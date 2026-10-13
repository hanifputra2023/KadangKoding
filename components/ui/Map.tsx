"use client"

import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import MarkerClusterGroup from 'react-leaflet-cluster'

const customIcon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
})

const selectedIcon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  className: 'leaflet-marker-selected',
})

interface MapPoint {
  id: string
  lat: number
  lng: number
  label?: string
  selected?: boolean
}

interface MapProps {
  center?: [number, number]
  zoom?: number
  markers?: MapPoint[]
  height?: string
  /** Dipanggil saat marker di-klik. */
  onSelect?: (id: string) => void
  /** Dipanggil saat peta di-klik (menghasilkan koordinat baru). */
  onClick?: (lat: number, lng: number) => void
}

function ClickHandler({ onClick }: { onClick?: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onClick?.(e.latlng.lat, e.latlng.lng)
    },
  })
  return null
}

export default function Map({
  center = [-7.4726, 110.2198],
  zoom = 12,
  markers = [],
  height = 'h-[400px]',
  onSelect,
  onClick,
}: MapProps) {
  return (
    <MapContainer center={center} zoom={zoom} className={`${height} w-full rounded-lg z-0`}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {onClick && <ClickHandler onClick={onClick} />}
      <MarkerClusterGroup chunkedLoading>
        {markers.map((m) => (
          <Marker
            key={m.id}
            position={[m.lat, m.lng]}
            icon={m.selected ? selectedIcon : customIcon}
            eventHandlers={onSelect ? { click: () => onSelect(m.id) } : undefined}
          >
            {m.label && (
              <Popup>
                <div className="text-xs">
                  <p className="font-semibold">{m.label}</p>
                  <p className="text-slate-500">
                    {m.lat.toFixed(5)}, {m.lng.toFixed(5)}
                  </p>
                </div>
              </Popup>
            )}
          </Marker>
        ))}
      </MarkerClusterGroup>
    </MapContainer>
  )
}
