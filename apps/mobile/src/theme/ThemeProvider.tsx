import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import type { ThemeMode } from '@agende/contracts';
import { getTheme, type ColorScheme, type PaletteName, type Theme } from '@agende/ui-tokens';

/** Paleta antes de o perfil carregar (login, cadastro). */
export const DEFAULT_PALETTE: PaletteName = 'ROSE_GOLD';

export function resolveScheme(
  mode: ThemeMode,
  system: ColorScheme | null | undefined,
): ColorScheme {
  if (mode === 'LIGHT') return 'light';
  if (mode === 'DARK') return 'dark';
  return system === 'dark' ? 'dark' : 'light';
}

const ThemeContext = createContext<Theme>(getTheme(DEFAULT_PALETTE, 'light'));

interface ThemeProviderProps {
  palette?: PaletteName;
  mode?: ThemeMode;
  children: ReactNode;
}

export function ThemeProvider({
  palette = DEFAULT_PALETTE,
  mode = 'SYSTEM',
  children,
}: ThemeProviderProps) {
  const system = useColorScheme();
  const scheme = resolveScheme(mode, system === 'dark' || system === 'light' ? system : null);
  const theme = useMemo(() => getTheme(palette, scheme), [palette, scheme]);
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}
