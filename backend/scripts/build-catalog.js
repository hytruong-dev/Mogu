const fs = require('fs');
const multi = JSON.parse(fs.readFileSync('backend/data/multi-source-clean-ingredients.json', 'utf8'));
const winmart = JSON.parse(fs.readFileSync('backend/data/winmart-raw-products.json', 'utf8'));
const bhxRaw = JSON.parse(fs.readFileSync('backend/data/bhx-raw-products.json', 'utf8'));

// Build list of all items with names and images
const catalog = [];

for (const m of multi) {
  if (m.name && m.image_url) {
    catalog.push({ name: m.name, image: m.image_url, source: 'multi' });
  }
}
for (const w of winmart) {
  if (w.name && w.image) {
    catalog.push({ name: w.name, image: w.image, source: 'winmart' });
  }
}
for (const b of bhxRaw) {
  const img = b.avatar || b.url;
  if (b.name && img && img.startsWith('http')) {
    catalog.push({ name: b.name, image: img, source: 'bhx' });
  }
}

console.log('Total catalog items:', catalog.length);
fs.writeFileSync('backend/scripts/all-supermarket-catalog.json', JSON.stringify(catalog, null, 2));
