/**
 * Automated Ingredient Cleaner & Variant Merger for Mogu
 *
 * Consolidates near-duplicates, removes redundant commercial prefixes/suffixes,
 * strips instant meal products, and updates synonyms.
 */

import * as path from 'path';
import * as dotenv from 'dotenv';
import pg from 'pg';

dotenv.config({ path: path.join(__dirname, '../.env.local') });
dotenv.config({ path: path.join(__dirname, '../.env') });

const pool = new pg.Pool({
  connectionString: process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL,
});

// Danh sách các nguyên liệu biến thể cần gộp vào nguyên liệu chuẩn:
// [Tên nguồn (xóa sau khi gộp), Tên đích (giữ lại và thêm synonym)]
const MERGE_MAP: [string, string][] = [
  // Tiền tố "Thịt"
  ['Thịt Ba Rọi heo', 'Ba rọi heo'],
  ['Thịt Thăn bò', 'Thăn bò'],
  ['Thịt ức gà', 'Ức gà'],
  ['Thịt gà ta', 'Gà ta'],
  ['Thịt nghêu', 'Nghêu'],
  ['Phi lê ức gà', 'Ức gà'],
  ['Cá basa phi lê', 'Cá basa'],
  ['Cá hồi phi lê', 'Cá hồi'],
  ['Bít tết đùi bò', 'Đùi bò'],
  ['Nạc đùi bò', 'Đùi bò'],
  ['Chân giò heo rút xương', 'Chân giò heo'],
  ['Giò heo', 'Chân giò heo'],
  ['Xương heo có thịt', 'Xương heo'],
  ['Xương heo WCM', 'Xương heo'],
  ['Tôm thẻ nõn', 'Tôm thẻ'],
  ['Mực trứng loại A', 'Mực trứng'],
  ['Nghêu trắng', 'Nghêu'],

  // Tiền tố "Củ"
  ['Củ gừng', 'Gừng'],
  ['Củ nghệ', 'Nghệ'],
  ['Củ riềng', 'Riềng'],
  ['Củ sả', 'Sả'],

  // Trái cây & Xuất xứ / Biến thể thừa
  ['Táo Envy New', 'Táo Envy'],
  ['Táo Envy NewZealand', 'Táo Envy'],
  ['Táo Breeze New', 'Táo Breeze Newzealand'],
  ['Kiwi vàng Newzealand', 'Kiwi vàng'],
  ['Kiwi xanh Newzealand', 'Kiwi xanh'],
  ['Bưởi hồng da xanh miền Tây', 'Bưởi hồng da xanh'],
  ['Cam Sành loại', 'Cam sành'],
  ['Dưa hấu đỏ', 'Dưa hấu'],
  ['Dưa hấu Hắc Nhân', 'Dưa hấu'],
  ['Xoài keo bao vàng', 'Xoài keo'],
  ['Rong nho *5', 'Rong nho'],

  // Rau củ biến thể thừa
  ['Bắp cải trắng', 'Bắp cải'],
  ['Bắp cải trái tim', 'Bắp cải'],
  ['Bắp cải thảo', 'Cải thảo'],
  ['Bí đỏ tròn', 'Bí đỏ'],
  ['Bí đỏ hồ lô', 'Bí đỏ'],
  ['Bí xanh thơm', 'Bí xanh'],
  ['Cà rốt baby', 'Cà rốt'],
  ['Cà tím dài', 'Cà tím'],
  ['Khoai lang mật', 'Khoai lang'],
  ['Rau mầm cải', 'Rau mầm cải xanh'],
  ['Rau muống hạt', 'Rau muống'],

  // Dầu ăn & Mỡ
  ['Dầu đậu nành', 'Dầu nành'],
  ['Dầu mè lít', 'Dầu mè'],
  ['Dầu Thực Vật T12', 'Dầu thực vật'],
  ['Dầu hướng dương VitaOrganic cao cấp', 'Dầu hướng dương'],
  ['Dầu gạo lức RBO', 'Dầu gạo lứt'],
  ['Dầu gạo', 'Dầu gạo lứt'],

  // Trứng & Sữa
  ['Trứng cút O\'LALA', 'Trứng cút'],
  ['Trứng gà DHA', 'Trứng gà'],
  ['Trứng gà J', 'Trứng gà'],
  ['Trứng gà quê', 'Trứng gà'],
  ['Trứng gà so', 'Trứng gà'],
  ['Trứng gà ta', 'Trứng gà'],

  // Gia vị & Ngũ cốc & Bột
  ['Tương cà eo', 'Tương cà'],
  ['Đường Pure', 'Đường'],
  ['Đường cát', 'Đường'],
  ['Đường mía', 'Đường'],
  ['Đường phèn hạt thiên nhiên', 'Đường phèn hạt'],
  ['Đường phèn hạt', 'Đường phèn'],
  ['Bột chiên', 'Bột chiên giòn'],
  ['Bột mì cho Bánh Mì', 'Bột mì đa dụng'],
  ['Bột mì', 'Bột mì đa dụng'],
  ['Bột năng đa dụng', 'Bột năng'],
  ['Bánh phở khô', 'Bánh phở'],
  ['Bún khô Hùng Lô', 'Bún khô'],
  ['Lá kim cuốn cơm Gimbab & Roll', 'Lá Kim cuốn cơm'],
  ['Rong biển cuộn cơm', 'Lá rong biển cuốn cơm'],
  ['Miến dong Na Rì', 'Miến dong'],
  ['Miến dong Bắc Kạn', 'Miến dong'],
  ['Sốt mayonnaise Aji Mayo', 'Sốt mayonnaise'],
  ['Sốt dầu dấm trộn salad', 'Dầu dấm trộn salad'],
  ['Nước xốt mè rang Yuzu &Tắc', 'Nước xốt mè rang'],
  ['Xốt gia vị hoàn chỉnh Thịt nướng ngũ vị', 'Xốt gia vị hoàn chỉnh thịt nướng'],
  ['Ướp thịt nướng', 'Xốt ướp thịt nướng'],
  ['Cua đồng tinh chất', 'Cua đồng'],
  ['Cua đồng xay', 'Cua đồng'],
  ['Thịt cua đồng xay tinh chế', 'Cua đồng'],
  ['Ngũ cốc ăn sáng Corn Flakes', 'Ngũ cốc ăn sáng'],
  ['Ngũ cốc ăn sáng Honey Star', 'Ngũ cốc ăn sáng'],
  ['Ngũ cốc ăn sáng Koko', 'Ngũ cốc ăn sáng'],
  ['Ngũ cốc ăn sáng Koko vị sô cô la', 'Ngũ cốc ăn sáng'],
  ['Ngũ cốc dinh dưỡng Mueslix Orchard Beauty', 'Ngũ cốc dinh dưỡng'],
  ['Ngũ cốc Trái cây ít đường', 'Ngũ cốc Trái cây'],
];

