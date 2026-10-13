import { createServiceClient } from '@/lib/supabase/service'
import { jsonError, jsonOk } from '@/lib/helpers'

export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * GET /api/cron/auto-expire
 * Background worker: menandai pickup "pending" yang kedaluwarsa menjadi
 * "expired" (PRD 4.6). Dipanggil oleh scheduler (Vercel Cron / GitHub
 * Action / Upstash Cron) secara berkala.
 *
 * Syarat expired (PRD 8.1 item 5):
 *   - status = pending DAN
 *   - (pickup_window_end < now ATAU created_at + 24 jam < now)
 *
 * Keamanan: dilindungi header Authorization: Bearer <CRON_SECRET>.
 * Gunakan Service Role Key (env SUPABASE_SERVICE_ROLE_KEY) agar dapat
 * mengubah baris tanpa sesi user (bypass RLS).
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = request.headers.get('authorization')
    if (auth !== `Bearer ${secret}`) {
      return jsonError('Unauthorized', 401)
    }
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return jsonError(
      'SUPABASE_SERVICE_ROLE_KEY belum dikonfigurasi — cron butuh service role untuk bypass RLS',
      500
    )
  }

  const sb = createServiceClient()

  const now = new Date()
  const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()

  const { data: expired, error: upErr } = await sb
    .from('pickup_requests')
    .update({ status: 'expired', expired_at: now.toISOString() })
    .eq('status', 'pending')
    .or(`pickup_window_end.lt.${now.toISOString()},created_at.lt.${cutoff}`)
    .select('id')

  if (upErr) return jsonError('Gagal menjalankan auto-expire: ' + upErr.message, 500)

  return jsonOk({
    message: 'Auto-expire selesai',
    expired_count: (expired ?? []).length,
    expired_ids: (expired ?? []).map((e) => e.id),
  })
}
