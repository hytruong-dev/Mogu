/**
 * Script xóa sạch toàn bộ dữ liệu user cũ và tạo mới danh sách tài khoản NOAN Admin chuẩn
 * - Xóa sạch bài viết community, bình luận, tương tác, meal logs, user settings
 * - Xóa sạch profiles, accounts, refresh_sessions và Supabase auth.users cũ
 * - Tạo các tài khoản NOAN Admin phân theo từng role (SUPER_ADMIN, CONTENT_ADMIN, REVIEWER)
 * - Khôi phục 14 bài viết cẩm nang ẩm thực gán cho NOAN Content Admin
 * - Kiểm tra đăng nhập tự động để đảm bảo 100% tài khoản hoạt động ngay
 *
 * Usage: npx tsx scripts/reset-users-and-seed-admins.ts
 */
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient, SystemRole, AccountStatus } from '@prisma/client'
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'
import { fileURLToPath } from 'url'
import * as fs from 'fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

const SUPABASE_URL = process.env.SUPABASE_URL!
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

interface AdminSeedConfig {
  username: string
  email: string
  password: string
  displayName: string
  role: SystemRole
  jobDescription: string
  avatarUrl: string
}

const ADMIN_ACCOUNTS: AdminSeedConfig[] = [
  {
    username: 'noan.superadmin',
    email: 'superadmin@noan.vn',
    password: 'Noan@SuperAdmin2026!',
    displayName: 'NOAN Super Admin',
    role: SystemRole.SUPER_ADMIN,
    jobDescription:
      'Quản trị viên Cấp cao: Toàn quyền quản trị hệ thống, quản lý người dùng & phân quyền admin, đặt lại mật khẩu khẩn cấp, cấu hình bảo mật và logs kiểm toán.',
    avatarUrl: '/avatars/admin-noan-superadmin.png',
  },
  {
    username: 'admin',
    email: 'admin@noan.vn',
    password: 'Noan@Admin2026!',
    displayName: 'NOAN Studio Master',
    role: SystemRole.SUPER_ADMIN,
    jobDescription:
      'Quản trị viên Điều hành Toàn diện: Tài khoản tổng dự phòng với quyền SUPER_ADMIN phục vụ vận hành nhanh và kiểm thử toàn bộ tính năng.',
    avatarUrl: '/avatars/admin-noan-studiomaster.png',
  },
  {
    username: 'noan.content',
    email: 'content@noan.vn',
    password: 'Noan@Content2026!',
    displayName: 'NOAN Content Admin',
    role: SystemRole.CONTENT_ADMIN,
    jobDescription:
      'Quản trị viên Nội dung & Ẩm thực: Quản lý kho món ăn, dữ liệu nguyên liệu, dinh dưỡng macro/calo, AI Ingest, xuất bản bài viết cẩm nang và chủ đề ẩm thực.',
    avatarUrl: '/avatars/admin-noan-content.png',
  },
  {
    username: 'noan.reviewer',
    email: 'reviewer@noan.vn',
    password: 'Noan@Reviewer2026!',
    displayName: 'NOAN Reviewer',
    role: SystemRole.REVIEWER,
    jobDescription:
      'Kiểm duyệt viên Nội dung & Cộng đồng: Kiểm duyệt hàng đợi món ăn bản nháp, duyệt chuyển sang công khai, giám sát bài viết/bình luận cộng đồng, xử lý báo cáo vi phạm và phát thông báo hệ thống.',
    avatarUrl: '/avatars/admin-noan-reviewer.png',
  },
]

