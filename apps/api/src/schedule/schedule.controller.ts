import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Query } from '@nestjs/common';
import {
  type AffectedAppointment,
  type BlockInput,
  blockInputSchema,
  type BlockListQuery,
  blockListQuerySchema,
  type BlockMutationResponse,
  type BlockResponse,
  type ExceptionBody,
  exceptionBodySchema,
  type ExceptionListQuery,
  exceptionListQuerySchema,
  type ExceptionMutationResponse,
  type ExceptionResponse,
  idSchema,
  localDateSchema,
  type WeeklyScheduleInput,
  weeklyScheduleInputSchema,
  type WeeklyScheduleMutationResponse,
  type WeeklyScheduleResponse,
} from '@agende/contracts';
import { CurrentProfessional } from '../auth/current-professional.decorator.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { ScheduleService } from './schedule.service.js';

const datePipe = new ZodValidationPipe(localDateSchema);

/** Escala semanal e exceções por data (RN-20, RN-21, Q-17, Q-20). */
@Controller('v1/schedule')
export class ScheduleController {
  constructor(private readonly schedule: ScheduleService) {}

  @Get('weekly')
  getWeekly(@CurrentProfessional() professionalId: string): Promise<WeeklyScheduleResponse> {
    return this.schedule.getWeekly(professionalId);
  }

  @Put('weekly')
  replaceWeekly(
    @CurrentProfessional() professionalId: string,
    @Body(new ZodValidationPipe(weeklyScheduleInputSchema)) input: WeeklyScheduleInput,
  ): Promise<WeeklyScheduleMutationResponse> {
    return this.schedule.replaceWeekly(professionalId, input);
  }

  @Get('exceptions')
  listExceptions(
    @CurrentProfessional() professionalId: string,
    @Query(new ZodValidationPipe(exceptionListQuerySchema)) query: ExceptionListQuery,
  ): Promise<ExceptionResponse[]> {
    return this.schedule.listExceptions(professionalId, query.from, query.to);
  }

  @Put('exceptions/:date')
  replaceException(
    @CurrentProfessional() professionalId: string,
    @Param('date', datePipe) date: string,
    @Body(new ZodValidationPipe(exceptionBodySchema)) body: ExceptionBody,
  ): Promise<ExceptionMutationResponse> {
    return this.schedule.replaceException(professionalId, date, body);
  }

  @Delete('exceptions/:date')
  deleteException(
    @CurrentProfessional() professionalId: string,
    @Param('date', datePipe) date: string,
  ): Promise<{ affectedAppointments: AffectedAppointment[] }> {
    return this.schedule.deleteException(professionalId, date);
  }
}

/** Bloqueios manuais da profissional (ocupam `[start, end)`, doc 02 §4). */
@Controller('v1/blocks')
export class BlocksController {
  constructor(private readonly schedule: ScheduleService) {}

  @Get()
  list(
    @CurrentProfessional() professionalId: string,
    @Query(new ZodValidationPipe(blockListQuerySchema)) query: BlockListQuery,
  ): Promise<BlockResponse[]> {
    return this.schedule.listBlocks(professionalId, query.from, query.to);
  }

  @Post()
  create(
    @CurrentProfessional() professionalId: string,
    @Body(new ZodValidationPipe(blockInputSchema)) input: BlockInput,
  ): Promise<BlockMutationResponse> {
    return this.schedule.createBlock(professionalId, input);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(
    @CurrentProfessional() professionalId: string,
    @Param('id', new ZodValidationPipe(idSchema)) id: string,
  ): Promise<void> {
    return this.schedule.deleteBlock(professionalId, id);
  }
}
