import { ERROR_HTTP_STATUS, type ErrorCode, errorResponseSchema } from '@agende/contracts';
import { z } from 'zod';
import { ROUTES, type RouteSpec } from './openapi.routes.js';

type JsonSchema = Record<string, unknown>;

interface Parameter {
  name: string;
  in: 'path' | 'query';
  required: boolean;
  schema: JsonSchema;
}

export interface OpenApiDocument {
  openapi: '3.1.0';
  info: { title: string; version: string; description: string };
  components: Record<string, unknown>;
  paths: Record<string, Record<string, unknown>>;
}

/**
 * JSON Schema 2020-12 (o dialeto do OpenAPI 3.1). Entradas pelo lado `input` (antes de
 * `trim`/`toLowerCase`), respostas pelo `output`. Refinamentos (`refine`) não têm tradução: a
 * regra vale na API e aparece na mensagem do 400.
 */
const toSchema = (schema: z.ZodType, io: 'input' | 'output'): JsonSchema => {
  const json: JsonSchema = { ...z.toJSONSchema(schema, { io, unrepresentable: 'any' }) };
  // O dialeto já é o padrão do OpenAPI 3.1; repetir `$schema` em cada operação só polui.
  delete json['$schema'];
  return json;
};

function queryParameters(query: z.ZodType): Parameter[] {
  const schema = toSchema(query, 'input');
  const properties = (schema['properties'] ?? {}) as Record<string, JsonSchema>;
  const required = new Set((schema['required'] ?? []) as string[]);
  return Object.entries(properties).map(([name, property]) => ({
    name,
    in: 'query',
    required: required.has(name),
    schema: property,
  }));
}

const errorResponse = (codes: readonly ErrorCode[]) => ({
  description: codes.join(' | '),
  content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
});

/** Agrupa os códigos de erro da rota por status HTTP (vários códigos podem dividir um status). */
function errorResponses(route: RouteSpec): Record<string, unknown> {
  const codes = new Set<ErrorCode>(route.errors ?? []);
  if (route.body ?? route.query ?? route.params) codes.add('VALIDATION_ERROR');
  if (route.auth) codes.add('UNAUTHORIZED');
  if (route.rateLimited) codes.add('RATE_LIMITED');
  codes.add('INTERNAL_ERROR');

  const byStatus = new Map<number, ErrorCode[]>();
  for (const code of codes) {
    const status = ERROR_HTTP_STATUS[code];
    byStatus.set(status, [...(byStatus.get(status) ?? []), code]);
  }
  return Object.fromEntries(
    [...byStatus].sort(([a], [b]) => a - b).map(([status, list]) => [status, errorResponse(list)]),
  );
}

function successResponse(route: RouteSpec): Record<string, unknown> {
  const { status, schema, sse } = route.response;
  if (!schema) return { [status]: { description: 'Sem conteúdo' } };
  const mediaType = sse ? 'text/event-stream' : 'application/json';
  const description = sse ? 'Stream de eventos; cada `data:` segue o schema.' : 'OK';
  return {
    [status]: { description, content: { [mediaType]: { schema: toSchema(schema, 'output') } } },
  };
}

function operation(route: RouteSpec): Record<string, unknown> {
  const parameters: Parameter[] = [
    ...Object.entries(route.params ?? {}).map(([name, schema]) => ({
      name,
      in: 'path' as const,
      required: true,
      schema: toSchema(schema, 'input'),
    })),
    ...(route.query ? queryParameters(route.query) : []),
  ];
  return {
    tags: [route.tag],
    summary: route.summary,
    security: route.auth ? [{ bearerAuth: [] }] : [],
    ...(parameters.length > 0 && { parameters }),
    ...(route.body && {
      requestBody: {
        required: true,
        content: { 'application/json': { schema: toSchema(route.body, 'input') } },
      },
    }),
    responses: { ...successResponse(route), ...errorResponses(route) },
  };
}

/** Documento OpenAPI 3.1 derivado dos contratos Zod (regra 6, 2.11). */
export function buildOpenApiDocument(routes: readonly RouteSpec[] = ROUTES): OpenApiDocument {
  const paths: OpenApiDocument['paths'] = {};
  for (const route of routes) {
    paths[route.path] = { ...paths[route.path], [route.method]: operation(route) };
  }
  return {
    openapi: '3.1.0',
    info: {
      title: 'Agende API',
      version: '0.1.0',
      description:
        'Gerado de `@agende/contracts`. Instantes em UTC (RN-01), dinheiro em centavos (RN-77). ' +
        'Erros no envelope `{ error: { code, message, details } }`.',
    },
    components: {
      securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
      schemas: { ErrorResponse: toSchema(errorResponseSchema, 'output') },
    },
    paths,
  };
}
