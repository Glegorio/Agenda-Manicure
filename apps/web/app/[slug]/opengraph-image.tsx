import { ImageResponse } from 'next/og';
import { getTheme } from '@agende/ui-tokens';
import { getPublicProfile } from '../../lib/api/public-server';
import { formatLocation } from './_components/ProfileHeader';

export const alt = 'Agende seu horário';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function OpengraphImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const profile = await getPublicProfile(slug);
  const { colors } = getTheme(profile?.themePalette ?? 'ELEGANCE_BLACK', 'light');
  const location = profile ? formatLocation(profile) : null;

  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: 80,
        background: colors.primary,
        color: colors.onPrimary,
      }}
    >
      <div style={{ fontSize: 72, fontWeight: 700 }}>{profile?.businessName ?? 'Agende'}</div>
      {location && <div style={{ fontSize: 36, marginTop: 16 }}>{location}</div>}
      <div style={{ fontSize: 32, marginTop: 48 }}>Agende seu horário online</div>
    </div>,
    size,
  );
}
