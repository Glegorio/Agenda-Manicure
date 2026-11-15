import { z } from 'zod';
import { ApiError, createApiClient } from '../src/api/client';
import { SessionManager } from '../src/auth/session';
import { BASE_URL, errorBody, json, memoryStorage, sessionResponse } from './helpers/fake-api';

const okSchema = z.object({ ok: z.boolean() });

async function setup(responses: Array<() => Response>) {
  const fetchImpl = jest.fn<Promise<Response>, [string, RequestInit?]>(() => {
    const next = responses.shift();
    return next ? Promise.resolve(next()) : Promise.reject(new Error('fetch inesperado'));
  });
  const session = new SessionManager({
    baseUrl: BASE_URL,
    fetch: fetchImpl,
    storage: memoryStorage(),
  });
  await session.set(sessionResponse(1));
  const api = createApiClient({ baseUrl: BASE_URL, fetch: fetchImpl, session });
  return { fetchImpl, session, api };
}

function authorizationOf(call: unknown[] | undefined): string | undefined {
  return ((call?.[1] as RequestInit).headers as Record<string, string>).Authorization;
}

describe('cliente HTTP (4.1)', () => {
  it('envia o Bearer da sessão e valida a resposta com o schema', async () => {
    const { fetchImpl, api } = await setup([() => json(200, { ok: true })]);

    await expect(api.get('/me', okSchema)).resolves.toEqual({ ok: true });
    expect(fetchImpl.mock.calls[0]?.[0]).toBe(`${BASE_URL}/me`);
    expect(authorizationOf(fetchImpl.mock.calls[0])).toBe('Bearer access-1');
  });

  it('erro no envelope padrão vira ApiError com código e mensagem em PT-BR', async () => {
    const { api } = await setup([
      () => json(409, errorBody('SLUG_TAKEN', 'Este link já está em uso.')),
    ]);

    const error = await api.patch('/me', { slug: 'x' }, okSchema).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 409,
      code: 'SLUG_TAKEN',
      message: 'Este link já está em uso.',
    });
  });

  it('resposta fora do envelope vira INTERNAL_ERROR com mensagem genérica', async () => {
    const { api } = await setup([() => new Response('<html>bad gateway</html>', { status: 502 })]);

    await expect(api.get('/me', okSchema)).rejects.toMatchObject({
      status: 502,
      code: 'INTERNAL_ERROR',
    });
  });

  it('401 renova a sessão uma vez e repete o pedido com o token novo', async () => {
    const { fetchImpl, api } = await setup([
      () => json(401, errorBody('UNAUTHORIZED', 'Token expirado.')),
      () => json(200, sessionResponse(2)),
      () => json(200, { ok: true }),
    ]);

    await expect(api.get('/me', okSchema)).resolves.toEqual({ ok: true });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(authorizationOf(fetchImpl.mock.calls[2])).toBe('Bearer access-2');
  });

  it('401 com refresh recusado encerra a sessão e devolve UNAUTHORIZED', async () => {
    const { session, api } = await setup([
      () => json(401, errorBody('UNAUTHORIZED', 'Token expirado.')),
      () => json(401, errorBody('UNAUTHORIZED', 'Sessão inválida.')),
    ]);

    await expect(api.get('/me', okSchema)).rejects.toMatchObject({
      status: 401,
      code: 'UNAUTHORIZED',
    });
    expect(session.current).toBeNull();
  });

  it('204 devolve undefined sem schema', async () => {
    const { api } = await setup([() => new Response(null, { status: 204 })]);

    await expect(api.delete('/blocks/1')).resolves.toBeUndefined();
  });

  it('falha de rede vira ApiError NETWORK com mensagem amigável', async () => {
    const fetchImpl = jest.fn(() => Promise.reject(new TypeError('Network request failed')));
    const session = new SessionManager({
      baseUrl: BASE_URL,
      fetch: fetchImpl,
      storage: memoryStorage(),
    });
    const api = createApiClient({ baseUrl: BASE_URL, fetch: fetchImpl, session });

    await expect(
      api.post('/auth/login', { email: 'a@b.c', password: 'x' }, okSchema, { auth: false }),
    ).rejects.toMatchObject({
      status: 0,
      code: 'NETWORK',
      message: 'Sem conexão com o servidor. Verifique sua internet e tente de novo.',
    });
  });
});
