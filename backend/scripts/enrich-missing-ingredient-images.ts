/**
 * Enrich Missing Ingredient Images (without activating them)
 *
 * Requirements:
 * - Find high-quality, verified images for the 183 inactive ingredients.
 * - Set image_url = validUrl, image_status = 'PENDING_REVIEW'.
 * - STRICT CONSTRAINT: DO NOT ACTIVATE (is_active = false, status = 'PENDING_REVIEW').
 */

import * as path from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';
import pg from 'pg';

dotenv.config({ path: path.join(__dirname, '../.env.local') });
dotenv.config({ path: path.join(__dirname, '../.env') });

const pool = new pg.Pool({
  connectionString: process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL,
});

// Từ điển ánh xạ từ khóa ẩm thực chuẩn Việt - Anh/Khoa học cho Wikipedia & Wikimedia
const TERM_MAPPING: Record<string, string[]> = {
  'Bột bắp': ['Tinh bột bắp', 'Corn starch', 'Bắp'],
  'Bột gạo': ['Bột gạo', 'Rice flour'],
  'Bột nếp': ['Bột nếp', 'Glutinous rice flour'],
  'Bột nở baking': ['Bột nở', 'Baking powder'],
  'Củ sen': ['Củ sen', 'Nelumbo nucifera', 'Lotus root'],
  'Sắn': ['Khoai mì', 'Manihot esculenta', 'Cassava'],
  'Bơ': ['Bơ (thực phẩm)', 'Butter'],
  'Bơ thực vật': ['Margarine', 'Bơ thực vật'],
  'Dừa': ['Dừa', 'Cocos nucifera', 'Coconut'],
  'Me chín': ['Me (thực vật)', 'Tamarindus indica', 'Tamarind'],
  'Mít': ['Mít', 'Artocarpus heterophyllus', 'Jackfruit'],
  'Nhãn Vải': ['Nhãn (thực vật)', 'Dimocarpus longan', 'Longan'],
  'Nước dừa': ['Nước dừa', 'Coconut water'],
  'Chao': ['Chao (thức ăn)', 'Fermented bean curd'],
  'Chao đỏ': ['Chao đỏ', 'Red fermented bean curd'],
  'Chao trắng': ['Chao (thức ăn)', 'Tofu'],
  'Cơm mẻ': ['Cơm mẻ', 'Mẻ'],
  'Củ nén': ['Hành tăm', 'Allium chinense'],
  'Dấm': ['Giấm', 'Vinegar'],
  'Dầu điều': ['Dầu màu điều', 'Bixa orellana', 'Annatto'],
  'Đường': ['Đường mía', 'Sucrose', 'Sugar'],
  'Đường thốt nốt': ['Đường thốt nốt', 'Palm sugar'],
  'Hoa hồi': ['Đại hồi', 'Illicium verum', 'Star anise'],
  'Mắm nêm': ['Mắm nêm', 'Mắm cá'],
  'Mắm ruốc': ['Mắm ruốc', 'Shrimp paste'],
  'Me vắt': ['Me (thực phẩm)', 'Tamarind pulp'],
  'Muối': ['Muối ăn', 'Sea salt', 'Salt'],
  'Muối hồng Himalaya': ['Muối Himalaya', 'Himalayan salt'],
  'Muối tinh': ['Muối tinh', 'Table salt'],
  'Ớt bột': ['Ớt bột', 'Chili powder'],
  'Quế chi': ['Quế', 'Cinnamomum verum', 'Cinnamon'],
  'Sa tế': ['Sa tế', 'Shacha sauce'],
  'Sữa đặc có đường': ['Sữa đặc', 'Condensed milk'],
  'Thảo quả': ['Thảo quả', 'Lanxangia tsaoko', 'Black cardamom'],
  'Tiêu': ['Hồ tiêu', 'Piper nigrum', 'Black pepper'],
  'Tiêu sọ nguyên hạt': ['Tiêu sọ', 'White pepper'],
  'Nấm hương': ['Nấm hương', 'Lentinula edodes', 'Shiitake'],
  'Nấm rơm': ['Nấm rơm', 'Volvariella volvacea'],
  'Bánh đa': ['Bánh đa', 'Bánh tráng nướng'],
  'Bánh mì': ['Bánh mì Việt Nam', 'Baguette', 'Bread'],
  'Bánh phồng tôm': ['Bánh phồng tôm', 'Prawn cracker'],
  'Cơm tẻ': ['Cơm', 'Cooked rice'],
  'Gạo lứt': ['Gạo lứt', 'Brown rice'],
  'Gạo nếp': ['Gạo nếp', 'Glutinous rice'],
  'Gạo tẻ': ['Gạo', 'White rice'],
  'Mì ăn liền': ['Mì ăn liền', 'Ramen', 'Instant noodles'],
  'Mì sợi': ['Mì', 'Noodles'],
  'Ngô': ['Ngô', 'Zea mays', 'Maize'],
  'Bắp chuối': ['Hoa chuối', 'Bắp chuối', 'Banana flower'],
  'Bắp Mỹ': ['Bắp ngọt', 'Sweet corn'],
  'Bầu sao': ['Bầu (thực vật)', 'Lagenaria siceraria', 'Calabash'],
  'Bí đao': ['Bí đao', 'Benincasa hispida', 'Winter melon'],
  'Bột nghệ': ['Bột nghệ', 'Curcuma longa', 'Turmeric'],
  'Bột sắn dây rau câu thạch': ['Sắn dây', 'Pueraria montana'],
  'Bột tỏi thơm': ['Bột tỏi', 'Garlic powder'],
  'Ca cao Cà phê bột': ['Bột ca cao', 'Cocoa powder'],
  'Cà chua': ['Cà chua', 'Solanum lycopersicum', 'Tomato'],
  'Cà chua bi': ['Cà chua bi', 'Cherry tomato'],
  'Cà pháo': ['Cà pháo', 'Solanum macrocarpon'],
  'Cải': ['Cải bẹ xanh', 'Mustard greens'],
  'Cải thìa': ['Cải thìa', 'Bok choy'],
  'Cải xanh': ['Cải bẹ xanh', 'Brassica juncea'],
  'Đậu': ['Hạt đậu', 'Phaseolus vulgaris', 'Bean'],
  'Đậu đen': ['Đậu đen', 'Black turtle bean'],
  'Đậu đỏ': ['Đậu đỏ', 'Adzuki bean'],
  'Đậu Hà Lan': ['Đậu Hà Lan', 'Pisum sativum', 'Pea'],
  'Đậu nành': ['Đậu tương', 'Glycine max', 'Soybean'],
  'Đậu phộng': ['Lạc (thực vật)', 'Arachis hypogaea', 'Peanut'],
  'Đậu que': ['Đậu cô ve', 'Green bean'],
  'Đậu xanh': ['Đậu xanh', 'Vigna radiata', 'Mung bean'],
  'Dưa cải muối': ['Dưa muối', 'Pickled mustard greens'],
  'Dưa leo': ['Dưa chuột', 'Cucumis sativus', 'Cucumber'],
  'Hành phi tỏi phi': ['Hành phi', 'Fried shallots'],
  'Hành tây': ['Hành tây', 'Allium cepa', 'Onion'],
  'Hành tím': ['Hành tím', 'Allium ascalonicum', 'Shallot'],
  'Hạt điều': ['Điều (thực vật)', 'Anacardium occidentale', 'Cashew'],
  'Húng quế': ['Húng quế', 'Ocimum basilicum', 'Thai basil'],
  'Khổ qua': ['Mướp đắng', 'Momordica charantia', 'Bitter melon'],
  'Kinh giới': ['Kinh giới', 'Elsholtzia ciliata'],
  'Lá lốt': ['Lá lốt', 'Piper sarmentosum'],
  'Măng': ['Măng', 'Bamboo shoot'],
  'Mật ong': ['Mật ong', 'Honey'],
  'Mè': ['Vừng', 'Sesamum indicum', 'Sesame'],
  'Mướp': ['Mướp hương', 'Luffa aegyptiaca', 'Luffa'],
  'Mướp hương': ['Mướp hương', 'Luffa acutangula'],
  'Nấm đông trùng hạ thảo': ['Đông trùng hạ thảo', 'Cordyceps militaris'],
  'Ngò gai': ['Mùi tàu', 'Eryngium foetidum', 'Culantro'],
  'Ngò rí': ['Rau mùi', 'Coriandrum sativum', 'Coriander'],
  'Ngũ vị hương': ['Ngũ vị hương', 'Five-spice powder'],
  'Nước lọc': ['Nước khoáng', 'Mineral water', 'Water glass'],
  'Ớt bột Ớt khô': ['Ớt khô', 'Dried chili'],
  'Rau đay': ['Rau đay', 'Corchorus olitorius'],
  'Rau mồng tơi': ['Mồng tơi', 'Basella alba', 'Malabar spinach'],
  'Rau ngót': ['Rau ngót', 'Sauropus androgynus'],
  'Rau nhút rau ngổ': ['Rau nhút', 'Neptunia oleracea', 'Rau ngổ'],
  'Rau thơm': ['Rau thơm', 'Mint'],
  'Rau xà lách': ['Xà lách', 'Lactuca sativa', 'Lettuce'],
  'Rượu nấu ăn': ['Rượu trắng', 'Cooking wine', 'Shaoxing wine'],
  'Sả cây': ['Sả', 'Cymbopogon citratus', 'Lemongrass'],
  'Su hào': ['Su hào', 'Brassica oleracea gongylodes', 'Kohlrabi'],
  'Súp lơ': ['Súp lơ', 'Brassica oleracea botrytis', 'Cauliflower'],
  'Tỏi': ['Tỏi', 'Allium sativum', 'Garlic'],
  'Trà': ['Trà', 'Camellia sinensis', 'Tea'],
  'Tương hột Tương bần': ['Tương Bần', 'Soybean paste'],
  'Bắp bò': ['Bắp bò', 'Beef shank', 'Beef cut'],
  'Chả lụa': ['Chả lụa', 'Giò lụa', 'Vietnamese sausage'],
  'Da heo': ['Bì lợn', 'Pork rind', 'Pork skin'],
  'Gân bò': ['Gân bò', 'Beef tendon'],
  'Huyết heo': ['Tiết (ẩm thực)', 'Blood curd'],
  'Lòng heo': ['Lòng (ẩm thực)', 'Chitterlings'],
  'Mỡ heo': ['Mỡ lợn', 'Lard', 'Pork fat'],
  'Nạm bò': ['Nạm bò', 'Beef brisket'],
  'Nấm đùi gà': ['Nấm đùi gà', 'Pleurotus eryngii', 'King oyster mushroom'],
  'Nước dùng gà bò': ['Nước dùng', 'Broth', 'Chicken broth'],
  'Sườn heo': ['Sườn lợn', 'Pork ribs'],
  'Thăn bò': ['Thăn bò', 'Beef tenderloin', 'Beefsteak'],
  'Thịt bò nạc': ['Thịt bò', 'Lean beef', 'Beef'],
  'Thịt dê': ['Thịt dê', 'Goat meat'],
  'Thịt ếch': ['Thịt ếch', 'Frog legs'],
  'Thịt gà': ['Thịt gà', 'Chicken meat'],
  'Thịt heo ba chỉ': ['Thịt ba chỉ', 'Pork belly'],
  'Thịt heo mỡ': ['Thịt mỡ', 'Pork fat'],
  'Thịt heo nạc': ['Thịt nạc', 'Lean pork'],
  'Thịt nguội Thịt xông khói': ['Thịt xông khói', 'Bacon', 'Ham'],
  'Thịt trâu': ['Thịt trâu', 'Carabeef', 'Water buffalo meat'],
  'Thịt vịt': ['Thịt vịt', 'Duck meat'],
  'Trứng vịt': ['Trứng vịt', 'Duck egg'],
  'Xúc xích': ['Xúc xích', 'Sausage'],
  'Xương bò': ['Xương bò', 'Beef bones'],
  'Bạch tuộc': ['Bạch tuộc', 'Octopus'],
  'Cá': ['Cá', 'Fish'],
  'Cá basa': ['Cá tra', 'Pangasius bocourti', 'Basa fish'],
  'Cá chép': ['Cá chép', 'Cyprinus carpio', 'Common carp'],
  'Cá điêu hồng': ['Cá điêu hồng', 'Red tilapia'],
  'Cá khô': ['Cá khô', 'Dried fish'],
  'Cá lóc': ['Cá quả', 'Channa striata', 'Snakehead fish'],
  'Cá ngừ': ['Cá ngừ', 'Thunnus', 'Tuna'],
  'Cá nục': ['Cá nục', 'Decapterus'],
  'Cá rô phi': ['Cá rô phi', 'Oreochromis niloticus', 'Tilapia'],
  'Cá thu': ['Cá thu', 'Scomberomorus', 'Mackerel'],
  'Cá trê': ['Cá trê', 'Clarias', 'Catfish'],
  'Chả cua chả cá': ['Chả cá', 'Fish cake'],
  'Cua biển ghẹ': ['Cua biển', 'Scylla serrata', 'Mud crab'],
  'Diếp cá': ['Giấp cá', 'Houttuynia cordata', 'Fish mint'],
  'Hàu sữa tách vỏ': ['Hàu', 'Crassostrea gigas', 'Oyster'],
  'Mắm nêm mắm cá': ['Mắm cá', 'Fermented fish'],
  'Mắm tôm': ['Mắm tôm', 'Shrimp paste'],
  'Mực': ['Mực (động vật)', 'Squid'],
  'Mực khô': ['Mực khô', 'Dried squid'],
  'Mực nang': ['Mực nang', 'Sepiida', 'Cuttlefish'],
  'Mực ống': ['Mực ống', 'Loligo', 'Squid'],
  'Nấm bào ngư trắng': ['Nấm sò', 'Pleurotus ostreatus', 'Oyster mushroom'],
  'Nghêu sò hến': ['Nghêu', 'Meretrix lyrata', 'Clam'],
  'Pate gan': ['Pâté', 'Liver pâté'],
  'Tép': ['Tép', 'Small shrimp'],
  'Tôm': ['Tôm', 'Caridea', 'Prawn'],
  'Tôm khô': ['Tôm khô', 'Dried shrimp'],
  'Tôm thẻ': ['Tôm thẻ chân trắng', 'Litopenaeus vannamei', 'Whiteleg shrimp'],
  'Bột quế thơm': ['Bột quế', 'Cinnamon powder'],
  'Bưởi da xanh': ['Bưởi da xanh', 'Pomelo'],
  'Cam': ['Cam (quả)', 'Citrus sinensis', 'Orange'],
  'Chuối chín': ['Chuối', 'Musa (genus)', 'Banana'],
  'Chuối già': ['Chuối già', 'Cavendish banana'],
  'Dầu mè thơm': ['Dầu mè', 'Sesame oil'],
  'Dâu tây': ['Dâu tây', 'Fragaria ananassa', 'Strawberry'],
  'Đu đủ xanh': ['Đu đủ', 'Carica papaya', 'Papaya'],
  'Dứa': ['Dứa', 'Ananas comosus', 'Pineapple'],
  'Hẹ': ['Hẹ', 'Allium tuberosum', 'Garlic chives'],
  'Lá chanh': ['Lá chúc', 'Kaffir lime leaves'],
  'Lá dứa': ['Lá dứa', 'Pandanus amaryllifolius', 'Pandan'],
  'Mộc nhĩ': ['Mộc nhĩ', 'Auricularia auricula-judae', 'Wood ear'],
  'Nước cốt chanh dây siro': ['Chanh leo', 'Passiflora edulis', 'Passion fruit'],
  'Ớt': ['Ớt', 'Capsicum annuum', 'Chili pepper'],
  'Ớt chuông': ['Ớt chuông', 'Bell pepper'],
  'Tắc': ['Quất', 'Citrus japonica', 'Calamansi'],
  'Táo': ['Táo tây', 'Malus domestica', 'Apple'],
  'Xoài xanh': ['Xoài', 'Mangifera indica', 'Green mango'],
  'Kem': ['Kem (thực phẩm)', 'Ice cream', 'Whipped cream'],
  'Phô mai': ['Phô mai', 'Cheese'],
  'Sữa': ['Sữa', 'Milk'],
  'Sữa chua': ['Sữa chua', 'Yogurt'],
  'Sữa đậu nành': ['Sữa đậu nành', 'Soy milk'],
  'Trứng cút': ['Trứng cút', 'Quail egg'],
};

