import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp } from '../../../test/app.js';
import { parseCorsOrigins } from '../cors.js';

const WEB = 'http://localhost:3000';
let app: INestApplication<App>;

beforeAll(async () => {
  app = await createTestApp({ corsOrigins: [WEB] });
});

afterAll(async () => {
  await app.close();
});

describe('Q-39: CORS para a web booking', () => {
  it('preflight da origem permitida recebe Access-Control-Allow-Origin', async () => {
    const res = await request(app.getHttpServer())
      .options('/v1/public/studio-ana/holds')
      .set('Origin', WEB)
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'content-type');

    expect(res.status).toBe(204);
    expect(res.headers['access-control-allow-origin']).toBe(WEB);
    expect(res.headers['access-control-allow-methods']).toContain('DELETE');
  });

  it('expõe Retry-After e Date (429 e contador do hold)', async () => {
    const res = await request(app.getHttpServer()).get('/health').set('Origin', WEB);
    expect(res.headers['access-control-expose-headers']).toMatch(/Retry-After/);
    expect(res.headers['access-control-expose-headers']).toMatch(/Date/);
  });

  it('origem fora da lista não recebe Access-Control-Allow-Origin', async () => {
    const res = await request(app.getHttpServer())
      .get('/health')
      .set('Origin', 'https://evil.example');
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });
});

describe('parseCorsOrigins', () => {
  it('separa por vírgula, tira espaços e vazios', () => {
    expect(parseCorsOrigins(' http://a.test , https://b.test,, ')).toEqual([
      'http://a.test',
      'https://b.test',
    ]);
  });

  it('ausente → nenhuma origem', () => {
    expect(parseCorsOrigins(undefined)).toEqual([]);
  });
});
