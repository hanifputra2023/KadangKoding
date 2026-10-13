"use client"

import { ReactNode, useState, useEffect, useRef, useMemo } from 'react'
import { AppNotification, SearchItem } from '@/lib/types/notifications'
import ProfileView from './ProfileView'

function IconDashboard() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
    </svg>
  )
}
function IconPickups() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><polyline points="8 12 12 16 16 12"/><line x1="12" y1="8" x2="12" y2="16"/>
    </svg>
  )
}
function IconRoutes() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
    </svg>
  )
}
function IconHistory() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="12 8 12 12 14 14"/><path d="M3.05 11a9 9 0 1 0 .5-4.5"/>
      <polyline points="3 3 3 9 9 9"/>
    </svg>
  )
}
function IconAdmin() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>
  )
}
function IconLogout() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  )
}
function IconBell() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
    </svg>
  )
}
function IconSearch() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>
  )
}
function IconMenu() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/>
    </svg>
  )
}
function IconClose() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  )
}
function IconCheckCircle() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
    </svg>
  )
}
function IconArrowLeft() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
    </svg>
  )
}

type Role = 'warung' | 'collector' | 'admin'

interface NavItem {
  label: string
  icon: ReactNode
  view: string
}

const warungNavItems: NavItem[] = [
  { label: 'Dashboard', icon: <IconDashboard />, view: 'dashboard' },
  { label: 'Pickups', icon: <IconPickups />, view: 'create-step1' },
  { label: 'History', icon: <IconHistory />, view: 'history' },
  { label: 'Status', icon: <IconRoutes />, view: 'pickup-status' },
  { label: 'Impact', icon: <IconDashboard />, view: 'impact' },
]

const collectorNavItems: NavItem[] = [
  { label: 'Dashboard', icon: <IconDashboard />, view: 'dashboard' },
  { label: 'Pickups', icon: <IconPickups />, view: 'available' },
  { label: 'Routes', icon: <IconRoutes />, view: 'selected' },
  { label: 'Map', icon: <IconRoutes />, view: 'route-map' },
  { label: 'Current', icon: <IconPickups />, view: 'current-stop' },
  { label: 'History', icon: <IconHistory />, view: 'completed' },
]

const adminNavItems: NavItem[] = [
  { label: 'Overview', icon: <IconDashboard />, view: 'overview' },
  { label: 'Management', icon: <IconPickups />, view: 'management' },
  { label: 'Audit Log', icon: <IconAdmin />, view: 'audit' },
]

interface AppShellProps {
  role: Role
  userName: string
  userRole: string
  currentView: string
  onNavigate: (view: string) => void
  onLogout: () => void
  breadcrumb?: string
  children: ReactNode
  // New interactive capabilities
  userId?: string
  userEmail?: string
  userPhone?: string
  onProfileUpdated?: (updated: { name: string; phone_number?: string }) => void
  notifications?: AppNotification[]
  onNotificationClick?: (notification: AppNotification) => void
  searchItems?: SearchItem[]
  searchPlaceholder?: string
}

function formatRelativeTime(dateInput: string | Date): string {
  try {
    const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput
    if (isNaN(d.getTime())) return 'Baru saja'
    const now = new Date()
    const diffSec = Math.floor((now.getTime() - d.getTime()) / 1000)
    if (diffSec < 60) return 'Baru saja'
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)} mnt lalu`
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} jam lalu`
    if (diffSec < 172800) return 'Kemarin'
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
  } catch {
    return 'Baru saja'
  }
}

