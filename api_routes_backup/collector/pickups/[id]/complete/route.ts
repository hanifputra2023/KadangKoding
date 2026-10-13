import { createClient } from '@/lib/supabase/server'
import { requireUser, logAudit, jsonError, jsonOk, closeRouteIfDone } from '@/lib/helpers'
import type { PickupStatus } from '@/lib/types'

/**
 * POST /api/collector/pickups/[id]/complete
 * Menyelesaikan penjemputan (role: collector yang ditugaskan).
 * Body: { actual_weight_kg, proof_photo_url }
 * Validasi (PRD 8.3): wajib actual_weight_kg > 0 dan proof_photo_url.
 */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const sb = await createClient()
  const { user, error } = await requireUser(sb, 'collector')
  if (error) return error

  const { data: collector } = await sb
    .from('collector_profiles')
    .select('id')
    .eq('user_id', user.id)
    .single()

  const { data: pickup, error: fErr } = await sb
    .from('pickup_requests')
    .select('*')
    .eq('id', id)
    .single()
  if (fErr || !pickup) return jsonError('Pickup request tidak ditemukan', 404)

  // Ownership: hanya collector yang ditugaskan.
  if (!collector || pickup.collector_id !== collector.id) {
    return jsonError('Anda tidak ditugaskan pada pickup ini', 403)
  }

  const allowed: PickupStatus[] = ['assigned', 'in_progress']
  if (!allowed.includes(pickup.status as PickupStatus)) {
    return jsonError(`Pickup berstatus ${pickup.status} tidak dapat diselesaikan`, 400)
  }

  const body = await request.json().catch(() => null)
  if (!body) return jsonError('Body JSON tidak valid', 400)

  const { actual_weight_kg, proof_photo_url } = body as {
    actual_weight_kg?: number
    proof_photo_url?: string
  }
  if (!actual_weight_kg || Number(actual_weight_kg) <= 0) {
    return jsonError('actual_weight_kg harus > 0', 400)
  }
  if (!proof_photo_url) {
    return jsonError('proof_photo_url (foto bukti) wajib diisi', 400)
  }

  const { data, error: cErr } = await sb
    .from('pickup_requests')
    .update({
      status: 'completed',
      actual_weight_kg: Number(actual_weight_kg),
      proof_photo_url,
      completed_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('*')
    .single()
  if (cErr) return jsonError('Gagal menyelesaikan pickup: ' + cErr.message, 500)

  // Tandai route stop terkait selesai.
  await sb
    .from('route_stops')
    .update({ status: 'completed' })
    .eq('pickup_request_id', id)

  // Tutup rute otomatis bila seluruh route stop sudah berstatus terminal.
  await closeRouteIfDone(sb, id)

  await logAudit(sb, {
    user_id: user.id,
    action: 'COMPLETE_PICKUP',
    resource_type: 'pickup_requests',
    resource_id: id,
    metadata: { actual_weight_kg },
  })

  return jsonOk({ pickup: data, message: 'Penjemputan selesai' })
}
