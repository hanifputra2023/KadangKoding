import { createClient } from '@/lib/supabase/server'
import { requireUser, jsonError, jsonOk, isMissingColumnError } from '@/lib/helpers'

/**
 * GET /api/collector/pickups
 * Menampilkan daftar pickup request berstatus "pending" yang tersedia
 * bagi collector (PRD 4.3).
 * Opsional filter: ?category=<waste_category_id>&area=<service_area>
 */
export async function GET(request: Request) {
  const sb = await createClient()
  const { error } = await requireUser(sb, 'collector')
  if (error) return error

  const { searchParams } = new URL(request.url)
  const category = searchParams.get('category')
  const area = searchParams.get('area')
  const schedule = searchParams.get('schedule') // 'today' | 'tomorrow' | 'upcoming' | 'all'

  type PickupRow = {
    id: string
    latitude: number
    longitude: number
    estimated_weight_kg: number
    pickup_window_start: string
    pickup_window_end: string
    waste_category_id: string
    notes?: string | null
    warung_profiles?: { business_name: string; address: string } | null
    waste_categories?: { category_name: string; is_maggot_friendly: boolean } | null
  }

  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).toISOString()
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).toISOString()
  const tomorrowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0).toISOString()
  const tomorrowEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 23, 59, 59, 999).toISOString()

  // Coba query dengan kolom notes terlebih dahulu
  let query = sb
    .from('pickup_requests')
    .select(
      'id, latitude, longitude, estimated_weight_kg, pickup_window_start, pickup_window_end, waste_category_id, notes, warung_profiles(business_name, address), waste_categories(category_name, is_maggot_friendly)'
    )
    .eq('status', 'pending')
    .order('pickup_window_start', { ascending: true })

  if (category) query = query.eq('waste_category_id', category)
  if (schedule === 'today') {
    query = query.gte('pickup_window_start', todayStart).lte('pickup_window_start', todayEnd)
  } else if (schedule === 'tomorrow') {
    query = query.gte('pickup_window_start', tomorrowStart).lte('pickup_window_start', tomorrowEnd)
  } else if (schedule === 'upcoming') {
    query = query.gt('pickup_window_start', tomorrowEnd)
  }

  const queryRes = await query
  let data = queryRes.data as unknown as PickupRow[] | null
  let listErr = queryRes.error

  // Jika kolom notes belum ada di database, fallback query tanpa kolom notes
  if (listErr && isMissingColumnError(listErr)) {
    let fallbackQuery = sb
      .from('pickup_requests')
      .select(
        'id, latitude, longitude, estimated_weight_kg, pickup_window_start, pickup_window_end, waste_category_id, warung_profiles(business_name, address), waste_categories(category_name, is_maggot_friendly)'
      )
      .eq('status', 'pending')
      .order('created_at', { ascending: true })

    if (category) fallbackQuery = fallbackQuery.eq('waste_category_id', category)

    const fallbackRes = await fallbackQuery
    data = fallbackRes.data as unknown as PickupRow[] | null
    listErr = fallbackRes.error
  }

  if (listErr) return jsonError('Gagal mengambil pickup: ' + listErr.message, 500)

  // Filter area di memori (aman dan tidak menyebabkan error PostgREST)
  let result = data ?? []
  if (area && area.trim()) {
    const areaLower = area.trim().toLowerCase()
    result = result.filter(
      (p) => (p.warung_profiles?.address || '').toLowerCase().includes(areaLower)
    )
  }

  return jsonOk({ pickups: result })
}

