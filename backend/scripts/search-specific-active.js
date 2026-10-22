const fs = require('fs');
const path = require('path');
const active = JSON.parse(fs.readFileSync(path.join(__dirname, 'active-ingredients-full.json'), 'utf8'));

const targets = ['đậu phụ', 'đậu hũ', 'đậu khuôn', 'gan', 'bò khô', 'heo quay', 'xá xíu', 'mọc', 'sườn', 'me', 'rau thơm', 'xà lách', 'dồi', 'nước mắm', 'chả cá', 'chả bò', 'chả cốm', 'chả trứng'];

targets.forEach(t => {
  const matches = active.filter(a => a.name.toLowerCase().includes(t));
  console.log(`\n=== "${t}" (${matches.length}) ===`);
  matches.forEach(m => console.log(`  - [${m.code}] "${m.name}"`));
});
