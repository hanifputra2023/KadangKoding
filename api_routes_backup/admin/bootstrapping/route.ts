import { createServiceClient } from '@/lib/supabase/service'
import { jsonError, jsonOk } from '@/lib/helpers'

export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/bootstrapping
 * Membuat admin (bootstrap) — BUKAN endpoint publik.
 *
 * Keamanan:
 *  - Dilindungi header `Authorization: Bearer <ADMIN_BOOTSTRAP_SECRET>`.
 *  - Memakai Service Role Key (bypass RLS) via createServiceClient.
 *  - Hanya mengizinkan jika belum ada admin sama sekali (cegah mengubah
 *    sembarang user jadi admin).
 *
 * Gunakan oleh developer:
 *   curl -X POST http://localhost:3000/api/admin/bootstrapping \
 *     -H "Authorization: Bearer <ADMIN_BOOTSTRAP_SECRET>" \
 *     -H "Content-Type: application/json" \
 *     -d '{"email":"admin@rumahsirkular.id","password":"<password>","name":"Admin"}'
 */
export async function POST(request: Request) {
  const secret = process.env.ADMIN_BOOTSTRAP_SECRET
  if (!secret) {
    return jsonError('ADMIN_BOOTSTRAP_SECRET belum dikonfigurasi', 500)
  }
  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${secret}`) {
    return jsonError('Unauthorized', 401)
  }

  const body = await request.json().catch(() => null)
  if (!body) return jsonError('Body JSON tidak valid', 400)
  const { email, password, name } = body as { email?: string; password?: string; name?: string }
  if (!email || !password || !name) return jsonError('email, password, dan name wajib diisi', 400)
  if (password.length < 6) return jsonError('Password minimal 6 karakter', 400)

  const sb = createServiceClient()

  // Guard: hanya jika belum ada admin (cegah registrasi admin sembarangan).
  const { count: adminCount, error: adErr } = await sb
    .from('users')
    .select('id', { count: 'exact', head: true })
    .eq('role', 'admin')
  if (adErr) return jsonError('Gagal memeriksa admin: ' + adErr.message, 500)
  if ((adminCount ?? 0) > 0) {
    return jsonError('Admin sudah ada — bootstrap hanya untuk admin pertama', 409)
  }

  // Buat user di Supabase Auth dengan metadata role=admin.
  const { data, error: uErr } = await sb.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name, role: 'admin' },
  })
  if (uErr) return jsonError('Gagal membuat user admin: ' + uErr.message, 400)

  // Trigger handle_new_user() menyinkronkan role admin ke public.users.
  // Beri redundansi: pastikan baris public.users ber-role admin.
  const id = data.user?.id
  if (!id) return jsonError('Gagal mendapat id user', 500)
  const { error: syncErr } = await sb
    .from('users')
    .update({ role: 'admin', name })
    .eq('id', id)
  if (syncErr) return jsonError('Gagal sinkron profil admin: ' + syncErr.message, 500)

  return jsonOk({
    message: 'Admin berhasil dibuat',
    user: { id, email, role: 'admin' },
  }, 201)
}
