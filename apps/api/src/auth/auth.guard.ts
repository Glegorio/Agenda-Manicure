import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { DomainError } from '../common/domain-error.js';
import type { AuthenticatedRequest } from './current-professional.decorator.js';
import { IS_PUBLIC } from './public.decorator.js';
import { TokenService } from './token.service.js';

/**
 * Guard global: toda rota exige `Authorization: Bearer <access>`, exceto as marcadas com
 * `@Public()`. Grava `professionalId` do token na request (regra 5).
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: TokenService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean | undefined>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context
      .switchToHttp()
      .getRequest<AuthenticatedRequest & { headers: Record<string, string | undefined> }>();
    // RFC 6750: o esquema não diferencia maiúsculas.
    const match = /^Bearer\s+(\S+)$/i.exec(request.headers['authorization'] ?? '');
    const professionalId = match?.[1] ? await this.tokens.verifyAccessToken(match[1]) : undefined;
    if (!professionalId) throw new DomainError('UNAUTHORIZED');

    request.professionalId = professionalId;
    return true;
  }
}
