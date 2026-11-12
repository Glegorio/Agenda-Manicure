import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpException,
  Module,
  Param,
  Post,
  Query,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { errorResponseSchema } from '@agende/contracts';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createTestApp } from '../../../test/app.js';
import { DomainError } from '../domain-error.js';
import { ZodValidationPipe } from '../zod-validation.pipe.js';

const echoSchema = z.object({ name: z.string().min(2), priceCents: z.number().int() });

@Controller('__test__')
class ProbeController {
  @Post('echo')
  @HttpCode(200)
  echo(@Body(new ZodValidationPipe(echoSchema)) body: z.infer<typeof echoSchema>) {
    return body;
  }

  @Get('slot-taken')
  slotTaken(): never {
    throw new DomainError('SLOT_UNAVAILABLE', undefined, { startAt: '2026-11-12T14:00:00.000Z' });
  }

  @Get('custom-message')
  custom(): never {
    throw new DomainError('NOT_FOUND', 'Serviço não encontrado.');
  }

  @Get('items/:id')
  item(
    @Param('id', new ZodValidationPipe(z.uuid())) id: string,
    @Query(new ZodValidationPipe(z.object({ limit: z.coerce.number().int().max(50) })))
    query: { limit: number },
  ) {
    return { id, limit: query.limit };
  }

  @Get('conflict')
  conflict(): never {
    throw new HttpException('Conflict interno', 409);
  }

  @Get('unavailable')
  unavailable(): never {
    throw new ServiceUnavailableException('db caiu');
  }

  @Get('boom')
  boom(): never {
    throw new Error('segredo interno: senha=123');
  }
}

@Module({ controllers: [ProbeController] })
// eslint-disable-next-line @typescript-eslint/no-extraneous-class -- módulo Nest de teste
class ProbeModule {}

describe('envelope de erro padrão (doc 05) e pipe Zod', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    app = await createTestApp({ imports: [ProbeModule] });
  });

  afterAll(async () => {
    await app.close();
  });

  const http = () => request(app.getHttpServer());

  it('body válido passa pelo pipe e chega já parseado', async () => {
    const res = await http()
      .post('/__test__/echo')
      .send({ name: 'Ana', priceCents: 1500, extra: 1 });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ name: 'Ana', priceCents: 1500 });
  });

  it('body inválido → 400 VALIDATION_ERROR com issues por campo em português', async () => {
    const res = await http().post('/__test__/echo').send({ name: 'A', priceCents: 1.5 });

    expect(res.status).toBe(400);
    const { error } = errorResponseSchema.parse(res.body);
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.message).toBe('Confira os dados informados.');
    const issues = error.details['issues'] as { path: string; message: string }[];
    expect(issues.map((i) => i.path).sort()).toEqual(['name', 'priceCents']);
    expect(issues.find((i) => i.path === 'name')?.message).toBe(
      'Pequeno demais: esperava que o texto tivesse >= 2 caracteres',
    );
  });

  it('pipe valida e converte @Param e @Query', async () => {
    const id = '0190a8e2-5f3c-7d4e-8a9b-1c2d3e4f5a6b';
    const ok = await http().get(`/__test__/items/${id}?limit=10`);
    expect(ok.status).toBe(200);
    expect(ok.body).toEqual({ id, limit: 10 });

    const bad = await http().get('/__test__/items/nao-e-uuid?limit=10');
    expect(bad.status).toBe(400);
    expect(errorResponseSchema.parse(bad.body).error.details['issues']).toEqual([
      { path: '', message: expect.any(String) as string },
    ]);
  });

  it('4xx do framework sem código próprio → 400 VALIDATION_ERROR (status segue o código)', async () => {
    const res = await http().get('/__test__/conflict');
    expect(res.status).toBe(400);
    expect(errorResponseSchema.parse(res.body).error.code).toBe('VALIDATION_ERROR');
  });

  it('503 do framework → SERVICE_UNAVAILABLE sem expor a mensagem original', async () => {
    const res = await http().get('/__test__/unavailable');
    expect(res.status).toBe(503);
    expect(errorResponseSchema.parse(res.body).error.code).toBe('SERVICE_UNAVAILABLE');
    expect(JSON.stringify(res.body)).not.toContain('db caiu');
  });

  it('JSON malformado → 400 VALIDATION_ERROR', async () => {
    const res = await http()
      .post('/__test__/echo')
      .set('Content-Type', 'application/json')
      .send('{"name":');
    expect(res.status).toBe(400);
    expect(errorResponseSchema.parse(res.body).error.code).toBe('VALIDATION_ERROR');
  });

  it('RN-41: DomainError SLOT_UNAVAILABLE → 409 com mensagem padrão e details', async () => {
    const res = await http().get('/__test__/slot-taken');
    expect(res.status).toBe(409);
    expect(errorResponseSchema.parse(res.body)).toEqual({
      error: {
        code: 'SLOT_UNAVAILABLE',
        message: 'Este horário acabou de ser reservado. Escolha outro.',
        details: { startAt: '2026-11-12T14:00:00.000Z' },
      },
    });
  });

  it('DomainError aceita mensagem específica', async () => {
    const res = await http().get('/__test__/custom-message');
    expect(res.status).toBe(404);
    expect(errorResponseSchema.parse(res.body).error.message).toBe('Serviço não encontrado.');
  });

  it('rota inexistente → 404 NOT_FOUND no envelope', async () => {
    const res = await http().get('/nao-existe');
    expect(res.status).toBe(404);
    expect(errorResponseSchema.parse(res.body).error.code).toBe('NOT_FOUND');
  });

  it('erro inesperado → 500 INTERNAL_ERROR sem vazar a mensagem interna', async () => {
    const res = await http().get('/__test__/boom');
    expect(res.status).toBe(500);
    const { error } = errorResponseSchema.parse(res.body);
    expect(error.code).toBe('INTERNAL_ERROR');
    expect(JSON.stringify(res.body)).not.toContain('segredo');
  });
});
