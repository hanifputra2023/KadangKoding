import { createClient } from '@/lib/supabase/server'
import { jsonError, jsonOk } from '@/lib/helpers'
import type { Role } from '@/lib/types'

/**
 * POST /api/auth/register
 * Registrasi user multi-role (warung | collector | admin).
 * Body:
 *   { email, password, name, role, phone_number?,
 *     warung?: { business_name, address, latitude, longitude },
 *     collector?: { vehicle_type, vehicle_capacity_kg, service_area, latitude?, longitude? } }
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  if (!body) return jsonError('Body JSON tidak valid', 400)

  const { email, password, name, role, phone_number } = body as {
    email: string
    password: string
    name: string
    role: Role
    phone_number?: string
  }

  if (!email || !password || !name || !role) {
    return jsonError('email, password, name, dan role wajib diisi', 400)
  }
  if (!['warung', 'collector'].includes(role)) {
    return jsonError('Role tidak valid. Pendaftaran hanya untuk warung atau collector.', 400)
  }
  if (password.length < 6) {
    return jsonError('Password minimal 6 karakter', 400)
  }

  const sb = await createClient()

  // Buat user di Supabase Auth. Role & profil disimpan di user_metadata,
  // kemudian trigger handle_new_user() menyalin ke public.users.
  const { data, error } = await sb.auth.signUp({
    email,
    password,
    options: {
      data: {
        name,
        role,
        phone_number: phone_number ?? null,
        // Data profil awal disimpan sementara di metadata
        // agar tersedia bagi langkah berikutnya (insert profil).
        profile:
          role === 'warung'
            ? body.warung ?? null
            : role === 'collector'
              ? body.collector ?? null
              : null,
      },
    },
  })

  if (error) return jsonError(error.message, 400)

  const authUserId = data.user?.id
  if (!authUserId) {
    return jsonError('Gagal membuat user', 500)
  }

  // Insert profil sesuai role (menggunakan sesi baru yang valid).
  if (role === 'warung') {
    const w = body.warung as
      | { business_name: string; address: string; latitude: number; longitude: number }
      | undefined
    if (!w?.business_name || !w.address || !w.latitude || !w.longitude) {
      return jsonError('warung.business_name, address, latitude, longitude wajib diisi', 400)
    }
    const { error: pErr } = await sb.from('warung_profiles').insert({
      user_id: authUserId,
      business_name: w.business_name,
      address: w.address,
      latitude: w.latitude,
      longitude: w.longitude,
    })
    if (pErr) return jsonError('Gagal menyimpan profil warung: ' + pErr.message, 500)
  }

  if (role === 'collector') {
    const c = body.collector as
      | {
          vehicle_type: string
          vehicle_capacity_kg?: number
          service_area?: string
          latitude?: number
          longitude?: number
        }
      | undefined
    if (!c?.vehicle_type) {
      return jsonError('collector.vehicle_type wajib diisi', 400)
    }
    const { error: pErr } = await sb.from('collector_profiles').insert({
      user_id: authUserId,
      vehicle_type: c.vehicle_type,
      vehicle_capacity_kg: c.vehicle_capacity_kg ?? 50,
      service_area: c.service_area ?? null,
      latitude: c.latitude ?? null,
      longitude: c.longitude ?? null,
    })
    if (pErr) return jsonError('Gagal menyimpan profil collector: ' + pErr.message, 500)
  }

  return jsonOk({
    message: 'Registrasi berhasil',
    user: {
      id: authUserId,
      email,
      role,
    },
  }, 201)
}
