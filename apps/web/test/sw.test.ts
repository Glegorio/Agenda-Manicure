// @vitest-environment node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Executa `public/sw.js` num contexto isolado com um `self` falso e dispara eventos `fetch`,
 * conferindo a estratégia de cache sem navegador.
 */
const source = readFileSync(resolve(process.cwd(), 'public/sw.js'), 'utf8');
const ORIGIN = 'https://agende.app';

type Handler = (event: unknown) => void;

function loadWorker() {
  const handlers: Record<string, Handler> = {};
  const store = new Map<string, Response>();
  const cache = {
    match: vi.fn((req: Request | string) =>
      Promise.resolve(
        store.get(new URL(typeof req === 'string' ? req : req.url, ORIGIN).href)?.clone(),
      ),
    ),
    put: vi.fn((req: Request, res: Response) => {
      store.set(req.url, res);
      return Promise.resolve();
    }),
    addAll: vi.fn(() => Promise.resolve()),
    keys: vi.fn(() => Promise.resolve([...store.keys()].map((url) => new Request(url)))),
    delete: vi.fn((req: Request) => Promise.resolve(store.delete(req.url))),
  };
  const caches = {
    open: vi.fn(() => Promise.resolve(cache)),
    keys: vi.fn(() => Promise.resolve(['agende-shell-old'])),
    delete: vi.fn(() => Promise.resolve(true)),
    match: vi.fn((url: string) => cache.match(url)),
  };
  const fetchMock = vi.fn<(req: Request) => Promise<Response>>(() =>
    Promise.resolve(new Response('rede', { status: 200 })),
  );
  const self = {
    location: { origin: ORIGIN },
    addEventListener: (type: string, fn: Handler) => {
      handlers[type] = fn;
    },
    skipWaiting: vi.fn(),
    clients: { claim: vi.fn() },
  };
  runInNewContext(source, { self, caches, fetch: fetchMock, URL, Response, Request, Promise });

  async function dispatchFetch(url: string, init: RequestInit & { mode?: RequestMode } = {}) {
    // `navigate` não pode ser passado ao construtor: só o navegador cria esse modo.
    const { mode, ...rest } = init;
    const req = new Request(url, rest);
    if (mode === 'navigate') Object.defineProperty(req, 'mode', { value: 'navigate' });
    let responded: Promise<Response> | undefined;
    handlers.fetch?.({
      request: req,
      respondWith: (p: Promise<Response>) => {
        responded = p;
      },
      waitUntil: () => undefined,
    });
    return {
      intercepted: responded !== undefined,
      response: responded ? await responded : undefined,
    };
  }

  return { handlers, cache, caches, store, fetchMock, dispatchFetch };
}

let worker: ReturnType<typeof loadWorker>;

beforeEach(() => {
  worker = loadWorker();
});

describe('service worker (3.8) — o que nunca é interceptado', () => {
  it('API em outra origem, mesmo em caminho de asset estático', async () => {
    const { intercepted } = await worker.dispatchFetch('https://api.agende.app/_next/static/a.js');
    expect(intercepted).toBe(false);
  });

  it.each(['availability', 'holds', 'bookings'])(
    'navegação para um caminho com o segmento "%s" vai direto à rede',
    async (word) => {
      const { intercepted } = await worker.dispatchFetch(`${ORIGIN}/v1/public/x/${word}`, {
        mode: 'navigate',
      });
      expect(intercepted).toBe(false);
    },
  );

  it('asset estático com "holds" no caminho também não é guardado', async () => {
    const { intercepted } = await worker.dispatchFetch(`${ORIGIN}/_next/static/holds/a.js`);
    expect(intercepted).toBe(false);
    expect(worker.cache.put).not.toHaveBeenCalled();
  });

  it('slug que só contém a palavra (ex.: bookings-nails) continua com fallback offline', async () => {
    const { intercepted } = await worker.dispatchFetch(`${ORIGIN}/bookings-nails`, {
      mode: 'navigate',
    });
    expect(intercepted).toBe(true);
  });

  it('requisições que não são GET', async () => {
    const { intercepted } = await worker.dispatchFetch(`${ORIGIN}/_next/static/a.js`, {
      method: 'POST',
    });
    expect(intercepted).toBe(false);
  });

  it('ícones da profissional ficam com o cache HTTP (podem mudar com a paleta)', async () => {
    const { intercepted } = await worker.dispatchFetch(`${ORIGIN}/studio-ana/pwa-icon/192`);
    expect(intercepted).toBe(false);
  });
});

