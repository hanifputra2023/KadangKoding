"use client"

/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { getCurrentPosition } from '@/lib/geo/geolocation'
import { useRealtimeTables } from '@/lib/hooks/useRealtimeTables'
import AppShell from '@/components/AppShell'
import ClientMap from '@/components/ClientMap'
import { LineChart } from '@/components/Charts'
import { compressImage } from '@/lib/utils'
import { AppNotification, SearchItem } from '@/lib/types/notifications'
import { apiGetMe, apiLogout, AuthUser } from '@/lib/api/auth'
import {
  apiGetCollectorPickups,
  apiGetCollectorRoutes,
  apiGetCollectorCapacity,
  apiUpdateCollectorCapacity,
  apiStartPickup,
  apiCompletePickup,
  apiFailPickup,
  apiRecommendRoute,
} from '@/lib/api/collector'
import { apiUpload } from '@/lib/api/upload'

// ─── Types ────────────────────────────────────────────────────────────────────

interface AvailablePickup {
  id: string
  latitude: number
  longitude: number
  estimated_weight_kg: number
  pickup_window_start: string
  pickup_window_end: string
  notes?: string | null
  warung_profiles?: { business_name: string; address: string } | null
  waste_categories?: { category_name: string; is_maggot_friendly: boolean } | null
}

interface RouteStop {
  id: string
  sequence_number: number
  status: string
  pickup_requests?: {
    id: string
    latitude: number
    longitude: number
    estimated_weight_kg: number
    actual_weight_kg: number | null
    status: string
    notes?: string | null
    warung_profiles?: { business_name: string; address: string } | null
    waste_categories?: { category_name: string } | null
  } | null
}

interface Route {
  id: string
  total_distance_km: number
  total_weight_kg: number
  status: string
  created_at?: string
  route_stops: RouteStop[]
}

type View =
  | 'dashboard'
  | 'available'
  | 'pickup-detail'
  | 'selected'
  | 'route-map'
  | 'current-stop'
  | 'completed'
  | 'settings'
  | 'profile'

// ─── Geo helper ───────────────────────────────────────────────────────────────

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

const IC = {
  check: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>,
  pin: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>,
  clock: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>,
  weight: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" /><line x1="3" y1="6" x2="21" y2="6" /></svg>,
  trending: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" /></svg>,
  chevronRight: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6" /></svg>,
  chevronLeft: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6" /></svg>,
  trash: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" /></svg>,
  plus: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>,
  search: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>,
  route: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="6" cy="19" r="3" /><path d="M9 19h8.5a4.5 4.5 0 0 0 0-9H5a4 4 0 0 1 0-8h11.5" /><circle cx="18" cy="5" r="3" /></svg>,
}

function Pagination({
  currentPage,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: {
  currentPage: number
  totalItems: number
  pageSize: number
  onPageChange: (page: number) => void
  onPageSizeChange?: (size: number) => void
}) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1
  const endItem = Math.min(totalItems, currentPage * pageSize)

  return (
    <div className="p-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600 bg-white rounded-b-xl">
      <div className="flex items-center gap-2">
        <span>
          Menampilkan <strong>{startItem}</strong> - <strong>{endItem}</strong> dari <strong>{totalItems}</strong> data
        </span>
        {onPageSizeChange && (
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="ml-2 bg-slate-50 border border-slate-200 rounded-md px-2 py-1 text-xs outline-none"
          >
            <option value={6}>6 / hal</option>
            <option value={12}>12 / hal</option>
            <option value={24}>24 / hal</option>
          </select>
        )}
      </div>
      <div className="flex items-center gap-1.5">
        <button
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
          className="px-2.5 py-1 rounded-md border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed font-semibold text-xs"
        >
          ← Prev
        </button>
        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
          let p = i + 1
          if (totalPages > 5) {
            if (currentPage > 3) {
              p = currentPage - 3 + i
              if (p > totalPages) p = totalPages - (4 - i)
            }
          }
          return (
            <button
              key={p}
              onClick={() => onPageChange(p)}
              className={`w-7 h-7 rounded-md text-xs font-bold transition-all ${currentPage === p
                  ? 'bg-emerald-800 text-white shadow-xs'
                  : 'border border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                }`}
            >
              {p}
            </button>
          )
        })}
        <button
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          className="px-2.5 py-1 rounded-md border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed font-semibold text-xs"
        >
          Next →
        </button>
      </div>
    </div>
  )
}

function CatBadge({ cat }: { cat: string }) {
  return (
    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800">
      {cat}
    </span>
  )
}

const LOCATION_PRESETS = [
  { name: 'Magelang Kota', lat: -7.4726, lng: 110.2198, area: 'Magelang' },
  { name: 'Mertoyudan', lat: -7.5142, lng: 110.2185, area: 'Mertoyudan' },
  { name: 'Muntilan', lat: -7.5833, lng: 110.2667, area: 'Muntilan' },
  { name: 'Borobudur', lat: -7.6079, lng: 110.2038, area: 'Borobudur' },
  { name: 'Sleman', lat: -7.7156, lng: 110.3556, area: 'Sleman' },
  { name: 'Yogyakarta Kota', lat: -7.7956, lng: 110.3695, area: 'Yogyakarta' },
  { name: 'Bantul', lat: -7.8897, lng: 110.3289, area: 'Bantul' },
  { name: 'Temanggung', lat: -7.3167, lng: 110.1667, area: 'Temanggung' },
]

