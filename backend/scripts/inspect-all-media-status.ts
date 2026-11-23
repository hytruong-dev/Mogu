import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const dishes = await prisma.dish.findMany({
    where: { deletedAt: null, status: 'PUBLISHED' },
    include: {
      media: true,
      province: true,
      region: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  const withPrimary = dishes.filter(d => d.media.some(m => m.isPrimary));
  const withoutPrimary = dishes.filter(d => !d.media.some(m => m.isPrimary));

  console.log(`=== BÁO CÁO HÌNH ẢNH MÓN ĂN TRÊN TOÀN HỆ THỐNG MOGU ===`);
  console.log(`Tổng số món ĐÃ XUẤT BẢN: ${dishes.length}`);
  console.log(`Số món ĐÃ CÓ ảnh đại diện (Primary): ${withPrimary.length}`);
  console.log(`Số món CHƯA CÓ ảnh đại diện: ${withoutPrimary.length}\n`);

  console.log(`--- Danh sách các món CHƯA CÓ ảnh đại diện (${withoutPrimary.length} món) ---`);
  withoutPrimary.forEach((d, idx) => {
    console.log(`${idx + 1}. [${d.id}] "${d.name}" (${d.province?.name ?? d.region?.name ?? 'Chưa rõ'}) - Media count: ${d.media.length}`);
  });
}

main().finally(() => prisma.$disconnect());
