import type { Prisma, Service } from '../../src/generated/prisma/client.js';
import type { PrismaService } from '../../src/prisma/prisma.service.js';

const MINUTE = 60_000;

const DEFAULT_SERVICE = {
  name: 'Manicure Tradicional',
  category: 'Manicure',
  priceCents: 4000,
  durationMin: 45,
};

const NAMES = ['Maria Souza', 'Ana Oliveira', 'Juliana Santos', 'Fernanda Lima', 'Camila Rocha'];
const SERVICES: readonly {
  name: string;
  category: string;
  priceCents: number;
  durationMin: number;
}[] = [
  { name: 'Alongamento em Gel', category: 'Alongamento', priceCents: 15000, durationMin: 120 },
  { name: 'Esmaltação em Gel', category: 'Esmaltação', priceCents: 7000, durationMin: 60 },
  { name: 'Manicure Tradicional', category: 'Manicure', priceCents: 4000, durationMin: 45 },
];

/**
 * Factories com dados realistas (nomes BR, E.164, centavos) e únicos por chamada.
 * Cada `overrides` é repassado ao Prisma, então qualquer coluna pode ser fixada no teste.
 */
export function makeFactories(prisma: PrismaService) {
  let seq = 0;
  const next = () => ++seq;

  return {
    professional(overrides: Partial<Prisma.ProfessionalUncheckedCreateInput> = {}) {
      const n = next();
      return prisma.professional.create({
        data: {
          email: `profissional${String(n)}@exemplo.com.br`,
          passwordHash: '!',
          businessName: `Studio ${String(n)}`,
          slug: `studio-${String(n)}`,
          ...overrides,
        },
      });
    },

    client(professionalId: string, overrides: Partial<Prisma.ClientUncheckedCreateInput> = {}) {
      const n = next();
      return prisma.client.create({
        data: {
          professionalId,
          name: NAMES[n % NAMES.length] ?? 'Maria Souza',
          phoneE164: `+55119${String(n).padStart(8, '0')}`,
          source: 'WEB',
          ...overrides,
        },
      });
    },

    service(professionalId: string, overrides: Partial<Prisma.ServiceUncheckedCreateInput> = {}) {
      const { name, category, priceCents, durationMin } =
        SERVICES[next() % SERVICES.length] ?? DEFAULT_SERVICE;
      return prisma.service.create({
        data: { professionalId, name, category, priceCents, durationMin, ...overrides },
      });
    },

    /** Agendamento com snapshot do serviço (RN-11) e `blockEndAt = fim + buffer` gravado. */
    appointment({
      professionalId,
      clientId,
      service,
      startAt = new Date('2026-11-12T14:00:00Z'),
      bufferMin = 10,
      ...overrides
    }: {
      professionalId: string;
      clientId: string;
      service: Service;
      startAt?: Date;
      bufferMin?: number;
    } & Partial<Prisma.AppointmentUncheckedCreateInput>) {
      const endAt = new Date(startAt.getTime() + service.durationMin * MINUTE);
      return prisma.appointment.create({
        data: {
          professionalId,
          clientId,
          serviceId: service.id,
          serviceNameSnapshot: service.name,
          priceCentsSnapshot: service.priceCents,
          durationMinSnapshot: service.durationMin,
          startAt,
          endAt,
          blockEndAt: new Date(endAt.getTime() + bufferMin * MINUTE),
          source: 'WEB',
          ...overrides,
        },
      });
    },
  };
}

export type Factories = ReturnType<typeof makeFactories>;
