/**
 * One-off: create "Mogo review" author + 5 published food articles (admin content).
 * Run: npx ts-node -r tsconfig-paths/register prisma/seed-mogo-review-articles.ts
 */
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { randomUUID } from 'crypto';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});
const prisma = new PrismaClient({ adapter });

const AUTHOR_EMAIL = 'mogoreview@mogu.internal';
const AUTHOR_NAME = 'Mogo review';

const ARTICLES = [
  {
    slug: 'bi-kip-nau-bun-bo-hue-dung-vi',
    title: 'Bí kíp nấu bún bò Huế đúng vị miền Trung',
    summary:
      'Từ nước dùng đến sợi bún và topping: cách làm bún bò Huế đậm đà, thơm sả mà không bị mặn gắt.',
    coverImageUrl:
      'https://images.unsplash.com/photo-1557872943-16a5ac26437e?auto=format&fit=crop&w=1200&q=80',
    readMinutes: 6,
    tags: ['món ngon', 'miền Trung', 'bún'],
    topicSlugHint: ['mon-ngon', 'mon-ngon-moi-ngay'],
    content: `Nước dùng bún bò Huế là linh hồn của món ăn. Không cần cầu kỳ, nhưng cần đúng thứ tự và độ lửa.

## 1. Chọn xương và thịt

Dùng xương ống bò kết hợp giò heo để nước ngọt tự nhiên. Thịt bò tái hoặc bắp bò thái mỏng giúp ăn không bị ngán.

## 2. Nấu nước dùng đúng cách

Xương hầm trước 45–60 phút, vớt bọt sạch. Cho sả đập dập, mắm ruốc khuấy đều ở cuối để giữ mùi thơm. Nêm vừa miệng, tránh mặn ngay từ đầu vì nước sẽ cô lại.

## 3. Chuẩn bị topping

Tiết, chả cua, huyết, rau sống và ớt sa tế nên chuẩn bị riêng. Khi ăn mới chan nước dùng nóng để giữ độ giòn của topping.

## 4. Mẹo thưởng thức

Ăn nóng kèm chanh, ớt và rau sống. Nếu thích vị đậm hơn, thêm một ít sa tế cháy cạnh thay vì chỉ dùng ớt tươi.

Bún bò Huế ngon không nằm ở công thức dài, mà ở sự kiên nhẫn với nước dùng và sự cân bằng giữa cay – mặn – ngọt.`,
  },
  {
    slug: 'com-tam-sai-gon-an-sao-cho-chuan',
    title: 'Cơm tấm Sài Gòn: ăn sao cho chuẩn vị đường phố',
    summary:
      'Từ sườn nướng đến mỡ hành và đồ chua — cách thưởng thức cơm tấm đúng điệu người Sài Gòn.',
    coverImageUrl:
      'https://images.unsplash.com/photo-1603133872878-684f208fb84b?auto=format&fit=crop&w=1200&q=80',
    readMinutes: 5,
    tags: ['món ngon', 'Sài Gòn', 'cơm'],
    topicSlugHint: ['mon-ngon', 'duoi-50k'],
    content: `Cơm tấm là biểu tượng ẩm thực đường phố Sài Gòn: nhanh, no, và luôn đậm vị.

## 1. Cơm và sườn

Cơm tấm ngon nhờ hạt tấm tơi, thơm mỡ hành. Sườn phải nướng vừa cháy cạnh, ngọt nước mắm đường, không khô.

## 2. Combo “chuẩn tiệm”

Một suất cân bằng thường có: sườn, bì, chả trứng, đồ chua và nước mắm pha. Thêm trứng ốp la nếu muốn no lâu hơn.

## 3. Cách ăn hợp lý

Trộn nhẹ mỡ hành vào cơm trước, rồi chan nước mắm từ từ. Đừng đổ hết một lần để giữ vị từng miếng.

## 4. Gợi ý healthy hơn

Bớt nước mắm ngọt, thêm dưa chua và rau. Chọn sườn nạc hoặc ức gà nướng nếu muốn giảm dầu.

Không chỉ đơn thuần là một món ăn, cơm tấm Sài Gòn còn là nét văn hóa ẩm thực đặc trưng, gắn liền với nhịp sống sôi động và thân thiện của thành phố. Nếu có dịp ghé thăm Sài Gòn, đừng quên thưởng thức một đĩa cơm tấm nóng hổi để cảm nhận trọn vẹn hương vị rất riêng của nơi đây nhé!`,
  },
  {
    slug: 'pho-bo-ha-noi-nuoc-trong-vi-sau',
    title: 'Phở bò Hà Nội: nước trong mà vị sâu',
    summary:
      'Bí quyết nước dùng trong veo, thơm gừng hồi quế và cách ăn phở đúng nhịp Hà Nội.',
    coverImageUrl:
      'https://images.unsplash.com/photo-1594756202469-9ff9790b63ac?auto=format&fit=crop&w=1200&q=80',
    readMinutes: 7,
    tags: ['món ngon', 'Hà Nội', 'phở'],
    topicSlugHint: ['mon-ngon', 'dinh-duong'],
    content: `Phở Hà Nội nổi bật bởi nước dùng trong, ngọt xương và hương thảo quả thanh nhẹ.

## 1. Xương và lửa nhỏ

Xương bò hầm lửa liu riu nhiều giờ. Vớt bọt liên tục để nước trong. Không khuấy mạnh khi đang sôi.

## 2. Gia vị đặc trưng

Gừng nướng, hành cháy, quế, hồi, thảo quả rang nhẹ rồi bỏ vào túi. Mùi phải thơm chứ không gắt.

## 3. Bánh phở và thịt

Bánh phở mềm vừa, không nát. Thịt tái chín tới khi chan nước. Có thể thêm gầu, nạm hoặc gân tùy khẩu vị.

## 4. Cách ăn tinh tế

Hành lá, rau thơm vừa đủ. Hạn chế tương ớt nếu muốn cảm nhận rõ vị nước dùng.

Một tô phở ngon là sự kiên nhẫn của người nấu và sự chậm rãi của người ăn.`,
  },
  {
    slug: 'goi-cuon-tom-thit-mat-lanh-ngay-nang',
    title: 'Gỏi cuốn tôm thịt: món mát lành cho ngày nắng',
    summary:
      'Cách cuốn gỏi cuốn không bị rách bánh, nước chấm đậu phộng đậm đà và mẹo giữ rau giòn.',
    coverImageUrl:
      'https://images.unsplash.com/photo-1535399831218-d5bd36d1a6b2?auto=format&fit=crop&w=1200&q=80',
    readMinutes: 4,
    tags: ['ăn lành mạnh', 'món cuốn', 'nhẹ bụng'],
    topicSlugHint: ['an-lanh-manh', 'duoi-50k'],
    content: `Gỏi cuốn là lựa chọn nhẹ bụng, giàu rau và rất dễ biến tấu tại nhà.

## 1. Chuẩn bị nhân

Tôm luộc vừa chín, thịt ba chỉ hoặc thịt nạc luộc thái mỏng. Bún tươi, rau sống rửa sạch để ráo.

## 2. Kỹ thuật cuốn

Nhúng bánh tráng nhanh, trải rau trước rồi mới tới bún và nhân. Cuốn chặt tay nhưng không mạnh để bánh không rách.

## 3. Nước chấm đậu phộng

Tương đen hoặc tương hột xay với đậu phộng rang, chút đường, tỏi và ớt. Đặc vừa ăn, không quá đặc cũng không quá loãng.

## 4. Bảo quản

Ăn ngay khi còn tươi. Nếu chuẩn bị sớm, bọc khăn ẩm mỏng để bánh không khô.

Gỏi cuốn ngon ở sự tươi mát — càng ít dầu mỡ, càng rõ vị nguyên bản của rau và tôm thịt.`,
  },
  {
    slug: 'banh-mi-thit-nguoi-viet-bua-sang-vang',
    title: 'Bánh mì thịt: bữa sáng vàng của người Việt',
    summary:
      'Từ vỏ giòn đến nhân pate – đồ chua: cách chọn và tự làm bánh mì thịt ngon không kém tiệm.',
    coverImageUrl:
      'https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=1200&q=80',
    readMinutes: 5,
    tags: ['món ngon', 'bữa sáng', 'bánh mì'],
    topicSlugHint: ['mon-ngon', 'duoi-50k'],
    content: `Bánh mì Việt Nam nổi tiếng thế giới nhờ sự cân bằng giữa giòn, béo, chua và cay.

## 1. Ổ bánh quan trọng

Vỏ phải giòn, ruột nhẹ xốp. Nướng lại 2–3 phút trước khi kẹp để bánh “thức dậy”.

## 2. Nhân kinh điển

Pate mỏng, mayonnaise vừa đủ, thịt nguội hoặc thịt nướng, đồ chua, dưa leo, rau mùi và ớt.

## 3. Tỷ lệ vàng

Không để pate át hết. Đồ chua giúp cắt vị béo. Rau thơm thêm ở bước cuối để giữ mùi.

## 4. Biến tấu lành mạnh

Bớt mayo, thêm trứng và rau. Có thể dùng ức gà nướng thay thịt nguội.

Một ổ bánh mì ngon là bữa sáng đủ năng lượng, nhanh và rất “Việt”.`,
  },
];

