/**
 * Enrich Remaining Missing Ingredient Images
 *
 * Strategies:
 * 1. Openverse API (Creative Commons food photography)
 * 2. Wikimedia Commons API
 * 3. English Wikipedia Pageimages
 * 4. Vietnamese Wikipedia generator
 *
 * STRICT REQUIREMENT:
 * DO NOT ACTIVATE (is_active = false, status = 'PENDING_REVIEW').
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

const CURATED_EN_TERMS: Record<string, string[]> = {
  'Bơ thực vật': ['Margarine', 'vegetable butter'],
  'Bột gạo': ['Rice flour', 'flour'],
  'Bột nếp': ['Glutinous rice flour', 'sweet rice flour'],
  'Bột nghệ': ['Turmeric powder', 'Curcuma powder'],
  'Bột nở baking': ['Baking powder', 'baking soda'],
  'Bột quế thơm': ['Cinnamon powder', 'cinnamon ground'],
  'Bột sắn dây rau câu thạch': ['Tapioca flour', 'arrowroot powder', 'kudzu starch'],
  'Bột tỏi thơm': ['Garlic powder', 'granulated garlic'],
  'Bưởi da xanh': ['Green pomelo', 'pomelo fruit'],
  'Ca cao Cà phê bột': ['Cocoa powder', 'coffee powder'],
  'Cá': ['Fresh fish', 'raw fish fillet'],
  'Cá chép': ['Common carp', 'carp fish'],
  'Cá điêu hồng': ['Red tilapia', 'red tilapia fish'],
  'Cá khô': ['Dried fish', 'dry fish'],
  'Cá lóc': ['Snakehead fish', 'Channa striata'],
  'Cá ngừ': ['Tuna fish', 'fresh tuna'],
  'Cá nục': ['Decapterus', 'mackerel fish', 'scad fish'],
  'Cá pháo': ['Solanum macrocarpon', 'Thai eggplant', 'white eggplant'],
  'Cá rô phi': ['Tilapia fish', 'Oreochromis niloticus'],
  'Cá thu': ['Spanish mackerel', 'mackerel fish'],
  'Cá trê': ['Catfish', 'fresh catfish'],
  'Cải thìa': ['Bok choy', 'pak choi', 'chinese cabbage'],
  'Chả cua chả cá': ['Vietnamese fish cake', 'fish cake'],
  'Chả lụa': ['Vietnamese pork sausage', 'pork roll giò lụa'],
  'Chao': ['Fermented bean curd', 'fermented tofu'],
  'Chao đỏ': ['Red fermented bean curd', 'red fermented tofu'],
  'Chao trắng': ['Fermented bean curd', 'tofu curd'],
  'Chuối chín': ['Ripe yellow banana', 'banana fruit'],
  'Chuối già': ['Cavendish banana', 'green banana'],
  'Cơm mẻ': ['Fermented rice', 'rice yeast'],
  'Cơm tẻ': ['Cooked white rice', 'steamed rice'],
  'Củ nén': ['Allium chinense', 'pickled shallot', 'shallot bulbs'],
  'Củ sen': ['Lotus root slices', 'raw lotus root'],
  'Cua biển ghẹ': ['Mud crab', 'blue crab', 'sea crab'],
  'Dầu mè thơm': ['Toasted sesame oil', 'sesame oil bottle'],
  'Đậu Hà Lan': ['Green peas', 'sweet peas'],
  'Đậu phộng': ['Raw peanuts', 'roasted peanuts'],
  'Đậu que': ['Green beans', 'string beans'],
  'Dâu tây': ['Fresh strawberries', 'strawberry fruit'],
  'Diếp cá': ['Houttuynia cordata', 'fish mint herb'],
  'Đu đủ xanh': ['Green papaya', 'unripe papaya'],
  'Dưa cải muối': ['Pickled mustard greens', 'mustard pickles'],
  'Dưa leo': ['Fresh cucumber', 'cucumbers'],
  'Đường thốt nốt': ['Palm sugar block', 'palm sugar'],
  'Gạo lứt': ['Brown rice grains', 'brown rice'],
  'Gạo nếp': ['Glutinous rice grains', 'sweet rice'],
  'Gạo tẻ': ['White rice grains', 'jasmine rice'],
  'Gân bò': ['Beef tendon raw', 'beef tendon'],
  'Hành phi tỏi phi': ['Fried crispy shallots', 'fried garlic'],
  'Hành tím': ['Shallots raw', 'red shallot'],
  'Hạt điều': ['Cashew nuts raw', 'cashew nuts'],
  'Hàu sữa tách vỏ': ['Fresh raw oysters', 'shucked oysters'],
  'Hẹ': ['Garlic chives', 'chinese chives'],
  'Huyết heo': ['Pork blood curd', 'blood tofu'],
  'Kinh giới': ['Elsholtzia ciliata', 'vietnamese balm'],
  'Lá chanh': ['Kaffir lime leaves', 'makrut lime leaves'],
  'Lá dứa': ['Pandan leaves', 'pandan leaf'],
  'Lòng heo': ['Pork chitterlings', 'pork intestines'],
  'Mắm nêm': ['Fermented fish sauce', 'vietnamese dipping sauce'],
  'Mắm nêm mắm cá': ['Fermented anchovy sauce', 'fish sauce'],
  'Mắm ruốc': ['Fermented shrimp paste', 'shrimp paste'],
  'Mắm tôm': ['Shrimp paste sauce', 'purple shrimp paste'],
  'Măng': ['Fresh bamboo shoots', 'bamboo shoots'],
  'Mè': ['White sesame seeds', 'sesame seeds'],
  'Me chín': ['Ripe tamarind pod', 'tamarind fruit'],
  'Me vắt': ['Tamarind pulp block', 'tamarind paste'],
  'Mì ăn liền': ['Instant ramen noodles', 'ramen noodles'],
  'Mì sợi': ['Wheat egg noodles', 'fresh noodles'],
  'Mít': ['Ripe jackfruit', 'jackfruit pieces'],
  'Mộc nhĩ': ['Black wood ear mushroom', 'wood ear fungus'],
  'Mỡ heo': ['Pork lard', 'pork fat cubes'],
  'Mực': ['Fresh whole squid', 'calamari'],
  'Mực khô': ['Dried squid', 'dried cuttlefish'],
  'Mực nang': ['Cuttlefish raw', 'Sepia cuttlefish'],
  'Mực ống': ['Loligo squid', 'fresh squid tubes'],
  'Mướp': ['Luffa gourd', 'sponge gourd'],
  'Mướp hương': ['Angled luffa', 'ridged gourd'],
  'Nạm bò': ['Beef brisket raw', 'beef flank'],
  'Nấm bào ngư trắng': ['White oyster mushroom', 'Pleurotus ostreatus'],
  'Nấm đông trùng hạ thảo': ['Cordyceps militaris fruiting body', 'cordyceps mushroom'],
  'Nấm đùi gà': ['King oyster mushroom', 'Pleurotus eryngii'],
  'Nấm hương': ['Dried shiitake mushroom', 'fresh shiitake mushroom'],
  'Nấm rơm': ['Straw mushroom', 'Volvariella volvacea'],
  'Nghêu sò hến': ['Fresh clams', 'hard clams'],
  'Nhãn Vải': ['Longan fruit', 'lychee fruit'],
  'Nước cốt chanh dây siro': ['Passion fruit juice', 'passion fruit pulp'],
  'Nước dừa': ['Fresh coconut water', 'coconut drink'],
  'Nước dùng gà bò': ['Chicken bone broth', 'beef broth in bowl'],
  'Nước lọc': ['Glass of pure water', 'fresh drinking water'],
  'Ớt bột': ['Red chili powder', 'cayenne pepper powder'],
  'Ớt bột Ớt khô': ['Dried red chili peppers', 'crushed red pepper'],
  'Ớt chuông': ['Bell peppers mix', 'sweet bell pepper'],
  'Pate gan': ['Liver pate spread', 'french pate'],
  'Quế chi': ['Cinnamon sticks', 'cassia bark'],
  'Rau đay': ['Jute mallow leaves', 'Corchorus olitorius'],
  'Rau mồng tơi': ['Malabar spinach leaves', 'Basella alba'],
  'Rau ngót': ['Sauropus androgynus leaves', 'sweet leaf bush'],
  'Rau nhút rau ngổ': ['Water mimosa herb', 'rice paddy herb Limnophila'],
  'Rau thơm': ['Fresh mint leaves', 'assorted vietnamese herbs'],
  'Rau xà lách': ['Fresh lettuce head', 'crisp lettuce'],
  'Rượu nấu ăn': ['Cooking rice wine', 'Shaoxing cooking wine'],
  'Sả cây': ['Fresh lemongrass stalks', 'lemongrass herb'],
  'Sắn': ['Cassava root', 'yuca root raw'],
  'Su hào': ['Kohlrabi bulb with leaves', 'fresh kohlrabi'],
  'Sữa chua': ['Plain yogurt in bowl', 'natural yogurt'],
  'Sữa đặc có đường': ['Condensed milk in can', 'sweetened condensed milk'],
  'Sữa đậu nành': ['Soy milk in glass', 'fresh soya milk'],
  'Súp lơ': ['White cauliflower head', 'fresh cauliflower'],
  'Tắc': ['Calamansi lime', 'kumquat fruit'],
  'Tép': ['Small fresh shrimp', 'krill shrimp'],
  'Thăn bò': ['Beef tenderloin filet', 'raw beefsteak'],
  'Thảo quả': ['Black cardamom pods', 'Amomum tsao-ko'],
  'Thịt bò nạc': ['Lean raw beef steak', 'raw beef cut'],
  'Thịt dê': ['Raw goat meat cuts', 'mutton goat meat'],
  'Thịt ếch': ['Raw frog legs', 'frog meat cleaned'],
  'Thịt heo ba chỉ': ['Raw pork belly strips', 'pork belly slab'],
  'Thịt heo mỡ': ['Fatty pork belly', 'pork fatback raw'],
  'Thịt heo nạc': ['Raw lean pork loin', 'pork chop fillet'],
  'Thịt nguội Thịt xông khói': ['Sliced bacon strips', 'smoked ham cuts'],
  'Thịt trâu': ['Water buffalo meat raw', 'buffalo steak'],
  'Thịt vịt': ['Raw duck breast', 'whole duck raw'],
  'Tiêu sọ nguyên hạt': ['Whole white peppercorns', 'white pepper seeds'],
  'Tôm khô': ['Dried shrimp orange', 'dried prawns'],
  'Trà': ['Green tea dried leaves', 'loose tea leaves'],
  'Trứng vịt': ['Raw duck eggs in basket', 'duck egg shell'],
  'Tương hột Tương bần': ['Vietnamese fermented soybean paste', 'soy bean paste'],
  'Xoài xanh': ['Unripe green mango', 'green mango fruit'],
  'Xúc xích': ['Raw grill sausages', 'frankfurter sausages'],
  'Xương bò': ['Raw beef marrow bones', 'beef soup bones'],
};

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

async function searchOpenverse(query: string): Promise<string | null> {
  try {
    const url = `https://api.openverse.org/v1/images/?q=${encodeURIComponent(query)}&page_size=4`;
    const res = await fetch(url, { headers: { 'User-Agent': 'MoguRecipeApp/1.0' } });
    if (res.ok) {
      const data = (await res.json()) as any;
      if (data.results && data.results.length > 0) {
        for (const item of data.results) {
          const imgUrl = item.url || item.thumbnail;
          if (imgUrl && (await validateImageUrl(imgUrl))) {
            return imgUrl;
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
          if (thumb && !thumb.endsWith('.svg') && !thumb.endsWith('.tif') && (await validateImageUrl(thumb))) {
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

async function searchEnglishWiki(title: string): Promise<string | null> {
  try {
    const url = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(
      title
    )}&prop=pageimages&format=json&pithumbsize=600&redirects=1`;
    const res = await fetch(url, { headers: { 'User-Agent': 'MoguRecipeApp/1.0' } });
    if (res.ok) {
      const data = (await res.json()) as any;
      const pages = data.query?.pages;
      if (pages) {
        for (const k of Object.keys(pages)) {
          const thumb = pages[k]?.thumbnail?.source;
          if (thumb && !thumb.endsWith('.svg') && (await validateImageUrl(thumb))) {
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

async function searchFallback(name: string): Promise<string | null> {
  const terms = CURATED_EN_TERMS[name] || [name];

  for (const t of terms) {
    // 1. Openverse
    let img = await searchOpenverse(t);
    if (img) return img;

    // 2. English Wikipedia
    img = await searchEnglishWiki(t);
    if (img) return img;

    // 3. Wikimedia Commons
    img = await searchCommonsImage(t);
    if (img) return img;
  }

  return null;
}

async function run() {
  console.log('===============================================================');
  console.log('   BỔ SUNG ẢNH ĐỢT 2 CHO CÁC NGUYÊN LIỆU CÒN THIẾU             ');
  console.log('   (ĐẢM BẢO TUYỆT ĐỐI KHÔNG KÍCH HOẠT: is_active = false)      ');
  console.log('===============================================================\n');

  // Lấy các nguyên liệu chưa có ảnh
  const { rows } = await pool.query(`
    SELECT id, code, name, group_label
    FROM ingredients
    WHERE is_active = false AND (image_url IS NULL OR image_url = '')
    ORDER BY name ASC
  `);

  console.log(`Số nguyên liệu còn thiếu ảnh cần xử lý: ${rows.length}\n`);

  let added = 0;
  let remaining = 0;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    for (let i = 0; i < rows.length; i++) {
      const ing = rows[i];
      const img = await searchFallback(ing.name);

      if (img) {
        await client.query(
          `UPDATE ingredients
           SET image_url = $1,
               image_status = 'PENDING_REVIEW',
               is_active = false,
               status = 'PENDING_REVIEW',
               updated_at = NOW()
           WHERE id = $2`,
          [img, ing.id]
        );
        added++;
        console.log(`[${i + 1}/${rows.length}] ✓ "${ing.name}": Đã thêm ảnh thành công`);
      } else {
        remaining++;
        console.log(`[${i + 1}/${rows.length}] ✗ "${ing.name}": Vẫn chưa tìm được ảnh`);
      }
    }

    await client.query('COMMIT');

    console.log('\n===============================================================');
    console.log(`KẾT QUẢ ĐỢT 2:`);
    console.log(`  • Đã thêm ảnh mới: ${added}/${rows.length}`);
    console.log(`  • Còn thiếu: ${remaining}`);
    console.log('===============================================================\n');

    // Cập nhật lại file JSON backup
    const allIngs = await client.query('SELECT * FROM ingredients ORDER BY name ASC');
    fs.writeFileSync(
      path.join(__dirname, '../data/multi-source-clean-ingredients.json'),
      JSON.stringify(allIngs.rows, null, 2),
      'utf-8'
    );
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Lỗi khi bổ sung ảnh đợt 2:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(console.error);
