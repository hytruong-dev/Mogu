const fs = require('fs');
const multi = JSON.parse(fs.readFileSync('backend/data/multi-source-clean-ingredients.json', 'utf8'));
const winmart = JSON.parse(fs.readFileSync('backend/data/winmart-raw-products.json', 'utf8'));
const active = JSON.parse(fs.readFileSync('backend/scripts/active-db-ingredients.json', 'utf8'));

const pool = [
  ...multi.map(m => ({ name: m.name, url: m.image_url, src: 'multi' })),
  ...winmart.map(w => ({ name: w.name, url: w.image, src: 'winmart' })),
  ...active.map(a => ({ name: a.name, url: a.imageUrl, src: 'active' })),
];

const targets = [
  'Thịt vai heo', 'Thịt heo ba chỉ', 'Ba rọi heo', 'Chân giò heo', 'Cá rô phi',
  'Mực khô', 'Pate gan', 'Nấm bào ngư', 'Thì là', 'Mùi tàu', 'Ngò gai',
  'Ngò rí', 'Cải xanh', 'Rau mầm cải xanh', 'Bắp chuối', 'Khế chua', 'Quả gấc',
  'Chả lụa', 'Chả cua chả cá', 'Đùi gà rút xương', 'Sườn heo'
];

for (const t of targets) {
  const item = pool.find(p => p.url && p.url.startsWith('http') && p.name.toLowerCase().includes(t.toLowerCase()));
  if (item) {
    console.log(`"${t}": ${item.url}`);
  }
}
