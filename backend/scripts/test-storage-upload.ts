import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

async function main() {
  const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data, error } = await supabase.storage
    .from('ingredient-images')
    .upload('test-ping.jpg', Buffer.from([0xff, 0xd8, 0xff, 0xe0]), { contentType: 'image/jpeg', upsert: true });
  console.log('Upload result:', data, error);
}

main().catch(console.error);
