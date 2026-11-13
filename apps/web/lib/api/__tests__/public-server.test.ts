import { describe, expect, it, vi } from 'vitest';
import { fetchPublicProfile } from '../public-server';
import { profileFixture } from '../../../test/fixtures';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('fetchPublicProfile', () => {
  it('200: valida com o contrato e devolve o perfil, com revalidate (Q-25)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json(200, profileFixture));
    const profile = await fetchPublicProfile('studio-ana', {
      fetch: fetchMock,
      baseUrl: 'http://api/v1',
    });

    expect(profile?.businessName).toBe(profileFixture.businessName);
    expect(fetchMock).toHaveBeenCalledWith(
      'http://api/v1/public/studio-ana',
      expect.objectContaining({ next: { revalidate: 60 } }),
    );
  });

  it('404: devolve null', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json(404, { error: { code: 'NOT_FOUND' } }));
    await expect(
      fetchPublicProfile('studio-ana', { fetch: fetchMock, baseUrl: 'x' }),
    ).resolves.toBeNull();
  });

  it('RN-90: slug inválido ou reservado devolve null sem chamar a API', async () => {
    const fetchMock = vi.fn();
    for (const slug of ['Studio', 'a', 'api', 'ab--c', '~offline']) {
      await expect(
        fetchPublicProfile(slug, { fetch: fetchMock, baseUrl: 'x' }),
      ).resolves.toBeNull();
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('5xx: lança erro (vai para o error boundary, não vira 404)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json(503, {}));
    await expect(
      fetchPublicProfile('studio-ana', { fetch: fetchMock, baseUrl: 'x' }),
    ).rejects.toThrow();
  });

  it('resposta fora do contrato: lança erro', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json(200, { slug: 'x' }));
    await expect(
      fetchPublicProfile('studio-ana', { fetch: fetchMock, baseUrl: 'x' }),
    ).rejects.toThrow();
  });
});
