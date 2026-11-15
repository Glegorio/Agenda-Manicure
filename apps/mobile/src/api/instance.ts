import * as SecureStore from 'expo-secure-store';
import { SessionManager } from '../auth/session';
import { createApiClient } from './client';

/** `apps/mobile/.env` (veja `.env.example`); no celular físico, use o IP da máquina. */
const baseUrl = resolveBaseUrl(process.env.EXPO_PUBLIC_API_BASE_URL, __DEV__);

/** Fora do dev, só HTTPS: login e tokens nunca trafegam em claro (Wi-Fi do salão). */
export function resolveBaseUrl(configured: string | undefined, dev: boolean): string {
  if (dev) return configured ?? 'http://localhost:3333/v1';
  if (!configured?.startsWith('https://')) {
    throw new Error(
      'EXPO_PUBLIC_API_BASE_URL precisa ser https:// fora do modo de desenvolvimento.',
    );
  }
  return configured;
}

export const session = new SessionManager({
  baseUrl,
  fetch: (input, init) => fetch(input, init),
  storage: SecureStore,
});

export const api = createApiClient({
  baseUrl,
  fetch: (input, init) => fetch(input, init),
  session,
});
