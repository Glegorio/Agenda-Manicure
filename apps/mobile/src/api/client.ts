import { errorResponseSchema, type ErrorCode } from '@agende/contracts';
import type { z } from 'zod';
import { timeoutSignal, type FetchFn, type SessionManager } from '../auth/session';

/** `NETWORK` não vem da API: o pedido nem chegou (sem internet, servidor fora). */
export type ApiErrorCode = ErrorCode | 'NETWORK';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ApiErrorCode,
    message: string,
    readonly details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const NETWORK_MESSAGE = 'Sem conexão com o servidor. Verifique sua internet e tente de novo.';
const GENERIC_MESSAGE = 'Algo deu errado do nosso lado. Tente de novo em instantes.';
const SESSION_ENDED_MESSAGE = 'Sua sessão terminou. Entre de novo.';

interface RequestOptions {
  /** Padrão `true`: envia o Bearer e renova a sessão num 401. */
  auth?: boolean;
}

interface ApiClientOptions {
  baseUrl: string;
  fetch: FetchFn;
  session: SessionManager;
}

export type ApiClient = ReturnType<typeof createApiClient>;

export function createApiClient({ baseUrl, fetch, session }: ApiClientOptions) {
  async function send(method: string, path: string, body: unknown, token: string | undefined) {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (token) headers.Authorization = `Bearer ${token}`;
    try {
      return await fetch(`${baseUrl}${path}`, {
        method,
        headers,
        signal: timeoutSignal(),
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    } catch {
      throw new ApiError(0, 'NETWORK', NETWORK_MESSAGE);
    }
  }

  async function request<T>(
    method: string,
    path: string,
    body: unknown,
    schema: z.ZodType<T> | undefined,
    { auth = true }: RequestOptions = {},
  ): Promise<T> {
    let response = await send(method, path, body, auth ? session.current?.accessToken : undefined);

    if (auth && response.status === 401) {
      const token = await session.refresh().catch(() => {
        throw new ApiError(0, 'NETWORK', NETWORK_MESSAGE);
      });
      if (!token) throw new ApiError(401, 'UNAUTHORIZED', SESSION_ENDED_MESSAGE);
      response = await send(method, path, body, token);
    }

    if (!response.ok) throw await toApiError(response);
    if (response.status === 204 || !schema) return undefined as T;
    return schema.parse(await response.json());
  }

  return {
    get: <T>(path: string, schema: z.ZodType<T>, options?: RequestOptions) =>
      request('GET', path, undefined, schema, options),
    post: <T>(path: string, body: unknown, schema?: z.ZodType<T>, options?: RequestOptions) =>
      request('POST', path, body, schema, options),
    put: <T>(path: string, body: unknown, schema?: z.ZodType<T>, options?: RequestOptions) =>
      request('PUT', path, body, schema, options),
    patch: <T>(path: string, body: unknown, schema?: z.ZodType<T>, options?: RequestOptions) =>
      request('PATCH', path, body, schema, options),
    delete: <T = void>(path: string, schema?: z.ZodType<T>, options?: RequestOptions) =>
      request('DELETE', path, undefined, schema, options),
  };
}

async function toApiError(response: Response): Promise<ApiError> {
  const body: unknown = await response.json().catch(() => null);
  const parsed = errorResponseSchema.safeParse(body);
  if (parsed.success) {
    const { code, message, details } = parsed.data.error;
    return new ApiError(response.status, code, message, details);
  }
  return new ApiError(response.status, 'INTERNAL_ERROR', GENERIC_MESSAGE);
}
