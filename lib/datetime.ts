/**
 * lib/datetime.ts
 *
 * Standarisasi waktu dan zona waktu untuk WarungSirkular.
 * Seluruh aplikasi menggunakan WIB (Waktu Indonesia Barat, UTC+7, Asia/Jakarta)
 * agar konsisten di semua sisi (Warung, Collector/Kurir, Admin), terlepas dari
 * pengaturan jam atau time zone lokal pada perangkat/browser masing-masing user.
 */

export const APP_TIMEZONE = 'Asia/Jakarta'
export const APP_TIMEZONE_LABEL = 'WIB'
export const APP_TIMEZONE_OFFSET_HOURS = 7

/**
 * Mengubah input tanggal/string dari Supabase atau sumber manapun menjadi objek Date yang valid.
 *
 * PENTING: PostgreSQL column TIMESTAMP (without timezone) mengembalikan string ISO
 * tanpa penanda zona waktu (misalnya "2026-10-15T00:00:00").
 * Secara spesifikasi ECMAScript, string ISO tanpa penanda waktu akan di-parse sebagai
 * LOCAL TIME dari perangkat pengguna, yang menyebabkan pergeseran waktu (misalnya jam 07:00 WIB
 * yang disimpan sebagai 00:00 UTC tiba-tiba terbaca sebagai jam 00:00 WIB pada browser lokal).
 *
 * Karena Supabase cloud menyimpan timestamp dalam UTC, jika string tidak memiliki penanda
 * offset ('Z' atau '+07:00' atau offset jam lainnya), kita tambahkan 'Z' agar selalu
 * di-parse sebagai waktu UTC murni secara presisi.
 */
export function parseDbDate(val: string | Date | null | undefined): Date {
  if (!val) return new Date(NaN)
  if (val instanceof Date) return val
  const str = String(val).trim()
  if (!str) return new Date(NaN)

  // Cek apakah sudah memiliki offset zona waktu (mis. "Z", "+07:00", "-05:00")
  const hasTimezone = /Z|[+-]\d{2}(:\d{2})?$/i.test(str)
  if (hasTimezone) {
    return new Date(str)
  }

  // Jika formatnya tanggal saja (mis. "2026-10-15"), parse sebagai jam 00:00:00 WIB
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return new Date(`${str}T00:00:00+07:00`)
  }

  // Format ISO datetime tanpa offset (mis. "2026-10-15T00:00:00" atau "2026-10-15 00:00:00.123")
  const normalized = str.replace(' ', 'T')
  return new Date(`${normalized}Z`)
}

/**
 * Ekstrak komponen tanggal & waktu dalam zona waktu Asia/Jakarta (WIB).
 */
export function getWibParts(dateInput: Date | string = new Date()) {
  const d = typeof dateInput === 'string' ? parseDbDate(dateInput) : dateInput
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: APP_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  })
  const parts = dtf.formatToParts(d)
  const map: Record<string, string> = {}
  for (const p of parts) {
    map[p.type] = p.value
  }
  return {
    year: parseInt(map.year, 10),
    month: parseInt(map.month, 10), // 1 - 12
    day: parseInt(map.day, 10),
    hour: parseInt(map.hour, 10),
    minute: parseInt(map.minute, 10),
    second: parseInt(map.second, 10),
  }
}

/**
 * Mendapatkan string tanggal "YYYY-MM-DD" dalam zona waktu WIB (Asia/Jakarta).
 */
export function getWibDateString(dateInput: Date | string = new Date()): string {
  const p = getWibParts(dateInput)
  const m = String(p.month).padStart(2, '0')
  const d = String(p.day).padStart(2, '0')
  return `${p.year}-${m}-${d}`
}

/**
 * Mendapatkan string tanggal "YYYY-MM-DD" untuk besok dalam zona waktu WIB.
 */
export function getWibTomorrowString(): string {
  const now = new Date()
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000)
  return getWibDateString(tomorrow)
}

/**
 * Format tanggal dalam bahasa Indonesia di zona waktu Asia/Jakarta (WIB).
 * Contoh default: "15 Okt 2026"
 */
