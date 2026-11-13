/**
 * Datas e horas da web booking. Instantes chegam da API em UTC; tudo é exibido no fuso da
 * profissional (RN-02a) com `Intl`, sem biblioteca no cliente. Datas locais são `YYYY-MM-DD`.
 */

const LOCALE = 'pt-BR';

const timeFormat = (timeZone: string) =>
  new Intl.DateTimeFormat(LOCALE, {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });

/** `2026-11-13T13:15:00Z` em São Paulo → `10:15`. */
export function formatSlotTime(iso: string, timeZone: string): string {
  return timeFormat(timeZone).format(new Date(iso));
}

/** Meio-dia UTC: o dia da semana e o rótulo de uma data local não dependem de fuso. */
const noonUtc = (date: string) => new Date(`${date}T12:00:00Z`);

/** `2026-11-13` → `sexta-feira, 13 de novembro`. */
export function formatDateLabel(date: string): string {
  return new Intl.DateTimeFormat(LOCALE, {
    timeZone: 'UTC',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(noonUtc(date));
}

/** Rótulo completo do botão de horário (doc 07): `sexta-feira, 13 de novembro, 10:15`. */
export function formatSlotLabel(iso: string, timeZone: string): string {
  return `${formatDateLabel(localDateOf(iso, timeZone))}, ${formatSlotTime(iso, timeZone)}`;
}

/** Data local (`YYYY-MM-DD`) de um instante no fuso dado (en-CA formata como ISO). */
export function localDateOf(instant: string | Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(instant));
}

/** RN-02: "hoje" no fuso da profissional. */
export function todayIn(timeZone: string, now: Date = new Date()): string {
  return localDateOf(now, timeZone);
}

export function addDays(date: string, days: number): string {
  const d = noonUtc(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** `2026-11` → mês seguinte (`1`) ou anterior (`-1`). */
export function addMonths(month: string, months: number): string {
  const d = noonUtc(`${month}-01`);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 7);
}

export function lastDayOfMonth(month: string): string {
  return addDays(`${addMonths(month, 1)}-01`, -1);
}

/** Células do calendário (semana começa no domingo): `null` antes do dia 1. */
export function monthGrid(month: string): (string | null)[] {
  const first = `${month}-01`;
  const blanks = noonUtc(first).getUTCDay();
  const days: string[] = [];
  for (let d = first; d.startsWith(month); d = addDays(d, 1)) days.push(d);
  return [...Array<null>(blanks).fill(null), ...days];
}

/** `novembro de 2026`. */
export function formatMonthLabel(month: string): string {
  return new Intl.DateTimeFormat(LOCALE, {
    timeZone: 'UTC',
    month: 'long',
    year: 'numeric',
  }).format(noonUtc(`${month}-01`));
}

/** `America/Sao_Paulo` → `Horário Padrão de Brasília` (nome legível para o aviso de fuso). */
export function formatTimeZoneName(timeZone: string, at: Date = new Date()): string {
  const part = new Intl.DateTimeFormat(LOCALE, { timeZone, timeZoneName: 'long' })
    .formatToParts(at)
    .find((p) => p.type === 'timeZoneName');
  return part?.value ?? timeZone;
}

/** RN-02a: avisar o fuso só quando o navegador está em outro. */
export function shouldShowTimezone(professionalTz: string, browserTz: string): boolean {
  return professionalTz !== browserTz;
}

export function browserTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}
