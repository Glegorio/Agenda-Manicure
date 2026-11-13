import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, type PublicClient } from '../../../lib/api/public-client';
import { loadHold, saveHold } from '../../../lib/hold-storage';
import { BookingFlow } from '../_components/BookingFlow';

const replace = vi.spyOn(window.history, 'replaceState');
const push = vi.spyOn(window.history, 'pushState');

const SP = 'America/Sao_Paulo';
const service = {
  id: '01a1d4c4-ae02-742d-811c-1a062bb4fa3f',
  name: 'Esmaltação em Gel',
  durationMin: 60,
  priceCents: 7000,
};
const TOKEN = 't'.repeat(43);
const holdResponse = {
  holdToken: TOKEN,
  expiresAt: '2026-11-13T12:05:00.000Z',
  startAt: '2026-11-13T13:15:00.000Z',
  endAt: '2026-11-13T14:15:00.000Z',
  serviceName: service.name,
  priceCents: 7000,
  durationMin: 60,
};

function fakeApi(overrides: Partial<PublicClient> = {}): PublicClient {
  return {
    availabilityDays: vi
      .fn()
      .mockResolvedValue({ timezone: SP, days: ['2026-11-13', '2026-11-16'] }),
    availability: vi.fn().mockResolvedValue({
      timezone: SP,
      slots: ['2026-11-13T13:00:00.000Z', '2026-11-13T13:15:00.000Z'],
    }),
    createHold: vi
      .fn()
      .mockResolvedValue({ hold: holdResponse, serverDate: new Date('2026-11-13T12:00:00Z') }),
    releaseHold: vi.fn().mockResolvedValue(undefined),
    createBooking: vi.fn(),
    ...overrides,
  };
}

const renderFlow = (api: PublicClient, props: Partial<Parameters<typeof BookingFlow>[0]> = {}) =>
  render(<BookingFlow slug="studio-ana" timezone={SP} service={service} api={api} {...props} />);

