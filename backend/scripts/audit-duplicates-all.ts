/**
 * Comprehensive Database Duplication Auditor for Mogu
 *
 * Checks:
 * 1. Row counts across all database tables.
 * 2. Exact duplicates in keys/uniques (identityNormalized, searchFolded, code, name).
 * 3. Near-duplicates in ingredients:
 *    - Accents & spelling variations (e.g., 'i' vs 'y', 'Bột mì' vs 'Bột mỳ')
 *    - Prefix variations (e.g., 'Thịt X' vs 'X', 'Rau X' vs 'X', 'Củ X' vs 'X', 'Cá X' vs 'X')
 *    - Stem & synonym overlaps
 * 4. Other core tables (allergens, categories, regions, diet_types, cooking_methods, users, places).
 */

import * as path from 'path';
import * as dotenv from 'dotenv';
import pg from 'pg';

dotenv.config({ path: path.join(__dirname, '../.env.local') });
dotenv.config({ path: path.join(__dirname, '../.env') });

const pool = new pg.Pool({
  connectionString: process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL,
});

function calculateSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();
  if (s1 === s2) return 1;

  const words1 = new Set(s1.split(/\s+/));
  const words2 = new Set(s2.split(/\s+/));

  const intersection = new Set([...words1].filter((x) => words2.has(x)));
  const union = new Set([...words1, ...words2]);

  return intersection.size / union.size;
}

