import { readFileSync } from 'fs'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'
const env = readFileSync('.env.local', 'utf-8')
for (const l of env.split('\n')) { const t = l.trim(); if (t && !t.startsWith('#')) { const i = t.indexOf('='); if (i > 0) process.env[t.slice(0, i).trim()] = t.slice(i + 1).trim() } }
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })
const dishes = await prisma.dish.findMany({ select: { id: true, name: true } })
dishes.forEach(d => console.log(d.id.slice(0,8), '|', d.name))
await prisma.$disconnect()
