import { Module } from '@nestjs/common';
import { BlocksController, ScheduleController } from './schedule.controller.js';
import { ScheduleRepository } from './schedule.repository.js';
import { ScheduleService } from './schedule.service.js';

@Module({
  controllers: [ScheduleController, BlocksController],
  providers: [ScheduleRepository, ScheduleService],
})
export class ScheduleModule {}
