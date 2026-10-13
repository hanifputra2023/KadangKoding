-- WarungSirkular - 0003
-- Buat bucket storage "pickup-photos" (public) + policy RLS storage.objects
-- Jalankan di SQL Editor project dengan URL: https://uzokxpyxlgfubgxbmqqx.supabase.co

-- 1) Buat bucket pickup-photos (public)
insert into storage.buckets (id, name, public)
values ('pickup-photos', 'pickup-photos', true)
on conflict (id) do update set public = true;

-- 2) Izinkan user terautentikasi meng-upload file ke bucket
drop policy if exists "pickup_photos_insert_auth" on storage.objects;
create policy "pickup_photos_insert_auth"
  on storage.objects for insert
  with check (bucket_id = 'pickup-photos' and auth.role() = 'authenticated');

-- 3) Izinkan pembacaan publik file di bucket (foto tampil di aplikasi)
drop policy if exists "pickup_photos_select_public" on storage.objects;
create policy "pickup_photos_select_public"
  on storage.objects for select
  using (bucket_id = 'pickup-photos');

-- 4) Isi seed kategori sampah jika masih kosong
insert into public.waste_categories (category_name, description, is_maggot_friendly)
select v.category_name, v.description, v.is_maggot_friendly
from (values
  ('Sisa Nasi/Lauk', 'Sisa nasi, sayur, dan lauk olahan siap konsumsi maggot', true),
  ('Sayur/Buah', 'Sisa sayur dan buah segar atau sisa olahan', true),
  ('Campuran', 'Campuran bahan organik yang masih layak olah', true)
) as v(category_name, description, is_maggot_friendly)
where not exists (select 1 from public.waste_categories);

-- 5) Verifikasi: hasilnya harus menampilkan row bucket pickup-photos + 3 kategori
select id, name, public from storage.buckets;
select category_name from public.waste_categories;
