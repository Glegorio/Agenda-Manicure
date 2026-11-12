import type { INestApplication } from '@nestjs/common';
import {
  errorResponseSchema,
  professionalProfileSchema,
  slugAvailabilityResponseSchema,
} from '@agende/contracts';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestApp } from '../../../test/app.js';
import { signUp as signUpHelper } from '../../../test/auth.js';
import { createTestPrisma, resetDatabase } from '../../../test/database.js';
import { makeFactories } from '../../../test/factories/index.js';

const prisma = createTestPrisma();
const factories = makeFactories(prisma);
let app: INestApplication<App>;

const http = () => request(app.getHttpServer());
const errorCode = (body: unknown) => errorResponseSchema.parse(body).error.code;

const signUp = (email = 'ana@exemplo.com.br', slug?: string) =>
  signUpHelper(app, { email, ...(slug === undefined ? {} : { slug }) });

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

describe('GET /v1/me', () => {
  it('Q-08: devolve o perfil da profissional do token com os padrões de agenda', async () => {
    const { id, auth } = await signUp();

    const res = await http().get('/v1/me').set('Authorization', auth).expect(200);

    expect(professionalProfileSchema.parse(res.body)).toMatchObject({
      id,
      email: 'ana@exemplo.com.br',
      businessName: 'Studio Ana',
      slug: null,
      timezone: 'America/Sao_Paulo',
      themePalette: 'ROSE_GOLD',
      themeMode: 'SYSTEM',
      bufferMin: 10,
      slotStepMin: 15,
      minNoticeMin: 120,
      bookingHorizonDays: 30,
    });
  });

  it('não expõe o hash da senha', async () => {
    const { auth } = await signUp();
    const res = await http().get('/v1/me').set('Authorization', auth).expect(200);
    expect(JSON.stringify(res.body)).not.toContain('argon2');
    expect(res.body).not.toHaveProperty('passwordHash');
  });

  it('sem token → 401', async () => {
    const res = await http().get('/v1/me');
    expect(res.status).toBe(401);
    expect(errorCode(res.body)).toBe('UNAUTHORIZED');
  });

  it('token de conta que não existe mais → 401', async () => {
    const { id, auth } = await signUp();
    await prisma.professional.delete({ where: { id } });
    expect((await http().get('/v1/me').set('Authorization', auth)).status).toBe(401);
  });
});

