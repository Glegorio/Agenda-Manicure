import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AUTH_CONFIG, authConfigFromEnv } from './auth.config.js';
import { AuthController } from './auth.controller.js';
import { AuthGuard } from './auth.guard.js';
import { AuthRepository } from './auth.repository.js';
import { AuthService } from './auth.service.js';
import { TokenService } from './token.service.js';

@Module({
  controllers: [AuthController],
  providers: [
    { provide: AUTH_CONFIG, useFactory: () => authConfigFromEnv() },
    TokenService,
    AuthRepository,
    AuthService,
    // Nega por padrão: rotas abertas precisam de @Public().
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
})
export class AuthModule {}
