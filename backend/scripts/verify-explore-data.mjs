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
    console.log('=== VERIFY EXPLORE SEED DATA ===\n');

    // Simulate what /explore/feed returns
    const topicsRes = await client.query(
      `SELECT t.id, t.slug, t.title, t.cover_image_url,
        COUNT(a.id) FILTER (WHERE a.status = 'PUBLISHED') as article_count
       FROM topics t
       LEFT JOIN articles a ON a.topic_id = t.id
       WHERE t.is_active = true
       GROUP BY t.id
       ORDER BY t.display_order
       LIMIT 5`,
    );

    console.log('📚 Topics (sẽ hiển thị trong TopicsRow):');
    topicsRes.rows.forEach((t, i) => {
      console.log(`  ${i + 1}. "${t.title}" — ${t.cover_image_url ? '✅ ảnh' : '❌ chưa có ảnh'} | ${t.article_count} bài viết`);
    });

    const articleRes = await client.query(
      `SELECT a.id, a.title, a.summary, a.cover_image_url, a.read_minutes, a.view_count, a.status,
        p.display_name as author_name,
        t.title as topic_title,
        array_agg(at.tag) FILTER (WHERE at.tag IS NOT NULL) as tags
       FROM articles a
       JOIN profiles p ON p.user_id = a.author_id
       LEFT JOIN topics t ON t.id = a.topic_id
       LEFT JOIN article_tags at ON at.article_id = a.id
       WHERE a.status = 'PUBLISHED'
       GROUP BY a.id, p.display_name, t.title
       ORDER BY a.view_count DESC
       LIMIT 1`,
    );

    console.log('\n📰 Featured Article (bài viết nổi bật):');
    if (articleRes.rows.length > 0) {
      const a = articleRes.rows[0];
      console.log(`  Title: "${a.title}"`);
      console.log(`  Author: ${a.author_name}`);
      console.log(`  Topic: ${a.topic_title}`);
      console.log(`  Summary: ${a.summary}`);
      console.log(`  Cover: ${a.cover_image_url ? '✅ ' + a.cover_image_url.substring(0, 60) + '...' : '❌ chưa có'}`);
      console.log(`  Read: ${a.read_minutes} phút | Views: ${a.view_count}`);
      console.log(`  Tags: ${a.tags?.join(', ')}`);
    } else {
      console.log('  ❌ Chưa có bài viết PUBLISHED!');
    }

    const postsRes = await client.query(
      `SELECT cp.id, cp.content, cp.image_urls, cp.like_count, cp.comment_count, cp.created_at,
        p.display_name as author_name, p.avatar_url
       FROM community_posts cp
       JOIN profiles p ON p.user_id = cp.author_id
       WHERE cp.status = 'ACTIVE'
       ORDER BY cp.created_at DESC
       LIMIT 5`,
    );

    console.log('\n👥 Community Posts (sẽ hiển thị trong PostCard):');
    postsRes.rows.forEach((post, i) => {
      const timeDiff = Math.round((Date.now() - new Date(post.created_at).getTime()) / 60000);
      console.log(`  ${i + 1}. ${post.author_name}: "${post.content.substring(0, 50)}"`);
      console.log(`     ❤️ ${post.like_count} | 💬 ${post.comment_count} | ⏱️ ${timeDiff} phút trước`);
      console.log(`     📸 Ảnh: ${post.image_urls?.length > 0 ? '✅ ' + post.image_urls[0].substring(0, 50) + '...' : '❌ Không có'}`);
      console.log(`     👤 Avatar: ${post.avatar_url ? '✅' : '❌ Chưa có'}`);
    });

    console.log('\n\n✅ Dữ liệu sẵn sàng để giao diện hiển thị!');
    console.log('Khởi động lại backend (nếu chưa) và mở app mobile để xem kết quả.');

  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(console.error);
