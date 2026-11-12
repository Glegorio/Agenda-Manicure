import { Injectable } from '@nestjs/common';
import type { Prisma, RefreshToken } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

const PROFESSIONAL_SUMMARY = {
  id: true,
  email: true,
  businessName: true,
  slug: true,
} as const satisfies Prisma.ProfessionalSelect;

export type ProfessionalSummary = Prisma.ProfessionalGetPayload<{
  select: typeof PROFESSIONAL_SUMMARY;
}>;

/** Client do Prisma dentro de `$transaction` (os métodos de escrita recebem o `tx`). */
export type Tx = Prisma.TransactionClient;

export interface NewRefreshToken {
  professionalId: string;
  tokenHash: string;
  familyId: string;
  expiresAt: Date;
}

/** Persistência de credenciais e refresh tokens (ADR-0009). */
@Injectable()
export class AuthRepository {
  constructor(private readonly prisma: PrismaService) {}

  transaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(fn);
  }

  createProfessional(
    tx: Tx,
    data: { email: string; passwordHash: string; businessName: string; slug: string | null },
  ): Promise<ProfessionalSummary> {
    return tx.professional.create({ data, select: PROFESSIONAL_SUMMARY });
  }

  findCredentialsByEmail(
    email: string,
  ): Promise<(ProfessionalSummary & { passwordHash: string }) | null> {
    return this.prisma.professional.findUnique({
      where: { email },
      select: { ...PROFESSIONAL_SUMMARY, passwordHash: true },
    });
  }

  findSummaryById(tx: Tx, id: string): Promise<ProfessionalSummary | null> {
    return tx.professional.findUnique({ where: { id }, select: PROFESSIONAL_SUMMARY });
  }

  async emailExists(email: string): Promise<boolean> {
    return (await this.prisma.professional.count({ where: { email } })) > 0;
  }

  async slugExists(slug: string): Promise<boolean> {
    return (await this.prisma.professional.count({ where: { slug } })) > 0;
  }

  async createRefreshToken(tx: Tx, data: NewRefreshToken): Promise<void> {
    await tx.refreshToken.create({ data });
  }

  findRefreshToken(tx: Tx, tokenHash: string): Promise<RefreshToken | null> {
    return tx.refreshToken.findUnique({ where: { tokenHash } });
  }

  /** Serializa rotação/revogação de uma família até o fim da transação. */
  async lockFamily(tx: Tx, familyId: string): Promise<void> {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${familyId}))`;
  }

  async revoke(tx: Tx, id: string, now: Date): Promise<void> {
    await tx.refreshToken.update({ where: { id }, data: { revokedAt: now } });
  }

  async revokeFamily(tx: Tx, familyId: string, now: Date): Promise<void> {
    await tx.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: now },
    });
  }
}
