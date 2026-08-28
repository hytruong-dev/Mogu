/**
 * Seed 23 nguyên liệu còn thiếu cho 5 món ăn
 * - Tạo Ingredient records trong DB
 * - Download ảnh từ Pexels / Wikipedia thumbnail API
 * - Upload lên Supabase Storage bucket 'ingredient-images'
 * - Link ingredientId vào DishIngredient.rawText tương ứng
 */

import { readFileSync } from 'fs'
import { createClient } from '@supabase/supabase-js'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'
import https from 'https'

const env = readFileSync('.env.local', 'utf-8')
for (const l of env.split('\n')) {
  const t = l.trim()
  if (t && !t.startsWith('#')) {
    const i = t.indexOf('=')
    if (i > 0) process.env[t.slice(0, i).trim()] = t.slice(i + 1).trim()
  }
}

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })
const BUCKET = 'ingredient-images'

// ── Dữ liệu 23 nguyên liệu ──────────────────────────────────────────────────
// imageUrl: Pexels (verified working) hoặc Wikipedia thumbnail
const INGREDIENTS = [
  {
    name: 'Bánh canh tươi',     code: 'banh_canh_tuoi',    nameEn: 'Fresh udon noodles',
    desc: 'Sợi bột gạo/bột mì tươi dùng để nấu bánh canh.',
    allergen: '',
    pexels: 'https://images.pexels.com/photos/1437267/pexels-photo-1437267.jpeg?w=400&q=80',
  },
  {
    name: 'Bánh phở tươi',      code: 'banh_pho_tuoi',     nameEn: 'Fresh pho noodles',
    desc: 'Sợi phở tươi làm từ bột gạo, dùng cho các món phở.',
    allergen: '',
    pexels: 'https://images.pexels.com/photos/3026808/pexels-photo-3026808.jpeg?w=400&q=80',
  },
  {
    name: 'Bắp bò',             code: 'bap_bo',            nameEn: 'Beef shank',
    desc: 'Phần thịt bò ở bắp chân, thớ thịt chắc, thường dùng trong bún bò và bò kho.',
    allergen: '',
    wiki: 'Beef_shank',
  },
  {
    name: 'Bún tươi sợi lớn',   code: 'bun_tuoi_soi_lon',  nameEn: 'Rice vermicelli',
    desc: 'Bún gạo sợi lớn, thường dùng cho bún bò Huế và các món bún nước.',
    allergen: '',
    pexels: 'https://images.pexels.com/photos/699953/pexels-photo-699953.jpeg?w=400&q=80',
  },
  {
    name: 'Cải thìa',           code: 'cai_thia',          nameEn: 'Bok choy',
    desc: 'Rau họ cải bẹ trắng, vị nhẹ, thích hợp xào cùng thịt bò và mì.',
    allergen: '',
    wiki: 'Bok_choy',
  },
  {
    name: 'Cơm nguội',          code: 'com_nguoi',         nameEn: 'Cooked rice',
    desc: 'Cơm đã nấu và để nguội, hạt cơm se lại nên phù hợp để chiên.',
    allergen: '',
    pexels: 'https://images.pexels.com/photos/723198/pexels-photo-723198.jpeg?w=400&q=80',
  },
  {
    name: 'Dầu ăn',             code: 'dau_an',            nameEn: 'Cooking oil',
    desc: 'Dầu thực vật dùng để chiên, xào và làm nóng nguyên liệu.',
    allergen: '',
    pexels: 'https://images.pexels.com/photos/33783/olive-oil-salad-dressing-food-eat.jpg?w=400&q=80',
  },
  {
    name: 'Dầu điều',           code: 'dau_dieu',          nameEn: 'Annatto oil',
    desc: 'Dầu tạo màu đỏ cam từ hạt điều màu, giúp món ăn có màu đẹp.',
    allergen: '',
    wiki: 'Annatto',
  },
  {
    name: 'Dầu hào',            code: 'dau_hao',           nameEn: 'Oyster sauce',
    desc: 'Sốt đặc sánh có vị umami, thường dùng để nêm các món xào.',
    allergen: 'shellfish',
    wiki: 'Oyster_sauce',
  },
  {
    name: 'Dầu mè',             code: 'dau_me',            nameEn: 'Sesame oil',
    desc: 'Dầu từ hạt mè, thường thêm ở cuối món để tạo mùi thơm.',
    allergen: 'sesame',
    wiki: 'Sesame_oil',
  },
  {
    name: 'Đậu Hà Lan',         code: 'dau_ha_lan',        nameEn: 'Green peas',
    desc: 'Hạt đậu xanh ngọt nhẹ, thường dùng trong cơm chiên và món xào.',
    allergen: '',
    wiki: 'Pea',
  },
  {
    name: 'Giò heo',            code: 'gio_heo',           nameEn: 'Pork hock',
    desc: 'Chân giò heo có da và gân, dùng nấu nước lèo và làm phần thịt ăn kèm.',
    allergen: '',
    wiki: 'Ham_hock',
  },
  {
    name: 'Hành lá',            code: 'hanh_la',           nameEn: 'Green onion',
    desc: 'Rau gia vị tạo mùi thơm, dùng nấu và trang trí món ăn.',
    allergen: '',
    wiki: 'Scallion',
  },
  {
    name: 'Hạt mùi',            code: 'hat_mui',           nameEn: 'Coriander seeds',
    desc: 'Hạt rau mùi thơm, thường rang nhẹ và dùng trong nước dùng phở.',
    allergen: '',
    wiki: 'Coriander',
  },
  {
    name: 'Hoa hồi',            code: 'hoa_hoi',           nameEn: 'Star anise',
    desc: 'Gia vị có mùi thơm ngọt đặc trưng, dùng cho nước dùng phở.',
    allergen: '',
    wiki: 'Star_anise',
  },
  {
    name: 'Mắm ruốc Huế',       code: 'mam_ruoc_hue',      nameEn: 'Shrimp paste',
    desc: 'Mắm ruốc lên men dùng tạo vị đậm đà đặc trưng cho nước dùng bún bò Huế.',
    allergen: 'seafood',
    wiki: 'Shrimp_paste',
  },
  {
    name: 'Mì trứng',           code: 'mi_trung',          nameEn: 'Egg noodles',
    desc: 'Sợi mì có trứng, dai và thơm, phù hợp các món mì xào.',
    allergen: 'egg',
    wiki: 'Egg_noodles',
  },
  {
    name: 'Quế',                code: 'que',               nameEn: 'Cinnamon',
    desc: 'Vỏ cây có mùi thơm ấm, kết hợp với các gia vị khác trong nước dùng phở.',
    allergen: '',
    wiki: 'Cinnamon',
  },
  {
    name: 'Rau sống/giá/hoa chuối', code: 'rau_song_gia',  nameEn: 'Bean sprouts and herbs',
    desc: 'Nhóm rau ăn kèm giúp tăng độ tươi, giòn và cân bằng vị món bún.',
    allergen: '',
    pexels: 'https://images.pexels.com/photos/1187917/pexels-photo-1187917.jpeg?w=400&q=80',
  },
  {
    name: 'Thảo quả',           code: 'thao_qua',          nameEn: 'Black cardamom',
    desc: 'Gia vị có mùi thơm mạnh và hơi khói, dùng trong một số công thức nước dùng phở.',
    allergen: '',
    wiki: 'Amomum_tsaoko',
  },
  {
    name: 'Xúc xích',           code: 'xuc_xich',          nameEn: 'Sausage',
    desc: 'Thực phẩm chế biến từ thịt, thường cắt lát và chiên cùng cơm.',
    allergen: '',
    pexels: 'https://images.pexels.com/photos/9897543/pexels-photo-9897543.jpeg?w=400&q=80',
  },
  {
    name: 'Xương bò',           code: 'xuong_bo',          nameEn: 'Beef bones',
    desc: 'Dùng ninh lâu để tạo vị ngọt và độ đậm cho nước dùng.',
    allergen: '',
    pexels: 'https://images.pexels.com/photos/8969237/pexels-photo-8969237.jpeg?w=400&q=80',
  },
  {
    name: 'Xương heo',          code: 'xuong_heo',         nameEn: 'Pork bones',
    desc: 'Dùng ninh lấy nước ngọt để làm nước dùng bánh canh.',
    allergen: '',
    pexels: 'https://images.pexels.com/photos/8969237/pexels-photo-8969237.jpeg?w=400&q=80',
  },
]

