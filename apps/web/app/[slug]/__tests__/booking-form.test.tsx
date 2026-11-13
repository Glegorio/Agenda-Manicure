import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, type PublicClient } from '../../../lib/api/public-client';
import { loadHold, saveHold } from '../../../lib/hold-storage';
import { BookingFlow } from '../_components/BookingFlow';

const SP = 'America/Sao_Paulo';
const service = {
  id: '01a1d4c4-ae02-742d-811c-1a062bb4fa3f',
  name: 'Esmaltação em Gel',
  durationMin: 60,
  priceCents: 7000,
};
const TOKEN = 't'.repeat(43);
// Quinta 2026-11-12 09:00 em São Paulo; hold criado agora, expira em 5 min.
const NOW = new Date('2026-11-12T12:00:00Z');
const hold = {
  holdToken: TOKEN,
  expiresAt: '2026-11-12T12:05:00.000Z',
  startAt: '2026-11-13T13:15:00.000Z',
  endAt: '2026-11-13T14:15:00.000Z',
  serviceName: service.name,
  // Q-30: o snapshot do hold (7500) vale, não o preço do perfil (7000).
  priceCents: 7500,
  durationMin: 60,
  serviceId: service.id,
  serverOffsetMs: 0,
};
const booking = {
  appointmentId: '01a1d4c4-ae02-742d-811c-1a062bb4fa99',
  startAt: hold.startAt,
  endAt: hold.endAt,
  serviceName: service.name,
  priceCents: 7500,
  durationMin: 60,
  timezone: SP,
  businessName: 'Studio Ana',
};
const POLICY = 'Cancelamentos com até 24 horas de antecedência, sem custo.';

function fakeApi(overrides: Partial<PublicClient> = {}): PublicClient {
  return {
    availabilityDays: vi.fn().mockResolvedValue({ timezone: SP, days: ['2026-11-13'] }),
    availability: vi.fn().mockResolvedValue({ timezone: SP, slots: [hold.startAt] }),
    createHold: vi.fn().mockResolvedValue({ hold, serverDate: null }),
    releaseHold: vi.fn().mockResolvedValue(undefined),
    createBooking: vi.fn().mockResolvedValue(booking),
    ...overrides,
  };
}

function renderStep3(api: PublicClient, cancellationPolicy: string | null = POLICY) {
  saveHold('studio-ana', hold);
  return render(
    <BookingFlow
      slug="studio-ana"
      timezone={SP}
      service={service}
      initialDate="2026-11-13"
      initialSlot={hold.startAt}
      cancellationPolicy={cancellationPolicy}
      api={api}
      browserTimeZone={SP}
    />,
  );
}

const nameInput = () => screen.getByRole('textbox', { name: /Seu nome/ });
const phoneInput = () => screen.getByRole('textbox', { name: /WhatsApp/ });
const notesInput = () => screen.getByRole('textbox', { name: /Observações/ });
const confirm = () => screen.getByRole('button', { name: 'Confirmar agendamento' });

