export interface Point {
  lat: number
  lng: number
}

export interface RouteStopInput extends Point {
  id: string
  label?: string
  weightKg: number
  pickupWindowStart?: string
  pickupWindowEnd?: string
}

export interface RecommendedStop extends RouteStopInput {
  sequence: number
  distanceFromPrevKm: number
}

export interface RecommendedRoute {
  stops: RecommendedStop[]
  totalDistanceKm: number
  totalWeightKg: number
  note: string
}

const R = 6371 // Bumi radius (km)

/** Jarak lurus (Haversine) antara dua koordinat dalam km. */
export function haversineKm(a: Point, b: Point): number {
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const lat1 = (a.lat * Math.PI) / 180
  const lat2 = (b.lat * Math.PI) / 180

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

/**
 * Algoritma Nearest-Neighbor (heuristik) untuk "Recommended Route".
 * Catatan PRD: hasil bersifat heuristik, BUKAN rute optimal mutlak.
 *
 * - dimulai dari start (titik awal collector, jika ada) lalu memilih
 *   titik terdekat yang belum dikunjungi secara berulang.
 * - mengembalikan urutan, jarak antar titik, total jarak, dan total berat.
 */
export function recommendRoute(inputs: RouteStopInput[], start?: Point): RecommendedRoute {
  const remaining = [...inputs]
  const stops: RecommendedStop[] = []
  let totalDistanceKm = 0
  let current: Point | null = start ?? null

  while (remaining.length > 0) {
    let bestIndex = 0
    let bestDist = Infinity

    for (let i = 0; i < remaining.length; i++) {
      const d = current ? haversineKm(current, remaining[i]) : 0
      if (d < bestDist) {
        bestDist = d
        bestIndex = i
      }
    }

    const chosen = remaining.splice(bestIndex, 1)[0]
    stops.push({
      ...chosen,
      sequence: stops.length + 1,
      distanceFromPrevKm: current ? Number(bestDist.toFixed(2)) : 0,
    })

    if (current) totalDistanceKm += bestDist
    current = chosen
  }

  const totalWeightKg = inputs.reduce((sum, i) => sum + i.weightKg, 0)

  return {
    stops,
    totalDistanceKm: Number(totalDistanceKm.toFixed(2)),
    totalWeightKg: Number(totalWeightKg.toFixed(2)),
    note: 'Recommended Route (heuristik Nearest-Neighbor) — bukan rute optimal mutlak.',
  }
}
