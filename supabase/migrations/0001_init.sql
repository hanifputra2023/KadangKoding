-- ============================================================
-- WarungSirkular — Schema Initial (v1.0)
-- PostgreSQL / Supabase dialect
-- Sesuai PRD v1.0 Section 9 (Data Model)
-- Apply via: Supabase SQL Editor / supabase db push
-- ============================================================

-- Ensure UUID extension (Supabase already enables it; idempotent guard)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ------------------------------------------------------------
-- 1. users
-- Tabel profil login. ID diambil dari auth.users (Supabase Auth)
-- via trigger, agar auth & RBAC konsisten dengan Supabase.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          VARCHAR(100) NOT NULL,
  email         VARCHAR(150) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role          VARCHAR(20) NOT NULL CHECK (role IN ('warung', 'collector', 'admin')),
  phone_number  VARCHAR(20),
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------
-- 2. warung_profiles
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.warung_profiles (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID UNIQUE NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  business_name VARCHAR(150) NOT NULL,
  address       TEXT NOT NULL,
  latitude      DECIMAL(10, 8) NOT NULL,
  longitude     DECIMAL(11, 8) NOT NULL,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------
-- 3. collector_profiles
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.collector_profiles (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID UNIQUE NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  vehicle_type       VARCHAR(50) NOT NULL,
  vehicle_capacity_kg DECIMAL(8, 2) NOT NULL DEFAULT 50.00,
  service_area       VARCHAR(100),
  latitude           DECIMAL(10, 8),
  longitude          DECIMAL(11, 8),
  created_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------
-- 4. waste_categories
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.waste_categories (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_name     VARCHAR(50) NOT NULL,
  description       TEXT,
  is_maggot_friendly BOOLEAN DEFAULT TRUE
);

-- ------------------------------------------------------------
-- 5. pickup_requests
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pickup_requests (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  warung_id           UUID NOT NULL REFERENCES public.warung_profiles(id),
  collector_id        UUID REFERENCES public.collector_profiles(id),
  waste_category_id   UUID NOT NULL REFERENCES public.waste_categories(id),
  estimated_weight_kg DECIMAL(8, 2) NOT NULL CHECK (estimated_weight_kg > 0),
  actual_weight_kg    DECIMAL(8, 2),
  sample_photo_url    TEXT,
  proof_photo_url     TEXT,
  latitude            DECIMAL(10, 8) NOT NULL,
  longitude           DECIMAL(11, 8) NOT NULL,
  pickup_window_start TIMESTAMP NOT NULL,
  pickup_window_end   TIMESTAMP NOT NULL,
  status              VARCHAR(20) DEFAULT 'pending'
                      CHECK (status IN ('pending','assigned','in_progress','completed','cancelled','failed','expired')),
  failure_reason      TEXT,
  created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  assigned_at         TIMESTAMP,
  completed_at        TIMESTAMP,
  expired_at          TIMESTAMP
);

-- ------------------------------------------------------------
-- 6. routes
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.routes (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collector_id     UUID NOT NULL REFERENCES public.collector_profiles(id),
  total_distance_km DECIMAL(8, 2) DEFAULT 0.00,
  total_weight_kg  DECIMAL(8, 2) DEFAULT 0.00,
  status           VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active','completed','cancelled')),
  created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at     TIMESTAMP
);

-- ------------------------------------------------------------
-- 7. route_stops
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.route_stops (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id          UUID NOT NULL REFERENCES public.routes(id) ON DELETE CASCADE,
  pickup_request_id UUID NOT NULL REFERENCES public.pickup_requests(id),
  sequence_number   INT NOT NULL,
  status            VARCHAR(20) DEFAULT 'pending'
                    CHECK (status IN ('pending','completed','failed','cancelled'))
);

-- ------------------------------------------------------------
-- 8. audit_logs
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES public.users(id),
  action        VARCHAR(100) NOT NULL,
  resource_type VARCHAR(50) NOT NULL,
  resource_id   UUID,
  metadata      JSONB,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------
-- Indexes (performance)
-- ------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_pickup_requests_status        ON public.pickup_requests(status);
CREATE INDEX IF NOT EXISTS idx_pickup_requests_warung        ON public.pickup_requests(warung_id);
CREATE INDEX IF NOT EXISTS idx_pickup_requests_collector     ON public.pickup_requests(collector_id);
CREATE INDEX IF NOT EXISTS idx_pickup_requests_waste_cat     ON public.pickup_requests(waste_category_id);
CREATE INDEX IF NOT EXISTS idx_route_stops_route             ON public.route_stops(route_id);
CREATE INDEX IF NOT EXISTS idx_route_stops_pickup            ON public.route_stops(pickup_request_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user               ON public.audit_logs(user_id);

-- ------------------------------------------------------------
-- Seeder: Waste Categories (PRD: Sisa Nasi/Lauk, Sayur/Buah, Campuran)
-- ------------------------------------------------------------
INSERT INTO public.waste_categories (category_name, description, is_maggot_friendly) VALUES
  ('Sisa Nasi/Lauk', 'Sisa nasi, sayur, dan lauk olahan siap konsumsi maggot', TRUE),
  ('Sayur/Buah', 'Sisa sayur dan buah segar atau sisa olahan', TRUE),
  ('Campuran', 'Campuran bahan organik yang masih layak olah', TRUE)
ON CONFLICT DO NOTHING;

-- ============================================================
-- Row Level Security (RLS) — sesuai NFR Security 6.2
-- Kebijakan berbasis ownership/role. Server route handler tetap
-- melakukan authorization secara eksplisit; RLS sebagai lapisan
-- pertahanan tambahan.
-- ============================================================

-- Helper SECURITY DEFINER untuk mengecek apakah user adalah admin.
-- Penting: menggunakan SECURITY DEFINER agar subquery membaca tabel
-- `users` TANPA memicu rekursi RLS. (Fungsi ini diizinkan oleh definer,
-- bukan oleh pemanggilnya.)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin');
$$;

ALTER TABLE public.users            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warung_profiles  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collector_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waste_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pickup_requests  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.routes           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.route_stops      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs       ENABLE ROW LEVEL SECURITY;

-- Semua user terautentikasi boleh membaca kategori sampah
DROP POLICY IF EXISTS "waste_categories_auth_read" ON public.waste_categories;
CREATE POLICY "waste_categories_auth_read" ON public.waste_categories
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- users: user hanya melihat dirinya sendiri; admin melihat semua
DROP POLICY IF EXISTS "users_select" ON public.users;
DROP POLICY IF EXISTS "users_own_read" ON public.users; -- nama lama (bug rekursi)
DROP POLICY IF EXISTS "admin_all" ON public.users;       -- nama lama (bug rekursi)
CREATE POLICY "users_select" ON public.users
  FOR SELECT USING (auth.uid() = id OR public.is_admin());

-- Warung: kelola profil miliknya; admin bisa semua
DROP POLICY IF EXISTS "warung_own_all" ON public.warung_profiles;
CREATE POLICY "warung_own_all" ON public.warung_profiles
  USING (auth.uid() = user_id OR public.is_admin());

-- Semua user terautentikasi boleh MEMBACA nama/alamat warung (tidak sensitif)
DROP POLICY IF EXISTS "warung_select_all" ON public.warung_profiles;
CREATE POLICY "warung_select_all" ON public.warung_profiles
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Warung: membuat profil untuk dirinya sendiri (registrasi)
DROP POLICY IF EXISTS "warung_insert_own" ON public.warung_profiles;
CREATE POLICY "warung_insert_own" ON public.warung_profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Collector: kelola profil miliknya; admin bisa semua
DROP POLICY IF EXISTS "collector_own_all" ON public.collector_profiles;
CREATE POLICY "collector_own_all" ON public.collector_profiles
  USING (auth.uid() = user_id OR public.is_admin());

-- Semua user terautentikasi boleh MEMBACA profil collector (tidak sensitif)
DROP POLICY IF EXISTS "collector_select_all" ON public.collector_profiles;
CREATE POLICY "collector_select_all" ON public.collector_profiles
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Collector: membuat profil untuk dirinya sendiri (registrasi)
DROP POLICY IF EXISTS "collector_insert_own" ON public.collector_profiles;
CREATE POLICY "collector_insert_own" ON public.collector_profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Pickup: warung pemilik bisa baca; collector yang ditugaskan bisa baca;
-- pickup pending bisa dibaca collector lain; admin bisa semua.
DROP POLICY IF EXISTS "pickup_read" ON public.pickup_requests;
CREATE POLICY "pickup_read" ON public.pickup_requests
  FOR SELECT USING (
    (SELECT EXISTS (SELECT 1 FROM public.warung_profiles w
                    WHERE w.id = pickup_requests.warung_id AND w.user_id = auth.uid())) OR
    (SELECT EXISTS (SELECT 1 FROM public.collector_profiles c
                    WHERE c.id = pickup_requests.collector_id AND c.user_id = auth.uid())) OR
    pickup_requests.status = 'pending' OR
    public.is_admin()
  );

-- Admin bisa mengubah semua data users & pickup (server tetap memvalidasi)
DROP POLICY IF EXISTS "admin_all_users" ON public.users;
CREATE POLICY "admin_all_users" ON public.users
  FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "admin_all_pickups" ON public.pickup_requests;
CREATE POLICY "admin_all_pickups" ON public.pickup_requests
  FOR ALL USING (public.is_admin());

-- ------------------------------------------------------------
-- Kebijakan WRITE untuk alur bisnis (di samping lapisan auth server):
--   - Warung  : INSERT pickup miliknya; UPDATE pickup miliknya.
--   - Collector: UPDATE pickup yang ditugaskan padanya (in_progress/
--                completed/failed); INSERT routes & route_stops.
--   - Semua authed: INSERT audit_logs (logging sisi server).
-- ------------------------------------------------------------

-- pickup_requests: warung pemilik boleh INSERT
DROP POLICY IF EXISTS "pickup_insert_warung" ON public.pickup_requests;
CREATE POLICY "pickup_insert_warung" ON public.pickup_requests
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.warung_profiles w
            WHERE w.id = pickup_requests.warung_id AND w.user_id = auth.uid()) OR
    public.is_admin()
  );

-- pickup_requests: warung pemilik ATAU collector yang ditugaskan boleh UPDATE.
-- Aturan klaim: collector boleh UPDATE pickup yang masih "pending"
-- (untuk mengklaim, karena collector_id belum terisi pada saat itu).
DROP POLICY IF EXISTS "pickup_update_owner" ON public.pickup_requests;
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

-- routes: collector pemilik boleh INSERT/UPDATE
DROP POLICY IF EXISTS "route_collector_writer" ON public.routes;
CREATE POLICY "route_collector_writer" ON public.routes
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.collector_profiles c
            WHERE c.id = routes.collector_id AND c.user_id = auth.uid()) OR
    public.is_admin()
  );

