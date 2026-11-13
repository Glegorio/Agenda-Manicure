import { ImageResponse } from 'next/og';
import { getTheme } from '@agende/ui-tokens';
import { getPublicProfile } from '../../../../lib/api/public-server';
import { PWA_ICON_SIZES, iconInitial, themeSchemeFor } from '../../../../lib/pwa';

/**
 * Ícone da profissional (Q-36): a inicial do negócio sobre a cor principal da paleta dela. Logo
 * enviado pela profissional depende do provedor de imagens (Q-09).
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string; size: string }> },
) {
  const { slug, size: rawSize } = await params;
  const size = PWA_ICON_SIZES.find((s) => String(s) === rawSize);
  if (!size) return new Response('Não encontrado', { status: 404 });
  const profile = await getPublicProfile(slug);
  if (!profile) return new Response('Não encontrado', { status: 404 });

  const { colors } = getTheme(profile.themePalette, themeSchemeFor(profile.themeMode));
  const initial = iconInitial(profile.businessName);

  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: colors.primary,
        color: colors.onPrimary,
        // Dentro da zona segura do maskable (80% central).
        fontSize: Math.round(size * 0.42),
        fontWeight: 700,
      }}
    >
      {initial}
    </div>,
    {
      width: size,
      height: size,
      headers: { 'cache-control': 'public, max-age=86400' },
    },
  );
}