// ── Helpers ──────────────────────────────────────────────────────────────────
function downloadBuffer(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      timeout: 20000,
    }, res => {
      if ([301, 302, 307, 308].includes(res.statusCode)) {
        return downloadBuffer(res.headers.location).then(resolve).catch(reject)
      }
      if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`))
      const chunks = []
      const ct = res.headers['content-type'] || 'image/jpeg'
      res.on('data', c => chunks.push(c))
      res.on('end', () => resolve({ buffer: Buffer.concat(chunks), contentType: ct }))
      res.on('error', reject)
    })
    req.on('error', reject)
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')) })
  })
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 Mogu-Seed/1.0', Accept: 'application/json' },
      timeout: 12000,
    }, res => {
      if ([301, 302].includes(res.statusCode)) return fetchJson(res.headers.location).then(resolve).catch(reject)
      if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`))
      let body = ''
      res.on('data', c => body += c)
      res.on('end', () => { try { resolve(JSON.parse(body)) } catch (e) { reject(e) } })
      res.on('error', reject)
    })
    req.on('error', reject)
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')) })
  })
}

async function getWikiThumb(title) {
  const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`
  const json = await fetchJson(url)
  const thumb = json?.thumbnail?.source || json?.originalimage?.source
  if (!thumb) throw new Error('No thumbnail')
  return thumb
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)) }

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  let ok = 0, fail = 0, skipped = 0
  const total = INGREDIENTS.length

  for (let i = 0; i < INGREDIENTS.length; i++) {
    const ing = INGREDIENTS[i]
    process.stdout.write(`\n[${i + 1}/${total}] ${ing.name}... `)

    // Kiểm tra đã tồn tại chưa
    let record = await prisma.ingredient.findUnique({ where: { code: ing.code } })
    if (record) {
      process.stdout.write('⏭  Đã tồn tại')
      skipped++
    } else {
      // Tạo mới
      try {
        record = await prisma.ingredient.create({
          data: {
            code: ing.code,
            name: ing.name,
            synonyms: [ing.nameEn],
            allergenCode: ing.allergen || null,
            isActive: true,
          },
        })
        process.stdout.write(`✅ created(${record.id.slice(0, 8)}) `)
      } catch (e) {
        process.stdout.write(`❌ DB: ${e.message}`)
        fail++
        continue
      }
    }

    // Upload ảnh nếu chưa có
    if (record.imageUrl) {
      process.stdout.write(' 🖼️ Đã có ảnh')
      ok++
      continue
    }

    // Thử download ảnh
    let imgData = null

    // Ưu tiên Pexels
    if (ing.pexels) {
      try {
        imgData = await downloadBuffer(ing.pexels)
        process.stdout.write(`📥 Pexels(${Math.round(imgData.buffer.length / 1024)}KB) `)
      } catch (e) {
        process.stdout.write(`⚠️ Pexels: ${e.message} → `)
      }
    }

    // Fallback Wikipedia
    if (!imgData && ing.wiki) {
      await delay(1000)
      try {
        const thumbUrl = await getWikiThumb(ing.wiki)
        imgData = await downloadBuffer(thumbUrl)
        process.stdout.write(`📥 Wiki(${Math.round(imgData.buffer.length / 1024)}KB) `)
      } catch (e) {
        process.stdout.write(`⚠️ Wiki: ${e.message}`)
      }
    }

    if (!imgData) {
      process.stdout.write('(no image)')
      ok++
      await delay(500)
      continue
    }

    // Upload Supabase
    const ext = imgData.contentType.includes('png') ? 'png' : 'jpg'
    const storagePath = `${record.id}/cover.${ext}`
    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, imgData.buffer, { contentType: imgData.contentType, upsert: true })

    if (upErr) {
      process.stdout.write(`❌ Upload: ${upErr.message}`)
      ok++
      continue
    }

    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(storagePath)
    await prisma.ingredient.update({
      where: { id: record.id },
      data: { imageUrl: urlData.publicUrl, imageKey: storagePath },
    })
    process.stdout.write('🖼️  ✅')
    ok++
    await delay(400)
  }

  // ── Link ingredientId vào DishIngredient ─────────────────────────────────
  console.log('\n\n─────────────────────────────────────────')
  console.log('🔗 Linking ingredientId vào DishIngredient...')

  const allIngredients = await prisma.ingredient.findMany({ select: { id: true, name: true, code: true, synonyms: true } })

  // Lấy tất cả dishIngredient chưa có ingredientId
  const unlinked = await prisma.dishIngredient.findMany({
    where: { ingredientId: null },
    select: { id: true, rawText: true },
  })

  let linked = 0
  for (const di of unlinked) {
    const lower = (di.rawText ?? '').toLowerCase().trim()
    const found = allIngredients.find(ing =>
      ing.name.toLowerCase() === lower ||
      ing.name.toLowerCase().includes(lower) ||
      lower.includes(ing.name.toLowerCase()) ||
      ing.synonyms?.some(s => s.toLowerCase().includes(lower) || lower.includes(s.toLowerCase()))
    )
    if (found) {
      await prisma.dishIngredient.update({
        where: { id: di.id },
        data: { ingredientId: found.id },
      })
      process.stdout.write(`  ✅ "${di.rawText}" → ${found.name}\n`)
      linked++
    }
  }

  console.log(`\n🔗 Đã link: ${linked}/${unlinked.length} nguyên liệu`)
  console.log('─────────────────────────────────────────')
  console.log(`✅ OK: ${ok}  ⏭ Skip: ${skipped}  ❌ Fail: ${fail}`)
  console.log('🎉 Hoàn tất!')
}

main()
  .catch(e => { console.error('\nFATAL:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
