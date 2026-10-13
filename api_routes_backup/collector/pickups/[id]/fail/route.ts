import { createClient } from '@/lib/supabase/server'
import { requireUser, logAudit, jsonError, jsonOk, closeRouteIfDone } from '@/lib/helpers'
import type { PickupStatus } from '@/lib/types'

/**
 * POST /api/collector/pickups/[id]/fail
 * Menandai penjemputan gagal di lapangan (role: collector yang ditugaskan).
 * Body: { failure_reason }
 * Validasi (PRD 8.4): wajib mengisi failure_reason.
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

  if (!collector || pickup.collector_id !== collector.id) {
    return jsonError('Anda tidak ditugaskan pada pickup ini', 403)
  }

  const allowed: PickupStatus[] = ['assigned', 'in_progress']
  if (!allowed.includes(pickup.status as PickupStatus)) {
    return jsonError(`Pickup berstatus ${pickup.status} tidak dapat digagalkan`, 400)
  }

  const body = await request.json().catch(() => null)
  if (!body) return jsonError('Body JSON tidak valid', 400)

  const { failure_reason } = body as { failure_reason?: string }
  if (!failure_reason || !failure_reason.trim()) {
    return jsonError('failure_reason wajib diisi', 400)
  }

  const { data, error: flErr } = await sb
    .from('pickup_requests')
    .update({
      status: 'failed',
      failure_reason: failure_reason.trim(),
    })
    .eq('id', id)
    .select('*')
    .single()
  if (flErr) return jsonError('Gagal menandai pickup: ' + flErr.message, 500)

  await sb.from('route_stops').update({ status: 'failed' }).eq('pickup_request_id', id)

  // Tutup rute otomatis bila seluruh route stop sudah berstatus terminal.
  await closeRouteIfDone(sb, id)

  await logAudit(sb, {
    user_id: user.id,
    action: 'FAIL_PICKUP',
    resource_type: 'pickup_requests',
    resource_id: id,
    metadata: { failure_reason },
  })

  return jsonOk({ pickup: data, message: 'Penjemputan ditandai gagal' })
}
