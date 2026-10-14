/**
 * lib/api/warung.ts
 * Client-side functions - menggantikan /api/warung/* routes.
 */
import { createClient } from '@/lib/supabase/client'
import {
  parseDbDate,
  getWibParts,
  getWibDateString,
} from '@/lib/datetime'

export const SLOTS = [
  { label: '07:00 – 09:00 WIB', from: 7, to: 9 },
  { label: '09:00 – 11:00 WIB', from: 9, to: 11 },
  { label: '11:00 – 13:00 WIB', from: 11, to: 13 },
  { label: '13:00 – 15:00 WIB', from: 13, to: 15 },
  { label: '15:00 – 17:00 WIB', from: 15, to: 17 },
  { label: '17:00 – 19:00 WIB', from: 17, to: 19 },
  { label: '19:00 – 21:00 WIB', from: 19, to: 21 },
  { label: '21:00 – 23:00 WIB', from: 21, to: 23 },
]
const ACTIVE_STATUSES = ['pending', 'assigned', 'in_progress']

function hhmmToNum(hhmm: string | null): number | null {
  if (!hhmm) return null
  const m = /^(\d{2}):(\d{2})$/.exec(hhmm)
  return m ? Number(m[1]) + Number(m[2]) / 60 : null
}

export async function apiGetSlots(dateStr: string) {
  const sb = createClient()
  const dayKey = dateStr.slice(0, 10)
  const nowWib = getWibParts()
  const todayStr = getWibDateString()
  const isToday = dayKey === todayStr
  const isPastDate = dayKey < todayStr
  const currentHourFraction = nowWib.hour + nowWib.minute / 60

  const { data: collectors } = await sb
    .from('collector_profiles')
    .select('service_start, service_end, max_pickups_per_slot')

  const { data: pickups } = await sb
    .from('pickup_requests')
    .select('pickup_window_start, pickup_window_end')
    .in('status', ACTIVE_STATUSES)

  const result = SLOTS.map((slot) => {
    if (isPastDate) return { label: slot.label, avail: false, reason: 'Tanggal sudah lewat' }
    if (isToday && currentHourFraction >= slot.to) return { label: slot.label, avail: false, reason: 'Waktu sudah lewat' }

    const effectiveCollectors = (collectors && collectors.length > 0)
      ? collectors.map((c: { service_start?: string | null; service_end?: string | null; max_pickups_per_slot?: number | null }) => ({
          service_start: c.service_start || '07:00',
          service_end: c.service_end || '23:00',
          max_pickups_per_slot: Number(c.max_pickups_per_slot) || 5,
        }))
      : [{ service_start: '07:00', service_end: '23:00', max_pickups_per_slot: 5 }]

    const openCollectors = effectiveCollectors.filter((c: { service_start: string; service_end: string; max_pickups_per_slot: number }) => {
      const start = hhmmToNum(c.service_start) ?? 7
      const end = hhmmToNum(c.service_end) ?? 23
      return start <= slot.from && end >= slot.to
    })

    if (openCollectors.length === 0) return { label: slot.label, avail: false, reason: 'Di luar jam layanan collector' }

    const totalQuota = openCollectors.reduce((sum: number, c: { max_pickups_per_slot: number }) => sum + c.max_pickups_per_slot, 0)
    const slotStart = new Date(`${dayKey}T${String(slot.from).padStart(2, '0')}:00:00+07:00`).getTime()
    const slotEnd = new Date(`${dayKey}T${String(slot.to).padStart(2, '0')}:00:00+07:00`).getTime()

    let count = 0
    for (const p of pickups ?? []) {
      const ps = parseDbDate(p.pickup_window_start).getTime()
      if (!isNaN(ps) && ps >= slotStart && ps < slotEnd) count++
    }

    const avail = count < totalQuota
    return { label: slot.label, avail, reason: avail ? 'Slot Tersedia' : 'Kuota penuh' }
  })

  return { slots: result, date: dayKey }
}

export async function apiGetWarungPickups(statusFilter?: string) {
  const sb = createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) throw new Error('Tidak terautentikasi')

  const { data: warung } = await sb
    .from('warung_profiles')
    .select('id')
    .eq('user_id', user.id)
    .single()
  if (!warung) throw new Error('Profil warung tidak ditemukan')

  let query = sb
    .from('pickup_requests')
    .select('*, waste_categories(category_name, is_maggot_friendly)')
    .eq('warung_id', warung.id)
    .order('created_at', { ascending: false })

  if (statusFilter && statusFilter !== 'all') query = query.eq('status', statusFilter)

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return data
}

