/**
 * Seed 30 nguyên liệu nấu ăn Việt Nam
 * - Tạo ingredient records trong DB
 * - Download ảnh từ Wikimedia Commons
 * - Upload lên Supabase Storage bucket 'ingredient-images'
 * - Cập nhật imageUrl vào record
 */

import { readFileSync, writeFileSync } from 'fs'
import { createClient } from '@supabase/supabase-js'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'
import https from 'https'
import http from 'http'

// ── Load .env.local ──────────────────────────────────────────────────────────
const envContent = readFileSync('.env.local', 'utf-8')
for (const line of envContent.split('\n')) {
  const trimmed = line.trim()
  if (trimmed && !trimmed.startsWith('#')) {
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx > 0) {
      const key = trimmed.substring(0, eqIdx).trim()
      const val = trimmed.substring(eqIdx + 1).trim()
      process.env[key] = val
    }
  }
}

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })
const BUCKET = 'ingredient-images'

// ── Dữ liệu 30 nguyên liệu ──────────────────────────────────────────────────
const INGREDIENTS = [
  { name: 'Cà chua',    code: 'ca_chua',    group: 'rau_cu_qua', nameEn: 'Tomato',       desc: 'Dùng làm sốt, canh, xào, salad; vị chua ngọt tự nhiên.',                          img: 'Tomato.jpg',               allergen: '' },
  { name: 'Cà rốt',    code: 'ca_rot',     group: 'rau_cu_qua', nameEn: 'Carrot',       desc: 'Tạo vị ngọt và màu sắc cho canh, súp, món xào và món hầm.',                       img: 'CARROT.jpg',               allergen: '' },
  { name: 'Khoai tây', code: 'khoai_tay',  group: 'rau_cu_qua', nameEn: 'Potato',       desc: 'Phù hợp với món chiên, xào, hầm, cà ri và súp.',                                  img: 'Potato.jpg',               allergen: '' },
  { name: 'Hành tây',  code: 'hanh_tay',   group: 'rau_cu_qua', nameEn: 'Onion',        desc: 'Tạo mùi thơm và vị ngọt; dùng trong xào, hầm, nướng và salad.',                  img: 'Onion.jpg',                allergen: '' },
  { name: 'Tỏi',       code: 'toi',        group: 'gia_vi',     nameEn: 'Garlic',       desc: 'Gia vị cơ bản để phi thơm, ướp thịt cá và làm nước chấm.',                       img: 'Garlic.jpg',               allergen: '' },
  { name: 'Gừng',      code: 'gung',       group: 'gia_vi',     nameEn: 'Ginger',       desc: 'Khử mùi, tạo độ thơm ấm cho các món thịt, cá, canh và kho.',                     img: '-%20Ginger%20-.jpg',       allergen: '' },
  { name: 'Ớt',        code: 'ot',         group: 'gia_vi',     nameEn: 'Chilli pepper', desc: 'Tạo vị cay và màu sắc cho món kho, xào, nước chấm và bún phở.',                  img: 'Chilli%20pepper.jpg',      allergen: '' },
  { name: 'Chanh vàng',code: 'chanh_vang', group: 'rau_cu_qua', nameEn: 'Lemon',        desc: 'Dùng pha nước chấm, đồ uống, ướp và cân bằng vị món ăn.',                        img: 'Lemon%20-%20whole%20and%20split.jpg', allergen: '' },
  { name: 'Chanh xanh',code: 'chanh_xanh', group: 'rau_cu_qua', nameEn: 'Lime',         desc: 'Thường dùng cho nước chấm, bún phở, đồ uống và món hải sản.',                    img: 'Lime.jpg',                 allergen: '' },
  { name: 'Bắp cải',   code: 'bap_cai',   group: 'rau_cu_qua', nameEn: 'Cabbage',      desc: 'Dùng luộc, xào, nấu canh, cuốn hoặc làm salad.',                                  img: 'Cabbage.jpg',              allergen: '' },
  { name: 'Rau bina',  code: 'rau_bina',  group: 'rau_la',     nameEn: 'Spinach',      desc: 'Dùng cho canh, xào, mì, trứng và các món ăn nhanh.',                              img: 'Spinach.jpg',              allergen: '' },
  { name: 'Rau muống', code: 'rau_muong', group: 'rau_la',     nameEn: 'Water spinach', desc: 'Nguyên liệu phổ biến để xào tỏi, luộc hoặc nấu canh.',                           img: 'Water%20spinach.jpg',      allergen: '' },
  { name: 'Rau mùi',   code: 'rau_mui',   group: 'rau_thom',   nameEn: 'Coriander',    desc: 'Dùng làm rau thơm cho phở, bún, canh và nhiều món Việt.',                        img: 'Coriander.jpg',            allergen: '' },
  { name: 'Sả',        code: 'sa',        group: 'gia_vi',     nameEn: 'Lemongrass',   desc: 'Tạo mùi thơm cho món nướng, kho, xào, cà ri và bún bò.',                         img: 'Lemongrass.jpg',           allergen: '' },
  { name: 'Cà tím',    code: 'ca_tim',    group: 'rau_cu_qua', nameEn: 'Eggplant',     desc: 'Dùng nướng, chiên, xào, kho và nấu canh.',                                        img: 'Eggplant.jpg',             allergen: '' },
  { name: 'Thịt heo',  code: 'thit_heo',  group: 'thit',       nameEn: 'Pork',         desc: 'Nguyên liệu phổ biến cho món kho, luộc, nướng, xào và bún phở.',                 img: 'Pork.jpg',                 allergen: '' },
  { name: 'Thịt bò',   code: 'thit_bo',   group: 'thit',       nameEn: 'Beef',         desc: 'Dùng cho phở, bò xào, bò kho, nướng và các món hầm.',                            img: 'Beef.jpg',                 allergen: '' },
  { name: 'Thịt gà',   code: 'thit_ga',   group: 'thit',       nameEn: 'Chicken',      desc: 'Dùng luộc, chiên, nướng, xào, kho và nấu súp.',                                  img: 'Chicken.jpg',              allergen: '' },
  { name: 'Tôm',       code: 'tom',       group: 'hai_san',    nameEn: 'Shrimp',       desc: 'Dùng trong món xào, hấp, chiên, canh, cháo và bún.',                              img: 'Shrimp.jpg',               allergen: 'seafood' },
  { name: 'Cá',        code: 'ca',        group: 'hai_san',    nameEn: 'Fish',         desc: 'Dùng kho, chiên, hấp, nướng, nấu canh và làm món nước.',                          img: 'Fish.jpg',                 allergen: 'fish' },
  { name: 'Trứng gà',  code: 'trung_ga',  group: 'trung',      nameEn: 'Egg',          desc: 'Nguyên liệu đa dụng cho chiên, luộc, hấp, xào và làm bánh.',                     img: 'Egg.jpg',                  allergen: 'egg' },
  { name: 'Đậu phụ',   code: 'dau_phu',   group: 'dam_thuc_vat', nameEn: 'Tofu',       desc: 'Dùng chiên, sốt, kho, nấu canh và các món chay.',                                img: 'Tofu.jpg',                 allergen: 'soy' },
  { name: 'Nấm',       code: 'nam',       group: 'rau_cu_qua', nameEn: 'Mushroom',     desc: 'Dùng xào, nấu canh, lẩu, súp và món chay.',                                      img: 'Mushroom.jpg',             allergen: '' },
  { name: 'Gạo',       code: 'gao',       group: 'ngu_coc',    nameEn: 'Rice',         desc: 'Nguyên liệu nền cho cơm, cháo, xôi, bún, bánh và nhiều món Việt.',               img: 'Rice.jpg',                 allergen: '' },
  { name: 'Đậu phộng', code: 'dau_phong', group: 'hat',        nameEn: 'Peanut',       desc: 'Dùng rang, giã làm muối đậu, rắc lên món ăn hoặc làm nước sốt.',                 img: 'Peanut.jpg',               allergen: 'nut' },
  { name: 'Tiêu đen',  code: 'tieu_den',  group: 'gia_vi',     nameEn: 'Black pepper', desc: 'Tạo mùi thơm cay cho món kho, xào, súp, ướp thịt và nước chấm.',                 img: 'Black%20pepper.jpg',       allergen: '' },
  { name: 'Nước mắm',  code: 'nuoc_mam',  group: 'gia_vi',     nameEn: 'Fish sauce',   desc: 'Gia vị đặc trưng Việt Nam cho ướp, nêm và pha nước chấm.',                       img: 'Fish%20sauce.jpg',         allergen: 'fish' },
  { name: 'Nước tương',code: 'nuoc_tuong', group: 'gia_vi',    nameEn: 'Soy sauce',    desc: 'Dùng làm gia vị nêm, nước chấm và sốt cho món xào/kho.',                         img: 'Soy%20sauce.jpg',          allergen: 'soy' },
  { name: 'Đường',     code: 'duong',     group: 'gia_vi',     nameEn: 'Sugar',        desc: 'Tạo vị ngọt, cân bằng vị trong nước chấm, kho, xào và món tráng miệng.',         img: 'Sugar.jpg',                allergen: '' },
  { name: 'Muối',      code: 'muoi',      group: 'gia_vi',     nameEn: 'Salt',         desc: 'Gia vị nền để nêm và điều chỉnh vị cho hầu hết món ăn.',                         img: 'Salt.jpg',                 allergen: '' },
]

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Download ảnh từ URL, trả về Buffer */
function downloadImage(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http
    const req = client.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Mogu-Seed/1.0)' },
      timeout: 15000,
    }, res => {
      // Xử lý redirect
      if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307) {
        return downloadImage(res.headers.location).then(resolve).catch(reject)
      }
      if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`))
      const chunks = []
      res.on('data', c => chunks.push(c))
      res.on('end', () => resolve(Buffer.concat(chunks)))
      res.on('error', reject)
    })
    req.on('error', reject)
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')) })
  })
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)) }

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  // Đảm bảo bucket tồn tại
  const { data: buckets } = await supabase.storage.listBuckets()
  const bucketExists = buckets?.some(b => b.name === BUCKET)
  if (!bucketExists) {
    await supabase.storage.createBucket(BUCKET, { public: true })
    console.log(`✅ Created bucket: ${BUCKET}`)
  } else {
    console.log(`📦 Bucket exists: ${BUCKET}`)
  }

  let success = 0, skipped = 0, failed = 0

  for (const ing of INGREDIENTS) {
    process.stdout.write(`\n[${INGREDIENTS.indexOf(ing) + 1}/30] ${ing.name} (${ing.nameEn})... `)

    // Kiểm tra đã tồn tại chưa
    const existing = await prisma.ingredient.findUnique({ where: { code: ing.code } })
    if (existing) {
      console.log('⏭  Đã tồn tại — bỏ qua')
      skipped++
      continue
    }

    // Tạo ingredient record
    let record
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
      process.stdout.write(`✅ created(${record.id.slice(0,8)}) `)
    } catch (e) {
      console.log(`❌ DB error: ${e.message}`)
      failed++
      continue
    }

    // Download ảnh
    const imgUrl = `https://commons.wikimedia.org/wiki/Special:FilePath/${ing.img}`
    let imgBuffer, mimeType = 'image/jpeg'
    try {
      imgBuffer = await downloadImage(imgUrl)
      if (ing.img.endsWith('.png') || ing.img.toLowerCase().includes('.png')) mimeType = 'image/png'
      process.stdout.write(`📥 downloaded(${Math.round(imgBuffer.length / 1024)}KB) `)
    } catch (e) {
      console.log(`⚠️  Download lỗi: ${e.message}`)
      success++
      continue
    }

    // Upload lên Supabase Storage
    const ext = mimeType === 'image/png' ? 'png' : 'jpg'
    const storagePath = `${record.id}/cover.${ext}`
    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, imgBuffer, { contentType: mimeType, upsert: true })

    if (upErr) {
      console.log(`⚠️  Upload lỗi: ${upErr.message}`)
      success++
      continue
    }

    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(storagePath)
    const publicUrl = urlData.publicUrl

    // Cập nhật imageUrl
    await prisma.ingredient.update({
      where: { id: record.id },
      data: { imageUrl: publicUrl, imageKey: storagePath },
    })
    process.stdout.write(`🖼️  ${publicUrl.slice(0, 60)}...`)
    success++

    // Delay nhẹ để tránh rate-limit
    await delay(300)
  }

  console.log('\n\n─────────────────────────────────────────')
  console.log(`✅ Thành công: ${success}`)
  console.log(`⏭  Bỏ qua:    ${skipped}`)
  console.log(`❌ Thất bại:  ${failed}`)
  console.log('🎉 Hoàn tất seed 30 nguyên liệu!')
}

main()
  .catch(e => { console.error('\nFATAL:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
