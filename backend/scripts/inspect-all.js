const fs = require('fs');
const list = JSON.parse(fs.readFileSync('backend/scripts/current-pending-ingredients.json', 'utf8'));

list.forEach((item, i) => {
  console.log(`${(i + 1).toString().padStart(3, ' ')}. [${item.code}] "${item.name}"`);
});
