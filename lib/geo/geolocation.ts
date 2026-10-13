/**
 * Helper geolocation browser (client-side).
 * Membungkus Geolocation API dengan pesan error yang ramah user.
 */

export interface Coords {
  latitude: number
  longitude: number
}

function friendlyError(code: number | null): string {
  switch (code) {
    case 1:
      return 'Izin lokasi ditolak. Izinkan akses lokasi di browser, atau masukkan koordinat manual.'
    case 2:
      return 'Posisi tidak tersedia. Coba lagi atau masukkan koordinat manual.'
    case 3:
      return 'Waktu permintaan lokasi habis. Coba lagi atau masukkan koordinat manual.'
    default:
      return 'Browser tidak dapat mengakses lokasi. Gunakan HTTPS/localhost, atau isi manual.'
  }
}

/** Meminta posisi saat ini via browser. Menolak bila tidak tersedia. */
export function getCurrentPosition(timeoutMs = 10000): Promise<Coords> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !('geolocation' in navigator)) {
      reject(new Error('Geolocation tidak didukung browser ini.'))
      return
    }

    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          latitude: Number(pos.coords.latitude.toFixed(6)),
          longitude: Number(pos.coords.longitude.toFixed(6)),
        }),
      (err) => reject(new Error(friendlyError(err.code))),
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 60000 }
    )
  })
}
