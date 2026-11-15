import { SESSION_KEY, SessionManager } from '../src/auth/session';
import { BASE_URL, errorBody, json, memoryStorage, sessionResponse } from './helpers/fake-api';

function setup(fetchImpl: jest.Mock) {
  const storage = memoryStorage();
  const session = new SessionManager({ baseUrl: BASE_URL, fetch: fetchImpl, storage });
  return { storage, session };
}

describe('SessionManager (4.1)', () => {
  it('guarda a sessão só no armazenamento seguro e a restaura', async () => {
    const { storage, session } = setup(jest.fn());
    await session.set(sessionResponse(1));

    expect(storage.setItemAsync).toHaveBeenCalledWith(SESSION_KEY, expect.any(String));
    const restored = new SessionManager({ baseUrl: BASE_URL, fetch: jest.fn(), storage });
    await restored.load();
    expect(restored.current?.accessToken).toBe('access-1');
    expect(restored.current?.professional.slug).toBe('ana-nails');
  });

  it('renovações simultâneas fazem uma única chamada ao /auth/refresh', async () => {
    const fetchImpl = jest.fn(() => Promise.resolve(json(200, sessionResponse(2))));
    const { session } = setup(fetchImpl);
    await session.set(sessionResponse(1));

    const tokens = await Promise.all([session.refresh(), session.refresh(), session.refresh()]);

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl).toHaveBeenCalledWith(
      `${BASE_URL}/auth/refresh`,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ refreshToken: 'refresh-1' }),
      }),
    );
    expect(tokens).toEqual(['access-2', 'access-2', 'access-2']);
    expect(session.current?.refreshToken).toBe('refresh-2');
  });

  it('refresh recusado (401) encerra a sessão e avisa quem escuta', async () => {
    const fetchImpl = jest.fn(() =>
      Promise.resolve(json(401, errorBody('UNAUTHORIZED', 'Sessão expirada.'))),
    );
    const { storage, session } = setup(fetchImpl);
    await session.set(sessionResponse(1));
    const listener = jest.fn();
    session.subscribe(listener);

    await expect(session.refresh()).resolves.toBeNull();

    expect(session.current).toBeNull();
    expect(storage.data.has(SESSION_KEY)).toBe(false);
    expect(listener).toHaveBeenCalledWith(null);
  });

  it('logout durante um refresh em andamento não ressuscita a sessão', async () => {
    let answer: (response: Response) => void = () => undefined;
    const fetchImpl = jest.fn((url: string) =>
      url.endsWith('/auth/refresh')
        ? new Promise<Response>((resolve) => {
            answer = resolve;
          })
        : Promise.resolve(new Response(null, { status: 204 })),
    );
    const { storage, session } = setup(fetchImpl);
    await session.set(sessionResponse(1));

    const refreshing = session.refresh();
    await session.logout();
    answer(json(200, sessionResponse(2)));

    await expect(refreshing).resolves.toBeNull();
    expect(session.current).toBeNull();
    expect(storage.data.has(SESSION_KEY)).toBe(false);
  });

  it('429 no refresh propaga e mantém a sessão (Q-31)', async () => {
    const fetchImpl = jest.fn(() =>
      Promise.resolve(json(429, errorBody('RATE_LIMITED', 'Muitas tentativas.'))),
    );
    const { session } = setup(fetchImpl);
    await session.set(sessionResponse(1));

    await expect(session.refresh()).rejects.toThrow('429');
    expect(session.current?.refreshToken).toBe('refresh-1');
  });

  it('falha de rede no refresh mantém a sessão (tenta de novo depois)', async () => {
    const fetchImpl = jest.fn(() => Promise.reject(new TypeError('Network request failed')));
    const { session } = setup(fetchImpl);
    await session.set(sessionResponse(1));

    await expect(session.refresh()).rejects.toThrow('Network request failed');
    expect(session.current?.refreshToken).toBe('refresh-1');
  });

  it('logout revoga o refresh na API e limpa local mesmo se a API falhar', async () => {
    const fetchImpl = jest.fn(() => Promise.reject(new TypeError('offline')));
    const { storage, session } = setup(fetchImpl);
    await session.set(sessionResponse(1));

    await session.logout();

    expect(fetchImpl).toHaveBeenCalledWith(
      `${BASE_URL}/auth/logout`,
      expect.objectContaining({ method: 'POST' }),
    );
    expect(session.current).toBeNull();
    expect(storage.data.size).toBe(0);
  });

  it('sessão gravada corrompida é descartada', async () => {
    const storage = memoryStorage();
    storage.data.set(SESSION_KEY, '{"accessToken":1}');
    const session = new SessionManager({ baseUrl: BASE_URL, fetch: jest.fn(), storage });

    await session.load();

    expect(session.current).toBeNull();
    expect(storage.data.has(SESSION_KEY)).toBe(false);
  });
});
