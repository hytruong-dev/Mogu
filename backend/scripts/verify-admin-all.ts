import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { Reflector } from '@nestjs/core';
import { ForbiddenException } from '@nestjs/common';
import { RolesGuard } from '../src/auth/guards/roles.guard';
import { AdminNotificationsService } from '../src/admin-notifications/admin-notifications.service';
import { NotificationsService } from '../src/notifications/notifications.service';
import { PlacesService } from '../src/places/places.service';
import { ModerationService } from '../src/moderation/moderation.service';
import { AdminDashboardService } from '../src/admin-dashboard/admin-dashboard.service';
import { AdminUsersService } from '../src/admin-users/admin-users.service';
import { ConfigService } from '@nestjs/config';

async function run() {
  console.log('=== BẮT ĐẦU KIỂM THỬ TOÀN DIỆN HỆ THỐNG ADMIN ===\n');

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('LỖI: DATABASE_URL không tồn tại trong môi trường.');
    process.exit(1);
  }

  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  const prismaClient = new PrismaClient({ adapter } as any);
  const prismaService = { db: prismaClient } as any;
  const configService = new ConfigService();

  let passCount = 0;
  let failCount = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passCount++;
    } else {
      console.error(`[FAIL] ${testName}`);
      failCount++;
    }
  }

  // ── TEST 1: RolesGuard từ chối user không có role (403 Forbidden) ──
  try {
    const reflector = new Reflector();
    // Simulate handler with SUPER_ADMIN requirement
    const dummyHandler = () => {};
    Reflect.defineMetadata('roles', ['SUPER_ADMIN'], dummyHandler);

    const rolesGuard = new RolesGuard(reflector, prismaService);

    // Mock ExecutionContext for non-privileged user (no roles or unknown sub)
    const mockContext = {
      getHandler: () => dummyHandler,
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({
          user: { sub: '00000000-0000-0000-0000-000000000099' }, // non-existent or no-role user
        }),
      }),
    } as any;

    let threw403 = false;
    try {
      await rolesGuard.canActivate(mockContext);
    } catch (err: any) {
      if (err instanceof ForbiddenException) {
        threw403 = true;
      }
    }
    assert(threw403, 'RolesGuard trả về 403 Forbidden khi user không có quyền');
  } catch (e: any) {
    assert(false, `RolesGuard test failed with unexpected error: ${e.message}`);
  }

  // ── TEST 2: Export CSV danh sách user thật ──
  try {
    const adminUsersService = new AdminUsersService(prismaService, configService);
    // Find an admin user to act as actor
    const anyAdmin = await prismaClient.profile.findFirst();
    if (anyAdmin) {
      const exportJob = await adminUsersService.createUserListExport(anyAdmin.userId, {
        reasonCode: 'AUDIT',
        format: 'CSV',
      });
      assert(exportJob.jobId != null, 'Tạo job export user thành công với jobId');

      const jobDetail = await adminUsersService.getUserListExport(anyAdmin.userId, exportJob.jobId);
      assert(
        jobDetail.status === 'READY' && jobDetail.download?.url != null,
        'Job export hoàn tất với status READY và download URL hợp lệ',
      );

      // Verify file content directly
      const fileData = await adminUsersService.getExportFile(anyAdmin.userId, exportJob.jobId);
      const csvStr = fileData.content;
      const lines = csvStr.split('\r\n');
      assert(
        lines[0].includes('userId') || lines[0].includes('displayName'),
        'File CSV export có đầy đủ columns thật (userId, displayName, ...)',
      );
      assert(lines.length > 1, `File CSV chứa dữ liệu thực tế (${lines.length - 1} dòng dữ liệu)`);
    } else {
      console.log('[SKIP] Không có profile nào trong DB để test export.');
    }
  } catch (e: any) {
    assert(false, `Export CSV test failed: ${e.message}`);
  }

  // ── TEST 3: Moderation Comments (Article + Post) ──
  try {
    const notificationsService = new NotificationsService(prismaService);
    const moderationService = new ModerationService(prismaService, notificationsService);
    const commentsList = await moderationService.adminListComments({ limit: 10 });
    assert(Array.isArray(commentsList.items), 'Moderation adminListComments trả về danh sách items hợp lệ');
    assert(typeof commentsList.total === 'number', `Tổng số comments kiểm duyệt: ${commentsList.total}`);
  } catch (e: any) {
    assert(false, `Moderation comments test failed: ${e.message}`);
  }

  // ── TEST 4: Places Management ──
  try {
    const placesService = new PlacesService(prismaService);
    const placesList = await placesService.adminList({ limit: 10 });
    assert(Array.isArray(placesList.items), 'Places adminList trả về danh sách items');
    assert(typeof placesList.total === 'number', `Tổng số places trong hệ thống: ${placesList.total}`);
    if (placesList.items.length > 0) {
      assert(typeof placesList.items[0].postCount === 'number', 'Địa điểm có thống kê postCount bài đăng gắn kèm');
    }
  } catch (e: any) {
    assert(false, `Places test failed: ${e.message}`);
  }

  // ── TEST 5: Broadcast Notifications In-App + Expo ──
  try {
    const notificationsService = new NotificationsService(prismaService);
    const adminNotificationsService = new AdminNotificationsService(prismaService, notificationsService);

    // Pick a test profile
    const testUser = await prismaClient.profile.findFirst();
    if (testUser) {
      const broadcastRes = await adminNotificationsService.broadcast(testUser.userId, {
        title: '[TEST] Kiểm thử thông báo admin',
        body: 'Đây là thông báo tự động kiểm tra hệ thống broadcast Mogu.',
        type: 'SYSTEM' as any,
        scope: 'SPECIFIC_USER' as any,
        targetUser: testUser.userId,
        deepLink: 'mogu://notifications',
      });
      assert(broadcastRes.success && broadcastRes.totalRecipients === 1, 'Broadcast thông báo đến 1 user thành công');

      // Verify notification in database
      const notif = await prismaClient.notification.findFirst({
        where: { userId: testUser.userId, title: '[TEST] Kiểm thử thông báo admin' },
      });
      assert(notif != null && notif.body.includes('thông báo tự động'), 'Bản ghi Notification in-app đã được tạo trong DB');

      // Verify audit history
      const history = await adminNotificationsService.getHistory(5);
      assert(history.items.length > 0, 'Lịch sử broadcast ghi nhận lượt gửi vừa tạo');
      assert(history.items[0].title === '[TEST] Kiểm thử thông báo admin', 'Tiêu đề trong lịch sử khớp chính xác');

      // Clean up test notif
      if (notif) {
        await prismaClient.notification.delete({ where: { id: notif.id } });
      }
    }
  } catch (e: any) {
    assert(false, `Broadcast test failed: ${e.message}`);
  }

  // ── TEST 6: Dashboard Summary with WeeklyPlan & MealLog Aggregates ──
  try {
    const dashboardService = new AdminDashboardService(prismaService, configService);
    const summary = await dashboardService.getSummary('7d');
    assert(summary?.kpi?.weeklyPlans != null, 'Dashboard KPI chứa trường weeklyPlans aggregate');
    assert(summary?.kpi?.mealLogs != null, 'Dashboard KPI chứa trường mealLogs aggregate');
    assert(typeof summary?.kpi?.weeklyPlans?.total === 'number', `Tổng số weekly plan: ${summary?.kpi?.weeklyPlans?.total}`);
    assert(typeof summary?.kpi?.mealLogs?.total === 'number', `Tổng số meal logs: ${summary?.kpi?.mealLogs?.total}`);
    assert(typeof summary?.kpi?.mealLogs?.avgPerDay === 'number', `Meal logs trung bình/ngày: ${summary?.kpi?.mealLogs?.avgPerDay}`);
  } catch (e: any) {
    assert(false, `Dashboard summary test failed: ${e.message}`);
  }

  console.log(`\n=== TỔNG KẾT: ${passCount} PASS, ${failCount} FAIL ===`);
  await pool.end();

  if (failCount > 0) {
    process.exit(1);
  }
}

run().catch((e) => {
  console.error('Fatal test error:', e);
  process.exit(1);
});
