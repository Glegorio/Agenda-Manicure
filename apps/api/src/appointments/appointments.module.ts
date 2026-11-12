import { Module } from '@nestjs/common';
import { AppointmentEvents } from './appointment-events.js';
import { AppointmentsController } from './appointments.controller.js';
import { AppointmentsRepository } from './appointments.repository.js';
import { AppointmentsService } from './appointments.service.js';

@Module({
  controllers: [AppointmentsController],
  providers: [AppointmentsRepository, AppointmentsService, AppointmentEvents],
  exports: [AppointmentsService],
})
export class AppointmentsModule {}