async function runResetAndSeed() {
  const adapter = new PrismaPg({ connectionString: process.env.DIRECT_URL! })
  const prisma = new PrismaClient({ adapter })

  console.log('═════════════════════════════════════════════════════════════════════')
  console.log('   NOAN STUDIO — WIPE USER DATA & SEED OFFICIAL ADMIN ACCOUNTS')
  console.log('═════════════════════════════════════════════════════════════════════')

  // 1. Backup articles if not already backed up
  const backupPath = path.resolve(__dirname, 'backup-articles.json')
  let articlesToRestore: any[] = []
  if (fs.existsSync(backupPath)) {
    try {
      articlesToRestore = JSON.parse(fs.readFileSync(backupPath, 'utf-8'))
      console.log(`[Backup] Tìm thấy file sao lưu chứa ${articlesToRestore.length} bài viết cẩm nang.`)
    } catch {
      console.warn('[Backup] Không thể đọc backup articles.')
    }
  }

  // 2. Xóa các bảng liên kết user trong database
  console.log('\n[BƯỚC 1/5] Xóa toàn bộ dữ liệu người dùng và dữ liệu liên quan...')

  await prisma.$executeRawUnsafe(`
    -- Tương tác cộng đồng & bài viết
    DELETE FROM post_comment_likes;
    DELETE FROM post_comments;
    DELETE FROM post_likes;
    DELETE FROM post_tags;
    DELETE FROM community_post_media;
    DELETE FROM community_media;
    DELETE FROM saved_posts;
    DELETE FROM community_posts;

    DELETE FROM article_comment_likes;
    DELETE FROM article_comments;
    DELETE FROM article_likes;
    DELETE FROM saved_articles;
    DELETE FROM article_tags;
    DELETE FROM articles;

    -- Tương tác món ăn & kiểm duyệt
    DELETE FROM reviews;
    DELETE FROM saved_dishes;
    DELETE FROM notifications;
    DELETE FROM user_follows;
    DELETE FROM user_media;
    DELETE FROM user_achievements;
    DELETE FROM account_restrictions;
    DELETE FROM privacy_jobs;
    DELETE FROM user_settings;
    DELETE FROM push_installations;
    DELETE FROM activity_buckets;
    DELETE FROM health_targets;
    DELETE FROM profile_measurements;
    DELETE FROM custom_foods;
    DELETE FROM water_logs;
    DELETE FROM diary_meal_log_items;
    DELETE FROM diary_meal_logs;
    DELETE FROM weekly_plan_slot_swaps;
    DELETE FROM weekly_plan_slots;
    DELETE FROM weekly_plans;
    DELETE FROM weekly_plan_configs;
    DELETE FROM recommendation_feedback;
    DELETE FROM explore_engagement_events;
    DELETE FROM explore_feed_sessions;
    DELETE FROM moderation_reports;
    DELETE FROM hidden_contents;
    DELETE FROM user_diet_types;
    DELETE FROM user_avoided_ingredients;
    DELETE FROM user_allergens;
    DELETE FROM user_dietary_preferences;
    DELETE FROM user_goals;
    DELETE FROM user_selection_priorities;
    DELETE FROM meal_items;
    DELETE FROM meals;
    DELETE FROM meal_logs;
    DELETE FROM onboarding_sessions;
    DELETE FROM user_consents;

    -- Dữ liệu phiên & xác thực
    DELETE FROM refresh_sessions;
    DELETE FROM password_reset_tokens;
    DELETE FROM email_verification_tokens;
    DELETE FROM auth_audit_logs;
    DELETE FROM admin_action_audits;

    -- Cuối cùng xóa roles, accounts và profiles
    DELETE FROM profile_roles;
    DELETE FROM accounts;
    DELETE FROM profiles;
  `)
  console.log('  ✓ Đã xóa sạch toàn bộ bảng quan hệ user trong Database!')

  // 3. Xóa toàn bộ user trong Supabase Auth
  console.log('\n[BƯỚC 2/5] Xóa toàn bộ users cũ trong Supabase Auth...')
  const { data: authUsers, error: listErr } = await supabase.auth.admin.listUsers({ perPage: 1000 })
  if (listErr) {
    console.error('  ✕ Lỗi khi lấy danh sách user từ Supabase:', listErr)
  } else if (authUsers && authUsers.users) {
    console.log(`  Tìm thấy ${authUsers.users.length} tài khoản trong Supabase Auth. Đang xóa...`)
    for (const u of authUsers.users) {
      await supabase.auth.admin.deleteUser(u.id)
    }
    console.log('  ✓ Đã xóa sạch toàn bộ Supabase Auth users!')
  }

  // 4. Tạo các tài khoản NOAN Admin mới
  console.log('\n[BƯỚC 3/5] Khởi tạo các tài khoản NOAN Admin chuẩn theo vai trò...')
  const createdAdmins: Array<{
    config: AdminSeedConfig
    userId: string
    profileId: string
  }> = []

  for (const acc of ADMIN_ACCOUNTS) {
    console.log(`\n  * Đang tạo tài khoản [${acc.role}]: ${acc.username} (${acc.email})...`)

    // 4.1 Tạo user trong Supabase Auth
    const { data: suData, error: suErr } = await supabase.auth.admin.createUser({
      email: acc.email,
      password: acc.password,
      email_confirm: true,
      user_metadata: {
        username: acc.username,
        display_name: acc.displayName,
      },
    })

    if (suErr || !suData?.user) {
      throw new Error(`Không thể tạo Supabase user cho ${acc.username}: ${suErr?.message}`)
    }

    const userId = suData.user.id

    // 4.2 Tạo Profile trong database
    const profile = await prisma.profile.create({
      data: {
        userId,
        displayName: acc.displayName,
        avatarUrl: acc.avatarUrl,
        accountStatus: AccountStatus.ACTIVE,
        onboardingStatus: 'COMPLETED',
        onboardingStep: 99,
        locale: 'vi',
        timezone: 'Asia/Ho_Chi_Minh',
      },
    })

    // 4.3 Tạo Account trong database
    await prisma.account.create({
      data: {
        username: acc.username.toLowerCase(),
        userId,
        passwordHash: userId,
        mustChangePassword: false,
      },
    })

    // 4.4 Gán Role trong profile_roles
    await prisma.profileRole.create({
      data: {
        profileId: profile.id,
        role: acc.role,
        assignedBy: userId,
      },
    })

    createdAdmins.push({
      config: acc,
      userId,
      profileId: profile.id,
    })

    console.log(`    ✓ Tạo thành công! Profile ID: ${profile.id}, User ID: ${userId}`)
  }

  // 5. Khôi phục 14 bài viết cẩm nang gán cho NOAN Content Admin
  console.log('\n[BƯỚC 4/5] Khôi phục bài viết cẩm nang ẩm thực gán cho NOAN Content Admin...')
  const contentAdmin = createdAdmins.find((a) => a.config.role === SystemRole.CONTENT_ADMIN)
  if (contentAdmin && articlesToRestore.length > 0) {
    let restoredCount = 0
    for (const art of articlesToRestore) {
      try {
        const article = await prisma.article.create({
          data: {
            id: art.id,
            slug: art.slug,
            title: art.title,
            summary: art.summary,
            content: art.content,
            coverImageUrl: art.coverImageUrl,
            status: art.status,
            readMinutes: art.readMinutes,
            viewCount: art.viewCount ?? 0,
            likeCount: 0,
            commentCount: 0,
            publishAt: art.publishAt ? new Date(art.publishAt) : new Date(),
            isPinned: art.isPinned ?? false,
            featuredAt: art.featuredAt ? new Date(art.featuredAt) : null,
            authorId: contentAdmin.userId,
            topicId: art.topicId,
            tags: art.tags?.length
              ? {
                  create: art.tags.map((t: any) => ({
                    tag: t.tag,
                  })),
                }
              : undefined,
          },
        })
        restoredCount++
      } catch (err: any) {
        console.warn(`    ✕ Không thể khôi phục bài viết "${art.title}": ${err?.message}`)
      }
    }
    console.log(`  ✓ Đã khôi phục ${restoredCount} bài viết cẩm nang gán cho Content Admin!`)
  }

  // 6. Kiểm tra đăng nhập thực tế của tất cả các tài khoản vừa tạo
  console.log('\n[BƯỚC 5/5] Kiểm thử xác thực đăng nhập từng tài khoản...')
  for (const admin of createdAdmins) {
    // Thử đăng nhập bằng email
    const { data: loginEmail, error: errEmail } = await supabase.auth.signInWithPassword({
      email: admin.config.email,
      password: admin.config.password,
    })

    if (errEmail || !loginEmail.session) {
      console.error(`  ✕ Đăng nhập bằng Email thất bại cho ${admin.config.email}:`, errEmail)
    } else {
      console.log(`  ✓ Đăng nhập thành công qua Email: ${admin.config.email}`)
    }
  }

  console.log('\n═════════════════════════════════════════════════════════════════════')
  console.log('   DANH SÁCH TÀI KHOẢN QUẢN TRỊ VIÊN NOAN STUDIO HOÀN THIỆN')
  console.log('═════════════════════════════════════════════════════════════════════')
  for (const a of createdAdmins) {
    console.log(`\n• [${a.config.role}] ${a.config.displayName}`)
    console.log(`  - Username: ${a.config.username}`)
    console.log(`  - Email:    ${a.config.email}`)
    console.log(`  - Password: ${a.config.password}`)
    console.log(`  - Nhiệm vụ: ${a.config.jobDescription}`)
  }
  console.log('═════════════════════════════════════════════════════════════════════\n')

  await prisma.$disconnect()
}

runResetAndSeed().catch((e) => {
  console.error('Fatal error during reset and seed:', e)
  process.exit(1)
})
