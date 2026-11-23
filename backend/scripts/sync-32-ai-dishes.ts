import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import pg from 'pg';

interface DishPrompt {
  dishId: string;
  name: string;
  imageName: string;
  province: string;
  prompt: string;
}

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const bucketName = process.env.SUPABASE_STORAGE_BUCKET || 'dish-images';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });
const supabase = createClient(supabaseUrl, supabaseKey);

const ARTIFACT_DIR = 'C:\\Users\\PC\\.gemini\\antigravity\\brain\\084088a0-83ad-45b9-b28c-a996f3c6d547';
const PROMPTS_FILE = path.join(__dirname, '32-missing-ai-dishes.json');

async function main() {
  const dishes: DishPrompt[] = JSON.parse(fs.readFileSync(PROMPTS_FILE, 'utf-8'));
  const allFiles = fs.readdirSync(ARTIFACT_DIR);

  console.log(`=== SYNC 32 AI DISH IMAGES TO SUPABASE STORAGE ===`);
  console.log(`Tổng số món mục tiêu: ${dishes.length}`);

  let synced = 0;
  let missing = 0;

  for (const item of dishes) {
    const matchedFile = allFiles
      .filter(f => f.startsWith(item.imageName) && (f.endsWith('.jpg') || f.endsWith('.png')))
      .sort()
      .pop();

    if (matchedFile) {
      const fullPath = path.join(ARTIFACT_DIR, matchedFile);
      const fileBuffer = fs.readFileSync(fullPath);
      const ext = path.extname(matchedFile).replace('.', '') || 'jpg';
      const mimeType = ext === 'png' ? 'image/png' : 'image/jpeg';
      const storageKey = `dishes/${item.dishId}/ai-photo-${Date.now()}.${ext}`;

      try {
        console.log(`Uploading [${item.name}] (${matchedFile}) -> ${storageKey}...`);
        const { error: uploadError } = await supabase.storage
          .from(bucketName)
          .upload(storageKey, fileBuffer, { contentType: mimeType, upsert: true });

        if (uploadError) {
          throw new Error(`Upload error: ${uploadError.message}`);
        }

        const { data: publicUrlData } = supabase.storage.from(bucketName).getPublicUrl(storageKey);
        const publicUrl = publicUrlData.publicUrl;

        // Upsert or replace primary media
        await prisma.dishMedia.deleteMany({
          where: { dishId: item.dishId },
        });

        await prisma.dishMedia.create({
          data: {
            dishId: item.dishId,
            type: 'IMAGE',
            storageKey,
            bucket: bucketName,
            mimeType,
            sizeBytes: fileBuffer.length,
            altText: `Hình ảnh món ${item.name}`,
            credit: 'AI Generated Studio Culinary Photography by Mogu',
            sourceUrl: publicUrl,
            moderationStatus: 'APPROVED',
            isPrimary: true,
            sortOrder: 0,
          },
        });

        console.log(`✅ Thành công: [${item.name}] -> ${publicUrl} (${fileBuffer.length} bytes)`);
        synced++;
      } catch (err: any) {
        console.error(`❌ Lỗi cập nhật [${item.name}]:`, err.message);
      }
    } else {
      console.log(`⏳ Chưa có ảnh trên đĩa cho [${item.name}] (${item.imageName})`);
      missing++;
    }
  }

  console.log(`\nTổng kết: Đã đồng bộ ${synced} món, Còn thiếu ${missing} món.`);
}

main().finally(async () => {
  await prisma.$disconnect();
  await pool.end();
  process.exit(0);
});
