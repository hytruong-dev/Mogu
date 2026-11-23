import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { VIETNAM_63_SPECIALTIES } from './plan-63-provinces';

dotenv.config({ path: path.join(__dirname, '../.env') });

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log(`=== ĐỒNG BỘ PROVINCE_ID VÀ REGION_ID CHO CÁC MÓN ĐÃ CÓ TRONG DB ===\n`);

  let updatedCount = 0;

  for (const s of VIETNAM_63_SPECIALTIES) {
    if (!s.existingInDb) continue;

    const province = await prisma.province.findFirst({
      where: { code: s.provinceCode },
      include: { region: true }
    });
    if (!province) continue;

    const dish = await prisma.dish.findFirst({
      where: {
        name: { equals: s.dishName, mode: 'insensitive' },
        deletedAt: null
      }
    });

    if (dish) {
      await prisma.dish.update({
        where: { id: dish.id },
        data: {
          provinceId: province.id,
          regionId: province.regionId,
          originText: `${s.dishName} - Đặc sản tiêu biểu ${s.provinceName} (${province.region.name})`,
        }
      });
      console.log(`✅ [${s.provinceCode}] ${s.provinceName} -> Gán món "${dish.name}" (ID: ${dish.id})`);
      updatedCount++;
    }
  }

  console.log(`\n🎉 Đã cập nhật thành công ${updatedCount} món đặc sản của các tỉnh hiện có!`);
}

main().finally(() => prisma.$disconnect());
