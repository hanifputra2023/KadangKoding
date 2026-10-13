import { createClient } from '@/lib/supabase/server'
import { requireUser, logAudit, jsonError, jsonOk } from '@/lib/helpers'

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp']
const MAX_SIZE = 5 * 1024 * 1024 // 5 MB (PRD 6.2)
const BUCKET = 'pickup-photos'

/**
 * POST /api/upload
 * Upload foto (multipart/form-data, field "file").
 * Menargetkan Supabase Storage bucket "pickup-photos".
 * Memvalidasi mime-type & ukuran sesuai PRD 6.2.
 *
 * Catatan: bucket harus dibuat terlebih dahulu di Supabase.
 * Path: {userId}/{uuid}.{ext}
 */
export async function POST(request: Request) {
  const sb = await createClient()
  const { user, error } = await requireUser(sb)
  if (error) return error

  const form = await request.formData().catch(() => null)
  const file = form?.get('file')
  if (!file || typeof file === 'string' || !(file instanceof Blob)) {
    return jsonError('File belum diunggah', 400)
  }

  if (!ALLOWED_MIME.includes(file.type)) {
    return jsonError('Format file harus JPG, PNG, atau WebP', 400)
  }
  if (file.size > MAX_SIZE) {
    return jsonError('Ukuran file maksimal 5 MB', 400)
  }

  const ext = file.type.split('/')[1] === 'jpeg' ? 'jpg' : file.type.split('/')[1]
  const path = `${user.id}/${crypto.randomUUID()}.${ext}`

  const { error: upErr } = await sb.storage.from(BUCKET).upload(path, file, {
    contentType: file.type,
    cacheControl: '3600',
    upsert: false,
  })
  if (upErr) {
    const msg = upErr.message.toLowerCase()
    const hint = /not found|bucket|couldn'?t find|does not exist/.test(msg)
      ? `Bucket "${BUCKET}" belum ada di Supabase Storage project ini. Buat bucket "pickup-photos" (public) di Dashboard > Storage, lalu coba lagi.`
      : null
    return jsonError(hint ?? 'Gagal upload: ' + upErr.message, 500)
  }

  const { data: pub } = sb.storage.from(BUCKET).getPublicUrl(path)

  await logAudit(sb, {
    user_id: user.id,
    action: 'UPLOAD_PHOTO',
    resource_type: 'storage',
    metadata: { path, url: pub.publicUrl },
  })

  return jsonOk({ url: pub.publicUrl })
}
