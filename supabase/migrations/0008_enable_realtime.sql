-- WarungSirkular - 0008
-- Aktifkan Supabase Realtime (Postgres Changes) agar halaman warung, collector,
-- dan admin auto-update tanpa refresh manual.
--
-- Realtime hanya memantau tabel yang menjadi anggota publication `supabase_realtime`
-- DAN direplikasi dengan REPLICA IDENTITY FULL. Seluruh RLS SELECT sudah ada di
-- migrasi 0001/0002; migrasi ini melengkapi sisi replikasi.
--
-- Bagian ini dijalankan via `supabase db push` (role postgres = superuser).
-- Catatan: jika project di-host di Supabase dan Anda tidak memakai `supabase db push`,
-- jalankan blok 2a + 2b di Supabase Dashboard → SQL Editor (role ini boleh
-- ALTER PUBLICATION ... ADD TABLE karena tabel milik postgres).

-- 2a. Replica Identity FULL agar payload event mengandung data lama (untuk UPDATE/DELETE)
ALTER TABLE public.pickup_requests    REPLICA IDENTITY FULL;
ALTER TABLE public.collector_profiles REPLICA IDENTITY FULL;
ALTER TABLE public.warung_profiles    REPLICA IDENTITY FULL;
ALTER TABLE public.routes             REPLICA IDENTITY FULL;
ALTER TABLE public.route_stops        REPLICA IDENTITY FULL;
ALTER TABLE public.users              REPLICA IDENTITY FULL;
ALTER TABLE public.waste_categories   REPLICA IDENTITY FULL;
ALTER TABLE public.audit_logs         REPLICA IDENTITY FULL;

-- 2b. Tambahkan tiap tabel ke publication `supabase_realtime` (idempoten).
--    Blok DO memeriksa dulu, jadi aman dijalankan ulang (tidak error 42710).
DO $$
DECLARE
  t text;
  tables text[] := array[
    'pickup_requests', 'collector_profiles', 'warung_profiles',
    'routes', 'route_stops', 'users', 'waste_categories', 'audit_logs'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;

-- 3a. Pastikan collector_profiles punya policy SELECT untuk authenticated,
--     karena realtime membaca data dengan RLS sisi client yang subscribe.
DROP POLICY IF EXISTS "realtime_select_all_authed" ON public.collector_profiles;
CREATE POLICY "realtime_select_all_authed"
  ON public.collector_profiles FOR SELECT
  TO authenticated
  USING (true);

-- Verifikasi tabel sudah menjadi anggota publication
SELECT schemaname, tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
ORDER BY tablename;
