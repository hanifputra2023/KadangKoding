-- =====================================================================
-- WarungSirkular — Aktifkan Realtime Supabase (copy-paste di SQL Editor)
-- Project: https://uzokxpyxlgfubgxbmqqx.supabase.co
--
-- Cara pakai:
--   1. Buka https://supabase.com/dashboard → pilih project ini.
--   2. Menu kiri → SQL Editor → New query.
--   3. Tempel seluruh isi file ini → klik RUN.
--
-- Catatan: blok penambahan ke publication pakai DO ... EXCEPTION sehingga
-- jika role tidak punya izin (ALTER PUBLICATION), ia TIDAK menghentikan
-- script — cukup lanjut ke langkah manual Replication di bawah.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) REPLICA IDENTITY FULL
--    Agar event UPDATE/DELETE membawa payload data lama di browser.
-- ---------------------------------------------------------------------
ALTER TABLE public.pickup_requests    REPLICA IDENTITY FULL;
ALTER TABLE public.collector_profiles REPLICA IDENTITY FULL;
ALTER TABLE public.warung_profiles    REPLICA IDENTITY FULL;
ALTER TABLE public.routes             REPLICA IDENTITY FULL;
ALTER TABLE public.route_stops        REPLICA IDENTITY FULL;
ALTER TABLE public.users              REPLICA IDENTITY FULL;
ALTER TABLE public.waste_categories   REPLICA IDENTITY FULL;
ALTER TABLE public.audit_logs         REPLICA IDENTITY FULL;

-- ---------------------------------------------------------------------
-- 2) TAMBAHKAN TABEL KE PUBLICATION supabase_realtime
--    Idempoten: tabel yang sudah masuk tidak diubah ulang.
--    Jika role tidak berhak ALTER PUBLICATION, error ditangkap & dilanjut.
-- ---------------------------------------------------------------------
DO $$
DECLARE
  t text;
  tables text[] := array[
    'pickup_requests', 'collector_profiles', 'warung_profiles',
    'routes', 'route_stops', 'users', 'waste_categories', 'audit_logs'
  ];
  already text[];
BEGIN
  SELECT ARRAY(
    SELECT tablename FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public'
  ) INTO already;

  FOREACH t IN ARRAY tables LOOP
    IF NOT t = ANY(already) THEN
      BEGIN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
        RAISE NOTICE 'OK  - % ditambahkan ke publication', t;
      EXCEPTION WHEN insufficient_privilege THEN
        RAISE NOTICE 'GAGAL - % butuh izin superuser (Gunakan panel Database -> Replication!)', t;
      END;
    END IF;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------
-- 2b) PEMERIKSAAN AKHIR (penting!)
--     Jika ada tabel yang BELUM masuk publication, realtime tidak akan jalan.
--     Solusi wajib: Supabase Dashboard -> Database -> Replication ->
--     centang semua tabel pada daftar "Source" -> Save.
-- ---------------------------------------------------------------------
DO $$
DECLARE
  missing text;
BEGIN
  SELECT string_agg(t, ', ')
  INTO missing
  FROM unnest(array[
    'pickup_requests', 'collector_profiles', 'warung_profiles',
    'routes', 'route_stops', 'users', 'waste_categories', 'audit_logs'
  ]) t
  WHERE NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
  );

  IF missing IS NULL THEN
    RAISE NOTICE 'SEMUA 8 tabel sudah masuk publication supabase_realtime. Realtime siap.';
  ELSE
    RAISE NOTICE 'MASIH ADA TABEL BELUM MASUK: %, silakan pakai Database -> Replication.', missing;
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- 3) PASTIKAN POLICY SELECT (dibaca oleh Realtime dengan RLS sisi client)
-- ---------------------------------------------------------------------
-- collector_profiles: izinkan Realtime membaca perubahan jadwal & profil
DROP POLICY IF EXISTS "realtime_select_all_authed" ON public.collector_profiles;
CREATE POLICY "realtime_select_all_authed"
  ON public.collector_profiles FOR SELECT
  TO anon, authenticated
  USING (true);

-- pickup_requests: izinkan Realtime menyiarkan perubahan status
DROP POLICY IF EXISTS "realtime_pickup_select_all" ON public.pickup_requests;
CREATE POLICY "realtime_pickup_select_all"
  ON public.pickup_requests FOR SELECT
  TO anon, authenticated
  USING (true);

-- routes & route_stops: izinkan Realtime menyiarkan pembaruan rute
DROP POLICY IF EXISTS "realtime_routes_select_all" ON public.routes;
CREATE POLICY "realtime_routes_select_all"
  ON public.routes FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "realtime_route_stops_select_all" ON public.route_stops;
CREATE POLICY "realtime_route_stops_select_all"
  ON public.route_stops FOR SELECT
  TO anon, authenticated
  USING (true);


-- ---------------------------------------------------------------------
-- 4) VERIFIKASI
-- ---------------------------------------------------------------------
SELECT schemaname, tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
ORDER BY tablename;

-- =====================================================================
-- ALTERNATIF (dipakai jika langkah 2 gagal karena izin):
--   Supabase Dashboard → Database → Replication → pilih semua tabel
--   pada daftar "Source" lalu Save. Itu memasukkan tabel yang sama ke
--   publication supabase_realtime. Setelah itu ulangi verifikasi (langkah 4).
-- =====================================================================
