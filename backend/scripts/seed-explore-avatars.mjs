import pg from 'pg';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, '..', '.env.local') });

const pool = new pg.Pool({
  connectionString: process.env.DIRECT_URL,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  const client = await pool.connect();
  try {
    // Cập nhật avatar cho "Mogu Nutrition" (profile đầu tiên)
    await client.query(
      `UPDATE profiles SET 
        display_name = 'Mogu Nutrition',
        avatar_url = 'https://lkqvyvllmrbxgaoqrkhd.supabase.co/storage/v1/object/public/dish-images/logo/mogu-icon.png'
       WHERE user_id = '7b272e62-1ec0-411a-b73b-802147280f33'`,
    );
    console.log('✅ Cập nhật Mogu Nutrition avatar');

    // Cập nhật avatar cho "Hương Giang"
    await client.query(
      `UPDATE profiles SET 
        display_name = 'Hương Giang',
        avatar_url = 'https://images.unsplash.com/photo-1499952127939-9bbf5af6c51c?w=100&auto=format'
       WHERE user_id = '3b66d744-18b5-4070-8c1d-1193bc5712a1'`,
    );
    console.log('✅ Cập nhật Hương Giang avatar');

    // Xác nhận
    const res = await client.query(
      `SELECT p.display_name, p.avatar_url, cp.content, cp.like_count, cp.comment_count, cp.created_at
       FROM community_posts cp
       JOIN profiles p ON p.user_id = cp.author_id
       ORDER BY cp.created_at DESC`,
    );
    console.log('\nCommunity Posts:');
    res.rows.forEach(r => {
      console.log(`  - ${r.display_name}: "${r.content.substring(0, 50)}..." | ❤️ ${r.like_count} | 💬 ${r.comment_count}`);
    });

    const articles = await client.query(
      `SELECT a.title, a.status, a.view_count, p.display_name, t.title as topic_title
       FROM articles a
       JOIN profiles p ON p.user_id = a.author_id
       LEFT JOIN topics t ON t.id = a.topic_id`,
    );
    console.log('\nArticles:');
    articles.rows.forEach(r => {
      console.log(`  - [${r.status}] "${r.title}" by ${r.display_name} | Topic: ${r.topic_title} | 👁️ ${r.view_count}`);
    });

    const topics = await client.query(
      `SELECT title, slug, is_active, display_order FROM topics ORDER BY display_order`,
    );
    console.log('\nTopics:');
    topics.rows.forEach(r => {
      console.log(`  - [${r.display_order}] ${r.title} (${r.slug}) active=${r.is_active}`);
    });

  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(console.error);
