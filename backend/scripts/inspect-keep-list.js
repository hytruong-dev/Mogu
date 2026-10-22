const fs = require('fs');
const path = require('path');

const plan = JSON.parse(fs.readFileSync(path.join(__dirname, 'ingredient-dedup-plan.json'), 'utf8'));
const keep = plan.filter(p => p.action === 'KEEP_DISTINCT_PENDING');

console.log(`49 NGUYÊN LIỆU ĐẶC THÙ MỚI:`);
keep.forEach((k, idx) => {
  console.log(`${idx + 1}. [${k.pendingCode}] "${k.pendingName}" (Dùng trong: ${k.usedInDishes.join(', ')})`);
});
