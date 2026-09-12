import { Module } from '@nestjs/common';
import {
  AuthController,
  AdminAccountController,
  SessionsController,
} from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Module({
  controllers: [AuthController, AdminAccountController, SessionsController],
  providers: [AuthService, JwtAuthGuard],
  exports: [AuthService, JwtAuthGuard],
})
export class AuthModule {}
