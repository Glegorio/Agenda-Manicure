import { Controller, Get, Module } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { authSessionResponseSchema, errorResponseSchema } from '@agende/contracts';
import type { AuthSessionResponse } from '@agende/contracts';
import { SignJWT } from 'jose';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestApp } from '../../../test/app.js';
import { FixedClock } from '../../../test/clock.js';
import { createTestPrisma, resetDatabase } from '../../../test/database.js';
import { makeFactories } from '../../../test/factories/index.js';
import { CurrentProfessional } from '../current-professional.decorator.js';

/** Rota autenticada de teste: só devolve o que o guard extraiu do token. */
@Controller('__test__/whoami')
class WhoAmIController {
  @Get()
  whoami(@CurrentProfessional() professionalId: string) {
    return { professionalId };
  }
}

@Module({ controllers: [WhoAmIController] })
// eslint-disable-next-line @typescript-eslint/no-extraneous-class -- módulo Nest de teste
class WhoAmIModule {}

const NOW = '2026-11-12T12:00:00Z';
const prisma = createTestPrisma();
const factories = makeFactories(prisma);
const clock = new FixedClock(NOW);
let app: INestApplication<App>;

const http = () => request(app.getHttpServer());
const registerBody = {
  email: 'ana@exemplo.com.br',
  password: 'senha-segura-123',
  businessName: 'Studio Ana',
};

async function register(body: Record<string, unknown> = registerBody) {
  const res = await http().post('/v1/auth/register').send(body).expect(201);
  return authSessionResponseSchema.parse(res.body);
}

const errorCode = (body: unknown) => errorResponseSchema.parse(body).error.code;

beforeAll(async () => {
  app = await createTestApp({ clock, imports: [WhoAmIModule] });
});

beforeEach(async () => {
  clock.set(NOW);
  await resetDatabase(prisma);
});

afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

