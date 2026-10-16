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
  apiCompleteRoute,
  apiFailPickup,
  apiRecommendRoute,
  apiGetCategories,
} from '@/lib/api/collector'
import { apiUpload } from '@/lib/api/upload'
import {
  parseDbDate,
  formatWIBDate,
  formatWIBTimeRange,
  getWibDateString,
  getWibTomorrowString,
} from '@/lib/datetime'

// ─── Types ────────────────────────────────────────────────────────────────────

interface WasteCategoryItem {
  id: string
  category_name: string
  is_maggot_friendly?: boolean
  description?: string | null
}

interface AvailablePickup {
  id: string
  latitude: number
  longitude: number
  estimated_weight_kg: number
  pickup_window_start: string
  pickup_window_end: string
  waste_category_id?: string | null
  notes?: string | null
  sample_photo_url?: string | null
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
    sample_photo_url?: string | null
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
  const c = cat.toLowerCase()
  let color = 'bg-emerald-50 text-emerald-800 border-emerald-200'
  if (c.includes('jelantah') || c.includes('minyak')) {
    color = 'bg-amber-50 text-amber-800 border-amber-200'
  } else if (c.includes('plastik') || c.includes('pet') || c.includes('cup')) {
    color = 'bg-sky-50 text-sky-800 border-sky-200'
  } else if (c.includes('kaleng') || c.includes('logam')) {
    color = 'bg-purple-50 text-purple-800 border-purple-200'
  } else if (c.includes('b3') || c.includes('baterai') || c.includes('lampu')) {
    color = 'bg-rose-50 text-rose-800 border-rose-200'
  } else if (c.includes('kaca') || c.includes('beling')) {
    color = 'bg-cyan-50 text-cyan-800 border-cyan-200'
  } else if (c.includes('kardus') || c.includes('karton')) {
    color = 'bg-emerald-50 text-emerald-800 border-emerald-200'
  }

