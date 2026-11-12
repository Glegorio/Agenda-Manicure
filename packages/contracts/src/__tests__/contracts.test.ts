import { describe, expect, it } from 'vitest';
import {
  availabilityDaysQuerySchema,
  availabilityQuerySchema,
  availabilityResponseSchema,
  blockInputSchema,
  centsSchema,
  configureContractsLocale,
  createBookingSchema,
  createHoldSchema,
  errorResponseSchema,
  ERROR_HTTP_STATUS,
  holdResponseSchema,
  localDateSchema,
  localTimeSchema,
  phoneE164Schema,
  scheduleExceptionInputSchema,
  schedulingSettingsSchema,
  schedulingSettingsUpdateSchema,
  serviceInputSchema,
  serviceUpdateSchema,
  timeZoneSchema,
  transitionRequestSchema,
  utcInstantSchema,
  weeklyScheduleInputSchema,
} from '../index.ts';

const UUID = '3f1c9b4e-8a2d-4c6e-9f1a-2b3c4d5e6f70';
const ok = (schema: { safeParse: (v: unknown) => { success: boolean } }, value: unknown) =>
  schema.safeParse(value).success;

describe('primitivos', () => {
  it.each(['2026-11-11', '2024-02-29'])('localDate aceita %s', (v) => {
    expect(ok(localDateSchema, v)).toBe(true);
  });

  it.each(['2026-02-30', '2026-13-01', '11/11/2026', '2026-11-11T00:00:00Z'])(
    'localDate recusa %s',
    (v) => {
      expect(ok(localDateSchema, v)).toBe(false);
    },
  );

  it.each(['00:00', '08:30', '23:55', '24:00'])('localTime aceita %s', (v) => {
    expect(ok(localTimeSchema, v)).toBe(true);
  });

  it.each(['8:00', '24:30', '12:60', '12:00:00'])('localTime recusa %s', (v) => {
    expect(ok(localTimeSchema, v)).toBe(false);
  });

  it('RN-01: instante UTC exige ISO-8601 com Z', () => {
    expect(ok(utcInstantSchema, '2026-11-11T11:00:00.000Z')).toBe(true);
    expect(ok(utcInstantSchema, '2026-11-11T11:00:00Z')).toBe(true);
    expect(ok(utcInstantSchema, '2026-11-11T08:00:00-03:00')).toBe(false);
    expect(ok(utcInstantSchema, '2026-11-11 11:00')).toBe(false);
  });

  it('RN-02: fuso IANA válido', () => {
    expect(ok(timeZoneSchema, 'America/Sao_Paulo')).toBe(true);
    expect(ok(timeZoneSchema, 'Mars/Olympus')).toBe(false);
    expect(ok(timeZoneSchema, '')).toBe(false);
  });

  it.each([0, 15000, 2_147_483_647])('RN-77: centavos aceita %s', (v) => {
    expect(ok(centsSchema, v)).toBe(true);
  });

  it.each([-1, 10.5, 2_147_483_648, '1500'])('RN-77: centavos recusa %s', (v) => {
    expect(ok(centsSchema, v)).toBe(false);
  });

  it.each(['+5511999998888', '+14155552671'])('RN-80: telefone E.164 aceita %s', (v) => {
    expect(ok(phoneE164Schema, v)).toBe(true);
  });

  it.each(['11999998888', '+55 11 99999-8888', '+0551199999', '+5511'])(
    'RN-80: telefone E.164 recusa %s',
    (v) => {
      expect(ok(phoneE164Schema, v)).toBe(false);
    },
  );
});

describe('serviço (RN-10)', () => {
  const valid = {
    name: 'Alongamento em Gel',
    category: 'Unhas',
    priceCents: 15000,
    durationMin: 120,
    active: true,
    public: true,
  };

  it('aceita serviço válido e imagem opcional', () => {
    expect(ok(serviceInputSchema, valid)).toBe(true);
    expect(ok(serviceInputSchema, { ...valid, imageUrl: 'https://cdn.exemplo.com/a.jpg' })).toBe(
      true,
    );
  });

  it.each([
    ['duração não múltipla de 5', { durationMin: 62 }],
    ['duração menor que 5', { durationMin: 0 }],
    ['duração maior que 600', { durationMin: 605 }],
    ['preço negativo', { priceCents: -100 }],
    ['preço fracionário', { priceCents: 99.9 }],
    ['nome vazio', { name: '   ' }],
    ['imagem sem https', { imageUrl: 'http://exemplo.com/a.jpg' }],
  ])('recusa %s', (_label, patch) => {
    expect(ok(serviceInputSchema, { ...valid, ...patch })).toBe(false);
  });

  it('nome é aparado', () => {
    expect(serviceInputSchema.parse({ ...valid, name: '  Gel  ' }).name).toBe('Gel');
  });

  it('atualização é parcial mas não vazia', () => {
    expect(ok(serviceUpdateSchema, { priceCents: 16000 })).toBe(true);
    expect(ok(serviceUpdateSchema, {})).toBe(false);
  });
});

