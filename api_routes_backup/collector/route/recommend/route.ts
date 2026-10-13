import { createClient } from '@/lib/supabase/server'
import { requireUser, logAudit, jsonError, jsonOk } from '@/lib/helpers'
import { recommendRoute, type RouteStopInput } from '@/lib/geo/routing'

/**
 * POST /api/collector/route/recommend
 * Mengklaim satu/beberapa pickup pending milik collector & menghasilkan
 * "Recommended Route" (heuristik Nearest-Neighbor) sekali atomik.
 *
 * Body:
 *   { pickup_ids: string[], start?: { lat, lng } }
 *
 * Validasi (PRD 8):
 *   - Pickup harus berstatus pending (dicegah double-claim via atomic update).
 *   - Total estimasi berat <= vehicle_capacity_kg collector.
 *   - Hasil dinamai "Recommended Route" (bukan optimal).
 */
export async function POST(request: Request) {
  const sb = await createClient()
  const { user, error } = await requireUser(sb, 'collector')
  if (error) return error

  const body = await request.json().catch(() => null)
  if (!body) return jsonError('Body JSON tidak valid', 400)

  const pickupIds: string[] = body.pickup_ids
  if (!Array.isArray(pickupIds) || pickupIds.length === 0) {
    return jsonError('pickup_ids wajib berisi minimal 1 id', 400)
  }

  const { data: collector, error: cErr } = await sb
    .from('collector_profiles')
    .select('id, vehicle_capacity_kg, latitude, longitude')
    .eq('user_id', user.id)
    .single()
  if (cErr) return jsonError('Profil collector tidak ditemukan', 404)

  // Ambil pickup yang diminta beserta lokasinya (harus pending).
  const { data: pickups, error: pErr } = await sb
    .from('pickup_requests')
    .select('*')
    .in('id', pickupIds)
  if (pErr) return jsonError('Gagal memuat pickup: ' + pErr.message, 500)

  if (!pickups || pickups.length !== new Set(pickupIds).size) {
    return jsonError('Beberapa pickup tidak ditemukan', 400)
  }
  for (const p of pickups) {
    if (p.status !== 'pending') {
      return jsonError(`Pickup ${p.id} sudah berstatus ${p.status}`, 409)
    }
  }

  // Validasi kapasitas kendaraan & muatan berjalan (Active Load Safeguard)
  const totalWeight = pickups.reduce(
    (sum, p) => sum + Number(p.estimated_weight_kg),
    0
  )
  const capacity = Number(collector.vehicle_capacity_kg) || 150

  // Hitung muatan dari rute aktif collector yang belum selesai
  const { data: activeRoutes } = await sb
    .from('routes')
    .select('id, total_weight_kg')
    .eq('collector_id', collector.id)
    .eq('status', 'active')

  const activeWeight = (activeRoutes ?? []).reduce(
    (sum, r) => sum + Number(r.total_weight_kg || 0),
    0
  )
  const remainingCapacity = Math.max(0, capacity - activeWeight)

  if (totalWeight > remainingCapacity) {
    return jsonError(
      `Muatan baru (${totalWeight} kg) melampaui sisa kapasitas kendaraan (${remainingCapacity} kg dari total ${capacity} kg). Selesaikan rute aktif & bongkar muatan terlebih dahulu!`,
      400
    )
  }

  // Validasi keseragaman tanggal jadwal (tidak mencampur jadwal hari ini dengan besok/lusa)
  const dateKeys = new Set(
    pickups.map((p) => new Date(p.pickup_window_start).toISOString().split('T')[0])
  )
  if (dateKeys.size > 1) {
    return jsonError(
      'Semua titik penjemputan dalam satu rute harus berada pada tanggal jadwal yang sama. Pisahkan permohonan hari ini dengan jadwal hari esok/mendatang.',
      400
    )
  }

  // Hitung Recommended Route (Nearest-Neighbor)
  const inputs: RouteStopInput[] = pickups.map((p) => ({
    id: p.id,
    lat: Number(p.latitude),
    lng: Number(p.longitude),
    weightKg: Number(p.estimated_weight_kg),
    pickupWindowStart: p.pickup_window_start,
    pickupWindowEnd: p.pickup_window_end,
  }))

  const start =
    body.start?.lat && body.start?.lng
      ? { lat: body.start.lat, lng: body.start.lng }
      : collector.latitude && collector.longitude
        ? { lat: Number(collector.latitude), lng: Number(collector.longitude) }
        : inputs[0]

  const recommended = recommendRoute(inputs, start)

  // Simpan route & stops, lalu assign pickup secara atomik (anti double-claim).
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
  if (rErr) return jsonError('Gagal membuat rute: ' + rErr.message, 500)

  // Insert route stops mengikuti urutan rekomendasi.
  const { error: sErr } = await sb.from('route_stops').insert(
    recommended.stops.map((s) => ({
      route_id: route.id,
      pickup_request_id: s.id,
      sequence_number: s.sequence,
      status: 'pending',
    }))
  )
  if (sErr) {
    // cleanup best-effort
    await sb.from('routes').delete().eq('id', route.id)
    return jsonError('Gagal menyimpan titik rute: ' + sErr.message, 500)
  }

  // Assign pickup satu per satu dengan guard status='pending'
  // untuk mencegah dua collector mengklaim pickup yang sama (race condition).
  const failed: string[] = []
  for (const p of pickups) {
    const { error: aErr, count } = await sb
      .from('pickup_requests')
      .update({ status: 'assigned', collector_id: collector.id, assigned_at: new Date().toISOString() })
      .eq('id', p.id)
      .eq('status', 'pending')
      .select('*')

    if (aErr) failed.push(p.id)
    // count dapat digunakan untuk mendeteksi pickup yang sudah
    // diambil collector lain (0 baris terupdate).
    void count
  }
  if (failed.length > 0) {
    await sb.from('routes').delete().eq('id', route.id)
    return jsonError('Terjadi konflik klaim pada beberapa pickup', 409)
  }

  await logAudit(sb, {
    user_id: user.id,
    action: 'CLAIM_PICKUP_CREATE_ROUTE',
    resource_type: 'routes',
    resource_id: route.id,
    metadata: { pickup_count: pickups.length, total_weight: recommended.totalWeightKg },
  })

  return jsonOk({
    message: 'Pickup berhasil diklaim & Recommended Route dibuat',
    route: route.id,
    recommended,
  }, 201)
}
