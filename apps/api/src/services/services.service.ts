import { Injectable } from '@nestjs/common';
import type {
  ServiceDeleteResponse,
  ServiceInput,
  ServiceResponse,
  ServiceUpdate,
} from '@agende/contracts';
import { Clock } from '../clock/clock.js';
import { serviceNotFound } from './services.errors.js';
import { ServicesRepository } from './services.repository.js';

@Injectable()
export class ServicesService {
  constructor(
    private readonly repository: ServicesRepository,
    private readonly clock: Clock,
  ) {}

  list(professionalId: string): Promise<ServiceResponse[]> {
    return this.repository.list(professionalId);
  }

  async get(professionalId: string, id: string): Promise<ServiceResponse> {
    const service = await this.repository.find(professionalId, id);
    if (!service) throw serviceNotFound();
    return service;
  }

  create(professionalId: string, input: ServiceInput): Promise<ServiceResponse> {
    return this.repository.create(professionalId, input);
  }

  /** RN-11: agendamentos guardam snapshot; mudar preço/duração aqui não os altera. */
  async update(professionalId: string, id: string, patch: ServiceUpdate): Promise<ServiceResponse> {
    const service = await this.repository.update(professionalId, id, patch);
    if (!service) throw serviceNotFound();
    return service;
  }

  async remove(professionalId: string, id: string): Promise<ServiceDeleteResponse> {
    const outcome = await this.repository.remove(professionalId, id, this.clock.now());
    if (outcome === 'NOT_FOUND') throw serviceNotFound();
    return { outcome };
  }
}
