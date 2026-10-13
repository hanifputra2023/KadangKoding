import { createClient } from '@/lib/supabase/server'
import { requireUser, jsonError, jsonOk } from '@/lib/helpers'

/**
 * GET /api/admin/routes
 * Monitoring seluruh rute penjemputan (role: admin) termasuk route stops
 * dan detail pickup tiap titik. Filter: ?status=active|completed|cancelled
 * &collector_id=<id>.
 */
export async function GET(request: Request) {
  const sb = await createClient()
  const { error } = await requireUser(sb, 'admin')
  if (error) return error

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')
  const collectorId = searchParams.get('collector_id')

  let q = sb
    .from('routes')
    .select(
      `*, collector_profiles(vehicle_type, vehicle_capacity_kg, service_area),
       route_stops(
         id, sequence_number, status,
         pickup_requests(id, status, estimated_weight_kg, actual_weight_kg,
                         pickup_window_start, pickup_window_end, created_at,
                         warung_profiles(business_name, address))
       )`
    )
    .order('created_at', { ascending: false })

  if (status && status !== 'all') q = q.eq('status', status)
  if (collectorId) q = q.eq('collector_id', collectorId)

  const { data, error: rErr } = await q
  if (rErr) return jsonError('Gagal mengambil rute: ' + rErr.message, 500)

  return jsonOk({ routes: data })
}