// Đọc WinMart raw cache để làm Tier 1
let winmartProducts: Array<{ name: string; imageUrl: string }> = [];
try {
  const rawPath = path.join(__dirname, '../data/winmart-raw-products.json');
  if (fs.existsSync(rawPath)) {
    winmartProducts = JSON.parse(fs.readFileSync(rawPath, 'utf-8'));
  }
} catch (e) {
  // ignore
}

async function validateImageUrl(url: string): Promise<boolean> {
  if (!url || !url.startsWith('http')) return false;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6000);
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Range: 'bytes=0-1024',
        Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
      },
      signal: controller.signal,
    });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchWikiPageImage(title: string, wikiHost = 'vi.wikipedia.org'): Promise<string | null> {
  try {
    const url = `https://${wikiHost}/w/api.php?action=query&titles=${encodeURIComponent(
      title
    )}&prop=pageimages&format=json&pithumbsize=600&redirects=1`;
    const res = await fetch(url, { headers: { 'User-Agent': 'MoguRecipeApp/1.0' } });
    if (res.ok) {
      const data = (await res.json()) as any;
      const pages = data.query?.pages;
      if (pages) {
        for (const k of Object.keys(pages)) {
          const thumb = pages[k]?.thumbnail?.source;
          if (thumb && !thumb.endsWith('.svg') && !thumb.endsWith('.tif')) {
            return thumb;
          }
        }
      }
    }
  } catch {
    // ignore
  }
  return null;
}

