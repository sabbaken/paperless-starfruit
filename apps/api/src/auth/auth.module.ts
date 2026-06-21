import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthGuard } from './auth.guard';
import { LoginThrottleGuard } from './login-throttle.guard';

/**
 * Single-admin auth. Registers {@link AuthGuard} as a global guard so every
 * route is locked unless `@Public()`. {@link AuthService} is exported for the
 * guard's token verification (and any future consumer).
 */
@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    LoginThrottleGuard,
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
  exports: [AuthService],
})
export class AuthModule {}
