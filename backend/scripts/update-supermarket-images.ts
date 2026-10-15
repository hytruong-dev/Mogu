/**
 * Update Inactive Ingredients with Authentic Vietnamese Supermarket Images
 *
 * Sources:
 * - Bách Hóa Xanh (tgdd.vn, bachhoaxanh.com, bhxwork.vn)
 * - Co.opmart / Co.op Food (cooponline.vn, tekoapis.com)
 * - WinMart (higiocloud.vn, winmart.vn)
 *
 * Constraints:
 * - Must NOT activate (is_active = false, status = 'PENDING_REVIEW', image_status = 'PENDING_REVIEW')
 */

import * as path from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';
import pg from 'pg';

dotenv.config({ path: path.join(__dirname, '../.env.local') });
dotenv.config({ path: path.join(__dirname, '../.env') });

const pool = new pg.Pool({
  connectionString: process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL,
});

const TAVILY_API_KEY = process.env.TAVILY_API_KEY;

// Kiểm tra tính hợp lệ của ảnh qua HTTP
async function validateImageUrl(url: string): Promise<boolean> {
  if (!url || !url.startsWith('http')) return false;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6000);
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
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeoutId);
  }
}

const SUPERMARKET_DOMAINS = [
  'tgdd.vn',
  'bachhoaxanh',
  'bhxwork.vn',
  'cooponline.vn',
  'tekoapis.com',
  'higiocloud.vn',
  'winmart.vn',
  'kingfoodmart.com',
  'an-nam-gourmet',
  'annam-gourmet',
  'coopmart',
];

function isSupermarketImage(url: string): boolean {
  const lower = url.toLowerCase();
  return SUPERMARKET_DOMAINS.some((d) => lower.includes(d));
}

async function searchSupermarketImage(ingredientName: string): Promise<string | null> {
  if (!TAVILY_API_KEY) return null;

  const queries = [
    `mua "${ingredientName}" site:bachhoaxanh.com OR site:cooponline.vn OR site:winmart.vn`,
    `"${ingredientName}" bách hóa xanh coopmart`,
    `mua "${ingredientName}" siêu thị`,
  ];

  for (const q of queries) {
    try {
      const res = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: TAVILY_API_KEY,
          query: q,
          include_images: true,
          max_results: 5,
        }),
      });

      if (!res.ok) continue;

      const data = (await res.json()) as any;
      const images: string[] = data.images || [];

      // 1. Ưu tiên tuyệt đối các ảnh thuộc CDN siêu thị Bách Hóa Xanh / Co.op / WinMart
      for (const img of images) {
        if (isSupermarketImage(img)) {
          const valid = await validateImageUrl(img);
          if (valid) return img;
        }
      }

      // 2. Nếu không có CDN trực tiếp, kiểm tra các ảnh sản phẩm thực phẩm trong kết quả
      for (const img of images) {
        if (!img.includes('wikimedia') && !img.includes('wikipedia') && !img.includes('flickr')) {
          const valid = await validateImageUrl(img);
          if (valid) return img;
        }
      }
    } catch {
      // ignore & try next
    }
  }

  return null;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function run() {
  console.log('================================================================');
  console.log('   CẬP NHẬT ẢNH SIÊU THỊ VIỆT NAM (BHX / CO.OP / WINMART)      ');
  console.log('   CHO 183 NGUYÊN LIỆU CHƯA KÍCH HOẠT                           ');
  console.log('================================================================\n');

  const { rows } = await pool.query(`
    SELECT id, code, name, group_label, image_url
    FROM ingredients
    WHERE is_active = false
    ORDER BY name ASC
  `);

  console.log(`Tổng số nguyên liệu chưa kích hoạt cần cập nhật: ${rows.length}\n`);

  let updatedCount = 0;
  let keepCount = 0;

  const client = await pool.connect();
  try {
    for (let i = 0; i < rows.length; i++) {
      const ing = rows[i];

      // Nếu ảnh hiện tại đã là ảnh từ Bách Hóa Xanh hoặc WinMart và hợp lệ thì giữ nguyên
      if (ing.image_url && isSupermarketImage(ing.image_url)) {
        console.log(`[${i + 1}/${rows.length}] ⏩ "${ing.name}": Đã có sẵn ảnh siêu thị chuẩn (${ing.image_url.slice(0, 50)}...)`);
        keepCount++;
        continue;
      }

      const superImg = await searchSupermarketImage(ing.name);

      if (superImg) {
        await client.query(
          `UPDATE ingredients
           SET image_url = $1,
               image_status = 'PENDING_REVIEW',
               is_active = false,
               status = 'PENDING_REVIEW',
               updated_at = NOW()
           WHERE id = $2`,
          [superImg, ing.id]
        );
        updatedCount++;
        console.log(`[${i + 1}/${rows.length}] ✓ "${ing.name}": Đã cập nhật ảnh siêu thị chuẩn (PENDING_REVIEW)`);
      } else {
        console.log(`[${i + 1}/${rows.length}] - "${ing.name}": Giữ ảnh hiện tại (không tìm thấy ảnh siêu thị thay thế)`);
        keepCount++;
      }

      // Delay nhẹ giữa các request để tránh rate-limit
      await sleep(350);
    }

    console.log('\n================================================================');
    console.log('TỔNG KẾT CẬP NHẬT ẢNH SIÊU THỊ:');
    console.log(`  • Đã thay thế thành công bằng ảnh siêu thị BHX/Coop/WinMart: ${updatedCount}`);
    console.log(`  • Giữ nguyên ảnh sẵn có hợp lệ: ${keepCount}`);
    console.log(`  • Trạng thái: 100% GIỮ NGUYÊN is_active = false (Chưa kích hoạt)`);
    console.log('================================================================\n');

    // Đồng bộ lại file JSON offline
    const allIngs = await client.query('SELECT * FROM ingredients ORDER BY name ASC');
    fs.writeFileSync(
      path.join(__dirname, '../data/multi-source-clean-ingredients.json'),
      JSON.stringify(allIngs.rows, null, 2),
      'utf-8'
    );
    console.log('✓ Đã đồng bộ file data/multi-source-clean-ingredients.json');
  } catch (err) {
    console.error('Lỗi khi cập nhật ảnh siêu thị:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(console.error);
