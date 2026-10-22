import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is not defined in .env');
}

const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const pending = await prisma.ingredient.findMany({
    where: {
      status: 'PENDING_REVIEW',
    },
    include: {
      dishIngredients: {
        include: {
          dish: {
            select: { name: true },
          },
        },
      },
    },
    orderBy: {
      name: 'asc',
    },
  });

  console.log(`=== DANH SÁCH NGUYÊN LIỆU "CẦN DUYỆT" HIỆN TẠI TRONG DB (${pending.length} MỤC) ===\n`);
  pending.forEach((p, idx) => {
    const dishNames = p.dishIngredients.map((di) => di.dish.name).join(', ');
    const hasImage = p.imageUrl ? '✅ Có ảnh' : '❌ Chưa có ảnh';
    console.log(`${idx + 1}. [${p.code}] "${p.name}" (${p.groupLabel || 'N/A'}) - ${hasImage}`);
    console.log(`   Dùng trong: ${dishNames || 'Không có món nào'}`);
    if (p.imageUrl) {
      console.log(`   Ảnh: ${p.imageUrl}`);
    }
  });

  const activeCount = await prisma.ingredient.count({ where: { isActive: true } });
  console.log(`\nTổng số Active: ${activeCount}`);
  console.log(`Tổng số Pending: ${pending.length}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
