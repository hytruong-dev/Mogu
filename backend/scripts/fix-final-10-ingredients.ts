/**
 * Script cập nhật hình ảnh chuẩn xác 100% cho đúng 10 nguyên liệu chưa kích hoạt.
 *
 * Tiêu chí:
 * - Thay thế các ảnh chưa sát (mì ăn liền, nước lẩu đóng gói, cá tươi nhầm cá khô, súp lơ nhầm rau cải...)
 * - Đảm bảo tất cả URL trả về HTTP 200 OK.
 * - Sửa danh mục 'Lá chanh' từ 'Trái cây' sang 'Rau củ'.
 * - Giữ nguyên isActive = false, status = 'PENDING_REVIEW'.
 */

import * as path from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';
import pg from 'pg';

dotenv.config({ path: path.join(__dirname, '../.env.local') });
dotenv.config({ path: path.join(__dirname, '../.env') });

const FIXED_10_ITEMS: Record<string, { url: string; note: string; newGroupLabel?: string }> = {
  'Bột nở baking': {
    url: 'https://dolambanhdanang.com/wp-content/uploads/2021/04/bot-no-alsa-baking-powder-11g.jpg',
    note: 'Bột nở làm bánh Alsa Baking Powder gói 11g chuẩn chuyên dụng',
  },
  'Cá khô': {
    url: 'https://cdn.tgdd.vn/Products/Images/8400/326246/bhx/kho-ca-sac-an-vinh-goi-200g-202405311532392850.jpg',
    note: 'Bách Hóa Xanh - Khô cá sặc An Vĩnh gói 200g (cá khô chuẩn siêu thị)',
  },
  'Lá chanh': {
    url: 'https://chanhthai.vn/wp-content/uploads/2017/09/La-Chanh-Thai.jpg',
    note: 'Lá chanh tươi xanh thơm gia vị món ăn',
    newGroupLabel: 'Rau củ',
  },
  'Me vắt': {
    url: 'https://cdn.tgdd.vn/Products/Images/8785/222877/bhx/me-chua-vat-hop-68g-202205181657130760.jpg',
    note: 'Bách Hóa Xanh - Me chua vắt nấu canh chua hộp 68g',
  },
  'Nước dùng gà bò': {
    url: 'https://file.hstatic.net/200000079049/file/cach-lam-nuoc-dung-ga-trong-veo-02_c689e2712bd547fc931949d6bd496054.jpg',
    note: 'Bát nước dùng gà bò hầm trong vắt vàng óng tự nhiên',
  },
  'Sườn heo': {
    url: 'https://cdnv2.tgdd.vn/bhx-static/bhx/production/2026/1/image/Products/Images/8781/226856/bhx/suon-non-heo-1kg_202601300959049826.jpg',
    note: 'Bách Hóa Xanh - Khay sườn non heo tươi ngon 1kg',
  },
  'Súp lơ': {
    url: 'https://cdn.tgdd.vn/Products/Images/8785/316280/bhx/bong-cai-xanh-400g-500g-202310170841009023.jpg',
    note: 'Bách Hóa Xanh - Bông cải xanh / súp lơ xanh tươi nguyên búp 500g',
  },
  'Thịt gà': {
    url: 'https://cdn.tgdd.vn/Products/Images/8790/320408/bhx/ga-ta-nguyen-con-202402271109594671.jpg',
    note: 'Bách Hóa Xanh - Thịt gà ta làm sạch nguyên con tươi',
  },
  'Thịt trâu': {
    url: 'https://shoptaybac.com/wp-content/uploads/2025/04/Thit-trau-ban-tuoi-loai-1.jpg',
    note: 'Thịt trâu bản tươi loại 1 màu đỏ sẫm tự nhiên',
  },
  'Xương bò': {
    url: 'https://thitbogiasi.com/upload/sanpham/thit-bo-gia-si-khung-012-xuong-ong-bo-2-9680.jpg',
    note: 'Xương ống bò tươi cưa khúc hầm súp nước dùng',
  },
};

async function validateUrl(url: string): Promise<boolean> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);
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

async function main() {
  const pool = new pg.Pool({
    connectionString: process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL,
  });

  try {
    const res = await pool.query(`
      SELECT id, name, group_label, image_url, is_active, status
      FROM ingredients
      WHERE is_active = false
      ORDER BY name ASC;
    `);

    const inactives = res.rows;
    console.log(`Tìm thấy ${inactives.length} nguyên liệu chưa kích hoạt:`);

    for (const item of inactives) {
      const fix = FIXED_10_ITEMS[item.name];
      if (!fix) {
        console.warn(`! Không có cấu hình fix cho: ${item.name}`);
        continue;
      }

      const valid = await validateUrl(fix.url);
      if (!valid) {
        throw new Error(`URL không hợp lệ hoặc lỗi kết nối: ${fix.url}`);
      }

      console.log(`✓ [${item.name}]:`);
      console.log(`   Cũ: ${item.image_url}`);
      console.log(`   Mới: ${fix.url} (${fix.note})`);

      if (fix.newGroupLabel) {
        await pool.query(
          `
          UPDATE ingredients
          SET 
            image_url = $1,
            image_status = 'PENDING_REVIEW',
            group_label = $2,
            is_active = false,
            status = 'PENDING_REVIEW',
            updated_at = NOW()
          WHERE id = $3;
        `,
          [fix.url, fix.newGroupLabel, item.id],
        );
      } else {
        await pool.query(
          `
          UPDATE ingredients
          SET 
            image_url = $1,
            image_status = 'PENDING_REVIEW',
            is_active = false,
            status = 'PENDING_REVIEW',
            updated_at = NOW()
          WHERE id = $2;
        `,
          [fix.url, item.id],
        );
      }
    }

    console.log(`\n✓ Đã cập nhật thành công 10/10 nguyên liệu vào PostgreSQL!`);
    console.log(`(Vẫn giữ nguyên isActive = false và status = 'PENDING_REVIEW').`);

    // Đồng bộ lại file multi-source-clean-ingredients.json
    const allIngredientsRes = await pool.query(`
      SELECT id, code, name, name_en, group_label, unit, image_url, image_status, is_active, status, synonyms
      FROM ingredients
      ORDER BY name ASC;
    `);
    const backupPath = path.join(__dirname, '../data/multi-source-clean-ingredients.json');
    fs.writeFileSync(backupPath, JSON.stringify(allIngredientsRes.rows, null, 2), 'utf8');
    console.log(`✓ Đã cập nhật đồng bộ file: ${backupPath}`);
  } finally {
    await pool.end();
  }
}

main().catch(console.error);
