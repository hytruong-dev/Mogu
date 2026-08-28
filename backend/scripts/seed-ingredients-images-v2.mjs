/**
 * Retry upload ảnh cho 27 nguyên liệu — dùng Wikipedia REST API thumbnail
 * thay vì Wikimedia Commons FilePath (tránh rate-limit IP)
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

// Map: code → Wikipedia search term để lấy thumbnail
const INGREDIENTS = [
  { code: 'ca_rot',     wiki: 'Carrot' },
  { code: 'khoai_tay', wiki: 'Potato' },
  { code: 'hanh_tay',  wiki: 'Onion' },
  { code: 'toi',       wiki: 'Garlic' },
  { code: 'gung',      wiki: 'Ginger' },
  { code: 'ot',        wiki: 'Chili_pepper' },
  { code: 'chanh_vang',wiki: 'Lemon' },
  { code: 'chanh_xanh',wiki: 'Lime_(fruit)' },
  { code: 'bap_cai',   wiki: 'Cabbage' },
  { code: 'rau_bina',  wiki: 'Spinach' },
  { code: 'rau_muong', wiki: 'Ipomoea_aquatica' },
  { code: 'rau_mui',   wiki: 'Coriander' },
  { code: 'sa',        wiki: 'Cymbopogon' },
  { code: 'ca_tim',    wiki: 'Eggplant' },
  { code: 'thit_bo',   wiki: 'Beef' },
  { code: 'thit_ga',   wiki: 'Chicken_as_food' },
  { code: 'tom',       wiki: 'Shrimp_as_food' },
  { code: 'ca',        wiki: 'Fish_as_food' },
  { code: 'trung_ga',  wiki: 'Egg_as_food' },
  { code: 'dau_phu',   wiki: 'Tofu' },
  { code: 'nam',       wiki: 'Mushroom' },
  { code: 'gao',       wiki: 'Rice' },
  { code: 'dau_phong', wiki: 'Peanut' },
  { code: 'tieu_den',  wiki: 'Black_pepper' },
  { code: 'nuoc_mam',  wiki: 'Fish_sauce' },
  { code: 'nuoc_tuong',wiki: 'Soy_sauce' },
  { code: 'duong',     wiki: 'Sugar' },
]

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http
    const req = client.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 Mogu-Seed/1.0 (contact@mogu.app)',
        'Accept': 'application/json',
      },
      timeout: 15000,
    }, res => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return fetchJson(res.headers.location).then(resolve).catch(reject)
      }
      if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`))
      let body = ''
      res.on('data', c => body += c)
      res.on('end', () => {
        try { resolve(JSON.parse(body)) } catch (e) { reject(e) }
      })
      res.on('error', reject)
    })
    req.on('error', reject)
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')) })
  })
}

function downloadBuffer(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http
    const req = client.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 Mogu-Seed/1.0' },
      timeout: 20000,
    }, res => {
      if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307) {
        return downloadBuffer(res.headers.location).then(resolve).catch(reject)
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

/** Lấy thumbnail URL từ Wikipedia REST API */
async function getWikipediaThumbnail(title) {
  const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`
  const json = await fetchJson(url)
  const thumb = json?.thumbnail?.source || json?.originalimage?.source
  if (!thumb) throw new Error('No thumbnail in API response')
  return thumb
}

async function main() {
  let ok = 0, fail = 0
  const total = INGREDIENTS.length

  for (let i = 0; i < INGREDIENTS.length; i++) {
    const ing = INGREDIENTS[i]
    process.stdout.write(`[${i + 1}/${total}] ${ing.code}... `)

    const record = await prisma.ingredient.findUnique({ where: { code: ing.code } })
    if (!record) { console.log('⚠️  Không tìm thấy record'); fail++; continue }
    if (record.imageUrl) { console.log('⏭  Đã có ảnh'); ok++; continue }

    // Lấy URL thumbnail từ Wikipedia
    let thumbUrl
    try {
      thumbUrl = await getWikipediaThumbnail(ing.wiki)
      process.stdout.write(`🔗 `)
    } catch (e) {
      console.log(`❌ API: ${e.message}`)
      fail++
      await delay(1000)
      continue
    }

    // Download ảnh
    let imgBuffer
    try {
      imgBuffer = await downloadBuffer(thumbUrl)
      process.stdout.write(`📥 ${Math.round(imgBuffer.length / 1024)}KB `)
    } catch (e) {
      console.log(`❌ Download: ${e.message}`)
      fail++
      await delay(1000)
      continue
    }

    // Xác định extension
    const ext = thumbUrl.includes('.png') ? 'png' : 'jpg'
    const mimeType = ext === 'png' ? 'image/png' : 'image/jpeg'
    const storagePath = `${record.id}/cover.${ext}`

    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, imgBuffer, { contentType: mimeType, upsert: true })

    if (upErr) { console.log(`❌ Upload: ${upErr.message}`); fail++; continue }

    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(storagePath)
    await prisma.ingredient.update({
      where: { id: record.id },
      data: { imageUrl: urlData.publicUrl, imageKey: storagePath },
    })
    console.log(`✅`)
    ok++

    await delay(800)
  }

  console.log(`\n─────────────────────────────────────────`)
  console.log(`✅ OK: ${ok}  ❌ Fail: ${fail}`)
  console.log('🎉 Hoàn tất!')
}

main()
  .catch(e => { console.error('FATAL:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
