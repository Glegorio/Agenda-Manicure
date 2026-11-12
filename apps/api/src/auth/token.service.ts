import { createHash, randomBytes } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { jwtVerify, SignJWT } from 'jose';
import { Clock } from '../clock/clock.js';
import { AUTH_CONFIG, type AuthConfig } from './auth.config.js';

const ALG = 'HS256';

/** Tokens da sessão (ADR-0009): access JWT curto e refresh opaco guardado só como hash. */
@Injectable()
export class TokenService {
  private readonly key: Uint8Array;

  constructor(
    @Inject(AUTH_CONFIG) private readonly config: AuthConfig,
    private readonly clock: Clock,
  ) {
    this.key = new TextEncoder().encode(config.accessTokenSecret);
  }

  async signAccessToken(professionalId: string): Promise<{ token: string; expiresAt: Date }> {
    const now = this.clock.now();
    const expiresAt = new Date(now.getTime() + this.config.accessTokenTtlSec * 1000);
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: ALG })
      .setSubject(professionalId)
      .setIssuedAt(now)
      .setExpirationTime(expiresAt)
      .sign(this.key);
    return { token, expiresAt };
  }

  /** `professionalId` do token, ou `undefined` se inválido/expirado (o `Clock` define o agora). */
  async verifyAccessToken(token: string): Promise<string | undefined> {
    try {
      const { payload } = await jwtVerify(token, this.key, {
        algorithms: [ALG],
        currentDate: this.clock.now(),
      });
      return payload.sub;
    } catch {
      return undefined;
    }
  }

  newRefreshToken(): { token: string; tokenHash: string; expiresAt: Date } {
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(this.clock.now().getTime() + this.config.refreshTokenTtlSec * 1000);
    return { token, tokenHash: hashRefreshToken(token), expiresAt };
  }
}

/** sha256 basta: o token tem 256 bits aleatórios, não precisa de hash lento. */
export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
