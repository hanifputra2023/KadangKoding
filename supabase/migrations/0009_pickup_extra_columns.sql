-- WarungSirkular - 0009
-- Tambahkan kolom-kolom yang dibutuhkan kode di pickup_requests:
--   started_at      : timestamp ketika pickup dimulai oleh collector
--   fail_reason     : alasan gagal penjemputan
--   failed_at       : timestamp ketika pickup gagal
--   collector_notes : catatan dari collector setelah penjemputan selesai
-- Jalankan di SQL Editor Supabase: https://uzokxpyxlgfubgxbmqqx.supabase.co

ALTER TABLE public.pickup_requests
  ADD COLUMN IF NOT EXISTS started_at      TIMESTAMP,
  ADD COLUMN IF NOT EXISTS fail_reason     TEXT,
  ADD COLUMN IF NOT EXISTS failed_at       TIMESTAMP,
  ADD COLUMN IF NOT EXISTS collector_notes TEXT;

-- Verifikasi
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'pickup_requests'
  AND column_name IN ('collector_id', 'started_at', 'fail_reason', 'failed_at', 'collector_notes', 'assigned_at')
ORDER BY column_name;
