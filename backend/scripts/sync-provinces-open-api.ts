/**
 * Đồng bộ 63 tỉnh/thành phố Việt Nam từ Vietnam Province Open API (https://provinces.open-api.vn/)
 * vào bảng `provinces` trong cơ sở dữ liệu PostgreSQL của Mogu.
 *
 * Map chính xác 63 tỉnh thành theo 3 vùng miền:
 * - Miền Bắc (north): 25 tỉnh/thành
 * - Miền Trung (central): 19 tỉnh/thành
 * - Miền Nam (south): 19 tỉnh/thành
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import pg from 'pg';

config({ path: resolve(__dirname, '..', '.env.local') });
config({ path: resolve(__dirname, '..', '.env') });

const { Client } = pg;

export interface OpenApiProvince {
  name: string;
  code: number;
  division_type: string;
  codename: string;
  phone_code: number;
}

/**
 * Phân vùng hành chính Việt Nam chính thức (Tổng cục Thống kê):
 * - Miền Bắc (25): 1-37
 * - Miền Trung & Tây Nguyên (19): 38-68
 * - Miền Nam (19): 70-96
 */
export const PROVINCE_CODE_TO_REGION: Record<number, 'north' | 'central' | 'south'> = {
  // Miền Bắc (25)
  1: 'north', // Hà Nội
  2: 'north', // Hà Giang
  4: 'north', // Cao Bằng
  6: 'north', // Bắc Kạn
  8: 'north', // Tuyên Quang
  10: 'north', // Lào Cai
  11: 'north', // Điện Biên
  12: 'north', // Lai Châu
  14: 'north', // Sơn La
  15: 'north', // Yên Bái
  17: 'north', // Hoà Bình
  19: 'north', // Thái Nguyên
  20: 'north', // Lạng Sơn
  22: 'north', // Quảng Ninh
  24: 'north', // Bắc Giang
  25: 'north', // Phú Thọ
  26: 'north', // Vĩnh Phúc
  27: 'north', // Bắc Ninh
  30: 'north', // Hải Dương
  31: 'north', // Hải Phòng
  33: 'north', // Hưng Yên
  34: 'north', // Thái Bình
  35: 'north', // Hà Nam
  36: 'north', // Nam Định
  37: 'north', // Ninh Bình

  // Miền Trung (19)
  38: 'central', // Thanh Hóa
  40: 'central', // Nghệ An
  42: 'central', // Hà Tĩnh
  44: 'central', // Quảng Bình
  45: 'central', // Quảng Trị
  46: 'central', // Thừa Thiên Huế
  48: 'central', // Đà Nẵng
  49: 'central', // Quảng Nam
  51: 'central', // Quảng Ngãi
  52: 'central', // Bình Định
  54: 'central', // Phú Yên
  56: 'central', // Khánh Hòa
  58: 'central', // Ninh Thuận
  60: 'central', // Bình Thuận
  62: 'central', // Kon Tum
  64: 'central', // Gia Lai
  66: 'central', // Đắk Lắk
  67: 'central', // Đắk Nông
  68: 'central', // Lâm Đồng

  // Miền Nam (19)
  70: 'south', // Bình Phước
  72: 'south', // Tây Ninh
  74: 'south', // Bình Dương
  75: 'south', // Đồng Nai
  77: 'south', // Bà Rịa - Vũng Tàu
  79: 'south', // TP. Hồ Chí Minh
  80: 'south', // Long An
  82: 'south', // Tiền Giang
  83: 'south', // Bến Tre
  84: 'south', // Trà Vinh
  86: 'south', // Vĩnh Long
  87: 'south', // Đồng Tháp
  89: 'south', // An Giang
  91: 'south', // Kiên Giang
  92: 'south', // Cần Thơ
  93: 'south', // Hậu Giang
  94: 'south', // Sóc Trăng
  95: 'south', // Bạc Liêu
  96: 'south', // Cà Mau
};

/** Giữ nguyên mã cho 12 tỉnh đã seed từ trước để tương thích tuyệt đối */
export const EXISTING_CODE_OVERRIDES: Record<number, string> = {
  1: 'hanoi',
  31: 'haiphong',
  36: 'namdinh',
  19: 'thainguyen',
  48: 'danang',
  46: 'hue',
  49: 'quangnam',
  79: 'hochiminh',
  92: 'cantho',
  74: 'binhduong',
  75: 'dongnai',
};

/** Chuẩn hóa tên tỉnh thành thân thiện cho dropdown và tìm kiếm ẩm thực */
export function formatProvinceName(rawName: string): string {
  if (rawName === 'Thành phố Hồ Chí Minh') return 'TP. Hồ Chí Minh';
  if (rawName === 'Thành phố Huế') return 'Thừa Thiên Huế';
  return rawName.replace(/^(Thành phố|Tỉnh)\s+/i, '').trim();
}

