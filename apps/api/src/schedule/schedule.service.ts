import { Injectable } from '@nestjs/common';
import type {
  AffectedAppointment,
  BlockInput,
  BlockMutationResponse,
  BlockResponse,
  ExceptionBody,
  ExceptionMutationResponse,
  ExceptionResponse,
  WeeklyScheduleInput,
  WeeklyScheduleMutationResponse,
  WeeklyScheduleResponse,
} from '@agende/contracts';
import {
  addLocalDays,
  findAppointmentsNewlyOutsideWorkingHours,
  localDateOf,
  localTimeToInstant,
  type WorkingHours,
} from '@agende/scheduling';
import { Clock } from '../clock/clock.js';
import { DomainError } from '../common/domain-error.js';
import {
  type AppointmentRow,
  localDateToDb,
  timeToMinutes,
  toAffected,
  toBlockResponse,
  toDomainException,
  toExceptionResponse,
  toWeeklyResponse,
  toWeeklySchedule,
} from './schedule.mapper.js';
import { ScheduleRepository, type Tx } from './schedule.repository.js';

const accountGone = () => new DomainError('UNAUTHORIZED');
const exceptionNotFound = () => new DomainError('NOT_FOUND', 'Exceção não encontrada.');
const blockNotFound = () => new DomainError('NOT_FOUND', 'Bloqueio não encontrado.');

/** Sem limite superior prático: agendamentos manuais podem ir além do horizonte (RN-45). */
const FAR_FUTURE = localDateToDb('9999-12-31');

/**
 * Escala semanal (RN-20), exceções (RN-21) e bloqueios. Mudanças são permitidas sobre
 * agendamentos existentes, que são mantidos; a resposta lista só os que **a mudança** tirou do
 * horário (Q-20, Q-26). Escritas sob o lock da agenda (regra 1); leituras sem lock.
 */
@Injectable()
export class ScheduleService {
  constructor(
    private readonly repository: ScheduleRepository,
    private readonly clock: Clock,
  ) {}

  async getWeekly(professionalId: string): Promise<WeeklyScheduleResponse> {
    return toWeeklyResponse(
      await this.repository.listWeekly(this.repository.reader, professionalId),
    );
  }

  replaceWeekly(
    professionalId: string,
    input: WeeklyScheduleInput,
  ): Promise<WeeklyScheduleMutationResponse> {
    return this.repository.withLock(professionalId, async (tx) => {
      const timeZone = await this.timezone(tx, professionalId);
      const now = this.clock.now();
      // `today - 1`: agendamento em andamento pode ter começado ontem (duração ≤ 600 min, RN-10).
      const exceptions = (
        await this.repository.listExceptions(
          tx,
          professionalId,
          localDateToDb(addLocalDays(localDateOf(now, timeZone), -1)),
          FAR_FUTURE,
        )
      ).map(toDomainException);
      const before = toWeeklySchedule(await this.repository.listWeekly(tx, professionalId));

      await this.repository.replaceWeekly(
        tx,
        professionalId,
        input.windows.map((w) => ({
          weekday: w.weekday,
          startMin: timeToMinutes(w.start),
          endMin: timeToMinutes(w.end),
        })),
      );
      const windows = await this.repository.listWeekly(tx, professionalId);

      const upcoming = await this.repository.activeAppointments(tx, professionalId, {
        endsAfter: now,
      });
      return {
        ...toWeeklyResponse(windows),
        affectedAppointments: this.newlyOutside(
          upcoming,
          { weeklySchedule: before, exceptions },
          { weeklySchedule: toWeeklySchedule(windows), exceptions },
          timeZone,
        ),
      };
    });
  }

  async listExceptions(
    professionalId: string,
    from: string,
    to: string,
  ): Promise<ExceptionResponse[]> {
    const rows = await this.repository.listExceptions(
      this.repository.reader,
      professionalId,
      localDateToDb(from),
      localDateToDb(to),
    );
    return rows.map(toExceptionResponse);
  }