export default function AppShell({
  role,
  userName,
  userRole,
  currentView,
  onNavigate,
  onLogout,
  breadcrumb,
  children,
  userId,
  userEmail,
  userPhone,
  onProfileUpdated,
  notifications = [],
  onNotificationClick,
  searchItems = [],
  searchPlaceholder = 'Cari jemputan, warung, status...',
}: AppShellProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  
  // Notification popover state
  const [notifOpen, setNotifOpen] = useState(false)
  const [notifTab, setNotifTab] = useState<'all' | 'unread'>('all')
  const [readNotifIds, setReadNotifIds] = useState<string[]>([])
  const [dismissedNotifIds, setDismissedNotifIds] = useState<string[]>([])
  const notifRef = useRef<HTMLDivElement>(null)

  // Search state
  const [searchQuery, setSearchQuery] = useState('')
  const [searchFocused, setSearchFocused] = useState(false)
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)

  // Storage keys keyed by userId or role
  const storageKey = `ws_read_notifs_${userId || role}`
  const dismissStorageKey = `ws_dismissed_notifs_${userId || role}`

  // Load read & dismissed notifications from localStorage
  useEffect(() => {
    try {
      const savedRead = localStorage.getItem(storageKey)
      if (savedRead) setReadNotifIds(JSON.parse(savedRead))

      const savedDismissed = localStorage.getItem(dismissStorageKey)
      if (savedDismissed) setDismissedNotifIds(JSON.parse(savedDismissed))
    } catch {
      /* ignore */
    }
  }, [storageKey, dismissStorageKey])

  const saveReadIds = (ids: string[]) => {
    setReadNotifIds(ids)
    try {
      localStorage.setItem(storageKey, JSON.stringify(ids))
    } catch {
      /* ignore */
    }
  }

  const markAsRead = (id: string) => {
    if (!readNotifIds.includes(id)) {
      saveReadIds([...readNotifIds, id])
    }
  }

  const markAllAsRead = () => {
    const allIds = notifications.map((n) => n.id)
    saveReadIds(Array.from(new Set([...readNotifIds, ...allIds])))
  }

  const dismissNotif = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    const newDismissed = Array.from(new Set([...dismissedNotifIds, id]))
    setDismissedNotifIds(newDismissed)
    // Also mark as read when dismissed
    const newRead = Array.from(new Set([...readNotifIds, id]))
    setReadNotifIds(newRead)
    try {
      localStorage.setItem(dismissStorageKey, JSON.stringify(newDismissed))
      localStorage.setItem(storageKey, JSON.stringify(newRead))
    } catch {
      /* ignore */
    }
  }

  const dismissAllNotifs = () => {
    const allIds = notifications.map((n) => n.id)
    const newDismissed = Array.from(new Set([...dismissedNotifIds, ...allIds]))
    const newRead = Array.from(new Set([...readNotifIds, ...allIds]))
    setDismissedNotifIds(newDismissed)
    setReadNotifIds(newRead)
    try {
      localStorage.setItem(dismissStorageKey, JSON.stringify(newDismissed))
      localStorage.setItem(storageKey, JSON.stringify(newRead))
    } catch {
      /* ignore */
    }
  }

  // Visible notifications = not yet dismissed
  const visibleNotifications = useMemo(() => {
    return notifications.filter((n) => !dismissedNotifIds.includes(n.id))
  }, [notifications, dismissedNotifIds])

  const unreadCount = useMemo(() => {
    return visibleNotifications.filter((n) => !readNotifIds.includes(n.id) && !n.read).length
  }, [visibleNotifications, readNotifIds])

  const displayedNotifications = useMemo(() => {
    if (notifTab === 'unread') {
      return visibleNotifications.filter((n) => !readNotifIds.includes(n.id) && !n.read)
    }
    return visibleNotifications
  }, [visibleNotifications, notifTab, readNotifIds])

  // Filtered search results
  const filteredSearchItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return []
    return searchItems
      .filter((item) =>
        item.title.toLowerCase().includes(q) ||
        item.subtitle.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q)
      )
      .slice(0, 8)
  }, [searchItems, searchQuery])

  // Close popovers on click outside or escape key
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false)
      }
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchFocused(false)
        setMobileSearchOpen(false)
      }
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setNotifOpen(false)
        setSearchFocused(false)
        setMobileSearchOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  const navItems =
    role === 'warung'
      ? warungNavItems
      : role === 'collector'
      ? collectorNavItems
      : adminNavItems

  const initials = userName
    ? userName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
    : 'WS'

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col md:flex-row text-slate-800">
      {/* Mobile Drawer Overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar (Desktop & Mobile Drawer) */}
      <aside
        className={`fixed md:sticky top-0 left-0 bottom-0 z-50 h-screen w-64 md:w-28 bg-white border-r border-slate-200 flex flex-col transition-transform duration-200 ease-in-out ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* Logo */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-700 flex items-center justify-center text-white shrink-0 shadow-xs">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                <polyline points="9 22 9 12 15 12 15 22"/>
              </svg>
            </div>
            <div className="md:hidden flex flex-col">
              <span className="font-bold text-emerald-950 text-sm leading-tight">WarungSirkular</span>
              <span className="text-[10px] text-slate-400 capitalize">{role} Portal</span>
            </div>
          </div>
          <button
            className="md:hidden p-1 rounded-md text-slate-500 hover:bg-slate-100"
            onClick={() => setMobileMenuOpen(false)}
          >
            <IconClose />
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 p-2 md:p-1.5 flex flex-col gap-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = currentView.startsWith(item.view.split('-')[0]) || currentView === item.view
            return (
              <button
                key={item.view}
                onClick={() => {
                  onNavigate(item.view)
                  setMobileMenuOpen(false)
                }}
                className={`flex md:flex-col items-center gap-3 md:gap-1 p-2.5 md:p-2 rounded-lg text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-emerald-50 text-emerald-800 font-semibold shadow-xs'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-emerald-700'
                }`}
              >
                <div className={isActive ? 'text-emerald-700' : 'text-slate-400'}>
                  {item.icon}
                </div>
                <span>{item.label}</span>
              </button>
            )
          })}
        </nav>

        {/* Bottom Actions */}
        <div className="p-2 md:p-1.5 border-t border-slate-200 flex flex-col gap-1">
          <button
            type="button"
            onClick={() => {
              onNavigate('profile')
              setMobileMenuOpen(false)
            }}
            className={`flex md:flex-col items-center gap-3 md:gap-1 p-2.5 md:p-2 rounded-lg text-xs font-medium transition-colors w-full ${
              currentView === 'profile'
                ? 'bg-emerald-50 text-emerald-800 font-semibold shadow-xs'
                : 'text-slate-600 hover:bg-slate-50 hover:text-emerald-700'
            }`}
          >
            <div className={currentView === 'profile' ? 'text-emerald-700' : 'text-slate-400'}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </div>
            <span>Profil Saya</span>
          </button>
          <button
            onClick={onLogout}
            className="flex md:flex-col items-center gap-3 md:gap-1 p-2.5 md:p-2 rounded-lg text-xs font-medium text-rose-600 hover:bg-rose-50 transition-colors w-full"
          >
            <IconLogout />
            <span>Log Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <header className="sticky top-0 z-30 h-14 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between gap-3 shadow-xs">
          {/* Left Topbar: Mobile Logo & Breadcrumb */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            {/* Mobile Logo (Menggantikan hamburger burger menu) */}
            <button
              type="button"
              onClick={() => onNavigate(navItems[0].view)}
              className="md:hidden flex items-center gap-1.5 shrink-0 active:scale-95 transition-transform"
              title="Kembali ke Beranda"
            >
              <div className="w-8 h-8 rounded-lg bg-emerald-700 flex items-center justify-center text-white shadow-xs">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                  <polyline points="9 22 9 12 15 12 15 22"/>
                </svg>
              </div>
            </button>

            <div className="h-4 w-px bg-slate-200 md:hidden shrink-0" />

            <div className="flex items-center gap-1.5 text-xs truncate">
              <span className="text-slate-400 hidden sm:inline">Dashboard</span>
              <span className="text-slate-300 hidden sm:inline">/</span>
              <span className="text-slate-800 font-semibold truncate capitalize">
                {currentView === 'profile' ? 'Profil Pengguna' : (breadcrumb ?? 'Overview')}
              </span>
            </div>
          </div>

          {/* Right Topbar items */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Mobile Search Trigger Button */}
            <button
              onClick={() => setMobileSearchOpen(true)}
              className="sm:hidden w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50"
              title="Cari"
            >
              <IconSearch />
            </button>

            {/* Desktop Search Input Container */}
            <div ref={searchRef} className="relative hidden sm:block">
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 w-48 md:w-64 focus-within:ring-1 focus-within:ring-emerald-600 focus-within:bg-white transition-all">
                <span className="text-slate-400 shrink-0"><IconSearch /></span>
                <input
                  type="text"
                  placeholder={searchPlaceholder}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => setSearchFocused(true)}
                  className="bg-transparent border-none text-xs outline-hidden w-full text-slate-700 placeholder:text-slate-400"
                />
                {searchQuery && (
                  <button
                    onClick={() => {
                      setSearchQuery('')
                      setSearchFocused(false)
                    }}
                    className="text-slate-400 hover:text-slate-600 shrink-0 p-0.5"
                  >
                    <IconClose />
                  </button>
                )}
              </div>

              {/* Desktop Live Search Results Dropdown */}
              {searchFocused && searchQuery.trim().length > 0 && (
                <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-white rounded-xl shadow-xl border border-slate-200 py-2 z-50 max-h-96 overflow-y-auto animate-in fade-in slide-in-from-top-1 duration-150">
                  <div className="px-3 py-1.5 border-b border-slate-100 flex items-center justify-between text-[11px] text-slate-400 font-medium">
                    <span>Hasil Pencarian ({filteredSearchItems.length})</span>
                    <span className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-500">ESC untuk tutup</span>
                  </div>

                  {filteredSearchItems.length === 0 ? (
                    <div className="px-4 py-6 text-center text-slate-400 text-xs">
                      <div className="mb-2 flex justify-center text-slate-300"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></div>
                      Tidak ada hasil yang cocok dengan &quot;{searchQuery}&quot;
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-50">
                      {filteredSearchItems.map((item) => (
                        <button
                          key={item.id}
                          onClick={() => {
                            item.onSelect()
                            setSearchFocused(false)
                            setSearchQuery('')
                          }}
                          className="w-full text-left px-3.5 py-2.5 hover:bg-emerald-50/60 transition-colors flex items-start justify-between gap-2 group"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold text-slate-800 group-hover:text-emerald-800 truncate">
                                {item.title}
                              </span>
                              {item.badge && (
                                <span className={`text-[10px] px-1.5 py-0.2 rounded font-medium ${
                                  item.badgeColor === 'emerald'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : item.badgeColor === 'blue'
                                    ? 'bg-blue-100 text-blue-800'
                                    : item.badgeColor === 'amber'
                                    ? 'bg-amber-100 text-amber-800'
                                    : item.badgeColor === 'rose'
                                    ? 'bg-rose-100 text-rose-800'
                                    : 'bg-slate-100 text-slate-600'
                                }`}>
                                  {item.badge}
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                              {item.subtitle}
                            </p>
                          </div>
                          <span className="text-[10px] font-medium text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded shrink-0">
                            {item.category}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Mobile Search Overlay Full-Screen */}
            {mobileSearchOpen && (
              <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs sm:hidden flex flex-col animate-in fade-in duration-150">
                {/* Mobile Search Bar at Top */}
                <div className="bg-white px-3 py-2.5 border-b border-slate-200 flex items-center gap-2 shadow-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setMobileSearchOpen(false)
                      setSearchQuery('')
                    }}
                    className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 shrink-0"
                    aria-label="Tutup pencarian"
                  >
                    <IconArrowLeft />
                  </button>
                  <div className="flex-1 flex items-center gap-2 bg-slate-100 rounded-lg px-3 py-2 border border-slate-200 focus-within:bg-white focus-within:border-emerald-600 focus-within:ring-1 focus-within:ring-emerald-600">
                    <span className="text-slate-400 shrink-0"><IconSearch /></span>
                    <input
                      type="text"
                      autoFocus
                      placeholder={searchPlaceholder}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="bg-transparent border-none text-xs outline-hidden w-full text-slate-800 placeholder:text-slate-400"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery('')}
                        className="text-slate-400 hover:text-slate-600 p-0.5"
                      >
                        <IconClose />
                      </button>
                    )}
                  </div>
                </div>

                {/* Mobile Search Results */}
                <div className="bg-white max-h-[75vh] overflow-y-auto divide-y divide-slate-100 shadow-xl">
                  <div className="px-4 py-2 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-[11px] text-slate-400 font-medium">
                    <span>Hasil Pencarian ({searchQuery.trim() ? filteredSearchItems.length : searchItems.length})</span>
                    <span className="text-[10px] text-slate-500">
                      {searchQuery.trim() ? 'Ketik untuk memfilter' : 'Saran menu & data'}
                    </span>
                  </div>

                  {(searchQuery.trim().length > 0 ? filteredSearchItems : searchItems.slice(0, 6)).length === 0 ? (
                    <div className="px-4 py-10 text-center text-slate-400 text-xs">
                      <div className="mb-2 flex justify-center text-slate-300"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></div>
                      Tidak ada hasil yang cocok dengan &quot;{searchQuery}&quot;
                    </div>
                  ) : (
                    (searchQuery.trim().length > 0 ? filteredSearchItems : searchItems.slice(0, 6)).map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          item.onSelect()
                          setMobileSearchOpen(false)
                          setSearchQuery('')
                        }}
                        className="w-full text-left px-4 py-3 hover:bg-emerald-50/60 active:bg-emerald-100 transition-colors flex items-start justify-between gap-2"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-slate-800 truncate">
                              {item.title}
                            </span>
                            {item.badge && (
                              <span className={`text-[10px] px-1.5 py-0.2 rounded font-medium ${
                                item.badgeColor === 'emerald'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : item.badgeColor === 'blue'
                                  ? 'bg-blue-100 text-blue-800'
                                  : item.badgeColor === 'amber'
                                  ? 'bg-amber-100 text-amber-800'
                                  : item.badgeColor === 'rose'
                                  ? 'bg-rose-100 text-rose-800'
                                  : 'bg-slate-100 text-slate-600'
                              }`}>
                                {item.badge}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500 line-clamp-2 mt-0.5">
                            {item.subtitle}
                          </p>
                        </div>
                        <span className="text-[10px] font-medium text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded shrink-0">
                          {item.category}
                        </span>
                      </button>
                    ))
                  )}
                </div>

                {/* Click outside to close backdrop */}
                <div
                  className="flex-1"
                  onClick={() => {
                    setMobileSearchOpen(false)
                    setSearchQuery('')
                  }}
                />
              </div>
            )}

            {/* Notification Bell with Dropdown */}
            <div ref={notifRef} className="relative">
              <button
                onClick={() => setNotifOpen((prev) => !prev)}
                className={`w-8 h-8 rounded-lg border flex items-center justify-center transition-colors relative shrink-0 ${
                  notifOpen
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-700 shadow-xs'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
                title="Notifikasi"
              >
                <IconBell />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-white animate-pulse">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {/* Notification Popover */}
              {notifOpen && (
                <div className="fixed inset-x-3 top-16 sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 w-auto sm:w-96 bg-white rounded-2xl shadow-2xl sm:shadow-xl border border-slate-200 py-3 z-50 animate-in fade-in slide-in-from-top-1 duration-150">
                  {/* Header */}
                  <div className="px-4 pb-2.5 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-slate-800 text-sm">Notifikasi</h3>
                      {unreadCount > 0 && (
                        <span className="bg-rose-100 text-rose-700 text-[10px] font-semibold px-2 py-0.5 rounded-full">
                          {unreadCount} baru
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {unreadCount > 0 && (
                        <button
                          onClick={markAllAsRead}
                          className="text-[11px] font-medium text-emerald-700 hover:text-emerald-800 hover:underline flex items-center gap-1"
                        >
                          <IconCheckCircle />
                          <span>Tandai dibaca</span>
                        </button>
                      )}
                      {visibleNotifications.length > 0 && (
                        <button
                          onClick={dismissAllNotifs}
                          className="text-[11px] font-medium text-slate-400 hover:text-rose-600 hover:underline flex items-center gap-1"
                          title="Hapus semua notifikasi"
                        >
                          <IconClose />
                          <span>Hapus semua</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Tabs filter (Semua / Belum Dibaca) */}
                  <div className="px-4 py-2 flex items-center gap-2 border-b border-slate-100 bg-slate-50/70">
                    <button
                      onClick={() => setNotifTab('all')}
                      className={`text-[11px] font-medium px-2.5 py-1 rounded-md transition-all ${
                        notifTab === 'all'
                          ? 'bg-white text-slate-800 shadow-xs font-semibold'
                          : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      Semua ({visibleNotifications.length})
                    </button>
                    <button
                      onClick={() => setNotifTab('unread')}
                      className={`text-[11px] font-medium px-2.5 py-1 rounded-md transition-all ${
                        notifTab === 'unread'
                          ? 'bg-white text-slate-800 shadow-xs font-semibold'
                          : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      Belum Dibaca ({unreadCount})
                    </button>
                  </div>

                  {/* Notification List */}
                  <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                    {displayedNotifications.length === 0 ? (
                      <div className="px-6 py-8 text-center text-slate-400">
                        <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-2 text-slate-400">
                          <IconBell />
                        </div>
                        <p className="text-xs font-medium text-slate-600">Tidak ada notifikasi</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          {notifTab === 'unread' ? 'Semua notifikasi sudah dibaca' : 'Aktivitas terbaru akan muncul di sini'}
                        </p>
                      </div>
                    ) : (
                      displayedNotifications.map((notif) => {
                        const isRead = readNotifIds.includes(notif.id) || notif.read
                        return (
                          <div
                            key={notif.id}
                            onClick={() => {
                              markAsRead(notif.id)
                              if (notif.linkView) {
                                onNavigate(notif.linkView)
                                setNotifOpen(false)
                              }
                              if (onNotificationClick) {
                                onNotificationClick(notif)
                              }
                            }}
                            className={`p-3.5 hover:bg-slate-50 transition-colors cursor-pointer flex items-start gap-3 relative group ${
                              !isRead ? 'bg-emerald-50/30' : ''
                            }`}
                          >
                            {/* Type indicator dot / icon */}
                            <div className="shrink-0 mt-0.5">
                              <span
                                className={`w-2.5 h-2.5 rounded-full block ${
                                  notif.type === 'success'
                                    ? 'bg-emerald-500 ring-4 ring-emerald-100'
                                    : notif.type === 'alert'
                                    ? 'bg-rose-500 ring-4 ring-rose-100'
                                    : notif.type === 'warning'
                                    ? 'bg-amber-500 ring-4 ring-amber-100'
                                    : 'bg-blue-500 ring-4 ring-blue-100'
                                }`}
                              />
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-1">
                                <h4 className={`text-xs truncate ${!isRead ? 'font-bold text-slate-900' : 'font-medium text-slate-700'}`}>
                                  {notif.title}
                                </h4>
                                <span className="text-[10px] text-slate-400 shrink-0">
                                  {formatRelativeTime(notif.time)}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed line-clamp-2">
                                {notif.message}
                              </p>
                            </div>

                            {/* Dismiss button (visible on hover) */}
                            <button
                              onClick={(e) => dismissNotif(e, notif.id)}
                              className="shrink-0 self-start p-0.5 rounded text-slate-300 opacity-0 group-hover:opacity-100 hover:text-rose-500 hover:bg-rose-50 transition-all"
                              title="Hapus notifikasi ini"
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                              </svg>
                            </button>

                            {/* Unread indicator */}
                            {!isRead && (
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 shrink-0 self-center" />
                            )}
                          </div>
                        )
                      })
                    )}
                  </div>

                  {/* Footer */}
                  {visibleNotifications.length > 0 && (
                    <div className="px-4 pt-2.5 border-t border-slate-100 text-center">
                      <span className="text-[10px] text-slate-400">
                        Notifikasi terhubung secara real-time ke akun Anda
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* User Profile Button - Langsung ke Halaman Profile */}
            <div className="pl-1 sm:pl-2 border-l border-slate-200">
              <button
                type="button"
                onClick={() => onNavigate('profile')}
                className={`flex items-center gap-2 p-1 sm:px-2.5 sm:py-1 rounded-xl transition-all cursor-pointer ${
                  currentView === 'profile'
                    ? 'bg-emerald-50 ring-1 ring-emerald-600 shadow-xs'
                    : 'hover:bg-slate-50 active:bg-slate-100'
                }`}
                title="Buka Halaman Profil"
              >
                <div className="w-8 h-8 rounded-full bg-emerald-800 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-xs ring-2 ring-emerald-700/20">
                  {initials}
                </div>
                <div className="hidden lg:flex flex-col text-left">
                  <span className="text-xs font-semibold text-slate-800 leading-none truncate max-w-[120px]">
                    {userName || 'User'}
                  </span>
                  <span className="text-[10px] text-slate-400 leading-tight mt-0.5 capitalize">
                    {userRole}
                  </span>
                </div>
              </button>
            </div>
          </div>
        </header>

        {/* View Content Body */}
        <main className="flex-1 p-3 sm:p-6 pb-24 md:pb-6 overflow-x-hidden">
          <div className="max-w-7xl mx-auto w-full">
            {currentView === 'profile' ? (
              <ProfileView
                role={role}
                userId={userId}
                userName={userName}
                userRole={userRole}
                userEmail={userEmail}
                userPhone={userPhone}
                onBack={() => onNavigate(navItems[0].view)}
                onLogout={onLogout}
                onProfileUpdated={onProfileUpdated}
              />
            ) : (
              children
            )}
          </div>
        </main>

        {/* Mobile Bottom Navigation Bar */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 px-2 py-1 flex items-center justify-around shadow-lg">
          {navItems.slice(0, 5).map((item) => {
            const isActive = currentView.startsWith(item.view.split('-')[0]) || currentView === item.view
            return (
              <button
                key={item.view}
                onClick={() => {
                  onNavigate(item.view)
                  setMobileMenuOpen(false)
                }}
                className={`flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-lg text-[10px] transition-all min-w-0 ${
                  isActive
                    ? 'text-emerald-800 font-bold'
                    : 'text-slate-500 hover:text-slate-800 font-medium'
                }`}
              >
                <div className={`p-1 rounded-md transition-colors ${isActive ? 'bg-emerald-100 text-emerald-800' : 'text-slate-400'}`}>
                  {item.icon}
                </div>
                <span className="truncate max-w-[60px] leading-tight mt-0.5">{item.label}</span>
              </button>
            )
          })}
        </nav>
      </div>
    </div>
  )
}
