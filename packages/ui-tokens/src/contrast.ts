const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

function channels(hex: string): [number, number, number] {
  if (!HEX.test(hex)) throw new Error(`Cor inválida: ${hex} (esperado #RGB ou #RRGGBB)`);
  const raw = hex.length === 4 ? hex.slice(1).replace(/./g, '$&$&') : hex.slice(1);
  return [0, 2, 4].map((i) => parseInt(raw.slice(i, i + 2), 16) / 255) as [number, number, number];
}

/** Luminância relativa (WCAG 2.1). */
export function relativeLuminance(hex: string): number {
  const [r, g, b] = channels(hex).map((c) =>
    c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4,
  ) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Razão de contraste WCAG 2.1 entre duas cores (1 a 21). */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x) as [
    number,
    number,
  ];
  return (hi + 0.05) / (lo + 0.05);
}
