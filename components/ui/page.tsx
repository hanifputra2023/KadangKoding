import dynamic from 'next/dynamic'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const MapWithNoSSR = dynamic(() => import('@/components/ui/Map'), {
  ssr: false,
  loading: () => (
    <div className="h-[400px] w-full bg-slate-100 animate-pulse rounded-lg flex items-center justify-center text-slate-400">
      Memuat Peta...
    </div>
  )
})

export default function HomePage() {
  return (
    <main className="min-h-screen p-8 max-w-5xl mx-auto space-y-6 bg-slate-50/50">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            WarungSirkular Dashboard
          </h1>
          <p className="text-slate-500">
            Sistem Pengelolaan Sampah Organik & Rute Penjemputan Real-time.
          </p>
        </div>
        <Button>Minta Penjemputan</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Peta Lokasi Penjemputan</CardTitle>
        </CardHeader>
        <CardContent>
          <MapWithNoSSR />
        </CardContent>
      </Card>
    </main>
  )
}