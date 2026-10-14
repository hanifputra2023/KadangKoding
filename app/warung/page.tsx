"use client"

/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useRef, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useRealtimeTables } from '@/lib/hooks/useRealtimeTables'
import AppShell from '@/components/AppShell'
import ClientMap from '@/components/ClientMap'
import { LineChart, DonutChart } from '@/components/Charts'
import { compressImage } from '@/lib/utils'
import { getCurrentPosition } from '@/lib/geo/geolocation'
import { AppNotification, SearchItem } from '@/lib/types/notifications'
import { apiGetMe, apiLogout, AuthUser } from '@/lib/api/auth'
import { apiGetCategories } from '@/lib/api/admin'
import { apiGetSlots, apiGetWarungPickups, apiCreatePickup, apiGetWarungProfile, apiCancelWarungPickup } from '@/lib/api/warung'
import { apiUpload } from '@/lib/api/upload'
import {
  parseCategoryGuideline,
  DEFAULT_GUIDE_STEPS,
  DEFAULT_GUIDE_FAQS,
  DEFAULT_STANDARDS,
} from '@/lib/guidelines'
import {
  parseDbDate,
  formatWIBDate,
  formatWIBTimeRange,
  buildWibIsoString,
  getWibDateString,
  getWibStartOfDay,
} from '@/lib/datetime'

// ─── Types ───────────────────────────────────────────────────────────────────

interface Category {
  id: string
  category_name: string
  description?: string | null
  is_maggot_friendly: boolean
}

interface Pickup {
  id: string
  status: string
  estimated_weight_kg: number
  actual_weight_kg: number | null
  pickup_window_start: string
  pickup_window_end: string
  sample_photo_url: string | null
  latitude?: number
  longitude?: number
  waste_categories?: { category_name: string } | null
  created_at?: string
  assigned_at?: string
  completed_at?: string
}

type View =
  | 'dashboard'
  | 'create-step1'
  | 'create-step2'
  | 'create-step3'
  | 'create-step4'
  | 'history'
  | 'pickup-status'
  | 'impact'
  | 'profile'

// ─── Icon helpers ─────────────────────────────────────────────────────────────

const IC = {
  recycle: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3"/>
    </svg>
  ),
  star: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
    </svg>
  ),
  check: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
    </svg>
  ),
  pin: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
    </svg>
  ),
  calendar: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  ),
  clock: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
    </svg>
  ),
  trending: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>
    </svg>
  ),
  box: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
    </svg>
  ),
  plus: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
  ),
  upload: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/>
    </svg>
  ),
  download: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="8 17 12 21 16 17"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.88 18.09A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.29"/>
    </svg>
  ),
  chevronRight: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6"/>
    </svg>
  ),
  chevronLeft: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6"/>
    </svg>
  ),
  info: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
    </svg>
  ),
}

/**
 * Hitung status pickup secara real-time di UI.
 * Jika status masih 'pending' tapi waktu jendela sudah lewat
 * atau sudah dibuat lebih dari 24 jam → tampilkan sebagai 'expired'.
 * Database akan diupdate oleh cron (1x/hari), tapi UI langsung akurat.
 */
function resolveStatus(pickup: Pick<Pickup, 'status' | 'pickup_window_end' | 'created_at'>): string {
  if (pickup.status !== 'pending') return pickup.status
  const now = new Date()
  const windowEnd = pickup.pickup_window_end ? parseDbDate(pickup.pickup_window_end) : null
  const createdAt = pickup.created_at ? parseDbDate(pickup.created_at) : null
  const expiredByWindow = windowEnd && !isNaN(windowEnd.getTime()) && windowEnd < now
  const expiredByAge = createdAt && !isNaN(createdAt.getTime()) && (now.getTime() - createdAt.getTime()) > 24 * 60 * 60 * 1000
  if (expiredByWindow || expiredByAge) return 'expired'
  return 'pending'
}

