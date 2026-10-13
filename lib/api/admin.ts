/**
 * lib/api/admin.ts
 * Client-side functions - menggantikan /api/admin/* routes.
 */
import { createClient } from '@/lib/supabase/client'

const EMISSION_FACTOR = 0.3

export async function apiGetAdminStats() {
  const sb = createClient()

  const [completedRes, warungCountRes, collectorCountRes, allStatusRes] = await Promise.all([
    sb.from('pickup_requests').select('actual_weight_kg').eq('status', 'completed'),
    sb.from('pickup_requests').select('warung_id', { count: 'exact', head: true }),
    sb.from('collector_profiles').select('id', { count: 'exact', head: true }),
    sb.from('pickup_requests').select('status'),
  ])

  const totalWasteKg = (completedRes.data ?? []).reduce((sum: number, p: { actual_weight_kg?: number | string | null }) => sum + Number(p.actual_weight_kg ?? 0), 0)
  const statusBreakdown: Record<string, number> = {}
  for (const r of allStatusRes.data ?? []) {
    const s = r.status as string
    statusBreakdown[s] = (statusBreakdown[s] ?? 0) + 1
  }

  return {
    total_waste_collected_kg: Number(totalWasteKg.toFixed(2)),
    total_waste_collected_ton: Number((totalWasteKg / 1000).toFixed(3)),
    total_completed_pickups: completedRes.data?.length ?? 0,
    active_warung_count: warungCountRes.count ?? 0,
    collector_count: collectorCountRes.count ?? 0,
    status_breakdown: statusBreakdown,
    estimated_carbon_offset_kg_co2e: Number((totalWasteKg * EMISSION_FACTOR).toFixed(2)),
    emission_factor_kg_co2e_per_kg: EMISSION_FACTOR,
  }
}

export async function apiGetAdminPickups(opts?: { status?: string; page?: number; limit?: number }) {
  const sb = createClient()
  const page = opts?.page ?? 1
  const limit = opts?.limit ?? 20
  const from = (page - 1) * limit
  const to = from + limit - 1

  let query = sb
    .from('pickup_requests')
    .select('*, warung_profiles(business_name, address), waste_categories(category_name), collector_profiles(vehicle_type)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to)

  if (opts?.status && opts.status !== 'all') query = query.eq('status', opts.status)

  const { data, error, count } = await query
  if (error) throw new Error(error.message)
  return { pickups: data, total: count }
}

export async function apiUpdateAdminPickup(id: string, update: Record<string, unknown>) {
  const sb = createClient()
  const { data: { user } } = await sb.auth.getUser()
  const { data, error } = await sb.from('pickup_requests').update(update).eq('id', id).select('*').single()
  if (error) throw new Error(error.message)
  await sb.from('audit_logs').insert({ user_id: user?.id, action: 'ADMIN_UPDATE_PICKUP', resource_type: 'pickup_requests', resource_id: id, metadata: update })
  return data
}

export async function apiGetAdminUsers() {
  const sb = createClient()
  const { data, error } = await sb
    .from('users')
    .select('id, name, email, role, phone_number, is_deleted, created_at')
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data
}

export async function apiUpdateAdminUser(id: string, update: Record<string, unknown>) {
  const sb = createClient()
  const { data: { user } } = await sb.auth.getUser()
  const { data, error } = await sb.from('users').update(update).eq('id', id).select('*').single()
  if (error) throw new Error(error.message)
  await sb.from('audit_logs').insert({ user_id: user?.id, action: 'ADMIN_UPDATE_USER', resource_type: 'users', resource_id: id, metadata: update })
  return data
}

export async function apiGetCategories() {
  const sb = createClient()
  const { data, error } = await sb.from('waste_categories').select('*').order('category_name')
  if (error) throw new Error(error.message)
  return data
}

export async function apiCreateCategory(body: { category_name: string; is_maggot_friendly?: boolean; description?: string }) {
  const sb = createClient()
  const { data, error } = await sb.from('waste_categories').insert(body).select('*').single()
  if (error) throw new Error(error.message)
  return data
}

export async function apiUpdateCategory(id: string, body: Record<string, unknown>) {
  const sb = createClient()
  const { data, error } = await sb.from('waste_categories').update(body).eq('id', id).select('*').single()
  if (error) throw new Error(error.message)
  return data
}

export async function apiDeleteCategory(id: string) {
  const sb = createClient()
  const { error } = await sb.from('waste_categories').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

export async function apiGetAuditLogs(limit = 50) {
  const sb = createClient()
  const { data, error } = await sb
    .from('audit_logs')
    .select('*, users(name, email)')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw new Error(error.message)
  return data
}

export async function apiGetAdminRoutes(opts?: { status?: string; collectorId?: string }) {
  const sb = createClient()
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

  if (opts?.status && opts.status !== 'all') q = q.eq('status', opts.status)
  if (opts?.collectorId) q = q.eq('collector_id', opts.collectorId)

  const { data, error } = await q
  if (error) throw new Error(error.message)
  return data
}

export async function apiCancelAdminPickup(id: string) {
  const sb = createClient()
  const { data: { user } } = await sb.auth.getUser()
  const { data, error } = await sb
    .from('pickup_requests')
    .update({ status: 'cancelled' })
    .eq('id', id)
    .eq('status', 'pending')
    .select('*')
    .single()
  if (error) throw new Error(error.message)
  await sb.from('audit_logs').insert({
    user_id: user?.id,
    action: 'ADMIN_CANCEL_PICKUP',
    resource_type: 'pickup_requests',
    resource_id: id,
  })
  return data
}

