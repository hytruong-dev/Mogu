const fs = require('fs');
const pending = JSON.parse(fs.readFileSync('backend/scripts/current-pending-ingredients.json', 'utf8'));
const multi = JSON.parse(fs.readFileSync('backend/data/multi-source-clean-ingredients.json', 'utf8'));
const bhxRaw = JSON.parse(fs.readFileSync('backend/data/bhx-raw-products.json', 'utf8'));
const winmart = JSON.parse(fs.readFileSync('backend/data/winmart-raw-products.json', 'utf8'));

console.log('Pending count:', pending.length);
console.log('Multi count:', multi.length);
console.log('BHX raw count:', bhxRaw.length);
console.log('WinMart count:', winmart.length);

const exactDict = new Map();

for (const m of multi) {
  if (m.name && m.image_url) {
    exactDict.set(m.name.toLowerCase().trim(), m.image_url);
  }
}
for (const b of bhxRaw) {
  if (b.name && (b.avatar || b.url)) {
    const img = b.avatar || b.url;
    if (img && img.startsWith('http')) {
      exactDict.set(b.name.toLowerCase().trim(), img);
    }
  }
}
for (const w of winmart) {
  if (w.name && w.image) {
    exactDict.set(w.name.toLowerCase().trim(), w.image);
  }
}

let matched = 0;
const unmatched = [];

for (const p of pending) {
  const norm = p.name.toLowerCase().trim();
  const baseName = norm.replace(/\s*\([^)]*\)/g, '').trim();
  const paren = norm.match(/\(([^)]+)\)/)?.[1]?.trim();

  let url = exactDict.get(norm) || exactDict.get(baseName);
  if (!url && paren) {
    url = exactDict.get(paren);
  }

  if (url) {
    matched++;
    console.log(`[MATCH] "${p.name}" -> ${url}`);
  } else {
    unmatched.push(p);
  }
}

console.log(`\nTotal matched: ${matched} / ${pending.length}`);
console.log(`Total unmatched: ${unmatched.length}`);
fs.writeFileSync('backend/scripts/unmatched-items.json', JSON.stringify(unmatched, null, 2), 'utf-8');
