import { Module } from '@nestjs/common';
import { PublicController } from './public.controller.js';
import { PublicRepository } from './public.repository.js';
import { PublicService } from './public.service.js';

@Module({
  controllers: [PublicController],
  providers: [PublicRepository, PublicService],
})
export class PublicModule {}
