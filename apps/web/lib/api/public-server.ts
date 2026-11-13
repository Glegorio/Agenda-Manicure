import { cache } from 'react';
import {
  publicProfileResponseSchema,
  slugSchema,
  type PublicProfileResponse,
} from '@agende/contracts';
import { serverApiBaseUrl } from '../env';

/** Cache do perfil no servidor: a página pública não pode estourar o rate limit por IP (Q-25). */
const PROFILE_REVALIDATE_S = 60;

interface FetchOptions {
  fetch?: typeof fetch;
  baseUrl?: string;
}

/** `GET /v1/public/:slug`. `null` para slug fora do RN-90 ou perfil inexistente. */
export async function fetchPublicProfile(
  slug: string,
  { fetch: fetchImpl = fetch, baseUrl = serverApiBaseUrl() }: FetchOptions = {},
): Promise<PublicProfileResponse | null> {
  if (!slugSchema.safeParse(slug).success) return null;

  const response = await fetchImpl(`${baseUrl}/public/${slug}`, {
    headers: { accept: 'application/json' },
    next: { revalidate: PROFILE_REVALIDATE_S },
  });
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`Falha ao carregar o perfil público (HTTP ${String(response.status)})`);
  }
  return publicProfileResponseSchema.parse(await response.json());
}

/** Deduplicado por requisição: metadata, viewport e página compartilham a mesma busca. */
export const getPublicProfile = cache((slug: string) => fetchPublicProfile(slug));
