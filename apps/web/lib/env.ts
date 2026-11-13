const DEFAULT_API = 'http://localhost:3333/v1';
const DEFAULT_SITE = 'http://localhost:3000';

/** URL da API para chamadas feitas no servidor Next (RSC). */
export function serverApiBaseUrl(): string {
  return process.env.API_INTERNAL_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || DEFAULT_API;
}

/** URL pública da web: base de canonical e Open Graph. */
export function siteUrl(): URL {
  return new URL(process.env.NEXT_PUBLIC_SITE_URL || DEFAULT_SITE);
}
