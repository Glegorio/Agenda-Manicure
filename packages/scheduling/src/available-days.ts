import { computeAvailableSlots } from './slots.ts';
import { addLocalDays } from './time.ts';
import type { LocalDate, SlotQuery } from './types.ts';

/**
 * Datas locais de `from` a `to` (inclusive) com ao menos um horário disponível — o calendário da
 * etapa 2 da web. Mesmo cálculo de `computeAvailableSlots` (RN-30..36), dia a dia; `busy` deve
 * cobrir o período inteiro. Função pura: `now` vem da query.
 */
export function computeAvailableDays(
  from: LocalDate,
  to: LocalDate,
  query: Omit<SlotQuery, 'date'>,
): LocalDate[] {
  if (from > to) throw new RangeError(`Período inválido: ${from} > ${to}.`);
  const days: LocalDate[] = [];
  for (let date = from; date <= to; date = addLocalDays(date, 1)) {
    if (computeAvailableSlots({ ...query, date }).length > 0) days.push(date);
  }
  return days;
}
