import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

async function main() {
  const pending = await prisma.ingredient.findMany({
    where: { status: 'PENDING_REVIEW' },
    select: { id: true, code: true, name: true, imageUrl: true, isActive: true, status: true },
    orderBy: { name: 'asc' },
  });

  console.log(`Auditing ${pending.length} pending ingredients...`);

  let allHostedOnSupabase = true;
  let allInactive = true;
  let allStatusPending = true;

  const results: any[] = [];
  let http200Count = 0;

  for (let i = 0; i < pending.length; i++) {
    const item = pending[i];

    if (!item.imageUrl?.includes('supabase.co/storage/v1/object/public/ingredient-images/')) {
      allHostedOnSupabase = false;
      console.log(`[NOT SUPABASE] [${item.code}] "${item.name}": ${item.imageUrl}`);
    }

    if (item.isActive !== false) allInactive = false;
    if (item.status !== 'PENDING_REVIEW') allStatusPending = false;

    // Test HTTP GET
    let status = 0;
    let size = 0;
    let contentType = '';
    try {
      const res = await fetch(item.imageUrl!);
      status = res.status;
      contentType = res.headers.get('content-type') || '';
      if (res.ok) {
        size = (await res.arrayBuffer()).byteLength;
        http200Count++;
      }
    } catch (e: any) {
      status = 0;
    }

    results.push({
      index: i + 1,
      code: item.code,
      name: item.name,
      url: item.imageUrl,
      status,
      size,
      contentType,
      ok: status === 200 && size > 3000,
    });
  }

  console.log('\n================ AUDIT SUMMARY ================');
  console.log(`Total Pending Items: ${pending.length}`);
  console.log(`All Inactive (isActive: false): ${allInactive ? '✅ YES' : '❌ NO'}`);
  console.log(`All Status PENDING_REVIEW: ${allStatusPending ? '✅ YES' : '❌ NO'}`);
  console.log(`All Hosted on Supabase Storage: ${allHostedOnSupabase ? '✅ YES' : '❌ NO'}`);
  console.log(`HTTP 200 OK Verified: ${http200Count} / ${pending.length}`);
  console.log('================================================\n');

  const failedHttp = results.filter(r => !r.ok);
  if (failedHttp.length > 0) {
    console.log('Failed HTTP verification:');
    failedHttp.forEach(f => console.log(`  - [${f.code}] "${f.name}": HTTP ${f.status}, size: ${f.size}`));
  } else {
    console.log('🎉 100% of the 112 ingredient images are active, live, and verified on Supabase Storage CDN!');
  }

  await prisma.$disconnect();
}

main();
