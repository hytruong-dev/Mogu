import { readFileSync } from 'fs'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'

const envContent = readFileSync('.env.local', 'utf-8')
for (const line of envContent.split('\n')) {
  const trimmed = line.trim()
  if (trimmed && !trimmed.startsWith('#')) {
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx > 0) process.env[trimmed.substring(0, eqIdx).trim()] = trimmed.substring(eqIdx + 1).trim()
  }
}
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })

const items = await prisma.ingredient.findMany({ select: { code: true, name: true, imageUrl: true } })
const withImg = items.filter(i => i.imageUrl)
const noImg = items.filter(i => !i.imageUrl)

console.log(`📊 Tổng nguyên liệu: ${items.length}`)
console.log(`🖼️  Có ảnh: ${withImg.length}`)
console.log(`❌ Không có ảnh: ${noImg.length}`)
if (noImg.length) console.log('   Danh sách:', noImg.map(i => i.code).join(', '))
else console.log('✅ Tất cả đều có ảnh!')

await prisma.$disconnect()
