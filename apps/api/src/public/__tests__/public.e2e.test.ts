import type { INestApplication } from '@nestjs/common';
import {
  availabilityDaysResponseSchema,
  availabilityResponseSchema,
  errorResponseSchema,
  publicProfileResponseSchema,
} from '@agende/contracts';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Professional, Service } from '../../generated/prisma/client.js';
import { createTestApp } from '../../../test/app.js';
import { createTestPrisma, resetDatabase } from '../../../test/database.js';
import { makeFactories } from '../../../test/factories/index.js';

// Relógio da app de teste: 2026-11-12T12:00Z = quinta 09:00 em São Paulo (UTC−3).
const prisma = createTestPrisma();
const factories = makeFactories(prisma);
let app: INestApplication<App>;

const http = () => request(app.getHttpServer());
const errorCode = (body: unknown) => errorResponseSchema.parse(body).error.code;
const THURSDAY = '2026-11-12';

/** `HH:mm` de São Paulo → ISO UTC (SP é UTC−3 o ano todo). */
const sp = (date: string, time: string) => new Date(`${date}T${time}:00-03:00`).toISOString();

/** Grade `HH:mm` de `from` a `to` (inclusive), de `step` em `step` minutos. */
function grid(from: string, to: string, step = 15): string[] {
  const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
  const out: string[] = [];
  for (let m = toMin(from); m <= toMin(to); m += step) {
    out.push(`${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`);
  }
  return out;
}

/** Profissional pública com escala seg–sex 08–12 / 13–18 (buffer 10, step 15, aviso 120). */
async function setupStudio(slug = 'studio-ana'): Promise<{ pro: Professional; service: Service }> {
  const pro = await factories.professional({
    slug,
    businessName: 'Studio Ana',
    city: 'São Paulo',
    state: 'SP',
    zip: '01310100',
    lat: -23.56,
    lng: -46.65,
    cancellationPolicy: 'Avise com 24 horas.',
  });
  await prisma.weeklyScheduleWindow.createMany({
    data: [1, 2, 3, 4, 5].flatMap((weekday) => [
      { professionalId: pro.id, weekday, startMin: 8 * 60, endMin: 12 * 60 },
      { professionalId: pro.id, weekday, startMin: 13 * 60, endMin: 18 * 60 },
    ]),
  });
  const service = await factories.service(pro.id, {
    name: 'Esmaltação em Gel',
    durationMin: 60,
    priceCents: 7000,
    sortOrder: 0,
  });
  return { pro, service };
}

const slotsOf = async (slug: string, serviceId: string, date = THURSDAY) => {
  const res = await http()
    .get(`/v1/public/${slug}/availability`)
    .query({ serviceId, date })
    .expect(200);
  return availabilityResponseSchema.parse(res.body);
};

/** Horários livres de quinta para 60 min: 11:00 (aviso de 120 min) e 13:00–17:00. */
const THURSDAY_FREE = ['11:00', ...grid('13:00', '17:00')].map((t) => sp(THURSDAY, t));

beforeAll(async () => {
  app = await createTestApp();
});

beforeEach(async () => {
  await resetDatabase(prisma);
});

afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

