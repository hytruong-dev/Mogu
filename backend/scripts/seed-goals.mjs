/**
 * Seed Goals vào DB
 * Usage: node scripts/seed-goals.mjs
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const env = readFileSync(join(__dirname, '../.env.local'), 'utf8');
const getEnv = (key) => env.match(new RegExp(`^${key}=(.+)`, 'm'))?.[1]?.trim();

const supabase = createClient(getEnv('SUPABASE_URL'), getEnv('SUPABASE_SERVICE_ROLE_KEY'));

const GOALS = [
  {
    code: 'BALANCE',
    name: 'Cân bằng',
    description: 'Duy trì chế độ ăn cân bằng, đa dạng dinh dưỡng',
    displayOrder: 1,
    active: true,
  },
  {
    code: 'LOSE_WEIGHT',
    name: 'Giảm cân',
    description: 'Ưu tiên món ít calo, nhiều chất xơ',
    displayOrder: 2,
    active: true,
  },
  {
    code: 'BUILD_MUSCLE',
    name: 'Tăng cơ',
    description: 'Món giàu protein, hỗ trợ tăng cơ bắp',
    displayOrder: 3,
    active: true,
  },
  {
    code: 'EAT_HEALTHY',
    name: 'Ăn lành mạnh',
    description: 'Ưu tiên thực phẩm sạch, hữu cơ, ít chế biến',
    displayOrder: 4,
    active: true,
  },
  {
    code: 'SAVE_MONEY',
    name: 'Tiết kiệm',
    description: 'Món ngon, giá cả phải chăng',
    displayOrder: 5,
    active: true,
  },
  {
    code: 'EXPLORE',
    name: 'Khám phá',
    description: 'Thử những món mới, đa dạng vùng miền',
    displayOrder: 6,
    active: true,
  },
];

async function main() {
  console.log('🌱 Seeding Goals...\n');

  for (const goal of GOALS) {
    // Upsert theo code
    const { data: existing } = await supabase
      .from('goals')
      .select('id')
      .eq('code', goal.code)
      .single();

    if (existing) {
      const { error } = await supabase
        .from('goals')
        .update({
          name: goal.name,
          description: goal.description,
          display_order: goal.displayOrder,
          active: goal.active,
        })
        .eq('id', existing.id);

      if (error) {
        console.error(`  ❌ Update ${goal.code}:`, error.message);
      } else {
        console.log(`  ✅ Updated: ${goal.name} (${goal.code})`);
      }
    } else {
      const { error } = await supabase.from('goals').insert({
        code: goal.code,
        name: goal.name,
        description: goal.description,
        display_order: goal.displayOrder,
        active: goal.active,
      });
      if (error) {
        console.error(`  ❌ Insert ${goal.code}:`, error.message);
      } else {
        console.log(`  ✅ Inserted: ${goal.name} (${goal.code})`);
      }
    }
  }

  // Verify
  const { data: all } = await supabase
    .from('goals')
    .select('code, name, display_order, active')
    .order('display_order');

  console.log('\n📋 Goals hiện tại trong DB:');
  console.table(all);
}

main().catch(console.error);
