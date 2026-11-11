import { TZDate } from '@date-fns/tz';
import type {
  Interval,
  LocalDate,
  LocalTime,
  LocalWindow,
  ScheduleException,
  TimeZone,
  Weekday,
  WeeklySchedule,
} from './types.ts';

const LOCAL_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const LOCAL_TIME = /^([01]\d|2[0-3]):([0-5]\d)$|^24:00$/;

function parseLocalDate(date: LocalDate): { year: number; month: number; day: number } {
  const match = LOCAL_DATE.exec(date);
  if (match) {
    const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
    // Rejeita datas que o calendário "corrige" (ex.: 2026-02-30 → 2026-03-02).
    const probe = new Date(Date.UTC(year, month - 1, day));
    if (probe.getUTCMonth() === month - 1 && probe.getUTCDate() === day) {
      return { year, month, day };
    }
  }
  throw new RangeError(`Data local inválida: "${date}" (esperado YYYY-MM-DD).`);
}

function parseLocalTime(time: LocalTime): { hours: number; minutes: number } {
  if (!LOCAL_TIME.test(time)) {
    throw new RangeError(`Hora local inválida: "${time}" (esperado HH:mm, 00:00–24:00).`);
  }
  const [hours, minutes] = time.split(':').map(Number) as [number, number];
  return { hours, minutes };
}

const validTimeZones = new Set<TimeZone>();

function assertTimeZone(timeZone: TimeZone): void {
  if (validTimeZones.has(timeZone)) return;
  // Intl lança RangeError para fuso IANA desconhecido. Cache: chamado milhares de vezes por consulta.
  new Intl.DateTimeFormat('en-US', { timeZone });
  validTimeZones.add(timeZone);
}

const pad = (value: number, length = 2) => String(value).padStart(length, '0');

const MINUTE_MS = 60_000;
/** Do maior para o menor: o primeiro que bater é a ocorrência mais cedo. */
const AMBIGUITY_SHIFTS_MIN = [120, 60, 30] as const;

/** Minutos desde a meia-noite local de `date`; instante do dia anterior conta como -1. */
function localMinuteOfDay(instant: number, date: LocalDate, timeZone: TimeZone): number {
  const zoned = new TZDate(instant, timeZone);
  const zonedDate = `${pad(zoned.getFullYear(), 4)}-${pad(zoned.getMonth() + 1)}-${pad(zoned.getDate())}`;
  if (zonedDate < date) return -1;
  return zoned.getHours() * 60 + zoned.getMinutes();
}

/**
 * Instante UTC de uma hora local no fuso informado (RN-02). `24:00` = início do dia seguinte.
 * Hora ambígua (retorno do horário de verão) usa a primeira ocorrência.
 * Hora inexistente (salto do horário de verão) vira o primeiro instante após o salto (Q-15):
 * assim uma janela nunca avança sobre horas locais que a profissional não configurou.
 */
export function localTimeToInstant(date: LocalDate, time: LocalTime, timeZone: TimeZone): Date {
  const { year, month, day } = parseLocalDate(date);
  const { hours, minutes } = parseLocalTime(time);
  assertTimeZone(timeZone);
  if (hours === 24) {
    return localTimeToInstant(addLocalDays(date, 1), '00:00', timeZone);
  }
  const requested = hours * 60 + minutes;
  let instant = new TZDate(year, month - 1, day, hours, minutes, timeZone).getTime();

  // Hora ambígua: o TZDate pode devolver a 2ª ocorrência; procura a mais cedo com o mesmo
  // horário local (deslocamentos de DST reais: 30, 60 ou 120 min).
  for (const shiftMin of AMBIGUITY_SHIFTS_MIN) {
    const earlier = instant - shiftMin * MINUTE_MS;
    if (localMinuteOfDay(earlier, date, timeZone) === requested) {
      instant = earlier;
      break;
    }
  }

  // Hora inexistente: o TZDate a empurra pelo tamanho do salto; recua até o fim do salto.
  while (localMinuteOfDay(instant - MINUTE_MS, date, timeZone) >= requested) {
    instant -= MINUTE_MS;
  }
  return new Date(instant);
}

