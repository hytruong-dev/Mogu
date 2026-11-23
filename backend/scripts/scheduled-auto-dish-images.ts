import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { createClient } from '@supabase/supabase-js';
import pg from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import axios from 'axios';

dotenv.config({ path: path.join(__dirname, '../.env') });

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const bucketName = process.env.SUPABASE_STORAGE_BUCKET || 'dish-images';
const supabase = createClient(supabaseUrl, supabaseKey);

// Search directories for AI generated images
const BRAIN_BASE = 'C:\\Users\\PC\\.gemini\\antigravity\\brain';

function getBrainDirs(): string[] {
  const dirs: string[] = [];
  try {
    if (fs.existsSync(BRAIN_BASE)) {
      dirs.push(BRAIN_BASE);
      const subdirs = fs.readdirSync(BRAIN_BASE, { withFileTypes: true });
      for (const d of subdirs) {
        if (d.isDirectory()) {
          dirs.push(path.join(BRAIN_BASE, d.name));
        }
      }
    }
  } catch {}
  return dirs;
}

interface MissingDishPrompt {
  dishId: string;
  name: string;
  imageName: string;
  province?: string;
  prompt: string;
}

// Load metadata and prompts
function loadPrompts(): Map<string, MissingDishPrompt> {
  const promptMap = new Map<string, MissingDishPrompt>();
  const promptsFile = path.join(__dirname, '32-missing-ai-dishes.json');
  if (fs.existsSync(promptsFile)) {
    const list: MissingDishPrompt[] = JSON.parse(fs.readFileSync(promptsFile, 'utf8'));
    for (const item of list) {
      promptMap.set(item.dishId, item);
      promptMap.set(item.name.toLowerCase().trim(), item);
    }
  }
  return promptMap;
}

function findLocalImageFile(prefix: string): { fullPath: string; fileName: string; buffer: Buffer } | null {
  const allDirs = getBrainDirs();
  const allMatches: { fullPath: string; fileName: string; mtime: number }[] = [];

  for (const dir of allDirs) {
    if (!fs.existsSync(dir)) continue;
    try {
      const files = fs.readdirSync(dir);
      const matches = files
        .filter((f) => f.startsWith(prefix) && (f.endsWith('.jpg') || f.endsWith('.png')))
        .map((f) => ({
          fileName: f,
          fullPath: path.join(dir, f),
          mtime: fs.statSync(path.join(dir, f)).mtimeMs,
        }));
      allMatches.push(...matches);
    } catch {}
  }

  if (allMatches.length > 0) {
    allMatches.sort((a, b) => b.mtime - a.mtime);
    const best = allMatches[0];
    return {
      fullPath: best.fullPath,
      fileName: best.fileName,
      buffer: fs.readFileSync(best.fullPath),
    };
  }
  return null;
}

async function generateWithGemini(prompt: string, apiKey: string): Promise<{ buffer: Buffer; mimeType: string } | null> {
  const models = ['gemini-2.5-flash-image', 'gemini-3.1-flash-image'];
  for (const model of models) {
    try {
      console.log(`      -> Đang gọi Gemini API (${model})...`);
      const response = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseModalities: ['IMAGE'] },
        },
        { timeout: 35000 },
      );
      const part = response.data?.candidates?.[0]?.content?.parts?.[0];
      if (part?.inlineData?.data) {
        return {
          buffer: Buffer.from(part.inlineData.data, 'base64'),
          mimeType: part.inlineData.mimeType || 'image/jpeg',
        };
      }
    } catch (err: any) {
      const status = err.response?.status;
      const msg = err.response?.data?.error?.message || err.message;
      console.log(`      -> ${model} error (${status}): ${msg.slice(0, 100)}`);
      if (status === 429) break;
    }
  }
  return null;
}

