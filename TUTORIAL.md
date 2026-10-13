# Tutorial Lengkap Menjalankan WarungSirkular

Panduan dari nol sampai aplikasi jalan di local machine.

---

## 1. Prasyarat (Wajib Diinstal Terlebih Dahulu)

### 1.1 Node.js (≥ v20.9.0)

Node.js adalah runtime JavaScript yang dibutuhkan Next.js.

**Cara cek apakah sudah terinstal:**
```bash
node -v
```
Kalau muncul `v20.x.x` atau lebih tinggi, sudah oke. Kalau "not recognized", belum terinstal.

**Cara install:**
- Download dari: https://nodejs.org/
- Pilih versi **LTS** (Long Term Support)
- Install seperti biasa, next-next-finish
- **npm** otomatis terinstal bareng (cek: `npm -v`)

> **Tip:** Pakai **nvm (Node Version Manager)** supaya gampang ganti versi Node:
> - Windows: https://github.com/coreybutler/nvm-windows
> - macOS/Linux: https://github.com/nvm-sh/nvm
>
> Setelah install nvm:
> ```bash
> nvm install 20
> nvm use 20
> ```

### 1.2 Git

Git diperlukan untuk clone dan version control.

**Cara cek:**
```bash
git --version
```

**Cara install:**
- Download dari: https://git-scm.com/
- Install seperti biasa

### 1.3 Code Editor (Opsional)

VS Code direkomendasikan: https://code.visualstudio.com/

---

## 2. Clone / Buka Project

```bash
# Kalau belum punya project:
git clone <url-repo>
cd warungsirkular-app

# Kalau sudah punya, langsung masuk folder:
cd C:\xampp\htdocs\Project Besar\warungsirkular-app
```

---

## 3. Install Semua Dependencies

```bash
npm install
```

Perintah ini akan download semua library yang dibutuhkan ke folder `node_modules/`.
Tunggu sampai selesai (biasanya 1-3 menit tergantung koneksi).

> **Kalau error?** Coba hapus dulu `node_modules` dan `package-lock.json`:
> ```bash
> rm -rf node_modules package-lock.json   # macOS/Linux
> rmdir /s /q node_modules                # Windows CMD
> Remove-Item -Recurse -Force node_modules # Windows PowerShell
> npm install
> ```

---

## 4. Setup Supabase (Database & Auth)

Project ini pakai **Supabase** sebagai database, auth, dan storage.

### 4.1 Buat Akun & Project Supabase

1. Buka https://supabase.com/ → **Sign Up** (bisa pakai GitHub)
2. Buat **New Project**
3. Catat 3 hal ini dari **Project Settings → API**:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **Anon / Publishable Key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **Service Role Key** → `SUPABASE_SERVICE_ROLE_KEY` (rahasia! jangan share)

### 4.2 Jalankan Database Migration

1. Buka **Supabase Dashboard** → pilih project → menu **SQL Editor**
2. Buka file `supabase/migrations/0001_init.sql` dari project ini
3. **Copy-paste seluruh isi** ke SQL Editor, klik **Run**
4. Ulangi untuk file berikutnya secara berurutan (0002 → 0008):
   - `0002_fix_rls.sql`
   - `0003_storage.sql`
   - `0004_fix_route_stops_select.sql`
   - `0005_admin_features.sql`
   - `0006_collector_schedule.sql`
   - `0007_pickup_notes.sql`
   - `0008_enable_realtime.sql`

> **Penting:** Jalankan sesuai urutan nomor! Jangan skip.

### 4.3 Buat Storage Bucket

1. Buka **Supabase Dashboard** → menu **Storage**
2. Klik **New Bucket**
3. Isi:
   - Nama: `pickup-photos`
   - Public: **✅ Centang** (biar foto bisa diakses)
4. Klik **Create Bucket**

### 4.4 Setup Realtime (Opsional)

Kalau mau fitur real-time (auto-refresh), ikuti panduan di `SUPABASE_REALTIME.md`.

---

## 5. Konfigurasi Environment Variables

Buat file `.env.local` di root project (`warungsirkular-app/.env.local`):

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<isi dari Supabase>
SUPABASE_SERVICE_ROLE_KEY=<isi dari Supabase>
CRON_SECRET=<rahasia bebas, misal: my-cron-secret-123>
ADMIN_BOOTSTRAP_SECRET=<rahasia bebas, misal: my-admin-secret-456>
```

> Ganti nilai `<...>` dengan data dari Supabase project kamu.
> `.env.local` sudah ada di `.gitignore` jadi tidak akan ter-commit.

---

## 6. Jalankan Aplikasi

```bash
npm run dev
```

Buka browser: **http://localhost:3000**

Otomatis diarahkan ke halaman login.

---

## 7. Script yang Tersedia

| Command | Fungsi |
|---|---|
| `npm run dev` | Jalankan development server (http://localhost:3000) |
| `npm run build` | Build untuk production |
| `npm run start` | Jalankan server production (setelah build) |
| `npm run lint` | Jalankan pengecekan kode (ESLint) |

---

## 8. Membuat Akun Admin

Admin **tidak bisa didaftar** dari halaman register (keamanan). Buat via endpoint khusus:

```bash
curl.exe -X POST http://localhost:3000/api/admin/bootstrapping ^
  -H "Authorization: Bearer <ADMIN_BOOTSTRAP_SECRET>" ^
  -H "Content-Type: application/json" ^
  -d "{\"email\":\"admin@warung.id\",\"password\":\"admin123\",\"name\":\"Admin\"}"
```

Ganti `<ADMIN_BOOTSTRAP_SECRET>` dengan nilai di `.env.local`.
Hanya bisa sekali (anti duplikat).

---

## 9. Testing Manual: Auto-Expire Cron

```bash
curl.exe -H "Authorization: Bearer <CRON_SECRET>" http://localhost:3000/api/cron/auto-expire
```

---

## 10. Troubleshooting

| Masalah | Solusi |
|---|---|
| `node: command not found` | Install Node.js dari https://nodejs.org/ |
| `npm install` error | Hapus `node_modules` & `package-lock.json`, ulang `npm install` |
| Blank page / error di browser | Cek terminal `npm run dev` untuk error message |
| Register gagal | Pastikan migration database sudah dijalankan semua (0001-0008) |
| Upload foto gagal | Pastikan bucket `pickup-photos` sudah dibuat di Supabase Storage |
| GPS / "Gunakan Lokasi Saya" tidak muncul | Akses via `localhost` atau HTTPS (bukan IP LAN) |
| Port 3000 sudah dipakai | Jalankan `npm run dev -- -p 3001` untuk pakai port lain |
| Error "RLS infinite recursion" | Jalankan ulang migration `0002_fix_rls.sql` |

---

## Ringkasan Cepat (TL;DR)

```bash
# 1. Install Node.js (≥ v20) dari https://nodejs.org/
# 2. Buka terminal, masuk ke folder project
cd warungsirkular-app

# 3. Install dependencies
npm install

# 4. Setup Supabase (bikin project + jalankan migration SQL + buat bucket)
# 5. Buat .env.local (lihat langkah 5)
# 6. Jalankan
npm run dev

# 7. Buka http://localhost:3000
```
