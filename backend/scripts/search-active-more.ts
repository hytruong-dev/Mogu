import * as fs from 'fs';
import * as path from 'path';

const activeList = JSON.parse(fs.readFileSync(path.join(__dirname, 'active-ingredients-full.json'), 'utf8'));

const terms = ['đậu', 'hũ', 'hủ', 'tàu', 'rượu', 'tương', 'mì', 'bún', 'bột'];

for (const term of terms) {
  const matches = activeList.filter((a: any) => a.name.toLowerCase().includes(term));
  console.log(`🔎 "${term}" (${matches.length}):`);
  matches.forEach((m: any) => {
    console.log(`   - [${m.code}] "${m.name}"`);
  });
  console.log('');
}