// Danh sách các món ăn liền đóng gói / set ăn liền bị sót cần xóa khỏi nguyên liệu nấu ăn thô
const DELETE_ITEMS: string[] = [
  'Miến Sườn Heo Miến Sườn Heo',
  'Lẩu Tomyum ba chỉ bò',
  'Bún bò Huế Hằng Nga',
  'Phở thịt bò hầm',
  'Phở thịt gà 18 x',
  'Phở thịt gà',
  'Vị phô mai',
  'Vị truyền thống',
  'Rong biển xốt Wasabi',
  'Bột bánh rán vị socola',
];

async function runMergeAndClean() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    console.log('--- BẮT ĐẦU QUÁ TRÌNH GỘP & TINH LỌC BIẾN THỂ NGUYÊN LIỆU ---\n');

    let mergedCount = 0;
    let deletedCount = 0;

    // 1. Thực hiện gộp (Merge)
    for (const [sourceName, targetName] of MERGE_MAP) {
      const srcRes = await client.query('SELECT * FROM ingredients WHERE name = $1', [sourceName]);
      const tgtRes = await client.query('SELECT * FROM ingredients WHERE name = $1', [targetName]);

      if (srcRes.rows.length === 0) {
        continue;
      }

      if (tgtRes.rows.length === 0) {
        // Nếu target chưa có, đổi tên source thành target
        const src = srcRes.rows[0];
        const newFolded = targetName
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toLowerCase()
          .trim();
        await client.query(
          `UPDATE ingredients 
           SET name = $1, identity_normalized = LOWER(TRIM($1)), search_folded = $2
           WHERE id = $3`,
          [targetName, newFolded, src.id]
        );
        console.log(`  [Đổi tên chuẩn hóa] "${sourceName}" => "${targetName}"`);
        continue;
      }

      const src = srcRes.rows[0];
      const tgt = tgtRes.rows[0];

      // Hợp nhất synonyms
      const combinedSynonyms = Array.from(
        new Set([
          ...(tgt.synonyms || []),
          ...(src.synonyms || []),
          src.name,
        ])
      ).filter((s) => s.toLowerCase() !== tgt.name.toLowerCase());

      // Ưu tiên hình ảnh hợp lệ
      const finalImage = tgt.image_url || src.image_url;

      // Cập nhật target
      await client.query(
        `UPDATE ingredients 
         SET synonyms = $1, image_url = $2, updated_at = NOW()
         WHERE id = $3`,
        [combinedSynonyms, finalImage, tgt.id]
      );

      // Chuyển quan hệ FK (nếu có)
      await client.query(
        `UPDATE user_avoided_ingredients SET ingredient_id = $1 WHERE ingredient_id = $2`,
        [tgt.id, src.id]
      );
      await client.query(
        `UPDATE dish_ingredients SET ingredient_id = $1 WHERE ingredient_id = $2`,
        [tgt.id, src.id]
      );

      // Xóa source
      await client.query(`DELETE FROM ingredients WHERE id = $1`, [src.id]);

      mergedCount++;
      console.log(`  [Đã gộp] "${sourceName}" => "${targetName}" (Synonyms: [${combinedSynonyms.join(', ')}])`);
    }

    // 2. Xóa các món ăn liền đóng gói / nhãn vị rác
    console.log('\n--- XÓA CÁC MÓN ĂN LIỀN / SẢN PHẨM KHÔNG PHẢI NGUYÊN LIỆU THÔ ---');
    for (const delName of DELETE_ITEMS) {
      const delRes = await client.query('SELECT id, name FROM ingredients WHERE name = $1', [delName]);
      if (delRes.rows.length > 0) {
        const item = delRes.rows[0];
        await client.query('DELETE FROM user_avoided_ingredients WHERE ingredient_id = $1', [item.id]);
        await client.query('DELETE FROM dish_ingredients WHERE ingredient_id = $1', [item.id]);
        await client.query('DELETE FROM ingredients WHERE id = $1', [item.id]);
        deletedCount++;
        console.log(`  [Đã xóa món ăn liền/không phù hợp] "${delName}"`);
      }
    }

    await client.query('COMMIT');

    // 3. Đếm lại số lượng sau khi dọn dẹp
    const finalCount = await client.query('SELECT count(*)::int as c FROM ingredients');
    console.log('\n======================================================');
    console.log(`Tổng kết tinh lọc & gộp:`);
    console.log(`  • Số biến thể đã gộp thành công: ${mergedCount}`);
    console.log(`  • Số sản phẩm đóng gói/rác đã xóa: ${deletedCount}`);
    console.log(`  • Số nguyên liệu chuẩn còn lại trong DB: ${finalCount.rows[0].c}`);
    console.log('======================================================');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Lỗi trong quá trình merge:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

runMergeAndClean().catch(console.error);
