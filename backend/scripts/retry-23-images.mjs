/**
 * Retry upload ảnh cho các nguyên liệu bị thiếu (429 / 404)
 * Dùng mix Pexels + Wikipedia với delay lớn hơn
 */

import { readFileSync } from 'fs'
import { createClient } from '@supabase/supabase-js'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'
import https from 'https'

const env = readFileSync('.env.local', 'utf-8')
for (const l of env.split('\n')) {
  const t = l.trim()
  if (t && !t.startsWith('#')) { const i = t.indexOf('='); if (i > 0) process.env[t.slice(0, i).trim()] = t.slice(i + 1).trim() }
}

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })
const BUCKET = 'ingredient-images'

// Danh sách nguyên liệu thiếu ảnh — dùng URL đã verify
const MISSING = [
  { code: 'bap_bo',       pexels: 'https://images.pexels.com/photos/8753379/pexels-photo-8753379.jpeg?w=400' },
  { code: 'dau_an',       pexels: 'https://images.pexels.com/photos/1458694/pexels-photo-1458694.jpeg?w=400' },
  { code: 'dau_dieu',     pexels: 'https://images.pexels.com/photos/8753379/pexels-photo-8753379.jpeg?w=400&fallback=annatto' },
  { code: 'dau_hao',      pexels: 'https://images.pexels.com/photos/4871261/pexels-photo-4871261.jpeg?w=400' },
  { code: 'gio_heo',      pexels: 'https://images.pexels.com/photos/323682/pexels-photo-323682.jpeg?w=400' },
  { code: 'hanh_la',      pexels: 'https://images.pexels.com/photos/207980/pexels-photo-207980.jpeg?w=400' },
  { code: 'hoa_hoi',      pexels: 'https://images.pexels.com/photos/1739855/pexels-photo-1739855.jpeg?w=400' },
  { code: 'mam_ruoc_hue', pexels: 'https://images.pexels.com/photos/2347311/pexels-photo-2347311.jpeg?w=400' },
  { code: 'mi_trung',     pexels: 'https://images.pexels.com/photos/3026804/pexels-photo-3026804.jpeg?w=400' },
  { code: 'que',          pexels: 'https://images.pexels.com/photos/277253/pexels-photo-277253.jpeg?w=400' },
  { code: 'rau_song_gia', pexels: 'https://images.pexels.com/photos/3763847/pexels-photo-3763847.jpeg?w=400' },
  { code: 'thao_qua',     pexels: 'https://images.pexels.com/photos/1340116/pexels-photo-1340116.jpeg?w=400' },
  // Dầu điều dùng URL thay thế (annatto seeds)
  { code: 'dau_dieu', pexels: 'https://images.pexels.com/photos/5945752/pexels-photo-5945752.jpeg?w=400', skipIfHas: true },
]

function downloadBuffer(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
      timeout: 20000,
    }, res => {
      if ([301, 302, 307, 308].includes(res.statusCode)) return downloadBuffer(res.headers.location).then(resolve).catch(reject)
      if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`))
      const chunks = []; const ct = res.headers['content-type'] || 'image/jpeg'
      res.on('data', c => chunks.push(c))
      res.on('end', () => resolve({ buffer: Buffer.concat(chunks), contentType: ct }))
      res.on('error', reject)
    })
    req.on('error', reject)
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')) })
  })
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)) }

async function main() {
  let ok = 0, fail = 0

  // Deduplicate by code
  const seen = new Set()
  const unique = MISSING.filter(m => { if (seen.has(m.code)) return false; seen.add(m.code); return true })

  for (let i = 0; i < unique.length; i++) {
    const item = unique[i]
    process.stdout.write(`[${i + 1}/${unique.length}] ${item.code}... `)

    const record = await prisma.ingredient.findUnique({ where: { code: item.code } })
    if (!record) { console.log('Not found'); fail++; continue }
    if (record.imageUrl) { console.log('Has image already'); ok++; continue }

    let imgData
    try {
      imgData = await downloadBuffer(item.pexels)
      process.stdout.write(`${Math.round(imgData.buffer.length / 1024)}KB `)
    } catch (e) {
      console.log(`FAIL: ${e.message}`)
      fail++
      await delay(2000)
      continue
    }

    const ext = imgData.contentType.includes('png') ? 'png' : 'jpg'
    const storagePath = `${record.id}/cover.${ext}`
    const { error: upErr } = await supabase.storage.from(BUCKET).upload(storagePath, imgData.buffer, { contentType: imgData.contentType, upsert: true })
    if (upErr) { console.log(`Upload ERR: ${upErr.message}`); fail++; continue }

    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(storagePath)
    await prisma.ingredient.update({ where: { id: record.id }, data: { imageUrl: urlData.publicUrl, imageKey: storagePath } })
    console.log('OK')
    ok++
    await delay(500)
  }

  console.log(`\nOK: ${ok}  FAIL: ${fail}`)
}

main().catch(e => { console.error('FATAL:', e); process.exit(1) }).finally(() => prisma.$disconnect())
