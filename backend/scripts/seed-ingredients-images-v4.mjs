/**
 * Upload ảnh nguyên liệu từ nhiều nguồn stable thay thế
 * (Không phụ thuộc Wikimedia — dùng ảnh từ các CDN khác)
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

// Ảnh từ các nguồn miễn phí public domain (Unsplash, Pexels free tier, etc.)
const INGREDIENTS = [
  // Unsplash CDN free images (no auth needed for small sizes)
  { code: 'khoai_tay', url: 'https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=400&q=80&fit=crop' },
  { code: 'ot',        url: 'https://images.unsplash.com/photo-1518461564688-20a00c0a3b57?w=400&q=80&fit=crop' },
  { code: 'chanh_vang',url: 'https://images.unsplash.com/photo-1587246873200-0cc069be93f1?w=400&q=80&fit=crop' },
  { code: 'chanh_xanh',url: 'https://images.unsplash.com/photo-1562051138-e7b82f5fb8ea?w=400&q=80&fit=crop' },
  { code: 'bap_cai',   url: 'https://images.unsplash.com/photo-1594282486552-05b4d80fbb9f?w=400&q=80&fit=crop' },
  { code: 'rau_muong', url: 'https://images.unsplash.com/photo-1576045057995-568f588f82fb?w=400&q=80&fit=crop' },
  { code: 'ca_tim',    url: 'https://images.unsplash.com/photo-1548506819-4e9c3e5c5e63?w=400&q=80&fit=crop' },
  { code: 'thit_ga',   url: 'https://images.unsplash.com/photo-1604503468506-a8da13d11d36?w=400&q=80&fit=crop' },
  { code: 'tom',       url: 'https://images.unsplash.com/photo-1565680018434-b513d5e5fd47?w=400&q=80&fit=crop' },
  { code: 'trung_ga',  url: 'https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f?w=400&q=80&fit=crop' },
  { code: 'dau_phu',   url: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=400&q=80&fit=crop' },
  { code: 'nam',       url: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400&q=80&fit=crop' },
  { code: 'nuoc_mam',  url: 'https://images.unsplash.com/photo-1615485500704-8e990f9900f7?w=400&q=80&fit=crop' },
  { code: 'nuoc_tuong',url: 'https://images.unsplash.com/photo-1584277261846-c6a1672ed979?w=400&q=80&fit=crop' },
]

function downloadBuffer(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http
    const req = client.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'image/webp,image/jpeg,image/*',
      },
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

function delay(ms) { return new Promise(r => setTimeout(r, ms)) }

async function main() {
  let ok = 0, fail = 0

  for (let i = 0; i < INGREDIENTS.length; i++) {
    const ing = INGREDIENTS[i]
    process.stdout.write(`[${i + 1}/${INGREDIENTS.length}] ${ing.code}... `)

    const record = await prisma.ingredient.findUnique({ where: { code: ing.code } })
    if (!record) { console.log('⚠️  Không tìm thấy'); fail++; continue }
    if (record.imageUrl) { console.log('⏭  Đã có ảnh'); ok++; continue }

    await delay(500)

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

    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, data.buffer, { contentType: data.contentType, upsert: true })

    if (upErr) { console.log(`❌ Upload: ${upErr.message}`); fail++; continue }

    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(storagePath)
    await prisma.ingredient.update({
      where: { id: record.id },
      data: { imageUrl: urlData.publicUrl, imageKey: storagePath },
    })
    console.log(`✅`)
    ok++
  }

  console.log(`\n✅ OK: ${ok}  ❌ Fail: ${fail}`)
  if (fail === 0) console.log('🎉 Tất cả ảnh đã được upload!')
}

main()
  .catch(e => { console.error('FATAL:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
