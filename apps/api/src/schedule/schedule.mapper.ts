import type {
  AffectedAppointment,
  BlockResponse,
  ExceptionResponse,
  WeeklyScheduleResponse,
} from '@agende/contracts';
import type { LocalWindow, ScheduleException, Weekday, WeeklySchedule } from '@agende/scheduling';

/** `HH:mm` ↔ minutos desde a meia-noite local (doc 04; `24:00` = 1440, Q-15). */
export function timeToMinutes(time: string): number {
  return Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
}

export function minutesToTime(minutes: number): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
}

/** Coluna `date` do Postgres ↔ data local `YYYY-MM-DD` (o Prisma usa meia-noite UTC). */
export function localDateToDb(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

export function dbToLocalDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export interface WindowRow {
  weekday: number;
  startMin: number;
  endMin: number;
}

export interface ExceptionRow {
  date: Date;
  closed: boolean;
  note: string | null;
  windows: { startMin: number; endMin: number }[];
}

export interface AppointmentRow {
  id: string;
  startAt: Date;
  endAt: Date;
  serviceNameSnapshot: string;
  client: { name: string };
}

const toLocalWindow = (w: { startMin: number; endMin: number }): LocalWindow => ({
  start: minutesToTime(w.startMin),
  end: minutesToTime(w.endMin),
});

/** Linhas do banco → tipos do domínio (`@agende/scheduling`). Reaproveitado pela 2.7. */
export function toWeeklySchedule(rows: readonly WindowRow[]): WeeklySchedule {
  const schedule: Partial<Record<Weekday, LocalWindow[]>> = {};
  for (const row of rows) (schedule[row.weekday as Weekday] ??= []).push(toLocalWindow(row));
  return schedule;
}

export function toDomainException(row: ExceptionRow): ScheduleException {
  const date = dbToLocalDate(row.date);
  return row.closed
    ? { date, closed: true }
    : { date, closed: false, windows: row.windows.map(toLocalWindow) };
}

/** Linhas do banco → respostas da API (`@agende/contracts`). */
export function toWeeklyResponse(rows: readonly WindowRow[]): WeeklyScheduleResponse {
  return { windows: rows.map((row) => ({ weekday: row.weekday, ...toLocalWindow(row) })) };
}

export function toExceptionResponse(row: ExceptionRow): ExceptionResponse {
  return {
    date: dbToLocalDate(row.date),
    closed: row.closed,
    windows: row.windows.map(toLocalWindow),
    note: row.note,
  };
}

export function toBlockResponse(row: {
  id: string;
  startAt: Date;
  endAt: Date;
  reason: string | null;
}): BlockResponse {
  return {
    id: row.id,
    startAt: row.startAt.toISOString(),
    endAt: row.endAt.toISOString(),
    reason: row.reason,
  };
}

export function toAffected(row: AppointmentRow): AffectedAppointment {
  return {
    id: row.id,
    startAt: row.startAt.toISOString(),
    endAt: row.endAt.toISOString(),
    serviceName: row.serviceNameSnapshot,
    clientName: row.client.name,
  };
}
