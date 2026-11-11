import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { healthResponseSchema } from '@agende/contracts';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../../app.module.js';

describe('GET /health', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<INestApplication<App>>();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('retorna 200 com { status: "ok" } conforme o contrato', async () => {
    const res = await request(app.getHttpServer()).get('/health').expect(200);

    expect(healthResponseSchema.parse(res.body)).toEqual({ status: 'ok' });
  });
});
