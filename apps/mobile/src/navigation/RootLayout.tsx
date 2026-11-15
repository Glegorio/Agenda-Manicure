import { useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClientProvider } from '@tanstack/react-query';
import type { ApiClient } from '../api/client';
import { createQueryClient } from '../api/queryClient';
import { useProfile } from '../api/queries';
import { AuthProvider, useAuth } from '../auth/AuthProvider';
import type { SessionManager } from '../auth/session';
import { DEFAULT_PALETTE, ThemeProvider, useTheme } from '../theme/ThemeProvider';

/** Layout raiz com sessão e cliente HTTP injetados (o app usa as instâncias reais; testes, falsas). */
export function createRootLayout(session: SessionManager, api: ApiClient) {
  return function RootLayout() {
    return <RootProviders session={session} api={api} />;
  };
}

function RootProviders({ session, api }: { session: SessionManager; api: ApiClient }) {
  const [queryClient] = useState(createQueryClient);
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider session={session} api={api}>
          <ThemedRoot />
        </AuthProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

/** Tema da profissional (paleta e modo do `/me`); antes do login, o padrão. */
function ThemedRoot() {
  const { data: profile } = useProfile();
  return (
    <ThemeProvider
      palette={profile?.themePalette ?? DEFAULT_PALETTE}
      mode={profile?.themeMode ?? 'SYSTEM'}
    >
      <Routes />
    </ThemeProvider>
  );
}

function Routes() {
  const { status } = useAuth();
  const { colors, scheme } = useTheme();
  // Enquanto lê o SecureStore, nada é mostrado (evita piscar o login para quem já entrou).
  if (status === 'loading') return null;
  const signedIn = status === 'signedIn';
  return (
    <>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}
      >
        <Stack.Protected guard={signedIn}>
          <Stack.Screen name="(tabs)" />
        </Stack.Protected>
        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="login" />
          <Stack.Screen name="register" />
        </Stack.Protected>
      </Stack>
    </>
  );
}
