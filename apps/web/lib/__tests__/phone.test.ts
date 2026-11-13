import { describe, expect, it } from 'vitest';
import { formatBRPhoneInput, toE164BR } from '../phone';

describe('formatBRPhoneInput (máscara na digitação)', () => {
  it.each([
    ['', ''],
    ['1', '(1'],
    ['11', '(11'],
    ['119', '(11) 9'],
    ['1199999', '(11) 99999'],
    ['11999998', '(11) 9999-98'],
    ['1133334444', '(11) 3333-4444'],
    ['11999998888', '(11) 99999-8888'],
  ])('%s → %s (progressiva)', (input, expected) => {
    expect(formatBRPhoneInput(input)).toBe(expected);
  });

  it('ignora letras e símbolos e corta em 11 dígitos', () => {
    expect(formatBRPhoneInput('(11) 9a9999-88889999')).toBe('(11) 99999-8888');
  });

  it('DDD 55 (RS): dígito a mais não é confundido com código do país', () => {
    expect(formatBRPhoneInput('(55) 99999-88881')).toBe('(55) 99999-8888');
    expect(formatBRPhoneInput('559999988881')).toBe('(55) 99999-8888');
  });

  it('número colado com +55 ou 0 na frente', () => {
    expect(formatBRPhoneInput('+55 11 99999-8888')).toBe('(11) 99999-8888');
    expect(formatBRPhoneInput('011999998888')).toBe('(11) 99999-8888');
  });
});

describe('toE164BR (RN-80)', () => {
  it('RN-80: celular com máscara → E.164', () => {
    expect(toE164BR('(11) 99999-8888')).toBe('+5511999998888');
  });

  it('RN-80: fixo de 10 dígitos → E.164', () => {
    expect(toE164BR('(21) 3333-4444')).toBe('+552133334444');
  });

  it('RN-80: aceita colado com +55, 55 ou 0', () => {
    expect(toE164BR('+55 11 99999-8888')).toBe('+5511999998888');
    expect(toE164BR('5511999998888')).toBe('+5511999998888');
    expect(toE164BR('011999998888')).toBe('+5511999998888');
  });

  it('RN-80: DDD 55 (RS) com e sem código do país', () => {
    expect(toE164BR('(55) 99999-8888')).toBe('+5555999998888');
    expect(toE164BR('+55 55 99999-8888')).toBe('+5555999998888');
    expect(toE164BR('555533334444')).toBe('+555533334444');
  });

  it('recusa DDD inexistente', () => {
    expect(toE164BR('(10) 99999-8888')).toBeNull();
    expect(toE164BR('(20) 99999-8888')).toBeNull();
  });

  it('recusa celular de 11 dígitos sem o 9', () => {
    expect(toE164BR('(11) 89999-8888')).toBeNull();
  });

  it('recusa fixo que começa com 0, 1 ou 9 (10 dígitos)', () => {
    expect(toE164BR('(11) 9999-8888')).toBeNull();
    expect(toE164BR('(11) 1999-8888')).toBeNull();
  });

  it('recusa curto ou vazio', () => {
    expect(toE164BR('(11) 9999')).toBeNull();
    expect(toE164BR('')).toBeNull();
  });
});
