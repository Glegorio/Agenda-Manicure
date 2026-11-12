import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { AuthSessionResponse, LoginRequest, RegisterRequest } from '@agende/contracts';
import { hash, type Options, verify } from '@node-rs/argon2';
import { Clock } from '../clock/clock.js';
import { PG_UNIQUE_VIOLATION, postgresErrorCode } from '../prisma/postgres-error.js';
import { emailTaken, invalidCredentials, invalidSession, slugTaken } from './auth.errors.js';
import { AuthRepository, type ProfessionalSummary, type Tx } from './auth.repository.js';
import { hashRefreshToken, TokenService } from './token.service.js';

/**
 * Custo mínimo recomendado pela OWASP, fixado para não mudar junto com a lib. O algoritmo é o
 * padrão da lib (argon2id; `Algorithm` é const enum, inacessível com verbatimModuleSyntax) —
 * o e2e confere o prefixo `$argon2id$` no hash gravado.
 */
const ARGON2_OPTIONS: Options = {
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
};

/**
 * Hash de uma senha que ninguém conhece: o login com e-mail inexistente também paga o custo do
 * `verify`, então o tempo de resposta não revela se a conta existe.
 */
let dummyHash: Promise<string> | undefined;
const getDummyHash = () =>
  (dummyHash ??= hash('agende-dummy-password-never-matches', ARGON2_OPTIONS));

type RotationOutcome = { kind: 'rotated'; session: AuthSessionResponse } | { kind: 'invalid' };

@Injectable()
export class AuthService {
  constructor(
    private readonly repository: AuthRepository,
    private readonly tokens: TokenService,
    private readonly clock: Clock,
  ) {}

  async register(input: RegisterRequest): Promise<AuthSessionResponse> {
    // Checagens antecipadas dão o erro certo; o índice único continua sendo a garantia (corrida).
    if (await this.repository.emailExists(input.email)) throw emailTaken();
    if (input.slug !== undefined && (await this.repository.slugExists(input.slug))) {
      throw slugTaken();
    }
    const passwordHash = await hash(input.password, ARGON2_OPTIONS);
    try {
      // Conta e primeira sessão juntas: nunca sobra conta sem sessão para um retry esbarrar.
      return await this.repository.transaction(async (tx) => {
        const professional = await this.repository.createProfessional(tx, {
          email: input.email,
          passwordHash,
          businessName: input.businessName,
          slug: input.slug ?? null,
        });
        return this.startSession(tx, professional, randomUUID());
      });
    } catch (error) {
      if (postgresErrorCode(error) === PG_UNIQUE_VIOLATION) {
        throw (await this.repository.emailExists(input.email)) ? emailTaken() : slugTaken();
      }
      throw error;
    }
  }

  async login(input: LoginRequest): Promise<AuthSessionResponse> {
    const found = await this.repository.findCredentialsByEmail(input.email);
    const valid = await verify(found?.passwordHash ?? (await getDummyHash()), input.password);
    if (!found || !valid) throw invalidCredentials();
    const { id, email, businessName, slug } = found;
    return this.repository.transaction((tx) =>
      this.startSession(tx, { id, email, businessName, slug }, randomUUID()),
    );
  }

  /**
   * Rotação (Q-22, ADR-0009): cada refresh vale uma vez; reuso revoga a família inteira.
   * A família fica travada na transação, então duas trocas simultâneas se serializam: a segunda
   * vê o token já revogado e derruba a família, inclusive o sucessor que a primeira acabou de criar.
   * O erro só é lançado depois do commit, para a revogação da família não sofrer rollback.
   */
  async refresh(refreshToken: string): Promise<AuthSessionResponse> {
    const tokenHash = hashRefreshToken(refreshToken);
    const outcome = await this.repository.transaction(async (tx): Promise<RotationOutcome> => {
      const found = await this.repository.findRefreshToken(tx, tokenHash);
      if (!found) return { kind: 'invalid' };
      await this.repository.lockFamily(tx, found.familyId);
      const stored = await this.repository.findRefreshToken(tx, tokenHash);
      const now = this.clock.now();
      if (!stored || stored.revokedAt !== null) {
        await this.repository.revokeFamily(tx, found.familyId, now);
        return { kind: 'invalid' };
      }
      if (stored.expiresAt <= now) return { kind: 'invalid' };

      const professional = await this.repository.findSummaryById(tx, stored.professionalId);
      if (!professional) return { kind: 'invalid' };
      await this.repository.revoke(tx, stored.id, now);
      return {
        kind: 'rotated',
        session: await this.startSession(tx, professional, stored.familyId),
      };
    });
    if (outcome.kind === 'invalid') throw invalidSession();
    return outcome.session;
  }

  /** Encerra a sessão do token (a família inteira). Idempotente e silencioso. */
  async logout(refreshToken: string): Promise<void> {
    await this.repository.transaction(async (tx) => {
      const stored = await this.repository.findRefreshToken(tx, hashRefreshToken(refreshToken));
      if (!stored) return;
      await this.repository.lockFamily(tx, stored.familyId);
      await this.repository.revokeFamily(tx, stored.familyId, this.clock.now());
    });
  }

  private async startSession(
    tx: Tx,
    professional: ProfessionalSummary,
    familyId: string,
  ): Promise<AuthSessionResponse> {
    const access = await this.tokens.signAccessToken(professional.id);
    const refresh = this.tokens.newRefreshToken();
    await this.repository.createRefreshToken(tx, {
      professionalId: professional.id,
      tokenHash: refresh.tokenHash,
      familyId,
      expiresAt: refresh.expiresAt,
    });
    return {
      accessToken: access.token,
      accessTokenExpiresAt: access.expiresAt.toISOString(),
      refreshToken: refresh.token,
      refreshTokenExpiresAt: refresh.expiresAt.toISOString(),
      professional,
    };
  }
}
