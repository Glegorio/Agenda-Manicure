import { Injectable } from '@nestjs/common';
import type { ServiceInput, ServiceResponse, ServiceUpdate } from '@agende/contracts';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { runInScheduleTransaction } from '../prisma/schedule-lock.js';

const SERVICE_SELECT = {
  id: true,
  name: true,
  category: true,
  description: true,
  priceCents: true,
  durationMin: true,
  imageUrl: true,
  active: true,
  public: true,
  sortOrder: true,
} as const satisfies Prisma.ServiceSelect;

/** Tira as chaves `undefined` da saída do Zod (exigido por `exactOptionalPropertyTypes`). */
function defined<T extends object>(patch: T): { [K in keyof T]: Exclude<T[K], undefined> } {
  return Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined)) as {
    [K in keyof T]: Exclude<T[K], undefined>;
  };
}

/** Toda query filtra por `professionalId` vindo do token (regra 5). */
@Injectable()
export class ServicesRepository {
  constructor(private readonly prisma: PrismaService) {}

  list(professionalId: string): Promise<ServiceResponse[]> {
    return this.prisma.service.findMany({
      where: { professionalId },
      select: SERVICE_SELECT,
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    });
  }

  find(professionalId: string, id: string): Promise<ServiceResponse | null> {
    return this.prisma.service.findFirst({ where: { id, professionalId }, select: SERVICE_SELECT });
  }

  /** Entra no fim da lista; o lock da profissional evita dois serviços com o mesmo sortOrder. */
  create(professionalId: string, input: ServiceInput): Promise<ServiceResponse> {
    return runInScheduleTransaction(this.prisma, professionalId, async (tx) => {
      const { _max } = await tx.service.aggregate({
        where: { professionalId },
        _max: { sortOrder: true },
      });
      return tx.service.create({
        data: {
          ...defined(input),
          professionalId,
          sortOrder: (_max.sortOrder ?? -1) + 1,
        },
        select: SERVICE_SELECT,
      });
    });
  }

  async update(
    professionalId: string,
    id: string,
    patch: ServiceUpdate,
  ): Promise<ServiceResponse | null> {
    const { count } = await this.prisma.service.updateMany({
      where: { id, professionalId },
      data: defined(patch),
    });
    return count === 0 ? null : this.find(professionalId, id);
  }

  /**
   * RN-12 / Q-24: apaga se o serviço nunca foi usado; senão desativa. Agendamentos de qualquer
   * status contam (histórico dos relatórios, RN-74), e holds **ativos** também: apagar removeria o
   * hold em cascata e derrubaria uma reserva em andamento (Q-23). Hold expirado some sem dano. Sob o lock da agenda (ADR-0003), um
   * hold ou agendamento não aparece entre a checagem e o delete.
   */
  remove(
    professionalId: string,
    id: string,
    now: Date,
  ): Promise<'DELETED' | 'DEACTIVATED' | 'NOT_FOUND'> {
    return runInScheduleTransaction(this.prisma, professionalId, async (tx) => {
      const service = await tx.service.findFirst({
        where: { id, professionalId },
        select: {
          _count: {
            select: { appointments: true, slotHolds: { where: { expiresAt: { gt: now } } } },
          },
        },
      });
      if (!service) return 'NOT_FOUND';
      if (service._count.appointments > 0 || service._count.slotHolds > 0) {
        await tx.service.update({ where: { id }, data: { active: false } });
        return 'DEACTIVATED';
      }
      await tx.service.delete({ where: { id } });
      return 'DELETED';
    });
  }
}
