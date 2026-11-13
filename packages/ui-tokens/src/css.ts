import type { PaletteName } from './palettes.ts';
import { getTheme, type Theme } from './theme.ts';
import { focusRing, fontSize, motion, radius, space, touchTarget } from './tokens.ts';

export type ThemeMode = 'LIGHT' | 'DARK' | 'SYSTEM';

const kebab = (key: string) => key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

function colorVars(theme: Theme): string[] {
  return [
    `color-scheme: ${theme.scheme};`,
    ...Object.entries(theme.colors).map(([k, v]) => `--color-${kebab(k)}: ${String(v)};`),
    ...Object.entries(theme.status).map(([k, v]) => `--status-${kebab(k)}: ${v};`),
  ];
}

const staticVars = [
  ...Object.entries(space).map(([k, v]) => `--space-${k}: ${String(v)}px;`),
  ...Object.entries(radius).map(([k, v]) => `--radius-${k}: ${String(v)}px;`),
  // rem: respeita o tamanho de fonte escolhido pelo usuário (zoom de texto até 200%).
  ...Object.entries(fontSize).map(([k, v]) => `--font-size-${k}: ${String(v / 16)}rem;`),
  `--touch-target: ${String(touchTarget)}px;`,
  `--focus-ring-width: ${String(focusRing.width)}px;`,
  `--focus-ring-offset: ${String(focusRing.offset)}px;`,
  `--motion-fast: ${String(motion.fast)}ms;`,
  `--motion-base: ${String(motion.base)}ms;`,
  `--motion-slow: ${String(motion.slow)}ms;`,
  `--motion-easing: ${motion.easing};`,
];

const reducedMotionVars = ['--motion-fast: 0ms;', '--motion-base: 0ms;', '--motion-slow: 0ms;'];

const media = (query: string, content: string) =>
  `@media (${query}) {
${content.replace(/^/gm, '  ')}
}`;

const block = (selector: string, lines: string[]) =>
  `${selector} {\n${lines.map((l) => `  ${l}`).join('\n')}\n}`;

/**
 * CSS variables do tema da profissional; `SYSTEM` segue `prefers-color-scheme`.
 * `prefers-reduced-motion` zera as durações em qualquer modo.
 */
export function buildThemeCss(palette: PaletteName, mode: ThemeMode, selector = ':root'): string {
  const scheme = mode === 'DARK' ? 'dark' : 'light';
  const css = [block(selector, [...staticVars, ...colorVars(getTheme(palette, scheme))])];
  if (mode === 'SYSTEM') {
    css.push(
      media('prefers-color-scheme: dark', block(selector, colorVars(getTheme(palette, 'dark')))),
    );
  }
  css.push(media('prefers-reduced-motion: reduce', block(selector, reducedMotionVars)));
  return css.join('\n');
}
