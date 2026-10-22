const fs = require('fs');
const wiki = JSON.parse(fs.readFileSync('backend/scripts/wiki-resolved-images.json', 'utf8'));
const pending = JSON.parse(fs.readFileSync('backend/scripts/current-pending-ingredients.json', 'utf8'));

console.log('Auditing 85 mapped wiki images:');
for (const [code, url] of Object.entries(wiki.codeToImage)) {
  const p = pending.find(x => x.code === code);
  const name = p ? p.name : code;
  const isSvg = url.endsWith('.svg') || url.includes('.svg');
  const isPdf = url.endsWith('.pdf') || url.includes('.pdf');
  const tag = isSvg ? '[SVG!]' : isPdf ? '[PDF!]' : '[IMG]';
  console.log(`${tag} "${name}" [${code}] -> ${url}`);
}
