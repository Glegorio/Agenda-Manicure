import { z } from 'zod';

/** Data local `YYYY-MM-DD` (no fuso da profissional, RN-02), validando o calendário. */
export const localDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida (use AAAA-MM-DD).')
  .refine((value) => {
    const [year, month, day] = value.split('-').map(Number) as [number, number, number];
    // Ano ≥ 2000: `Date.UTC` trata 0–99 como 19xx e datas antigas não fazem sentido na agenda.
    const probe = new Date(Date.UTC(year, month - 1, day));
    return year >= 2000 && probe.getUTCMonth() === month - 1 && probe.getUTCDate() === day;
  }, 'Data inexistente no calendário.');

/** Hora local `HH:mm`; `24:00` = fim do dia. */
export const localTimeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$|^24:00$/, 'Hora inválida (use HH:mm).');

/** Instante em UTC, ISO-8601 com `Z` (RN-01). */
export const utcInstantSchema = z.iso.datetime({ offset: false });

/**
 * Fuso IANA em forma canônica (RN-02). Recusa offsets (`+03:00`), apelidos (`EST`) e variações de
 * caixa (`utc`): o valor gravado precisa ser o mesmo que `@date-fns/tz` e o Postgres entendem.
 */
export const timeZoneSchema = z
  .string()
  .min(1)
  .max(64)
  .refine((timeZone) => {
    try {
      const canonical = new Intl.DateTimeFormat('en-US', { timeZone }).resolvedOptions().timeZone;
      return canonical === timeZone && !/^[+-]/.test(timeZone);
    } catch {
      return false;
    }
  }, 'Fuso horário inválido.');

/**
 * Mensagens padrão do Zod em português (a usuária final lê `message`, doc 05). `z.config` é
 * global: cada app chama uma vez na inicialização (não é efeito colateral de import).
 */
export function configureContractsLocale(): void {
  z.config(z.locales.ptBR());
}

/** Teto do `int` (int4) do PostgreSQL, tipo das colunas `*_cents` (doc 04). */
export const MAX_CENTS = 2_147_483_647;

/** Dinheiro em centavos inteiros, não negativo (regra 3, RN-10, RN-52, RN-77). */
export const centsSchema = z.int().min(0).max(MAX_CENTS);

/** Telefone em E.164 (RN-80). A web/app convertem a máscara BR antes de enviar. */
export const phoneE164Schema = z
  .string()
  .regex(/^\+[1-9]\d{9,14}$/, 'Telefone inválido (formato internacional, ex.: +5511999998888).');

export const idSchema = z.uuid();
