import { createClient } from '@/lib/supabase/server'
import { requireUser, logAudit, jsonError, jsonOk } from '@/lib/helpers'
import type { PickupStatus } from '@/lib/types'

/**
 * GET /api/admin/pickups/[id]
 * Detail lengkap pickup request (role: admin): warung, collector,
 * kategori, dan rute/stop terkait.
 */
export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const sb = await createClient()
  const { error } = await requireUser(sb, 'admin')
  if (error) return error

  const { data: pickup, error: fErr } = await sb
    .from('pickup_requests')
    .select(
      `*, warung_profiles(business_name, address, latitude, longitude),
       collector_profiles(vehicle_type, vehicle_capacity_kg),
       waste_categories(category_name, description, is_maggot_friendly)`
    )
    .eq('id', id)
    .single()
  if (fErr || !pickup) return jsonError('Pickup request tidak ditemukan', 404)

  const { data: stops } = await sb
    .from('route_stops')
    .select('*, routes(id, status, total_distance_km, total_weight_kg)')
    .eq('pickup_request_id', id)

  return jsonOk({ pickup, stops: stops ?? [] })
}

// Transisi status yang diizinkan untuk aksi admin (PRD 8.1: imutabilitas).
// Admin dapat membatalkan request pending (warung tutup / sampah basi dsb.).
const ALLOWED_TRANSITIONS: Partial<Record<PickupStatus, PickupStatus[]>> = {
  pending: ['cancelled'],
}

/**
 * PATCH /api/admin/pickups/[id]
 * Aksi admin atas pickup. Body: { status: 'cancelled', reason? }
 * Hanya transisi yang diizinkan (lihat ALLOWED_TRANSITIONS).
 */
export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const sb = await createClient()
  const { user, error } = await requireUser(sb, 'admin')
  if (error) return error

  const body = await request.json().catch(() => null)
  if (!body) return jsonError('Body JSON tidak valid', 400)

  const target = String(body.status ?? '') as PickupStatus
  if (!target) return jsonError('field status wajib diisi', 400)

  const { data: pickup, error: fErr } = await sb
    .from('pickup_requests')
    .select('*')
    .eq('id', id)
    .single()
  if (fErr || !pickup) return jsonError('Pickup request tidak ditemukan', 404)

  const from = pickup.status as PickupStatus
  const allowedNext = ALLOWED_TRANSITIONS[from] ?? []
  if (!allowedNext.includes(target)) {
    return jsonError(
      `Transisi status tidak diizinkan: ${from} -> ${target} (PRD 8.1 imutabilitas)`,
      400
    )
  }

  const reason = body.reason ? String(body.reason).trim().slice(0, 500) : null

  const { data, error: upErr } = await sb
    .from('pickup_requests')
    .update({ status: target, failure_reason: reason })
    .eq('id', id)
    .select('*')
    .single()
  if (upErr) return jsonError('Gagal memperbarui pickup: ' + upErr.message, 500)

  await logAudit(sb, {
    user_id: user.id,
    action: 'ADMIN_UPDATE_PICKUP',
    resource_type: 'pickup_requests',
    resource_id: id,
    metadata: { from, to: target, reason },
  })

  return jsonOk({ pickup: data, message: `Status diubah ke ${target}` })
}

/**
 * DELETE /api/admin/pickups/[id]
 * Pembatalan pickup oleh admin (hanya bila status masih pending).
 */
export async function DELETE(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const sb = await createClient()
  const { user, error } = await requireUser(sb, 'admin')
  if (error) return error

  const { data: pickup, error: fErr } = await sb
    .from('pickup_requests')
    .select('*')
    .eq('id', id)
    .single()
  if (fErr || !pickup) return jsonError('Pickup request tidak ditemukan', 404)
  if (pickup.status !== 'pending') {
    return jsonError(`Request berstatus ${pickup.status} tidak dapat dibatalkan`, 400)
  }

  const { data, error: cErr } = await sb
    .from('pickup_requests')
    .update({ status: 'cancelled' })
    .eq('id', id)
    .select('*')
    .single()
  if (cErr) return jsonError('Gagal membatalkan request: ' + cErr.message, 500)

  await logAudit(sb, {
    user_id: user.id,
    action: 'ADMIN_CANCEL_PICKUP',
    resource_type: 'pickup_requests',
    resource_id: id,
  })

  return jsonOk({ pickup: data, message: 'Request dibatalkan oleh admin' })
}