import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

const THIRTY_DAYS_SECONDS = 60 * 60 * 24 * 30 // 30 hari (2,592,000 detik)

/**
 * Server-side Supabase client untuk Route Handler / Server Component.
 * Membaca & menulis cookie sesi secara aman melalui `@supabase/ssr` dengan masa aktif 30 hari rolling.
 */
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: {
        maxAge: THIRTY_DAYS_SECONDS,
        path: '/',
        sameSite: 'lax',
      },
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, {
                ...options,
                maxAge: THIRTY_DAYS_SECONDS,
                path: '/',
                sameSite: 'lax',
              })
            )
          } catch {
            // Dipanggil dari Server Component; abaikan (Next menangani header).
          }
        },
      },
    }
  )
}
