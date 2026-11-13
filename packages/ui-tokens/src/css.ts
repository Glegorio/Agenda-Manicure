import type { PaletteName } from './palettes.ts';
import { getTheme, type Theme } from './theme.ts';
import { fontSize, motion, radius, space } from './tokens.ts';

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
  ...Object.entries(fontSize).map(([k, v]) => `--font-size-${k}: ${String(v)}px;`),
  `--motion-fast: ${String(motion.fast)}ms;`,
  `--motion-base: ${String(motion.base)}ms;`,
  `--motion-slow: ${String(motion.slow)}ms;`,
  `--motion-easing: ${motion.easing};`,
];

const block = (selector: string, lines: string[]) =>
  `${selector} {\n${lines.map((l) => `  ${l}`).join('\n')}\n}`;

/** CSS variables do tema da profissional; `SYSTEM` segue `prefers-color-scheme`. */
export function buildThemeCss(palette: PaletteName, mode: ThemeMode, selector = ':root'): string {
  const scheme = mode === 'DARK' ? 'dark' : 'light';
  const base = block(selector, [...staticVars, ...colorVars(getTheme(palette, scheme))]);
  if (mode !== 'SYSTEM') return base;
  const dark = block(selector, colorVars(getTheme(palette, 'dark')));
  return `${base}\n@media (prefers-color-scheme: dark) {\n${dark.replace(/^/gm, '  ')}\n}`;
}
