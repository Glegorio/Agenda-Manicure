import { randomUUID } from 'node:crypto';
import { test as base, expect, type APIRequestContext, type Page } from '@playwright/test';
import pg from 'pg';
import { API_URL, DATABASE_URL } from './env';

export interface Studio {
  slug: string;
  businessName: string;
  serviceId: string;
  serviceName: string;
  policy: string;
}

/**
 * Cria uma profissional completa **pela API** (sem acoplar ao Prisma): conta com slug aleatório,
 * política de cancelamento, escala 06–22 todos os dias e um serviço público.
 */
async function createStudio(request: APIRequestContext): Promise<Studio> {
  const id = randomUUID().slice(0, 8);
  const slug = `e2e-${id}`;
  const businessName = `Studio ${id}`;
  const policy = 'Cancelamentos com até 24 horas de antecedência, sem custo.';

  const register = await request.post(`${API_URL}/auth/register`, {
    data: { email: `${slug}@exemplo.com.br`, password: 'senha-forte-123', businessName, slug },
  });
  expect(register.status()).toBe(201);
  const { accessToken } = (await register.json()) as { accessToken: string };
  const headers = { authorization: `Bearer ${accessToken}` };

  const me = await request.patch(`${API_URL}/me`, {
    headers,
    data: { cancellationPolicy: policy, city: 'São Paulo', state: 'SP' },
  });
  expect(me.status()).toBe(200);

  const weekly = await request.put(`${API_URL}/schedule/weekly`, {
    headers,
    data: {
      windows: [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, start: '06:00', end: '22:00' })),
    },
  });
  expect(weekly.status()).toBe(200);

  const serviceName = 'Esmaltação em Gel';
  const service = await request.post(`${API_URL}/services`, {
    headers,
    data: {
      name: serviceName,
      category: 'Mãos',
      priceCents: 7500,
      durationMin: 60,
      active: true,
      public: true,
    },
  });
  expect(service.status()).toBe(201);
  const { id: serviceId } = (await service.json()) as { id: string };

  return { slug, businessName, serviceId, serviceName, policy };
}

/** RN-44: força o hold da profissional a expirar (o relógio da API é o real). */
export async function expireHolds(slug: string): Promise<void> {
  const client = new pg.Client({ connectionString: DATABASE_URL });
  await client.connect();
  try {
    await client.query(
      `UPDATE slot_holds SET expires_at = now() - interval '1 second'
        WHERE professional_id = (SELECT id FROM professionals WHERE slug = $1)`,
      [slug],
    );
  } finally {
    await client.end();
  }
}

/**
 * Etapa 1 → 2: escolhe o serviço e um dia com vaga **depois de hoje** (avança o mês se preciso).
 * Hoje é evitado de propósito: com antecedência de 2 h e grade de 15 min, o primeiro horário de hoje
 * pode deixar de existir em segundos (Q-28) e tornar o teste instável.
 */
export async function chooseServiceAndFirstDay(page: Page, studio: Studio): Promise<string> {
  await page.goto(`/${studio.slug}`);
  await page.getByRole('link', { name: new RegExp(studio.serviceName) }).click();
  await expect(page.getByRole('heading', { name: 'Escolha o dia' })).toBeVisible();

  const calendar = page.getByRole('group', { name: /de \d{4}$/ });
  const days = calendar.getByRole('button', { disabled: false });
  await expect(calendar).toHaveAttribute('aria-busy', 'false');
  if ((await days.count()) >= 2) {
    await days.nth(1).click();
  } else {
    await page.getByRole('button', { name: 'Próximo mês' }).click();
    await expect(calendar).toHaveAttribute('aria-busy', 'false');
    await days.first().click();
  }
  await expect(page.getByRole('group', { name: /^Horários disponíveis em/ })).toBeVisible();
  const date = new URL(page.url()).searchParams.get('date');
  expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  return date ?? '';
}

export async function firstSlotOf(
  request: APIRequestContext,
  studio: Studio,
  date: string,
): Promise<string> {
  const res = await request.get(
    `${API_URL}/public/${studio.slug}/availability?serviceId=${studio.serviceId}&date=${date}`,
  );
  const { slots } = (await res.json()) as { slots: string[] };
  const first = slots[0];
  if (!first) throw new Error(`Sem horários em ${date}`);
  return first;
}

export async function fillCustomer(page: Page): Promise<void> {
  await page.getByRole('textbox', { name: 'Seu nome' }).fill('Maria Souza');
  await page.getByRole('textbox', { name: /WhatsApp/ }).fill('11999998888');
}

export const test = base.extend<{ studio: Studio }>({
  // `provide` é o `use` do Playwright (renomeado: o lint o confunde com o hook do React).
  studio: async ({ request }, provide) => {
    await provide(await createStudio(request));
  },
});

export { expect };
