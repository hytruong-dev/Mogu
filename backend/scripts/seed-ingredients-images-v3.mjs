/**
 * Retry upload ảnh — dùng direct upload.wikimedia.org URL
 * (bỏ qua bước redirect từ commons.wikimedia.org)
 */

import { readFileSync } from 'fs'
import { createClient } from '@supabase/supabase-js'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'
import https from 'https'

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

// Direct upload.wikimedia.org URLs — không qua redirect
// Source từ Wikipedia REST API thumbnail responses (đã resolve)
const INGREDIENTS = [
  { code: 'khoai_tay', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Potato_and_cross_section.jpg/320px-Potato_and_cross_section.jpg' },
  { code: 'ot',        url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b1/Cayenne_pepper.jpg/320px-Cayenne_pepper.jpg' },
  { code: 'chanh_vang',url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b4/Lemons.jpg/320px-Lemons.jpg' },
  { code: 'chanh_xanh',url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9d/Lime-Whole-Split.jpg/320px-Lime-Whole-Split.jpg' },
  { code: 'bap_cai',   url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6d/Brassica_oleracea_var_capitata_f_rubra.jpg/320px-Brassica_oleracea_var_capitata_f_rubra.jpg' },
  { code: 'rau_muong', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b8/Ipomoea_aquatica_in_a_field.JPG/320px-Ipomoea_aquatica_in_a_field.JPG' },
  { code: 'ca_tim',    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/67/Solanum_melongena.jpg/320px-Solanum_melongena.jpg' },
  { code: 'thit_ga',   url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a4/Poultry_cut_chicken_back.jpg/320px-Poultry_cut_chicken_back.jpg' },
  { code: 'tom',       url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3d/Shrimps.jpg/320px-Shrimps.jpg' },
  { code: 'trung_ga',  url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8c/Egg_1_%281%29.png/320px-Egg_1_%281%29.png' },
  { code: 'dau_phu',   url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b0/Tofu_by_Jpatokal.jpg/320px-Tofu_by_Jpatokal.jpg' },
  { code: 'nam',       url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4a/Button_mushrooms.jpg/320px-Button_mushrooms.jpg' },
  { code: 'nuoc_mam',  url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/41/Fish_sauce_03.jpg/320px-Fish_sauce_03.jpg' },
  { code: 'nuoc_tuong',url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1u/Soy_sauce_by_the_book_%28_The_Joy_of_Cooking_%29.jpg/320px-Soy_sauce_by_the_book_%28_The_Joy_of_Cooking_%29.jpg' },
]

function downloadBuffer(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Mogu/1.0; +https://mogu.app)',
        'Referer': 'https://en.wikipedia.org/',
      },
      timeout: 20000,
    }, res => {
      if ([301, 302, 307, 308].includes(res.statusCode)) {
        return downloadBuffer(res.headers.location).then(resolve).catch(reject)
      }
      if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`))
      const chunks = []
      res.on('data', c => chunks.push(c))
      res.on('end', () => resolve({ buffer: Buffer.concat(chunks), contentType: res.headers['content-type'] || 'image/jpeg' }))
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

    await delay(1500)

    let data
    try {
      data = await downloadBuffer(ing.url)
      process.stdout.write(`📥 ${Math.round(data.buffer.length / 1024)}KB `)
    } catch (e) {
      console.log(`❌ ${e.message}`)
      fail++
      await delay(3000)
      continue
    }

    const ext = data.contentType.includes('png') || ing.url.toLowerCase().includes('.png') ? 'png' : 'jpg'
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
}

main()
  .catch(e => { console.error('FATAL:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
