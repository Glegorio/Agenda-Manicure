import { Body, Controller, Get, Patch, Query } from '@nestjs/common';
import {
  type ProfessionalProfile,
  type ProfessionalUpdate,
  professionalUpdateSchema,
  type SlugAvailabilityQuery,
  slugAvailabilityQuerySchema,
  type SlugAvailabilityResponse,
} from '@agende/contracts';
import { CurrentProfessional } from '../auth/current-professional.decorator.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { ProfessionalsService } from './professionals.service.js';

/** Perfil da profissional autenticada; o id vem sempre do token (regra 5). */
@Controller('v1/me')
export class ProfessionalsController {
  constructor(private readonly professionals: ProfessionalsService) {}

  @Get()
  get(@CurrentProfessional() professionalId: string): Promise<ProfessionalProfile> {
    return this.professionals.getProfile(professionalId);
  }

  @Patch()
  update(
    @CurrentProfessional() professionalId: string,
    @Body(new ZodValidationPipe(professionalUpdateSchema)) patch: ProfessionalUpdate,
  ): Promise<ProfessionalProfile> {
    return this.professionals.updateProfile(professionalId, patch);
  }

  @Get('slug-availability')
  slugAvailability(
    @CurrentProfessional() professionalId: string,
    @Query(new ZodValidationPipe(slugAvailabilityQuerySchema)) query: SlugAvailabilityQuery,
  ): Promise<SlugAvailabilityResponse> {
    return this.professionals.checkSlug(professionalId, query.slug);
  }
}
