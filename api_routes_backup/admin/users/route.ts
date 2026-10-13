import { createClient } from '@/lib/supabase/server'
import { requireUser, jsonError, jsonOk, isMissingColumnError } from '@/lib/helpers'

/**
 * GET /api/admin/users
 * Daftar pengguna (role: admin). Password tidak pernah diekspos.
 * Filter: ?role=warung|collector|admin &include_deleted=true (default sembunyikan
 * akun yang dinonaktifkan).
 */
export async function GET(request: Request) {
  const sb = await createClient()
  const { error } = await requireUser(sb, 'admin')
  if (error) return error

  const { searchParams } = new URL(request.url)
  const role = searchParams.get('role')
  const includeDeleted = searchParams.get('include_deleted') === 'true'

  let q = sb
    .from('users')
    .select('id, name, email, role, phone_number, is_deleted, created_at')
    .order('created_at', { ascending: false })

  if (role) q = q.eq('role', role)
  if (!includeDeleted) q = q.eq('is_deleted', false)

  const { data, error: uErr } = await q
  // Migrasi 0005 belum dijalankan → kolom is_deleted tidak ada.
  if (isMissingColumnError(uErr)) {
    let q2 = sb
      .from('users')
      .select('id, name, email, role, phone_number, created_at')
      .order('created_at', { ascending: false })
    if (role) q2 = q2.eq('role', role)
    const { data: d2, error: uErr2 } = await q2
    if (uErr2) return jsonError('Gagal mengambil data user: ' + uErr2.message, 500)
    return jsonOk({ users: (d2 ?? []).map((u: Record<string, unknown>) => ({ ...u, is_deleted: false })) })
  }
  if (uErr) return jsonError('Gagal mengambil data user: ' + uErr.message, 500)

  return jsonOk({ users: data })
}
