import * as path from 'path';
import * as dotenv from 'dotenv';
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

dotenv.config({ path: path.join(__dirname, '../.env.local') });
dotenv.config({ path: path.join(__dirname, '../.env') });

async function main() {
  const pool = new pg.Pool({ connectionString: process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter } as any);
  try {
    const dishes = await prisma.dish.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        name: true,
        servings: true,
        status: true,
        createdAt: true,
        _count: {
          select: {
            dishIngredients: true,
            recipeSteps: true,
            media: true,
          },
        },
      },
    });

    console.log(`\n=== TẤT CẢ ${dishes.length} MÓN TRONG DATABASE ===\n`);
    dishes.forEach((d, idx) => {
      console.log(
        `${(idx + 1).toString().padStart(2, ' ')}. [${d.status}] ${d.name} | Khẩu phần: ${d.servings} | ${d._count.dishIngredients} nguyên liệu | ${d._count.recipeSteps} bước | ${d._count.media} ảnh`,
      );
    });
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}
main().catch(console.error);
