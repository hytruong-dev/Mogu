/**
 * Liệt kê các nguyên liệu trong món ăn chưa match với bảng Ingredient (ingredientId = null)
 */

import { readFileSync, writeFileSync } from 'fs'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'

const env = readFileSync('.env.local', 'utf-8')
for (const l of env.split('\n')) {
  const t = l.trim()
  if (t && !t.startsWith('#')) {
    const i = t.indexOf('=')
    if (i > 0) process.env[t.slice(0, i).trim()] = t.slice(i + 1).trim()
  }
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })

const dishes = await prisma.dish.findMany({
  include: {
    dishIngredients: {
      include: { ingredient: { select: { name: true } } },
      orderBy: { sortOrder: 'asc' },
    },
  },
})

const lines = []

lines.push('NGUYÊN LIỆU TRONG MÓN ĂN CHƯA CÓ TRONG DB INGREDIENT')
lines.push('='.repeat(60))
lines.push('')

const allMissing = new Map()

for (const dish of dishes) {
  const missing = dish.dishIngredients.filter(i => !i.ingredientId)
  if (missing.length === 0) continue

  lines.push(`[MON] ${dish.name}`)
  for (const ing of missing) {
    lines.push(`  THIEU: ${ing.rawText}  (qty: ${ing.quantity ?? '?'} ${ing.unit ?? ''})  prep: ${ing.preparation ?? ''}`)
    if (!allMissing.has(ing.rawText)) allMissing.set(ing.rawText, new Set())
    allMissing.get(ing.rawText).add(dish.name)
  }
  lines.push('')
}

lines.push('='.repeat(60))
lines.push(`TONG HOP: ${allMissing.size} NGUYEN LIEU CHUA CO TRONG DB`)
lines.push('='.repeat(60))
lines.push('')

const sorted = [...allMissing.entries()].sort((a, b) => a[0].localeCompare(b[0], 'vi'))
sorted.forEach(([name, dishSet]) => {
  lines.push(`  MISSING: ${name}  |  Dung trong: ${[...dishSet].join(', ')}`)
})

lines.push('')
lines.push('DA CO TRONG DB:')
const matched = dishes.flatMap(d => d.dishIngredients.filter(i => i.ingredientId))
const matchedNames = [...new Set(matched.map(i => i.rawText))]
matchedNames.sort((a, b) => a.localeCompare(b, 'vi')).forEach(n => lines.push(`  OK: ${n}`))

const output = lines.join('\n')
writeFileSync('scripts/missing-report.txt', output, 'utf-8')
console.log('Written to scripts/missing-report.txt')

await prisma.$disconnect()