describe('service worker (3.8) — cache dos assets do Next', () => {
  it('cache-first: a segunda vez não vai à rede', async () => {
    const url = `${ORIGIN}/_next/static/chunks/app.js`;
    await worker.dispatchFetch(url);
    await worker.dispatchFetch(url);
    expect(worker.fetchMock).toHaveBeenCalledTimes(1);
    expect(worker.cache.put).toHaveBeenCalledTimes(1);
  });

  it('resposta de erro não é guardada', async () => {
    worker.fetchMock.mockResolvedValueOnce(new Response('x', { status: 404 }));
    await worker.dispatchFetch(`${ORIGIN}/_next/static/chunks/sumiu.js`);
    expect(worker.cache.put).not.toHaveBeenCalled();
  });

  it('o cache tem limite de entradas: as mais antigas saem', async () => {
    for (let i = 0; i < 70; i += 1) {
      await worker.dispatchFetch(`${ORIGIN}/_next/static/chunks/${String(i)}.js`);
    }
    expect(worker.store.size).toBeLessThanOrEqual(60);
    expect(worker.store.has(`${ORIGIN}/_next/static/chunks/69.js`)).toBe(true);
    expect(worker.store.has(`${ORIGIN}/_next/static/chunks/0.js`)).toBe(false);
  });
});

describe('service worker (3.8) — navegação', () => {
  it('rede primeiro (página sempre atual) e o HTML não é guardado', async () => {
    const { response } = await worker.dispatchFetch(`${ORIGIN}/studio-ana`, { mode: 'navigate' });
    expect(await response?.text()).toBe('rede');
    expect(worker.cache.put).not.toHaveBeenCalled();
  });

  it('sem rede: mostra a página offline estática guardada na instalação', async () => {
    worker.store.set(`${ORIGIN}/offline.html`, new Response('offline'));
    worker.fetchMock.mockRejectedValueOnce(new TypeError('offline'));

    const { response } = await worker.dispatchFetch(`${ORIGIN}/studio-ana`, { mode: 'navigate' });

    expect(await response?.text()).toBe('offline');
  });

  it('sem rede e sem a página offline: 503 em texto', async () => {
    worker.fetchMock.mockRejectedValueOnce(new TypeError('offline'));
    const { response } = await worker.dispatchFetch(`${ORIGIN}/studio-ana`, { mode: 'navigate' });
    expect(response?.status).toBe(503);
  });
});

describe('service worker (3.8) — ciclo de vida', () => {
  it('instalação guarda só a página offline estática', async () => {
    let done: Promise<unknown> = Promise.resolve();
    worker.handlers.install?.({
      waitUntil: (p: Promise<unknown>) => {
        done = p;
      },
    });
    await done;
    expect(worker.cache.addAll).toHaveBeenCalledWith(['/offline.html']);
  });

  it('ativação apaga caches de versões antigas', async () => {
    let done: Promise<unknown> = Promise.resolve();
    worker.handlers.activate?.({
      waitUntil: (p: Promise<unknown>) => {
        done = p;
      },
    });
    await done;
    expect(worker.caches.delete).toHaveBeenCalledWith('agende-shell-old');
  });
});

describe('public/offline.html', () => {
  const html = readFileSync(resolve(process.cwd(), 'public/offline.html'), 'utf8');

  it('funciona sozinha: sem CSS nem JS externos (nada com hash de build)', () => {
    expect(html).not.toMatch(/<link[^>]+stylesheet/);
    expect(html).not.toMatch(/<script[^>]+src=/);
    expect(html).toContain('<style>');
  });

  it('explica a falta de conexão e oferece "Tentar de novo"', () => {
    expect(html).toContain('lang="pt-BR"');
    expect(html).toContain('Você está sem internet');
    expect(html).toMatch(/Tentar de novo/);
  });
});