describe('GET /v1/public/:slug', () => {
  it('RN-91 / RN-92: perfil sem login, com política e só serviços ativos e públicos', async () => {
    const { pro, service } = await setupStudio();
    await factories.service(pro.id, { name: 'Inativo', active: false, sortOrder: 1 });
    await factories.service(pro.id, { name: 'Só no app', public: false, sortOrder: 2 });
    const second = await factories.service(pro.id, { name: 'Pedicure', sortOrder: 3 });

    const res = await http().get('/v1/public/studio-ana').expect(200);

    const profile = publicProfileResponseSchema.parse(res.body);
    expect(profile).toMatchObject({
      slug: 'studio-ana',
      businessName: 'Studio Ana',
      timezone: 'America/Sao_Paulo',
      cancellationPolicy: 'Avise com 24 horas.',
    });
    expect(profile.services.map((s) => s.id)).toEqual([service.id, second.id]);
  });

  it('LGPD: não expõe e-mail, CEP, coordenadas nem hash de senha', async () => {
    await setupStudio();
    const res = await http().get('/v1/public/studio-ana').expect(200);
    for (const key of ['email', 'zip', 'lat', 'lng', 'passwordHash', 'id']) {
      expect(res.body).not.toHaveProperty(key);
    }
  });

  it('Q-27: endereço completo só aparece se a profissional optar', async () => {
    const { pro } = await setupStudio();
    await prisma.professional.update({
      where: { id: pro.id },
      data: { addressLine: 'Rua Augusta, 100' },
    });

    const hidden = await http().get('/v1/public/studio-ana').expect(200);
    expect(hidden.body).toMatchObject({ addressLine: null, city: 'São Paulo', state: 'SP' });

    await prisma.professional.update({ where: { id: pro.id }, data: { showFullAddress: true } });
    const shown = await http().get('/v1/public/studio-ana').expect(200);
    expect(shown.body).toMatchObject({ addressLine: 'Rua Augusta, 100' });
  });

  it.each(['a', 'studio_ana', 'studio%00ana', '-ana'])(
    'RN-90: slug malformado "%s" → 404 (sem erro interno)',
    async (slug) => {
      const res = await http().get(`/v1/public/${encodeURIComponent(slug)}`);
      expect(res.status).toBe(404);
      expect(errorCode(res.body)).toBe('NOT_FOUND');
    },
  );

  it('RN-90: slug não diferencia maiúsculas na URL', async () => {
    await setupStudio();
    await http().get('/v1/public/Studio-Ana').expect(200);
  });

  it('slug inexistente → 404 NOT_FOUND', async () => {
    const res = await http().get('/v1/public/nao-existe');
    expect(res.status).toBe(404);
    expect(errorCode(res.body)).toBe('NOT_FOUND');
  });
});

