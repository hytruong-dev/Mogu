/**
 * fix-bad-links.ts
 * 
 * Fix các DishIngredient bị link sai vào Ingredient "Cá"
 * khi tên thực sự là "Mì cao lầu", "Hành lá", "2 cây Hành lá"
 */
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import * as https from 'https';
import * as http from 'http';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env.local') });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as any);
const db = (prisma as any);

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!;
const UNSPLASH_KEY = process.env.UNSPLASH_ACCESS_KEY;

async function fetchJson(url: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, {
      headers: { 'User-Agent': 'MoguBot/1.0', 'Accept-Language': 'vi,en;q=0.9' }
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { reject(new Error(`JSON parse: ${data.substring(0, 100)}`)); }
      });
    });
    req.on('error', reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

async function fetchBuffer(url: string): Promise<Buffer | null> {
  return new Promise((resolve) => {
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, { headers: { 'User-Agent': 'MoguBot/1.0' } }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        fetchBuffer(res.headers.location!).then(resolve); return;
      }
      const chunks: Buffer[] = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    });
    req.on('error', () => resolve(null));
    req.setTimeout(15000, () => { req.destroy(); resolve(null); });
  });
}

async function uploadToSupabase(imgBuffer: Buffer, ingredientId: string, mimeType = 'image/jpeg'): Promise<string | null> {
  const ext = mimeType === 'image/png' ? 'png' : 'jpg';
  const storagePath = `${ingredientId}/cover.${ext}`;
  const uploadUrl = `${SUPABASE_URL}/storage/v1/object/ingredient-images/${storagePath}`;

  return new Promise((resolve) => {
    const urlObj = new URL(uploadUrl);
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': mimeType,
        'Content-Length': imgBuffer.length,
        'x-upsert': 'true',
      },
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (c) => data += c);
      res.on('end', () => {
        if (res.statusCode === 200 || res.statusCode === 201) {
          resolve(`${SUPABASE_URL}/storage/v1/object/public/ingredient-images/${storagePath}`);
        } else {
          resolve(null);
        }
      });
    });
    req.on('error', () => resolve(null));
    req.write(imgBuffer);
    req.end();
  });
}

async function searchUnsplash(query: string): Promise<string | null> {
  if (!UNSPLASH_KEY) return null;
  try {
    const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=3&client_id=${UNSPLASH_KEY}`;
    const data = await fetchJson(url);
    return data.results?.[0]?.urls?.regular ?? null;
  } catch { return null; }
}

async function searchWikipedia(query: string, lang = 'en'): Promise<string | null> {
  try {
    const url = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`;
    const data = await fetchJson(url);
    return data.thumbnail?.source ?? null;
  } catch { return null; }
}

async function findImageAndUpload(ingredientId: string, name: string, queries: string[]): Promise<string | null> {
  for (const q of queries) {
    const url = await searchUnsplash(q);
    if (url) {
      const buf = await fetchBuffer(url);
      if (buf) {
        const supaUrl = await uploadToSupabase(buf, ingredientId);
        if (supaUrl) return supaUrl;
      }
      return url; // fallback external URL
    }
  }
  // Try Wikipedia
  for (const q of queries) {
    const url = await searchWikipedia(q, 'en') ?? await searchWikipedia(q, 'vi');
    if (url) return url;
  }
  return null;
}

