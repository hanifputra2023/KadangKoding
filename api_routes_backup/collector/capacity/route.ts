import { createClient } from '@/lib/supabase/server'
import { requireUser, jsonError, jsonOk } from '@/lib/helpers'

/**
 * GET /api/collector/capacity
 * Mengambil pengaturan kapasitas kendaraan collector yang login.
 */
export async function GET() {
  const sb = await createClient()
  const { user, error } = await requireUser(sb, 'collector')
  if (error) return error

  const { data, error: cErr } = await sb
    .from('collector_profiles')
    .select(
      'id, vehicle_type, vehicle_capacity_kg, service_area, latitude, longitude, service_start, service_end, max_pickups_per_slot'
    )
    .eq('user_id', user.id)
    .single()
  if (cErr) return jsonError('Profil collector tidak ditemukan', 404)

  return jsonOk({ profile: data })
}

/**
 * PUT /api/collector/capacity
 * Memperbarui kapasitas kendaraan / area layanan / jadwal collector.
 * Body: { vehicle_type?, vehicle_capacity_kg?, service_area?, latitude?, longitude?,
 *         service_start?, service_end?, max_pickups_per_slot? }
 */
export async function PUT(request: Request) {
  const sb = await createClient()
  const { user, error } = await requireUser(sb, 'collector')
  if (error) return error

  const body = await request.json().catch(() => null)
  if (!body) return jsonError('Body JSON tidak valid', 400)

  const update: Record<string, unknown> = {}
  if (body.vehicle_type) update.vehicle_type = body.vehicle_type
  if (body.vehicle_capacity_kg !== undefined) {
    if (Number(body.vehicle_capacity_kg) <= 0) return jsonError('Kapasitas harus > 0', 400)
    update.vehicle_capacity_kg = Number(body.vehicle_capacity_kg)
  }
  if (body.service_area !== undefined) update.service_area = body.service_area
  if (body.latitude !== undefined) update.latitude = body.latitude
  if (body.longitude !== undefined) update.longitude = body.longitude

  const timeRe = /^([01]\d|2[0-3]):[0-5]\d$/
  if (body.service_start !== undefined) {
    if (typeof body.service_start !== 'string' || !timeRe.test(body.service_start)) {
      return jsonError('service_start harus format HH:MM (24 jam)', 400)
    }
    update.service_start = body.service_start
  }
  if (body.service_end !== undefined) {
    if (typeof body.service_end !== 'string' || !timeRe.test(body.service_end)) {
      return jsonError('service_end harus format HH:MM (24 jam)', 400)
    }
    update.service_end = body.service_end
  }
  if (
    update.service_start &&
    update.service_end &&
    update.service_start >= update.service_end
  ) {
    return jsonError('service_start harus lebih awal dari service_end', 400)
  }
  if (body.max_pickups_per_slot !== undefined) {
    const n = Number(body.max_pickups_per_slot)
    if (!Number.isInteger(n) || n <= 0) {
      return jsonError('max_pickups_per_slot harus bilangan bulat > 0', 400)
    }
    update.max_pickups_per_slot = n
  }

  const { data, error: cErr } = await sb
    .from('collector_profiles')
    .update(update)
    .eq('user_id', user.id)
    .select('*')
    .single()
  if (cErr) return jsonError('Gagal memperbarui profil collector: ' + cErr.message, 500)

  return jsonOk({ profile: data, message: 'Profil collector diperbarui' })
}