export async function apiCreatePickup(body: {
  waste_category_id: string
  estimated_weight_kg: number
  pickup_window_start: string
  pickup_window_end: string
  sample_photo_url: string
  latitude?: number
  longitude?: number
  address?: string
  notes?: string
}) {
  const sb = createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) throw new Error('Tidak terautentikasi')

  const { data: warung } = await sb
    .from('warung_profiles')
    .select('id, address, latitude, longitude')
    .eq('user_id', user.id)
    .single()
  if (!warung) throw new Error('Profil warung tidak ditemukan')

  const start = parseDbDate(body.pickup_window_start)
  const end = parseDbDate(body.pickup_window_end)
  const now = new Date()
  if (end.getTime() <= now.getTime()) throw new Error('Jendela waktu yang dipilih sudah lewat')

  // Validasi kuota berdasarkan jam WIB
  const startWib = getWibParts(start)
  const endWib = getWibParts(end)
  const slotFrom = startWib.hour
  const slotTo = endWib.hour
  const { data: collectors } = await sb.from('collector_profiles').select('service_start, service_end, max_pickups_per_slot')
  const open = (collectors ?? []).filter((c: { service_start?: string | null; service_end?: string | null }) => {
    const cs = hhmmToNum(c.service_start ?? null) ?? 7
    const ce = hhmmToNum(c.service_end ?? null) ?? 23
    return cs <= slotFrom && ce >= slotTo
  })
  if (open.length === 0) throw new Error('Tidak ada collector yang beroperasi pada jam tersebut')

  const totalQuota = open.reduce((s: number, c: { max_pickups_per_slot?: number | null }) => s + (Number(c.max_pickups_per_slot) || 0), 0)
  const slotStart = start.getTime()
  const slotEnd = end.getTime()
  const { data: existing } = await sb.from('pickup_requests').select('pickup_window_start').in('status', ACTIVE_STATUSES)
  let count = 0
  for (const p of existing ?? []) {
    const ps = parseDbDate(p.pickup_window_start).getTime()
    if (!isNaN(ps) && ps >= slotStart && ps < slotEnd) count++
  }
  if (count >= totalQuota) throw new Error(`Kuota penuh (${totalQuota}). Pilih jendela waktu lain.`)

  const finalLat = body.latitude ?? warung.latitude
  const finalLng = body.longitude ?? warung.longitude
  const finalAddress = body.address?.trim() || warung.address

  if (finalAddress) {
    await sb.from('warung_profiles').update({ address: finalAddress, latitude: finalLat, longitude: finalLng }).eq('id', warung.id)
  }

  const insertPayload: Record<string, unknown> = {
    warung_id: warung.id,
    waste_category_id: body.waste_category_id,
    estimated_weight_kg: Number(body.estimated_weight_kg),
    sample_photo_url: body.sample_photo_url,
    latitude: finalLat, longitude: finalLng,
    pickup_window_start: start.toISOString(),
    pickup_window_end: end.toISOString(),
    status: 'pending',
  }
  if (body.notes) insertPayload.notes = body.notes

  let { data: pickup, error: pErr } = await sb.from('pickup_requests').insert(insertPayload).select('*').single()
  if (pErr && body.notes) {
    delete insertPayload.notes
    const retry = await sb.from('pickup_requests').insert(insertPayload).select('*').single()
    pickup = retry.data; pErr = retry.error
  }
  if (pErr) throw new Error(pErr.message)

  await sb.from('audit_logs').insert({
    user_id: user.id, action: 'CREATE_PICKUP', resource_type: 'pickup_requests',
    resource_id: pickup!.id, metadata: { estimated_weight_kg: body.estimated_weight_kg, waste_category_id: body.waste_category_id }
  })

  return pickup
}

export async function apiGetWarungProfile() {
  const sb = createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) throw new Error('Tidak terautentikasi')
  const { data, error } = await sb.from('warung_profiles').select('*').eq('user_id', user.id).single()
  if (error) throw new Error(error.message)
  return data
}

export async function apiUpdateWarungProfile(update: Record<string, unknown>) {
  const sb = createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) throw new Error('Tidak terautentikasi')
  const { data, error } = await sb.from('warung_profiles').update(update).eq('user_id', user.id).select('*').single()
  if (error) throw new Error(error.message)
  return data
}

export async function apiCancelWarungPickup(id: string) {
  const sb = createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) throw new Error('Tidak terautentikasi')
  const { data, error } = await sb
    .from('pickup_requests')
    .update({ status: 'cancelled' })
    .eq('id', id)
    .eq('status', 'pending')
    .select('*')
    .single()
  if (error) throw new Error(error.message)
  await sb.from('audit_logs').insert({
    user_id: user.id,
    action: 'CANCEL_PICKUP',
    resource_type: 'pickup_requests',
    resource_id: id,
  })
  return data
}

