import { Module } from '@nestjs/common';
import { AppointmentsModule } from '../appointments/appointments.module.js';
import { BookingRepository } from './booking.repository.js';
import { BookingService } from './booking.service.js';
import { PublicController } from './public.controller.js';
import { PublicRepository } from './public.repository.js';
import { PublicService } from './public.service.js';

@Module({
  imports: [AppointmentsModule],
  controllers: [PublicController],
  providers: [PublicRepository, PublicService, BookingRepository, BookingService],
})
export class PublicModule {}
