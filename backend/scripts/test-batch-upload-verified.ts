import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

async function downloadImage(url: string): Promise<{ buffer: Buffer; contentType: string } | null> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
      },
    });
    if (!res.ok) return null;
    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const contentType = res.headers.get('content-type') || 'image/jpeg';
    if (buffer.length < 3000) return null; // Reject tiny or error HTML
    return { buffer, contentType: contentType.split(';')[0].trim() };
  } catch {
    return null;
  }
}

async function uploadToSupabase(code: string, buffer: Buffer, contentType: string): Promise<string | null> {
  const ext = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg';
  const filePath = `${code}.${ext}`;

  const { data, error } = await supabase.storage
    .from('ingredient-images')
    .upload(filePath, buffer, { contentType, upsert: true });

  if (error) {
    console.error(`Upload error for ${code}:`, error.message);
    return null;
  }

  return `${process.env.SUPABASE_URL}/storage/v1/object/public/ingredient-images/${filePath}`;
}

async function run() {
  const testItems = [
    {
      code: 'dau-phu-ran-vang-h6kub',
      name: 'Đậu phụ rán vàng',
      url: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/1/1d/Tahu_digoreng.JPG/960px-Tahu_digoreng.JPG',
    },
    {
      code: 'dau-phong-rang-lac-rang-tx3n7',
      name: 'Đậu phộng rang (Lạc rang)',
      url: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/1/12/Fried_groundnuts.jpg/960px-Fried_groundnuts.jpg',
    },
    {
      code: 'thit-xa-xiu-ikscz',
      name: 'Thịt xá xíu',
      url: 'https://upload.wikimedia.org/wikipedia/commons/9/95/Charsiu.jpg',
    },
    {
      code: 'do-chua-ie01z',
      name: 'Đồ chua',
      url: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/f/f6/%C4%90%E1%BB%93_chua.jpg/960px-%C4%90%E1%BB%93_chua.jpg',
    },
    {
      code: 'mo-hanh-la-liv0t',
      name: 'Mỡ hành lá',
      url: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/1/1e/M%E1%BB%A1_h%C3%A0nh.jpg/960px-M%E1%BB%A1_h%C3%A0nh.jpg',
    },
  ];

  for (const item of testItems) {
    console.log(`\nProcessing: "${item.name}" [${item.code}]`);
    const dl = await downloadImage(item.url);
    if (!dl) {
      console.log(`❌ Download failed for ${item.url}`);
      continue;
    }
    console.log(`  Downloaded: ${dl.buffer.length} bytes, type: ${dl.contentType}`);
    const publicUrl = await uploadToSupabase(item.code, dl.buffer, dl.contentType);
    if (publicUrl) {
      await prisma.ingredient.update({
        where: { code: item.code },
        data: { imageUrl: publicUrl, imageStatus: 'PENDING_REVIEW' },
      });
      console.log(`  ✅ Uploaded & DB updated: ${publicUrl}`);
    }
  }

  await prisma.$disconnect();
}

run();
