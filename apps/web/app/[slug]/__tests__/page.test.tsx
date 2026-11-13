import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getTheme } from '@agende/ui-tokens';
import { profileFixture } from '../../../test/fixtures';

const getPublicProfile = vi.fn<(slug: string) => Promise<unknown>>();
vi.mock('../../../lib/api/public-server', () => ({
  getPublicProfile: (slug: string) => getPublicProfile(slug),
}));
const notFound = vi.fn(() => {
  throw new Error('NEXT_NOT_FOUND');
});
vi.mock('next/navigation', () => ({ notFound: () => notFound() }));

const { default: Page, generateMetadata, generateViewport } = await import('../page');
const params = (slug: string) => ({ params: Promise.resolve({ slug }) });

beforeEach(() => {
  getPublicProfile.mockReset();
  notFound.mockClear();
});

describe('/[slug]', () => {
  it('perfil inexistente chama notFound()', async () => {
    getPublicProfile.mockResolvedValue(null);
    await expect(Page(params('nao-existe'))).rejects.toThrow('NEXT_NOT_FOUND');
  });

  it('mostra o nome do negócio como h1 e injeta o tema da paleta', async () => {
    getPublicProfile.mockResolvedValue(profileFixture);
    const { container } = render(await Page(params('studio-ana')));

    expect(screen.getByRole('heading', { level: 1, name: 'Studio Ana Nails' })).toBeInTheDocument();
    const css = container.querySelector('style')?.textContent ?? '';
    expect(css).toContain(getTheme('PASTEL_LILAC', 'light').colors.primary);
    expect(css).toContain('prefers-color-scheme: dark');
  });

  it('etapa 1: lista os serviços do perfil', async () => {
    getPublicProfile.mockResolvedValue({
      ...profileFixture,
      services: [
        {
          id: '01a1d4c4-ae02-742d-811c-1a062bb4fa3f',
          name: 'Manicure',
          category: 'Mãos',
          description: null,
          priceCents: 5000,
          durationMin: 45,
          imageUrl: null,
        },
      ],
    });
    render(await Page(params('studio-ana')));
    expect(
      screen.getByRole('heading', { level: 2, name: 'Escolha o serviço' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Manicure/ })).toBeInTheDocument();
  });

  it('Q-27: sem opt-in mostra só cidade e UF', async () => {
    getPublicProfile.mockResolvedValue(profileFixture);
    render(await Page(params('studio-ana')));
    expect(screen.getByText('São Paulo – SP')).toBeInTheDocument();
  });

  it('Q-27: com addressLine mostra o endereço completo', async () => {
    getPublicProfile.mockResolvedValue({ ...profileFixture, addressLine: 'Rua das Flores, 10' });
    render(await Page(params('studio-ana')));
    expect(screen.getByText('Rua das Flores, 10 · São Paulo – SP')).toBeInTheDocument();
  });

  it('sem cidade nem endereço não mostra linha de local', async () => {
    getPublicProfile.mockResolvedValue({ ...profileFixture, city: null, state: null });
    render(await Page(params('studio-ana')));
    expect(screen.queryByTestId('profile-location')).toBeNull();
  });

  it('metadata usa o nome do negócio e a URL canônica do slug', async () => {
    getPublicProfile.mockResolvedValue(profileFixture);
    const metadata = await generateMetadata(params('studio-ana'));
    expect(metadata.title).toBe('Studio Ana Nails · Agende');
    expect(metadata.alternates?.canonical).toBe('/studio-ana');
    expect(metadata.openGraph?.title).toBe('Studio Ana Nails');
  });

  it('metadata de perfil inexistente não lança', async () => {
    getPublicProfile.mockResolvedValue(null);
    await expect(generateMetadata(params('x'))).resolves.toMatchObject({
      title: 'Página não encontrada · Agende',
    });
  });

  it('theme-color no SYSTEM segue prefers-color-scheme', async () => {
    getPublicProfile.mockResolvedValue(profileFixture);
    const viewport = await generateViewport(params('studio-ana'));
    expect(viewport.themeColor).toEqual([
      {
        media: '(prefers-color-scheme: light)',
        color: getTheme('PASTEL_LILAC', 'light').colors.primary,
      },
      {
        media: '(prefers-color-scheme: dark)',
        color: getTheme('PASTEL_LILAC', 'dark').colors.primary,
      },
    ]);
  });

  it('theme-color no DARK usa a primary escura', async () => {
    getPublicProfile.mockResolvedValue({ ...profileFixture, themeMode: 'DARK' });
    const viewport = await generateViewport(params('studio-ana'));
    expect(viewport.themeColor).toBe(getTheme('PASTEL_LILAC', 'dark').colors.primary);
  });

  it('theme-color no LIGHT usa a primary clara e o body recebe o tema', async () => {
    getPublicProfile.mockResolvedValue({ ...profileFixture, themeMode: 'LIGHT' });
    const { container } = render(await Page(params('studio-ana')));
    expect(container.querySelector('style')?.textContent).toContain(
      'body { background: var(--color-background)',
    );
    const viewport = await generateViewport(params('studio-ana'));
    expect(viewport.themeColor).toBe(getTheme('PASTEL_LILAC', 'light').colors.primary);
  });
});
