import * as fs from 'fs';
import * as path from 'path';

const activeList = JSON.parse(fs.readFileSync(path.join(__dirname, 'active-ingredients-full.json'), 'utf8'));

const inspectCodes = [
  'tau-chien-3wkkc',
  'xot-bo-kho-bfkln',
  'ruou-nau-an-rtbo9',
  'mi-soi-gno75',
  'du-du-xanh-qk3ut',
  'xi-dau-nuoc-tuong-den-n5jv8',
  'dau-bap-9shx0',
  'ca-rot-4rcfv',
  'da-heo-i8l22',
  'gan-bo-0ocq1'
];

console.log('=== CHI TIẾT CÁC MỤC ACTIVE ĐƯỢC CHỌN ===\n');

for (const code of inspectCodes) {
  const item = activeList.find((a: any) => a.code === code);
  if (item) {
    console.log(`- [${item.code}] "${item.name}"`);
    console.log(`  Nhóm: ${item.groupLabel}`);
    console.log(`  Ảnh: ${item.imageUrl}`);
    console.log('');
  } else {
    console.log(`❌ Không tìm thấy ${code}`);
  }
}
