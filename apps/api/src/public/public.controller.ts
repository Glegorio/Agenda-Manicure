import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import {
  type AvailabilityDaysQuery,
  availabilityDaysQuerySchema,
  type AvailabilityDaysResponse,
  type AvailabilityQuery,
  availabilityQuerySchema,
  type AvailabilityResponse,
  type BookingResponse,
  type CreateBooking,
  createBookingSchema,
  type CreateHold,
  createHoldSchema,
  type HoldResponse,
  type PublicProfileResponse,
} from '@agende/contracts';
import { z } from 'zod';
import { Public } from '../auth/public.decorator.js';
import { RateLimit } from '../common/rate-limit.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { BookingService } from './booking.service.js';
import { PublicService } from './public.service.js';

/** Slug na URL: só limita o tamanho; formato inválido simplesmente não existe (404). */
const slugPipe = new ZodValidationPipe(z.string().min(1).max(100));
const holdTokenPipe = new ZodValidationPipe(createBookingSchema.shape.holdToken);

/** Página pública de agendamento (booking web, sem login). Rate limit por IP + slug (Q-25). */
@Public()
@RateLimit('public-read')
@Controller('v1/public/:slug')
export class PublicController {
  constructor(
    private readonly publicPage: PublicService,
    private readonly booking: BookingService,
  ) {}

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

  /** RN-40/41: segura o horário por 5 minutos; 409 se não estiver mais na grade (Q-28). */
  @Post('holds')
  @RateLimit('public-write')
  createHold(
    @Param('slug', slugPipe) slug: string,
    @Body(new ZodValidationPipe(createHoldSchema)) body: CreateHold,
  ): Promise<HoldResponse> {
    return this.booking.createHold(slug, body.serviceId, body.startAt);
  }

  @Delete('holds/:holdToken')
  @RateLimit('public-write')
  @HttpCode(204)
  releaseHold(
    @Param('slug', slugPipe) slug: string,
    @Param('holdToken', holdTokenPipe) holdToken: string,
  ): Promise<void> {
    return this.booking.releaseHold(slug, holdToken);
  }

  /** RN-43/44: confirma o hold; 410 se expirou, 409 se a constraint barrar (RN-42). */
  @Post('bookings')
  @RateLimit('public-write')
  confirm(
    @Param('slug', slugPipe) slug: string,
    @Body(new ZodValidationPipe(createBookingSchema)) body: CreateBooking,
  ): Promise<BookingResponse> {
    return this.booking.confirm(slug, body);
  }
}
