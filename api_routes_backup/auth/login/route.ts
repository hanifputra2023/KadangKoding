import { createClient } from '@/lib/supabase/server'
import { jsonError, jsonOk, fetchUserProfile } from '@/lib/helpers'

/**
 * POST /api/auth/login
 * Body: { email, password }
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  if (!body) return jsonError('Body JSON tidak valid', 400)

  const { email, password } = body as { email: string; password: string }
  if (!email || !password) return jsonError('email dan password wajib diisi', 400)

  const sb = await createClient()
  const { data, error } = await sb.auth.signInWithPassword({ email, password })
  if (error) return jsonError('Email atau password salah', 401)

  const profile = await fetchUserProfile(sb, data.user.id)
  if (!profile) {
    await sb.auth.signOut().catch(() => null)
    return jsonError('Akun tidak ditemukan', 401)
  }
  // User yang dinonaktifkan admin (is_deleted = true) tidak boleh login.
  if (profile.is_deleted) {
    await sb.auth.signOut().catch(() => null)
    return jsonError('Akun telah dinonaktifkan oleh admin', 403)
  }

  return jsonOk({
    message: 'Login berhasil',
    user: {
      id: profile.id,
      name: profile.name,
      email: profile.email,
      role: profile.role,
      phone_number: profile.phone_number,
    },
  })
}
