import { createClient } from '@/lib/supabase/server'
import { requireUser, jsonError, jsonOk } from '@/lib/helpers'

/**
 * GET /api/warung/slots?date=YYYY-MM-DD
 * Menghitung ketersediaan "Jendela Waktu" secara dinamis,
 * disesuaikan dengan kondisi collector (jadwal layanan + kuota per slot).
 *
 * Logika:
 *  - Setiap slot waktu berdurasi 2 jam (07-09, 09-11, 11-13, 13-15, 15-17).
 *  - Suatu slot TERSEDIA jika:
 *      a) Ada collector yang jam layanannya mencakup slot tsb (buka), DAN
 *      b) Jumlah pickup belum-terminal (pending/assigned/in_progress)
 *         pada slot tsb < total kuota (max_pickups_per_slot) semua collector
 *         yang sedang buka pada slot tsb.
 */

const SLOTS: { label: string; from: number; to: number }[] = [
  { label: '07:00 – 09:00 WIB', from: 7, to: 9 },
  { label: '09:00 – 11:00 WIB', from: 9, to: 11 },
  { label: '11:00 – 13:00 WIB', from: 11, to: 13 },
  { label: '13:00 – 15:00 WIB', from: 13, to: 15 },
  { label: '15:00 – 17:00 WIB', from: 15, to: 17 },
]

const ACTIVE_STATUSES = ['pending', 'assigned', 'in_progress']

function hhmmToNum(hhmm: string | null): number | null {
  if (!hhmm) return null
  const m = /^(\d{2}):(\d{2})$/.exec(hhmm)
  if (!m) return null
  return Number(m[1]) + Number(m[2]) / 60
}

export async function GET(request: Request) {
  const sb = await createClient()
  const requestor = await requireUser(sb)
  if (requestor.error) return requestor.error

  const { searchParams } = new URL(request.url)
  const dateStr = searchParams.get('date')
  if (!dateStr) return jsonError('Parameter date (YYYY-MM-DD) wajib diisi', 400)
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) {
    return jsonError('Tanggal tidak valid', 400)
  }
  // Normalisasi ke tanggal lokal tanpa zona waktu
  const dayKey = dateStr.slice(0, 10)

  const now = new Date()
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const isToday = dayKey === todayStr

  const [sYear, sMonth, sDay] = dayKey.split('-').map(Number)
  const selectedDateMidnight = new Date(sYear, sMonth - 1, sDay)
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const isPastDate = selectedDateMidnight < todayMidnight
  const currentHourFraction = now.getHours() + now.getMinutes() / 60

  // Ambil semua collector aktif beserta jadwal & kuota
  const { data: collectors, error: cErr } = await sb
    .from('collector_profiles')
    .select('user_id, service_start, service_end, max_pickups_per_slot')
  if (cErr) return jsonError('Gagal mengambil profil collector: ' + cErr.message, 500)

  // Ambil semua pickup belum-terminal
  const { data: pickups, error: pErr } = await sb
    .from('pickup_requests')
    .select('pickup_window_start, pickup_window_end')
    .in('status', ACTIVE_STATUSES)
  if (pErr) return jsonError('Gagal mengambil pickup: ' + pErr.message, 500)

  // Hitung per slot
  const result = SLOTS.map((slot) => {
    // 1. Cek apakah tanggal di masa lalu
    if (isPastDate) {
      return { label: slot.label, avail: false, reason: 'Tanggal sudah lewat' }
    }

    // 2. Jika hari ini, cek apakah jam selesai slot (window end) sudah terlewati waktu saat ini
    if (isToday && currentHourFraction >= slot.to) {
      return { label: slot.label, avail: false, reason: 'Waktu sudah lewat' }
    }

    // 3. Collector yang buka pada slot ini
    // Jika collector belum mengatur jadwal (null), gunakan default platform (07:00 - 17:00, kuota 5)
    const effectiveCollectors = (collectors && collectors.length > 0)
      ? collectors.map((c) => ({
          service_start: c.service_start || '07:00',
          service_end: c.service_end || '17:00',
          max_pickups_per_slot: Number(c.max_pickups_per_slot) || 5,
        }))
      : [{ service_start: '07:00', service_end: '17:00', max_pickups_per_slot: 5 }]

    const openCollectors = effectiveCollectors.filter((c) => {
      const start = hhmmToNum(c.service_start) ?? 7
      const end = hhmmToNum(c.service_end) ?? 17
      // slot harus berada di dalam rentang layanan collector
      return start <= slot.from && end >= slot.to
    })

    if (openCollectors.length === 0) {
      return { label: slot.label, avail: false, reason: 'Di luar jam layanan collector' }
    }

    const totalQuota = openCollectors.reduce(
      (sum, c) => sum + (Number(c.max_pickups_per_slot) || 5),
      0
    )

    // 4. Hitung jumlah pickup pada window tsb di tanggal tsb
    const slotStart = new Date(`${dayKey}T${String(slot.from).padStart(2, '0')}:00:00`)
    const slotEnd = new Date(`${dayKey}T${String(slot.to).padStart(2, '0')}:00:00`)

    let count = 0
    for (const p of pickups ?? []) {
      const ps = new Date(p.pickup_window_start)
      if (!isNaN(ps.getTime()) && ps >= slotStart && ps < slotEnd) count++
    }

    const avail = count < totalQuota
    return {
      label: slot.label,
      avail,
      reason: avail
        ? 'Slot Tersedia'
        : count >= totalQuota
          ? 'Kuota penuh'
          : 'Tidak tersedia',
    }
  })

  return jsonOk({ slots: result, date: dayKey })
}
