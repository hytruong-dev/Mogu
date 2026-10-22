import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

async function check() {
  const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data: buckets, error } = await supabase.storage.listBuckets();
  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Buckets:', buckets?.map(b => ({ name: b.name, public: b.public })));
  }
}
check();
