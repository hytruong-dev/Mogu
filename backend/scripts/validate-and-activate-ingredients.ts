/**
 * Validate Image URLs and Activate Ingredients
 *
 * Rules:
 * - If imageUrl is valid and returns HTTP 200 (image/*) -> ACTIVATE (isActive = true, status = 'ACTIVE', imageStatus = 'APPROVED').
 * - If imageUrl is null, empty, or returns error (404, 403, broken link => renders knife & fork icon) -> DO NOT ACTIVATE (isActive = false, status = 'PENDING_REVIEW').
 */

import * as path from 'path';
import * as dotenv from 'dotenv';
import pg from 'pg';

dotenv.config({ path: path.join(__dirname, '../.env.local') });
dotenv.config({ path: path.join(__dirname, '../.env') });

const pool = new pg.Pool({
  connectionString: process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL,
});

interface CheckResult {
  id: string;
  name: string;
  imageUrl: string | null;
  isValidImage: boolean;
  reason: string;
}

async function checkUrl(url: string | null): Promise<{ ok: boolean; reason: string }> {
  if (!url || typeof url !== 'string' || !url.trim().startsWith('http')) {
    return { ok: false, reason: 'Không có URL ảnh' };
  }

  const trimmed = url.trim();

  // Kiểm tra nhanh định dạng URL
  try {
    new URL(trimmed);
  } catch {
    return { ok: false, reason: 'URL không hợp lệ' };
  }

  // Gửi request HEAD/GET với AbortController timeout 6s
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6000);

  try {
    let res = await fetch(trimmed, {
      method: 'HEAD',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
      },
      signal: controller.signal,
    });

    // Một số CDN (như WinMart/BHX) từ chối HEAD (405 Method Not Allowed), thử lại với GET Range 0-1024
    if (res.status === 405 || res.status === 403) {
      res = await fetch(trimmed, {
        method: 'GET',
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Range: 'bytes=0-1024',
          Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        },
        signal: controller.signal,
      });
    }

    if (res.ok) {
      const contentType = res.headers.get('content-type') || '';
      // Một số CDN trả octet-stream hoặc image/*
      if (
        contentType.includes('image') ||
        contentType.includes('octet-stream') ||
        /\.(jpg|jpeg|png|webp|avif|gif)$/i.test(trimmed)
      ) {
        return { ok: true, reason: 'Ảnh hợp lệ' };
      }
      return { ok: false, reason: `Content-type không phải ảnh (${contentType})` };
    } else {
      return { ok: false, reason: `HTTP ${res.status}` };
    }
  } catch (err: any) {
    if (err.name === 'AbortError') {
      return { ok: false, reason: 'Timeout khi tải ảnh' };
    }
    return { ok: false, reason: `Lỗi kết nối: ${err.message}` };
  } finally {
    clearTimeout(timeoutId);
  }
}

async function run() {
  console.log('===============================================================');
  console.log('   KIỂM TRA URL ẢNH & KÍCH HOẠT NGUYÊN LIỆU HỢP LỆ VÀO DB      ');
  console.log('===============================================================\n');

  const { rows } = await pool.query(`
    SELECT id, code, name, image_url, status, is_active, image_status
    FROM ingredients
    ORDER BY name ASC
  `);

  console.log(`Tổng số nguyên liệu cần kiểm tra: ${rows.length}\n`);

  const results: CheckResult[] = [];
  const BATCH_SIZE = 15;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const chunk = rows.slice(i, i + BATCH_SIZE);
    const chunkPromises = chunk.map(async (row) => {
      const check = await checkUrl(row.image_url);
      return {
        id: row.id,
        name: row.name,
        imageUrl: row.image_url,
        isValidImage: check.ok,
        reason: check.reason,
      };
    });

    const chunkResults = await Promise.all(chunkPromises);
    results.push(...chunkResults);
    process.stdout.write(`Đã kiểm tra ${Math.min(i + BATCH_SIZE, rows.length)}/${rows.length} ảnh...\r`);
  }

  console.log('\nHoàn tất kiểm tra mạng cho toàn bộ ảnh!\n');

  const validItems = results.filter((r) => r.isValidImage);
  const invalidOrNoImage = results.filter((r) => !r.isValidImage);

  console.log(`--- THỐNG KÊ KẾT QUẢ KIỂM TRA ẢNH ---`);
  console.log(`  ✓ Số nguyên liệu có ảnh hợp lệ, tải được: ${validItems.length}`);
  console.log(`  ✗ Số nguyên liệu KHÔNG có ảnh hoặc ảnh lỗi (nĩa dao): ${invalidOrNoImage.length}`);

  console.log('\nVí dụ một số ảnh lỗi/không có ảnh:');
  invalidOrNoImage.slice(0, 10).forEach((item) => {
    console.log(`  - "${item.name}": ${item.reason} (URL: ${item.imageUrl || 'null'})`);
  });

  // Cập nhật vào DB
  console.log('\n--- TIẾN HÀNH CẬP NHẬT TRẠNG THÁI TRONG DATABASE ---');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Kích hoạt những nguyên liệu có ảnh đầy đủ
    const validIds = validItems.map((x) => x.id);
    if (validIds.length > 0) {
      await client.query(
        `UPDATE ingredients
         SET is_active = true,
             status = 'ACTIVE',
             image_status = 'APPROVED',
             updated_at = NOW()
         WHERE id = ANY($1::uuid[])`,
        [validIds]
      );
      console.log(`  ✓ ĐÃ KÍCH HOẠT (is_active = true, status = 'ACTIVE'): ${validIds.length} nguyên liệu có ảnh đầy đủ.`);
    }

    // 2. Tắt / không kích hoạt những nguyên liệu không có ảnh hoặc ảnh lỗi
    const invalidIds = invalidOrNoImage.map((x) => x.id);
    if (invalidIds.length > 0) {
      // Đối với ảnh lỗi HTTP 404/broken (gây ra hình nĩa dao), ta cũng set image_url = null và image_status = 'NOT_FOUND' để giao diện sạch sẽ
      for (const item of invalidOrNoImage) {
        if (item.imageUrl) {
          await client.query(
            `UPDATE ingredients
             SET is_active = false,
                 status = 'PENDING_REVIEW',
                 image_status = 'NOT_FOUND',
                 image_url = NULL,
                 updated_at = NOW()
             WHERE id = $1`,
            [item.id]
          );
        } else {
          await client.query(
            `UPDATE ingredients
             SET is_active = false,
                 status = 'PENDING_REVIEW',
                 image_status = 'NOT_REQUESTED',
                 updated_at = NOW()
             WHERE id = $1`,
            [item.id]
          );
        }
      }
      console.log(`  ✗ ĐÃ KHÓA / CHƯA KÍCH HOẠT (is_active = false, status = 'PENDING_REVIEW'): ${invalidIds.length} nguyên liệu.`);
    }

    await client.query('COMMIT');
    console.log('\n✓ Cập nhật thành công vào Database!');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('Lỗi khi cập nhật DB:', e);
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(console.error);
