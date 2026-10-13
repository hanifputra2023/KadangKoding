import { createClient } from '@/lib/supabase/server'
import { requireUser, jsonError, jsonOk } from '@/lib/helpers'

// Faktor emisi estimasi pengurangan metana/karbon per kg sampah organik
// (bersifat hipotetis MVP, lihat PRD Bagian 12 — perlu validasi).
const EMISSION_FACTOR_KG_CO2E_PER_KG = 0.3 // kg CO2e per kg (ilustratif)

/**
 * GET /api/admin/stats
 * Impact Analytics Dashboard (role: admin).
 * Menampilkan agregasi berat organik, jumlah pickup, warung aktif, dll.
 */
export async function GET() {
  const sb = await createClient()
  const { error } = await requireUser(sb, 'admin')
  if (error) return error

  // Total pickup completed & total berat aktual
  const { data: completed, error: cErr } = await sb
    .from('pickup_requests')
    .select('actual_weight_kg, status')
    .eq('status', 'completed')
  if (cErr) return jsonError('Gagal menghitung statistik: ' + cErr.message, 500)

  const totalWasteKg = completed.reduce(
    (sum, p) => sum + Number(p.actual_weight_kg ?? 0),
    0
  )

  // Jumlah warung aktif (pernah membuat request)
  const { count: warungAktif, error: wErr } = await sb
    .from('pickup_requests')
    .select('warung_id', { count: 'exact', head: true })
  if (wErr) return jsonError('Gagal menghitung warung aktif: ' + wErr.message, 500)

  // Jumlah collector berprofil
  const { count: collectorCount, error: colErr } = await sb
    .from('collector_profiles')
    .select('id', { count: 'exact', head: true })
  if (colErr) return jsonError('Gagal menghitung collector: ' + colErr.message, 500)

  // Breakdown per status
  const { data: statusRows, error: stErr } = await sb
    .from('pickup_requests')
    .select('status')
  if (stErr) return jsonError('Gagal breakdown status: ' + stErr.message, 500)

  const statusBreakdown: Record<string, number> = {}
  for (const r of statusRows) {
    const s = r.status as string
    statusBreakdown[s] = (statusBreakdown[s] ?? 0) + 1
  }

  // Estimasi dampak karbon (ilustratif, hipotesis)
  const carbonOffsetKg = totalWasteKg * EMISSION_FACTOR_KG_CO2E_PER_KG

  return jsonOk({
    stats: {
      total_waste_collected_kg: Number(totalWasteKg.toFixed(2)),
      total_waste_collected_ton: Number((totalWasteKg / 1000).toFixed(3)),
      total_completed_pickups: completed.length,
      active_warung_count: warungAktif ?? 0,
      collector_count: collectorCount ?? 0,
      status_breakdown: statusBreakdown,
      estimated_carbon_offset_kg_co2e: Number(carbonOffsetKg.toFixed(2)),
      emission_factor_kg_co2e_per_kg: EMISSION_FACTOR_KG_CO2E_PER_KG,
    },
  })
}