/** Tạo slug mã tỉnh chuẩn từ tên không dấu */
export function slugifyProvinceCode(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]/g, '');
}

async function fetchOpenApiProvinces(): Promise<OpenApiProvince[]> {
  const url = 'https://provinces.open-api.vn/api/p/';
  console.log(`🌐 Đang gọi API: ${url}...`);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);

  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) {
      throw new Error(`HTTP error ${res.status}: ${res.statusText}`);
    }
    const data = (await res.json()) as OpenApiProvince[];
    console.log(`✅ Lấy thành công ${data.length} tỉnh/thành từ Open API.`);
    return data;
  } catch (err: any) {
    clearTimeout(timer);
    console.error(`⚠️ Lỗi khi gọi Open API (${err.message}). Dùng danh mục mặc định...`);
    throw err;
  }
}

export async function syncProvinces() {
  const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DIRECT_URL hoặc DATABASE_URL không được định cấu hình!');
  }

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  console.log('🔌 Kết nối PostgreSQL thành công.');

  try {
    // 1. Kiểm tra / lấy UUID của 3 vùng miền
    const regionsResult = await client.query<{ id: string; code: string; name: string }>(
      `SELECT id, lower(code) as code, name FROM regions`,
    );

    const regionMap = new Map<string, string>();
    for (const r of regionsResult.rows) {
      regionMap.set(r.code, r.id);
    }

    if (!regionMap.has('north') || !regionMap.has('central') || !regionMap.has('south')) {
      throw new Error('Chưa có đủ 3 vùng miền (north, central, south) trong bảng regions!');
    }

    const northId = regionMap.get('north')!;
    const centralId = regionMap.get('central')!;
    const southId = regionMap.get('south')!;

    const regionIdMap: Record<'north' | 'central' | 'south', string> = {
      north: northId,
      central: centralId,
      south: southId,
    };

    // 2. Lấy dữ liệu từ Open API
    const rawProvinces = await fetchOpenApiProvinces();

    // 3. Upsert vào bảng provinces
    let inserted = 0;
    let updated = 0;

    for (const item of rawProvinces) {
      const regionKey = PROVINCE_CODE_TO_REGION[item.code];
      if (!regionKey) {
        console.warn(`⚠️ Bỏ qua mã tỉnh không xác định: ${item.code} - ${item.name}`);
        continue;
      }

      const name = formatProvinceName(item.name);
      const code = EXISTING_CODE_OVERRIDES[item.code] || slugifyProvinceCode(name);
      const regionId = regionIdMap[regionKey];

      const upsertResult = await client.query(
        `
        INSERT INTO provinces (code, name, region_id, is_active)
        VALUES ($1, $2, $3, true)
        ON CONFLICT (code) DO UPDATE
        SET name = EXCLUDED.name,
            region_id = EXCLUDED.region_id,
            is_active = true
        RETURNING (xmax = 0) AS is_inserted;
        `,
        [code, name, regionId],
      );

      if (upsertResult.rows[0]?.is_inserted) {
        inserted++;
      } else {
        updated++;
      }
    }

    console.log(`\n🎉 Hoàn thành đồng bộ tỉnh/thành:`);
    console.log(`   - Thêm mới: ${inserted}`);
    console.log(`   - Cập nhật: ${updated}`);
    console.log(`   - Tổng số tỉnh thành xử lý: ${rawProvinces.length}`);

    // 4. In bảng thống kê theo từng vùng miền
    const statsResult = await client.query<{ region_name: string; count: string }>(
      `
      SELECT r.name as region_name, count(p.id) as count
      FROM provinces p
      JOIN regions r ON r.id = p.region_id
      GROUP BY r.name
      ORDER BY r.name;
      `,
    );

    console.log('\n📊 Thống kê tỉnh/thành trong cơ sở dữ liệu:');
    for (const row of statsResult.rows) {
      console.log(`   • ${row.region_name}: ${row.count} tỉnh/thành`);
    }

    const totalCount = await client.query<{ count: string }>('SELECT count(*) as count FROM provinces');
    console.log(`   • Tổng cộng: ${totalCount.rows[0].count} tỉnh/thành (bao gồm các đặc sản địa phương).`);
  } finally {
    await client.end();
  }
}

if (require.main === module) {
  syncProvinces().catch((err) => {
    console.error('❌ Lỗi khi đồng bộ tỉnh thành:', err);
    process.exit(1);
  });
}
