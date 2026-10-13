import { createClient } from '@/lib/supabase/server'
import { jsonError, jsonOk } from '@/lib/helpers'

/**
 * GET /api/categories
 * Menampilkan daftar kategori sampah (butuh login sesuai RLS).
 */
export async function GET() {
  const sb = await createClient()

  const { data, error } = await sb
    .from('waste_categories')
    .select('*')
    .order('category_name')

  if (error) return jsonError('Gagal mengambil kategori: ' + error.message, 500)
  return jsonOk({ categories: data })
}
