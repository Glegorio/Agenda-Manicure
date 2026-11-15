import { fireEvent, screen } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';
import { createApiClient } from '../src/api/client';
import { createRootLayout } from '../src/app/RootLayout';
import { SESSION_KEY, SessionManager } from '../src/auth/session';
import TabsLayout from '../app/(tabs)/_layout';
import AgendaScreen from '../app/(tabs)/index';
import SettingsScreen from '../app/(tabs)/ajustes';
import ClientsScreen from '../app/(tabs)/clientes';
import ServicesScreen from '../app/(tabs)/servicos';
import LoginScreen from '../app/login';
import RegisterScreen from '../app/register';
import { BASE_URL, errorBody, json, memoryStorage, sessionResponse } from './helpers/fake-api';

jest.mock('expo-haptics', () => ({
  notificationAsync: jest.fn(),
  selectionAsync: jest.fn(),
  NotificationFeedbackType: { Error: 'error' },
}));

const profile = {
  ...sessionResponse(1).professional,
  timezone: 'America/Sao_Paulo',
  bufferMin: 10,
  slotStepMin: 15,
  minNoticeMin: 120,
  bookingHorizonDays: 30,
  addressLine: null,
  showFullAddress: false,
  city: null,
  state: null,
  zip: null,
  lat: null,
  lng: null,
  logoUrl: null,
  coverUrl: null,
  themePalette: 'ROSE_GOLD',
  themeMode: 'SYSTEM',
  cancellationPolicy: null,
  closingReminderOffsetMin: 30,
};

type Route = (url: string, init?: RequestInit) => Response | undefined;

async function setup(route: Route, stored?: ReturnType<typeof sessionResponse>) {
  const fetchImpl = jest.fn((url: string, init?: RequestInit) => {
    const path = url.replace(BASE_URL, '');
    const response = path === '/me' ? json(200, profile) : route(path, init);
    return response
      ? Promise.resolve(response)
      : Promise.reject(new Error(`rota inesperada: ${init?.method ?? 'GET'} ${path}`));
  });
  const storage = memoryStorage();
  if (stored) storage.data.set(SESSION_KEY, JSON.stringify(stored));
  const session = new SessionManager({ baseUrl: BASE_URL, fetch: fetchImpl, storage });
  const api = createApiClient({ baseUrl: BASE_URL, fetch: fetchImpl, session });
  await renderRouter(
    {
      _layout: createRootLayout(session, api),
      '(tabs)/_layout': TabsLayout,
      '(tabs)/index': AgendaScreen,
      '(tabs)/clientes': ClientsScreen,
      '(tabs)/servicos': ServicesScreen,
      '(tabs)/ajustes': SettingsScreen,
      login: LoginScreen,
      register: RegisterScreen,
    },
    { initialUrl: '/' },
  );
  return { fetchImpl, storage };
}

describe('autenticação e navegação (4.1)', () => {
  it('sem sessão, abre no login; credencial errada mostra a mensagem da API', async () => {
    await setup((path) =>
      path === '/auth/login'
        ? json(401, errorBody('UNAUTHORIZED', 'E-mail ou senha incorretos.'))
        : undefined,
    );

    await fireEvent.changeText(await screen.findByLabelText('E-mail'), 'ana@exemplo.com');
    await fireEvent.changeText(screen.getByLabelText('Senha'), 'senha-errada');
    await fireEvent.press(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('E-mail ou senha incorretos.');
  });

  it('valida no app antes de chamar a API (contrato Zod)', async () => {
    const { fetchImpl } = await setup(() => undefined);

    await fireEvent.changeText(await screen.findByLabelText('E-mail'), 'nao-e-email');
    await fireEvent.press(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByText('E-mail inválido.')).toBeOnTheScreen();
    expect(screen.getByText('Informe a senha.')).toBeOnTheScreen();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('login certo grava a sessão no SecureStore e abre a Agenda nas tabs', async () => {
    const { storage } = await setup((path) =>
      path === '/auth/login' ? json(200, sessionResponse(1)) : undefined,
    );

    await fireEvent.changeText(await screen.findByLabelText('E-mail'), 'ana@exemplo.com');
    await fireEvent.changeText(screen.getByLabelText('Senha'), 'senha-certa-123');
    await fireEvent.press(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByRole('header', { name: 'Agenda' })).toBeOnTheScreen();
    expect(storage.data.has(SESSION_KEY)).toBe(true);
  });

  it('sessão salva abre direto nas tabs; sair revoga e volta ao login', async () => {
    const { fetchImpl, storage } = await setup(
      (path) => (path === '/auth/logout' ? new Response(null, { status: 204 }) : undefined),
      sessionResponse(1),
    );

    await fireEvent.press(await screen.findByRole('button', { name: /Ajustes/ }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Sair da conta' }));

    expect(await screen.findByRole('header', { name: 'Entrar' })).toBeOnTheScreen();
    expect(fetchImpl).toHaveBeenCalledWith(
      `${BASE_URL}/auth/logout`,
      expect.objectContaining({ body: JSON.stringify({ refreshToken: 'refresh-1' }) }),
    );
    expect(storage.data.size).toBe(0);
  });

  it('cadastro exige o nome do negócio e entra direto nas tabs', async () => {
    await setup((path) => (path === '/auth/register' ? json(201, sessionResponse(1)) : undefined));

    await fireEvent.press(await screen.findByText('Ainda não tem conta? Criar conta'));
    await fireEvent.changeText(await screen.findByLabelText('E-mail'), 'ana@exemplo.com');
    await fireEvent.changeText(screen.getByLabelText('Senha'), 'senha-certa-123');
    await fireEvent.press(screen.getByRole('button', { name: 'Criar conta' }));
    expect(await screen.findByText('Informe o nome do seu negócio.')).toBeOnTheScreen();

    await fireEvent.changeText(screen.getByLabelText('Nome do seu negócio'), 'Ana Nails');
    await fireEvent.press(screen.getByRole('button', { name: 'Criar conta' }));

    expect(await screen.findByRole('header', { name: 'Agenda' })).toBeOnTheScreen();
  });
});
