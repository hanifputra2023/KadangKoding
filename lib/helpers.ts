import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import type { AuthedUser, Role } from '@/lib/types'

// ------------------------------------------------------------------
// Response helpers (konsisten untuk seluruh API)
// ------------------------------------------------------------------
export function jsonOk<T>(data: T, status = 200) {
  return NextResponse.json({ success: true, data }, { status })
}

export function jsonError(message: string, status = 400, extra?: Record<string, unknown>) {
  return NextResponse.json({ success: false, message, ...extra }, { status })
}

// ------------------------------------------------------------------
// Auth helper — mengambil user terautentikasi + role dari Supabase Auth
// ------------------------------------------------------------------

/**
 * Deteksi error PostgREST "kolom tidak ada" (mis. is_deleted pada project
 * yang belum menjalankan migrasi 0005). Kolom yang belum ada JANGAN
 * dianggap sebagai "akun dinonaktifkan".
 */
export function isMissingColumnError(err: { message?: string; code?: string } | null): boolean {
  if (!err) return false
  const msg = (err.message ?? '').toLowerCase()
  return (
    msg.includes('does not exist') ||
    msg.includes('undefined_column') ||
    err.code === '42703'
  )
}

/**
 * Mengambil profil user + flag is_deleted. Tahan terhadap kondisi kolom
 * is_deleted yang belum ada (migrasi 0005 belum dijalankan): saat kolom
 * tidak ada, profil dianggap aktif (is_deleted = false).
 */
export async function fetchUserProfile(sb: SupabaseClient, userId: string) {
  const { data, error } = await sb
    .from('users')
    .select('id, name, email, role, phone_number, is_deleted')
    .eq('id', userId)
    .single()

  if (error) {
    if (isMissingColumnError(error)) {
      const { data: legacy, error: legacyErr } = await sb
        .from('users')
        .select('id, name, email, role, phone_number')
        .eq('id', userId)
        .single()
      if (legacyErr || !legacy) return null
      return { ...legacy, is_deleted: false }
    }
    return null
  }

  return data ?? null
}

export async function getAuthedUser(
  sb: SupabaseClient
): Promise<AuthedUser | null> {
  const {
    data: { user },
    error,
  } = await sb.auth.getUser()
  if (error || !user) return null

  const profile = await fetchUserProfile(sb, user.id)
  if (!profile || profile.is_deleted) return null

  return {
    id: profile.id,
    name: profile.name,
    email: profile.email,
    role: profile.role as Role,
    phone_number: profile.phone_number,
  }
}

/**
 * Mengharuskan user login (dengan role opsional).
 * - role kosong => hanya mengharuskan login.
 * - role diisi  => wajib sama dengan role user.
 */
export async function requireUser(sb: SupabaseClient, role?: Role) {
  const user = await getAuthedUser(sb)
  if (!user) {
    return { user: null as unknown as AuthedUser, error: jsonError('Tidak terautentikasi', 401) }
  }
  if (role && user.role !== role) {
    return { user, error: jsonError('Akses ditolak: role tidak diizinkan', 403) }
  }
  return { user, error: null }
}

// ------------------------------------------------------------------
// Audit log
// ------------------------------------------------------------------
export async function logAudit(
  sb: SupabaseClient,
  input: {
    user_id?: string | null
    action: string
    resource_type: string
    resource_id?: string | null
    metadata?: Record<string, unknown> | null
  }
) {
  await sb.from('audit_logs').insert({
    user_id: input.user_id ?? null,
    action: input.action,
    resource_type: input.resource_type,
    resource_id: input.resource_id ?? null,
    metadata: input.metadata ?? null,
  })
}

// ------------------------------------------------------------------
// Menutup rute otomatis bila seluruh route stop sudah berstatus terminal
// (completed/failed/cancelled). Dipanggil setelah menandai satu stop
// selesai atau gagal, agar rute tidak tersangkut status 'active'.
// ------------------------------------------------------------------
export async function closeRouteIfDone(
  sb: SupabaseClient,
  pickupRequestId: string
) {
  const { data: stopRow } = await sb
    .from('route_stops')
    .select('route_id')
    .eq('pickup_request_id', pickupRequestId)
    .single()

  if (!stopRow?.route_id) return

  const { data: routeStops, error } = await sb
    .from('route_stops')
    .select('status')
    .eq('route_id', stopRow.route_id)
  if (error || !Array.isArray(routeStops) || routeStops.length === 0) return

  const allTerminal = routeStops.every((s) =>
    ['completed', 'failed', 'cancelled'].includes(s.status)
  )

  if (allTerminal) {
    await sb
      .from('routes')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', stopRow.route_id)
  }
}

// ------------------------------------------------------------------
// Memastikan seluruh operasi Supabase memakai client dengan konteks auth
// ------------------------------------------------------------------
export { createClient }
