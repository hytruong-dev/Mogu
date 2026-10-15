import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import { IngredientNormalizerService } from '../src/ingredients/ingredient-normalizer.service';

dotenv.config({ path: path.join(__dirname, '../.env.local') });
dotenv.config({ path: path.join(__dirname, '../.env') });

const TAVILY_API_KEY = process.env.TAVILY_API_KEY;

export const CANDIDATES_38 = [
  { name: 'Rau tiến vua', group: 'Rau củ', unit: 'Gói', query: 'rau tiến vua khô ngâm nước gói siêu thị' },
  { name: 'Rau sắng', group: 'Rau củ', unit: 'Bó', query: 'rau sắng chùa hương rau ngót rừng tươi bó' },
  { name: 'Bông atiso', group: 'Rau củ', unit: 'Bông', query: 'bông atiso tươi đà lạt bách hóa xanh' },
  { name: 'Hoa hẹ', group: 'Rau củ', unit: 'Bó', query: 'bông hẹ tươi hoa hẹ bách hóa xanh winmart' },
  { name: 'Súp lơ trắng', group: 'Rau củ', unit: 'Búp', query: 'súp lơ trắng bông cải trắng bách hóa xanh winmart' },
  { name: 'Khế chua', group: 'Rau củ', unit: 'Kg', query: 'quả khế chua tươi quả khế xanh' },
  { name: 'Quả dọc', group: 'Rau củ', unit: 'Kg', query: 'quả dọc tươi nấu canh chua' },
  { name: 'Củ kiệu', group: 'Rau củ', unit: 'Kg', query: 'củ kiệu tươi huế bách hóa xanh' },
  { name: 'Lá mắc mật', group: 'Rau củ', unit: 'Bó', query: 'lá mắc mật tươi lạng sơn' },
  { name: 'Quả mắc mật', group: 'Rau củ', unit: 'Kg', query: 'quả mắc mật tươi quả móc mật' },
  { name: 'Lá chúc', group: 'Rau củ', unit: 'Bó', query: 'lá chúc an giang tươi lá chanh thái kaffir' },
  { name: 'Chẩm chéo', group: 'Gia vị & nước chấm', unit: 'Hũ', query: 'chẩm chéo ướt tây bắc hũ gia vị' },
  { name: 'Mắm tép', group: 'Gia vị & nước chấm', unit: 'Hũ', query: 'mắm tép hàng bè mắm tép chưng thịt hũ' },
  { name: 'Tiêu sọ Phú Quốc', group: 'Gia vị & nước chấm', unit: 'Hũ', query: 'tiêu sọ phú quốc dh foods hũ' },
  { name: 'Nước màu dừa', group: 'Gia vị & nước chấm', unit: 'Chai', query: 'nước màu dừa bến tre nguyên chất chai' },
  { name: 'Cá chép giòn', group: 'Thủy hải sản', unit: 'Kg', query: 'cá chép giòn tươi nguyên con' },
  { name: 'Cá trắm đen', group: 'Thủy hải sản', unit: 'Kg', query: 'cá trắm đen tươi sông nguyên con' },
  { name: 'Cá trắm cỏ', group: 'Thủy hải sản', unit: 'Kg', query: 'cá trắm cỏ tươi làm sạch cắt khúc' },
  { name: 'Cá rô đồng', group: 'Thủy hải sản', unit: 'Kg', query: 'cá rô đồng tươi sống bách hóa xanh' },
  { name: 'Cá thòi lòi', group: 'Thủy hải sản', unit: 'Kg', query: 'cá thòi lòi cà mau tươi sống' },
  { name: 'Cá đuối', group: 'Thủy hải sản', unit: 'Kg', query: 'cá đuối tươi làm sạch khay bách hóa xanh' },
  { name: 'Cá cơm', group: 'Thủy hải sản', unit: 'Kg', query: 'cá cơm tươi biển khay bách hóa xanh' },
  { name: 'Ốc nhồi', group: 'Thủy hải sản', unit: 'Kg', query: 'ốc nhồi tươi sống ốc bươu đen' },
  { name: 'Ốc len', group: 'Thủy hải sản', unit: 'Kg', query: 'ốc len tươi sống miền tây' },
  { name: 'Tu hài', group: 'Thủy hải sản', unit: 'Kg', query: 'tu hài tươi sống ốc vòi voi' },
  { name: 'Bào ngư', group: 'Thủy hải sản', unit: 'Kg', query: 'bào ngư tươi sống khay bách hóa xanh winmart' },
  { name: 'Hải sâm', group: 'Thủy hải sản', unit: 'Kg', query: 'hải sâm đen tươi biển cát bà' },
  { name: 'Thịt chim cút', group: 'Thịt', unit: 'Con', query: 'chim cút làm sạch khay bách hóa xanh winmart' },
  { name: 'Gà ác', group: 'Thịt', unit: 'Con', query: 'gà ác tiềm thuốc bắc làm sạch khay cp bách hóa xanh' },
  { name: 'Thịt thỏ', group: 'Thịt', unit: 'Kg', query: 'thịt thỏ tươi làm sạch móc hàm' },
  { name: 'Sườn bò', group: 'Thịt', unit: 'Kg', query: 'sườn bò tươi có xương cắt khúc bách hóa xanh pacow' },
  { name: 'Cuống tim heo', group: 'Thịt', unit: 'Kg', query: 'cuống tim heo tươi khay cp bách hóa xanh' },
  { name: 'Thịt nọng heo', group: 'Thịt', unit: 'Kg', query: 'thịt nọng heo meat deli cp bách hóa xanh' },
  { name: 'Cốm Làng Vòng', group: 'Nông sản & ngũ cốc', unit: 'Gói', query: 'cốm tươi làng vòng lá sen hà nội' },
  { name: 'Đậu ngự', group: 'Đậu & hạt', unit: 'Gói', query: 'đậu ngự hạt tươi gói việt san bách hóa xanh' },
  { name: 'Hạt é', group: 'Đậu & hạt', unit: 'Gói', query: 'hạt é việt san gói 100g bách hóa xanh' },
  { name: 'Tàu hũ ky', group: 'Nông sản & ngũ cốc', unit: 'Gói', query: 'tàu hũ ky lá khô váng đậu gói bách hóa xanh' },
  { name: 'Bánh tráng phơi sương', group: 'Nông sản & ngũ cốc', unit: 'Xấp', query: 'bánh tráng phơi sương trảng bàng xấp gói' },
];

