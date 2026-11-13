import type { ColorScheme } from '@agende/ui-tokens';

/** 192/512 (manifest) e 180 (apple-touch-icon). */
export const PWA_ICON_SIZES = [180, 192, 512] as const;

/**
 * O app instalado tem uma cor só (manifest não tem media query): `SYSTEM` usa o claro. Ícone,
 * manifest e `theme-color` usam o mesmo modo.
 */
export function themeSchemeFor(mode: 'LIGHT' | 'DARK' | 'SYSTEM'): ColorScheme {
  return mode === 'DARK' ? 'dark' : 'light';
}

/** Primeira letra ou número do nome (emoji não existe na fonte do ícone). */
export function iconInitial(businessName: string): string {
  return businessName.match(/[\p{L}\p{N}]/u)?.[0]?.toUpperCase() ?? 'A';
}
