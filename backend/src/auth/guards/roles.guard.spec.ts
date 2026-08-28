import { RolesGuard } from './roles.guard';
import { Reflector } from '@nestjs/core';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SystemRole } from '@prisma/client';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: Reflector;
  let prisma: { db: { profile: { findUnique: jest.Mock } } };

  beforeEach(() => {
    reflector = new Reflector();
    prisma = { db: { profile: { findUnique: jest.fn() } } };
    guard = new RolesGuard(reflector, prisma as unknown as PrismaService);
  });

  const makeContext = (user: any): ExecutionContext =>
    ({
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({ user, userRoles: [], profileId: null }),
      }),
    }) as unknown as ExecutionContext;

  it('should allow access when no roles required', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(null);
    const ctx = makeContext({ sub: 'user-1' });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('should throw ForbiddenException when user has no sub', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([SystemRole.REVIEWER]);
    const ctx = makeContext({});
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('should allow SUPER_ADMIN to access any role-protected route', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([SystemRole.REVIEWER]);
    prisma.db.profile.findUnique.mockResolvedValueOnce({
      id: 'profile-1',
      profileRoles: [{ role: SystemRole.SUPER_ADMIN }],
    });
    const ctx = makeContext({ sub: 'user-1' });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('should allow user with matching role', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([SystemRole.CONTENT_ADMIN]);
    prisma.db.profile.findUnique.mockResolvedValueOnce({
      id: 'profile-2',
      profileRoles: [{ role: SystemRole.CONTENT_ADMIN }],
    });
    const ctx = makeContext({ sub: 'user-2' });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('should throw ForbiddenException when user lacks required role', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([SystemRole.SUPER_ADMIN]);
    prisma.db.profile.findUnique.mockResolvedValueOnce({
      id: 'profile-3',
      profileRoles: [{ role: SystemRole.USER }],
    });
    const ctx = makeContext({ sub: 'user-3' });
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('should throw ForbiddenException when profile not found', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([SystemRole.REVIEWER]);
    prisma.db.profile.findUnique.mockResolvedValueOnce(null);
    const ctx = makeContext({ sub: 'user-4' });
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(ForbiddenException);
  });
});