function StatusBadge({ pickup }: { pickup: Pick<Pickup, 'status' | 'pickup_window_end' | 'created_at'> }) {
  const status = resolveStatus(pickup)
  const map: Record<string, string> = {
    completed: 'ws-badge-completed',
    pending: 'ws-badge-pending',
    cancelled: 'ws-badge-cancelled',
    failed: 'ws-badge-failed',
    in_progress: 'ws-badge-in-progress',
    assigned: 'ws-badge-assigned',
    expired: 'ws-badge-cancelled',
  }
  const label: Record<string, string> = {
    in_progress: 'In Progress',
    expired: 'Expired',
  }
  return (
    <span className={map[status] ?? 'ws-badge-pending'}>
      {label[status] ?? (status.charAt(0).toUpperCase() + status.slice(1))}
    </span>
  )
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
            <option value={10}>10 / hal</option>
            <option value={20}>20 / hal</option>
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

function StepWizard({ current }: { current: 1 | 2 | 3 | 4 }) {
  const steps = ['BERAT', 'JADWAL', 'LOKASI', 'REVIEW']
  return (
    <div className="flex items-center justify-between w-full max-w-xl mx-auto mb-6 px-1">
      {steps.map((label, i) => {
        const n = i + 1
        const done = n < current
        const active = n === current
        return (
          <div key={n} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1 shrink-0">
              <div className={`ws-step-circle ${done ? 'done' : active ? 'active' : ''}`}>
                {done ? '✓' : n}
              </div>
              <span className={`text-[9px] sm:text-[10px] font-bold tracking-wider ${done || active ? 'text-emerald-700' : 'text-slate-400'}`}>
                {label}
              </span>
            </div>
            {n < 4 && <div className={`ws-step-line mx-1.5 sm:mx-2.5 ${done ? 'done' : ''}`} />}
          </div>
        )
      })}
    </div>
  )
}

// ─── Recycling Guide Modal ────────────────────────────────────────────────────

function RecyclingGuideModal({
  categories,
  onClose,
}: {
  categories: Category[]
  onClose: () => void
}) {
  const [activeTab, setActiveTab] = useState<'kategori' | 'langkah' | 'faq'>('kategori')
  const [activeCatIndex, setActiveCatIndex] = useState(0)

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  const currentCat = categories[activeCatIndex] || categories[0]
  const guideline = currentCat ? parseCategoryGuideline(currentCat) : null

  return (
    <div
      className="fixed inset-0 z-[999] bg-slate-950/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white w-full sm:max-w-2xl max-h-[92vh] sm:max-h-[85vh] rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-5 pt-5 pb-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200/60 flex items-center justify-center shrink-0">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z" />
                <path d="M6 6h10" />
                <path d="M6 10h10" />
              </svg>
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Pedoman Daur Ulang & Pemilahan</h2>
              <p className="text-[11px] text-slate-500 mt-0.5">Standar mutu pemilahan limbah anorganik & sirkular warung mitra</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors shrink-0"
            aria-label="Tutup"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Tab bar */}
        <div className="flex items-center gap-1.5 px-5 py-2.5 border-b border-slate-100 bg-slate-50/70 shrink-0">
          <button
            onClick={() => setActiveTab('kategori')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              activeTab === 'kategori'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white'
            }`}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            Kategori Sampah ({categories.length})
          </button>
          <button
            onClick={() => setActiveTab('langkah')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              activeTab === 'langkah'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white'
            }`}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/><path d="m9 14 2 2 4-4"/></svg>
            Cara Pemilahan
          </button>
          <button
            onClick={() => setActiveTab('faq')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              activeTab === 'faq'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white'
            }`}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            FAQ & Standar
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">

          {/* ── TAB: Kategori ─────────────────────────────────────────── */}
          {activeTab === 'kategori' && (
            categories.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                Belum ada kategori sampah yang terdaftar di database.
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row h-full min-h-[360px]">
                {/* Category Sidebar */}
                <div className="w-full sm:w-44 shrink-0 border-b sm:border-b-0 sm:border-r border-slate-100 p-2 flex sm:flex-col gap-1 overflow-x-auto sm:overflow-y-auto bg-slate-50/50">
                  {categories.map((c, i) => (
                    <button
                      key={c.id}
                      onClick={() => setActiveCatIndex(i)}
                      className={`w-full text-left px-3 py-2.5 rounded-xl transition-all flex items-center justify-between gap-2 shrink-0 ${
                        activeCatIndex === i
                          ? 'bg-white text-emerald-900 font-bold border border-emerald-200/80 shadow-xs'
                          : 'text-slate-600 hover:bg-white/80 hover:text-slate-900'
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="text-xs truncate">{c.category_name}</p>
                        <p className="text-[10px] text-slate-400 font-normal">
                          {c.is_maggot_friendly ? 'Daur Ulang Sirkular' : 'Penanganan Khusus'}
                        </p>
                      </div>
                      <span className={`w-2 h-2 rounded-full shrink-0 ${c.is_maggot_friendly ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                    </button>
                  ))}
                </div>

                {/* Category Detail */}
                {guideline && currentCat && (
                  <div className="flex-1 p-5 overflow-y-auto space-y-4">
                    {/* Header Info */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
                      <div>
                        <h3 className="text-base font-bold text-slate-900">{currentCat.category_name}</h3>
                        <p className="text-xs text-slate-500 mt-0.5">{guideline.summary}</p>
                      </div>
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border uppercase tracking-wide ${
                        currentCat.is_maggot_friendly
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : 'bg-slate-50 text-slate-700 border-slate-200'
                      }`}>
                        {currentCat.is_maggot_friendly ? '✓ Daur Ulang Sirkular' : 'Penanganan Khusus / B3'}
                      </span>
                    </div>

                    {/* OK / Not OK Grids */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Boleh Dikumpulkan */}
                      <div className="rounded-xl border border-emerald-200/80 p-3.5 bg-emerald-50/50">
                        <p className="text-[11px] font-bold text-emerald-900 uppercase tracking-wide mb-2.5 flex items-center gap-1.5">
                          <svg className="w-3.5 h-3.5 text-emerald-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                          Boleh Dikumpulkan
                        </p>
                        <ul className="space-y-1.5">
                          {guideline.acceptable.map((item, j) => (
                            <li key={j} className="text-xs font-medium text-emerald-950 flex items-start gap-2 leading-relaxed">
                              <span className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 bg-emerald-600" />
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Sebaiknya Dihindari */}
                      <div className="rounded-xl border border-rose-200/80 p-3.5 bg-rose-50/50">
                        <p className="text-[11px] font-bold text-rose-900 uppercase tracking-wide mb-2.5 flex items-center gap-1.5">
                          <svg className="w-3.5 h-3.5 text-rose-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                          Sebaiknya Dihindari
                        </p>
                        <ul className="space-y-1.5">
                          {guideline.unacceptable.map((item, j) => (
                            <li key={j} className="text-xs font-medium text-rose-950 flex items-start gap-2 leading-relaxed">
                              <span className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 bg-rose-500" />
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    {/* Tips Kualitas (Clean Light Palette, Not Black!) */}
                    <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3.5">
                      <p className="text-[11px] font-bold text-slate-800 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5 text-emerald-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/></svg>
                        Tips Penanganan & Kualitas
                      </p>
                      <ul className="space-y-1.5">
                        {guideline.tips.map((tip, j) => (
                          <li key={j} className="text-xs text-slate-700 flex items-start gap-2 leading-relaxed">
                            <span className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 bg-emerald-600" />
                            <span>{tip}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            )
          )}

          {/* ── TAB: Langkah Pemilahan ────────────────────────────────── */}
          {activeTab === 'langkah' && (
            <div className="p-5 space-y-4">
              <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-4">
                <p className="text-xs font-bold text-emerald-950 mb-1 flex items-center gap-1.5">
                  <svg className="w-4 h-4 text-emerald-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                  Standar Pemilahan Sumber WarungSirkular
                </p>
                <p className="text-xs text-emerald-800 leading-relaxed">
                  Limbah anorganik dan pencemar lingkungan yang dipilah sejak dari warung mencegah pencemaran air dan tanah,
                  menghentikan penumpukan sampah di TPA, serta mendukung sirkularitas bahan daur ulang hingga <strong>100%</strong>.
                </p>
              </div>

              <div className="space-y-2.5">
                {DEFAULT_GUIDE_STEPS.map((step) => (
                  <div key={step.num} className="flex items-start gap-3.5 p-3.5 bg-white border border-slate-200/80 rounded-xl hover:border-emerald-300 transition-colors">
                    <div className="w-7 h-7 rounded-full bg-emerald-700 text-white flex items-center justify-center text-xs font-bold shrink-0">
                      {step.num}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-900 mb-0.5">{step.title}</p>
                      <p className="text-xs text-slate-600 leading-relaxed">{step.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Standar Kualitas (Clean Light Palette, Not Black!) */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                <p className="text-xs font-bold text-slate-900 mb-2.5 flex items-center gap-1.5">
                  <svg className="w-4 h-4 text-emerald-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 14 14"/></svg>
                  Standar Kelayakan Fisik
                </p>
                <div className="grid grid-cols-3 gap-2.5">
                  {DEFAULT_STANDARDS.map((m) => (
                    <div key={m.label} className="bg-white border border-slate-200 rounded-lg p-2.5 text-center shadow-xs">
                      <p className="text-sm font-black text-emerald-700">{m.value}</p>
                      <p className="text-[11px] font-semibold text-slate-800 leading-tight mt-0.5">{m.label}</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">{m.hint}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── TAB: FAQ ────────────────────────────────────────────────── */}
          {activeTab === 'faq' && (
            <div className="p-5 space-y-3">
              {DEFAULT_GUIDE_FAQS.map((faq, i) => (
                <details key={i} className="group border border-slate-200 rounded-xl overflow-hidden bg-white">
                  <summary className="flex items-start justify-between gap-3 p-3.5 cursor-pointer select-none hover:bg-slate-50 transition-colors list-none">
                    <span className="text-xs font-semibold text-slate-800 leading-relaxed">{faq.q}</span>
                    <svg
                      className="w-4 h-4 text-slate-400 shrink-0 mt-0.5 group-open:rotate-180 transition-transform"
                      viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </summary>
                  <div className="px-3.5 pb-3.5 border-t border-slate-100 bg-slate-50/50">
                    <p className="text-xs text-slate-600 leading-relaxed pt-2.5">{faq.a}</p>
                  </div>
                </details>
              ))}

              {/* Bantuan (Clean Light Palette, Not Black!) */}
              <div className="mt-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-center">
                <p className="text-xs font-bold text-emerald-950 mb-1">Pertanyaan Khusus Seputar Jenis Sampah?</p>
                <p className="text-xs text-emerald-800">
                  Konsultasikan langsung dengan kurir atau admin saat proses penjemputan berkala berlangsung.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between bg-slate-50/70 shrink-0">
          <span className="text-[11px] text-slate-500">WarungSirkular • Standar Operasional Pemilahan</span>
          <button
            onClick={onClose}
            className="text-xs font-semibold px-4 py-1.5 bg-emerald-700 text-white rounded-lg hover:bg-emerald-800 transition-colors shadow-xs"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  )
}

export default function WarungPage() {
  const router = useRouter()

  // User state
  const [me, setMe] = useState<AuthUser | null>(null)
  const [cats, setCats] = useState<Category[]>([])
  const [pickups, setPickups] = useState<Pickup[]>([])
  const [view, setView] = useState<View>('dashboard')
  const [selectedPickupId, setSelectedPickupId] = useState<string | null>(null)

  // Form state
  const [categoryId, setCategoryId] = useState('')
  const [weight, setWeight] = useState('')
  const [photoUrl, setPhotoUrl] = useState('')
  const [uploading, setUploading] = useState(false)
  const [loading, setLoading] = useState(false)

  // Step 2: schedule
  const [selectedDate, setSelectedDate] = useState<Date>(() => getWibStartOfDay())
  // Ref so realtime callbacks always read the latest selectedDate (avoids stale closure)
  const selectedDateRef = useRef(selectedDate)
  const [selectedTimeSlot, setSelectedTimeSlot] = useState('')
  const [timeSlots, setTimeSlots] = useState<{ label: string; avail: boolean; reason?: string }[]>([])
  const [slotsLoading, setSlotsLoading] = useState(false)

  // Step 3: location
  const [address, setAddress] = useState('')
  const [instructions, setInstructions] = useState('')
  const [pickupLat, setPickupLat] = useState<number>(-7.4726)
  const [pickupLng, setPickupLng] = useState<number>(110.2198)
  const [locating, setLocating] = useState(false)

  async function useMyLocation() {
    setLocating(true)
    try {
      const coords = await getCurrentPosition()
      setPickupLat(coords.latitude)
      setPickupLng(coords.longitude)
      toast.success('Titik lokasi berhasil disinkronkan dengan GPS Anda')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Gagal mendeteksi lokasi GPS')
    } finally {
      setLocating(false)
    }
  }

  // History filter + pagination
  const [histSearch, setHistSearch] = useState('')
  const [histStatusFilter, setHistStatusFilter] = useState<'all'|'pending'|'assigned'|'in_progress'|'completed'|'cancelled'>('all')
  const [histPage, setHistPage] = useState(1)
  const [histPageSize, setHistPageSize] = useState(8)

  // Pedoman Daur Ulang modal
  const [showGuideModal, setShowGuideModal] = useState(false)

  async function loadPickups() {
    try {
      const data = await apiGetWarungPickups()
      if (Array.isArray(data)) setPickups(data as unknown as Pickup[])
    } catch {
      /* ignore */
    }
  }

  async function load() {
    try {
      const [meUser, catsData, pickupsData, profData] = await Promise.all([
        apiGetMe(),
        apiGetCategories().catch(() => []),
        apiGetWarungPickups().catch(() => []),
        apiGetWarungProfile().catch(() => null),
      ])

      if (!meUser) { router.replace('/login'); return }
      if (meUser.role !== 'warung') { router.replace(`/${meUser.role}`); return }
      setMe(meUser)

      if (Array.isArray(catsData)) setCats(catsData as unknown as Category[])
      if (Array.isArray(pickupsData)) setPickups(pickupsData as unknown as Pickup[])
      if (profData) {
        const w = profData as { address?: string; latitude?: number; longitude?: number }
        if (w.address) setAddress((prev) => prev || w.address!)
        if (w.latitude != null) setPickupLat(Number(w.latitude))
        if (w.longitude != null) setPickupLng(Number(w.longitude))
      }
    } catch {
      /* ignore */
    }
  }

  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadSlots(date: Date, isSilent = false) {
    if (!isSilent) setSlotsLoading(true)
    try {
      const dateStr = getWibDateString(date)
      const res = await apiGetSlots(dateStr)
      if (!res || !Array.isArray(res.slots)) return
      setTimeSlots(res.slots)
      setSelectedTimeSlot((prev) =>
        prev && res.slots.some((s: { label: string; avail: boolean }) => s.label === prev && s.avail)
          ? prev
          : ''
      )
    } finally {
      if (!isSilent) setSlotsLoading(false)
    }
  }

  useEffect(() => {
    selectedDateRef.current = selectedDate
    loadSlots(selectedDate, timeSlots.length > 0)
  }, [selectedDate]) // eslint-disable-line react-hooks/exhaustive-deps

  // Refresh slots when user navigates to the schedule step
  useEffect(() => {
    if (view === 'create-step2') {
      loadSlots(selectedDateRef.current, timeSlots.length > 0)
    }
  }, [view]) // eslint-disable-line react-hooks/exhaustive-deps

  const realtimeStatus = useRealtimeTables(
    ['pickup_requests', 'collector_profiles', 'routes', 'route_stops'],
    (event) => {
      // Selalu perbarui riwayat jemputan warung di background (tanpa mengganggu input/state)
      loadPickups()

      // Jendela waktu (slots) HANYA di-refresh jika ada perubahan riil dari database
      // yaitu ketika collector mengubah jam layanan (collector_profiles) atau ada order baru (pickup_requests)
      if (
        event?.isRealtimeEvent &&
        (event.table === 'collector_profiles' || event.table === 'pickup_requests')
      ) {
        loadSlots(selectedDateRef.current, true) // Silent refresh di background
      }
    }
  )

  // Notifikasi dinamis berbasis data riil jemputan warung
  const notifications = useMemo<AppNotification[]>(() => {
    const list: AppNotification[] = []
    pickups.forEach((p) => {
      const catName = p.waste_categories?.category_name || 'Limbah Sirkular'
      const code = p.id.slice(0, 6).toUpperCase()
      // Gunakan resolveStatus agar expired ter-detect real-time di UI
      const status = resolveStatus(p)

      if (status === 'completed') {
        list.push({
          id: `pickup-${p.id}-completed`,
          title: `Penimbangan Selesai (${p.actual_weight_kg ?? p.estimated_weight_kg} kg)`,
          message: `Jemputan #${code} (${catName}) telah ditimbang & selesai diproses oleh kurir.`,
          time: p.completed_at || p.created_at || new Date().toISOString(),
          type: 'success',
          linkView: 'history',
        })
      } else if (status === 'in_progress') {
        list.push({
          id: `pickup-${p.id}-inprogress`,
          title: `Kurir Bergerak Menuju Warung Anda`,
          message: `Kurir sedang menuju lokasi untuk jemputan #${code}. Harap siapkan ember/wadah sampah.`,
          time: p.assigned_at || p.created_at || new Date().toISOString(),
          type: 'info',
          linkView: 'pickup-status',
        })
      } else if (status === 'assigned') {
        list.push({
          id: `pickup-${p.id}-assigned`,
          title: `Kurir Ditugaskan (#${code})`,
          message: `Kurir telah menerima jadwal jemputan sampah ${catName} (${p.estimated_weight_kg} kg).`,
          time: p.assigned_at || p.created_at || new Date().toISOString(),
          type: 'info',
          linkView: 'pickup-status',
        })
      } else if (status === 'expired') {
        list.push({
          id: `pickup-${p.id}-expired`,
          title: `Jemputan #${code} Kadaluarsa`,
          message: `Permohonan jemput ${catName} tidak sempat diproses dalam jendela waktu. Silakan buat baru.`,
          time: p.pickup_window_end || p.created_at || new Date().toISOString(),
          type: 'alert',
          linkView: 'history',
        })
      } else if (status === 'pending') {
        list.push({
          id: `pickup-${p.id}-pending`,
          title: `Permohonan Terkirim (#${code})`,
          message: `Permohonan jemput ${catName} (${p.estimated_weight_kg} kg) sedang menunggu kurir.`,
          time: p.created_at || new Date().toISOString(),
          type: 'warning',
          linkView: 'pickup-status',
        })
      } else if (status === 'cancelled' || status === 'failed') {
        list.push({
          id: `pickup-${p.id}-cancelled`,
          title: `Jemputan #${code} Dibatalkan/Gagal`,
          message: `Permohonan jemputan tidak dapat diproses. Silakan jadwalkan ulang.`,
          time: p.created_at || new Date().toISOString(),
          type: 'alert',
          linkView: 'history',
        })
      }
    })
    return list
  }, [pickups])

  // Search items autocomplete dinamis
  const searchItems = useMemo<SearchItem[]>(() => {
    const items: SearchItem[] = [
      {
        id: 'menu-create',
        title: 'Buat Permohonan Jemput Baru',
        subtitle: 'Ajukan jadwal penjemputan limbah anorganik & jelantah warung',
        category: 'Menu',
        badge: 'Buat',
        badgeColor: 'emerald',
        onSelect: () => setView('create-step1'),
      },
      {
        id: 'menu-status',
        title: 'Status & Pelacakan Kurir',
        subtitle: 'Pantau posisi dan 4-tahap verifikasi jemputan aktif',
        category: 'Menu',
        badge: 'Live',
        badgeColor: 'blue',
        onSelect: () => setView('pickup-status'),
      },
      {
        id: 'menu-history',
        title: 'Riwayat Penjemputan',
        subtitle: 'Daftar semua transaksi dan catatan berat timbangan',
        category: 'Menu',
        badge: 'Riwayat',
        badgeColor: 'slate',
        onSelect: () => setView('history'),
      },
      {
        id: 'menu-impact',
        title: 'Statistik & Dampak Lingkungan',
        subtitle: 'Total emisi CO2 dicegah dan limbah didaur ulang',
        category: 'Menu',
        badge: 'Eco',
        badgeColor: 'emerald',
        onSelect: () => setView('impact'),
      },
    ]

    pickups.forEach((p) => {
      const code = p.id.slice(0, 8).toUpperCase()
      const catName = p.waste_categories?.category_name || 'Anorganik'
      const dateStr = formatWIBDate(p.pickup_window_start, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
      items.push({
        id: `search-p-${p.id}`,
        title: `Jemputan #${code} (${catName})`,
        subtitle: `Status: ${p.status.toUpperCase()} • Estimasi: ${p.estimated_weight_kg} kg • ${dateStr}`,
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
          setHistSearch(p.id.slice(0, 6))
          if (p.status === 'completed' || p.status === 'cancelled') {
            setView('history')
          } else {
            setView('pickup-status')
          }
        },
      })
    })

    return items
  }, [pickups])

  async function createPickup() {
    if (!photoUrl) return toast.error('Unggah foto pratinjau sampah terlebih dahulu!')
    if (!categoryId) return toast.error('Pilih kategori sampah!')
    if (!weight || Number(weight) <= 0) return toast.error('Estimasi berat harus lebih dari 0 kg!')
    if (!selectedTimeSlot) return toast.error('Pilih jendela waktu yang tersedia!')
    setLoading(true)
    try {
      // Parse slot label like "07:00 – 09:00 WIB" or "07:00 - 09:00 WIB"
      const match = /(\d{1,2}):(\d{2})\s*[-–]\s*(\d{1,2}):(\d{2})/.exec(selectedTimeSlot)
      let startH = 7
      let startM = 0
      let endH = 9
      let endM = 0

      if (match) {
        startH = parseInt(match[1], 10)
        startM = parseInt(match[2], 10)
        endH = parseInt(match[3], 10)
        endM = parseInt(match[4], 10)
      } else {
        const singleMatch = /(\d{1,2}):(\d{2})/.exec(selectedTimeSlot)
        if (singleMatch) {
          startH = parseInt(singleMatch[1], 10)
          startM = parseInt(singleMatch[2], 10)
          endH = startH + 2
          endM = startM
        }
      }

      const dateStr = getWibDateString(selectedDate)
      const winStartIso = buildWibIsoString(dateStr, startH, startM)
      const winEndIso = buildWibIsoString(dateStr, endH, endM)

      await apiCreatePickup({
        waste_category_id: categoryId,
        estimated_weight_kg: Number(weight),
        pickup_window_start: winStartIso,
        pickup_window_end: winEndIso,
        sample_photo_url: photoUrl,
        latitude: pickupLat,
        longitude: pickupLng,
        address: address.trim(),
        notes: instructions.trim(),
      })
      toast.success('Pickup request berhasil dibuat!')
      setCategoryId('')
      setWeight('')
      setPhotoUrl('')
      setInstructions('')
      const p = await apiGetWarungPickups()
      if (Array.isArray(p)) setPickups(p as unknown as Pickup[])
      setView('dashboard')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Terjadi kesalahan saat memproses permohonan'
      toast.error(msg, { duration: 5000 })
      // Jika penolakan disebabkan kurir tidak melayani jam ini, slot ditutup, atau kuota habis:
      if (
        msg.toLowerCase().includes('slot') ||
        msg.toLowerCase().includes('collector') ||
        msg.toLowerCase().includes('kurir') ||
        msg.toLowerCase().includes('jam') ||
        msg.toLowerCase().includes('kuota')
      ) {
        // Otomatis kembalikan ke Step 2 agar user dapat memilih jendela waktu yang valid
        setView('create-step2')
        setSelectedTimeSlot('')
        loadSlots(selectedDateRef.current, false)
      }
    } finally { setLoading(false) }
  }

  async function uploadPhoto(file: File | null) {
    if (!file) return
    setUploading(true)
    try {
      const compressed = await compressImage(file)
      const url = await apiUpload(compressed)
      setPhotoUrl(url)
      toast.success('Foto sampah berhasil diunggah ✓')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Gagal upload foto')
    } finally { setUploading(false) }
  }

  async function cancelPickup(id: string) {
    try {
      await apiCancelWarungPickup(id)
      toast.success('Request penjemputan berhasil dibatalkan')
      const p = await apiGetWarungPickups()
      if (Array.isArray(p)) setPickups(p as unknown as Pickup[])
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Gagal membatalkan request')
    }
  }

  async function logout() {
    await apiLogout()
    router.replace('/login')
  }

  // Derived stats
  const completedPickups = pickups.filter((p) => p.status === 'completed')
  const totalWeight = completedPickups.reduce((s, p) => s + Number(p.actual_weight_kg ?? 0), 0)
  const activePickup = pickups.find((p) => p.status === 'in_progress' || p.status === 'assigned' || p.status === 'pending')
  const histFiltered = pickups.filter((p) => {
    const matchSearch = histSearch === '' || p.id.toLowerCase().includes(histSearch.toLowerCase()) || p.status.includes(histSearch.toLowerCase())
    const matchStatus = histStatusFilter === 'all' || p.status === histStatusFilter
    return matchSearch && matchStatus
  })
  const histTotalPages = Math.max(1, Math.ceil(histFiltered.length / histPageSize))
  const histPaged = histFiltered.slice((histPage - 1) * histPageSize, histPage * histPageSize)

  // Calendar helpers
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const calYear = selectedDate.getFullYear()
  const calMonth = selectedDate.getMonth()
  const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December']
  const firstDay = new Date(calYear, calMonth, 1).getDay()
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate()
  const prevMonth = () => {
    const prev = new Date(calYear, calMonth - 1, 1)
    // Don't navigate to months entirely in the past
    if (prev.getFullYear() > today.getFullYear() || (prev.getFullYear() === today.getFullYear() && prev.getMonth() >= today.getMonth())) {
      setSelectedDate(prev)
    }
  }
  const nextMonth = () => setSelectedDate(new Date(calYear, calMonth + 1, 1))

  const breadcrumbMap: Record<View, string> = {
    'dashboard': 'Overview',
    'create-step1': 'Create Pickup',
    'create-step2': 'Schedule Pickup',
    'create-step3': 'Pickup Location',
    'create-step4': 'Review & Submit',
    'history': 'Pickup History',
    'pickup-status': 'Pickup Status',
    'impact': 'Impact Report',
    'profile': 'Profil Pengguna',
  }

  // ─── Views ────────────────────────────────────────────────────────────────

  const renderDashboard = () => (
    <div className="flex flex-col lg:flex-row gap-6">
      {/* Left Main column */}
      <div className="flex-1 flex flex-col gap-5 min-w-0">
        {/* Welcome banner */}
        <div className="ws-card overflow-hidden bg-white">
          <div className="relative p-5 sm:p-6 bg-gradient-to-r from-emerald-50 via-teal-50/50 to-white">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-3 max-w-xl flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <div className="sm:hidden w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/></svg>
                  </div>
                  <h2 className="text-lg sm:text-2xl font-bold text-slate-900 truncate">
                    Welcome back, {me?.name?.split(' ')[0] ?? 'Partner'}!
                  </h2>
                </div>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  Warung Anda telah mendaur ulang <strong className="text-emerald-700">{totalWeight.toFixed(1)} kg</strong> limbah anorganik. Bersama mencegah pencemaran lingkungan!
                </p>
                <div className="flex flex-col sm:flex-row gap-2 pt-1">
                  <button className="ws-btn-primary w-full sm:w-auto justify-center text-xs py-2.5 px-4 font-semibold shadow-xs" onClick={() => setView('create-step1')}>
                    {IC.plus} <span>Buat Pickup Request</span>
                  </button>
                  <button className="ws-btn-outline w-full sm:w-auto justify-center text-xs py-2.5 px-4 font-semibold" onClick={() => setView('history')}>
                    <span>Lihat Riwayat</span>
                  </button>
                </div>
              </div>

              {/* Large leaf illustration on desktop only */}
              <div className="hidden sm:flex w-24 h-24 sm:w-32 sm:h-32 rounded-2xl bg-emerald-100/70 items-center justify-center shrink-0 shadow-inner text-emerald-600">
                <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/></svg>
              </div>
            </div>
          </div>
        </div>

        {/* 3 Stat cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          {[
            { label: 'TOTAL RECYCLED', value: `${totalWeight.toFixed(0)} kg`, trend: '+12% month', icon: IC.recycle, color: '#059669', bg: '#ecfdf5' },
            { label: 'IMPACT POINTS', value: `${Math.round(totalWeight * 17)}`, trend: '+450 pts', icon: IC.star, color: '#7c3aed', bg: '#f5f3ff' },
            { label: 'PICKUPS DONE', value: `${completedPickups.length}`, trend: '+3 complete', icon: IC.check, color: '#0891b2', bg: '#ecfeff' },
          ].map((s) => (
            <div key={s.label} className="ws-card p-4 sm:p-5 flex flex-col justify-between">
              <span className="text-[11px] font-bold text-slate-400 tracking-wider">{s.label}</span>
              <div className="flex items-center justify-between my-2">
                <span className="text-2xl font-extrabold text-slate-900">{s.value}</span>
                <div style={{ backgroundColor: s.bg, color: s.color }} className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0">
                  {s.icon}
                </div>
              </div>
              <p className="text-xs font-semibold text-emerald-700 flex items-center gap-1 mt-1">
                {IC.trending} <span>{s.trend}</span>
              </p>
            </div>
          ))}
        </div>

        {/* Active Pickup Card */}
        <div className="ws-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <span className="text-slate-500"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></span> Active Pickup Request
            </h3>
            {activePickup && (
              <button
                className="text-xs font-semibold text-emerald-700 hover:underline flex items-center gap-1"
                onClick={() => setView('pickup-status')}
              >
                Track details {IC.chevronRight}
              </button>
            )}
          </div>
          {activePickup ? (
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
              {activePickup.sample_photo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={activePickup.sample_photo_url}
                  alt="Foto Sampah"
                  className="w-20 h-20 rounded-xl object-cover border border-slate-200 shrink-0"
                />
              ) : (
                <div className="w-20 h-20 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 shrink-0"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg></div>
              )}
              <div className="flex-1 min-w-0 space-y-1.5 w-full">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-slate-900">
                    Pickup #{activePickup.id.slice(-6).toUpperCase()}
                  </span>
                  <StatusBadge pickup={activePickup} />
                </div>
                <p className="text-xs text-slate-500 flex items-center gap-1 truncate">
                  {IC.pin} Est. {activePickup.estimated_weight_kg} kg • {activePickup.waste_categories?.category_name ?? 'Anorganik'}
                </p>
                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-600 rounded-full transition-all"
                    style={{ width: activePickup.status === 'completed' ? '100%' : activePickup.status === 'in_progress' ? '70%' : '35%' }}
                  />
                </div>
                <div className="flex flex-wrap gap-4 text-xs text-slate-500 pt-1">
                  <span className="flex items-center gap-1">
                    {IC.calendar} {formatWIBDate(activePickup.pickup_window_start)}
                  </span>
                  <span className="flex items-center gap-1">
                    {IC.clock} {formatWIBTimeRange(activePickup.pickup_window_start, activePickup.pickup_window_end)}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-slate-400">
              <p className="text-xs">Belum ada request aktif. Klik tombol di bawah untuk membuat jadwal penjemputan.</p>
              <button className="ws-btn-primary mt-3 text-xs" onClick={() => setView('create-step1')}>
                {IC.plus} Buat Jadwal Pickup
              </button>
            </div>
          )}
        </div>

        {/* Recent Pickups Table Card */}
        <div className="ws-card">
          <div className="p-4 border-b border-slate-100 flex justify-between items-center">
            <h3 className="text-sm font-bold text-slate-900">Recent Pickups</h3>
            <button className="text-xs font-semibold text-emerald-700 hover:underline" onClick={() => setView('history')}>
              View All
            </button>
          </div>
          <div className="divide-y divide-slate-100">
            {pickups.slice(0, 4).map((p) => (
              <div key={p.id} className="p-3.5 sm:px-4 flex items-center justify-between gap-3 hover:bg-slate-50/70 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-emerald-800">
                    {p.status === 'completed' ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg> : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-800">#{p.id.slice(-6).toUpperCase()}</p>
                    <p className="text-[11px] text-slate-400">{p.waste_categories?.category_name ?? 'Anorganik'}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold text-slate-800">{p.actual_weight_kg ?? p.estimated_weight_kg} kg</p>
                  <StatusBadge pickup={p} />
                </div>
              </div>
            ))}
            {pickups.length === 0 && (
              <div className="p-6 text-center text-xs text-slate-400">Belum ada riwayat penjemputan.</div>
            )}
          </div>
        </div>
      </div>

      {/* Right Sidebar */}
      <div className="w-full lg:w-72 flex flex-col gap-5 shrink-0">
        {/* Recycling Tip */}
        <div className="bg-emerald-900 rounded-xl p-5 text-white shadow-sm">
          <div className="flex items-center gap-2 mb-2.5">
            <span className="text-emerald-300"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3"/></svg></span>
            <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-200">Recycling Tip</h4>
          </div>
          <p className="text-xs text-emerald-100 leading-relaxed mb-4">
            Pisahkan kardus, botol plastik, dan jerigen minyak jelantah sebelum dijemput. 1 liter jelantah yang dicegah mencemari hingga 1 juta liter air bersih!
          </p>
          <button
            onClick={() => setShowGuideModal(true)}
            className="text-xs font-semibold bg-white/15 hover:bg-white/25 text-white px-3 py-1.5 rounded-lg transition-colors w-full"
          >
            Pelajari Pedoman Daur Ulang
          </button>
        </div>

        {/* Real Interactive Map Card */}
        {(() => {
          const validPickups = pickups.filter(p => p.status !== 'cancelled')
          const mapCenter: [number, number] =
            validPickups.length > 0 && validPickups[0].latitude != null
              ? [Number(validPickups[0].latitude), Number(validPickups[0].longitude)]
              : [pickupLat, pickupLng]

          return (
            <div className="ws-card p-4">
              <div className="flex items-center justify-between mb-1">
                <h4 className="text-xs font-bold text-slate-900">Impact Map</h4>
                <span className="text-[10px] text-emerald-800 font-bold bg-emerald-100 px-2 py-0.5 rounded-full">
                  {validPickups.length} Titik
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mb-3">Sebaran penjemputan aktif & selesai</p>
              <div className="h-48 w-full rounded-lg overflow-hidden border border-slate-200">
                <ClientMap
                  center={mapCenter}
                  zoom={14}
                  height="h-48"
                  markers={validPickups.map(p => ({
                    id: p.id,
                    lat: Number(p.latitude) || pickupLat,
                    lng: Number(p.longitude) || pickupLng,
                    label: `Pickup #${p.id.slice(-6).toUpperCase()} • ${p.waste_categories?.category_name ?? 'Anorganik'} (${p.actual_weight_kg ?? p.estimated_weight_kg} kg)`
                  }))}
                />
              </div>
            </div>
          )
        })()}
      </div>
    </div>
  )

  // ─── Step 1 ───────────────────────────────────────────────────────────────

  const renderStep1 = () => (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-xl sm:text-2xl font-bold text-slate-900 mb-1">Schedule Pickup</h1>
      <p className="text-xs sm:text-sm text-slate-500 mb-6">Pilih kategori sampah dan masukkan estimasi berat bahan daur ulang.</p>
      <StepWizard current={1} />

      <div className="ws-card p-6 space-y-5">
        <h3 className="text-sm font-bold text-slate-900">Informasi Sampah</h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1.5">Kategori Sampah</label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 outline-hidden focus:ring-1 focus:ring-emerald-600 focus:bg-white"
            >
              <option value="">-- Pilih Kategori --</option>
              {cats.map((c) => (
                <option key={c.id} value={c.id}>{c.category_name} {c.is_maggot_friendly ? '(Maggot-friendly)' : ''}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1.5">Estimasi Berat (kg)</label>
            <input
              type="number"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              placeholder="mis. 12.5"
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 outline-hidden focus:ring-1 focus:ring-emerald-600 focus:bg-white"
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-bold text-slate-700 block mb-1.5">Foto Pratinjau Sampah (Wajib)</label>
          <div className="border-2 border-dashed border-slate-200 hover:border-emerald-500 rounded-xl p-6 text-center bg-slate-50/50 transition-colors">
            {photoUrl ? (
              <div className="flex flex-col items-center gap-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photoUrl} alt="Preview" className="h-32 object-cover rounded-lg border border-slate-200 shadow-xs" />
                <p className="text-xs font-bold text-emerald-700">✓ Foto berhasil diunggah</p>
                <label className="text-xs text-slate-500 underline cursor-pointer">
                  Ganti Foto
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => uploadPhoto(e.target.files?.[0] ?? null)} />
                </label>
              </div>
            ) : (
              <label className="flex flex-col items-center cursor-pointer">
                <span className="mb-2 text-slate-400"><svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg></span>
                <span className="text-xs font-semibold text-slate-700">Klik untuk mengunggah foto sampah</span>
                <span className="text-[11px] text-slate-400 mt-1">Format JPG, PNG, atau WebP (Maks 5MB)</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  disabled={uploading}
                  onChange={(e) => uploadPhoto(e.target.files?.[0] ?? null)}
                  className="hidden"
                />
                <span className="ws-btn-outline mt-3 text-xs">
                  {uploading ? 'Mengunggah...' : 'Pilih File Foto'}
                </span>
              </label>
            )}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:justify-end gap-2 pt-3 border-t border-slate-100">
          <button
            className="ws-btn-primary w-full sm:w-auto justify-center text-xs py-2.5 px-5 font-semibold transition-all shadow-xs"
            disabled={!categoryId || !weight || !photoUrl}
            onClick={() => setView('create-step2')}
            style={{ opacity: !categoryId || !weight || !photoUrl ? 0.5 : 1 }}
          >
            <span>Lanjut: Pilih Waktu</span>
            {IC.chevronRight}
          </button>
        </div>
      </div>
    </div>
  )

  // ─── Step 2 ───────────────────────────────────────────────────────────────

  const renderStep2 = () => (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-xl sm:text-2xl font-bold text-slate-900 mb-1">Schedule Pickup</h1>
      <p className="text-xs sm:text-sm text-slate-500 mb-6">Pilih tanggal dan jendela waktu kedatangan kurir.</p>
      <StepWizard current={2} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Calendar */}
        <div className="ws-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              {IC.calendar} Pilih Tanggal
            </h4>
            <div className="flex items-center gap-1">
              <button onClick={prevMonth} className="w-7 h-7 rounded-md border border-slate-200 flex items-center justify-center text-xs hover:bg-slate-50">
                {IC.chevronLeft}
              </button>
              <span className="text-xs font-bold text-slate-800 px-2">{monthNames[calMonth]} {calYear}</span>
              <button onClick={nextMonth} className="w-7 h-7 rounded-md border border-slate-200 flex items-center justify-center text-xs hover:bg-slate-50">
                {IC.chevronRight}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-xs">
            {['Min','Sen','Sel','Rab','Kam','Jum','Sab'].map(d => (
              <div key={d} className="text-[10px] font-bold text-slate-400 py-1">{d}</div>
            ))}
            {Array(firstDay).fill(null).map((_, i) => <div key={`e${i}`} />)}
            {Array(daysInMonth).fill(null).map((_, i) => {
              const day = i + 1
              const date = new Date(calYear, calMonth, day)
              date.setHours(0, 0, 0, 0)
              const isSelected = date.toDateString() === selectedDate.toDateString()
              const isPast = date < today
              const isToday = date.toDateString() === today.toDateString()
              return (
                <button
                  key={day}
                  disabled={isPast}
                  onClick={() => !isPast && setSelectedDate(date)}
                  className={`w-full p-1 sm:p-2 rounded-lg text-[11px] sm:text-xs font-semibold transition-all aspect-square flex items-center justify-center ${
                    isPast
                      ? 'text-slate-300 cursor-not-allowed'
                      : isSelected
                      ? 'bg-emerald-800 text-white shadow-xs'
                      : isToday
                      ? 'ring-2 ring-emerald-400 text-emerald-800 bg-emerald-50'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {day}
                </button>
              )
            })}
          </div>
        </div>

        {/* Time Slots */}
        <div className="ws-card p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                {IC.clock} Jendela Waktu
              </h4>
              <button
                type="button"
                onClick={() => loadSlots(selectedDateRef.current, false)}
                disabled={slotsLoading}
                className="text-[11px] font-medium text-slate-400 hover:text-emerald-700 flex items-center gap-1 transition-colors px-2 py-0.5 rounded hover:bg-emerald-50"
                title="Segarkan ketersediaan slot waktu"
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={slotsLoading ? 'animate-spin text-emerald-600' : ''}
                >
                  <polyline points="23 4 23 10 17 10" />
                  <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                </svg>
                <span>{slotsLoading ? 'Memeriksa...' : 'Cek Slot'}</span>
              </button>
            </div>

            {/* Selected date summary */}
            <p className="text-[11px] text-slate-500 mb-2 flex items-center gap-1">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              {formatWIBDate(selectedDate, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </p>

            <div className="space-y-2">
              {slotsLoading && timeSlots.length === 0 ? (
                <div className="flex flex-col items-center py-6 gap-2">
                  <div className="w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                  <p className="text-xs text-slate-400">Memuat jendela waktu...</p>
                </div>
              ) : timeSlots.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-4">Tidak ada slot tersedia untuk tanggal ini.</p>
              ) : (
                timeSlots.map((slot) => {
                  const isSelected = selectedTimeSlot === slot.label
                  return (
                    <button
                      key={slot.label}
                      disabled={!slot.avail}
                      onClick={() => setSelectedTimeSlot(slot.label)}
                      className={`w-full p-3 rounded-lg border text-left flex items-center justify-between transition-all ${
                        isSelected
                          ? 'border-emerald-600 bg-emerald-50 text-emerald-900 font-semibold'
                          : slot.avail
                          ? 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                          : 'border-slate-100 bg-slate-50 text-slate-300 cursor-not-allowed'
                      }`}
                    >
                      <div>
                        <p className="text-xs">{slot.label}</p>
                        <span className={`text-[10px] ${slot.avail ? 'text-emerald-700 font-bold' : 'text-rose-500'}`}>
                          {slot.avail ? 'Slot Tersedia' : (slot.reason ?? 'Penuh')}
                        </span>
                      </div>
                      {isSelected && <span className="text-emerald-700 font-bold">✓</span>}
                    </button>
                  )
                })
              )}
            </div>
          </div>

          <div className="flex flex-col-reverse sm:flex-row justify-between items-stretch sm:items-center gap-2 pt-4 border-t border-slate-100 mt-4">
            <button className="ws-btn-outline w-full sm:w-auto justify-center text-xs py-2.5 px-4 font-semibold" onClick={() => setView('create-step1')}>
              {IC.chevronLeft} <span>Kembali</span>
            </button>
            <button
              className="ws-btn-primary w-full sm:w-auto justify-center text-xs py-2.5 px-5 font-semibold transition-all shadow-xs"
              disabled={!selectedTimeSlot}
              style={{ opacity: !selectedTimeSlot ? 0.5 : 1 }}
              onClick={() => {
                if (!selectedTimeSlot) return toast.error('Pilih jendela waktu terlebih dahulu!')
                // Validasi langsung apakah slot yang dipilih tersedia
                const currentSlot = timeSlots.find((s) => s.label === selectedTimeSlot)
                if (currentSlot && !currentSlot.avail) {
                  return toast.error(`Jadwal gagal: ${currentSlot.reason || 'Tidak ada kurir yang beroperasi di jam ini atau kuota penuh'}`)
                }
                setView('create-step3')
              }}
            >
              <span>Lanjut: Lokasi</span>
              {IC.chevronRight}
            </button>
          </div>
        </div>
      </div>
    </div>
  )

  // ─── Step 3 (Interactive Map Location) ────────────────────────────────────

  const renderStep3 = () => (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-xl sm:text-2xl font-bold text-slate-900 mb-1">Pickup Location</h1>
      <p className="text-xs sm:text-sm text-slate-500 mb-6">Tentukan pin lokasi penjemputan pada peta dan konfirmasi alamat Anda.</p>
      <StepWizard current={3} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Map and Address form */}
        <div className="lg:col-span-2 ws-card p-5 space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1.5">Alamat Lengkap</label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Jl. Kaliurang KM 5 No. 12, Sleman, Yogyakarta"
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 outline-hidden focus:ring-1 focus:ring-emerald-600 focus:bg-white"
            />
          </div>

          {/* Real Leaflet Map */}
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
              <label className="text-xs font-bold text-slate-700">Pin Lokasi Peta (Klik peta untuk memindahkan pin)</label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={useMyLocation}
                  disabled={locating}
                  className="ws-btn-outline text-[11px] py-1 px-2.5 text-emerald-800 border-emerald-300 hover:bg-emerald-50 shrink-0 flex items-center gap-1"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
                  {locating ? 'Mencari GPS...' : 'Gunakan GPS Saya'}
                </button>
                <span className="text-[11px] text-emerald-700 font-mono">
                  {pickupLat.toFixed(5)}, {pickupLng.toFixed(5)}
                </span>
              </div>
            </div>
            <div className="h-64 rounded-xl overflow-hidden border border-slate-200">
              <ClientMap
                center={[pickupLat, pickupLng]}
                zoom={14}
                height="h-64"
                markers={[{ id: 'pickup-target', lat: pickupLat, lng: pickupLng, label: address || 'Lokasi Penjemputan', selected: true }]}
                onClick={(lat, lng) => {
                  setPickupLat(lat)
                  setPickupLng(lng)
                  toast.success('Koordinat lokasi penjemputan diperbarui')
                }}
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1.5">Catatan Tambahan untuk Kurir (Opsional)</label>
            <textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              rows={2}
              placeholder="mis. Di dekat gerbang biru samping warung, tolong hubungi saat tiba."
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 outline-hidden focus:ring-1 focus:ring-emerald-600 focus:bg-white resize-none"
            />
          </div>
        </div>

        {/* Sidebar Summary */}
        <div className="ws-card p-5 flex flex-col justify-between">
          <div className="space-y-4">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Ringkasan Sementara</h4>
            <div className="bg-slate-50 rounded-xl p-3.5 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Estimasi:</span>
                <span className="font-bold text-slate-800">{weight || 0} kg</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Jadwal:</span>
                <span className="font-bold text-slate-800">{formatWIBDate(selectedDate)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Waktu:</span>
                <span className="font-bold text-slate-800">{selectedTimeSlot}</span>
              </div>
            </div>
          </div>

          <div className="space-y-2 pt-4">
            <button className="ws-btn-primary w-full justify-center text-xs" onClick={() => setView('create-step4')}>
              Lanjut: Review & Submit {IC.chevronRight}
            </button>
            <button className="ws-btn-outline w-full justify-center text-xs" onClick={() => setView('create-step2')}>
              {IC.chevronLeft} Kembali
            </button>
          </div>
        </div>
      </div>
    </div>
  )

  // ─── Step 4 (Review) ──────────────────────────────────────────────────────

  const renderStep4 = () => (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-xl sm:text-2xl font-bold text-slate-900 mb-1">Review & Submit</h1>
      <p className="text-xs sm:text-sm text-slate-500 mb-6">Pastikan semua data penjemputan sudah benar sebelum konfirmasi.</p>
      <StepWizard current={4} />

      <div className="ws-card p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Detail Permohonan</h3>
            <p className="text-xs text-slate-400 font-mono">Ref ID: WS-REQ-6204</p>
          </div>
          <span className="ws-badge-pending">Pending Confirmation</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-slate-50 rounded-xl p-4">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Estimasi Muatan</span>
            <p className="text-2xl font-extrabold text-slate-900 mt-1">{weight} kg</p>
            <p className="text-xs font-semibold text-emerald-700">{cats.find(c => c.id === categoryId)?.category_name ?? 'Anorganik'}</p>
          </div>
          <div className="bg-slate-50 rounded-xl p-4">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Jadwal Penjemputan</span>
            <p className="text-sm font-bold text-slate-900 mt-1">{formatWIBDate(selectedDate, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
            <p className="text-xs text-slate-500">{selectedTimeSlot}</p>
          </div>
        </div>

        <div className="bg-slate-50 rounded-xl p-4">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Lokasi Penjemputan</span>
          <p className="text-xs font-bold text-slate-900 mt-1">{address || 'Lokasi Warung Terdaftar'}</p>
          <p className="text-[11px] text-slate-500 mt-0.5">Koordinat: {pickupLat.toFixed(5)}, {pickupLng.toFixed(5)}</p>
        </div>

        {instructions && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 text-xs text-amber-900">
            <strong className="block font-bold mb-0.5">Catatan Kurir:</strong>
            {instructions}
          </div>
        )}

        <div className="flex flex-col-reverse sm:flex-row justify-between items-stretch sm:items-center gap-2 pt-3 border-t border-slate-100">
          <button className="ws-btn-outline text-xs sm:w-auto" onClick={() => setView('create-step3')}>
            {IC.chevronLeft} Ubah Lokasi
          </button>
          <button className="ws-btn-primary text-xs w-full sm:w-auto" onClick={createPickup} disabled={loading}>
            {loading ? 'Mengirim Permohonan...' : 'Konfirmasi & Kirim Request'}
          </button>
        </div>
      </div>
    </div>
  )

  // ─── History ──────────────────────────────────────────────────────────────

  const renderHistory = () => {
    const statusTabs: { value: 'all'|'pending'|'assigned'|'in_progress'|'completed'|'cancelled'; label: string }[] = [
      { value: 'all', label: 'Semua' },
      { value: 'pending', label: 'Pending' },
      { value: 'assigned', label: 'Assigned' },
      { value: 'in_progress', label: 'In Progress' },
      { value: 'completed', label: 'Selesai' },
      { value: 'cancelled', label: 'Dibatalkan' },
    ]
    return (
    <div className="space-y-4 sm:space-y-5">
      <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 truncate">Pickup History</h1>
            <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${
              realtimeStatus === 'connected'
                ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                : realtimeStatus === 'error'
                ? 'text-rose-600 bg-rose-50 border-rose-200'
                : 'text-amber-600 bg-amber-50 border-amber-200'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${
                realtimeStatus === 'connected'
                  ? 'bg-emerald-500 animate-pulse'
                  : realtimeStatus === 'error'
                  ? 'bg-rose-500'
                  : 'bg-amber-400 animate-pulse'
              }`} />
              {realtimeStatus === 'connected'
                ? 'Live · Auto-update aktif'
                : realtimeStatus === 'error'
                ? 'Realtime terputus'
                : 'Menghubungkan...'}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">Semua riwayat permohonan daur ulang warung Anda.</p>
        </div>
        <button
          className="ws-btn-primary w-full sm:w-auto justify-center text-xs py-2.5 px-4 font-semibold shadow-xs shrink-0"
          onClick={() => setView('create-step1')}
        >
          {IC.plus} <span>Request Baru</span>
        </button>
      </div>

      <div className="ws-card">
        {/* Filter bar */}
        <div className="p-4 border-b border-slate-100 flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row gap-3 justify-between items-stretch sm:items-center">
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 max-w-sm flex-1">
              <span className="text-slate-400"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></span>
              <input
                type="text"
                placeholder="Cari ID pickup atau kategori..."
                value={histSearch}
                onChange={(e) => { setHistSearch(e.target.value); setHistPage(1) }}
                className="bg-transparent border-none text-xs outline-hidden w-full"
              />
              {histSearch && (
                <button onClick={() => { setHistSearch(''); setHistPage(1) }} className="text-slate-400 hover:text-slate-700">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              )}
            </div>
            <span className="text-xs text-slate-400 shrink-0">{histFiltered.length} data ditemukan</span>
          </div>
          {/* Status tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar flex-nowrap">
            {statusTabs.map((tab) => {
              const count = tab.value === 'all' ? pickups.length : pickups.filter(p => p.status === tab.value).length
              return (
                <button
                  key={tab.value}
                  onClick={() => { setHistStatusFilter(tab.value); setHistPage(1) }}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border shrink-0 ${
                    histStatusFilter === tab.value
                      ? 'bg-emerald-800 text-white border-emerald-800'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {tab.label} <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${histStatusFilter === tab.value ? 'bg-emerald-700 text-white' : 'bg-slate-100 text-slate-500'}`}>{count}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Mobile: stacked cards */}
        <div className="sm:hidden divide-y divide-slate-100">
          {histPaged.length === 0 && (
            <p className="p-6 text-center text-xs text-slate-400">Tidak ada data riwayat pickup.</p>
          )}
          {histPaged.map((p) => (
            <div key={p.id} className="p-4 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono font-bold text-xs">#{p.id.slice(-6).toUpperCase()}</span>
                <StatusBadge pickup={p} />
              </div>
              <p className="text-xs text-slate-500 truncate">
                {formatWIBDate(p.pickup_window_start)} • {formatWIBTimeRange(p.pickup_window_start, p.pickup_window_end)}
              </p>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-slate-600 truncate">{p.waste_categories?.category_name ?? 'Anorganik'} • <strong className="text-slate-800">{p.actual_weight_kg ?? p.estimated_weight_kg} kg</strong></span>
                <button
                  onClick={() => {
                    setSelectedPickupId(p.id)
                    setView('pickup-status')
                  }}
                  className="text-xs font-semibold text-emerald-700 hover:underline shrink-0"
                >
                  Lacak
                </button>
              </div>
              {p.status === 'pending' && (
                <button
                  onClick={() => cancelPickup(p.id)}
                  className="text-xs font-semibold text-rose-600 hover:underline"
                >
                  Batalkan
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Desktop: table */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="ws-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>WAKTU JADWAL</th>
                <th>KATEGORI</th>
                <th>BERAT</th>
                <th>STATUS</th>
                <th className="text-right">AKSI</th>
              </tr>
            </thead>
            <tbody>
              {histPaged.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-xs text-slate-400">
                    Tidak ada data riwayat pickup.
                  </td>
                </tr>
              )}
              {histPaged.map((p) => (
                <tr key={p.id}>
                  <td className="font-mono font-bold text-xs">#{p.id.slice(-6).toUpperCase()}</td>
                  <td className="text-xs">
                    {formatWIBDate(p.pickup_window_start)} • {formatWIBTimeRange(p.pickup_window_start, p.pickup_window_end)}
                  </td>
                  <td className="text-xs">{p.waste_categories?.category_name ?? 'Anorganik'}</td>
                  <td className="text-xs font-bold">{p.actual_weight_kg ?? p.estimated_weight_kg} kg</td>
                  <td><StatusBadge pickup={p} /></td>
                  <td className="text-right space-x-2">
                    <button
                      onClick={() => {
                        setSelectedPickupId(p.id)
                        setView('pickup-status')
                      }}
                      className="text-xs font-semibold text-emerald-700 hover:underline"
                    >
                      Lacak
                    </button>
                    {p.status === 'pending' && (
                      <button
                        onClick={() => cancelPickup(p.id)}
                        className="text-xs font-semibold text-rose-600 hover:underline"
                      >
                        Batalkan
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <Pagination
          currentPage={histPage}
          totalItems={histFiltered.length}
          pageSize={histPageSize}
          onPageChange={(p) => setHistPage(p)}
          onPageSizeChange={(s) => { setHistPageSize(s); setHistPage(1) }}
        />
      </div>
    </div>
    )
  }



  // ─── Pickup Status ────────────────────────────────────────────────────────

  const renderPickupStatus = () => {
    const tracked = (selectedPickupId ? pickups.find(p => p.id === selectedPickupId) : null) ?? activePickup ?? null

    if (!tracked) {
      return (
        <div className="max-w-md mx-auto ws-card p-6 sm:p-8 text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>
          </div>
          <h2 className="text-xl font-bold text-slate-900">Tidak Ada Penjemputan Aktif</h2>
          <p className="text-xs text-slate-500">
            Saat ini tidak ada permohonan penjemputan sampah yang sedang berlangsung.
          </p>
          <div className="flex flex-col sm:flex-row gap-2 pt-2">
            <button className="ws-btn-primary w-full sm:flex-1 justify-center text-xs py-2.5 px-4 font-semibold shadow-xs" onClick={() => setView('create-step1')}>
              {IC.plus} <span>Buat Pickup Baru</span>
            </button>
            <button className="ws-btn-outline w-full sm:flex-1 justify-center text-xs py-2.5 px-4 font-semibold shadow-xs" onClick={() => setView('history')}>
              <span>Lihat Riwayat</span>
            </button>
          </div>
        </div>
      )
    }

    const isCompleted = tracked.status === 'completed'
    const isInProgress = tracked.status === 'in_progress'
    const isAssigned = tracked.status === 'assigned'
    const isPending = tracked.status === 'pending'

    const steps = [
      { label: 'Request Created', desc: 'Permohonan penjemputan telah tercatat.', done: true, active: false },
      { label: 'Assigned', desc: isAssigned ? 'Kurir telah ditugaskan menuju lokasi warung Anda.' : isPending ? 'Menunggu kurir mengambil rute penjemputan...' : 'Kurir telah ditugaskan.', done: isAssigned || isInProgress || isCompleted, active: isAssigned },
      { label: 'In Progress', desc: isInProgress ? 'Kurir sedang dalam perjalanan ke warung Anda.' : isCompleted ? 'Kurir telah tiba di warung Anda.' : 'Menunggu kurir bergerak.', done: isInProgress || isCompleted, active: isInProgress },
      { label: 'Completed', desc: isCompleted ? `Sampah selesai ditimbang (${tracked.actual_weight_kg ?? tracked.estimated_weight_kg} kg).` : 'Penimbangan sampah di warung.', done: isCompleted, active: false },
    ]

    return (
      <div className="space-y-4 sm:space-y-5 max-w-5xl mx-auto">
        {/* ── Top Bar & Actions ── */}
        <div className="space-y-3 pb-3 border-b border-slate-100">
          {/* Breadcrumb / Back Navigation */}
          

          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div className="space-y-1.5 min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg sm:text-2xl font-bold text-slate-900 tracking-tight">Status Pelacakan Penjemputan</h1>
                <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${
                  realtimeStatus === 'connected'
                    ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                    : realtimeStatus === 'error'
                    ? 'text-rose-600 bg-rose-50 border-rose-200'
                    : 'text-amber-600 bg-amber-50 border-amber-200'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${
                    realtimeStatus === 'connected'
                      ? 'bg-emerald-500 animate-pulse'
                      : realtimeStatus === 'error'
                      ? 'bg-rose-500'
                      : 'bg-amber-400 animate-pulse'
                  }`} />
                  {realtimeStatus === 'connected'
                    ? 'Live · Auto-update'
                    : realtimeStatus === 'error'
                    ? 'Offline'
                    : 'Menghubungkan...'}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500 flex-wrap">
                <span className="font-mono font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">ID: #{tracked.id.slice(-6).toUpperCase()}</span>
                <span className="text-slate-300">•</span>
                <span className="text-slate-600 font-medium bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded border border-emerald-100">
                  {tracked.waste_categories?.category_name ?? 'Anorganik'}
                </span>
              </div>
            </div>

            {/* Action buttons: 2-columns on mobile, inline on desktop */}
            <div className="grid grid-cols-2 sm:flex sm:flex-row gap-2 w-full sm:w-auto shrink-0">
              <button
                className="ws-btn-outline justify-center text-xs py-2 px-3 font-semibold shadow-xs"
                onClick={() => setView('history')}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
                <span className="truncate">Semua Request</span>
              </button>
              <button
                className="ws-btn-primary justify-center text-xs py-2 px-3 font-semibold shadow-xs"
                onClick={() => setView('create-step1')}
              >
                {IC.plus} <span className="truncate">Request Baru</span>
              </button>
            </div>
          </div>
        </div>

        {isCompleted && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-emerald-700 text-white font-bold text-sm flex items-center justify-center shrink-0">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
              <div>
                <h4 className="text-xs sm:text-sm font-bold text-emerald-950">Penjemputan Telah Selesai</h4>
                <p className="text-[11px] sm:text-xs text-emerald-700">Sampah berhasil ditimbang dan diambil oleh kurir mitra.</p>
              </div>
            </div>
            <div className="text-left sm:text-right border-t sm:border-t-0 pt-2 sm:pt-0 border-emerald-200/60 w-full sm:w-auto">
              <span className="text-xs font-bold text-emerald-900 block">Berat Aktual: {tracked.actual_weight_kg ?? tracked.estimated_weight_kg} kg</span>
              <span className="text-[11px] text-emerald-700 font-semibold">+{Math.round(Number(tracked.actual_weight_kg ?? tracked.estimated_weight_kg) * 17)} Poin Daur Ulang</span>
            </div>
          </div>
        )}

        {/* ── Main Layout: Map & Stepper ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Progress Timeline — order-2 on mobile, order-1 on desktop */}
          <div className="order-2 lg:order-1 lg:col-span-2 space-y-4">
            <div className="ws-card p-4 sm:p-6">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-2">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                  <span>Progress Alur Penjemputan</span>
                </h3>
                <span className="text-[11px] font-semibold text-slate-400">
                  {isCompleted ? 'Selesai' : isInProgress ? 'Dalam Perjalanan' : isAssigned ? 'Kurir Ditugaskan' : 'Menunggu Kurir'}
                </span>
              </div>

              <div className="space-y-5 sm:space-y-6">
                {steps.map((s, i) => (
                  <div key={s.label} className="flex gap-3 sm:gap-4">
                    <div className="flex flex-col items-center">
                      <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-colors ${
                        s.done
                          ? 'bg-emerald-700 text-white shadow-xs'
                          : s.active
                          ? 'bg-emerald-100 text-emerald-800 ring-2 ring-emerald-600'
                          : 'bg-slate-100 text-slate-400'
                      }`}>
                        {s.done ? (
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                        ) : i + 1}
                      </div>
                      {i < steps.length - 1 && (
                        <div className={`w-0.5 h-10 sm:h-12 ${s.done ? 'bg-emerald-600' : 'bg-slate-200'}`} />
                      )}
                    </div>
                    <div className="pt-0.5 min-w-0 flex-1">
                      <p className={`text-xs sm:text-sm font-bold ${s.active ? 'text-emerald-800' : 'text-slate-800'}`}>{s.label}</p>
                      <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5 leading-relaxed">{s.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              {isPending && (
                <div className="mt-5 pt-3.5 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                  <span className="text-[11px] text-slate-400">Ingin membatalkan jadwal?</span>
                  <button
                    onClick={() => cancelPickup(tracked.id)}
                    className="text-xs font-semibold text-rose-600 hover:text-rose-700 hover:underline inline-flex items-center gap-1.5"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    <span>Batalkan Permohonan</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Real Leaflet Map for Pickup Tracking — order-1 on mobile, order-2 on desktop */}
          <div className="order-1 lg:order-2 space-y-4">
            <div className="ws-card p-4 sm:p-5">
              <div className="flex items-center justify-between mb-2.5">
                <h4 className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-2">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
                  <span>Lokasi Penjemputan</span>
                </h4>
                <span className="text-[10px] text-slate-400 font-medium">Peta Interaktif</span>
              </div>

              <div className="h-44 sm:h-56 rounded-xl overflow-hidden border border-slate-200 shadow-inner">
                <ClientMap
                  center={[Number(tracked.latitude) || -7.4726, Number(tracked.longitude) || 110.2198]}
                  zoom={14}
                  height="h-44 sm:h-56"
                  markers={[{ id: tracked.id, lat: Number(tracked.latitude) || -7.4726, lng: Number(tracked.longitude) || 110.2198, label: 'Lokasi Warung Anda' }]}
                />
              </div>

              <div className="mt-3 text-xs space-y-2 text-slate-600 bg-slate-50/80 p-3 rounded-lg border border-slate-100">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-baseline gap-0.5 sm:gap-2">
                  <span className="text-slate-400 text-[11px] font-medium">Jadwal Penjemputan</span>
                  <span className="font-semibold text-slate-800 text-xs sm:text-right break-words">
                    {formatWIBDate(tracked.pickup_window_start)} • {formatWIBTimeRange(tracked.pickup_window_start, tracked.pickup_window_end)}
                  </span>
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-slate-200/50">
                  <span className="text-slate-400 text-[11px] font-medium">Estimasi Muatan</span>
                  <span className="font-bold text-emerald-800">{tracked.estimated_weight_kg} kg</span>
                </div>
                {tracked.actual_weight_kg != null && (
                  <div className="flex items-center justify-between pt-1 border-t border-slate-200/50">
                    <span className="text-slate-400 text-[11px] font-medium">Berat Aktual</span>
                    <span className="font-bold text-emerald-900">{tracked.actual_weight_kg} kg</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ─── Impact Report ────────────────────────────────────────────────────────

  const renderImpact = () => {
    const wasteComposition = [
      { label: 'Kardus & Karton', value: 35, color: '#059669' },
      { label: 'Botol PET & Plastik', value: 25, color: '#0891b2' },
      { label: 'Minyak Jelantah', value: 20, color: '#d97706' },
      { label: 'Kaleng & Logam', value: 20, color: '#7c3aed' },
    ]
    const perfData = [{ label: 'Weight', values: [120, 180, 240, 310, 420, 560, 680] }]
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul']

    return (
      <div className="space-y-5">
        <div className="ws-card bg-gradient-to-r from-emerald-50 via-emerald-100 to-teal-100 text-emerald-950 p-6 sm:p-8 rounded-2xl">
          <span className="text-[10px] font-bold tracking-widest text-emerald-800 uppercase">Impact Analytics</span>
          <h2 className="text-xl sm:text-3xl font-extrabold mt-1 mb-2 text-emerald-950">Laporan Dampak Lingkungan</h2>
          <p className="text-xs sm:text-sm text-emerald-900 max-w-xl">
            Setiap kilogram limbah anorganik dan liter minyak jelantah yang Anda kelola mencegah pencemaran tanah dan perairan, serta mendukung bahan baku industri sirkular.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'SAMPAH TERKUMPUL', value: `${totalWeight.toFixed(1)} kg`, color: 'text-emerald-600', icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3"/></svg> },
            { label: 'OFFSET KARBON', value: `${(totalWeight * 2.1).toFixed(1)} kg CO2e`, color: 'text-green-600', icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/></svg> },
            { label: 'PENGALIHAN TPA', value: '94%', color: 'text-blue-600', icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg> },
            { label: 'AIR DIHEMAT', value: `${(totalWeight * 0.4).toFixed(1)} kL`, color: 'text-cyan-600', icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg> },
          ].map((s) => (
            <div key={s.label} className="ws-card p-5">
              <span className={s.color}>{s.icon}</span>
              <p className="text-[11px] font-bold text-slate-400 mt-2">{s.label}</p>
              <p className="text-2xl font-extrabold text-slate-900 mt-1">{s.value}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 ws-card p-5">
            <h4 className="text-xs font-bold text-slate-800 mb-3">Tren Penjemputan (kg)</h4>
            <div className="h-48">
              <LineChart data={perfData} labels={months} height={190} />
            </div>
          </div>
          <div className="ws-card p-5 flex flex-col justify-between">
            <h4 className="text-xs font-bold text-slate-800 mb-3">Komposisi Sampah</h4>
            <div className="flex justify-center my-2">
              <DonutChart segments={wasteComposition} size={130} />
            </div>
            <div className="space-y-1.5 text-xs">
              {wasteComposition.map(c => (
                <div key={c.label} className="flex justify-between items-center">
                  <span className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c.color }} />
                    <span className="text-slate-600">{c.label}</span>
                  </span>
                  <span className="font-bold text-slate-800">{c.value}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <AppShell
      role="warung"
      userName={me?.name ?? 'Warung Partner'}
      userRole="Warung Owner"
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
      searchPlaceholder="Cari jemputan, status, kategori..."
    >
      {/* Indikator status realtime */}
      {view !== 'history' && view !== 'pickup-status' && (
        <div className="flex items-center justify-end mb-2">
          <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full border ${
            realtimeStatus === 'connected'
              ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
              : realtimeStatus === 'error'
              ? 'text-rose-600 bg-rose-50 border-rose-200'
              : 'text-amber-600 bg-amber-50 border-amber-200'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${
              realtimeStatus === 'connected'
                ? 'bg-emerald-500 animate-pulse'
                : realtimeStatus === 'error'
                ? 'bg-rose-500'
                : 'bg-amber-400 animate-pulse'
            }`}></span>
            {realtimeStatus === 'connected'
              ? 'Live · Auto-update aktif'
              : realtimeStatus === 'error'
              ? 'Realtime terputus · Polling aktif'
              : 'Menghubungkan realtime...'}
          </span>
        </div>
      )}

      {view === 'dashboard' && renderDashboard()}
      {view === 'create-step1' && renderStep1()}
      {view === 'create-step2' && renderStep2()}
      {view === 'create-step3' && renderStep3()}
      {view === 'create-step4' && renderStep4()}
      {view === 'history' && renderHistory()}
      {view === 'pickup-status' && renderPickupStatus()}
      {view === 'impact' && renderImpact()}

      {/* ─── Modal Pedoman Daur Ulang ─────────────────────────────────── */}
      {showGuideModal && <RecyclingGuideModal categories={cats} onClose={() => setShowGuideModal(false)} />}
    </AppShell>
  )
}
