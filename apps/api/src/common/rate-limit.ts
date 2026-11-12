import {
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { slugSchema } from '@agende/contracts';
import { Clock } from '../clock/clock.js';
import { DomainError } from './domain-error.js';

const MINUTE_MS = 60_000;

/**
 * Janela fixa de 1 minuto. Q-25: leituras públicas 60/min e holds/reservas 10/min, por IP + slug.
 * ADR-0009: login, registro e refresh 10/min por IP (número provisório, Q-31).
 */
export const RATE_LIMIT_POLICIES = {
  'public-read': { limit: 60, windowMs: MINUTE_MS },
  'public-write': { limit: 10, windowMs: MINUTE_MS },
  auth: { limit: 10, windowMs: MINUTE_MS },
} as const;

export type RateLimitPolicy = keyof typeof RATE_LIMIT_POLICIES;

const RATE_LIMIT = Symbol('RATE_LIMIT');

/** Aplica a política à rota; no método, sobrepõe a da classe. */
export const RateLimit = (policy: RateLimitPolicy) => SetMetadata(RATE_LIMIT, policy);

/** Liga/desliga o limite (os testes de API desligam, salvo o próprio teste de rate limit). */
export const RATE_LIMIT_ENABLED = Symbol('RATE_LIMIT_ENABLED');

/** Teto rígido de contadores: memória e CPU constantes mesmo sob chaves forjadas. */
export const MAX_TRACKED_KEYS = 10_000;

/**
 * Contadores em memória, por instância da API. Com várias réplicas cada uma conta à parte
 * (limite efetivo × N): trocar por store compartilhado no deploy (8.4).
 */
export class RateLimitStore {
  /** Ordem de inserção = ordem de início da janela (toda janela nova é reinserida no fim). */
  private readonly windows = new Map<string, { start: number; count: number }>();

  constructor(private readonly maxKeys: number = MAX_TRACKED_KEYS) {}

  /** Conta uma requisição; devolve os segundos até liberar se o limite estourou, senão `null`. */
  consume(key: string, limit: number, windowMs: number, now: number): number | null {
    const current = this.windows.get(key);
    if (!current || now - current.start >= windowMs) {
      this.windows.delete(key);
      this.evict(now, windowMs);
      this.windows.set(key, { start: now, count: 1 });
      return null;
    }
    current.count += 1;
    if (current.count <= limit) return null;
    return Math.max(1, Math.ceil((current.start + windowMs - now) / 1000));
  }

  clear(): void {
    this.windows.clear();
  }

  get size(): number {
    return this.windows.size;
  }

  /**
   * Remove do início (as janelas mais antigas) as vencidas e, se ainda estiver no teto, a mais
   * antiga viva: O(1) amortizado. Despejar uma janela viva só zera o contador de quem já parou
   * de chamar há mais tempo.
   */
  private evict(now: number, windowMs: number): void {
    for (const [key, window] of this.windows) {
      if (now - window.start < windowMs && this.windows.size < this.maxKeys) return;
      this.windows.delete(key);
    }
  }
}

interface RateLimitedRequest {
  ip?: string;
  params?: Record<string, string | undefined>;
  res?: { setHeader(name: string, value: string): void };
}

/** Guard global: só age em rotas com `@RateLimit`; estourou → `429 RATE_LIMITED` + `Retry-After`. */
@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly store: RateLimitStore,
    private readonly clock: Clock,
    @Inject(RATE_LIMIT_ENABLED) private readonly enabled: boolean,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    if (!this.enabled) return true;
    const policy = this.reflector.getAllAndOverride<RateLimitPolicy | undefined>(RATE_LIMIT, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!policy) return true;

    const request = context.switchToHttp().getRequest<RateLimitedRequest>();
    const { limit, windowMs } = RATE_LIMIT_POLICIES[policy];
    // O guard roda antes dos pipes: slug fora do formato RN-90 conta só pelo IP.
    const slug = slugSchema.safeParse(request.params?.['slug']);
    const key = [policy, request.ip ?? 'unknown', slug.success ? slug.data : ''].join('|');
    const retryAfter = this.store.consume(key, limit, windowMs, this.clock.now().getTime());
    if (retryAfter === null) return true;

    request.res?.setHeader('Retry-After', String(retryAfter));
    throw new DomainError('RATE_LIMITED', undefined, { retryAfterSeconds: retryAfter });
  }
}
