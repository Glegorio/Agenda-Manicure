/**
 * Margem do contador do hold: o `Date` do servidor tem resolução de 1 s e é lido depois do
 * download, então o cliente acharia o hold válido um pouco além da conta. O 410 continua sendo a
 * garantia (RN-44).
 */
export const HOLD_SAFETY_MARGIN_MS = 2_000;

/**
 * Tempo restante do hold no relógio do servidor (`serverOffsetMs` = servidor − local): um celular
 * com a hora errada não muda o prazo.
 */
export function holdRemainingMs(
  expiresAt: string,
  serverOffsetMs: number,
  localNowMs: number = Date.now(),
  marginMs: number = HOLD_SAFETY_MARGIN_MS,
): number {
  return Math.max(0, Date.parse(expiresAt) - (localNowMs + serverOffsetMs) - marginMs);
}

/** `299_001` → `4:59`. */
export function formatCountdown(ms: number): string {
  const total = Math.floor(ms / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes)}:${String(seconds).padStart(2, '0')}`;
}
