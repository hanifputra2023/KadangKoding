import { createClient as createSupabaseClient } from '@supabase/supabase-js'

/**
 * Client server-side dengan Service Role Key (bypass RLS).
 * HANYA dipakai untuk operasi background/admin yang butuh akses penuh
 * (mis. cron auto-expire) dan TIDAK boleh dipakai dari client/browser.
 * Membutuhkan env `SUPABASE_SERVICE_ROLE_KEY`.
 */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createSupabaseClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
