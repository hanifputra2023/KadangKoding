-- 0010_user_update_profile_rls.sql
-- Mengizinkan user terautentikasi untuk memperbarui nama dan profil mereka sendiri di public.users

DROP POLICY IF EXISTS "users_update_own" ON public.users;
CREATE POLICY "users_update_own" ON public.users
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);
