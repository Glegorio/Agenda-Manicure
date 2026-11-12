import { Injectable } from '@nestjs/common';
import {
  type ProfessionalProfile,
  type ProfessionalUpdate,
  RESERVED_SLUGS,
  type SlugAvailabilityResponse,
  slugSchema,
} from '@agende/contracts';
import { PG_UNIQUE_VIOLATION, postgresErrorCode } from '../prisma/postgres-error.js';
import { accountGone, slugTaken } from './professionals.errors.js';
import { ProfessionalsRepository } from './professionals.repository.js';

@Injectable()
export class ProfessionalsService {
  constructor(private readonly repository: ProfessionalsRepository) {}

  async getProfile(professionalId: string): Promise<ProfessionalProfile> {
    const profile = await this.repository.findProfile(professionalId);
    if (!profile) throw accountGone();
    return profile;
  }

  /**
   * Q-21: trocar o slug é permitido e o antigo fica livre na hora (sem redirecionamento).
   * Mudar fuso/parâmetros não altera agendamentos existentes (RN-11, Q-20).
   */
  async updateProfile(
    professionalId: string,
    patch: ProfessionalUpdate,
  ): Promise<ProfessionalProfile> {
    if (
      patch.slug !== undefined &&
      (await this.repository.slugTakenByOther(patch.slug, professionalId))
    ) {
      throw slugTaken();
    }
    let profile: ProfessionalProfile | null;
    try {
      profile = await this.repository.updateProfile(professionalId, patch);
    } catch (error) {
      // Corrida entre a checagem e o update: o índice único citext é a garantia final.
      if (postgresErrorCode(error) === PG_UNIQUE_VIOLATION) throw slugTaken();
      throw error;
    }
    if (!profile) throw accountGone();
    return profile;
  }

  /** RN-90 para feedback ao digitar: formato e reservados primeiro, depois o banco. */
  async checkSlug(professionalId: string, slug: string): Promise<SlugAvailabilityResponse> {
    if (RESERVED_SLUGS.includes(slug)) return { slug, available: false, reason: 'RESERVED' };
    if (!slugSchema.safeParse(slug).success) {
      return { slug, available: false, reason: 'INVALID_FORMAT' };
    }
    if (await this.repository.slugTakenByOther(slug, professionalId)) {
      return { slug, available: false, reason: 'TAKEN' };
    }
    return { slug, available: true };
  }
}
