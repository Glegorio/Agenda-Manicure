import { Injectable } from '@nestjs/common';
import { Clock } from '../clock/clock.js';
import { PrismaService } from '../prisma/prisma.service.js';

/**
 * Limpeza periódica. Idempotente: só apaga o que já expirou, então rodar duas vezes (ou em duas
 * instâncias) não muda o resultado. A correção nunca depende dela (RN-46): toda leitura já
 * ignora hold com `expires_at <= now` e todo refresh vencido é recusado.
 */
@Injectable()
export class CleanupService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
  ) {}

  async run(): Promise<{ holds: number; refreshTokens: number }> {
    const now = this.clock.now();
    const [holds, refreshTokens] = await Promise.all([
      this.prisma.slotHold.deleteMany({ where: { expiresAt: { lte: now } } }),
      // ADR-0009: perde-se só o sinal de reuso de token já vencido (não dá mais acesso); tokens
      // rotacionados ainda no prazo continuam no banco e seguem detectando reuso.
      this.prisma.refreshToken.deleteMany({ where: { expiresAt: { lte: now } } }),
    ]);
    return { holds: holds.count, refreshTokens: refreshTokens.count };
  }
}
