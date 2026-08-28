import { PrismaClient } from '../generated/prisma';

const p = new PrismaClient();

async function main() {
  const jobs = await p.importJob.findMany({
    where: { status: 'FAILED' },
    orderBy: { createdAt: 'desc' },
    take: 6,
    select: { id: true, query: true, status: true, currentStep: true, error: true, logs: true },
  });

  for (const j of jobs) {
    console.log(`\n=== ${j.query} ===`);
    console.log(`Step: ${j.currentStep} | Error: ${j.error}`);
    const logs = j.logs as any[];
    if (Array.isArray(logs)) {
      logs.slice(-4).forEach((l: any) => {
        console.log(`  [${l.step}] ${l.status}: ${l.message}`);
      });
    }
  }

  await p.$disconnect();
}

main().catch((e) => { console.error(e.message); process.exit(1); });
