-- WarungSirkular - 0004 (fix)
-- Masalah: tabel route_stops tidak punya policy SELECT, sehingga collector
-- tidak bisa membaca titik rutenya sendiri. Akibatnya relasi route_stops kosong
-- dan UI "Rute Saya" tidak menampilkan stop beserta tombol Selesaikan/Gagalkan.
-- Jalankan di SQL Editor project: https://uzokxpyxlgfubgxbmqqx.supabase.co

-- Izinkan collector pemilik rute (atau admin) membaca rute_stops
DROP POLICY IF EXISTS "route_stops_select" ON public.route_stops;
CREATE POLICY "route_stops_select" ON public.route_stops
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.routes r
            JOIN public.collector_profiles c ON c.id = r.collector_id
            WHERE r.id = route_stops.route_id AND c.user_id = auth.uid()) OR
    public.is_admin()
  );

-- Verifikasi: daftar policy route_stops (harus ada select)
SELECT policyname, cmd FROM pg_policies WHERE schemaname='public' AND tablename='route_stops';