async function fillValid(user: ReturnType<typeof userEvent.setup>) {
  await user.type(nameInput(), 'Maria Souza');
  await user.type(phoneInput(), '11999998888');
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'], now: NOW });
  window.history.replaceState(null, '', '/studio-ana');
  sessionStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('BookingFlow — etapa 3 (formulário)', () => {
  it('Q-30: o resumo mostra o preço do hold, não o do perfil', () => {
    renderStep3(fakeApi());
    expect(screen.getByText(/R\$\s75,00/)).toBeInTheDocument();
  });

  it('RN-80: máscara BR na digitação', async () => {
    const user = userEvent.setup();
    renderStep3(fakeApi());
    await user.type(phoneInput(), '11999998888');
    expect(phoneInput()).toHaveValue('(11) 99999-8888');
  });

  it('RN-43 / RN-80: confirma enviando o telefone em E.164 e o token do hold', async () => {
    const user = userEvent.setup();
    const api = fakeApi();
    renderStep3(api);

    await fillValid(user);
    await user.click(confirm());

    expect(api.createBooking).toHaveBeenCalledWith('studio-ana', {
      holdToken: TOKEN,
      name: 'Maria Souza',
      phone: '+5511999998888',
    });
  });

  it('sucesso: mostra a confirmação e limpa o hold da sessão', async () => {
    const user = userEvent.setup();
    renderStep3(fakeApi());

    await fillValid(user);
    await user.click(confirm());

    expect(await screen.findByRole('heading', { name: /Agendamento confirmado/ })).toHaveFocus();
    expect(loadHold('studio-ana')).toBeNull();
    const whatsapp = screen.getByRole('link', { name: /Enviar confirmação pelo WhatsApp/ });
    expect(decodeURIComponent(whatsapp.getAttribute('href') ?? '')).toContain('Olá Maria Souza');
  });

  it('RN-80 / RN-81: nome curto e telefone inválido: erros anunciados, foco no primeiro, sem envio', async () => {
    const user = userEvent.setup();
    const api = fakeApi();
    renderStep3(api);

    await user.type(nameInput(), 'M');
    await user.type(phoneInput(), '1099999888');
    await user.click(confirm());

    expect(api.createBooking).not.toHaveBeenCalled();
    expect(nameInput()).toHaveAttribute('aria-invalid', 'true');
    expect(nameInput()).toHaveAccessibleDescription(/pelo menos 2 letras/);
    expect(phoneInput()).toHaveAttribute('aria-invalid', 'true');
    expect(phoneInput()).toHaveAccessibleDescription(/WhatsApp válido com DDD/);
    expect(nameInput()).toHaveFocus();
  });

  it('observações: contador até 500 caracteres', async () => {
    const user = userEvent.setup();
    renderStep3(fakeApi());
    await user.type(notesInput(), 'Prefiro tons nude');
    expect(screen.getByText('17/500')).toBeInTheDocument();
    expect(notesInput()).toHaveAttribute('maxLength', '500');
  });

  it('Q-34: sem observações não pede consentimento', async () => {
    const user = userEvent.setup();
    const api = fakeApi();
    renderStep3(api);

    expect(screen.queryByRole('checkbox')).toBeNull();
    await fillValid(user);
    await user.click(confirm());

    expect(api.createBooking).toHaveBeenCalled();
  });

  it('Q-34: com observações exige o consentimento antes de enviar', async () => {
    const user = userEvent.setup();
    const api = fakeApi();
    renderStep3(api);

    await fillValid(user);
    await user.type(notesInput(), 'Tenho alergia a acrílico');
    await user.click(confirm());

    expect(api.createBooking).not.toHaveBeenCalled();
    const consent = screen.getByRole('checkbox', { name: /Autorizo/ });
    expect(consent).toHaveAttribute('aria-invalid', 'true');
    expect(consent).toHaveFocus();

    await user.click(consent);
    await user.click(confirm());

    expect(api.createBooking).toHaveBeenCalledWith(
      'studio-ana',
      expect.objectContaining({ notes: 'Tenho alergia a acrílico' }),
    );
  });

  it('Q-34: orienta sobre dados de saúde nas observações', () => {
    renderStep3(fakeApi());
    expect(notesInput()).toHaveAccessibleDescription(/saúde/);
  });

  it('RN-92 / Q-35: política de cancelamento aparece antes do botão de confirmar', () => {
    renderStep3(fakeApi());
    const policy = screen.getByText(POLICY);
    expect(
      policy.compareDocumentPosition(confirm()) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('Q-35: sem política cadastrada a seção não aparece', () => {
    renderStep3(fakeApi(), null);
    expect(screen.queryByRole('heading', { name: 'Política de cancelamento' })).toBeNull();
  });

  it('Q-33: link para a política de privacidade', () => {
    renderStep3(fakeApi());
    expect(screen.getByRole('link', { name: /política de privacidade/i })).toHaveAttribute(
      'href',
      '/privacidade',
    );
  });

  it('RN-44: 410 na confirmação volta à etapa 2 com aviso e mantém nome e telefone', async () => {
    const user = userEvent.setup();
    const api = fakeApi({
      createBooking: vi.fn().mockRejectedValue(new ApiError(410, 'HOLD_EXPIRED', 'Expirou.')),
    });
    renderStep3(api);

    await fillValid(user);
    await user.click(confirm());

    expect(await screen.findByRole('alert')).toHaveTextContent(/tempo para confirmar acabou/);
    expect(screen.getByRole('heading', { name: 'Escolha o dia' })).toBeInTheDocument();
    expect(loadHold('studio-ana')).toBeNull();

    // Novo hold: o formulário volta preenchido.
    await user.click(await screen.findByRole('button', { name: /10:15$/ }));
    await user.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(await screen.findByRole('textbox', { name: /Seu nome/ })).toHaveValue('Maria Souza');
    expect(phoneInput()).toHaveValue('(11) 99999-8888');
  });

  it('RN-42: 409 na confirmação volta à etapa 2 com aviso de horário tomado', async () => {
    const user = userEvent.setup();
    const api = fakeApi({
      createBooking: vi.fn().mockRejectedValue(new ApiError(409, 'SLOT_UNAVAILABLE', 'Tomado.')),
    });
    renderStep3(api);

    await fillValid(user);
    await user.click(confirm());

    expect(await screen.findByRole('alert')).toHaveTextContent(/acabou de ser reservado/);
  });
});

describe('BookingFlow — contador do hold', () => {
  it('RN-44: mostra o tempo restante e volta à etapa 2 quando zera', () => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'], now: NOW });
    renderStep3(fakeApi());

    // 5:00 − 2 s de margem.
    expect(screen.getByRole('timer')).toHaveTextContent('4:58');

    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(screen.getByRole('timer')).toHaveTextContent('3:58');

    act(() => {
      vi.advanceTimersByTime(4 * 60_000);
    });
    expect(screen.getByRole('alert')).toHaveTextContent(/tempo para confirmar acabou/);
    expect(loadHold('studio-ana')).toBeNull();
  });

  it('avisa por leitor de tela só no último minuto (sem anunciar a cada segundo)', () => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'], now: NOW });
    renderStep3(fakeApi());
    expect(screen.getByRole('timer')).toHaveAttribute('aria-live', 'off');
    act(() => {
      vi.advanceTimersByTime(4 * 60_000);
    });
    expect(screen.getByText(/Falta menos de 1 minuto/)).toHaveAttribute('role', 'status');
  });
});

describe('BookingFlow — corrida no envio', () => {
  it('não envia duas vezes com clique duplo', async () => {
    const user = userEvent.setup();
    let resolve: (v: typeof booking) => void = () => undefined;
    const createBooking = vi.fn(
      () =>
        new Promise<typeof booking>((r) => {
          resolve = r;
        }),
    );
    renderStep3(fakeApi({ createBooking }));

    await fillValid(user);
    const form = confirm().closest('form');
    if (!form) throw new Error('formulário não encontrado');
    // Dois submits seguidos, sem esperar o React desabilitar o botão.
    fireEvent.submit(form);
    fireEvent.submit(form);
    await act(async () => {
      resolve(booking);
      await Promise.resolve();
    });

    expect(createBooking).toHaveBeenCalledTimes(1);
  });
});

describe('BookingFlow — etapa 3, casos de borda', () => {
  it('Q-34: apagar as observações desmarca o consentimento', async () => {
    const user = userEvent.setup();
    renderStep3(fakeApi());

    await user.type(notesInput(), 'Alergia a acrílico');
    await user.click(screen.getByRole('checkbox', { name: /Autorizo/ }));
    await user.clear(notesInput());
    await user.type(notesInput(), 'Outra observação');

    expect(screen.getByRole('checkbox', { name: /Autorizo/ })).not.toBeChecked();
  });

  it('corrigir o campo tira o erro dele', async () => {
    const user = userEvent.setup();
    renderStep3(fakeApi());

    await user.click(confirm());
    expect(nameInput()).toHaveAttribute('aria-invalid', 'true');
    await user.type(nameInput(), 'Maria');

    expect(nameInput()).not.toHaveAttribute('aria-invalid');
  });

  it('campos obrigatórios marcados', () => {
    renderStep3(fakeApi());
    expect(nameInput()).toBeRequired();
    expect(phoneInput()).toBeRequired();
    expect(notesInput()).not.toBeRequired();
  });

  it('erro de rede na confirmação mostra aviso e mantém a etapa 3', async () => {
    const user = userEvent.setup();
    renderStep3(fakeApi({ createBooking: vi.fn().mockRejectedValue(new TypeError('Failed')) }));

    await fillValid(user);
    await user.click(confirm());

    await waitFor(() => {
      expect(
        screen.getAllByRole('alert').some((a) => /Verifique a conexão/.test(a.textContent)),
      ).toBe(true);
    });
    expect(screen.getByRole('heading', { name: 'Seus dados' })).toBeInTheDocument();
  });

  it('RN-44: tempo acaba durante um envio que falha → volta à etapa 2', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'], now: NOW });
    let reject: (e: unknown) => void = () => undefined;
    const createBooking = vi.fn(
      () =>
        new Promise<typeof booking>((_, r) => {
          reject = r;
        }),
    );
    renderStep3(fakeApi({ createBooking }));
    fireEvent.change(nameInput(), { target: { value: 'Maria Souza' } });
    fireEvent.change(phoneInput(), { target: { value: '11999998888' } });
    fireEvent.click(confirm());

    act(() => {
      vi.advanceTimersByTime(5 * 60_000);
    });
    await act(async () => {
      reject(new TypeError('Failed'));
      await Promise.resolve();
    });

    expect(screen.getByRole('heading', { name: 'Escolha o dia' })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(/tempo para confirmar acabou/);
  });

  it('RN-44: hold perdido põe o foco no aviso da etapa 2', async () => {
    const user = userEvent.setup();
    renderStep3(
      fakeApi({ createBooking: vi.fn().mockRejectedValue(new ApiError(410, 'HOLD_EXPIRED', 'x')) }),
    );

    await fillValid(user);
    await user.click(confirm());

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveFocus();
    });
  });

  it('usa o relógio do servidor: celular 3 min adiantado ainda mostra ~5 min', () => {
    saveHold('studio-ana', { ...hold, serverOffsetMs: -3 * 60_000 });
    vi.setSystemTime(new Date('2026-11-12T12:03:00Z'));
    render(
      <BookingFlow
        slug="studio-ana"
        timezone={SP}
        service={service}
        initialDate="2026-11-13"
        initialSlot={hold.startAt}
        api={fakeApi()}
        browserTimeZone={SP}
      />,
    );
    expect(screen.getByRole('timer')).toHaveTextContent('4:58');
  });
});

describe('BookingFlow — 3.7 (reenvio)', () => {
  it('Q-41: depois de um erro de rede, reenviar confirma (a API devolve a mesma reserva)', async () => {
    const user = userEvent.setup();
    const createBooking = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValue(booking);
    renderStep3(fakeApi({ createBooking }));

    await fillValid(user);
    await user.click(confirm());
    await waitFor(() => {
      expect(
        screen.getAllByRole('alert').some((a) => /Verifique a conexão/.test(a.textContent)),
      ).toBe(true);
    });
    await user.click(confirm());

    expect(
      await screen.findByRole('heading', { name: /Agendamento confirmado/ }),
    ).toBeInTheDocument();
    expect(createBooking).toHaveBeenCalledTimes(2);
    expect(createBooking.mock.calls[1]?.[1]).toEqual(createBooking.mock.calls[0]?.[1]);
  });
});
