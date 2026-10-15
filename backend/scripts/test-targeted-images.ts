import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env.local') });
dotenv.config({ path: path.join(__dirname, '../.env') });

const TAVILY_API_KEY = process.env.TAVILY_API_KEY;

const TARGET_SEARCHES: Record<string, string> = {
  'Cá đuối': 'cá đuối tươi làm sạch nguyên con',
  'Cuống tim heo': 'cuống tim heo tươi sống khay',
  'Thịt nọng heo': 'thịt nọng heo tươi giòn nọng cằm',
  'Quả mắc mật': 'quả mắc mật tươi lạng sơn',
  'Cốm Làng Vòng': 'cốm làng vòng tươi lá sen mễ trì',
  'Đậu ngự': 'hạt đậu ngự khô tươi việt san',
  'Hạt é': 'hạt é khô nguyên chất việt san',
  'Tàu hũ ky': 'tàu hũ ky lá váng đậu khô bách hóa xanh',
  'Bánh tráng phơi sương': 'bánh tráng phơi sương trảng bàng dẻo tôm gừng',
};

async function testSearch() {
  for (const [name, query] of Object.entries(TARGET_SEARCHES)) {
    console.log(`\n=== TÌM KIẾM CHO: "${name}" (${query}) ===`);
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: TAVILY_API_KEY,
        query,
        include_images: true,
        max_results: 8,
      }),
    });

    const data = await res.json();
    const images: string[] = data.images || [];

    for (const img of images) {
      try {
        const check = await fetch(img, {
          method: 'GET',
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            Range: 'bytes=0-1024',
          },
        });
        console.log(`  [HTTP ${check.status}] ${img}`);
      } catch (e: any) {
        console.log(`  [FAIL] ${img} (${e.message})`);
      }
    }
  }
}

testSearch().catch(console.error);