describe('GET /v1/public/:slug/availability', () => {
  it('RN-30..35: horários do dia em UTC com o fuso da profissional (RN-02a)', async () => {
    const { service } = await setupStudio();
    expect(await slotsOf('studio-ana', service.id)).toEqual({
      timezone: 'America/Sao_Paulo',
      slots: THURSDAY_FREE,
    });
  });

  it('horários nunca são cacheados (Cache-Control: no-store)', async () => {
    const { service } = await setupStudio();
    const res = await http()
      .get('/v1/public/studio-ana/availability')
      .query({ serviceId: service.id, date: THURSDAY })
      .expect(200);
    expect(res.headers['cache-control']).toBe('no-store');
  });

  it('RN-33: data antes de hoje ou além do horizonte → lista vazia', async () => {
    const { service } = await setupStudio();
    expect((await slotsOf('studio-ana', service.id, '2026-11-11')).slots).toEqual([]);
    expect((await slotsOf('studio-ana', service.id, '2026-12-14')).slots).toEqual([]);
  });

  it('T8 / RN-02a: profissional em Nova York no dia do salto do horário de verão', async () => {
    const pro = await factories.professional({
      slug: 'ny-nails',
      timezone: 'America/New_York',
      minNoticeMin: 0,
      bookingHorizonDays: 365,
    });
    // 2027-03-14 (domingo): 02:00 EST → 03:00 EDT. Janela 00:00–05:00 local.
    await prisma.weeklyScheduleWindow.create({
      data: { professionalId: pro.id, weekday: 0, startMin: 0, endMin: 5 * 60 },
    });
    const service = await factories.service(pro.id, { durationMin: 60 });

    const res = await http()
      .get('/v1/public/ny-nails/availability')
      .query({ serviceId: service.id, date: '2027-03-14' })
      .expect(200);

    const { timezone, slots } = availabilityResponseSchema.parse(res.body);
    expect(timezone).toBe('America/New_York');
    expect(new Set(slots).size).toBe(slots.length); // sem duplicados (Q-16)
    expect(slots[0]).toBe('2027-03-14T05:00:00.000Z'); // 00:00 EST
    // A janela fecha às 05:00 EDT (09:00Z): o último início de 60 min é 04:00 EDT.
    expect(slots.at(-1)).toBe('2027-03-14T08:00:00.000Z');
    // Nenhum horário "02:xx" inexistente vira instante extra: tudo em ordem estrita.
    expect([...slots].sort()).toEqual(slots);
  });

  it('RN-31 / RN-34: agendamento ocupa até o blockEndAt gravado e libera encaixe', async () => {
    const { pro, service } = await setupStudio();
    const client = await factories.client(pro.id);
    // 13:00–14:00 com buffer gravado de 20 min (≠ buffer atual de 10): ocupa até 14:20.
    await factories.appointment({
      professionalId: pro.id,
      clientId: client.id,
      service,
      startAt: new Date(sp(THURSDAY, '13:00')),
      bufferMin: 20,
    });

    const { slots } = await slotsOf('studio-ana', service.id);

    expect(slots).not.toContain(sp(THURSDAY, '14:15'));
    expect(slots).toContain(sp(THURSDAY, '14:20')); // RN-34: encaixe no fim da ocupação
    expect(slots).toContain(sp(THURSDAY, '11:00'));
  });

  it('T9 / RN-51: agendamento cancelado não ocupa', async () => {
    const { pro, service } = await setupStudio();
    const client = await factories.client(pro.id);
    await factories.appointment({
      professionalId: pro.id,
      clientId: client.id,
      service,
      startAt: new Date(sp(THURSDAY, '13:00')),
      status: 'CANCELLED',
      cancelledBy: 'CLIENT',
    });
    expect((await slotsOf('studio-ana', service.id)).slots).toEqual(THURSDAY_FREE);
  });

  it('T5: hold ativo ocupa; hold expirado não', async () => {
    const { pro, service } = await setupStudio();
    const hold = (startTime: string, expiresAt: string, token: string) =>
      prisma.slotHold.create({
        data: {
          professionalId: pro.id,
          serviceId: service.id,
          startAt: new Date(sp(THURSDAY, startTime)),
          endAt: new Date(new Date(sp(THURSDAY, startTime)).getTime() + 60 * 60_000),
          blockEndAt: new Date(new Date(sp(THURSDAY, startTime)).getTime() + 70 * 60_000),
          tokenHash: token,
          expiresAt: new Date(expiresAt),
        },
      });
    await hold('14:00', '2026-11-12T12:04:00Z', 'ativo');
    await hold('16:00', '2026-11-12T11:59:00Z', 'expirado');

    const { slots } = await slotsOf('studio-ana', service.id);

    expect(slots).not.toContain(sp(THURSDAY, '14:00'));
    expect(slots).toContain(sp(THURSDAY, '16:00'));
  });

  it('bloqueio manual ocupa [start, end)', async () => {
    const { pro, service } = await setupStudio();
    await prisma.manualBlock.create({
      data: {
        professionalId: pro.id,
        startAt: new Date(sp(THURSDAY, '13:00')),
        endAt: new Date(sp(THURSDAY, '18:00')),
      },
    });
    expect((await slotsOf('studio-ana', service.id)).slots).toEqual([sp(THURSDAY, '11:00')]);
  });

  it('T6 / RN-21: exceção closed na data → lista vazia', async () => {
    const { pro, service } = await setupStudio();
    await prisma.scheduleException.create({
      data: { professionalId: pro.id, date: new Date(`${THURSDAY}T00:00:00Z`), closed: true },
    });
    expect((await slotsOf('studio-ana', service.id)).slots).toEqual([]);
  });

  it('regra 5: ocupação de outra profissional não interfere', async () => {
    const { service } = await setupStudio();
    const other = await setupStudio('bia-nails');
    await prisma.manualBlock.create({
      data: {
        professionalId: other.pro.id,
        startAt: new Date(sp(THURSDAY, '08:00')),
        endAt: new Date(sp(THURSDAY, '18:00')),
      },
    });
    expect((await slotsOf('studio-ana', service.id)).slots).toEqual(THURSDAY_FREE);
  });

  it.each([
    ['inativo', { active: false }],
    ['não público', { public: false }],
  ])('RN-91: serviço %s → 404', async (_label, flags) => {
    const { pro } = await setupStudio();
    const hidden = await factories.service(pro.id, flags);
    const res = await http()
      .get('/v1/public/studio-ana/availability')
      .query({ serviceId: hidden.id, date: THURSDAY });
    expect(res.status).toBe(404);
  });

  it('regra 5: serviço de outra profissional → 404', async () => {
    await setupStudio();
    const other = await setupStudio('bia-nails');
    const res = await http()
      .get('/v1/public/studio-ana/availability')
      .query({ serviceId: other.service.id, date: THURSDAY });
    expect(res.status).toBe(404);
  });

  it.each([
    ['sem serviceId', { date: THURSDAY }],
    ['data inválida', { serviceId: '0190a8e2-5f3c-7d4e-8a9b-1c2d3e4f5a6b', date: '2026-13-01' }],
  ])('%s → 400', async (_label, query) => {
    await setupStudio();
    const res = await http().get('/v1/public/studio-ana/availability').query(query);
    expect(res.status).toBe(400);
  });

  it('slug inexistente → 404', async () => {
    const res = await http()
      .get('/v1/public/nao-existe/availability')
      .query({ serviceId: '0190a8e2-5f3c-7d4e-8a9b-1c2d3e4f5a6b', date: THURSDAY });
    expect(res.status).toBe(404);
  });
});

