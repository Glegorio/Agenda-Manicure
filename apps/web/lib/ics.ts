/** Arquivo de calendário (.ics, RFC 5545) para "adicionar ao calendário" (3.6). */

interface IcsEvent {
  /** Id do agendamento: o mesmo evento importado de novo não duplica. */
  uid: string;
  startAt: string;
  endAt: string;
  summary: string;
  location?: string | null;
  description?: string;
  now?: Date;
}

/** RN-01: instantes em UTC (`20261113T131500Z`). */
const utc = (instant: string | Date) =>
  new Date(instant)
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');

/** Escape de texto do RFC 5545 (§3.3.11). */
const escapeText = (text: string) =>
  text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    // Qualquer quebra (inclusive `\r` sozinho) vira `\n` escapado: texto da profissional não
    // pode abrir uma propriedade nova no calendário da cliente.
    .replace(/\r\n|\r|\n/g, '\\n')
    // eslint-disable-next-line no-control-regex -- remove de propósito os caracteres de controle
    .replace(/[\x00-\x08\x0B-\x1F\x7F]/g, '');

const encoder = new TextEncoder();

/** Dobra a linha em até 75 octetos UTF-8 (§3.1), sem partir caracteres. */
function fold(line: string): string {
  const parts: string[] = [];
  let current = '';
  let size = 0;
  for (const char of line) {
    const bytes = encoder.encode(char).length;
    // A continuação começa com um espaço, que também conta.
    const limit = parts.length === 0 ? 75 : 74;
    if (size + bytes > limit) {
      parts.push(current);
      current = '';
      size = 0;
    }
    current += char;
    size += bytes;
  }
  parts.push(current);
  return parts.join('\r\n ');
}

export function buildIcs(event: IcsEvent): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Agende//Agendamento//PT-BR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${escapeText(event.uid)}@agende`,
    `DTSTAMP:${utc(event.now ?? new Date())}`,
    `DTSTART:${utc(event.startAt)}`,
    `DTEND:${utc(event.endAt)}`,
    `SUMMARY:${escapeText(event.summary)}`,
    ...(event.location ? [`LOCATION:${escapeText(event.location)}`] : []),
    ...(event.description ? [`DESCRIPTION:${escapeText(event.description)}`] : []),
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return `${lines.map(fold).join('\r\n')}\r\n`;
}
