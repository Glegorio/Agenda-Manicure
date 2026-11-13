import { API_URL } from './env';
import {
  chooseServiceAndFirstDay,
  expect,
  expireHolds,
  fillCustomer,
  firstSlotOf,
  test,
} from './fixtures';

test.describe('reserva pela página pública (3.9)', () => {
  test('fluxo feliz: serviço → dia → horário → dados → confirmado', async ({ page, studio }) => {
    await chooseServiceAndFirstDay(page, studio);

    const slot = page
      .getByRole('group', { name: /^Horários disponíveis em/ })
      .getByRole('button')
      .first();
    await slot.click();
    await expect(slot).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: 'Continuar' }).click();

    // Etapa 3: contador, política antes do CTA (RN-92) e token fora da URL (RN-40).
    await expect(
      page.getByRole('heading', { name: 'Horário reservado por 5 minutos' }),
    ).toBeVisible();
    await expect(page.getByRole('timer')).toContainText(/^Confirme em até [45]:\d\d$/);
    await expect(page.getByText(studio.policy)).toBeVisible();
    expect(new URL(page.url()).searchParams.get('slot')).toMatch(/Z$/);
    expect(page.url()).not.toMatch(/holdToken|token=/);

    await fillCustomer(page);
    await page.getByRole('button', { name: 'Confirmar agendamento' }).click();

    await expect(page.getByRole('heading', { name: /Agendamento confirmado/ })).toBeFocused();
    await expect(page.getByText(studio.serviceName)).toBeVisible();
    await expect(
      page.getByRole('link', { name: /Enviar confirmação pelo WhatsApp/ }),
    ).toHaveAttribute('href', /^https:\/\/wa\.me\/\?text=/);
  });

  test('RN-41: horário tomado por outra pessoa → 409, aviso e grade recarregada', async ({
    page,
    request,
    studio,
  }) => {
    const date = await chooseServiceAndFirstDay(page, studio);
    const first = page
      .getByRole('group', { name: /^Horários disponíveis em/ })
      .getByRole('button')
      .first();
    const takenLabel = (await first.getAttribute('aria-label')) ?? '';
    await first.click();

    // Outra cliente segura o mesmo horário enquanto esta ainda está na etapa 2.
    const startAt = await firstSlotOf(request, studio, date);
    const other = await request.post(`${API_URL}/public/${studio.slug}/holds`, {
      data: { serviceId: studio.serviceId, startAt },
    });
    expect(other.status()).toBe(201);

    await page.getByRole('button', { name: 'Continuar' }).click();

    // O Next também tem um anunciador de rota com role=alert: filtra pelo texto.
    const alert = page.getByRole('alert').filter({ hasText: 'acabou de ser reservado' });
    await expect(alert).toBeVisible();
    await expect(alert).toBeFocused();
    await expect(page.getByRole('heading', { name: 'Escolha o dia' })).toBeVisible();
    // A grade recarregada (na tela) não oferece mais o horário tomado e nada fica selecionado.
    const grid = page.getByRole('group', { name: /^Horários disponíveis em/ });
    await expect(grid.getByRole('button', { name: takenLabel })).toHaveCount(0);
    await expect(grid.getByRole('button', { pressed: true })).toHaveCount(0);
  });

  test('RN-44: hold expirado na confirmação → 410, volta à etapa 2 mantendo os dados', async ({
    page,
    studio,
  }) => {
    await chooseServiceAndFirstDay(page, studio);
    await page
      .getByRole('group', { name: /^Horários disponíveis em/ })
      .getByRole('button')
      .first()
      .click();
    await page.getByRole('button', { name: 'Continuar' }).click();
    await expect(
      page.getByRole('heading', { name: 'Horário reservado por 5 minutos' }),
    ).toBeVisible();
    await fillCustomer(page);

    await expireHolds(studio.slug);
    await page.getByRole('button', { name: 'Confirmar agendamento' }).click();

    await expect(
      page.getByRole('alert').filter({ hasText: 'tempo para confirmar acabou' }),
    ).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Escolha o dia' })).toBeVisible();

    // Novo horário: nome e telefone continuam preenchidos.
    await page
      .getByRole('group', { name: /^Horários disponíveis em/ })
      .getByRole('button')
      .first()
      .click();
    await page.getByRole('button', { name: 'Continuar' }).click();
    await expect(page.getByRole('textbox', { name: 'Seu nome' })).toHaveValue('Maria Souza');
    await expect(page.getByRole('textbox', { name: /WhatsApp/ })).toHaveValue('(11) 99999-8888');
  });
});