async function main() {
  console.log('🔧 Fixing bad DishIngredient links...\n');

  // Các fixes cần thực hiện
  const fixes = [
    // Mì cao lầu → tạo ingredient mới
    {
      rawTextPattern: 'Mì cao lầu',
      correctName: 'Mì cao lầu',
      imageQueries: ['cao lau noodles Hoi An Vietnam', 'Vietnamese thick wheat noodles yellow'],
      wikiQuery: 'Cao lầu',
    },
    // Hành lá (2 cây...) → link đến "Hành lá" đúng
    {
      rawTextPattern: '2 cây Hành lá',
      correctName: 'Hành lá',
      imageQueries: null, // đã có ảnh
    },
    // Cơm trắng (4 tô...) — đã tạo nhưng tên xấu
    {
      rawTextPattern: '4 tô Cơm trắng',
      correctName: 'Cơm trắng',
      imageQueries: ['white steamed rice bowl Vietnamese', 'plain cooked rice bowl'],
      wikiQuery: 'Cooked rice',
    },
  ];

  // Tìm "Hành lá" đúng trong DB
  const hanhLa = await db.ingredient.findFirst({
    where: { name: { contains: 'Hành lá' }, isActive: true, imageUrl: { not: null } },
  });
  console.log(`Hành lá in DB: ${hanhLa?.id} — ${hanhLa?.name}`);

  // Tìm/tạo "Mì cao lầu"
  let miCaoLau = await db.ingredient.findFirst({
    where: { name: { contains: 'Mì cao lầu' } },
  });
  if (!miCaoLau) {
    const code = 'mi-cao-lau-' + Date.now().toString().slice(-5);
    miCaoLau = await db.ingredient.create({
      data: { name: 'Mì cao lầu', code, isActive: true },
    });
    console.log(`✅ Created "Mì cao lầu" → ${miCaoLau.id}`);
    // Find image
    const imgUrl = await findImageAndUpload(miCaoLau.id, 'Mì cao lầu', [
      'cao lau noodles Hoi An Vietnam yellow thick',
      'Vietnamese Hoi An noodles dish',
    ]);
    if (imgUrl) {
      await db.ingredient.update({ where: { id: miCaoLau.id }, data: { imageUrl: imgUrl } });
      console.log(`  📸 Image: ${imgUrl.substring(0, 60)}`);
    }
  } else {
    console.log(`Found "Mì cao lầu": ${miCaoLau.id}`);
  }

  // Fix ingredient "4 tô Cơm trắng" → rename to "Cơm trắng" and add image
  const comTrang4To = await db.ingredient.findFirst({
    where: { name: '4 tô Cơm trắng' },
  });
  if (comTrang4To) {
    // Check if "Cơm trắng" already exists
    const comTrangExist = await db.ingredient.findFirst({
      where: { name: 'Cơm trắng', isActive: true },
    });
    if (comTrangExist) {
      // Update DishIngredient to point to existing one, then delete the bad one
      await db.dishIngredient.updateMany({
        where: { ingredientId: comTrang4To.id },
        data: { ingredientId: comTrangExist.id },
      });
      // Delete the bad ingredient
      await db.ingredient.delete({ where: { id: comTrang4To.id } });
      console.log(`✅ Merged "4 tô Cơm trắng" → "Cơm trắng"`);
    } else {
      // Rename + add image
      await db.ingredient.update({
        where: { id: comTrang4To.id },
        data: { name: 'Cơm trắng' },
      });
      const imgUrl = await findImageAndUpload(comTrang4To.id, 'Cơm trắng', [
        'white steamed rice bowl food',
        'cooked white rice Vietnamese',
      ]);
      if (imgUrl) {
        await db.ingredient.update({ where: { id: comTrang4To.id }, data: { imageUrl: imgUrl } });
        console.log(`  📸 Image added for Cơm trắng`);
      }
      console.log(`✅ Renamed to "Cơm trắng"`);
    }
  }

  // Fix DishIngredient "Mì cao lầu" links
  const wrongCaLinks = await db.dishIngredient.findMany({
    where: {
      rawText: { contains: 'Mì cao lầu' },
    },
    include: { ingredient: { select: { id: true, name: true } } },
  });
  
  for (const di of wrongCaLinks) {
    if (di.ingredient?.name !== 'Mì cao lầu') {
      await db.dishIngredient.update({
        where: { id: di.id },
        data: { ingredientId: miCaoLau.id },
      });
      console.log(`✅ Fixed "${di.rawText.substring(0, 40)}" → "Mì cao lầu"`);
    }
  }

  // Fix "2 cây Hành lá" → link to real "Hành lá"
  if (hanhLa) {
    const wrongHanhLa = await db.dishIngredient.findMany({
      where: {
        rawText: { contains: 'Hành lá' },
        ingredient: { name: 'Cá' },
      },
    });
    for (const di of wrongHanhLa) {
      await db.dishIngredient.update({
        where: { id: di.id },
        data: { ingredientId: hanhLa.id },
      });
      console.log(`✅ Fixed "${di.rawText.substring(0, 40)}" → "${hanhLa.name}"`);
    }
  }

  console.log('\n✅ All fixes done!');
  await db.$disconnect();
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
