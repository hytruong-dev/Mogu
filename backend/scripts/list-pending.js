const fs = require('fs');
const list = JSON.parse(fs.readFileSync('backend/scripts/current-pending-ingredients.json', 'utf8'));

console.log('Total pending:', list.length);
list.forEach((item, i) => {
  console.log(`${i + 1}. [${item.code}] "${item.name}"`);
});
