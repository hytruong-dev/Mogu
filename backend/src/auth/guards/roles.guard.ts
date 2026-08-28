import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SystemRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<SystemRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // Nếu không có yêu cầu role → pass (cho JwtAuthGuard xử lý)
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user?.sub) {
      throw new ForbiddenException({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Bạn cần đăng nhập để thực hiện thao tác này.',
        },
      });
    }

    // Lấy profile từ userId
    const profile = await this.prisma.db.profile.findUnique({
      where: { userId: user.sub },
      select: {
        id: true,
        profileRoles: {
          select: { role: true },
        },
      },
    });

    if (!profile) {
      throw new ForbiddenException({
        error: {
          code: 'PROFILE_NOT_FOUND',
          message: 'Không tìm thấy profile.',
        },
      });
    }

    const userRoles = profile.profileRoles.map((pr) => pr.role);

    // SUPER_ADMIN bypass tất cả
    if (userRoles.includes(SystemRole.SUPER_ADMIN)) {
      return true;
    }

    const hasRole = requiredRoles.some((role) => userRoles.includes(role));
    if (!hasRole) {
      throw new ForbiddenException({
        error: {
          code: 'INSUFFICIENT_ROLE',
          message: `Yêu cầu quyền: ${requiredRoles.join(' hoặc ')}.`,
        },
      });
    }

    // Inject roles vào request để downstream dùng
    request.userRoles = userRoles;
    request.profileId = profile.id;

    return true;
  }
}
