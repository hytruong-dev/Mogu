/**
 * Script: Parse rawText từ DishIngredient → fuzzy match Ingredient DB → link hoặc tạo mới
 * Run: npx ts-node scripts/link-dish-ingredients.ts
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter } as any);

// ── AI client (xKiro) để search ảnh ──────────────────────────────────────────
// Dùng Unsplash trực tiếp vì không thể inject AiService ở đây
const UNSPLASH_KEY = process.env.UNSPLASH_ACCESS_KEY ?? '';
const XKIRO_KEY = process.env.XKIRO_API_KEY ?? '';

/**
 * Parse rawText để lấy tên nguyên liệu thuần túy.
 * VD: "100 g Thịt heo (ba chỉ hoặc nạc dăm)" → "Thịt heo"
 *     "1 bó nhỏ Xà lách (Rửa sạch...)"       → "Xà lách"
 *     "2 củ Hành tím (Bóc vỏ...)"             → "Hành tím"
 */
function extractIngredientName(rawText: string): string {
  // Xóa số lượng và đơn vị đầu chuỗi
  let s = rawText.trim();

  // Bỏ phần trong ngoặc
  s = s.replace(/\(.*?\)/g, '').trim();

  // Bỏ số + đơn vị đầu chuỗi: "100 g ", "1 bó nhỏ ", "2.5 ml ", v.v.
  s = s.replace(/^\d+(\.\d+)?\s*(con|cây|củ|quả|nhánh|bó|nắm|nhúm|lát|miếng|chùm|thanh|viên|mảnh|đĩa|lo|muỗng canh|muỗng cà phê|muối cà phê|tsp|tbsp|ml|g|kg|l|lít|mẩu|mảnh)\s*(nhỏ|lớn|to|vừa)?\s*/i, '').trim();
  s = s.replace(/^\d+(\.\d+)?\s*/,'').trim(); // xóa số còn lại

  // Viết hoa chữ đầu
  s = s.charAt(0).toUpperCase() + s.slice(1);

  return s.trim();
}

/**
 * Fuzzy match tên với danh sách ingredient trong DB.
 * Trả về ingredient nếu tên chứa hoặc tương tự (case-insensitive).
 */
function fuzzyMatch(name: string, ingredients: Array<{ id: string; name: string }>): string | null {
  const lower = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g,'d');

  for (const ing of ingredients) {
    const ingLower = ing.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d');
    // Exact match
    if (ingLower === lower) return ing.id;
    // One contains the other (min 4 chars to avoid false positives)
    if (lower.length >= 4 && ingLower.includes(lower)) return ing.id;
    if (ingLower.length >= 4 && lower.includes(ingLower)) return ing.id;
  }
  return null;
}

async function searchImage(name: string): Promise<string | null> {
  // Mapping một số tên Việt → English cho Unsplash
  const viToEn: Record<string, string> = {
    'thịt heo': 'pork meat', 'bún tươi': 'rice vermicelli noodles', 'hành tím': 'shallot',
    'tỏi': 'garlic', 'sả': 'lemongrass', 'đường trắng': 'white sugar', 'nước mắm': 'fish sauce',
    'dầu ăn': 'cooking oil', 'tiêu đen': 'black pepper', 'muối': 'salt', 'chanh': 'lime',
    'ớt tươi': 'fresh chili', 'hành lá': 'spring onion', 'xà lách': 'lettuce', 'dưa leo': 'cucumber',
    'giá đỗ': 'bean sprouts', 'đậu phộng': 'peanuts', 'cà rốt': 'carrot', 'gừng': 'ginger',
    'hành tây': 'onion', 'gà ta': 'free range chicken', 'rau mùi': 'coriander', 'rau răm': 'vietnamese mint',
    'ngò gai': 'sawtooth herb', 'quế': 'cinnamon stick', 'hồi': 'star anise', 'củ cải trắng': 'daikon radish',
    'nước cốt chanh': 'lime juice', 'đường phèn': 'rock sugar', 'tương ớt': 'chili sauce',
    'chả lụa': 'vietnamese pork roll', 'dừa nạo': 'shredded coconut', 'đồ chua': 'pickled vegetables',
    'rau thơm': 'fresh herbs', 'húng quế': 'thai basil', 'tía tô': 'perilla leaves',
    'kinh giới': 'marjoram herb', 'gia vị': 'seasoning spices', 'hạt nêm': 'seasoning powder',
  };

  const lower = name.toLowerCase();
  let query = name;
  for (const [vi, en] of Object.entries(viToEn)) {
    if (lower.includes(vi)) { query = en; break; }
  }

  // Thử Unsplash
  if (UNSPLASH_KEY) {
    try {
      const res = await fetch(
        `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query + ' food ingredient')}&per_page=3&orientation=squarish`,
        { headers: { Authorization: `Client-ID ${UNSPLASH_KEY}`, 'Accept-Version': 'v1' } }
      );
      if (res.ok) {
        const data = await res.json() as any;
        const img = data.results?.[0]?.urls?.regular;
        if (img) return img;
      }
    } catch {}
  }

  // Fallback Wikipedia VI
  try {
    const searchRes = await fetch(
      `https://vi.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(name)}&srlimit=1&format=json`
    );
    if (searchRes.ok) {
      const sd = await searchRes.json() as any;
      const title = sd.query?.search?.[0]?.title;
      if (title) {
        const imgRes = await fetch(
          `https://vi.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(title)}&prop=pageimages&pithumbsize=400&format=json`
        );
        if (imgRes.ok) {
          const id = await imgRes.json() as any;
          const pages = Object.values(id.query?.pages ?? {}) as any[];
          const img = pages[0]?.thumbnail?.source;
          if (img) return img;
        }
      }
    }
  } catch {}

  return null;
}

