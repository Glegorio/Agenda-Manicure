/**
 * Telefone BR: máscara na digitação e envio em E.164 (RN-80). Sem biblioteca (orçamento de JS).
 * Celular: DDD + 9 + 8 dígitos; fixo: DDD + [2-5] + 7 dígitos.
 */

/** DDDs válidos no Brasil (Anatel). */
const DDDS = new Set([
  11, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 24, 27, 28, 31, 32, 33, 34, 35, 37, 38, 41, 42, 43,
  44, 45, 46, 47, 48, 49, 51, 53, 54, 55, 61, 62, 63, 64, 65, 66, 67, 68, 69, 71, 73, 74, 75, 77,
  79, 81, 82, 83, 84, 85, 86, 87, 88, 89, 91, 92, 93, 94, 95, 96, 97, 98, 99,
]);

/** Número nacional válido (DDD + celular com 9 ou fixo [2-5]), sem código de país. */
function isNational(d: string): boolean {
  if (!DDDS.has(Number(d.slice(0, 2)))) return false;
  const number = d.slice(2);
  return (
    (number.length === 9 && number.startsWith('9')) ||
    (number.length === 8 && /^[2-5]/.test(number))
  );
}

/**
 * Só os dígitos nacionais (DDD + número): tira o `55` de país e o `0` de operadora. O `55` só sai
 * com `+` na frente ou quando o resto é um número válido — DDD 55 (RS) com um dígito a mais
 * digitado não pode virar outro número.
 */
function nationalDigits(raw: string): string {
  let digits = raw.replace(/\D/g, '');
  const hasCountry =
    digits.startsWith('55') &&
    (raw.trim().startsWith('+') || (digits.length >= 12 && isNational(digits.slice(2))));
  if (hasCountry) digits = digits.slice(2);
  if (digits.length > 10 && digits.startsWith('0')) digits = digits.slice(1);
  return digits.slice(0, 11);
}

/** `11999998888` → `(11) 99999-8888`, progressivamente enquanto a cliente digita. */
export function formatBRPhoneInput(raw: string): string {
  const d = nationalDigits(raw);
  if (d.length === 0) return '';
  if (d.length <= 2) return `(${d}`;
  const ddd = d.slice(0, 2);
  const rest = d.slice(2);
  if (rest.length <= 5) return `(${ddd}) ${rest}`;
  // Até 10 dígitos o hífen fica após 4 (fixo); com 11, após 5 (celular).
  const split = d.length === 11 ? 5 : 4;
  return `(${ddd}) ${rest.slice(0, split)}-${rest.slice(split)}`;
}

/** RN-80: telefone digitado → `+55…`, ou `null` se não for um número brasileiro válido. */
export function toE164BR(raw: string): string | null {
  const d = nationalDigits(raw);
  return isNational(d) ? `+55${d}` : null;
}
