import { createClient } from '@/lib/supabase/server'
import { requireUser, logAudit, jsonError, jsonOk } from '@/lib/helpers'
import type { PickupStatus } from '@/lib/types'

const EDITABLE_STATUS: PickupStatus[] = ['pending']

/**
 * PATCH /api/warung/pickups/[id]
 * Mengedit pickup request milik warung (hanya bila status masih pending).
 */
export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const sb = await createClient()
  const { user, error } = await requireUser(sb, 'warung')
  if (error) return error

  const { data: warung } = await sb
    .from('warung_profiles')
    .select('id')
    .eq('user_id', user.id)
    .single()

  const { data: pickup, error: fErr } = await sb
    .from('pickup_requests')
    .select('*')
    .eq('id', id)
    .single()
  if (fErr || !pickup) return jsonError('Pickup request tidak ditemukan', 404)

  // Ownership: hanya warung pemilik yang boleh mengedit
  if (!warung || pickup.warung_id !== warung.id) {
    return jsonError('Anda tidak memiliki akses ke request ini', 403)
  }
  if (!EDITABLE_STATUS.includes(pickup.status as PickupStatus)) {
    return jsonError(`Request berstatus ${pickup.status} tidak dapat diedit`, 400)
  }

  const body = await request.json().catch(() => ({}))
  const update: Record<string, unknown> = {}

  if (body.waste_category_id) update.waste_category_id = body.waste_category_id
  if (body.estimated_weight_kg !== undefined && Number(body.estimated_weight_kg) > 0) {
    update.estimated_weight_kg = Number(body.estimated_weight_kg)
  }
  if (body.sample_photo_url) update.sample_photo_url = body.sample_photo_url
  if (body.latitude !== undefined) update.latitude = body.latitude
  if (body.longitude !== undefined) update.longitude = body.longitude
  if (body.pickup_window_start) update.pickup_window_start = body.pickup_window_start
  if (body.pickup_window_end) update.pickup_window_end = body.pickup_window_end

  // Validasi time window gabungan (mulai < selesai) bila salah satu diubah.
  const effStart = update.pickup_window_start ?? pickup.pickup_window_start
  const effEnd = update.pickup_window_end ?? pickup.pickup_window_end
  const s = new Date(effStart)
  const e = new Date(effEnd)
  if (isNaN(s.getTime()) || isNaN(e.getTime()) || s >= e) {
    return jsonError('Time window tidak valid: pickup_window_end harus setelah pickup_window_start', 400)
  }

  const { data, error: upErr } = await sb
    .from('pickup_requests')
    .update(update)
    .eq('id', id)
    .select('*')
    .single()
  if (upErr) return jsonError('Gagal mengedit request: ' + upErr.message, 500)

  await logAudit(sb, {
    user_id: user.id,
    action: 'UPDATE_PICKUP',
    resource_type: 'pickup_requests',
    resource_id: id,
    metadata: update,
  })

  return jsonOk({ pickup: data, message: 'Request berhasil diperbarui' })
}

/**
 * DELETE /api/warung/pickups/[id]
 * Membatalkan pickup request (hanya bila status masih pending).
 */
export async function DELETE(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const sb = await createClient()
  const { user, error } = await requireUser(sb, 'warung')
  if (error) return error

  const { data: warung } = await sb
    .from('warung_profiles')
    .select('id')
    .eq('user_id', user.id)
    .single()

  const { data: pickup, error: fErr } = await sb
    .from('pickup_requests')
    .select('*')
    .eq('id', id)
    .single()
  if (fErr || !pickup) return jsonError('Pickup request tidak ditemukan', 404)

  if (!warung || pickup.warung_id !== warung.id) {
    return jsonError('Anda tidak memiliki akses ke request ini', 403)
  }
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
    action: 'CANCEL_PICKUP',
    resource_type: 'pickup_requests',
    resource_id: id,
  })

  return jsonOk({ pickup: data, message: 'Request dibatalkan' })
}
