import { describe, expect, it, vi } from 'vitest';
import { ApiError, createPublicClient } from '../public-client';

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });

const SERVICE = '01a1d4c4-ae02-742d-811c-1a062bb4fa3f';

describe('public-client', () => {
  it('availability/days com from/to e serviceId', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(json(200, { timezone: 'America/Sao_Paulo', days: ['2026-11-13'] }));
    const api = createPublicClient('http://api/v1', fetchMock);

    const res = await api.availabilityDays('studio-ana', SERVICE, '2026-11-01', '2026-11-30');

    expect(res.days).toEqual(['2026-11-13']);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      `http://api/v1/public/studio-ana/availability/days?serviceId=${SERVICE}&from=2026-11-01&to=2026-11-30`,
    );
  });

  it('nunca usa cache do navegador para horários', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json(200, { timezone: 'UTC', slots: [] }));
    await createPublicClient('http://api/v1', fetchMock).availability(
      'studio-ana',
      SERVICE,
      '2026-11-13',
    );
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ cache: 'no-store' });
  });

  it('RN-40: cria hold com POST e devolve o Date do servidor', async () => {
    const hold = { holdToken: 'x'.repeat(43), expiresAt: '2026-11-13T12:05:00.000Z' };
    const fetchMock = vi
      .fn()
      .mockResolvedValue(json(201, hold, { date: 'Fri, 13 Nov 2026 12:00:00 GMT' }));
    const api = createPublicClient('http://api/v1', fetchMock);

    const res = await api.createHold('studio-ana', SERVICE, '2026-11-13T13:00:00.000Z');

    expect(res.hold).toEqual(hold);
    expect(res.serverDate?.toISOString()).toBe('2026-11-13T12:00:00.000Z');
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://api/v1/public/studio-ana/holds');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({
      serviceId: SERVICE,
      startAt: '2026-11-13T13:00:00.000Z',
    });
  });

  it('libera hold com DELETE keepalive', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    await createPublicClient('http://api/v1', fetchMock).releaseHold('studio-ana', 'tok');
    expect(fetchMock).toHaveBeenCalledWith(
      'http://api/v1/public/studio-ana/holds/tok',
      expect.objectContaining({ method: 'DELETE', keepalive: true }),
    );
  });

  it('erro com envelope vira ApiError com código e Retry-After', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        json(
          429,
          { error: { code: 'RATE_LIMITED', message: 'Muitas tentativas.', details: {} } },
          { 'retry-after': '30' },
        ),
      );
    const error = await createPublicClient('http://api/v1', fetchMock)
      .createHold('studio-ana', SERVICE, '2026-11-13T13:00:00.000Z')
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 429,
      code: 'RATE_LIMITED',
      message: 'Muitas tentativas.',
      retryAfterS: 30,
    });
  });

  it('corpo não-JSON vira erro genérico', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('<html>', { status: 502 }));
    const error = await createPublicClient('http://api/v1', fetchMock)
      .availability('studio-ana', SERVICE, '2026-11-13')
      .catch((e: unknown) => e);
    expect(error).toMatchObject({ status: 502, code: 'UNKNOWN' });
  });
});
