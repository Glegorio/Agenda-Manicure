import type { Metadata, Viewport } from 'next';
import { notFound } from 'next/navigation';
import { buildThemeCss, getTheme, type ColorScheme } from '@agende/ui-tokens';
import { getPublicProfile } from '../../lib/api/public-server';
import { ProfileHeader, formatLocation } from './_components/ProfileHeader';
import styles from './page.module.css';

/** O tema cobre a página inteira, não só a coluna do `main`. */
const BODY_CSS = 'body { background: var(--color-background); color: var(--color-text-primary); }';

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const profile = await getPublicProfile(slug);
  if (!profile) return { title: 'Página não encontrada · Agende', robots: { index: false } };

  const location = formatLocation(profile);
  const description = `Agende seu horário com ${profile.businessName}${location ? ` em ${location}` : ''}.`;
  return {
    title: `${profile.businessName} · Agende`,
    description,
    alternates: { canonical: `/${profile.slug}` },
    openGraph: {
      title: profile.businessName,
      description,
      type: 'website',
      locale: 'pt_BR',
      url: `/${profile.slug}`,
    },
  };
}

export async function generateViewport({ params }: Props): Promise<Viewport> {
  const { slug } = await params;
  const profile = await getPublicProfile(slug);
  if (!profile) return {};
  const primary = (scheme: ColorScheme) => getTheme(profile.themePalette, scheme).colors.primary;
  if (profile.themeMode !== 'SYSTEM') {
    return { themeColor: primary(profile.themeMode === 'DARK' ? 'dark' : 'light') };
  }
  return {
    themeColor: [
      { media: '(prefers-color-scheme: light)', color: primary('light') },
      { media: '(prefers-color-scheme: dark)', color: primary('dark') },
    ],
  };
}

export default async function ProfilePage({ params }: Props) {
  const { slug } = await params;
  const profile = await getPublicProfile(slug);
  if (!profile) notFound();

  return (
    <>
      <style>{`${buildThemeCss(profile.themePalette, profile.themeMode)}
${BODY_CSS}`}</style>
      <main className={styles.main}>
        <ProfileHeader {...profile} />
        {/* Etapas do agendamento entram a partir da 3.3. */}
      </main>
    </>
  );
}
