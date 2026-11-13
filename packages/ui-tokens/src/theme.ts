import { NEUTRALS, PALETTES, type ColorScheme, type PaletteName } from './palettes.ts';

export const PALETTE_NAMES = Object.keys(PALETTES) as PaletteName[];
export const COLOR_SCHEMES: readonly ColorScheme[] = ['light', 'dark'];

export interface Theme {
  palette: PaletteName;
  scheme: ColorScheme;
  colors: (typeof NEUTRALS)[ColorScheme] & {
    primary: string;
    onPrimary: string;
    focusRing: string;
  };
  /** RN-55. Cor nunca é o único indicador: sempre com ícone e rótulo. */
  status: {
    scheduled: string;
    inProgress: string;
    completed: string;
    cancelled: string;
    noShow: string;
  };
}

export function getTheme(palette: PaletteName, scheme: ColorScheme): Theme {
  const brand = PALETTES[palette][scheme];
  const neutral = NEUTRALS[scheme];
  const colors = { ...neutral, ...brand, focusRing: brand.primary };
  return {
    palette,
    scheme,
    colors,
    status: {
      scheduled: colors.primary,
      inProgress: colors.warning,
      completed: colors.success,
      cancelled: colors.muted,
      noShow: colors.danger,
    },
  };
}
