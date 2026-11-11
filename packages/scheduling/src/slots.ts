import {
  addLocalDays,
  intervalsOverlap,
  localDateOf,
  localTimeOf,
  localTimeToInstant,
  resolveDayWindows,
  toLocalIntervals,
} from './time.ts';
import type { BusyInterval, Interval, LocalTime, LocalWindow, SlotQuery } from './types.ts';

const MINUTE_MS = 60_000;
const SLOT_STEPS: readonly number[] = [5, 10, 15, 30]; // RN-23

const toMinutes = (time: LocalTime) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
const toLocalTime = (minutes: number): LocalTime =>
  `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

/** Valores vêm do banco/API em runtime: o tipo sozinho não impede um laço infinito. */
function assertValidQuery({ durationMin, settings }: SlotQuery): void {
  const problems: string[] = [];
  if (!Number.isInteger(durationMin) || durationMin <= 0)
    problems.push(`durationMin=${String(durationMin)}`);
  if (!SLOT_STEPS.includes(settings.slotStepMin))
    problems.push(`slotStepMin=${String(settings.slotStepMin)}`);
  if (!Number.isInteger(settings.bufferMin) || settings.bufferMin < 0 || settings.bufferMin > 60) {
    problems.push(`bufferMin=${String(settings.bufferMin)}`);
  }
  if (!Number.isInteger(settings.minNoticeMin) || settings.minNoticeMin < 0) {
    problems.push(`minNoticeMin=${String(settings.minNoticeMin)}`);
  }
  if (!Number.isInteger(settings.bookingHorizonDays) || settings.bookingHorizonDays < 0) {
    problems.push(`bookingHorizonDays=${String(settings.bookingHorizonDays)}`);
  }
  if (problems.length > 0) {
    throw new RangeError(`Parâmetros de agenda inválidos: ${problems.join(', ')}.`);
  }
}

/** Intervalo que de fato ocupa a agenda agora, ou `null` (RN-51, hold expirado). */
function occupiedInterval(busy: BusyInterval, now: Date): Interval | null {
  switch (busy.kind) {
    case 'appointment':
      return busy.status === 'SCHEDULED' || busy.status === 'IN_PROGRESS'
        ? { start: busy.start, end: busy.blockEnd }
        : null;
    case 'hold':
      return busy.expiresAt > now ? { start: busy.start, end: busy.blockEnd } : null;
    case 'block':
      return { start: busy.start, end: busy.end };
  }
}

/** Inícios da grade no relógio local (Q-16): `W0, W0+step, …` antes do fim da janela. */
function gridCandidates(query: SlotQuery, window: LocalWindow): Date[] {
  const { date, settings } = query;
  const candidates: Date[] = [];
  for (let m = toMinutes(window.start); m < toMinutes(window.end); m += settings.slotStepMin) {
    candidates.push(localTimeToInstant(date, toLocalTime(m), settings.timezone));
  }
  return candidates;
}

/**
 * Horários de início disponíveis para um serviço numa data local (seção 4 de
 * `docs/02-regras-de-negocio.md`, RN-30..36). Função pura: `now` vem da query.
 *
 * Devolve instantes UTC ordenados e sem duplicatas (RN-36). Em dias de troca de horário de
 * verão, cada horário local oferecido corresponde a um único instante — a 1ª ocorrência
 * (T8, Q-15, Q-16) —, então `localTimeToInstant(date, localTimeOf(slot))` devolve o próprio slot.
 */
export function computeAvailableSlots(query: SlotQuery): Date[] {
  assertValidQuery(query);
  const { date, durationMin, now, settings } = query;

  // RN-33: só de hoje até hoje + horizonte, pela data local da profissional (RN-02).
  const today = localDateOf(now, settings.timezone);
  if (date < today || date > addLocalDays(today, settings.bookingHorizonDays)) return [];

  const earliestStart = now.getTime() + settings.minNoticeMin * MINUTE_MS;
  const durationMs = durationMin * MINUTE_MS;
  const bufferMs = settings.bufferMin * MINUTE_MS;
  const occupied = query.busy
    .map((busy) => occupiedInterval(busy, now))
    .filter((interval): interval is Interval => interval !== null);

  const valid = new Map<number, Date>();
  for (const window of resolveDayWindows(date, query.weeklySchedule, query.exceptions)) {
    // Valida a janela e descarta as que ficam vazias no salto do horário de verão (Q-15).
    const [interval] = toLocalIntervals(date, [window], settings.timezone);
    if (!interval) continue;
    const w0 = interval.start.getTime();
    const w1 = interval.end.getTime();

    // RN-34: o fim de cada ocupação ativa dentro da janela também é candidato.
    const fitCandidates = occupied
      .map((busy) => busy.end)
      .filter((end) => end.getTime() >= w0 && end.getTime() < w1);

    for (const t of [...gridCandidates(query, window), ...fitCandidates]) {
      const start = t.getTime();
      if (valid.has(start)) continue; // encaixe que coincide com a grade
      const fitsWindow = start >= w0 && start + durationMs <= w1; // RN-30 (RN-35: sem buffer)
      const respectsNotice = start >= earliestStart; // RN-33
      if (!fitsWindow || !respectsNotice) continue;
      // RN-31/32: o candidato leva o buffer vigente; ocupações já trazem o blockEnd gravado.
      const candidate = { start: t, end: new Date(start + durationMs + bufferMs) };
      const isFree = !occupied.some((busy) => intervalsOverlap(candidate, busy));
      if (isFree) valid.set(start, t);
    }
  }

  // Q-16: um horário local, um instante (a 1ª ocorrência). Descarta encaixes na 2ª ocorrência
  // de uma hora repetida, que a UI não conseguiria distinguir pelo rótulo.
  const isCanonical = (slot: Date) =>
    localTimeToInstant(date, localTimeOf(slot, settings.timezone), settings.timezone).getTime() ===
    slot.getTime();

  return [...valid.values()].filter(isCanonical).sort((a, b) => a.getTime() - b.getTime()); // RN-36
}
