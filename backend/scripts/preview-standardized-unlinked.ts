import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

// Helper to clean raw ingredient text to a clean standard name
export function cleanIngredientName(raw: string): string {
  let name = raw.trim();

  // Strip leading numbers, fractions, quantities and common unit words
  // e.g. "80g đậu phụ rán" -> "đậu phụ rán"
  // "1/4 cái bánh tráng nướng mè" -> "bánh tráng mè nướng"
  // "3-5 lá ổi tươi, rửa sạch lau khô" -> "lá ổi tươi"
  name = name.replace(/^[\d.,/–—\s-]+\s*(g|kg|ml|l|thìa\s*canh|thìa\s*cà\s*phê|muỗng\s*canh|muỗng\s*cà\s*phê|muỗng|thìa|chén|bát|tô|cái|quả|trái|củ|nhánh|lá|miếng|khoanh|cọng|búp|lát|góc\s*tư|vắt|gói|chiếc|phần)?\s*/i, '');

  // Strip trailing notes, preparations in parentheses or after commas
  // e.g. "(hoặc tóp mỡ)" or ", rửa sạch ngắt khúc" or ", băm nhỏ"
  name = name.replace(/\s*\(.*?\)\s*/g, ' ');
  name = name.split(/,\s*(rửa sạch|thái|cắt|băm|chần|ngâm|luộc|nướng|ăn kèm|bóc vỏ|đập dập|nhặt|vắt|xắt|bóp|khoảng)/i)[0];
  name = name.replace(/,\s*.*$/, ''); // strip any remaining comma note

  // Clean trailing punctuation or whitespace
  name = name.replace(/^[,\s.-]+|[,\s.-]+$/g, '').trim();

  // Capitalize first letter
  if (name.length > 0) {
    name = name.charAt(0).toUpperCase() + name.slice(1);
  }
  return name;
}

// Group label categorization
export function guessGroupLabel(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes('thịt') || lower.includes('heo') || lower.includes('bò') || lower.includes('gà') || lower.includes('ếch') || lower.includes('gan') || lower.includes('phèo') || lower.includes('dồi') || lower.includes('sườn') || lower.includes('giò') || lower.includes('mỡ')) {
    return 'Thịt & Gia cầm';
  }
  if (lower.includes('cá') || lower.includes('tôm') || lower.includes('mực') || lower.includes('cua') || lower.includes('ghẹ') || lower.includes('hến') || lower.includes('ốc') || lower.includes('sứa') || lower.includes('hải sản')) {
    return 'Thủy hải sản';
  }
  if (lower.includes('rau') || lower.includes('lá') || lower.includes('củ') || lower.includes('quả') || lower.includes('cà') || lower.includes('măng') || lower.includes('chuối') || lower.includes('giá') || lower.includes('nấm') || lower.includes('mùi') || lower.includes('ngò') || lower.includes('hành') || lower.includes('tỏi') || lower.includes('ớt') || lower.includes('gừng') || lower.includes('sả') || lower.includes('dưa')) {
    return 'Rau củ & Quả';
  }
  if (lower.includes('bún') || lower.includes('mì') || lower.includes('phở') || lower.includes('bánh canh') || lower.includes('bánh đa') || lower.includes('cao lầu') || lower.includes('hủ tiếu') || lower.includes('cơm') || lower.includes('gạo') || lower.includes('bột') || lower.includes('bánh')) {
    return 'Tinh bột & Ngũ cốc';
  }
  if (lower.includes('sốt') || lower.includes('tương') || lower.includes('mắm') || lower.includes('dầu') || lower.includes('giấm') || lower.includes('muối') || lower.includes('đường') || lower.includes('tiêu') || lower.includes('hạt nêm') || lower.includes('quế') || lower.includes('hồi') || lower.includes('thính') || lower.includes('ớt chưng') || lower.includes('gia vị') || lower.includes('nước dùng') || lower.includes('nước hầm') || lower.includes('rượu')) {
    return 'Gia vị & Nước sốt';
  }
  if (lower.includes('đậu') || lower.includes('lạc') || lower.includes('mè') || lower.includes('hạt')) {
    return 'Các loại hạt & Đậu';
  }
  return 'Khác';
}