describe('PATCH /v1/me', () => {
  it('atualiza perfil, tema e parâmetros de agenda (RN-22..25) e devolve o perfil', async () => {
    const { auth } = await signUp();

    const res = await http()
      .patch('/v1/me')
      .set('Authorization', auth)
      .send({
        businessName: 'Ana Nails',
        slug: 'ana-nails',
        timezone: 'America/Manaus',
        state: 'am',
        zip: '69005-010',
        lat: -3.1,
        lng: -60.02,
        themePalette: 'PASTEL_LILAC',
        themeMode: 'DARK',
        cancellationPolicy: 'Avise com 24 horas.',
        bufferMin: 15,
        slotStepMin: 30,
        minNoticeMin: 60,
        bookingHorizonDays: 60,
        closingReminderOffsetMin: 45,
      })
      .expect(200);

    expect(professionalProfileSchema.parse(res.body)).toMatchObject({
      businessName: 'Ana Nails',
      slug: 'ana-nails',
      timezone: 'America/Manaus',
      state: 'AM',
      zip: '69005010',
      lat: -3.1,
      lng: -60.02,
      themePalette: 'PASTEL_LILAC',
      themeMode: 'DARK',
      cancellationPolicy: 'Avise com 24 horas.',
      bufferMin: 15,
      slotStepMin: 30,
      minNoticeMin: 60,
      bookingHorizonDays: 60,
      closingReminderOffsetMin: 45,
    });
    const me = await http().get('/v1/me').set('Authorization', auth).expect(200);
    expect(me.body).toEqual(res.body);
  });

  it('só altera os campos enviados', async () => {
    const { auth } = await signUp('ana@exemplo.com.br', 'studio-ana');
    await http().patch('/v1/me').set('Authorization', auth).send({ bufferMin: 0 }).expect(200);
    const me = await http().get('/v1/me').set('Authorization', auth).expect(200);
    expect(me.body).toMatchObject({ bufferMin: 0, slug: 'studio-ana', slotStepMin: 15 });
  });

  it('null apaga campos opcionais do endereço', async () => {
    const { auth } = await signUp();
    await http().patch('/v1/me').set('Authorization', auth).send({ city: 'Santos' }).expect(200);
    const res = await http()
      .patch('/v1/me')
      .set('Authorization', auth)
      .send({ city: null })
      .expect(200);
    expect(res.body).toMatchObject({ city: null });
  });

  it('regra 5: id no body é ignorado — só a profissional do token é alterada', async () => {
    const ana = await signUp('ana@exemplo.com.br');
    const bia = await signUp('bia@exemplo.com.br');

    await http()
      .patch('/v1/me')
      .set('Authorization', ana.auth)
      .send({ id: bia.id, professionalId: bia.id, businessName: 'Invadido' })
      .expect(200);

    const biaStored = await prisma.professional.findUniqueOrThrow({ where: { id: bia.id } });
    const anaStored = await prisma.professional.findUniqueOrThrow({ where: { id: ana.id } });
    expect(biaStored.businessName).toBe('Studio Ana');
    expect(anaStored.businessName).toBe('Invadido');
  });

  it('Q-21: troca de slug é permitida e libera o antigo', async () => {
    const ana = await signUp('ana@exemplo.com.br', 'studio-ana');
    await http()
      .patch('/v1/me')
      .set('Authorization', ana.auth)
      .send({ slug: 'ana-nails' })
      .expect(200);

    const bia = await signUp('bia@exemplo.com.br');
    await http()
      .patch('/v1/me')
      .set('Authorization', bia.auth)
      .send({ slug: 'studio-ana' })
      .expect(200);
  });

  it('RN-90: slug de outra profissional → 409 SLUG_TAKEN', async () => {
    await factories.professional({ slug: 'studio-ana' });
    const { auth } = await signUp();
    const res = await http()
      .patch('/v1/me')
      .set('Authorization', auth)
      .send({ slug: 'studio-ana' });
    expect(res.status).toBe(409);
    expect(errorCode(res.body)).toBe('SLUG_TAKEN');
  });

  it('RN-90: dois PATCH simultâneos com o mesmo slug → um 200 e um 409 (índice único)', async () => {
    const ana = await signUp('ana@exemplo.com.br');
    const bia = await signUp('bia@exemplo.com.br');
    const results = await Promise.all(
      [ana, bia].map(({ auth }) =>
        http().patch('/v1/me').set('Authorization', auth).send({ slug: 'disputado' }),
      ),
    );
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(errorCode(results.find((r) => r.status === 409)?.body)).toBe('SLUG_TAKEN');
  });

  it('string vazia apaga a política de cancelamento', async () => {
    const { auth } = await signUp();
    await http()
      .patch('/v1/me')
      .set('Authorization', auth)
      .send({ cancellationPolicy: 'Avise com 24 horas.' })
      .expect(200);
    const res = await http()
      .patch('/v1/me')
      .set('Authorization', auth)
      .send({ cancellationPolicy: '  ' })
      .expect(200);
    expect(res.body).toMatchObject({ cancellationPolicy: null });
  });

  it('token de conta que não existe mais → 401', async () => {
    const { id, auth } = await signUp();
    await prisma.professional.delete({ where: { id } });
    const res = await http().patch('/v1/me').set('Authorization', auth).send({ bufferMin: 5 });
    expect(res.status).toBe(401);
  });

  it('RN-90: manter o próprio slug não conflita', async () => {
    const { auth } = await signUp('ana@exemplo.com.br', 'studio-ana');
    await http()
      .patch('/v1/me')
      .set('Authorization', auth)
      .send({ slug: 'studio-ana' })
      .expect(200);
  });

  it.each([
    ['RN-22: buffer 61', { bufferMin: 61 }],
    ['RN-23: step 20', { slotStepMin: 20 }],
    ['RN-90: slug reservado', { slug: 'admin' }],
    ['Q-21: apagar o slug', { slug: null }],
    ['RN-02: fuso inválido', { timezone: 'Brasil/SP' }],
    ['latitude sem longitude', { lat: -23.5 }],
    ['patch vazio', {}],
  ])('%s → 400 VALIDATION_ERROR', async (_label, body) => {
    const { auth } = await signUp();
    const res = await http().patch('/v1/me').set('Authorization', auth).send(body);
    expect(res.status).toBe(400);
    expect(errorCode(res.body)).toBe('VALIDATION_ERROR');
  });

  it('sem token → 401', async () => {
    expect((await http().patch('/v1/me').send({ bufferMin: 5 })).status).toBe(401);
  });
});

describe('GET /v1/me/slug-availability', () => {
  const check = (auth: string, slug: string) =>
    http()
      .get('/v1/me/slug-availability')
      .query({ slug })
      .set('Authorization', auth)
      .expect(200)
      .then((res) => slugAvailabilityResponseSchema.parse(res.body));

  it('slug livre → disponível', async () => {
    const { auth } = await signUp();
    expect(await check(auth, 'ana-nails')).toEqual({ slug: 'ana-nails', available: true });
  });

  it('RN-90: slug de outra profissional → TAKEN', async () => {
    await factories.professional({ slug: 'ana-nails' });
    const { auth } = await signUp();
    expect(await check(auth, 'ana-nails')).toMatchObject({ available: false, reason: 'TAKEN' });
  });

  it('o próprio slug atual conta como disponível', async () => {
    const { auth } = await signUp('ana@exemplo.com.br', 'studio-ana');
    expect(await check(auth, 'studio-ana')).toEqual({ slug: 'studio-ana', available: true });
  });

  it.each([
    ['admin', 'RESERVED'],
    ['Ana_Nails', 'INVALID_FORMAT'],
    ['ab', 'INVALID_FORMAT'],
  ])('RN-90: "%s" → %s', async (slug, reason) => {
    const { auth } = await signUp();
    expect(await check(auth, slug)).toEqual({ slug, available: false, reason });
  });

  it('sem o parâmetro slug → 400', async () => {
    const { auth } = await signUp();
    const res = await http().get('/v1/me/slug-availability').set('Authorization', auth);
    expect(res.status).toBe(400);
  });

  it('sem token → 401', async () => {
    const res = await http().get('/v1/me/slug-availability').query({ slug: 'ana' });
    expect(res.status).toBe(401);
  });
});
