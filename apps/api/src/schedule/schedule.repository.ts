import { Injectable } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { runInScheduleTransaction } from '../prisma/schedule-lock.js';
import type { AppointmentRow } from './schedule.mapper.js';

export type Tx = Prisma.TransactionClient;

/** Só agendamentos que ocupam a agenda contam como afetados (RN-51). */
const ACTIVE: Prisma.EnumAppointmentStatusFilter = { in: ['SCHEDULED', 'IN_PROGRESS'] };

const APPOINTMENT_SELECT = {
  id: true,
  startAt: true,
  endAt: true,
  serviceNameSnapshot: true,
  client: { select: { name: true } },
} as const satisfies Prisma.AppointmentSelect;

const EXCEPTION_INCLUDE = {
  windows: { orderBy: { startMin: 'asc' } },
} as const satisfies Prisma.ScheduleExceptionInclude;

type ExceptionRow = Prisma.ScheduleExceptionGetPayload<{ include: typeof EXCEPTION_INCLUDE }>;

/** Toda query filtra por `professionalId` do token (regra 5). */
@Injectable()
export class ScheduleRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Escritas de disponibilidade concorrem com holds/reservas: mesmo lock (ADR-0003, regra 1). */
  withLock<T>(professionalId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
    return runInScheduleTransaction(this.prisma, professionalId, fn);
  }

  /** Client fora de transação, para leituras: não disputam o lock com holds/reservas. */
  get reader(): Tx {
    return this.prisma;
  }

  async timezoneOf(tx: Tx, professionalId: string): Promise<string | null> {
    const row = await tx.professional.findUnique({
      where: { id: professionalId },
      select: { timezone: true },
    });
    return row?.timezone ?? null;
  }

  listWeekly(db: Tx, professionalId: string) {
    return db.weeklyScheduleWindow.findMany({
      where: { professionalId },
      select: { weekday: true, startMin: true, endMin: true },
      orderBy: [{ weekday: 'asc' }, { startMin: 'asc' }],
    });
  }

  async replaceWeekly(
    tx: Tx,
    professionalId: string,
    windows: { weekday: number; startMin: number; endMin: number }[],
  ): Promise<void> {
    await tx.weeklyScheduleWindow.deleteMany({ where: { professionalId } });
    await tx.weeklyScheduleWindow.createMany({
      data: windows.map((window) => ({ ...window, professionalId })),
    });
  }

  listExceptions(db: Tx, professionalId: string, from: Date, to: Date): Promise<ExceptionRow[]> {
    return db.scheduleException.findMany({
      where: { professionalId, date: { gte: from, lte: to } },
      include: EXCEPTION_INCLUDE,
      orderBy: { date: 'asc' },
    });
  }

  findException(db: Tx, professionalId: string, date: Date): Promise<ExceptionRow | null> {
    return db.scheduleException.findUnique({
      where: { professionalId_date: { professionalId, date } },
      include: EXCEPTION_INCLUDE,
    });
  }

  /** Cria ou substitui a exceção da data (com as janelas). */
  async replaceException(
    tx: Tx,
    professionalId: string,
    date: Date,
    data: { closed: boolean; note: string | null; windows: { startMin: number; endMin: number }[] },
  ): Promise<ExceptionRow> {
    await tx.scheduleException.deleteMany({ where: { professionalId, date } });
    return tx.scheduleException.create({
      data: {
        professionalId,
        date,
        closed: data.closed,
        note: data.note,
        windows: { create: data.windows },
      },
      include: EXCEPTION_INCLUDE,
    });
  }

  async deleteException(tx: Tx, professionalId: string, date: Date): Promise<boolean> {
    const { count } = await tx.scheduleException.deleteMany({ where: { professionalId, date } });
    return count > 0;
  }

  /** Agendamentos ativos com `start` em `[from, to)` e ainda não terminados em `now`. */
  activeAppointments(
    tx: Tx,
    professionalId: string,
    range: { from?: Date; to?: Date; endsAfter: Date },
  ): Promise<AppointmentRow[]> {
    return tx.appointment.findMany({
      where: {
        professionalId,
        status: ACTIVE,
        startAt: { ...(range.from && { gte: range.from }), ...(range.to && { lt: range.to }) },
        endAt: { gt: range.endsAfter },
      },
      select: APPOINTMENT_SELECT,
      orderBy: { startAt: 'asc' },
    });
  }

  /** Agendamentos ativos, não terminados em `now`, que se sobrepõem a `[start, end)`. */
  overlappingAppointments(
    tx: Tx,
    professionalId: string,
    range: { start: Date; end: Date; endsAfter: Date },
  ): Promise<AppointmentRow[]> {
    const endsAfter = range.endsAfter > range.start ? range.endsAfter : range.start;
    return tx.appointment.findMany({
      where: {
        professionalId,
        status: ACTIVE,
        startAt: { lt: range.end },
        endAt: { gt: endsAfter },
      },
      select: APPOINTMENT_SELECT,
      orderBy: { startAt: 'asc' },
    });
  }

  createBlock(
    tx: Tx,
    professionalId: string,
    data: { startAt: Date; endAt: Date; reason: string | null },
  ) {
    return tx.manualBlock.create({
      data: { ...data, professionalId },
      select: { id: true, startAt: true, endAt: true, reason: true },
    });
  }

  listBlocks(professionalId: string, from: Date, to: Date) {
    return this.prisma.manualBlock.findMany({
      where: { professionalId, startAt: { lt: to }, endAt: { gt: from } },
      select: { id: true, startAt: true, endAt: true, reason: true },
      orderBy: { startAt: 'asc' },
    });
  }

  async deleteBlock(tx: Tx, professionalId: string, id: string): Promise<boolean> {
    const { count } = await tx.manualBlock.deleteMany({ where: { id, professionalId } });
    return count > 0;
  }
}