async function ensureAuthor(): Promise<string> {
  const existing = await prisma.profile.findFirst({
    where: {
      OR: [
        { displayName: AUTHOR_NAME },
        { displayName: { equals: 'Mogu review', mode: 'insensitive' } },
      ],
    },
    select: { userId: true, displayName: true },
  });
  if (existing) {
    if (existing.displayName !== AUTHOR_NAME) {
      await prisma.profile.update({
        where: { userId: existing.userId },
        data: { displayName: AUTHOR_NAME },
      });
    }
    console.log(`Author exists: ${existing.userId}`);
    return existing.userId;
  }

  // Prefer linking to an existing auth user with matching email if present in accounts
  const account = await prisma.account.findFirst({
    where: {
      OR: [
        { username: 'mogoreview' },
        { username: 'mogo-review' },
      ],
    },
    select: { userId: true },
  });
  if (account?.userId) {
    const linkedUserId = account.userId;
    await prisma.profile.upsert({
      where: { userId: linkedUserId },
      update: { displayName: AUTHOR_NAME },
      create: {
        userId: linkedUserId,
        displayName: AUTHOR_NAME,
        locale: 'vi',
        timezone: 'Asia/Saigon',
      },
    });
    console.log(`Linked author to account user: ${linkedUserId}`);
    return linkedUserId;
  }

  // Create a synthetic profile userId — Article.authorId references Profile.userId
  // Profile.userId typically equals auth.users id. Insert via raw if needed.
  const userId = randomUUID();
  // Create minimal rows expected by FKs: some DBs use profiles only with existing auth users.
  // Try profile create; if FK fails, reuse any admin profile.
  try {
    await prisma.$executeRawUnsafe(
      `INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, aud, role, raw_app_meta_data, raw_user_meta_data, is_super_admin)
       VALUES ($1::uuid, $2, crypt('MogoReview!2026', gen_salt('bf')), now(), now(), now(), 'authenticated', 'authenticated', '{"provider":"email","providers":["email"]}'::jsonb, '{"display_name":"Mogo review"}'::jsonb, false)
       ON CONFLICT (id) DO NOTHING`,
      userId,
      AUTHOR_EMAIL,
    );
  } catch (e: any) {
    console.warn('auth.users insert skipped/failed:', e?.message?.slice?.(0, 200));
  }

  try {
    await prisma.profile.create({
      data: {
        userId,
        displayName: AUTHOR_NAME,
        locale: 'vi',
        timezone: 'Asia/Saigon',
        bio: 'Biên tập ẩm thực từ đội ngũ Mogu — chia sẻ mẹo nấu ăn và câu chuyện món Việt.',
      },
    });
    console.log(`Created profile author: ${userId}`);
    return userId;
  } catch (e: any) {
    console.warn('Profile create failed, fallback to existing profile:', e?.message?.slice?.(0, 200));
    const anyAdmin = await prisma.profile.findFirst({
      orderBy: { createdAt: 'asc' },
      select: { userId: true },
    });
    if (!anyAdmin) throw new Error('No profile available to author articles');
    await prisma.profile.update({
      where: { userId: anyAdmin.userId },
      data: { displayName: AUTHOR_NAME },
    });
    return anyAdmin.userId;
  }
}

