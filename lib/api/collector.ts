/**
 * lib/api/collector.ts
 * Client-side functions - menggantikan /api/collector/* routes.
 */
import { createClient } from '@/lib/supabase/client'

export async function apiGetCollectorPickups(opts?: { category?: string; area?: string; schedule?: string }) {
  const sb = createClient()
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).toISOString()
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).toISOString()
  const tomorrowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0).toISOString()
  const tomorrowEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 23, 59, 59, 999).toISOString()

  let query = sb
    .from('pickup_requests')
    .select('id, latitude, longitude, estimated_weight_kg, pickup_window_start, pickup_window_end, waste_category_id, notes, warung_profiles(business_name, address), waste_categories(category_name, is_maggot_friendly)')
    .eq('status', 'pending')
    .order('pickup_window_start', { ascending: true })

  if (opts?.category) query = query.eq('waste_category_id', opts.category)
  if (opts?.schedule === 'today') query = query.gte('pickup_window_start', todayStart).lte('pickup_window_start', todayEnd)
  else if (opts?.schedule === 'tomorrow') query = query.gte('pickup_window_start', tomorrowStart).lte('pickup_window_start', tomorrowEnd)
  else if (opts?.schedule === 'upcoming') query = query.gt('pickup_window_start', tomorrowEnd)

  const { data, error } = await query
  if (error) throw new Error(error.message)

  let result = data ?? []
  if (opts?.area?.trim()) {
    const areaLower = opts.area.trim().toLowerCase()
    result = result.filter((p: { warung_profiles?: unknown }) => ((p.warung_profiles as { address?: string } | null)?.address || '').toLowerCase().includes(areaLower))
  }
  return result
}

export async function apiGetCollectorCapacity() {
  const sb = createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) throw new Error('Tidak terautentikasi')

  const { data, error } = await sb
    .from('collector_profiles')
    .select('id, vehicle_type, vehicle_capacity_kg, service_area, latitude, longitude, service_start, service_end, max_pickups_per_slot')
    .eq('user_id', user.id)
    .single()
  if (error) throw new Error('Profil collector tidak ditemukan')
  return data
}

export async function apiUpdateCollectorCapacity(update: Record<string, unknown>) {
  const sb = createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) throw new Error('Tidak terautentikasi')

  const timeRe = /^([01]\d|2[0-3]):[0-5]\d$/
  if (update.service_start && !timeRe.test(update.service_start as string)) throw new Error('service_start harus format HH:MM')
  if (update.service_end && !timeRe.test(update.service_end as string)) throw new Error('service_end harus format HH:MM')

  const { data, error } = await sb
    .from('collector_profiles')
    .update(update)
    .eq('user_id', user.id)
    .select('*')
    .single()
  if (error) throw new Error(error.message)
  return data
}

export async function apiStartPickup(pickupId: string) {
  const sb = createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) throw new Error('Tidak terautentikasi')

  const { data: profile } = await sb.from('collector_profiles').select('id').eq('user_id', user.id).single()
  if (!profile) throw new Error('Profil collector tidak ditemukan')

  const { data, error } = await sb
    .from('pickup_requests')
    .update({ status: 'in_progress', collector_id: profile.id, started_at: new Date().toISOString() })
    .eq('id', pickupId)
    .in('status', ['pending', 'assigned'])
    .select('*')
    .single()
  if (error) throw new Error(error.message)

  await sb.from('audit_logs').insert({ user_id: user.id, action: 'START_PICKUP', resource_type: 'pickup_requests', resource_id: pickupId })
  return data
}

