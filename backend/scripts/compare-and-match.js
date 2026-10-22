const fs = require('fs');
const path = require('path');

const active = JSON.parse(fs.readFileSync(path.join(__dirname, 'active-ingredients-full.json'), 'utf8'));
const pending = JSON.parse(fs.readFileSync(path.join(__dirname, 'pending-audit-results.json'), 'utf8'));

// Tạo lookup map cho active
function normalize(str) {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

const activeMap = active.map(a => ({
  ...a,
  norm: normalize(a.name)
}));

function findBestActive(pName) {
  const pNorm = normalize(pName);

  // 1. Exact match normalized
  let found = activeMap.find(a => a.norm === pNorm);
  if (found) return { item: found, matchType: 'EXACT', confidence: 100 };

  // 2. Các pattern cụ thể trong tiếng Việt
  // Loại bỏ các từ phụ: tươi, khô, luộc sẵn, gỡ sẵn, bóc sẵn, xắt lát, thái mỏng, tẩm vị, ráo nước, hầm nước dùng, nấu canh, ăn kèm...
  const cleaned = pNorm
    .replace(/\b(tuoi|kho|luoc san|go san|boc san|tam vi|ham nuoc dung|nau canh|an kem|nau nuoc dung|truyen thong|tron thinh gao|mieng soi|gion|chien hap|xao dau dieu|beo|banh te|bao mong|rang min|hoac ca co|nguyen chat|xé vụn)\b/g, '')
    .trim()
    .replace(/\s+/g, ' ');

  found = activeMap.find(a => a.norm === cleaned);
  if (found) return { item: found, matchType: 'CLEANED_EXACT', confidence: 95 };

  // Kiểm tra nếu active nằm trọn vẹn trong cleaned
  const subMatches = activeMap
    .filter(a => cleaned === a.norm || cleaned.startsWith(a.norm + ' ') || cleaned.endsWith(' ' + a.norm) || cleaned.includes(' ' + a.norm + ' '))
    .sort((a, b) => b.norm.length - a.norm.length);

  if (subMatches.length > 0) {
    return { item: subMatches[0], matchType: 'SUBSTRING_ACTIVE', confidence: 85 };
  }

  return null;
}

const classified = pending.map((p, idx) => {
  const match = findBestActive(p.pendingName);
  return {
    index: idx + 1,
    pendingId: p.pendingId,
    pendingCode: p.pendingCode,
    pendingName: p.pendingName,
    usedInDishes: p.usedInDishes,
    match: match ? {
      activeId: match.item.id,
      activeCode: match.item.code,
      activeName: match.item.name,
      matchType: match.matchType,
      confidence: match.confidence
    } : null
  };
});

fs.writeFileSync(path.join(__dirname, 'smart-matches.json'), JSON.stringify(classified, null, 2), 'utf8');

const matchedList = classified.filter(c => c.match);
const unmatchedList = classified.filter(c => !c.match);

console.log(`Tổng pending: ${classified.length}`);
console.log(`Tìm thấy active tương ứng: ${matchedList.length}`);
console.log(`Chưa tìm thấy (nguyên liệu đặc thù mới): ${unmatchedList.length}\n`);

console.log('--- DANH SÁCH KHỚP (CÓ THỂ HỢP NHẤT VÀO ACTIVE) ---');
matchedList.forEach(m => {
  console.log(`${m.index}. "${m.pendingName}" -> Active: "${m.match.activeName}" (${m.match.matchType}) [Dùng trong: ${m.usedInDishes.join(', ')}]`);
});

console.log('\n--- DANH SÁCH ĐẶC THÙ MỚI (CẦN GIỮ LẠI ĐỂ DUYỆT) ---');
unmatchedList.forEach(u => {
  console.log(`${u.index}. "${u.pendingName}" [Dùng trong: ${u.usedInDishes.join(', ')}]`);
});
