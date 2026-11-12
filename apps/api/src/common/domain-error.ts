import type { ErrorCode } from '@agende/contracts';

/** Mensagem padrão por código, em português e voltada à usuária final (doc 05). */
export const DEFAULT_ERROR_MESSAGES: Record<ErrorCode, string> = {
  VALIDATION_ERROR: 'Confira os dados informados.',
  UNAUTHORIZED: 'Sua sessão expirou. Entre novamente.',
  FORBIDDEN: 'Você não tem permissão para fazer isso.',
  NOT_FOUND: 'Não encontramos o que você procurou.',
  SLOT_UNAVAILABLE: 'Este horário acabou de ser reservado. Escolha outro.',
  SLUG_TAKEN: 'Este link já está em uso. Escolha outro.',
  HOLD_EXPIRED: 'O tempo para confirmar acabou. Escolha o horário novamente.',
  INVALID_TRANSITION: 'Não é possível mudar o status deste agendamento.',
  RATE_LIMITED: 'Muitas tentativas. Aguarde um instante e tente de novo.',
  INTERNAL_ERROR: 'Algo deu errado do nosso lado. Tente novamente.',
  SERVICE_UNAVAILABLE: 'Serviço indisponível no momento. Tente novamente em instantes.',
};

/**
 * Erro de domínio: o filtro global o converte no envelope `{ error: { code, message, details } }`
 * com o status HTTP de `ERROR_HTTP_STATUS`. Services lançam isto, nunca `HttpException`.
 */
export class DomainError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string = DEFAULT_ERROR_MESSAGES[code],
    readonly details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = 'DomainError';
  }
}
