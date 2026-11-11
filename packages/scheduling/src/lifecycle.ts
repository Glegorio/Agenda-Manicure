import type { AppointmentStatus } from './types.ts';

/** RN-50. */
export const APPOINTMENT_STATUSES = [
  'SCHEDULED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
  'NO_SHOW',
] as const satisfies readonly AppointmentStatus[];

/** Formas de pagamento (seção 8 de `docs/02-regras-de-negocio.md`). */
export const PAYMENT_METHODS = ['PIX', 'CREDIT_CARD', 'DEBIT_CARD', 'CASH'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

/** RN-53. */
export const CANCELLED_BY = ['PROFESSIONAL', 'CLIENT'] as const;
export type CancelledBy = (typeof CANCELLED_BY)[number];

/** Pedido de transição com os dados que cada destino exige (RN-52, RN-53). */
export type TransitionCommand =
  | { readonly to: 'IN_PROGRESS' }
  | { readonly to: 'NO_SHOW' }
  | {
      readonly to: 'COMPLETED';
      readonly paymentMethod: PaymentMethod;
      /**
       * Valor recebido em centavos, já resolvido: quem chama (service da API) aplica o padrão
       * `price_cents` do snapshot quando o body não traz o valor (RN-52, Q-13).
       */
      readonly paidCents: number;
    }
  | {
      readonly to: 'CANCELLED';
      /** Derivado do contexto (token da profissional ou link da cliente), nunca do body. */
      readonly cancelledBy: CancelledBy;
      readonly reason?: string;
    };

export type TransitionResult =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly code: 'INVALID_TRANSITION' | 'VALIDATION_ERROR';
      /** Mensagem em português, pronta para a usuária final. */
      readonly message: string;
    };

/** RN-54. Record completo: um status novo obriga a decidir suas transições. */
const TRANSITIONS: Readonly<Record<AppointmentStatus, readonly AppointmentStatus[]>> = {
  SCHEDULED: ['IN_PROGRESS', 'COMPLETED', 'NO_SHOW', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  NO_SHOW: [],
  CANCELLED: [],
};

/** Teto de `int` (int4) do PostgreSQL, tipo de `paid_cents` (doc 04). */
const MAX_CENTS = 2_147_483_647;

const INVALID_TRANSITION_MESSAGES: Readonly<Record<AppointmentStatus, string>> = {
  SCHEDULED: 'Este agendamento já está agendado.',
  IN_PROGRESS: 'Um atendimento em andamento só pode ser concluído ou cancelado.',
  COMPLETED: 'Este agendamento já foi concluído e não pode mais ser alterado.',
  NO_SHOW: 'Este agendamento já foi marcado como falta e não pode mais ser alterado.',
  CANCELLED: 'Este agendamento já foi cancelado e não pode mais ser alterado.',
};

/** RN-54: a transição `from → to` está na tabela de transições permitidas? */
export function canTransition(from: AppointmentStatus, to: AppointmentStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

/** RN-51: somente `SCHEDULED` e `IN_PROGRESS` ocupam a agenda. */
export function occupiesSchedule(status: AppointmentStatus): boolean {
  return status === 'SCHEDULED' || status === 'IN_PROGRESS';
}

const invalid = (message: string): TransitionResult => ({
  ok: false,
  code: 'VALIDATION_ERROR',
  message,
});

/**
 * Valida uma transição de status com os dados exigidos pelo destino.
 * A transição em si (RN-54) é checada antes dos dados.
 */
export function validateTransition(
  from: AppointmentStatus,
  command: TransitionCommand,
): TransitionResult {
  // Formato (enums, tipos) também é validado pelo Zod na borda (1.6); aqui fica a regra de domínio.
  if (!canTransition(from, command.to)) {
    return {
      ok: false,
      code: 'INVALID_TRANSITION',
      message: INVALID_TRANSITION_MESSAGES[from],
    };
  }
  if (command.to === 'COMPLETED') {
    if (!(PAYMENT_METHODS as readonly string[]).includes(command.paymentMethod)) {
      return invalid('Escolha a forma de pagamento.');
    }
    // RN-52 / RN-77: centavos inteiros, não negativos e dentro do int do banco.
    if (
      !Number.isSafeInteger(command.paidCents) ||
      command.paidCents < 0 ||
      command.paidCents > MAX_CENTS
    ) {
      return invalid('Informe um valor recebido válido.');
    }
  }
  if (
    command.to === 'CANCELLED' &&
    !(CANCELLED_BY as readonly string[]).includes(command.cancelledBy)
  ) {
    return invalid('Informe quem cancelou o agendamento.');
  }
  return { ok: true };
}
