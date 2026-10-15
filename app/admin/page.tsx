"use client"

/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useRealtimeTables } from '@/lib/hooks/useRealtimeTables'
import AppShell from '@/components/AppShell'
import { LineChart, DonutChart } from '@/components/Charts'
import { AppNotification, SearchItem } from '@/lib/types/notifications'
import { apiGetMe, apiLogout, AuthUser } from '@/lib/api/auth'
import {
  apiGetAdminStats,
  apiGetAdminPickups,
  apiGetAdminUsers,
  apiUpdateAdminUser,
  apiGetAuditLogs,
  apiGetCategories,
  apiCreateCategory,
  apiUpdateCategory,
  apiDeleteCategory,
  apiGetAdminRoutes,
  apiCancelAdminPickup,
  apiApproveAdminPickup,
  apiRejectAdminPickup,
  apiGetAdminCategoryStats,
} from '@/lib/api/admin'
import {
  parseCategoryGuideline,
  serializeCategoryGuideline,
} from '@/lib/guidelines'
import {
  formatWIBDate,
  formatWIBDateTime,
} from '@/lib/datetime'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Stats {
  total_waste_collected_kg: number
  total_waste_collected_ton: number
  total_completed_pickups: number
  active_warung_count: number
  collector_count: number
  status_breakdown: Record<string, number>
  estimated_carbon_offset_kg_co2e: number
}

interface Pickup {
  id: string
  status: string
  estimated_weight_kg: number
  actual_weight_kg: number | null
  created_at: string
  pickup_window_start?: string
  pickup_window_end?: string
  notes?: string | null
  sample_photo_url?: string | null
  latitude?: number | null
  longitude?: number | null
  warung_profiles?: { business_name: string; address?: string } | null
  collector_profiles?: { vehicle_type: string } | null
  waste_categories?: { category_name: string; is_maggot_friendly?: boolean } | null
}

interface UserRow {
  id: string
  name: string
  email: string
  role: string
  phone_number: string | null
  is_deleted?: boolean
  created_at: string
}

interface CategoryRow {
  id: string
  category_name: string
  description: string | null
  is_maggot_friendly: boolean
}

interface CategoryStat {
  category_name: string
  is_maggot_friendly: boolean
  total_pickups: number
  completed_pickups: number
  total_kg: number
}

interface RouteStopRow {
  id: string
  sequence_number: number
  status: string
  pickup_requests?: {
    id: string
    status: string
    estimated_weight_kg: number
    actual_weight_kg: number | null
    warung_profiles?: { business_name: string } | null
  } | null
}

interface RouteRow {
  id: string
  status: string
  total_distance_km: number
  total_weight_kg: number
  created_at: string
  completed_at: string | null
  collector_profiles?: { vehicle_type: string; vehicle_capacity_kg: number } | null
  route_stops?: RouteStopRow[]
}

interface AuditRow {
  id: string
  action: string
  resource_type: string
  resource_id: string | null
  metadata: unknown
  created_at: string
  users?: { name: string; email: string } | null
}

type AdminView = 'overview' | 'management' | 'audit' | 'profile'
type MgmtTab = 'pickups' | 'users' | 'categories' | 'routes'

// ─── Photo Lightbox Component ───────────────────────────────────────────────
function PhotoLightbox({ url, onClose }: { url: string; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[9999] bg-black/90 flex items-center justify-center p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <button
        className="absolute top-4 right-4 text-white/70 hover:text-white bg-white/10 rounded-full p-2 transition-colors"
        onClick={onClose}
        aria-label="Tutup"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
      <img
        src={url}
        alt="Foto Pickup"
        className="max-h-[85vh] max-w-full rounded-xl shadow-2xl object-contain"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  )
}

