import { createClient } from '@/lib/supabase/server'
import { requireUser, logAudit, jsonError, jsonOk } from '@/lib/helpers'

/**
 * POST /api/collector/pickups/[id]/start
 * Memulai perjalanan kurir menuju warung (mengubah status menjadi in_progress).
 * Role: collector yang ditugaskan pada pickup ini.
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

  // Ownership: hanya collector yang ditugaskan
  if (!collector || pickup.collector_id !== collector.id) {
    return jsonError('Anda tidak ditugaskan pada pickup ini', 403)
  }

  // Idempoten jika sudah in_progress
  if (pickup.status === 'in_progress') {
    return jsonOk({ pickup, message: 'Pickup sudah berstatus Dalam Perjalanan' })
  }

  if (pickup.status !== 'assigned') {
    return jsonError(`Pickup berstatus "${pickup.status}" tidak dapat diubah menjadi Dalam Perjalanan`, 400)
  }

  const { data, error: uErr } = await sb
    .from('pickup_requests')
    .update({
      status: 'in_progress',
    })
    .eq('id', id)
    .select('*')
    .single()

  if (uErr) return jsonError('Gagal memperbarui status: ' + uErr.message, 500)

  await logAudit(sb, {
    user_id: user.id,
    action: 'START_PICKUP_TRIP',
    resource_type: 'pickup_requests',
    resource_id: id,
  })

  return jsonOk({ pickup: data, message: 'Status penjemputan diubah: Kurir dalam perjalanan ke lokasi warung' })
}
