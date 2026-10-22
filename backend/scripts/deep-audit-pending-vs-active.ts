import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const prisma = new PrismaClient({ adapter });

  const activeIngredients = await prisma.ingredient.findMany({
    where: { isActive: true },
    select: {
      id: true,
      code: true,
      name: true,
      groupLabel: true,
      imageUrl: true,
      identityNormalized: true,
      searchFolded: true,
    },
    orderBy: { name: 'asc' }
  });

  const pendingIngredients = await prisma.ingredient.findMany({
    where: { status: 'PENDING_REVIEW' },
    select: {
      id: true,
      code: true,
      name: true,
      groupLabel: true,
      imageUrl: true,
      dishIngredients: {
        select: {
          id: true,
          dish: { select: { id: true, name: true } },
          rawText: true,
          quantity: true,
          unit: true
        }
      }
    },
    orderBy: { name: 'asc' }
  });

  console.log(`Active count: ${activeIngredients.length}`);
  console.log(`Pending count: ${pendingIngredients.length}`);

  const auditResults = pendingIngredients.map((p) => {
    const pName = p.name.trim();
    const pLower = pName.toLowerCase();
    const dishes = p.dishIngredients.map((di) => di.dish.name);

    // Tìm các ứng viên phù hợp trong activeIngredients
    const candidates = activeIngredients.map((a) => {
      const aLower = a.name.toLowerCase().trim();
      let score = 0;
      let reason = '';

      if (aLower === pLower) {
        score = 100;
        reason = 'Khớp chính xác 100%';
      } else if (pLower.startsWith(aLower) || aLower.startsWith(pLower)) {
        score = 85;
        reason = 'Khớp tiền tố';
      } else if (pLower.includes(aLower) && aLower.length >= 3) {
        score = 75;
        reason = `Tên chứa '${a.name}'`;
      } else if (aLower.includes(pLower) && pLower.length >= 3) {
        score = 70;
        reason = `Được chứa trong '${a.name}'`;
      }

      return {
        activeId: a.id,
        activeCode: a.code,
        activeName: a.name,
        activeGroup: a.groupLabel,
        activeImage: a.imageUrl,
        score,
        reason
      };
    })
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score);

    return {
      pendingId: p.id,
      pendingCode: p.code,
      pendingName: p.name,
      pendingGroup: p.groupLabel,
      pendingImage: p.imageUrl,
      usedInDishes: dishes,
      dishCount: dishes.length,
      topCandidates: candidates.slice(0, 5)
    };
  });

  const outputPath = path.join(__dirname, 'pending-audit-results.json');
  fs.writeFileSync(outputPath, JSON.stringify(auditResults, null, 2), 'utf8');

  console.log(`\nĐã ghi kết quả phân tích vào ${outputPath}`);
}

main().catch(console.error);