async function searchWikiGenerator(keyword: string, wikiHost = 'vi.wikipedia.org'): Promise<string | null> {
  try {
    const url = `https://${wikiHost}/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(
      keyword
    )}&prop=pageimages&format=json&pithumbsize=600&gsrlimit=3`;
    const res = await fetch(url, { headers: { 'User-Agent': 'MoguRecipeApp/1.0' } });
    if (res.ok) {
      const data = (await res.json()) as any;
      const pages = data.query?.pages;
      if (pages) {
        for (const k of Object.keys(pages)) {
          const thumb = pages[k]?.thumbnail?.source;
          if (thumb && !thumb.endsWith('.svg') && !thumb.endsWith('.tif')) {
            return thumb;
          }
        }
      }
    }
  } catch {
    // ignore
  }
  return null;
}

async function searchCommonsImage(query: string): Promise<string | null> {
  try {
    const url = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(
      query
    )}&gsrnamespace=6&prop=imageinfo&iiprop=url&iiurlwidth=600&format=json&gsrlimit=3`;
    const res = await fetch(url, { headers: { 'User-Agent': 'MoguRecipeApp/1.0' } });
    if (res.ok) {
      const data = (await res.json()) as any;
      const pages = data.query?.pages;
      if (pages) {
        for (const k of Object.keys(pages)) {
          const info = pages[k]?.imageinfo?.[0];
          const thumb = info?.thumburl || info?.url;
          if (thumb && !thumb.endsWith('.svg') && !thumb.endsWith('.tif')) {
            return thumb;
          }
        }
      }
    }
  } catch {
    // ignore
  }
  return null;
}

async function findImageForIngredient(name: string): Promise<string | null> {
  // Tier 1: Tìm trong WinMart cache nếu có sản phẩm trùng tên
  const nameLower = name.toLowerCase().trim();
  const winmartMatch = winmartProducts.find((p) => {
    const pName = p.name.toLowerCase();
    return pName.startsWith(nameLower) || pName.includes(` ${nameLower} `);
  });
  if (winmartMatch?.imageUrl) {
    const ok = await validateImageUrl(winmartMatch.imageUrl);
    if (ok) return winmartMatch.imageUrl;
  }

  // Tier 2: Sử dụng danh sách terms từ điển
  const terms = TERM_MAPPING[name] || [name];

  for (const term of terms) {
    // 2.1 Vi Wikipedia direct title
    let img = await fetchWikiPageImage(term, 'vi.wikipedia.org');
    if (img && (await validateImageUrl(img))) return img;

    // 2.2 Vi Wikipedia generator search
    img = await searchWikiGenerator(term, 'vi.wikipedia.org');
    if (img && (await validateImageUrl(img))) return img;

    // 2.3 En Wikipedia direct title
    img = await fetchWikiPageImage(term, 'en.wikipedia.org');
    if (img && (await validateImageUrl(img))) return img;

    // 2.4 En Wikipedia generator search
    img = await searchWikiGenerator(term, 'en.wikipedia.org');
    if (img && (await validateImageUrl(img))) return img;

    // 2.5 Wikimedia Commons search
    img = await searchCommonsImage(term);
    if (img && (await validateImageUrl(img))) return img;
  }

  return null;
}

async function run() {
  console.log('===============================================================');
  console.log('   TÌM VÀ BỔ SUNG ẢNH CHO 183 NGUYÊN LIỆU (KHÔNG KÍCH HOẠT)   ');
  console.log('===============================================================\n');

  // Lấy danh sách 183 nguyên liệu chưa có ảnh và chưa kích hoạt
  const { rows } = await pool.query(`
    SELECT id, code, name, group_label, image_url, image_status, is_active, status
    FROM ingredients
    WHERE is_active = false
    ORDER BY name ASC
  `);

  console.log(`Số nguyên liệu cần tìm ảnh: ${rows.length}\n`);

  let foundCount = 0;
  let notFoundCount = 0;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    for (let i = 0; i < rows.length; i++) {
      const ing = rows[i];
      const imgUrl = await findImageForIngredient(ing.name);

      if (imgUrl) {
        // CẬP NHẬT ẢNH NHƯNG TUYỆT ĐỐI KHÔNG KÍCH HOẠT
        await client.query(
          `UPDATE ingredients
           SET image_url = $1,
               image_status = 'PENDING_REVIEW',
               is_active = false,
               status = 'PENDING_REVIEW',
               updated_at = NOW()
           WHERE id = $2`,
          [imgUrl, ing.id]
        );
        foundCount++;
        console.log(`[${i + 1}/${rows.length}] ✓ "${ing.name}": Đã thêm ảnh (PENDING_REVIEW, chưa kích hoạt)`);
      } else {
        notFoundCount++;
        console.log(`[${i + 1}/${rows.length}] ✗ "${ing.name}": Chưa tìm được ảnh phù hợp`);
      }
    }

    await client.query('COMMIT');

    console.log('\n===============================================================');
    console.log(`TỔNG KẾT BỔ SUNG ẢNH:`);
    console.log(`  • Đã tìm thấy và thêm ảnh thành công: ${foundCount}/${rows.length}`);
    console.log(`  • Chưa tìm thấy ảnh: ${notFoundCount}`);
    console.log(`  • Trạng thái kích hoạt: 100% GIỮ NGUYÊN is_active = false, status = 'PENDING_REVIEW'`);
    console.log('===============================================================\n');

    // Đồng bộ vào file JSON sao lưu
    const allIngs = await client.query('SELECT * FROM ingredients ORDER BY name ASC');
    fs.writeFileSync(
      path.join(__dirname, '../data/multi-source-clean-ingredients.json'),
      JSON.stringify(allIngs.rows, null, 2),
      'utf-8'
    );
    console.log('Đã đồng bộ cập nhật vào file data/multi-source-clean-ingredients.json!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Lỗi khi cập nhật ảnh:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(console.error);
