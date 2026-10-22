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

const remainingMap: Record<string, string> = {
  'banh-quay-gion-dsr7f': 'https://thumb.wikimedia.org/wikipedia/commons/thumb/7/78/Youtiao.jpg/960px-Youtiao.jpg?utm_source=vi.wikipedia.org&utm_campaign=api&utm_content=thumbnail',
  'bi-heo-tron-thinh-gao-04aqb': 'https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b0/C%C6%A1m_T%E1%BA%A5m%2C_Da_Nang%2C_Vietnam.jpg/960px-C%C6%A1m_T%E1%BA%A5m%2C_Da_Nang%2C_Vietnam.jpg?utm_source=vi.wikipedia.org&utm_campaign=api&utm_content=thumbnail',
  'cha-bong-thit-heo-ruoc-fr1ql': 'https://upload.wikimedia.org/wikipedia/commons/f/f4/Fragrance_Pork_Floss.jpg',
  'dau-phong-rang-lac-rang-tx3n7': 'https://cdn.tgdd.vn/Products/Images/3235/83022/bhx/dau-phong-viet-san-500g-201812111146444694.jpg',
  'do-chua-ie01z': 'https://thumb.wikimedia.org/wikipedia/commons/thumb/4/48/Banh_mi_assemblage.JPG/960px-Banh_mi_assemblage.JPG?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail',
  'do-chua-ca-rot-cu-cai-jxacf': 'https://thumb.wikimedia.org/wikipedia/commons/thumb/4/48/Banh_mi_assemblage.JPG/960px-Banh_mi_assemblage.JPG?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail',
  'gia-vi-uop-toi-gung-s18r6': 'https://s3-hcmc02.higiocloud.vn/images/2022/cu-gung-100g_1ac1e773-c510-4518-84e0-4c8aca6ea8a5-og.jpg',
  'hanh-kho-hanh-cu-tim-4gybv': 'https://cdn.tgdd.vn/Products/Images/8785/309133/bhx/hanh-tim-200g-202306080954084413.jpg',
  'hanh-tim-va-gung-nuong-810f0': 'https://s3-hcmc02.higiocloud.vn/images/2022/cu-gung-100g_1ac1e773-c510-4518-84e0-4c8aca6ea8a5-og.jpg',
  'hoa-hoi-va-que-thanh-h89rx': 'https://thumb.wikimedia.org/wikipedia/commons/thumb/6/62/Illicium_verum_2006-10-17.jpg/960px-Illicium_verum_2006-10-17.jpg?utm_source=vi.wikipedia.org&utm_campaign=api&utm_content=thumbnail',
  'hu-tieu-dai-iksax': 'https://thumb.wikimedia.org/wikipedia/commons/thumb/f/f4/H%E1%BB%A7_t%C3%ADu_Nam_Vang_%28h%E1%BB%A7_t%C3%ADu_t%C3%B4m%29%2C_qu%C3%A1n_C%E1%BA%A7u_Tr%E1%BA%AFng%2C_K%C3%AAnh_n%C6%B0%E1%BB%9Bc_%C4%91en_%281%29.jpg/960px-H%E1%BB%A7_t%C3%ADu_Nam_Vang_%28h%E1%BB%A7_t%C3%ADu_t%C3%B4m%29%2C_qu%C3%A1n_C%E1%BA%A7u_Tr%E1%BA%AFng%2C_K%C3%AAnh_n%C6%B0%E1%BB%9Bc_%C4%91en_%281%29.jpg?utm_source=vi.wikipedia.org&utm_campaign=api&utm_content=thumbnail',
  'la-dong-goi-banh-tuoi-wowmt': 'https://thumb.wikimedia.org/wikipedia/commons/thumb/0/06/The_dong_leaf.jpg/960px-The_dong_leaf.jpg?utm_source=vi.wikipedia.org&utm_campaign=api&utm_content=thumbnail',
  'la-oi-banh-te-tuoi-6uu83': 'https://thumb.wikimedia.org/wikipedia/commons/thumb/e/ed/Fermented_pork_wrapped_in_leaves.jpg/960px-Fermented_pork_wrapped_in_leaves.jpg?utm_source=vi.wikipedia.org&utm_campaign=api&utm_content=thumbnail',
  'mi-trung-tuoi-soi-tron-2ji9y': 'https://cdn.tgdd.vn/Products/Images/8158/80133/bhx/mi-trung-safoco-cao-cap-500g-2-700x467.jpg',
  'nem-chua-cay-gu1vh': 'https://thumb.wikimedia.org/wikipedia/commons/thumb/e/ed/Fermented_pork_wrapped_in_leaves.jpg/960px-Fermented_pork_wrapped_in_leaves.jpg?utm_source=vi.wikipedia.org&utm_campaign=api&utm_content=thumbnail',
  'que-thanh-cao-vo-aerwl': 'https://thumb.wikimedia.org/wikipedia/commons/thumb/f/f1/Baton_de_cannelle.jpg/960px-Baton_de_cannelle.jpg?utm_source=vi.wikipedia.org&utm_campaign=api&utm_content=thumbnail',
  'rau-an-lau-mam-thap-cam-keo-neo-rau-dang-dien-dien-bong-sung-ym62o': 'https://cdnv2.tgdd.vn/bhx-static/bhx/Products/Images/8820/325781/bhx/keo-neo_202504151614088353.jpg',
  'rau-cu-luoc-an-kho-quet-dau-bap-ca-rot-su-su-6f9yf': 'https://s3-hcmc02.higiocloud.vn/images/2023/02/rau-cu-hon-hop-goi-400g.jpg',
  'ruot-banh-mi-xe-vun-xqcxg': 'https://cdn.tgdd.vn/Products/Images/7259/266327/bhx/banh-mi-dai-baguette-hoang-phat-goi-200g-202201040933099018.jpg',
  'soi-banh-canh-bot-gao-4e1if': 'https://upload.wikimedia.org/wikipedia/commons/c/c4/Banh-Canh-Noodle-Soup.jpg',
  'soi-banh-canh-bot-loc-mzaqg': 'https://upload.wikimedia.org/wikipedia/commons/c/c4/Banh-Canh-Noodle-Soup.jpg',
  'soi-hu-tieu-my-tho-botuy': 'https://thumb.wikimedia.org/wikipedia/commons/thumb/f/f4/H%E1%BB%A7_t%C3%ADu_Nam_Vang_%28h%E1%BB%A7_t%C3%ADu_t%C3%B4m%29%2C_qu%C3%A1n_C%E1%BA%A7u_Tr%E1%BA%AFng%2C_K%C3%AAnh_n%C6%B0%E1%BB%9Bc_%C4%91en_%281%29.jpg/960px-H%E1%BB%A7_t%C3%ADu_Nam_Vang_%28h%E1%BB%A7_t%C3%ADu_t%C3%B4m%29%2C_qu%C3%A1n_C%E1%BA%A7u_Tr%E1%BA%AFng%2C_K%C3%AAnh_n%C6%B0%E1%BB%9Bc_%C4%91en_%281%29.jpg?utm_source=vi.wikipedia.org&utm_campaign=api&utm_content=thumbnail',
  'sua-bien-tuoi-lam-sach-0r7x5': 'https://upload.wikimedia.org/wikipedia/commons/8/81/Jellyfish%2BprocessingVOA.jpg',
  'thinh-gao-rang-min-w4wsm': 'https://thumb.wikimedia.org/wikipedia/commons/thumb/8/8f/Lao_khao_khua_%28toasted_rice_powder%29_for_laab_and_jeow.jpg/960px-Lao_khao_khua_%28toasted_rice_powder%29_for_laab_and_jeow.jpg?utm_source=en.wikipedia.org&utm_campaign=api&utm_content=thumbnail',
  'thit-bo-kho-mieng-soi-tam-vi-xkvmb': 'https://thumb.wikimedia.org/wikipedia/commons/thumb/6/64/Jerky_%281%29.jpg/960px-Jerky_%281%29.jpg?utm_source=en.wikipedia.org&utm_campaign=api&utm_content=thumbnail',
  'thit-heo-quay-gion-bi-kop4s': 'https://upload.wikimedia.org/wikipedia/commons/1/12/RoastPig.jpg',
  'toi-tep-va-ot-hiem-d5sny': 'https://s3-hcmc02.higiocloud.vn/images/2023/02/toi-cu-ly-son-100g.png',
};

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function downloadWithRetry(url: string): Promise<{ buffer: Buffer; contentType: string } | null> {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'MoguCulinaryBot/1.0 (https://mogu.vn; contact@mogu.vn) Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
          Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
        },
      });

      if (res.status === 429) {
        console.log(`    ⏳ 429 Too Many Requests, waiting ${attempt * 2}s...`);
        await sleep(attempt * 2000);
        continue;
      }

      if (!res.ok) {
        console.log(`    ❌ HTTP ${res.status}`);
        return null;
      }

      const ct = (res.headers.get('content-type') || 'image/jpeg').split(';')[0].trim();
      const arrayBuffer = await res.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      if (buffer.length < 3000) return null;
      return { buffer, contentType: ct };
    } catch (e: any) {
      console.log(`    ⚠️ Error: ${e.message}`);
      await sleep(1000);
    }
  }
  return null;
}

