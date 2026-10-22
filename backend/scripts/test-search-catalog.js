const fs = require('fs');
const catalog = JSON.parse(fs.readFileSync('backend/scripts/all-supermarket-catalog.json', 'utf8'));
const pending = JSON.parse(fs.readFileSync('backend/scripts/current-pending-ingredients.json', 'utf8'));

function searchCatalog(keyword) {
  const kw = keyword.toLowerCase();
  return catalog.filter(c => c.name.toLowerCase().includes(kw));
}

// Test some items
const testKeywords = [
  'cốt lết', 'nạc vai', 'ba rọi', 'xương ống', 'đùi gà', 'chả lụa', 'giò sống', 'lạp xưởng',
  'chà bông', 'thịt bò khô', 'hành phi', 'tỏi phi', 'đậu phộng', 'hạt điều màu',
  'nước cốt me', 'muối ớt xanh', 'mì trứng', 'gạo tấm', 'hến', 'sứa'
];

for (const kw of testKeywords) {
  const results = searchCatalog(kw);
  console.log(`\nResults for "${kw}" (${results.length}):`);
  results.slice(0, 3).forEach(r => console.log(`  - [${r.source}] ${r.name}: ${r.image}`));
}
