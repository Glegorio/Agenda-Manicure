import { Global, Module } from '@nestjs/common';
import { DATABASE_URL, PrismaService } from './prisma.service.js';

@Global()
@Module({
  providers: [
    {
      provide: DATABASE_URL,
      useFactory: (): string => {
        const url = process.env['DATABASE_URL'];
        if (!url) throw new Error('DATABASE_URL não definido.');
        return url;
      },
    },
    PrismaService,
  ],
  exports: [PrismaService, DATABASE_URL],
})
export class PrismaModule {}
