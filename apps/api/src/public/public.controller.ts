import { Controller, Get, Header, Param, Query } from '@nestjs/common';
import {
  type AvailabilityDaysQuery,
  availabilityDaysQuerySchema,
  type AvailabilityDaysResponse,
  type AvailabilityQuery,
  availabilityQuerySchema,
  type AvailabilityResponse,
  type PublicProfileResponse,
} from '@agende/contracts';
import { z } from 'zod';
import { Public } from '../auth/public.decorator.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { PublicService } from './public.service.js';

/** Slug na URL: só limita o tamanho; formato inválido simplesmente não existe (404). */
const slugPipe = new ZodValidationPipe(z.string().min(1).max(100));

/** Página pública de agendamento (booking web, sem login). Rate limit na 2.10 (Q-25). */
@Public()
@Controller('v1/public/:slug')
export class PublicController {
  constructor(private readonly publicPage: PublicService) {}

  @Get()
  profile(@Param('slug', slugPipe) slug: string): Promise<PublicProfileResponse> {
    return this.publicPage.getProfile(slug);
  }

  /** Horários mudam a cada reserva: nunca cachear (fase 3.8). */
  @Get('availability')
  @Header('Cache-Control', 'no-store')
  availability(
    @Param('slug', slugPipe) slug: string,
    @Query(new ZodValidationPipe(availabilityQuerySchema)) query: AvailabilityQuery,
  ): Promise<AvailabilityResponse> {
    return this.publicPage.getSlots(slug, query.serviceId, query.date);
  }

  @Get('availability/days')
  @Header('Cache-Control', 'no-store')
  availabilityDays(
    @Param('slug', slugPipe) slug: string,
    @Query(new ZodValidationPipe(availabilityDaysQuerySchema)) query: AvailabilityDaysQuery,
  ): Promise<AvailabilityDaysResponse> {
    return this.publicPage.getDays(slug, query.serviceId, query.from, query.to);
  }
}