function toSlug(name: string): string {
  return name
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase().trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .substring(0, 90) + '-' + Date.now().toString().slice(-5);
}

// ── Concurrency helper ────────────────────────────────────────────────────────
async function pLimit<T>(items: T[], concurrency: number, fn: (item: T) => Promise<void>) {
  const queue = [...items];
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (queue.length) {
      const item = queue.shift()!;
      await fn(item);
    }
  });
  await Promise.all(workers);
}

async function main() {
  console.log('Đang tải danh sách ingredient từ DB...');
  const allIngredients = await (prisma as any).ingredient.findMany({
    select: { id: true, name: true, imageUrl: true },
  });
  console.log(`Ingredient trong DB: ${allIngredients.length}`);

  // Lấy DishIngredient chưa link
  const unlinked = await (prisma as any).dishIngredient.findMany({
    where: { ingredientId: null },
    select: { id: true, rawText: true, unit: true },
  });
  console.log(`DishIngredient chưa link: ${unlinked.length}\n`);

  let linked = 0, created = 0, skipped = 0;
  const newlyCreated: Array<{ name: string; id: string }> = [];

  await pLimit(unlinked, 3, async (di: any) => {
    const parsedName = extractIngredientName(di.rawText);
    if (!parsedName || parsedName.length < 2) { skipped++; return; }

    // Fuzzy match với DB hiện tại + mới tạo trong session này
    const matchId = fuzzyMatch(parsedName, [...allIngredients, ...newlyCreated]);

    if (matchId) {
      await (prisma as any).dishIngredient.update({
        where: { id: di.id },
        data: { ingredientId: matchId },
      });
      linked++;
      return;
    }

    // Kiểm tra DB thêm lần nữa (case-insensitive)
    const existing = await (prisma as any).ingredient.findFirst({
      where: { name: { equals: parsedName, mode: 'insensitive' } },
      select: { id: true, name: true },
    });

    if (existing) {
      await (prisma as any).dishIngredient.update({
        where: { id: di.id },
        data: { ingredientId: existing.id },
      });
      allIngredients.push(existing);
      linked++;
      return;
    }

    // Tạo mới + tìm ảnh (timeout 5s)
    console.log(`  + Tạo mới: "${parsedName}"`);
    const imageUrl = await Promise.race([
      searchImage(parsedName),
      new Promise<null>(r => setTimeout(() => r(null), 5000)),
    ]);

    try {
      const newIng = await (prisma as any).ingredient.create({
        data: {
          name: parsedName,
          code: toSlug(parsedName),
          unit: di.unit ?? null,
          imageUrl: imageUrl ?? null,
          isActive: true,
        },
        select: { id: true, name: true },
      });
      await (prisma as any).dishIngredient.update({
        where: { id: di.id },
        data: { ingredientId: newIng.id },
      });
      allIngredients.push(newIng);
      newlyCreated.push(newIng);
      created++;
    } catch (e: any) {
      if (e.code === 'P2002') {
        // Race condition — tìm lại
        const retry = await (prisma as any).ingredient.findFirst({
          where: { name: { equals: parsedName, mode: 'insensitive' } },
          select: { id: true, name: true },
        });
        if (retry) {
          await (prisma as any).dishIngredient.update({
            where: { id: di.id },
            data: { ingredientId: retry.id },
          });
          linked++;
        }
      } else {
        console.error(`  ! Lỗi tạo "${parsedName}":`, e.message);
        skipped++;
      }
    }
  });

  console.log(`\n=== KẾT QUẢ ===`);
  console.log(`✅ Đã link:  ${linked}`);
  console.log(`🆕 Tạo mới: ${created}`);
  console.log(`⏭  Bỏ qua:  ${skipped}`);
  if (newlyCreated.length) {
    console.log(`\nNguyên liệu mới tạo:`);
    newlyCreated.forEach(n => console.log(` - ${n.name}`));
  }
}

main().catch(console.error).finally(() => (prisma as any).$disconnect());
