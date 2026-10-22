import * as fs from 'fs';
import * as path from 'path';

const activeList = JSON.parse(fs.readFileSync(path.join(__dirname, 'active-ingredients-full.json'), 'utf8'));

const searchTerms = [
  'gan', 'đậu phụ', 'đậu hũ', 'nem', 'chả giò', 'chả lụa', 'chả', 'hủ tiếu', 
  'lạp xưởng', 'xá xíu', 'mỡ', 'bì', 'da heo', 'giò sống', 'mọc', 'sứa', 
  'thính', 'quay', 'bò khô', 'đồ chua', 'đu đủ'
];

console.log('=== TÌM KIẾM CÁC TỪ KHÓA TRONG ACTIVE DB ===\n');

for (const term of searchTerms) {
  const matches = activeList.filter((a: any) => a.name.toLowerCase().includes(term));
  console.log(`🔎 Từ khóa "${term}" (${matches.length} kết quả):`);
  matches.forEach((m: any) => {
    console.log(`   - [${m.code}] "${m.name}" (${m.groupLabel})`);
  });
  console.log('');
}