  return (
    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase border ${color}`}>
      {cat}
    </span>
  )
}

function PhotoPreviewModal({
  photo,
  onClose,
  onVerify,
  isVerified,
}: {
  photo: {
    url: string
    title: string
    category?: string
    weight?: number
    notes?: string | null
    pickupId?: string
  }
  onClose: () => void
  onVerify?: () => void
  isVerified?: boolean
}) {
  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-100 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-white">
          <div className="min-w-0 pr-2">
            <h3 className="font-bold text-sm text-slate-900 truncate">{photo.title}</h3>
            <p className="text-xs text-slate-500 flex items-center gap-1.5 flex-wrap">
              <span className="font-semibold text-emerald-800">{photo.category ?? 'Limbah Anorganik'}</span>
              <span>•</span>
              <span>Est. {photo.weight ?? 0} kg</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors shrink-0"
            aria-label="Tutup"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        {/* Image Display */}
        <div className="p-3 bg-slate-900 flex items-center justify-center overflow-auto flex-1 min-h-[260px]">
          <img
            src={photo.url}
            alt={photo.title}
            className="max-h-[58vh] max-w-full object-contain rounded-lg shadow-lg"
          />
        </div>

        {/* Footer info & verify */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 space-y-3">
          {photo.notes && (
            <p className="text-xs text-slate-600 bg-amber-50/80 p-2.5 rounded-lg border border-amber-200">
              <strong className="text-amber-900">Catatan Warung:</strong> {photo.notes}
            </p>
          )}

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              {isVerified ? (
                <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-800 bg-emerald-100 px-2.5 py-1 rounded-md border border-emerald-200">
                  <svg className="w-3.5 h-3.5 text-emerald-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                  Sudah Dinyatakan Sesuai
                </span>
              ) : (
                <span className="text-[11px] text-slate-500 font-medium">
                  Periksa kebersihan & kecocokan jenis limbah
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {onVerify && !isVerified && (
                <button
                  type="button"
                  onClick={() => {
                    onVerify()
                    onClose()
                  }}
                  className="ws-btn-primary text-xs py-1.5 px-3 flex-1 sm:flex-none justify-center bg-emerald-800 hover:bg-emerald-900"
                >
                  ✓ Konfirmasi Sesuai
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="ws-btn-outline text-xs py-1.5 px-3 flex-1 sm:flex-none justify-center"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
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

interface VehicleOption {
  type: string
  title: string
  subtitle: string
  badge: string
  isPopular?: boolean
  defaultCap: number
  minCap: number
  maxCap: number
  recommendation: string
}

const VEHICLE_OPTIONS: VehicleOption[] = [
  {
    type: 'Motor Roda Dua',
    title: 'Sepeda Motor (Roda Dua)',
    subtitle: 'Lincah menjangkau gang sempit & jalan permukiman padat',
    badge: 'Area Sempit / Cepat',
    defaultCap: 50,
    minCap: 20,
    maxCap: 80,
    recommendation: 'Cocok untuk jeriken jelantah kecil & karung plastik padat.',
  },
  {
    type: 'Motor Roda Tiga / Tossa',
    title: 'Motor Roda Tiga (Tossa / Viar)',
    subtitle: 'Kargo bak terbuka serbaguna, standar kurir jemputan',
    badge: 'Paling Populer',
    isPopular: true,
    defaultCap: 150,
    minCap: 80,
    maxCap: 350,
    recommendation: 'Muatan ideal bal kardus, jeriken minyak, dan botol PET karungan.',
  },
  {
    type: 'Mobil Pick-up / GranMax',
    title: 'Mobil Pick-Up (GranMax / Carry)',
    subtitle: 'Daya muat besar untuk multi-warung rute sekali jalan',
    badge: 'Kapasitas Menengah',
    defaultCap: 600,
    minCap: 300,
    maxCap: 900,
    recommendation: 'Sangat efisien untuk 10-20 warung tanpa bolak-balik ke depot.',
  },
  {
    type: 'Truk Engkel / Box',
    title: 'Truk Engkel / Box Komersial',
    subtitle: 'Pengangkutan tonase besar ke pabrik pengolahan daur ulang',
    badge: 'Kapasitas Tonase',
    defaultCap: 1500,
    minCap: 1000,
    maxCap: 3000,
    recommendation: 'Optimal untuk transfer limbah skala besar antar depot / agregator.',
  },
]

export default function CollectorPage() {
  const router = useRouter()

  const [me, setMe] = useState<AuthUser | null>(null)
  const [available, setAvailable] = useState<AvailablePickup[]>([])
  const [routes, setRoutes] = useState<Route[]>([])
  const [vehicleType, setVehicleType] = useState<string>('Motor Roda Tiga / Tossa')
  const [capacity, setCapacity] = useState<number>(150)
  const [serviceStart, setServiceStart] = useState('07:00')
  const [serviceEnd, setServiceEnd] = useState('23:00')
  const [maxPerSlot, setMaxPerSlot] = useState(5)
  const [selected, setSelected] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [savingVehicle, setSavingVehicle] = useState(false)
  const [savingScheduleState, setSavingScheduleState] = useState(false)
  const [savingAll, setSavingAll] = useState(false)
  const [settingsTab, setSettingsTab] = useState<'all' | 'vehicle' | 'location' | 'schedule'>('all')
  const [copiedCoords, setCopiedCoords] = useState(false)
  const [view, setView] = useState<View>('dashboard')
  const [detailPickup, setDetailPickup] = useState<AvailablePickup | null>(null)
  const [activeStopId, setActiveStopId] = useState<string | null>(null)
  // Modal konfirmasi kosongkan muatan
  const [unloadConfirmOpen, setUnloadConfirmOpen] = useState(false)

  // Modal Preview Foto Fullscreen
  const [photoModal, setPhotoModal] = useState<{
    url: string
    title: string
    category?: string
    weight?: number
    notes?: string | null
    pickupId?: string
  } | null>(null)

  // Status Verifikasi Kesesuaian Foto Sampel oleh Collector
  const [verifiedMap, setVerifiedMap] = useState<Record<string, {
    categoryOk: boolean
    conditionOk: boolean
    weightOk: boolean
    isInvalid: boolean
    invalidReason?: string
  }>>({})

  function toggleVerificationField(pickupId: string, field: 'categoryOk' | 'conditionOk' | 'weightOk') {
    setVerifiedMap(prev => {
      const current = prev[pickupId] ?? { categoryOk: false, conditionOk: false, weightOk: false, isInvalid: false }
      const updated = { ...current, [field]: !current[field], isInvalid: false }
      return { ...prev, [pickupId]: updated }
    })
  }

  function verifyAll(pickupId: string) {
    setVerifiedMap(prev => ({
      ...prev,
      [pickupId]: { categoryOk: true, conditionOk: true, weightOk: true, isInvalid: false }
    }))
    toast.success('Limbah diverifikasi: Kategori, kondisi, dan muatan sesuai ✓')
  }

  function markInvalid(pickupId: string, reason: string) {
    setVerifiedMap(prev => ({
      ...prev,
      [pickupId]: { categoryOk: false, conditionOk: false, weightOk: false, isInvalid: true, invalidReason: reason }
    }))
    toast.warning('Permohonan ditandai tidak sesuai/mencurigakan.')
  }

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

  const [categories, setCategories] = useState<WasteCategoryItem[]>([])
  const [catFilter, setCatFilter] = useState<string>('all')
  const [searchFilter, setSearchFilter] = useState('')
  const [availPage, setAvailPage] = useState(1)
  const [availPageSize, setAvailPageSize] = useState(6)

  async function load() {
    try {
      const [meUser, av, rt, cap, cats] = await Promise.all([
        apiGetMe(),
        apiGetCollectorPickups().catch(() => []),
        apiGetCollectorRoutes().catch(() => []),
        apiGetCollectorCapacity().catch(() => null),
        apiGetCategories().catch(() => []),
      ])

      if (!meUser) { router.replace('/login'); return }
      if (meUser.role !== 'collector') { router.replace(`/${meUser.role}`); return }
      setMe(meUser)

      if (Array.isArray(av)) setAvailable(av as unknown as AvailablePickup[])
      if (Array.isArray(rt)) setRoutes(rt as unknown as Route[])
      if (Array.isArray(cats)) setCategories(cats as WasteCategoryItem[])
      if (cap) {
        const p = cap as {
          vehicle_type?: string
          vehicle_capacity_kg?: number
          latitude?: number
          longitude?: number
          service_start?: string
          service_end?: string
          max_pickups_per_slot?: number
          service_area?: string
        }
        if (p.vehicle_type) setVehicleType(p.vehicle_type)
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
        setServiceEnd(p.service_end || '23:00')
        setMaxPerSlot(Number(p.max_pickups_per_slot) || 5)
      }
    } catch {
      /* ignore */
    }
  }

  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Sinkronisasi realtime: pickup_requests, routes, route_stops, collector_profiles, dan waste_categories (dari admin)
  useRealtimeTables(['pickup_requests', 'routes', 'route_stops', 'collector_profiles', 'waste_categories'], load)

  // Otomatis reset filter kategori jika kategori yang dipilih dihapus oleh admin
  useEffect(() => {
    if (catFilter !== 'all' && categories.length > 0) {
      const exists = categories.some(
        (c) => c.id === catFilter || c.category_name.toLowerCase() === catFilter.toLowerCase()
      )
      if (!exists) setCatFilter('all')
    }
  }, [categories, catFilter])

  // Notifikasi dinamis berbasis data riil collector
  const notifications = useMemo<AppNotification[]>(() => {
    const list: AppNotification[] = []

    // 1. Notifikasi jemputan baru yang tersedia di area
    if (available.length > 0) {
      list.push({
        id: `col-avail-${available.length}-${available[0].id}`,
        title: `${available.length} Permohonan Siap Dijemput`,
        message: `Ada ${available.length} warung membutuhkan penjemputan limbah anorganik di radius Anda.`,
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
      const cat = p.waste_categories?.category_name || 'Anorganik'
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

  async function saveVehicle(typeToSave?: string, capToSave?: number) {
    const vType = typeToSave ?? vehicleType
    const vCap = capToSave ?? capacity
    if (!vCap || vCap <= 0) {
      return toast.error('Kapasitas angkut harus lebih besar dari 0 kg!')
    }
    setSavingVehicle(true)
    try {
      await apiUpdateCollectorCapacity({
        vehicle_type: vType,
        vehicle_capacity_kg: vCap,
      })
      setVehicleType(vType)
      setCapacity(vCap)
      toast.success(`Armada berhasil diperbarui: ${vType} (${vCap} kg) ✓`)
      await load()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Gagal menyimpan armada kendaraan')
    } finally {
      setSavingVehicle(false)
    }
  }

  async function saveSchedule() {
    if (serviceStart >= serviceEnd) {
      return toast.error('Jam mulai harus lebih awal dari jam selesai!')
    }
    setSavingScheduleState(true)
    try {
      await apiUpdateCollectorCapacity({
        service_start: serviceStart,
        service_end: serviceEnd,
        max_pickups_per_slot: Number(maxPerSlot),
      })
      toast.success('Jadwal layanan berhasil disimpan! ✓')
      await load()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Gagal menyimpan jadwal')
    } finally {
      setSavingScheduleState(false)
    }
  }

  async function saveAllSettings() {
    if (serviceStart >= serviceEnd) {
      return toast.error('Jam mulai layanan harus lebih awal dari jam selesai!')
    }
    const lat = parseFloat(inputLat)
    const lng = parseFloat(inputLng)
    if (isNaN(lat) || lat < -90 || lat > 90) {
      return toast.error('Latitude harus angka yang valid antara -90 dan 90!')
    }
    if (isNaN(lng) || lng < -180 || lng > 180) {
      return toast.error('Longitude harus angka yang valid antara -180 dan 180!')
    }
    if (!capacity || capacity <= 0) {
      return toast.error('Kapasitas angkut harus lebih besar dari 0 kg!')
    }

    setSavingAll(true)
    try {
      await apiUpdateCollectorCapacity({
        vehicle_type: vehicleType,
        vehicle_capacity_kg: capacity,
        latitude: lat,
        longitude: lng,
        service_area: serviceArea.trim() || 'Area Layanan',
        service_start: serviceStart,
        service_end: serviceEnd,
        max_pickups_per_slot: Number(maxPerSlot),
      })
      setColLat(lat)
      setColLng(lng)
      toast.success('Semua pengaturan layanan kurir berhasil disimpan! ✓')
      await load()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Gagal menyimpan semua pengaturan')
    } finally {
      setSavingAll(false)
    }
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

  async function completeRoute(routeId: string) {
    setLoading(true)
    try {
      await apiCompleteRoute(routeId)
      toast.success('Rute selesai & muatan armada berhasil dikosongkan! Kapasitas siap dipakai kembali. ✓')
      await load()
      setView('completed')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Gagal menyelesaikan rute')
    } finally {
      setLoading(false)
    }
  }

  async function emptyVehicleLoad() {
    setLoading(true)
    try {
      const activeList = routes.filter(r => r.status === 'active')
      for (const r of activeList) {
        await apiCompleteRoute(r.id)
      }
      toast.success('Muatan armada berhasil dikosongkan (0 kg)! Kapasitas siap digunakan kembali. ✓')
      await load()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Gagal mengosongkan muatan')
    } finally {
      setLoading(false)
    }
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

  // Hitung jumlah per kategori (dari filtered radius)
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const p of filtered) {
      if (p.waste_category_id) {
        counts[p.waste_category_id] = (counts[p.waste_category_id] || 0) + 1
      }
      const name = p.waste_categories?.category_name
      if (name) {
        counts[name] = (counts[name] || 0) + 1
      }
    }
    return counts
  }, [filtered])

  const catFiltered = useMemo(() => {
    if (catFilter === 'all') return filtered
    return filtered.filter((p) => {
      if (p.waste_category_id && p.waste_category_id === catFilter) return true
      const catName = (p.waste_categories?.category_name || '').toLowerCase()
      const target = catFilter.toLowerCase()
      return catName === target || catName.includes(target)
    })
  }, [catFilter, filtered])

  const todayStr = getWibDateString()
  const tomorrowStr = getWibTomorrowString()

  const scheduleFiltered = catFiltered.filter((p) => {
    if (scheduleFilter === 'all') return true
    const pDate = getWibDateString(p.pickup_window_start)
    if (scheduleFilter === 'today') return pDate === todayStr
    if (scheduleFilter === 'tomorrow') return pDate === tomorrowStr
    if (scheduleFilter === 'upcoming') return pDate > tomorrowStr
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

  const todayCount = catFiltered.filter((p) => getWibDateString(p.pickup_window_start) === todayStr).length
  const tomorrowCount = catFiltered.filter((p) => getWibDateString(p.pickup_window_start) === tomorrowStr).length
  const upcomingCount = catFiltered.filter((p) => {
    const d = getWibDateString(p.pickup_window_start)
    return d > tomorrowStr
  }).length

  // Kapasitas & Perlindungan Overload
  // activeRoutes = semua rute berstatus 'active' (muatan masih ada di kendaraan).
  // Muatan baru dikosongkan hanya ketika collector menekan "Kosongkan Muatan" (apiCompleteRoute).
  const activeRoutes = routes.filter((r) => r.status === 'active')
  // Gunakan actual_weight dari stop-stop yang sudah completed, atau total_weight_kg rute sebagai estimasi
  const activeWeight = activeRoutes.reduce((sum, r) => {
    // Hitung berat aktual dari stop yang sudah selesai
    const completedWeight = r.route_stops
      ?.filter(s => s.status === 'completed')
      .reduce((w, s) => w + Number(s.pickup_requests?.actual_weight_kg ?? s.pickup_requests?.estimated_weight_kg ?? 0), 0) ?? 0
    // Hitung estimasi dari stop yang masih pending/in_progress
    const pendingWeight = r.route_stops
      ?.filter(s => s.status === 'pending' || s.status === 'in_progress')
      .reduce((w, s) => w + Number(s.pickup_requests?.estimated_weight_kg ?? 0), 0) ?? 0
    return sum + completedWeight + pendingWeight
  }, 0)
  const remainingCapacity = Math.max(0, capacity - activeWeight)
  const selectedWeight = available.filter((a) => selected.includes(a.id)).reduce((s, a) => s + Number(a.estimated_weight_kg), 0)
  const selectableRemaining = Math.max(0, remainingCapacity - selectedWeight)

  // Pagination available
  const totalAvailPages = Math.max(1, Math.ceil(searchFiltered.length / availPageSize))
  const paginatedAvail = searchFiltered.slice((availPage - 1) * availPageSize, availPage * availPageSize)

  // Rute aktif: semua rute berstatus 'active', termasuk yang semua stop-nya sudah selesai
  // tapi belum dikosongkan di depot (belum memanggil apiCompleteRoute).
  const activeRoute = routes
    .filter(r => r.status === 'active')
    .sort((a, b) => (a.created_at && b.created_at ? String(b.created_at).localeCompare(String(a.created_at)) : 0))[0]
  const totalPickups = routes.reduce((s, r) => s + (r.route_stops?.length || 0), 0)
  const completedPickupsCount = routes.reduce(
    (s, r) => s + (r.route_stops?.filter(st => st.status === 'completed' || st.pickup_requests?.status === 'completed').length || 0),
    0
  )
  const totalWeight = routes.reduce((s, r) => s + Number(r.total_weight_kg || 0), 0)

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
    // Hitung performa 7 hari terakhir berbasis data riil rute/pickup
    const dayNames = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']
    const last7Days: { label: string; dateStr: string; weight: number }[] = []
    const now = new Date()
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(d.getDate() - i)
      const dateStr = d.toISOString().split('T')[0]
      const label = dayNames[d.getDay()]
      last7Days.push({ label, dateStr, weight: 0 })
    }

    for (const r of routes) {
      const rDate = r.created_at ? r.created_at.split('T')[0] : ''
      const dayEntry = last7Days.find(d => d.dateStr === rDate)
      if (dayEntry) {
        dayEntry.weight += Number(r.total_weight_kg || 0)
      }
    }

    const weekLabels = last7Days.map(d => d.label)
    const weekData = [{ label: 'Muatan (kg)', values: last7Days.map(d => Math.round(d.weight * 10) / 10) }]

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
        <div className="ws-card bg-gradient-to-br from-emerald-50 via-emerald-100/70 to-teal-50 text-emerald-950 p-5 sm:p-7 md:p-8 rounded-2xl border border-emerald-200/70 shadow-xs relative overflow-hidden">
          {/* Subtle background glow */}
          <div className="absolute -right-12 -bottom-12 w-48 h-48 bg-emerald-200/40 rounded-full blur-2xl pointer-events-none" />

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center relative z-10">
            {/* Left Column: Greeting, Info & Actions */}
            <div className="lg:col-span-7 space-y-3">
              <div className="inline-flex items-center gap-2">
                <span className="text-[10px] font-extrabold tracking-wider uppercase bg-emerald-800 px-2.5 py-1 rounded-full text-emerald-100 shadow-2xs">
                  Collector Portal
                </span>
                <span className="text-xs font-semibold text-emerald-800/80">
                  {formatWIBDate(new Date(), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                </span>
              </div>

              <h2 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-emerald-950 tracking-tight leading-snug">
                Siap Optimalkan Rute Penjemputan Sampah?
              </h2>

              <p className="text-xs sm:text-sm text-emerald-900/90 leading-relaxed max-w-xl">
                Temukan permohonan jemput terdekat, klaim muatan sesuai kapasitas maksimal motor ({capacity} kg), dan ikuti rekomendasi navigasi rute terpendek.
              </p>

              {/* Action Buttons (Responsive: full-width on mobile, auto on sm/desktop) */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 pt-2">
                <button
                  className="ws-btn-primary text-xs py-2.5 px-4 justify-center sm:justify-start shadow-xs flex items-center gap-2 transition-transform active:scale-95"
                  onClick={() => setView('available')}
                >
                  {IC.route}
                  <span>Lihat {filtered.length} Pickup Tersedia</span>
                  <span className="bg-emerald-700 text-emerald-100 text-[10px] font-bold px-1.5 py-0.5 rounded-full ml-1">
                    {filtered.length}
                  </span>
                </button>
                <button
                  className="ws-btn-outline text-emerald-900 border-emerald-300 bg-white/80 hover:bg-white text-xs py-2.5 px-4 justify-center sm:justify-start flex items-center gap-1.5 transition-transform active:scale-95 shadow-2xs"
                  onClick={() => setView('settings')}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="3" />
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                  </svg>
                  <span>Atur Lokasi & Jadwal</span>
                </button>
              </div>
            </div>

            {/* Right Column: Status Pangkalan Kurir Aktif & Kendaraan (Glassmorphism Card) */}
            <div className="lg:col-span-5 w-full">
              <div className="bg-white/90 backdrop-blur-md border border-emerald-200/90 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="w-8 h-8 rounded-xl bg-emerald-800 text-white flex items-center justify-center shrink-0 shadow-2xs">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                        <circle cx="12" cy="10" r="3" />
                      </svg>
                    </span>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block leading-tight">Pangkalan Operasional</span>
                      <strong className="text-sm font-extrabold text-slate-900 block truncate">{serviceArea || 'Magelang'}</strong>
                    </div>
                  </div>
                  <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2.5 py-0.5 rounded-full shrink-0 border border-emerald-200">
                    Aktif
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 border border-slate-200/70 p-2.5 rounded-xl">
                  <div>
                    <span className="text-[10px] text-slate-400 block font-medium">Titik Koordinat:</span>
                    <span className="font-mono text-[11px] font-bold text-slate-700 block truncate" title={`${colLat}, ${colLng}`}>
                      {colLat != null ? colLat.toFixed(4) : '-'}, {colLng != null ? colLng.toFixed(4) : '-'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block font-medium">Kapasitas Muat:</span>
                    <span className="text-[11px] font-bold text-emerald-700 block">
                      {capacity} kg (Motor)
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 4 Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="ws-card p-5 flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">TOTAL PICKUPS</span>
                <p className="text-2xl font-extrabold text-slate-900 mt-1">{totalPickups}</p>
              </div>
              <span className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 10V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l2-1.14" />
                  <polyline points="3.29 7 12 12 20.71 7" />
                  <polyline points="16 16 19 19 22 13" />
                </svg>
              </span>
            </div>
            <div className="mt-2.5 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className="font-semibold text-emerald-700">
                {totalPickups > 0 ? `${completedPickupsCount} Selesai (${Math.round((completedPickupsCount / totalPickups) * 100)}%)` : '0 Selesai'}
              </span>
              <span className="text-[10px] text-slate-400">Riwayat Armada</span>
            </div>
          </div>

          <div className="ws-card p-5 flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">MUATAN SAAT INI</span>
                <p className={`text-2xl font-extrabold mt-1 ${activeWeight > capacity * 0.85 ? 'text-rose-600' : activeWeight > 0 ? 'text-amber-700' : 'text-slate-900'}`}>
                  {activeWeight.toFixed(1)} kg
                </p>
              </div>
              <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${activeWeight > 0 ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-500'}`}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="1" y="3" width="15" height="13" rx="1" />
                  <path d="M16 8h4l3 3v5h-7V8z" />
                  <circle cx="5.5" cy="18.5" r="2.5" />
                  <circle cx="18.5" cy="18.5" r="2.5" />
                </svg>
              </span>
            </div>
            <div className="mt-2.5 pt-2.5 border-t border-slate-100 flex flex-col gap-1">
              <div className="flex items-center justify-between text-xs">
                <span className={`font-bold ${activeWeight > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
                  {activeWeight === 0 ? 'Kosong (0% Terisi)' : `${Math.round((activeWeight / capacity) * 100)}% Terisi`}
                </span>
                <span className="text-[10px] text-slate-400">Total: {totalWeight.toFixed(1)} kg</span>
              </div>
              {activeWeight > 0 && (
                <button
                  type="button"
                  onClick={() => setUnloadConfirmOpen(true)}
                  className="text-[11px] font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-300 px-2 py-1 rounded-md flex items-center justify-center gap-1 transition-colors mt-1 w-full"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                  Kosongkan Muatan di Sini
                </button>
              )}
            </div>
          </div>

          <div className="ws-card p-5 flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">KAPASITAS KENDARAAN</span>
                <p className="text-2xl font-extrabold text-slate-900 mt-1">{capacity} kg</p>
              </div>
              <span className="w-8 h-8 rounded-lg bg-cyan-50 text-cyan-700 flex items-center justify-center shrink-0">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2v20" />
                  <path d="m17 5-5-3-5 3" />
                  <path d="m17 19-5 3-5-3" />
                  <path d="M2 12h20" />
                  <path d="m5 7-3 5 3 5" />
                  <path d="m19 7 3 5-3 5" />
                </svg>
              </span>
            </div>
            <div className="mt-2.5 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className={`font-semibold ${remainingCapacity > 0 ? 'text-cyan-800' : 'text-rose-600'}`}>
                Sisa {remainingCapacity.toFixed(1)} kg
              </span>
              <span className="text-[10px] text-slate-400">{vehicleType || 'Motor'}</span>
            </div>
          </div>

          <div className="ws-card p-5 flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">RUTE AKTIF</span>
                <p className="text-2xl font-extrabold text-slate-900 mt-1">
                  {routeInProgress ? `${activeRoute?.route_stops?.filter(s => s.status !== 'completed' && s.pickup_requests?.status !== 'completed').length || 0} Titik` : '0 Aktif'}
                </p>
              </div>
              <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${routeInProgress ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-400'}`}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="6" cy="19" r="3" />
                  <path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15" />
                  <circle cx="18" cy="5" r="3" />
                </svg>
              </span>
            </div>
            <div className="mt-2.5 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className={`font-semibold ${routeInProgress ? 'text-purple-700 font-bold' : 'text-slate-500'}`}>
                {routeInProgress ? 'Sedang Berjalan' : 'Standby (Idle)'}
              </span>
              {routeInProgress && (
                <button
                  type="button"
                  onClick={() => setView('current-stop')}
                  className="text-[10px] font-bold text-purple-700 hover:underline"
                >
                  Buka Rute &rarr;
                </button>
              )}
            </div>
          </div>
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
            <>
              <button
                type="button"
                className="ws-btn-outline text-rose-700 border-rose-300 hover:bg-rose-50 text-xs py-1.5 px-3"
                onClick={() => {
                  setSelected([])
                  toast.info('Pilihan antrean jemputan berhasil dikosongkan')
                }}
              >
                Reset Pilihan
              </button>
              <button className="ws-btn-primary text-xs" onClick={() => setView('selected')}>
                Lihat Antrian ({selected.length})
              </button>
            </>
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
              <span className="text-slate-400 font-medium">Muatan Kendaraan:</span>{' '}
              <strong className={activeWeight > 0 ? 'text-amber-700 font-bold' : 'text-slate-700'}>
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

