import { createClient } from '@supabase/supabase-js'

const supabaseUrl =
  (import.meta.env.VITE_SUPABASE_URL as string) ||
  'https://lkqvyvllmrbxgaoqrkhd.supabase.co'
const supabaseAnonKey =
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string) ||
  'sb_publishable_g3vbNIQNJ4uMPLCHwq2n6A_FcZNMU7Q'

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('[Supabase] VITE_SUPABASE_URL hoặc VITE_SUPABASE_ANON_KEY chưa được cấu hình.')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storageKey: 'mogu-admin-auth',
  },
})
