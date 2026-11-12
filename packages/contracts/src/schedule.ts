import { z } from 'zod';
import {
  idSchema,
  localDateSchema,
  localTimeSchema,
  timeZoneSchema,
  utcInstantSchema,
} from './common.ts';

interface TimeRange {
  readonly start: string;
  readonly end: string;
}

/** `HH:mm` com zero à esquerda compara corretamente como texto. */
const startBeforeEnd = (w: TimeRange) => w.start < w.end;
const START_BEFORE_END = { message: 'O início da janela deve ser antes do fim.', path: ['end'] };

/** Q-17: sobreposição é recusada; janelas que só se encostam viram uma só no cálculo. */
function noOverlap(
  windows: readonly TimeRange[],
  sameGroup: (i: number, j: number) => boolean = () => true,
) {
  return windows.every((a, i) =>
    windows.every((b, j) => i === j || !sameGroup(i, j) || a.end <= b.start || b.end <= a.start),
  );
}
const NO_OVERLAP = { message: 'Há janelas sobrepostas no mesmo dia.', path: ['windows'] };

const localWindowSchema = z
  .object({ start: localTimeSchema, end: localTimeSchema })
  .refine(startBeforeEnd, START_BEFORE_END);

/** `PUT /v1/schedule/weekly` — substitui o conjunto (RN-20). Dia da semana: 0=dom..6=sáb. */
export const weeklyScheduleInputSchema = z
  .object({
    windows: z
      .array(
        z
          .object({ weekday: z.int().min(0).max(6), start: localTimeSchema, end: localTimeSchema })
          .refine(startBeforeEnd, START_BEFORE_END),
      )
      .max(42),
  })
  .refine(
    ({ windows }) => noOverlap(windows, (i, j) => windows[i]?.weekday === windows[j]?.weekday),
    NO_OVERLAP,
  );

const noteSchema = z.string().trim().max(200).optional();

const closedExceptionSchema = z.object({ closed: z.literal(true), note: noteSchema });
const openExceptionSchema = z.object({
  closed: z.literal(false),
  windows: z.array(localWindowSchema).min(1).max(6),
  note: noteSchema,
});

/** Exceção por data: folga ou janelas customizadas (RN-21; janelas seguem Q-17). */
export const scheduleExceptionInputSchema = z.discriminatedUnion('closed', [
  closedExceptionSchema.extend({ date: localDateSchema }),
  openExceptionSchema
    .extend({ date: localDateSchema })
    .refine(({ windows }) => noOverlap(windows), NO_OVERLAP),
]);

/** Corpo de `PUT /v1/schedule/exceptions/:date` (a data vem da URL). */
export const exceptionBodySchema = z.discriminatedUnion('closed', [
  closedExceptionSchema,
  openExceptionSchema.refine(({ windows }) => noOverlap(windows), NO_OVERLAP),
]);

/** Bloqueio manual `[startAt, endAt)`; compara instantes, não texto. */
export const blockInputSchema = z
  .object({
    startAt: utcInstantSchema,
    endAt: utcInstantSchema,
    reason: z.string().trim().max(200).optional(),
  })
  .refine((b) => Date.parse(b.startAt) < Date.parse(b.endAt), {
    message: 'O início do bloqueio deve ser antes do fim.',
    path: ['endAt'],
  });

/** Parâmetros de agenda da profissional (RN-02, RN-22..25). */
export const schedulingSettingsSchema = z.object({
  timezone: timeZoneSchema,
  bufferMin: z.int().min(0).max(60),
  slotStepMin: z.union([z.literal(5), z.literal(10), z.literal(15), z.literal(30)]),
  minNoticeMin: z
    .int()
    .min(0)
    .max(7 * 24 * 60),
  bookingHorizonDays: z.int().min(1).max(365),
});

const MAX_RANGE_DAYS = 366;
const DAY_MS = 86_400_000;