      {/* Banner Muatan Aktif — muncul hanya jika ada muatan di kendaraan */}
      {activeWeight > 0 && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-3 flex items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="shrink-0 w-8 h-8 rounded-full bg-amber-100 border border-amber-300 flex items-center justify-center text-amber-700">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="1" y="3" width="15" height="13" rx="1"/>
                <path d="M16 8h4l3 3v5h-7V8z"/>
                <circle cx="5.5" cy="18.5" r="2.5"/>
                <circle cx="18.5" cy="18.5" r="2.5"/>
              </svg>
            </span>
            <div className="min-w-0">
              <p className="text-xs font-bold text-amber-900 leading-tight">Kendaraan Membawa Muatan</p>
              <p className="text-[11px] text-amber-700 leading-tight truncate">
                {activeWeight.toFixed(1)} kg sampah di kendaraan · Sisa: {remainingCapacity.toFixed(1)} kg
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setUnloadConfirmOpen(true)}
            disabled={loading}
            className="shrink-0 px-3 py-1.5 text-[11px] font-bold rounded-lg bg-amber-600 hover:bg-amber-700 text-white transition-colors shadow-xs disabled:opacity-60"
          >
            Buang Muatan
          </button>
        </div>
      )}

      {remainingCapacity <= 0 && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-xs text-rose-800 flex items-start gap-2">
          <span className="text-amber-500"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg></span>
          <div>
            <strong className="block font-bold">Kapasitas Kendaraan Anda Penuh ({capacity} kg)!</strong>
            <p className="mt-0.5 text-rose-700">
              Selesaikan semua pickup dan buang muatan di TPS/depot terlebih dahulu sebelum mengambil permohonan baru.
            </p>
          </div>
        </div>
      )}

      {/* Schedule Tabs */}
      <div className="bg-slate-50 border border-slate-200/90 p-2 rounded-xl space-y-2">
        <span className="text-xs font-bold text-slate-500 ml-1 uppercase tracking-wider block">Jadwal:</span>
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2">
          <button
            onClick={() => { setScheduleFilter('today'); setAvailPage(1) }}
            className={`px-3 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-between gap-1.5 ${scheduleFilter === 'today'
                ? 'bg-emerald-800 text-white shadow-xs'
                : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
              }`}
          >
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span> Hari Ini</span>
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${scheduleFilter === 'today' ? 'bg-emerald-700 text-white' : 'bg-slate-100 text-slate-600'}`}>
              {todayCount}
            </span>
          </button>
          <button
            onClick={() => { setScheduleFilter('tomorrow'); setAvailPage(1) }}
            className={`px-3 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-between gap-1.5 ${scheduleFilter === 'tomorrow'
                ? 'bg-emerald-800 text-white shadow-xs'
                : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
              }`}
          >
            <span className="flex items-center gap-1"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg> Besok</span>
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${scheduleFilter === 'tomorrow' ? 'bg-emerald-700 text-white' : 'bg-slate-100 text-slate-600'}`}>
              {tomorrowCount}
            </span>
          </button>
          <button
            onClick={() => { setScheduleFilter('upcoming'); setAvailPage(1) }}
            className={`px-3 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-between gap-1.5 ${scheduleFilter === 'upcoming'
                ? 'bg-emerald-800 text-white shadow-xs'
                : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
              }`}
          >
            <span className="flex items-center gap-1"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg> Mendatang</span>
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${scheduleFilter === 'upcoming' ? 'bg-emerald-700 text-white' : 'bg-slate-100 text-slate-600'}`}>
              {upcomingCount}
            </span>
          </button>
          <button
            onClick={() => { setScheduleFilter('all'); setAvailPage(1) }}
            className={`px-3 py-2 rounded-lg text-xs font-semibold transition-all flex items-center justify-between gap-1.5 ${scheduleFilter === 'all'
                ? 'bg-emerald-800 text-white shadow-xs'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
          >
            <span>Semua Jadwal</span>
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${scheduleFilter === 'all' ? 'bg-emerald-700 text-white' : 'bg-slate-100 text-slate-600'}`}>
              {catFiltered.length}
            </span>
          </button>
        </div>
      </div>

      {/* Filter & Search bar */}
      <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar flex-nowrap max-w-full">
          <button
            onClick={() => { setCatFilter('all'); setAvailPage(1) }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap flex items-center gap-1.5 shrink-0 ${catFilter === 'all'
                ? 'bg-emerald-800 text-white shadow-xs'
                : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
              }`}
          >
            <span>Semua Kategori</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${catFilter === 'all' ? 'bg-emerald-700 text-white' : 'bg-slate-100 text-slate-600'}`}>
              {filtered.length}
            </span>
          </button>

          {categories.length === 0 ? (
            <div className="flex items-center gap-1.5 animate-pulse">
              <div className="h-7 w-28 bg-slate-100 rounded-lg border border-slate-200"></div>
              <div className="h-7 w-24 bg-slate-100 rounded-lg border border-slate-200"></div>
              <div className="h-7 w-20 bg-slate-100 rounded-lg border border-slate-200"></div>
            </div>
          ) : (
            categories.map((cat) => {
              const count = categoryCounts[cat.id] ?? categoryCounts[cat.category_name] ?? 0
              const isActive = catFilter === cat.id || catFilter.toLowerCase() === cat.category_name.toLowerCase()
              return (
                <button
                  key={cat.id}
                  onClick={() => { setCatFilter(cat.id); setAvailPage(1) }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap flex items-center gap-1.5 shrink-0 ${isActive
                      ? 'bg-emerald-800 text-white shadow-xs'
                      : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
                    }`}
                >
                  <span>{cat.category_name}</span>
                  {count > 0 && (
                    <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${isActive ? 'bg-emerald-700 text-white' : 'bg-emerald-100 text-emerald-800'}`}>
                      {count}
                    </span>
                  )}
                </button>
              )
            })
          )}
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
                  <CatBadge cat={p.waste_categories?.category_name ?? 'Anorganik'} />
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
                    {getWibDateString(p.pickup_window_start) === todayStr ? (
                      <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md">
                        <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span> Hari Ini</span>
                      </span>
                    ) : getWibDateString(p.pickup_window_start) === tomorrowStr ? (
                      <span className="text-[10px] font-bold text-blue-800 bg-blue-100 px-2 py-0.5 rounded-md">
                        <span className="inline-flex items-center gap-1"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg> Besok</span>
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md">
                        <span className="inline-flex items-center gap-1"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg> {formatWIBDate(p.pickup_window_start)}</span>
                      </span>
                    )}
                    <span className="text-slate-600 font-medium">
                      <span className="inline-flex items-center gap-1"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg> {formatWIBTimeRange(p.pickup_window_start, p.pickup_window_end)}</span>
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

                {/* Tinjauan Foto Sampel & Status Validasi */}
                <div className="flex items-center gap-2.5 pt-2 border-t border-slate-100">
                  {p.sample_photo_url ? (
                    <div
                      onClick={(e) => {
                        e.stopPropagation()
                        setPhotoModal({
                          url: p.sample_photo_url!,
                          title: p.warung_profiles?.business_name ?? 'Warung',
                          category: p.waste_categories?.category_name ?? 'Anorganik',
                          weight: p.estimated_weight_kg,
                          notes: p.notes,
                          pickupId: p.id,
                        })
                      }}
                      className="group/thumb relative w-11 h-11 rounded-lg overflow-hidden border border-slate-200 bg-slate-900 shrink-0 cursor-pointer shadow-2xs hover:ring-2 hover:ring-emerald-500 transition-all"
                      title="Klik untuk meninjau foto sampel warung"
                    >
                      <img src={p.sample_photo_url} alt="Sampel" className="w-full h-full object-cover group-hover/thumb:scale-110 transition-transform" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/thumb:opacity-100 flex items-center justify-center transition-opacity">
                        <svg className="w-3.5 h-3.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                      </div>
                    </div>
                  ) : (
                    <div className="w-11 h-11 rounded-lg border border-dashed border-slate-200 bg-slate-50 flex flex-col items-center justify-center text-[8px] text-slate-400 shrink-0 font-medium">
                      <span>Tanpa</span>
                      <span>Foto</span>
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    {verifiedMap[p.id]?.categoryOk && verifiedMap[p.id]?.conditionOk ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                        <svg className="w-3 h-3 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                        Foto Terverifikasi Sesuai
                      </span>
                    ) : verifiedMap[p.id]?.isInvalid ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-800 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
                        <svg className="w-3 h-3 text-rose-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                        Ditandai Tidak Sesuai
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          setDetailPickup(p)
                          setView('pickup-detail')
                        }}
                        className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-900 hover:underline flex items-center gap-1"
                      >
                        <svg className="w-3 h-3 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                        Tinjau & Validasi Foto
                      </button>
                    )}
                    <p className="text-[10px] text-slate-400 truncate mt-0.5">
                      {p.sample_photo_url ? 'Klik thumbnail untuk perbesar' : 'Warung belum sertakan foto'}
                    </p>
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
                <p className="font-bold text-emerald-800 text-sm mt-0.5">{detailPickup.waste_categories?.category_name ?? 'Anorganik'}</p>
              </div>
            </div>
            <div>
              <span className="text-[11px] font-bold text-slate-400 uppercase">Jadwal Penjemputan</span>
              <p className="text-xs font-bold text-slate-800 mt-1">
                {formatWIBDate(detailPickup.pickup_window_start, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} ({formatWIBTimeRange(detailPickup.pickup_window_start, detailPickup.pickup_window_end)})
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

        {/* Panel Tinjauan Foto & Verifikasi Kelayakan Limbah */}
        <div className="ws-card p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <svg className="w-5 h-5 text-emerald-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                Tinjauan Foto & Verifikasi Kesesuaian Request
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Pastikan foto sampel limbah yang diunggah warung benar, sesuai kategori, dan tidak salah sebelum dijemput.
              </p>
            </div>
            {verifiedMap[detailPickup.id]?.categoryOk && verifiedMap[detailPickup.id]?.conditionOk && verifiedMap[detailPickup.id]?.weightOk ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-2xs">
                <svg className="w-3.5 h-3.5 text-emerald-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                Terverifikasi Valid & Benar
              </span>
            ) : verifiedMap[detailPickup.id]?.isInvalid ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300 shadow-2xs">
                <svg className="w-3.5 h-3.5 text-rose-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                Ditandai Tidak Sesuai
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                Perlu Ditinjau Kurir
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-start">
            {/* Image Preview Box */}
            <div className="space-y-2">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide block">Foto Sampel dari Warung:</span>
              {detailPickup.sample_photo_url ? (
                <div className="relative group rounded-xl overflow-hidden border border-slate-200 bg-slate-900 max-h-72 flex items-center justify-center shadow-xs">
                  <img
                    src={detailPickup.sample_photo_url}
                    alt={`Sampel ${detailPickup.warung_profiles?.business_name}`}
                    className="max-h-72 w-full object-contain cursor-pointer transition-transform group-hover:scale-102"
                    onClick={() => setPhotoModal({
                      url: detailPickup.sample_photo_url!,
                      title: detailPickup.warung_profiles?.business_name ?? 'Warung',
                      category: detailPickup.waste_categories?.category_name ?? 'Anorganik',
                      weight: detailPickup.estimated_weight_kg,
                      notes: detailPickup.notes,
                      pickupId: detailPickup.id,
                    })}
                  />
                  <button
                    type="button"
                    onClick={() => setPhotoModal({
                      url: detailPickup.sample_photo_url!,
                      title: detailPickup.warung_profiles?.business_name ?? 'Warung',
                      category: detailPickup.waste_categories?.category_name ?? 'Anorganik',
                      weight: detailPickup.estimated_weight_kg,
                      notes: detailPickup.notes,
                      pickupId: detailPickup.id,
                    })}
                    className="absolute bottom-3 right-3 bg-white/95 hover:bg-white text-slate-800 px-3 py-1.5 rounded-lg text-xs font-bold shadow-md flex items-center gap-1.5 transition-all"
                  >
                    <svg className="w-3.5 h-3.5 text-emerald-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
                    Perbesar Pratinjau
                  </button>
                </div>
              ) : (
                <div className="border border-dashed border-slate-200 rounded-xl p-8 text-center bg-slate-50 space-y-2">
                  <svg className="w-10 h-10 text-slate-300 mx-auto" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><line x1="21" y1="15" x2="16" y2="10"/><line x1="5" y1="21" x2="21" y2="5"/></svg>
                  <p className="text-xs font-semibold text-slate-600">Warung tidak mengunggah foto sampel</p>
                  <p className="text-[11px] text-slate-400">Harap ekstra teliti saat tiba di lokasi untuk memastikan limbah non-organik.</p>
                </div>
              )}
            </div>

            {/* Checklist Validation Box */}
            <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wide block">
                Lembar Verifikasi Kesesuaian Kurir
              </span>
              <p className="text-xs text-slate-600 leading-relaxed">
                Tandai checklist di bawah setelah meneliti foto sampel untuk memastikan order tidak keliru:
              </p>

              <div className="space-y-2.5 pt-1">
                {/* 1. Kategori Sesuai */}
                <label className="flex items-start gap-2.5 text-xs text-slate-700 cursor-pointer p-2 rounded-lg hover:bg-white border border-transparent hover:border-slate-200 transition-all">
                  <input
                    type="checkbox"
                    checked={verifiedMap[detailPickup.id]?.categoryOk ?? false}
                    onChange={() => toggleVerificationField(detailPickup.id, 'categoryOk')}
                    className="w-4 h-4 rounded text-emerald-700 accent-emerald-700 mt-0.5 cursor-pointer"
                  />
                  <div>
                    <strong className="block text-slate-800">1. Kategori Sesuai</strong>
                    <span className="text-[11px] text-slate-500">
                      Foto benar-benar menunjukkan <strong>{detailPickup.waste_categories?.category_name ?? 'Limbah Anorganik'}</strong>.
                    </span>
                  </div>
                </label>

                {/* 2. Kondisi Non-Organik Bersih */}
                <label className="flex items-start gap-2.5 text-xs text-slate-700 cursor-pointer p-2 rounded-lg hover:bg-white border border-transparent hover:border-slate-200 transition-all">
                  <input
                    type="checkbox"
                    checked={verifiedMap[detailPickup.id]?.conditionOk ?? false}
                    onChange={() => toggleVerificationField(detailPickup.id, 'conditionOk')}
                    className="w-4 h-4 rounded text-emerald-700 accent-emerald-700 mt-0.5 cursor-pointer"
                  />
                  <div>
                    <strong className="block text-slate-800">2. Kondisi Non-Organik Bersih</strong>
                    <span className="text-[11px] text-slate-500">
                      Tidak tercampur sisa makanan basi, kuah basah, atau sampah organik dapur.
                    </span>
                  </div>
                </label>

                {/* 3. Estimasi Muatan Masuk Akal */}
                <label className="flex items-start gap-2.5 text-xs text-slate-700 cursor-pointer p-2 rounded-lg hover:bg-white border border-transparent hover:border-slate-200 transition-all">
                  <input
                    type="checkbox"
                    checked={verifiedMap[detailPickup.id]?.weightOk ?? false}
                    onChange={() => toggleVerificationField(detailPickup.id, 'weightOk')}
                    className="w-4 h-4 rounded text-emerald-700 accent-emerald-700 mt-0.5 cursor-pointer"
                  />
                  <div>
                    <strong className="block text-slate-800">3. Estimasi Muatan Masuk Akal</strong>
                    <span className="text-[11px] text-slate-500">
                      Volume pada foto sepadan dengan estimasi timbangan <strong>{detailPickup.estimated_weight_kg} kg</strong>.
                    </span>
                  </div>
                </label>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex flex-col sm:flex-row gap-2">
                <button
                  type="button"
                  onClick={() => verifyAll(detailPickup.id)}
                  className="ws-btn-primary flex-1 justify-center text-xs py-2 bg-emerald-800 hover:bg-emerald-900"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                  Verifikasi Semua & Tandai Benar
                </button>
                <button
                  type="button"
                  onClick={() => markInvalid(detailPickup.id, 'Kategori tidak sesuai foto atau tercampur sampah organik')}
                  className="ws-btn-outline text-xs py-2 text-rose-700 border-rose-200 hover:bg-rose-50"
                >
                  Tandai Tidak Sesuai
                </button>
              </div>
            </div>
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
    if (!activeRoute) {
      return (
        <div className="max-w-md mx-auto space-y-4 text-center py-12">
          <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center mx-auto border border-emerald-200">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">Tidak Ada Rute Aktif</h2>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Saat ini Anda tidak memiliki rute penjemputan yang sedang berjalan. Muatan armada Anda bersih dan siap digunakan.
            </p>
          </div>
          <button
            className="ws-btn-primary mx-auto text-xs py-2.5 px-5 flex items-center gap-2"
            onClick={() => setView('available')}
          >
            <span>Pilih Jemputan di Available Pickups</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        </div>
      )
    }

    const route = activeRoute
    const stops = route.route_stops?.slice().sort((a, b) => a.sequence_number - b.sequence_number) ?? []

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

          <div className="space-y-2">
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center gap-2.5 text-xs text-amber-800">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-amber-600">
                <rect x="1" y="3" width="15" height="13" rx="1"/>
                <path d="M16 8h4l3 3v5h-7V8z"/>
                <circle cx="5.5" cy="18.5" r="2.5"/>
                <circle cx="18.5" cy="18.5" r="2.5"/>
              </svg>
              <span>Untuk mengosongkan muatan, tekan tombol <strong>Buang Muatan</strong> di halaman Available Pickups setelah sampah diturunkan di TPS / depot.</span>
            </div>
            <button className="ws-btn-primary w-full justify-center text-sm py-3" onClick={() => setView('available')}>
              Ke Available Pickups
            </button>
            <button className="ws-btn-outline w-full justify-center text-xs" onClick={() => setView('dashboard')}>
              Kembali ke Dashboard
            </button>
          </div>
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
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Rute Aktif (Nearest-Neighbor)</h1>
            <p className="text-xs sm:text-sm text-slate-500">Rekomendasi urutan penjemputan untuk efisiensi bahan bakar.</p>
          </div>
          {route && (
            <span className="text-xs font-bold text-emerald-800 bg-emerald-100 px-3 py-1.5 rounded-full whitespace-nowrap">
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
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-xs text-slate-400">
          <button
            onClick={() => setView('route-map')}
            className="flex items-center gap-1 hover:text-emerald-700 transition-colors font-medium"
          >
            {IC.chevronLeft} Peta Rute
          </button>
          <span>/</span>
          <span className="text-slate-700 font-semibold">Current Stop</span>
        </nav>

        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
            Current Stop: Verifikasi Timbangan
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {isStopAlreadyCompleted
              ? 'Stop ini sudah selesai diverifikasi sebelumnya.'
              : 'Timbang limbah anorganik langsung di lokasi warung dan ambil foto bukti timbangan.'}
          </p>
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

            {/* Foto Sampel Awal dari Warung sebagai Referensi */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-700 uppercase flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5 text-emerald-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                  Foto Sampel Awal dari Warung:
                </span>
                {p?.sample_photo_url && (
                  <button
                    type="button"
                    onClick={() => setPhotoModal({
                      url: p.sample_photo_url!,
                      title: p.warung_profiles?.business_name ?? 'Warung',
                      category: p.waste_categories?.category_name ?? 'Anorganik',
                      weight: p.estimated_weight_kg,
                      notes: p.notes,
                      pickupId: p.id,
                    })}
                    className="text-[10px] font-bold text-emerald-700 hover:underline"
                  >
                    Perbesar
                  </button>
                )}
              </div>

              {p?.sample_photo_url ? (
                <div className="flex items-center gap-3">
                  <img
                    src={p.sample_photo_url}
                    alt="Foto Sampel"
                    className="w-16 h-16 rounded-lg object-cover border border-slate-200 shrink-0 cursor-pointer hover:opacity-90 transition-opacity"
                    onClick={() => setPhotoModal({
                      url: p.sample_photo_url!,
                      title: p.warung_profiles?.business_name ?? 'Warung',
                      category: p.waste_categories?.category_name ?? 'Anorganik',
                      weight: p.estimated_weight_kg,
                      notes: p.notes,
                      pickupId: p.id,
                    })}
                  />
                  <div className="text-[11px] text-slate-500 space-y-0.5">
                    <p className="font-semibold text-slate-800">
                      Kategori: <span className="text-emerald-800">{p.waste_categories?.category_name ?? 'Anorganik'}</span>
                    </p>
                    <p className="leading-tight">
                      Bandingkan fisik limbah di lokasi dengan foto ini sebelum menginput berat timbangan.
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-[11px] text-slate-400 italic">Warung tidak mengunggah foto sampel saat pengajuan request.</p>
              )}
            </div>
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

                        <span>{loading ? 'Mengubah status...' : 'Mulai Menuju Lokasi Warung'}</span>
                      </button>
                    </div>

                    <div className="bg-slate-50 border border-dashed border-slate-200 rounded-xl p-5 text-center space-y-1.5">
                      <span className="flex items-center justify-center w-ful"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" /><path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" /><path d="M7 21h10" /><path d="M12 3v18" /><path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2" /></svg></span>
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
                      {/* Petunjuk kelengkapan form timbangan */}
                      {(!actualWeight || !proofUrl) && (
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 text-[11px] text-amber-800 space-y-1">
                          <p className="font-semibold flex items-center gap-1.5">
                            <svg className="w-4 h-4 text-amber-600 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                              <line x1="12" y1="9" x2="12" y2="13" />
                              <line x1="12" y1="17" x2="12.01" y2="17" />
                            </svg>
                            <span>Syarat untuk menyelesaikan penjemputan:</span>
                          </p>
                          <div className="flex flex-col gap-0.5 pl-3 text-[10px]">
                            <span className={actualWeight && Number(actualWeight) > 0 ? 'text-emerald-700 font-bold' : 'text-amber-700'}>
                              {actualWeight && Number(actualWeight) > 0 ? '✓' : '○'} Berat aktual: {actualWeight && Number(actualWeight) > 0 ? `${actualWeight} kg (Siap)` : 'Wajib diisi'}
                            </span>
                            <span className={proofUrl ? 'text-emerald-700 font-bold' : 'text-amber-700'}>
                              {proofUrl ? '✓' : '○'} Foto bukti timbangan: {proofUrl ? 'Foto sudah diunggah' : 'Wajib diunggah'}
                            </span>
                          </div>
                        </div>
                      )}

                      <button
                        type="button"
                        className="ws-btn-primary w-full justify-center text-xs py-2.5 font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-xs"
                        disabled={loading}
                        onClick={() => {
                          if (!p) return toast.error('Data pickup tidak ditemukan!')
                          submitComplete(p.id)
                        }}
                      >
                        {loading ? 'Menyimpan...' : 'Selesaikan Penjemputan Stop Ini'}
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

  const renderSettings = () => {
    // Hitung estimasi jendela waktu slot
    const startHour = parseInt(serviceStart.split(':')[0] || '7', 10)
    const endHour = parseInt(serviceEnd.split(':')[0] || '23', 10)
    const operatingHours = Math.max(1, endHour - startHour)
    const slotCount = Math.max(1, Math.floor(operatingHours / 2))
    const totalMaxDaily = slotCount * maxPerSlot

    // Payload bar percentage
    const maxCapacityScale = 2000
    const payloadPercent = Math.min(100, Math.round((capacity / maxCapacityScale) * 100))

    let payloadTierLabel = 'Muatan Ringan'
    let payloadTierColor = 'bg-emerald-500'
    if (capacity > 900) {
      payloadTierLabel = 'Muatan Tonase Komersial'
      payloadTierColor = 'bg-purple-600'
    } else if (capacity > 300) {
      payloadTierLabel = 'Muatan Berat'
      payloadTierColor = 'bg-blue-600'
    } else if (capacity > 80) {
      payloadTierLabel = 'Muatan Menengah'
      payloadTierColor = 'bg-teal-600'
    }

    const copyCoords = () => {
      if (colLat != null && colLng != null) {
        navigator.clipboard.writeText(`${colLat.toFixed(6)}, ${colLng.toFixed(6)}`)
        setCopiedCoords(true)
        toast.success('Koordinat GPS berhasil disalin ke papan klip! ✓')
        setTimeout(() => setCopiedCoords(false), 2200)
      } else {
        toast.warning('Koordinat pangkalan belum tersedia.')
      }
    }

    const gmapsUrl = (colLat != null && colLng != null)
      ? `https://www.google.com/maps?q=${colLat},${colLng}`
      : `https://www.google.com/maps?q=-7.4726,110.2198`

    return (
      <div className="max-w-5xl mx-auto space-y-4 sm:space-y-5 pb-16 px-1 sm:px-0">
        {/* ── 1. Page Title & Action Bar (Clean, Light, Professional) ── */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-2xs">
          <div>
            <h2 className="text-base sm:text-xl font-extrabold text-slate-900 flex items-center gap-2">
              <span className="p-1.5 sm:p-2 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200/60 shrink-0">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
              </span>
              Pengaturan Layanan
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Atur armada, pangkalan depot, dan jam operasional harian.
            </p>
          </div>

          <button
            type="button"
            onClick={saveAllSettings}
            disabled={savingAll}
            className="ws-btn-primary text-xs py-2.5 px-4 shadow-2xs flex items-center justify-center gap-1.5 w-full sm:w-auto"
          >
            {savingAll ? (
              <>
                <svg className="animate-spin h-3.5 w-3.5 text-white" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg>
                <span>Menyimpan...</span>
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                <span>Simpan Semua</span>
              </>
            )}
          </button>
        </div>

        {/* ── 2. Metric Summary Cards (Light, Clean) ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 text-xs">
          <div className="bg-white rounded-xl p-3 sm:p-3.5 border border-slate-200/80 shadow-2xs">
            <div className="flex items-center gap-1.5 text-[11px] text-emerald-800 font-semibold">
              <svg className="w-3.5 h-3.5 text-emerald-600 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
              <span>Armada Aktif</span>
            </div>
            <div className="text-slate-900 font-bold text-xs sm:text-sm mt-1 truncate">{vehicleType}</div>
            <div className="text-slate-500 text-[11px] mt-0.5">Maks. <strong className="text-emerald-800">{capacity} kg</strong></div>
          </div>

          <div className="bg-white rounded-xl p-3 sm:p-3.5 border border-slate-200/80 shadow-2xs">
            <div className="flex items-center gap-1.5 text-[11px] text-teal-800 font-semibold">
              <svg className="w-3.5 h-3.5 text-teal-600 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
              <span>Pangkalan Depot</span>
            </div>
            <div className="text-slate-900 font-bold text-xs sm:text-sm mt-1 truncate">{serviceArea || 'Depot Magelang'}</div>
            <div className="text-slate-500 text-[11px] mt-0.5"><strong className="text-teal-700">{available.length}</strong> Warung di area</div>
          </div>

          <div className="bg-white rounded-xl p-3 sm:p-3.5 border border-slate-200/80 shadow-2xs">
            <div className="flex items-center gap-1.5 text-[11px] text-amber-800 font-semibold">
              <svg className="w-3.5 h-3.5 text-amber-600 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              <span>Jam Layanan</span>
            </div>
            <div className="text-slate-900 font-bold text-xs sm:text-sm mt-1 truncate">{serviceStart} – {serviceEnd} WIB</div>
            <div className="text-slate-500 text-[11px] mt-0.5">{operatingHours} Jam / Hari</div>
          </div>

          <div className="bg-white rounded-xl p-3 sm:p-3.5 border border-slate-200/80 shadow-2xs">
            <div className="flex items-center gap-1.5 text-[11px] text-indigo-800 font-semibold">
              <svg className="w-3.5 h-3.5 text-indigo-600 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
              <span>Kapasitas Slot</span>
            </div>
            <div className="text-slate-900 font-bold text-xs sm:text-sm mt-1 truncate">Maks. {maxPerSlot} Pickup</div>
            <div className="text-slate-500 text-[11px] mt-0.5">Daya: ~{totalMaxDaily} warung/hari</div>
          </div>
        </div>

        {/* ── 3. Tab Navigation — mobile-friendly stack with icon + label ── */}
        <div className="flex items-center gap-1 p-1 sm:p-1.5 bg-slate-100 rounded-xl border border-slate-200/80">
          {([
            { key: 'all', label: 'Semua', icon: <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg> },
            { key: 'vehicle', label: 'Armada', icon: <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg> },
            { key: 'location', label: 'Pangkalan', icon: <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg> },
            { key: 'schedule', label: 'Jadwal', icon: <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> },
          ] as const).map(tab => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setSettingsTab(tab.key)}
              title={tab.label}
              className={`flex-1 py-1.5 sm:py-2 px-1 sm:px-3 rounded-lg text-[11px] sm:text-xs font-bold transition-all flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 ${
                settingsTab === tab.key
                  ? 'bg-white text-emerald-900 shadow-xs border border-emerald-200/60'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              {tab.icon}
              <span className="whitespace-nowrap">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* ── 4. Section 1: Armada Kendaraan & Kapasitas Angkut ── */}
        {(settingsTab === 'all' || settingsTab === 'vehicle') && (
          <div className="ws-card p-4 sm:p-6 space-y-5 sm:space-y-6 border border-emerald-100 shadow-xs">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-emerald-100 text-emerald-800 shrink-0">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
                  </span>
                  Armada Kendaraan & Daya Angkut Muatan
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Pilih tipe armada. Kapasitas ini menjadi parameter utama perhitungan rute.
                </p>
              </div>
              <button
                type="button"
                onClick={() => saveVehicle()}
                disabled={savingVehicle}
                className="ws-btn-primary text-xs py-2 px-3.5 w-full sm:w-auto justify-center shrink-0 flex items-center gap-1.5"
              >
                {savingVehicle ? 'Menyimpan...' : 'Simpan Armada'}
              </button>
            </div>

            {/* Vehicle Options Grid */}
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-2.5">
                Pilih Tipe Kendaraan Operasional:
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {VEHICLE_OPTIONS.map((opt) => {
                  const isSelected = vehicleType.toLowerCase().includes(opt.type.toLowerCase()) || opt.type.toLowerCase().includes(vehicleType.toLowerCase())
                  return (
                    <div
                      key={opt.type}
                      onClick={() => {
                        setVehicleType(opt.type)
                        if (capacity <= 0 || Math.abs(capacity - opt.defaultCap) > 100) {
                          setCapacity(opt.defaultCap)
                        }
                      }}
                      className={`cursor-pointer rounded-xl p-3.5 sm:p-4 border transition-all text-left relative group ${
                        isSelected
                          ? 'border-emerald-600 bg-emerald-50/70 shadow-xs ring-2 ring-emerald-500/30'
                          : 'border-slate-200 bg-white hover:border-emerald-300 hover:bg-slate-50/60'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2.5 sm:gap-3">
                        <div className="flex items-start gap-2.5 sm:gap-3 min-w-0">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                            isSelected ? 'bg-emerald-700 text-white shadow-xs' : 'bg-slate-100 text-slate-600 group-hover:bg-emerald-100 group-hover:text-emerald-800'
                          }`}>
                            {opt.type.includes('Dua') ? (
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="18.5" cy="17.5" r="3.5"/><path d="M15 6h-3l-2.5 4.5h4"/><path d="M9 17.5l2-6 4-2"/><path d="M12 9.5l4 8"/></svg>
                            ) : opt.type.includes('Tiga') ? (
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="5" cy="17" r="3"/><circle cx="19" cy="17" r="3"/><path d="M8 17h8"/><path d="M10 7h8v7H10z"/><path d="M4 14l3-7h3"/></svg>
                            ) : opt.type.includes('Pick-up') ? (
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 13V7a1 1 0 0 1 1-1h10v7"/><path d="M14 8h4l3 3.5V13"/><rect x="2" y="11" width="19" height="4" rx="1"/><circle cx="6.5" cy="16.5" r="2.5"/><circle cx="17.5" cy="16.5" r="2.5"/></svg>
                            ) : (
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="4" width="15" height="11" rx="1"/><path d="M16 8h4l3 3v4h-7V8z"/><circle cx="5.5" cy="17.5" r="2.5"/><circle cx="18.5" cy="17.5" r="2.5"/></svg>
                            )}
                          </div>
                          <div className="min-w-0">
                            <h4 className="font-extrabold text-xs sm:text-sm text-slate-900 leading-tight">{opt.title}</h4>
                            <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">{opt.subtitle}</p>
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            opt.isPopular
                              ? 'bg-amber-100 text-amber-900 border border-amber-300'
                              : 'bg-slate-100 text-slate-600'
                          }`}>
                            {opt.badge}
                          </span>
                          {isSelected && (
                            <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px] shadow-xs">
                              ✓
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="mt-3 pt-2.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-1 text-[11px] text-slate-600">
                        <span>Standar Kapasitas: <strong className="text-emerald-900 font-bold">{opt.defaultCap} kg</strong></span>
                        <span className="text-[10px] text-slate-400">Rentang: {opt.minCap}–{opt.maxCap} kg</span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1 italic">
                        {opt.recommendation}
                      </p>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Custom Capacity Controller & Visual Bar */}
            <div className="bg-slate-50 rounded-xl p-3.5 sm:p-5 border border-slate-200/80 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <label className="text-xs sm:text-sm font-bold text-slate-800 block">
                    Batas Kapasitas Muatan Maksimal (kg)
                  </label>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Tentukan kapasitas aman kendaraan Anda dalam satuan kilogram.
                  </p>
                </div>

                {/* Number Input with Stepper - Unified Mobile Pill */}
                <div className="flex items-center justify-between sm:justify-start gap-2 bg-white sm:bg-transparent p-1.5 sm:p-0 rounded-xl border sm:border-0 border-slate-200 shadow-2xs sm:shadow-none w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => setCapacity(prev => Math.max(10, prev - 25))}
                    className="w-10 h-10 sm:w-8 sm:h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-lg flex items-center justify-center shadow-2xs active:scale-95 shrink-0"
                    title="Kurangi 25 kg"
                  >
                    −
                  </button>
                  <div className="flex items-center justify-center flex-1 sm:flex-initial">
                    <input
                      type="number"
                      min={10}
                      max={5000}
                      step={5}
                      value={capacity}
                      onChange={(e) => setCapacity(Math.max(0, Number(e.target.value) || 0))}
                      className="w-20 sm:w-24 text-center font-mono font-black text-lg sm:text-sm py-1 sm:py-2 px-1 bg-transparent sm:bg-white sm:border sm:border-slate-300 rounded-lg text-emerald-950 focus:border-emerald-600 outline-hidden"
                    />
                    <span className="text-xs font-bold text-slate-400 pointer-events-none -ml-1 sm:ml-1">kg</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCapacity(prev => prev + 25)}
                    className="w-10 h-10 sm:w-8 sm:h-8 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-lg flex items-center justify-center shadow-2xs active:scale-95 shrink-0"
                    title="Tambah 25 kg"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Quick Preset Buttons */}
              <div className="space-y-1.5 pt-1">
                <span className="text-[11px] font-bold text-slate-600 block">Preset Cepat:</span>
                <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5">
                  {[50, 100, 150, 300, 600, 1000, 1500].map((kg) => (
                    <button
                      key={kg}
                      type="button"
                      onClick={() => setCapacity(kg)}
                      className={`text-xs py-2 px-1 text-center rounded-lg border font-mono font-bold transition-all ${
                        capacity === kg
                          ? 'bg-emerald-800 text-white border-emerald-800 shadow-2xs ring-2 ring-emerald-500/30'
                          : 'bg-white text-slate-700 border-slate-200 hover:border-emerald-400 hover:bg-slate-50'
                      }`}
                    >
                      {kg} kg
                    </button>
                  ))}
                </div>
              </div>

              {/* Visual Payload Meter */}
              <div className="space-y-1.5 pt-2 border-t border-slate-200/60">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-600 font-medium">Klasifikasi Muatan:</span>
                  <span className="font-bold text-slate-800 flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${payloadTierColor}`} />
                    {payloadTierLabel} ({capacity} kg)
                  </span>
                </div>
                <div className="h-2.5 w-full bg-slate-200 rounded-full overflow-hidden p-0.5">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${payloadTierColor}`}
                    style={{ width: `${Math.max(5, Math.min(100, payloadPercent))}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                  <span>0 kg</span>
                  <span>500 kg</span>
                  <span>1.000 kg</span>
                  <span>2.000 kg</span>
                </div>
              </div>

              {/* Informative Safety Callout */}
              <div className="bg-emerald-50 border border-emerald-200/80 rounded-lg p-3 text-xs text-emerald-900 flex items-start gap-2.5">
                <span className="text-emerald-700 mt-0.5 shrink-0">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                </span>
                <p className="text-[11px] leading-relaxed">
                  <strong>Pemberitahuan Algoritma:</strong> Sistem rekomendasi rute (TSP Routing) menjumlahkan perkiraan berat sampah dari seluruh warung terpilih dan otomatis membatasi rute harian agar tidak melampaui <strong>{capacity} kg</strong> demi keselamatan berkendara.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── 5. Section 2: Titik Pangkalan & Jangkauan Operasional ── */}
        {(settingsTab === 'all' || settingsTab === 'location') && (
          <div className="ws-card p-4 sm:p-6 space-y-5 sm:space-y-6 border border-emerald-100 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-teal-100 text-teal-800">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
                  </span>
                  Lokasi Pangkalan & Titik Pusat Operasional
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Titik depot pangkalan kurir menjadi titik awal (Start Hub) dan titik akhir saat sistem mengoptimalkan urutan kunjungan ke warung.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 self-stretch sm:self-auto shrink-0 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={useMyLocation}
                  disabled={locating}
                  className="ws-btn-outline text-emerald-800 border-emerald-300 hover:bg-emerald-50 text-xs flex items-center justify-center gap-1.5 py-2.5 px-3 w-full sm:w-auto"
                  title="Gunakan koordinat GPS perangkat saat ini"
                >
                  <svg className={`w-3.5 h-3.5 ${locating ? 'animate-spin' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg>
                  {locating ? 'Mencari GPS...' : 'Deteksi GPS Saya'}
                </button>
                <button
                  type="button"
                  onClick={() => saveLocation()}
                  disabled={savingLocation}
                  className="ws-btn-primary text-xs py-2.5 px-3.5 flex items-center justify-center gap-1.5 w-full sm:w-auto"
                >
                  {savingLocation ? 'Menyimpan...' : 'Simpan Pangkalan'}
                </button>
              </div>
            </div>

            {/* Active Location Showcase Card */}
            <div className="bg-emerald-50/60 border border-emerald-200/90 rounded-xl p-3.5 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-3.5">
              <div className="flex items-start gap-3 min-w-0">
                <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-emerald-800 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-extrabold text-emerald-950 text-sm sm:text-base truncate">{serviceArea || 'Belum Diberi Nama'}</span>
                    <span className="bg-emerald-200/80 text-emerald-900 text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-emerald-300 shrink-0">
                      Pusat Rute Aktif
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="text-emerald-800 text-[11px] sm:text-xs font-mono font-medium">
                      Lat: {colLat != null ? colLat.toFixed(6) : '-'} • Lng: {colLng != null ? colLng.toFixed(6) : '-'}
                    </span>
                    <button
                      type="button"
                      onClick={copyCoords}
                      className="text-[11px] text-emerald-700 hover:text-emerald-900 underline font-medium cursor-pointer"
                      title="Salin koordinat"
                    >
                      {copiedCoords ? '✓ Tersalin' : 'Salin'}
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full md:w-auto">
                <a
                  href={gmapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ws-btn-outline bg-white text-slate-700 border-slate-200 hover:bg-slate-50 text-xs py-2 px-3 flex items-center justify-center gap-1.5 w-full sm:w-auto"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                  Buka di Google Maps
                </a>
                <div className="text-xs text-emerald-950 font-semibold bg-white py-2 px-3 rounded-lg border border-emerald-200/80 shadow-2xs text-center w-full sm:w-auto">
                  Jemputan Terjangkau: <strong className="text-emerald-800">{available.length} Warung</strong>
                </div>
              </div>
            </div>

            {/* Pilihan Cepat (Preset Wilayah Populer) */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold text-slate-700">
                  Pilihan Cepat Wilayah / Depot Populer (Klik untuk terapkan & simpan):
                </label>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
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
                      className={`text-xs px-2.5 sm:px-3 py-2 rounded-xl border font-medium transition-all flex items-center justify-between gap-1 text-left ${
                        isSelected
                          ? 'bg-emerald-800 text-white border-emerald-800 shadow-xs ring-2 ring-emerald-400'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-emerald-50/50 hover:border-emerald-300'
                      }`}
                    >
                      <div className="truncate flex items-center gap-1.5">
                        <svg className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-white' : 'text-emerald-700'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
                        <span className="font-semibold truncate">{preset.name}</span>
                      </div>
                      {isSelected && <span className="text-[10px] font-bold shrink-0">✓</span>}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Manual Coordinate Form */}
            <div className="border-t border-slate-100 pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-slate-800">Atur Koordinat & Nama Depot Kustom:</span>
                <span className="text-[11px] text-slate-400 font-mono">Format Desimal (WGS84)</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 block mb-1">Nama Wilayah / Depot</label>
                  <input
                    type="text"
                    placeholder="Contoh: Depot Pusat Magelang"
                    value={serviceArea}
                    onChange={(e) => setServiceArea(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs outline-hidden focus:border-emerald-500 shadow-2xs"
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
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-mono outline-hidden focus:border-emerald-500 shadow-2xs"
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
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-mono outline-hidden focus:border-emerald-500 shadow-2xs"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── 6. Section 3: Pengaturan Jadwal Layanan & Slot Waktu ── */}
        {(settingsTab === 'all' || settingsTab === 'schedule') && (
          <div className="ws-card p-4 sm:p-6 space-y-5 sm:space-y-6 border border-emerald-100 shadow-xs">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-amber-100 text-amber-800 shrink-0">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                  </span>
                  Pengaturan Jam Operasional & Manajemen Slot
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Atur jam kerja harian dan kuota penjemputan per slot waktu.
                </p>
              </div>

              <button
                type="button"
                onClick={saveSchedule}
                disabled={savingScheduleState}
                className="ws-btn-primary text-xs py-2 px-3.5 w-full sm:w-auto justify-center shrink-0 flex items-center gap-1.5"
              >
                {savingScheduleState ? 'Menyimpan...' : 'Simpan Jadwal'}
              </button>
            </div>

            {/* Schedule: 1-col on mobile, 3-col on md+ */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
              {/* Jam Mulai */}
              <div className="bg-slate-50/80 rounded-xl p-3.5 sm:p-4 border border-slate-200/80 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700">Jam Mulai Layanan</label>
                  <span className="text-[10px] font-mono text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded">WIB</span>
                </div>
                <input
                  type="time"
                  value={serviceStart}
                  onChange={(e) => setServiceStart(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold outline-hidden focus:border-emerald-500 shadow-2xs"
                />
                <p className="text-[11px] text-slate-400">Kurir mulai beroperasi dan menerima penjemputan awal.</p>
              </div>

              {/* Jam Selesai */}
              <div className="bg-slate-50/80 rounded-xl p-3.5 sm:p-4 border border-slate-200/80 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700">Jam Selesai Layanan</label>
                  <span className="text-[10px] font-mono text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded">WIB</span>
                </div>
                <input
                  type="time"
                  value={serviceEnd}
                  onChange={(e) => setServiceEnd(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold outline-hidden focus:border-emerald-500 shadow-2xs"
                />
                <p className="text-[11px] text-slate-400">Batas akhir slot penjemputan warung pada hari tersebut.</p>
              </div>

              {/* Kuota Pickup per Slot */}
              <div className="bg-slate-50/80 rounded-xl p-3.5 sm:p-4 border border-slate-200/80 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700">Maks. Pickup per Slot</label>
                  <span className="text-[10px] font-bold text-slate-500">2 Jam / Slot</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setMaxPerSlot(prev => Math.max(1, prev - 1))}
                    className="w-9 h-9 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold text-base flex items-center justify-center shadow-2xs active:scale-95"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min={1}
                    max={30}
                    value={maxPerSlot}
                    onChange={(e) => setMaxPerSlot(Math.max(1, Number(e.target.value) || 1))}
                    className="w-full text-center rounded-lg border border-slate-300 bg-white py-2 text-sm font-extrabold text-emerald-950 focus:border-emerald-500 outline-hidden shadow-2xs"
                  />
                  <button
                    type="button"
                    onClick={() => setMaxPerSlot(prev => prev + 1)}
                    className="w-9 h-9 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold text-base flex items-center justify-center shadow-2xs active:scale-95"
                  >
                    +
                  </button>
                </div>
                <div className="grid grid-cols-4 gap-1.5 pt-1">
                  {[3, 5, 8, 10].map(v => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setMaxPerSlot(v)}
                      className={`text-[11px] py-1.5 rounded-lg font-bold border transition-colors text-center ${
                        maxPerSlot === v
                          ? 'bg-emerald-700 text-white border-emerald-700'
                          : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      {v} slot
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Visual Timeline & Warung Simulation (Light & Clean) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              {/* Timeline Info */}
              <div className="bg-emerald-50/60 border border-emerald-200/80 rounded-xl p-4 space-y-3">
                <div className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                  <svg className="w-4 h-4 text-emerald-700 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                  <span>Kalkulasi Operasional Harian:</span>
                </div>
                <div className="space-y-1.5 text-xs text-emerald-900">
                  <div className="flex justify-between">
                    <span>Durasi Layanan Aktif:</span>
                    <strong className="font-mono">{operatingHours} Jam / Hari</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Jumlah Slot Waktu (per 2 jam):</span>
                    <strong className="font-mono">{slotCount} Slot Terbuka</strong>
                  </div>
                  <div className="flex justify-between border-t border-emerald-200/60 pt-1.5 text-emerald-950 font-bold">
                    <span>Estimasi Maks. Permohonan Terlayani:</span>
                    <strong className="font-mono text-emerald-800">{totalMaxDaily} Warung / Hari</strong>
                  </div>
                </div>
                <p className="text-[11px] text-emerald-800/80 leading-relaxed italic">
                  Slot waktu di warung akan otomatis diberi label &#34;Penuh&#34; jika sudah ada {maxPerSlot} warung yang memilih slot tersebut.
                </p>
              </div>

              {/* Simulation of Warung View (Light Card) */}
              <div className="bg-white rounded-xl p-4 border border-slate-200/90 shadow-2xs space-y-3">
                <div className="flex items-center justify-between text-xs border-b border-slate-100 pb-2">
                  <span className="font-bold text-slate-800 flex items-center gap-1.5">
                    <svg className="w-4 h-4 text-emerald-700 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
                    <span>Simulasi Tampilan di Sisi Warung</span>
                  </span>
                  <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    Pratinjau Live
                  </span>
                </div>

                <div className="bg-emerald-50/70 rounded-lg p-3 border border-emerald-200/80 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-emerald-950 flex items-center gap-1.5">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                      {serviceStart} – {String(Math.min(23, startHour + 2)).padStart(2, '0')}:00 WIB
                    </span>
                    <span className="bg-emerald-200/80 text-emerald-900 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-300">
                      Tersedia ({maxPerSlot} Kuota)
                    </span>
                  </div>
                  <p className="text-[11px] text-emerald-800">
                    Sopir pengangkut beroperasi dari pangkalan {serviceArea || 'Magelang'}.
                  </p>
                </div>

                <p className="text-[11px] text-slate-500">
                  Warung hanya dapat memilih jadwal penjemputan di dalam batas {serviceStart} hingga {serviceEnd} WIB.
                </p>
              </div>
            </div>
          </div>
        )}

        
      </div>
    )
  }

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

      {/* Lightbox Modal Pratinjau Foto Sampel */}
      {photoModal && (
        <PhotoPreviewModal
          photo={photoModal}
          isVerified={Boolean(photoModal.pickupId && verifiedMap[photoModal.pickupId]?.categoryOk && verifiedMap[photoModal.pickupId]?.conditionOk && verifiedMap[photoModal.pickupId]?.weightOk)}
          onVerify={photoModal.pickupId ? () => verifyAll(photoModal.pickupId!) : undefined}
          onClose={() => setPhotoModal(null)}
        />
      )}
      {/* Modal Konfirmasi Kosongkan Muatan */}
      {unloadConfirmOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-5 animate-in fade-in duration-150">
          <div className="bg-white w-full sm:max-w-sm sm:rounded-2xl rounded-t-2xl shadow-2xl border border-slate-100 overflow-hidden">
            {/* Header */}
            <div className="p-5 border-b border-slate-100 flex items-center gap-3">
              <span className="w-10 h-10 rounded-full bg-amber-100 border border-amber-300 flex items-center justify-center text-amber-700 shrink-0">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="1" y="3" width="15" height="13" rx="1"/>
                  <path d="M16 8h4l3 3v5h-7V8z"/>
                  <circle cx="5.5" cy="18.5" r="2.5"/>
                  <circle cx="18.5" cy="18.5" r="2.5"/>
                </svg>
              </span>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Kosongkan Muatan Kendaraan?</h3>
                <p className="text-xs text-slate-500 mt-0.5">Pastikan sampah sudah diturunkan di TPS / depot</p>
              </div>
            </div>

            {/* Body */}
            <div className="p-5 space-y-3">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center justify-between">
                <span className="text-xs text-amber-800 font-medium">Total muatan saat ini</span>
                <span className="text-sm font-black text-amber-900">{activeWeight.toFixed(1)} kg</span>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Setelah dikonfirmasi, muatan kendaraan akan direset ke <strong>0 kg</strong> dan kapasitas tersedia kembali penuh. Aksi ini tidak bisa dibatalkan.
              </p>
            </div>

            {/* Footer */}
            <div className="p-4 pt-0 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setUnloadConfirmOpen(false)}
                className="py-3 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={async () => {
                  setUnloadConfirmOpen(false)
                  await emptyVehicleLoad()
                }}
                className="py-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-sm font-bold transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" strokeOpacity=".25"/><path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round"/></svg>
                    Mengosongkan...
                  </>
                ) : (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                    Ya, Kosongkan
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  )
}
