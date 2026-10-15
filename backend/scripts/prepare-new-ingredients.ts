import * as path from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';
import { NEW_INGREDIENTS } from './define-new-ingredients';
import { IngredientNormalizerService } from '../src/ingredients/ingredient-normalizer.service';

dotenv.config({ path: path.join(__dirname, '../.env.local') });
dotenv.config({ path: path.join(__dirname, '../.env') });

const TAVILY_API_KEY = process.env.TAVILY_API_KEY;

const SUPERMARKET_DOMAINS = [
  'tgdd.vn',
  'bachhoaxanh',
  'bhxwork.vn',
  'cooponline.vn',
  'tekoapis.com',
  'higiocloud.vn',
  'winmart.vn',
  'kingfoodmart.com',
  'lottemart.vn',
  'go-vietnam.vn',
  'coopmart',
  'megamarket.vn',
  'an-nam-gourmet',
];

const NEGATIVE_KEYWORDS = [
  'mien-an-lien',
  'mi-goi',
  'banh-da-cua-an-lien',
  'pho-goi',
  'dau-an-simply',
  'dau-hao',
  'mayonnaise',
  'kem-cac-loai',
];

async function validateImageUrl(url: string): Promise<boolean> {
  if (!url || !url.startsWith('http')) return false;
  const lower = url.toLowerCase();
  if (NEGATIVE_KEYWORDS.some((neg) => lower.includes(neg))) return false;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 7000);
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Range: 'bytes=0-1024',
        Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
      },
      signal: controller.signal,
    });
    return res.ok && res.status < 400;
  } catch {
    return false;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function searchImage(queries: string[]): Promise<{ url: string; isSupermarket: boolean } | null> {
  if (!TAVILY_API_KEY) return null;

  for (const q of queries) {
    try {
      const res = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: TAVILY_API_KEY,
          query: q,
          include_images: true,
          max_results: 6,
        }),
      });

      if (!res.ok) continue;
      const data = (await res.json()) as any;
      const images: string[] = data.images || [];

      // 1. Ưu tiên siêu thị
      for (const img of images) {
        if (SUPERMARKET_DOMAINS.some((d) => img.toLowerCase().includes(d))) {
          const ok = await validateImageUrl(img);
          if (ok) return { url: img, isSupermarket: true };
        }
      }

      // 2. Ảnh ẩm thực sạch khác
      for (const img of images) {
        const ok = await validateImageUrl(img);
        if (ok) return { url: img, isSupermarket: false };
      }
    } catch {
      // next query
    }
  }

  return null;
}

function generateCode(name: string, normalizer: IngredientNormalizerService): string {
  const folded = normalizer.searchFolded(name).replace(/\s+/g, '-').slice(0, 30);
  const rand = Math.random().toString(36).substring(2, 7);
  return `${folded}-${rand}`;
}

async function main() {
  const normalizer = new IngredientNormalizerService();
  console.log(`Bắt đầu thu thập và tìm kiếm hình ảnh cho ${NEW_INGREDIENTS.length} nguyên liệu Việt Nam mới...\n`);

  const results: Array<any> = [];

  for (let i = 0; i < NEW_INGREDIENTS.length; i++) {
    const item = NEW_INGREDIENTS[i];
    process.stdout.write(`[${i + 1}/${NEW_INGREDIENTS.length}] "${item.name}" (${item.group})... `);

    const found = await searchImage(item.queries);
    if (found) {
      console.log(`✓ (${found.isSupermarket ? 'SUPERMARKET' : 'FOOD'}) -> ${found.url.slice(0, 80)}...`);
      results.push({
        code: generateCode(item.name, normalizer),
        name: item.name,
        nameEn: item.nameEn,
        groupLabel: item.group,
        unit: item.unit,
        allergenCode: item.allergenCode || null,
        identityNormalized: normalizer.identityKey(item.name),
        searchFolded: normalizer.searchFolded(item.name),
        synonyms: item.synonyms,
        imageUrl: found.url,
        isSupermarket: found.isSupermarket,
      });
    } else {
      console.log(`✗ KHÔNG TÌM THẤY`);
    }

    // Tránh rate-limit Tavily
    await new Promise((r) => setTimeout(r, 600));
  }

  console.log(`\n========================================`);
  console.log(`Kết quả: Tìm thấy ${results.length}/${NEW_INGREDIENTS.length} nguyên liệu đạt chuẩn hình ảnh!`);
  console.log(`========================================\n`);

  const outPath = path.join(__dirname, '../data/new-ingredients-prepared.json');
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2), 'utf8');
  console.log(`Đã lưu kết quả chuẩn bị vào: ${outPath}`);
}

main().catch(console.error);
