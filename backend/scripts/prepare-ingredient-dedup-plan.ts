import * as fs from 'fs';
import * as path from 'path';

interface ActiveItem {
  id: string;
  code: string;
  name: string;
  groupLabel: string;
  imageUrl: string;
  synonyms: string[];
}

interface PendingItem {
  pendingId: string;
  pendingCode: string;
  pendingName: string;
  pendingGroup: string;
  pendingImage: string;
  usedInDishes: string[];
  dishCount: number;
}

const active: ActiveItem[] = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'active-ingredients-full.json'), 'utf8')
);
const pending: PendingItem[] = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'pending-audit-results.json'), 'utf8')
);

// Map thủ công chuẩn xác 100% dựa trên nghiệp vụ ẩm thực Việt Nam
// Target là tên chính xác của Active item trong DB
const DEDUP_MAPPINGS: Record<string, { targetActiveName: string; note: string }> = {
  // ── THỊT & PHỤ PHẨM HEO ────────────────────────────────────────────────
  'Thịt ba chỉ heo tươi': { targetActiveName: 'Thịt heo ba chỉ', note: 'Trùng ba chỉ heo' },
  'Thịt nạc vai heo': { targetActiveName: 'Thịt nạc heo', note: 'Trùng thịt nạc heo' },
  'Phèo non heo tươi (Lòng non)': { targetActiveName: 'Lòng heo', note: 'Trùng lòng heo' },
  'Khoanh giò heo': { targetActiveName: 'Chân giò heo', note: 'Trùng chân giò heo' },
  'Xương ống heo hầm canh': { targetActiveName: 'Xương heo', note: 'Trùng xương heo' },
  'Xương bay heo hầm nước dùng': { targetActiveName: 'Xương heo', note: 'Trùng xương heo' },
  'Nước hầm xương heo': { targetActiveName: 'Xương heo', note: 'Quy về xương heo hầm' },
  'nước hầm xương': { targetActiveName: 'Xương heo', note: 'Quy về xương heo' },

  // ── GIA CẦM ──────────────────────────────────────────────────────────
  'Đùi gà góc tư': { targetActiveName: 'Đùi tỏi gà', note: 'Quy về đùi gà' },
  'Nước luộc gà': { targetActiveName: 'Gà ta', note: 'Nước luộc gà lấy từ gà ta' },

  // ── THỦY HẢI SẢN ──────────────────────────────────────────────────────
  'Thịt hến tươi luộc sẵn': { targetActiveName: 'Thịt hến', note: 'Khớp 100% thịt hến' },
  'Phi lê cá rô phi tươi': { targetActiveName: 'Cá rô phi', note: 'Khớp cá rô phi' },
  'Thịt cá ngừ (hoặc cá cờ)': { targetActiveName: 'Cá ngừ', note: 'Khớp cá ngừ' },
  'Khô mực mini nướng nấu nước dùng': { targetActiveName: 'Mực khô', note: 'Trùng mực khô' },
  'Tôm đất tươi': { targetActiveName: 'Tôm', note: 'Trùng tôm tươi' },
  'Thịt cua biển tươi gỡ sẵn': { targetActiveName: 'Cua biển ghẹ', note: 'Trùng cua biển' },
  'Thịt ghẹ tươi bóc sẵn': { targetActiveName: 'Cua biển ghẹ', note: 'Trùng cua biển ghẹ' },
  'Gạch ghẹ xào dầu điều': { targetActiveName: 'Dầu điều', note: 'Quy về gia vị dầu điều / cua ghẹ' },
  'Xương cá và đầu cá nấu nước dùng': { targetActiveName: 'Cá', note: 'Quy về cá' },

  // ── GIÒ CHẢ & CHẾ BIẾN SẴN ─────────────────────────────────────────────
  'Giò lụa truyền thống': { targetActiveName: 'Chả lụa', note: 'Giò lụa chính là Chả lụa' },

  // ── TINH BỘT & NGŨ CỐC ────────────────────────────────────────────────
  'Gạo tấm thơm': { targetActiveName: 'Gạo', note: 'Trùng gạo' },
  'Cơm trắng (Cơm nguội)': { targetActiveName: 'Cơm tẻ', note: 'Cơm trắng là Cơm tẻ' },
  'Ruột bánh mì xé vụn': { targetActiveName: 'Bánh mì', note: 'Trùng bánh mì' },
  'Bún sợi to Bún Bò Huế': { targetActiveName: 'Bún', note: 'Quy về bún tươi' },
  'Bánh đa đỏ Hải Phòng tươi': { targetActiveName: 'Bánh đa', note: 'Bánh đa Hải Phòng quy về Bánh đa' },
  'Sợi bánh canh bột gạo': { targetActiveName: 'Bột gạo', note: 'Quy về bột gạo / bánh canh' },

  // ── RAU CỦ & QUẢ ──────────────────────────────────────────────────────
  'Củ sắn tươi (Củ đậu)': { targetActiveName: 'Củ đậu', note: 'Củ sắn miền Nam chính là củ đậu' },
  'Rau cải xanh (Cải cay)': { targetActiveName: 'Cải xanh', note: 'Khớp 100% cải xanh' },
  'Thịt quả gấc tươi': { targetActiveName: 'Quả gấc', note: 'Khớp quả gấc' },
  'Nấm bào ngư xám tươi': { targetActiveName: 'Nấm bào ngư trắng', note: 'Trùng nấm bào ngư' },
  'Rau sống hoa chuối búp non': { targetActiveName: 'Bắp chuối', note: 'Hoa chuối chính là bắp chuối' },
  'Thân chuối non bào mỏng': { targetActiveName: 'Bắp chuối', note: 'Quy về thân / bắp chuối' },
  'Rau mầm củ cải trắng': { targetActiveName: 'Củ cải trắng', note: 'Trùng củ cải trắng' },

  // ── GIA VỊ, NƯỚC SỐT & DẦU ───────────────────────────────────────────
  'Hành khô (Hành củ tím)': { targetActiveName: 'Hành tím', note: 'Hành củ tím là Hành tím' },
  'Hành tím phi giòn': { targetActiveName: 'Hành phi tỏi phi', note: 'Khớp hành phi tỏi phi' },
  'Tỏi phi vàng thơm': { targetActiveName: 'Hành phi tỏi phi', note: 'Khớp hành phi tỏi phi' },
  'Mỡ hành lá': { targetActiveName: 'Hành lá', note: 'Mỡ hành quy về hành lá' },
  'Hoa hồi và quế thanh': { targetActiveName: 'Hoa hồi', note: 'Khớp hoa hồi' },
  'Quế thanh cạo vỏ': { targetActiveName: 'Quế chi', note: 'Quế thanh quy về Quế chi' },
  'Ớt chưng sa tế': { targetActiveName: 'Sa tế', note: 'Ớt chưng sa tế là Sa tế' },
  'Hạt điều màu (Hạt cà ri)': { targetActiveName: 'Dầu điều', note: 'Hạt điều màu làm dầu điều' },
  'Tương đen': { targetActiveName: 'Xì dầu (Nước tương đen)', note: 'Khớp nước tương đen' },

  // ── CÁC NGUYÊN LIỆU KÉP (Ghép 2 loại quen thuộc) ──────────────────────
  'Dưa leo và cà chua tươi': { targetActiveName: 'Dưa leo', note: 'Nguyên liệu kép: Dưa leo + Cà chua' },
  'Hành lá và ngò rí': { targetActiveName: 'Hành lá', note: 'Nguyên liệu kép: Hành lá + Ngò rí' },
  'Hành lá và rau mùi (Ngò rí)': { targetActiveName: 'Hành lá', note: 'Nguyên liệu kép: Hành lá + Ngò rí' },
  'Hành lá và mùi tàu (Ngò gai)': { targetActiveName: 'Hành lá', note: 'Nguyên liệu kép: Hành lá + Ngò gai' },
  'Hành lá và rau răm tươi': { targetActiveName: 'Hành lá', note: 'Nguyên liệu kép: Hành lá + Rau răm' },
  'Hành lá và thì là tươi': { targetActiveName: 'Hành lá', note: 'Nguyên liệu kép: Hành lá + Thì là' },
  'lá lốt và tía tô': { targetActiveName: 'Lá lốt', note: 'Nguyên liệu kép: Lá lốt + Tía tô' },
  'Rau kinh giới và rau mùi': { targetActiveName: 'Kinh giới', note: 'Nguyên liệu kép: Kinh giới + Rau mùi' },
  'Rau xà lách và húng lủi': { targetActiveName: 'Rau xà lách', note: 'Nguyên liệu kép: Xà lách + Húng lủi' },
  'Chanh tươi và ớt hiểm': { targetActiveName: 'Chanh', note: 'Nguyên liệu kép: Chanh + Ớt' },
  'Tỏi tép và ớt hiểm': { targetActiveName: 'Tỏi', note: 'Nguyên liệu kép: Tỏi + Ớt' },
  'Hành tím và gừng nướng': { targetActiveName: 'Hành tím', note: 'Nguyên liệu kép: Hành tím + Gừng' },
  'Gia vị ướp tỏi gừng': { targetActiveName: 'Gừng', note: 'Nguyên liệu kép: Tỏi + Gừng' },
  'Đồ chua (Cà rốt & Củ cải)': { targetActiveName: 'Cà rốt', note: 'Nguyên liệu kép: Cà rốt + Củ cải' },
  'Rau cũ luộc ăn kho quẹt (Đậu bắp, cà rốt, su su)': { targetActiveName: 'Đậu bắp', note: 'Nguyên liệu kép rau luộc' },
  'Rau ăn lẩu mắm thập cẩm (Kèo nèo, rau đắng, điên điển, bông súng)': { targetActiveName: 'Rau đắng', note: 'Rau ăn lẩu mắm quy về Rau đắng' },
  'Rau sống chuối chát khế chua': { targetActiveName: 'Khế chua', note: 'Rau sống chuối chát khế chua quy về Khế chua' },
};

