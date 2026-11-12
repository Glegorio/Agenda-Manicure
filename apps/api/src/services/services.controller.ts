import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import {
  idSchema,
  type ServiceDeleteResponse,
  type ServiceInput,
  serviceInputSchema,
  type ServiceResponse,
  type ServiceUpdate,
  serviceUpdateSchema,
} from '@agende/contracts';
import { CurrentProfessional } from '../auth/current-professional.decorator.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { ServicesService } from './services.service.js';

const idPipe = new ZodValidationPipe(idSchema);

/** Serviços da profissional autenticada (RN-10..12); escopo sempre pelo token (regra 5). */
@Controller('v1/services')
export class ServicesController {
  constructor(private readonly services: ServicesService) {}

  @Get()
  list(@CurrentProfessional() professionalId: string): Promise<ServiceResponse[]> {
    return this.services.list(professionalId);
  }

  @Post()
  create(
    @CurrentProfessional() professionalId: string,
    @Body(new ZodValidationPipe(serviceInputSchema)) input: ServiceInput,
  ): Promise<ServiceResponse> {
    return this.services.create(professionalId, input);
  }

  @Get(':id')
  get(
    @CurrentProfessional() professionalId: string,
    @Param('id', idPipe) id: string,
  ): Promise<ServiceResponse> {
    return this.services.get(professionalId, id);
  }

  @Patch(':id')
  update(
    @CurrentProfessional() professionalId: string,
    @Param('id', idPipe) id: string,
    @Body(new ZodValidationPipe(serviceUpdateSchema)) patch: ServiceUpdate,
  ): Promise<ServiceResponse> {
    return this.services.update(professionalId, id, patch);
  }

  /** Q-24: `200 { outcome }` — `DELETED` ou `DEACTIVATED` (RN-12). */
  @Delete(':id')
  @HttpCode(200)
  remove(
    @CurrentProfessional() professionalId: string,
    @Param('id', idPipe) id: string,
  ): Promise<ServiceDeleteResponse> {
    return this.services.remove(professionalId, id);
  }
}
