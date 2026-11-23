import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import pg from 'pg';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const bucketName = process.env.SUPABASE_STORAGE_BUCKET || 'dish-images';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });
const supabase = createClient(supabaseUrl, supabaseKey);

export async function uploadAndSetStepImage(
  stepId: string,
  dishId: string,
  stepOrder: number,
  imagePath: string,
): Promise<string> {
  if (!fs.existsSync(imagePath)) {
    throw new Error(`File not found: ${imagePath}`);
  }

  const fileBuffer = fs.readFileSync(imagePath);
  const ext = path.extname(imagePath).replace('.', '') || 'jpg';
  const mimeType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
  const storageKey = `dishes/${dishId}/steps/step-${stepOrder}-${Date.now()}.${ext}`;

  console.log(`Uploading step image to ${bucketName}/${storageKey}...`);
  const { error: uploadError } = await supabase.storage
    .from(bucketName)
    .upload(storageKey, fileBuffer, { contentType: mimeType, upsert: true });

  if (uploadError) {
    throw new Error(`Supabase upload failed: ${uploadError.message}`);
  }

  const { data: publicUrlData } = supabase.storage.from(bucketName).getPublicUrl(storageKey);
  const publicUrl = publicUrlData.publicUrl;

  await prisma.recipeStep.update({
    where: { id: stepId },
    data: { imageUrl: publicUrl },
  });

  console.log(`Updated RecipeStep [${stepId}] (step ${stepOrder}) -> ${publicUrl}`);
  return publicUrl;
}
