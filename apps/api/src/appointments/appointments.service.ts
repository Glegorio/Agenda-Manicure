import { Injectable, Logger } from '@nestjs/common';
import type {
  AppointmentResponse,
  ManualAppointmentInput,
  TransitionRequest,
} from '@agende/contracts';
import { type TransitionCommand, validateTransition } from '@agende/scheduling';
import { Clock } from '../clock/clock.js';
import { DomainError } from '../common/domain-error.js';
import { PG_EXCLUSION_VIOLATION, postgresErrorCode } from '../prisma/postgres-error.js';
import { AppointmentEvents } from './appointment-events.js';
import { toAppointmentResponse } from './appointments.mapper.js';
import { AppointmentsRepository } from './appointments.repository.js';

const MINUTE_MS = 60_000;

const accountGone = () => new DomainError('UNAUTHORIZED');
const appointmentNotFound = () => new DomainError('NOT_FOUND', 'Agendamento não encontrado.');
const serviceNotFound = () => new DomainError('NOT_FOUND', 'Serviço não encontrado.');
const slotUnavailable = () =>
  new DomainError('SLOT_UNAVAILABLE', 'Já existe um agendamento ou reserva neste horário.');

function toCommand(request: TransitionRequest, priceCentsSnapshot: number): TransitionCommand {
  switch (request.to) {
    case 'COMPLETED':
      return {
        to: 'COMPLETED',
        paymentMethod: request.paymentMethod,
        paidCents: request.paidCents ?? priceCentsSnapshot, // RN-52, Q-13
      };
    case 'CANCELLED':
      // RN-53: pelo app quem cancela é sempre a profissional (token), nunca o body.
      return {
        to: 'CANCELLED',
        cancelledBy: 'PROFESSIONAL',
        ...(request.reason !== undefined && { reason: request.reason }),
      };
    default:
      return { to: request.to };
  }
}

/**
 * Agenda da profissional: lista, agendamento manual (RN-45, Q-19) e transições (RN-52..54).
 * Cada escrita publica um evento SSE depois do commit (ADR-0001).
 */
@Injectable()
export class AppointmentsService {
  private readonly logger = new Logger(AppointmentsService.name);

  constructor(
    private readonly repository: AppointmentsRepository,
    private readonly events: AppointmentEvents,
    private readonly clock: Clock,
  ) {}

  async list(professionalId: string, from: string, to: string): Promise<AppointmentResponse[]> {
    const rows = await this.repository.listOverlapping(
      this.repository.reader,
      professionalId,
      new Date(from),
      new Date(to),
    );
    return rows.map(toAppointmentResponse);
  }

  /**
   * RN-45/Q-19: ignora antecedência, janelas, grade e bloqueios; respeita agendamentos ativos e
   * holds não expirados, revalidados sob o lock. A exclusion constraint é a garantia final (RN-42).
   */
  async createManual(
    professionalId: string,
    input: ManualAppointmentInput,
  ): Promise<AppointmentResponse> {
    let created: AppointmentResponse;
    try {
      created = await this.repository.withLock(professionalId, async (tx) => {
        const bufferMin = await this.repository.bufferMinOf(tx, professionalId);
        if (bufferMin === null) throw accountGone();
        const service = await this.repository.activeService(tx, professionalId, input.serviceId);
        if (!service) throw serviceNotFound();

        const startAt = new Date(input.startAt);
        const endAt = new Date(startAt.getTime() + service.durationMin * MINUTE_MS);
        // RN-31: o buffer vigente protege o próximo atendimento e fica gravado (RN-42).
        const blockEndAt = new Date(endAt.getTime() + bufferMin * MINUTE_MS);
        const now = this.clock.now();
        if (await this.repository.hasConflict(tx, professionalId, startAt, blockEndAt, now)) {
          throw slotUnavailable();
        }

        const client = await this.repository.upsertClient(
          tx,
          professionalId,
          input.name,
          input.phone,
        );
        const row = await this.repository.create(tx, {
          professionalId,
          clientId: client.id,
          serviceId: service.id,
          serviceNameSnapshot: service.name,
          priceCentsSnapshot: service.priceCents,
          durationMinSnapshot: service.durationMin,
          startAt,
          endAt,
          blockEndAt,
          source: 'APP',
          clientNotes: input.notes ?? null,
        });
        return toAppointmentResponse(row);
      });
    } catch (error) {
      if (postgresErrorCode(error) === PG_EXCLUSION_VIOLATION) throw slotUnavailable();
      throw error;
    }
    this.events.publish({ professionalId, type: 'appointment.created', appointment: created });
    return created;
  }

  /**
   * RN-54 pelo domínio; o update é condicionado ao status lido, então de duas transições
   * concorrentes só uma vence e a outra recebe 422 (doc 05). Transição só libera a agenda
   * (RN-51), por isso dispensa o lock.
   */
  async transition(
    professionalId: string,
    id: string,
    request: TransitionRequest,
  ): Promise<AppointmentResponse> {
    const updated = await this.repository.transaction(async (tx) => {
      const current = await this.repository.find(tx, professionalId, id);
      if (!current) throw appointmentNotFound();

      const command = toCommand(request, current.priceCentsSnapshot);
      const result = validateTransition(current.status, command);
      if (!result.ok) throw new DomainError(result.code, result.message);

      const changed = await this.repository.updateIfStatus(tx, professionalId, id, current.status, {
        status: command.to,
        statusChangedAt: this.clock.now(),
        ...(command.to === 'COMPLETED' && {
          paidCents: command.paidCents,
          paymentMethod: command.paymentMethod,
        }),
        ...(command.to === 'CANCELLED' && {
          cancelledBy: command.cancelledBy,
          cancelReason: command.reason ?? null,
        }),
        // Falta não tem coluna própria: o motivo opcional fica em `cancel_reason` (doc 04).
        ...(request.to === 'NO_SHOW' && { cancelReason: request.reason ?? null }),
      });
      if (!changed) throw new DomainError('INVALID_TRANSITION');

      const row = await this.repository.find(tx, professionalId, id);
      if (!row) throw appointmentNotFound();
      return toAppointmentResponse(row);
    });
    this.events.publish({ professionalId, type: 'appointment.updated', appointment: updated });
    return updated;
  }

  /**
   * Reserva pública confirmada (RN-43): avisa a Agenda Hub. Chame após o commit. Nunca lança: a
   * reserva já está gravada e uma falha aqui não pode virar erro para a cliente.
   */
  async publishCreated(professionalId: string, id: string): Promise<void> {
    try {
      const row = await this.repository.find(this.repository.reader, professionalId, id);
      if (!row) return;
      this.events.publish({
        professionalId,
        type: 'appointment.created',
        appointment: toAppointmentResponse(row),
      });
    } catch (error) {
      this.logger.error(`Falha ao publicar o agendamento ${id} no SSE`, error);
    }
  }
}
