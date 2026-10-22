import * as fs from 'fs';
import * as path from 'path';

const DATA_DIR = path.join(__dirname, '../data');
const multiSource: any[] = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'multi-source-clean-ingredients.json'), 'utf-8'));
const winmart: any[] = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'winmart-raw-products.json'), 'utf-8'));

function findExact(q: string) {
  const matches: string[] = [];
  for (const m of multiSource) {
    if (m.name && m.name.toLowerCase().includes(q.toLowerCase()) && m.image_url) {
      matches.push(`[Multi] ${m.name}: ${m.image_url}`);
    }
  }
  for (const w of winmart) {
    if (w.name && w.name.toLowerCase().includes(q.toLowerCase()) && (w.avatar || w.image_url)) {
      matches.push(`[WinMart] ${w.name}: ${w.avatar || w.image_url}`);
    }
  }
  return matches.slice(0, 3);
}

const checkQueries = [
  'chả lụa', 'chả quế', 'chả bò', 'bánh tráng', 'đậu phộng', 'hành phi', 'tỏi phi',
  'mỡ', 'xá bấu', 'măng', 'sứa', 'khô mực', 'hến', 'ghẹ', 'cua', 'ba rọi', 'nạc vai',
  'sườn', 'gan heo', 'tai heo', 'thính', 'gấc', 'sa tế', 'me', 'hột điều', 'điều màu',
  'cơm nguội', 'gạo tấm', 'hủ tiếu', 'bánh canh', 'mì trứng', 'quẩy', 'nem chua'
];

for (const q of checkQueries) {
  const found = findExact(q);
  console.log(`\n=== "${q}" (${found.length} matches) ===`);
  for (const f of found) console.log(' ', f);
}