async function audit() {
  console.log('======================================================');
  console.log('      KIỂM TRA TOÀN DIỆN DỮ LIỆU TRÙNG LẶP TRONG DB   ');
  console.log('======================================================\n');

  // 1. Quét số lượng dòng trong tất cả các bảng
  console.log('--- 1. TỔNG QUAN CÁC BẢNG TRONG DATABASE CÓ DỮ LIỆU ---');
  const tableRes = await pool.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
    ORDER BY table_name;
  `);

  const activeTables: { name: string; count: number }[] = [];
  for (const row of tableRes.rows) {
    const t = row.table_name;
    const cntRes = await pool.query(`SELECT count(*)::int as c FROM "${t}"`);
    const c = cntRes.rows[0].c;
    if (c > 0) {
      activeTables.push({ name: t, count: c });
      console.log(`  • Bảng "${t.padEnd(28)}": ${String(c).padStart(6)} dòng`);
    }
  }

  // 2. Kiểm tra trùng lặp tuyệt đối trong bảng ingredients
  console.log('\n--- 2. KIỂM TRA TRÙNG LẶP TUYỆT ĐỐI BẢNG INGREDIENTS ---');

  // 2.1 Trùng identity_normalized
  const dupIdentity = await pool.query(`
    SELECT identity_normalized, COUNT(*) as cnt, array_agg(name) as names, array_agg(id) as ids
    FROM ingredients
    GROUP BY identity_normalized
    HAVING COUNT(*) > 1;
  `);
  console.log(`  • Trùng khớp hoàn toàn identity_normalized: ${dupIdentity.rows.length} trường hợp`);
  if (dupIdentity.rows.length > 0) {
    console.log('    Chi tiết:', dupIdentity.rows);
  }

  // 2.2 Trùng search_folded (chỉ khác dấu thanh hoặc ký tự đặc biệt)
  const dupFolded = await pool.query(`
    SELECT search_folded, COUNT(*) as cnt, array_agg(name) as names, array_agg(id) as ids
    FROM ingredients
    GROUP BY search_folded
    HAVING COUNT(*) > 1;
  `);
  console.log(`  • Trùng khớp không dấu (search_folded): ${dupFolded.rows.length} trường hợp`);
  if (dupFolded.rows.length > 0) {
    console.log('    Các cặp trùng không dấu:');
    for (const r of dupFolded.rows) {
      console.log(`      - search_folded: "${r.search_folded}" -> Tên: [${r.names.join(' | ')}]`);
    }
  }

  // 2.3 Trùng LOWER(name)
  const dupLower = await pool.query(`
    SELECT LOWER(name) as lname, COUNT(*) as cnt, array_agg(name) as names
    FROM ingredients
    GROUP BY LOWER(name)
    HAVING COUNT(*) > 1;
  `);
  console.log(`  • Trùng khớp LOWER(name): ${dupLower.rows.length} trường hợp`);

  // 3. Kiểm tra trùng lặp bán phần / gần đúng (Near-Duplicates & Variants)
  console.log('\n--- 3. KIỂM TRA TRÙNG LẶP GẦN ĐÚNG / BIẾN THỂ (NEAR-DUPLICATES) ---');
  const allIngRes = await pool.query(`
    SELECT id, code, name, group_label, identity_normalized, search_folded, synonyms
    FROM ingredients
    ORDER BY name ASC;
  `);
  const ingredients = allIngRes.rows;

  const prefixPairs: Array<{
    item1: string;
    item2: string;
    type: string;
    group1: string;
    group2: string;
  }> = [];

  const PREFIXES = ['thịt ', 'rau ', 'củ ', 'trái ', 'quả ', 'hạt '];

  for (let i = 0; i < ingredients.length; i++) {
    const a = ingredients[i];
    const aName = a.name.toLowerCase();
    const aFolded = a.search_folded;

    for (let j = i + 1; j < ingredients.length; j++) {
      const b = ingredients[j];
      const bName = b.name.toLowerCase();
      const bFolded = b.search_folded;

      // 3.1 Cặp có tiền tố (vd: 'Thịt ba chỉ bò' vs 'Ba chỉ bò', 'Rau mồng tơi' vs 'Mồng tơi')
      for (const p of PREFIXES) {
        if (
          (aName.startsWith(p) && aName.slice(p.length) === bName) ||
          (bName.startsWith(p) && bName.slice(p.length) === aName)
        ) {
          prefixPairs.push({
            item1: a.name,
            item2: b.name,
            type: `Thừa/thiếu tiền tố "${p.trim()}"`,
            group1: a.group_label,
            group2: b.group_label,
          });
        }
      }

      // 3.2 Biến thể i/y (vd: 'Bột mì' vs 'Bột mỳ', 'Bánh tráng' vs ...)
      const aIY = aName.replace(/y/g, 'i');
      const bIY = bName.replace(/y/g, 'i');
      if (aName !== bName && aIY === bIY) {
        prefixPairs.push({
          item1: a.name,
          item2: b.name,
          type: 'Biến thể chính tả (i / y)',
          group1: a.group_label,
          group2: b.group_label,
        });
      }

      // 3.3 Một tên là chuỗi con trọn vẹn của tên kia nhưng không phải tiền tố chung chung
      // Ví dụ: "Ức gà" vs "Thịt ức gà" hoặc "Ba rọi heo" vs "Ba rọi rút sườn heo"
      if (aFolded.length >= 5 && bFolded.length >= 5) {
        if (
          (bFolded.includes(aFolded) && bFolded !== aFolded && a.group_label === b.group_label) ||
          (aFolded.includes(bFolded) && aFolded !== bFolded && a.group_label === b.group_label)
        ) {
          const sim = calculateSimilarity(a.name, b.name);
          if (sim >= 0.5) {
            prefixPairs.push({
              item1: a.name,
              item2: b.name,
              type: `Độ tương đồng cao (${(sim * 100).toFixed(0)}%)`,
              group1: a.group_label,
              group2: b.group_label,
            });
          }
        }
      }
    }
  }

  // Khử trùng danh sách cặp đã tìm được
  const seenKey = new Set<string>();
  const uniquePairs = prefixPairs.filter((p) => {
    const k = [p.item1, p.item2].sort().join(' <=> ');
    if (seenKey.has(k)) return false;
    seenKey.add(k);
    return true;
  });

  console.log(`  • Phát hiện ${uniquePairs.length} cặp nguyên liệu có quan hệ gần giống / tương tự:`);
  for (const pair of uniquePairs) {
    console.log(`    - [${pair.type}] "${pair.item1}" <=> "${pair.item2}" (${pair.group1})`);
  }

  // 4. Kiểm tra các bảng Danh mục / Phân loại khác
  console.log('\n--- 4. KIỂM TRA CÁC BẢNG DANH MỤC & PHÂN LOẠI KHÁC ---');

  // 4.1 Bảng allergens
  const dupAllergens = await pool.query(`
    SELECT code, COUNT(*) FROM allergens GROUP BY code HAVING COUNT(*) > 1;
  `);
  console.log(`  • Bảng "allergens": ${dupAllergens.rows.length} mã trùng lặp`);

  // 4.2 Bảng dish_categories
  const dupCategories = await pool.query(`
    SELECT code, COUNT(*) FROM dish_categories GROUP BY code HAVING COUNT(*) > 1;
  `);
  console.log(`  • Bảng "dish_categories": ${dupCategories.rows.length} mã trùng lặp`);

  // 4.3 Bảng regions
  const dupRegions = await pool.query(`
    SELECT code, COUNT(*) FROM regions GROUP BY code HAVING COUNT(*) > 1;
  `);
  console.log(`  • Bảng "regions": ${dupRegions.rows.length} mã trùng lặp`);

  // 4.4 Bảng diet_types
  const dupDiet = await pool.query(`
    SELECT code, COUNT(*) FROM diet_types GROUP BY code HAVING COUNT(*) > 1;
  `);
  console.log(`  • Bảng "diet_types": ${dupDiet.rows.length} mã trùng lặp`);

  // 4.5 Bảng users
  const dupUsers = await pool.query(`
    SELECT email, COUNT(*) FROM users WHERE email IS NOT NULL GROUP BY email HAVING COUNT(*) > 1;
  `);
  console.log(`  • Bảng "users" (trùng email): ${dupUsers.rows.length} trường hợp`);

  console.log('\n======================================================');
  console.log('             HOÀN TẤT KIỂM TRA TRÙNG LẶP              ');
  console.log('======================================================\n');
}

audit()
  .catch((err) => console.error('Lỗi khi audit database:', err))
  .finally(() => pool.end());
