import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireUser, jsonError, isMissingColumnError } from '@/lib/helpers'

export const dynamic = 'force-dynamic'

interface ExportPickupRow {
  id: string | null
  status: string | null
  estimated_weight_kg: number | null
  actual_weight_kg: number | null
  pickup_window_start: string | null
  pickup_window_end: string | null
  created_at: string | null
  assigned_at: string | null
  completed_at: string | null
  expired_at: string | null
  warung_profiles?: { business_name: string; address: string } | null
  collector_profiles?: { vehicle_type: string } | null
  waste_categories?: { category_name: string } | null
}

interface ExportAuditRow {
  created_at: string | null
  action: string | null
  resource_type: string | null
  resource_id: string | null
  metadata: unknown
  users?: { name: string; email: string; role: string } | null
}

/**
 * GET /api/admin/export?type=pickups|users|audit
 * Ekspor laporan CSV (role: admin).
 * - pickups : semua pickup + nama warung, kategori, collector.
 * - users   : direktori pengguna (tanpa password).
 * - audit   : audit log.
 * File disertakan dengan BOM UTF-8 agar terbaca Excel dengan benar.
 */
export async function GET(request: Request) {
  const sb = await createClient()
  const { error } = await requireUser(sb, 'admin')
  if (error) return error

  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type') ?? 'pickups'

  let header: string[] = []
  let rows: string[][] = []

  if (type === 'users') {
    const { data, error: uErr } = await sb
      .from('users')
      .select('name, email, role, phone_number, is_deleted, created_at')
      .order('created_at', { ascending: false })
    if (isMissingColumnError(uErr)) {
      const { data: dLegacy, error: uErr2 } = await sb
        .from('users')
        .select('name, email, role, phone_number, created_at')
        .order('created_at', { ascending: false })
      if (uErr2) return jsonError('Gagal ekpor pengguna: ' + uErr2.message, 500)

      header = ['Nama', 'Email', 'Role', 'No. HP', 'Status', 'Tanggal Gabung']
      rows = ((dLegacy ?? []) as Array<{
        name: string | null
        email: string | null
        role: string | null
        phone_number: string | null
        created_at: string | null
      }>).map((u) => [
        u.name ?? '',
        u.email ?? '',
        u.role ?? '',
        u.phone_number ?? '',
        'aktif',
        u.created_at ? new Date(u.created_at).toISOString() : '',
      ])
    } else if (uErr) {
      return jsonError('Gagal ekpor pengguna: ' + uErr.message, 500)
    } else {
      header = ['Nama', 'Email', 'Role', 'No. HP', 'Status', 'Tanggal Gabung']
      rows = ((data ?? []) as Array<{
        name: string | null
        email: string | null
        role: string | null
        phone_number: string | null
        is_deleted: boolean | null
        created_at: string | null
      }>).map((u) => [
        u.name ?? '',
        u.email ?? '',
        u.role ?? '',
        u.phone_number ?? '',
        u.is_deleted ? 'nonaktif' : 'aktif',
        u.created_at ? new Date(u.created_at).toISOString() : '',
      ])
    }
  } else if (type === 'audit') {
    const { data, error: aErr } = await sb
      .from('audit_logs')
      .select('*, users(name, email, role)')
      .order('created_at', { ascending: false })
    if (aErr) return jsonError('Gagal ekspor audit log: ' + aErr.message, 500)

    header = ['Waktu', 'User', 'Email', 'Role', 'Aksi', 'Modul', 'Resource ID', 'Metadata']
    rows = ((data ?? []) as ExportAuditRow[]).map((l) => [
      l.created_at ? new Date(l.created_at).toISOString() : '',
      l.users?.name ?? 'System',
      l.users?.email ?? '',
      l.users?.role ?? '',
      l.action ?? '',
      l.resource_type ?? '',
      l.resource_id ?? '',
      l.metadata ? JSON.stringify(l.metadata) : '',
    ])
  } else {
    // default: pickups
    const { data, error: pErr } = await sb
      .from('pickup_requests')
      .select(
        `id, status, estimated_weight_kg, actual_weight_kg, pickup_window_start,
         pickup_window_end, created_at, assigned_at, completed_at, expired_at,
         warung_profiles(business_name, address),
         collector_profiles(vehicle_type),
         waste_categories(category_name)`
      )
      .order('created_at', { ascending: false })
    if (pErr) return jsonError('Gagal ekspor pickup: ' + pErr.message, 500)

    header = [
      'ID', 'Status', 'Estimasi (kg)', 'Aktual (kg)', 'Warung', 'Alamat',
      'Kategori', 'Collector', 'Window Mulai', 'Window Selesai', 'Dibuat',
      'Diklaim', 'Selesai', 'Kedaluwarsa',
    ]
    rows = ((data ?? []) as unknown as ExportPickupRow[]).map((p) => [
      p.id ?? '',
      p.status ?? '',
      String(p.estimated_weight_kg ?? ''),
      String(p.actual_weight_kg ?? ''),
      p.warung_profiles?.business_name ?? '',
      p.warung_profiles?.address ?? '',
      p.waste_categories?.category_name ?? '',
      p.collector_profiles?.vehicle_type ?? '',
      p.pickup_window_start ? new Date(p.pickup_window_start).toISOString() : '',
      p.pickup_window_end ? new Date(p.pickup_window_end).toISOString() : '',
      p.created_at ? new Date(p.created_at).toISOString() : '',
      p.assigned_at ? new Date(p.assigned_at).toISOString() : '',
      p.completed_at ? new Date(p.completed_at).toISOString() : '',
      p.expired_at ? new Date(p.expired_at).toISOString() : '',
    ])
  }

  const csv = toCsv(header, rows)
  const filename = `warungsirkular-${type}-${new Date().toISOString().slice(0, 10)}.csv`

  return new NextResponse('\uFEFF' + csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}

function esc(value: string): string {
  const s = String(value ?? '')
  return '"' + s.replace(/"/g, '""') + '"'
}

function toCsv(header: string[], rows: string[][]): string {
  const lines = [header.map(esc).join(',')]
  for (const r of rows) lines.push(r.map(esc).join(','))
  return lines.join('\r\n')
}