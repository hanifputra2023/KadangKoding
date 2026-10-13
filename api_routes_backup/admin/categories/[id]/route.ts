import { createClient } from '@/lib/supabase/server'
import { requireUser, logAudit, jsonError, jsonOk } from '@/lib/helpers'

/**
 * PATCH /api/admin/categories/[id]
 * Ubah kategori sampah. Body: { category_name?, description?, is_maggot_friendly? }
 */
export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const sb = await createClient()
  const { user, error } = await requireUser(sb, 'admin')
  if (error) return error

  const { data: existing, error: fErr } = await sb
    .from('waste_categories')
    .select('*')
    .eq('id', id)
    .single()
  if (fErr || !existing) return jsonError('Kategori tidak ditemukan', 404)

  const body = await request.json().catch(() => ({}))
  const update: Record<string, unknown> = {}

  if (body.category_name !== undefined) {
    const name = String(body.category_name).trim()
    if (!name) return jsonError('category_name tidak boleh kosong', 400)
    if (name.length > 50) return jsonError('category_name maksimal 50 karakter', 400)
    if (name.toLowerCase() !== existing.category_name.toLowerCase()) {
      const { count, error: dupErr } = await sb
        .from('waste_categories')
        .select('id', { count: 'exact', head: true })
        .ilike('category_name', name)
        .neq('id', id)
      if (dupErr) return jsonError('Gagal cek duplikat: ' + dupErr.message, 500)
      if ((count ?? 0) > 0) return jsonError('Kategori dengan nama sama sudah ada', 409)
    }
    update.category_name = name
  }
  if (body.description !== undefined) {
    update.description = body.description === '' ? null : String(body.description).trim()
  }
  if (body.is_maggot_friendly !== undefined) {
    update.is_maggot_friendly = Boolean(body.is_maggot_friendly)
  }

  if (Object.keys(update).length === 0) {
    return jsonError('Tidak ada field yang diubah', 400)
  }

  const { data, error: upErr } = await sb
    .from('waste_categories')
    .update(update)
    .eq('id', id)
    .select('*')
    .single()
  if (upErr) return jsonError('Gagal memperbarui kategori: ' + upErr.message, 500)

  await logAudit(sb, {
    user_id: user.id,
    action: 'UPDATE_CATEGORY',
    resource_type: 'waste_categories',
    resource_id: id,
    metadata: update,
  })

  return jsonOk({ category: data, message: 'Kategori berhasil diperbarui' })
}

/**
 * DELETE /api/admin/categories/[id]
 * Hapus kategori. Ditolak bila masih dipakai oleh pickup request.
 */
export async function DELETE(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const sb = await createClient()
  const { user, error } = await requireUser(sb, 'admin')
  if (error) return error

  const { data: existing, error: fErr } = await sb
    .from('waste_categories')
    .select('id, category_name')
    .eq('id', id)
    .single()
  if (fErr || !existing) return jsonError('Kategori tidak ditemukan', 404)

  const { count, error: useErr } = await sb
    .from('pickup_requests')
    .select('id', { count: 'exact', head: true })
    .eq('waste_category_id', id)
  if (useErr) return jsonError('Gagal cek pemakaian kategori: ' + useErr.message, 500)
  if ((count ?? 0) > 0) {
    return jsonError(`Kategori "${existing.category_name}" dipakai ${count} pickup — tidak dapat dihapus`, 409)
  }

  const { error: dErr } = await sb.from('waste_categories').delete().eq('id', id)
  if (dErr) return jsonError('Gagal menghapus kategori: ' + dErr.message, 500)

  await logAudit(sb, {
    user_id: user.id,
    action: 'DELETE_CATEGORY',
    resource_type: 'waste_categories',
    resource_id: id,
    metadata: { category_name: existing.category_name },
  })

  return jsonOk({ message: 'Kategori dihapus' })
}