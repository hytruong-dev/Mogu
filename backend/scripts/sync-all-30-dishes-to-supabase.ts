import 'dotenv/config';
import axios from 'axios';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const EXTERNAL_DISH_IMAGES: Record<string, { url: string; credit: string; altText: string }> = {
  'Bún chả Hà Nội': {
    url: 'https://upload.wikimedia.org/wikipedia/commons/b/b7/B%C3%BAn_ch%E1%BA%A3_H%C3%A0_N%E1%BB%99i_%28th%E1%BB%8Bt_n%C6%B0%E1%BB%9Bng%29_t%E1%BA%A1i_Nguy%E1%BB%85n_S%C6%A1n%2C_T%C3%A2n_Ph%C3%BA_%282%29.jpg',
    credit: 'Wikimedia Commons / Phương Huy',
    altText: 'Bún chả Hà Nội truyền thống với thịt nướng than hoa, bún tươi và nước chấm chua ngọt',
  },
  'Bún đậu mắm tôm': {
    url: 'https://upload.wikimedia.org/wikipedia/commons/5/5a/B%C3%BAn_%C4%91%E1%BA%ADu_m%E1%BA%AFm_t%C3%B4m.jpg',
    credit: 'Wikimedia Commons',
    altText: 'Mẹt bún đậu mắm tôm thập cẩm với đậu mơ rán giòn, chả cốm, thịt luộc và mắm tôm',
  },
  'Chả cá Lã Vọng': {
    url: 'https://upload.wikimedia.org/wikipedia/commons/2/2f/Ch%E1%BA%A3_c%C3%A1_L%C3%A3_V%E1%BB%8Dng.jpg',
    credit: 'Wikimedia Commons / Kirk K',
    altText: 'Chả cá Lã Vọng xèo xèo trên chảo cùng thì là, hành hoa, ăn kèm bún và lạc rang',
  },
  'Bún ốc Hà Nội': {
    url: 'https://upload.wikimedia.org/wikipedia/commons/a/a7/Bun_oc_Hoe_Nhai.JPG',
    credit: 'Wikimedia Commons / Bún ốc Hòe Nhai',
    altText: 'Bát bún ốc nóng hổi chua thanh vị giấm bỗng với ốc nhồi giòn sần sật và đậu phụ',
  },
  'Mì Quảng tôm thịt': {
    url: 'https://upload.wikimedia.org/wikipedia/commons/d/df/Mi_Quang_1A_Danang.jpg',
    credit: 'Wikimedia Commons / Mì Quảng 1A Đà Nẵng',
    altText: 'Tô mì Quảng tôm thịt đậm đà màu nghệ với tôm, thịt ba chỉ, bánh tráng nướng mè giòn rụm',
  },
  'Cơm gà Hội An': {
    url: 'https://upload.wikimedia.org/wikipedia/commons/c/c5/Com_ga_Viet_Nam_voi_ga_luoc_com_vang_va_nuoc_cham.jpg',
    credit: 'Wikimedia Commons',
    altText: 'Đĩa cơm gà Hội An hạt cơm vàng ươm, thịt gà ta xé phay bóp rau răm hành tây thơm lừng',
  },
  'Cao lầu Hội An': {
    url: 'https://upload.wikimedia.org/wikipedia/commons/4/45/Cao_l%E1%BA%A7u_H%E1%BB%99i_An.jpg',
    credit: 'Wikimedia Commons',
    altText: 'Bát cao lầu Hội An sợi bánh dai giòn đặc trưng, thịt xá xíu đậm vị và tóp mỡ giòn rụm',
  },
  'Bún chả cá Nha Trang': {
    url: 'https://upload.wikimedia.org/wikipedia/commons/6/6a/Bun_cha_ca.jpg',
    credit: 'Wikimedia Commons',
    altText: 'Tô bún chả cá Nha Trang nước dùng trong ngọt thanh từ xương cá cờ, chả cá thu chiên vàng hấp dẫn',
  },
  'Bánh bột lọc Huế': {
    url: 'https://upload.wikimedia.org/wikipedia/commons/2/28/Banh_bot_loc_hue.jpg',
    credit: 'Wikimedia Commons / Bánh bột lọc Huế',
    altText: 'Đĩa bánh bột lọc Huế vỏ trong veo thấy rõ nhân tôm đỏ au và thịt ba chỉ, chan mỡ hành ớt cay',
  },
  'Bánh căn xíu mại': {
    url: 'https://upload.wikimedia.org/wikipedia/commons/a/a3/B%C3%A1nh_c%C4%83n_1.jpg',
    credit: 'Wikimedia Commons',
    altText: 'Dĩa bánh căn nóng hổi giòn rụm chấm chén xíu mại đậm đà ngập mỡ hành và xoài xanh',
  },
  'Cơm tấm sườn bì chả': {
    url: 'https://upload.wikimedia.org/wikipedia/commons/8/81/C%C6%A1m_t%E1%BA%A5m_s%C6%B0%E1%BB%9Dn_b%C3%AC_ch%E1%BA%A3.jpg',
    credit: 'Wikimedia Commons / Cơm tấm Sài Gòn',
    altText: 'Đĩa cơm tấm sườn nướng than hoa thơm lừng, bì sợi dai bùi, chả trứng hấp vàng óng và mỡ hành',
  },
  'Bánh mì thịt nướng': {
    url: 'https://upload.wikimedia.org/wikipedia/commons/0/0c/B%C3%A1nh_m%C3%AC_th%E1%BB%8Bt_n%C6%B0%E1%BB%9Bng.png',
    credit: 'Wikimedia Commons',
    altText: 'Ổ bánh mì kẹp thịt nướng sả thơm phức, đồ chua, dưa leo giòn rụm và sốt tương đậm đà',
  },
  'Hủ tiếu Nam Vang': {
    url: 'https://upload.wikimedia.org/wikipedia/commons/c/c9/Hu-Tieu-Kho-2008.jpg',
    credit: 'Wikimedia Commons',
    altText: 'Tô hủ tiếu Nam Vang khô trộn sốt đậm đà, tôm tươi luộc, thịt nạc, thịt bằm và tỏi phi thơm nức',
  },
  'Gỏi cuốn tôm thịt': {
    url: 'https://upload.wikimedia.org/wikipedia/commons/0/03/Summer_roll.jpg',
    credit: 'Wikimedia Commons / Summer roll',
    altText: 'Đĩa gỏi cuốn tôm thịt thanh mát cuốn bánh tráng mỏng, tôm đỏ tươi, bún và rau thơm chấm tương đậu phộng',
  },
  'Bò kho bánh mì': {
    url: 'https://upload.wikimedia.org/wikipedia/commons/2/2b/Bo_Kho.jpg',
    credit: 'Wikimedia Commons',
    altText: 'Tô bò kho đậm đà màu nâu đỏ sóng sánh, nạm bò mềm ngậy thơm nồng sả hoa hồi ăn kèm bánh mì nóng',
  },
  'Bánh xèo miền Tây': {
    url: 'https://upload.wikimedia.org/wikipedia/commons/e/e5/B%C3%A1nh_x%C3%A8o_1.jpg',
    credit: 'Wikimedia Commons',
    altText: 'Bánh xèo miền Tây vành mỏng vàng ươm giòn tan đầy ắp nhân tôm đất, thịt heo, giá đỗ và rau rừng',
  },
};

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchImageWithRetry(url: string, retries = 3): Promise<{ buffer: Buffer; mimeType: string }> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await axios.get(url, {
        responseType: 'arraybuffer',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 MoguFoodBot/1.0',
          'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
          'Referer': 'https://commons.wikimedia.org/',
        },
        timeout: 15000,
      });

      const contentType = response.headers['content-type'] || 'image/jpeg';
      const buffer = Buffer.from(response.data);
      return { buffer, mimeType: contentType.split(';')[0].trim() };
    } catch (err: any) {
      console.warn(`  [Lần thử ${attempt}/${retries}] Lỗi tải ảnh ${url}: ${err.message}`);
      if (attempt === retries) throw err;
      await sleep(2500 * attempt);
    }
  }
  throw new Error(`Không thể tải ảnh sau ${retries} lần thử: ${url}`);
}

