import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import * as dotenv from 'dotenv'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

const adapter = new PrismaPg({ connectionString: process.env.DIRECT_URL! })
const prisma = new PrismaClient({ adapter })

async function inspectData() {
  const [
    randomHistories,
    foodScans,
    diaryLogs,
    savedDishes,
    exploreEvents,
    refreshSessions,
    authLogs,
    articles,
    articleLikes,
    articleComments,
    profiles,
    accounts,
  ] = await Promise.all([
    prisma.randomHistory.count(),
    prisma.foodScanEvent.count(),
    prisma.diaryMealLog.count().catch(() => 0),
    prisma.savedDish.count(),
    prisma.exploreEngagementEvent.count(),
    prisma.refreshSession.count(),
    prisma.authAuditLog.count(),
    prisma.article.count(),
    prisma.articleLike.count(),
    prisma.articleComment.count(),
    prisma.profile.count(),
    prisma.account.count(),
  ])

  console.log({
    randomHistories,
    foodScans,
    diaryLogs,
    savedDishes,
    exploreEvents,
    refreshSessions,
    authLogs,
    articles,
    articleLikes,
    articleComments,
    profiles,
    accounts,
  })

  // Sample timestamps of randomHistories
  const sampleSpins = await prisma.randomHistory.findMany({
    take: 5,
    select: { id: true, userId: true, createdAt: true, mealSlot: true, durationMs: true, attemptNo: true },
    orderBy: { createdAt: 'desc' },
  })
  console.log('Sample spins:', sampleSpins)

  // Sample timestamps of food scans
  const sampleScans = await prisma.foodScanEvent.findMany({
    take: 5,
    select: { id: true, userId: true, createdAt: true, latencyMs: true, correct: true },
    orderBy: { createdAt: 'desc' },
  })
  console.log('Sample scans:', sampleScans)

  // Sample accounts
  const sampleAccounts = await prisma.account.findMany({
    take: 10,
    select: { id: true, username: true, userId: true, lastLoginAt: true, createdAt: true },
  })
  console.log('Sample accounts:', sampleAccounts)
}

inspectData().finally(() => prisma.$disconnect())
