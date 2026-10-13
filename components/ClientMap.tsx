"use client"

import dynamic from 'next/dynamic'

export interface MapPoint {
  id: string
  lat: number
  lng: number
  label?: string
  selected?: boolean
}

export interface ClientMapProps {
  center?: [number, number]
  zoom?: number
  markers?: MapPoint[]
  height?: string
  onSelect?: (id: string) => void
  onClick?: (lat: number, lng: number) => void
}

const MapImpl = dynamic(
  () => import('@/components/ui/Map'),
  { ssr: false }
)

export default function ClientMap(props: ClientMapProps) {
  return <MapImpl {...props} />
}
