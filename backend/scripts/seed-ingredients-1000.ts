/**
 * Seed 1000 nguyên liệu từ CSV vào DB
 * - Xóa toàn bộ dữ liệu ingredient cũ (cascade DishIngredient)
 * - Import 1000 nguyên liệu mới, tạo slug + code từ tên
 */
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

dotenv.config({ path: path.join(__dirname, '../.env.local') });

const pool = new (pg.Pool)({
  connectionString: process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL,
});
const adapter = new PrismaPg(pool);
const db = new PrismaClient({ adapter } as any) as any;

// ─── CSV parser ───────────────────────────────────────────────────────────────

interface CsvRow {
  stt: number;
  nhom: string;
  ten: string;
}

function parseCSV(filePath: string): CsvRow[] {
  const raw = fs.readFileSync(filePath);
  // Try UTF-8 first, fallback character by character
  let content: string;
  try {
    content = raw.toString('utf-8');
    // Check if it looks OK (contains Vietnamese)
    if (!content.includes('ộ') && !content.includes('ắ')) {
      throw new Error('not utf8');
    }
  } catch {
    content = raw.toString('latin1');
  }

  const lines = content.split('\n');
  const rows: CsvRow[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Parse CSV line with quotes
    const parts = parseCSVLine(trimmed);
    if (parts.length < 3) continue;

    const stt = parseInt(parts[0].trim(), 10);
    if (isNaN(stt)) continue;

    const nhom = parts[1].trim().replace(/^"|"$/g, '').trim();
    const ten = parts[2].trim().replace(/^"|"$/g, '').trim();

    if (nhom && ten) {
      rows.push({ stt, nhom, ten });
    }
  }

  return rows;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

// ─── Slug / code generator ────────────────────────────────────────────────────

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80);
}

function toCode(name: string): string {
  return name
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/Đ/g, 'D')
    .replace(/[^A-Z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, '_')
    .slice(0, 60);
}

// Map Vietnamese group names to English group keys
function mapGroup(nhom: string): string {
  const nhomClean = nhom.toLowerCase();
  if (nhomClean.includes('rau lá') || nhomClean.includes('rau thơm')) return 'Rau lá và rau thơm';
  if (nhomClean.includes('củ') || nhomClean.includes('nấm')) return 'Củ quả và nấm';
  if (nhomClean.includes('trái cây') || nhomClean.includes('trai cay')) return 'Trái cây';
  if (nhomClean.includes('thịt') || nhomClean.includes('trứng') || nhomClean.includes('nội tạng')) return 'Thịt, trứng và nội tạng';
  if (nhomClean.includes('cá') || nhomClean.includes('hải sản')) return 'Cá và hải sản';
  if (nhomClean.includes('gạo') || nhomClean.includes('bột') || nhomClean.includes('mì') || nhomClean.includes('đậu')) return 'Gạo, bột, mì và đậu';
  if (nhomClean.includes('gia vị') || nhomClean.includes('khô')) return 'Gia vị khô';
  if (nhomClean.includes('nước chấm') || nhomClean.includes('dầu') || nhomClean.includes('sốt')) return 'Nước chấm, dầu và sốt';
  if (nhomClean.includes('đồ khô') || nhomClean.includes('chế biến') || nhomClean.includes('phụ')) return 'Đồ khô, chế biến và nguyên liệu phụ';
  if (nhomClean.includes('vùng miền') || nhomClean.includes('đồ uống')) return 'Nguyên liệu vùng miền và đồ uống';
  return nhom; // fallback — giữ nguyên
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const csvPath = path.join('c:/Users/PC/Downloads/1000_nguyen_lieu_am_thuc_viet_nam.csv');

  console.log('📂 Đọc file CSV...');
  const rows = parseCSV(csvPath);
  console.log(`✅ Đọc được ${rows.length} nguyên liệu`);

  // Show sample
  console.log('\nSample (5 dòng đầu):');
  for (const r of rows.slice(0, 5)) {
    console.log(`  [${r.nhom}] ${r.ten}`);
  }

  // Count groups
  const groupCounts: Record<string, number> = {};
  for (const r of rows) {
    const g = mapGroup(r.nhom);
    groupCounts[g] = (groupCounts[g] || 0) + 1;
  }
  console.log('\nNhóm nguyên liệu:');
  for (const [g, c] of Object.entries(groupCounts)) {
    console.log(`  [${c.toString().padStart(3)}] ${g}`);
  }

  // ── STEP 1: Xóa dữ liệu cũ ────────────────────────────────────────────────
  console.log('\n🗑️  Xóa dữ liệu nguyên liệu cũ...');

  // Xóa DishIngredient links trước
  const delDI = await db.dishIngredient.deleteMany({});
  console.log(`  Đã xóa ${delDI.count} DishIngredient records`);

  // Xóa Ingredient
  const delIng = await db.ingredient.deleteMany({});
  console.log(`  Đã xóa ${delIng.count} Ingredient records`);

  // ── STEP 2: Seed 1000 nguyên liệu mới ─────────────────────────────────────
  console.log('\n🌱 Seed 1000 nguyên liệu mới...');

  // Track slugs để tránh trùng
  const usedCodes = new Set<string>();

  const toInsert = rows.map((row) => {
    let slug = toSlug(row.ten);
    let code = toCode(row.ten);

    // Ensure unique code
    if (usedCodes.has(code)) {
      code = `${code}_${row.stt}`;
    }
    usedCodes.add(code);

    return {
      name: row.ten,
      code: code.slice(0, 99),
      // group stored as part of synonyms array for searchability
      synonyms: [mapGroup(row.nhom)],
      imageUrl: null as string | null,
    };
  });

  // Insert theo batch 100
  const BATCH = 100;
  let created = 0;
  for (let i = 0; i < toInsert.length; i += BATCH) {
    const batch = toInsert.slice(i, i + BATCH);
    await db.ingredient.createMany({ data: batch, skipDuplicates: true });
    created += batch.length;
    process.stdout.write(`\r  Đã thêm ${created}/${toInsert.length}...`);
  }

  console.log(`\n\n✅ Hoàn thành! Đã seed ${created} nguyên liệu.`);

  // Verify
  const total = await db.ingredient.count();
  console.log(`📊 Tổng ingredient trong DB: ${total}`);
}

main().catch(console.error).finally(async () => {
  await db.$disconnect();
  await pool.end();
});