/** Data local (`YYYY-MM-DD`) de um instante no fuso informado (RN-02). */
export function localDateOf(instant: Date, timeZone: TimeZone): LocalDate {
  if (Number.isNaN(instant.getTime())) {
    throw new RangeError('Instante inválido (Invalid Date).');
  }
  assertTimeZone(timeZone);
  const zoned = new TZDate(instant.getTime(), timeZone);
  return `${pad(zoned.getFullYear(), 4)}-${pad(zoned.getMonth() + 1)}-${pad(zoned.getDate())}`;
}

/** Hora local (`HH:mm`) de um instante no fuso informado (RN-02). */
export function localTimeOf(instant: Date, timeZone: TimeZone): LocalTime {
  if (Number.isNaN(instant.getTime())) {
    throw new RangeError('Instante inválido (Invalid Date).');
  }
  assertTimeZone(timeZone);
  const zoned = new TZDate(instant.getTime(), timeZone);
  return `${pad(zoned.getHours())}:${pad(zoned.getMinutes())}`;
}

/** Soma (ou subtrai) dias de calendário a uma data local. Independe de fuso. */
export function addLocalDays(date: LocalDate, days: number): LocalDate {
  if (!Number.isInteger(days)) {
    throw new RangeError(`Quantidade de dias inválida: ${String(days)} (esperado inteiro).`);
  }
  const { year, month, day } = parseLocalDate(date);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return `${pad(shifted.getUTCFullYear(), 4)}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`;
}

/** Dia da semana de uma data local: 0 = domingo … 6 = sábado. */
export function weekdayOf(date: LocalDate): Weekday {
  const { year, month, day } = parseLocalDate(date);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay() as Weekday;
}

/**
 * Janelas de trabalho de uma data local, ordenadas por início e sem sobreposição.
 * Exceção da data (RN-21) tem precedência sobre a escala semanal (RN-20).
 * Janelas que se encostam ou se sobrepõem viram uma só: pausa é só o espaço entre janelas (Q-17).
 */
export function resolveDayWindows(
  date: LocalDate,
  weeklySchedule: WeeklySchedule,
  exceptions: readonly ScheduleException[],
): LocalWindow[] {
  const exception = exceptions.find((candidate) => candidate.date === date);
  const windows = exception
    ? exception.closed
      ? []
      : exception.windows
    : (weeklySchedule[weekdayOf(date)] ?? []);
  // `HH:mm` com zero à esquerda ordena e compara corretamente como texto.
  const sorted = [...windows].sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));

  const merged: LocalWindow[] = [];
  for (const window of sorted) {
    const last = merged.at(-1);
    if (last && window.start <= last.end) {
      merged[merged.length - 1] = {
        start: last.start,
        end: window.end > last.end ? window.end : last.end,
      };
    } else {
      merged.push(window);
    }
  }
  return merged;
}

/**
 * Converte janelas locais de uma data em intervalos UTC meio-abertos `[start, end)`.
 * Janelas que ficam vazias após a conversão (inteiras dentro de um salto de DST) são descartadas.
 */
export function toLocalIntervals(
  date: LocalDate,
  windows: readonly LocalWindow[],
  timeZone: TimeZone,
): Interval[] {
  return windows
    .map((window) => {
      parseLocalTime(window.start);
      parseLocalTime(window.end);
      if (window.start >= window.end) {
        throw new RangeError(`Janela inválida: ${window.start}–${window.end} (início ≥ fim).`);
      }
      return {
        start: localTimeToInstant(date, window.start, timeZone),
        end: localTimeToInstant(date, window.end, timeZone),
      };
    })
    .filter((interval) => interval.start < interval.end);
}

/** Sobreposição de intervalos meio-abertos: encostar (`a.end === b.start`) não sobrepõe. */
export function intervalsOverlap(a: Interval, b: Interval): boolean {
  return a.start < b.end && b.start < a.end;
}
