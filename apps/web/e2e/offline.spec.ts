import { chooseServiceAndFirstDay, expect, test } from './fixtures';

test.describe('PWA offline (3.8)', () => {
  test('horários vistos online não ficam no cache: offline mostra a página offline', async ({
    page,
    context,
    studio,
  }) => {
    // Service worker ativo (registro só em produção) controlando a página.
    await page.goto(`/${studio.slug}`);
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });
    await page.reload();

    // Online: abre a etapa 2 e carrega horários de verdade.
    await chooseServiceAndFirstDay(page, studio);
    const stepUrl = page.url();

    await context.setOffline(true);
    await page.goto(stepUrl);

    await expect(page.getByRole('heading', { name: 'Você está sem internet' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Tentar de novo' })).toBeVisible();
    await expect(page.getByRole('group', { name: /^Horários disponíveis em/ })).toHaveCount(0);

    // Nada de horários, holds ou reservas em nenhum cache do service worker.
    const cachedUrls = await page.evaluate(async () => {
      const urls: string[] = [];
      for (const name of await caches.keys()) {
        const cache = await caches.open(name);
        urls.push(...(await cache.keys()).map((request) => request.url));
      }
      return urls;
    });
    expect(cachedUrls.length).toBeGreaterThan(0);
    expect(cachedUrls.filter((url) => /availability|holds|bookings/.test(url))).toEqual([]);

    await context.setOffline(false);
  });
});