async function main() {
  console.log(`======================================================================`);
  console.log(`⏰ [SCHEDULED RUN] KIỂM TRA & TỰ ĐỘNG CẬP NHẬT ẢNH AI CHO 10 MÓN ĂN`);
  console.log(`======================================================================\n`);

  const promptMap = loadPrompts();
  const geminiKey = process.env.GEMINI_IMAGE_API_KEY || process.env.GEMINI_API_KEY;

  // 1. Quét tất cả món ăn đang hoạt động trong DB
  const dishes = await prisma.dish.findMany({
    where: { deletedAt: null },
    include: {
      media: { where: { isPrimary: true } },
      province: true,
      region: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  const dishesMissingAi: typeof dishes = [];
  const dishesWithAi: typeof dishes = [];

  for (const d of dishes) {
    const m = d.media[0];
    const isMissingAi =
      !m ||
      m.sizeBytes === 0 ||
      !m.storageKey ||
      m.storageKey.includes('ai-cover-') ||
      m.storageKey.includes('placeholder') ||
      m.credit?.includes('Wikipedia') ||
      m.credit?.includes('Unsplash') ||
      !m.sourceUrl;

    if (isMissingAi) {
      dishesMissingAi.push(d);
    } else {
      dishesWithAi.push(d);
    }
  }

  console.log(`📊 Tổng số món ăn đang hoạt động: ${dishes.length}`);
  console.log(`✅ Đã có ảnh AI Studio chuẩn: ${dishesWithAi.length}`);
  console.log(`⏳ Còn thiếu ảnh AI chính thức: ${dishesMissingAi.length} món\n`);

  if (dishesMissingAi.length === 0) {
    console.log(`🎉 Tất cả ${dishes.length} món ăn đều đã có ảnh đại diện AI chính thức trên Supabase!`);
    return;
  }

  // 2. Chọn đợt 10 món để xử lý
  const batch10 = dishesMissingAi.slice(0, 10);
  console.log(`📋 Danh sách 10 món trong đợt kiểm tra và cập nhật này:`);
  batch10.forEach((d, idx) => {
    const pInfo = promptMap.get(d.id) || promptMap.get(d.name.toLowerCase().trim());
    console.log(`   ${idx + 1}. [${d.id}] "${d.name}" (${d.province?.name ?? d.region?.name ?? 'Việt Nam'}) - Prefix: ${pInfo?.imageName ?? 'n/a'}`);
  });

  console.log(`\n----------------------------------------------------------------------`);
  console.log(`🚀 BẮT ĐẦU QUY TRÌNH TẠO ẢNH AI & UPLOAD LÊN SUPABASE STORAGE`);
  console.log(`----------------------------------------------------------------------`);

  let successCount = 0;
  let skippedCount = 0;

  for (let i = 0; i < batch10.length; i++) {
    const dish = batch10[i];
    const indexStr = `[${i + 1}/${batch10.length}]`;
    const pInfo = promptMap.get(dish.id) || promptMap.get(dish.name.toLowerCase().trim());
    const prefix = pInfo?.imageName || dish.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "_");

    console.log(`\n${indexStr} Đang xử lý: "${dish.name}"...`);

    let imageBuffer: Buffer | null = null;
    let mimeType = 'image/jpeg';

    // Bước 1: Kiểm tra xem đã có ảnh AI trên đĩa chưa
    const localMatch = findLocalImageFile(prefix);
    if (localMatch) {
      console.log(`   📁 Tìm thấy file ảnh AI trên máy: ${localMatch.fileName} (${(localMatch.buffer.length / 1024).toFixed(1)} KB)`);
      imageBuffer = localMatch.buffer;
      if (localMatch.fileName.endsWith('.png')) mimeType = 'image/png';
    } else {
      // Bước 2: Thử gọi model AI Gemini nếu chưa có file cục bộ
      if (geminiKey && pInfo?.prompt) {
        console.log(`   🖌️ Gọi model AI tạo ảnh cho "${dish.name}"...`);
        const result = await generateWithGemini(pInfo.prompt, geminiKey);
        if (result) {
          imageBuffer = result.buffer;
          mimeType = result.mimeType;
          console.log(`   ✅ Model AI đã sinh ảnh thành công! (${(imageBuffer.length / 1024).toFixed(1)} KB)`);
          // Lưu vào brain dir
          const ext = mimeType === 'image/png' ? 'png' : 'jpg';
          const targetDir = getBrainDirs()[0] || BRAIN_BASE;
          const savedPath = path.join(targetDir, `${prefix}_${Date.now()}.${ext}`);
          fs.writeFileSync(savedPath, imageBuffer);
        }
      }
    }

    if (!imageBuffer) {
      console.log(`   ⏳ Chưa có ảnh AI cho "${dish.name}", chuyển sang món kế tiếp.`);
      skippedCount++;
      continue;
    }

    // Bước 3: Upload ảnh lên Supabase Storage bucket `dish-images`
    const ext = mimeType === 'image/png' ? 'png' : 'jpg';
    const storageKey = `dishes/${dish.id}/ai-photo-${Date.now()}.${ext}`;
    console.log(`   📤 Uploading lên Supabase Storage bucket "${bucketName}": ${storageKey}...`);

    const { error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(storageKey, imageBuffer, {
        contentType: mimeType,
        upsert: true,
      });

    if (uploadError) {
      console.error(`   ❌ Lỗi upload Supabase: ${uploadError.message}`);
      skippedCount++;
      continue;
    }

    const { data: publicUrlData } = supabase.storage.from(bucketName).getPublicUrl(storageKey);
    const publicUrl = publicUrlData.publicUrl;

    // Bước 4: Cập nhật cơ sở dữ liệu DishMedia
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

    console.log(`   ✅ Hoàn tất món "${dish.name}"!`);
    console.log(`      🔗 Public URL: ${publicUrl}`);
    console.log(`      📦 Kích thước: ${(imageBuffer.length / 1024).toFixed(1)} KB`);
    successCount++;
  }

  console.log(`\n======================================================================`);
  console.log(`📊 TỔNG KẾT ĐỢT CẬP NHẬT 10 MÓN ĂN:`);
  console.log(`- Thành công cập nhật & upload: ${successCount} món`);
  console.log(`- Bỏ qua / đang chờ sinh ảnh: ${skippedCount} món`);
  console.log(`- Số món còn lại cần xử lý trong hệ thống: ${dishesMissingAi.length - successCount} món`);
  console.log(`======================================================================\n`);
}

main()
  .catch((e) => {
    console.error('Fatal error in scheduled-auto-dish-images:', e);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
