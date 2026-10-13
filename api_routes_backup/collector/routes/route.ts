import { createClient } from '@/lib/supabase/server'
import { requireUser, jsonError, jsonOk } from '@/lib/helpers'

/**
 * GET /api/collector/routes
 * Menampilkan rute milik collector yang login (beserta titik singgahnya).
 * Opsional: ?status=active|completed|cancelled
 */
export async function GET(request: Request) {
  const sb = await createClient()
  const { user, error } = await requireUser(sb, 'collector')
  if (error) return error

  const { data: collector } = await sb
    .from('collector_profiles')
    .select('id')
    .eq('user_id', user.id)
    .single()
  if (!collector) return jsonError('Profil collector tidak ditemukan', 404)

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')

  let q = sb
    .from('routes')
    .select('*, route_stops(*, pickup_requests(*, warung_profiles(business_name, address), waste_categories(category_name)))')
    .eq('collector_id', collector.id)
    .order('created_at', { ascending: false })

  if (status) q = q.eq('status', status)

  const { data, error: rErr } = await q
  if (rErr) return jsonError('Gagal mengambil rute: ' + rErr.message, 500)

  return jsonOk({ routes: data })
}