async function main() {
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

  const unlinked = await prisma.dishIngredient.findMany({
    where: { ingredientId: null },
    include: {
      dish: { select: { id: true, name: true } },
    },
  });

  const map = new Map<string, { rawTexts: string[]; cleanName: string; group: string; dishes: Set<string>; count: number }>();

  for (const item of unlinked) {
    const raw = item.rawText;
    let clean = cleanIngredientName(raw);
    
    // Normalize some common names
    if (/quế\s*(nhỏ|thanh)?/i.test(clean)) clean = 'Quế thanh';
    if (/hoa hồi/i.test(clean) || /quế và hoa hồi/i.test(clean)) clean = 'Quế và hoa hồi';
    if (/đậu phụ/i.test(clean) || /đậu hũ/i.test(clean)) clean = 'Đậu phụ rán';
    if (/đậu phộng/i.test(clean) || /lạc/i.test(clean)) clean = 'Lạc rang (Đậu phộng)';
    if (/thịt gấc/i.test(clean)) clean = 'Thịt gấc';
    if (/chà bông/i.test(clean) || /ruốc/i.test(clean)) clean = 'Chà bông thịt heo';
    if (/hành tím phi/i.test(clean) || /hành phi/i.test(clean)) clean = 'Hành tím phi giòn';
    if (/tỏi phi/i.test(clean)) clean = 'Tỏi phi thơm';
    if (/mỡ hành/i.test(clean)) clean = 'Mỡ hành';
    if (/mỡ gà/i.test(clean)) clean = 'Mỡ gà';
    if (/giò sống/i.test(clean)) clean = 'Giò sống';
    if (/chả cua/i.test(clean)) clean = 'Chả cua Huế';
    if (/bánh tráng mè/i.test(clean)) clean = 'Bánh tráng mè nướng';
    if (/da heo chiên|tóp mỡ/i.test(clean)) clean = 'Tóp mỡ giòn';
    if (/chả cá thu/i.test(clean)) clean = 'Chả cá thu';
    if (/sứa/i.test(clean)) clean = 'Sứa tươi';
    if (/tôm đất/i.test(clean)) clean = 'Tôm đất tươi';
    if (/sườn cốt lết/i.test(clean)) clean = 'Sườn cốt lết heo';
    if (/bì heo/i.test(clean)) clean = 'Bì heo trộn thính';
    if (/chả trứng/i.test(clean)) clean = 'Chả trứng hấp';
    if (/khô mực/i.test(clean)) clean = 'Khô mực';
    if (/thịt ghẹ/i.test(clean) || /ghẹ/i.test(clean)) clean = 'Thịt ghẹ tươi';
    if (/gạch ghẹ/i.test(clean)) clean = 'Gạch ghẹ xào';
    if (/mì trứng/i.test(clean)) clean = 'Mì trứng tươi';
    if (/bánh đa đỏ/i.test(clean)) clean = 'Bánh đa đỏ Hải Phòng';
    if (/cơm nguội|cơm trắng/i.test(clean)) clean = 'Cơm trắng (Cơm nguội)';
    if (/hến/i.test(clean)) clean = 'Hến tươi';
    if (/bột tôm chấy/i.test(clean)) clean = 'Bột tôm chấy';
    if (/lá dong/i.test(clean)) clean = 'Lá dong gói bánh';
    if (/thịt má heo|thịt đầu heo/i.test(clean)) clean = 'Thịt đầu heo (Má heo)';
    if (/thính gạo/i.test(clean)) clean = 'Thính gạo rang';
    if (/lá ổi/i.test(clean)) clean = 'Lá ổi tươi';
    if (/thịt heo quay/i.test(clean)) clean = 'Thịt heo quay';
    if (/chả bò/i.test(clean)) clean = 'Chả bò Đà Nẵng';
    if (/nem chua/i.test(clean)) clean = 'Nem chua';
    if (/măng chua/i.test(clean)) clean = 'Măng chua';
    if (/nấm bào ngư/i.test(clean)) clean = 'Nấm bào ngư xám';
    if (/ngải bún/i.test(clean)) clean = 'Củ ngải bún';
    if (/thịt cua/i.test(clean)) clean = 'Thịt cua tươi';
    if (/lạp xưởng/i.test(clean)) clean = 'Lạp xưởng tôm thịt';
    if (/phèo non/i.test(clean)) clean = 'Phèo non heo (Lòng non)';
    if (/dồi/i.test(clean)) clean = 'Dồi chiên miền Nam';
    if (/củ sắn/i.test(clean)) clean = 'Củ sắn (Củ đậu)';
    if (/ruột bánh mì/i.test(clean)) clean = 'Ruột bánh mì';
    if (/rau cải xanh|cải xanh/i.test(clean)) clean = 'Rau cải xanh';
    if (/rau ăn lẩu mắm|rau ăn kèm/i.test(clean)) clean = 'Rau ăn lẩu mắm tổng hợp';
    if (/rau củ ăn kèm|rau củ các loại/i.test(clean)) clean = 'Rau củ luộc thập cẩm';
    if (/dưa leo và cà chua/i.test(clean)) clean = 'Dưa leo và cà chua tươi';
    if (/hành lá và mùi tàu|hành lá và ngò/i.test(clean)) clean = 'Hành lá và mùi tàu (Ngò gai)';
    if (/nước dùng xương|nước dùng|nước luộc gà/i.test(clean)) clean = 'Nước dùng hầm xương heo';

    const key = clean.toLowerCase();
    if (!map.has(key)) {
      map.set(key, {
        rawTexts: [],
        cleanName: clean,
        group: guessGroupLabel(clean),
        dishes: new Set<string>(),
        count: 0,
      });
    }
    const entry = map.get(key)!;
    entry.rawTexts.push(raw);
    entry.dishes.add(item.dish.name);
    entry.count++;
  }

  console.log(`Unique standardized ingredients to provision: ${map.size}`);
  const sorted = Array.from(map.values()).sort((a, b) => b.count - a.count);
  for (let i = 0; i < sorted.length; i++) {
    const item = sorted[i];
    console.log(`${i + 1}. [${item.group}] "${item.cleanName}" (${item.count} dish ingredients in ${item.dishes.size} dishes)`);
  }

  await prisma.$disconnect();
}

main().catch(console.error);