// ─── Pickup Detail Modal ─────────────────────────────────────────────────────
function PickupDetailModal({
  pickup,
  onClose,
  onApprove,
  onReject,
  onCancel,
}: {
  pickup: Pickup
  onClose: () => void
  onApprove?: (id: string) => void
  onReject?: (id: string) => void
  onCancel?: (id: string) => void
}) {
  const [lightbox, setLightbox] = useState<string | null>(null)

  function StatusBadgeLocal({ status }: { status: string }) {
    const s = status.toLowerCase()
    if (s === 'completed' || s === 'success') return <span className="ws-badge-completed">COMPLETED</span>
    if (s === 'in_progress' || s === 'assigned') return <span className="ws-badge-in-progress">{s === 'in_progress' ? 'IN PROGRESS' : 'ASSIGNED'}</span>
    if (s === 'pending') return <span className="ws-badge-pending">PENDING</span>
    if (s === 'critical' || s === 'failed' || s === 'cancelled') return <span className="ws-badge-critical">{s.toUpperCase()}</span>
    if (s === 'awaiting_approval') return <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-violet-100 text-violet-800">MENUNGGU APPROVAL</span>
    return <span className="ws-badge-pending">{status.toUpperCase()}</span>
  }

  return (
    <>
      {lightbox && <PhotoLightbox url={lightbox} onClose={() => setLightbox(null)} />}
      <div
        className="fixed inset-0 z-[998] bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150"
        onClick={onClose}
      >
        <div
          className="bg-white w-full max-w-lg rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-150 max-h-[90vh]"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0 bg-emerald-50">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Detail Pickup #{pickup.id.slice(-6).toUpperCase()}</h3>
              <div className="mt-1"><StatusBadgeLocal status={pickup.status} /></div>
            </div>
            <button onClick={onClose} className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {/* Photo */}
            {pickup.sample_photo_url ? (
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-2">Foto Sampel Limbah dari Warung</p>
                <div
                  className="relative w-full h-52 rounded-xl overflow-hidden cursor-pointer group border border-slate-200"
                  onClick={() => setLightbox(pickup.sample_photo_url!)}
                >
                  <img src={pickup.sample_photo_url} alt="Foto Pickup" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                    <span className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 text-slate-800 text-xs font-bold px-3 py-1.5 rounded-full">
                      🔍 Perbesar Foto
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200">
                <svg className="w-5 h-5 text-amber-600 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
                <p className="text-xs text-amber-800 font-medium">Warung belum menyertakan foto sampel limbah.</p>
              </div>
            )}

            {/* Info Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Warung</p>
                <p className="text-xs font-bold text-slate-900 mt-0.5">{pickup.warung_profiles?.business_name ?? '–'}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">{pickup.warung_profiles?.address ?? '–'}</p>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Kategori Limbah</p>
                <p className="text-xs font-bold text-slate-900 mt-0.5">{pickup.waste_categories?.category_name ?? '–'}</p>
                {pickup.waste_categories?.is_maggot_friendly !== undefined && (
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md mt-1 inline-block ${
                    pickup.waste_categories.is_maggot_friendly
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}>
                    {pickup.waste_categories.is_maggot_friendly ? 'DAUR ULANG' : 'B3/KHUSUS'}
                  </span>
                )}
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Estimasi Berat</p>
                <p className="text-lg font-extrabold text-emerald-700">{pickup.estimated_weight_kg} kg</p>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Berat Aktual</p>
                <p className="text-lg font-extrabold text-slate-900">{pickup.actual_weight_kg ? `${pickup.actual_weight_kg} kg` : '–'}</p>
              </div>
              {pickup.pickup_window_start && (
                <div className="col-span-2 p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Jadwal Pickup</p>
                  <p className="text-xs text-slate-700 mt-0.5">
                    {new Date(pickup.pickup_window_start).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}
                    {pickup.pickup_window_end && ` – ${new Date(pickup.pickup_window_end).toLocaleString('id-ID', { timeStyle: 'short' })}`}
                  </p>
                </div>
              )}
              {pickup.notes && (
                <div className="col-span-2 p-3 bg-blue-50 rounded-xl border border-blue-100">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-blue-500">Catatan dari Warung</p>
                  <p className="text-xs text-blue-900 mt-0.5">{pickup.notes}</p>
                </div>
              )}
            </div>
          </div>

          {/* Actions Footer */}
          <div className="flex items-center justify-between gap-2 px-5 py-3 border-t border-slate-100 bg-slate-50/70 shrink-0 flex-wrap">
            <button onClick={onClose} className="ws-btn-outline text-xs">Tutup</button>
            <div className="flex items-center gap-2">
              {pickup.status === 'pending' && onCancel && (
                <button
                  onClick={() => { onCancel(pickup.id); onClose() }}
                  className="ws-btn-outline text-rose-600 border-rose-200 hover:bg-rose-50 text-xs"
                >
                  Batalkan Pickup
                </button>
              )}
              {pickup.status === 'awaiting_approval' && onReject && (
                <button
                  onClick={() => { onReject(pickup.id); onClose() }}
                  className="ws-btn-outline text-rose-600 border-rose-200 hover:bg-rose-50 text-xs"
                >
                  Tolak
                </button>
              )}
              {pickup.status === 'awaiting_approval' && onApprove && (
                <button
                  onClick={() => { onApprove(pickup.id); onClose() }}
                  className="ws-btn-primary text-xs bg-emerald-700 hover:bg-emerald-800"
                >
                  ✓ Setujui Pickup
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

// ─── Icons ────────────────────────────────────────────────────────────────────

const IC = {
  box: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>,
  truck: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>,
  users: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  checkCircle: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>,
  download: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="8 17 12 21 16 17"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.88 18.09A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.29"/></svg>,
  refresh: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>,
  search: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  shield: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  alert: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  clock: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  activity: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,
  plus: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  edit: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>,
  trash: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>,
  tag: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.83z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>,
  map: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg>,
  power: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"/><line x1="12" y1="2" x2="12" y2="12"/></svg>,
}

function StatusBadge({ status }: { status: string }) {
  const s = status.toLowerCase()
  if (s === 'completed' || s === 'success') return <span className="ws-badge-completed">COMPLETED</span>
  if (s === 'in_progress' || s === 'assigned') return <span className="ws-badge-in-progress">{s === 'in_progress' ? 'IN PROGRESS' : 'ASSIGNED'}</span>
  if (s === 'pending') return <span className="ws-badge-pending">PENDING</span>
  if (s === 'critical' || s === 'failed' || s === 'cancelled') return <span className="ws-badge-critical">{s.toUpperCase()}</span>
  if (s === 'warning') return <span className="ws-badge-warning">WARNING</span>
  return <span className="ws-badge-pending">{status.toUpperCase()}</span>
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
          Menampilkan <strong>{startItem}</strong> – <strong>{endItem}</strong> dari <strong>{totalItems}</strong>
        </span>
        {onPageSizeChange && (
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="ml-2 bg-slate-50 border border-slate-200 rounded-md px-2 py-1 text-xs outline-none"
          >
            <option value={10}>10 / hal</option>
            <option value={20}>20 / hal</option>
            <option value={50}>50 / hal</option>
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
              className={`w-7 h-7 rounded-md text-xs font-bold transition-all ${
                currentPage === p
                  ? 'bg-emerald-800 text-white shadow-sm'
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

export default function AdminPage() {
  const router = useRouter()
  const [me, setMe] = useState<AuthUser | null>(null)
  const [view, setView] = useState<AdminView>('overview')
  const [stats, setStats] = useState<Stats | null>(null)
  const [pickups, setPickups] = useState<Pickup[]>([])
  const [users, setUsers] = useState<UserRow[]>([])
  const [logs, setLogs] = useState<AuditRow[]>([])
  const [categories, setCategories] = useState<CategoryRow[]>([])
  const [routes, setRoutes] = useState<RouteRow[]>([])

  const [showDeletedUsers, setShowDeletedUsers] = useState(false)
  const [categoryStats, setCategoryStats] = useState<CategoryStat[]>([])

  const [mgmtTab, setMgmtTab] = useState<MgmtTab>('pickups')
  const [searchFilter, setSearchFilter] = useState('')
  const [auditModuleFilter, setAuditModuleFilter] = useState('all')

  // Per-tab filter + pagination
  const [pickupStatusFilter, setPickupStatusFilter] = useState('all')
  const [pickupsPage, setPickupsPage] = useState(1)
  const [pickupsPageSize, setPickupsPageSize] = useState(10)

  const [userRoleFilter, setUserRoleFilter] = useState('all')
  const [userStatusFilter, setUserStatusFilter] = useState('all') // 'all' | 'active' | 'inactive'
  const [usersPage, setUsersPage] = useState(1)
  const [usersPageSize, setUsersPageSize] = useState(10)

  const [auditPage, setAuditPage] = useState(1)
  const [auditPageSize, setAuditPageSize] = useState(10)

  const [routesPage, setRoutesPage] = useState(1)
  const [routesPageSize, setRoutesPageSize] = useState(10)

  // ─── Photo Lightbox & Detail Modal ────────────────────────────────────────
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)
  const [detailPickup, setDetailPickup] = useState<Pickup | null>(null)

  // ─── Form & Setting Kategori ───────────────────────────────────────────────
  const [catForm, setCatForm] = useState({ category_name: '', description: '', is_maggot_friendly: true })
  const [editingCat, setEditingCat] = useState<CategoryRow | null>(null)
  const [editGuideline, setEditGuideline] = useState<{
    category_name: string
    is_maggot_friendly: boolean
    summary: string
    acceptable: string[]
    unacceptable: string[]
    tips: string[]
  } | null>(null)
  const [busy, setBusy] = useState(false)

  async function loadMe() {
    const user = await apiGetMe()
    if (!user) { router.replace('/login'); return }
    if (user.role !== 'admin') { router.replace(`/${user.role}`); return }
    setMe(user)
  }

  async function loadStats() {
    try {
      const s = await apiGetAdminStats()
      if (s) setStats(s as unknown as Stats)
    } catch { /* ignore */ }
  }
  async function loadPickups() {
    try {
      const res = await apiGetAdminPickups({ limit: 100 })
      if (res?.pickups) setPickups(res.pickups as unknown as Pickup[])
    } catch { /* ignore */ }
  }
  async function loadUsers() {
    try {
      const u = await apiGetAdminUsers()
      if (Array.isArray(u)) setUsers(u as unknown as UserRow[])
    } catch { /* ignore */ }
  }
  async function loadLogs() {
    try {
      const l = await apiGetAuditLogs(100)
      if (Array.isArray(l)) setLogs(l as unknown as AuditRow[])
    } catch { /* ignore */ }
  }
  async function loadCategories() {
    try {
      const c = await apiGetCategories()
      if (Array.isArray(c)) setCategories(c as unknown as CategoryRow[])
    } catch { /* ignore */ }
  }
  async function loadRoutes() {
    try {
      const r = await apiGetAdminRoutes()
      if (Array.isArray(r)) setRoutes(r as unknown as RouteRow[])
    } catch { /* ignore */ }
  }
  async function loadCategoryStats() {
    try {
      const raw = await apiGetAdminCategoryStats()
      if (!Array.isArray(raw)) return
      // Aggregate by category
      const map = new Map<string, CategoryStat>()
      for (const row of raw as Array<{
        waste_categories?: { category_name: string; is_maggot_friendly: boolean } | null
        status: string
        actual_weight_kg?: number | null
        estimated_weight_kg?: number | null
      }>) {
        const catName = row.waste_categories?.category_name ?? 'Tidak Diketahui'
        const isMf = row.waste_categories?.is_maggot_friendly ?? true
        const existing = map.get(catName) ?? { category_name: catName, is_maggot_friendly: isMf, total_pickups: 0, completed_pickups: 0, total_kg: 0 }
        existing.total_pickups += 1
        if (row.status === 'completed') {
          existing.completed_pickups += 1
          existing.total_kg += Number(row.actual_weight_kg ?? row.estimated_weight_kg ?? 0)
        }
        map.set(catName, existing)
      }
      setCategoryStats(Array.from(map.values()).sort((a, b) => b.total_kg - a.total_kg))
    } catch { /* ignore */ }
  }

  useEffect(() => {
    loadMe()
    loadStats()
    loadPickups()
    loadUsers()
    loadLogs()
    loadCategories()
    loadRoutes()
    loadCategoryStats()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    loadUsers()
  }, [showDeletedUsers]) // eslint-disable-line react-hooks/exhaustive-deps

  useRealtimeTables(['pickup_requests', 'users', 'audit_logs', 'waste_categories', 'routes', 'route_stops'], () => {
    loadStats()
    loadPickups()
    loadUsers()
    loadLogs()
    loadCategories()
    loadRoutes()
    loadCategoryStats()
  })

  // Notifikasi dinamis sistem untuk admin
  const notifications = useMemo<AppNotification[]>(() => {
    const list: AppNotification[] = []

    // 1. Permohonan jemput baru yang butuh penugasan
    const pendingPickups = pickups.filter((p) => p.status === 'pending')
    pendingPickups.slice(0, 5).forEach((p) => {
      const wName = p.warung_profiles?.business_name || 'Warung Mitra'
      const cat = p.waste_categories?.category_name || 'Organik'
      list.push({
        id: `admin-notif-p-${p.id}`,
        title: `Permohonan Masuk: ${wName}`,
        message: `Menunggu kurir: ${cat} (~${p.estimated_weight_kg} kg). Dibuat ${formatWIBDate(p.created_at)}`,
        time: p.created_at,
        type: 'warning',
        linkView: 'management',
      })
    })

    // 2. Transaksi penimbangan yang selesai
    const completedPickups = pickups.filter((p) => p.status === 'completed')
    completedPickups.slice(0, 4).forEach((p) => {
      const wName = p.warung_profiles?.business_name || 'Warung Mitra'
      const actualKg = p.actual_weight_kg ?? p.estimated_weight_kg
      list.push({
        id: `admin-notif-comp-${p.id}`,
        title: `Verifikasi Selesai: ${wName}`,
        message: `Penimbangan ${actualKg} kg selesai diverifikasi oleh kurir lapangan.`,
        time: p.created_at,
        type: 'success',
        linkView: 'overview',
      })
    })

    // 3. Pendaftaran akun baru
    users.slice(0, 3).forEach((u) => {
      list.push({
        id: `admin-notif-u-${u.id}`,
        title: `Pengguna Baru: ${u.name}`,
        message: `Akun baru terdaftar dengan peran [${u.role.toUpperCase()}]. Email: ${u.email}`,
        time: u.created_at,
        type: 'info',
        linkView: 'management',
      })
    })

    return list
  }, [pickups, users])

  // Search items dinamis untuk admin
  const searchItems = useMemo<SearchItem[]>(() => {
    const items: SearchItem[] = [
      {
        id: 'admin-menu-overview',
        title: 'Overview & Metrik Sirkular',
        subtitle: 'Statistik total tonase, serapan karbon, dan kurir aktif',
        category: 'Menu',
        badge: 'Metrik',
        badgeColor: 'emerald',
        onSelect: () => setView('overview'),
      },
      {
        id: 'admin-menu-mgmt-pickups',
        title: 'Manajemen Penjemputan',
        subtitle: 'Kelola dan pantau seluruh status permohonan',
        category: 'Menu',
        badge: 'Jemputan',
        badgeColor: 'blue',
        onSelect: () => {
          setMgmtTab('pickups')
          setView('management')
        },
      },
      {
        id: 'admin-menu-mgmt-users',
        title: 'Manajemen Pengguna & Mitra',
        subtitle: 'Daftar akun warung, collector, dan admin',
        category: 'Menu',
        badge: 'User',
        badgeColor: 'amber',
        onSelect: () => {
          setMgmtTab('users')
          setView('management')
        },
      },
      {
        id: 'admin-menu-audit',
        title: 'Audit Log & Jejak Aktivitas',
        subtitle: 'Log keamanan dan audit trail perubahan database',
        category: 'Menu',
        badge: 'Audit',
        badgeColor: 'slate',
        onSelect: () => setView('audit'),
      },
    ]

    // Jemputan
    pickups.forEach((p) => {
      const wName = p.warung_profiles?.business_name || 'Warung'
      const cat = p.waste_categories?.category_name || 'Organik'
      items.push({
        id: `search-p-${p.id}`,
        title: `${wName} (#${p.id.slice(0, 6)})`,
        subtitle: `Status: ${p.status.toUpperCase()} • ${cat} • ${p.estimated_weight_kg} kg`,
        category: 'Jemputan',
        badge: p.status,
        badgeColor:
          p.status === 'completed'
            ? 'emerald'
            : p.status === 'in_progress'
            ? 'blue'
            : p.status === 'pending'
            ? 'amber'
            : 'slate',
        onSelect: () => {
          setMgmtTab('pickups')
          setSearchFilter(p.id.slice(0, 6))
          setView('management')
        },
      })
    })

    // Pengguna
    users.forEach((u) => {
      items.push({
        id: `search-u-${u.id}`,
        title: `${u.name} (${u.role.toUpperCase()})`,
        subtitle: `${u.email} • ${u.phone_number || 'Tidak ada no telepon'}`,
        category: 'Pengguna',
        badge: u.role,
        badgeColor: u.role === 'admin' ? 'rose' : u.role === 'collector' ? 'blue' : 'emerald',
        onSelect: () => {
          setMgmtTab('users')
          setSearchFilter(u.name)
          setView('management')
        },
      })
    })

    return items
  }, [pickups, users])

  async function logout() {
    await apiLogout()
    router.replace('/login')
  }

  // ─── Aksi manajemen ──────────────────────────────────────────────────────

  async function cancelPickup(id: string) {
    if (!confirm('Yakin batalkan pickup ini? (hanya bisa jika status pending)')) return
    try {
      await apiCancelAdminPickup(id)
      toast.success('Pickup dibatalkan')
      loadPickups(); loadStats(); loadLogs()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Gagal membatalkan pickup')
    }
  }

  async function approvePickup(id: string) {
    try {
      await apiApproveAdminPickup(id)
      toast.success('Pickup disetujui ✓')
      loadPickups(); loadStats(); loadLogs()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Gagal menyetujui pickup')
    }
  }

  async function rejectPickup(id: string) {
    const reason = prompt('Alasan penolakan (opsional):')
    if (reason === null) return // user cancelled
    try {
      await apiRejectAdminPickup(id, reason || undefined)
      toast.success('Pickup ditolak')
      loadPickups(); loadStats(); loadLogs()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Gagal menolak pickup')
    }
  }

  async function toggleUserActive(u: UserRow) {
    const action = u.is_deleted ? 'aktifkan kembali' : 'nonaktifkan'
    if (!confirm(`Yakin ${action} akun ${u.name} (${u.email})?`)) return
    try {
      await apiUpdateAdminUser(u.id, { is_deleted: !u.is_deleted })
      toast.success(`Akun ${action === 'aktifkan kembali' ? 'diaktifkan' : 'dinonaktifkan'}`)
      loadUsers(); loadLogs()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Gagal mengubah status akun')
    }
  }

  async function changeRole(u: UserRow, role: string) {
    if (role === u.role) return
    if (!confirm(`Ubah role ${u.name} menjadi ${role.toUpperCase()}?`)) return
    try {
      await apiUpdateAdminUser(u.id, { role })
      toast.success('Role diperbarui')
      loadUsers(); loadLogs()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Gagal mengubah role')
    }
  }

  async function createCategory(e: React.FormEvent) {
    e.preventDefault()
    const name = catForm.category_name.trim()
    if (!name) { toast.error('Nama kategori wajib diisi'); return }
    setBusy(true)
    try {
      const gl = parseCategoryGuideline({
        category_name: name,
        description: catForm.description,
        is_maggot_friendly: catForm.is_maggot_friendly,
      })
      const serialized = serializeCategoryGuideline(gl)
      await apiCreateCategory({
        category_name: name,
        description: serialized,
        is_maggot_friendly: catForm.is_maggot_friendly,
      })
      toast.success('Kategori dan pedoman awal berhasil ditambahkan')
      setCatForm({ category_name: '', description: '', is_maggot_friendly: true })
      loadCategories(); loadLogs()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Gagal menambah kategori')
    } finally {
      setBusy(false)
    }
  }

  function openEditCategory(c: CategoryRow) {
    const gl = parseCategoryGuideline(c)
    setEditingCat(c)
    setEditGuideline({
      category_name: c.category_name,
      is_maggot_friendly: c.is_maggot_friendly,
      summary: gl.summary,
      acceptable: [...gl.acceptable],
      unacceptable: [...gl.unacceptable],
      tips: [...gl.tips],
    })
  }

  async function saveCategoryGuideline(e?: React.FormEvent) {
    if (e) e.preventDefault()
    if (!editingCat || !editGuideline) return
    const name = editGuideline.category_name.trim()
    if (!name) { toast.error('Nama kategori wajib diisi'); return }
    setBusy(true)
    try {
      const serialized = serializeCategoryGuideline({
        summary: editGuideline.summary,
        acceptable: editGuideline.acceptable,
        unacceptable: editGuideline.unacceptable,
        tips: editGuideline.tips,
      })
      await apiUpdateCategory(editingCat.id, {
        category_name: name,
        description: serialized,
        is_maggot_friendly: editGuideline.is_maggot_friendly,
      })
      toast.success(`Pedoman kategori "${name}" berhasil disimpan`)
      setEditingCat(null)
      setEditGuideline(null)
      loadCategories()
      loadLogs()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Gagal memperbarui kategori')
    } finally {
      setBusy(false)
    }
  }

  function addGuidelineItem(field: 'acceptable' | 'unacceptable' | 'tips') {
    if (!editGuideline) return
    setEditGuideline({
      ...editGuideline,
      [field]: [...editGuideline[field], ''],
    })
  }

  function removeGuidelineItem(field: 'acceptable' | 'unacceptable' | 'tips', index: number) {
    if (!editGuideline) return
    setEditGuideline({
      ...editGuideline,
      [field]: editGuideline[field].filter((_, i) => i !== index),
    })
  }

  function updateGuidelineItem(field: 'acceptable' | 'unacceptable' | 'tips', index: number, value: string) {
    if (!editGuideline) return
    const updated = [...editGuideline[field]]
    updated[index] = value
    setEditGuideline({
      ...editGuideline,
      [field]: updated,
    })
  }

  async function deleteCategory(c: CategoryRow) {
    if (!confirm(`Hapus kategori "${c.category_name}"?`)) return
    try {
      await apiDeleteCategory(c.id)
      toast.success('Kategori dihapus')
      loadCategories(); loadLogs()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Gagal menghapus kategori')
    }
  }

  const filteredPickups = pickups.filter(p => {
    const matchStatus = pickupStatusFilter === 'all' || p.status === pickupStatusFilter
    const matchSearch = !searchFilter || [
      p.id, p.warung_profiles?.business_name ?? '', p.status
    ].some(v => v.toLowerCase().includes(searchFilter.toLowerCase()))
    return matchStatus && matchSearch
  })
  const pagedPickups = filteredPickups.slice((pickupsPage - 1) * pickupsPageSize, pickupsPage * pickupsPageSize)

  const filteredUsers = users.filter(u => {
    const matchRole = userRoleFilter === 'all' || u.role === userRoleFilter
    const matchStatus = userStatusFilter === 'all' || (userStatusFilter === 'active' ? !u.is_deleted : u.is_deleted)
    const matchSearch = !searchFilter || [
      u.name, u.email, u.role
    ].some(v => v.toLowerCase().includes(searchFilter.toLowerCase()))
    return matchRole && matchStatus && matchSearch
  })
  const pagedUsers = filteredUsers.slice((usersPage - 1) * usersPageSize, usersPage * usersPageSize)

  const filteredCategories = categories.filter(c => {
    if (!searchFilter) return true
    const term = searchFilter.toLowerCase()
    return (
      c.category_name.toLowerCase().includes(term) ||
      (c.description || '').toLowerCase().includes(term)
    )
  })

  const filteredRoutes = routes.filter(r => {
    if (!searchFilter) return true
    const term = searchFilter.toLowerCase()
    return (
      r.id.toLowerCase().includes(term) ||
      (r.collector_profiles?.vehicle_type || '').toLowerCase().includes(term) ||
      (r.route_stops ?? []).some(s =>
        (s.pickup_requests?.warung_profiles?.business_name || '').toLowerCase().includes(term)
      )
    )
  })
  const pagedRoutes = filteredRoutes.slice((routesPage - 1) * routesPageSize, routesPage * routesPageSize)

  const filteredLogs = logs.filter(l => {
    if (auditModuleFilter !== 'all' && l.resource_type.toLowerCase() !== auditModuleFilter.toLowerCase()) {
      return false
    }
    if (!searchFilter) return true
    const term = searchFilter.toLowerCase()
    return (
      l.action.toLowerCase().includes(term) ||
      l.resource_type.toLowerCase().includes(term) ||
      (l.users?.name || '').toLowerCase().includes(term)
    )
  })
  const pagedLogs = filteredLogs.slice((auditPage - 1) * auditPageSize, auditPage * auditPageSize)

  // ─── 1. System Overview ───────────────────────────────────────────────────

  const renderOverview = () => {
    const chartLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul']
    const volumeData = [
      { label: 'Recycled Weight', values: [2500, 3800, 5200, 9800, 4800, 5600, 7200] },
      { label: 'Baseline', values: [4500, 5000, 4800, 5200, 5800, 6000, 7000] },
    ]

    const zoneSegments = [
      { label: 'Sleman', value: 40, color: '#064e3b' },
      { label: 'Kota Yogyakarta', value: 25, color: '#059669' },
      { label: 'Bantul', value: 20, color: '#34d399' },
      { label: 'Kulon Progo', value: 15, color: '#f59e0b' },
    ]

    const totalWeightNum = stats?.total_waste_collected_kg ?? 0
    const collectorsNum = stats?.collector_count ?? 0
    const warungNum = stats?.active_warung_count ?? 0
    const pendingCount = stats?.status_breakdown?.pending ?? 0
    const completedCount = stats?.total_completed_pickups ?? 0
    const carbonOffset = stats?.estimated_carbon_offset_kg_co2e ?? 0

    // Category donut segments from real data
    const topCatColors = ['#064e3b', '#059669', '#34d399', '#f59e0b', '#3b82f6', '#8b5cf6']
    const catDonutSegments = categoryStats.slice(0, 6).map((c, i) => ({
      label: c.category_name,
      value: Math.max(1, c.total_pickups),
      color: topCatColors[i % topCatColors.length],
    }))
    const totalCatPickups = catDonutSegments.reduce((s, c) => s + c.value, 0)

    return (
      <div className="space-y-5">
        {/* Hero Banner */}
        <div className="ws-card bg-gradient-to-r from-emerald-50 via-emerald-100 to-teal-100 text-emerald-950 p-6 sm:p-8 rounded-2xl">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="space-y-2 max-w-xl">
              <span className="text-[10px] font-bold tracking-wider uppercase bg-emerald-800 px-2.5 py-1 rounded-full text-emerald-100">
                Operational Control
              </span>
              <h2 className="text-xl sm:text-3xl font-extrabold text-emerald-950">
                WarungSirkular System Overview
              </h2>
              <p className="text-xs sm:text-sm text-emerald-900 leading-relaxed">
                Monitoring real-time alur logistik penjemputan limbah non-organik, metrik reduksi pencemaran, dan performa kurir di seluruh jaringan warung.
              </p>
              <div className="flex flex-col sm:flex-row flex-wrap gap-2 pt-2">
                <button
                  className="ws-btn-primary text-xs w-full sm:w-auto justify-center"
                  onClick={() => setView('management')}
                >
                  Buka Manajemen Data
                </button>
                <div className="flex gap-2 sm:contents">
                  <a
                    className="ws-btn-outline text-emerald-900 border-emerald-300 hover:bg-emerald-100/60 text-xs flex-1 sm:flex-none justify-center text-center"
                    href="/api/admin/export?type=pickups"
                    download
                  >
                    {IC.download} Laporan Pickup
                  </a>
                  <a
                    className="ws-btn-outline text-emerald-900 border-emerald-300 hover:bg-emerald-100/60 text-xs flex-1 sm:flex-none justify-center text-center"
                    href="/api/admin/export?type=users"
                    download
                  >
                    {IC.download} Pengguna
                  </a>
                </div>
              </div>
            </div>
            
          </div>
        </div>

        {/* 6 Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {[
            { label: 'TOTAL BERAT TERKUMPUL', value: `${totalWeightNum.toLocaleString('id-ID')} kg`, sub: `${(totalWeightNum/1000).toFixed(2)} ton`, icon: IC.box, color: 'emerald' },
            { label: 'PICKUP SELESAI', value: `${completedCount}`, sub: 'transaksi terverifikasi', icon: IC.checkCircle, color: 'emerald' },
            { label: 'PICKUP PENDING', value: `${pendingCount}`, sub: 'menunggu kurir', icon: IC.clock, color: pendingCount > 10 ? 'amber' : 'emerald' },
            { label: 'COLLECTOR AKTIF', value: `${collectorsNum}`, sub: 'kurir terdaftar', icon: IC.truck, color: 'blue' },
            { label: 'WARUNG MITRA', value: `${warungNum}`, sub: 'partner aktif', icon: IC.users, color: 'blue' },
            { label: 'OFFSET KARBON', value: `${carbonOffset.toFixed(1)} kg`, sub: 'CO₂e terhindarkan', icon: IC.checkCircle, color: 'teal' },
          ].map((s) => (
            <div key={s.label} className="ws-card p-4 sm:p-5">
              <div className="flex items-start justify-between gap-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-tight">{s.label}</span>
                <span className={`text-slate-400 ${ s.color === 'amber' ? 'text-amber-500' : ''}`}>{s.icon}</span>
              </div>
              <p className="text-xl sm:text-2xl font-extrabold text-slate-900 mt-2">{s.value}</p>
              <p className="text-[11px] text-slate-500 mt-0.5">{s.sub}</p>
            </div>
          ))}
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 ws-card p-5">
            <h3 className="text-sm font-bold text-slate-800 mb-2">Tren Volume Pengumpulan Limbah Non-Organik (kg)</h3>
            <div className="h-64">
              <LineChart data={volumeData} labels={chartLabels} colors={['#059669', '#3b82f6']} height={250} />
            </div>
          </div>

          <div className="ws-card p-5 flex flex-col">
            <h3 className="text-sm font-bold text-slate-800 mb-1">Distribusi Wilayah</h3>
            <div className="flex justify-center my-2">
              <DonutChart segments={zoneSegments} size={120} />
            </div>
            <div className="space-y-1.5 text-xs flex-1">
              {zoneSegments.map(z => (
                <div key={z.label} className="flex justify-between items-center">
                  <span className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: z.color }} />
                    <span className="text-slate-600">{z.label}</span>
                  </span>
                  <span className="font-bold text-slate-800">{z.value}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Category Stats */}
        {categoryStats.length > 0 && (
          <div className="ws-card p-5">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-800">Analitik Kategori Limbah Non-Organik</h3>
                <p className="text-xs text-slate-500">Breakdown jumlah pickup dan berat terkumpul per kategori</p>
              </div>
              {catDonutSegments.length > 0 && (
                <div className="shrink-0">
                  <DonutChart segments={catDonutSegments} size={80} />
                </div>
              )}
            </div>
            <div className="space-y-2">
              {categoryStats.slice(0, 8).map((cat, i) => {
                const pct = totalCatPickups > 0 ? Math.round((cat.total_pickups / totalCatPickups) * 100) : 0
                return (
                  <div key={cat.category_name} className="flex items-center gap-3">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: topCatColors[i % topCatColors.length] }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-0.5">
                        <span className="text-xs font-semibold text-slate-800 truncate">{cat.category_name}</span>
                        <span className="text-[11px] text-slate-500 shrink-0">{cat.total_pickups} pickup • {cat.total_kg.toFixed(1)} kg</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-1.5">
                        <div
                          className="h-1.5 rounded-full transition-all duration-500"
                          style={{ width: `${pct}%`, backgroundColor: topCatColors[i % topCatColors.length] }}
                        />
                      </div>
                    </div>
                    <span className="text-[11px] font-bold text-slate-600 w-8 text-right shrink-0">{pct}%</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Limbah Berbahaya Info Card */}
        <div className="ws-card p-5 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
              {IC.alert}
            </div>
            <div>
              <h3 className="text-sm font-bold text-amber-900">Limbah Pencemar Lingkungan — Prioritas Penanganan</h3>
              <p className="text-xs text-amber-800 mt-1 leading-relaxed">
                Plastik sachet, minyak jelantah, styrofoam, dan limbah B3 dari warung merupakan pencemar prioritas yang wajib ditangani secara terpisah. Pastikan collector memverifikasi foto sebelum penjemputan.
              </p>
              <div className="flex flex-wrap gap-2 mt-3">
                {['Plastik Sachet', 'Minyak Jelantah', 'Styrofoam', 'Kaleng Aerosol', 'Baterai Bekas', 'Lampu Neon'].map(tag => (
                  <span key={tag} className="px-2 py-0.5 bg-amber-200/80 text-amber-900 text-[11px] font-semibold rounded-full">{tag}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ─── 2. Operational Audit Logs ────────────────────────────────────────────

  const renderAudit = () => (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Operational Audit Logs</h1>
          <p className="text-xs sm:text-sm text-slate-500">Catatan jejak aktivitas sistem, aksi user, dan audit keamanan.</p>
        </div>
        <button className="ws-btn-primary text-xs" onClick={loadLogs}>
          {IC.refresh} Segarkan Log
        </button>
      </div>

      <div className="ws-card">
        {/* Filter bar */}
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row gap-3 justify-between">
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 max-w-sm w-full">
            <span className="text-slate-400">{IC.search}</span>
            <input
              placeholder="Cari user, aksi, atau modul..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="bg-transparent border-none text-xs outline-hidden w-full"
            />
          </div>
          <select
            value={auditModuleFilter}
            onChange={(e) => setAuditModuleFilter(e.target.value)}
            className="p-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 outline-hidden"
          >
            <option value="all">Semua Modul</option>
            <option value="pickup_requests">Pickup Requests</option>
            <option value="users">User Management</option>
            <option value="routes">Logistics Engine</option>
          </select>
        </div>

        {/* Table */}
        {pagedLogs.length === 0 && filteredLogs.length === 0 && (
          <p className="p-6 text-center text-xs text-slate-400">Tidak ada catatan audit yang cocok.</p>
        )}

        {/* Mobile: stacked cards */}
        <div className="sm:hidden divide-y divide-slate-100">
          {pagedLogs.map((l, i) => (
            <div key={l.id} className="p-4 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-xs text-slate-500">LOG-{String((auditPage - 1) * auditPageSize + i + 1).padStart(4, '0')}</span>
                <StatusBadge status="completed" />
              </div>
              <p className="text-xs font-semibold text-slate-900">{l.action}</p>
              <p className="text-[11px] text-slate-500">Modul: {l.resource_type}</p>
              <p className="text-[11px] text-slate-400">{l.users?.name ?? 'System Engine'} • {formatWIBDateTime(l.created_at)}</p>
            </div>
          ))}
        </div>

        {/* Desktop: table */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="ws-table">
            <thead>
              <tr>
                <th>LOG ID</th>
                <th>WAKTU</th>
                <th>PENGGUNA</th>
                <th>AKSI & MODUL</th>
                <th>STATUS</th>
              </tr>
            </thead>
            <tbody>
              {pagedLogs.map((l, i) => (
                <tr key={l.id}>
                  <td className="font-mono text-xs text-slate-500">LOG-{String((auditPage - 1) * auditPageSize + i + 1).padStart(4, '0')}</td>
                  <td className="text-xs">{formatWIBDateTime(l.created_at)}</td>
                  <td className="text-xs font-bold text-slate-800">{l.users?.name ?? 'System Engine'}</td>
                  <td className="text-xs">
                    <span className="font-semibold text-slate-900">{l.action}</span>
                    <span className="text-slate-400 block text-[11px]">Modul: {l.resource_type}</span>
                  </td>
                  <td><StatusBadge status="completed" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination
          currentPage={auditPage}
          totalItems={filteredLogs.length}
          pageSize={auditPageSize}
          onPageChange={(p) => setAuditPage(p)}
          onPageSizeChange={(s) => { setAuditPageSize(s); setAuditPage(1) }}
        />
      </div>
    </div>
  )


  // ─── 3. System Management ─────────────────────────────────────────────────

  const renderManagement = () => (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">System Management</h1>
          <p className="text-xs sm:text-sm text-slate-500">Kelola permohonan penjemputan dan direktori akun pengguna.</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto no-scrollbar flex-nowrap">
        <button
          onClick={() => setMgmtTab('pickups')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all shrink-0 ${
            mgmtTab === 'pickups' ? 'bg-emerald-800 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          {IC.box} Data Pickups ({pickups.length})
        </button>
        <button
          onClick={() => setMgmtTab('users')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all shrink-0 ${
            mgmtTab === 'users' ? 'bg-emerald-800 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          {IC.users} Pengguna ({users.length})
        </button>
        <button
          onClick={() => setMgmtTab('categories')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all shrink-0 ${
            mgmtTab === 'categories' ? 'bg-emerald-800 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          {IC.tag} Kategori ({categories.length})
        </button>
        <button
          onClick={() => setMgmtTab('routes')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all shrink-0 ${
            mgmtTab === 'routes' ? 'bg-emerald-800 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          {IC.map} Rute ({routes.length})
        </button>
      </div>

      {/* Table */}
      <div className="ws-card">
        <div className="p-4 border-b border-slate-100 flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 flex-1 max-w-sm">
              <span className="text-slate-400">{IC.search}</span>
              <input
                placeholder={`Cari ${mgmtTab === 'pickups' ? 'pickup, warung...' : mgmtTab === 'users' ? 'nama, email...' : mgmtTab === 'categories' ? 'kategori...' : 'rute...'}`}
                value={searchFilter}
                onChange={(e) => { setSearchFilter(e.target.value); setPickupsPage(1); setUsersPage(1); setAuditPage(1); setRoutesPage(1) }}
                className="bg-transparent border-none text-xs outline-hidden w-full"
              />
              {searchFilter && (
                <button onClick={() => { setSearchFilter(''); setPickupsPage(1); setUsersPage(1); setAuditPage(1); setRoutesPage(1) }} className="text-slate-400 hover:text-slate-700">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {mgmtTab === 'pickups' && (
                <select
                  value={pickupStatusFilter}
                  onChange={(e) => { setPickupStatusFilter(e.target.value); setPickupsPage(1) }}
                  className="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-medium outline-none"
                >
                  <option value="all">Semua Status</option>
                  <option value="pending">Pending</option>
                  <option value="assigned">Assigned</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              )}
              {mgmtTab === 'users' && (
                <>
                  <select
                    value={userRoleFilter}
                    onChange={(e) => { setUserRoleFilter(e.target.value); setUsersPage(1) }}
                    className="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-medium outline-none"
                  >
                    <option value="all">Semua Role</option>
                    <option value="warung">Warung</option>
                    <option value="collector">Collector</option>
                    <option value="admin">Admin</option>
                  </select>
                  <select
                    value={userStatusFilter}
                    onChange={(e) => { setUserStatusFilter(e.target.value); setUsersPage(1) }}
                    className="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-medium outline-none"
                  >
                    <option value="all">Semua Status</option>
                    <option value="active">Aktif</option>
                    <option value="inactive">Nonaktif</option>
                  </select>
                  <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={showDeletedUsers}
                      onChange={(e) => setShowDeletedUsers(e.target.checked)}
                      className="accent-emerald-700"
                    />
                    Tampilkan dinonaktifkan
                  </label>
                </>
              )}
            </div>
          </div>
          <p className="text-xs text-slate-400">
            {mgmtTab === 'pickups' ? `${filteredPickups.length} pickup` : mgmtTab === 'users' ? `${filteredUsers.length} pengguna` : mgmtTab === 'categories' ? `${filteredCategories.length} kategori` : `${filteredRoutes.length} rute`} ditemukan
          </p>
        </div>

        {/* Form tambah kategori */}
        {mgmtTab === 'categories' && (
          <form onSubmit={createCategory} className="p-4 border-b border-slate-100 space-y-3">
            <p className="text-xs font-bold text-slate-700">Tambah Kategori Limbah Anorganik</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                placeholder="Nama kategori (mis. Kardus, Minyak Jelantah, Botol PET)"
                value={catForm.category_name}
                onChange={(e) => setCatForm({ ...catForm, category_name: e.target.value })}
                className="p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-hidden w-full"
              />
              <input
                placeholder="Deskripsi daur ulang / penanganan (opsional)"
                value={catForm.description}
                onChange={(e) => setCatForm({ ...catForm, description: e.target.value })}
                className="p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-hidden w-full"
              />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={catForm.is_maggot_friendly}
                  onChange={(e) => setCatForm({ ...catForm, is_maggot_friendly: e.target.checked })}
                  className="accent-emerald-700"
                />
                Bernilai Daur Ulang Sirkular
              </label>
              <button type="submit" disabled={busy} className="ws-btn-primary text-xs disabled:opacity-50">
                {IC.plus} Tambah
              </button>
            </div>
          </form>
        )}

        {mgmtTab === 'pickups' && (
          <>
            {/* Mobile: stacked cards */}
            <div className="sm:hidden divide-y divide-slate-100">
              {pagedPickups.length === 0 ? (
                <p className="p-6 text-center text-xs text-slate-400">Tidak ada data pickup.</p>
              ) : (
                pagedPickups.map((p) => (
                  <div key={p.id} className="p-4 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-bold">#{p.id.slice(-6).toUpperCase()}</span>
                      <StatusBadge status={p.status} />
                    </div>
                    <div className="flex items-start gap-3">
                      {p.sample_photo_url ? (
                        <button
                          onClick={() => setLightboxUrl(p.sample_photo_url!)}
                          className="relative w-16 h-16 rounded-lg overflow-hidden border border-slate-200 shrink-0"
                        >
                          <img src={p.sample_photo_url} alt="" className="w-full h-full object-cover" />
                        </button>
                      ) : (
                        <span className="w-16 h-16 rounded-lg bg-slate-100 border border-dashed border-slate-300 flex items-center justify-center text-slate-400 text-[10px] shrink-0">No Photo</span>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold">{p.warung_profiles?.business_name ?? 'Warung Partner'}</p>
                        <p className="text-[11px] text-slate-500">{p.waste_categories?.category_name ?? '–'}</p>
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-500 mt-1">
                          <span>Est: <strong className="text-slate-800">{p.estimated_weight_kg} kg</strong></span>
                          <span>Aktual: <strong className="text-slate-800">{p.actual_weight_kg ? `${p.actual_weight_kg} kg` : '–'}</strong></span>
                        </div>
                        <p className="text-[11px] text-slate-400">{formatWIBDate(p.created_at)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        onClick={() => setDetailPickup(p as unknown as Pickup)}
                        className="ws-btn-outline text-xs text-emerald-800 border-emerald-200 hover:bg-emerald-50"
                      >
                        {IC.search} Detail
                      </button>
                      {p.status === 'awaiting_approval' && (
                        <>
                          <button onClick={() => approvePickup(p.id)} className="ws-btn-outline text-xs text-emerald-700 border-emerald-300 hover:bg-emerald-50">✓ Setujui</button>
                          <button onClick={() => rejectPickup(p.id)} className="ws-btn-outline text-xs text-rose-600 border-rose-200 hover:bg-rose-50">✕ Tolak</button>
                        </>
                      )}
                      {p.status === 'pending' && (
                        <button onClick={() => cancelPickup(p.id)} className="ws-btn-outline text-rose-600 border-rose-200 hover:bg-rose-50 text-xs">
                          {IC.trash} Batalkan
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Desktop: table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="ws-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>FOTO</th>
                    <th>WARUNG</th>
                    <th>KATEGORI</th>
                    <th>ESTIMASI</th>
                    <th>AKTUAL</th>
                    <th>STATUS</th>
                    <th>TANGGAL</th>
                    <th>AKSI</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedPickups.length === 0 && (
                    <tr>
                      <td colSpan={9} className="text-center py-8 text-xs text-slate-400">Tidak ada data pickup.</td>
                    </tr>
                  )}
                  {pagedPickups.map((p) => (
                    <tr key={p.id}>
                      <td className="font-mono text-xs font-bold">#{p.id.slice(-6).toUpperCase()}</td>
                      <td>
                        {p.sample_photo_url ? (
                          <button
                            onClick={() => setLightboxUrl(p.sample_photo_url!)}
                            className="relative w-10 h-10 rounded-lg overflow-hidden border border-slate-200 hover:border-emerald-400 hover:shadow-md transition-all group shrink-0"
                            title="Lihat foto"
                          >
                            <img src={p.sample_photo_url} alt="" className="w-full h-full object-cover group-hover:scale-110 transition-transform" />
                          </button>
                        ) : (
                          <span className="w-10 h-10 rounded-lg bg-slate-100 border border-dashed border-slate-300 flex items-center justify-center text-slate-400" title="Tidak ada foto">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <rect x="3" y="3" width="18" height="18" rx="2"/>
                              <circle cx="8.5" cy="8.5" r="1.5"/>
                              <polyline points="21 15 16 10 5 21"/>
                            </svg>
                          </span>
                        )}
                      </td>
                      <td className="text-xs font-semibold">{p.warung_profiles?.business_name ?? 'Warung Partner'}</td>
                      <td className="text-xs">
                        <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold ${
                          p.waste_categories?.is_maggot_friendly
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}>
                          {p.waste_categories?.category_name ?? '–'}
                        </span>
                      </td>
                      <td className="text-xs">{p.estimated_weight_kg} kg</td>
                      <td className="text-xs font-bold">{p.actual_weight_kg ? `${p.actual_weight_kg} kg` : '–'}</td>
                      <td><StatusBadge status={p.status} /></td>
                      <td className="text-xs text-slate-500">{formatWIBDate(p.created_at)}</td>
                      <td>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <button
                            onClick={() => setDetailPickup(p as unknown as Pickup)}
                            className="ws-btn-outline text-xs text-emerald-800 border-emerald-200 hover:bg-emerald-50"
                          >
                            {IC.search} Detail
                          </button>
                          {p.status === 'awaiting_approval' && (
                            <>
                              <button onClick={() => approvePickup(p.id)} className="ws-btn-outline text-xs text-emerald-700 border-emerald-300 hover:bg-emerald-50">✓ Setujui</button>
                              <button onClick={() => rejectPickup(p.id)} className="ws-btn-outline text-xs text-rose-600 border-rose-200 hover:bg-rose-50">✕ Tolak</button>
                            </>
                          )}
                          {p.status === 'pending' && (
                            <button onClick={() => cancelPickup(p.id)} className="ws-btn-outline text-rose-600 border-rose-200 hover:bg-rose-50 text-xs">
                              {IC.trash}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              currentPage={pickupsPage}
              totalItems={filteredPickups.length}
              pageSize={pickupsPageSize}
              onPageChange={(p) => setPickupsPage(p)}
              onPageSizeChange={(s) => { setPickupsPageSize(s); setPickupsPage(1) }}
            />
          </>
        )}

        {mgmtTab === 'users' && (
          <>
            {/* Mobile: stacked cards */}
            <div className="sm:hidden divide-y divide-slate-100">
              {pagedUsers.length === 0 ? (
                <p className="p-6 text-center text-xs text-slate-400">Tidak ada data pengguna.</p>
              ) : (
                 pagedUsers.map((u) => (
                  <div key={u.id} className={`p-4 space-y-3 ${u.is_deleted ? 'opacity-60' : ''}`}>
                    {/* Header: nama + badge */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-slate-900 truncate">{u.name}</p>
                        <p className="text-[11px] text-slate-500 break-all">{u.email}</p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {u.is_deleted && (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-slate-200 text-slate-600">NONAKTIF</span>
                        )}
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                          u.role === 'admin' ? 'bg-rose-100 text-rose-800' : u.role === 'collector' ? 'bg-blue-100 text-blue-800' : 'bg-emerald-100 text-emerald-800'
                        }`}>
                          {u.role}
                        </span>
                      </div>
                    </div>

                    {/* Info */}
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                      <span>HP: {u.phone_number || '–'}</span>
                      <span>Gabung: {formatWIBDate(u.created_at)}</span>
                    </div>

                    {/* Aksi */}
                    {me?.id !== u.id && (
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Ganti Role */}
                        <select
                          value={u.role}
                          onChange={(e) => changeRole(u, e.target.value)}
                          className="flex-1 p-1.5 bg-white border border-slate-200 rounded-lg text-[11px] font-bold outline-none"
                        >
                          <option value="warung">Warung</option>
                          <option value="collector">Collector</option>
                          <option value="admin">Admin</option>
                        </select>
                        {/* Aktifkan / Nonaktifkan */}
                        <button
                          onClick={() => toggleUserActive(u)}
                          className={`ws-btn-outline text-xs flex items-center gap-1 ${
                            u.is_deleted
                              ? 'text-emerald-700 border-emerald-200 hover:bg-emerald-50'
                              : 'text-rose-600 border-rose-200 hover:bg-rose-50'
                          }`}
                        >
                          {IC.power}
                          {u.is_deleted ? 'Aktifkan' : 'Nonaktifkan'}
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Desktop: table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="ws-table">
                <thead>
                  <tr>
                    <th>NAMA</th>
                    <th>EMAIL</th>
                    <th>ROLE</th>
                    <th>NO. HP</th>
                    <th>STATUS</th>
                    <th>TANGGAL GABUNG</th>
                    <th>AKSI</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedUsers.length === 0 && (
                    <tr>
                      <td colSpan={7} className="text-center py-8 text-xs text-slate-400">Tidak ada data pengguna.</td>
                    </tr>
                  )}
                  {pagedUsers.map((u) => (
                    <tr key={u.id} className={u.is_deleted ? 'opacity-60' : ''}>
                      <td className="text-xs font-bold">{u.name}</td>
                      <td className="text-xs text-slate-600">{u.email}</td>
                      <td>
                        <select
                          value={u.role}
                          disabled={me?.id === u.id}
                          onChange={(e) => changeRole(u, e.target.value)}
                          className="p-1 bg-white border border-slate-200 rounded-lg text-[11px] font-bold outline-hidden disabled:opacity-60"
                        >
                          <option value="warung">Warung</option>
                          <option value="collector">Collector</option>
                          <option value="admin">Admin</option>
                        </select>
                      </td>
                      <td className="text-xs">{u.phone_number || '–'}</td>
                      <td>
                        {u.is_deleted ? (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-slate-200 text-slate-600">NONAKTIF</span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800">AKTIF</span>
                        )}
                      </td>
                      <td className="text-xs text-slate-500">{formatWIBDate(u.created_at)}</td>
                      <td>
                        {me?.id !== u.id ? (
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => toggleUserActive(u)}
                              className={`ws-btn-outline text-xs flex items-center gap-1 ${
                                u.is_deleted
                                  ? 'text-emerald-700 border-emerald-200 hover:bg-emerald-50'
                                  : 'text-rose-600 border-rose-200 hover:bg-rose-50'
                              }`}
                            >
                              {IC.power}
                              {u.is_deleted ? 'Aktifkan' : 'Nonaktifkan'}
                            </button>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">Akun sendiri</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              currentPage={usersPage}
              totalItems={filteredUsers.length}
              pageSize={usersPageSize}
              onPageChange={(p) => setUsersPage(p)}
              onPageSizeChange={(s) => { setUsersPageSize(s); setUsersPage(1) }}
            />
          </>
        )}

        {mgmtTab === 'categories' && (
          <div className="divide-y divide-slate-100">
            {filteredCategories.length === 0 && (
              <p className="p-6 text-center text-xs text-slate-400">Tidak ada kategori. Tambahkan dari form di atas.</p>
            )}
            {filteredCategories.map((c) => {
              const gl = parseCategoryGuideline(c)
              return (
                <div key={c.id} className="p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 hover:bg-slate-50/50 transition-colors">
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-bold text-slate-900">{c.category_name}</span>
                      {c.is_maggot_friendly ? (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800 border border-emerald-200">
                          DAUR ULANG SIRKULAR
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-amber-100 text-amber-800 border border-amber-200">
                          PENANGANAN KHUSUS / B3
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-600 line-clamp-2">{gl.summary || 'Belum ada deskripsi pedoman'}</p>
                    <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500 pt-0.5">
                      <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded-md font-medium border border-emerald-100">
                        ✓ {gl.acceptable.length} Ketentuan Boleh
                      </span>
                      <span className="inline-flex items-center gap-1 bg-rose-50 text-rose-800 px-2 py-0.5 rounded-md font-medium border border-rose-100">
                        ✕ {gl.unacceptable.length} Larangan
                      </span>
                      <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md font-medium border border-slate-200">
                        {gl.tips.length} Tips Kualitas
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => openEditCategory(c)} className="ws-btn-outline text-xs text-emerald-800 border-emerald-200 hover:bg-emerald-50">
                      {IC.edit} Setting Pedoman
                    </button>
                    <button onClick={() => deleteCategory(c)} className="ws-btn-outline text-rose-600 border-rose-200 hover:bg-rose-50 text-xs">
                      {IC.trash} Hapus
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {mgmtTab === 'routes' && (
          <>
            <div className="divide-y divide-slate-100">
              {pagedRoutes.length === 0 && (
                <p className="p-6 text-center text-xs text-slate-400">Tidak ada rute penjemputan.</p>
              )}
              {pagedRoutes.map((r) => (
                <div key={r.id} className="p-4 space-y-3">
                  <div className="flex flex-wrap justify-between gap-2">
                    <div>
                      <p className="text-xs font-bold text-slate-900">Rute #{r.id.slice(-6).toUpperCase()}</p>
                      <p className="text-[11px] text-slate-500">
                        {r.collector_profiles?.vehicle_type ?? 'Collector'} • Dibuat {formatWIBDateTime(r.created_at)}
                        {r.completed_at ? ` • Selesai ${formatWIBDateTime(r.completed_at)}` : ''}
                      </p>
                    </div>
                    <StatusBadge status={r.status} />
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
                    <span>Berat: <strong className="text-slate-800">{r.total_weight_kg} kg</strong></span>
                    <span>Jarak: <strong className="text-slate-800">{r.total_distance_km} km</strong></span>
                    <span>Stop: <strong className="text-slate-800">{(r.route_stops ?? []).length}</strong></span>
                  </div>
                  <div className="border-t border-slate-100 pt-2 space-y-1">
                    {(r.route_stops ?? []).map((s) => (
                      <div key={s.id} className="flex items-center justify-between gap-2 text-xs">
                        <span className="text-slate-600">#{s.sequence_number} • {s.pickup_requests?.warung_profiles?.business_name ?? 'Warung'}</span>
                        <span className="flex items-center gap-2">
                          <span className="text-slate-500 w-16 text-right">{s.pickup_requests?.estimated_weight_kg} kg</span>
                          <StatusBadge status={s.status} />
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <Pagination
              currentPage={routesPage}
              totalItems={filteredRoutes.length}
              pageSize={routesPageSize}
              onPageChange={(p) => setRoutesPage(p)}
              onPageSizeChange={(s) => { setRoutesPageSize(s); setRoutesPage(1) }}
            />
          </>
        )}
      </div>
    </div>
  )

  const breadcrumbMap: Record<AdminView, string> = {
    overview: 'Overview',
    management: 'System Management',
    audit: 'Operational Audit Logs',
    profile: 'Profil Pengguna',
  }

  return (
    <AppShell
      role="admin"
      userName={me?.name ?? 'Admin Portal'}
      userRole="Administrator"
      currentView={view}
      onNavigate={(v) => setView(v as AdminView)}
      onLogout={logout}
      breadcrumb={breadcrumbMap[view]}
      userId={me?.id}
      userEmail={me?.email}
      userPhone={me?.phone_number ?? ''}
      onProfileUpdated={(up) => setMe((prev) => (prev ? { ...prev, ...up } : null))}
      notifications={notifications}
      searchItems={searchItems}
      searchPlaceholder="Cari data sistem, user, jemputan..."
    >
      {view === 'overview' && renderOverview()}
      {view === 'management' && renderManagement()}
      {view === 'audit' && renderAudit()}

      {/* ─── Photo Lightbox ────────────────────────────────────────────── */}
      {lightboxUrl && <PhotoLightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} />}

      {/* ─── Pickup Detail Modal ───────────────────────────────────────── */}
      {detailPickup && (
        <PickupDetailModal
          pickup={detailPickup}
          onClose={() => setDetailPickup(null)}
          onApprove={approvePickup}
          onReject={rejectPickup}
          onCancel={cancelPickup}
        />
      )}

      {/* ─── Modal Setting Pedoman Daur Ulang Kategori ───────────────── */}
      {editingCat && editGuideline && (
        <div
          className="fixed inset-0 z-[999] bg-slate-950/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150"
          onClick={() => { setEditingCat(null); setEditGuideline(null) }}
        >
          <div
            className="bg-white w-full max-w-2xl max-h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0 bg-slate-50/70">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center text-sm font-bold">
                  {IC.tag}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Setting Pedoman Kategori</h3>
                  <p className="text-[11px] text-slate-500">Sesuaikan standar pemilahan untuk tampilan warung mitra</p>
                </div>
              </div>
              <button
                onClick={() => { setEditingCat(null); setEditGuideline(null) }}
                className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                aria-label="Tutup"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            {/* Scrollable Body */}
            <form onSubmit={saveCategoryGuideline} className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* Basic Fields */}
              <div className="space-y-3 p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl">
                <p className="text-xs font-bold text-slate-800 uppercase tracking-wide">Informasi Kategori</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-600 block mb-1">Nama Kategori</label>
                    <input
                      value={editGuideline.category_name}
                      onChange={(e) => setEditGuideline({ ...editGuideline, category_name: e.target.value })}
                      placeholder="Nama kategori"
                      className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs outline-none focus:border-emerald-500"
                      required
                    />
                  </div>
                  <div className="flex items-end pb-1.5">
                    <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={editGuideline.is_maggot_friendly}
                        onChange={(e) => setEditGuideline({ ...editGuideline, is_maggot_friendly: e.target.checked })}
                        className="accent-emerald-700 w-4 h-4"
                      />
                      <span>Bernilai Daur Ulang Sirkular (Non-Organik)</span>
                    </label>
                  </div>
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 block mb-1">Ringkasan / Deskripsi Kategori</label>
                  <textarea
                    rows={2}
                    value={editGuideline.summary}
                    onChange={(e) => setEditGuideline({ ...editGuideline, summary: e.target.value })}
                    placeholder="Deskripsi singkat jenis limbah anorganik..."
                    className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs outline-none focus:border-emerald-500 resize-none"
                  />
                </div>
              </div>

              {/* Acceptable items */}
              <div className="space-y-2 p-3.5 bg-emerald-50/50 border border-emerald-200/80 rounded-xl">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-emerald-950 uppercase tracking-wide flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5 text-emerald-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                    Ketentuan: Boleh Dikumpulkan
                  </p>
                  <button
                    type="button"
                    onClick={() => addGuidelineItem('acceptable')}
                    className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-900 bg-white border border-emerald-200 px-2 py-0.5 rounded-md hover:bg-emerald-50 transition-colors"
                  >
                    + Tambah Item
                  </button>
                </div>
                <div className="space-y-1.5">
                  {editGuideline.acceptable.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 shrink-0" />
                      <input
                        value={item}
                        onChange={(e) => updateGuidelineItem('acceptable', idx, e.target.value)}
                        placeholder="Contoh: Sisa nasi putih, daun singkong"
                        className="flex-1 p-1.5 bg-white border border-slate-200 rounded-lg text-xs outline-none focus:border-emerald-500"
                      />
                      <button
                        type="button"
                        onClick={() => removeGuidelineItem('acceptable', idx)}
                        className="text-slate-400 hover:text-rose-600 p-1"
                        aria-label="Hapus item"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  {editGuideline.acceptable.length === 0 && (
                    <p className="text-[11px] text-slate-400 italic">Belum ada item. Klik Tambah Item di atas.</p>
                  )}
                </div>
              </div>

              {/* Unacceptable items */}
              <div className="space-y-2 p-3.5 bg-rose-50/50 border border-rose-200/80 rounded-xl">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-rose-950 uppercase tracking-wide flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5 text-rose-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                    Ketentuan: Sebaiknya Dihindari / Ditolak
                  </p>
                  <button
                    type="button"
                    onClick={() => addGuidelineItem('unacceptable')}
                    className="text-[11px] font-semibold text-rose-700 hover:text-rose-900 bg-white border border-rose-200 px-2 py-0.5 rounded-md hover:bg-rose-50 transition-colors"
                  >
                    + Tambah Item
                  </button>
                </div>
                <div className="space-y-1.5">
                  {editGuideline.unacceptable.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                      <input
                        value={item}
                        onChange={(e) => updateGuidelineItem('unacceptable', idx, e.target.value)}
                        placeholder="Contoh: Plastik pembungkus, tulang sapi keras"
                        className="flex-1 p-1.5 bg-white border border-slate-200 rounded-lg text-xs outline-none focus:border-rose-400"
                      />
                      <button
                        type="button"
                        onClick={() => removeGuidelineItem('unacceptable', idx)}
                        className="text-slate-400 hover:text-rose-600 p-1"
                        aria-label="Hapus item"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  {editGuideline.unacceptable.length === 0 && (
                    <p className="text-[11px] text-slate-400 italic">Belum ada item larangan. Klik Tambah Item di atas.</p>
                  )}
                </div>
              </div>

              {/* Tips items */}
              <div className="space-y-2 p-3.5 bg-slate-50 border border-slate-200/90 rounded-xl">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5 text-emerald-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/></svg>
                    Tips Kualitas & Penanganan
                  </p>
                  <button
                    type="button"
                    onClick={() => addGuidelineItem('tips')}
                    className="text-[11px] font-semibold text-slate-700 hover:text-slate-900 bg-white border border-slate-200 px-2 py-0.5 rounded-md hover:bg-slate-50 transition-colors"
                  >
                    + Tambah Tips
                  </button>
                </div>
                <div className="space-y-1.5">
                  {editGuideline.tips.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 shrink-0" />
                      <input
                        value={item}
                        onChange={(e) => updateGuidelineItem('tips', idx, e.target.value)}
                        placeholder="Contoh: Tiriskan air berlebih sebelum dikemas"
                        className="flex-1 p-1.5 bg-white border border-slate-200 rounded-lg text-xs outline-none focus:border-emerald-500"
                      />
                      <button
                        type="button"
                        onClick={() => removeGuidelineItem('tips', idx)}
                        className="text-slate-400 hover:text-rose-600 p-1"
                        aria-label="Hapus tips"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  {editGuideline.tips.length === 0 && (
                    <p className="text-[11px] text-slate-400 italic">Belum ada tips. Klik Tambah Tips di atas.</p>
                  )}
                </div>
              </div>
            </form>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-slate-100 bg-slate-50/70 shrink-0">
              <button
                type="button"
                onClick={() => { setEditingCat(null); setEditGuideline(null) }}
                className="ws-btn-outline text-xs"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => saveCategoryGuideline()}
                disabled={busy}
                className="ws-btn-primary text-xs disabled:opacity-50"
              >
                {busy ? 'Menyimpan...' : 'Simpan Pedoman & Kategori'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  )
}
