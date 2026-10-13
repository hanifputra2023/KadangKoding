"use client"

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { getCurrentPosition } from '@/lib/geo/geolocation'
import ClientMap from '@/components/ClientMap'
import { apiLogin, apiRegister, apiGetMe } from '@/lib/api/auth'

type Role = 'warung' | 'collector'
type Mode = 'login' | 'register'

// ─── Inline SVG Icons ────────────────────────────────────────────────────────

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

const Spinner = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
  </svg>
)

const IconMotor = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="5.5" cy="17.5" r="3.5" />
    <circle cx="18.5" cy="17.5" r="3.5" />
    <path d="M15 6h-2l-3 6.5h5.5l2-3.5H19" />
    <circle cx="15" cy="4.5" r="1.5" />
    <path d="M9 17.5l2-5" />
  </svg>
)

const IconTossa = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="5" cy="18" r="3" />
    <circle cx="19" cy="18" r="3" />
    <path d="M5 15h14v-6H8L5 15z" />
    <rect x="8" y="5" width="12" height="10" rx="1" />
  </svg>
)

const IconPickup = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 3h15v13H1z" />
    <path d="M16 8h4l3 3v5h-7V8z" />
    <circle cx="5.5" cy="18.5" r="2.5" />
    <circle cx="18.5" cy="18.5" r="2.5" />
  </svg>
)

// ─── Inner Login Component ───────────────────────────────────────────────────

