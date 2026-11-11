// Seed determinístico (.claude/rules/database.md): profissional demo com serviços da spec e escala
// 08–12 / 13–18 de segunda a sábado. Pode rodar várias vezes: RESETA os serviços e a escala da
// demo (IDs mudam; edições feitas na conta demo em dev se perdem). Nunca roda em produção.
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.ts';

const connectionString = process.env['DATABASE_URL'];
if (!connectionString) throw new Error('DATABASE_URL não definido.');
if (process.env['NODE_ENV'] === 'production') throw new Error('Seed recusado em produção.');

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

/** Janelas em minutos desde a meia-noite local (1440 = 24:00). */
const minutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

const SERVICES = [
  { name: 'Alongamento em Gel', category: 'Alongamento', priceCents: 15000, durationMin: 120 },
  { name: 'Manutenção de Gel', category: 'Alongamento', priceCents: 9000, durationMin: 90 },
  { name: 'Esmaltação em Gel', category: 'Esmaltação', priceCents: 7000, durationMin: 60 },
  { name: 'Manicure Tradicional', category: 'Manicure', priceCents: 4000, durationMin: 45 },
  { name: 'Pedicure', category: 'Pedicure', priceCents: 5000, durationMin: 60 },
];

async function main(): Promise<void> {
  const professional = await prisma.professional.upsert({
    where: { email: 'demo@agende.app' },
    update: {},
    create: {
      email: 'demo@agende.app',
      // Hash inválido de propósito: a conta demo não faz login até a tarefa 2.3.
      passwordHash: '!',
      businessName: 'Studio Demo',
      slug: 'demo',
      city: 'São Paulo',
      state: 'SP',
      cancellationPolicy: 'Cancelamentos com até 24 horas de antecedência, sem custo.',
    },
  });

  await prisma.$transaction([
    prisma.service.deleteMany({ where: { professionalId: professional.id } }),
    prisma.weeklyScheduleWindow.deleteMany({ where: { professionalId: professional.id } }),
    prisma.service.createMany({
      data: SERVICES.map((service, sortOrder) => ({
        ...service,
        professionalId: professional.id,
        sortOrder,
      })),
    }),
    prisma.weeklyScheduleWindow.createMany({
      data: [1, 2, 3, 4, 5, 6].flatMap((weekday) => [
        {
          professionalId: professional.id,
          weekday,
          startMin: minutes('08:00'),
          endMin: minutes('12:00'),
        },
        {
          professionalId: professional.id,
          weekday,
          startMin: minutes('13:00'),
          endMin: minutes('18:00'),
        },
      ]),
    }),
  ]);
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}
