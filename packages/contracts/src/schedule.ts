import { z } from 'zod';
import { localDateSchema, localTimeSchema, timeZoneSchema, utcInstantSchema } from './common.ts';

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

/** Exceção por data: folga ou janelas customizadas (RN-21; janelas seguem Q-17). */
export const scheduleExceptionInputSchema = z.discriminatedUnion('closed', [
  z.object({ date: localDateSchema, closed: z.literal(true), note: noteSchema }),
  z
    .object({
      date: localDateSchema,
      closed: z.literal(false),
      windows: z.array(localWindowSchema).min(1).max(6),
      note: noteSchema,
    })
    .refine(({ windows }) => noOverlap(windows), NO_OVERLAP),
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

/** `PATCH /v1/me` (parte de agenda): parcial, mas não vazio. */
export const schedulingSettingsUpdateSchema = schedulingSettingsSchema
  .partial()
  .refine((patch) => Object.keys(patch).length > 0, 'Nada para atualizar.');

export type WeeklyScheduleInput = z.infer<typeof weeklyScheduleInputSchema>;
export type ScheduleExceptionInput = z.infer<typeof scheduleExceptionInputSchema>;
export type BlockInput = z.infer<typeof blockInputSchema>;
export type SchedulingSettingsInput = z.infer<typeof schedulingSettingsSchema>;
export type SchedulingSettingsUpdate = z.infer<typeof schedulingSettingsUpdateSchema>;
