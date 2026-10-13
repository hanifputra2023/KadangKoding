import { createClient } from '@/lib/supabase/server'
import { requireUser, logAudit, jsonError, jsonOk } from '@/lib/helpers'

/**
 * POST /api/warung/pickups
 * Membuat pickup request (role: warung).
 * Body (PRD 4.1):
 *   { waste_category_id, estimated_weight_kg, pickup_window_start,
 *     pickup_window_end, sample_photo_url, latitude?, longitude? }
 */
export async function POST(request: Request) {
  const sb = await createClient()
  const { user, error } = await requireUser(sb, 'warung')
  if (error) return error

  const body = await request.json().catch(() => null)
  if (!body) return jsonError('Body JSON tidak valid', 400)

  const {
    waste_category_id,
    estimated_weight_kg,
    pickup_window_start,
    pickup_window_end,
    sample_photo_url,
    latitude,
    longitude,
    address,
    instructions,
    notes,
  } = body as {
    waste_category_id?: string
    estimated_weight_kg?: number
    pickup_window_start?: string
    pickup_window_end?: string
    sample_photo_url?: string
    latitude?: number
    longitude?: number
    address?: string
    instructions?: string
    notes?: string
  }

  // Ambil profil warung milik user ini (lokasi default dari profil).
  const { data: warung, error: wErr } = await sb
    .from('warung_profiles')
    .select('id, address, latitude, longitude')
    .eq('user_id', user.id)
    .single()
  if (wErr) return jsonError('Profil warung tidak ditemukan', 404)

  if (!waste_category_id) return jsonError('waste_category_id wajib diisi', 400)
  if (!estimated_weight_kg || Number(estimated_weight_kg) <= 0) {
    return jsonError('estimated_weight_kg harus > 0', 400)
  }
  if (!pickup_window_start || !pickup_window_end) {
    return jsonError('pickup_window_start dan pickup_window_end wajib diisi', 400)
  }
  if (!sample_photo_url) return jsonError('sample_photo_url (foto pratinjau) wajib diisi', 400)

  const start = new Date(pickup_window_start)
  const end = new Date(pickup_window_end)
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || start >= end) {
    return jsonError('Time window tidak valid', 400)
  }

  // Cegah pickup di masa lalu (jendela waktu sudah berakhir sebelum waktu saat ini)
  const now = new Date()
  if (end.getTime() <= now.getTime()) {
    return jsonError('Jendela waktu yang dipilih sudah lewat. Silakan pilih slot waktu berikutnya atau hari lain.', 400)
  }

  // Validasi kuota slot (cegah slot terisi berlebihan / duplikasi terisi).
  // Hitung total kuota semua collector yang buka pada jendela waktu request.
  const slotFrom = start.getHours()
  const slotTo = slotFrom + 2
  const activeStatuses = ['pending', 'assigned', 'in_progress']

  const { data: collectors, error: colErr } = await sb
    .from('collector_profiles')
    .select('service_start, service_end, max_pickups_per_slot')
  if (colErr) return jsonError('Gagal mengambil profil collector: ' + colErr.message, 500)

  const toNum = (s: string | null): number | null => {
    if (!s) return null
    const m = /^(\d{2}):(\d{2})$/.exec(s)
    return m ? Number(m[1]) + Number(m[2]) / 60 : null
  }

  const open = (collectors ?? []).filter((c) => {
    const cs = toNum(c.service_start)
    const ce = toNum(c.service_end)
    return cs != null && ce != null && cs <= slotFrom && ce >= slotTo
  })

  if (open.length === 0) {
    return jsonError('Permohonan ditolak: Saat ini tidak ada kurir/collector yang beroperasi pada jam tersebut. Silakan pilih jendela waktu lain.', 400)
  }

  const totalQuota = open.reduce((s, c) => s + (Number(c.max_pickups_per_slot) || 0), 0)

  // Jumlah pickup aktif pada window tsb di tanggal tsb
  const windowKey = start.toDateString()
  const { data: existing, error: exErr } = await sb
    .from('pickup_requests')
    .select('pickup_window_start')
    .in('status', activeStatuses)
  if (exErr) return jsonError('Gagal memvalidasi ketersediaan slot: ' + exErr.message, 500)

  let count = 0
  for (const p of existing ?? []) {
    const ps = new Date(p.pickup_window_start)
    if (!isNaN(ps.getTime()) && ps.toDateString() === windowKey) {
      const h = ps.getHours()
      if (h >= slotFrom && h < slotTo) count++
    }
  }

  if (count >= totalQuota) {
    return jsonError(`Permohonan ditolak: Kuota penjemputan pada jam tersebut sudah penuh (${totalQuota} permohonan). Silakan pilih jendela waktu lain.`, 400)
  }

  const finalLat = latitude ?? warung.latitude
  const finalLng = longitude ?? warung.longitude
  const finalAddress = address?.trim() || warung.address
  const finalNotes = instructions?.trim() || notes?.trim() || null

  // Perbarui alamat dan koordinat di profil warung jika ada perubahan
  if (finalAddress) {
    await sb
      .from('warung_profiles')
      .update({
        address: finalAddress,
        latitude: finalLat,
        longitude: finalLng,
      })
      .eq('id', warung.id)
  }

  // Coba insert dengan kolom notes terlebih dahulu
  const insertPayload: Record<string, unknown> = {
    warung_id: warung.id,
    waste_category_id,
    estimated_weight_kg: Number(estimated_weight_kg),
    sample_photo_url,
    latitude: finalLat,
    longitude: finalLng,
    pickup_window_start: start.toISOString(),
    pickup_window_end: end.toISOString(),
    status: 'pending',
  }
  if (finalNotes) {
    insertPayload.notes = finalNotes
  }

  let { data: pickup, error: pErr } = await sb
    .from('pickup_requests')
    .insert(insertPayload)
    .select('*')
    .single()

  // Jika kolom notes belum ada di skema database, fallback insert tanpa notes
  if (pErr && finalNotes) {
    delete insertPayload.notes
    const retry = await sb
      .from('pickup_requests')
      .insert(insertPayload)
      .select('*')
      .single()
    pickup = retry.data
    pErr = retry.error
  }

  if (pErr) return jsonError('Gagal membuat request: ' + pErr.message, 500)

  await logAudit(sb, {
    user_id: user.id,
    action: 'CREATE_PICKUP',
    resource_type: 'pickup_requests',
    resource_id: pickup.id,
    metadata: { estimated_weight_kg, waste_category_id, address: finalAddress, notes: finalNotes },
  })

  return jsonOk({ pickup, message: 'Pickup request berhasil dibuat (status: pending)' }, 201)
}

/**
 * GET /api/warung/pickups
 * Menampilkan daftar pickup milik warung yang sedang login
 * (dengan join kategori sampah & opsi filter status).
 */
export async function GET(request: Request) {
  const sb = await createClient()
  const { user, error } = await requireUser(sb, 'warung')
  if (error) return error

  const { data: warung, error: wErr } = await sb
    .from('warung_profiles')
    .select('id')
    .eq('user_id', user.id)
    .single()
  if (wErr) return jsonError('Profil warung tidak ditemukan', 404)

  const q = request.url.includes('?') ? new URL(request.url).searchParams : null
  const status = q?.get('status')

  let query = sb
    .from('pickup_requests')
    .select('*, waste_categories(category_name, is_maggot_friendly)')
    .eq('warung_id', warung.id)
    .order('created_at', { ascending: false })

  if (status && status !== 'all') query = query.eq('status', status)

  const { data, error: listErr } = await query
  if (listErr) return jsonError('Gagal mengambil request: ' + listErr.message, 500)

  return jsonOk({ pickups: data })
}