function LoginContent({ defaultMode = 'login' }: { defaultMode?: Mode }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialModeParam = (searchParams.get('tab') as Mode) || defaultMode

  const [mode, setMode] = useState<Mode>(initialModeParam === 'register' ? 'register' : 'login')
  const [loading, setLoading] = useState(false)
  const [locating, setLocating] = useState(false)

  // Auth fields
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  // Register common fields
  const [name, setName] = useState('')
  const [role, setRole] = useState<Role>('warung')
  const [phone, setPhone] = useState('')

  // Warung specific fields
  const [businessName, setBusinessName] = useState('')
  const [address, setAddress] = useState('')
  const [lat, setLat] = useState('-7.4726')
  const [lng, setLng] = useState('110.2198')

  // Collector specific fields
  const [vehicleType, setVehicleType] = useState('Motor')
  const [capacity, setCapacity] = useState('50')
  const [serviceArea, setServiceArea] = useState('')

  // Redirect if already authenticated
  useEffect(() => {
    apiGetMe()
      .then((user) => {
        if (user) router.replace(`/${user.role}`)
      })
      .catch(() => {})
  }, [router])

  // Sync mode with query param if present
  useEffect(() => {
    const tab = searchParams.get('tab')
    if (tab === 'register' || tab === 'login') {
      setMode(tab)
    }
  }, [searchParams])

  // Calculate password strength
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

  const pwdStrength = getPasswordStrength(password)

  async function useMyLocation() {
    setLocating(true)
    try {
      const coords = await getCurrentPosition()
      setLat(String(coords.latitude))
      setLng(String(coords.longitude))
      toast.success('Lokasi GPS berhasil diambil ✓')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Gagal mengambil lokasi GPS. Pastikan izin lokasi aktif.')
    } finally {
      setLocating(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!email.trim() || !password) {
      toast.error('Email dan kata sandi wajib diisi!')
      return
    }

    if (mode === 'register') {
      if (!name.trim()) {
        toast.error('Nama lengkap wajib diisi!')
        return
      }
      if (password.length < 6) {
        toast.error('Kata sandi minimal 6 karakter!')
        return
      }
      if (role === 'warung') {
        if (!businessName.trim()) {
          toast.error('Nama warung / usaha wajib diisi!')
          return
        }
        if (!address.trim()) {
          toast.error('Alamat lengkap warung wajib diisi!')
          return
        }
      }
      if (role === 'collector') {
        if (!capacity || Number(capacity) <= 0) {
          toast.error('Kapasitas muatan kendaraan harus lebih dari 0 kg!')
          return
        }
      }
    }

    setLoading(true)
    try {
      if (mode === 'login') {
        const res = await apiLogin(email.trim(), password)
        if (res.error || !res.user) throw new Error(res.error || 'Login gagal. Periksa kembali email dan kata sandi.')
        toast.success(`Selamat datang, ${res.user.name}!`)
        router.replace(`/${res.user.role}`)
      } else {
        const res = await apiRegister({
          email: email.trim(),
          password,
          name: name.trim(),
          role: role as 'warung' | 'collector',
          phone_number: phone.trim() || undefined,
          warung: role === 'warung' ? {
            business_name: businessName.trim(),
            address: address.trim(),
            latitude: Number(lat) || -7.4726,
            longitude: Number(lng) || 110.2198,
          } : undefined,
          collector: role === 'collector' ? {
            vehicle_type: vehicleType,
            vehicle_capacity_kg: Number(capacity) || 50,
            service_area: serviceArea.trim() || undefined,
          } : undefined,
        })
        if (res.error || !res.user) throw new Error(res.error || 'Registrasi gagal. Silakan coba lagi.')
        toast.success(`Registrasi berhasil! Selamat bergabung, ${res.user.name}.`)
        router.replace(`/${res.user.role}`)
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Terjadi kesalahan jaringan')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen w-full flex flex-col lg:flex-row bg-slate-50">

      {/* ─── LEFT: Brand Hero Showcase (Desktop only) ────────────────────────── */}
      <div className="hidden lg:flex lg:w-5/12 xl:w-5/12 bg-gradient-to-br from-emerald-950 via-emerald-900 to-emerald-950 text-white relative overflow-hidden flex-col justify-between p-10 xl:p-14 border-r border-emerald-800/40">
        {/* Subtle Ambient Decorative Glow */}
        <div className="absolute -top-24 -left-24 w-80 h-80 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-80 h-80 bg-emerald-400/15 rounded-full blur-3xl pointer-events-none" />

        {/* Top: Logo & Platform Identity */}
        <div className="relative z-10 space-y-4">
          <div className="flex items-center gap-3.5">
            <div className="w-14 h-14 rounded-2xl bg-white p-1.5 shadow-md border border-white/20 flex items-center justify-center shrink-0 ring-4 ring-emerald-500/20">
              <img src="/logo.png" alt="WarungSirkular Logo" className="w-full h-full object-contain" />
            </div>
            <div>
              <span className="text-2xl font-black tracking-tight text-white block leading-tight">
                WarungSirkular
              </span>
              <span className="text-xs font-semibold text-emerald-300 tracking-wide uppercase">
                Sirkular Sampah Organik
              </span>
            </div>
          </div>

          <div className="pt-6">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-800/80 text-emerald-100 border border-emerald-700/60 shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Ekosistem Terintegrasi Maggot BSF
            </span>
            <h1 className="text-3xl xl:text-4xl font-extrabold text-white tracking-tight leading-tight mt-3">
              Ubah Sisa Makanan Jadi Pakan Bernilai Tinggi.
            </h1>
            <p className="text-sm text-emerald-100/80 mt-3 leading-relaxed">
              Platform pintar yang menghubungkan mitra warung makan dan armada penjemput sampah organik ke fasilitas budidaya maggot BSF secara teroptimasi dan transparan.
            </p>
          </div>
        </div>

        {/* Middle: Feature Highlights */}
        <div className="relative z-10 space-y-4 py-8">
          <div className="flex items-start gap-3.5 bg-white/5 border border-white/10 rounded-2xl p-4 backdrop-blur-xs">
            <div className="w-10 h-10 rounded-xl bg-emerald-700/60 text-emerald-300 flex items-center justify-center shrink-0 border border-emerald-500/30">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Mitra Warung Makan</h3>
              <p className="text-xs text-emerald-200/70 mt-0.5 leading-relaxed">
                Jadwalkan penjemputan sampah organik dapur dengan mudah dan pantau status armada secara langsung.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3.5 bg-white/5 border border-white/10 rounded-2xl p-4 backdrop-blur-xs">
            <div className="w-10 h-10 rounded-xl bg-emerald-700/60 text-emerald-300 flex items-center justify-center shrink-0 border border-emerald-500/30">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="1" y="3" width="15" height="13" />
                <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
                <circle cx="5.5" cy="18.5" r="2.5" />
                <circle cx="18.5" cy="18.5" r="2.5" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Rute Cerdas Nearest-Neighbor</h3>
              <p className="text-xs text-emerald-200/70 mt-0.5 leading-relaxed">
                Rute penjemputan disusun otomatis berdasarkan jarak terdekat dan kapasitas muatan kendaraan kurir.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3.5 bg-white/5 border border-white/10 rounded-2xl p-4 backdrop-blur-xs">
            <div className="w-10 h-10 rounded-xl bg-emerald-700/60 text-emerald-300 flex items-center justify-center shrink-0 border border-emerald-500/30">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Verifikasi Timbangan & Bukti</h3>
              <p className="text-xs text-emerald-200/70 mt-0.5 leading-relaxed">
                Catat berat aktual dan unggah foto bukti timbangan langsung di titik penjemputan untuk transparansi audit.
              </p>
            </div>
          </div>
        </div>

        {/* Bottom: Footer Info */}
        <div className="relative z-10 pt-4 border-t border-emerald-800/60 flex items-center justify-between text-xs text-emerald-300/70">
          <span>WarungSirkular Platform © 2026</span>
          <span className="font-mono text-[11px]">v1.0.0 Stable</span>
        </div>
      </div>

      {/* ─── RIGHT: Auth Form Container ──────────────────────────────────────── */}
      <div className="w-full lg:w-7/12 flex-1 flex flex-col justify-center items-center p-4 sm:p-8 lg:p-12 overflow-y-auto">
        <div className="w-full max-w-lg my-auto space-y-6">

          {/* Mobile Brand Header */}
          <div className="lg:hidden text-center space-y-2 pt-4">
            <div className="w-16 h-16 rounded-2xl bg-white p-2 shadow-md border border-slate-200/80 mx-auto flex items-center justify-center ring-4 ring-emerald-600/10">
              <img src="/logo.png" alt="WarungSirkular Logo" className="w-full h-full object-contain" />
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">WarungSirkular</h1>
            <p className="text-xs text-slate-500">Ekosistem Sirkular Sampah Organik ke Pakan Maggot BSF</p>
          </div>

          

          {/* Main Card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-6">

            {/* Header Titles */}
            <div className="space-y-1">
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                {mode === 'login' ? 'Selamat Datang Kembali' : 'Pendaftaran Mitra Baru'}
              </h2>
              <p className="text-xs sm:text-sm text-slate-500">
                {mode === 'login'
                  ? 'Masuk ke dashboard untuk mengelola penjemputan & verifikasi sampah.'
                  : 'Lengkapi profil untuk bergabung ke ekosistem sirkular WarungSirkular.'}
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-5">

              {/* ─── REGISTER SPECIFIC: ROLE SELECTOR CARDS ─────────────────── */}
              {mode === 'register' && (
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-700">
                    Pilih Peran Akun <span className="text-rose-500">*</span>
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Warung Option */}
                    <div
                      onClick={() => setRole('warung')}
                      className={`p-3.5 rounded-xl border-2 transition-all cursor-pointer flex items-start gap-3 relative ${
                        role === 'warung'
                          ? 'border-emerald-700 bg-emerald-50/50 shadow-2xs'
                          : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
                      }`}
                    >
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                        role === 'warung' ? 'bg-emerald-800 text-white' : 'bg-slate-100 text-slate-600'
                      }`}>
                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                          <polyline points="9 22 9 12 15 12 15 22" />
                        </svg>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-bold text-slate-900">Mitra Warung</h4>
                          {role === 'warung' && (
                            <span className="w-4 h-4 rounded-full bg-emerald-700 text-white flex items-center justify-center text-[10px]">
                              ✓
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5 leading-tight">
                          Penyetor sisa bahan dapur & limbah makanan
                        </p>
                      </div>
                    </div>

                    {/* Collector Option */}
                    <div
                      onClick={() => setRole('collector')}
                      className={`p-3.5 rounded-xl border-2 transition-all cursor-pointer flex items-start gap-3 relative ${
                        role === 'collector'
                          ? 'border-emerald-700 bg-emerald-50/50 shadow-2xs'
                          : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
                      }`}
                    >
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                        role === 'collector' ? 'bg-emerald-800 text-white' : 'bg-slate-100 text-slate-600'
                      }`}>
                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="1" y="3" width="15" height="13" />
                          <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
                          <circle cx="5.5" cy="18.5" r="2.5" />
                          <circle cx="18.5" cy="18.5" r="2.5" />
                        </svg>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-bold text-slate-900">Kurir / Kolektor</h4>
                          {role === 'collector' && (
                            <span className="w-4 h-4 rounded-full bg-emerald-700 text-white flex items-center justify-center text-[10px]">
                              ✓
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5 leading-tight">
                          Penjemput sampah organik ke fasilitas pangkalan
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ─── REGISTER SPECIFIC: NAMA LENGKAP ────────────────────────── */}
              {mode === 'register' && (
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
                      placeholder="Nama lengkap Anda"
                      className="w-full pl-10 pr-3.5 py-2.5 sm:py-3 rounded-xl border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700 bg-white transition shadow-2xs"
                    />
                  </div>
                </div>
              )}

              {/* ─── EMAIL INPUT ────────────────────────────────────────────── */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700">
                  Alamat Email <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                      <polyline points="22,6 12,13 2,6" />
                    </svg>
                  </div>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="nama@email.com"
                    autoComplete="email"
                    className="w-full pl-10 pr-3.5 py-2.5 sm:py-3 rounded-xl border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700 bg-white transition shadow-2xs"
                  />
                </div>
              </div>

              {/* ─── PASSWORD INPUT ─────────────────────────────────────────── */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-slate-700">
                    Kata Sandi <span className="text-rose-500">*</span>
                  </label>
                  {mode === 'login' && (
                    <span className="text-[11px] text-emerald-800 font-medium">
                      Min. 6 karakter
                    </span>
                  )}
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimal 6 karakter"
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    className="w-full pl-10 pr-11 py-2.5 sm:py-3 rounded-xl border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700 bg-white transition shadow-2xs"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((p) => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer transition-colors"
                    title={showPassword ? 'Sembunyikan sandi' : 'Tampilkan sandi'}
                  >
                    <EyeIcon open={showPassword} />
                  </button>
                </div>

                {/* Password strength meter for registration */}
                {mode === 'register' && password.length > 0 && (
                  <div className="space-y-1 pt-1 animate-fadeIn">
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

                {/* 30-day persistent session indicator on login */}
                {mode === 'login' && (
                  <div className="flex items-center justify-between text-xs pt-1 select-none">
                    <label className="flex items-center gap-2 text-slate-600 cursor-pointer">
                      <input
                        type="checkbox"
                        defaultChecked
                        className="w-4 h-4 rounded text-emerald-700 border-slate-300 focus:ring-emerald-700/20 accent-emerald-800 cursor-pointer"
                      />
                      <span>Ingat sesi masuk 30 hari</span>
                    </label>
                    <span className="text-[11px] text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/60 flex items-center gap-1">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                      Rolling refresh aktif
                    </span>
                  </div>
                )}
              </div>

              {/* ─── REGISTER SPECIFIC: NOMOR WHATSAPP ──────────────────────── */}
              {mode === 'register' && (
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-700">
                    Nomor WhatsApp / HP
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
                  <p className="text-[11px] text-slate-400">Digunakan untuk koordinasi konfirmasi jadwal jemputan langsung.</p>
                </div>
              )}

              {/* ─── REGISTER SPECIFIC: ROLE WARUNG DETAILS ─────────────────── */}
              {mode === 'register' && role === 'warung' && (
                <div className="space-y-4 pt-2 border-t border-slate-100">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-600" />
                    <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      Informasi Lokasi & Profil Warung
                    </h3>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-slate-700">
                      Nama Warung / Usaha <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={businessName}
                      onChange={(e) => setBusinessName(e.target.value)}
                      placeholder="Contoh: Warung Bu Ani / Resto Berkah"
                      className="w-full px-3.5 py-2.5 sm:py-3 rounded-xl border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700 bg-white transition shadow-2xs"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-slate-700">
                      Alamat Lengkap <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="Jl. Merdeka No. 12, Kelurahan, Kecamatan"
                      className="w-full px-3.5 py-2.5 sm:py-3 rounded-xl border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700 bg-white transition shadow-2xs"
                    />
                  </div>

                  {/* GPS & Map Picker */}
                  <div className="space-y-2 pt-1">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <label className="block text-xs font-semibold text-slate-700">
                        Titik Koordinat Warung (Untuk Rute Kurir)
                      </label>
                      <button
                        type="button"
                        onClick={useMyLocation}
                        disabled={locating}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-semibold border border-emerald-200 transition cursor-pointer self-start sm:self-auto shrink-0 shadow-2xs"
                      >
                        {locating ? (
                          <>
                            <Spinner className="w-3.5 h-3.5 text-emerald-700" />
                            <span>Mendeteksi GPS...</span>
                          </>
                        ) : (
                          <>
                            <svg className="w-3.5 h-3.5 text-emerald-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <circle cx="12" cy="12" r="10" />
                              <circle cx="12" cy="12" r="3" />
                            </svg>
                            <span>Gunakan GPS Saya</span>
                          </>
                        )}
                      </button>
                    </div>

                    <div className="rounded-xl overflow-hidden border border-slate-200 shadow-2xs">
                      <ClientMap
                        center={[Number(lat) || -7.4726, Number(lng) || 110.2198]}
                        zoom={13}
                        height="h-[220px]"
                        markers={
                          lat && lng
                            ? [{ id: 'warung', lat: Number(lat), lng: Number(lng), label: businessName || 'Titik Warung' }]
                            : []
                        }
                        onClick={(lat2, lng2) => {
                          setLat(String(lat2))
                          setLng(String(lng2))
                          toast.success('Titik lokasi berhasil ditandai pada peta')
                        }}
                      />
                    </div>
                    <p className="text-[11px] text-slate-500 flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5 text-emerald-700 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="16" x2="12" y2="12" />
                        <line x1="12" y1="8" x2="12.01" y2="8" />
                      </svg>
                      <span>Klik pada area peta untuk menyesuaikan titik lokasi warung Anda.</span>
                    </p>

                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <div>
                        <label className="text-[11px] font-medium text-slate-500 block mb-0.5">Latitude</label>
                        <input
                          type="text"
                          value={lat}
                          onChange={(e) => setLat(e.target.value)}
                          className="w-full px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-800 font-mono"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-medium text-slate-500 block mb-0.5">Longitude</label>
                        <input
                          type="text"
                          value={lng}
                          onChange={(e) => setLng(e.target.value)}
                          className="w-full px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-800 font-mono"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ─── REGISTER SPECIFIC: ROLE COLLECTOR DETAILS ──────────────── */}
              {mode === 'register' && role === 'collector' && (
                <div className="space-y-4 pt-2 border-t border-slate-100">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-600" />
                    <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      Informasi Armada & Logistik Kolektor
                    </h3>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-slate-700">
                      Jenis Kendaraan Operasional <span className="text-rose-500">*</span>
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { type: 'Motor', icon: <IconMotor className="w-5 h-5 mx-auto" />, label: 'Motor Roda Dua' },
                        { type: 'Tossa', icon: <IconTossa className="w-5 h-5 mx-auto" />, label: 'Tossa / Roda Tiga' },
                        { type: 'Pick-up', icon: <IconPickup className="w-5 h-5 mx-auto" />, label: 'Mobil Pick-up' },
                      ].map((item) => (
                        <button
                          key={item.type}
                          type="button"
                          onClick={() => setVehicleType(item.type)}
                          className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-1.5 ${
                            vehicleType === item.type
                              ? 'border-emerald-700 bg-emerald-50 text-emerald-900 font-bold shadow-2xs'
                              : 'border-slate-200 hover:border-slate-300 text-slate-600'
                          }`}
                        >
                          <div className={vehicleType === item.type ? 'text-emerald-800' : 'text-slate-500'}>
                            {item.icon}
                          </div>
                          <span className="text-[11px] font-semibold block leading-tight">{item.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-slate-700">
                      Estimasi Kapasitas Muatan Maksimal (kg) <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        required
                        min="5"
                        max="2000"
                        value={capacity}
                        onChange={(e) => setCapacity(e.target.value)}
                        placeholder="Contoh: 50"
                        className="w-full px-3.5 pr-12 py-2.5 sm:py-3 rounded-xl border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700 bg-white transition shadow-2xs"
                      />
                      <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                        kg
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400">Digunakan algoritma untuk menghitung batas muatan stop pada rute rekomendasi.</p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-slate-700">
                      Area / Wilayah Layanan Utama
                    </label>
                    <input
                      type="text"
                      value={serviceArea}
                      onChange={(e) => setServiceArea(e.target.value)}
                      placeholder="Contoh: Kota Magelang & Sleman Utara"
                      className="w-full px-3.5 py-2.5 sm:py-3 rounded-xl border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700 bg-white transition shadow-2xs"
                    />
                  </div>
                </div>
              )}

              {/* ─── SUBMIT BUTTON ──────────────────────────────────────────── */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 px-5 rounded-xl bg-emerald-800 hover:bg-emerald-900 active:scale-[0.99] text-white text-sm font-bold transition-all shadow-xs disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer mt-2"
              >
                {loading ? (
                  <>
                    <Spinner className="w-4 h-4 text-white" />
                    <span>{mode === 'login' ? 'Memverifikasi Akun...' : 'Mendaftarkan Akun...'}</span>
                  </>
                ) : (
                  <>
                    <span>
                      {mode === 'login'
                        ? 'Masuk ke Dashboard'
                        : role === 'warung'
                        ? 'Daftar Sebagai Mitra Warung'
                        : 'Daftar Sebagai Kurir / Kolektor'}
                    </span>
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="5" y1="12" x2="19" y2="12" />
                      <polyline points="12 5 19 12 12 19" />
                    </svg>
                  </>
                )}
              </button>

              {/* Toggle Mode Footer Link */}
              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
                  className="text-xs font-semibold text-emerald-800 hover:text-emerald-950 transition-colors cursor-pointer"
                >
                  {mode === 'login' ? (
                    <>Belum memiliki akun? <span className="underline underline-offset-2">Daftar sekarang</span></>
                  ) : (
                    <>Sudah memiliki akun? <span className="underline underline-offset-2">Masuk di sini</span></>
                  )}
                </button>
              </div>

            </form>
          </div>

          {/* Quick Demo Credentials Info (Subtle) */}
          <div className="text-center">
            <span className="text-[11px] text-slate-400">
              Perlu bantuan atau akun uji coba? Hubungi koordinator pangkalan maggot Anda.
            </span>
          </div>

        </div>
      </div>

    </main>
  )
}

// ─── Default Page with Suspense (Required for Next.js useSearchParams) ─────────

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex items-center gap-2 text-slate-500 text-sm">
          <Spinner className="w-5 h-5 text-emerald-700" />
          <span>Memuat halaman...</span>
        </div>
      </div>
    }>
      <LoginContent />
    </Suspense>
  )
}
