import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

interface DishPrompt {
  id: string;
  name: string;
  prefix: string;
  prompt: string;
}

async function main() {
  console.log('=== ĐỒNG BỘ ẢNH ĐẠI DIỆN 37 MÓN ĂN VÀO SUPABASE STORAGE & DATABASE ===\n');

  const supabaseUrl = process.env.SUPABASE_URL!;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const bucketName = process.env.SUPABASE_STORAGE_BUCKET || 'dish-images';

  const supabase = createClient(supabaseUrl, supabaseKey);
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const prisma = new PrismaClient({ adapter });

  const promptsPath = path.join(__dirname, 'missing-37-dish-prompts.json');
  const prompts: DishPrompt[] = JSON.parse(fs.readFileSync(promptsPath, 'utf8'));

  const brainDir = 'C:\\Users\\PC\\.gemini\\antigravity\\brain\\084088a0-83ad-45b9-b28c-a996f3c6d547';
  const allFiles = fs.readdirSync(brainDir).filter(f => f.endsWith('.jpg') || f.endsWith('.png'));

  console.log(`Tìm thấy ${allFiles.length} file ảnh trong thư mục brain.`);
  console.log(`Tổng số món cần đồng bộ: ${prompts.length}\n`);

  let synced = 0;
  let missing = 0;

  for (const item of prompts) {
    const matching = allFiles
      .filter(f => f.startsWith(item.prefix))
      .map(f => ({
        name: f,
        mtime: fs.statSync(path.join(brainDir, f)).mtimeMs,
      }))
      .sort((a, b) => b.mtime - a.mtime);

    if (matching.length === 0) {
      console.log(`⏳ [CHƯA CÓ FILE] "${item.name}" (prefix: ${item.prefix})`);
      missing++;
      continue;
    }

    const latestFile = matching[0].name;
    const filePath = path.join(brainDir, latestFile);
    const fileBuffer = fs.readFileSync(filePath);
    const storageKey = `dishes/${item.id}/${latestFile}`;

    // Upload lên Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(storageKey, fileBuffer, {
        contentType: 'image/jpeg',
        upsert: true,
      });

    if (uploadError) {
      console.error(`❌ Lỗi upload món "${item.name}":`, uploadError.message);
      continue;
    }

    // Đặt các ảnh cũ của món này thành isPrimary: false (nếu có)
    await prisma.dishMedia.updateMany({
      where: { dishId: item.id },
      data: { isPrimary: false },
    });

    // Thêm hoặc cập nhật bản ghi dish_media
    const existingMedia = await prisma.dishMedia.findFirst({
      where: { dishId: item.id, storageKey },
    });

    if (existingMedia) {
      await prisma.dishMedia.update({
        where: { id: existingMedia.id },
        data: {
          isPrimary: true,
          moderationStatus: 'APPROVED',
          altText: `Ảnh đại diện món ${item.name}`,
        },
      });
    } else {
      await prisma.dishMedia.create({
        data: {
          dishId: item.id,
          type: 'IMAGE',
          storageKey,
          bucket: bucketName,
          mimeType: 'image/jpeg',
          sizeBytes: fileBuffer.length,
          altText: `Ảnh đại diện món ${item.name}`,
          isPrimary: true,
          moderationStatus: 'APPROVED',
          sortOrder: 0,
        },
      });
    }

    console.log(`✅ [ĐÃ ĐỒNG BỘ] "${item.name}" -> ${storageKey}`);
    synced++;
  }

  console.log(`\n======================================================`);
  console.log(`TỔNG KẾT:`);
  console.log(`• Đã đồng bộ thành công: ${synced} / ${prompts.length}`);
  console.log(`• Còn thiếu file ảnh: ${missing} món`);
  console.log(`======================================================\n`);
}

main().finally(() => process.exit(0));