export default function CollectorPage() {
  const router = useRouter()

  const [me, setMe] = useState<AuthUser | null>(null)
  const [available, setAvailable] = useState<AvailablePickup[]>([])
  const [routes, setRoutes] = useState<Route[]>([])
  const [capacity, setCapacity] = useState<number>(150)
  const [serviceStart, setServiceStart] = useState('07:00')
  const [serviceEnd, setServiceEnd] = useState('17:00')
  const [maxPerSlot, setMaxPerSlot] = useState(5)
  const [selected, setSelected] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [view, setView] = useState<View>('dashboard')
  const [detailPickup, setDetailPickup] = useState<AvailablePickup | null>(null)
  const [activeStopId, setActiveStopId] = useState<string | null>(null)

  const [colLat, setColLat] = useState<number | null>(null)
  const [colLng, setColLng] = useState<number | null>(null)
  const [serviceArea, setServiceArea] = useState<string>('Magelang')
  const [inputLat, setInputLat] = useState<string>('-7.4726')
  const [inputLng, setInputLng] = useState<string>('110.2198')
  const [savingLocation, setSavingLocation] = useState(false)
  const [radiusKm, setRadiusKm] = useState<string>('0')
  const [locating, setLocating] = useState(false)
  const [scheduleFilter, setScheduleFilter] = useState<'today' | 'tomorrow' | 'upcoming' | 'all'>('all')

  const [actualWeight, setActualWeight] = useState('')
  const [proofUrl, setProofUrl] = useState('')
  const [uploading, setUploading] = useState(false)

  const [catFilter, setCatFilter] = useState<'all' | 'Organik' | 'Maggot' | 'Restoran'>('all')
  const [searchFilter, setSearchFilter] = useState('')
  const [availPage, setAvailPage] = useState(1)
  const [availPageSize, setAvailPageSize] = useState(6)

  async function load() {
    try {
      const [meUser, av, rt, cap] = await Promise.all([
        apiGetMe(),
        apiGetCollectorPickups().catch(() => []),
        apiGetCollectorRoutes().catch(() => []),
        apiGetCollectorCapacity().catch(() => null),
      ])

      if (!meUser) { router.replace('/login'); return }
      if (meUser.role !== 'collector') { router.replace(`/${meUser.role}`); return }
      setMe(meUser)

      if (Array.isArray(av)) setAvailable(av as unknown as AvailablePickup[])
      if (Array.isArray(rt)) setRoutes(rt as unknown as Route[])
      if (cap) {
        const p = cap as { vehicle_capacity_kg?: number; latitude?: number; longitude?: number; service_start?: string; service_end?: string; max_pickups_per_slot?: number; service_area?: string }
        setCapacity(Number(p.vehicle_capacity_kg) || 150)
        if (p.latitude != null) {
          setColLat(Number(p.latitude))
          setInputLat(String(p.latitude))
        }
        if (p.longitude != null) {
          setColLng(Number(p.longitude))
          setInputLng(String(p.longitude))
        }
        if (p.service_area) setServiceArea(p.service_area)
        setServiceStart(p.service_start || '07:00')
        setServiceEnd(p.service_end || '17:00')
        setMaxPerSlot(Number(p.max_pickups_per_slot) || 5)
      }
    } catch {
      /* ignore */
    }
  }

  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useRealtimeTables(['pickup_requests', 'routes', 'route_stops', 'collector_profiles'], load)

  // Notifikasi dinamis berbasis data riil collector
  const notifications = useMemo<AppNotification[]>(() => {
    const list: AppNotification[] = []

    // 1. Notifikasi jemputan baru yang tersedia di area
    if (available.length > 0) {
      list.push({
        id: `col-avail-${available.length}-${available[0].id}`,
        title: `${available.length} Permohonan Siap Dijemput`,
        message: `Ada ${available.length} warung membutuhkan penjemputan sampah organik di radius Anda.`,
        time: available[0].pickup_window_start || new Date().toISOString(),
        type: 'warning',
        linkView: 'available',
      })
    }

    // 2. Notifikasi rute aktif & titik jemput
    routes.forEach((r) => {
      if (r.status === 'active') {
        const pendingStops = r.route_stops?.filter((s) => s.status === 'pending') || []
        const doneStops = r.route_stops?.filter((s) => s.status === 'completed') || []

        if (pendingStops.length > 0) {
          const nextStop = pendingStops[0]
          const wName = nextStop.pickup_requests?.warung_profiles?.business_name || 'Warung'
          list.push({
            id: `col-stop-${nextStop.id}`,
            title: `Tugas Aktif: Stop #${nextStop.sequence_number} (${wName})`,
            message: `Menuju lokasi ${nextStop.pickup_requests?.warung_profiles?.address || 'warung'} (~${nextStop.pickup_requests?.estimated_weight_kg || 0} kg).`,
            time: r.created_at || new Date().toISOString(),
            type: 'info',
            linkView: 'current-stop',
          })
        }

        doneStops.forEach((s) => {
          const wName = s.pickup_requests?.warung_profiles?.business_name || 'Warung'
          const actualKg = s.pickup_requests?.actual_weight_kg ?? s.pickup_requests?.estimated_weight_kg ?? 0
          list.push({
            id: `col-done-${s.id}`,
            title: `Penimbangan Selesai: ${wName}`,
            message: `Data penimbangan berhasil dicatat: ${actualKg} kg sampah terverifikasi.`,
            time: new Date().toISOString(),
            type: 'success',
            linkView: 'completed',
          })
        })
      } else if (r.status === 'completed') {
        list.push({
          id: `col-route-completed-${r.id}`,
          title: `Rute Selesai (${r.total_weight_kg} kg)`,
          message: `Rute #${r.id.slice(0, 6).toUpperCase()} telah dituntaskan dengan total jarak ${r.total_distance_km} km.`,
          time: r.created_at || new Date().toISOString(),
          type: 'success',
          linkView: 'completed',
        })
      }
    })

    return list
  }, [available, routes])

  // Search items dinamis untuk collector
  const searchItems = useMemo<SearchItem[]>(() => {
    const items: SearchItem[] = [
      {
        id: 'menu-avail',
        title: 'Daftar Jemputan Tersedia',
        subtitle: 'Cari dan pilih warung yang siap dijemput',
        category: 'Menu',
        badge: `${available.length} Baru`,
        badgeColor: 'amber',
        onSelect: () => setView('available'),
      },
      {
        id: 'menu-routes',
        title: 'Optimasi & Antrean Rute',
        subtitle: 'Atur rute terbaik untuk hari ini',
        category: 'Menu',
        badge: 'Rute',
        badgeColor: 'blue',
        onSelect: () => setView('selected'),
      },
      {
        id: 'menu-map',
        title: 'Peta Navigasi Interaktif',
        subtitle: 'Lihat peta persebaran warung dan rute perjalanan',
        category: 'Menu',
        badge: 'Peta',
        badgeColor: 'emerald',
        onSelect: () => setView('route-map'),
      },
      {
        id: 'menu-stop',
        title: 'Penimbangan & Verifikasi Stop',
        subtitle: 'Input timbangan fisik dan foto bukti jemputan',
        category: 'Menu',
        badge: 'Timbang',
        badgeColor: 'rose',
        onSelect: () => setView('current-stop'),
      },
      {
        id: 'menu-comp',
        title: 'Riwayat Rute Selesai',
        subtitle: 'Arsip rute dan total tonase yang berhasil dijemput',
        category: 'Menu',
        badge: 'Arsip',
        badgeColor: 'slate',
        onSelect: () => setView('completed'),
      },
      {
        id: 'menu-set',
        title: 'Kapasitas & Jadwal Kerja',
        subtitle: 'Atur kapasitas armada dan jam operasional harian',
        category: 'Menu',
        badge: 'Setelan',
        badgeColor: 'slate',
        onSelect: () => setView('settings'),
      },
    ]

    // Tambahkan item dari jemputan tersedia
    available.forEach((p) => {
      const wName = p.warung_profiles?.business_name || `Warung #${p.id.slice(0, 6)}`
      const cat = p.waste_categories?.category_name || 'Organik'
      items.push({
        id: `search-avail-${p.id}`,
        title: `${wName} (${cat})`,
        subtitle: `Estimasi: ${p.estimated_weight_kg} kg • ${p.warung_profiles?.address || 'Alamat warung'}`,
        category: 'Jemputan Tersedia',
        badge: `${p.estimated_weight_kg} kg`,
        badgeColor: 'amber',
        onSelect: () => {
          setDetailPickup(p)
          setView('pickup-detail')
        },
      })
    })

    // Tambahkan item dari stops rute aktif
    routes.forEach((r) => {
      r.route_stops?.forEach((s) => {
        const wName = s.pickup_requests?.warung_profiles?.business_name || `Stop #${s.sequence_number}`
        items.push({
          id: `search-stop-${s.id}`,
          title: `Stop #${s.sequence_number}: ${wName}`,
          subtitle: `Status: ${s.status.toUpperCase()} • ${s.pickup_requests?.warung_profiles?.address || ''}`,
          category: 'Rute Saya',
          badge: s.status,
          badgeColor: s.status === 'completed' ? 'emerald' : 'blue',
          onSelect: () => {
            setActiveStopId(s.id)
            setView('current-stop')
          },
        })
      })
    })

    return items
  }, [available, routes])

  async function saveLocation(targetLat?: number, targetLng?: number, targetArea?: string) {
    const lat = targetLat !== undefined ? targetLat : parseFloat(inputLat)
    const lng = targetLng !== undefined ? targetLng : parseFloat(inputLng)
    const area = targetArea !== undefined ? targetArea : serviceArea

    if (isNaN(lat) || lat < -90 || lat > 90) {
      return toast.error('Latitude harus angka yang valid antara -90 dan 90!')
    }
    if (isNaN(lng) || lng < -180 || lng > 180) {
      return toast.error('Longitude harus angka yang valid antara -180 dan 180!')
    }

    setSavingLocation(true)
    try {
      await apiUpdateCollectorCapacity({
        latitude: lat,
        longitude: lng,
        service_area: area.trim() || 'Area Layanan',
      })
      setColLat(lat)
      setColLng(lng)
      setInputLat(String(lat))
      setInputLng(String(lng))
      if (area) setServiceArea(area)
      toast.success(`Lokasi pangkalan kurir berhasil disimpan ke ${area || `${lat}, ${lng}`} ✓`)
      await load()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Gagal menyimpan lokasi')
    } finally {
      setSavingLocation(false)
    }
  }

  async function useMyLocation() {
    setLocating(true)
    try {
      const coords = await getCurrentPosition()
      setColLat(coords.latitude)
      setColLng(coords.longitude)
      setInputLat(coords.latitude.toFixed(6))
      setInputLng(coords.longitude.toFixed(6))
      await apiUpdateCollectorCapacity({ latitude: coords.latitude, longitude: coords.longitude })
      toast.success('Lokasi pangkalan berhasil diperbarui dari GPS perangkat! ✓')
      await load()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Gagal mendapatkan lokasi GPS')
    } finally { setLocating(false) }
  }

  async function uploadProof(file: File | null) {
    if (!file) return
    setUploading(true)
    try {
      const compressed = await compressImage(file)
      const url = await apiUpload(compressed)
      setProofUrl(url)
      toast.success('Foto bukti timbangan berhasil diunggah ✓')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Gagal upload foto')
    } finally { setUploading(false) }
  }

  async function saveSchedule() {
    if (serviceStart >= serviceEnd) {
      return toast.error('Jam mulai harus lebih awal dari jam selesai!')
    }
    setLoading(true)
    try {
      await apiUpdateCollectorCapacity({
        service_start: serviceStart,
        service_end: serviceEnd,
        max_pickups_per_slot: Number(maxPerSlot),
      })
      toast.success('Jadwal layanan berhasil disimpan!')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Gagal menyimpan jadwal')
    } finally { setLoading(false) }
  }

  async function createRoute() {
    if (selected.length === 0) return toast.error('Pilih minimal 1 pickup terlebih dahulu!')
    setLoading(true)
    try {
      await apiRecommendRoute({ pickup_ids: selected })
      toast.success('Pickup berhasil diklaim & rute rekomendasi dibuat!')
      setSelected([])
      await load()
      setView('route-map')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Terjadi kesalahan saat membuat rute')
    } finally { setLoading(false) }
  }

  async function submitComplete(pickupId: string) {
    const w = Number(actualWeight)
    if (!w || w <= 0) return toast.error('Masukkan berat aktual sampah yang valid!')
    if (!proofUrl) return toast.error('Unggah foto bukti timbangan terlebih dahulu!')
    setLoading(true)
    try {
      await apiCompletePickup(pickupId, w, proofUrl)
      toast.success('Penjemputan selesai diverifikasi!')
      setView('completed')
      setActualWeight('')
      setProofUrl('')
      setActiveStopId(null)
      await load()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Gagal menyelesaikan penjemputan')
    } finally { setLoading(false) }
  }

  async function startTrip(pickupId: string) {
    setLoading(true)
    try {
      await apiStartPickup(pickupId)
      toast.success('Status diperbarui: Anda sedang dalam perjalanan ke warung!')
      await load()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Gagal memperbarui status perjalanan')
    } finally {
      setLoading(false)
    }
  }

  async function failPickup(pickupId: string) {
    const reason = prompt('Masukkan alasan penjemputan gagal:')
    if (!reason) return
    try {
      await apiFailPickup(pickupId, reason)
      toast.success('Penjemputan ditandai gagal')
      await load()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Gagal memperbarui status')
    }
  }

  async function logout() {
    await apiLogout()
    router.replace('/login')
  }

  // Filtered available & sorted by distance
  const baseLat = colLat ?? -7.4726
  const baseLng = colLng ?? 110.2198
  const radius = Number(radiusKm) > 0 ? Number(radiusKm) : Infinity

  const withDistance = available.map((a) => {
    const wLat = Number(a.latitude)
    const wLng = Number(a.longitude)
    const isValid = !isNaN(wLat) && !isNaN(wLng) && wLat !== 0 && wLng !== 0
    const dist = isValid ? haversineKm(baseLat, baseLng, wLat, wLng) : 999
    return { ...a, distance_km: dist }
  })
  const sorted = withDistance.sort((a, b) => a.distance_km - b.distance_km)
  const filtered = sorted.filter((a) => a.distance_km <= radius)

  const catFiltered = catFilter === 'all' ? filtered : filtered.filter(
    (p) => (p.waste_categories?.category_name || '').toLowerCase().includes(catFilter.toLowerCase())
  )

  const now = new Date()
  const todayStr = now.toDateString()
  const tomorrowObj = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
  const tomorrowStr = tomorrowObj.toDateString()

  const scheduleFiltered = catFiltered.filter((p) => {
    if (scheduleFilter === 'all') return true
    const pDate = new Date(p.pickup_window_start).toDateString()
    if (scheduleFilter === 'today') return pDate === todayStr
    if (scheduleFilter === 'tomorrow') return pDate === tomorrowStr
    if (scheduleFilter === 'upcoming') return pDate !== todayStr && pDate !== tomorrowStr
    return true
  })

  const searchFiltered = scheduleFiltered.filter((p) => {
    if (!searchFilter.trim()) return true
    const q = searchFilter.toLowerCase()
    return (
      (p.warung_profiles?.business_name || '').toLowerCase().includes(q) ||
      (p.warung_profiles?.address || '').toLowerCase().includes(q) ||
      p.id.toLowerCase().includes(q)
    )
  })

  const todayCount = catFiltered.filter((p) => new Date(p.pickup_window_start).toDateString() === todayStr).length
  const tomorrowCount = catFiltered.filter((p) => new Date(p.pickup_window_start).toDateString() === tomorrowStr).length
  const upcomingCount = catFiltered.filter((p) => {
    const d = new Date(p.pickup_window_start).toDateString()
    return d !== todayStr && d !== tomorrowStr
  }).length

  // Kapasitas & Perlindungan Overload
  const activeRoutes = routes.filter((r) => r.status === 'active')
  const activeWeight = activeRoutes.reduce((sum, r) => sum + Number(r.total_weight_kg || 0), 0)
  const remainingCapacity = Math.max(0, capacity - activeWeight)
  const selectedWeight = available.filter((a) => selected.includes(a.id)).reduce((s, a) => s + Number(a.estimated_weight_kg), 0)
  const selectableRemaining = Math.max(0, remainingCapacity - selectedWeight)

  // Pagination available
  const totalAvailPages = Math.max(1, Math.ceil(searchFiltered.length / availPageSize))
  const paginatedAvail = searchFiltered.slice((availPage - 1) * availPageSize, availPage * availPageSize)

  const activeRoute = routes
    .filter(r => r.status === 'active' && r.route_stops?.some(s => !['completed', 'failed', 'cancelled'].includes(s.status)))
    .sort((a, b) => (a.created_at && b.created_at ? String(b.created_at).localeCompare(String(a.created_at)) : 0))[0]
  const totalPickups = routes.reduce((s, r) => s + r.route_stops.length, 0)
  const totalWeight = routes.reduce((s, r) => s + Number(r.total_weight_kg), 0)

  const breadcrumbMap: Record<View, string> = {
    'dashboard': 'Overview',
    'available': 'Available Pickups',
    'pickup-detail': 'Pickup Details',
    'selected': 'Selected Pickups',
    'route-map': 'Route Map',
    'current-stop': 'Current Stop',
    'completed': 'Pickup Completed',
    'settings': 'Pengaturan Layanan',
    'profile': 'Profil Pengguna',
  }

  // ─── 1. Dashboard ─────────────────────────────────────────────────────────

  const renderDashboard = () => {
    const weekData = [{ label: 'Weight', values: [70, 150, 210, 140, 280, 250, 140] }]
    const weekLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

    const mapCenter: [number, number] = colLat && colLng ? [colLat, colLng] : [-7.4726, 110.2198]
    const markers = filtered.map(p => ({
      id: p.id,
      lat: Number(p.latitude) || -7.4726,
      lng: Number(p.longitude) || 110.2198,
      selected: selected.includes(p.id),
      label: `${p.warung_profiles?.business_name ?? 'Warung'} (${p.estimated_weight_kg}kg)`
    }))

    const routeInProgress = activeRoute && activeRoute.route_stops.some(
      s => s.status !== 'completed' && s.pickup_requests?.status !== 'completed'
    )

    return (
      <div className="space-y-5">
        {/* Hero banner */}
        <div className="ws-card bg-gradient-to-r from-emerald-50 via-emerald-100 to-teal-100 text-emerald-950 p-6 sm:p-8 rounded-2xl">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="space-y-2 max-w-xl">
              <span className="text-[10px] font-bold tracking-wider uppercase bg-emerald-800 px-2.5 py-1 rounded-full text-emerald-100">
                Collector Portal
              </span>
              <h2 className="text-xl sm:text-2xl font-extrabold text-emerald-950">
                Siap Optimalkan Rute Penjemputan Sampah?
              </h2>
              <p className="text-xs sm:text-sm text-emerald-900 leading-relaxed">
                Temukan permohonan jemput terdekat, klaim muatan sesuai kapasitas ({capacity} kg), dan ikuti rekomendasi rute terpendek.
              </p>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-100/90 text-emerald-950 text-xs font-semibold border border-emerald-300/80">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></svg>
                  Pangkalan: {serviceArea || 'Magelang'} ({colLat != null ? colLat.toFixed(4) : '-'}, {colLng != null ? colLng.toFixed(4) : '-'})
                </span>
                <button
                  onClick={() => setView('settings')}
                  className="text-xs font-bold text-emerald-900 hover:text-emerald-950 underline underline-offset-2 cursor-pointer transition-all"
                >
                  Ubah Lokasi Pangkalan →
                </button>
              </div>
              <div className="flex flex-wrap gap-2.5 pt-2">
                <button className="ws-btn-primary text-xs" onClick={() => setView('available')}>
                  {IC.route} Lihat {filtered.length} Pickup Tersedia
                </button>
                <button className="ws-btn-outline text-emerald-900 border-emerald-300 hover:bg-emerald-100/60 text-xs flex items-center gap-1.5" onClick={() => setView('settings')}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></svg>
                  Atur Lokasi Pangkalan
                </button>
                <button className="ws-btn-outline text-emerald-900 border-emerald-300 hover:bg-emerald-100/60 text-xs" onClick={() => setView('settings')}>
                  {IC.clock} Atur Jadwal Layanan
                </button>
              </div>
            </div>
            <div className="shrink-0 opacity-60 text-slate-600"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="18.5" cy="17.5" r="3.5" /><circle cx="5.5" cy="17.5" r="3.5" /><circle cx="15" cy="5" r="1" /><path d="M12 17.5V14l-3-3 4-3 2 3h2" /></svg></div>
          </div>
        </div>

        {/* 4 Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'TOTAL PICKUPS', value: `${totalPickups}`, trend: '+12%', color: '#059669' },
            { label: 'TOTAL MUATAN', value: `${totalWeight.toFixed(1)} kg`, trend: '+8.5%', color: '#059669' },
            { label: 'KAPASITAS KENDARAAN', value: `${capacity} kg`, trend: 'Maks', color: '#0891b2' },
            { label: 'RUTE AKTIF', value: routeInProgress ? `${activeRoute.route_stops.length} Titik` : '0 Aktif', trend: routeInProgress ? 'In Progress' : 'Idle', color: '#7c3aed' },
          ].map((s) => (
            <div key={s.label} className="ws-card p-5">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{s.label}</span>
              <p className="text-2xl font-extrabold text-slate-900 mt-1">{s.value}</p>
              <span className="text-xs font-semibold text-emerald-700">{s.trend}</span>
            </div>
          ))}
        </div>

        {/* Real Leaflet Map & Weekly Performance */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Interactive Map */}
          <div className="lg:col-span-2 ws-card p-5 flex flex-col justify-between">
            <div className="flex justify-between items-center mb-3">
              <div>
                <h4 className="text-xs font-bold text-slate-800">Peta Sebaran Pickup Terdekat</h4>
                <p className="text-[11px] text-slate-400">Klik marker untuk melihat detail toko</p>
              </div>
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-md">
                {filtered.length} Tersedia
              </span>
            </div>
            <div className="h-72 rounded-xl overflow-hidden border border-slate-200">
              <ClientMap
                center={mapCenter}
                zoom={13}
                height="h-72"
                markers={markers}
                onSelect={(id) => {
                  const p = available.find(x => x.id === id)
                  if (p) { setDetailPickup(p); setView('pickup-detail') }
                }}
              />
            </div>
          </div>

          {/* Weekly Performance Chart */}
          <div className="ws-card p-5 flex flex-col justify-between">
            <h4 className="text-xs font-bold text-slate-800 mb-2">Performa Mingguan (kg)</h4>
            <div className="h-56">
              <LineChart data={weekData} labels={weekLabels} height={220} />
            </div>
            <p className="text-[11px] text-slate-400 text-center mt-2">Tren akumulasi volume sampah daur ulang 7 hari terakhir</p>
          </div>
        </div>
      </div>
    )
  }

  // ─── 2. Available Pickups ─────────────────────────────────────────────────

  const renderAvailable = () => (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Available Pickups</h1>
          <p className="text-xs sm:text-sm text-slate-500">Pilih permohonan penjemputan sampah untuk dimasukkan ke rute Anda.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`text-xs font-bold px-3 py-1.5 rounded-full ${selectedWeight > remainingCapacity
              ? 'bg-rose-100 text-rose-800'
              : 'bg-emerald-100 text-emerald-800'
            }`}>
            {selected.length} Terpilih ({selectedWeight.toFixed(1)} / {remainingCapacity.toFixed(1)} kg)
          </span>
          {selected.length > 0 && (
            <button className="ws-btn-primary text-xs" onClick={() => setView('selected')}>
              Lihat Antrian ({selected.length})
            </button>
          )}
        </div>
      </div>

      {/* Kapasitas & Status Muatan Kendaraan */}
      <div className="ws-card p-4 bg-gradient-to-r from-slate-50 via-emerald-50/30 to-slate-50 border border-slate-200/80">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs mb-2">
          <div className="flex flex-wrap items-center gap-4">
            <div>
              <span className="text-slate-400 font-medium">Kapasitas Maks:</span>{' '}
              <strong className="text-slate-800">{capacity} kg</strong>
            </div>
            <div>
              <span className="text-slate-400 font-medium">Muatan Rute Berjalan:</span>{' '}
              <strong className={activeWeight > 0 ? 'text-amber-700' : 'text-slate-700'}>
                {activeWeight.toFixed(1)} kg
              </strong>
            </div>
            <div>
              <span className="text-slate-400 font-medium">Sisa Muatan Tersedia:</span>{' '}
              <strong className={remainingCapacity <= 0 ? 'text-rose-600' : 'text-emerald-700'}>
                {remainingCapacity.toFixed(1)} kg
              </strong>
            </div>
          </div>
          <span className="text-[11px] font-semibold text-slate-500">
            Terpilih: {selectedWeight.toFixed(1)} kg (Sisa slot pilih: {selectableRemaining.toFixed(1)} kg)
          </span>
        </div>
        <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${selectedWeight + activeWeight > capacity
                ? 'bg-rose-500'
                : selectedWeight + activeWeight > capacity * 0.85
                  ? 'bg-amber-500'
                  : 'bg-emerald-600'
              }`}
            style={{ width: `${Math.min(100, ((selectedWeight + activeWeight) / capacity) * 100)}%` }}
          />
        </div>
      </div>

      {remainingCapacity <= 0 && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-xs text-rose-800 flex items-start gap-2">
          <span className="text-amber-500"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg></span>
          <div>
            <strong className="block font-bold">Kapasitas Kendaraan Anda Penuh ({capacity} kg)!</strong>
            <p className="mt-0.5 text-rose-700">
              Anda sedang memiliki rute aktif yang sedang berjalan. Selesaikan dan buang muatan di titik pengolahan terlebih dahulu sebelum mengambil permohonan baru.
            </p>
          </div>
        </div>
      )}

      {/* Schedule Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar flex-nowrap bg-slate-50 border border-slate-200/90 p-2 rounded-xl">
        <span className="text-xs font-bold text-slate-500 ml-1 mr-1 uppercase tracking-wider shrink-0">Jadwal:</span>
        <button
          onClick={() => { setScheduleFilter('today'); setAvailPage(1) }}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${scheduleFilter === 'today'
              ? 'bg-emerald-800 text-white shadow-xs'
              : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
            }`}
        >
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span> Hari Ini</span>
          <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${scheduleFilter === 'today' ? 'bg-emerald-700 text-white' : 'bg-slate-100 text-slate-600'}`}>
            {todayCount}
          </span>
        </button>
        <button
          onClick={() => { setScheduleFilter('tomorrow'); setAvailPage(1) }}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${scheduleFilter === 'tomorrow'
              ? 'bg-blue-800 text-white shadow-xs'
              : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
            }`}
        >
          <span className="flex items-center gap-1"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg> Besok</span>
          <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${scheduleFilter === 'tomorrow' ? 'bg-blue-700 text-white' : 'bg-slate-100 text-slate-600'}`}>
            {tomorrowCount}
          </span>
        </button>
        <button
          onClick={() => { setScheduleFilter('upcoming'); setAvailPage(1) }}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${scheduleFilter === 'upcoming'
              ? 'bg-slate-800 text-white shadow-xs'
              : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
            }`}
        >
          <span className="flex items-center gap-1"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg> Mendatang</span>
          <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${scheduleFilter === 'upcoming' ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-600'}`}>
            {upcomingCount}
          </span>
        </button>
        <button
          onClick={() => { setScheduleFilter('all'); setAvailPage(1) }}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${scheduleFilter === 'all'
              ? 'bg-slate-800 text-white shadow-xs'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
        >
          Semua Jadwal ({catFiltered.length})
        </button>
      </div>

      {/* Filter & Search bar */}
      <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar flex-nowrap">
          {(['all', 'Organik', 'Maggot', 'Restoran'] as const).map((cat) => (
            <button
              key={cat}
              onClick={() => { setCatFilter(cat); setAvailPage(1) }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${catFilter === cat
                  ? 'bg-emerald-800 text-white shadow-xs'
                  : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
                }`}
            >
              {cat === 'all' ? 'Semua Kategori' : cat}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs w-full sm:w-60 shadow-2xs">
            <span className="text-slate-400">{IC.search}</span>
            <input
              type="text"
              placeholder="Cari warung / alamat..."
              value={searchFilter}
              onChange={(e) => { setSearchFilter(e.target.value); setAvailPage(1) }}
              className="bg-transparent border-none text-xs outline-hidden w-full text-slate-800"
            />
          </div>

          <select
            value={radiusKm}
            onChange={(e) => { setRadiusKm(e.target.value); setAvailPage(1) }}
            className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-700 outline-hidden shadow-2xs"
          >
            <option value="5">Radius ≤ 5 km (Sangat Dekat)</option>
            <option value="10">Radius ≤ 10 km (Area Sekitar)</option>
            <option value="15">Radius ≤ 15 km (Standar Layanan)</option>
            <option value="25">Radius ≤ 25 km (Jangkauan Maks)</option>
            <option value="0">Semua Jarak (Tanpa Batas)</option>
          </select>
        </div>
      </div>

      {/* List Pickups with Interactive Checkbox & Zero-Overload Protection */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {paginatedAvail.map((p) => {
          const isSelected = selected.includes(p.id)
          const pWeight = Number(p.estimated_weight_kg) || 0
          const isOverload = !isSelected && (pWeight > selectableRemaining || remainingCapacity <= 0)
          const pLat = Number(p.latitude)
          const pLng = Number(p.longitude)
          const isValidCoord = !isNaN(pLat) && !isNaN(pLng) && pLat !== 0 && pLng !== 0
          const dist = (p as unknown as { distance_km?: number }).distance_km ?? (isValidCoord ? haversineKm(baseLat, baseLng, pLat, pLng) : 999)

          return (
            <div
              key={p.id}
              className={`ws-card p-4 flex flex-col justify-between transition-all ${isSelected
                  ? 'ring-2 ring-emerald-600 bg-emerald-50/30'
                  : isOverload
                    ? 'opacity-70 bg-slate-50/80 border-dashed border-slate-300'
                    : 'hover:shadow-sm'
                }`}
            >
              <div className="space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-bold text-sm text-slate-900">{p.warung_profiles?.business_name ?? 'Warung Partner'}</h3>
                    <p className="text-xs text-slate-500 line-clamp-1">{p.warung_profiles?.address ?? 'Yogyakarta'}</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={isSelected}
                    disabled={isOverload}
                    title={isOverload ? `Muatan ${pWeight} kg melebihi sisa kapasitas (${selectableRemaining.toFixed(1)} kg)` : undefined}
                    onChange={() => {
                      if (isSelected) {
                        setSelected(prev => prev.filter(x => x !== p.id))
                      } else if (!isOverload) {
                        setSelected(prev => [...prev, p.id])
                      } else {
                        toast.error(`Kapasitas tidak cukup! Sisa kapasitas: ${selectableRemaining.toFixed(1)} kg`)
                      }
                    }}
                    className={`w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 mt-1 ${isOverload ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'
                      }`}
                  />
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <CatBadge cat={p.waste_categories?.category_name ?? 'Organik'} />
                  <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md flex items-center gap-1">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" /><path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" /><path d="M7 21h10" /><path d="M12 3v18" /><path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2" /></svg>
                    {p.estimated_weight_kg} kg
                  </span>
                  {isOverload && (
                    <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
                      Melebihi Sisa
                    </span>
                  )}
                </div>

                <div className="text-[11px] text-slate-500 space-y-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {new Date(p.pickup_window_start).toDateString() === todayStr ? (
                      <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md">
                        <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span> Hari Ini</span>
                      </span>
                    ) : new Date(p.pickup_window_start).toDateString() === tomorrowStr ? (
                      <span className="text-[10px] font-bold text-blue-800 bg-blue-100 px-2 py-0.5 rounded-md">
                        <span className="inline-flex items-center gap-1"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg> Besok</span>
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md">
                        <span className="inline-flex items-center gap-1"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg> {new Date(p.pickup_window_start).toLocaleDateString()}</span>
                      </span>
                    )}
                    <span className="text-slate-600 font-medium">
                      <span className="inline-flex items-center gap-1"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg> {new Date(p.pickup_window_start).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false })} – {new Date(p.pickup_window_end).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false })} WIB</span>
                    </span>
                  </div>
                  <div className="pt-0.5 flex items-center gap-1.5 flex-wrap">
                    {dist <= 3 ? (
                      <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <span className="text-emerald-600"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg></span> Sangat Dekat (±{dist.toFixed(1)} km)
                      </span>
                    ) : dist <= 10 ? (
                      <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <span className="text-blue-500"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></svg></span> ±{dist.toFixed(1)} km
                      </span>
                    ) : dist <= 25 ? (
                      <span className="text-[10px] font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <span className="text-blue-500"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></svg></span> ±{dist.toFixed(1)} km
                      </span>
                    ) : dist <= 100 ? (
                      <span className="text-[10px] font-bold text-amber-800 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <span className="text-amber-500"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg></span> Jarak Jauh (±{dist.toFixed(1)} km)
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-rose-800 bg-rose-100 border border-rose-300 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <span className="text-rose-500"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="4.93" y1="4.93" x2="19.07" y2="19.07" /></svg></span> Luar Wilayah / Beda Pulau (±{dist.toFixed(0)} km)
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex gap-2 pt-3 border-t border-slate-100 mt-3">
                <button
                  className="ws-btn-outline text-xs flex-1 justify-center"
                  onClick={() => { setDetailPickup(p); setView('pickup-detail') }}
                >
                  Detail
                </button>
                <button
                  disabled={isOverload && !isSelected}
                  className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition-all ${isSelected
                      ? 'bg-rose-100 text-rose-700 hover:bg-rose-200'
                      : isOverload
                        ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                        : 'bg-emerald-800 text-white hover:bg-emerald-900'
                    }`}
                  onClick={() => {
                    if (isSelected) {
                      setSelected(prev => prev.filter(x => x !== p.id))
                    } else if (!isOverload) {
                      setSelected(prev => [...prev, p.id])
                    } else {
                      toast.error(`Kapasitas tidak mencukupi! Sisa kapasitas: ${selectableRemaining.toFixed(1)} kg`)
                    }
                  }}
                >
                  {isSelected ? 'Batal Pilih' : isOverload ? 'Kapasitas Penuh' : '+ Pilih'}
                </button>
              </div>
            </div>
          )
        })}
        {searchFiltered.length === 0 && (
          <div className="col-span-full ws-card p-8 text-center text-xs text-slate-400">
            Tidak ada permohonan penjemputan sampah yang sesuai dengan filter atau kata kunci pencarian.
          </div>
        )}
      </div>

      {/* Pagination Controls */}
      {searchFiltered.length > 0 && (
        <Pagination
          currentPage={availPage}
          totalItems={searchFiltered.length}
          pageSize={availPageSize}
          onPageChange={setAvailPage}
          onPageSizeChange={(sz) => { setAvailPageSize(sz); setAvailPage(1) }}
        />
      )}
    </div>
  )

  // ─── 3. Pickup Detail ─────────────────────────────────────────────────────

  const renderPickupDetail = () => {
    if (!detailPickup) return null
    const isSelected = selected.includes(detailPickup.id)
    const pWeight = Number(detailPickup.estimated_weight_kg) || 0
    const isOverload = !isSelected && (pWeight > selectableRemaining || remainingCapacity <= 0)

    return (
      <div className="max-w-4xl mx-auto space-y-5">
        <div className="flex items-center gap-3">
          <button className="ws-btn-outline p-2" onClick={() => setView('available')}>
            {IC.chevronLeft}
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-slate-900">Detail Permohonan Penjemputan</h1>
            <p className="text-xs text-slate-400 font-mono">Ref: #{detailPickup.id.slice(-6).toUpperCase()}</p>
          </div>
          <button
            disabled={isOverload && !isSelected}
            className={`ws-btn-primary text-xs ${isOverload && !isSelected ? 'opacity-50 cursor-not-allowed' : ''}`}
            onClick={() => {
              if (isSelected) {
                setView('selected')
              } else if (!isOverload) {
                setSelected(prev => [...prev, detailPickup.id])
                setView('selected')
              } else {
                toast.error(`Kapasitas tidak cukup! Sisa kapasitas: ${selectableRemaining.toFixed(1)} kg`)
              }
            }}
          >
            {isSelected ? 'Lihat di Antrian' : isOverload ? 'Kapasitas Penuh' : '+ Tambahkan ke Rute'}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Map */}
          <div className="ws-card p-4 space-y-3">
            <h4 className="text-xs font-bold text-slate-800">Peta Lokasi Warung</h4>
            <div className="h-64 rounded-xl overflow-hidden border border-slate-200">
              <ClientMap
                center={[detailPickup.latitude, detailPickup.longitude]}
                zoom={14}
                height="h-64"
                markers={[{ id: detailPickup.id, lat: detailPickup.latitude, lng: detailPickup.longitude, label: detailPickup.warung_profiles?.business_name ?? 'Warung' }]}
              />
            </div>
            <p className="text-xs text-slate-600 font-medium"><span className="inline-flex items-center gap-1"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></svg> {detailPickup.warung_profiles?.address}</span></p>
          </div>

          {/* Info */}
          <div className="ws-card p-5 space-y-4">
            <div>
              <span className="text-[11px] font-bold text-slate-400 uppercase">Nama Warung</span>
              <p className="text-lg font-bold text-slate-900">{detailPickup.warung_profiles?.business_name}</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-3.5 rounded-xl text-xs">
              <div>
                <span className="text-slate-400">Estimasi Berat:</span>
                <p className="font-bold text-slate-800 text-sm mt-0.5">{detailPickup.estimated_weight_kg} kg</p>
              </div>
              <div>
                <span className="text-slate-400">Kategori:</span>
                <p className="font-bold text-emerald-800 text-sm mt-0.5">{detailPickup.waste_categories?.category_name ?? 'Organik'}</p>
              </div>
            </div>
            <div>
              <span className="text-[11px] font-bold text-slate-400 uppercase">Jadwal Penjemputan</span>
              <p className="text-xs font-bold text-slate-800 mt-1">
                {new Date(detailPickup.pickup_window_start).toLocaleDateString('id-ID')} ({new Date(detailPickup.pickup_window_start).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false })} – {new Date(detailPickup.pickup_window_end).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false })} WIB)
              </p>
            </div>

            {detailPickup.notes && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-900">
                <strong className="block font-bold mb-0.5"><span className="inline-flex items-center gap-1"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg> Catatan Khusus dari Warung:</span></strong>
                {detailPickup.notes}
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ─── 4. Selected Pickups ──────────────────────────────────────────────────

  const renderSelected = () => {
    const selPickups = available.filter(a => selected.includes(a.id))
    const isOverloaded = selectedWeight > remainingCapacity || remainingCapacity <= 0

    return (
      <div className="max-w-4xl mx-auto space-y-5">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Antrian Rute ({selected.length})</h1>
            <p className="text-xs text-slate-500">Daftar warung yang dipilih untuk dibuatkan rute rekomendasi.</p>
          </div>
          <button className="text-xs font-bold text-rose-600 hover:underline" onClick={() => setSelected([])}>
            Hapus Semua
          </button>
        </div>

        {isOverloaded && (
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-xs text-rose-800">
            <strong className="block font-bold"><span className="inline-flex items-center gap-1"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg> Total muatan melebihi sisa kapasitas kendaraan!</span></strong>
            <p className="mt-0.5">
              Total terpilih ({selectedWeight.toFixed(1)} kg) + muatan berjalan ({activeWeight.toFixed(1)} kg) melebihi kapasitas kendaraan Anda ({capacity} kg). Kurangi beberapa warung sebelum generate rute.
            </p>
          </div>
        )}

        {selPickups.some(p => {
          const wLat = Number(p.latitude)
          const wLng = Number(p.longitude)
          const dist = !isNaN(wLat) && !isNaN(wLng) && wLat !== 0 && wLng !== 0
            ? haversineKm(baseLat, baseLng, wLat, wLng)
            : 0
          return dist > 25
        }) && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 text-xs text-amber-900 flex items-start gap-2">
              <span className="text-amber-500"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg></span>
              <div>
                <strong className="block font-bold">Peringatan: Terdapat lokasi berjarak jauh (&gt; 25 km) dalam antrian!</strong>
                <p className="mt-0.5 text-amber-800">
                  Memasukkan stop yang sangat jauh dapat meningkatkan waktu tempuh dan konsumsi bahan bakar secara signifikan.
                </p>
              </div>
            </div>
          )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 space-y-3">
            {selPickups.map((p, idx) => {
              const wLat = Number(p.latitude)
              const wLng = Number(p.longitude)
              const isValid = !isNaN(wLat) && !isNaN(wLng) && wLat !== 0 && wLng !== 0
              const dist = isValid ? haversineKm(baseLat, baseLng, wLat, wLng) : null

              return (
                <div key={p.id} className="ws-card p-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-7 h-7 rounded-full bg-emerald-800 text-white font-bold text-xs flex items-center justify-center shrink-0">
                      {idx + 1}
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-slate-900 truncate">{p.warung_profiles?.business_name}</h4>
                      <p className="text-[11px] text-slate-400 truncate">{p.warung_profiles?.address}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[11px] font-bold text-emerald-800"><span className="flex items-center gap-1"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" /><path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" /><path d="M7 21h10" /><path d="M12 3v18" /><path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2" /></svg> {p.estimated_weight_kg} kg</span></span>
                        {dist != null && (
                          <span className={`text-[10px] font-bold ${dist > 25 ? 'text-amber-700' : 'text-slate-500'}`}>
                            • <span className="inline-flex items-center gap-0.5"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></svg></span> ±{dist > 100 ? `${dist.toFixed(0)} km (Luar Wilayah)` : `${dist.toFixed(1)} km`}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <button
                    className="text-slate-400 hover:text-rose-600 p-1 shrink-0"
                    onClick={() => setSelected(prev => prev.filter(x => x !== p.id))}
                  >
                    {IC.trash}
                  </button>
                </div>
              )
            })}

            <button
              className="w-full py-4 border-2 border-dashed border-slate-200 hover:border-emerald-500 rounded-xl text-xs font-bold text-slate-500 hover:text-emerald-700 transition-colors flex items-center justify-center gap-2"
              onClick={() => setView('available')}
            >
              {IC.plus} Tambah Warung Lainnya
            </button>
          </div>

          {/* Summary */}
          <div className="ws-card p-5 flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Kapasitas Muatan</h4>
              <div className="bg-slate-50 p-4 rounded-xl space-y-2">
                <div className="flex justify-between text-xs font-bold">
                  <span>Terpilih / Sisa Kapasitas:</span>
                  <span className={isOverloaded ? 'text-rose-600' : 'text-emerald-800'}>
                    {selectedWeight.toFixed(1)} / {remainingCapacity.toFixed(1)} kg
                  </span>
                </div>
                <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${isOverloaded ? 'bg-rose-500' : 'bg-emerald-600'}`}
                    style={{ width: `${Math.min(100, (selectedWeight / Math.max(1, remainingCapacity)) * 100)}%` }}
                  />
                </div>
                <div className="flex justify-between text-[11px] text-slate-500 pt-1">
                  <span>Kapasitas Total: {capacity} kg</span>
                  <span>Berjalan: {activeWeight.toFixed(1)} kg</span>
                </div>
              </div>
            </div>

            <button
              className="ws-btn-primary w-full justify-center text-xs"
              disabled={loading || selected.length === 0 || isOverloaded}
              onClick={createRoute}
            >
              {loading ? 'Memproses Rute...' : 'Generate Recommended Route'} {IC.chevronRight}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ─── 5. Route Map ─────────────────────────────────────────────────────────

  const renderRouteMap = () => {
    const route = activeRoute ?? routes[0]
    const stops = route?.route_stops?.slice().sort((a, b) => a.sequence_number - b.sequence_number) ?? []

    const allDone = stops.length > 0 && stops.every(s => s.status === 'completed' || s.pickup_requests?.status === 'completed')

    const totalActual = stops.reduce((sum, s) => sum + (Number(s.pickup_requests?.actual_weight_kg) || 0), 0)

    if (allDone) {
      return (
        <div className="max-w-md mx-auto space-y-5">
          <div className="text-center space-y-3">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-800 text-3xl flex items-center justify-center mx-auto">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="6" /><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11" /></svg>
            </div>
            <h2 className="text-xl font-bold text-slate-900">Seluruh Stop Selesai Dikerjakan!</h2>
            <p className="text-xs text-slate-500">
              Semua permohonan penjemputan pada rute ini telah selesai ditimbang dan diverifikasi.
            </p>
          </div>

          <div className="ws-card p-5 space-y-3">
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">Jumlah Stop</span>
              <span className="font-bold text-slate-800">{stops.length}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">Total Jarak Rute</span>
              <span className="font-bold text-slate-800">{route?.total_distance_km?.toFixed(1) ?? '0'} km</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">Estimasi Berat</span>
              <span className="font-bold text-slate-800">{route?.total_weight_kg ?? '0'} kg</span>
            </div>
            <div className="flex justify-between text-xs border-t border-slate-100 pt-3">
              <span className="text-slate-500">Total Berat Aktual</span>
              <span className="font-bold text-emerald-800">{totalActual.toFixed(1)} kg</span>
            </div>
          </div>

          <div className="ws-card p-5 space-y-2">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Ringkasan Stop ({stops.length})</h4>
            {stops.map(s => {
              const p = s.pickup_requests
              return (
                <div key={s.id} className="flex items-center justify-between gap-2 p-3 rounded-xl bg-emerald-50/50 border border-emerald-200">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0">✓</span>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-800 truncate">{p?.warung_profiles?.business_name ?? 'Warung Partner'}</p>
                      <p className="text-[11px] text-slate-500 truncate">{p?.warung_profiles?.address}</p>
                    </div>
                  </div>
                  <span className="text-[11px] font-bold text-emerald-800 shrink-0">
                    {p?.actual_weight_kg ? `${p.actual_weight_kg} kg` : '–'}
                  </span>
                </div>
              )
            })}
          </div>

          <button className="ws-btn-primary w-full justify-center text-xs" onClick={() => setView('dashboard')}>
            Kembali ke Dashboard
          </button>
        </div>
      )
    }

    const mapCenter: [number, number] = stops[0]?.pickup_requests
      ? [Number(stops[0].pickup_requests.latitude), Number(stops[0].pickup_requests.longitude)]
      : [-7.4726, 110.2198]

    const markers = stops.map(s => ({
      id: s.id,
      lat: Number(s.pickup_requests?.latitude) || -7.4726,
      lng: Number(s.pickup_requests?.longitude) || 110.2198,
      label: `Stop #${s.sequence_number}: ${s.pickup_requests?.warung_profiles?.business_name} (${s.pickup_requests?.estimated_weight_kg}kg)`
    }))

    return (
      <div className="space-y-5">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Rute Aktif (Nearest-Neighbor)</h1>
            <p className="text-xs sm:text-sm text-slate-500">Rekomendasi urutan penjemputan untuk efisiensi bahan bakar.</p>
          </div>
          {route && (
            <span className="text-xs font-bold text-emerald-800 bg-emerald-100 px-3 py-1.5 rounded-full">
              Jarak: {route.total_distance_km?.toFixed(1) ?? '0'} km • Total: {route.total_weight_kg ?? '0'} kg
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
          {/* Real Leaflet Route Map */}
          <div className="lg:col-span-2 ws-card p-4 sm:p-5 flex flex-col">
            <div className="flex items-center justify-between mb-3 shrink-0">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <span className="text-slate-600"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></svg></span> Peta Navigasi Penjemputan
              </span>
              <span className="text-[11px] text-slate-500 font-medium">
                {stops.length} Lokasi Terhubung
              </span>
            </div>
            <div className="h-72 sm:h-96 lg:h-[480px] rounded-xl overflow-hidden border border-slate-200 shadow-2xs">
              <ClientMap
                center={mapCenter}
                zoom={13}
                height="h-full min-h-[288px] sm:min-h-[384px] lg:min-h-[480px]"
                markers={markers}
              />
            </div>
          </div>

          {/* Stops List */}
          <div className="ws-card p-4 sm:p-5 flex flex-col h-[480px] lg:h-[552px]">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3 shrink-0">
              <div>
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Urutan Stop ({stops.length})</h4>
                <p className="text-[11px] text-slate-400">Rute teroptimasi terdekat</p>
              </div>
              <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                {stops.filter(s => s.status === 'completed' || s.pickup_requests?.status === 'completed').length}/{stops.length} Selesai
              </span>
            </div>

            <div className="space-y-3 overflow-y-auto flex-1 pr-1 pb-3">
              {stops.map(s => {
                const p = s.pickup_requests
                const isDone = s.status === 'completed' || p?.status === 'completed'
                return (
                  <div
                    key={s.id}
                    className={`p-3.5 rounded-xl space-y-2 border transition-all ${isDone
                        ? 'bg-emerald-50/50 border-emerald-200'
                        : 'bg-slate-50/80 border-slate-200/80 hover:bg-white hover:border-emerald-300 hover:shadow-2xs'
                      }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`w-6 h-6 rounded-full text-white text-xs font-bold flex items-center justify-center shrink-0 shadow-2xs ${isDone ? 'bg-emerald-600' : p?.status === 'in_progress' ? 'bg-blue-600' : 'bg-emerald-800'}`}>
                          {isDone ? '✓' : s.sequence_number}
                        </span>
                        <span className="text-xs font-bold text-slate-800 truncate">{p?.warung_profiles?.business_name ?? 'Warung Partner'}</span>
                      </div>
                      {isDone ? (
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full shrink-0">Selesai</span>
                      ) : p?.status === 'in_progress' ? (
                        <span className="text-[10px] font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full shrink-0 animate-pulse"><span className="inline-flex items-center gap-1"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="18.5" cy="17.5" r="3.5" /><circle cx="5.5" cy="17.5" r="3.5" /><circle cx="15" cy="5" r="1" /><path d="M12 17.5V14l-3-3 4-3 2 3h2" /></svg> OTW Lokasi</span></span>
                      ) : (
                        <span className="text-[10px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full shrink-0">Ditugaskan</span>
                      )}
                    </div>

                    <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed pl-8">{p?.warung_profiles?.address || 'Alamat tidak tertera'}</p>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/60 pl-8">
                      <span className="text-[11px] font-bold text-emerald-800 flex items-center gap-1">
                        <span className="text-slate-600"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" /><path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" /><path d="M7 21h10" /><path d="M12 3v18" /><path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2" /></svg></span>
                        <span>{p?.actual_weight_kg ? `${p.actual_weight_kg} kg (aktual)` : `${p?.estimated_weight_kg ?? 0} kg (est)`}</span>
                      </span>
                      {!isDone ? (
                        <div className="flex items-center gap-1.5">
                          {p?.status === 'assigned' ? (
                            <>
                              <button
                                type="button"
                                className="ws-btn-outline text-xs py-1.5 px-2.5 shrink-0"
                                onClick={() => {
                                  setActiveStopId(s.id)
                                  setView('current-stop')
                                }}
                              >
                                Detail
                              </button>
                              <button
                                type="button"
                                className="ws-btn-primary bg-blue-700 hover:bg-blue-800 text-white text-xs py-1.5 px-3 shrink-0 shadow-2xs font-semibold flex items-center gap-1"
                                disabled={loading}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  if (p) startTrip(p.id)
                                }}
                                title="Update status OTW ke warung"
                              >
                                <span className="text-slate-600"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="18.5" cy="17.5" r="3.5" /><circle cx="5.5" cy="17.5" r="3.5" /><circle cx="15" cy="5" r="1" /><path d="M12 17.5V14l-3-3 4-3 2 3h2" /></svg></span>
                                <span>Mulai OTW</span>
                              </button>
                            </>
                          ) : (
                            <button
                              className="ws-btn-primary text-xs py-1.5 px-3 shrink-0 shadow-2xs bg-emerald-800 hover:bg-emerald-900"
                              onClick={() => {
                                setActiveStopId(s.id)
                                setView('current-stop')
                              }}
                            >
                              Eksekusi Stop {IC.chevronRight}
                            </button>
                          )}
                        </div>
                      ) : (
                        <button
                          className="ws-btn-outline text-xs py-1.5 px-3 shrink-0"
                          onClick={() => {
                            setActiveStopId(s.id)
                            setView('current-stop')
                          }}
                        >
                          Lihat Detail
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
              {stops.length === 0 && (
                <p className="text-xs text-slate-400 text-center py-10">Belum ada rute yang aktif.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ─── 6. Current Stop (Timbang & Foto) ─────────────────────────────────────

  const renderCurrentStop = () => {
    const route = activeRoute ?? routes[0]
    const stops = route?.route_stops?.slice().sort((a, b) => a.sequence_number - b.sequence_number) ?? []

    const currentStop = (activeStopId ? stops.find(s => s.id === activeStopId) : null)
      ?? stops.find(s => s.status !== 'completed' && s.pickup_requests?.status !== 'completed')
      ?? null

    const p = currentStop?.pickup_requests
    const isStopAlreadyCompleted = currentStop ? (currentStop.status === 'completed' || p?.status === 'completed') : false

    // Next pending stop if any
    const nextPendingStop = stops.find(s => s.status !== 'completed' && s.pickup_requests?.status !== 'completed' && s.id !== currentStop?.id)

    if (!currentStop || (stops.length > 0 && stops.every(s => s.status === 'completed' || s.pickup_requests?.status === 'completed') && !activeStopId)) {
      return (
        <div className="max-w-md mx-auto ws-card p-8 text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-800 text-3xl flex items-center justify-center mx-auto">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="6" /><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11" /></svg>
          </div>
          <h2 className="text-xl font-bold text-slate-900">Seluruh Stop Selesai Dikerjakan!</h2>
          <p className="text-xs text-slate-500">
            Semua permohonan penjemputan pada rute ini telah selesai ditimbang dan diverifikasi.
          </p>
          <div className="flex flex-col sm:flex-row gap-2 pt-2">
            <button className="ws-btn-primary sm:flex-1 justify-center text-xs" onClick={() => setView('route-map')}>
              Lihat Ringkasan Rute
            </button>
            <button className="ws-btn-outline sm:flex-1 justify-center text-xs" onClick={() => setView('dashboard')}>
              Kembali ke Dashboard
            </button>
          </div>
        </div>
      )
    }

    return (
      <div className="max-w-3xl mx-auto space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
              Current Stop: Verifikasi Timbangan
            </h1>
            <p className="text-xs text-slate-500">
              {isStopAlreadyCompleted
                ? 'Stop ini sudah selesai diverifikasi sebelumnya.'
                : 'Timbang sampah organik langsung di lokasi warung dan ambil foto bukti timbangan.'}
            </p>
          </div>
          <button className="ws-btn-outline text-xs self-start sm:self-auto" onClick={() => setView('route-map')}>
            {IC.chevronLeft} Kembali ke Peta Rute
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Info & Map */}
          <div className="ws-card p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md">
                Stop #{currentStop?.sequence_number ?? 1}
              </span>
              {isStopAlreadyCompleted && (
                <span className="text-[10px] font-bold uppercase text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                  ✓ Sudah Selesai
                </span>
              )}
            </div>
            <h3 className="text-base font-bold text-slate-900">{p?.warung_profiles?.business_name ?? 'Warung Partner'}</h3>
            <p className="text-xs text-slate-500"><span className="inline-flex items-center gap-1"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></svg> {p?.warung_profiles?.address}</span></p>

            <div className="h-44 rounded-lg overflow-hidden border border-slate-200">
              <ClientMap
                center={[Number(p?.latitude) || -7.4726, Number(p?.longitude) || 110.2198]}
                zoom={14}
                height="h-44"
                markers={p ? [{ id: p.id, lat: Number(p.latitude) || -7.4726, lng: Number(p.longitude) || 110.2198, label: p.warung_profiles?.business_name ?? 'Warung' }] : []}
              />
            </div>

            {p?.notes && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-900">
                <strong className="block font-bold mb-0.5"><span className="inline-flex items-center gap-1"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg> Catatan Khusus dari Warung:</span></strong>
                {p.notes}
              </div>
            )}
          </div>

          {/* Form Verifikasi or Completed View */}
          <div className="ws-card p-5 space-y-4 flex flex-col justify-between">
            {isStopAlreadyCompleted ? (
              <div className="space-y-4">
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-2 text-xs">
                  <div className="flex items-center gap-2 text-emerald-800 font-bold text-sm">
                    <span>✓</span> Penjemputan Selesai
                  </div>
                  <p className="text-slate-600">
                    <strong>Berat Aktual Tercatat:</strong> {p?.actual_weight_kg ?? '–'} kg
                  </p>
                  <p className="text-slate-500">
                    Status: <span className="font-semibold text-emerald-700 uppercase">{p?.status}</span>
                  </p>
                </div>

                {nextPendingStop ? (
                  <button
                    className="ws-btn-primary w-full justify-center text-xs"
                    onClick={() => {
                      setActiveStopId(nextPendingStop.id)
                      setActualWeight('')
                      setProofUrl('')
                    }}
                  >
                    Lanjut ke Stop #{nextPendingStop.sequence_number} ({nextPendingStop.pickup_requests?.warung_profiles?.business_name}) {IC.chevronRight}
                  </button>
                ) : (
                  <button
                    className="ws-btn-primary w-full justify-center text-xs"
                    onClick={() => setView('route-map')}
                  >
                    Lihat Peta Rute
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {/* Step 3: Menuju Lokasi / In Progress */}
                {p?.status === 'assigned' ? (
                  <div className="space-y-4">
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4 space-y-2.5 text-xs shadow-2xs">
                      <div className="flex items-center gap-2 text-blue-900 font-bold text-sm">
                        <span className="text-blue-600"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18.5" cy="17.5" r="3.5" /><circle cx="5.5" cy="17.5" r="3.5" /><circle cx="15" cy="5" r="1" /><path d="M12 17.5V14l-3-3 4-3 2 3h2" /></svg></span>
                        <span>Tahap 3: Menuju Lokasi Warung</span>
                      </div>
                      <p className="text-slate-600 leading-relaxed text-[11px]">
                        Status warung saat ini masih <strong>Assigned</strong>. Tekan tombol di bawah saat Anda mulai berangkat menuju lokasi warung.
                      </p>
                      <button
                        type="button"
                        disabled={loading}
                        onClick={() => p && startTrip(p.id)}
                        className="ws-btn-primary w-full justify-center text-xs py-2.5 bg-blue-700 hover:bg-blue-800 text-white font-bold shadow-xs flex items-center gap-2 transition-all mt-1"
                      >
                        <span className="text-slate-600"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" /><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" /><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" /><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" /></svg></span>
                        <span>{loading ? 'Mengubah status...' : 'Mulai Menuju Lokasi Warung (Kirim OTW)'}</span>
                      </button>
                    </div>

                    <div className="bg-slate-50 border border-dashed border-slate-200 rounded-xl p-5 text-center space-y-1.5">
                      <span className="text-slate-500"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" /><path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" /><path d="M7 21h10" /><path d="M12 3v18" /><path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2" /></svg></span>
                      <h4 className="text-xs font-bold text-slate-700">Form Eksekusi Timbangan Terkunci</h4>
                      <p className="text-[11px] text-slate-500 max-w-xs mx-auto">
                        Form timbangan & upload foto bukti akan otomatis terbuka setelah Anda menekan tombol <strong>Mulai Menuju Lokasi Warung</strong> di atas.
                      </p>
                    </div>

                    <div className="pt-2 border-t border-slate-100">
                      {p && (
                        <button
                          className="w-full text-xs font-semibold text-rose-600 hover:underline py-1 text-center block"
                          onClick={() => failPickup(p.id)}
                        >
                          Tandai Gagal Jemput
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs flex items-center justify-between shadow-2xs">
                      <div className="flex items-center gap-2 text-emerald-800 font-bold">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 animate-ping"></span>
                        <span>Status: Sedang Dalam Perjalanan / Tiba di Warung</span>
                      </div>
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                        ✓ Warung Memantau
                      </span>
                    </div>

                    <div className="space-y-3 pt-1">
                      <div>
                        <label className="text-xs font-bold text-slate-700 block mb-1">Tahap 4: Berat Aktual Timbangan (kg)</label>
                        <input
                          type="number"
                          value={actualWeight}
                          onChange={(e) => setActualWeight(e.target.value)}
                          placeholder={`Estimasi awal: ${p?.estimated_weight_kg ?? 0} kg`}
                          className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 outline-hidden focus:ring-1 focus:ring-emerald-600 focus:bg-white"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-bold text-slate-700 block mb-1">Foto Bukti Timbangan (Wajib)</label>
                        <div className="border border-dashed border-slate-200 rounded-lg p-4 text-center bg-slate-50">
                          {proofUrl ? (
                            <div className="space-y-1">
                              <p className="text-xs font-bold text-emerald-700">✓ Foto bukti timbangan siap</p>
                              <label className="text-[11px] text-slate-500 underline cursor-pointer">
                                Ganti foto
                                <input type="file" accept="image/*" className="hidden" onChange={(e) => uploadProof(e.target.files?.[0] ?? null)} />
                              </label>
                            </div>
                          ) : (
                            <label className="cursor-pointer text-xs text-slate-600 flex flex-col items-center">
                              <span className="text-slate-400"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" /><circle cx="12" cy="13" r="3" /></svg></span>
                              <span>{uploading ? 'Mengunggah...' : 'Upload Foto Bukti Timbangan'}</span>
                              <input
                                type="file"
                                accept="image/*"
                                disabled={uploading}
                                onChange={(e) => uploadProof(e.target.files?.[0] ?? null)}
                                className="hidden"
                              />
                            </label>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2 pt-3 border-t border-slate-100">
                      <button
                        className="ws-btn-primary w-full justify-center text-xs"
                        disabled={loading || !actualWeight || !proofUrl}
                        onClick={() => p && submitComplete(p.id)}
                      >
                        {loading ? 'Menyimpan...' : 'Selesaikan Penjemputan Stop Ini (Step 4)'}
                      </button>
                      {p && (
                        <button
                          className="w-full text-xs font-semibold text-rose-600 hover:underline py-1"
                          onClick={() => failPickup(p.id)}
                        >
                          Tandai Gagal Jemput
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ─── 7. Completed ─────────────────────────────────────────────────────────

  const renderCompleted = () => {
    const route = activeRoute ?? routes[0]
    const stops = route?.route_stops?.slice().sort((a, b) => a.sequence_number - b.sequence_number) ?? []
    const nextPending = stops.find(s => s.status !== 'completed' && s.pickup_requests?.status !== 'completed')

    return (
      <div className="max-w-md mx-auto ws-card p-6 text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-800 text-3xl flex items-center justify-center mx-auto">
          ✓
        </div>
        <h2 className="text-xl font-bold text-slate-900">Penjemputan Berhasil Diselesaikan!</h2>
        <p className="text-xs text-slate-500">
          Data berat aktual telah tersinkronisasi ke database backend & status stop telah diperbarui menjadi selesai.
        </p>

        <div className="flex flex-col sm:flex-row gap-2 pt-2">
          <button className="ws-btn-outline sm:flex-1 justify-center text-xs" onClick={() => setView('dashboard')}>
            Dashboard
          </button>
          {nextPending ? (
            <button
              className="ws-btn-primary sm:flex-1 justify-center text-xs"
              onClick={() => {
                setActiveStopId(nextPending.id)
                setView('current-stop')
              }}
            >
              Lanjut Stop #{nextPending.sequence_number} {IC.chevronRight}
            </button>
          ) : (
            <button className="ws-btn-primary sm:flex-1 justify-center text-xs" onClick={() => setView('route-map')}>
              Lihat Peta Rute {IC.chevronRight}
            </button>
          )}
        </div>
      </div>
    )
  }

  // ─── Pengaturan Layanan & Lokasi Pangkalan ────────────────────────────

  const renderSettings = () => (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* 1. Pengaturan Lokasi Pangkalan Kurir */}
      <div className="ws-card p-6 space-y-5 border border-emerald-100/80 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <span className="text-emerald-700">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></svg>
              </span>
              Lokasi Pangkalan & Wilayah Operasional
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Atur titik pangkalan atau lokasi Anda saat ini. Titik ini menjadi pusat perhitungan jarak dan estimasi rute ke warung-warung.
            </p>
          </div>
          <button
            onClick={useMyLocation}
            disabled={locating}
            className="ws-btn-outline text-emerald-800 border-emerald-300 hover:bg-emerald-50 text-xs flex items-center gap-1.5 py-1.5 px-3 self-start sm:self-auto shrink-0"
            title="Gunakan koordinat GPS perangkat saat ini"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg>
            {locating ? 'Mencari GPS...' : 'Deteksi GPS Perangkat'}
          </button>
        </div>

        {/* Status Lokasi Aktif */}
        <div className="bg-emerald-50/80 border border-emerald-200/90 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-700 text-white flex items-center justify-center shrink-0 shadow-xs">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-emerald-950 text-sm">{serviceArea || 'Belum Diberi Nama'}</span>
                <span className="bg-emerald-200/80 text-emerald-900 text-[10px] font-bold px-2 py-0.5 rounded-full">Aktif</span>
              </div>
              <p className="text-emerald-800 text-[11px] mt-0.5 font-mono">
                Lat: {colLat != null ? colLat.toFixed(6) : '-'} • Lng: {colLng != null ? colLng.toFixed(6) : '-'}
              </p>
            </div>
          </div>
          <div className="text-right sm:text-left text-xs text-emerald-900 font-medium bg-white/70 py-1.5 px-3 rounded-lg border border-emerald-200/60 self-start sm:self-auto">
            Jemputan Terjangkau: <strong className="text-emerald-950">{available.length} Warung</strong>
          </div>
        </div>

        {/* Pilihan Cepat (Preset Wilayah) */}
        <div>
          <label className="text-xs font-bold text-slate-700 block mb-1.5">
            Pilihan Cepat Wilayah Populer (Klik untuk pilih & simpan):
          </label>
          <div className="flex flex-wrap gap-2">
            {LOCATION_PRESETS.map((preset) => {
              const isSelected = Math.abs((colLat ?? 0) - preset.lat) < 0.005 && Math.abs((colLng ?? 0) - preset.lng) < 0.005
              return (
                <button
                  key={preset.name}
                  type="button"
                  onClick={() => {
                    setInputLat(String(preset.lat))
                    setInputLng(String(preset.lng))
                    setServiceArea(preset.area)
                    saveLocation(preset.lat, preset.lng, preset.area)
                  }}
                  className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-all flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-emerald-800 text-white border-emerald-800 shadow-xs ring-2 ring-emerald-300'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-emerald-300'
                  }`}
                >
                  <span>📍</span>
                  <span>{preset.name}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Form Atur Bebas Manual */}
        <div className="border-t border-slate-100 pt-4 space-y-3">
          <div className="font-bold text-xs text-slate-800">Atur Koordinat & Wilayah Kustom:</div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-[11px] font-semibold text-slate-600 block mb-1">Nama Wilayah / Depot</label>
              <input
                type="text"
                placeholder="Contoh: Depot Mertoyudan"
                value={serviceArea}
                onChange={(e) => setServiceArea(e.target.value)}
                className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs outline-hidden focus:border-emerald-500 shadow-2xs"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-slate-600 block mb-1">Latitude (Garis Lintang)</label>
              <input
                type="number"
                step="any"
                placeholder="-7.472600"
                value={inputLat}
                onChange={(e) => setInputLat(e.target.value)}
                className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-mono outline-hidden focus:border-emerald-500 shadow-2xs"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-slate-600 block mb-1">Longitude (Garis Bujur)</label>
              <input
                type="number"
                step="any"
                placeholder="110.219800"
                value={inputLng}
                onChange={(e) => setInputLng(e.target.value)}
                className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-mono outline-hidden focus:border-emerald-500 shadow-2xs"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={() => saveLocation()}
              disabled={savingLocation}
              className="ws-btn-primary text-xs flex items-center gap-1.5 py-2 px-4 shadow-xs"
            >
              {savingLocation ? 'Menyimpan Lokasi...' : 'Simpan Lokasi Pangkalan'}
            </button>
          </div>
        </div>
      </div>

      {/* 2. Pengaturan Jadwal Layanan */}
      <div className="ws-card p-6 space-y-4">
        <div>
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">{IC.clock} Pengaturan Jadwal Layanan</h3>
          <p className="text-xs text-slate-500 mt-1">
            Jadwal & kuota ini menentukan &#34;Jendela Waktu&#34; yang tampil di sisi warung. Warung hanya dapat memilih slot di dalam jam layanan Anda dan selama slot belum penuh.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="text-xs font-medium text-slate-700 block mb-1.5">Jam Mulai Layanan</label>
            <input
              type="time"
              className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm"
              value={serviceStart}
              onChange={(e) => setServiceStart(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-700 block mb-1.5">Jam Selesai Layanan</label>
            <input
              type="time"
              className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm"
              value={serviceEnd}
              onChange={(e) => setServiceEnd(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-700 block mb-1.5">Maks. Pickup per Slot</label>
            <input
              type="number"
              min={1}
              className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm"
              value={maxPerSlot}
              onChange={(e) => setMaxPerSlot(Number(e.target.value) || 0)}
            />
          </div>
        </div>

        <p className="text-[11px] text-slate-400">
          Contoh: jika jam layanan 09:00–15:00, maka slot yang tersedia di warung adalah 09:00–11:00, 11:00–13:00, dan 13:00–15:00.
        </p>

        <div className="flex flex-col-reverse sm:flex-row justify-between items-stretch sm:items-center gap-2 pt-3 border-t border-slate-100">
          <button className="ws-btn-outline text-xs" onClick={() => setView('dashboard')}>
            {IC.chevronLeft} Kembali ke Dashboard
          </button>
          <button className="ws-btn-primary text-xs" onClick={saveSchedule} disabled={loading}>
            {loading ? 'Menyimpan...' : 'Simpan Jadwal'}
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <AppShell
      role="collector"
      userName={me?.name ?? 'Collector Partner'}
      userRole="Active Collector"
      currentView={view}
      onNavigate={(v) => setView(v as View)}
      onLogout={logout}
      breadcrumb={breadcrumbMap[view]}
      userId={me?.id}
      userEmail={me?.email}
      userPhone={me?.phone_number ?? ''}
      onProfileUpdated={(up) => setMe((prev) => (prev ? { ...prev, ...up } : null))}
      notifications={notifications}
      searchItems={searchItems}
      searchPlaceholder="Cari warung, alamat, titik jemput..."
    >
      {view === 'dashboard' && renderDashboard()}
      {view === 'available' && renderAvailable()}
      {view === 'pickup-detail' && renderPickupDetail()}
      {view === 'selected' && renderSelected()}
      {view === 'route-map' && renderRouteMap()}
      {view === 'current-stop' && renderCurrentStop()}
      {view === 'completed' && renderCompleted()}
      {(view === 'settings' || view === 'profile') && renderSettings()}
    </AppShell>
  )
}
