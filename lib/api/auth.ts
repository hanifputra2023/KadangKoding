/**
 * lib/api/auth.ts
 * Client-side auth functions - menggantikan /api/auth/* routes.
 */
import { createClient } from '@/lib/supabase/client'

export interface AuthUser {
  id: string
  name: string
  email: string
  role: 'warung' | 'collector' | 'admin'
  phone_number?: string | null
}

async function fetchProfile(userId: string): Promise<AuthUser | null> {
  const sb = createClient()
  const { data, error } = await sb
    .from('users')
    .select('id, name, email, role, phone_number, is_deleted')
    .eq('id', userId)
    .single()

  if (error || !data) {
    const { data: legacy } = await sb
      .from('users')
      .select('id, name, email, role, phone_number')
      .eq('id', userId)
      .single()
    return legacy ? ({ ...legacy, is_deleted: false } as unknown as AuthUser) : null
  }

  if ((data as { is_deleted?: boolean }).is_deleted) return null
  return data as unknown as AuthUser
}

export async function apiLogin(
  email: string,
  password: string
): Promise<{ user: AuthUser; error: null } | { user: null; error: string }> {
  const sb = createClient()
  const { data, error } = await sb.auth.signInWithPassword({ email, password })
  if (error || !data.user) return { user: null, error: 'Email atau password salah' }

  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem('ws_last_session_refresh', String(Date.now()))
    } catch {}
  }

  const profile = await fetchProfile(data.user.id)
  if (!profile) {
    await sb.auth.signOut()
    return { user: null, error: 'Akun tidak ditemukan atau telah dinonaktifkan' }
  }

  return { user: profile, error: null }
}

export async function apiLogout(): Promise<void> {
  const sb = createClient()
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem('ws_last_session_refresh')
    } catch {}
  }
  await sb.auth.signOut()
}

export async function apiGetMe(): Promise<AuthUser | null> {
  const sb = createClient()

  // 1. Ambil sesi aktif yang tersimpan
  const {
    data: { session },
    error: sessionErr,
  } = await sb.auth.getSession()

  if (sessionErr || !session) return null

  // 2. Rolling Session (Perpanjangan Otomatis 30 Hari):
  // Setiap kali user membuka website (misal 1 hari dalam seminggu atau kapan pun dalam 30 hari),
  // refreshSession() dipanggil untuk memperbarui token dan memajukan masa aktif cookie 30 hari lagi.
  // Dibatasi jeda 15 menit agar tidak berlebihan saat navigasi halaman.
  if (typeof window !== 'undefined') {
    try {
      const LAST_REFRESH_KEY = 'ws_last_session_refresh'
      const lastRefresh = parseInt(localStorage.getItem(LAST_REFRESH_KEY) || '0', 10)
      const now = Date.now()
      const FIFTEEN_MINUTES = 15 * 60 * 1000

      if (now - lastRefresh > FIFTEEN_MINUTES) {
        const { error: refreshErr } = await sb.auth.refreshSession()
        if (!refreshErr) {
          localStorage.setItem(LAST_REFRESH_KEY, String(now))
        }
      }
    } catch {
      // Abaikan jika ada gangguan koneksi sementara, sesi lokal tetap berjalan
    }
  }

  const {
    data: { user },
    error,
  } = await sb.auth.getUser()
  if (error || !user) return null
  return fetchProfile(user.id)
}

export async function apiRegister(body: {
  email: string
  password: string
  name: string
  role: 'warung' | 'collector'
  phone_number?: string
  warung?: { business_name: string; address: string; latitude: number; longitude: number }
  collector?: { vehicle_type: string; vehicle_capacity_kg?: number; service_area?: string; latitude?: number; longitude?: number }
}): Promise<{ user: AuthUser; error: null } | { user: null; error: string }> {
  const sb = createClient()
  const { email, password, name, role, phone_number } = body

  const { data, error } = await sb.auth.signUp({
    email,
    password,
    options: {
      data: {
        name,
        role,
        phone_number: phone_number ?? null,
        profile: role === 'warung' ? body.warung ?? null : role === 'collector' ? body.collector ?? null : null,
      },
    },
  })

  if (error || !data.user) {
    return { user: null, error: error?.message || 'Gagal mendaftar' }
  }

  const authUserId = data.user.id

  if (role === 'warung' && body.warung) {
    await sb.from('warung_profiles').insert({
      user_id: authUserId,
      business_name: body.warung.business_name,
      address: body.warung.address,
      latitude: body.warung.latitude,
      longitude: body.warung.longitude,
    })
  }

  if (role === 'collector' && body.collector) {
    await sb.from('collector_profiles').insert({
      user_id: authUserId,
      vehicle_type: body.collector.vehicle_type,
      vehicle_capacity_kg: body.collector.vehicle_capacity_kg ?? 50,
      service_area: body.collector.service_area ?? null,
      latitude: body.collector.latitude ?? null,
      longitude: body.collector.longitude ?? null,
    })
  }

  const profile = await fetchProfile(authUserId)
  return { user: profile || ({ id: authUserId, name, email, role, phone_number } as AuthUser), error: null }
}

export async function apiUpdateProfile(data: {
  name?: string
  phone_number?: string
}): Promise<{ error: string | null }> {
  const sb = createClient()
  const {
    data: { user },
    error: authErr,
  } = await sb.auth.getUser()
  if (authErr || !user) return { error: 'Sesi login tidak valid' }

  // 1. Update metadata di auth.users (memicu trigger sync_user_profile)
  const metaUpdates: Record<string, string> = {}
  if (data.name !== undefined) metaUpdates.name = data.name.trim()
  if (data.phone_number !== undefined) metaUpdates.phone_number = data.phone_number.trim()

  const { error: updateAuthErr } = await sb.auth.updateUser({
    data: metaUpdates,
  })
  if (updateAuthErr) {
    return { error: updateAuthErr.message || 'Gagal memperbarui metadata akun' }
  }

  // 2. Update langsung ke public.users
  try {
    const directUpdates: Record<string, string> = {}
    if (data.name !== undefined) directUpdates.name = data.name.trim()
    if (data.phone_number !== undefined) directUpdates.phone_number = data.phone_number.trim()

    await sb.from('users').update(directUpdates).eq('id', user.id)
  } catch {
    // Abaikan jika RLS belum di-apply, trigger di auth.users sudah menangani update
  }

  return { error: null }
}

export async function apiUpdatePassword(newPassword: string): Promise<{ error: string | null }> {
  const sb = createClient()
  if (!newPassword || newPassword.length < 6) {
    return { error: 'Kata sandi minimal 6 karakter' }
  }

  const { error } = await sb.auth.updateUser({
    password: newPassword,
  })
  if (error) {
    return { error: error.message || 'Gagal memperbarui kata sandi' }
  }

  return { error: null }
}

