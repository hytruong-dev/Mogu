import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

export async function uploadAndSetDishImage(dishId: string, imagePath: string, dishName: string) {
  const supabaseUrl = process.env.SUPABASE_URL!;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const bucketName = process.env.SUPABASE_STORAGE_BUCKET || 'dish-images';

  const supabase = createClient(supabaseUrl, supabaseKey);
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const prisma = new PrismaClient({ adapter });

  try {
    const fileBuffer = fs.readFileSync(imagePath);
    const ext = path.extname(imagePath).replace('.', '') || 'jpg';
    const mimeType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
    const storageKey = `dishes/${dishId}/ai-generated-${Date.now()}.${ext}`;

    console.log(`Uploading ${imagePath} to ${bucketName}/${storageKey}...`);
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(storageKey, fileBuffer, { contentType: mimeType, upsert: true });

    if (uploadError) {
      throw new Error(`Supabase upload failed: ${uploadError.message}`);
    }

    const { data: publicUrlData } = supabase.storage.from(bucketName).getPublicUrl(storageKey);
    const publicUrl = publicUrlData.publicUrl;
    console.log(`Uploaded! Public URL: ${publicUrl}`);

    // Update DishMedia
    await prisma.dishMedia.deleteMany({
      where: { dishId }
    });

    const media = await prisma.dishMedia.create({
      data: {
        dishId,
        type: 'IMAGE',
        storageKey,
        bucket: bucketName,
        mimeType,
        sizeBytes: fileBuffer.length,
        altText: `Hình ảnh món ${dishName}`,
        credit: 'AI Generated Photography by Mogu',
        sourceUrl: publicUrl,
        moderationStatus: 'APPROVED',
        isPrimary: true,
        sortOrder: 0,
      }
    });

    console.log(`Updated dish_media for "${dishName}" (${dishId}) -> Media ID: ${media.id}`);
    return { storageKey, publicUrl };
  } finally {
    await prisma.$disconnect();
  }
}

// Test with Com bo luc lac if run directly
if (require.main === module) {
  const testDishId = 'cbd3e927-b7f8-49c9-96d8-67a4330df1ff';
  const testPath = 'C:\\Users\\PC\\.gemini\\antigravity\\brain\\084088a0-83ad-45b9-b28c-a996f3c6d547\\com_bo_luc_lac_1792472428514.jpg';
  uploadAndSetDishImage(testDishId, testPath, 'Cơm bò lúc lắc')
    .then(() => console.log('Done test upload!'))
    .catch(console.error);
}