async function main() {
  const supabaseUrl = process.env.SUPABASE_URL!;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const bucketName = process.env.SUPABASE_STORAGE_BUCKET || 'dish-images';

  const supabase = createClient(supabaseUrl, supabaseKey);
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const prisma = new PrismaClient({ adapter });

  console.log(`Bắt đầu đồng bộ hóa toàn bộ ảnh món ăn vào Supabase Storage...`);

  const dishes = await prisma.dish.findMany({
    where: { deletedAt: null },
    include: { media: { where: { isPrimary: true } } },
  });

  let updatedCount = 0;

  for (const [dishName, meta] of Object.entries(EXTERNAL_DISH_IMAGES)) {
    const dish = dishes.find((d) => d.name.toLowerCase().trim() === dishName.toLowerCase().trim());
    if (!dish) {
      console.warn(`⚠️ Không tìm thấy món trong cơ sở dữ liệu: "${dishName}"`);
      continue;
    }

    const currentPrimary = dish.media[0];
    if (currentPrimary && currentPrimary.sourceUrl?.includes('supabase.co') && !currentPrimary.sourceUrl?.includes('external')) {
      console.log(`⏩ Món "${dishName}" đã có ảnh Supabase Storage hợp lệ: ${currentPrimary.sourceUrl}`);
      continue;
    }

    console.log(`\n📥 [${dishName}] Đang tải ảnh từ nguồn chất lượng: ${meta.url}`);
    try {
      const { buffer, mimeType } = await fetchImageWithRetry(meta.url);
      const ext = mimeType.includes('png') ? 'png' : mimeType.includes('webp') ? 'webp' : 'jpg';
      const storageKey = `dishes/${dish.id}/authentic-${Date.now()}.${ext}`;

      console.log(`📤 Đang đẩy lên Supabase Storage: ${storageKey} (${(buffer.length / 1024).toFixed(1)} KB)`);
      const { error: uploadError } = await supabase.storage
        .from(bucketName)
        .upload(storageKey, buffer, { contentType: mimeType, upsert: true });

      if (uploadError) {
        throw new Error(`Lỗi tải lên Supabase: ${uploadError.message}`);
      }

      const { data: publicUrlData } = supabase.storage.from(bucketName).getPublicUrl(storageKey);
      const publicUrl = publicUrlData.publicUrl;

      // Xóa media cũ và ghi media chuẩn vào dish_media
      await prisma.dishMedia.deleteMany({ where: { dishId: dish.id } });
      await prisma.dishMedia.create({
        data: {
          dishId: dish.id,
          type: 'IMAGE',
          storageKey,
          bucket: bucketName,
          mimeType,
          sizeBytes: buffer.length,
          altText: meta.altText,
          credit: meta.credit,
          sourceUrl: publicUrl,
          moderationStatus: 'APPROVED',
          isPrimary: true,
          sortOrder: 0,
        },
      });

      console.log(`✅ Thành công cập nhật món "${dishName}" -> ${publicUrl}`);
      updatedCount++;

      // Nghỉ nhẹ 1.5s giữa các request để tránh rate-limit
      await sleep(1500);
    } catch (err: any) {
      console.error(`❌ Lỗi xử lý món "${dishName}": ${err.message}`);
    }
  }

  console.log(`\n======================================================`);
  console.log(`Tổng kết: Đã đồng bộ thành công ${updatedCount} món ăn lên Supabase Storage!`);
  console.log(`======================================================\n`);

  await prisma.$disconnect();
}

main().catch(console.error);
