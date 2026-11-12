import { localDateOf, resolveDayWindows, toLocalIntervals } from './time.ts';
import type { Interval, ScheduleException, TimeZone, WeeklySchedule } from './types.ts';

/** Escala + exceções vigentes num momento (antes ou depois de uma mudança). */
export interface WorkingHours {
  readonly weeklySchedule: WeeklySchedule;
  readonly exceptions: readonly ScheduleException[];
}

/**
 * Agendamentos que **a mudança** tirou do horário (Q-20, Q-26): cabiam em `before` e não cabem
 * em `after`. Quem já estava fora antes (ex.: agendamento manual fora da grade, Q-19) não volta.
 * Devolve os próprios objetos recebidos, na ordem de entrada.
 */
export function findAppointmentsNewlyOutsideWorkingHours<T extends Interval>(
  appointments: readonly T[],
  before: WorkingHours,
  after: WorkingHours,
  timeZone: TimeZone,
): T[] {
  const alreadyOutside = new Set(
    findAppointmentsOutsideWorkingHours(
      appointments,
      before.weeklySchedule,
      before.exceptions,
      timeZone,
    ),
  );
  return findAppointmentsOutsideWorkingHours(
    appointments,
    after.weeklySchedule,
    after.exceptions,
    timeZone,
  ).filter((appointment) => !alreadyOutside.has(appointment));
}

/**
 * Agendamentos fora do horário de trabalho. Base de `findAppointmentsNewlyOutsideWorkingHours`.
 *
 * Um agendamento `[start, end)` cabe se estiver inteiro dentro de uma janela do seu dia local
 * (RN-02), com a exceção da data valendo sobre a escala (RN-21), janelas encostadas unidas (Q-17)
 * e conversão de fuso/horário de verão pelos helpers de `time.ts` (Q-15). Atravessar a pausa
 * não cabe (RN-30). Devolve os próprios objetos recebidos, na ordem de entrada.
 */
export function findAppointmentsOutsideWorkingHours<T extends Interval>(
  appointments: readonly T[],
  weeklySchedule: WeeklySchedule,
  exceptions: readonly ScheduleException[],
  timeZone: TimeZone,
): T[] {
  const windowsByDate = new Map<string, Interval[]>();
  const windowsOf = (date: string): Interval[] => {
    let windows = windowsByDate.get(date);
    if (!windows) {
      windows = toLocalIntervals(
        date,
        resolveDayWindows(date, weeklySchedule, exceptions),
        timeZone,
      );
      windowsByDate.set(date, windows);
    }
    return windows;
  };

  return appointments.filter((appointment) => {
    const windows = windowsOf(localDateOf(appointment.start, timeZone));
    return !windows.some(
      (window) => window.start <= appointment.start && appointment.end <= window.end,
    );
  });
}
