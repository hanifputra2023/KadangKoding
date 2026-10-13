import { createBrowserClient } from '@supabase/ssr'

const THIRTY_DAYS_SECONDS = 60 * 60 * 24 * 30 // 30 hari (2,592,000 detik)

let client: ReturnType<typeof createBrowserClient> | null = null

export function createClient() {
  if (client) return client
  client = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: {
        maxAge: THIRTY_DAYS_SECONDS,
        path: '/',
        sameSite: 'lax',
      },
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    }
  )
  return client
}