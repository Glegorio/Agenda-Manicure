/** Escala de espaço em 4 pt (doc 07). */
export const space = { 1: 4, 2: 8, 3: 12, 4: 16, 5: 24, 6: 32, 7: 48 } as const;

export const radius = { md: 12, lg: 16, full: 9999 } as const;

export const motion = { fast: 150, base: 220, slow: 300, easing: 'ease-out' } as const;

/** Corpo mínimo de 16 px evita o zoom do iOS em inputs. */
export const fontSize = { sm: 14, md: 16, lg: 18, xl: 22, xxl: 28 } as const;

/** Alvo de toque mínimo (48 dp Android ≥ 44 pt iOS). */
export const touchTarget = 48;
