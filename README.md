# WarungSirkular

> **Platform B2B Micro-Logistics untuk Pengelolaan Sampah Organik**
>
> Menghubungkan warung makan, kurir pengumpul, dan pembudidaya maggot BSF dalam satu ekosistem daur ulang yang terintegrasi.

🌐 **Live Website:** [https://kadang-koding.vercel.app](https://kadang-koding.vercel.app)

---

## Daftar Isi

- [Tentang Proyek](#tentang-proyek)
- [Fitur Utama](#fitur-utama)
- [Tech Stack](#tech-stack)
- [Struktur Proyek](#struktur-proyek)
- [Prasyarat](#prasyarat)
- [Cara Menjalankan](#cara-menjalankan)
- [Konfigurasi Database (Supabase)](#konfigurasi-database-supabase)
- [Alur Kerja Aplikasi](#alur-kerja-aplikasi)
- [Role & Akses](#role--akses)
- [Build Android (APK)](#build-android-apk)
- [Deploy ke Vercel](#deploy-ke-vercel)
- [Kontribusi](#kontribusi)

---

## Tentang Proyek

**WarungSirkular** adalah platform manajemen penjemputan sampah organik berbasis web (dan Android) yang menghubungkan tiga pihak utama:

| Peran | Deskripsi |
|---|---|
| **Warung (Mitra)** | Pemilik warung makan yang ingin menyetorkan sisa bahan organik |
| **Collector (Kurir)** | Kurir yang menjemput sampah organik ke warung-warung |
| **Admin** | Pengelola platform yang memantau operasional & analitik dampak lingkungan |

Sistem ini mendukung:
- Penjadwalan penjemputan sampah dengan peta interaktif
- Pelacakan status penjemputan secara real-time (Supabase Realtime)
- Routing rekomendasi untuk kurir berbasis algoritma Nearest-Neighbor
- Laporan dampak lingkungan (offset karbon, berat terkumpul, dll.)
- Sesi login persisten 30 hari (rolling session)

---

## Fitur Utama

### Warung Dashboard
- Buat & jadwalkan permintaan penjemputan sampah (4-step wizard)
- Pilih kategori sampah, estimasi berat, waktu jendela penjemputan
- Upload foto pratinjau sampah
- Lacak status penjemputan secara live (Pending → Assigned → In Progress → Completed)
- Riwayat seluruh pickup dengan filter & pencarian
- Laporan dampak lingkungan personal

### Collector Dashboard
- Lihat semua pickup request yang tersedia dari warung-warung
- Klaim & buat rute penjemputan otomatis (heuristik Nearest-Neighbor)
- Lacak lokasi warung di peta interaktif (Leaflet)
- Selesaikan penjemputan dengan input berat aktual & foto bukti
- Manajemen kapasitas kendaraan & area layanan

### Admin Panel
- Monitoring seluruh aktivitas pickup (filter status, kategori, tanggal)
- Manajemen pengguna (warung & kurir)
- Impact analytics: total berat, offset karbon CO2e, pengalihan TPA
- Audit log lengkap semua aksi pengguna

---

## Tech Stack

| Layer | Teknologi |
|---|---|
| **Frontend** | Next.js 16 (App Router), React 19, Tailwind CSS v4 |
| **Mobile** | Capacitor.js (Android WebView wrapper) |
| **Database** | Supabase (PostgreSQL), Row Level Security (RLS) |
| **Auth** | Supabase Auth (JWT cookie, 30-day rolling session via `@supabase/ssr`) |
| **Storage** | Supabase Storage (foto pickup & bukti penimbangan) |
| **Realtime** | Supabase Realtime (WebSocket auto-update status pickup) |
| **Peta** | Leaflet + React-Leaflet + OpenStreetMap |
| **UI** | Sonner (toast), custom design system (Emerald theme) |
| **Deployment** | Vercel (web), Gradle (APK Android) |

---

## Struktur Proyek

```
warungsirkular-app/
├── app/
│   ├── layout.tsx           # Root layout + font Inter + Toaster
│   ├── page.tsx             # Root redirect ke /login
│   ├── login/               # Halaman login & register (satu halaman)
│   ├── warung/              # Dashboard Warung (Owner)
│   ├── collector/           # Dashboard Kurir/Collector
│   ├── admin/               # Panel Admin
│   └── register/            # Redirect ke /login?tab=register
├── components/
│   ├── AppShell.tsx         # Layout sidebar + topbar untuk semua dashboard
│   ├── ProfileView.tsx      # Modal profil user (edit nama, nomor HP, password)
│   ├── ClientMap.tsx        # Wrapper Leaflet (hanya client-side)
│   ├── Charts.tsx           # LineChart & DonutChart untuk analytics
│   └── Icons.tsx            # Custom SVG icon components
├── lib/
│   ├── api/
│   │   ├── auth.ts          # apiLogin, apiLogout, apiGetMe, apiRegister, apiUpdateProfile
│   │   ├── warung.ts        # apiGetWarungPickups, apiCreatePickup, dll.
│   │   ├── collector.ts     # apiGetAvailablePickups, apiClaimRoute, dll.
│   │   ├── admin.ts         # apiGetStats, apiGetAllPickups, dll.
│   │   └── upload.ts        # apiUpload (foto ke Supabase Storage)
│   ├── supabase/
│   │   ├── client.ts        # createBrowserClient (30-day cookie)
│   │   ├── server.ts        # createServerClient (Route Handlers / SSR)
│   │   └── service.ts       # createServiceClient (bypass RLS, cron)
│   ├── hooks/
│   │   └── useRealtimeTables.ts  # Hook Supabase Realtime subscribe
│   ├── guidelines.ts        # Panduan daur ulang per kategori sampah
│   └── helpers.ts           # Utility functions
├── supabase/
│   ├── migrations/          # SQL schema lengkap (0001_init.sql)
│   └── setup_realtime_sql_editor.sql  # Enable Realtime di Supabase
├── public/
│   └── logo.png             # Logo WarungSirkular
├── android/                 # Project Android (Capacitor)
├── capacitor.config.ts      # Konfigurasi Capacitor (appId, webDir)
├── next.config.ts           # Konfigurasi Next.js (static export untuk APK)
├── vercel.json              # Konfigurasi deployment Vercel
└── package.json
```

---

## Prasyarat

Sebelum memulai, pastikan sudah menginstall:

- **Node.js** v18 atau lebih baru — [nodejs.org](https://nodejs.org)
- **npm** v9+ (ikut sertaan Node.js)
- **Akun Supabase** (gratis) — [supabase.com](https://supabase.com)

Opsional (untuk build Android):
- **Android Studio** (termasuk JDK 17+, Android SDK) — [developer.android.com/studio](https://developer.android.com/studio)

---

## Cara Menjalankan

### 1. Clone Repositori

```bash
git clone https://github.com/hanifputra2023/KadangKoding.git
cd KadangKoding
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Konfigurasi Environment

Buat file `.env.local` di root project (atau salin dari `.env.local.example`):

```env
# Supabase Project URL & Anon Key (dari Settings → API di Supabase Dashboard)
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxxxx...

# Supabase Service Role Key (untuk cron & operasi bypass RLS - JANGAN expose ke client!)
SUPABASE_SERVICE_ROLE_KEY=eyJxxxxx...

# Secret untuk mengamankan endpoint cron (isi bebas, string acak)
CRON_SECRET=rahasia_super_aman_isi_bebas_123
```

> **Cara mendapatkan key Supabase:**
> 1. Buka [app.supabase.com](https://app.supabase.com) → pilih project Anda
> 2. Pergi ke **Settings → API**
> 3. Salin **Project URL**, **anon (public) key**, dan **service_role key**

### 4. Setup Database

Jalankan SQL migration di Supabase SQL Editor:

1. Buka **Supabase Dashboard → SQL Editor**
2. Buka file `supabase/migrations/0001_init.sql` dari repositori ini
3. Copy seluruh isi file, paste di SQL Editor, lalu klik **Run**

File ini akan membuat:
- 8 tabel: `users`, `warung_profiles`, `collector_profiles`, `waste_categories`, `pickup_requests`, `routes`, `route_stops`, `audit_logs`
- Row Level Security (RLS) policies untuk semua tabel
- Trigger otomatis: sync `auth.users → public.users` saat register
- Seed data: 5 kategori sampah default

Kemudian aktifkan Supabase Realtime:

1. Masih di SQL Editor, jalankan isi file `supabase/setup_realtime_sql_editor.sql`
2. Atau aktifkan manual di **Supabase → Table Editor → pickup_requests → Edit → Enable Realtime**

### 5. Buat Storage Bucket

1. Di Supabase Dashboard, buka **Storage**
2. Klik **New Bucket**, beri nama: `pickup-photos`
3. Centang **Public bucket** (agar foto bisa diakses langsung via URL)
4. Klik **Create bucket**

### 6. Jalankan Dev Server

```bash
npm run dev
```

Buka browser di: **[http://localhost:3000](http://localhost:3000)**

Kamu akan diarahkan ke halaman **Login**. Gunakan tombol **"Daftar sekarang"** untuk membuat akun baru.

---

## Konfigurasi Database (Supabase)

### Schema Tabel Utama

```
users                   → Data profil pengguna (sinkron dari auth.users)
warung_profiles         → Profil & lokasi warung
collector_profiles      → Profil kendaraan & area kurir
waste_categories        → Kategori sampah (Organik, Sisa Makanan, dll.)
pickup_requests         → Request penjemputan (core data)
routes                  → Rute penjemputan yang diklaim kurir
route_stops             → Titik-titik warung dalam satu rute
audit_logs              → Log setiap aksi penting pengguna
```

### Status Pickup Request

```
pending → assigned → in_progress → completed
                 ↘ cancelled (oleh warung)
                 ↘ expired (oleh cron, jika >24 jam tanpa kurir)
                 ↘ failed (dilaporkan kurir)
```

---

## Alur Kerja Aplikasi

```
1. Warung mendaftar & login
        │
        ▼
2. Warung membuat Pickup Request
   (Pilih kategori → Pilih jadwal → Tentukan lokasi → Upload foto → Konfirmasi)
        │
        ▼
3. Status: PENDING
        │
        ▼ (Kurir melihat pickup tersedia)
4. Collector klaim pickup & buat rute (Nearest-Neighbor routing)
        │
        ▼
5. Status: ASSIGNED
        │
        ▼ (Kurir berangkat)
6. Status: IN_PROGRESS
        │
        ▼ (Kurir tiba, timbang sampah, upload bukti)
7. Collector selesaikan penjemputan (input berat aktual + foto)
        │
        ▼
8. Status: COMPLETED
        │
        ▼
9. Warung mendapat notifikasi & poin daur ulang
   Admin melihat analytics dampak lingkungan
```

---

## Role & Akses

### Warung (Mitra)
- URL setelah login: `/warung`
- Bisa: buat pickup, lihat riwayat, track status, lihat impact analytics
- Tidak bisa: akses data warung lain

### Collector (Kurir)
- URL setelah login: `/collector`
- Bisa: lihat semua pickup pending, klaim & buat rute, selesaikan/gagalkan pickup
- Tidak bisa: mengubah data pickup yang tidak ditugaskan padanya

### Admin
- URL setelah login: `/admin`
- Bisa: lihat semua data, monitoring, analytics platform, daftar pengguna, audit log
- Akun admin dibuat manual di Supabase Auth dengan `role: "admin"` di `user_metadata`

---

## Build Android (APK)

### Tahap 1: Build & Sync ke Android

Setiap kali ada perubahan fitur di kode web, jalankan:

```bash
npm run build:android
```

Perintah ini otomatis:
1. Build Next.js sebagai static export ke folder `out/`
2. Sinkronkan file web ke `android/app/src/main/assets/public/`

### Tahap 2: Generate APK via Android Studio

1. Buka Android Studio:
   ```bash
   npm run cap:open
   ```
2. Tunggu Gradle Sync selesai
3. Di menu bar Android Studio: **Build → Build Bundle(s) / APK(s) → Build APK(s)**
4. File APK ada di: `android/app/build/outputs/apk/debug/app-debug.apk`

### Tahap 2 (Alternatif): Generate APK via Terminal

Jika Java 17+ sudah terkonfigurasi di PATH:

```bash
cd android
./gradlew assembleDebug
# File: android/app/build/outputs/apk/debug/app-debug.apk
```

---

## Deploy ke Vercel

Proyek ini sudah dikonfigurasi untuk Vercel. Cukup:

1. Push ke GitHub
2. Connect repositori di [vercel.com](https://vercel.com)
3. Tambahkan **Environment Variables** yang sama seperti `.env.local` di dashboard Vercel
4. Deploy!

> **Catatan:** Untuk production, Supabase Auth memerlukan domain Vercel ditambahkan di **Supabase → Authentication → URL Configuration → Redirect URLs**.

---

## Scripts

| Perintah | Keterangan |
|---|---|
| `npm run dev` | Jalankan development server (localhost:3000) |
| `npm run build` | Build production untuk web/Vercel |
| `npm run start` | Jalankan production server lokal |
| `npm run lint` | Cek kode dengan ESLint |
| `npm run build:android` | Build static + sync ke Android (Capacitor) |
| `npm run cap:open` | Buka project Android di Android Studio |
| `npm run cap:sync` | Sinkronkan web assets ke Android tanpa rebuild |

---

## Kontribusi

Pull request sangat disambut! Untuk perubahan besar, mohon buka issue terlebih dahulu untuk mendiskusikan apa yang ingin diubah.

---

## Lisensi

MIT License — silakan gunakan bebas untuk keperluan edukasi & komersial.

---

<p align="center">
  Dibuat dengan semangat untuk lingkungan yang lebih bersih 🌱
  <br />
  <a href="https://kadang-koding.vercel.app">kadang-koding.vercel.app</a>
</p>
