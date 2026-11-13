/*
 * Service worker da web booking (3.8). Escrito à mão (sem bibliotecas). Só guarda o que está
 * na lista de permitidos:
 * - assets versionados do Next (`/_next/static/`): cache-first, com limite de entradas;
 * - `/offline.html` (estático, sem CSS/JS externos), guardada na instalação.
 * Navegações vão à rede primeiro e o HTML nunca é guardado. A API (outra origem) e qualquer
 * caminho com segmento availability/holds/bookings nunca são interceptados — horários e
 * reservas vêm sempre da rede (rules/web.md, RN-40..44). Ícones ficam com o cache HTTP.
 */
const VERSION = 'v2';
const CACHE = `agende-shell-${VERSION}`;
const OFFLINE_URL = '/offline.html';
const MAX_ASSETS = 60;
const NEVER_INTERCEPT = /(^|\/)(availability|holds|bookings)(\/|$)/;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll([OFFLINE_URL]))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

/** A cada deploy entram chunks novos: os mais antigos saem (a página offline fica). */
async function trimAssets(cache) {
  const keys = (await cache.keys()).filter((req) => !req.url.endsWith(OFFLINE_URL));
  const excess = keys.length - MAX_ASSETS;
  for (let i = 0; i < excess; i += 1) await cache.delete(keys[i]);
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    await cache.put(request, response.clone());
    await trimAssets(cache);
  }
  return response;
}

async function networkFirstNavigation(request) {
  try {
    return await fetch(request);
  } catch {
    const offline = await caches.match(OFFLINE_URL);
    return (
      offline ??
      new Response('Sem conexão.', {
        status: 503,
        headers: { 'content-type': 'text/plain; charset=utf-8' },
      })
    );
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (NEVER_INTERCEPT.test(url.pathname)) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstNavigation(request));
  } else if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(cacheFirst(request));
  }
});