describe('agenda (RN-20..25)', () => {
  it('RN-20: escala semanal com janelas válidas', () => {
    expect(
      ok(weeklyScheduleInputSchema, {
        windows: [
          { weekday: 1, start: '08:00', end: '12:00' },
          { weekday: 1, start: '13:00', end: '18:00' },
        ],
      }),
    ).toBe(true);
  });

  it('RN-20: recusa janela com início ≥ fim', () => {
    expect(
      ok(weeklyScheduleInputSchema, { windows: [{ weekday: 1, start: '18:00', end: '08:00' }] }),
    ).toBe(false);
  });

  it('RN-20 / Q-17: recusa janelas sobrepostas no mesmo dia', () => {
    expect(
      ok(weeklyScheduleInputSchema, {
        windows: [
          { weekday: 1, start: '08:00', end: '13:00' },
          { weekday: 1, start: '12:00', end: '18:00' },
        ],
      }),
    ).toBe(false);
  });

  it('RN-20 / Q-17: aceita janelas que só se encostam (viram uma só no cálculo)', () => {
    expect(
      ok(weeklyScheduleInputSchema, {
        windows: [
          { weekday: 1, start: '08:00', end: '12:00' },
          { weekday: 1, start: '12:00', end: '18:00' },
        ],
      }),
    ).toBe(true);
  });

  it('RN-20: janelas sobrepostas em dias diferentes não conflitam', () => {
    expect(
      ok(weeklyScheduleInputSchema, {
        windows: [
          { weekday: 1, start: '08:00', end: '13:00' },
          { weekday: 2, start: '12:00', end: '18:00' },
        ],
      }),
    ).toBe(true);
  });

  it('recusa dia da semana fora de 0..6', () => {
    expect(
      ok(weeklyScheduleInputSchema, { windows: [{ weekday: 7, start: '08:00', end: '12:00' }] }),
    ).toBe(false);
  });

  it('RN-21: exceção closed sem janelas e exceção com janelas', () => {
    expect(ok(scheduleExceptionInputSchema, { date: '2026-12-25', closed: true })).toBe(true);
    expect(
      ok(scheduleExceptionInputSchema, {
        date: '2026-12-24',
        closed: false,
        windows: [{ start: '08:00', end: '12:00' }],
      }),
    ).toBe(true);
  });

  it('RN-21: exceção aberta exige ao menos uma janela', () => {
    expect(
      ok(scheduleExceptionInputSchema, { date: '2026-12-24', closed: false, windows: [] }),
    ).toBe(false);
  });

  it('bloqueio compara instantes, não texto (com e sem milissegundos)', () => {
    expect(
      ok(blockInputSchema, { startAt: '2026-11-11T14:00:00.500Z', endAt: '2026-11-11T14:00:00Z' }),
    ).toBe(false);
    expect(
      ok(blockInputSchema, { startAt: '2026-11-11T14:00:00Z', endAt: '2026-11-11T14:00:00.500Z' }),
    ).toBe(true);
  });

  it('bloqueio manual exige início < fim', () => {
    expect(
      ok(blockInputSchema, {
        startAt: '2026-11-11T14:00:00Z',
        endAt: '2026-11-11T15:00:00Z',
        reason: 'Médico',
      }),
    ).toBe(true);
    expect(
      ok(blockInputSchema, { startAt: '2026-11-11T15:00:00Z', endAt: '2026-11-11T14:00:00Z' }),
    ).toBe(false);
  });

  it.each([
    ['buffer acima de 60 (RN-22)', { bufferMin: 61 }],
    ['step fora de 5/10/15/30 (RN-23)', { slotStepMin: 20 }],
    ['antecedência negativa (RN-24)', { minNoticeMin: -5 }],
    ['horizonte zero (RN-25)', { bookingHorizonDays: 0 }],
    ['fuso inválido (RN-02)', { timezone: 'Brasil' }],
  ])('parâmetros de agenda: recusa %s', (_label, patch) => {
    const valid = {
      timezone: 'America/Sao_Paulo',
      bufferMin: 10,
      slotStepMin: 15,
      minNoticeMin: 120,
      bookingHorizonDays: 30,
    };
    expect(ok(schedulingSettingsSchema, valid)).toBe(true);
    expect(ok(schedulingSettingsSchema, { ...valid, ...patch })).toBe(false);
  });
});

