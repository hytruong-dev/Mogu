import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { DishMatcherService } from '../src/places/ingest/dish-matcher.service';
import { Prisma } from '@prisma/client';

const NEW_30 = [
  'Miến lươn Hà Nội',
  'Cơm rang dưa bò',
  'Chả rươi Tứ Kỳ',
  'Vịt om sấu',
  'Canh cua mồng tơi cà pháo',
  'Bánh đúc nóng Hà Nội',
  'Thịt đông dưa chua',
  'Cá kho làng Vũ Đại',
  'Bún cá rô đồng',
  'Phở cuốn Hà Nội',
  'Gỏi cá mai Nha Trang',
  'Hến xào xúc bánh tráng',
  'Bánh tráng cuốn thịt heo Đà Nẵng',
  'Bánh ướt thịt nướng Huế',
  'Lẩu cá bớp măng chua',
  'Bánh canh hẹ Phú Yên',
  'Cơm lam gà nướng Tây Nguyên',
  'Bánh hỏi cháo lòng Bình Định',
  'Bánh đập mắm nêm Quảng Nam',
  'Cơm gà Tam Kỳ',
  'Cá lóc nướng trui miền Tây',
  'Hủ tiếu Sa Đéc',
  'Lẩu cua đồng miền Tây',
  'Bánh cóng Sóc Trăng',
  'Bún kèn Kiên Giang',
  'Bánh tằm bì nước cốt dừa',
  'Bún thịt nướng chả giò Sài Gòn',
  'Bánh xèo củ hũ dừa Bến Tre',
  'Lẩu vịt nấu chao Cần Thơ',
  'Cá kho tộ miền Tây',
];

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] });
  const prisma = app.get(PrismaService);

  const newDishes = await prisma.db.dish.findMany({
    where: { name: { in: NEW_30 }, deletedAt: null },
    select: { id: true, name: true }
  });
  const newDishIds = new Set(newDishes.map(d => d.id));

  console.log(`Tìm thấy ${newDishes.length} món ăn mới cần liên kết quán...`);
  const matcher = await new DishMatcherService(prisma).loadCatalog();
  const places = await prisma.db.place.findMany({
    select: { id: true, name: true, provider: true }
  });

  const linksData: Prisma.PlaceDishCreateManyInput[] = [];

  for (const p of places) {
    const matches = matcher.matchPlace(p.name);
    for (const m of matches) {
      if (newDishIds.has(m.dishId)) {
        linksData.push({
          placeId: p.id,
          dishId: m.dishId,
          matchStatus: m.status,
          matchScore: new Prisma.Decimal(m.score.toFixed(3)),
          sourceItemName: m.sourceItemName ?? null,
        });
      }
    }
  }

  let createdCount = 0;
  if (linksData.length > 0) {
    for (let i = 0; i < linksData.length; i += 1000) {
      const chunk = linksData.slice(i, i + 1000);
      const res = await prisma.db.placeDish.createMany({
        data: chunk,
        skipDuplicates: true,
      });
      createdCount += res.count;
    }
  }

  console.log(`✅ Đã tạo thành công ${createdCount} liên kết quán ăn với các món mới!`);
  await app.close();
}

main().catch(console.error);
