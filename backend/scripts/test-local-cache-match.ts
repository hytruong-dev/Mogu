import * as fs from 'fs';
import * as path from 'path';

const multiSourcePath = path.join(__dirname, '../data/multi-source-clean-ingredients.json');
const bhxPath = path.join(__dirname, '../data/bhx-clean-ingredients.json');
const winmartPath = path.join(__dirname, '../data/winmart-raw-products.json');

const multi = fs.existsSync(multiSourcePath) ? JSON.parse(fs.readFileSync(multiSourcePath, 'utf-8')) : [];
const bhx = fs.existsSync(bhxPath) ? JSON.parse(fs.readFileSync(bhxPath, 'utf-8')) : [];
const winmart = fs.existsSync(winmartPath) ? JSON.parse(fs.readFileSync(winmartPath, 'utf-8')) : [];

console.log(`Loaded ${multi.length} multi-source items, ${bhx.length} bhx items, ${winmart.length} winmart items`);

const testQueries = [
  'quế', 'hồi', 'măng', 'chả lụa', 'chả cá', 'gấc', 'đậu phộng', 'hành phi', 'tỏi phi',
  'mỡ', 'xá xíu', 'sườn', 'bò kho', 'tương đen', 'đồ chua', 'thịt ghẹ', 'hến'
];

for (const q of testQueries) {
  const matchMulti = multi.find((m: any) => m.name.toLowerCase().includes(q) && m.image_url);
  const matchWinmart = winmart.find((w: any) => w.name?.toLowerCase().includes(q) && (w.avatar || w.image_url));
  const matchBhx = bhx.find((b: any) => b.name?.toLowerCase().includes(q) && (b.image_url || b.avatar));
  console.log(`Query "${q}":`);
  if (matchMulti) console.log(`  Multi: ${matchMulti.name} -> ${matchMulti.image_url}`);
  else if (matchWinmart) console.log(`  WinMart: ${matchWinmart.name} -> ${matchWinmart.avatar || matchWinmart.image_url}`);
  else if (matchBhx) console.log(`  BHX: ${matchBhx.name} -> ${matchBhx.image_url || matchBhx.avatar}`);
  else console.log(`  NONE`);
}
