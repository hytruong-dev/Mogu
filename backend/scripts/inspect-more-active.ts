import * as fs from 'fs';
import * as path from 'path';

const activeList = JSON.parse(fs.readFileSync(path.join(__dirname, 'active-ingredients-full.json'), 'utf8'));

const inspectCodes2 = [
  'hu-tieu-nam-vang-18-x-wp0iw',
  'cha-cua-cha-ca-9n66u',
  'cha-lua-yhjhc',
  'thit-nac-heo-w7psl',
  'thit-heo-ba-chi-ou4je',
  'ba-roi-heo-fgpr6'
];

for (const code of inspectCodes2) {
  const item = activeList.find((a: any) => a.code === code);
  if (item) {
    console.log(`- [${item.code}] "${item.name}"`);
    console.log(`  Nhóm: ${item.groupLabel}`);
    console.log(`  Ảnh: ${item.imageUrl}`);
    console.log('');
  }
}
