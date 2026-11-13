import { describe, expect, it } from 'vitest';
import { buildConfirmationMessage, buildWhatsAppShareLink } from '../whatsapp';

const booking = {
  startAt: '2026-11-13T13:15:00.000Z',
  serviceName: 'Esmaltação em Gel',
  priceCents: 7500,
  timezone: 'America/Sao_Paulo',
  businessName: 'Studio Ana',
};

describe('mensagem de confirmação (template padrão do doc 06)', () => {
  it('RN-02a / RN-77: data e hora no fuso da profissional, valor em BRL', () => {
    const message = buildConfirmationMessage({
      ...booking,
      clientName: 'Maria',
      location: 'Rua das Flores, 10 · São Paulo – SP',
    });
    expect(message).toBe(
      [
        'Olá Maria, seu agendamento foi confirmado!',
        '📅 Data: 13/11/2026 às 10:15',
        '💅 Serviço: Esmaltação em Gel',
        '💰 Valor: R$ 75,00',
        '📍 Endereço: Rua das Flores, 10 · São Paulo – SP',
        '👤 Profissional: Studio Ana',
      ].join('\n'),
    );
  });

  it('Q-27: sem endereço publicado, a linha não aparece', () => {
    const message = buildConfirmationMessage({ ...booking, clientName: 'Maria', location: null });
    expect(message).not.toContain('Endereço');
  });

  it('RN-02a: fuso com horário de verão (Nova York)', () => {
    const message = buildConfirmationMessage({
      ...booking,
      timezone: 'America/New_York',
      startAt: '2026-11-01T05:30:00.000Z',
      clientName: 'Maria',
      location: null,
    });
    expect(message).toContain('📅 Data: 01/11/2026 às 01:30');
  });
});

describe('buildWhatsAppShareLink (Q-32)', () => {
  it('Q-32: sem número — a cliente escolhe a quem encaminhar', () => {
    const link = buildWhatsAppShareLink('Olá & até já? 💅\nlinha 2');
    expect(link.startsWith('https://wa.me/?text=')).toBe(true);
    expect(decodeURIComponent(link.slice('https://wa.me/?text='.length))).toBe(
      'Olá & até já? 💅\nlinha 2',
    );
  });
});
