import * as fs from 'fs';
import * as path from 'path';

interface Candidate {
  activeId: string;
  activeCode: string;
  activeName: string;
  activeGroup: string;
  activeImage: string;
  score: number;
  reason: string;
}

interface PendingItem {
  pendingId: string;
  pendingCode: string;
  pendingName: string;
  pendingGroup: string;
  pendingImage: string;
  usedInDishes: string[];
  dishCount: number;
  topCandidates: Candidate[];
}

const data: PendingItem[] = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'pending-audit-results.json'), 'utf8')
);

console.log(`Đang phân loại ${data.length} nguyên liệu pending:\n`);

data.forEach((item, index) => {
  const top = item.topCandidates[0];
  console.log(`${index + 1}. [${item.pendingCode}] "${item.pendingName}" (${item.usedInDishes.join(', ')})`);
  if (top) {
    console.log(`   👉 Gợi ý Active tốt nhất: "${top.activeName}" (Code: ${top.activeCode}, Điểm: ${top.score}, Lý do: ${top.reason})`);
    if (item.topCandidates.length > 1) {
      console.log(`      Ứng viên khác: ${item.topCandidates.slice(1, 4).map(c => `"${c.activeName}" (${c.score})`).join(', ')}`);
    }
  } else {
    console.log(`   ✨ NGUYÊN LIỆU MỚI HOÀN TOÀN (Không có trong DB Active)`);
  }
});
