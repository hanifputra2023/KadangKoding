import { createClient } from '@/lib/supabase/server'
import { requireUser, jsonError, jsonOk } from '@/lib/helpers'

/**
 * GET /api/admin/pickups
 * Monitoring seluruh pickup request dengan filter (role: admin).
 * Filter: ?status=&category=&from=&to=
 */
export async function GET(request: Request) {
  const sb = await createClient()
  const { error } = await requireUser(sb, 'admin')
  if (error) return error

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')
  const category = searchParams.get('category')
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  let q = sb
    .from('pickup_requests')
    .select(
      '*, warung_profiles(business_name, address), collector_profiles(vehicle_type), waste_categories(category_name, is_maggot_friendly)'
    )
    .order('created_at', { ascending: false })

  if (status && status !== 'all') q = q.eq('status', status)
  if (category) q = q.eq('waste_category_id', category)
  if (from) q = q.gte('created_at', new Date(from).toISOString())
  if (to) q = q.lte('created_at', new Date(to).toISOString())

  const { data, error: pErr } = await q
  if (pErr) return jsonError('Gagal mengambil pickup: ' + pErr.message, 500)

  return jsonOk({ pickups: data })
}
