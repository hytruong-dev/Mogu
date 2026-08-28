import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter } as any);

async function main() {
  // ── Lấy region IDs ────────────────────────────────────────────────────────
  const regions = await prisma.region.findMany({ select: { id: true, name: true } });
  console.log('Regions:', regions);

  const mienBac = regions.find((r) => r.name.toLowerCase().includes('bắc'));
  const mienTrung = regions.find((r) => r.name.toLowerCase().includes('trung'));

  console.log('Miền Bắc:', mienBac);
  console.log('Miền Trung:', mienTrung);

  // ── Dữ liệu 5 món ăn ─────────────────────────────────────────────────────
  const dishes = [
    {
      name: 'Bún bò Huế',
      shortDescription:
        'Đặc sản Huế với nước dùng đậm đà từ sả và mắm ruốc, kết hợp bún sợi to, bắp bò, giò heo và rau ăn kèm. Món có hương vị thơm, cay nhẹ đến cay tùy khẩu vị.',
      regionId: mienTrung?.id,
      difficulty: 'EASY' as const,
      prepMinutes: 10,
      cookMinutes: 150,
      priceMin: 30000,
      priceMax: 50000,
      steps: [
        { stepOrder: 1, instruction: 'Sơ chế và chần xương, giò heo và thịt bò để làm sạch.', durationMin: 15 },
        { stepOrder: 2, instruction: 'Nấu nước dùng cùng sả, hành, gừng; vớt bọt để nước trong.', durationMin: 30 },
        { stepOrder: 3, instruction: 'Thêm mắm ruốc Huế, dầu điều và gia vị, sau đó hầm đến khi thịt mềm và nước dùng đậm vị.', durationMin: 90 },
        { stepOrder: 4, instruction: 'Luộc bún, cắt thịt và chuẩn bị rau sống, giá, hoa chuối cùng các loại rau thơm.', durationMin: 15 },
        { stepOrder: 5, instruction: 'Cho bún vào tô, xếp thịt và giò heo, chan nước dùng nóng rồi dùng kèm rau và chanh, ớt.', durationMin: 5 },
      ],
    },
    {
      name: 'Phở bò',
      shortDescription:
        'Món nước nổi tiếng của Việt Nam với nước dùng trong, thơm mùi quế, hồi, gừng và hành nướng, ăn cùng bánh phở mềm và thịt bò.',
      regionId: mienBac?.id,
      difficulty: 'EASY' as const,
      prepMinutes: 25,
      cookMinutes: 75,
      priceMin: 25000,
      priceMax: 45000,
      steps: [
        { stepOrder: 1, instruction: 'Rửa, chần xương và thịt bò; để ráo.', durationMin: 15 },
        { stepOrder: 2, instruction: 'Nướng hành tây, gừng và chuẩn bị quế, hồi cùng các gia vị tạo mùi thơm.', durationMin: 10 },
        { stepOrder: 3, instruction: 'Ninh xương và thịt bò, thường xuyên vớt bọt để nước dùng trong.', durationMin: 60 },
        { stepOrder: 4, instruction: 'Nêm nước dùng với muối, nước mắm, đường phèn và gia vị phở.', durationMin: 5 },
        { stepOrder: 5, instruction: 'Trụng bánh phở, xếp thịt bò lên trên, chan nước dùng nóng và ăn kèm hành, rau thơm, chanh, ớt.', durationMin: 5 },
      ],
    },
    {
      name: 'Cơm chiên Dương Châu',
      shortDescription:
        'Cơm chiên hạt tơi kết hợp trứng, rau củ và thịt hoặc hải sản, nêm bằng nước tương, nước mắm và gia vị để tạo vị mặn thơm, dễ ăn.',
      regionId: undefined,
      difficulty: 'EASY' as const,
      prepMinutes: 15,
      cookMinutes: 15,
      priceMin: 15000,
      priceMax: 35000,
      steps: [
        { stepOrder: 1, instruction: 'Dùng cơm nguội, tơi hạt và để ráo; sơ chế cà rốt, đậu Hà Lan, thịt và các nguyên liệu đi kèm.', durationMin: 10 },
        { stepOrder: 2, instruction: 'Đánh trứng, chiên vừa chín rồi để riêng.', durationMin: 5 },
        { stepOrder: 3, instruction: 'Phi thơm tỏi, cho thịt hoặc hải sản vào xào chín.', durationMin: 5 },
        { stepOrder: 4, instruction: 'Cho cơm và rau củ vào chảo, đảo trên lửa lớn để hạt cơm săn và tơi.', durationMin: 8 },
        { stepOrder: 5, instruction: 'Thêm trứng, nước tương, nước mắm và gia vị; đảo đều rồi tắt bếp.', durationMin: 2 },
      ],
    },
    {
      name: 'Mì xào bò rau cải',
      shortDescription:
        'Món mì xào nhanh với sợi mì dai, thịt bò mềm và rau cải giòn, phù hợp cho bữa sáng hoặc bữa ăn nhanh trong ngày.',
      regionId: undefined,
      difficulty: 'EASY' as const,
      prepMinutes: 10,
      cookMinutes: 20,
      priceMin: 20000,
      priceMax: 40000,
      steps: [
        { stepOrder: 1, instruction: 'Sơ chế thịt bò, cải thìa, hành và tỏi; ướp thịt bò với gia vị.', durationMin: 10 },
        { stepOrder: 2, instruction: 'Trụng mì vừa chín, xả nhanh với nước và để ráo.', durationMin: 5 },
        { stepOrder: 3, instruction: 'Phi thơm hành tỏi, xào thịt bò trên lửa lớn đến khi vừa chín tới.', durationMin: 5 },
        { stepOrder: 4, instruction: 'Cho rau cải vào xào nhanh để giữ độ giòn.', durationMin: 3 },
        { stepOrder: 5, instruction: 'Thêm mì, dầu mè và gia vị; đảo đều đến khi mì thấm vị rồi dùng nóng.', durationMin: 5 },
      ],
    },
    {
      name: 'Bánh canh giò heo tôm',
      shortDescription:
        'Bánh canh với sợi bột dày, dai mềm, nước dùng đậm vị từ xương và giò heo, kết hợp tôm cùng hành ngò. Có thể biến tấu theo khẩu vị từng vùng.',
      regionId: mienTrung?.id,
      difficulty: 'MEDIUM' as const,
      prepMinutes: 30,
      cookMinutes: 100,
      priceMin: 20000,
      priceMax: 45000,
      steps: [
        { stepOrder: 1, instruction: 'Sơ chế, chần giò heo và xương để loại bỏ bọt bẩn.', durationMin: 15 },
        { stepOrder: 2, instruction: 'Hầm xương và giò heo cùng hành, gia vị cho đến khi nước dùng ngọt và giò mềm.', durationMin: 90 },
        { stepOrder: 3, instruction: 'Sơ chế tôm, nêm gia vị rồi cho vào nước dùng ở giai đoạn cuối để tôm vừa chín.', durationMin: 10 },
        { stepOrder: 4, instruction: 'Luộc hoặc trụng bánh canh, cho vào tô.', durationMin: 10 },
        { stepOrder: 5, instruction: 'Xếp giò heo, tôm, hành lá và rau thơm; chan nước dùng nóng và thưởng thức.', durationMin: 5 },
      ],
    },
  ];

  // ── Tạo từng món + recipe ─────────────────────────────────────────────────
  for (const d of dishes) {
    // Kiểm tra đã tồn tại chưa
    const existing = await prisma.dish.findFirst({ where: { name: d.name } });
    if (existing) {
      console.log(`⚠️  Đã tồn tại: ${d.name} (${existing.id}) — bỏ qua`);
      continue;
    }

    const slug = d.name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-');

    const dish = await prisma.dish.create({
      data: {
        name: d.name,
        slug,
        shortDescription: d.shortDescription,
        regionId: d.regionId ?? null,
        difficulty: d.difficulty,
        prepMinutes: d.prepMinutes,
        cookMinutes: d.cookMinutes,
        priceMin: d.priceMin,
        priceMax: d.priceMax,
        status: 'PUBLISHED',
      },
    });
    console.log(`✅ Tạo dish: ${dish.name} (${dish.id})`);

    // Tạo recipe + steps
    const recipe = await prisma.recipe.create({
      data: {
        dishId: dish.id,
        isDefault: true,
        servings: 1,
        prepMinutes: d.prepMinutes,
        cookMinutes: d.cookMinutes,
      },
    });

    await prisma.recipeStep.createMany({
      data: d.steps.map((s) => ({
        recipeId: recipe.id,
        stepOrder: s.stepOrder,
        instruction: s.instruction,
        durationMin: s.durationMin,
      })),
    });
    console.log(`   📋 Tạo ${d.steps.length} bước nấu`);
  }

  await prisma.$disconnect();
  console.log('\n🎉 Seed xong!');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
