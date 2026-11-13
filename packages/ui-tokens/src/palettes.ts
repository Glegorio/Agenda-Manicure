export type ColorScheme = 'light' | 'dark';

export interface NeutralColors {
  background: string;
  surface: string;
  surfaceElevated: string;
  textPrimary: string;
  textSecondary: string;
  border: string;
  success: string;
  warning: string;
  danger: string;
  muted: string;
}

export interface BrandColors {
  primary: string;
  onPrimary: string;
}

/**
 * Hex do doc 07 escurecidos (light) até AA com texto branco; no dark o texto sobre a
 * primary é escuro. Validados em `__tests__/contrast.test.ts`.
 */
export const PALETTES = {
  ROSE_GOLD: {
    light: { primary: '#9A5560', onPrimary: '#FFFFFF' },
    dark: { primary: '#E8A9B2', onPrimary: '#1F1416' },
  },
  NUDE_MINIMAL: {
    light: { primary: '#86624D', onPrimary: '#FFFFFF' },
    dark: { primary: '#D9B8A3', onPrimary: '#1F1813' },
  },
  ELEGANCE_BLACK: {
    light: { primary: '#1F1F1F', onPrimary: '#FFFFFF' },
    dark: { primary: '#F2F2F2', onPrimary: '#1F1F1F' },
  },
  PASTEL_LILAC: {
    light: { primary: '#6B58A6', onPrimary: '#FFFFFF' },
    dark: { primary: '#C7B9F0', onPrimary: '#1B1626' },
  },
} as const satisfies Record<string, Record<ColorScheme, BrandColors>>;

export type PaletteName = keyof typeof PALETTES;

export const NEUTRALS: Record<ColorScheme, NeutralColors> = {
  light: {
    background: '#FAF8F7',
    surface: '#FFFFFF',
    surfaceElevated: '#FFFFFF',
    textPrimary: '#1F1A1C',
    textSecondary: '#5C5458',
    border: '#8A8084',
    success: '#1E7A46',
    warning: '#A35A00',
    danger: '#B3261E',
    muted: '#6F696C',
  },
  dark: {
    background: '#141213',
    surface: '#1E1B1C',
    surfaceElevated: '#2A2628',
    textPrimary: '#F3EFF0',
    textSecondary: '#C4BBBF',
    border: '#8A8285',
    success: '#5CC98A',
    warning: '#F0B357',
    danger: '#FF8A80',
    muted: '#A39C9F',
  },
};
