"use client"

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export interface RealtimeChangeInfo {
  table?: string
  eventType?: 'INSERT' | 'UPDATE' | 'DELETE' | string
  isRealtimeEvent: boolean
  source: 'websocket' | 'poll' | 'focus'
}

/**
 * useRealtimeTables
 * Subscribe Realtime (Postgres Changes) pada sekumpulan tabel dengan update cerdas:
 * 1. WebSocket postgres_changes event — update instan & akurat saat data benar-benar berubah di DB.
 * 2. Fallback polling sebagai safety net ketika koneksi websocket belum/tidak tersambung.
 * 3. Sync saat tab/jendela browser difokuskan kembali (visibilitychange/focus).
 *
 * Mengirim metadata event (table, eventType, isRealtimeEvent) ke callback sehingga konsumen
 * dapat membedakan aksi yang perlu refresh berat vs aksi yang silent/spesifik.
 *
 * Returns status koneksi realtime: 'connecting' | 'connected' | 'error'
 */
export function useRealtimeTables(
  tables: string[],
  onAnyChange: (info?: RealtimeChangeInfo) => void,
  deps: unknown[] = []
): 'connecting' | 'connected' | 'error' {
  const cbRef = useRef(onAnyChange)
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)
  const pendingEventRef = useRef<RealtimeChangeInfo | undefined>(undefined)
  const [status, setStatus] = useState<'connecting' | 'connected' | 'error'>('connecting')
  const statusRef = useRef(status)

  useEffect(() => {
    cbRef.current = onAnyChange
  })

  useEffect(() => {
    statusRef.current = status
  }, [status])

  const triggerChange = (info: RealtimeChangeInfo) => {
    // Simpan event terbaru (terutama prioritaskan event real-time database daripada polling biasa)
    if (!pendingEventRef.current || info.isRealtimeEvent) {
      pendingEventRef.current = info
    }

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    debounceTimerRef.current = setTimeout(() => {
      const eventToDispatch = pendingEventRef.current
      pendingEventRef.current = undefined
      cbRef.current?.(eventToDispatch)
    }, 200)
  }

  useEffect(() => {
    const sb = createClient()
    const sortedKey = [...tables].sort().join('_')
    const channelName = `realtime_ws_${sortedKey}`
    const channel = sb.channel(channelName)

    for (const table of tables) {
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table },
        (payload: { eventType: string }) => {
          triggerChange({
            table,
            eventType: payload.eventType,
            isRealtimeEvent: true,
            source: 'websocket',
          })
        }
      )
    }

    channel.subscribe((subStatus: string, err?: Error) => {
      if (subStatus === 'SUBSCRIBED') {
        setStatus('connected')
      } else if (subStatus === 'CHANNEL_ERROR' || subStatus === 'TIMED_OUT' || err) {
        setStatus('error')
      }
    })

    // Polling cerdas:
    // Jika WebSocket sudah CONNECTED, kita tidak perlu polling agresif setiap 4 detik
    // karena Supabase langsung mengalirkan event perubahan lewat websocket.
    // Polling hanya berjalan santai (30s) atau jika websocket terputus/error (10s).
    const pollInterval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        const isConnected = statusRef.current === 'connected'
        // Jika belum terkoneksi, selalu trigger fallback
        // Jika sudah terkoneksi, biarkan websocket bekerja tanpa membebani aplikasi
        if (!isConnected) {
          triggerChange({ isRealtimeEvent: false, source: 'poll' })
        }
      }
    }, 10000)

    // Sync instan saat tab browser kembali difokuskan
    const handleFocus = () => {
      if (document.visibilityState === 'visible') {
        triggerChange({ isRealtimeEvent: false, source: 'focus' })
      }
    }
    window.addEventListener('visibilitychange', handleFocus)
    window.addEventListener('focus', handleFocus)

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
      clearInterval(pollInterval)
      window.removeEventListener('visibilitychange', handleFocus)
      window.removeEventListener('focus', handleFocus)
      sb.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tables.slice().sort().join(','), ...deps])

  return status
}
