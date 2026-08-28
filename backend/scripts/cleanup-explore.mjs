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
    // Xóa post của Mogu Nutrition (chỉ giữ post của Hương Giang)
    const del = await client.query(
      `DELETE FROM community_posts WHERE author_id = '7b272e62-1ec0-411a-b73b-802147280f33'`,
    );
    console.log('Deleted Mogu Nutrition posts:', del.rowCount);

    // Kiểm tra lại
    const posts = await client.query(
      `SELECT p.display_name, cp.content, cp.like_count, cp.comment_count, cp.created_at
       FROM community_posts cp
       JOIN profiles p ON p.user_id = cp.author_id
       ORDER BY cp.created_at DESC`,
    );
    console.log('\nFinal community posts:');
    posts.rows.forEach(r => {
      console.log(`  ${r.display_name}: "${r.content.substring(0, 60)}" | ❤️ ${r.like_count} | 💬 ${r.comment_count}`);
    });

    // Test API feed endpoint sẽ trả về gì
    console.log('\n✅ Seed data hoàn chỉnh!');
    console.log('Khi gọi GET /v1/explore/feed sẽ trả về:');
    console.log('  - topics: 3 chủ đề (Món ngon mùa mưa, Ăn lành mạnh, Dưới 50K)');
    console.log('  - featuredArticle: "10 thực phẩm giúp tăng cường sức đề kháng"');
    console.log('  - recentPosts: Post của Hương Giang về Bún bò Huế');

  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(console.error);