  replaceException(
    professionalId: string,
    date: string,
    body: ExceptionBody,
  ): Promise<ExceptionMutationResponse> {
    return this.repository.withLock(professionalId, async (tx) => {
      const previous = await this.repository.findException(tx, professionalId, localDateToDb(date));
      const row = await this.repository.replaceException(tx, professionalId, localDateToDb(date), {
        closed: body.closed,
        note: body.note ?? null,
        windows: body.closed
          ? []
          : body.windows.map((w) => ({
              startMin: timeToMinutes(w.start),
              endMin: timeToMinutes(w.end),
            })),
      });
      return {
        exception: toExceptionResponse(row),
        affectedAppointments: await this.affectedOnDate(
          tx,
          professionalId,
          date,
          previous ? [toDomainException(previous)] : [],
          [toDomainException(row)],
        ),
      };
    });
  }

  /** Volta a valer a escala semanal na data; pode tirar agendamentos do horário (Q-20). */
  deleteException(
    professionalId: string,
    date: string,
  ): Promise<{ affectedAppointments: AffectedAppointment[] }> {
    return this.repository.withLock(professionalId, async (tx) => {
      const previous = await this.repository.findException(tx, professionalId, localDateToDb(date));
      if (!previous) throw exceptionNotFound();
      await this.repository.deleteException(tx, professionalId, localDateToDb(date));
      return {
        affectedAppointments: await this.affectedOnDate(
          tx,
          professionalId,
          date,
          [toDomainException(previous)],
          [],
        ),
      };
    });
  }

  async listBlocks(professionalId: string, from: string, to: string): Promise<BlockResponse[]> {
    const rows = await this.repository.listBlocks(professionalId, new Date(from), new Date(to));
    return rows.map(toBlockResponse);
  }

  /** Bloqueio sobre agendamento existente é permitido; os sobrepostos voltam na resposta (Q-20). */
  createBlock(professionalId: string, input: BlockInput): Promise<BlockMutationResponse> {
    return this.repository.withLock(professionalId, async (tx) => {
      const start = new Date(input.startAt);
      const end = new Date(input.endAt);
      const block = await this.repository.createBlock(tx, professionalId, {
        startAt: start,
        endAt: end,
        reason: input.reason ?? null,
      });
      const overlapping = await this.repository.overlappingAppointments(tx, professionalId, {
        start,
        end,
        endsAfter: this.clock.now(),
      });
      return { block: toBlockResponse(block), affectedAppointments: overlapping.map(toAffected) };
    });
  }

  deleteBlock(professionalId: string, id: string): Promise<void> {
    return this.repository.withLock(professionalId, async (tx) => {
      if (!(await this.repository.deleteBlock(tx, professionalId, id))) throw blockNotFound();
    });
  }

  private async timezone(tx: Tx, professionalId: string): Promise<string> {
    const timeZone = await this.repository.timezoneOf(tx, professionalId);
    if (!timeZone) throw accountGone();
    return timeZone;
  }

  /** Agendamentos do dia local, ainda não terminados, que a troca de exceção tirou do horário. */
  private async affectedOnDate(
    tx: Tx,
    professionalId: string,
    date: string,
    exceptionsBefore: WorkingHours['exceptions'],
    exceptionsAfter: WorkingHours['exceptions'],
  ): Promise<AffectedAppointment[]> {
    const timeZone = await this.timezone(tx, professionalId);
    const sameDay = await this.repository.activeAppointments(tx, professionalId, {
      from: localTimeToInstant(date, '00:00', timeZone),
      to: localTimeToInstant(addLocalDays(date, 1), '00:00', timeZone),
      endsAfter: this.clock.now(),
    });
    const weeklySchedule = toWeeklySchedule(await this.repository.listWeekly(tx, professionalId));
    return this.newlyOutside(
      sameDay,
      { weeklySchedule, exceptions: exceptionsBefore },
      { weeklySchedule, exceptions: exceptionsAfter },
      timeZone,
    );
  }

  private newlyOutside(
    rows: AppointmentRow[],
    before: WorkingHours,
    after: WorkingHours,
    timeZone: string,
  ): AffectedAppointment[] {
    return findAppointmentsNewlyOutsideWorkingHours(
      rows.map((row) => ({ start: row.startAt, end: row.endAt, row })),
      before,
      after,
      timeZone,
    ).map(({ row }) => toAffected(row));
  }
}
