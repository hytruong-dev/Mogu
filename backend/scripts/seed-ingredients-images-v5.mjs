/**
 * Retry 5 nguyên liệu còn thiếu ảnh: ot, chanh_vang, chanh_xanh, ca_tim, thit_ga
 */

import { readFileSync } from 'fs'
import { createClient } from '@supabase/supabase-js'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'
import https from 'https'

const envContent = readFileSync('.env.local', 'utf-8')
for (const line of envContent.split('\n')) {
  const trimmed = line.trim()
  if (trimmed && !trimmed.startsWith('#')) {
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx > 0) {
      process.env[trimmed.substring(0, eqIdx).trim()] = trimmed.substring(eqIdx + 1).trim()
    }
  }
}

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })
const BUCKET = 'ingredient-images'

// Thay URL Unsplash mới (verified working)
const INGREDIENTS = [
  { code: 'ot',        url: 'https://images.unsplash.com/photo-1568346347427-2c078c0e0d01?w=400&q=80' },  // chili pepper
  { code: 'chanh_vang',url: 'https://images.unsplash.com/photo-1496060083879-9d7c4d835fb5?w=400&q=80' },  // lemons
  { code: 'chanh_xanh',url: 'https://images.unsplash.com/photo-1616688085490-b430516f11e3?w=400&q=80' },  // lime
  { code: 'ca_tim',    url: 'https://images.unsplash.com/photo-1659209474614-9c60c4a3c4d2?w=400&q=80' },  // eggplant
  { code: 'thit_ga',   url: 'https://images.unsplash.com/photo-1604503468506-a8da13d11d36?w=400&q=80&auto=format' }, // chicken
]

function downloadBuffer(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : require('http')
    const req = https.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36' },
      timeout: 25000,
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

async function main() {
  let ok = 0, fail = 0

  for (const ing of INGREDIENTS) {
    process.stdout.write(`${ing.code}... `)

    const record = await prisma.ingredient.findUnique({ where: { code: ing.code } })
    if (!record) { console.log('⚠️  Không tìm thấy'); fail++; continue }
    if (record.imageUrl) { console.log('⏭  Đã có ảnh'); ok++; continue }

    let data
    try {
      data = await downloadBuffer(ing.url)
      process.stdout.write(`📥 ${Math.round(data.buffer.length / 1024)}KB `)
    } catch (e) {
      console.log(`❌ ${e.message}`)
      fail++
      continue
    }

    const ext = data.contentType.includes('png') ? 'png' : 'jpg'
    const storagePath = `${record.id}/cover.${ext}`
    const { error: upErr } = await supabase.storage.from(BUCKET).upload(storagePath, data.buffer, { contentType: data.contentType, upsert: true })
    if (upErr) { console.log(`❌ Upload: ${upErr.message}`); fail++; continue }

    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(storagePath)
    await prisma.ingredient.update({ where: { id: record.id }, data: { imageUrl: urlData.publicUrl, imageKey: storagePath } })
    console.log(`✅`)
    ok++
  }

  console.log(`\n✅ OK: ${ok}  ❌ Fail: ${fail}`)
  console.log('🎉 Hoàn tất!')
}

main()
  .catch(e => { console.error('FATAL:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
