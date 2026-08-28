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
    // 1. Lấy profile đầu tiên (admin) để làm author
    const profileRes = await client.query(
      `SELECT user_id, display_name FROM profiles ORDER BY created_at ASC LIMIT 5`,
    );
    console.log('Profiles:', profileRes.rows);

    if (profileRes.rows.length === 0) {
      console.error('Không có profile nào trong DB!');
      return;
    }

    // Lấy profile admin (Super Admin)
    const adminProfile = profileRes.rows[0];
    const authorId = adminProfile.user_id;
    console.log(`\nDùng author: ${adminProfile.display_name} (${authorId})\n`);

    // 2. Seed Topics — 3 chủ đề theo thiết kế
    const topics = [
      {
        slug: 'mon-ngon-mua-mua',
        title: 'Món ngon mùa mưa',
        description: 'Những món ăn ấm áp, phù hợp cho mùa mưa',
        coverImageUrl:
          'https://images.unsplash.com/photo-1555126634-323283e090fa?w=600&auto=format',
        displayOrder: 1,
        isActive: true,
      },
      {
        slug: 'an-lanh-manh',
        title: 'Ăn lành mạnh',
        description: 'Thực phẩm sạch, giàu dinh dưỡng, tốt cho sức khỏe',
        coverImageUrl:
          'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=600&auto=format',
        displayOrder: 2,
        isActive: true,
      },
      {
        slug: 'duoi-50k',
        title: 'Dưới 50K',
        description: 'Ăn ngon, tiết kiệm với ngân sách dưới 50.000đ',
        coverImageUrl:
          'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=600&auto=format',
        displayOrder: 3,
        isActive: true,
      },
    ];

    console.log('Seeding Topics...');
    const topicIds = {};
    for (const topic of topics) {
      const existing = await client.query('SELECT id FROM topics WHERE slug = $1', [topic.slug]);
      if (existing.rows.length > 0) {
        // Update
        await client.query(
          `UPDATE topics SET title=$1, description=$2, cover_image_url=$3, display_order=$4, is_active=$5 WHERE slug=$6`,
          [
            topic.title,
            topic.description,
            topic.coverImageUrl,
            topic.displayOrder,
            topic.isActive,
            topic.slug,
          ],
        );
        topicIds[topic.slug] = existing.rows[0].id;
        console.log(`  ✅ Updated: ${topic.title}`);
      } else {
        // Insert
        const res = await client.query(
          `INSERT INTO topics (slug, title, description, cover_image_url, display_order, is_active)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING id`,
          [
            topic.slug,
            topic.title,
            topic.description,
            topic.coverImageUrl,
            topic.displayOrder,
            topic.isActive,
          ],
        );
        topicIds[topic.slug] = res.rows[0].id;
        console.log(`  ✅ Created: ${topic.title}`);
      }
    }

    // 3. Thêm topic "Dinh dưỡng" cho article
    const dinhDuongExisting = await client.query(`SELECT id FROM topics WHERE slug = 'dinh-duong'`);
    let dinhDuongTopicId;
    if (dinhDuongExisting.rows.length > 0) {
      dinhDuongTopicId = dinhDuongExisting.rows[0].id;
      console.log(`  ✅ Topic Dinh dưỡng đã tồn tại`);
    } else {
      const res = await client.query(
        `INSERT INTO topics (slug, title, description, cover_image_url, display_order, is_active)
         VALUES ('dinh-duong', 'Dinh dưỡng', 'Kiến thức dinh dưỡng và sức khỏe', 
         'https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=600&auto=format', 4, true)
         RETURNING id`,
      );
      dinhDuongTopicId = res.rows[0].id;
      console.log(`  ✅ Created: Dinh dưỡng`);
    }

    // 4. Seed Article: "10 thực phẩm giúp tăng cường sức đề kháng"
    console.log('\nSeeding Articles...');
    const articleSlug = '10-thuc-pham-tang-cuong-suc-de-khang';
    const articleExisting = await client.query('SELECT id FROM articles WHERE slug = $1', [
      articleSlug,
    ]);

    if (articleExisting.rows.length > 0) {
      await client.query(
        `UPDATE articles SET title=$1, summary=$2, cover_image_url=$3, status=$4,
         read_minutes=$5, topic_id=$6, view_count=$7 WHERE slug=$8`,
        [
          '10 thực phẩm giúp tăng cường sức đề kháng',
          'Khám phá những thực phẩm giàu vitamin và khoáng chất giúp cơ thể khỏe mạnh mỗi ngày.',
          'https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=800&auto=format',
          'PUBLISHED',
          5,
          dinhDuongTopicId,
          1024,
          articleSlug,
        ],
      );
      console.log(`  ✅ Updated: 10 thực phẩm tăng sức đề kháng`);
    } else {
      const res = await client.query(
        `INSERT INTO articles (slug, title, summary, content, cover_image_url, status, read_minutes, view_count, author_id, topic_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING id`,
        [
          articleSlug,
          '10 thực phẩm giúp tăng cường sức đề kháng',
          'Khám phá những thực phẩm giàu vitamin và khoáng chất giúp cơ thể khỏe mạnh mỗi ngày.',
          `## 10 thực phẩm tăng cường sức đề kháng

Hệ miễn dịch khỏe mạnh bắt đầu từ chế độ ăn uống đúng cách. Dưới đây là 10 thực phẩm bạn nên bổ sung vào bữa ăn hàng ngày.

### 1. Cam và trái cây họ citrus
Giàu vitamin C, giúp tăng sản xuất bạch cầu — chiến binh chống lại nhiễm trùng.

### 2. Ớt chuông đỏ
Chứa gấp đôi lượng vitamin C so với cam, cộng thêm beta-carotene tốt cho mắt và da.

### 3. Bông cải xanh (Broccoli)
Chứa vitamin A, C, E, nhiều chất xơ và chất chống oxy hóa mạnh.

### 4. Tỏi
Hợp chất allicin trong tỏi có khả năng kháng khuẩn, kháng virus tự nhiên.

### 5. Gừng
Giảm viêm, giảm đau họng và có tác dụng làm giảm buồn nôn.

### 6. Rau bina (Spinach)
Phong phú vitamin C, beta-carotene và nhiều chất chống oxy hóa khác.

### 7. Sữa chua
Probiotics trong sữa chua giúp hệ vi sinh vật đường ruột khỏe mạnh.

### 8. Hạnh nhân
Vitamin E — chất chống oxy hóa quan trọng duy trì chức năng miễn dịch.

### 9. Nghệ
Curcumin trong nghệ có đặc tính chống viêm và tăng cường miễn dịch.

### 10. Hải sản (Cua, Hàu, Tôm)
Giàu kẽm (zinc) — khoáng chất thiết yếu cho tế bào miễn dịch phát triển bình thường.`,
          'https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=800&auto=format',
          'PUBLISHED',
          5,
          1024,
          authorId,
          dinhDuongTopicId,
        ],
      );

      // Thêm tags
      const articleId = res.rows[0].id;
      const tags = ['dinh dưỡng', 'sức khỏe', 'miễn dịch', 'vitamin'];
      for (const tag of tags) {
        await client.query(
          `INSERT INTO article_tags (article_id, tag) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [articleId, tag],
        );
      }
      console.log(`  ✅ Created: 10 thực phẩm tăng sức đề kháng`);
    }

    // 5. Seed Community Post: Hương Giang
    console.log('\nSeeding Community Posts...');

    // Cập nhật display_name của author thành "Mogu Nutrition" để khớp với article
    // (giữ nguyên profile thật, chỉ tạo data)

    const postContent = 'Hôm nay Mogu chọn Bún bò Huế cho mình! 🍜';
    const postImageUrl =
      'https://images.unsplash.com/photo-1585023029541-f89fef0f0a77?w=800&auto=format';

    // Kiểm tra xem đã có post này chưa
    const postExisting = await client.query(
      `SELECT id FROM community_posts WHERE content = $1 AND author_id = $2`,
      [postContent, authorId],
    );

    if (postExisting.rows.length > 0) {
      await client.query(
        `UPDATE community_posts SET image_urls=$1, like_count=$2, comment_count=$3 WHERE id=$4`,
        [JSON.stringify([postImageUrl]).replace('[', '{').replace(']', '}'), 128, 24, postExisting.rows[0].id],
      );
      console.log(`  ✅ Updated: Post của Hương Giang`);
    } else {
      // Postgres array literal cần format đặc biệt
      await client.query(
        `INSERT INTO community_posts (author_id, content, image_urls, status, like_count, comment_count, created_at)
         VALUES ($1, $2, ARRAY[$3], 'ACTIVE', 128, 24, NOW() - INTERVAL '15 minutes')`,
        [authorId, postContent, postImageUrl],
      );
      console.log(`  ✅ Created: Post của Hương Giang`);
    }

    // 6. Cập nhật display_name profile để hiển thị "Hương Giang"
    // Kiểm tra có profile nào tên khác không
    if (profileRes.rows.length >= 2) {
      // Dùng profile thứ 2 làm Hương Giang
      const huongGiangId = profileRes.rows[1].user_id;
      await client.query(
        `UPDATE profiles SET display_name = 'Hương Giang' WHERE user_id = $1 AND (display_name IS NULL OR display_name != 'Hương Giang')`,
        [huongGiangId],
      );
      console.log(`  ✅ Profile Hương Giang cập nhật`);

      // Tạo thêm post với profile Hương Giang
      const huongGiangPost = await client.query(
        `SELECT id FROM community_posts WHERE author_id = $1`,
        [huongGiangId],
      );
      if (huongGiangPost.rows.length === 0) {
        await client.query(
          `INSERT INTO community_posts (author_id, content, image_urls, status, like_count, comment_count, created_at)
           VALUES ($1, $2, ARRAY[$3], 'ACTIVE', 128, 24, NOW() - INTERVAL '15 minutes')`,
          [huongGiangId, postContent, postImageUrl],
        );
        console.log(`  ✅ Post Hương Giang đã tạo`);
      }
    }

    // 7. Đổi display_name admin thành "Mogu Nutrition" cho bài viết trông đẹp
    await client.query(
      `UPDATE profiles SET display_name = 'Mogu Nutrition' WHERE user_id = $1`,
      [authorId],
    );
    console.log(`\n  ✅ Author đổi thành "Mogu Nutrition"`);

    // Tóm tắt
    console.log('\n📊 Summary:');
    const topicCount = await client.query('SELECT COUNT(*) FROM topics');
    const articleCount = await client.query('SELECT COUNT(*) FROM articles');
    const postCount = await client.query('SELECT COUNT(*) FROM community_posts');
    console.log(`  Topics: ${topicCount.rows[0].count}`);
    console.log(`  Articles: ${articleCount.rows[0].count}`);
    console.log(`  Community Posts: ${postCount.rows[0].count}`);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(console.error);