async function searchAll() {
  const normalizer = new IngredientNormalizerService();
  const results = [];

  for (let i = 0; i < CANDIDATES_38.length; i++) {
    const item = CANDIDATES_38[i];
    process.stdout.write(`[${i + 1}/${CANDIDATES_38.length}] "${item.name}"... `);

    try {
      const res = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: TAVILY_API_KEY,
          query: item.query,
          include_images: true,
          max_results: 6,
        }),
      });

      const data = await res.json();
      const images: string[] = data.images || [];

      let pickedUrl = '';
      for (const img of images) {
        if (!img || !img.startsWith('http')) continue;
        if (img.includes('facebook') || img.includes('tiktok') || img.includes('fbsbx')) continue;

        try {
          const check = await fetch(img, {
            method: 'GET',
            headers: {
              'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              Range: 'bytes=0-1024',
            },
          });
          if (check.ok && check.status < 400) {
            pickedUrl = img;
            break;
          }
        } catch {
          // next
        }
      }

      if (pickedUrl) {
        console.log(`✓ -> ${pickedUrl.slice(0, 75)}...`);
        results.push({
          ...item,
          imageUrl: pickedUrl,
          identityNormalized: normalizer.identityKey(item.name),
          searchFolded: normalizer.searchFolded(item.name),
        });
      } else {
        console.log(`✗ Không tìm thấy ảnh hợp lệ`);
      }
    } catch (e: any) {
      console.log(`Lỗi: ${e.message}`);
    }

    await new Promise((r) => setTimeout(r, 450));
  }

  const outPath = path.join(__dirname, '../data/38-new-ingredients.json');
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2), 'utf8');
  console.log(`\nĐã lưu ${results.length}/${CANDIDATES_38.length} nguyên liệu vào: ${outPath}`);
}

searchAll().catch(console.error);
