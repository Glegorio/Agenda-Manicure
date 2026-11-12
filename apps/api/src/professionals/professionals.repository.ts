import { Injectable } from '@nestjs/common';
import {
  type ProfessionalProfile,
  professionalProfileSchema,
  type ProfessionalUpdate,
} from '@agende/contracts';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

/** Colunas do perfil (`professionalProfileSchema`); nunca inclui `passwordHash`. */
const PROFILE_SELECT = {
  id: true,
  email: true,
  businessName: true,
  slug: true,
  timezone: true,
  addressLine: true,
  showFullAddress: true,
  city: true,
  state: true,
  zip: true,
  lat: true,
  lng: true,
  logoUrl: true,
  coverUrl: true,
  themePalette: true,
  themeMode: true,
  cancellationPolicy: true,
  bufferMin: true,
  slotStepMin: true,
  minNoticeMin: true,
  bookingHorizonDays: true,
  closingReminderOffsetMin: true,
} as const satisfies Prisma.ProfessionalSelect;

/** Todo acesso é pelo `id` vindo do token (regra 5). */
@Injectable()
export class ProfessionalsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Validado pelo contrato: o banco tipa `slotStepMin` como `number`; o contrato, como 5/10/15/30. */
  async findProfile(id: string): Promise<ProfessionalProfile | null> {
    const row = await this.prisma.professional.findUnique({
      where: { id },
      select: PROFILE_SELECT,
    });
    return row && professionalProfileSchema.parse(row);
  }

  /** `count` = 0 quando a conta não existe mais (o service trata como sessão inválida). */
  /** Tira as chaves `undefined` da saída do Zod (exigido por `exactOptionalPropertyTypes`). */
  async updateProfile(id: string, patch: ProfessionalUpdate): Promise<ProfessionalProfile | null> {
    const data = Object.fromEntries(
      Object.entries(patch).filter(([, value]) => value !== undefined),
    ) as Prisma.ProfessionalUpdateManyMutationInput;
    const { count } = await this.prisma.professional.updateMany({ where: { id }, data });
    return count === 0 ? null : this.findProfile(id);
  }

  /** Slug em uso por **outra** profissional (citext: sem diferenciar maiúsculas). */
  async slugTakenByOther(slug: string, professionalId: string): Promise<boolean> {
    const count = await this.prisma.professional.count({
      where: { slug, id: { not: professionalId } },
    });
    return count > 0;
  }
}
