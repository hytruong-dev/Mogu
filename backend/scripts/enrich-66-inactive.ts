import * as path from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';
import pg from 'pg';

dotenv.config({ path: path.join(__dirname, '../.env.local') });
dotenv.config({ path: path.join(__dirname, '../.env') });

const TAVILY_API_KEY = process.env.TAVILY_API_KEY;

// Mapping cụ thể truy vấn chuẩn xác cho 66 nguyên liệu
const TARGET_QUERIES: Record<string, string[]> = {
  'Bánh đa': [
    'bánh đa mè nướng khô bách hóa xanh winmart',
    'bánh đa cua khô bách hóa xanh coopmart',
    'bánh đa khô việt san',
  ],
  'Bánh mì': [
    'bánh mì baguette bách hóa xanh winmart',
    'ổ bánh mì việt nam siêu thị',
    'bánh mì tươi siêu thị',
  ],
  'Bắp Mỹ': [
    'bắp mỹ ngọt bách hóa xanh winmart',
    'ngô ngọt bắp mỹ tươi bách hóa xanh',
  ],
  'Bầu sao': [
    'trái bầu sao bách hóa xanh winmart',
    'bầu sao tươi bách hóa xanh',
  ],
  'Bột bắp': [
    'tinh bột bắp meizan bách hóa xanh winmart',
    'bột bắp tài ký gói bách hóa xanh',
  ],
  'Bột nở baking': [
    'bột nở làm bánh alsa bách hóa xanh winmart',
    'bột nổi baking powder mauripan bách hóa xanh',
    'baking soda arm hammer bách hóa xanh',
  ],
  'Bột sắn dây rau câu thạch': [
    'bột sắn dây nguyên chất bách hóa xanh winmart',
    'bột sắn dây ta bách hóa xanh',
  ],
  'Cá': [
    'cá điêu hồng làm sạch bách hóa xanh winmart',
    'cá lóc làm sạch bách hóa xanh winmart',
    'cá hồi phi lê tươi bách hóa xanh',
  ],
  'Cá basa': [
    'cá basa phi lê bách hóa xanh winmart',
    'cá basa cắt khúc bách hóa xanh',
  ],
  'Ca cao Cà phê bột': [
    'bột ca cao nguyên chất bách hóa xanh winmart',
    'bột ca cao golden bách hóa xanh',
  ],
  'Cá khô': [
    'cá cơm khô bách hóa xanh winmart',
    'cá sặc khô bách hóa xanh',
    'cá đù khô một nắng',
  ],
  'Cà pháo': [
    'cà pháo tươi bách hóa xanh winmart',
    'cà pháo trắng bách hóa xanh',
  ],
  'Cải': [
    'cải thìa bách hóa xanh winmart',
    'cải ngọt bách hóa xanh winmart',
  ],
  'Cải xanh': [
    'cải bẹ xanh bách hóa xanh winmart',
    'rau cải xanh tươi bách hóa xanh',
  ],
  'Chao đỏ': [
    'chao đỏ bông mai bách hóa xanh coopmart',
    'chao đỏ hũ bách hóa xanh winmart',
  ],
  'Chao trắng': [
    'chao môn bông mai bách hóa xanh coopmart',
    'chao trắng bông mai hũ bách hóa xanh',
  ],
  'Chuối chín': [
    'chuối xiêm chín bách hóa xanh winmart',
    'nải chuối già chín bách hóa xanh winmart',
  ],
  'Chuối già': [
    'chuối già nam mỹ bách hóa xanh winmart',
    'chuối già dole bách hóa xanh',
  ],
  'Cơm tẻ': [
    'bát cơm trắng dẻo bát sứ',
    'chén cơm trắng thơm ngon',
  ],
  'Củ nén': [
    'củ nén tươi bách hóa xanh coopmart',
    'hành tăm củ nén miền trung',
  ],
  'Cua biển ghẹ': [
    'cua biển cà mau tươi sống bách hóa xanh winmart',
    'ghẹ xanh tươi sống bách hóa xanh',
  ],
  'Da heo': [
    'da heo tươi cp bách hóa xanh winmart',
    'bì heo tươi meatdeli bách hóa xanh',
  ],
  'Đậu': [
    'đậu cô ve bách hóa xanh winmart',
    'đậu cove tươi bách hóa xanh',
  ],
  'Dầu điều': [
    'dầu màu điều dh foods bách hóa xanh winmart',
    'dầu hạt điều màu cholimex chai bách hóa xanh',
  ],
  'Đậu nành': [
    'hạt đậu nành khô việt san bách hóa xanh winmart',
    'đậu tương hạt khô bách hóa xanh',
  ],
  'Đậu xanh': [
    'đậu xanh bóc vỏ việt san bách hóa xanh winmart',
    'đậu xanh cà bách hóa xanh',
  ],
  'Diếp cá': [
    'rau diếp cá gói bách hóa xanh winmart',
    'rau diếp cá tươi bách hóa xanh',
  ],
  'Dừa': [
    'trái dừa xiêm gọt trọc bách hóa xanh winmart',
    'cơm dừa nạo sợi tươi bách hóa xanh',
  ],
  'Đường thốt nốt': [
    'đường thốt nốt an giang bách hóa xanh winmart',
    'đường thốt nốt viên tròn bách hóa xanh',
  ],
  'Gân bò': [
    'gân bò tươi pacow bách hóa xanh winmart',
    'gân bò tươi khay meatdeli bách hóa xanh',
  ],
  'Gạo lứt': [
    'gạo lứt đỏ huyết rồng bách hóa xanh winmart',
    'gạo lứt tím than túi bách hóa xanh',
  ],
  'Gạo tẻ': [
    'gạo st25 túi 5kg bách hóa xanh winmart',
    'gạo thơm lài bách hóa xanh',
  ],
  'Kem': [
    'whipping cream anchor hộp bách hóa xanh winmart',
    'kem tươi whipping cream tatua bách hóa xanh',
  ],
  'Lá chanh': [
    'lá chanh tươi gia vị bách hóa xanh winmart',
    'lá chanh tươi bắc',
  ],
  'Lá dứa': [
    'lá dứa thơm tươi bách hóa xanh winmart',
    'lá nếp tươi bách hóa xanh',
  ],
  'Lá lốt': [
    'lá lốt tươi bách hóa xanh winmart',
    'bó lá lốt tươi bách hóa xanh',
  ],
  'Lòng heo': [
    'lòng non heo tươi cp bách hóa xanh winmart',
    'phèo non heo tươi meatdeli bách hóa xanh',
  ],
  'Mắm nêm': [
    'mắm nêm pha sẵn dì cẩn bách hóa xanh winmart',
    'mắm nêm dh foods chai bách hóa xanh',
  ],
  'Mắm nêm mắm cá': [
    'mắm cá linh hũ bách hóa xanh winmart',
    'mắm cá sặc xay bách hóa xanh',
  ],
  'Mắm tôm': [
    'mắm tôm bắc trung thành chai bách hóa xanh winmart',
    'mắm tôm lê gia bách hóa xanh',
  ],
  'Mè': [
    'mè trắng hạt việt san bách hóa xanh winmart',
    'hạt vừng trắng bách hóa xanh',
  ],
  'Me vắt': [
    'me chua vắt gói bách hóa xanh winmart',
    'hộp me vắt nấu canh chua bách hóa xanh',
  ],
  'Mì ăn liền': [
    'mì hảo hảo tôm chua cay gói bách hóa xanh winmart',
    'mì gói hảo hảo bách hóa xanh',
  ],
  'Mì sợi': [
    'mì trứng cao cấp safoco gói bách hóa xanh winmart',
    'mì sợi khô safoco bách hóa xanh',
  ],
  'Nạm bò': [
    'nạm bò tươi pacow bách hóa xanh winmart',
    'nạm bò tươi meatdeli bách hóa xanh',
  ],
  'Nấm hương': [
    'nấm hương khô việt san bách hóa xanh winmart',
    'nấm đông cô khô bách hóa xanh winmart',
  ],
  'Nghêu sò hến': [
    'nghêu sống bến tre túi bách hóa xanh winmart',
    'nghêu tươi sống bách hóa xanh',
  ],
  'Nước cốt chanh dây siro': [
    'nước cốt chanh dây chai bách hóa xanh winmart',
    'chanh leo siro lafresh bách hóa xanh',
  ],
  'Nước dùng gà bò': [
    'nước hầm xương gà barona bách hóa xanh winmart',
    'nước dùng hoàn chỉnh phở bò barona bách hóa xanh',
  ],
  'Phô mai': [
    'phô mai con bò cười 8 miếng bách hóa xanh winmart',
    'phô mai lát vuông anchor bách hóa xanh',
  ],
  'Sắn': [
    'củ sắn tươi củ đậu bách hóa xanh winmart',
    'củ khoai mì tươi bách hóa xanh',
  ],
  'Sữa': [
    'sữa tươi tiệt trùng vinamilk 1 lít bách hóa xanh winmart',
    'sữa tươi th true milk 1l bách hóa xanh',
  ],
  'Sữa chua': [
    'lốc 4 hộp sữa chua vinamilk có đường bách hóa xanh winmart',
    'sữa chua ăn th true milk bách hóa xanh',
  ],
  'Sườn heo': [
    'sườn non heo tươi meatdeli bách hóa xanh winmart',
    'sườn que heo tươi cp bách hóa xanh',
  ],
  'Súp lơ': [
    'bông cải xanh súp lơ tươi bách hóa xanh winmart',
    'súp lơ xanh bách hóa xanh',
  ],
  'Thảo quả': [
    'thảo quả khô dh foods bách hóa xanh winmart',
    'thảo quả hạt khô gia vị',
  ],
  'Thịt dê': [
    'thịt dê tươi cắt miếng siêu thị',
    'thịt đùi dê tươi phi lê',
  ],
  'Thịt gà': [
    'thịt đùi gà tươi cp bách hóa xanh winmart',
    'thịt gà ta làm sạch bách hóa xanh',
    'ức gà tươi cp bách hóa xanh',
  ],
  'Thịt trâu': [
    'thịt bắp trâu tươi siêu thị',
    'thịt trâu tươi bắp hoa',
  ],
  'Tiêu': [
    'tiêu đen xay phú quốc dh foods bách hóa xanh winmart',
    'tiêu hạt đen bách hóa xanh',
  ],
  'Tỏi': [
    'tỏi cô đơn củ việt san bách hóa xanh winmart',
    'tỏi hải dương túi bách hóa xanh',
  ],
  'Tôm khô': [
    'tôm khô cà mau việt san bách hóa xanh winmart',
    'tôm khô loại 1 bách hóa xanh',
  ],
  'Tôm thẻ': [
    'tôm thẻ tươi sống bách hóa xanh winmart',
    'tôm thẻ chân trắng khay bách hóa xanh',
  ],
  'Trà': [
    'trà xanh thái nguyên búp khô bách hóa xanh winmart',
    'trà bắc thái nguyên gói bách hóa xanh',
  ],
  'Tương hột Tương bần': [
    'tương hột cholimex hũ bách hóa xanh winmart',
    'tương bần hưng yên chai bách hóa xanh',
  ],
  'Xương bò': [
    'xương ống bò pacow khay bách hóa xanh winmart',
    'xương súp bò pacow bách hóa xanh',
  ],
};

