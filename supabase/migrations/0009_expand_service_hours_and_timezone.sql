-- WarungSirkular - 0009
-- Perluasan Jam Layanan Collector & Standarisasi Zona Waktu WIB (UTC+7, Asia/Jakarta)
--
-- File ini memperluas rentang waktu default penjemputan hingga pukul 23:00 WIB
-- agar user warung dapat memesan slot malam (17:00–19:00, 19:00–21:00, 21:00–23:00 WIB).

-- 1) Ubah default kolom service_end menjadi 23:00
alter table public.collector_profiles
  alter column service_end set default '23:00';

-- 2) Update profil collector yang masih menggunakan batas lama 17:00 menjadi 23:00
update public.collector_profiles
set service_end = '23:00'
where service_end = '17:00' or service_end is null;

-- 3) Verifikasi data jadwal collector
select id, user_id, vehicle_type, service_start, service_end, max_pickups_per_slot
from public.collector_profiles;
