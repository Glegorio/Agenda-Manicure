import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import { DomainError } from '../common/domain-error.js';

/** Request depois do `AuthGuard`: só o guard escreve `professionalId`. */
export interface AuthenticatedRequest {
  professionalId?: string;
}

/**
 * `professionalId` da profissional autenticada, **sempre** vindo do token (regra 5).
 * Nunca leia esse id do body, da query ou dos params.
 */
export const CurrentProfessional = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const { professionalId } = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    // Rota marcada @Public() usando o decorator: erro de programação, nunca acesso liberado.
    if (!professionalId) throw new DomainError('UNAUTHORIZED');
    return professionalId;
  },
);
