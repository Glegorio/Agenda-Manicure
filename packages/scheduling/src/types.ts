/** Data local no fuso da profissional, `YYYY-MM-DD` (RN-02). */
export type LocalDate = string;

/** Hora local no fuso da profissional, `HH:mm` (`24:00` = fim do dia). */
export type LocalTime = string;

/** Fuso IANA, ex. `America/Sao_Paulo`. */
export type TimeZone = string;

/** 0 = domingo … 6 = sábado (convenção de `weekly_schedule_windows`). */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/** Intervalo de instantes meio-aberto `[start, end)`, em UTC. */
export interface Interval {
  readonly start: Date;
  readonly end: Date;
}

/** Janela de trabalho em hora local; `start < end`, não atravessa meia-noite (RN-20). */
export interface LocalWindow {
  readonly start: LocalTime;
  readonly end: LocalTime;
}

/** Janela de trabalho concreta de um dia, em UTC. */
export type Window = Interval;

/** Escala semanal: zero ou mais janelas por dia da semana (RN-20). */
export type WeeklySchedule = Readonly<Partial<Record<Weekday, readonly LocalWindow[]>>>;

/** Exceção por data: folga (`closed`) ou janelas customizadas (RN-21). */
export type ScheduleException =
  | { readonly date: LocalDate; readonly closed: true }
  | { readonly date: LocalDate; readonly closed: false; readonly windows: readonly LocalWindow[] };

/** Status do agendamento (RN-50). Só `SCHEDULED` e `IN_PROGRESS` ocupam a agenda (RN-51). */
export type AppointmentStatus = 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';

/**
 * Algo que pode ocupar a agenda. O algoritmo (tarefa 1.2) decide se ocupa:
 * agendamento ativo (RN-51) e hold com `expiresAt > now` ocupam `[start, blockEnd)`;
 * bloqueio manual ocupa `[start, end)`.
 *
 * `blockEnd` é o `block_end_at` gravado no banco (`end + buffer vigente na criação`, doc 04) —
 * o mesmo valor que a exclusion constraint usa (RN-42). Nunca recalcule com o buffer atual:
 * o buffer de hoje só se aplica ao candidato novo `[t, t + D + bufferMin)`.
 */
export type BusyInterval =
  | (Interval & {
      readonly kind: 'appointment';
      readonly status: AppointmentStatus;
      readonly blockEnd: Date;
    })
  | (Interval & { readonly kind: 'hold'; readonly expiresAt: Date; readonly blockEnd: Date })
  | (Interval & { readonly kind: 'block' });

/** Parâmetros de agenda da profissional (RN-02, RN-22..25). */
export interface SchedulingSettings {
  readonly timezone: TimeZone;
  /** 0–60 (RN-22). */
  readonly bufferMin: number;
  /** 5, 10, 15 ou 30 (RN-23). */
  readonly slotStepMin: 5 | 10 | 15 | 30;
  /** Antecedência mínima para agendar online (RN-24). */
  readonly minNoticeMin: number;
  /** Até quantos dias à frente (RN-25). */
  readonly bookingHorizonDays: number;
}

/** Entrada do cálculo de slots de um dia (seção 4 de `docs/02-regras-de-negocio.md`). */
export interface SlotQuery {
  /** Data local `d` no fuso da profissional. */
  readonly date: LocalDate;
  /** Duração do serviço `D`, em minutos (RN-10). */
  readonly durationMin: number;
  /** Instante atual, sempre injetado (função pura). */
  readonly now: Date;
  readonly settings: SchedulingSettings;
  readonly weeklySchedule: WeeklySchedule;
  readonly exceptions: readonly ScheduleException[];
  readonly busy: readonly BusyInterval[];
}