export function formatWIBDate(
  dateInput: Date | string | null | undefined,
  options?: Intl.DateTimeFormatOptions
): string {
  if (!dateInput) return '-'
  const d = parseDbDate(dateInput)
  if (isNaN(d.getTime())) return '-'

  const defaultOpts: Intl.DateTimeFormatOptions = {
    timeZone: APP_TIMEZONE,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }

  return new Intl.DateTimeFormat('id-ID', { ...defaultOpts, ...options }).format(d)
}

/**
 * Format waktu dalam format "HH:mm" (24 jam) di zona waktu Asia/Jakarta (WIB).
 * Contoh: "07:00"
 */
export function formatWIBTime(dateInput: Date | string | null | undefined): string {
  if (!dateInput) return '-'
  const d = parseDbDate(dateInput)
  if (isNaN(d.getTime())) return '-'

  const p = getWibParts(d)
  const h = String(p.hour).padStart(2, '0')
  const m = String(p.minute).padStart(2, '0')
  return `${h}:${m}`
}

/**
 * Format waktu beserta label zona waktu ("HH:mm WIB").
 * Contoh: "07:00 WIB"
 */
export function formatWIBTimeWithZone(dateInput: Date | string | null | undefined): string {
  const t = formatWIBTime(dateInput)
  return t === '-' ? '-' : `${t} ${APP_TIMEZONE_LABEL}`
}

/**
 * Format rentang waktu penjemputan ("HH:mm – HH:mm WIB").
 * Contoh: "07:00 – 09:00 WIB"
 */
export function formatWIBTimeRange(
  startInput: Date | string | null | undefined,
  endInput: Date | string | null | undefined
): string {
  const s = formatWIBTime(startInput)
  const e = formatWIBTime(endInput)
  if (s === '-' || e === '-') return '-'
  return `${s} – ${e} ${APP_TIMEZONE_LABEL}`
}

/**
 * Format tanggal & jam lengkap dalam bahasa Indonesia di zona waktu WIB.
 * Contoh: "15 Okt 2026, 07:00 WIB"
 */
export function formatWIBDateTime(
  dateInput: Date | string | null | undefined,
  options?: Intl.DateTimeFormatOptions
): string {
  if (!dateInput) return '-'
  const d = parseDbDate(dateInput)
  if (isNaN(d.getTime())) return '-'

  const dateStr = formatWIBDate(d, options)
  const timeStr = formatWIBTime(d)
  return `${dateStr}, ${timeStr} ${APP_TIMEZONE_LABEL}`
}

/**
 * Membangun string ISO UTC dari tanggal (YYYY-MM-DD) dan jam WIB tertentu.
 * Contoh: dateStr = "2026-10-15", hour = 7, minute = 0
 * -> Di-parse sebagai "2026-10-15T07:00:00+07:00"
 * -> Menghasilkan string ISO UTC "2026-10-15T00:00:00.000Z"
 *
 * Dengan fungsi ini, output selalu identik terlepas dari time zone browser/perangkat klien!
 */
export function buildWibIsoString(dateStr: string, hour: number, minute: number = 0): string {
  const cleanDate = dateStr.slice(0, 10)
  const hStr = String(Math.floor(hour)).padStart(2, '0')
  const mStr = String(Math.floor(minute)).padStart(2, '0')
  const dateObj = new Date(`${cleanDate}T${hStr}:${mStr}:00+07:00`)
  return dateObj.toISOString()
}

/**
 * Mendapatkan Date awal hari (00:00:00 WIB) dalam epoch UTC.
 */
export function getWibStartOfDay(dateInput?: Date | string): Date {
  const dateStr = dateInput ? getWibDateString(dateInput) : getWibDateString()
  return new Date(`${dateStr}T00:00:00+07:00`)
}

/**
 * Mendapatkan Date akhir hari (23:59:59.999 WIB) dalam epoch UTC.
 */
export function getWibEndOfDay(dateInput?: Date | string): Date {
  const dateStr = dateInput ? getWibDateString(dateInput) : getWibDateString()
  return new Date(`${dateStr}T23:59:59.999+07:00`)
}
