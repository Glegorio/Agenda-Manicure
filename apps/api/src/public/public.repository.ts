import { Injectable } from '@nestjs/common';
import type { BusyInterval } from '@agende/scheduling';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { ExceptionRow, WindowRow } from '../schedule/schedule.mapper.js';

const PUBLIC_PROFILE_SELECT = {
  id: true,
  slug: true,
  businessName: true,
  timezone: true,
  addressLine: true,
  showFullAddress: true,
  city: true,
  state: true,
  logoUrl: true,
  coverUrl: true,
  themePalette: true,
  themeMode: true,
  cancellationPolicy: true,
  bufferMin: true,
  slotStepMin: true,
  minNoticeMin: true,
  bookingHorizonDays: true,
} as const satisfies Prisma.ProfessionalSelect;

export type PublicProfessional = Prisma.ProfessionalGetPayload<{
  select: typeof PUBLIC_PROFILE_SELECT;
}>;

const PUBLIC_SERVICE_SELECT = {
  id: true,
  name: true,
  category: true,
  description: true,
  priceCents: true,
  durationMin: true,
  imageUrl: true,
} as const satisfies Prisma.ServiceSelect;

/** Serviço visível na página pública (RN-91). */
const VISIBLE = { active: true, public: true } as const;

/** Client global (leituras soltas) ou o `tx` de uma transação sob o lock da agenda (2.8). */
export type Db = Prisma.TransactionClient;

/**
 * Leituras da página pública. Sem lock (ADR-0003 serializa escritas) e sem dados de clientes:
 * ocupações viram só intervalos (regra de endpoints `public/*`).
 */
@Injectable()
export class PublicRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** `slug` é citext: a busca não diferencia maiúsculas (RN-90). */
  findProfessionalBySlug(slug: string, db: Db = this.prisma): Promise<PublicProfessional | null> {
    return db.professional.findUnique({ where: { slug }, select: PUBLIC_PROFILE_SELECT });
  }

  listVisibleServices(professionalId: string) {
    return this.prisma.service.findMany({
      where: { professionalId, ...VISIBLE },
      select: PUBLIC_SERVICE_SELECT,
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    });
  }

  findVisibleService(professionalId: string, id: string, db: Db = this.prisma) {
    return db.service.findFirst({
      where: { id, professionalId, ...VISIBLE },
      select: { id: true, name: true, priceCents: true, durationMin: true },
    });
  }

  listWeekly(professionalId: string, db: Db = this.prisma): Promise<WindowRow[]> {
    return db.weeklyScheduleWindow.findMany({
      where: { professionalId },
      select: { weekday: true, startMin: true, endMin: true },
    });
  }

  listExceptions(
    professionalId: string,
    from: Date,
    to: Date,
    db: Db = this.prisma,
  ): Promise<ExceptionRow[]> {
    return db.scheduleException.findMany({
      where: { professionalId, date: { gte: from, lte: to } },
      include: { windows: { orderBy: { startMin: 'asc' } } },
    });
  }

  /**
   * Tudo que pode ocupar `[from, to)` (doc 02 §4, passo 2), por **sobreposição** — inclui o que
   * começou antes do período. Agendamentos e holds ocupam até o `blockEndAt` gravado (RN-42);
   * holds vêm com `expiresAt` e o domínio descarta os expirados (T5).
   */
  async busyBetween(
    professionalId: string,
    from: Date,
    to: Date,
    db: Db = this.prisma,
  ): Promise<BusyInterval[]> {
    // Em sequência: dentro de uma transação (2.8) o client não aceita consultas paralelas.
    const appointments = await db.appointment.findMany({
      where: {
        professionalId,
        status: { in: ['SCHEDULED', 'IN_PROGRESS'] },
        startAt: { lt: to },
        blockEndAt: { gt: from },
      },
      select: { status: true, startAt: true, endAt: true, blockEndAt: true },
    });
    const holds = await db.slotHold.findMany({
      where: { professionalId, startAt: { lt: to }, blockEndAt: { gt: from } },
      select: { startAt: true, endAt: true, blockEndAt: true, expiresAt: true },
    });
    const blocks = await db.manualBlock.findMany({
      where: { professionalId, startAt: { lt: to }, endAt: { gt: from } },
      select: { startAt: true, endAt: true },
    });
    return [
      ...appointments.map((a): BusyInterval => ({
        kind: 'appointment',
        status: a.status,
        start: a.startAt,
        end: a.endAt,
        blockEnd: a.blockEndAt,
      })),
      ...holds.map((h): BusyInterval => ({
        kind: 'hold',
        start: h.startAt,
        end: h.endAt,
        blockEnd: h.blockEndAt,
        expiresAt: h.expiresAt,
      })),
      ...blocks.map((b): BusyInterval => ({ kind: 'block', start: b.startAt, end: b.endAt })),
    ];
  }
}
