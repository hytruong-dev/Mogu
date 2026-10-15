import { determineAllergenCode } from './map-ingredient-allergens';
import fs from 'fs';
import path from 'path';

const list = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../data/current-ingredients-for-allergen.json'), 'utf-8')
);

console.log('=== KIỂM TRA TOÀN DIỆN CÁC NGUYÊN LIỆU ĐANG CÓ ALLERGEN = NULL ===');

const nullByGroup: Record<string, string[]> = {};
for (const item of list) {
  const code = determineAllergenCode(item.name, item.group_label);
  if (!code) {
    if (!nullByGroup[item.group_label]) nullByGroup[item.group_label] = [];
    nullByGroup[item.group_label].push(item.name);
  }
}

for (const [group, names] of Object.entries(nullByGroup)) {
  console.log(`\nNhóm [${group}] (${names.length} mục có allergen = null):`);
  console.log(names.join(', '));
}
