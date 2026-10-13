-- WarungSirkular - 0005 (admin features)
-- 1) Soft-delete akun: kolom is_deleted pada users (NFR 6.3).
-- 2) RLS: admin boleh tulis waste_categories (CRUD kategori dari panel admin).
-- 3) RLS: admin boleh MEMBACA audit_logs (PRD 4.7 — sebelumnya tanpa policy SELECT).
-- Jalankan di SQL Editor project: https://uzokxpyxlgfubgxbmqqx.supabase.co

-- 1) Soft delete
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS idx_users_is_deleted ON public.users(is_deleted);

-- 2) Admin CRUD waste_categories (sebelumnya hanya read utk semua authed user)
DROP POLICY IF EXISTS "waste_categories_admin_all" ON public.waste_categories;
CREATE POLICY "waste_categories_admin_all" ON public.waste_categories
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 3) Admin SELECT audit_logs (viewer audit log di panel admin)
DROP POLICY IF EXISTS "audit_logs_admin_select" ON public.audit_logs;
CREATE POLICY "audit_logs_admin_select" ON public.audit_logs
  FOR SELECT USING (public.is_admin());

-- Verifikasi
SELECT column_name FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'is_deleted';
SELECT policyname, cmd, schemaname, tablename FROM pg_policies
WHERE schemaname = 'public' AND tablename IN ('waste_categories', 'audit_logs')
ORDER BY tablename, cmd;