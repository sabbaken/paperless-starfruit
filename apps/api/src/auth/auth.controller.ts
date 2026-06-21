import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  loginInputSchema,
  registerInputSchema,
  type AuthResult,
  type AuthStatus,
  type LoginInput,
  type RegisterInput,
} from '@paperless-starfruit/shared';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { AuthService, type AuthUser } from './auth.service';
import { LoginThrottleGuard } from './login-throttle.guard';
import { Public } from './public.decorator';

const registerPipe = new ZodValidationPipe(registerInputSchema);
const loginPipe = new ZodValidationPipe(loginInputSchema);

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /** Public bootstrap state for the web gate (claimed? token still valid?). */
  @Public()
  @Get('status')
  status(@Headers('authorization') authorization?: string): AuthStatus {
    const token = authorization?.startsWith('Bearer ')
      ? authorization.slice('Bearer '.length)
      : null;
    return {
      initialized: this.auth.hasAdmin(),
      authenticated: token ? this.auth.verify(token) !== null : false,
    };
  }

  /** First-run setup — creates the one admin. 409 once an admin exists. */
  @Public()
  @UseGuards(LoginThrottleGuard)
  @Post('register')
  @HttpCode(201)
  register(@Body(registerPipe) body: RegisterInput): AuthResult {
    return this.auth.register(body);
  }

  @Public()
  @UseGuards(LoginThrottleGuard)
  @Post('login')
  @HttpCode(200)
  login(@Body(loginPipe) body: LoginInput): AuthResult {
    return this.auth.login(body);
  }

  /** The logged-in admin (verifies the bearer token via the global guard). */
  @Get('me')
  me(@Req() req: Request & { user?: AuthUser }): AuthUser {
    return { username: req.user?.username ?? '' };
  }
}
