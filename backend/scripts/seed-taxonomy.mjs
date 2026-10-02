import pg from 'pg';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { config } from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, '..', '.env.local') });

const client = new pg.Client({ connectionString: process.env.DIRECT_URL, ssl: { rejectUnauthorized: false } });

async function main() {
  await client.connect();
  console.log('🌱 Seeding BA-004 taxonomy data...');

  // ── Regions ───────────────────────────────────────────────────────────────
  const regions = [
    { code: 'north', name: 'Miền Bắc' },
    { code: 'central', name: 'Miền Trung' },
    { code: 'south', name: 'Miền Nam' },
  ];
  for (const r of regions) {
    await client.query(
      `INSERT INTO regions (code, name) VALUES ($1, $2) ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name`,
      [r.code, r.name],
    );
  }
  console.log(`✅ Regions: ${regions.length}`);

  // ── Provinces (63 tỉnh/thành chuẩn từ https://provinces.open-api.vn/ + đặc sản Hội An) ──
  const northId = (await client.query(`SELECT id FROM regions WHERE code='north'`)).rows[0].id;
  const centralId = (await client.query(`SELECT id FROM regions WHERE code='central'`)).rows[0].id;
  const southId = (await client.query(`SELECT id FROM regions WHERE code='south'`)).rows[0].id;

  const provinces = [
    // Miền Bắc (25)
    { code: 'hanoi', name: 'Hà Nội', regionId: northId },
    { code: 'hagiang', name: 'Hà Giang', regionId: northId },
    { code: 'caobang', name: 'Cao Bằng', regionId: northId },
    { code: 'backan', name: 'Bắc Kạn', regionId: northId },
    { code: 'tuyenquang', name: 'Tuyên Quang', regionId: northId },
    { code: 'laocai', name: 'Lào Cai', regionId: northId },
    { code: 'dienbien', name: 'Điện Biên', regionId: northId },
    { code: 'laichau', name: 'Lai Châu', regionId: northId },
    { code: 'sonla', name: 'Sơn La', regionId: northId },
    { code: 'yenbai', name: 'Yên Bái', regionId: northId },
    { code: 'hoabinh', name: 'Hoà Bình', regionId: northId },
    { code: 'thainguyen', name: 'Thái Nguyên', regionId: northId },
    { code: 'langson', name: 'Lạng Sơn', regionId: northId },
    { code: 'quangninh', name: 'Quảng Ninh', regionId: northId },
    { code: 'bacgiang', name: 'Bắc Giang', regionId: northId },
    { code: 'phutho', name: 'Phú Thọ', regionId: northId },
    { code: 'vinhphuc', name: 'Vĩnh Phúc', regionId: northId },
    { code: 'bacninh', name: 'Bắc Ninh', regionId: northId },
    { code: 'haiduong', name: 'Hải Dương', regionId: northId },
    { code: 'haiphong', name: 'Hải Phòng', regionId: northId },
    { code: 'hungyen', name: 'Hưng Yên', regionId: northId },
    { code: 'thaibinh', name: 'Thái Bình', regionId: northId },
    { code: 'hanam', name: 'Hà Nam', regionId: northId },
    { code: 'namdinh', name: 'Nam Định', regionId: northId },
    { code: 'ninhbinh', name: 'Ninh Bình', regionId: northId },

    // Miền Trung (19 + Hội An = 20)
    { code: 'thanhhoa', name: 'Thanh Hóa', regionId: centralId },
    { code: 'nghean', name: 'Nghệ An', regionId: centralId },
    { code: 'hatinh', name: 'Hà Tĩnh', regionId: centralId },
    { code: 'quangbinh', name: 'Quảng Bình', regionId: centralId },
    { code: 'quangtri', name: 'Quảng Trị', regionId: centralId },
    { code: 'hue', name: 'Thừa Thiên Huế', regionId: centralId },
    { code: 'danang', name: 'Đà Nẵng', regionId: centralId },
    { code: 'hoian', name: 'Hội An', regionId: centralId },
    { code: 'quangnam', name: 'Quảng Nam', regionId: centralId },
    { code: 'quangngai', name: 'Quảng Ngãi', regionId: centralId },
    { code: 'binhdinh', name: 'Bình Định', regionId: centralId },
    { code: 'phuyen', name: 'Phú Yên', regionId: centralId },
    { code: 'khanhhoa', name: 'Khánh Hòa', regionId: centralId },
    { code: 'ninhthuan', name: 'Ninh Thuận', regionId: centralId },
    { code: 'binhthuan', name: 'Bình Thuận', regionId: centralId },
    { code: 'kontum', name: 'Kon Tum', regionId: centralId },
    { code: 'gialai', name: 'Gia Lai', regionId: centralId },
    { code: 'daklak', name: 'Đắk Lắk', regionId: centralId },
    { code: 'daknong', name: 'Đắk Nông', regionId: centralId },
    { code: 'lamdong', name: 'Lâm Đồng', regionId: centralId },

    // Miền Nam (19)
    { code: 'binhphuoc', name: 'Bình Phước', regionId: southId },
    { code: 'tayninh', name: 'Tây Ninh', regionId: southId },
    { code: 'binhduong', name: 'Bình Dương', regionId: southId },
    { code: 'dongnai', name: 'Đồng Nai', regionId: southId },
    { code: 'bariavungtau', name: 'Bà Rịa - Vũng Tàu', regionId: southId },
    { code: 'hochiminh', name: 'TP. Hồ Chí Minh', regionId: southId },
    { code: 'longan', name: 'Long An', regionId: southId },
    { code: 'tiengiang', name: 'Tiền Giang', regionId: southId },
    { code: 'bentre', name: 'Bến Tre', regionId: southId },
    { code: 'travinh', name: 'Trà Vinh', regionId: southId },
    { code: 'vinhlong', name: 'Vĩnh Long', regionId: southId },
    { code: 'dongthap', name: 'Đồng Tháp', regionId: southId },
    { code: 'angiang', name: 'An Giang', regionId: southId },
    { code: 'kiengiang', name: 'Kiên Giang', regionId: southId },
    { code: 'cantho', name: 'Cần Thơ', regionId: southId },
    { code: 'haugiang', name: 'Hậu Giang', regionId: southId },
    { code: 'soctrang', name: 'Sóc Trăng', regionId: southId },
    { code: 'baclieu', name: 'Bạc Liêu', regionId: southId },
    { code: 'camau', name: 'Cà Mau', regionId: southId },
  ];
  for (const p of provinces) {
    await client.query(
      `INSERT INTO provinces (code, name, region_id) VALUES ($1, $2, $3) ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name`,
      [p.code, p.name, p.regionId],
    );
  }
  console.log(`✅ Provinces: ${provinces.length}`);

  // ── Dish Categories ───────────────────────────────────────────────────────
  const categories = [
    { code: 'COM', name: 'Cơm', displayOrder: 1 },
    { code: 'PHO', name: 'Phở & Bún', displayOrder: 2 },
    { code: 'BANH', name: 'Bánh', displayOrder: 3 },
    { code: 'LẨU', name: 'Lẩu', displayOrder: 4 },
    { code: 'CHAY', name: 'Chay', displayOrder: 5 },
    { code: 'HAI_SAN', name: 'Hải sản', displayOrder: 6 },
    { code: 'THIT', name: 'Thịt', displayOrder: 7 },
    { code: 'TRANG_MIENG', name: 'Tráng miệng', displayOrder: 8 },
    { code: 'DO_UONG', name: 'Đồ uống', displayOrder: 9 },
    { code: 'AN_VAN', name: 'Ăn vặt', displayOrder: 10 },
  ];
  for (const c of categories) {
    await client.query(
      `INSERT INTO dish_categories (code, name, display_order) VALUES ($1, $2, $3) ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name`,
      [c.code, c.name, c.displayOrder],
    );
  }
  console.log(`✅ Dish Categories: ${categories.length}`);

  // ── Meal Type Tags ────────────────────────────────────────────────────────
  const mealTypes = [
    { code: 'BREAKFAST', name: 'Bữa sáng', displayOrder: 1 },
    { code: 'LUNCH', name: 'Bữa trưa', displayOrder: 2 },
    { code: 'DINNER', name: 'Bữa tối', displayOrder: 3 },
    { code: 'SNACK', name: 'Ăn vặt', displayOrder: 4 },
    { code: 'DESSERT', name: 'Tráng miệng', displayOrder: 5 },
  ];
  for (const m of mealTypes) {
    await client.query(
      `INSERT INTO meal_type_tags (code, name, display_order) VALUES ($1, $2, $3) ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name`,
      [m.code, m.name, m.displayOrder],
    );
  }
  console.log(`✅ Meal Type Tags: ${mealTypes.length}`);

  // ── Diet Types ────────────────────────────────────────────────────────────
  const dietTypes = [
    { code: 'OMNIVORE', name: 'Ăn tạp', displayOrder: 1 },
    { code: 'VEGETARIAN', name: 'Ăn chay (có trứng/sữa)', displayOrder: 2 },
    { code: 'VEGAN', name: 'Thuần chay', displayOrder: 3 },
    { code: 'PESCATARIAN', name: 'Ăn hải sản, không thịt', displayOrder: 4 },
    { code: 'KETO', name: 'Keto (ít carb)', displayOrder: 5 },
    { code: 'GLUTEN_FREE', name: 'Không gluten', displayOrder: 6 },
    { code: 'HALAL', name: 'Halal', displayOrder: 7 },
  ];
  for (const d of dietTypes) {
    await client.query(
      `INSERT INTO diet_types (code, name, display_order) VALUES ($1, $2, $3) ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name`,
      [d.code, d.name, d.displayOrder],
    );
  }
  console.log(`✅ Diet Types: ${dietTypes.length}`);

  // ── Update goals is_active ────────────────────────────────────────────────
  await client.query(`UPDATE goals SET is_active = true WHERE is_active IS NULL OR is_active = false`);
  await client.query(`UPDATE allergens SET is_active = true WHERE is_active IS NULL OR is_active = false`);
  console.log('✅ Updated goals & allergens is_active');

  console.log('\n🎉 Seed taxonomy BA-004 hoàn tất!');
  await client.end();
}

main().catch((e) => {
  console.error('❌ Seed thất bại:', e.message);
  process.exit(1);
});
