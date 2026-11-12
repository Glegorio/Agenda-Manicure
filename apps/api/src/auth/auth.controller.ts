import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import {
  type AuthSessionResponse,
  type LoginRequest,
  loginRequestSchema,
  type LogoutRequest,
  logoutRequestSchema,
  type RefreshRequest,
  refreshRequestSchema,
  type RegisterRequest,
  registerRequestSchema,
} from '@agende/contracts';
import { RateLimit } from '../common/rate-limit.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { AuthService } from './auth.service.js';
import { Public } from './public.decorator.js';

@Public()
@Controller('v1/auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  @RateLimit('auth')
  register(
    @Body(new ZodValidationPipe(registerRequestSchema)) body: RegisterRequest,
  ): Promise<AuthSessionResponse> {
    return this.auth.register(body);
  }

  @Post('login')
  @RateLimit('auth')
  @HttpCode(200)
  login(
    @Body(new ZodValidationPipe(loginRequestSchema)) body: LoginRequest,
  ): Promise<AuthSessionResponse> {
    return this.auth.login(body);
  }

  @Post('refresh')
  @RateLimit('auth')
  @HttpCode(200)
  refresh(
    @Body(new ZodValidationPipe(refreshRequestSchema)) body: RefreshRequest,
  ): Promise<AuthSessionResponse> {
    return this.auth.refresh(body.refreshToken);
  }

  @Post('logout')
  @HttpCode(204)
  logout(@Body(new ZodValidationPipe(logoutRequestSchema)) body: LogoutRequest): Promise<void> {
    return this.auth.logout(body.refreshToken);
  }
}
