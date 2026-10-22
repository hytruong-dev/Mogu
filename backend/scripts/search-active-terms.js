const fs = require('fs');
const path = require('path');

const active = JSON.parse(fs.readFileSync(path.join(__dirname, 'active-ingredients-full.json'), 'utf8'));

function searchActive(term) {
  const t = term.toLowerCase();
  return active
    .filter(a => a.name.toLowerCase().includes(t))
    .map(a => ({ id: a.id, code: a.code, name: a.name, group: a.groupLabel }));
}

const terms = [
  'thịt', 'ba chỉ', 'ba rọi', 'nạc', 'sườn', 'cốt lết', 'heo', 'bò', 'gà',
  'chả', 'giò', 'mọc', 'nem', 'dồi',
  'bún', 'mì', 'phở', 'hủ tiếu', 'bánh canh', 'bánh đa', 'gạo', 'tấm', 'cơm',
  'hành', 'tỏi', 'ớt', 'gừng', 'chanh', 'tiêu', 'quế', 'hồi',
  'rau', 'cải', 'muống', 'chuối', 'hoa chuối', 'bắp chuối', 'kèo nèo', 'rau đắng', 'bông súng', 'điên điển',
  'cá', 'tôm', 'mực', 'cua', 'ghẹ', 'hến', 'sứa', 'ốc',
  'đậu', 'nấm', 'trứng', 'mỡ', 'xương', 'dầu'
];

const results = {};
for (const t of terms) {
  results[t] = searchActive(t);
}

fs.writeFileSync(path.join(__dirname, 'active-by-terms.json'), JSON.stringify(results, null, 2), 'utf8');
console.log('Saved active-by-terms.json');
