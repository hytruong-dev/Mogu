/**
 * generate-dish-images-worker.ts
 *
 * Tự động tạo ảnh AI ẩm thực chuẩn Studio (phong cách Hình 1) cho danh sách món ăn
 * và tự động upload lên Supabase Storage bucket `dish-images`.
 *
 * Chạy: cd backend; npx ts-node -T -r tsconfig-paths/register scripts/generate-dish-images-worker.ts
 */
import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const BRAIN_DIR = 'C:\\Users\\PC\\.gemini\\antigravity\\brain\\084088a0-83ad-45b9-b28c-a996f3c6d547';

interface DishPrompt {
  prefix: string;
  name: string;
  prompt: string;
}

async function main() {
  const supabaseUrl = process.env.SUPABASE_URL!;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const bucketName = process.env.SUPABASE_STORAGE_BUCKET || 'dish-images';

  const supabase = createClient(supabaseUrl, supabaseKey);
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

  const openaiKey = process.env.OPENAI_API_KEY;
  const geminiKey = process.env.GEMINI_IMAGE_API_KEY || process.env.GEMINI_API_KEY;

  const openai = openaiKey && openaiKey.startsWith('sk-') ? new OpenAI({ apiKey: openaiKey }) : null;

  // Đọc danh sách prompt của 30 món mới
  const newDishesFile = path.join(__dirname, 'new-30-dishes-image-prompts.json');
  const remainingFile = path.join(__dirname, 'remaining-16-image-prompts.json');

  const allPrompts: DishPrompt[] = [];
  if (fs.existsSync(newDishesFile)) {
    allPrompts.push(...JSON.parse(fs.readFileSync(newDishesFile, 'utf-8')));
  }
  if (fs.existsSync(remainingFile)) {
    const rem: DishPrompt[] = JSON.parse(fs.readFileSync(remainingFile, 'utf-8'));
    for (const r of rem) {
      if (!allPrompts.some((p) => p.prefix === r.prefix)) {
        allPrompts.push(r);
      }
    }
  }

  console.log(`\n======================================================`);
  console.log(`🎨 WORKER SINH ẢNH AI ẨM THỰC CHUẨN STUDIO (MOGU)`);
  console.log(`======================================================`);
  console.log(`Tổng số món cần kiểm tra ảnh: ${allPrompts.length}`);
  console.log(`• OpenAI DALL-E 3: ${openai ? 'SẴN SÀNG' : 'CHƯA CÓ KEY'}`);
  console.log(`• Google Gemini/Imagen: ${geminiKey ? 'CÓ KEY' : 'CHƯA CÓ KEY'}`);

  const existingFiles = fs.readdirSync(BRAIN_DIR).filter((f) => f.endsWith('.jpg') || f.endsWith('.png'));

  const dishesInDb = await prisma.dish.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true, media: { select: { isPrimary: true, credit: true, sourceUrl: true } } },
  });

  let generatedCount = 0;
  let alreadyHasAiCount = 0;

  for (let i = 0; i < allPrompts.length; i++) {
    const item = allPrompts[i];
    const indexStr = `[${i + 1}/${allPrompts.length}]`;
    const dish = dishesInDb.find((d) => d.name.toLowerCase().trim() === item.name.toLowerCase().trim());

    if (!dish) {
      console.log(`${indexStr} ⚠️ Món "${item.name}" chưa có trong Database, bỏ qua.`);
      continue;
    }

    const hasAiMediaInDb = dish.media.some((m) => m.isPrimary && (m.credit?.includes('AI') || m.sourceUrl?.includes('ai-photo')));
    if (hasAiMediaInDb) {
      alreadyHasAiCount++;
      continue;
    }

    // Kiểm tra xem trong brain dir đã có ảnh chưa
    const localFile = existingFiles.find((f) => f.startsWith(item.prefix));
    let imageBuffer: Buffer | null = null;
    let mimeType = 'image/jpeg';

    if (localFile) {
      console.log(`${indexStr} 📁 Đã có file cục bộ cho "${item.name}": ${localFile}`);
      imageBuffer = fs.readFileSync(path.join(BRAIN_DIR, localFile));
    } else {
      // Cần sinh ảnh mới
      console.log(`\n${indexStr} 🖌️ Đang sinh ảnh AI cho món: "${item.name}"...`);

      // 1. Thử OpenAI DALL-E 3 nếu có
      if (openai) {
        try {
          console.log(`   -> Đang gọi DALL-E 3...`);
          const dRes = await openai.images.generate({
            model: 'dall-e-3',
            prompt: item.prompt,
            n: 1,
            size: '1024x1024',
            quality: 'standard',
          });
          const imgUrl = dRes.data?.[0]?.url;
          if (imgUrl) {
            const download = await axios.get(imgUrl, { responseType: 'arraybuffer' });
            imageBuffer = Buffer.from(download.data);
            mimeType = 'image/png';
            console.log(`   -> ✅ DALL-E 3 sinh ảnh thành công!`);
          }
        } catch (e: any) {
          console.log(`   -> DALL-E 3 lỗi: ${e.message}`);
        }
      }

      // 2. Thử Google Gemini Image nếu có key và chưa sinh được
      if (!imageBuffer && geminiKey) {
        const geminiModels = ['gemini-3.1-flash-image', 'gemini-2.5-flash-image'];
        for (const model of geminiModels) {
          try {
            console.log(`   -> Đang gọi Google Gemini (${model})...`);
            const gRes = await axios.post(
              `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`,
              {
                contents: [{ parts: [{ text: item.prompt }] }],
                generationConfig: { responseModalities: ['IMAGE'] },
              },
              { timeout: 35000 },
            );
            const part = gRes.data?.candidates?.[0]?.content?.parts?.[0];
            if (part?.inlineData?.data) {
              imageBuffer = Buffer.from(part.inlineData.data, 'base64');
              mimeType = part.inlineData.mimeType || 'image/jpeg';
              console.log(`   -> ✅ Google ${model} sinh ảnh thành công!`);
              break;
            }
          } catch (e: any) {
            const errStatus = e.response?.status;
            const errMsg = e.response?.data?.error?.message || e.message;
            console.log(`   -> ${model} (${errStatus}): ${errMsg.slice(0, 80)}...`);
            if (errStatus === 429) {
              break; // Đang cạn hạn mức, dừng thử model khác để tránh spam
            }
          }
        }
      }

      if (!imageBuffer) {
        console.log(`   ⏳ Chưa thể sinh ảnh cho "${item.name}" (chờ reset quota hoặc thêm key).`);
        continue;
      }

      // Lưu vào brain dir
      const ext = mimeType === 'image/png' ? 'png' : 'jpg';
      const localSavedName = `${item.prefix}_${Date.now()}.${ext}`;
      fs.writeFileSync(path.join(BRAIN_DIR, localSavedName), imageBuffer);
      console.log(`   💾 Đã lưu file cục bộ: ${localSavedName}`);
    }

    // Tải lên Supabase Storage và cập nhật DB
    const ext = mimeType === 'image/png' ? 'png' : 'jpg';
    const storageKey = `dishes/${dish.id}/ai-photo-${Date.now()}.${ext}`;
    console.log(`   📤 Uploading lên Supabase Storage: ${storageKey}...`);

    const { error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(storageKey, imageBuffer, { contentType: mimeType, upsert: true });

    if (uploadError) {
      console.error(`   ❌ Lỗi upload Supabase: ${uploadError.message}`);
      continue;
    }

    const { data: publicUrlData } = supabase.storage.from(bucketName).getPublicUrl(storageKey);
    const publicUrl = publicUrlData.publicUrl;

    await prisma.dishMedia.deleteMany({ where: { dishId: dish.id } });
    await prisma.dishMedia.create({
      data: {
        dishId: dish.id,
        type: 'IMAGE',
        storageKey,
        bucket: bucketName,
        mimeType,
        sizeBytes: imageBuffer.length,
        altText: `Hình ảnh món ${dish.name}`,
        credit: 'AI Generated Studio Culinary Photography by Mogu',
        sourceUrl: publicUrl,
        moderationStatus: 'APPROVED',
        isPrimary: true,
        sortOrder: 0,
      },
    });

    console.log(`   ✅ Đã cập nhật ảnh đẹp cho món "${dish.name}": ${publicUrl}`);
    generatedCount++;
  }

  console.log(`\n======================================================`);
  console.log(`Tổng kết Worker:`);
  console.log(`- Đã có sẵn ảnh AI từ trước: ${alreadyHasAiCount}`);
  console.log(`- Mới tạo & đồng bộ thành công: ${generatedCount}`);
  console.log(`======================================================\n`);

  await prisma.$disconnect();
}

main().catch(console.error);
