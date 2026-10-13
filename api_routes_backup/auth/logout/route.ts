import { createClient } from '@/lib/supabase/server'
import { jsonOk } from '@/lib/helpers'

/**
 * POST /api/auth/logout
 * Membatalkan sesi pengguna.
 */
export async function POST() {
  const sb = await createClient()
  await sb.auth.signOut()
  return jsonOk({ message: 'Logout berhasil' })
}
