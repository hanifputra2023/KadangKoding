import { createClient } from '@/lib/supabase/client'

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp']
const MAX_SIZE = 5 * 1024 * 1024 // 5 MB
const BUCKET = 'pickup-photos'

export async function apiUpload(file: File | Blob): Promise<string> {
  if (!ALLOWED_MIME.includes(file.type)) {
    throw new Error('Format file harus JPG, PNG, atau WebP')
  }
  if (file.size > MAX_SIZE) {
    throw new Error('Ukuran file maksimal 5 MB')
  }

  const sb = createClient()
  const { data: { user } } = await sb.auth.getUser()
  const userId = user?.id || 'guest'

  const ext = file.type.split('/')[1] === 'jpeg' ? 'jpg' : file.type.split('/')[1] || 'jpg'
  const path = `${userId}/${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${ext}`

  const { error: upErr } = await sb.storage.from(BUCKET).upload(path, file, {
    contentType: file.type,
    cacheControl: '3600',
    upsert: false,
  })

  if (upErr) {
    const msg = upErr.message.toLowerCase()
    if (/not found|bucket|couldn'?t find|does not exist/.test(msg)) {
      throw new Error(`Bucket "${BUCKET}" belum dibuat di Supabase Storage. Buat bucket "${BUCKET}" (public) di Supabase Dashboard.`)
    }
    throw new Error('Gagal upload: ' + upErr.message)
  }

  const { data: pub } = sb.storage.from(BUCKET).getPublicUrl(path)
  return pub.publicUrl
}
