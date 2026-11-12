import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { ERROR_HTTP_STATUS, type ErrorCode, type ErrorResponse } from '@agende/contracts';
import { DEFAULT_ERROR_MESSAGES, DomainError } from './domain-error.js';

/** Status HTTP de exceções do Nest/Express → código do envelope (o resto vira INTERNAL_ERROR). */
const CODE_BY_STATUS: Partial<Record<number, ErrorCode>> = {
  400: 'VALIDATION_ERROR',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  413: 'VALIDATION_ERROR',
  415: 'VALIDATION_ERROR',
  429: 'RATE_LIMITED',
  503: 'SERVICE_UNAVAILABLE',
};

/**
 * Toda resposta de erro sai no envelope padrão do doc 05. Mensagens de exceções do framework e
 * de erros inesperados nunca vão para o corpo (podem estar em inglês ou vazar detalhes internos).
 */
@Catch()
export class ErrorEnvelopeFilter implements ExceptionFilter {
  private readonly logger = new Logger(ErrorEnvelopeFilter.name);

  constructor(private readonly adapterHost: HttpAdapterHost) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const body = this.toEnvelope(exception);
    // O status sempre segue o código (contrato do doc 05), nunca o status original da exceção.
    const status = ERROR_HTTP_STATUS[body.error.code];
    if (status >= 500) {
      // Stack só no log do servidor; pode conter dados pessoais até o mascaramento da 8.2.
      this.logger.error(exception instanceof Error ? exception.stack : String(exception));
    }
    const response: unknown = host.switchToHttp().getResponse();
    // Resposta já iniciada (ex.: stream SSE da 2.9): não dá para trocar status nem corpo.
    if (this.adapterHost.httpAdapter.isHeadersSent(response)) return;
    this.adapterHost.httpAdapter.reply(response, body, status);
  }

  private toEnvelope(exception: unknown): ErrorResponse {
    if (exception instanceof DomainError) {
      return {
        error: { code: exception.code, message: exception.message, details: exception.details },
      };
    }
    const code =
      exception instanceof HttpException
        ? codeForHttpStatus(exception.getStatus())
        : 'INTERNAL_ERROR';
    return { error: { code, message: DEFAULT_ERROR_MESSAGES[code], details: {} } };
  }
}

/** 4xx sem código próprio é erro de requisição (400); 5xx é erro nosso (500). */
function codeForHttpStatus(status: number): ErrorCode {
  return CODE_BY_STATUS[status] ?? (status < 500 ? 'VALIDATION_ERROR' : 'INTERNAL_ERROR');
}