export async function apiCompletePickup(pickupId: string, actualWeightKg: number, notes?: string) {
  const sb = createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) throw new Error('Tidak terautentikasi')

  const update: Record<string, unknown> = {
    status: 'completed',
    actual_weight_kg: actualWeightKg,
    completed_at: new Date().toISOString(),
  }
  if (notes) update.collector_notes = notes

  const { data, error } = await sb
    .from('pickup_requests')
    .update(update)
    .eq('id', pickupId)
    .select('*')
    .single()
  if (error) throw new Error(error.message)

  await sb.from('audit_logs').insert({ user_id: user.id, action: 'COMPLETE_PICKUP', resource_type: 'pickup_requests', resource_id: pickupId, metadata: { actual_weight_kg: actualWeightKg } })
  return data
}

export async function apiFailPickup(pickupId: string, reason: string) {
  const sb = createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) throw new Error('Tidak terautentikasi')

  const { data, error } = await sb
    .from('pickup_requests')
    .update({ status: 'failed', fail_reason: reason, failed_at: new Date().toISOString() })
    .eq('id', pickupId)
    .select('*')
    .single()
  if (error) throw new Error(error.message)

  await sb.from('audit_logs').insert({ user_id: user.id, action: 'FAIL_PICKUP', resource_type: 'pickup_requests', resource_id: pickupId, metadata: { reason } })
  return data
}

export async function apiGetCollectorRoutes() {
  const sb = createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) throw new Error('Tidak terautentikasi')

  const { data: profile } = await sb.from('collector_profiles').select('id').eq('user_id', user.id).single()
  if (!profile) throw new Error('Profil collector tidak ditemukan')

  const { data, error } = await sb
    .from('routes')
    .select('*, route_stops(*, pickup_requests(*, warung_profiles(business_name, address), waste_categories(category_name)))')
    .eq('collector_id', profile.id)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data
}

export async function apiRecommendRoute(body: { pickup_ids: string[]; start?: { lat: number; lng: number } }) {
  const sb = createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) throw new Error('Tidak terautentikasi')

  const { data: collector, error: cErr } = await sb
    .from('collector_profiles')
    .select('id, vehicle_capacity_kg, latitude, longitude')
    .eq('user_id', user.id)
    .single()
  if (cErr || !collector) throw new Error('Profil collector tidak ditemukan')

  const { data: pickups, error: pErr } = await sb
    .from('pickup_requests')
    .select('*')
    .in('id', body.pickup_ids)
  if (pErr) throw new Error('Gagal memuat pickup: ' + pErr.message)
  if (!pickups || pickups.length === 0) throw new Error('Pickup tidak ditemukan')

  const { recommendRoute } = await import('@/lib/geo/routing')
  const inputs = pickups.map((p: any) => ({
    id: p.id,
    lat: Number(p.latitude),
    lng: Number(p.longitude),
    weightKg: Number(p.estimated_weight_kg),
    pickupWindowStart: p.pickup_window_start,
    pickupWindowEnd: p.pickup_window_end,
  }))

  const start = body.start?.lat && body.start?.lng
    ? { lat: body.start.lat, lng: body.start.lng }
    : collector.latitude && collector.longitude
      ? { lat: Number(collector.latitude), lng: Number(collector.longitude) }
      : inputs[0]

  const recommended = recommendRoute(inputs, start)

  const { data: route, error: rErr } = await sb
    .from('routes')
    .insert({
      collector_id: collector.id,
      total_distance_km: recommended.totalDistanceKm,
      total_weight_kg: recommended.totalWeightKg,
      status: 'active',
    })
    .select('id')
    .single()
  if (rErr) throw new Error('Gagal membuat rute: ' + rErr.message)

  await sb.from('route_stops').insert(
    recommended.stops.map((s: any) => ({
      route_id: route.id,
      pickup_request_id: s.id,
      sequence_number: s.sequence,
      status: 'pending',
    }))
  )

  for (const p of pickups) {
    await sb
      .from('pickup_requests')
      .update({ status: 'assigned', collector_id: collector.id, assigned_at: new Date().toISOString() })
      .eq('id', p.id)
      .eq('status', 'pending')
  }

  return { route: route.id, recommended }
}

