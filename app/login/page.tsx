"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { toast } from 'sonner'
import { getCurrentPosition } from '@/lib/geo/geolocation'
import ClientMap from '@/components/ClientMap'

import { apiLogin, apiRegister, apiGetMe } from '@/lib/api/auth'

type Role = 'warung' | 'collector' | 'admin'
type Mode = 'login' | 'register'

const fieldCls = 'w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm'

export default function LoginPage() {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('login')
  const [loading, setLoading] = useState(false)
  const [locating, setLocating] = useState(false)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [role, setRole] = useState<Role>('warung')
  const [phone, setPhone] = useState('')
  const [businessName, setBusinessName] = useState('')
  const [address, setAddress] = useState('')
  const [lat, setLat] = useState('-7.4726')
  const [lng, setLng] = useState('110.2198')
  const [vehicleType, setVehicleType] = useState('Motor')
  const [capacity, setCapacity] = useState('50')
  const [serviceArea, setServiceArea] = useState('')

  async function submit() {
    setLoading(true)
    try {
      if (mode === 'login') {
        const res = await apiLogin(email, password)
        if (res.error || !res.user) throw new Error(res.error || 'Login gagal')
        toast.success('Login berhasil')
        router.replace(`/${res.user.role}`)
      } else {
        const res = await apiRegister({
          email,
          password,
          name,
          role: role as 'warung' | 'collector',
          phone_number: phone || undefined,
          warung: role === 'warung' ? {
            business_name: businessName,
            address,
            latitude: Number(lat),
            longitude: Number(lng),
          } : undefined,
          collector: role === 'collector' ? {
            vehicle_type: vehicleType,
            vehicle_capacity_kg: Number(capacity),
            service_area: serviceArea || undefined,
          } : undefined,
        })
        if (res.error || !res.user) throw new Error(res.error || 'Registrasi gagal')
        toast.success('Registrasi berhasil')
        router.replace(`/${res.user.role}`)
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Terjadi kesalahan')
    } finally {
      setLoading(false)
    }
  }

  // Supabase default session — cek apakah sudah login
  useEffect(() => {
    apiGetMe()
      .then((user) => {
        if (user) router.replace(`/${user.role}`)
      })
      .catch(() => {})
  }, [router])

  async function useMyLocation() {
    setLocating(true)
    try {
      const coords = await getCurrentPosition()
      setLat(String(coords.latitude))
      setLng(String(coords.longitude))
      toast.success('Lokasi terisi dari GPS')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Gagal mengambil lokasi')
    } finally {
      setLocating(false)
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-xl">WarungSirkular</CardTitle>
          <CardDescription>
            {mode === 'login' ? 'Masuk ke akun Anda' : 'Buat akun baru'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {mode === 'register' && (
            <>
              <div>
                <label className="text-xs font-medium">Nama</label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nama lengkap" />
              </div>
              <div>
                <label className="text-xs font-medium">Role (hackathon MVP)</label>
                <select className={fieldCls} value={role} onChange={(e) => setRole(e.target.value as Role)}>
                  <option value="warung">Warung</option>
                  <option value="collector">Collector</option>
                </select>
              </div>
            </>
          )}

          <div>
            <label className="text-xs font-medium">Email</label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" />
          </div>
          <div>
            <label className="text-xs font-medium">Password</label>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min. 6 karakter" />
          </div>

          {mode === 'register' && role === 'warung' && (
            <>
              <div>
                <label className="text-xs font-medium">Nama Warung</label>
                <Input value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="Warung Bu Ani" />
              </div>
              <div>
                <label className="text-xs font-medium">Alamat</label>
                <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Jl. Merdeka No. 12" />
              </div>
              <div className="flex items-end gap-2">
                <Button type="button" variant="secondary" size="sm" onClick={useMyLocation} disabled={locating} className="shrink-0">
                  {locating ? 'Mencari...' : 'Gunakan Lokasi Saya'}
                </Button>
                <p className="text-xs text-slate-400">
                  Otomatis isi koordinat dari GPS (butuh izin lokasi).
                </p>
              </div>
              <div>
                <ClientMap
                  center={[Number(lat) || -7.4726, Number(lng) || 110.2198]}
                  zoom={13}
                  height="h-[260px]"
                  markers={
                    lat && lng
                      ? [{ id: 'warung', lat: Number(lat), lng: Number(lng), label: businessName || 'Lokasi Warung' }]
                      : []
                  }
                  onClick={(lat2, lng2) => {
                    setLat(String(lat2))
                    setLng(String(lng2))
                  }}
                />
                <p className="mt-1 text-xs text-slate-400">Klik peta untuk menempatkan lokasi warung.</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-medium">Latitude</label>
                  <Input value={lat} onChange={(e) => setLat(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs font-medium">Longitude</label>
                  <Input value={lng} onChange={(e) => setLng(e.target.value)} />
                </div>
              </div>
            </>
          )}

          {mode === 'register' && role === 'collector' && (
            <>
              <div>
                <label className="text-xs font-medium">Jenis Kendaraan</label>
                <select className={fieldCls} value={vehicleType} onChange={(e) => setVehicleType(e.target.value)}>
                  <option>Motor</option>
                  <option>Tossa</option>
                  <option>Pick-up</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium">Kapasitas (kg)</label>
                <Input type="number" value={capacity} onChange={(e) => setCapacity(e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-medium">Area Layanan</label>
                <Input value={serviceArea} onChange={(e) => setServiceArea(e.target.value)} placeholder="mis. Yogyakarta" />
              </div>
            </>
          )}

          {mode === 'register' && (
            <div>
              <label className="text-xs font-medium">No. HP (opsional)</label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="08xx" />
            </div>
          )}

          <Button className="w-full" onClick={submit} disabled={loading}>
            {loading ? 'Memproses...' : mode === 'login' ? 'Masuk' : 'Daftar'}
          </Button>

          <button
            type="button"
            className="w-full text-center text-xs text-primary underline-offset-4 hover:underline"
            onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
          >
            {mode === 'login' ? 'Belum punya akun? Daftar di sini' : 'Sudah punya akun? Masuk'}
          </button>
        </CardContent>
      </Card>
    </main>
  )
}
