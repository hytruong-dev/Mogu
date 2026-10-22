const fs = require('fs');
const active = JSON.parse(fs.readFileSync('backend/scripts/active-db-ingredients.json', 'utf8'));
const pending = JSON.parse(fs.readFileSync('backend/scripts/current-pending-ingredients.json', 'utf8'));

console.log('Active count:', active.length);
console.log('Pending count:', pending.length);

const activeWithImages = active.filter(a => a.imageUrl && a.imageUrl.startsWith('http'));
console.log('Active with images:', activeWithImages.length);

const matches = [];

for (const p of pending) {
  const pNorm = p.name.toLowerCase().trim();
  const pBase = pNorm.replace(/\s*\([^)]*\)/g, '').trim();

  // Find close matches in active ingredients
  const exact = activeWithImages.find(a => a.name.toLowerCase().trim() === pNorm);
  if (exact) {
    matches.push({ pending: p.name, code: p.code, match: exact.name, url: exact.imageUrl, type: 'EXACT' });
    continue;
  }

  const baseMatch = activeWithImages.find(a => a.name.toLowerCase().trim() === pBase);
  if (baseMatch) {
    matches.push({ pending: p.name, code: p.code, match: baseMatch.name, url: baseMatch.imageUrl, type: 'BASE' });
    continue;
  }

  // Look for high similarity
  const partial = activeWithImages.filter(a => {
    const aNorm = a.name.toLowerCase().trim();
    return (aNorm.includes(pBase) && pBase.length > 4) || (pBase.includes(aNorm) && aNorm.length > 4);
  });
  if (partial.length > 0) {
    matches.push({
      pending: p.name,
      code: p.code,
      candidates: partial.map(a => ({ name: a.name, url: a.imageUrl })),
      type: 'PARTIAL'
    });
  }
}

console.log('\nMatches summary:');
console.log('Exact / Base matches:', matches.filter(m => m.type !== 'PARTIAL').length);
matches.filter(m => m.type !== 'PARTIAL').forEach(m => console.log(`  - [${m.type}] "${m.pending}" -> "${m.match}": ${m.url}`));

console.log('\nPartial matches:', matches.filter(m => m.type === 'PARTIAL').length);
matches.filter(m => m.type === 'PARTIAL').slice(0, 10).forEach(m => {
  console.log(`  - "${m.pending}":`);
  m.candidates.slice(0, 3).forEach(c => console.log(`      * "${c.name}": ${c.url}`));
});
