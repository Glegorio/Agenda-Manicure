import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp } from '../../../test/app.js';
import { DocsModule, docsModules } from '../docs.module.js';
import { buildOpenApiDocument } from '../openapi.document.js';

let app: INestApplication<App>;

const http = () => request(app.getHttpServer());

interface RouterLayer {
  route?: { path: string; methods: Record<string, boolean> };
}

/** Rotas que o Nest registrou no Express, no formato `METHOD /caminho/{param}`. */
function registeredRoutes(): string[] {
  const express = app.getHttpAdapter().getInstance() as { router: { stack: RouterLayer[] } };
  return express.router.stack
    .flatMap(({ route }) =>
      route
        ? Object.keys(route.methods).map(
            (method) => `${method.toUpperCase()} ${route.path.replace(/:(\w+)/g, '{$1}')}`,
          )
        : [],
    )
    .filter((route) => !route.startsWith('GET /docs'))
    .sort();
}

/** Forma mínima do documento lida pelos testes. */
interface ServedOperation {
  security: unknown;
  parameters?: { name: string; in: string }[];
  requestBody?: { content: Record<string, { schema: unknown } | undefined> };
  responses: Record<string, { description: string } | undefined>;
}

async function fetchDocument() {
  const res = await http().get('/docs/openapi.json').expect(200);
  return res.body as {
    openapi: string;
    paths: Record<string, Record<string, ServedOperation | undefined> | undefined>;
  };
}

beforeAll(async () => {
  app = await createTestApp();
});

afterAll(async () => {
  await app.close();
});

describe('OpenAPI (2.11)', () => {
  it('documenta exatamente as rotas registradas na API (nem a mais, nem a menos)', () => {
    const doc = buildOpenApiDocument();
    const documented = Object.entries(doc.paths)
      .flatMap(([path, item]) =>
        Object.keys(item).map((method) => `${method.toUpperCase()} ${path}`),
      )
      .sort();

    expect(documented).toEqual(registeredRoutes());
  });

  it('GET /docs/openapi.json devolve OpenAPI 3.1 com schemas vindos dos contratos', async () => {
    const doc = await fetchDocument();

    expect(doc.openapi).toBe('3.1.0');
    const createAppointment = doc.paths['/v1/appointments']?.['post'];
    expect(createAppointment?.requestBody?.content['application/json']?.schema).toMatchObject({
      type: 'object',
      required: expect.arrayContaining(['serviceId', 'startAt', 'name', 'phone']) as unknown,
    });
    expect(createAppointment?.responses['409']?.description).toContain('SLOT_UNAVAILABLE');
    expect(createAppointment?.security).toEqual([{ bearerAuth: [] }]);
  });

  it('rotas públicas não exigem token; query vira parâmetros', async () => {
    const doc = await fetchDocument();

    const availability = doc.paths['/v1/public/{slug}/availability']?.['get'];
    expect(availability?.security).toEqual([]);
    expect(availability?.parameters?.map((p) => `${p.in}:${p.name}`)).toEqual([
      'path:slug',
      'query:serviceId',
      'query:date',
    ]);
  });

  it('GET /docs serve a página de referência sem exigir login', async () => {
    const res = await http().get('/docs').expect(200);
    expect(res.headers['content-type']).toContain('text/html');
    expect(res.text).toContain('/docs/openapi.json');
  });

  it('só é publicado com opt-in explícito (ou nos testes); fora disso, nunca', () => {
    expect(docsModules({ API_DOCS_ENABLED: 'true' })).toEqual([DocsModule]);
    expect(docsModules({ NODE_ENV: 'test' })).toEqual([DocsModule]);
    expect(docsModules({ NODE_ENV: 'production' })).toEqual([]);
    expect(docsModules({ NODE_ENV: 'staging' })).toEqual([]);
    expect(docsModules({})).toEqual([]);
  });
});
