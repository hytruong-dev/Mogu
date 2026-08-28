/**
 * Bổ sung nguyên liệu chi tiết cho 5 món ăn đã có trong DB
 * Dữ liệu từ: 5-mon-an-viet-bo-sung-nguyen-lieu.md
 */

import { readFileSync } from 'fs'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'

// ── Load .env.local ──────────────────────────────────────────────────────────
const envContent = readFileSync('.env.local', 'utf-8')
for (const line of envContent.split('\n')) {
  const trimmed = line.trim()
  if (trimmed && !trimmed.startsWith('#')) {
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx > 0) process.env[trimmed.substring(0, eqIdx).trim()] = trimmed.substring(eqIdx + 1).trim()
  }
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })

// ── Dữ liệu nguyên liệu từ file MD ──────────────────────────────────────────
// Format: { dishNameKeyword, ingredients: [{ name, quantity, unit, note }] }
const DISH_INGREDIENTS = [
  {
    dishNameKeyword: 'Bún bò Huế',
    ingredients: [
      { name: 'Bún tươi sợi lớn',     quantity: 200,  unit: 'g',   note: 'Trụng trước khi ăn' },
      { name: 'Bắp bò',               quantity: 80,   unit: 'g',   note: 'Có thể thay bằng nạm bò' },
      { name: 'Giò heo',              quantity: 100,  unit: 'g',   note: 'Chọn khoanh có da và xương' },
      { name: 'Xương bò',             quantity: 150,  unit: 'g',   note: 'Dùng nấu nước dùng' },
      { name: 'Sả',                   quantity: 2,    unit: 'cây', note: 'Đập dập' },
      { name: 'Hành tây',             quantity: 0.25, unit: 'củ',  note: 'Nướng hoặc cho vào nước dùng' },
      { name: 'Gừng',                 quantity: 10,   unit: 'g',   note: 'Nướng sơ' },
      { name: 'Mắm ruốc Huế',         quantity: 1,    unit: 'thìa', note: 'Điều chỉnh theo khẩu vị' },
      { name: 'Dầu điều',             quantity: 1,    unit: 'thìa', note: 'Tạo màu' },
      { name: 'Nước mắm',             quantity: 1,    unit: 'thìa', note: 'Nêm cuối' },
      { name: 'Muối',                 quantity: 0.33, unit: 'thìa', note: 'Có thể điều chỉnh' },
      { name: 'Đường',                quantity: 0.5,  unit: 'thìa', note: 'Cân bằng vị' },
      { name: 'Ớt',                   quantity: 1,    unit: 'quả', note: 'Tùy khẩu vị' },
      { name: 'Rau sống/giá/hoa chuối', quantity: 90, unit: 'g',  note: 'Ăn kèm' },
      { name: 'Chanh',                quantity: 0.5,  unit: 'quả', note: 'Ăn kèm' },
    ],
    steps: [
      { stepOrder: 1, instruction: 'Sơ chế và chần xương, giò heo và thịt bò; rửa lại bằng nước sạch.', durationMin: 15 },
      { stepOrder: 2, instruction: 'Nướng sơ hành tây và gừng; đập dập sả rồi cho vào nồi nấu cùng xương và giò heo.', durationMin: 10 },
      { stepOrder: 3, instruction: 'Hớt bọt thường xuyên, hầm đến khi nước dùng ngọt và giò heo mềm.', durationMin: 90 },
      { stepOrder: 4, instruction: 'Hòa mắm ruốc với một ít nước, lọc bỏ cặn rồi cho vào nồi; thêm dầu điều và gia vị.', durationMin: 10 },
      { stepOrder: 5, instruction: 'Luộc hoặc trụng bún, thái thịt; cho bún, thịt, giò heo vào tô rồi chan nước dùng.', durationMin: 10 },
      { stepOrder: 6, instruction: 'Dùng kèm rau sống, giá, hoa chuối, chanh và ớt.', durationMin: null },
    ],
  },
  {
    dishNameKeyword: 'Phở bò',
    ingredients: [
      { name: 'Bánh phở tươi',        quantity: 200,  unit: 'g',   note: 'Trụng trước khi dùng' },
      { name: 'Thịt bò tái/nạm',      quantity: 100,  unit: 'g',   note: 'Thái lát mỏng' },
      { name: 'Xương bò',             quantity: 250,  unit: 'g',   note: 'Dùng tạo vị ngọt cho nước dùng' },
      { name: 'Hành tây',             quantity: 0.25, unit: 'củ',  note: 'Nướng sơ' },
      { name: 'Gừng',                 quantity: 10,   unit: 'g',   note: 'Nướng sơ' },
      { name: 'Quế',                  quantity: 1,    unit: 'thanh', note: 'Dùng tạo mùi' },
      { name: 'Hoa hồi',              quantity: 2,    unit: 'cánh', note: 'Không dùng quá nhiều' },
      { name: 'Thảo quả',             quantity: 0.5,  unit: 'quả', note: 'Có thể bỏ nếu không có' },
      { name: 'Hạt mùi',              quantity: 0.5,  unit: 'thìa', note: 'Tạo mùi thơm' },
      { name: 'Nước mắm',             quantity: 1,    unit: 'thìa', note: 'Nêm cuối' },
      { name: 'Muối',                 quantity: 0.33, unit: 'thìa', note: 'Điều chỉnh theo khẩu vị' },
      { name: 'Đường phèn',           quantity: 1,    unit: 'thìa', note: 'Cân bằng vị' },
      { name: 'Hành lá và rau mùi',   quantity: 15,   unit: 'g',   note: 'Thái nhỏ' },
      { name: 'Chanh',                quantity: 0.5,  unit: 'quả', note: 'Ăn kèm' },
      { name: 'Ớt',                   quantity: 1,    unit: 'quả', note: 'Tùy khẩu vị' },
    ],
    steps: [
      { stepOrder: 1, instruction: 'Rửa và chần xương bò, sau đó rửa sạch để nước dùng trong hơn.', durationMin: 10 },
      { stepOrder: 2, instruction: 'Nướng hành tây và gừng; rang hoặc nướng nhẹ quế, hồi và thảo quả.', durationMin: 10 },
      { stepOrder: 3, instruction: 'Ninh xương với các nguyên liệu thơm, thường xuyên hớt bọt.', durationMin: 60 },
      { stepOrder: 4, instruction: 'Nêm muối, nước mắm và đường phèn; điều chỉnh độ đậm nhạt.', durationMin: 5 },
      { stepOrder: 5, instruction: 'Trụng bánh phở, cho vào tô cùng thịt bò thái lát.', durationMin: 5 },
      { stepOrder: 6, instruction: 'Chan nước dùng thật nóng, rắc hành lá và rau mùi; dùng với chanh và ớt.', durationMin: null },
    ],
  },
  {
    dishNameKeyword: 'Cơm chiên',
    ingredients: [
      { name: 'Cơm nguội',            quantity: 250,  unit: 'g',   note: 'Cơm để lạnh sẽ dễ chiên tơi' },
      { name: 'Trứng gà',             quantity: 1,    unit: 'quả', note: 'Đánh tan' },
      { name: 'Cà rốt',               quantity: 30,   unit: 'g',   note: 'Thái hạt lựu' },
      { name: 'Đậu Hà Lan',           quantity: 25,   unit: 'g',   note: 'Có thể dùng loại đông lạnh' },
      { name: 'Xúc xích',             quantity: 40,   unit: 'g',   note: 'Thái hạt lựu' },
      { name: 'Tôm',                  quantity: 40,   unit: 'g',   note: 'Tùy chọn' },
      { name: 'Tỏi',                  quantity: 1,    unit: 'tép', note: 'Băm nhỏ' },
      { name: 'Hành lá',              quantity: 10,   unit: 'g',   note: 'Thái nhỏ' },
      { name: 'Nước tương',           quantity: 1,    unit: 'thìa', note: 'Tạo vị mặn thơm' },
      { name: 'Nước mắm',             quantity: 0.5,  unit: 'thìa', note: 'Tạo vị đậm' },
      { name: 'Tiêu đen',             quantity: 0.25, unit: 'thìa', note: 'Tùy khẩu vị' },
      { name: 'Dầu ăn',               quantity: 1.5,  unit: 'thìa canh', note: 'Dùng chiên' },
    ],
    steps: [
      { stepOrder: 1, instruction: 'Tách cơm nguội cho thật tơi; sơ chế cà rốt, đậu Hà Lan, tôm và xúc xích.', durationMin: 10 },
      { stepOrder: 2, instruction: 'Đánh trứng rồi chiên vừa chín, đảo nhỏ và để riêng.', durationMin: 5 },
      { stepOrder: 3, instruction: 'Phi thơm tỏi, xào tôm và xúc xích đến khi chín.', durationMin: 5 },
      { stepOrder: 4, instruction: 'Cho cơm, cà rốt và đậu Hà Lan vào; đảo trên lửa lớn để cơm săn và tơi.', durationMin: 7 },
      { stepOrder: 5, instruction: 'Cho trứng trở lại chảo, thêm nước tương, nước mắm và tiêu.', durationMin: 3 },
      { stepOrder: 6, instruction: 'Đảo đều, rắc hành lá rồi tắt bếp.', durationMin: null },
    ],
  },
  {
    dishNameKeyword: 'Mì xào bò',
    ingredients: [
      { name: 'Mì trứng',             quantity: 80,   unit: 'g',   note: 'Trụng vừa chín' },
      { name: 'Thịt bò',              quantity: 100,  unit: 'g',   note: 'Thái mỏng' },
      { name: 'Cải thìa',             quantity: 100,  unit: 'g',   note: 'Cắt khúc' },
      { name: 'Cà rốt',               quantity: 30,   unit: 'g',   note: 'Thái sợi' },
      { name: 'Hành tây',             quantity: 0.25, unit: 'củ',  note: 'Thái múi mỏng' },
      { name: 'Tỏi',                  quantity: 2,    unit: 'tép', note: 'Băm nhỏ' },
      { name: 'Dầu hào',              quantity: 1,    unit: 'thìa', note: 'Dùng làm sốt' },
      { name: 'Nước tương',           quantity: 1,    unit: 'thìa', note: 'Điều chỉnh độ mặn' },
      { name: 'Dầu mè',               quantity: 0.5,  unit: 'thìa', note: 'Tạo mùi thơm' },
      { name: 'Tiêu đen',             quantity: 0.25, unit: 'thìa', note: 'Ướp bò' },
      { name: 'Dầu ăn',               quantity: 1,    unit: 'thìa canh', note: 'Xào' },
    ],
    steps: [
      { stepOrder: 1, instruction: 'Thái mỏng thịt bò; ướp với một ít nước tương, tiêu và dầu ăn.', durationMin: 10 },
      { stepOrder: 2, instruction: 'Trụng mì vừa chín, xả nhanh và để ráo để sợi không bị nát.', durationMin: 5 },
      { stepOrder: 3, instruction: 'Phi thơm tỏi, xào thịt bò trên lửa lớn đến khi vừa chín tới rồi để riêng.', durationMin: 5 },
      { stepOrder: 4, instruction: 'Xào hành tây, cà rốt và rau cải nhanh tay để rau còn độ giòn.', durationMin: 5 },
      { stepOrder: 5, instruction: 'Cho mì và thịt bò vào, thêm dầu hào, nước tương và dầu mè.', durationMin: 3 },
      { stepOrder: 6, instruction: 'Đảo đều cho mì thấm sốt rồi tắt bếp.', durationMin: null },
    ],
  },
  {
    dishNameKeyword: 'Bánh canh tôm thịt',
    ingredients: [
      { name: 'Bánh canh tươi',       quantity: 200,  unit: 'g',   note: 'Sợi bột gạo/bột lọc tùy loại' },
      { name: 'Giò heo',              quantity: 120,  unit: 'g',   note: 'Chọn khoanh vừa ăn' },
      { name: 'Xương heo',            quantity: 200,  unit: 'g',   note: 'Dùng nấu nước dùng' },
      { name: 'Tôm',                  quantity: 60,   unit: 'g',   note: 'Bóc vỏ, bỏ chỉ lưng' },
      { name: 'Hành tây',             quantity: 0.25, unit: 'củ',  note: 'Tạo vị ngọt nước dùng' },
      { name: 'Hành lá',              quantity: 10,   unit: 'g',   note: 'Thái nhỏ' },
      { name: 'Rau mùi',              quantity: 5,    unit: 'g',   note: 'Ăn kèm' },
      { name: 'Tỏi',                  quantity: 1,    unit: 'tép', note: 'Tùy chọn' },
      { name: 'Nước mắm',             quantity: 1,    unit: 'thìa', note: 'Nêm nước dùng' },
      { name: 'Muối',                 quantity: 0.33, unit: 'thìa', note: 'Điều chỉnh khẩu vị' },
      { name: 'Tiêu đen',             quantity: 0.25, unit: 'thìa', note: 'Rắc khi ăn' },
      { name: 'Đường',                quantity: 0.5,  unit: 'thìa', note: 'Cân bằng vị' },
      { name: 'Chanh',                quantity: 0.5,  unit: 'quả', note: 'Ăn kèm' },
      { name: 'Ớt',                   quantity: 1,    unit: 'quả', note: 'Tùy khẩu vị' },
    ],
    steps: [
      { stepOrder: 1, instruction: 'Chần giò heo và xương, rửa sạch rồi để ráo.', durationMin: 10 },
      { stepOrder: 2, instruction: 'Hầm xương và giò heo cùng hành tây cho đến khi nước dùng ngọt và giò mềm; thường xuyên hớt bọt.', durationMin: 80 },
      { stepOrder: 3, instruction: 'Nêm nước mắm, muối, đường và tiêu cho vừa ăn.', durationMin: 5 },
      { stepOrder: 4, instruction: 'Sơ chế tôm rồi cho vào nồi ở giai đoạn cuối, nấu đến khi tôm vừa chín.', durationMin: 5 },
      { stepOrder: 5, instruction: 'Trụng bánh canh, cho vào tô; xếp giò heo, tôm lên trên.', durationMin: 5 },
      { stepOrder: 6, instruction: 'Chan nước dùng nóng, thêm hành lá và rau mùi; dùng cùng chanh và ớt.', durationMin: null },
    ],
  },
]

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('🔍 Tìm 5 món ăn trong DB...\n')

  // Lấy danh sách ingredient từ DB để match tên
  const allIngredients = await prisma.ingredient.findMany({
    select: { id: true, name: true, synonyms: true, code: true },
  })

  // Helper: tìm ingredient ID theo tên (fuzzy match)
  function findIngredientId(name) {
    const lower = name.toLowerCase().trim()
    // Exact match
    let found = allIngredients.find(i => i.name.toLowerCase() === lower)
    if (found) return found.id
    // Partial match (ingredient name contains search term)
    found = allIngredients.find(i => i.name.toLowerCase().includes(lower) || lower.includes(i.name.toLowerCase()))
    if (found) return found.id
    // Synonym match
    found = allIngredients.find(i => i.synonyms?.some(s => s.toLowerCase().includes(lower) || lower.includes(s.toLowerCase())))
    if (found) return found.id
    return null
  }

  let totalOk = 0, totalSkipped = 0

  for (const dishData of DISH_INGREDIENTS) {
    // Tìm dish theo tên
    const dish = await prisma.dish.findFirst({
      where: { name: { contains: dishData.dishNameKeyword, mode: 'insensitive' } },
      include: {
        dishIngredients: true,
        recipeSteps: true,
      },
    })

    if (!dish) {
      console.log(`⚠️  Không tìm thấy món: "${dishData.dishNameKeyword}"`)
      totalSkipped++
      continue
    }

    console.log(`\n🍜 ${dish.name} (id: ${dish.id.slice(0, 8)})`)

    // ── Xoá nguyên liệu cũ & recipe steps cũ ────────────────────────────────
    await prisma.dishIngredient.deleteMany({ where: { dishId: dish.id } })
    await prisma.recipeStep.deleteMany({ where: { dishId: dish.id } })
    console.log(`   🗑️  Đã xoá ${dish.dishIngredients.length} nguyên liệu cũ, ${dish.recipeSteps.length} bước cũ`)

    // ── Tạo nguyên liệu mới ──────────────────────────────────────────────────
    let matched = 0, unmatched = 0
    const ingredientCreates = dishData.ingredients.map((ing, idx) => {
      const ingId = findIngredientId(ing.name)
      if (ingId) matched++
      else unmatched++
      return {
        dishId: dish.id,
        ingredientId: ingId,
        rawText: ing.name,
        quantity: ing.quantity,
        unit: ing.unit,
        preparation: ing.note || null,  // field trong schema là "preparation"
      }
    })

    await prisma.dishIngredient.createMany({ data: ingredientCreates })
    console.log(`   ✅ Đã thêm ${ingredientCreates.length} nguyên liệu (${matched} match DB, ${unmatched} chưa có trong DB)`)

    // ── Tạo recipe steps mới ─────────────────────────────────────────────────
    const stepCreates = dishData.steps.map(s => ({
      dishId: dish.id,
      stepOrder: s.stepOrder,
      instruction: s.instruction,
      durationMin: s.durationMin || null,
    }))
    await prisma.recipeStep.createMany({ data: stepCreates })
    console.log(`   📋 Đã thêm ${stepCreates.length} bước nấu`)

    totalOk++
  }

  console.log('\n─────────────────────────────────────────')
  console.log(`✅ Cập nhật thành công: ${totalOk} món`)
  console.log(`⏭  Bỏ qua: ${totalSkipped} món`)
  console.log('🎉 Hoàn tất!')
}

main()
  .catch(e => { console.error('FATAL:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
