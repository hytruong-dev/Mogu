import * as fs from 'fs';
import * as path from 'path';

const file = path.join(__dirname, '../data/38-new-ingredients.json');
const items = JSON.parse(fs.readFileSync(file, 'utf8'));

console.log(`Đang có ${items.length} nguyên liệu trong 38-new-ingredients.json:`);
items.forEach((it: any, i: number) => {
  console.log(`${i + 1}. [${it.group}] ${it.name} (${it.unit}) -> ${it.imageUrl}`);
});
