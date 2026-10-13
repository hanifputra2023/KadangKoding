import { createClient } from '@/lib/supabase/server'
import { requireUser, logAudit, jsonError, jsonOk } from '@/lib/helpers'

/**
 * GET /api/admin/categories
 * Daftar kategori sampah (role: admin).
 */
export async function GET() {
  const sb = await createClient()
  const { error } = await requireUser(sb, 'admin')
  if (error) return error

  const { data, error: gErr } = await sb
    .from('waste_categories')
    .select('*')
    .order('category_name')
  if (gErr) return jsonError('Gagal mengambil kategori: ' + gErr.message, 500)

  return jsonOk({ categories: data })
}

/**
 * POST /api/admin/categories
 * Tambah kategori sampah baru.
 * Body: { category_name, description?, is_maggot_friendly? }
 */
export async function POST(request: Request) {
  const sb = await createClient()
  const { user, error } = await requireUser(sb, 'admin')
  if (error) return error

  const body = await request.json().catch(() => null)
  if (!body) return jsonError('Body JSON tidak valid', 400)

  const category_name = String(body.category_name ?? '').trim()
  if (!category_name) return jsonError('category_name wajib diisi', 400)
  if (category_name.length > 50) return jsonError('category_name maksimal 50 karakter', 400)

  const description =
    body.description !== undefined && body.description !== ''
      ? String(body.description).trim()
      : null
  const is_maggot_friendly =
    body.is_maggot_friendly !== undefined ? Boolean(body.is_maggot_friendly) : true

  const { count, error: dupErr } = await sb
    .from('waste_categories')
    .select('id', { count: 'exact', head: true })
    .ilike('category_name', category_name)
  if (dupErr) return jsonError('Gagal cek duplikat: ' + dupErr.message, 500)
  if ((count ?? 0) > 0) return jsonError('Kategori dengan nama sama sudah ada', 409)

  const { data, error: iErr } = await sb
    .from('waste_categories')
    .insert({ category_name, description, is_maggot_friendly })
    .select('*')
    .single()
  if (iErr) return jsonError('Gagal menambah kategori: ' + iErr.message, 500)

  await logAudit(sb, {
    user_id: user.id,
    action: 'CREATE_CATEGORY',
    resource_type: 'waste_categories',
    resource_id: data.id,
    metadata: { category_name },
  })

  return jsonOk({ category: data, message: 'Kategori berhasil ditambahkan' }, 201)
}