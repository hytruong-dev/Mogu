import * as path from 'path';
import * as dotenv from 'dotenv';
import pg from 'pg';
import { IngredientNormalizerService } from '../src/ingredients/ingredient-normalizer.service';

dotenv.config({ path: path.join(__dirname, '../.env.local') });
dotenv.config({ path: path.join(__dirname, '../.env') });

const PROPOSED_ADDITIONS = [
  // 1. Rau củ & Thảo mộc truyền thống Việt Nam
  { name: 'Rau tiến vua', group: 'Rau củ', unit: 'Gói', note: 'Gỏi tiến vua tôm thịt, xào bắp bò' },
  { name: 'Rau sắng', group: 'Rau củ', unit: 'Bó', note: 'Rau ngót rừng Chùa Hương nấu canh thịt' },
  { name: 'Bông atiso', group: 'Rau củ', unit: 'Bông', note: 'Bông atiso tươi hầm giò heo Đà Lạt' },
  { name: 'Hoa hẹ', group: 'Rau củ', unit: 'Bó', note: 'Bông hẹ tươi xào cật, tôm mực' },
  { name: 'Súp lơ trắng', group: 'Rau củ', unit: 'Búp', note: 'Bông cải trắng xào thịt, nấu súp' },
  { name: 'Khế chua', group: 'Rau củ', unit: 'Kg', note: 'Kho cá trắm khế, canh riêu cua, bò xào khế' },
  { name: 'Quả dọc', group: 'Rau củ', unit: 'Kg', note: 'Nấu canh chua cá dọc, canh sườn chua' },
  { name: 'Củ kiệu', group: 'Rau củ', unit: 'Kg', note: 'Làm dưa kiệu chua ngọt ăn Tết' },
  { name: 'Lá mắc mật', group: 'Rau củ', unit: 'Bó', note: 'Gia vị vịt quay Lạng Sơn, heo quay' },
  { name: 'Quả mắc mật', group: 'Rau củ', unit: 'Kg', note: 'Quả móc mật kho thịt, ngâm măng ớt' },
  { name: 'Lá chúc', group: 'Rau củ', unit: 'Bó', note: 'Chanh Kaffir An Giang nấu cháo bò, gà hấp' },

  // 2. Gia vị đặc sản
  { name: 'Chẩm chéo', group: 'Gia vị & nước chấm', unit: 'Hũ', note: 'Gia vị chấm đặc sản Tây Bắc' },
  { name: 'Mắm tép', group: 'Gia vị & nước chấm', unit: 'Hũ', note: 'Thịt chưng mắm tép Hàng Bè nức tiếng' },
  { name: 'Tiêu sọ Phú Quốc', group: 'Gia vị & nước chấm', unit: 'Hũ', note: 'Hạt tiêu chín sọ thơm nồng đặc sản' },
  { name: 'Nước màu dừa', group: 'Gia vị & nước chấm', unit: 'Chai', note: 'Thắng từ nước dừa nguyên chất kho cá' },

  // 3. Thủy hải sản sông nước & biển sâu
  { name: 'Cá chép giòn', group: 'Thủy hải sản', unit: 'Kg', note: 'Lẩu cá chép giòn, xào cần tỏi' },
  { name: 'Cá trắm đen', group: 'Thủy hải sản', unit: 'Kg', note: 'Cá trắm đen kho niêu đất làng Vũ Đại' },
  { name: 'Cá trắm cỏ', group: 'Thủy hải sản', unit: 'Kg', note: 'Cá trắm cỏ nấu canh chua, rán giòn' },
  { name: 'Cá rô đồng', group: 'Thủy hải sản', unit: 'Kg', note: 'Canh cải cá rô đồng, bún cá rô' },
  { name: 'Cá thòi lòi', group: 'Thủy hải sản', unit: 'Kg', note: 'Đặc sản Cà Mau nướng muối ớt, kho tiêu' },
  { name: 'Cá đuối', group: 'Thủy hải sản', unit: 'Kg', note: 'Lẩu cá đuối lá giang Vũng Tàu' },
  { name: 'Cá cơm', group: 'Thủy hải sản', unit: 'Kg', note: 'Cá cơm kho tiêu ớt, cá cơm chiên giòn' },
  { name: 'Ốc nhồi', group: 'Thủy hải sản', unit: 'Kg', note: 'Ốc nhồi thịt ống nứa, bún ốc nhồi' },
  { name: 'Ốc len', group: 'Thủy hải sản', unit: 'Kg', note: 'Ốc len xào dừa béo ngậy miền Tây' },
  { name: 'Tu hài', group: 'Thủy hải sản', unit: 'Kg', note: 'Tu hài nướng mỡ hành, hấp sả' },
  { name: 'Bào ngư', group: 'Thủy hải sản', unit: 'Kg', note: 'Bào ngư tươi hầm nấm đông cô, súp' },
  { name: 'Hải sâm', group: 'Thủy hải sản', unit: 'Kg', note: 'Hải sâm biển xào nấm đông cô, tiềm' },

  // 4. Thịt & Gia cầm đặc sản
  { name: 'Thịt chim cút', group: 'Thịt', unit: 'Con', note: 'Chim cút chiên bơ, cút rô ti nước dừa' },
  { name: 'Gà ác', group: 'Thịt', unit: 'Con', note: 'Gà ác đen nguyên con tiềm thuốc bắc' },
  { name: 'Thịt thỏ', group: 'Thịt', unit: 'Kg', note: 'Thịt thỏ xào lăn sả ớt, rô ti' },
  { name: 'Sườn bò', group: 'Thịt', unit: 'Kg', note: 'Sườn bò rút xương, sườn bò hầm sả' },
  { name: 'Cuống tim heo', group: 'Thịt', unit: 'Kg', note: 'Cuống tim xào cần tây hành tây giòn' },
  { name: 'Thịt nọng heo', group: 'Thịt', unit: 'Kg', note: 'Thịt nọng nướng muối ớt, nướng giòn' },

  // 5. Ngũ cốc, đậu hạt & làm bánh chè
  { name: 'Cốm Làng Vòng', group: 'Nông sản & ngũ cốc', unit: 'Gói', note: 'Chả cốm, xôi cốm Hà Nội mùa thu' },
  { name: 'Đậu ngự', group: 'Đậu & hạt', unit: 'Gói', note: 'Nấu chè đậu ngự cung đình Huế, nấu súp' },
  { name: 'Hạt é', group: 'Đậu & hạt', unit: 'Gói', note: 'Hạt é khô ngâm nước uống giải nhiệt' },
  { name: 'Tàu hũ ky', group: 'Nông sản & ngũ cốc', unit: 'Gói', note: 'Váng đậu cuộn nấm, nhúng lẩu, nấu chay' },
  { name: 'Bánh tráng phơi sương', group: 'Nông sản & ngũ cốc', unit: 'Xấp', note: 'Đặc sản Trảng Bàng cuốn thịt luộc' },
];

