"use client"

import { useState } from 'react'
import { apiUpdateProfile, apiUpdatePassword } from '@/lib/api/auth'

interface ProfileViewProps {
  role: 'warung' | 'collector' | 'admin'
  userId?: string
  userName: string
  userRole: string
  userEmail?: string
  userPhone?: string
  initialTab?: 'profile' | 'password'
  onBack: () => void
  onLogout: () => void
  onProfileUpdated?: (updated: { name: string; phone_number?: string }) => void
}

// ─── Inline Icons ─────────────────────────────────────────────────────────────

const EyeIcon = ({ open }: { open: boolean }) => open ? (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
) : (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
)

const CheckIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
)

const CopyIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
)

const Spinner = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
  </svg>
)

export default function ProfileView({
  role,
  userId,
  userName,
  userRole,
  userEmail,
  userPhone = '',
  initialTab = 'profile',
  onBack,
  onLogout,
  onProfileUpdated,
}: ProfileViewProps) {
  const [activeTab, setActiveTab] = useState<'profile' | 'password'>(initialTab)

  // Profile form state
  const [name, setName] = useState(userName)
  const [phone, setPhone] = useState(userPhone)
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null)
  const [profileError, setProfileError] = useState<string | null>(null)

  // Password form state
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null)
  const [passwordError, setPasswordError] = useState<string | null>(null)

  // UI state
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [copiedId, setCopiedId] = useState(false)

  const roleLabel: Record<string, string> = {
    warung: 'Mitra Warung',
    collector: 'Kurir / Kolektor',
    admin: 'Administrator Sistem',
  }

  const roleBadgeIcon = (r: string) => {
    if (r === 'warung') {
      return (
        <svg className="w-3.5 h-3.5 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
      )
    }
    if (r === 'collector') {
      return (
        <svg className="w-3.5 h-3.5 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="1" y="3" width="15" height="13" />
          <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
          <circle cx="5.5" cy="18.5" r="2.5" />
          <circle cx="18.5" cy="18.5" r="2.5" />
        </svg>
      )
    }
    return (
      <svg className="w-3.5 h-3.5 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    )
  }

  const initials = (name || userName || 'WS')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  const isProfileChanged = name.trim() !== userName.trim() || phone.trim() !== (userPhone || '').trim()

  const handleCopyId = () => {
    if (!userId) return
    navigator.clipboard.writeText(userId)
    setCopiedId(true)
    setTimeout(() => setCopiedId(false), 2000)
  }

  const handleResetProfile = () => {
    setName(userName)
    setPhone(userPhone || '')
    setProfileError(null)
    setProfileSuccess(null)
  }

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setProfileSuccess(null)
    setProfileError(null)
    const trimmedName = name.trim()
    if (!trimmedName) {
      setProfileError('Nama lengkap tidak boleh kosong')
      return
    }
    setProfileSaving(true)
    try {
      const res = await apiUpdateProfile({
        name: trimmedName,
        phone_number: phone.trim() || undefined,
      })
      if (res.error) {
        setProfileError(res.error)
      } else {
        setProfileSuccess('Profil akun berhasil diperbarui')
        onProfileUpdated?.({ name: trimmedName, phone_number: phone.trim() })
      }
    } catch {
      setProfileError('Terjadi kendala jaringan, silakan coba lagi')
    } finally {
      setProfileSaving(false)
    }
  }

  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setPasswordSuccess(null)
    setPasswordError(null)
    if (newPassword.length < 6) {
      setPasswordError('Kata sandi baru minimal harus 6 karakter')
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Konfirmasi kata sandi tidak cocok')
      return
    }
    setPasswordSaving(true)
    try {
      const res = await apiUpdatePassword(newPassword)
      if (res.error) {
        setPasswordError(res.error)
      } else {
        setPasswordSuccess('Kata sandi berhasil diperbarui dengan aman')
        setNewPassword('')
        setConfirmPassword('')
      }
    } catch {
      setPasswordError('Gagal memperbarui kata sandi, silakan coba lagi')
    } finally {
      setPasswordSaving(false)
    }
  }

  // Password strength calculation
  const getPasswordStrength = (pwd: string) => {
    if (!pwd) return { score: 0, label: '', color: 'bg-slate-200' }
    let score = 0
    if (pwd.length >= 6) score += 1
    if (pwd.length >= 8) score += 1
    if (/[A-Z]/.test(pwd) && /[0-9]/.test(pwd)) score += 1
    if (/[^A-Za-z0-9]/.test(pwd)) score += 1

    if (score <= 1) return { score: 1, label: 'Lemah', color: 'bg-rose-500' }
    if (score === 2) return { score: 2, label: 'Cukup', color: 'bg-amber-500' }
    if (score === 3) return { score: 3, label: 'Kuat', color: 'bg-emerald-500' }
    return { score: 4, label: 'Sangat Kuat', color: 'bg-emerald-700' }
  }

  const pwdStrength = getPasswordStrength(newPassword)
  const isPwdLengthValid = newPassword.length >= 6
  const isPwdMatchValid = confirmPassword.length > 0 && newPassword === confirmPassword

  return (
    <div className="max-w-2xl mx-auto pb-20 space-y-5 px-1 sm:px-0">

      {/* ─── Breadcrumb Navigation ────────────────────────────────────────── */}
      <nav className="flex items-center justify-between text-xs text-slate-500 pt-1">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 hover:text-emerald-800 hover:border-emerald-300 hover:bg-emerald-50/50 transition-all font-medium shadow-2xs group cursor-pointer"
        >
          <svg className="w-4 h-4 text-slate-400 group-hover:text-emerald-800 transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
          <span>Kembali ke Dashboard</span>
        </button>

        <div className="flex items-center gap-2">
          <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
            Akun Terverifikasi
          </span>
        </div>
      </nav>

      {/* ─── Hero Profile Header Card ────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-950 via-emerald-800 to-emerald-900 text-white p-5 sm:p-7 shadow-md border border-emerald-700/40">
        {/* Subtle Decorative Ambient Glow */}
        <div className="absolute -top-16 -right-16 w-52 h-52 bg-emerald-400/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 w-52 h-52 bg-emerald-600/15 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-6 text-center sm:text-left">
          {/* Avatar with Ring & Status Indicator */}
          <div className="relative shrink-0">
            <div className="w-20 h-20 sm:w-22 sm:h-22 rounded-2xl bg-white/10 backdrop-blur-md border border-white/25 text-white font-black text-2xl sm:text-3xl flex items-center justify-center shadow-lg ring-4 ring-emerald-600/30">
              {initials}
            </div>
            <div
              className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-400 border-2 border-emerald-950 ring-2 ring-emerald-300/60 flex items-center justify-center shadow-xs"
              title="Status: Aktif"
            >
              <CheckIcon className="w-3 h-3 text-emerald-950 stroke-[3]" />
            </div>
          </div>

          {/* User Primary Details */}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white truncate max-w-full">
                {name || userName}
              </h1>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-900/90 text-emerald-100 border border-emerald-600/50 shadow-2xs">
                {roleBadgeIcon(role)}
                {roleLabel[role] ?? userRole}
              </span>
            </div>

            <p className="text-xs sm:text-sm text-emerald-100/80 mt-1 truncate">
              {userEmail || 'Belum ada email terdaftar'}
            </p>

            {/* Quick Metadata Chips */}
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 sm:gap-3 mt-3 pt-3 border-t border-emerald-700/40 text-xs">
              {userPhone ? (
                <div className="inline-flex items-center gap-1.5 text-emerald-100/90 bg-emerald-900/60 px-2.5 py-1 rounded-lg border border-emerald-700/40">
                  <svg className="w-3.5 h-3.5 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                  </svg>
                  <span>{userPhone}</span>
                </div>
              ) : (
                <div className="inline-flex items-center gap-1.5 text-emerald-200/60 bg-emerald-900/40 px-2.5 py-1 rounded-lg border border-emerald-700/30">
                  <span>Nomor WA belum diisi</span>
                </div>
              )}

              {userId && (
                <button
                  type="button"
                  onClick={handleCopyId}
                  className="inline-flex items-center gap-1.5 text-emerald-100/90 bg-emerald-900/60 hover:bg-emerald-900/90 px-2.5 py-1 rounded-lg border border-emerald-700/40 transition cursor-pointer"
                  title="Klik untuk menyalin ID Pengguna"
                >
                  <span className="font-mono text-[11px] text-emerald-200">ID: {userId.slice(0, 8)}…</span>
                  {copiedId ? (
                    <span className="text-[10px] text-emerald-300 font-bold">Tersalin!</span>
                  ) : (
                    <CopyIcon className="w-3 h-3 text-emerald-300" />
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ─── Modern Segmented Navigation Tabs ────────────────────────────── */}
      <div className="bg-slate-100/90 p-1.5 rounded-xl border border-slate-200/90 shadow-2xs">
        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
              activeTab === 'profile'
                ? 'bg-emerald-800 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            <span>Informasi Akun</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('password')}
            className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
              activeTab === 'password'
                ? 'bg-emerald-800 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            <span>Kata Sandi & Keamanan</span>
          </button>
        </div>
      </div>

      {/* ─── TAB CONTENT 1: Informasi Profil ──────────────────────────────── */}
      {activeTab === 'profile' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-5 sm:p-6 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-800 flex items-center justify-center border border-emerald-200">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">Data Pribadi & Kontak</h2>
                <p className="text-xs text-slate-500">Perbarui identitas profil dan kontak yang dapat dihubungi</p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSaveProfile} className="p-5 sm:p-6 space-y-5">
            {/* Success Alert */}
            {profileSuccess && (
              <div className="flex items-center gap-3 p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 text-xs sm:text-sm animate-fadeIn">
                <div className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0">
                  <CheckIcon className="w-3.5 h-3.5" />
                </div>
                <div className="flex-1 font-medium">{profileSuccess}</div>
                <button
                  type="button"
                  onClick={() => setProfileSuccess(null)}
                  className="text-emerald-700 hover:text-emerald-900 text-xs font-semibold cursor-pointer"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Error Alert */}
            {profileError && (
              <div className="flex items-center gap-3 p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-900 text-xs sm:text-sm animate-fadeIn">
                <div className="w-5 h-5 rounded-full bg-rose-600 text-white flex items-center justify-center shrink-0 font-bold">
                  !
                </div>
                <div className="flex-1 font-medium">{profileError}</div>
                <button
                  type="button"
                  onClick={() => setProfileError(null)}
                  className="text-rose-700 hover:text-rose-900 text-xs font-semibold cursor-pointer"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Input: Nama Lengkap */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700">
                Nama Lengkap <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                </div>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nama lengkap kamu"
                  className="w-full pl-10 pr-3.5 py-2.5 sm:py-3 rounded-xl border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700 bg-white transition shadow-2xs"
                />
              </div>
              <p className="text-[11px] text-slate-500">Nama resmi yang digunakan pada faktur, riwayat transaksi, dan rute pangkalan.</p>
            </div>

            {/* Input: Nomor WhatsApp */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700">
                Nomor WhatsApp / Telepon
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                  </svg>
                </div>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="08xxxxxxxxxx"
                  className="w-full pl-10 pr-3.5 py-2.5 sm:py-3 rounded-xl border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700 bg-white transition shadow-2xs"
                />
              </div>
              <p className="text-[11px] text-slate-500">Digunakan untuk notifikasi jadwal jemputan sampah dan verifikasi langsung via WhatsApp.</p>
            </div>

            {/* Read-only: Email Akun */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-slate-700">
                  Alamat Email (Akun Utama)
                </label>
                <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md">
                  Permanen
                </span>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                    <polyline points="22,6 12,13 2,6" />
                  </svg>
                </div>
                <div className="w-full pl-10 pr-10 py-2.5 sm:py-3 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-600 truncate select-none flex items-center">
                  {userEmail || '—'}
                </div>
                <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400" title="Email terdaftar tidak dapat diubah">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </div>
              </div>
              <p className="text-[11px] text-slate-400">Email terdaftar sebagai identitas otentikasi Supabase dan tidak dapat diganti secara langsung.</p>
            </div>

            {/* Read-only: User ID card */}
            {userId && (
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
                <div className="min-w-0 pr-2">
                  <span className="text-slate-400 block text-[10px] font-medium uppercase tracking-wider">Unique User ID</span>
                  <span className="font-mono text-slate-700 text-[11px] truncate block">{userId}</span>
                </div>
                <button
                  type="button"
                  onClick={handleCopyId}
                  className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 hover:border-emerald-300 text-slate-600 hover:text-emerald-800 text-xs font-medium flex items-center gap-1.5 transition shrink-0 cursor-pointer"
                >
                  {copiedId ? (
                    <>
                      <CheckIcon className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-emerald-700 font-semibold">Disalin</span>
                    </>
                  ) : (
                    <>
                      <CopyIcon className="w-3.5 h-3.5" />
                      <span>Salin</span>
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Form Actions */}
            <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
              <button
                type="submit"
                disabled={profileSaving || !name.trim()}
                className="w-full sm:flex-1 py-3 px-5 rounded-xl bg-emerald-800 hover:bg-emerald-900 active:scale-[0.99] text-white text-sm font-semibold transition-all shadow-xs disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
              >
                {profileSaving ? (
                  <>
                    <Spinner className="w-4 h-4 text-white" />
                    <span>Menyimpan Perubahan...</span>
                  </>
                ) : (
                  <>
                    <CheckIcon className="w-4 h-4 text-white" />
                    <span>Simpan Perubahan Profil</span>
                  </>
                )}
              </button>

              {isProfileChanged && (
                <button
                  type="button"
                  onClick={handleResetProfile}
                  disabled={profileSaving}
                  className="w-full sm:w-auto py-3 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-sm font-semibold transition cursor-pointer"
                >
                  Batal
                </button>
              )}
            </div>
          </form>
        </div>
      )}

      {/* ─── TAB CONTENT 2: Kata Sandi & Keamanan ─────────────────────────── */}
      {activeTab === 'password' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-5 sm:p-6 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-800 flex items-center justify-center border border-emerald-200">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">Perbarui Kata Sandi</h2>
                <p className="text-xs text-slate-500">Amankan akun Anda dengan kata sandi baru yang kuat</p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSavePassword} className="p-5 sm:p-6 space-y-5">
            {/* Success Alert */}
            {passwordSuccess && (
              <div className="flex items-center gap-3 p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 text-xs sm:text-sm animate-fadeIn">
                <div className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0">
                  <CheckIcon className="w-3.5 h-3.5" />
                </div>
                <div className="flex-1 font-medium">{passwordSuccess}</div>
                <button
                  type="button"
                  onClick={() => setPasswordSuccess(null)}
                  className="text-emerald-700 hover:text-emerald-900 text-xs font-semibold cursor-pointer"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Error Alert */}
            {passwordError && (
              <div className="flex items-center gap-3 p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-900 text-xs sm:text-sm animate-fadeIn">
                <div className="w-5 h-5 rounded-full bg-rose-600 text-white flex items-center justify-center shrink-0 font-bold">
                  !
                </div>
                <div className="flex-1 font-medium">{passwordError}</div>
                <button
                  type="button"
                  onClick={() => setPasswordError(null)}
                  className="text-rose-700 hover:text-rose-900 text-xs font-semibold cursor-pointer"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Input: Kata Sandi Baru */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700">
                Kata Sandi Baru <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </div>
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Ketik minimal 6 karakter"
                  className="w-full pl-10 pr-11 py-2.5 sm:py-3 rounded-xl border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700 bg-white transition shadow-2xs"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword((p) => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer transition-colors"
                  title={showNewPassword ? 'Sembunyikan sandi' : 'Tampilkan sandi'}
                >
                  <EyeIcon open={showNewPassword} />
                </button>
              </div>

              {/* Password strength visual meter */}
              {newPassword.length > 0 && (
                <div className="space-y-1 pt-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-500">Kekuatan Sandi:</span>
                    <span className="font-semibold text-slate-700">{pwdStrength.label}</span>
                  </div>
                  <div className="grid grid-cols-4 gap-1.5 h-1.5">
                    {[1, 2, 3, 4].map((step) => (
                      <div
                        key={step}
                        className={`rounded-full transition-all duration-300 ${
                          pwdStrength.score >= step ? pwdStrength.color : 'bg-slate-200'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Input: Konfirmasi Kata Sandi */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700">
                Konfirmasi Kata Sandi Baru <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                </div>
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Ketik ulang kata sandi baru"
                  className="w-full pl-10 pr-11 py-2.5 sm:py-3 rounded-xl border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700 bg-white transition shadow-2xs"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((p) => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer transition-colors"
                  title={showConfirmPassword ? 'Sembunyikan sandi' : 'Tampilkan sandi'}
                >
                  <EyeIcon open={showConfirmPassword} />
                </button>
              </div>
            </div>

            {/* Checklist Validation */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
              <div className="flex items-center gap-2">
                <div
                  className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 text-[10px] ${
                    isPwdLengthValid ? 'bg-emerald-600 text-white font-bold' : 'bg-slate-200 text-slate-400'
                  }`}
                >
                  {isPwdLengthValid ? '✓' : '•'}
                </div>
                <span className={isPwdLengthValid ? 'text-emerald-800 font-medium' : 'text-slate-500'}>
                  Minimal 6 karakter
                </span>
              </div>

              <div className="flex items-center gap-2">
                <div
                  className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 text-[10px] ${
                    isPwdMatchValid ? 'bg-emerald-600 text-white font-bold' : 'bg-slate-200 text-slate-400'
                  }`}
                >
                  {isPwdMatchValid ? '✓' : '•'}
                </div>
                <span className={isPwdMatchValid ? 'text-emerald-800 font-medium' : 'text-slate-500'}>
                  Kata sandi baru dan konfirmasi cocok
                </span>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={passwordSaving || !isPwdLengthValid || !isPwdMatchValid}
              className="w-full py-3 px-5 rounded-xl bg-emerald-800 hover:bg-emerald-900 active:scale-[0.99] text-white text-sm font-semibold transition-all shadow-xs disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
            >
              {passwordSaving ? (
                <>
                  <Spinner className="w-4 h-4 text-white" />
                  <span>Memperbarui Kata Sandi...</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                  <span>Perbarui Kata Sandi Sekarang</span>
                </>
              )}
            </button>
          </form>
        </div>
      )}

      {/* ─── Danger Zone: Sesi Akun / Logout ──────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-5 sm:p-6">
          {!showLogoutConfirm ? (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-0.5">
                <h3 className="text-sm font-bold text-slate-900">Sesi Login Akun</h3>
                <p className="text-xs text-slate-500">
                  Keluar dari sesi ini untuk mengamankan akun jika perangkat digunakan bersama.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowLogoutConfirm(true)}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-xs sm:text-sm font-semibold transition-colors cursor-pointer shrink-0"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
                <span>Keluar dari Akun</span>
              </button>
            </div>
          ) : (
            <div className="p-4 sm:p-5 rounded-xl bg-rose-50 border border-rose-200 space-y-3.5 animate-fadeIn">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                </div>
                <div className="space-y-0.5 min-w-0">
                  <h4 className="text-sm font-bold text-rose-950">Konfirmasi Keluar dari Akun</h4>
                  <p className="text-xs text-rose-700">
                    Apakah Anda yakin ingin keluar dari sesi ini? Anda harus memasukkan email dan kata sandi kembali untuk mengakses sistem.
                  </p>
                </div>
              </div>

              <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowLogoutConfirm(false)}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs sm:text-sm font-semibold transition cursor-pointer shadow-2xs"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={onLogout}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 active:scale-[0.99] text-white text-xs sm:text-sm font-bold transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                  <span>Ya, Keluar Sekarang</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

    </div>
  )
}
