import { Module } from '@nestjs/common';
import { ProfessionalsController } from './professionals.controller.js';
import { ProfessionalsRepository } from './professionals.repository.js';
import { ProfessionalsService } from './professionals.service.js';

@Module({
  controllers: [ProfessionalsController],
  providers: [ProfessionalsRepository, ProfessionalsService],
})
export class ProfessionalsModule {}
