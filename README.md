# WarungSirkular

Platform B2B Micro-Logistics untuk mengoordinasikan penjemputan sampah organik dari warung makan kepada pembudidaya maggot / pengelola sampah organik.

> Sesuai **PRD v1.0** (`PRD_v1_0_WarungSirkular.md`) — single source of truth untuk requirement.

## Stack

- **Frontend:** Next.js 16 (App Router, Tailwind CSS, Leaflet)
- **Backend:** Next.js API Routes (Route Handlers) — Node.js runtime
- **Database:** Supabase (PostgreSQL) + RLS
- **Auth:** Supabase Auth (email/password, JWT via cookie + `@supabase/ssr`)
- **Storage:** Supabase Storage (foto pratinjau & bukti penimbangan)
- **Background Worker:** Route handler cron `/api/cron/auto-expire`

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Salin konfigurasi environment (sudah ada `.env.local`):

   ```env
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   SUPABASE_SERVICE_ROLE_KEY=...  # Service Role (Settings → API) untuk cron auto-expire
   CRON_SECRET=...                # untuk mengamankan endpoint cron
   ```

3. **Buat schema database.** Jalankan isi `supabase/migrations/0001_init.sql` di **Supabase SQL Editor**. File ini berisi:
   - 8 tabel (`users`, `warung_profiles`, `collector_profiles`, `waste_categories`, `pickup_requests`, `routes`, `route_stops`, `audit_logs`) sesuai PRD §9.
   - Index, seed kategori sampah, **RLS policies** (anti-rekursi via fungsi `is_admin()` SECURITY DEFINER), dan **trigger sinkronisasi** `auth.users → public.users`.
   - > **Penting:** register memakai Supabase Auth. Trigger `handle_new_user()` menyalin user baru ke `public.users` dengan `role` dari `user_metadata`. Pastikan trigger aktif.
   - > **Jika sudah pernah menerapkan versi lama** (yang memicu error RLS *"infinite recursion"*), cukup jalankan ulang file terbaru ini — file bersifat idempotent (memakai `CREATE ... IF NOT EXISTS` dan `DROP POLICY IF EXISTS`), sehingga akan memperbaiki kebijakan yang salah.

4. **Buat Storage bucket** `pickup-photos` di Supabase Storage (untuk `/api/upload`).

5. Jalankan dev server:

   ```bash
   npm run dev
   ```

6. Buka `http://localhost:3000/login`.

## Alur MVP (end-to-end)

```text
Warung buat pickup request (kategori, est. berat, time window, foto) → pending
Collector lihat pickup tersedia → pilih → "Klaim & Buat Recommended Route"
Sistem cek kapasitas + Nearest-Neighbor → routes + route_stops → assigned
Collector selesaikan (berat aktual + foto bukti) → completed
Tanpa collector > 24 jam → expired (cron)
Admin lihat impact analytics & audit log
```

## API Contract

### Auth
| Method | Endpoint | Deskripsi |
|---|---|---|
| POST | `/api/auth/register` | Registrasi multi-role (`warung`/`collector`/`admin`) + profil |
| POST | `/api/auth/login` | Login email/password |
| POST | `/api/auth/logout` | Logout |
| GET | `/api/auth/me` | Profil user saat ini (`401` bila belum login) |

Contoh register warung:
```jsonc
{
  "email": "warung@mail.com", "password": "rahasia123", "name": "Bu Ani",
  "role": "warung",
  "warung": { "business_name": "Warung Bu Ani", "address": "Jl. A No.1",
              "latitude": -7.4726, "longitude": 110.2198 }
}
```

### Warung
| Method | Endpoint | Deskripsi |
|---|---|---|
| POST | `/api/warung/pickups` | Buat pickup request (status awal `pending`) |
| GET | `/api/warung/pickups` | Daftar pickup milik warung (filter `?status=`) |
| PATCH | `/api/warung/pickups/[id]` | Edit (hanya saat status `pending`) |
| DELETE | `/api/warung/pickups/[id]` | Batalkan (hanya saat status `pending` → `cancelled`) |