-- route_stops: siapa pun authed boleh INSERT (dibuat dalam 1 proses klaim)
DROP POLICY IF EXISTS "route_stops_insert" ON public.route_stops;
CREATE POLICY "route_stops_insert" ON public.route_stops
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- route_stops: UPDATE oleh collector pemilik rute (tandai selesai/gagal)
DROP POLICY IF EXISTS "route_stops_update" ON public.route_stops;
CREATE POLICY "route_stops_update" ON public.route_stops
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.routes r
            JOIN public.collector_profiles c ON c.id = r.collector_id
            WHERE r.id = route_stops.route_id AND c.user_id = auth.uid()) OR
    public.is_admin()
  );

-- audit_logs: semua authed boleh INSERT (logging server)
DROP POLICY IF EXISTS "audit_logs_insert" ON public.audit_logs;
CREATE POLICY "audit_logs_insert" ON public.audit_logs
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- ============================================================
-- Trigger: sinkronisasi auth.users -> public.users
-- Role diambil dari raw_user_meta_data saat registrasi (signUp).
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, name, email, password_hash, role, phone_number)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'password_hash', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'warung'),
    NEW.raw_user_meta_data->>'phone_number'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Trigger dihapus dulu bila sudah ada agar idempoten
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- (Opsional) Sinkronisasi update profil user ke public.users
CREATE OR REPLACE FUNCTION public.sync_user_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.users
  SET name = COALESCE(NEW.raw_user_meta_data->>'name', public.users.name),
      phone_number = COALESCE(NEW.raw_user_meta_data->>'phone_number', public.users.phone_number)
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
CREATE TRIGGER on_auth_user_updated
  AFTER UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.sync_user_profile();
