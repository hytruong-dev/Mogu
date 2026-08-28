import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { createClient } from '@supabase/supabase-js';
import { ConfigService } from '@nestjs/config';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly config: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Skip guard cho routes đánh dấu @Public()
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers['authorization'];

    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Thiếu hoặc sai định dạng Authorization header');
    }

    const token = authHeader.slice(7);

    try {
      const supabase = createClient(
        this.config.get<string>('app.supabase.url')!,
        this.config.get<string>('app.supabase.secretKey')!,
      );

      const { data, error } = await supabase.auth.getUser(token);
      if (error || !data.user) {
        throw new UnauthorizedException('Token không hợp lệ hoặc đã hết hạn');
      }

      // Chuẩn hóa: thêm `sub` = user.id để tương thích cả decorator @CurrentUser('sub') và @CurrentUser()
      request.user = { ...data.user, sub: data.user.id };
      request.accessToken = token;
      return true;
    } catch {
      throw new UnauthorizedException('Token không hợp lệ hoặc đã hết hạn');
    }
  }
}
