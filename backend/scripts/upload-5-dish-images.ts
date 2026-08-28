import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import * as fs from 'fs';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter } as any);

const BUCKET = 'dish-images';

// Map: tên món → file ảnh (theo thứ tự user gửi)
const imageMap: Array<{ dishName: string; imagePath: string }> = [
  {
    dishName: 'Bún bò Huế',
    imagePath:
      'C:\\Users\\PC\\.cursor\\projects\\c-QuangHy-Mogu\\assets\\c__Users_PC_AppData_Roaming_Cursor_User_workspaceStorage_2af69c43e8ba1804c32d01b410638ec6_images_image-181ab09a-3f26-466b-96dd-63220251a483-1aa2f44b-85e9-4687-b8cc-961fdcd7dfcf.png',
  },
  {
    dishName: 'Phở bò',
    imagePath:
      'C:\\Users\\PC\\.cursor\\projects\\c-QuangHy-Mogu\\assets\\c__Users_PC_AppData_Roaming_Cursor_User_workspaceStorage_2af69c43e8ba1804c32d01b410638ec6_images_image-08777d11-c5f3-4baf-9caf-6fc4f0a1f518.png',
  },
  {
    dishName: 'Cơm chiên Dương Châu',
    imagePath:
      'C:\\Users\\PC\\.cursor\\projects\\c-QuangHy-Mogu\\assets\\c__Users_PC_AppData_Roaming_Cursor_User_workspaceStorage_2af69c43e8ba1804c32d01b410638ec6_images_image-e9c94b11-1dd0-45ed-9d4a-68ba95b93e75.png',
  },
  {
    dishName: 'Mì xào bò rau cải',
    imagePath:
      'C:\\Users\\PC\\.cursor\\projects\\c-QuangHy-Mogu\\assets\\c__Users_PC_AppData_Roaming_Cursor_User_workspaceStorage_2af69c43e8ba1804c32d01b410638ec6_images_image-b63533f2-4f20-4db3-9a82-522d2d8c7d06.png',
  },
  {
    dishName: 'Bánh canh giò heo tôm',
    imagePath:
      'C:\\Users\\PC\\.cursor\\projects\\c-QuangHy-Mogu\\assets\\c__Users_PC_AppData_Roaming_Cursor_User_workspaceStorage_2af69c43e8ba1804c32d01b410638ec6_images_image-b10e0665-4233-4122-ad98-2d815a2d4c8d.png',
  },
];

async function main() {
  for (const item of imageMap) {
    // Tìm dish
    const dish = await prisma.dish.findFirst({ where: { name: item.dishName } });
    if (!dish) {
      console.log(`❌ Không tìm thấy dish: ${item.dishName}`);
      continue;
    }

    // Đọc file
    const fileBuffer = fs.readFileSync(item.imagePath);
    const fileSizeBytes = fileBuffer.length;
    const ext = path.extname(item.imagePath).replace('.', '');
    const storageKey = `dishes/${dish.id}/cover.${ext}`;
    const mimeType = 'image/png';

    console.log(`⬆️  Uploading "${item.dishName}" → ${storageKey}`);

    // Upload lên Supabase Storage
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(storageKey, fileBuffer, {
        contentType: mimeType,
        upsert: true,
      });

    if (error) {
      console.error(`   ❌ Upload lỗi:`, error.message);
      continue;
    }

    // Lấy public URL
    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(storageKey);
    const publicUrl = urlData.publicUrl;
    console.log(`   ✅ URL: ${publicUrl}`);

    // Kiểm tra đã có DishMedia chưa
    const existing = await prisma.dishMedia.findFirst({ where: { dishId: dish.id } });
    if (existing) {
      console.log(`   ⚠️  Đã có media → cập nhật`);
      await prisma.dishMedia.update({
        where: { id: existing.id },
        data: { storageKey, bucket: BUCKET, mimeType, isPrimary: true, moderationStatus: 'APPROVED' },
      });
    } else {
      await prisma.dishMedia.create({
        data: {
          dishId: dish.id,
          type: 'IMAGE',
          storageKey,
          bucket: BUCKET,
          mimeType,
          sizeBytes: fileSizeBytes,
          isPrimary: true,
          moderationStatus: 'APPROVED',
        },
      });
      console.log(`   📸 Đã lưu DishMedia`);
    }
  }

  await prisma.$disconnect();
  console.log('\n🎉 Upload ảnh xong!');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