console.log(`Kiểm tra tính hợp lệ của DEDUP_MAPPINGS...`);
let validMappings = 0;
for (const [pendingName, mapping] of Object.entries(DEDUP_MAPPINGS)) {
  const activeItem = active.find(a => a.name.toLowerCase().trim() === mapping.targetActiveName.toLowerCase().trim());
  if (!activeItem) {
    console.error(`❌ Lỗi cấu hình: Không tìm thấy activeItem "${mapping.targetActiveName}" trong DB!`);
  } else {
    validMappings++;
  }
}
console.log(`Hợp lệ: ${validMappings}/${Object.keys(DEDUP_MAPPINGS).length}`);

// Phân tích danh sách 107 pending
const plan = pending.map((p, idx) => {
  const mapping = DEDUP_MAPPINGS[p.pendingName];
  if (mapping) {
    const activeTarget = active.find(a => a.name.toLowerCase().trim() === mapping.targetActiveName.toLowerCase().trim())!;
    return {
      index: idx + 1,
      action: 'MERGE_TO_ACTIVE',
      pendingId: p.pendingId,
      pendingCode: p.pendingCode,
      pendingName: p.pendingName,
      usedInDishes: p.usedInDishes,
      targetActiveId: activeTarget.id,
      targetActiveCode: activeTarget.code,
      targetActiveName: activeTarget.name,
      note: mapping.note
    };
  } else {
    return {
      index: idx + 1,
      action: 'KEEP_DISTINCT_PENDING',
      pendingId: p.pendingId,
      pendingCode: p.pendingCode,
      pendingName: p.pendingName,
      usedInDishes: p.usedInDishes,
      targetActiveId: null,
      targetActiveCode: null,
      targetActiveName: null,
      note: 'Nguyên liệu đặc thù riêng biệt, giữ lại mục Cần duyệt để duyệt tay'
    };
  }
});

const mergeList = plan.filter(p => p.action === 'MERGE_TO_ACTIVE');
const keepList = plan.filter(p => p.action === 'KEEP_DISTINCT_PENDING');

console.log(`\n================ KẾ HOẠCH XỬ LÝ 107 NGUYÊN LIỆU ================`);
console.log(`1. Số lượng nguyên liệu TRÙNG LẶP / ĐÃ CÓ trong DB (sẽ hợp nhất & xóa khỏi Cần duyệt): ${mergeList.length}`);
console.log(`2. Số lượng nguyên liệu ĐẶC THÙ MỚI THẬT SỰ (giữ lại Cần duyệt để duyệt tay): ${keepList.length}`);
console.log(`=================================================================\n`);

fs.writeFileSync(path.join(__dirname, 'ingredient-dedup-plan.json'), JSON.stringify(plan, null, 2), 'utf8');
console.log('Đã lưu kế hoạch vào backend/scripts/ingredient-dedup-plan.json');