/** Agendamento ativo que ficou fora do horário ou sob um bloqueio (Q-20): a UI avisa. */
export const affectedAppointmentSchema = z.object({
  id: idSchema,
  startAt: utcInstantSchema,
  endAt: utcInstantSchema,
  serviceName: z.string(),
  clientName: z.string(),
});

const affectedListSchema = z.array(affectedAppointmentSchema);

/** `GET /v1/schedule/weekly` (e corpo de saída do PUT). */
export const weeklyScheduleResponseSchema = z.object({
  windows: z.array(
    z.object({ weekday: z.int().min(0).max(6), start: localTimeSchema, end: localTimeSchema }),
  ),
});

export const weeklyScheduleMutationResponseSchema = weeklyScheduleResponseSchema.extend({
  affectedAppointments: affectedListSchema,
});

/** Exceção como a API devolve: `windows` vazio quando `closed`. */
export const exceptionResponseSchema = z.object({
  date: localDateSchema,
  closed: z.boolean(),
  windows: z.array(z.object({ start: localTimeSchema, end: localTimeSchema })),
  note: z.string().nullable(),
});

export const exceptionMutationResponseSchema = z.object({
  exception: exceptionResponseSchema,
  affectedAppointments: affectedListSchema,
});

/** `GET /v1/schedule/exceptions?from=&to=` — datas locais inclusivas, até 366 dias. */
export const exceptionListQuerySchema = z
  .object({ from: localDateSchema, to: localDateSchema })
  .refine(({ from, to }) => from <= to, {
    message: 'O fim deve ser depois do início.',
    path: ['to'],
  })
  .refine(({ from, to }) => Date.parse(to) - Date.parse(from) <= MAX_RANGE_DAYS * DAY_MS, {
    message: `Consulte no máximo ${String(MAX_RANGE_DAYS)} dias.`,
    path: ['to'],
  });

export const blockResponseSchema = z.object({
  id: idSchema,
  startAt: utcInstantSchema,
  endAt: utcInstantSchema,
  reason: z.string().nullable(),
});

export const blockMutationResponseSchema = z.object({
  block: blockResponseSchema,
  affectedAppointments: affectedListSchema,
});

/** `GET /v1/blocks?from=&to=` — bloqueios que se sobrepõem a `[from, to)`, até 366 dias. */
export const blockListQuerySchema = z
  .object({ from: utcInstantSchema, to: utcInstantSchema })
  .refine(({ from, to }) => Date.parse(from) < Date.parse(to), {
    message: 'O fim deve ser depois do início.',
    path: ['to'],
  })
  .refine(({ from, to }) => Date.parse(to) - Date.parse(from) <= MAX_RANGE_DAYS * DAY_MS, {
    message: `Consulte no máximo ${String(MAX_RANGE_DAYS)} dias.`,
    path: ['to'],
  });

export type WeeklyScheduleInput = z.infer<typeof weeklyScheduleInputSchema>;
export type ScheduleExceptionInput = z.infer<typeof scheduleExceptionInputSchema>;
export type BlockInput = z.infer<typeof blockInputSchema>;
export type SchedulingSettingsInput = z.infer<typeof schedulingSettingsSchema>;
export type ExceptionBody = z.infer<typeof exceptionBodySchema>;
export type AffectedAppointment = z.infer<typeof affectedAppointmentSchema>;
export type WeeklyScheduleResponse = z.infer<typeof weeklyScheduleResponseSchema>;
export type WeeklyScheduleMutationResponse = z.infer<typeof weeklyScheduleMutationResponseSchema>;
export type ExceptionResponse = z.infer<typeof exceptionResponseSchema>;
export type ExceptionMutationResponse = z.infer<typeof exceptionMutationResponseSchema>;
export type ExceptionListQuery = z.infer<typeof exceptionListQuerySchema>;
export type BlockResponse = z.infer<typeof blockResponseSchema>;
export type BlockMutationResponse = z.infer<typeof blockMutationResponseSchema>;
export type BlockListQuery = z.infer<typeof blockListQuerySchema>;