const SUPERMARKET_DOMAINS = [
  'tgdd.vn',
  'bachhoaxanh',
  'bhxwork.vn',
  'cooponline.vn',
  'tekoapis.com',
  'higiocloud.vn',
  'winmart.vn',
  'kingfoodmart.com',
  'lottemart.vn',
  'go-vietnam.vn',
  'coopmart',
  'megamarket.vn',
  'an-nam-gourmet',
];

// Từ khóa cần né tránh (sản phẩm chế biến sẵn/gói gia vị sai lệch)
const NEGATIVE_KEYWORDS = [
  'mien-an-lien',
  'mi-goi',
  'banh-da-cua-an-lien',
  'pho-goi',
  'dau-an-simply',
  'dau-dau-nanh',
  'dau-gao-lut',
  'dau-hao',
  'mayonnaise',
  'kem-cac-loai-mua-2-tang-1',
  'la-me-50g',
  'cha-sot',
  'lo-ca-pho',
  'ca-pho-tan',
  'banh-trang-tron',
];

async function validateImageUrl(url: string): Promise<boolean> {
  if (!url || !url.startsWith('http')) return false;
  const lower = url.toLowerCase();
  if (NEGATIVE_KEYWORDS.some((neg) => lower.includes(neg))) return false;

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

async function searchImageForIngredient(name: string): Promise<{ url: string; source: string } | null> {
  if (!TAVILY_API_KEY) return null;
  const queries = TARGET_QUERIES[name] || [`mua "${name}" bách hóa xanh winmart`];

  for (const q of queries) {
    try {
      const res = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: TAVILY_API_KEY,
          query: q,
          include_images: true,
          max_results: 6,
        }),
      });

      if (!res.ok) continue;
      const data = (await res.json()) as any;
      const images: string[] = data.images || [];

      // Ưu tiên 1: Supermarket domains
      for (const img of images) {
        const isSm = SUPERMARKET_DOMAINS.some((d) => img.toLowerCase().includes(d));
        if (isSm) {
          const valid = await validateImageUrl(img);
          if (valid) return { url: img, source: 'SUPERMARKET' };
        }
      }

      // Ưu tiên 2: Ảnh sản phẩm chất lượng khác (food photo / packaging)
      for (const img of images) {
        const valid = await validateImageUrl(img);
        if (valid) return { url: img, source: 'FOOD_SEARCH' };
      }
    } catch {
      // next query
    }
  }

  return null;
}

