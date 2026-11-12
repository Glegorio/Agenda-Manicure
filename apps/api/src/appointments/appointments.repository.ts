import { Injectable } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { runInScheduleTransaction } from '../prisma/schedule-lock.js';

export type Tx = Prisma.TransactionClient;

/** RN-51: só estes ocupam a agenda. */
const ACTIVE: Prisma.EnumAppointmentStatusFilter = { in: ['SCHEDULED', 'IN_PROGRESS'] };

export const APPOINTMENT_INCLUDE = {
  client: { select: { id: true, name: true, phoneE164: true } },
} as const satisfies Prisma.AppointmentInclude;

export type AppointmentRow = Prisma.AppointmentGetPayload<{ include: typeof APPOINTMENT_INCLUDE }>;

/** Toda query filtra por `professionalId` do token (regra 5). */
@Injectable()
export class AppointmentsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Escritas que ocupam a agenda: mesmo lock de holds e reservas (ADR-0003, regra 1). */
  withLock<T>(professionalId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
    return runInScheduleTransaction(this.prisma, professionalId, fn);
  }

  /** Transição só libera a agenda (RN-51): transação simples, sem o lock. */
  transaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(fn);
  }

  get reader(): Tx {
    return this.prisma;
  }

  /** Agendamentos que tocam `[from, to)`, de qualquer status, por início. */
  listOverlapping(db: Tx, professionalId: string, from: Date, to: Date): Promise<AppointmentRow[]> {
    return db.appointment.findMany({
      where: { professionalId, startAt: { lt: to }, endAt: { gt: from } },
      include: APPOINTMENT_INCLUDE,
      orderBy: [{ startAt: 'asc' }, { id: 'asc' }],
    });
  }

  find(db: Tx, professionalId: string, id: string): Promise<AppointmentRow | null> {
    return db.appointment.findFirst({
      where: { id, professionalId },
      include: APPOINTMENT_INCLUDE,
    });
  }

  activeService(tx: Tx, professionalId: string, id: string) {
    return tx.service.findFirst({
      where: { id, professionalId, active: true },
      select: { id: true, name: true, priceCents: true, durationMin: true },
    });
  }

  async bufferMinOf(tx: Tx, professionalId: string): Promise<number | null> {
    const row = await tx.professional.findUnique({
      where: { id: professionalId },
      select: { bufferMin: true },
    });
    return row?.bufferMin ?? null;
  }

  /** RN-31/RN-42: algum agendamento ativo ou hold não expirado intersecta `[start, blockEnd)`? */
  async hasConflict(
    tx: Tx,
    professionalId: string,
    startAt: Date,
    blockEndAt: Date,
    now: Date,
  ): Promise<boolean> {
    const overlap = { startAt: { lt: blockEndAt }, blockEndAt: { gt: startAt } };
    const [appointments, holds] = await Promise.all([
      tx.appointment.count({ where: { professionalId, status: ACTIVE, ...overlap } }),
      tx.slotHold.count({ where: { professionalId, expiresAt: { gt: now }, ...overlap } }),
    ]);
    return appointments + holds > 0;
  }

  /** RN-81 aplicado ao app (Q-19): cliente existente é reaproveitada sem alteração. */
  upsertClient(tx: Tx, professionalId: string, name: string, phoneE164: string) {
    return tx.client.upsert({
      where: { professionalId_phoneE164: { professionalId, phoneE164 } },
      update: {},
      create: { professionalId, name, phoneE164, source: 'MANUAL' },
      select: { id: true },
    });
  }

  create(tx: Tx, data: Prisma.AppointmentUncheckedCreateInput): Promise<AppointmentRow> {
    return tx.appointment.create({ data, include: APPOINTMENT_INCLUDE });
  }

  /** Update condicionado ao status lido (doc 05): 0 linhas → outra transição venceu. */
  async updateIfStatus(
    tx: Tx,
    professionalId: string,
    id: string,
    from: AppointmentRow['status'],
    data: Prisma.AppointmentUncheckedUpdateManyInput,
  ): Promise<boolean> {
    const { count } = await tx.appointment.updateMany({
      where: { id, professionalId, status: from },
      data,
    });
    return count === 1;
  }
}
