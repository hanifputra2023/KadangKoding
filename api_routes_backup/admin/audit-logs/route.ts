import { createClient } from '@/lib/supabase/server'
import { requireUser, jsonError, jsonOk } from '@/lib/helpers'

/**
 * GET /api/admin/audit-logs
 * Viewer audit log dengan filter (role: admin).
 * Filter: ?action=&user_id=&from=&to=
 */
export async function GET(request: Request) {
  const sb = await createClient()
  const { error } = await requireUser(sb, 'admin')
  if (error) return error

  const { searchParams } = new URL(request.url)
  const action = searchParams.get('action')
  const userId = searchParams.get('user_id')
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  let q = sb
    .from('audit_logs')
    .select('*, users(name, email, role)')
    .order('created_at', { ascending: false })

  if (action) q = q.ilike('action', `%${action}%`)
  if (userId) q = q.eq('user_id', userId)
  if (from) q = q.gte('created_at', new Date(from).toISOString())
  if (to) q = q.lte('created_at', new Date(to).toISOString())

  const { data, error: aErr } = await q
  if (aErr) return jsonError('Gagal mengambil audit log: ' + aErr.message, 500)

  return jsonOk({ logs: data })
}
