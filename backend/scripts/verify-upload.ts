import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

async function main() {
  // 1. Kiểm tra bucket tồn tại
  const { data: buckets, error: bucketsErr } = await supabase.storage.listBuckets();
  console.log('Buckets:', buckets?.map(b => b.name));
  if (bucketsErr) console.error('listBuckets error:', bucketsErr);

  // 2. Liệt kê files trong bucket dish-images
  const { data: files, error: listErr } = await supabase.storage
    .from('dish-images')
    .list('dishes', { limit: 20 });
  console.log('\nFolders in dish-images/dishes:', files?.map(f => f.name));
  if (listErr) console.error('list error:', listErr);

  // 3. Thử download 1 file để verify
  const dishId = 'b3ce33d8-8a47-426b-bfab-85abe14f54d0';
  const { data: dlData, error: dlErr } = await supabase.storage
    .from('dish-images')
    .download(`dishes/${dishId}/cover.png`);
  
  if (dlErr) {
    console.error('\nDownload error:', dlErr.message);
  } else {
    console.log('\n✅ File size:', dlData?.size, 'bytes — file accessible!');
  }

  // 4. Kiểm tra public URL
  const { data: urlData } = supabase.storage.from('dish-images').getPublicUrl(`dishes/${dishId}/cover.png`);
  console.log('Public URL:', urlData.publicUrl);
}

main().catch(console.error);
