const fs = require('fs');

const pending = JSON.parse(fs.readFileSync('backend/scripts/current-pending-ingredients.json', 'utf8'));

// Format clean template for 112 items
const template = pending.map((item, idx) => ({
  index: idx + 1,
  code: item.code,
  name: item.name,
  description: '',
  curatedUrl: '',
  sourceType: '', // 'bhx' | 'winmart' | 'wiki' | 'unsplash' | 'custom'
  verified: false
}));

fs.writeFileSync('backend/scripts/112-curated-map.json', JSON.stringify(template, null, 2), 'utf-8');
console.log(`Created 112-curated-map.json with ${template.length} items.`);
