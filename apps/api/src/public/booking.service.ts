import { createHash, randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { BookingResponse, CreateBooking, HoldResponse } from '@agende/contracts';
import { computeAvailableSlots, localDateOf } from '@agende/scheduling';
import { AppointmentsService } from '../appointments/appointments.service.js';
import { Clock } from '../clock/clock.js';
import { DomainError } from '../common/domain-error.js';
import { PG_EXCLUSION_VIOLATION, postgresErrorCode } from '../prisma/postgres-error.js';
import { BookingRepository } from './booking.repository.js';
import { PublicService } from './public.service.js';

const MINUTE_MS = 60_000;
/** RN-40: o hold vale 5 minutos. */
const HOLD_TTL_MS = 5 * MINUTE_MS;

const slotUnavailable = () => new DomainError('SLOT_UNAVAILABLE');
const holdExpired = () => new DomainError('HOLD_EXPIRED');

/** sha256 basta: o token tem 256 bits aleatórios; o banco nunca vê o token (doc 04). */
const hashHoldToken = (token: string) => createHash('sha256').update(token).digest('hex');

/**
 * Hold de 5 minutos e confirmação da reserva (RN-40..44, ADR-0003). Toda escrita roda numa
 * transação que começa com o lock da agenda da profissional; a exclusion constraint do banco é a
 * garantia final (RN-42).
 */
@Injectable()
export class BookingService {
  constructor(
    private readonly repository: BookingRepository,
    private readonly publicPage: PublicService,
    private readonly clock: Clock,
    private readonly appointments: AppointmentsService,
  ) {}

  /**
   * RN-40/41: revalida o horário **depois** do lock, com tudo lido no mesmo `tx` — inclusive os
   * parâmetros da profissional (fuso, buffer, antecedência). Só aceita um `startAt` presente na
   * grade atual (Q-28); qualquer outro → 409. Guarda nome e preço vistos pela cliente (Q-30).
   */
  async createHold(slug: string, serviceId: string, startAtIso: string): Promise<HoldResponse> {
    const { id: professionalId } = await this.publicPage.professional(slug);
    const startAt = new Date(startAtIso);
    const token = randomBytes(32).toString('base64url');

    const expiresAt = await this.repository.withScheduleLock(professionalId, async (tx) => {
      const pro = await this.publicPage.professional(slug, tx);
      // Serviço lido sob o lock: um DELETE concorrente (2.5) não deixa o hold órfão.
      const service = await this.publicPage.visibleService(pro.id, serviceId, tx);
      const date = localDateOf(startAt, pro.timezone);
      const query = await this.publicPage.slotQuery(pro, service.durationMin, date, date, tx);
      const offered = computeAvailableSlots({ ...query, date });
      if (!offered.some((slot) => slot.getTime() === startAt.getTime())) throw slotUnavailable();

      const endAt = new Date(startAt.getTime() + service.durationMin * MINUTE_MS);
      const hold = await this.repository.createHold(tx, {
        professionalId: pro.id,
        serviceId: service.id,
        serviceNameSnapshot: service.name,
        priceCentsSnapshot: service.priceCents,
        startAt,
        endAt,
        // RN-42: o buffer vigente na criação fica gravado; a constraint e a grade usam este valor.
        blockEndAt: new Date(endAt.getTime() + pro.bufferMin * MINUTE_MS),
        tokenHash: hashHoldToken(token),
        expiresAt: new Date(query.now.getTime() + HOLD_TTL_MS),
      });
      return hold.expiresAt;
    });

    return { holdToken: token, expiresAt: expiresAt.toISOString() };
  }

  /** A cliente voltou: libera o horário. Idempotente e silencioso (não revela se existia). */
  async releaseHold(slug: string, token: string): Promise<void> {
    const pro = await this.publicPage.professional(slug);
    await this.repository.withScheduleLock(pro.id, (tx) =>
      this.repository.deleteHold(tx, pro.id, hashHoldToken(token)),
    );
  }

  /**
   * RN-43: converte o hold em agendamento na mesma transação e apaga o hold. Revalida só a
   * expiração e o conflito (Q-23). RN-44: hold ausente ou expirado → 410. O agendamento usa o
   * snapshot do hold (RN-11, Q-30), não o serviço de agora.
   */
  async confirm(slug: string, input: CreateBooking): Promise<BookingResponse> {
    const pro = await this.publicPage.professional(slug);
    const tokenHash = hashHoldToken(input.holdToken);

    let booking: BookingResponse;
    try {
      booking = await this.repository.withScheduleLock(pro.id, async (tx) => {
        const hold = await this.repository.findHold(tx, pro.id, tokenHash);
        if (!hold || hold.expiresAt <= this.clock.now()) throw holdExpired();

        const client = await this.repository.upsertClient(tx, pro.id, input.name, input.phone);
        const durationMin = Math.round((hold.endAt.getTime() - hold.startAt.getTime()) / MINUTE_MS);
        const appointment = await this.repository.createAppointment(tx, {
          professionalId: pro.id,
          clientId: client.id,
          serviceId: hold.serviceId,
          serviceNameSnapshot: hold.serviceNameSnapshot,
          priceCentsSnapshot: hold.priceCentsSnapshot,
          durationMinSnapshot: durationMin,
          startAt: hold.startAt,
          endAt: hold.endAt,
          blockEndAt: hold.blockEndAt,
          clientNotes: input.notes ?? null,
          bookedName: input.name, // Q-29
        });
        await this.repository.deleteHold(tx, pro.id, tokenHash);

        return {
          appointmentId: appointment.id,
          startAt: hold.startAt.toISOString(),
          endAt: hold.endAt.toISOString(),
          serviceName: hold.serviceNameSnapshot,
          priceCents: hold.priceCentsSnapshot,
          durationMin,
          timezone: pro.timezone,
          businessName: pro.businessName,
        };
      });
    } catch (error) {
      // RN-42: a exclusion constraint barrou uma sobreposição que escapou do lock.
      if (postgresErrorCode(error) === PG_EXCLUSION_VIOLATION) throw slotUnavailable();
      throw error;
    }
    // Depois do commit: a Agenda Hub recebe a reserva nova (SSE, ADR-0001).
    await this.appointments.publishCreated(pro.id, booking.appointmentId);
    return booking;
  }
}
