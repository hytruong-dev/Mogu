const fs = require('fs');
const multi = JSON.parse(fs.readFileSync('backend/data/multi-source-clean-ingredients.json', 'utf8'));
const winmart = JSON.parse(fs.readFileSync('backend/data/winmart-raw-products.json', 'utf8'));
const bhxRaw = JSON.parse(fs.readFileSync('backend/data/bhx-raw-products.json', 'utf8'));

const all = [...multi, ...winmart, ...bhxRaw];

function searchItems(keyword) {
  const kw = keyword.toLowerCase();
  return all.filter(item => {
    const name = (item.name || item.fullName || '').toLowerCase();
    return name.includes(kw);
  });
}

const queries = ['giò sống', 'mọc', 'chả cá', 'muối ớt xanh', 'me', 'nước cốt me', 'xương', 'rượu', 'cua', 'ghẹ'];

for (const q of queries) {
  const found = searchItems(q);
  console.log(`\n--- Results for "${q}" (${found.length}) ---`);
  found.slice(0, 5).forEach(f => {
    const img = f.image_url || f.image || f.avatar || f.url;
    console.log(`  - ${f.name || f.fullName}: ${img}`);
  });
}
