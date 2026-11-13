import { describe, expect, it } from 'vitest';
import { THEME_PALETTES } from '@agende/contracts';
import { contrastRatio } from '../contrast.ts';
import { COLOR_SCHEMES, PALETTE_NAMES, getTheme } from '../theme.ts';

const AA_TEXT = 4.5;
const AA_UI = 3;

describe('contrastRatio (WCAG 2.1)', () => {
  it('preto sobre branco = 21:1', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
  });

  it('é simétrico e igual a 1 para a mesma cor', () => {
    expect(contrastRatio('#777777', '#FFFFFF')).toBeCloseTo(
      contrastRatio('#FFFFFF', '#777777'),
      10,
    );
    expect(contrastRatio('#B76E79', '#B76E79')).toBe(1);
  });

  it('#777 sobre branco ≈ 4.48 (abaixo de AA)', () => {
    expect(contrastRatio('#777777', '#FFFFFF')).toBeCloseTo(4.48, 2);
  });

  it('aceita hex curto e minúsculo', () => {
    expect(contrastRatio('#fff', '#000')).toBeCloseTo(21, 5);
  });

  it('recusa cor que não é hex', () => {
    expect(() => contrastRatio('red', '#000')).toThrow();
  });
});

describe('paletas', () => {
  it('cobrem exatamente as paletas do contrato', () => {
    expect([...PALETTE_NAMES].sort()).toEqual([...THEME_PALETTES].sort());
  });
});

describe.each(PALETTE_NAMES.flatMap((p) => COLOR_SCHEMES.map((s) => [p, s] as const)))(
  'AA em %s/%s',
  (palette, scheme) => {
    const { colors, status } = getTheme(palette, scheme);
    const backgrounds = {
      background: colors.background,
      surface: colors.surface,
      surfaceElevated: colors.surfaceElevated,
    };

    it('onPrimary sobre primary ≥ 4.5', () => {
      expect(contrastRatio(colors.onPrimary, colors.primary)).toBeGreaterThanOrEqual(AA_TEXT);
    });

    // Todas as cores que aparecem como texto (rótulos de status, cancelado riscado em muted).
    const textColors = {
      textPrimary: colors.textPrimary,
      textSecondary: colors.textSecondary,
      primary: colors.primary,
      danger: colors.danger,
      success: colors.success,
      warning: colors.warning,
      muted: colors.muted,
    };

    it.each(Object.entries(backgrounds))('toda cor de texto sobre %s ≥ 4.5', (_, bg) => {
      for (const [name, fg] of Object.entries(textColors)) {
        expect(contrastRatio(fg, bg), name).toBeGreaterThanOrEqual(AA_TEXT);
      }
    });

    it.each(Object.entries(backgrounds))('border e focusRing sobre %s ≥ 3', (_, bg) => {
      expect(contrastRatio(colors.border, bg)).toBeGreaterThanOrEqual(AA_UI);
      expect(contrastRatio(colors.focusRing, bg)).toBeGreaterThanOrEqual(AA_UI);
    });

    it.each(Object.entries(backgrounds))('RN-55: status como texto sobre %s ≥ 4.5', (_, bg) => {
      for (const [name, color] of Object.entries(status)) {
        expect(contrastRatio(color, bg), name).toBeGreaterThanOrEqual(AA_TEXT);
      }
    });

    it('RN-55: status.scheduled = primary', () => {
      expect(status.scheduled).toBe(colors.primary);
    });
  },
);
