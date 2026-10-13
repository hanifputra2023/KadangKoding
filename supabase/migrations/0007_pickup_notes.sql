-- WarungSirkular - 0007
-- Tambahkan kolom notes pada tabel pickup_requests
-- untuk menyimpan catatan instruksi penjemputan dari warung untuk kurir.
-- Jalankan di SQL Editor project: https://uzokxpyxlgfubgxbmqqx.supabase.co

ALTER TABLE public.pickup_requests
  ADD COLUMN IF NOT EXISTS notes TEXT;

-- Verifikasi kolom baru
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'pickup_requests' AND column_name = 'notes';
