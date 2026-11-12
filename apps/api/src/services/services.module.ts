import { Module } from '@nestjs/common';
import { ServicesController } from './services.controller.js';
import { ServicesRepository } from './services.repository.js';
import { ServicesService } from './services.service.js';

@Module({
  controllers: [ServicesController],
  providers: [ServicesRepository, ServicesService],
})
export class ServicesModule {}