### Collector
| Method | Endpoint | Deskripsi |
|---|---|---|
| GET | `/api/collector/pickups` | Browse pickup `pending` tersedia |
| PUT/GET | `/api/collector/capacity` | Atur kapasitas kendaraan & area layanan |
| POST | `/api/collector/route/recommend` | Klaim pickup + buat **Recommended Route** (validasi kapasitas, Nearest-Neighbor) |
| GET | `/api/collector/routes` | Daftar rute collector beserta stop |
| POST | `/api/collector/pickups/[id]/complete` | Selesai (wajib `actual_weight_kg` & `proof_photo_url`) |
| POST | `/api/collector/pickups/[id]/fail` | Gagal lapangan (wajib `failure_reason`) |

Contoh rekomendasi rute:
```jsonc
POST /api/collector/route/recommend
{ "pickup_ids": ["<uuid>", "<uuid>"] }
```
Response berisi `recommended.stops` (berurutan), `totalDistanceKm`, `totalWeightKg`, dan catatan bahwa ini **Recommended Route (heuristik)** — bukan rute optimal mutlak (PRD §8.3).

### Admin (+ Audit)
| Method | Endpoint | Deskripsi |
|---|---|---|
| GET | `/api/admin/stats` | Impact analytics (berat terkumpul, pickup selesai, warung aktif, est. offset karbon) |
| GET | `/api/admin/pickups` | Monitoring pickup (filter `?status=&category=&from=&to=`) |
| GET | `/api/admin/users` | Daftar user (tanpa password) |
| GET | `/api/admin/audit-logs` | Audit log (filter `?action=&user_id=&from=&to=`) |

### Utilities & Cron
| Method | Endpoint | Deskripsi |
|---|---|---|
| GET | `/api/categories` | Daftar kategori sampah |
| POST | `/api/upload` | Upload foto (multipart `file`, JPG/PNG/WebP ≤ 5MB) → Supabase Storage |
| GET | `/api/cron/auto-expire` | Worker auto-expire (`pending` > 24 jam / lewat time window → `expired`) |

**Cron:** schedukan `GET /api/cron/auto-expire` dengan header `Authorization: Bearer <CRON_SECRET>` (mis. Vercel Cron / GitHub Action / Upstash). Endpoint memakai Service Role Key (`SUPABASE_SERVICE_ROLE_KEY`) agar bisa memperbarui baris tanpa sesi user (bypass RLS). Contoh `vercel.json`:

```json
{
  "crons": [
    { "path": "/api/cron/auto-expire", "schedule": "*/30 * * * *" }
  ]
}
```

## Keamanan (PRD §6.2 & §10)

- Semua input divalidasi server-side; tidak mempercayai frontend.
- Password di-hash oleh Supabase Auth; tidak disimpan plaintext.
- Secret hanya via environment variable; `.env*` digitignore.
- Authorization per-route (role) + **ownership check** (warung hanya miliknya; collector hanya yang ditugaskan).
- Antisipasi race condition klaim pickup via `UPDATE ... WHERE status='pending'` (atomic guard).
- Upload memvalidasi mime-type & ukuran (JPG/PNG/WebP, ≤ 5MB).
- RLS diaktifkan sebagai lapisan pertahanan tambahan.
- Error production tidak mengekspos stack trace.

## Catatan Implementasi (Asumsi MVP)

- Jarak routing memakai **Haversine** (jarak lurus), sesuai opsi MVP PRD §12 (belum integrasi Google Directions/OSRM).
- Faktor emisi karbon (`0.3 kg CO2e/kg`) bersifat **hipotetis** (PRD §12 — perlu validasi lapangan).
- Foto memakai URL string di UI MVP; upload CLI `/api/upload` tersedia untuk menghasilkan URL ke Supabase Storage.

## Scripts

```bash
npm run dev      # dev server
npm run build    # production build
npm run start    # start production
npm run lint     # eslint
```
