import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  authSessionResponseSchema,
  type LoginRequest,
  type RegisterRequest,
} from '@agende/contracts';
import type { ApiClient } from '../api/client';
import type { Session, SessionManager } from './session';

type AuthStatus = 'loading' | 'signedOut' | 'signedIn';

interface AuthContextValue {
  status: AuthStatus;
  session: Session | null;
  api: ApiClient;
  login: (input: LoginRequest) => Promise<void>;
  register: (input: RegisterRequest) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

interface AuthProviderProps {
  session: SessionManager;
  api: ApiClient;
  children: ReactNode;
}

export function AuthProvider({ session, api, children }: AuthProviderProps) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<{ status: AuthStatus; session: Session | null }>({
    status: 'loading',
    session: null,
  });

  useEffect(() => {
    const unsubscribe = session.subscribe((current) => {
      setState({ status: current ? 'signedIn' : 'signedOut', session: current });
      // Sessão encerrada (logout ou refresh recusado): nada da conta anterior fica em cache.
      if (!current) queryClient.clear();
    });
    session.load().catch(() => {
      setState({ status: 'signedOut', session: null });
    });
    return unsubscribe;
  }, [session, queryClient]);

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      api,
      login: async (input) => {
        await session.set(
          await api.post('/auth/login', input, authSessionResponseSchema, { auth: false }),
        );
      },
      register: async (input) => {
        await session.set(
          await api.post('/auth/register', input, authSessionResponseSchema, { auth: false }),
        );
      },
      logout: () => session.logout(),
    }),
    [state, api, session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth fora do AuthProvider');
  return value;
}
