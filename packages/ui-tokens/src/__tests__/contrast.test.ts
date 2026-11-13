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

    it.each(Object.entries(backgrounds))('textos e primary como texto sobre %s ≥ 4.5', (_, bg) => {
      for (const fg of [colors.textPrimary, colors.textSecondary, colors.primary, colors.danger]) {
        expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(AA_TEXT);
      }
    });

    it('border e focusRing sobre background/surface ≥ 3', () => {
      for (const bg of [colors.background, colors.surface]) {
        expect(contrastRatio(colors.border, bg)).toBeGreaterThanOrEqual(AA_UI);
        expect(contrastRatio(colors.focusRing, bg)).toBeGreaterThanOrEqual(AA_UI);
      }
    });

    it('RN-55: cores de status ≥ 3 sobre surface (componente de UI)', () => {
      for (const color of Object.values(status)) {
        expect(contrastRatio(color, colors.surface)).toBeGreaterThanOrEqual(AA_UI);
      }
    });

    it('RN-55: status.scheduled = primary', () => {
      expect(status.scheduled).toBe(colors.primary);
    });
  },
);
