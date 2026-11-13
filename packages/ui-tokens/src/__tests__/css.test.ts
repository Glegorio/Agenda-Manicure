import { describe, expect, it } from 'vitest';
import { buildThemeCss } from '../css.ts';
import { getTheme } from '../theme.ts';

const declarations = (css: string) => [...css.matchAll(/(--[a-z0-9-]+):\s*([^;]*);/g)];

describe('buildThemeCss', () => {
  it('LIGHT gera só o bloco claro, com a primary da paleta', () => {
    const css = buildThemeCss('ROSE_GOLD', 'LIGHT');
    expect(css).not.toContain('prefers-color-scheme');
    expect(css).toContain(`--color-primary: ${getTheme('ROSE_GOLD', 'light').colors.primary};`);
    expect(css).toContain('color-scheme: light;');
  });

  it('DARK usa os valores escuros', () => {
    const css = buildThemeCss('PASTEL_LILAC', 'DARK');
    expect(css).toContain(`--color-primary: ${getTheme('PASTEL_LILAC', 'dark').colors.primary};`);
    expect(css).toContain('color-scheme: dark;');
  });

  it('SYSTEM gera o claro e um bloco prefers-color-scheme: dark', () => {
    const css = buildThemeCss('NUDE_MINIMAL', 'SYSTEM');
    expect(css).toContain('@media (prefers-color-scheme: dark)');
    expect(css).toContain(getTheme('NUDE_MINIMAL', 'dark').colors.primary);
  });

  it('nenhum token vazio e os mesmos nomes de token nos dois modos', () => {
    const withoutMedia = (css: string) => css.slice(0, css.indexOf('@media'));
    const light = declarations(withoutMedia(buildThemeCss('ELEGANCE_BLACK', 'LIGHT')));
    const dark = declarations(withoutMedia(buildThemeCss('ELEGANCE_BLACK', 'DARK')));
    expect(light.length).toBeGreaterThan(20);
    expect(light.map((d) => d[1])).toEqual(dark.map((d) => d[1]));
    for (const [, , value] of [...light, ...dark]) expect(value?.trim()).not.toBe('');
  });

  it('expõe espaço, raio, movimento, alvo de toque e anel de foco', () => {
    const css = buildThemeCss('ROSE_GOLD', 'LIGHT');
    expect(css).toContain('--space-4: 16px;');
    expect(css).toContain('--radius-md: 12px;');
    expect(css).toContain('--motion-base: 220ms;');
    expect(css).toContain('--touch-target: 48px;');
    expect(css).toContain('--focus-ring-width: 2px;');
    expect(css).toContain('--focus-ring-offset: 2px;');
  });

  it('fontes em rem, respeitando o tamanho de fonte do usuário', () => {
    const css = buildThemeCss('ROSE_GOLD', 'LIGHT');
    expect(css).toContain('--font-size-md: 1rem;');
    expect(css).toContain('--font-size-sm: 0.875rem;');
    expect(css).not.toMatch(/--font-size-[a-z]+: [0-9.]+px/);
  });

  it.each(['LIGHT', 'DARK', 'SYSTEM'] as const)(
    'prefers-reduced-motion zera as durações (%s)',
    (mode) => {
      const css = buildThemeCss('ROSE_GOLD', mode);
      const reduced = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'));
      expect(css).toContain('@media (prefers-reduced-motion: reduce)');
      for (const name of ['fast', 'base', 'slow'])
        expect(reduced).toContain(`--motion-${name}: 0ms;`);
    },
  );

  it('usa o seletor informado', () => {
    expect(buildThemeCss('ROSE_GOLD', 'LIGHT', '[data-theme]')).toMatch(/^\[data-theme\] \{/);
  });
});
