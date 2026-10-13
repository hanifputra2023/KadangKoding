-- WarungSirkular - 0006
-- Tambahkan jadwal layanan & kuota per slot untuk collector.
-- Digunakan untuk menghitung ketersediaan "Jendela Waktu" di sisi warung
-- secara dinamis berdasarkan kondisi collector.
-- Jalankan di SQL Editor project: https://uzokxpyxlgfubgxbmqqx.supabase.co

-- 1) Kolom jadwal layanan (format jam "HH:MM", 24 jam)
alter table public.collector_profiles
  add column if not exists service_start    text not null default '07:00',
  add column if not exists service_end      text not null default '17:00';

-- 2) Kuota pickup maksimal per slot waktu (per collector)
alter table public.collector_profiles
  add column if not exists max_pickups_per_slot int not null default 5;

-- Verifikasi kolom baru
select user_id, vehicle_type, service_start, service_end, max_pickups_per_slot
from public.collector_profiles;
