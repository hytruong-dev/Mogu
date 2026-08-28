import { SetMetadata } from '@nestjs/common';
import { SystemRole } from '@prisma/client';

export const ROLES_KEY = 'roles';

/** Decorator chỉ định role(s) được phép. Dùng cùng RolesGuard. */
export const Roles = (...roles: SystemRole[]) => SetMetadata(ROLES_KEY, roles);
