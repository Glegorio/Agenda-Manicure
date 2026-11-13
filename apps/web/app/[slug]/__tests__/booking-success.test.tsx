import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BookingSuccess } from '../_components/BookingSuccess';

const booking = {
  appointmentId: '01a1d4c4-ae02-742d-811c-1a062bb4fa99',
  startAt: '2026-11-13T13:15:00.000Z',
  endAt: '2026-11-13T14:15:00.000Z',
  serviceName: 'Esmaltação em Gel',
  priceCents: 7500,
  durationMin: 60,
  timezone: 'America/Sao_Paulo',
  businessName: 'Studio Ana',
};
const LOCATION = 'Rua das Flores, 10 · São Paulo – SP';

const renderSuccess = (location: string | null = LOCATION) =>
  render(
    <BookingSuccess slug="studio-ana" booking={booking} clientName="Maria" location={location} />,
  );

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-11-12T12:00:00Z') });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('BookingSuccess (3.6)', () => {
  it('título recebe o foco e o resumo vem da resposta da reserva', () => {
    renderSuccess();
    expect(screen.getByRole('heading', { name: 'Agendamento confirmado!' })).toHaveFocus();
    expect(screen.getByText('Esmaltação em Gel')).toBeInTheDocument();
    expect(screen.getByText('sexta-feira, 13 de novembro, 10:15')).toBeInTheDocument();
    expect(screen.queryByText(/Horário Padrão/)).toBeNull();
    expect(screen.getByText(/R\$\s75,00/)).toBeInTheDocument();
    expect(screen.getByText('Studio Ana')).toBeInTheDocument();
    expect(screen.getByText(LOCATION)).toBeInTheDocument();
  });

  it('Q-27: sem endereço publicado não mostra a linha de local', () => {
    renderSuccess(null);
    expect(screen.queryByText('Onde')).toBeNull();
  });

  it('Q-32: botão do WhatsApp abre wa.me sem número com a confirmação', () => {
    renderSuccess();
    const link = screen.getByRole('link', { name: /Enviar confirmação pelo WhatsApp/ });
    const href = link.getAttribute('href') ?? '';
    expect(href.startsWith('https://wa.me/?text=')).toBe(true);
    expect(decodeURIComponent(href)).toContain('Olá Maria, seu agendamento foi confirmado!');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
  });

  it('"Adicionar ao calendário" baixa o .ics do agendamento', async () => {
    const user = userEvent.setup();
    const createObjectURL = vi.fn<(blob: Blob) => string>(() => 'blob:agendamento');
    const revokeObjectURL = vi.fn();
    Object.assign(URL, { createObjectURL, revokeObjectURL });
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);

    renderSuccess();
    await user.click(screen.getByRole('button', { name: 'Adicionar ao calendário' }));

    const blob = createObjectURL.mock.calls[0]?.[0];
    expect(blob?.type).toBe('text/calendar;charset=utf-8');
    expect(await blob?.text()).toContain('DTSTART:20261113T131500Z');
    const anchor = click.mock.contexts[0] as HTMLAnchorElement;
    expect(anchor.download).toBe('agendamento.ics');
    expect(screen.getByRole('status')).toHaveTextContent(/agendamento.ics baixado/);
    // A URL é revogada 1 s depois do clique (download no celular).
    await vi.waitFor(
      () => {
        expect(revokeObjectURL).toHaveBeenCalledWith('blob:agendamento');
      },
      { timeout: 3000 },
    );
  });

  it('avisa que o WhatsApp abre em nova aba', () => {
    renderSuccess();
    expect(screen.getByRole('link', { name: /abre em nova aba/ })).toBeInTheDocument();
  });

  it('RN-02a: navegador em outro fuso mostra o fuso da profissional', () => {
    render(
      <BookingSuccess
        slug="studio-ana"
        booking={booking}
        clientName="Maria"
        location={null}
        showTimezone
      />,
    );
    expect(
      screen.getByText('sexta-feira, 13 de novembro, 10:15 (Horário Padrão de Brasília)'),
    ).toBeInTheDocument();
  });

  it('permite agendar outro horário', () => {
    renderSuccess();
    expect(screen.getByRole('link', { name: 'Agendar outro horário' })).toHaveAttribute(
      'href',
      '/studio-ana',
    );
  });
});
