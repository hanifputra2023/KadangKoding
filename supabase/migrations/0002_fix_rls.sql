-- ============================================================
-- WarungSirkular — FIX RLS: hapus semua policy lama lalu buat ulang
-- Dipakai bila masih muncul error "infinite recursion detected in
-- policy for relation ..." akibat policy lama yang tersisa.
-- Jalankan DI SINI SETELAH 0001_init.sql (pembersih + rebuild RLS).
-- Aman dijalankan berulang.
-- ============================================================

-- 1) Hapus SEMUA policy dari tabel yang bermasalah (anti-rekursi alias lama)
DO $$
DECLARE
  t TEXT;
  p RECORD;
  target TEXT[] := ARRAY[
    'users','warung_profiles','collector_profiles','waste_categories',
    'pickup_requests','routes','route_stops','audit_logs'
  ];
BEGIN
  FOREACH t IN ARRAY target LOOP
    FOR p IN
      SELECT policyname
      FROM pg_policies
      WHERE schemaname = 'public' AND tablename = t
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p.policyname, t);
    END LOOP;
  END LOOP;
END $$;

-- 2) Helper admin (SECURITY DEFINER, bypass RLS — anti-rekursi)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin');
$$;

-- 3) Pastikan RLS aktif
ALTER TABLE public.users               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warung_profiles     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collector_profiles  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waste_categories    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pickup_requests     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.routes              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.route_stops         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs          ENABLE ROW LEVEL SECURITY;

-- 4) Rebuild policies yang benar
CREATE POLICY "waste_categories_auth_read" ON public.waste_categories
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "users_select" ON public.users
  FOR SELECT USING (auth.uid() = id OR public.is_admin());

CREATE POLICY "admin_all_users" ON public.users
  FOR ALL USING (public.is_admin());

CREATE POLICY "warung_select_all" ON public.warung_profiles
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "warung_own_all" ON public.warung_profiles
  USING (auth.uid() = user_id OR public.is_admin());
CREATE POLICY "warung_insert_own" ON public.warung_profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "collector_select_all" ON public.collector_profiles
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "collector_own_all" ON public.collector_profiles
  USING (auth.uid() = user_id OR public.is_admin());
CREATE POLICY "collector_insert_own" ON public.collector_profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "pickup_read" ON public.pickup_requests
  FOR SELECT USING (
    (SELECT EXISTS (SELECT 1 FROM public.warung_profiles w
                    WHERE w.id = pickup_requests.warung_id AND w.user_id = auth.uid())) OR
    (SELECT EXISTS (SELECT 1 FROM public.collector_profiles c
                    WHERE c.id = pickup_requests.collector_id AND c.user_id = auth.uid())) OR
    pickup_requests.status = 'pending' OR
    public.is_admin()
  );
CREATE POLICY "pickup_insert_warung" ON public.pickup_requests
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.warung_profiles w
            WHERE w.id = pickup_requests.warung_id AND w.user_id = auth.uid()) OR
    public.is_admin()
  );
CREATE POLICY "pickup_update_owner" ON public.pickup_requests
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.warung_profiles w
            WHERE w.id = pickup_requests.warung_id AND w.user_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM public.collector_profiles c
            WHERE c.id = pickup_requests.collector_id AND c.user_id = auth.uid()) OR
    (pickup_requests.status = 'pending' AND
     EXISTS (SELECT 1 FROM public.collector_profiles c
             WHERE c.user_id = auth.uid())) OR
    public.is_admin()
  );
CREATE POLICY "admin_all_pickups" ON public.pickup_requests
  FOR ALL USING (public.is_admin());

CREATE POLICY "route_collector_writer" ON public.routes
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.collector_profiles c
            WHERE c.id = routes.collector_id AND c.user_id = auth.uid()) OR
    public.is_admin()
  );

CREATE POLICY "route_stops_insert" ON public.route_stops
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "route_stops_update" ON public.route_stops
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.routes r
            JOIN public.collector_profiles c ON c.id = r.collector_id
            WHERE r.id = route_stops.route_id AND c.user_id = auth.uid()) OR
    public.is_admin()
  );

CREATE POLICY "audit_logs_insert" ON public.audit_logs
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- 5) Pastikan seed kategori ada (buat ulang bila kosong)
INSERT INTO public.waste_categories (category_name, description, is_maggot_friendly)
SELECT v.category_name, v.description, v.is_maggot_friendly
FROM (VALUES
  ('Sisa Nasi/Lauk', 'Sisa nasi, sayur, dan lauk olahan siap konsumsi maggot', TRUE),
  ('Sayur/Buah', 'Sisa sayur dan buah segar atau sisa olahan', TRUE),
  ('Campuran', 'Campuran bahan organik yang masih layak olah', TRUE)
) AS v(category_name, description, is_maggot_friendly)
WHERE NOT EXISTS (SELECT 1 FROM public.waste_categories);
