import type { Metadata, Viewport } from 'next';
import { notFound } from 'next/navigation';
import { buildThemeCss, getTheme, type ColorScheme } from '@agende/ui-tokens';
import { getPublicProfile } from '../../lib/api/public-server';
import { BookingFlowLoader } from './_components/BookingFlowLoader';
import { ProfileHeader, formatLocation } from './_components/ProfileHeader';
import { ServiceList } from './_components/ServiceList';
import styles from './page.module.css';

/** O tema cobre a página inteira, não só a coluna do `main`. */
const BODY_CSS = 'body { background: var(--color-background); color: var(--color-text-primary); }';

interface Props {
  params: Promise<{ slug: string }>;
}

type SearchParams = Record<string, string | string[] | undefined>;

const LOCAL_DATE = /^\d{4}-\d{2}-\d{2}$/;
const UTC_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/;

/** Data de calendário real (`2026-02-31` e `2026-13-45` não passam). */
const isRealDate = (value: string) =>
  !Number.isNaN(Date.parse(`${value}T12:00:00Z`)) &&
  new Date(`${value}T12:00:00Z`).toISOString().startsWith(value);

/** Estado do fluxo na URL (`?service=&date=&slot=`); valores malformados são ignorados. */
function param(searchParams: SearchParams, name: string, pattern?: RegExp): string | undefined {
  const value = searchParams[name];
  if (typeof value !== 'string') return undefined;
  if (pattern && !pattern.test(value)) return undefined;
  return pattern === LOCAL_DATE && !isRealDate(value) ? undefined : value;
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

export default async function ProfilePage({
  params,
  searchParams,
}: Props & { searchParams: Promise<SearchParams> }) {
  const { slug } = await params;
  const profile = await getPublicProfile(slug);
  if (!profile) notFound();

  const query = await searchParams;
  // RN-91: só serviços que a API publicou; id desconhecido volta à etapa 1.
  const service = profile.services.find((s) => s.id === param(query, 'service'));

  return (
    <>
      <style>{`${buildThemeCss(profile.themePalette, profile.themeMode)}
${BODY_CSS}`}</style>
      <main className={styles.main}>
        <ProfileHeader {...profile} />
        {service ? (
          <BookingFlowLoader
            slug={profile.slug}
            timezone={profile.timezone}
            service={{
              id: service.id,
              name: service.name,
              durationMin: service.durationMin,
              priceCents: service.priceCents,
            }}
            initialDate={param(query, 'date', LOCAL_DATE)}
            initialSlot={param(query, 'slot', UTC_INSTANT)}
            cancellationPolicy={profile.cancellationPolicy}
            location={formatLocation(profile)}
          />
        ) : (
          <ServiceList slug={profile.slug} services={profile.services} />
        )}
      </main>
    </>
  );
}