async function main() {
  const isApply = process.argv.includes('--apply');
  console.log(`MODE: ${isApply ? 'APPLY (Ghi trực tiếp vào PostgreSQL)' : 'DRY-RUN (Chỉ kiểm tra & xuất kết quả)'}`);

  const pool = new pg.Pool({
    connectionString: process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL,
  });

  try {
    const res = await pool.query(`
      SELECT id, name, group_label, image_url, is_active, status
      FROM ingredients
      WHERE is_active = false
      ORDER BY name ASC;
    `);

    const inactives = res.rows;
    console.log(`Đang xử lý ${inactives.length} nguyên liệu chưa kích hoạt...\n`);

    const updates: Array<{ id: string; name: string; oldUrl: string; newUrl: string; source: string }> = [];

    for (let i = 0; i < inactives.length; i++) {
      const item = inactives[i];
      process.stdout.write(`[${i + 1}/${inactives.length}] Tìm ảnh cho: "${item.name}"... `);

      const found = await searchImageForIngredient(item.name);
      if (found) {
        console.log(`✓ (${found.source})`);
        console.log(`   -> ${found.url.slice(0, 100)}...`);
        updates.push({
          id: item.id,
          name: item.name,
          oldUrl: item.image_url,
          newUrl: found.url,
          source: found.source,
        });
      } else {
        console.log(`✗ KHÔNG TÌM THẤY`);
      }

      // Sleep nhẹ tránh rate limit
      await new Promise((r) => setTimeout(r, 600));
    }

    console.log(`\n========================================`);
    console.log(`Tổng kết tìm kiếm: ${updates.length}/${inactives.length} thành công.`);
    console.log(`========================================\n`);

    // Lưu file JSON backup & đối soát
    const resultFile = path.join(__dirname, '../data/66-inactive-enriched-images.json');
    fs.writeFileSync(resultFile, JSON.stringify(updates, null, 2), 'utf8');
    console.log(`Đã xuất kết quả vào: ${resultFile}`);

    if (isApply && updates.length > 0) {
      console.log(`\nBắt đầu cập nhật PostgreSQL...`);
      for (const u of updates) {
        await pool.query(
          `
          UPDATE ingredients
          SET 
            image_url = $1,
            image_status = 'PENDING_REVIEW',
            is_active = false,
            status = 'PENDING_REVIEW',
            updated_at = NOW()
          WHERE id = $2;
        `,
          [u.newUrl, u.id],
        );
      }
      console.log(`✓ Đã cập nhật thành công ${updates.length} nguyên liệu trong DB!`);
      console.log(`(Lưu ý: Tất cả vẫn giữ trạng thái is_active = false và status = 'PENDING_REVIEW' để người dùng duyệt).`);
    } else {
      console.log(`\nĐể cập nhật vào DB, chạy lại script với cờ: --apply`);
    }
  } finally {
    await pool.end();
  }
}

main().catch(console.error);
