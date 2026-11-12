import { Injectable } from '@nestjs/common';
import type { SlotHold } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { runInScheduleTransaction } from '../prisma/schedule-lock.js';
import type { Db } from './public.repository.js';

/** Escritas de hold e reserva — sempre sob o lock da agenda da profissional (regra 1). */
@Injectable()
export class BookingRepository {
  constructor(private readonly prisma: PrismaService) {}

  withScheduleLock<T>(professionalId: string, fn: (tx: Db) => Promise<T>): Promise<T> {
    return runInScheduleTransaction(this.prisma, professionalId, fn);
  }

  createHold(
    tx: Db,
    data: {
      professionalId: string;
      serviceId: string;
      serviceNameSnapshot: string;
      priceCentsSnapshot: number;
      startAt: Date;
      endAt: Date;
      blockEndAt: Date;
      tokenHash: string;
      expiresAt: Date;
    },
  ): Promise<SlotHold> {
    return tx.slotHold.create({ data });
  }

  findHold(tx: Db, professionalId: string, tokenHash: string): Promise<SlotHold | null> {
    return tx.slotHold.findFirst({ where: { tokenHash, professionalId } });
  }

  async deleteHold(tx: Db, professionalId: string, tokenHash: string): Promise<void> {
    await tx.slotHold.deleteMany({ where: { tokenHash, professionalId } });
  }

  /**
   * RN-81 + Q-29: cliente nova é criada pelo telefone; cliente existente **não** é alterada —
   * sem login, quem sabe o telefone de alguém não pode renomear o cadastro dela.
   */
  upsertClient(tx: Db, professionalId: string, name: string, phoneE164: string) {
    return tx.client.upsert({
      where: { professionalId_phoneE164: { professionalId, phoneE164 } },
      update: {},
      create: { professionalId, name, phoneE164, source: 'WEB' },
      select: { id: true },
    });
  }

  createAppointment(
    tx: Db,
    data: {
      professionalId: string;
      clientId: string;
      serviceId: string;
      serviceNameSnapshot: string;
      priceCentsSnapshot: number;
      durationMinSnapshot: number;
      startAt: Date;
      endAt: Date;
      blockEndAt: Date;
      clientNotes: string | null;
      bookedName: string;
    },
  ) {
    return tx.appointment.create({ data: { ...data, source: 'WEB' }, select: { id: true } });
  }
}