describe('disponibilidade', () => {
  it('consulta do dia exige serviceId uuid e data local', () => {
    expect(ok(availabilityQuerySchema, { serviceId: UUID, date: '2026-11-11' })).toBe(true);
    expect(ok(availabilityQuerySchema, { serviceId: '1', date: '2026-11-11' })).toBe(false);
  });

  it('consulta de dias exige from ≤ to e no máximo 62 dias', () => {
    expect(
      ok(availabilityDaysQuerySchema, { serviceId: UUID, from: '2026-11-01', to: '2026-11-30' }),
    ).toBe(true);
    expect(
      ok(availabilityDaysQuerySchema, { serviceId: UUID, from: '2026-11-30', to: '2026-11-01' }),
    ).toBe(false);
    expect(
      ok(availabilityDaysQuerySchema, { serviceId: UUID, from: '2026-01-01', to: '2026-12-31' }),
    ).toBe(false);
  });

  it('Q-16 / RN-36: resposta traz o fuso e os horários como instantes UTC', () => {
    expect(
      ok(availabilityResponseSchema, {
        timezone: 'America/Sao_Paulo',
        slots: ['2026-11-11T11:00:00.000Z', '2026-11-11T11:15:00.000Z'],
      }),
    ).toBe(true);
    expect(
      ok(availabilityResponseSchema, { timezone: 'America/Sao_Paulo', slots: ['08:00'] }),
    ).toBe(false);
  });
});

describe('hold e reserva (RN-40..44)', () => {
  it('RN-40: hold recebe serviceId e startAt em UTC', () => {
    expect(ok(createHoldSchema, { serviceId: UUID, startAt: '2026-11-11T11:00:00Z' })).toBe(true);
    expect(ok(createHoldSchema, { serviceId: UUID, startAt: '2026-11-11' })).toBe(false);
  });

  it('RN-40: resposta do hold tem token opaco e expiração', () => {
    expect(
      ok(holdResponseSchema, {
        holdToken: 'b3BhcXVlLXRva2VuLWRlLTMyLWJ5dGVzLWFsZWF0b3Jpb3M',
        expiresAt: '2026-11-11T11:05:00Z',
      }),
    ).toBe(true);
  });

  it('RN-43 / RN-80: reserva exige token, nome e telefone E.164', () => {
    const valid = {
      holdToken: 'b3BhcXVlLXRva2VuLWRlLTMyLWJ5dGVzLWFsZWF0b3Jpb3M',
      name: 'Maria Souza',
      phone: '+5511999998888',
      notes: 'Prefiro tons nude',
    };
    expect(ok(createBookingSchema, valid)).toBe(true);
    expect(ok(createBookingSchema, { ...valid, notes: undefined })).toBe(true);
    expect(ok(createBookingSchema, { ...valid, phone: '11999998888' })).toBe(false);
    expect(ok(createBookingSchema, { ...valid, name: 'M' })).toBe(false);
    expect(ok(createBookingSchema, { ...valid, notes: 'x'.repeat(501) })).toBe(false);
  });
});

describe('transições (RN-52..54, doc 05)', () => {
  it('RN-52: concluir exige forma de pagamento; paidCents é opcional (padrão do snapshot)', () => {
    expect(ok(transitionRequestSchema, { to: 'COMPLETED', paymentMethod: 'PIX' })).toBe(true);
    expect(
      ok(transitionRequestSchema, { to: 'COMPLETED', paymentMethod: 'CASH', paidCents: 12000 }),
    ).toBe(true);
    expect(ok(transitionRequestSchema, { to: 'COMPLETED' })).toBe(false);
    expect(
      ok(transitionRequestSchema, { to: 'COMPLETED', paymentMethod: 'PIX', paidCents: -1 }),
    ).toBe(false);
  });

  it('RN-53: cancelledBy não é aceito do body (vem do token)', () => {
    expect(ok(transitionRequestSchema, { to: 'CANCELLED', reason: 'Imprevisto' })).toBe(true);
    expect(ok(transitionRequestSchema, { to: 'CANCELLED', cancelledBy: 'CLIENT' })).toBe(false);
  });

  it('RN-54: SCHEDULED não é destino válido', () => {
    expect(ok(transitionRequestSchema, { to: 'SCHEDULED' })).toBe(false);
  });

  it('forma de pagamento fora da lista do domínio é recusada', () => {
    expect(ok(transitionRequestSchema, { to: 'COMPLETED', paymentMethod: 'BOLETO' })).toBe(false);
  });
});

