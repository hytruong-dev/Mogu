import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const DISH_PREFIX_MAP: Record<string, string> = {
  'pho_bo': 'Phở bò',
  'bun_cha_ha_noi': 'Bún chả Hà Nội',
  'bun_dau_mam_tom': 'Bún đậu mắm tôm',
  'bun_rieu_cua_dong': 'Bún riêu cua đồng',
  'cha_ca_la_vong': 'Chả cá Lã Vọng',
  'bun_oc_ha_noi': 'Bún ốc Hà Nội',
  'bo_sot_vang_banh_mi': 'Bò sốt vang bánh mì',
  'xoi_xeo_ha_noi': 'Xôi xéo Hà Nội',
  'bun_moc_suon_chua': 'Bún mọc sườn chua',
  'lau_rieu_cua_bap_bo': 'Lẩu riêu cua bắp bò',
  'bun_bo_hue': 'Bún bò Huế',
  'mi_quang_tom_thit': 'Mì Quảng tôm thịt',
  'com_ga_hoi_an': 'Cơm gà Hội An',
  'cao_lau_hoi_an': 'Cao lầu Hội An',
  'bun_cha_ca_nha_trang': 'Bún chả cá Nha Trang',
  'banh_bot_loc_hue': 'Bánh bột lọc Huế',
  'banh_beo_chen': 'Bánh bèo chén',
  'nem_lui_nuong': 'Nem lụi nướng',
  'banh_can_xiu_mai': 'Bánh căn xíu mại',
  'bun_sua_quy_nhon': 'Bún sứa Quy Nhơn',
  'com_tam_suon_bi_cha': 'Cơm tấm sườn bì chả',
  'banh_mi_thit_nuong': 'Bánh mì thịt nướng',
  'hu_tieu_nam_vang': 'Hủ tiếu Nam Vang',
  'goi_cuon_tom_thit': 'Gỏi cuốn tôm thịt',
  'bo_kho_banh_mi': 'Bò kho bánh mì',
  'com_ga_xoi_mo': 'Cơm gà xối mỡ',
  'com_bo_luc_lac': 'Cơm bò lúc lắc',
  'hu_tieu_my_tho': 'Hủ tiếu Mỹ Tho',
  'banh_canh_ghe': 'Bánh canh ghẹ',
  'banh_xeo_mien_tay': 'Bánh xèo miền Tây',
};

async function main() {
  const supabaseUrl = process.env.SUPABASE_URL!;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const bucketName = process.env.SUPABASE_STORAGE_BUCKET || 'dish-images';

  const supabase = createClient(supabaseUrl, supabaseKey);
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const prisma = new PrismaClient({ adapter });

  const brainDir = 'C:\\Users\\PC\\.gemini\\antigravity\\brain\\084088a0-83ad-45b9-b28c-a996f3c6d547';
  const files = fs.readdirSync(brainDir).filter((f) => f.endsWith('.jpg') || f.endsWith('.png'));

  console.log(`Tìm thấy ${files.length} ảnh trong thư mục brain:`, files);

  const dishes = await prisma.dish.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true }
  });

  let syncedCount = 0;

  for (const [prefix, dishName] of Object.entries(DISH_PREFIX_MAP)) {
    // Tìm file mới nhất có tiền tố tương ứng
    const matchingFiles = files
      .filter((f) => f.startsWith(prefix))
      .map((f) => ({
        name: f,
        path: path.join(brainDir, f),
        time: fs.statSync(path.join(brainDir, f)).mtimeMs
      }))
      .sort((a, b) => b.time - a.time);

    if (matchingFiles.length === 0) {
      console.log(`⏳ Chưa có ảnh cho: "${dishName}" (${prefix})`);
      continue;
    }

    const latestFile = matchingFiles[0];
    const dish = dishes.find((d) => d.name.toLowerCase().trim() === dishName.toLowerCase().trim());
    if (!dish) {
      console.warn(`⚠️ Không tìm thấy món trong DB: "${dishName}"`);
      continue;
    }

    const fileBuffer = fs.readFileSync(latestFile.path);
    const ext = path.extname(latestFile.path).replace('.', '') || 'jpg';
    const mimeType = ext === 'png' ? 'image/png' : 'image/jpeg';
    const storageKey = `dishes/${dish.id}/ai-photo-${Date.now()}.${ext}`;

    console.log(`📤 Đang tải lên Supabase [${dishName}]: ${latestFile.name} -> ${storageKey}`);
    const { error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(storageKey, fileBuffer, { contentType: mimeType, upsert: true });

    if (uploadError) {
      console.error(`❌ Lỗi upload Supabase cho ${dishName}: ${uploadError.message}`);
      continue;
    }

    const { data: publicUrlData } = supabase.storage.from(bucketName).getPublicUrl(storageKey);
    const publicUrl = publicUrlData.publicUrl;

    // Cập nhật dish_media
    await prisma.dishMedia.deleteMany({ where: { dishId: dish.id } });
    await prisma.dishMedia.create({
      data: {
        dishId: dish.id,
        type: 'IMAGE',
        storageKey,
        bucket: bucketName,
        mimeType,
        sizeBytes: fileBuffer.length,
        altText: `Hình ảnh món ${dish.name}`,
        credit: 'AI Generated Studio Culinary Photography by Mogu',
        sourceUrl: publicUrl,
        moderationStatus: 'APPROVED',
        isPrimary: true,
        sortOrder: 0,
      }
    });

    console.log(`✅ Đã cập nhật ảnh đẹp cho món "${dishName}": ${publicUrl}`);
    syncedCount++;
  }

  console.log(`\n======================================================`);
  console.log(`Tổng kết: Đã đồng bộ thành công ${syncedCount}/${Object.keys(DISH_PREFIX_MAP).length} món ăn!`);
  console.log(`======================================================\n`);

  await prisma.$disconnect();
}

main().catch(console.error);
