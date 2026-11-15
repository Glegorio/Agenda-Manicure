import { chromium, type Page } from '@playwright/test';
import lighthouse from 'lighthouse';
import { expect, test } from './fixtures';

/**
 * 3.10 / Q-37: rota pública no perfil mobile padrão do Lighthouse (Slow 4G e CPU 4× simulados).
 * Metas: LCP < 2,5 s e TBT ≤ 200 ms (TBT no lugar do TTI, que saiu da pontuação).
 * Orçamento de JS renegociado (Q-37): a base do Next 16 + React 19.3 já transfere ~121 KB gz
 * (react-dom 70 + runtime do App Router 46 + runtime Turbopack 5). Etapa 1 (só RSC) ≤ 150 KB;
 * etapa 2 (fluxo interativo carregado sob demanda) ≤ 170 KB. Medido em 2026-11-13: 141 e 149 KB
 * (ADR-0011).
 */
const PORT = 9333;
const LCP_MAX_MS = 2500;
const TBT_MAX_MS = 200;
const CLS_MAX = 0.1;
const SCRIPT_BUDGET_KB = { 'etapa-1': 150, 'etapa-2': 170 } as const;
type Step = keyof typeof SCRIPT_BUDGET_KB;

test.describe.configure({ mode: 'serial' });

interface Measure {
  performance: number;
  lcpMs: number;
  tbtMs: number;
  fcpMs: number;
  cls: number;
  /** `transferSize` dos scripts: comprimido e com cabeçalhos (lado conservador). */
  scriptBytes: number;
  benchmarkIndex: number;
}

/**
 * Mede `url` no perfil mobile do Lighthouse. `ready` roda no aquecimento e prova que a página
 * certa renderizou (evita medir uma 404 ou uma etapa vazia, que seriam "rápidas").
 */
async function measure(url: string, ready: (page: Page) => Promise<void>): Promise<Measure> {
  const browser = await chromium.launch({ args: [`--remote-debugging-port=${String(PORT)}`] });
  try {
    const warm = await browser.newPage();
    const response = await warm.goto(url);
    expect(response?.status(), 'status HTTP da página medida').toBe(200);
    await ready(warm);
    await warm.close();

    const result = await lighthouse(url, {
      port: PORT,
      output: 'json',
      logLevel: 'error',
      onlyCategories: ['performance'],
    });
    if (!result) throw new Error('Lighthouse não devolveu resultado');
    const { lhr } = result;
    expect(lhr.runtimeError, 'erro do Lighthouse').toBeUndefined();
    expect(lhr.finalDisplayedUrl, 'URL medida').toBe(url);

    const { audits } = lhr;
    const resources = (
      audits['resource-summary']?.details as
        { items?: { resourceType: string; transferSize: number }[] } | undefined
    )?.items;
    const scriptBytes = resources?.find((i) => i.resourceType === 'script')?.transferSize;
    if (!scriptBytes) throw new Error('Lighthouse não mediu o JS transferido');

    return {
      performance: Math.round((lhr.categories['performance']?.score ?? 0) * 100),
      lcpMs: Math.round(audits['largest-contentful-paint']?.numericValue ?? Infinity),
      tbtMs: Math.round(audits['total-blocking-time']?.numericValue ?? Infinity),
      fcpMs: Math.round(audits['first-contentful-paint']?.numericValue ?? Infinity),
      cls: audits['cumulative-layout-shift']?.numericValue ?? Infinity,
      scriptBytes,
      benchmarkIndex: lhr.environment.benchmarkIndex,
    };
  } finally {
    await browser.close();
  }
}

async function check(step: Step, result: Measure) {
  const budget = SCRIPT_BUDGET_KB[step];
  const summary = {
    step,
    ...result,
    scriptKb: Math.round(result.scriptBytes / 1024),
    scriptBudgetKb: budget,
  };
  // Vai para o relatório HTML do Playwright (útil quando falha na CI).
  await test.info().attach(`lighthouse-${step}`, {
    body: JSON.stringify(summary, null, 2),
    contentType: 'application/json',
  });
  console.log('Lighthouse:', JSON.stringify(summary));

  expect(result.lcpMs, 'LCP (ms)').toBeLessThan(LCP_MAX_MS);
  expect(result.tbtMs, 'TBT (ms)').toBeLessThanOrEqual(TBT_MAX_MS);
  expect(result.cls, 'CLS').toBeLessThanOrEqual(CLS_MAX);
  // Em bytes, sem arredondar: 150,4 KB não pode passar num orçamento de 150.
  expect(result.scriptBytes, `JS transferido (orçamento ${String(budget)} KB)`).toBeLessThanOrEqual(
    budget * 1024,
  );
}

test('etapa 1 (serviços): LCP, TBT, CLS e orçamento de JS no mobile', async ({
  studio,
  baseURL,
}) => {
  test.setTimeout(180_000);
  const result = await measure(`${baseURL ?? ''}/${studio.slug}`, async (page) => {
    await expect(page.getByRole('heading', { name: 'Escolha o serviço' })).toBeVisible();
  });
  await check('etapa-1', result);
});

test('etapa 2 (calendário, fluxo interativo): LCP, TBT, CLS e orçamento de JS no mobile', async ({
  studio,
  baseURL,
}) => {
  test.setTimeout(180_000);
  const result = await measure(
    `${baseURL ?? ''}/${studio.slug}?service=${studio.serviceId}`,
    async (page) => {
      // Prova que o BookingFlow (carregado sob demanda) renderizou o calendário.
      await expect(page.getByRole('heading', { name: 'Escolha o dia' })).toBeVisible();
    },
  );
  await check('etapa-2', result);
});
