import { createClient } from '@/lib/supabase/server'
import { requireUser, jsonError, jsonOk } from '@/lib/helpers'

/**
 * GET /api/warung/profile
 * Mengambil profil warung milik user yang sedang login.
 */
export async function GET() {
  const sb = await createClient()
  const { user, error } = await requireUser(sb, 'warung')
  if (error) return error

  const { data: warung, error: wErr } = await sb
    .from('warung_profiles')
    .select('id, business_name, address, latitude, longitude')
    .eq('user_id', user.id)
    .single()

  if (wErr) return jsonError('Profil warung tidak ditemukan: ' + wErr.message, 404)

  return jsonOk({ warung })
}
