import * as path from 'path';
import * as dotenv from 'dotenv';
import pg from 'pg';

dotenv.config({ path: path.join(__dirname, '../.env.local') });
dotenv.config({ path: path.join(__dirname, '../.env') });

async function inspectScope() {
  const pool = new pg.Pool({
    connectionString: process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL,
  });

  try {
    const names = [
      'Sả', 'Sả cây',
      'Mùi tàu', 'Ngò gai', 'Ngò gai, rau om', 'Ngò om',
      'Quất', 'Tắc',
      'Xốt mayonnaise', 'Sốt mayonnaise',
      'Dầu ô liu Extra Virgin', 'Dầu ôliu Olivoila Extra Virgin',
      'Xốt muối kim cho', 'Sốt muối kim chi',
      'Thịt heo xay', 'Thịt heo xay đặc biệt',
      'Thịt heo ba chỉ', 'Ba rọi heo', 'Thịt Ba Rọi có da MH giun quế',
      'Rau nhút rau ngổ',
      'Mắm nêm mắm cá', 'Mắm nêm',
      'Tương hột Tương bần', 'Tương bần',
      'Cua biển ghẹ', 'Nghêu sò hến',
      'Gạo ST25', 'Gạo ST 25 đặc sản', 'Gạo ST25 Giống Cây Trồng TW', 'Gạo ST25 lúa ruộng rươi',
      'Bột ngọt', 'Mì chính JP', 'Mì chính Plus',
      'Thịt', 'Đậu', 'Cá', 'Vị chua'
    ];

    const res = await pool.query(
      `SELECT id, code, name, group_label, is_active, status FROM ingredients WHERE name = ANY($1) ORDER BY name`,
      [names]
    );

    console.log(`Tìm thấy ${res.rows.length} mục trùng lặp/dư thừa tiêu biểu:`);
    res.rows.forEach(r => console.log(` - [${r.code}] "${r.name}" (${r.group_label}) - Active: ${r.is_active}`));
  } finally {
    await pool.end();
  }
}

inspectScope().catch(console.error);
