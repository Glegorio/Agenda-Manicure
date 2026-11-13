import { describe, expect, it } from 'vitest';
import { buildIcs } from '../ics';

const event = {
  uid: '01a1d4c4-ae02-742d-811c-1a062bb4fa99',
  startAt: '2026-11-13T13:15:00.000Z',
  endAt: '2026-11-13T14:15:00.000Z',
  summary: 'Esmaltação em Gel — Studio Ana',
  location: 'Rua das Flores, 10 · São Paulo – SP',
  description: 'Valor: R$ 75,00',
  now: new Date('2026-11-12T12:00:00Z'),
};

const lines = (ics: string) => ics.split('\r\n');
const unfold = (ics: string) => ics.replace(/\r\n /g, '');

describe('buildIcs (RFC 5545)', () => {
  it('linhas terminam em CRLF, com VCALENDAR e VEVENT', () => {
    const ics = buildIcs(event);
    expect(ics.endsWith('\r\n')).toBe(true);
    expect(ics.replace(/\r\n/g, '')).not.toContain('\n');
    expect(lines(ics)).toEqual(
      expect.arrayContaining([
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'BEGIN:VEVENT',
        'END:VEVENT',
        'END:VCALENDAR',
      ]),
    );
  });

  it('RN-01: início e fim em UTC com Z', () => {
    const ics = unfold(buildIcs(event));
    expect(ics).toContain('DTSTART:20261113T131500Z');
    expect(ics).toContain('DTEND:20261113T141500Z');
    expect(ics).toContain('DTSTAMP:20261112T120000Z');
  });

  it('UID estável por agendamento', () => {
    expect(unfold(buildIcs(event))).toContain(`UID:${event.uid}@agende`);
  });

  it('escapa vírgula, ponto e vírgula, barra invertida e quebra de linha', () => {
    const ics = unfold(buildIcs({ ...event, description: 'a, b; c \\ d\ne' }));
    expect(ics).toContain('DESCRIPTION:a\\, b\\; c \\\\ d\\ne');
  });

  it('\\r sozinho e caracteres de controle não abrem propriedade nova', () => {
    const ics = buildIcs({ ...event, summary: 'Gel\rURL:https://phishing.example\x07' });
    expect(lines(ics).some((l) => l.startsWith('URL:'))).toBe(false);
    expect(ics.replace(/\r\n/g, '')).not.toMatch(/\p{Cc}/u);
    expect(ics.replace(/\r\n/g, '')).not.toContain('\r');
    expect(unfold(ics)).toContain('SUMMARY:Gel\\nURL:https://phishing.example');
  });

  it('dobra linhas longas em até 75 octetos UTF-8 sem partir caracteres', () => {
    const long = 'Manicure, pedicure e esmaltação em gel com decoração'.repeat(3);
    const ics = buildIcs({ ...event, summary: long });
    for (const line of lines(ics)) {
      expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    }
    expect(unfold(ics)).toContain(`SUMMARY:${long.replace(/,/g, '\\,')}`);
  });

  it('sem endereço não gera LOCATION', () => {
    const ics = buildIcs({ ...event, location: null });
    expect(ics).not.toContain('LOCATION');
  });
});