async function pickTopicId(hints: string[]): Promise<string | undefined> {
  const topics = await prisma.topic.findMany({
    select: { id: true, slug: true, title: true },
  });
  if (!topics.length) return undefined;
  for (const hint of hints) {
    const hit = topics.find(
      (t) =>
        t.slug?.toLowerCase().includes(hint.toLowerCase()) ||
        t.title?.toLowerCase().includes(hint.replace(/-/g, ' ')),
    );
    if (hit) return hit.id;
  }
  const preferred = topics.find((t) =>
    /ngon|dinh dưỡng|lành|món/i.test(t.title ?? ''),
  );
  return preferred?.id ?? topics[0].id;
}

async function main() {
  console.log('Seeding Mogo review articles...');
  await prisma.profile.updateMany({
    where: { displayName: { in: ['Mogo review', 'mogo review', 'Mogu Review'] } },
    data: { displayName: 'Mogu review' },
  });
  await prisma.topic.upsert({
    where: { slug: 'mon-ngon-mua-mua' },
    update: {
      title: 'Món ngon mùa mưa',
      description: 'Món ấm bụng cho những ngày mưa',
    },
    create: {
      slug: 'mon-ngon-mua-mua',
      title: 'Món ngon mùa mưa',
      description: 'Món ấm bụng cho những ngày mưa',
      displayOrder: 1,
      isActive: true,
    },
  });

  const authorId = await ensureAuthor();
  console.log('AuthorId:', authorId);

  for (const a of ARTICLES) {
    const topicId = await pickTopicId(a.topicSlugHint);
    const existing = await prisma.article.findUnique({ where: { slug: a.slug } });
    if (existing) {
      await prisma.article.update({
        where: { id: existing.id },
        data: {
          title: a.title,
          summary: a.summary,
          content: a.content,
          coverImageUrl: a.coverImageUrl,
          readMinutes: a.readMinutes,
          likeCount: (a as any).likeCount ?? 128,
          commentCount: (a as any).commentCount ?? 12,
          status: 'PUBLISHED',
          authorId,
          topicId,
          tags: {
            deleteMany: {},
            create: a.tags.map((tag) => ({ tag })),
          },
        },
      });
      console.log(`Updated+published: ${a.slug}`);
    } else {
      await prisma.article.create({
        data: {
          slug: a.slug,
          title: a.title,
          summary: a.summary,
          content: a.content,
          coverImageUrl: a.coverImageUrl,
          readMinutes: a.readMinutes,
          likeCount: (a as any).likeCount ?? 128,
          commentCount: (a as any).commentCount ?? 12,
          status: 'PUBLISHED',
          authorId,
          topicId,
          tags: {
            create: a.tags.map((tag) => ({ tag })),
          },
        },
      });
      console.log(`Created+published: ${a.slug}`);
    }
  }

  const published = await prisma.article.findMany({
    where: { authorId, status: 'PUBLISHED' },
    select: { slug: true, title: true, topicId: true },
    orderBy: { createdAt: 'desc' },
  });
  console.log('Published by Mogo review:', published.length);
  console.log(JSON.stringify(published, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
