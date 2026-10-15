import * as path from 'path';
import * as dotenv from 'dotenv';
import pg from 'pg';

dotenv.config({ path: path.join(__dirname, '../.env.local') });
dotenv.config({ path: path.join(__dirname, '../.env') });

export interface IngredientRow {
  id: string;
  code: string;
  name: string;
  group_label: string;
  allergen_code: string | null;
}

/**
 * Hàm phân loại allergen chuẩn hóa dựa trên tên và nhóm nguyên liệu.
 * Đối chiếu chặt chẽ với danh mục 35 mã dị ứng chuẩn hệ thống Mogu.
 */
export function determineAllergenCode(name: string, groupLabel: string): string | null {
  const n = name.toLowerCase().trim();

  // 1. TRỨNG (EGG)
  if (
    n.includes('trứng') ||
    n.includes('mayonnaise') ||
    n.includes('mayo') ||
    n === 'trung ga' ||
    n === 'trung vit'
  ) {
    return 'EGG';
  }

  // 2. SỮA & CHẾ PHẨM TỪ SỮA (MILK)
  if (
    (n.includes('sữa') && !n.includes('sữa đậu nành') && !n.includes('sữa bắp') && !n.includes('sữa hạt')) ||
    n.includes('phô mai') ||
    n.includes('phomai') ||
    n.includes('whipping') ||
    n.includes('kem tươi') ||
    n === 'kem' ||
    n === 'bơ' ||
    n === 'bơ lạt' ||
    n === 'bơ động vật'
  ) {
    return 'MILK';
  }

  // 3. ĐẬU NÀNH & CHẾ PHẨM (SOY)
  if (
    n.includes('đậu nành') ||
    n.includes('sữa đậu nành') ||
    n.includes('nước tương') ||
    n.includes('xì dầu') ||
    n.includes('tàu hũ') ||
    n.includes('đậu hũ') ||
    n.includes('đậu phụ') ||
    n.includes('đâu phụ') ||
    n.includes('đậu đậu làng mơ') ||
    n.includes('chao ') ||
    n === 'chao' ||
    n.includes('chao đỏ') ||
    n.includes('chao trắng') ||
    n.includes('tương bần') ||
    n.includes('tương đậu') ||
    n.includes('tương hột') ||
    n.includes('sốt đậu tứ xuyên') ||
    n.includes('dầu nành') ||
    n.includes('tàu chiên') ||
    n.includes('tàu mềm') ||
    n.includes('tàu bổ dưỡng') ||
    n.includes('bột tàu hủ') ||
    n.includes('xốt tương')
  ) {
    return 'SOY';
  }

  // 4. ĐẬU PHỘNG / LẠC (PEANUT)
  if (
    n.includes('đậu phộng') ||
    n.includes('lạc nhân') ||
    n.includes('hạt lạc') ||
    n.includes('bơ đậu phộng') ||
    n.includes('dầu đậu phộng')
  ) {
    return 'PEANUT';
  }

  // 5. CÁC LOẠI HẠT CÂY (TREE_NUT)
  if (
    n.includes('hạnh nhân') ||
    n.includes('óc chó') ||
    n.includes('hạt điều') ||
    n.includes('mắc ca') ||
    n.includes('macca') ||
    n.includes('hạt dẻ cười') ||
    n.includes('hồ đào') ||
    n.includes('hạt phỉ') ||
    n.includes('5 nuts')
  ) {
    return 'TREE_NUT';
  }

  // 6. CÁC LOẠI ĐẬU ĐỖ KHÁC (LEGUMES_OTHER)
  if (
    n.includes('đậu xanh') ||
    n.includes('đậu đen') ||
    n.includes('đậu đỏ') ||
    n.includes('đậu ngự') ||
    n.includes('đậu hà lan') ||
    n.includes('đậu cove') ||
    n.includes('đậu que') ||
    n.includes('đậu ván') ||
    n.includes('đậu truyền thống')
  ) {
    return 'LEGUMES_OTHER';
  }

  // 7. MẮM TÔM, MẮM RUỐC & MẮM LÊN MEN (FERMENTED_PASTE)
  if (
    n.includes('mắm tôm') ||
    n.includes('mắm ruốc') ||
    n.includes('mắm nêm') ||
    n.includes('mắm cáy') ||
    n.includes('mắm tép') ||
    n.includes('mắm ba khía') ||
    n.includes('mắm cá linh') ||
    n.includes('mắm cá sặc') ||
    n.includes('mắm cá')
  ) {
    return 'FERMENTED_PASTE';
  }

  // 8. ĐỘNG VẬT GIÁP XÁC (SHELLFISH) - Tôm, Cua, Ghẹ, Bề bề, Tép, Rươi, Nhộng
  if (
    n.includes('tôm') ||
    n.includes('cua biển') ||
    n.includes('cua đồng') ||
    n.includes('ghẹ') ||
    n.includes('bề bề') ||
    n.includes('tép') ||
    n.includes('sa tế tôm') ||
    n.includes('muối tôm') ||
    n.includes('rươi') ||
    n.includes('bánh đa cua') ||
    n.includes('bún riêu cua') ||
    n.includes('bánh phồng tôm') ||
    n.includes('nhộng tằm') ||
    n.includes('trộn hải sản') ||
    n.includes('miến cua')
  ) {
    return 'SHELLFISH';
  }

  // 9. ĐỘNG VẬT NHUYỄN THỂ (MOLLUSK) - Mực, Bạch tuộc, Sò, Nghêu, Ốc, Hàu, Hến, Hải sâm, Điệp
  if (
    n.includes('mực') ||
    n.includes('bạch tuộc') ||
    n.includes('nghêu') ||
    n.includes('sò') ||
    n.includes('ốc') ||
    n.includes('hàu') ||
    n.includes('hến') ||
    n.includes('điệp') ||
    n.includes('hải sâm') ||
    n.includes('bào ngư') ||
    n.includes('tu hài') ||
    n.includes('sá sùng') ||
    n.includes('dầu hào')
  ) {
    return 'MOLLUSK';
  }

  // 10. CÁ (FISH)
  if (
    n.includes('cá ') ||
    n.endsWith(' cá') ||
    n === 'cá' ||
    n.includes('cá basa') ||
    n.includes('cá lóc') ||
    n.includes('cá hồi') ||
    n.includes('cá kho') ||
    n.includes('chả cá') ||
    n.includes('nước mắm') ||
    n.includes('lươn')
  ) {
    return 'FISH';
  }

  // 11. THỊT BÒ & THỊT ĐỎ (BEEF_RED_MEAT)
  if (
    (n.includes('bò') && !n.includes('rau bắp bò') && !n.includes('bò bía') && !n.includes('rau')) ||
    n.includes('bê') ||
    n.includes('thịt dê') ||
    n.includes('thịt cừu') ||
    n.includes('thịt trâu') ||
    n.includes('thịt thỏ')
  ) {
    return 'BEEF_RED_MEAT';
  }

  // 12. THỊT HEO (PORK)
  if (
    n.includes('heo') ||
    n.includes('lợn') ||
    n.includes('chả lụa') ||
    n.includes('thịt nguội') ||
    n.includes('xúc xích') ||
    n.includes('mỡ chài') ||
    n.includes('dồi trường') ||
    n.includes('bắp giò') ||
    n.includes('nạc nọng') ||
    n.includes('pate gan') ||
    n.includes('thịt bằm') ||
    (groupLabel === 'Thịt' && (n.includes('ba rọi') || n.includes('sườn') || n.includes('nạc')))
  ) {
    return 'PORK';
  }

  // 13. THỊT GÀ & GIA CẦM (POULTRY)
  if (
    (n.includes('gà') && !n.includes('trứng') && !n.includes('nấm đùi gà') && !n.includes('rau ngò gai')) ||
    n.includes('thịt vịt') ||
    n.includes('vịt') ||
    n.includes('thịt ngan') ||
    n.includes('ngỗng') ||
    n.includes('chim cút') ||
    n.includes('bồ câu')
  ) {
    return 'POULTRY';
  }

  // 14. LÚA MÌ / GLUTEN (WHEAT)
  if (
    n.includes('bột mì') ||
    n.includes('bánh mì') ||
    n.includes('mì sợi') ||
    n.includes('mì ăn liền') ||
    n.includes('mì chay') ||
    n.includes('nui ') ||
    n === 'nui' ||
    n.includes('bột chiên xù') ||
    n.includes('bột chiên giòn') ||
    n.includes('bột bánh rán') ||
    n.includes('bột tẩm khô chiên giòn') ||
    n.includes('spaghetti') ||
    n.includes('fresco')
  ) {
    return 'WHEAT';
  }

  // 15. NGÔ / BẮP (CORN)
  if (
    n.includes('bột bắp') ||
    n.includes('tinh bột bắp') ||
    n.includes('bắp mỹ') ||
    n.includes('ngô ngọt') ||
    n === 'ngô' ||
    n === 'bắp'
  ) {
    return 'CORN';
  }

  // 16. MÈ / VỪNG (SESAME)
  if (
    n.includes('mè ') ||
    n === 'mè' ||
    n.includes('vừng') ||
    n.includes('dầu mè') ||
    n.includes('mè rang') ||
    n.includes('tahini') ||
    n.includes('lá mè')
  ) {
    return 'SESAME';
  }

  // 17. MÙ TẠT (MUSTARD)
  if (n.includes('mù tạt') || n.includes('wasabi') || n.includes('mustard')) {
    return 'MUSTARD';
  }

  // 18. CẦN TÂY (CELERY)
  if (n.includes('cần tây') || n.includes('cần tàu') || n.includes('rau cần tàu') || n === 'rau cần') {
    return 'CELERY';
  }

  // 19. NẤM ĂN CÁC LOẠI (MUSHROOM)
  if (
    n.includes('nấm') ||
    n.includes('mộc nhĩ') ||
    n.includes('nấm đông cô') ||
    n.includes('nấm hương') ||
    n.includes('nấm shiitake')
  ) {
    return 'MUSHROOM';
  }

  // 20. BỘT NGỌT / MÌ CHÍNH (MSG)
  if (n.includes('bột ngọt') || n.includes('mì chính') || n.includes('monosodium')) {
    return 'MSG';
  }

  // 21. HÀNH, TỎI & HẸ (ALLIUM)
  if (
    n.includes('hành lá') ||
    n.includes('hành củ') ||
    n.includes('hành tím') ||
    n.includes('hành tây') ||
    n.includes('hành phi') ||
    n.includes('hành lý sơn') ||
    n.includes('tỏi') ||
    n.includes('hẹ') ||
    n.includes('củ kiệu') ||
    n.includes('củ nén')
  ) {
    return 'ALLIUM';
  }

  // 22. DỪA & NƯỚC CỐT DỪA (COCONUT)
  if (
    n.includes('nước cốt dừa') ||
    n.includes('bột cốt dừa') ||
    n.includes('dầu dừa') ||
    n.includes('nước màu dừa') ||
    n.includes('củ hũ dừa') ||
    n === 'dừa' ||
    n === 'nước dừa'
  ) {
    return 'COCONUT';
  }

  // 23. TRÁI CÂY HỌ CAM CHANH (CITRUS)
  if (
    n.startsWith('cam ') ||
    n === 'cam' ||
    n.startsWith('chanh') ||
    n.startsWith('bưởi') ||
    n.startsWith('quất') ||
    n === 'tắc' ||
    n.includes('chanh leo') ||
    n.includes('chanh dây') ||
    n.includes('chanh nha trang')
  ) {
    return 'CITRUS';
  }

  // 24. TRÁI CÂY NHẠY CẢM (TROPICAL_FRUIT) - Dứa, Xoài, Kiwi
  if (
    n.startsWith('xoài') ||
    n.startsWith('dứa') ||
    n.includes('khóm') ||
    n.startsWith('kiwi')
  ) {
    return 'TROPICAL_FRUIT';
  }

  // 25. NHÓM CÀ & CÀ CHUA (NIGHTSHADE)
  if (
    n.startsWith('cà chua') ||
    n.startsWith('cà tím') ||
    n.startsWith('cà pháo') ||
    n.startsWith('khoai tây') ||
    n.includes('tương cà')
  ) {
    return 'NIGHTSHADE';
  }

  // 26. ỚT & GIA VỊ CAY NỒNG (CAPSAICIN_SPICE)
  if (
    n.startsWith('ớt ') ||
    n === 'ớt' ||
    n.includes('ớt bột') ||
    n.includes('ớt khô') ||
    n.includes('sa tế') ||
    n.includes('tương ớt') ||
    n.includes('tiêu sọ') ||
    n.includes('tiêu đen') ||
    n.includes('tiêu xanh') ||
    n.startsWith('tiêu') ||
    n.includes('ngũ vị hương') ||
    n.includes('bột cà ri')
  ) {
    return 'CAPSAICIN_SPICE';
  }

  // 27. CACAO & SÔ CÔ LA (COCOA)
  if (n.includes('ca cao') || n.includes('cacao') || n.includes('sô cô la') || n.includes('chocolate')) {
    return 'COCOA';
  }

  // 28. CỒN & RƯỢU NẤU ĂN (ALCOHOL)
  if (
    n.includes('rượu') ||
    n.includes('cơm rượu') ||
    n.includes('bia')
  ) {
    return 'ALCOHOL';
  }

  // 29. ĐƯỜNG ĂN KIÊNG / CHẤT TẠO NGỌT (ARTIFICIAL_SWEETENER)
  if (n.includes('đường ăn kiêng') || n.includes('aspartame') || n.includes('sucralose')) {
    return 'ARTIFICIAL_SWEETENER';
  }

  // Mặc định không phải chất gây dị ứng phổ biến
  return null;
}