beforeEach(() => {
  window.history.replaceState(null, '', '/studio-ana');
  // Quinta 2026-11-12 09:00 em São Paulo.
  vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-11-12T12:00:00Z') });
  sessionStorage.clear();
  replace.mockClear();
  push.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('BookingFlow — etapa 2', () => {
  it('pede os dias com vaga do mês, a partir de hoje no fuso da profissional', async () => {
    const api = fakeApi();
    renderFlow(api);
    await screen.findByRole('button', { name: /sexta-feira, 13 de novembro/ });
    expect(api.availabilityDays).toHaveBeenCalledWith(
      'studio-ana',
      service.id,
      '2026-11-12',
      '2026-11-30',
    );
  });

  it('só os dias com vaga ficam habilitados', async () => {
    renderFlow(fakeApi());
    expect(
      await screen.findByRole('button', { name: /sexta-feira, 13 de novembro/ }),
    ).toBeEnabled();
    expect(screen.getByRole('button', { name: /sábado, 14 de novembro/ })).toBeDisabled();
  });

  it('escolher o dia grava a data na URL e carrega os horários com rótulo completo', async () => {
    const user = userEvent.setup();
    const api = fakeApi();
    renderFlow(api);

    await user.click(await screen.findByRole('button', { name: /sexta-feira, 13 de novembro/ }));

    expect(replace).toHaveBeenCalledWith(
      null,
      '',
      `/studio-ana?service=${service.id}&date=2026-11-13`,
    );
    expect(api.availability).toHaveBeenCalledWith('studio-ana', service.id, '2026-11-13');
    const slots = await screen.findByRole('group', {
      name: 'Horários disponíveis em sexta-feira, 13 de novembro',
    });
    expect(
      within(slots).getByRole('button', { name: 'sexta-feira, 13 de novembro, 10:15' }),
    ).toHaveTextContent('10:15');
  });

  it('data inicial vinda da URL já carrega os horários', async () => {
    const api = fakeApi();
    renderFlow(api, { initialDate: '2026-11-13' });
    await screen.findByRole('button', { name: 'sexta-feira, 13 de novembro, 10:00' });
    expect(api.availability).toHaveBeenCalledWith('studio-ana', service.id, '2026-11-13');
  });

  it('RN-40: avançar cria o hold com o startAt exato da grade; token só na sessionStorage', async () => {
    const user = userEvent.setup();
    const api = fakeApi();
    renderFlow(api, { initialDate: '2026-11-13' });

    const continuar = screen.getByRole('button', { name: 'Continuar' });
    expect(continuar).toBeDisabled();
    await user.click(await screen.findByRole('button', { name: /10:15$/ }));
    expect(screen.getByRole('button', { name: /10:15$/ })).toHaveAttribute('aria-pressed', 'true');
    await user.click(continuar);

    expect(api.createHold).toHaveBeenCalledWith(
      'studio-ana',
      service.id,
      '2026-11-13T13:15:00.000Z',
    );
    await waitFor(() => {
      expect(push).toHaveBeenCalled();
    });
    const url = String(push.mock.calls[0]?.[2]);
    expect(url).toContain('slot=2026-11-13T13%3A15%3A00.000Z');
    expect(url).not.toContain(TOKEN);
    expect(loadHold('studio-ana')).toMatchObject({
      holdToken: TOKEN,
      serviceName: service.name,
      priceCents: 7000,
    });
  });

  it('trocar de horário libera o hold anterior', async () => {
    const user = userEvent.setup();
    const api = fakeApi();
    saveHold('studio-ana', {
      ...holdResponse,
      holdToken: 'v'.repeat(43),
      serviceId: service.id,
      serverOffsetMs: 0,
    });
    renderFlow(api, { initialDate: '2026-11-13' });

    await user.click(await screen.findByRole('button', { name: /10:15$/ }));
    await user.click(screen.getByRole('button', { name: 'Continuar' }));

    await waitFor(() => {
      expect(api.releaseHold).toHaveBeenCalledWith('studio-ana', 'v'.repeat(43));
    });
  });

  it('RN-41: 409 avisa, recarrega a grade e não avança', async () => {
    const user = userEvent.setup();
    const api = fakeApi({
      createHold: vi.fn().mockRejectedValue(new ApiError(409, 'SLOT_UNAVAILABLE', 'Indisponível.')),
    });
    renderFlow(api, { initialDate: '2026-11-13' });

    await user.click(await screen.findByRole('button', { name: /10:15$/ }));
    await user.click(screen.getByRole('button', { name: 'Continuar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/acabou de ser reservado/);
    expect(api.availability).toHaveBeenCalledTimes(2);
    expect(push).not.toHaveBeenCalled();
  });

  it('RN-02a: mostra o fuso quando difere do navegador', async () => {
    renderFlow(fakeApi(), { browserTimeZone: 'America/New_York' });
    expect(await screen.findByTestId('timezone-notice')).toHaveTextContent(
      'Horários no fuso da profissional: Horário Padrão de Brasília (America/Sao_Paulo).',
    );
  });

  it('RN-02a: não mostra o fuso quando é o mesmo do navegador', async () => {
    renderFlow(fakeApi(), { browserTimeZone: SP });
    await screen.findByRole('button', { name: /sexta-feira, 13 de novembro/ });
    expect(screen.queryByTestId('timezone-notice')).toBeNull();
  });

  it('dia sem horários (tomados entre a lista de dias e o clique) avisa', async () => {
    const api = fakeApi({ availability: vi.fn().mockResolvedValue({ timezone: SP, slots: [] }) });
    renderFlow(api, { initialDate: '2026-11-13' });
    expect(await screen.findByText(/Não há mais horários neste dia/)).toBeInTheDocument();
  });
});

describe('BookingFlow — robustez e acessibilidade', () => {
  it('RN-40: depois do hold mostra o resumo com o snapshot e põe o foco no título', async () => {
    const user = userEvent.setup();
    renderFlow(fakeApi(), { initialDate: '2026-11-13' });

    await user.click(await screen.findByRole('button', { name: /10:15$/ }));
    await user.click(screen.getByRole('button', { name: 'Continuar' }));

    const title = await screen.findByRole('heading', { name: 'Horário reservado por 5 minutos' });
    expect(title).toHaveFocus();
    expect(screen.getByText('sexta-feira, 13 de novembro, 10:15')).toBeInTheDocument();
    expect(screen.getByText(/R\$\s70,00/)).toBeInTheDocument();
  });

  it('URL com slot e hold válido na sessão abre o resumo', () => {
    saveHold('studio-ana', { ...holdResponse, serviceId: service.id, serverOffsetMs: 0 });
    renderFlow(fakeApi(), { initialDate: '2026-11-13', initialSlot: holdResponse.startAt });
    expect(
      screen.getByRole('heading', { name: 'Horário reservado por 5 minutos' }),
    ).toBeInTheDocument();
  });

  it('RN-44: hold expirado na sessão não abre o resumo', () => {
    saveHold('studio-ana', {
      ...holdResponse,
      expiresAt: '2026-11-12T11:59:00.000Z',
      serviceId: service.id,
      serverOffsetMs: 0,
    });
    renderFlow(fakeApi(), { initialDate: '2026-11-13', initialSlot: holdResponse.startAt });
    expect(screen.queryByRole('heading', { name: 'Horário reservado por 5 minutos' })).toBeNull();
  });

  it('"Escolher outro horário" libera o hold e volta à escolha do dia com foco', async () => {
    const user = userEvent.setup();
    const api = fakeApi();
    saveHold('studio-ana', { ...holdResponse, serviceId: service.id, serverOffsetMs: 0 });
    renderFlow(api, { initialDate: '2026-11-13', initialSlot: holdResponse.startAt });

    await user.click(screen.getByRole('button', { name: 'Escolher outro horário' }));

    expect(api.releaseHold).toHaveBeenCalledWith('studio-ana', TOKEN);
    expect(loadHold('studio-ana')).toBeNull();
    expect(await screen.findByRole('heading', { name: 'Escolha o dia' })).toHaveFocus();
  });

  it('Voltar do navegador saindo da etapa 3 libera o hold e mostra a grade', async () => {
    const api = fakeApi();
    saveHold('studio-ana', { ...holdResponse, serviceId: service.id, serverOffsetMs: 0 });
    renderFlow(api, { initialDate: '2026-11-13', initialSlot: holdResponse.startAt });

    window.history.replaceState(null, '', `/studio-ana?service=${service.id}&date=2026-11-13`);
    window.dispatchEvent(new PopStateEvent('popstate'));

    expect(await screen.findByRole('heading', { name: 'Escolha o dia' })).toBeInTheDocument();
    expect(api.releaseHold).toHaveBeenCalledWith('studio-ana', TOKEN);
  });

  it('libera o hold anterior antes de criar o novo (evita 409 contra o próprio hold)', async () => {
    const user = userEvent.setup();
    const order: string[] = [];
    const api = fakeApi({
      releaseHold: vi.fn(() => {
        order.push('release');
        return Promise.resolve();
      }),
      createHold: vi.fn(() => {
        order.push('create');
        return Promise.resolve({ hold: holdResponse, serverDate: null });
      }),
    });
    saveHold('studio-ana', {
      ...holdResponse,
      holdToken: 'v'.repeat(43),
      serviceId: service.id,
      serverOffsetMs: 0,
    });
    renderFlow(api, { initialDate: '2026-11-13' });

    await user.click(await screen.findByRole('button', { name: /10:15$/ }));
    await user.click(screen.getByRole('button', { name: 'Continuar' }));

    await waitFor(() => {
      expect(order).toEqual(['release', 'create']);
    });
  });

  it('RN-41: no 409 o foco vai para o aviso', async () => {
    const user = userEvent.setup();
    const api = fakeApi({
      createHold: vi.fn().mockRejectedValue(new ApiError(409, 'SLOT_UNAVAILABLE', 'Indisponível.')),
    });
    renderFlow(api, { initialDate: '2026-11-13' });

    await user.click(await screen.findByRole('button', { name: /10:15$/ }));
    await user.click(screen.getByRole('button', { name: 'Continuar' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveFocus();
    });
  });

  it('falha de rede no hold mostra mensagem genérica sem avançar', async () => {
    const user = userEvent.setup();
    const api = fakeApi({
      createHold: vi.fn().mockRejectedValue(new TypeError('Failed to fetch')),
    });
    renderFlow(api, { initialDate: '2026-11-13' });

    await user.click(await screen.findByRole('button', { name: /10:15$/ }));
    await user.click(screen.getByRole('button', { name: 'Continuar' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/Verifique a conexão/);
    });
    expect(push).not.toHaveBeenCalled();
  });

  it('falha ao carregar horários oferece "Tentar de novo" e recarrega', async () => {
    const user = userEvent.setup();
    const availability = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValue({ timezone: SP, slots: ['2026-11-13T13:00:00.000Z'] });
    renderFlow(fakeApi({ availability }), { initialDate: '2026-11-13' });

    await user.click(await screen.findByRole('button', { name: 'Tentar de novo' }));

    expect(await screen.findByRole('button', { name: /10:00$/ })).toBeInTheDocument();
    expect(availability).toHaveBeenCalledTimes(2);
  });

  it('falha ao carregar os dias oferece "Tentar de novo"', async () => {
    const user = userEvent.setup();
    const availabilityDays = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValue({ timezone: SP, days: ['2026-11-13'] });
    renderFlow(fakeApi({ availabilityDays }));

    await user.click(await screen.findByRole('button', { name: 'Tentar de novo' }));

    expect(
      await screen.findByRole('button', { name: 'sexta-feira, 13 de novembro' }),
    ).toBeEnabled();
  });

  it('data da URL no passado é ignorada', async () => {
    const api = fakeApi();
    renderFlow(api, { initialDate: '2026-10-01' });
    await screen.findByRole('button', { name: 'sexta-feira, 13 de novembro' });
    expect(api.availability).not.toHaveBeenCalled();
    expect(api.availabilityDays).toHaveBeenCalledWith(
      'studio-ana',
      service.id,
      '2026-11-12',
      '2026-11-30',
    );
  });

  it('resposta antiga de horários não sobrescreve a do dia escolhido depois', async () => {
    const user = userEvent.setup();
    let resolveFirst: (v: { timezone: string; slots: string[] }) => void = () => undefined;
    const availability = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirst = resolve;
          }),
      )
      .mockResolvedValue({ timezone: SP, slots: ['2026-11-16T12:00:00.000Z'] });
    renderFlow(fakeApi({ availability }), { initialDate: '2026-11-13' });

    await user.click(await screen.findByRole('button', { name: 'segunda-feira, 16 de novembro' }));
    await screen.findByRole('button', { name: /16 de novembro, 09:00$/ });
    resolveFirst({ timezone: SP, slots: ['2026-11-13T13:00:00.000Z'] });

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /13 de novembro, 10:00$/ })).toBeNull();
    });
  });

  it('dia sem vaga informa "sem horários" no rótulo', async () => {
    renderFlow(fakeApi());
    expect(
      await screen.findByRole('button', { name: 'sábado, 14 de novembro, sem horários' }),
    ).toBeDisabled();
  });
});
