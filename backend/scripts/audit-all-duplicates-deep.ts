import * as path from 'path';
import * as dotenv from 'dotenv';
import pg from 'pg';
import { IngredientNormalizerService } from '../src/ingredients/ingredient-normalizer.service';

dotenv.config({ path: path.join(__dirname, '../.env.local') });
dotenv.config({ path: path.join(__dirname, '../.env') });

async function auditDeep() {
  const pool = new pg.Pool({
    connectionString: process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL,
  });

  const normalizer = new IngredientNormalizerService();

  try {
    const res = await pool.query(`
      SELECT id, code, name, group_label, identity_normalized, search_folded, image_url
      FROM ingredients
      ORDER BY group_label, name
    `);

    const items = res.rows;
    console.log(`=== ĐANG QUÉT TRÙNG LẶP CHO ${items.length} NGUYÊN LIỆU ===\n`);

    // 1. Kiểm tra canonical key (lợn=heo, bắp=ngô, đậu phộng=lạc, v.v.)
    const canonicalMap = new Map<string, typeof items>();
    for (const item of items) {
      const canon = normalizer.canonicalKey(item.name);
      if (!canonicalMap.has(canon)) canonicalMap.set(canon, []);
      canonicalMap.get(canon)!.push(item);
    }

    const exactCanonicalDuplicates: Array<{ canon: string; items: string[] }> = [];
    for (const [canon, group] of canonicalMap.entries()) {
      if (group.length > 1) {
        exactCanonicalDuplicates.push({
          canon,
          items: group.map((g) => `${g.name} (${g.group_label})`),
        });
      }
    }

    console.log(`1. Trùng lặp hoàn toàn / từ đồng nghĩa tuyệt đối (Canonical Key): ${exactCanonicalDuplicates.length} nhóm`);
    exactCanonicalDuplicates.forEach((d) => console.log(`   - [${d.canon}]: ${d.items.join(' <==> ')}`));

    // 2. Kiểm tra chuỗi chứa nhau hoặc tên ghép (Substrings & Combined names)
    // Ví dụ: "Sả" nằm trong "Sả cây", "Ngò gai" nằm trong "Ngò gai, rau om", "Mắm nêm" nằm trong "Mắm nêm mắm cá"
    const substringPairs: Array<{ shortItem: string; longItem: string; shortGroup: string; longGroup: string }> = [];
    for (let i = 0; i < items.length; i++) {
      for (let j = 0; j < items.length; j++) {
        if (i === j) continue;
        const a = items[i];
        const b = items[j];

        const foldA = normalizer.searchFolded(a.name);
        const foldB = normalizer.searchFolded(b.name);

        // Nếu a là từ đơn ngắn và b chứa trọn vẹn a như một từ độc lập
        // Bỏ qua các từ quá ngắn như "ca", "bo", "ga" trừ khi có ngữ cảnh rõ ràng
        if (foldA.length >= 3 && foldB.split(' ').includes(foldA) && foldA !== foldB) {
          substringPairs.push({
            shortItem: a.name,
            longItem: b.name,
            shortGroup: a.group_label,
            longGroup: b.group_label,
          });
        }
      }
    }

    console.log(`\n2. Các cặp tên chứa nhau / tên ghép có khả năng trùng hoặc phân tách chưa sạch: ${substringPairs.length} cặp`);
    substringPairs.forEach((p) => {
      console.log(`   - "${p.shortItem}" [${p.shortGroup}] ⊆ "${p.longItem}" [${p.longGroup}]`);
    });

    // 3. Kiểm tra biến thể thương hiệu hoặc đóng gói dư thừa
    // Ví dụ: Gạo ST25, Gạo ST 25 đặc sản, Gạo ST25 Giống Cây Trồng TW, Gạo ST25 lúa ruộng rươi
    console.log(`\n3. Kiểm tra biến thể trùng lặp theo tiền tố món (prefix clusters):`);
    const clusters: Record<string, string[]> = {};
    const PREFIXES = [
      'Gạo ST25',
      'Phở bò',
      'Phở gà',
      'Miến',
      'Mì',
      'Rong biển',
      'Tảo',
      'Dầu ô liu',
      'Đường',
      'Xốt gia vị',
      'Sốt mayonnaise',
      'Muối',
      'Tiêu',
      'Nấm',
      'Xoài',
      'Cam',
      'Táo',
      'Bột',
    ];

    for (const pref of PREFIXES) {
      const match = items
        .filter((it) => it.name.toLowerCase().startsWith(pref.toLowerCase()))
        .map((it) => it.name);
      if (match.length > 1) {
        clusters[pref] = match;
      }
    }

    for (const [pref, list] of Object.entries(clusters)) {
      console.log(`   * Tiền tố "${pref}" (${list.length} mục): ${list.join(', ')}`);
    }
  } finally {
    await pool.end();
  }
}

auditDeep().catch(console.error);
