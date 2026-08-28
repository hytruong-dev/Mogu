/**
 * Retry upload ảnh cho 27 nguyên liệu bị 429 ở lần đầu
 * Chạy từng cái với delay 3s để tránh rate-limit Wikimedia
 */

import { readFileSync } from 'fs'
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

// Chỉ những cái chưa có ảnh
const INGREDIENTS = [
  { code: 'ca_rot',     img: 'CARROT.jpg' },
  { code: 'khoai_tay', img: 'Potato.jpg' },
  { code: 'hanh_tay',  img: 'Onion.jpg' },
  { code: 'toi',       img: 'Garlic.jpg' },
  { code: 'gung',      img: '-%20Ginger%20-.jpg' },
  { code: 'ot',        img: 'Chilli%20pepper.jpg' },
  { code: 'chanh_vang',img: 'Lemon%20-%20whole%20and%20split.jpg' },
  { code: 'chanh_xanh',img: 'Lime.jpg' },
  { code: 'bap_cai',   img: 'Cabbage.jpg' },
  { code: 'rau_bina',  img: 'Spinach.jpg' },
  { code: 'rau_muong', img: 'Water%20spinach.jpg' },
  { code: 'rau_mui',   img: 'Coriander.jpg' },
  { code: 'sa',        img: 'Lemongrass.jpg' },
  { code: 'ca_tim',    img: 'Eggplant.jpg' },
  { code: 'thit_bo',   img: 'Beef.jpg' },
  { code: 'thit_ga',   img: 'Chicken.jpg' },
  { code: 'tom',       img: 'Shrimp.jpg' },
  { code: 'ca',        img: 'Fish.jpg' },
  { code: 'trung_ga',  img: 'Egg.jpg' },
  { code: 'dau_phu',   img: 'Tofu.jpg' },
  { code: 'nam',       img: 'Mushroom.jpg' },
  { code: 'gao',       img: 'Rice.jpg' },
  { code: 'dau_phong', img: 'Peanut.jpg' },
  { code: 'tieu_den',  img: 'Black%20pepper.jpg' },
  { code: 'nuoc_mam',  img: 'Fish%20sauce.jpg' },
  { code: 'nuoc_tuong',img: 'Soy%20sauce.jpg' },
  { code: 'duong',     img: 'Sugar.jpg' },
]

function downloadImage(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http
    const req = client.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Mogu-Seed/1.0)' },
      timeout: 20000,
    }, res => {
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

async function main() {
  let ok = 0, fail = 0
  const total = INGREDIENTS.length

  for (let i = 0; i < INGREDIENTS.length; i++) {
    const ing = INGREDIENTS[i]
    process.stdout.write(`[${i + 1}/${total}] ${ing.code}... `)

    // Lấy record
    const record = await prisma.ingredient.findUnique({ where: { code: ing.code } })
    if (!record) { console.log('⚠️  Không tìm thấy record'); fail++; continue }

    // Nếu đã có ảnh rồi thì bỏ qua
    if (record.imageUrl) { console.log('⏭  Đã có ảnh'); ok++; continue }

    // Delay trước download để tránh rate-limit
    await delay(2500)

    const imgUrl = `https://commons.wikimedia.org/wiki/Special:FilePath/${ing.img}`
    let imgBuffer
    try {
      imgBuffer = await downloadImage(imgUrl)
      process.stdout.write(`📥 ${Math.round(imgBuffer.length / 1024)}KB `)
    } catch (e) {
      console.log(`❌ Download: ${e.message}`)
      fail++
      await delay(5000) // wait thêm nếu bị 429
      continue
    }

    const storagePath = `${record.id}/cover.jpg`
    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, imgBuffer, { contentType: 'image/jpeg', upsert: true })

    if (upErr) { console.log(`❌ Upload: ${upErr.message}`); fail++; continue }

    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(storagePath)
    await prisma.ingredient.update({
      where: { id: record.id },
      data: { imageUrl: urlData.publicUrl, imageKey: storagePath },
    })
    console.log(`✅ ${urlData.publicUrl.slice(0, 60)}...`)
    ok++
  }

  console.log(`\n✅ OK: ${ok}  ❌ Fail: ${fail}`)
}

main()
  .catch(e => { console.error('FATAL:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
