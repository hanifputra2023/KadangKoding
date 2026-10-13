Backend
Folder	Isi
app/api/	Semua route handler (API backend) — auth/, warung/, collector/, admin/, categories/, upload/, rute/, cron/
lib/supabase/	Klien Supabase (client, server, service)
lib/geo/	Routing engine (Haversine/Nearest-Neighbor) + geolocation
lib/helpers.ts, lib/types.ts	Helper auth/audit & tipe
supabase/migrations/	Skema database + RLS (4 file 0001–0004)
Frontend
Folder	Isi
app/	Halaman — login/, warung/, collector/, admin/ (+ page.tsx root)
components/ui/	Komponen UI (Button, Card, Input, Map.tsx, dsb.)