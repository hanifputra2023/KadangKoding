import { createClient } from '@/lib/supabase/server'
import { getAuthedUser, jsonError, jsonOk } from '@/lib/helpers'

/**
 * GET /api/auth/me
 * Mengembalikan profil user yang sedang login (atau 401 bila belum login).
 */
export async function GET() {
  const sb = await createClient()
  const user = await getAuthedUser(sb)
  if (!user) return jsonError('Tidak terautentikasi', 401)

  return jsonOk({ user })
}