async function checkCandidates() {
  const normalizer = new IngredientNormalizerService();
  const pool = new pg.Pool({
    connectionString: process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL,
  });

  try {
    const res = await pool.query('SELECT name, identity_normalized, search_folded FROM ingredients');
    const existing = new Set<string>();
    for (const r of res.rows) {
      existing.add(normalizer.identityKey(r.name));
      existing.add(normalizer.searchFolded(r.name));
    }

    const available: typeof PROPOSED_ADDITIONS = [];
    const duplicated: string[] = [];

    for (const p of PROPOSED_ADDITIONS) {
      const iden = normalizer.identityKey(p.name);
      const fold = normalizer.searchFolded(p.name);
      if (existing.has(iden) || existing.has(fold)) {
        duplicated.push(p.name);
      } else {
        available.push(p);
      }
    }

    console.log(`Đã đối soát ${PROPOSED_ADDITIONS.length} nguyên liệu đề xuất:`);
    console.log(`- Trùng lặp đã có: ${duplicated.length} (${duplicated.join(', ') || 'Không có'})`);
    console.log(`- Nguyên liệu mới độc nhất: ${available.length}`);
    available.forEach((a, i) => console.log(`  ${i + 1}. [${a.group}] ${a.name} -> ${a.note}`));
  } finally {
    await pool.end();
  }
}

checkCandidates().catch(console.error);
