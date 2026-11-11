/**
 * Dinheiro em centavos inteiros (CLAUDE.md regra 3, RN-77). Formatação em BRL só na borda de UI.
 */
export type Cents = number;

/** RN-77: valor em centavos é um inteiro seguro (sem perda de precisão em `number`). */
export function isCents(value: number): boolean {
  return Number.isSafeInteger(value);
}

/** Valida e normaliza (`-0` vira `0`, para nunca exibir "-R$ 0,00"). */
export function assertCents(value: number): Cents {
  if (!isCents(value)) {
    throw new RangeError(`Valor em centavos inválido: ${String(value)} (esperado inteiro seguro).`);
  }
  return value === 0 ? 0 : value;
}

/** Espaço não separável entre "R$" e o número, como no `Intl.NumberFormat('pt-BR')`. */
const NBSP = String.fromCharCode(0xa0);

/**
 * `123456` → `1.234,56`. Feito com BigInt em vez de `Intl` + `cents / 100`: exato em toda a faixa
 * segura e sem depender do `Intl` do Hermes (React Native). Saída idêntica à do Intl pt-BR.
 */
export function formatBRLNumber(cents: Cents): string {
  const value = BigInt(assertCents(cents));
  const absolute = value < 0n ? -value : value;
  const reais = (absolute / 100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const centavos = (absolute % 100n).toString().padStart(2, '0');
  return `${value < 0n ? '-' : ''}${reais},${centavos}`;
}

/** `123456` → `R$ 1.234,56` (com espaço não separável); negativos → `-R$ 10,50`. RN-77. */
export function formatBRL(cents: Cents): string {
  const number = formatBRLNumber(cents);
  return number.startsWith('-') ? `-R$${NBSP}${number.slice(1)}` : `R$${NBSP}${number}`;
}

// Milhares agrupados de 3 em 3 com ponto (1º grupo sem zero à esquerda) ou dígitos corridos;
// vírgula + 1–2 casas decimais.
const BRL_INPUT = /^([1-9]\d{0,2}(?:\.\d{3})+|\d+)?(?:,(\d{1,2}))?$/;

/**
 * Converte texto digitado em BRL para centavos, sem passar por ponto flutuante.
 * Aceita `R$ 1.234,56`, `1234,5`, `150`, `,50`. Devolve `null` se o texto for inválido,
 * ambíguo (`12.34`), negativo, com espaço no meio ou grande demais para um inteiro seguro.
 * Leitura pt-BR: `1.500` é mil e quinhentos reais.
 */
export function parseBRL(input: string): Cents | null {
  // `\s` inclui o espaço não separável (U+00A0) que o Intl usa depois de R$.
  const text = input.trim().replace(/^R\$\s*/, '');
  const match = BRL_INPUT.exec(text);
  if (!match || text === '' || text === ',') return null;

  const reais = (match[1] ?? '0').replaceAll('.', '');
  const centavos = (match[2] ?? '').padEnd(2, '0');
  return safeCentsOrNull(BigInt(reais) * 100n + BigInt(centavos));
}

/**
 * Máscara de digitação "da direita para a esquerda": usa só os dígitos digitados como centavos
 * (`4990` → R$ 49,90). Ignora qualquer outro caractere. `null` se estourar o inteiro seguro.
 */
export function centsFromDigits(input: string): Cents | null {
  const digits = input.replace(/\D/g, '');
  return digits === '' ? 0 : safeCentsOrNull(BigInt(digits));
}

/** Converte agregações do banco (`SUM` → `bigint`, RN-77) para centavos; lança fora da faixa. */
export function centsFromBigInt(value: bigint): Cents {
  const cents = safeCentsOrNull(value);
  if (cents === null) {
    throw new RangeError(`Valor em centavos fora do inteiro seguro: ${value.toString()}.`);
  }
  return cents;
}

function safeCentsOrNull(value: bigint): Cents | null {
  const limit = BigInt(Number.MAX_SAFE_INTEGER);
  return value <= limit && value >= -limit ? Number(value) : null;
}

/**
 * Soma em centavos inteiros (RN-77). Checa cada parcial: um estouro no meio arredonda e não
 * "volta" exato depois — inclusive com sinais opostos, como `[MAX, MAX, -MAX]`.
 */
export function sumCents(values: readonly Cents[]): Cents {
  let total = 0;
  for (const value of values) {
    total = assertCents(total + assertCents(value));
  }
  return total;
}
