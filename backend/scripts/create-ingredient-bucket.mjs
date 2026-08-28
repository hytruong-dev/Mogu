import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://lkqvyvllmrbxgaoqrkhd.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxrcXZ5dmxsbXJieGdhb3Fya2hkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NjM1MTgyOCwiZXhwIjoyMTAxOTI3ODI4fQ.A6nsyhZg2GI4PuCZZgSAKCXtceBoB3RvzW-RdRdmqqw',
)

const { data, error } = await supabase.storage.createBucket('ingredient-images', {
  public: true,
  fileSizeLimit: 5 * 1024 * 1024, // 5MB
  allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
})

if (error && !error.message.includes('already exists')) {
  console.error('❌ Error:', error.message)
} else {
  console.log('✅ Bucket ingredient-images OK')
}