describe('erros (doc 05)', () => {
  it('envelope padrão { error: { code, message, details } }', () => {
    expect(
      ok(errorResponseSchema, {
        error: {
          code: 'SLOT_UNAVAILABLE',
          message: 'Este horário acabou de ser reservado.',
          details: {},
        },
      }),
    ).toBe(true);
    expect(ok(errorResponseSchema, { error: { code: 'TEAPOT', message: 'x', details: {} } })).toBe(
      false,
    );
  });

  it('cada código tem o status HTTP documentado', () => {
    expect(ERROR_HTTP_STATUS).toEqual({
      VALIDATION_ERROR: 400,
      UNAUTHORIZED: 401,
      FORBIDDEN: 403,
      NOT_FOUND: 404,
      SLOT_UNAVAILABLE: 409,
      SLUG_TAKEN: 409,
      EMAIL_TAKEN: 409,
      HOLD_EXPIRED: 410,
      INVALID_TRANSITION: 422,
      RATE_LIMITED: 429,
      INTERNAL_ERROR: 500,
      SERVICE_UNAVAILABLE: 503,
    });
  });
});

describe('ajustes da revisão (1.6)', () => {
  it.each(['+03:00', 'utc', 'america/sao_paulo', 'EST'])(
    'RN-02: fuso não canônico %s é recusado',
    (tz) => {
      expect(ok(timeZoneSchema, tz)).toBe(false);
    },
  );

  it('RN-02: UTC canônico é aceito', () => {
    expect(ok(timeZoneSchema, 'UTC')).toBe(true);
  });

  it.each([
    ['pagamento em cancelamento', { to: 'CANCELLED', paymentMethod: 'PIX' }],
    ['valor em falta', { to: 'NO_SHOW', paidCents: 1000 }],
    ['motivo ao iniciar', { to: 'IN_PROGRESS', reason: 'x' }],
    ['motivo ao concluir', { to: 'COMPLETED', paymentMethod: 'PIX', reason: 'x' }],
  ])('RN-52..54: transição recusa campos de outro destino (%s)', (_label, body) => {
    expect(ok(transitionRequestSchema, body)).toBe(false);
  });

  it('RN-52: erro de pagamento ausente aponta para o campo', () => {
    const result = transitionRequestSchema.safeParse({ to: 'COMPLETED' });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(['paymentMethod']);
  });

  it('RN-21 / Q-17: exceção com janelas sobrepostas é recusada', () => {
    expect(
      ok(scheduleExceptionInputSchema, {
        date: '2026-12-24',
        closed: false,
        windows: [
          { start: '08:00', end: '13:00' },
          { start: '12:00', end: '18:00' },
        ],
      }),
    ).toBe(false);
  });

  it('imagem do serviço tem tamanho máximo e pode ser removida (null) na atualização', () => {
    const base = {
      name: 'Gel',
      category: 'Unhas',
      priceCents: 100,
      durationMin: 60,
      active: true,
      public: true,
    };
    expect(
      ok(serviceInputSchema, { ...base, imageUrl: `https://cdn.exemplo.com/${'a'.repeat(2100)}` }),
    ).toBe(false);
    expect(ok(serviceUpdateSchema, { imageUrl: null })).toBe(true);
  });

  it('RN-40: token do hold só tem caracteres base64url', () => {
    expect(
      ok(holdResponseSchema, {
        holdToken: `${'a'.repeat(40)}/+`,
        expiresAt: '2026-11-11T11:05:00Z',
      }),
    ).toBe(false);
  });

  it('PATCH de parâmetros de agenda é parcial mas não vazio', () => {
    expect(ok(schedulingSettingsUpdateSchema, { bufferMin: 15 })).toBe(true);
    expect(ok(schedulingSettingsUpdateSchema, {})).toBe(false);
  });

  it('mensagens padrão do Zod em português após configureContractsLocale()', () => {
    configureContractsLocale();
    const result = createBookingSchema.safeParse({
      holdToken: 'a'.repeat(40),
      name: 'M',
      phone: '+5511999998888',
    });
    expect(result.error?.issues[0]?.message).toMatch(/esperava/i);
  });

  it('localDate recusa anos antes de 2000 (Date.UTC trata 0–99 como 19xx)', () => {
    expect(ok(localDateSchema, '0001-01-01')).toBe(false);
    expect(ok(localDateSchema, '1999-12-31')).toBe(false);
  });
});
