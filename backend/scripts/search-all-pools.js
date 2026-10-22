const fs = require('fs');
const multi = JSON.parse(fs.readFileSync('backend/data/multi-source-clean-ingredients.json', 'utf8'));
const winmart = JSON.parse(fs.readFileSync('backend/data/winmart-raw-products.json', 'utf8'));
const active = JSON.parse(fs.readFileSync('backend/scripts/active-db-ingredients.json', 'utf8'));

const pool = [
  ...multi.map(m => ({ name: m.name, url: m.image_url, src: 'multi' })),
  ...winmart.map(w => ({ name: w.name, url: w.image, src: 'winmart' })),
  ...active.map(a => ({ name: a.name, url: a.imageUrl, src: 'active' })),
];

function findItems(query) {
  const q = query.toLowerCase();
  return pool.filter(p => p.url && p.url.startsWith('http') && p.name.toLowerCase().includes(q));
}

const terms = [
  'sườn', 'vai', 'ba chỉ', 'ba rọi', 'chân giò', 'giò heo', 'đùi gà', 'cá rô phi',
  'mực', 'tôm', 'sứa', 'gan', 'nấm', 'thì là', 'mùi tàu', 'ngò gai', 'ngò rí',
  'cải xanh', 'cải cay', 'rau mầm', 'chuối', 'khế', 'gấc', 'hành phi', 'tỏi phi',
  'chả lụa', 'giò sống', 'bánh tráng', 'bún bò huế', 'bánh canh', 'hủ tiếu',
  'mì trứng', 'gạo tấm', 'xá xíu', 'kho quẹt', 'chả cá', 'cơm tấm'
];

for (const t of terms) {
  const matches = findItems(t);
  const unique = Array.from(new Set(matches.map(m => m.name))).slice(0, 4);
  console.log(`[${t}] (${matches.length} hits) -> ${unique.join(', ')}`);
}
