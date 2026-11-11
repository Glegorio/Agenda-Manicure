import { describe, expect, it } from 'vitest';
import {
  APPOINTMENT_STATUSES,
  canTransition,
  occupiesSchedule,
  validateTransition,
} from '../lifecycle.ts';
import type { AppointmentStatus } from '../types.ts';

/** Tabela da RN-54, escrita à mão (fonte: docs/02-regras-de-negocio.md). */
const ALLOWED: Record<AppointmentStatus, AppointmentStatus[]> = {
  SCHEDULED: ['IN_PROGRESS', 'COMPLETED', 'NO_SHOW', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  NO_SHOW: [],
  CANCELLED: [],
};

const ALL_PAIRS = APPOINTMENT_STATUSES.flatMap((from) =>
  APPOINTMENT_STATUSES.map((to) => [from, to, ALLOWED[from].includes(to)] as const),
);

describe('APPOINTMENT_STATUSES', () => {
  it('RN-50: são exatamente os cinco status', () => {
    expect([...APPOINTMENT_STATUSES].sort()).toEqual(
      ['CANCELLED', 'COMPLETED', 'IN_PROGRESS', 'NO_SHOW', 'SCHEDULED'].sort(),
    );
  });
});

describe('canTransition', () => {
  it.each(ALL_PAIRS)('RN-54: %s → %s permitido = %s', (from, to, allowed) => {
    expect(canTransition(from, to)).toBe(allowed);
  });

  it('RN-54: nenhum status transita para si mesmo', () => {
    for (const status of APPOINTMENT_STATUSES) expect(canTransition(status, status)).toBe(false);
  });

  it('RN-54: nada volta para SCHEDULED', () => {
    for (const status of APPOINTMENT_STATUSES)
      expect(canTransition(status, 'SCHEDULED')).toBe(false);
  });
});

describe('occupiesSchedule', () => {
  it.each([
    ['SCHEDULED', true],
    ['IN_PROGRESS', true],
    ['COMPLETED', false],
    ['CANCELLED', false],
    ['NO_SHOW', false],
  ] as const)('RN-51: %s ocupa a agenda = %s', (status, expected) => {
    expect(occupiesSchedule(status)).toBe(expected);
  });
});

describe('validateTransition', () => {
  it('RN-54: transição fora da tabela → INVALID_TRANSITION', () => {
    const result = validateTransition('COMPLETED', { to: 'IN_PROGRESS' });
    expect(result).toEqual({
      ok: false,
      code: 'INVALID_TRANSITION',
      message: 'Este agendamento já foi concluído e não pode mais ser alterado.',
    });
  });

  it('RN-54: iniciar um agendamento SCHEDULED é válido', () => {
    expect(validateTransition('SCHEDULED', { to: 'IN_PROGRESS' })).toEqual({ ok: true });
  });

  it('RN-54: marcar falta em SCHEDULED é válido', () => {
    expect(validateTransition('SCHEDULED', { to: 'NO_SHOW' })).toEqual({ ok: true });
  });

  it('RN-52 / RN-61: concluir SCHEDULED direto com pagamento é válido (fechamento do dia)', () => {
    expect(
      validateTransition('SCHEDULED', { to: 'COMPLETED', paymentMethod: 'PIX', paidCents: 15000 }),
    ).toEqual({ ok: true });
  });

  it('RN-52: valor recebido 0 (cortesia) é aceito', () => {
    expect(
      validateTransition('IN_PROGRESS', { to: 'COMPLETED', paymentMethod: 'CASH', paidCents: 0 }),
    ).toEqual({ ok: true });
  });

  it.each([
    ['negativo', -1],
    ['fracionário (dinheiro em centavos inteiros)', 1500.5],
    ['NaN', Number.NaN],
    ['infinito', Number.POSITIVE_INFINITY],
    ['acima do int do banco', 2_147_483_648],
    ['acima do inteiro seguro', Number.MAX_SAFE_INTEGER + 1],
    ['ausente (body malformado)', undefined as unknown as number],
  ])('RN-52: valor recebido %s → VALIDATION_ERROR', (_label, paidCents) => {
    expect(
      validateTransition('IN_PROGRESS', { to: 'COMPLETED', paymentMethod: 'PIX', paidCents }),
    ).toMatchObject({ ok: false, code: 'VALIDATION_ERROR' });
  });

  it('RN-52: valor recebido no teto do int do banco é aceito', () => {
    expect(
      validateTransition('IN_PROGRESS', {
        to: 'COMPLETED',
        paymentMethod: 'PIX',
        paidCents: 2_147_483_647,
      }),
    ).toEqual({ ok: true });
  });

  it('RN-52: forma de pagamento ausente → VALIDATION_ERROR', () => {
    expect(
      validateTransition('IN_PROGRESS', {
        to: 'COMPLETED',
        paymentMethod: undefined as never,
        paidCents: 1000,
      }),
    ).toMatchObject({ ok: false, code: 'VALIDATION_ERROR' });
  });

  it('RN-54: mensagem de transição inválida descreve o estado atual', () => {
    expect(validateTransition('IN_PROGRESS', { to: 'NO_SHOW' })).toEqual({
      ok: false,
      code: 'INVALID_TRANSITION',
      message: 'Um atendimento em andamento só pode ser concluído ou cancelado.',
    });
  });

  it('RN-52: forma de pagamento desconhecida → VALIDATION_ERROR', () => {
    expect(
      validateTransition('IN_PROGRESS', {
        to: 'COMPLETED',
        paymentMethod: 'BOLETO' as never,
        paidCents: 1000,
      }),
    ).toMatchObject({ ok: false, code: 'VALIDATION_ERROR' });
  });

  it('RN-53: cancelar com cancelledBy e motivo é válido', () => {
    expect(
      validateTransition('SCHEDULED', {
        to: 'CANCELLED',
        cancelledBy: 'CLIENT',
        reason: 'Imprevisto',
      }),
    ).toEqual({ ok: true });
  });

  it('RN-53: motivo é opcional', () => {
    expect(
      validateTransition('IN_PROGRESS', { to: 'CANCELLED', cancelledBy: 'PROFESSIONAL' }),
    ).toEqual({ ok: true });
  });

  it('RN-53: cancelledBy desconhecido → VALIDATION_ERROR', () => {
    expect(
      validateTransition('SCHEDULED', { to: 'CANCELLED', cancelledBy: 'ADMIN' as never }),
    ).toMatchObject({ ok: false, code: 'VALIDATION_ERROR' });
  });

  it('RN-54: transição inválida tem precedência sobre dados inválidos', () => {
    expect(
      validateTransition('CANCELLED', { to: 'COMPLETED', paymentMethod: 'PIX', paidCents: -1 }),
    ).toMatchObject({ ok: false, code: 'INVALID_TRANSITION' });
  });
});
