import { getTheme } from '@agende/ui-tokens';
import { getPublicProfile } from '../../../lib/api/public-server';
import { PWA_ICON_SIZES, themeSchemeFor } from '../../../lib/pwa';

/** Q-36: o app instalado é da profissional — abre no link dela, com nome e cores dela. */
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const profile = await getPublicProfile(slug);
  if (!profile) return new Response('Não encontrado', { status: 404 });

  const { colors } = getTheme(profile.themePalette, themeSchemeFor(profile.themeMode));
  const base = `/${profile.slug}`;
  const manifest = {
    name: profile.businessName,
    // Até 12 caracteres para caber sob o ícone na tela inicial.
    short_name: Array.from(profile.businessName).slice(0, 12).join('').trim(),
    description: `Agende seu horário com ${profile.businessName}.`,
    lang: 'pt-BR',
    start_url: base,
    scope: base,
    display: 'standalone',
    theme_color: colors.primary,
    background_color: colors.background,
    icons: [
      ...PWA_ICON_SIZES.filter((size) => size !== 180).map((size) => ({
        src: `${base}/pwa-icon/${String(size)}`,
        sizes: `${String(size)}x${String(size)}`,
        type: 'image/png',
        purpose: 'any',
      })),
      // A inicial fica no centro, longe da borda: serve também como maskable.
      { src: `${base}/pwa-icon/512`, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };

  return Response.json(manifest, {
    headers: {
      'content-type': 'application/manifest+json; charset=utf-8',
      'cache-control': 'public, max-age=300',
    },
  });
}