describe('GET /v1/public/:slug/availability/days', () => {
  it('lista os dias com vaga no período (fim de semana e folga fora)', async () => {
    const { pro, service } = await setupStudio();
    await prisma.scheduleException.create({
      data: { professionalId: pro.id, date: new Date('2026-11-16T00:00:00Z'), closed: true },
    });

    const res = await http()
      .get('/v1/public/studio-ana/availability/days')
      .query({ serviceId: service.id, from: '2026-11-12', to: '2026-11-18' })
      .expect(200);

    expect(availabilityDaysResponseSchema.parse(res.body)).toEqual({
      timezone: 'America/Sao_Paulo',
      days: ['2026-11-12', '2026-11-13', '2026-11-17', '2026-11-18'],
    });
  });

  it('dia lotado por ocupação que vem do período não aparece', async () => {
    const { pro, service } = await setupStudio();
    await prisma.manualBlock.create({
      data: {
        professionalId: pro.id,
        startAt: new Date(sp('2026-11-13', '08:00')),
        endAt: new Date(sp('2026-11-13', '18:00')),
      },
    });
    const res = await http()
      .get('/v1/public/studio-ana/availability/days')
      .query({ serviceId: service.id, from: '2026-11-13', to: '2026-11-13' })
      .expect(200);
    expect(res.body).toMatchObject({ days: [] });
  });

  it('ocupação que começa antes do período e invade o dia também conta', async () => {
    const { pro, service } = await setupStudio();
    // Qui 20:00 → sex 13:00 (SP): só a sexta é consultada; a manhã inteira fica bloqueada.
    await prisma.manualBlock.create({
      data: {
        professionalId: pro.id,
        startAt: new Date(sp(THURSDAY, '20:00')),
        endAt: new Date(sp('2026-11-13', '13:00')),
      },
    });
    const { slots } = await slotsOf('studio-ana', service.id, '2026-11-13');
    expect(slots[0]).toBe(sp('2026-11-13', '13:00'));
  });

  it('RN-33: período recortado em [hoje, hoje + horizonte]', async () => {
    const { pro, service } = await setupStudio();
    await prisma.professional.update({ where: { id: pro.id }, data: { bookingHorizonDays: 4 } });
    const res = await http()
      .get('/v1/public/studio-ana/availability/days')
      .query({ serviceId: service.id, from: '2026-11-01', to: '2026-11-30' })
      .expect(200);
    // hoje = 12 (quinta); horizonte 4 → até 16 (segunda).
    expect(res.body).toMatchObject({ days: ['2026-11-12', '2026-11-13', '2026-11-16'] });
  });

  it.each([
    ['inativo', { active: false }],
    ['não público', { public: false }],
  ])('RN-91: serviço %s → 404', async (_label, flags) => {
    const { pro } = await setupStudio();
    const hidden = await factories.service(pro.id, flags);
    const res = await http()
      .get('/v1/public/studio-ana/availability/days')
      .query({ serviceId: hidden.id, from: '2026-11-12', to: '2026-11-18' });
    expect(res.status).toBe(404);
  });

  it('regra 5: serviço de outra profissional → 404', async () => {
    await setupStudio();
    const other = await setupStudio('bia-nails');
    const res = await http()
      .get('/v1/public/studio-ana/availability/days')
      .query({ serviceId: other.service.id, from: '2026-11-12', to: '2026-11-18' });
    expect(res.status).toBe(404);
  });

  it('slug inexistente → 404', async () => {
    const res = await http().get('/v1/public/nao-existe/availability/days').query({
      serviceId: '0190a8e2-5f3c-7d4e-8a9b-1c2d3e4f5a6b',
      from: '2026-11-12',
      to: '2026-11-18',
    });
    expect(res.status).toBe(404);
  });

  it('fim antes do início → 400', async () => {
    const { service } = await setupStudio();
    const res = await http()
      .get('/v1/public/studio-ana/availability/days')
      .query({ serviceId: service.id, from: '2026-11-18', to: '2026-11-12' });
    expect(res.status).toBe(400);
  });

  it('período acima do limite → 400', async () => {
    const { service } = await setupStudio();
    const res = await http()
      .get('/v1/public/studio-ana/availability/days')
      .query({ serviceId: service.id, from: '2026-11-01', to: '2027-02-01' });
    expect(res.status).toBe(400);
  });
});
