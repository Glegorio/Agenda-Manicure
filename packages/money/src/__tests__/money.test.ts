import { describe, expect, it } from 'vitest';
import {
  assertCents,
  centsFromBigInt,
  centsFromDigits,
  formatBRL,
  formatBRLNumber,
  isCents,
  parseBRL,
  sumCents,
} from '../money.ts';

// Intl separa "R$" do número com espaço não separável (U+00A0).
const NBSP = String.fromCharCode(0xa0);
const brl = (text: string) => text.replace(' ', NBSP);

describe('isCents / assertCents', () => {
  it.each([0, 1, 15000, -500, Number.MAX_SAFE_INTEGER])(
    'RN-77: %s é um valor em centavos',
    (value) => {
      expect(isCents(value)).toBe(true);
    },
  );

  it.each([1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1])(
    'RN-77: %s não é um valor em centavos (inteiro seguro)',
    (value) => {
      expect(isCents(value)).toBe(false);
      expect(() => assertCents(value)).toThrow(RangeError);
    },
  );

  it('assertCents normaliza -0 para 0', () => {
    expect(Object.is(assertCents(-0), 0)).toBe(true);
  });

  it('assertCents devolve o próprio valor quando válido', () => {
    expect(assertCents(4990)).toBe(4990);
  });
});

describe('formatBRL', () => {
  it.each([
    [0, 'R$ 0,00'],
    [5, 'R$ 0,05'],
    [99, 'R$ 0,99'],
    [100, 'R$ 1,00'],
    [123456, 'R$ 1.234,56'],
    [100000000, 'R$ 1.000.000,00'],
  ])('RN-77: %s centavos → %s', (cents, expected) => {
    expect(formatBRL(cents)).toBe(brl(expected));
  });

  it('RN-75: valores negativos (saída de caixa) levam o sinal', () => {
    expect(formatBRL(-1050)).toBe(brl('-R$ 10,50'));
  });

  it('RN-77: recusa valor que não é centavos inteiros', () => {
    expect(() => formatBRL(10.5)).toThrow(RangeError);
  });

  it('RN-75: zero negativo (ex.: -despesa de 0) não mostra sinal', () => {
    expect(formatBRL(-0)).toBe(brl('R$ 0,00'));
  });

  it('RN-77: exato até o maior inteiro seguro (sem arredondar via float)', () => {
    expect(formatBRL(Number.MAX_SAFE_INTEGER)).toBe(brl('R$ 90.071.992.547.409,91'));
  });

  it('produz exatamente o mesmo texto que Intl.NumberFormat pt-BR (onde o float é exato)', () => {
    const intl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
    for (const cents of [
      0, 1, 9, 10, 99, 100, 101, 999, 1000, 123456, -1, -99, -123456, 1e10, 98765432101,
    ]) {
      expect(formatBRL(cents)).toBe(intl.format(cents / 100));
    }
  });
});

describe('formatBRLNumber', () => {
  it.each([
    [0, '0,00'],
    [4990, '49,90'],
    [123456, '1.234,56'],
  ])('%s centavos → %s (sem R$, para campos de valor)', (cents, expected) => {
    expect(formatBRLNumber(cents)).toBe(expected);
  });
});

describe('centsFromDigits', () => {
  it.each([
    ['', 0],
    ['5', 5],
    ['49', 49],
    ['4990', 4990],
    ['R$ 49,90', 4990],
    ['00012', 12],
  ])('máscara de digitação: "%s" → %s centavos', (input, expected) => {
    expect(centsFromDigits(input)).toBe(expected);
  });

  it('recusa entrada que estoura o inteiro seguro', () => {
    expect(centsFromDigits('99999999999999999')).toBeNull();
  });
});

describe('centsFromBigInt', () => {
  it('RN-77: converte SUM do banco (bigint) para centavos', () => {
    expect(centsFromBigInt(123456n)).toBe(123456);
  });

  it('RN-77: recusa bigint fora do inteiro seguro', () => {
    expect(() => centsFromBigInt(BigInt(Number.MAX_SAFE_INTEGER) + 1n)).toThrow(RangeError);
  });
});

describe('parseBRL', () => {
  it.each([
    ['0', 0],
    ['0,99', 99],
    ['1', 100],
    ['1,5', 150],
    ['1,50', 150],
    ['150', 15000],
    ['1234,56', 123456],
    ['1.234,56', 123456],
    ['1.234', 123400],
    ['1.000.000,00', 100000000],
    ['R$ 49,90', 4990],
    ['R$49,90', 4990],
    [`R$${NBSP}1.234,56`, 123456],
    ['  12,30  ', 1230],
    [',50', 50],
    ['0,5', 50],
    ['007', 700],
    ['90.071.992.547.409,91', Number.MAX_SAFE_INTEGER],
  ])('RN-77: "%s" → %s centavos', (input, expected) => {
    expect(parseBRL(input)).toBe(expected);
  });

  it('é o inverso de formatBRL para valores ≥ 0 (negativos são recusados de propósito)', () => {
    for (const cents of [0, 7, 1999, 123456, 987654321]) {
      expect(parseBRL(formatBRL(cents))).toBe(cents);
    }
  });

  it.each([
    ['vazio', ''],
    ['só espaços', '   '],
    ['só o símbolo', 'R$'],
    ['letras', 'abc'],
    ['mais de 2 casas decimais', '12,345'],
    ['ponto decimal à americana', '12.34'],
    ['grupo de milhar irregular', '1.23,00'],
    ['milhar sem dígitos antes', '.123'],
    ['duas vírgulas', '1,2,3'],
    ['vírgula sem centavos', '12,'],
    ['negativo', '-10,00'],
    ['notação científica', '1e3'],
    ['número grande demais (perde precisão)', '999999999999999999'],
    ['um centavo acima do inteiro seguro', '90.071.992.547.409,92'],
    ['espaço no meio do número', '1 234,56'],
    ['grupo de milhar começando com zero', '0.500'],
    ['r$ minúsculo', 'r$ 10,00'],
  ])('rejeita %s → null', (_label, input) => {
    expect(parseBRL(input)).toBeNull();
  });
});

describe('sumCents', () => {
  it('RN-70/77: soma inteiros em centavos sem erro de ponto flutuante', () => {
    // 0,10 + 0,20 em float dá 0,30000000000000004; em centavos é exato.
    expect(sumCents([10, 20])).toBe(30);
  });

  it('lista vazia soma 0', () => {
    expect(sumCents([])).toBe(0);
  });

  it('RN-75: aceita negativos (despesas)', () => {
    expect(sumCents([15000, -3500])).toBe(11500);
  });

  it('RN-77: recusa parcela que não é centavos inteiros', () => {
    expect(() => sumCents([100, 0.5])).toThrow(RangeError);
  });

  it('RN-77: recusa estouro intermediário mesmo que o total final pareça seguro', () => {
    expect(() => sumCents([Number.MAX_SAFE_INTEGER, 2, -2])).toThrow(RangeError);
  });

  it('RN-77: recusa soma que sai do inteiro seguro', () => {
    expect(() => sumCents([Number.MAX_SAFE_INTEGER, 1])).toThrow(RangeError);
  });
});
