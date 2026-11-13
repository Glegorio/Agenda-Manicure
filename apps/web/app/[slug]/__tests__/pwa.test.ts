import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getTheme } from '@agende/ui-tokens';
import { profileFixture } from '../../../test/fixtures';

const getPublicProfile = vi.fn<(slug: string) => Promise<unknown>>();
vi.mock('../../../lib/api/public-server', () => ({
  getPublicProfile: (slug: string) => getPublicProfile(slug),
}));

const { GET: manifest } = await import('../manifest.webmanifest/route');
const { GET: icon } = await import('../pwa-icon/[size]/route');
const { iconInitial, themeSchemeFor } = await import('../../../lib/pwa');

const ctx = <T extends object>(params: T) => ({ params: Promise.resolve(params) });
const request = new Request('http://localhost:3000/x');

beforeEach(() => {
  getPublicProfile.mockReset();
});

describe('manifest por profissional (Q-36)', () => {
  it('Q-36: app instalado abre no link da profissional, com nome e cores dela', async () => {
    getPublicProfile.mockResolvedValue(profileFixture);

    const res = await manifest(request, ctx({ slug: 'studio-ana' }));
    const body = (await res.json()) as Record<string, unknown>;

    expect(res.headers.get('content-type')).toContain('application/manifest+json');
    expect(body).toMatchObject({
      name: 'Studio Ana Nails',
      start_url: '/studio-ana',
      scope: '/studio-ana',
      display: 'standalone',
      lang: 'pt-BR',
      theme_color: getTheme('PASTEL_LILAC', 'light').colors.primary,
      background_color: getTheme('PASTEL_LILAC', 'light').colors.background,
    });
  });

  it('nome curto cabe na tela inicial (até 12 caracteres)', async () => {
    getPublicProfile.mockResolvedValue(profileFixture);
    const body = (await (await manifest(request, ctx({ slug: 'studio-ana' }))).json()) as {
      short_name: string;
    };
    expect(body.short_name.length).toBeLessThanOrEqual(12);
  });

  it('ícones 192, 512 e maskable da própria profissional', async () => {
    getPublicProfile.mockResolvedValue(profileFixture);
    const body = (await (await manifest(request, ctx({ slug: 'studio-ana' }))).json()) as {
      icons: { src: string; sizes: string; purpose?: string }[];
    };
    expect(body.icons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ src: '/studio-ana/pwa-icon/192', sizes: '192x192' }),
        expect.objectContaining({ src: '/studio-ana/pwa-icon/512', sizes: '512x512' }),
        expect.objectContaining({ purpose: 'maskable' }),
      ]),
    );
  });

  it('slug inexistente → 404', async () => {
    getPublicProfile.mockResolvedValue(null);
    expect((await manifest(request, ctx({ slug: 'nao-existe' }))).status).toBe(404);
  });
});

describe('ícone gerado da profissional', () => {
  it('PNG no tamanho pedido, com cache', async () => {
    getPublicProfile.mockResolvedValue(profileFixture);
    const res = await icon(request, ctx({ slug: 'studio-ana', size: '192' }));
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/png');
    expect(res.headers.get('cache-control')).toContain('max-age');
  });

  it('nome começando com emoji usa a primeira letra (a fonte do ícone não tem emoji)', async () => {
    getPublicProfile.mockResolvedValue({ ...profileFixture, businessName: '💅 Bia Nails' });
    expect(iconInitial('💅 Bia Nails')).toBe('B');
    const res = await icon(request, ctx({ slug: 'studio-ana', size: '192' }));
    expect(res.status).toBe(200);
  });

  it('tamanho fora da lista → 404', async () => {
    getPublicProfile.mockResolvedValue(profileFixture);
    expect((await icon(request, ctx({ slug: 'studio-ana', size: '9999' }))).status).toBe(404);
  });

  it('slug inexistente → 404', async () => {
    getPublicProfile.mockResolvedValue(null);
    expect((await icon(request, ctx({ slug: 'x', size: '192' }))).status).toBe(404);
  });
});

describe('tema do app instalado', () => {
  it('ícone e manifest usam o mesmo modo da profissional (DARK → escuro; SYSTEM → claro)', () => {
    expect(themeSchemeFor('DARK')).toBe('dark');
    expect(themeSchemeFor('LIGHT')).toBe('light');
    expect(themeSchemeFor('SYSTEM')).toBe('light');
  });

  it('manifest de profissional DARK usa a primary escura', async () => {
    getPublicProfile.mockResolvedValue({ ...profileFixture, themeMode: 'DARK' });
    const body = (await (await manifest(request, ctx({ slug: 'studio-ana' }))).json()) as {
      theme_color: string;
    };
    expect(body.theme_color).toBe(getTheme('PASTEL_LILAC', 'dark').colors.primary);
  });
});
