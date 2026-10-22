import * as fs from 'fs';
import * as path from 'path';

const active = JSON.parse(fs.readFileSync(path.join(__dirname, 'active-ingredients-full.json'), 'utf8'));
const pending = JSON.parse(fs.readFileSync(path.join(__dirname, 'pending-audit-results.json'), 'utf8'));

export const COMPLETE_MERGE_MAP: Record<string, { targetName: string; reason: string }> = {
  // ── 1. THỊT, SƯỜN & PHỤ PHẨM HEO ────────────────────────────────────
  'Thịt ba chỉ heo tươi': { targetName: 'Thịt heo ba chỉ', reason: 'Đã có "Thịt heo ba chỉ" trong DB' },
  'Thịt nạc vai heo': { targetName: 'Thịt nạc heo', reason: 'Đã có "Thịt nạc heo" trong DB' },
  'Sườn cốt lết heo tươi': { targetName: 'Sườn heo', reason: 'Đã có "Sườn heo" trong DB' },
  'Phèo non heo tươi (Lòng non)': { targetName: 'Lòng heo', reason: 'Đã có "Lòng heo" trong DB' },
  'Khoanh giò heo': { targetName: 'Chân giò heo', reason: 'Đã có "Chân giò heo" trong DB' },
  'Xương ống heo hầm canh': { targetName: 'Xương heo', reason: 'Đã có "Xương heo" trong DB' },
  'Xương bay heo hầm nước dùng': { targetName: 'Xương heo', reason: 'Đã có "Xương heo" trong DB' },
  'Nước hầm xương heo': { targetName: 'Xương heo', reason: 'Đã có "Xương heo" trong DB' },
  'nước hầm xương': { targetName: 'Xương heo', reason: 'Đã có "Xương heo" trong DB' },
  'Pa-tê gan heo béo': { targetName: 'Pate gan', reason: 'Đã có "Pate gan" trong DB' },

  // ── 2. GIA CẦM ──────────────────────────────────────────────────────
  'Đùi gà góc tư': { targetName: 'Đùi tỏi gà', reason: 'Đã có "Đùi tỏi gà" trong DB' },
  'Nước luộc gà': { targetName: 'Gà ta', reason: 'Đã có "Gà ta" trong DB' },

  // ── 3. THỦY HẢI SẢN ──────────────────────────────────────────────────
  'Thịt hến tươi luộc sẵn': { targetName: 'Thịt hến', reason: 'Đã có "Thịt hến" trong DB' },
  'Phi lê cá rô phi tươi': { targetName: 'Cá rô phi', reason: 'Đã có "Cá rô phi" trong DB' },
  'Thịt cá ngừ (hoặc cá cờ)': { targetName: 'Cá ngừ', reason: 'Đã có "Cá ngừ" trong DB' },
  'Khô mực mini nướng nấu nước dùng': { targetName: 'Mực khô', reason: 'Đã có "Mực khô" trong DB' },
  'Tôm đất tươi': { targetName: 'Tôm', reason: 'Đã có "Tôm" trong DB' },
  'Thịt cua biển tươi gỡ sẵn': { targetName: 'Cua biển ghẹ', reason: 'Đã có "Cua biển ghẹ" trong DB' },
  'Thịt ghẹ tươi bóc sẵn': { targetName: 'Cua biển ghẹ', reason: 'Đã có "Cua biển ghẹ" trong DB' },
  'Gạch ghẹ xào dầu điều': { targetName: 'Dầu điều', reason: 'Đã có "Dầu điều" trong DB' },
  'Xương cá và đầu cá nấu nước dùng': { targetName: 'Cá', reason: 'Đã có "Cá" trong DB' },

  // ── 4. CHẢ & GIÒ ────────────────────────────────────────────────────
  'Giò lụa truyền thống': { targetName: 'Chả lụa', reason: 'Giò lụa chính là "Chả lụa" đã có trong DB' },

  // ── 5. TINH BỘT & NGŨ CỐC ──────────────────────────────────────────
  'Gạo tấm thơm': { targetName: 'Gạo', reason: 'Đã có "Gạo" trong DB' },
  'Cơm trắng (Cơm nguội)': { targetName: 'Cơm tẻ', reason: 'Cơm trắng là "Cơm tẻ" trong DB' },
  'Ruột bánh mì xé vụn': { targetName: 'Bánh mì', reason: 'Đã có "Bánh mì" trong DB' },
  'Bún sợi to Bún Bò Huế': { targetName: 'Bún', reason: 'Đã có "Bún" trong DB' },
  'Bánh đa đỏ Hải Phòng tươi': { targetName: 'Bánh đa', reason: 'Đã có "Bánh đa" trong DB' },
  'Sợi bánh canh bột gạo': { targetName: 'Bột gạo', reason: 'Đã có "Bột gạo" trong DB' },

  // ── 6. RAU CỦ & QUẢ ──────────────────────────────────────────────────
  'Củ sắn tươi (Củ đậu)': { targetName: 'Củ đậu', reason: 'Đã có "Củ đậu" trong DB' },
  'Rau cải xanh (Cải cay)': { targetName: 'Cải xanh', reason: 'Đã có "Cải xanh" trong DB' },
  'Thịt quả gấc tươi': { targetName: 'Quả gấc', reason: 'Đã có "Quả gấc" trong DB' },
  'Nấm bào ngư xám tươi': { targetName: 'Nấm bào ngư trắng', reason: 'Đã có "Nấm bào ngư trắng" trong DB' },
  'Rau sống hoa chuối búp non': { targetName: 'Bắp chuối', reason: 'Hoa chuối chính là "Bắp chuối" trong DB' },
  'Thân chuối non bào mỏng': { targetName: 'Bắp chuối', reason: 'Đã có "Bắp chuối" trong DB' },
  'Rau mầm củ cải trắng': { targetName: 'Củ cải trắng', reason: 'Đã có "Củ cải trắng" trong DB' },
  'Rau sống': { targetName: 'Rau thơm', reason: 'Đã có "Rau thơm" trong DB' },
  'Rau sống ăn kèm': { targetName: 'Rau xà lách', reason: 'Đã có "Rau xà lách" trong DB' },

  // ── 7. GIA VỊ, NƯỚC SỐT & DẦU ───────────────────────────────────────
  'Hành khô (Hành củ tím)': { targetName: 'Hành tím', reason: 'Đã có "Hành tím" trong DB' },
  'Hành tím phi giòn': { targetName: 'Hành phi tỏi phi', reason: 'Đã có "Hành phi tỏi phi" trong DB' },
  'Tỏi phi vàng thơm': { targetName: 'Hành phi tỏi phi', reason: 'Đã có "Hành phi tỏi phi" trong DB' },
  'Mỡ hành lá': { targetName: 'Hành lá', reason: 'Đã có "Hành lá" trong DB' },
  'Hoa hồi và quế thanh': { targetName: 'Hoa hồi', reason: 'Đã có "Hoa hồi" trong DB' },
  'Quế thanh cạo vỏ': { targetName: 'Quế chi', reason: 'Đã có "Quế chi" trong DB' },
  'Ớt chưng sa tế': { targetName: 'Sa tế', reason: 'Đã có "Sa tế" trong DB' },
  'Hạt điều màu (Hạt cà ri)': { targetName: 'Dầu điều', reason: 'Đã có "Dầu điều" trong DB' },
  'Tương đen': { targetName: 'Xì dầu (Nước tương đen)', reason: 'Đã có "Xì dầu (Nước tương đen)" trong DB' },
  'Nước cốt me chua': { targetName: 'Me vắt', reason: 'Đã có "Me vắt" trong DB' },
  'Nước chấm nem chua ngọt': { targetName: 'Nước mắm', reason: 'Quy về nước mắm' },
  'Gia vị nấu ăn tổng hợp': { targetName: 'Dầu ăn', reason: 'Quy về dầu ăn / gia vị nấu' },
  'Nước sốt trộn': { targetName: 'Xì dầu (Nước tương đen)', reason: 'Quy về xì dầu nước tương trộn' },

  // ── 8. NGUYÊN LIỆU KÉP (Ghép 2 loại quen thuộc) ──────────────────────
  'Dưa leo và cà chua tươi': { targetName: 'Dưa leo', reason: 'Nguyên liệu ghép: Dưa leo + Cà chua' },
  'Hành lá và ngò rí': { targetName: 'Hành lá', reason: 'Nguyên liệu ghép: Hành lá + Ngò rí' },
  'Hành lá và rau mùi (Ngò rí)': { targetName: 'Hành lá', reason: 'Nguyên liệu ghép: Hành lá + Ngò rí' },
  'Hành lá và mùi tàu (Ngò gai)': { targetName: 'Hành lá', reason: 'Nguyên liệu ghép: Hành lá + Ngò gai' },
  'Hành lá và rau răm tươi': { targetName: 'Hành lá', reason: 'Nguyên liệu ghép: Hành lá + Rau răm' },
  'Hành lá và thì là tươi': { targetName: 'Hành lá', reason: 'Nguyên liệu ghép: Hành lá + Thì là' },
  'lá lốt và tía tô': { targetName: 'Lá lốt', reason: 'Nguyên liệu ghép: Lá lốt + Tía tô' },
  'Rau kinh giới và rau mùi': { targetName: 'Kinh giới', reason: 'Nguyên liệu ghép: Kinh giới + Rau mùi' },
  'Rau xà lách và húng lủi': { targetName: 'Rau xà lách', reason: 'Nguyên liệu ghép: Xà lách + Húng lủi' },
  'Chanh tươi và ớt hiểm': { targetName: 'Chanh', reason: 'Nguyên liệu ghép: Chanh + Ớt' },
  'Tỏi tép và ớt hiểm': { targetName: 'Tỏi', reason: 'Nguyên liệu ghép: Tỏi + Ớt' },
  'Hành tím và gừng nướng': { targetName: 'Hành tím', reason: 'Nguyên liệu ghép: Hành tím + Gừng' },
  'Gia vị ướp tỏi gừng': { targetName: 'Gừng', reason: 'Nguyên liệu ghép: Tỏi + Gừng' },
  'Đồ chua (Cà rốt & Củ cải)': { targetName: 'Cà rốt', reason: 'Nguyên liệu ghép: Cà rốt + Củ cải' },
  'Rau ăn lẩu mắm thập cẩm (Kèo nèo, rau đắng, điên điển, bông súng)': { targetName: 'Rau đắng', reason: 'Rau lẩu mắm quy về Rau đắng' },
  'Rau sống chuối chát khế chua': { targetName: 'Khế chua', reason: 'Rau sống chuối khế quy về Khế chua' },
};

console.log(`Số lượng mapping chuẩn hóa: ${Object.keys(COMPLETE_MERGE_MAP).length}`);

let invalid = 0;
for (const [pName, map] of Object.entries(COMPLETE_MERGE_MAP)) {
  const target = active.find((a: any) => a.name.toLowerCase().trim() === map.targetName.toLowerCase().trim());
  if (!target) {
    console.error(`❌ Lỗi: Target "${map.targetName}" không tồn tại trong DB Active!`);
    invalid++;
  }
}

if (invalid === 0) {
  console.log(`✅ 100% Target Active Items đều tồn tại hợp lệ trong cơ sở dữ liệu!`);
}