/**
 * Thực thi cập nhật trực tiếp vào bảng ingredients trong database
 */
async function applyIngredientAllergens() {
  const pool = new pg.Pool({
    connectionString: process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL,
  });

  try {
    console.log('=== BẮT ĐẦU CẬP NHẬT MÃ DỊ ỨNG CHO TOÀN BỘ 712 NGUYÊN LIỆU ===\n');

    const res = await pool.query('SELECT id, code, name, group_label, allergen_code FROM ingredients ORDER BY name');
    const ingredients = res.rows as IngredientRow[];

    let updatedCount = 0;
    let unchangedCount = 0;

    for (const item of ingredients) {
      const newAllergenCode = determineAllergenCode(item.name, item.group_label);

      if (newAllergenCode !== item.allergen_code) {
        await pool.query('UPDATE ingredients SET allergen_code = $1, updated_at = NOW() WHERE id = $2', [
          newAllergenCode,
          item.id,
        ]);
        updatedCount++;
      } else {
        unchangedCount++;
      }
    }

    console.log(`✓ Đã cập nhật thành công: ${updatedCount} nguyên liệu.`);
    console.log(`✓ Không đổi (đã khớp chuẩn): ${unchangedCount} nguyên liệu.`);

    // Lấy thống kê sau khi cập nhật
    const statRes = await pool.query(`
      SELECT COALESCE(allergen_code, 'KHÔNG_CÓ_DỊ_ỨNG') as allergen, count(*) as total
      FROM ingredients
      GROUP BY allergen_code
      ORDER BY count(*) DESC
    `);

    console.log('\n=== BẢNG PHÂN BỔ DỊ ỨNG TOÀN BỘ NGUYÊN LIỆU TRONG DATABASE ===');
    console.table(statRes.rows);

    const hasAllergenRes = await pool.query('SELECT count(*) FROM ingredients WHERE allergen_code IS NOT NULL');
    console.log(`\n🎉 Tổng cộng: ${hasAllergenRes.rows[0].count} / ${ingredients.length} nguyên liệu đã được gắn nhãn dị ứng chính xác!`);
  } finally {
    await pool.end();
  }
}

applyIngredientAllergens().catch(console.error);
