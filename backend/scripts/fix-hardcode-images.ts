/**
 * fix-hardcode-images.ts
 * Gán ảnh hardcode từ Wikimedia Commons cho những items không tự search được
 * + Merge duplicate ingredients (nhiều entries cùng loại → dùng ảnh của nhau)
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import * as https from 'https';

const SUPABASE_URL = process.env.SUPABASE_URL ?? '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const STORAGE_BUCKET = 'dish-images';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const p = new PrismaClient({ adapter } as any);

// Ảnh Wikimedia Commons chất lượng cao, license CC
const HARDCODE_ING: Record<string, string> = {
  'chanh hoặc quất': 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e0/Citrus_x_limon_%28Rutaceae%29.jpg/640px-Citrus_x_limon_%28Rutaceae%29.jpg',
  'đậu phộng rang': 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8a/Peanuts_roasted.jpg/640px-Peanuts_roasted.jpg',
  'mì quảng tươi (sợi vàng)': 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/79/Mi_quang_1_crop.jpg/640px-Mi_quang_1_crop.jpg',
  'nước cốt chanh (hoặc giấm)': 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/91/Lemon_Juice.jpg/640px-Lemon_Juice.jpg',
  'rau ăn kèm hỗn hợp (xà lách, rau thơm (húng quế, rau răm), giá đỗ, chuối chát, khế chua)':
    'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3c/Vietnamese_herbs_and_vegetables.jpg/640px-Vietnamese_herbs_and_vegetables.jpg',
  'thịt ba chỉ (hoặc nạc vai) heo': 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4d/Pork_belly_01.jpg/640px-Pork_belly_01.jpg',
  'thịt ba chỉ heo': 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4d/Pork_belly_01.jpg/640px-Pork_belly_01.jpg',
  'thịt heo ba chỉ (hoặc nạc vai)': 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4d/Pork_belly_01.jpg/640px-Pork_belly_01.jpg',
  'xương bò đùi (hoặc xương sụn)': 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b3/Beef_bones_stock.jpg/640px-Beef_bones_stock.jpg',
  'xương ống bò (có tủy)': 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b3/Beef_bones_stock.jpg/640px-Beef_bones_stock.jpg',
  'xương ống bò (ống lợn hoặc bò)': 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b3/Beef_bones_stock.jpg/640px-Beef_bones_stock.jpg',
};

const HARDCODE_DISH: Record<string, string> = {
  'bún thịt nướng miền trung': 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c8/Bun_thit_nuong.jpg/640px-Bun_thit_nuong.jpg',
  'bánh xèo miền trung': 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b3/Banh_Xeo_Vietnamese_Sizzling_Cake.jpg/640px-Banh_Xeo_Vietnamese_Sizzling_Cake.jpg',
  'bánh cuốn miền bắc': 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5b/Bánh_cuốn.jpg/640px-Bánh_cuốn.jpg',
  'bánh canh cua miền nam': 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/89/Banh_canh_cua.jpg/640px-Banh_canh_cua.jpg',
  'gỏi cuốn tôm thịt': 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5d/Goi_cuon.jpg/640px-Goi_cuon.jpg',
  'phở bò hà nội (phở bò miền bắc)': 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/27/Pho_bo.jpg/640px-Pho_bo.jpg',
};

// Fallback URLs nếu Wikimedia không có (dùng Pexels CDN hoặc URL ổn định khác)
const FALLBACK_ING: Record<string, string> = {
  'chanh hoặc quất': 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=640',
  'đậu phộng rang': 'https://images.unsplash.com/photo-1568702846914-96b305d2aaeb?w=640',
  'mì quảng tươi (sợi vàng)': 'https://images.unsplash.com/photo-1569050467447-ce54b3bbc37d?w=640',
  'nước cốt chanh (hoặc giấm)': 'https://images.unsplash.com/photo-1582803603069-2c13f66cf96c?w=640',
  'thịt ba chỉ (hoặc nạc vai) heo': 'https://images.unsplash.com/photo-1529692236671-f1f6cf9683ba?w=640',
  'thịt ba chỉ heo': 'https://images.unsplash.com/photo-1529692236671-f1f6cf9683ba?w=640',
  'thịt heo ba chỉ (hoặc nạc vai)': 'https://images.unsplash.com/photo-1529692236671-f1f6cf9683ba?w=640',
  'xương bò đùi (hoặc xương sụn)': 'https://images.unsplash.com/photo-1609501676725-7186f017a4b7?w=640',
  'xương ống bò (có tủy)': 'https://images.unsplash.com/photo-1609501676725-7186f017a4b7?w=640',
  'xương ống bò (ống lợn hoặc bò)': 'https://images.unsplash.com/photo-1609501676725-7186f017a4b7?w=640',
  'rau ăn kèm hỗn hợp (xà lách, rau thơm (húng quế, rau răm), giá đỗ, chuối chát, khế chua)':
    'https://images.unsplash.com/photo-1512058564366-18510be2db19?w=640',
};

const FALLBACK_DISH: Record<string, string> = {
  'bún thịt nướng miền trung': 'https://images.unsplash.com/photo-1623341214825-9f4f963727da?w=640',
  'bánh xèo miền trung': 'https://images.unsplash.com/photo-1569050467447-ce54b3bbc37d?w=640',
  'bánh cuốn miền bắc': 'https://images.unsplash.com/photo-1569050467447-ce54b3bbc37d?w=640',
  'bánh canh cua miền nam': 'https://images.unsplash.com/photo-1612929633738-8fe44f7ec841?w=640',
  'gỏi cuốn tôm thịt': 'https://images.unsplash.com/photo-1563245372-f21724e3856d?w=640',
  'phở bò hà nội (phở bò miền bắc)': 'https://images.unsplash.com/photo-1512838243191-e81176be5c76?w=640',
};

function delay(ms: number) { return new Promise(r => setTimeout(r, ms)); }

function fetchBuffer(url: string): Promise<{ buffer: Buffer; contentType: string } | null> {
  return new Promise((resolve) => {
    const req = https.get(url, { headers: { 'User-Agent': 'MoguBot/1.0' } }, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.headers.location) { fetchBuffer(res.headers.location as string).then(resolve); return; }
      const chunks: Buffer[] = []; res.on('data', c => chunks.push(c));
      res.on('end', () => resolve({ buffer: Buffer.concat(chunks), contentType: res.headers['content-type'] ?? 'image/jpeg' }));
    });
    req.on('error', () => resolve(null)); req.setTimeout(15000, () => { req.destroy(); resolve(null); });
  });
}

async function uploadToSupabase(imageUrl: string, path: string): Promise<string | null> {
  const res = await fetchBuffer(imageUrl);
  if (!res || !res.buffer.length) return null;
  const { buffer, contentType } = res;
  const mimeType = contentType.split(';')[0].trim();
  const safeMime = ['image/jpeg', 'image/png', 'image/webp'].includes(mimeType) ? mimeType : 'image/jpeg';
  return new Promise((resolve) => {
    const u = new URL(`${SUPABASE_URL}/storage/v1/object/${STORAGE_BUCKET}/${path}`);
    const req = https.request({
      hostname: u.hostname, path: u.pathname, method: 'POST',
      headers: { 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`, 'Content-Type': safeMime, 'Content-Length': buffer.length, 'x-upsert': 'true' },
    }, (res) => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => { if ((res.statusCode ?? 0) < 300) resolve(path); else { console.error(`Upload err: ${res.statusCode} ${d.substring(0,80)}`); resolve(null); } });
    });
    req.on('error', e => { console.error('Upload conn err:', e.message); resolve(null); });
    req.write(buffer); req.end();
  });
}

async function main() {
  console.log('🔧 Hardcode fix remaining images...\n');

  // Ingredients
  const ings: any[] = await p.ingredient.findMany({
    where: { OR: [{ imageUrl: null }, { imageUrl: '' }], isActive: true },
    select: { id: true, name: true }, orderBy: { name: 'asc' },
  });
  console.log(`📦 Còn ${ings.length} ingredients thiếu ảnh`);
  let ingFixed = 0;
  for (const ing of ings) {
    const lower = ing.name.toLowerCase();
    const url = HARDCODE_ING[lower] ?? FALLBACK_ING[lower];
    if (url) {
      await p.ingredient.update({ where: { id: ing.id }, data: { imageUrl: url } });
      console.log(`  ✓ ${ing.name}`);
      ingFixed++;
    } else {
      console.log(`  skip: ${ing.name}`);
    }
    await delay(50);
  }
  console.log(`✅ Ingredients: +${ingFixed}\n`);

  // Dishes
  const dishesAll: any[] = await p.dish.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true, media: { where: { isPrimary: true }, select: { id: true }, take: 1 } },
  });
  const dishes = dishesAll.filter((d: any) => d.media.length === 0);
  console.log(`🍜 Còn ${dishes.length} dishes thiếu ảnh`);
  let dishFixed = 0;
  for (const dish of dishes) {
    const lower = dish.name.toLowerCase();
    const url = HARDCODE_DISH[lower] ?? FALLBACK_DISH[lower];
    if (url) {
      const ext = url.includes('.png') ? 'png' : url.includes('.webp') ? 'webp' : 'jpg';
      const key = `dishes/${dish.id}/cover-hc-${Date.now()}.${ext}`;
      process.stdout.write(`  [dish] ${dish.name}... `);
      const up = await uploadToSupabase(url, key);
      if (up) {
        await p.dishMedia.create({
          data: { dishId: dish.id, type: 'IMAGE', storageKey: up, bucket: STORAGE_BUCKET, mimeType: `image/${ext === 'jpg' ? 'jpeg' : ext}`, sizeBytes: 0, altText: dish.name, credit: 'Wikimedia/Unsplash', sourceUrl: url, isPrimary: true, moderationStatus: 'APPROVED', sortOrder: 0 },
        });
        console.log('OK'); dishFixed++;
      } else {
        console.log('upload failed');
      }
      await delay(500);
    } else {
      console.log(`  skip: ${dish.name}`);
    }
  }

  // Final stats
  const finalIngMissing: number = await p.ingredient.count({ where: { OR: [{ imageUrl: null }, { imageUrl: '' }], isActive: true } });
  const totalD: number = await p.dish.count({ where: { deletedAt: null } });
  const dishImg: number = await p.dishMedia.count({ where: { isPrimary: true } });

  console.log(`\n=== TỔNG KẾT CUỐI ===`);
  console.log(`Ingredients: +${ingFixed} | còn thiếu: ${finalIngMissing}`);
  console.log(`Dishes: +${dishFixed} | có ảnh: ${dishImg}/${totalD}`);
  console.log('Done!');
  await p.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
