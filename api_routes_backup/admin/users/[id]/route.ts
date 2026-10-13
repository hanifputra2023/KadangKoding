import { createClient } from '@/lib/supabase/server'
import { requireUser, logAudit, jsonError, jsonOk, isMissingColumnError, fetchUserProfile } from '@/lib/helpers'
import type { Role } from '@/lib/types'

const ROLES: Role[] = ['warung', 'collector', 'admin']

// Pesan ketika kolom is_deleted belum ada (migrasi 0005 belum dijalankan).
const MISSING_COLUMN_MSG =
  'Kolom is_deleted belum ada di database — jalankan migrasi 0005_admin_features.sql di SQL Editor Supabase terlebih dahulu.'

async function countActiveAdmins(sb: Awaited<ReturnType<typeof createClient>>) {
  const base = sb
    .from('users')
    .select('id', { count: 'exact', head: true })
    .eq('role', 'admin')
  const { count, error } = await base.eq('is_deleted', false)
  if (isMissingColumnError(error)) {
    // Kolom is_deleted belum ada (migrasi 0005 belum dijalankan):
    // semua admin dianggap aktif.
    const fallback = await base
    return fallback
  }
  return { count, error }
}

/**
 * PATCH /api/admin/users/[id]
 * Kelola pengguna (role: admin, tanpa akses password).
 * Body (semua opsional): { name?, phone_number?, role?, is_deleted? }
 *  - name/phone_number : edit profil.
 *  - role              : ubah role (guard: tidak boleh ubah role sendiri,
 *                        tidak boleh menurunkan admin terakhir).
 *  - is_deleted        : true = nonaktifkan (soft delete), false = aktifkan kembali.
 */
export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const sb = await createClient()
  const { user, error } = await requireUser(sb, 'admin')
  if (error) return error

  const target = await fetchUserProfile(sb, id)
  if (!target) return jsonError('Pengguna tidak ditemukan', 404)

  const body = await request.json().catch(() => null)
  if (!body) return jsonError('Body JSON tidak valid', 400)

  const update: Record<string, unknown> = {}
  const log: Record<string, unknown> = {}

  if (body.name !== undefined) {
    const name = String(body.name).trim()
    if (!name) return jsonError('name tidak boleh kosong', 400)
    update.name = name
    log.name = name
  }
  if (body.phone_number !== undefined) {
    update.phone_number = body.phone_number === '' ? null : String(body.phone_number)
    log.phone_number = body.phone_number
  }
  if (body.role !== undefined) {
    const role = String(body.role) as Role
    if (!ROLES.includes(role)) return jsonError('role tidak valid', 400)
    if (user.id === id) {
      return jsonError('Tidak dapat mengubah role akun sendiri (cegah lockout)', 400)
    }
    if (target.role === 'admin' || role === 'admin') {
      const { count: adminCount, error: acErr } = await countActiveAdmins(sb)
      if (acErr) return jsonError('Gagal memeriksa jumlah admin: ' + acErr.message, 500)
      if ((adminCount ?? 0) <= 1) {
        return jsonError('Tidak dapat mengubah role: admin terakhir harus tetap admin', 400)
      }
    }
    update.role = role
    log.role = role
  }
  if (body.is_deleted !== undefined) {
    const flag = Boolean(body.is_deleted)
    if (flag && user.id === id) {
      return jsonError('Tidak dapat menonaktifkan akun sendiri', 400)
    }
    if (flag && target.role === 'admin') {
      const { count: adminCount, error: acErr } = await countActiveAdmins(sb)
      if (acErr) return jsonError('Gagal memeriksa jumlah admin: ' + acErr.message, 500)
      if ((adminCount ?? 0) <= 1) {
        return jsonError('Tidak dapat menonaktifkan admin terakhir', 400)
      }
    }
    update.is_deleted = flag
    log.is_deleted = flag
  }

  if (Object.keys(update).length === 0) {
    return jsonError('Tidak ada field yang diubah', 400)
  }

  const action =
    update.is_deleted === true
      ? 'DEACTIVATE_USER'
      : update.is_deleted === false
        ? 'RESTORE_USER'
        : 'UPDATE_USER'

  const { data, error: upErr } = await sb
    .from('users')
    .update(update)
    .eq('id', id)
    .select('id, name, email, role, phone_number, is_deleted, created_at')
    .single()
  if (upErr) {
    if (isMissingColumnError(upErr)) return jsonError(MISSING_COLUMN_MSG, 500)
    return jsonError('Gagal memperbarui pengguna: ' + upErr.message, 500)
  }

  await logAudit(sb, {
    user_id: user.id,
    action,
    resource_type: 'users',
    resource_id: id,
    metadata: log,
  })

  return jsonOk({ user: data, message: 'Pengguna berhasil diperbarui' })
}

/**
 * DELETE /api/admin/users/[id]
 * Soft-delete akun (set is_deleted = true). Tidak menghapus data fisik.
 * Guard: tidak bisa menghapus diri sendiri / admin terakhir.
 */
export async function DELETE(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const sb = await createClient()
  const { user, error } = await requireUser(sb, 'admin')
  if (error) return error

  const target = await fetchUserProfile(sb, id)
  if (!target) return jsonError('Pengguna tidak ditemukan', 404)
  if (target.is_deleted) return jsonError('Pengguna sudah dinonaktifkan', 400)
  if (user.id === id) return jsonError('Tidak dapat menonaktifkan akun sendiri', 400)

  if (target.role === 'admin') {
    const { count: adminCount, error: acErr } = await countActiveAdmins(sb)
    if (acErr) return jsonError('Gagal memeriksa jumlah admin: ' + acErr.message, 500)
    if ((adminCount ?? 0) <= 1) {
      return jsonError('Tidak dapat menonaktifkan admin terakhir', 400)
    }
  }

  const { data, error: dErr } = await sb
    .from('users')
    .update({ is_deleted: true })
    .eq('id', id)
    .select('id, name, email, role, phone_number, is_deleted, created_at')
    .single()
  if (dErr) {
    if (isMissingColumnError(dErr)) return jsonError(MISSING_COLUMN_MSG, 500)
    return jsonError('Gagal menonaktifkan pengguna: ' + dErr.message, 500)
  }

  await logAudit(sb, {
    user_id: user.id,
    action: 'DEACTIVATE_USER',
    resource_type: 'users',
    resource_id: id,
    metadata: { email: target.email },
  })

  return jsonOk({ user: data, message: 'Pengguna dinonaktifkan' })
}