<div align="center">

# 🌿 WarungSirkular

### Platform Ekosistem Sirkular Sampah Organik

**Menghubungkan warung makan, kurir pengumpul, dan pembudidaya maggot BSF**
**dalam satu platform terintegrasi yang transparan & berdampak nyata.**

[![Live Demo](https://img.shields.io/badge/🌐_Live_Demo-kadang--koding.vercel.app-10b981?style=for-the-badge)](https://kadang-koding.vercel.app)
[![Next.js](https://img.shields.io/badge/Next.js-16-black?style=for-the-badge&logo=next.js)](https://nextjs.org)
[![Supabase](https://img.shields.io/badge/Supabase-Database-3ecf8e?style=for-the-badge&logo=supabase)](https://supabase.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?style=for-the-badge&logo=typescript)](https://typescriptlang.org)
[![Capacitor](https://img.shields.io/badge/Android_APK-Capacitor-119EFF?style=for-the-badge&logo=capacitor)](https://capacitorjs.com)

</div>

---

## 💡 Latar Belakang Masalah

Setiap hari, jutaan kilogram **sampah organik dari warung makan** berakhir di TPA dan menghasilkan gas metana — salah satu gas rumah kaca paling berbahaya. Di sisi lain, pembudidaya **maggot BSF (Black Soldier Fly)** membutuhkan bahan organik ini sebagai pakan larva yang bernilai tinggi sebagai sumber protein.

**Masalahnya?** Tidak ada infrastruktur yang menghubungkan keduanya secara efisien.

> **WarungSirkular** hadir sebagai jembatan digital: mengubah sampah organik warung menjadi aset dalam rantai ekonomi sirkular.

---

## ✨ Solusi yang Kami Bangun

```
Warung Makan  ──►  WarungSirkular  ──►  Kurir Mitra  ──►  Pembudidaya Maggot BSF
 (Penghasil)         (Platform)          (Logistik)           (Pengolah)
```

Platform ini menangani **tiga sisi ekosistem** sekaligus:

| 🏪 Warung | 🛵 Collector | 🛡️ Admin |
|:---:|:---:|:---:|
| Buat jadwal penjemputan | Lihat & klaim pickup tersedia | Monitor seluruh operasional |
| Lacak status real-time | Optimasi rute otomatis | Analytics dampak lingkungan |
| Riwayat & impact report | Konfirmasi dengan berat aktual | Audit log lengkap |

---

## 🚀 Demo Langsung

🌐 **[https://kadang-koding.vercel.app](https://kadang-koding.vercel.app)**

Gunakan akun berikut untuk menjelajahi tiap role:

| Role | Email | Password |
|------|-------|----------|
| Warung | `demo.warung@warungsirkular.id` | `demo1234` |
| Collector | `demo.kurir@warungsirkular.id` | `demo1234` |
| Admin | `demo.admin@warungsirkular.id` | `demo1234` |

> Atau daftar akun baru langsung di halaman login!

---

## 🏗️ Arsitektur Sistem

```
┌─────────────────────────────────────────────────────────┐
│                      CLIENT LAYER                        │
│   Next.js 16 (App Router)  +  Capacitor (Android APK)   │
└──────────────────────┬──────────────────────────────────┘
                       │ HTTPS / WebSocket
┌──────────────────────▼──────────────────────────────────┐
│                    SUPABASE LAYER                         │
│  ┌──────────────┐  ┌─────────────┐  ┌────────────────┐  │
│  │  PostgreSQL  │  │  Auth (JWT) │  │    Realtime    │  │
│  │  + RLS       │  │  30-day     │  │  (WebSocket)   │  │
│  │              │  │  rolling    │  │  auto-update   │  │
│  └──────────────┘  └─────────────┘  └────────────────┘  │
│  ┌──────────────┐                                        │
│  │   Storage    │  ← Foto sampah & bukti penimbangan     │
│  └──────────────┘                                        │
└─────────────────────────────────────────────────────────┘
```

---

## 🛠️ Tech Stack

| Kategori | Teknologi |
|----------|-----------|
| **Framework** | Next.js 16 (App Router), React 19 |
| **Styling** | Tailwind CSS v4, Custom Emerald Design System |
| **Database** | Supabase (PostgreSQL + Row Level Security) |
| **Auth** | Supabase Auth — JWT Cookie, 30-day rolling session |
| **Realtime** | Supabase Realtime (WebSocket live update) |
| **Mobile** | Capacitor.js — Android WebView wrapper |
| **Peta** | Leaflet + React-Leaflet + OpenStreetMap |
| **Bahasa** | TypeScript 5 (strict mode) |
| **Deployment** | Vercel (web) + Gradle (APK) |

---

## 📁 Struktur Proyek

```
warungsirkular-app/
│
├── 📂 app/
│   ├── login/          → Halaman Login & Register (unified UI)
│   ├── warung/         → Dashboard Mitra Warung
│   ├── collector/      → Dashboard Kurir / Collector
│   └── admin/          → Panel Admin & Analytics
│
├── 📂 components/
│   ├── AppShell.tsx    → Layout sidebar + topbar (semua dashboard)
│   ├── ProfileView.tsx → Modal profil & edit akun
│   ├── ClientMap.tsx   → Leaflet map (SSR-safe)
│   └── Charts.tsx      → LineChart & DonutChart analytics
│
├── 📂 lib/
│   ├── api/            → Fungsi API: auth, warung, collector, admin
│   ├── supabase/       → Browser client, server client, service client
│   └── hooks/          → useRealtimeTables (live subscription)
│
├── 📂 supabase/
│   ├── migrations/     → SQL schema lengkap (0001_init.sql)
│   └── setup_realtime_sql_editor.sql
│
├── 📂 android/         → Project Android (Capacitor)
├── capacitor.config.ts → Config Capacitor (appId, webDir)
├── next.config.ts      → Next.js config (static export untuk APK)
└── vercel.json         → Config deployment Vercel
```

---

## ⚙️ Cara Menjalankan Secara Lokal

### Prasyarat

- **Node.js** v18+ → [nodejs.org](https://nodejs.org)
- **Akun Supabase** (gratis) → [supabase.com](https://supabase.com)

---

### Langkah 1 — Clone & Install

```bash
git clone https://github.com/hanifputra2023/KadangKoding.git
cd KadangKoding
npm install
```

### Langkah 2 — Konfigurasi Environment

Buat file `.env.local` di root project:

```env
# Dari Supabase Dashboard → Settings → API
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Service Role (jangan expose ke client!)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Secret bebas untuk endpoint cron
CRON_SECRET=isi_bebas_string_acak_anda
```

### Langkah 3 — Setup Database Supabase

1. Buka **Supabase Dashboard → SQL Editor**
2. Copy isi file `supabase/migrations/0001_init.sql`
3. Paste & klik **Run**

File ini otomatis membuat:
- ✅ 8 tabel + relasi lengkap
- ✅ Row Level Security (RLS) policies
- ✅ Trigger sinkronisasi `auth.users → public.users`
- ✅ Seed 5 kategori sampah default

Lalu aktifkan Realtime — jalankan `supabase/setup_realtime_sql_editor.sql` di SQL Editor.

### Langkah 4 — Buat Storage Bucket

Di Supabase Dashboard → **Storage → New Bucket**:
- Nama: `pickup-photos`
- Centang **Public bucket**
- Klik **Create**

### Langkah 5 — Jalankan

```bash
npm run dev
```

Buka **[http://localhost:3000](http://localhost:3000)** → daftar akun baru & mulai eksplorasi!

---

## 🔄 Alur Kerja Lengkap (End-to-End)

```
1. 🏪 WARUNG membuat Pickup Request
   └─ Pilih kategori sampah
   └─ Estimasi berat & jadwal
   └─ Pin lokasi di peta interaktif
   └─ Upload foto pratinjau sampah
            │
            ▼ STATUS: PENDING
            │
2. 🛵 COLLECTOR melihat pickup tersedia
   └─ Pilih beberapa pickup sekaligus
   └─ Sistem generate rute optimal (Nearest-Neighbor)
   └─ Klaim rute penjemputan
            │
            ▼ STATUS: ASSIGNED
            │
3. 🚗 COLLECTOR berangkat ke warung-warung
            │
            ▼ STATUS: IN PROGRESS
            │
4. ✅ COLLECTOR menyelesaikan di setiap warung
   └─ Input berat aktual
   └─ Upload foto bukti penimbangan
            │
            ▼ STATUS: COMPLETED
            │
5. 📊 ADMIN memantau & lihat analytics
   └─ Total berat terkumpul
   └─ Estimasi offset karbon CO₂e
   └─ Audit log seluruh aktivitas
```

---

## 📊 Fitur Unggulan

### 🔴 Live Real-time Tracking
Status penjemputan diperbarui otomatis tanpa refresh menggunakan **Supabase Realtime WebSocket**. Badge "Live · Auto-update aktif" muncul di setiap halaman yang tersubscribe.

### 🗺️ Peta Interaktif
Pengguna bisa pin lokasi di peta **Leaflet + OpenStreetMap** saat membuat pickup request. Kurir melihat lokasi semua warung yang harus dijemput dalam satu tampilan.

### 🔐 Session Persisten 30 Hari
Login sekali, sesi otomatis diperpanjang setiap kali pengguna membuka website. Tidak perlu login ulang selama masih aktif dalam 30 hari.

### 📱 Tersedia sebagai Android APK
Dibangun menggunakan **Capacitor.js** — seluruh fitur web berjalan dalam WebView Android native tanpa perlu menulis kode native terpisah.

---

## 📦 Build Android APK

```bash
# Langkah 1: Build web & sync ke Android
npm run build:android

# Langkah 2: Buka Android Studio
npm run cap:open

# Di Android Studio: Build → Build APK(s)
# Output: android/app/build/outputs/apk/debug/app-debug.apk
```

---

## 🚢 Deploy ke Vercel

```bash
# 1. Push ke GitHub (sudah dilakukan)
git push origin main

# 2. Import project di vercel.com
# 3. Tambahkan Environment Variables (.env.local)
# 4. Deploy otomatis!
```

---

## 📜 Scripts

| Perintah | Fungsi |
|----------|--------|
| `npm run dev` | Dev server (localhost:3000) |
| `npm run build` | Production build untuk Vercel |
| `npm run build:android` | Build + sync ke Android |
| `npm run cap:open` | Buka project di Android Studio |
| `npm run lint` | Cek kode dengan ESLint |

---

## 🌍 Dampak Lingkungan

Setiap kilogram sampah organik yang berhasil dikelola melalui WarungSirkular:

- ♻️ **Mengalihkan sampah** dari TPA yang menghasilkan metana
- 🌱 **Mengurangi** ~2.1 kg CO₂e emisi gas rumah kaca
- 💧 **Menghemat** ~0.4 kL air yang tercemar lindi
- 🐛 **Mendukung** produksi maggot BSF berprotein tinggi sebagai pakan ternak

---

<div align="center">

**Dibuat dengan ❤️ untuk lingkungan yang lebih bersih**

[🌐 Live Demo](https://kadang-koding.vercel.app) · [🐛 Laporkan Bug](https://github.com/hanifputra2023/KadangKoding/issues) · [💡 Request Fitur](https://github.com/hanifputra2023/KadangKoding/issues)

</div>