describe('POST /v1/auth/register', () => {
  it('cria a profissional e devolve sessão (access 15 min, refresh 30 dias, Q-22)', async () => {
    const session = await register({ ...registerBody, slug: 'studio-ana' });

    expect(session.professional).toMatchObject({
      email: 'ana@exemplo.com.br',
      businessName: 'Studio Ana',
      slug: 'studio-ana',
    });
    expect(session.accessTokenExpiresAt).toBe('2026-11-12T12:15:00.000Z');
    expect(session.refreshTokenExpiresAt).toBe('2026-12-12T12:00:00.000Z');
  });

  it('Q-21: slug é opcional no cadastro', async () => {
    const session = await register();
    expect(session.professional.slug).toBeNull();
  });

  it('guarda a senha só como hash argon2id e o refresh só como sha256', async () => {
    const session = await register();
    const stored = await prisma.professional.findUniqueOrThrow({
      where: { id: session.professional.id },
      include: { refreshTokens: true },
    });
    expect(stored.passwordHash).toMatch(/^\$argon2id\$/);
    expect(stored.passwordHash).not.toContain(registerBody.password);
    expect(stored.refreshTokens).toHaveLength(1);
    expect(stored.refreshTokens[0]?.tokenHash).not.toBe(session.refreshToken);
  });

  it('e-mail já cadastrado (sem diferenciar maiúsculas) → 409 EMAIL_TAKEN', async () => {
    await register();
    const res = await http()
      .post('/v1/auth/register')
      .send({ ...registerBody, email: 'ANA@exemplo.com.br' });
    expect(res.status).toBe(409);
    expect(errorCode(res.body)).toBe('EMAIL_TAKEN');
  });

  it('RN-90: slug já em uso → 409 SLUG_TAKEN', async () => {
    await factories.professional({ slug: 'studio-ana' });
    const res = await http()
      .post('/v1/auth/register')
      .send({ ...registerBody, slug: 'studio-ana' });
    expect(res.status).toBe(409);
    expect(errorCode(res.body)).toBe('SLUG_TAKEN');
  });

  it('dois cadastros simultâneos com o mesmo e-mail → um 201 e um 409 (índice único)', async () => {
    const results = await Promise.all([
      http().post('/v1/auth/register').send(registerBody),
      http()
        .post('/v1/auth/register')
        .send({ ...registerBody, businessName: 'Outra' }),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(await prisma.professional.count()).toBe(1);
  });

  it('dados inválidos → 400 VALIDATION_ERROR', async () => {
    const res = await http()
      .post('/v1/auth/register')
      .send({ ...registerBody, password: 'curta', slug: 'admin' });
    expect(res.status).toBe(400);
    expect(errorCode(res.body)).toBe('VALIDATION_ERROR');
  });
});

describe('POST /v1/auth/login', () => {
  it('credenciais corretas → 200 com sessão nova', async () => {
    const { professional } = await register();
    const res = await http()
      .post('/v1/auth/login')
      .send({ email: ' Ana@Exemplo.com.br', password: registerBody.password })
      .expect(200);
    expect(authSessionResponseSchema.parse(res.body).professional.id).toBe(professional.id);
  });

  it.each([
    ['senha errada', { email: registerBody.email, password: 'outra-senha' }],
    ['e-mail inexistente', { email: 'nao@exemplo.com.br', password: registerBody.password }],
  ])('%s → 401 com a mesma mensagem (não revela se o e-mail existe)', async (_label, body) => {
    await register();
    const res = await http().post('/v1/auth/login').send(body);
    expect(res.status).toBe(401);
    expect(errorResponseSchema.parse(res.body).error).toMatchObject({
      code: 'UNAUTHORIZED',
      message: 'E-mail ou senha incorretos.',
    });
  });
});

describe('guard de autenticação', () => {
  const whoami = (token?: string) => {
    const req = http().get('/__test__/whoami');
    return token === undefined ? req : req.set('Authorization', `Bearer ${token}`);
  };

  it('regra 5: com token válido, professionalId vem do token', async () => {
    const session = await register();
    const res = await whoami(session.accessToken).expect(200);
    expect(res.body).toEqual({ professionalId: session.professional.id });
  });

  it('sem token → 401 UNAUTHORIZED', async () => {
    const res = await whoami();
    expect(res.status).toBe(401);
    expect(errorCode(res.body)).toBe('UNAUTHORIZED');
  });

  it('aceita o esquema "bearer" em minúsculas (RFC 6750)', async () => {
    const session = await register();
    await whoami().set('Authorization', `bearer ${session.accessToken}`).expect(200);
  });

  it.each(['abc', 'Bearer', 'a.b.c'])('token malformado "%s" → 401', async (token) => {
    expect((await whoami(token)).status).toBe(401);
  });

  it('access token expirado (16 min depois) → 401', async () => {
    const session = await register();
    clock.advance({ minutes: 16 });
    expect((await whoami(session.accessToken)).status).toBe(401);
  });

  it('token assinado com outro segredo → 401', async () => {
    const session = await register();
    const forged = await new SignJWT({})
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(session.professional.id)
      .setIssuedAt(new Date(NOW))
      .setExpirationTime(new Date('2026-11-12T13:00:00Z'))
      .sign(new TextEncoder().encode('outro-segredo-com-tamanho-suficiente-123456'));
    expect((await whoami(forged)).status).toBe(401);
  });

  it('token com alg "none" → 401', async () => {
    const session = await register();
    const [, payload] = session.accessToken.split('.');
    const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    expect((await whoami(`${header}.${payload ?? ''}.`)).status).toBe(401);
  });

  it('rotas públicas continuam acessíveis sem token', async () => {
    await http().get('/health').expect(200);
  });
});

describe('POST /v1/auth/refresh', () => {
  const refresh = (refreshToken: string) => http().post('/v1/auth/refresh').send({ refreshToken });

  it('Q-22: troca o refresh por um novo (rotação) e o antigo deixa de valer', async () => {
    const first = await register();
    clock.advance({ minutes: 20 });

    const res = await refresh(first.refreshToken).expect(200);
    const second: AuthSessionResponse = authSessionResponseSchema.parse(res.body);

    expect(second.refreshToken).not.toBe(first.refreshToken);
    expect(second.accessTokenExpiresAt).toBe('2026-11-12T12:35:00.000Z');
    expect(second.refreshTokenExpiresAt).toBe('2026-12-12T12:20:00.000Z');
    expect((await refresh(first.refreshToken)).status).toBe(401);
  });

  it('reuso de refresh já trocado → 401 e revoga a família inteira', async () => {
    const first = await register();
    const second = authSessionResponseSchema.parse(
      (await refresh(first.refreshToken).expect(200)).body,
    );

    expect((await refresh(first.refreshToken)).status).toBe(401);
    // O token legítimo mais novo também morre: a sessão pode ter sido roubada.
    expect((await refresh(second.refreshToken)).status).toBe(401);
  });

  it('reuso não derruba outras sessões (outro login) da mesma profissional', async () => {
    const first = await register();
    const other = authSessionResponseSchema.parse(
      (
        await http()
          .post('/v1/auth/login')
          .send({ email: registerBody.email, password: registerBody.password })
      ).body,
    );
    await refresh(first.refreshToken).expect(200);
    await refresh(first.refreshToken).expect(401);

    await refresh(other.refreshToken).expect(200);
  });

  it('Q-22: refresh expirado (31 dias depois) → 401', async () => {
    const first = await register();
    clock.advance({ minutes: 31 * 24 * 60 });
    expect((await refresh(first.refreshToken)).status).toBe(401);
  });

  it('token desconhecido → 401', async () => {
    expect((await refresh('nao-existe')).status).toBe(401);
  });

  it('duas trocas simultâneas do mesmo refresh → exatamente uma dá certo', async () => {
    const first = await register();
    const results = await Promise.all([refresh(first.refreshToken), refresh(first.refreshToken)]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 401]);

    // A perdedora vê o token já trocado e derruba a família, inclusive o sucessor da vencedora.
    const winner = results.find((r) => r.status === 200);
    const successor = authSessionResponseSchema.parse(winner?.body).refreshToken;
    expect((await refresh(successor)).status).toBe(401);
  });

  it('reuso de refresh já trocado e depois expirado também é recusado', async () => {
    const first = await register();
    await refresh(first.refreshToken).expect(200);
    clock.advance({ minutes: 31 * 24 * 60 });
    expect((await refresh(first.refreshToken)).status).toBe(401);
  });
});

describe('POST /v1/auth/logout', () => {
  it('revoga a sessão: 204 e o refresh deixa de valer', async () => {
    const session = await register();
    await http().post('/v1/auth/logout').send({ refreshToken: session.refreshToken }).expect(204);
    const res = await http().post('/v1/auth/refresh').send({ refreshToken: session.refreshToken });
    expect(res.status).toBe(401);
  });

  it('não encerra outras sessões (outro login) da mesma profissional', async () => {
    const first = await register();
    const other = authSessionResponseSchema.parse(
      (
        await http()
          .post('/v1/auth/login')
          .send({ email: registerBody.email, password: registerBody.password })
          .expect(200)
      ).body,
    );
    await http().post('/v1/auth/logout').send({ refreshToken: first.refreshToken }).expect(204);

    await http().post('/v1/auth/refresh').send({ refreshToken: other.refreshToken }).expect(200);
  });

  it('token desconhecido → 204 (idempotente, não revela nada)', async () => {
    await http().post('/v1/auth/logout').send({ refreshToken: 'nao-existe' }).expect(204);
  });
});
