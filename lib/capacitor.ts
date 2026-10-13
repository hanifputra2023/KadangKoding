/**
 * lib/capacitor.ts
 * Wrapper untuk Capacitor native plugins.
 * Safe to import di web — semua fungsi di-guard dengan isNativePlatform().
 */

// Cek apakah berjalan di dalam APK (Capacitor native) atau di browser biasa
export function isNative(): boolean {
  return typeof window !== 'undefined' && !!(window as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.()
}

// -- Push Notifications --------------------------------------------------------

export async function requestPushPermission(): Promise<boolean> {
  if (!isNative()) return false
  try {
    const { PushNotifications } = await import('@capacitor/push-notifications')
    const result = await PushNotifications.requestPermissions()
    if (result.receive === 'granted') {
      await PushNotifications.register()
      return true
    }
    return false
  } catch {
    return false
  }
}

export async function onPushNotification(callback: (data: { title?: string; body?: string }) => void) {
  if (!isNative()) return
  try {
    const { PushNotifications } = await import('@capacitor/push-notifications')
    PushNotifications.addListener('pushNotificationReceived', (notification) => {
      callback({ title: notification.title, body: notification.body })
    })
  } catch {
    // ignore
  }
}

export async function getPushToken(): Promise<string | null> {
  if (!isNative()) return null
  try {
    const { PushNotifications } = await import('@capacitor/push-notifications')
    return new Promise((resolve) => {
      PushNotifications.addListener('registration', (token) => resolve(token.value))
      PushNotifications.addListener('registrationError', () => resolve(null))
    })
  } catch {
    return null
  }
}

// -- Local Notifications -------------------------------------------------------

export async function showLocalNotification(title: string, body: string, id = Math.floor(Math.random() * 100000)) {
  if (!isNative()) {
    // Fallback ke browser Notification API
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body })
    }
    return
  }
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications')
    await LocalNotifications.schedule({
      notifications: [{ title, body, id, schedule: { at: new Date(Date.now() + 100) } }],
    })
  } catch {
    // ignore
  }
}

// -- Camera --------------------------------------------------------------------

export async function takePhoto(): Promise<string | null> {
  if (!isNative()) return null
  try {
    const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera')
    const photo = await Camera.getPhoto({
      quality: 80,
      allowEditing: false,
      resultType: CameraResultType.DataUrl,
      source: CameraSource.Camera,
    })
    return photo.dataUrl ?? null
  } catch {
    return null
  }
}

export async function pickPhotoFromGallery(): Promise<string | null> {
  if (!isNative()) return null
  try {
    const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera')
    const photo = await Camera.getPhoto({
      quality: 80,
      allowEditing: false,
      resultType: CameraResultType.DataUrl,
      source: CameraSource.Photos,
    })
    return photo.dataUrl ?? null
  } catch {
    return null
  }
}

// -- Preferences (persistent key-value storage) --------------------------------

export async function setPreference(key: string, value: string) {
  if (!isNative()) { localStorage.setItem(key, value); return }
  try {
    const { Preferences } = await import('@capacitor/preferences')
    await Preferences.set({ key, value })
  } catch {
    localStorage.setItem(key, value)
  }
}

export async function getPreference(key: string): Promise<string | null> {
  if (!isNative()) return localStorage.getItem(key)
  try {
    const { Preferences } = await import('@capacitor/preferences')
    const { value } = await Preferences.get({ key })
    return value
  } catch {
    return localStorage.getItem(key)
  }
}

export async function removePreference(key: string) {
  if (!isNative()) { localStorage.removeItem(key); return }
  try {
    const { Preferences } = await import('@capacitor/preferences')
    await Preferences.remove({ key })
  } catch {
    localStorage.removeItem(key)
  }
}
