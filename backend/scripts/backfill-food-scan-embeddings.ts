import pg from 'pg';
import * as dotenv from 'dotenv';
import axios from 'axios';
import { FoodScanEmbeddingService } from '../src/food-scan/food-scan-embedding.service';
import { ConfigService } from '@nestjs/config';

dotenv.config({ path: '.env.local' });

const pool = new pg.Pool({
  connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
});

async function main() {
  console.log('--- Starting FoodScan Embeddings Backfill ---');
  const embeddingService = new FoodScanEmbeddingService(new ConfigService({}));

  // 1. Text embedding for dishes
  const dishesRes = await pool.query(`
    SELECT id, name, alternate_names, search_text
    FROM dishes
    WHERE status = 'PUBLISHED' AND deleted_at IS NULL
      AND food_scan_text_embedding IS NULL
    ORDER BY created_at ASC
  `);
  console.log(`Dishes requiring text embeddings: ${dishesRes.rows.length}`);

  let dishCount = 0;
  for (const row of dishesRes.rows) {
    const textToEmbed = [
      row.name,
      ...(row.alternate_names || []),
      row.search_text ? row.search_text.slice(0, 150) : '',
    ]
      .filter(Boolean)
      .join(' ');

    const vec = await embeddingService.embedText(textToEmbed);
    if (vec && vec.length === 512) {
      const vecString = `[${vec.join(',')}]`;
      await pool.query(
        'UPDATE dishes SET food_scan_text_embedding = $1::vector WHERE id = $2',
        [vecString, row.id],
      );
      dishCount++;
      if (dishCount % 10 === 0) {
        console.log(`  Indexed text embeddings for ${dishCount}/${dishesRes.rows.length} dishes.`);
      }
    }
  }
  console.log(`Finished text embeddings. Total updated: ${dishCount}`);

  // 2. Image embeddings for dish media
  const supabaseUrl = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'dish-images';

  const mediaRes = await pool.query(`
    SELECT m.id, m.dish_id, m.storage_key, m.bucket, m.source_url
    FROM dish_media m
    JOIN dishes d ON d.id = m.dish_id
    WHERE d.status = 'PUBLISHED' AND d.deleted_at IS NULL
      AND m.type = 'IMAGE'
      AND m.moderation_status = 'APPROVED'
      AND m.image_embedding IS NULL
    ORDER BY m.is_primary DESC, m.created_at ASC
  `);
  console.log(`Dish media requiring image embeddings: ${mediaRes.rows.length}`);

  let mediaCount = 0;
  for (const row of mediaRes.rows) {
    try {
      const b = row.bucket || bucket;
      const mediaUrl =
        row.storage_key && supabaseUrl
          ? `${supabaseUrl}/storage/v1/object/public/${b}/${row.storage_key}`
          : row.source_url;

      if (!mediaUrl) continue;

      const resp = await axios.get(mediaUrl, {
        responseType: 'arraybuffer',
        timeout: 15000,
      });

      const buffer = Buffer.from(resp.data);
      const vec = await embeddingService.embedImage(buffer);
      if (vec && vec.length === 512) {
        const vecString = `[${vec.join(',')}]`;
        await pool.query(
          'UPDATE dish_media SET image_embedding = $1::vector WHERE id = $2',
          [vecString, row.id],
        );
        mediaCount++;
        if (mediaCount % 5 === 0) {
          console.log(`  Indexed image embeddings for ${mediaCount}/${mediaRes.rows.length} media.`);
        }
      }
    } catch (err: any) {
      console.warn(`  Failed image embedding for media ${row.id} (${row.storage_key}): ${err.message}`);
    }
  }

  console.log(`Finished image embeddings. Total updated: ${mediaCount}`);
  embeddingService.onModuleDestroy();
}

main()
  .catch((e) => {
    console.error('Backfill error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await pool.end();
  });