async function uploadToSupabase(code: string, buffer: Buffer, contentType: string): Promise<string | null> {
  const ext = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg';
  const filePath = `${code}.${ext}`;

  const { error } = await supabase.storage
    .from('ingredient-images')
    .upload(filePath, buffer, { contentType, upsert: true });

  if (error) {
    console.error(`    ❌ Supabase upload error: ${error.message}`);
    return null;
  }

  return `${process.env.SUPABASE_URL}/storage/v1/object/public/ingredient-images/${filePath}`;
}

async function main() {
  const codes = Object.keys(remainingMap);
  console.log(`Deploying remaining ${codes.length} ingredients...`);

  let successCount = 0;
  for (let i = 0; i < codes.length; i++) {
    const code = codes[i];
    const url = remainingMap[code];

    const ingredient = await prisma.ingredient.findUnique({
      where: { code },
      select: { code: true, name: true },
    });

    const name = ingredient ? ingredient.name : code;
    console.log(`\n[${i + 1}/${codes.length}] Deploying: "${name}" [${code}]`);

    const dl = await downloadWithRetry(url);
    if (!dl) {
      console.log(`  ❌ Failed download: ${url}`);
      continue;
    }

    console.log(`  Downloaded: ${dl.buffer.length} bytes (${dl.contentType})`);
    const publicUrl = await uploadToSupabase(code, dl.buffer, dl.contentType);
    if (!publicUrl) {
      console.log(`  ❌ Failed Supabase upload`);
      continue;
    }

    await prisma.ingredient.update({
      where: { code },
      data: {
        imageUrl: publicUrl,
        imageStatus: 'PENDING_REVIEW',
        isActive: false,
        status: 'PENDING_REVIEW',
      },
    });

    console.log(`  ✅ Deployed: ${publicUrl}`);
    successCount++;
    await sleep(300);
  }

  console.log(`\n========================================`);
  console.log(`Remaining deployment complete: ${successCount} / ${codes.length}`);
  console.log(`========================================`);

  await prisma.$disconnect();
}

main();
