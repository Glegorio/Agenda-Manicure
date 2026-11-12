import {
  Body,
  Controller,
  Get,
  HttpCode,
  type MessageEvent,
  Param,
  Post,
  Query,
  Sse,
} from '@nestjs/common';
import {
  type AppointmentListQuery,
  appointmentListQuerySchema,
  type AppointmentResponse,
  idSchema,
  type ManualAppointmentInput,
  manualAppointmentInputSchema,
  type TransitionRequest,
  transitionRequestSchema,
} from '@agende/contracts';
import type { Observable } from 'rxjs';
import { CurrentProfessional } from '../auth/current-professional.decorator.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { AppointmentEvents } from './appointment-events.js';
import { AppointmentsService } from './appointments.service.js';

/** Agenda Hub: lista, manual, transições e tempo real (doc 05, RN-45, RN-50..54, ADR-0001). */
@Controller('v1/appointments')
export class AppointmentsController {
  constructor(
    private readonly appointments: AppointmentsService,
    private readonly events: AppointmentEvents,
  ) {}

  @Get()
  list(
    @CurrentProfessional() professionalId: string,
    @Query(new ZodValidationPipe(appointmentListQuerySchema)) query: AppointmentListQuery,
  ): Promise<AppointmentResponse[]> {
    return this.appointments.list(professionalId, query.from, query.to);
  }

  @Post()
  create(
    @CurrentProfessional() professionalId: string,
    @Body(new ZodValidationPipe(manualAppointmentInputSchema)) input: ManualAppointmentInput,
  ): Promise<AppointmentResponse> {
    return this.appointments.createManual(professionalId, input);
  }

  @Post(':id/transitions')
  @HttpCode(200)
  transition(
    @CurrentProfessional() professionalId: string,
    @Param('id', new ZodValidationPipe(idSchema)) id: string,
    @Body(new ZodValidationPipe(transitionRequestSchema)) request: TransitionRequest,
  ): Promise<AppointmentResponse> {
    return this.appointments.transition(professionalId, id, request);
  }

  /** SSE: `appointment.created` / `appointment.updated`, só da própria profissional (regra 5). */
  @Sse('stream')
  stream(@CurrentProfessional() professionalId: string): Observable<MessageEvent> {
    return this.events.streamFor(professionalId);
  }
}
