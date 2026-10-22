const fs = require('fs');
const path = require('path');

const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'pending-audit-results.json'), 'utf8'));

let out = '';
data.forEach((item, index) => {
  const top = item.topCandidates[0];
  out += `${index + 1}. [${item.pendingCode}] "${item.pendingName}" (Dùng trong: ${item.usedInDishes.join(', ')})\n`;
  if (top) {
    out += `   👉 Gợi ý: "${top.activeName}" (Code: ${top.activeCode}, Điểm: ${top.score}, Lý do: ${top.reason})\n`;
    if (item.topCandidates.length > 1) {
      out += `   👉 Khác: ${item.topCandidates.slice(1, 4).map(c => `"${c.activeName}" (${c.score})`).join(', ')}\n`;
    }
  } else {
    out += `   ✨ [NGUYÊN LIỆU MỚI HOÀN TOÀN]\n`;
  }
});

fs.writeFileSync(path.join(__dirname, 'classified-summary.txt'), out, 'utf8');
console.log('Đã tạo backend/scripts/classified-summary.txt');
