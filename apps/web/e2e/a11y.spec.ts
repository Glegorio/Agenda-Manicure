import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { chooseServiceAndFirstDay, expect, fillCustomer, test } from './fixtures';

/** WCAG 2.1 AA (doc 07): zero violações nas 3 etapas e no sucesso, nos dois temas. */
async function expectNoViolations(page: Page, step: string) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  const summary = violations.map(
    (v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`,
  );
  expect(summary, `violações de acessibilidade em ${step}`).toEqual([]);
}

for (const colorScheme of ['light', 'dark'] as const) {
  test(`axe sem violações nas etapas 1, 2, 3 e no sucesso (${colorScheme})`, async ({
    page,
    studio,
  }) => {
    await page.emulateMedia({ colorScheme });

    await page.goto(`/${studio.slug}`);
    await expect(page.getByRole('heading', { name: 'Escolha o serviço' })).toBeVisible();
    await expectNoViolations(page, 'etapa 1');

    await chooseServiceAndFirstDay(page, studio);
    const slot = page
      .getByRole('group', { name: /^Horários disponíveis em/ })
      .getByRole('button')
      .first();
    await slot.click();
    await expectNoViolations(page, 'etapa 2');

    await page.getByRole('button', { name: 'Continuar' }).click();
    await expect(page.getByRole('heading', { name: 'Seus dados' })).toBeVisible();
    await page.getByRole('textbox', { name: /Observações/ }).fill('Prefiro tons nude');
    await expectNoViolations(page, 'etapa 3');

    await fillCustomer(page);
    await page.getByRole('checkbox', { name: /Autorizo/ }).check();
    await page.getByRole('button', { name: 'Confirmar agendamento' }).click();
    await expect(page.getByRole('heading', { name: /Agendamento confirmado/ })).toBeVisible();
    await expectNoViolations(page, 'sucesso');
  });
}
