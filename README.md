<div align="center">

# 🌿 WarungSirkular

### Platform Micro-Logistics & Ekosistem Sirkular Limbah Anorganik & Minyak Jelantah

**Menghubungkan warung makan, kurir sirkular pengumpul, dan sentra daur ulang / pengolah biodiesel**  
**dalam satu platform digital terintegrasi yang transparan & terukur.**

[![Live Demo](https://img.shields.io/badge/🌐_Live_Demo-kadang--koding.vercel.app-10b981?style=for-the-badge)](https://kadang-koding.vercel.app)
[![Next.js](https://img.shields.io/badge/Next.js-16-black?style=for-the-badge&logo=next.js)](https://nextjs.org)
[![Supabase](https://img.shields.io/badge/Supabase-Database-3ecf8e?style=for-the-badge&logo=supabase)](https://supabase.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?style=for-the-badge&logo=typescript)](https://typescriptlang.org)
[![Capacitor](https://img.shields.io/badge/Android_APK-Capacitor-119EFF?style=for-the-badge&logo=capacitor)](https://capacitorjs.com)

</div>

---

## 📌 Daftar Isi (Table of Contents)
1. [Latar Belakang & Masalah](#1-latar-belakang--masalah)
2. [Alur Solusi (Workflow & Business Model)](#2-alur-solusi-workflow--business-model)
   - [2.1 Alur Rantai Sirkular Sistem](#21-alur-rantai-sirkular-sistem)
   - [2.2 Alur Pengguna & Sistem (End-to-End User Journey)](#22-alur-pengguna--sistem-end-to-end-user-journey)
   - [2.3 Matriks Peran & Hak Akses (Role Matrix)](#23-matriks-peran--hak-akses-role-matrix)
   - [2.4 Kategori Limbah Sirkular yang Dikelola](#24-kategori-limbah-sirkular-yang-dikelola)
3. [Cara Menjalankan Solusi](#3-cara-menjalankan-solusi)
   - [Opsi A: Jalankan Langsung (Cloud Live Demo — Rekomendasi Juri)](#opsi-a-jalankan-langsung-cloud-live-demo--rekomendasi-juri)
   - [Opsi B: Jalankan Secara Lokal (Localhost Development)](#opsi-b-jalankan-secara-lokal-localhost-development)
   - [Opsi C: Jalankan di Android (Mobile APK)](#opsi-c-jalankan-di-android-mobile-apk)
4. [Arsitektur Sistem & Tech Stack](#4-arsitektur-sistem--tech-stack)
   - [4.1 Arsitektur Sistem](#41-arsitektur-sistem)
   - [4.2 Tech Stack](#42-tech-stack)
   - [4.3 Struktur Direktori](#43-struktur-direktori)
5. [Fitur Unggulan Sistem](#5-fitur-unggulan-sistem)
6. [Dampak Lingkungan & ESG (Impact Metrics)](#6-dampak-lingkungan--esg-impact-metrics)

---

## 1. Latar Belakang & Masalah

Setiap hari, warung makan dan UMKM kuliner menghasilkan limbah anorganik bernilai sirkular tinggi (kardus kemasan bahan baku, botol plastik PET/PP cup, kaleng seng/aluminium, dan botol kaca), serta limbah pencemar lingkungan kritis seperti **Minyak Jelantah (Used Cooking Oil / UCO)** dan **Limbah B3 Domestik** (baterai timbangan digital, lampu neon mati).

Jika tidak dikelola dengan benar:
- **Pencemaran Air & Drainase:** Minyak jelantah yang dibuang ke wastafel membeku menjadi sumbatan pipa masif (*fatberg*), dan 1 liter minyak jelantah dapat meracuni hingga 1 juta liter air bersih serta merusak ekosistem perairan.
- **Beban TPA & Hilangnya Nilai Ekonomi:** Kardus, plastik PET, dan kaleng yang berakhir di TPA membutuhkan waktu puluhan hingga ratusan tahun terurai, padahal bernilai ekonomis tinggi jika didaur ulang menjadi bahan baku sekunder (rPET, *pulp* kertas, peleburan logam, dan biofuel).

### Inti Masalah:
- ❌ **Warung Makan:** Kesulitan menyalurkan limbah anorganik dan minyak jelantah terpilah, keterbatasan ruang penyimpanan, dan kebiasaan membuang jelantah ke saluran air.
- ❌ **Kurir Sirkular (Collector):** Tidak memiliki transparansi rute penjemputan, jadwal tidak terkoordinasi, dan ketidakpastian volume limbah siap jemput.
- ❌ **Sentra Daur Ulang & Pengolah Biodiesel:** Pasokan bahan baku sirkular terpilah dari sektor UMKM kuliner belum terintegrasi dan sulit diakses langsung dari sumbernya.
- ❌ **Pemerintah & Publik:** Ketiadaan data audit jejak limbah, pencegahan pencemaran air, dan jejak karbon yang berhasil diselamatkan dari TPA.

> **WarungSirkular** hadir menyelesaikan hambatan ini melalui digitalisasi mikro-logistik pengelolaan limbah anorganik dan pencegahan pencemaran lingkungan terintegrasi.

---

## 2. Alur Solusi (Workflow & Business Model)

### 2.1 Alur Rantai Sirkular Sistem

```
┌──────────────────┐       ┌─────────────────┐       ┌──────────────────┐       ┌───────────────────────────────┐
│   WARUNG MAKAN   │ ───►  │  WARUNGSIRKULAR │ ───►  │  KURIR SIRKULAR  │ ───►  │  SENTRA DAUR ULANG & REFINERY │
│ (Produsen Limbah │       │  (Platform B2B  │       │  (Mikro-Logistik │       │ (Pengolahan Biodiesel, Pabrik │
│ Anorganik & UCO) │       │   Koordinasi)   │       │   Jemput & Timbang)      │  rPET, Peleburan Logam/Pulp)  │
└──────────────────┘       └─────────────────┘       └──────────────────┘       └───────────────────────────────┘
         │                                                                                      │
         └───────────────────◄ Nilai Tambah & Laporan Dampak ESG ◄──────────────────────────────┘
```

---

### 2.2 Alur Pengguna & Sistem (End-to-End User Journey)

Berikut adalah tahapan operasional dari pemilahan limbah di warung hingga disalurkan ke sentra pengolahan:

```
[ TAHAP 1: REQUEST OLEH WARUNG ]
  1. Mitra Warung memilah limbah anorganik (kardus, botol plastik, kaleng, kaca) dan menampung minyak jelantah dingin dalam jerigen tertutup.
  2. Buka Dashboard Warung -> Klik "Buat Penjemputan".
  3. Memilih kategori limbah, estimasi berat (kg/liter), waktu penjemputan, pin lokasi via peta, dan upload foto sampel.
  4. Sistem menyimpan data ke database -> Status: PENDING.
  5. Notifikasi realtime langsung muncul di feed mitra Kurir.
             │
             ▼
[ TAHAP 2: KLAIM & OPTIMASI RUTE OLEH KURIR ]
  1. Kurir membuka Dashboard Collector -> Melihat daftar pickup PENDING di sekitarnya.
  2. Kurir dapat memilih satu atau beberapa titik warung sekaligus.
  3. Sistem mengurutkan rute penjemputan terdekat.
  4. Kurir menekan "Klaim Penjemputan" -> Status berubah: ASSIGNED.
             │
             ▼
[ TAHAP 3: PERJALANAN & PENJEMPUTAN ]
  1. Kurir menuju lokasi warung (menggunakan navigasi koordinat peta Leaflet).
  2. Status penjemputan diupdate -> Status: IN PROGRESS.
  3. Pemilik Warung melihat status bergerak secara real-time tanpa refresh layar.
             │
             ▼
[ TAHAP 4: PENIMBANGAN AKTUAL & SERAH TERIMA ]
  1. Kurir tiba di warung dan melakukan verifikasi kondisi limbah serta penimbangan fisik.
  2. Kurir memasukkan **Berat Aktual (kg)** dan mengunggah **Foto Bukti Penimbangan**.
  3. Konfirmasi penyelesaian -> Status berubah: COMPLETED.
  4. Limbah disalurkan menuju sentra daur ulang atau refinery biodiesel ramah lingkungan.
             │
             ▼
[ TAHAP 5: ANALYTICS & AUDIT OLEH ADMIN ]
  1. Sistem otomatis mengkalkulasi dampak lingkungan & sirkularitas:
     - Estimasi offset emisi karbon (kg CO₂e).
     - Pencegahan pencemaran air bersih dari minyak jelantah yang terselamatkan.
     - Total tonase limbah sirkular bernilai tinggi yang dialihkan dari TPA.
  2. Seluruh metrik tampil di Dashboard Admin untuk keperluan audit dan sertifikasi ESG.
```

---

### 2.3 Matriks Peran & Hak Akses (Role Matrix)

| Peran (Role) | Akses URL | Fitur Utama | Tanggung Jawab Operasional |
|---|---|---|---|
| **🏪 Warung Makan** | `/warung` | Buat jadwal jemput, peta pin lokasi, tracking live status, riwayat penjemputan, metrik reduksi limbah pribadi. | Memilah limbah anorganik & jelantah dari sumber, membuat permintaan jemput saat wadah siap angkut. |
| **🛵 Kurir (Collector)** | `/collector` | Feed pickup tersedia, klaim pickup multi-titik, petunjuk arah peta, input berat riil, upload foto bukti serah terima. | Melakukan verifikasi fisik, penimbangan, dan pengantaran ke sentra daur ulang / refinery. |
| **🛡️ Administrator** | `/admin` | Ringkasan operasional real-time, verifikasi seluruh transaksi, grafik analitik ESG (CO₂e & Kg), audit log pengguna. | Menjaga kestabilan sistem, manajemen pengguna, dan penerbitan laporan dampak lingkungan. |

---

### 2.4 Kategori Limbah Sirkular yang Dikelola

| Kategori Limbah | Penanganan di Warung | Pemanfaatan Sirkular & Dampak |
|---|---|---|
| **🛢️ Minyak Jelantah (UCO)** | Disaring dingin, ditampung dalam jerigen tertutup rapat. | Bahan baku energi terbarukan (Biodiesel); mencegah penyumbatan pipa & pencemaran jutaan liter air. |
| **📦 Kardus & Karton Kemasan** | Boks dus mie, minyak, telur dilipat pipih dan diikat rapi. | Didaur ulang menjadi bubur kertas (*pulp*) untuk mencegah deforestasi hutan. |
| **🧴 Botol Plastik PET & Cup** | Botol dan cup plastik dibilas bersih dan diremas pipih. | Diolah menjadi serat tekstil, dakron, dan botol daur ulang rPET baru. |
| **🥫 Kaleng Seng & Logam** | Kaleng susu kental, sarden, dan minuman dibilas. | Material logam bernilai tinggi yang dapat dilebur ulang 100% secara sirkular. |
| **🛍️ Plastik Sachet & Kresek** | Sachet bumbu dan kantong kresek dipadatkan dalam kantong. | Diolah menjadi material komposit, *ecobrick*, dan bahan campuran aspal plastik. |
| **🍾 Botol Kaca & Pecah Belah** | Botol kecap, sirup beling dibersihkan dan disimpan tegak. | Disterilisasi untuk guna ulang (*reuse*) atau dilebur ulang menjadi kaca baru. |
| **⚠️ Limbah B3 Domestik** | Baterai timbangan digital dan lampu neon mati disimpan kering. | Menjamin penanganan aman agar zat beracun (merkuri, timbal) tidak meracuni air tanah. |

---

## 3. Cara Menjalankan Solusi

Tersedia **3 cara** untuk menguji dan menjalankan solusi WarungSirkular:

### Opsi A: Jalankan Langsung (Cloud Live Demo — Rekomendasi Juri)

> 💡 **Cara paling cepat bagi Dewan Juri**: Tidak perlu install atau clone apapun. Seluruh sistem web dan database Supabase telah online 24/7.

1. Buka tautan resmi: **[https://kadang-koding.vercel.app](https://kadang-koding.vercel.app)**
2. Masuk menggunakan salah satu **Akun Demo Siap Pakai** berikut:

| Role Pengguna | Email | Password | Kegunaan Pengujian |
|---|---|---|---|
| **Warung Mitra** | `mawar@gmail.com` | `admin123` | Menguji pembuatan jadwal jemput dan tracking status. |
| **Kurir Pengumpul (Collector)** | `budi@gmail.com` | `admin123` | Menguji klaim pickup, navigasi, dan input timbangan. |
| **Super Admin** | `nandahanif2020@gmail.com` | `admin123` | Menguji dashboard metrik analitik, grafik, dan audit log. |

*Catatan: Penguji juga dapat mendaftar akun baru mandiri secara langsung melalui halaman Register.*

---

### Opsi B: Jalankan Secara Lokal (Localhost Development)

Jika ingin menjalankan kode sumber di komputer lokal:

#### 1. Prasyarat Sistem
- **Node.js** versi 18 atau lebih baru ([Unduh Node.js](https://nodejs.org))
- **Git** ([Unduh Git](https://git-scm.com))
- Akun layanan **Supabase** (Free Tier) ([supabase.com](https://supabase.com))

#### 2. Kloning Repositori & Instalasi Dependensi
```bash
# Clone repository
git clone https://github.com/hanifputra2023/KadangKoding.git

# Masuk ke direktori proyek
cd KadangKoding

# Install semua paket dependensi
npm install
```

#### 3. Konfigurasi Environment Variables
Buat file baru bernama `.env.local` pada direktori root proyek:
```env
# URL & Kunci Publik Supabase (dari menu Project Settings -> API)
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Kunci Rahasia Server Supabase (Service Role)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# String rahasia untuk trigger endpoint internal cron
CRON_SECRET=warungsirkular_secret_cron_token_123
```

#### 4. Setup Database & Storage Supabase
1. Masuk ke **Supabase Dashboard** -> pilih proyek -> buka **SQL Editor**.
2. Salin isi file `supabase/migrations/0001_init.sql`, tempelkan ke editor, lalu klik **Run** (membuat tabel, view, enum, RLS, trigger, dan seed kategori).
3. Buka tab baru di SQL Editor, salin isi file `supabase/setup_realtime_sql_editor.sql`, lalu klik **Run** (mengaktifkan publication realtime WebSocket).
4. Buka menu **Storage** -> klik **New Bucket**:
   - Beri nama: `pickup-photos`
   - Aktifkan opsi **Public bucket**
   - Klik **Save**

#### 5. Menjalankan Server Development
```bash
npm run dev
```
Buka browser di **[http://localhost:3000](http://localhost:3000)**. Aplikasi siap digunakan!

---

### Opsi C: Jalankan di Android (Mobile APK)

Aplikasi telah dikonfigurasi menggunakan **Capacitor.js** untuk kompilasi ke perangkat Android Native:

```bash
# 1. Ekspor bundle web dan sinkronisasikan ke folder Android native
npm run build:android

# 2. Buka proyek Android di Android Studio
npm run cap:open
```

**Langkah di Android Studio:**
1. Tunggu Gradle Sync selesai.
2. Pilih menu **Build** -> **Build Bundle(s) / APK(s)** -> **Build APK(s)**.
3. File APK siap di-install di smartphone Anda pada folder:  
   `android/app/build/outputs/apk/debug/app-debug.apk`

---

## 4. Arsitektur Sistem & Tech Stack

### 4.1 Arsitektur Sistem

```
┌────────────────────────────────────────────────────────────────────────┐
│                        PRESENTATION LAYER                              │
│   Next.js 16 (App Router + React 19)   │   Capacitor Android Native    │
│   - Responsive Mobile First UI         │   - Android WebKit Container  │
│   - Leaflet + OSM Geospatial Map       │   - Native Device Integration │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ HTTPS (REST) & WSS (WebSocket)
┌───────────────────────────────────▼────────────────────────────────────┐
│                       BACKEND & CLOUD SERVICES                         │
│                           (Supabase PaaS)                              │
│                                                                        │
│  ┌──────────────────────┐  ┌─────────────────────┐  ┌───────────────┐  │
│  │ PostgreSQL Database  │  │ Supabase Auth (JWT) │  │  Realtime WS  │  │
│  │ - 8 Normalized Tables│  │ - 30-Day Rolling    │  │ - Live State  │  │
│  │ - Row Level Security │  │   Session Refresh   │  │   Updates     │  │
│  └──────────────────────┘  └─────────────────────┘  └───────────────┘  │
│  ┌──────────────────────┐  ┌─────────────────────┐                     │
│  │ Storage S3 Bucket    │  │ Next.js API Routes  │                     │
│  │ - pickup-photos      │  │ - Middleware Auth   │                     │
│  │   (Public CDN)       │  │ - Route Handlers    │                     │
│  └──────────────────────┘  └─────────────────────┘                     │
└────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Tech Stack

| Lapisan (Layer) | Teknologi | Alasan Pemilihan |
|---|---|---|
| **Frontend Framework** | **Next.js 16 (React 19)** | Server Component, optimasi SEO, performa render tinggi. |
| **Bahasa Pemrograman** | **TypeScript 5** | Strict type safety mencegah runtime error pada skema logistik. |
| **Styling & Design** | **Tailwind CSS v4** | Konsistensi palet Emerald Nature, responsive breakpoints, zero-runtime CSS. |
| **Database & Auth** | **Supabase (PostgreSQL 15)** | Relasional kuat, Row Level Security (RLS) menjaga privasi data antar-warung. |
| **Realtime Engine** | **Supabase Realtime (WebSocket)**| Perubahan status penjemputan terupdate instan tanpa beban polling server. |
| **Sesi & Login** | **30-Day Rolling JWT** | Kenyamanan mitra kurir/warung agar tidak ter-logout tiba-tiba saat di lapangan. |
| **Peta & Geospasial** | **Leaflet + OpenStreetMap** | Solusi pemetaan gratis dan presisi tanpa batasan kuota Google Maps API. |
| **Mobile Runtime** | **Capacitor 6** | Mengubah web app responsif menjadi APK Android dengan performa native. |
| **Hosting & CI/CD** | **Vercel Edge Platform** | Deploy otomatis, latensi rendah, dan SSL otomatis aktif. |

### 4.3 Struktur Direktori

```
warungsirkular-app/
├── 📂 app/                      # Arsitektur App Router Next.js
│   ├── login/                  # Autentikasi terpadu (Login & Register)
│   ├── warung/                 # Dashboard, order form, dan riwayat Warung
│   ├── collector/              # Dashboard, feed penjemputan, dan verifikasi Kurir
│   └── admin/                  # Dashboard operasional & analitik ESG
├── 📂 components/               # Komponen UI Reusable
│   ├── AppShell.tsx            # Layout responsif (Sidebar, Topbar, User Profile)
│   ├── ClientMap.tsx           # Integrasi Leaflet Map (SSR-Safe)
│   ├── Charts.tsx              # Visualisasi data analitik donat & garis
│   └── ProfileView.tsx         # Modal edit data profil pengguna
├── 📂 lib/                      # Utilitas & Abstraksi Data
│   ├── api/                    # Endpoint helper untuk masing-masing role
│   ├── supabase/               # Client koneksi Supabase (Browser, Server, Admin)
│   └── hooks/                  # Custom React Hook untuk langganan Realtime
├── 📂 supabase/                 # Skema SQL & Konfigurasi Realtime
│   ├── migrations/0001_init.sql# Skrip inisialisasi tabel, index, RLS & seed
│   └── setup_realtime_sql_editor.sql
├── 📂 android/                  # Proyek Android Native (Capacitor)
├── capacitor.config.ts          # Konfigurasi bundle ID & direktori APK
└── package.json                 # Daftar dependensi & npm scripts
```

---

## 5. Fitur Unggulan Sistem

- 🔄 **Real-Time Live Sync (WebSocket):** Setiap perubahan status penjemputan dari `PENDING` -> `ASSIGNED` -> `IN PROGRESS` -> `COMPLETED` otomatis tersinkronisasi ke seluruh dashboard tanpa perlu memuat ulang (refresh) halaman.
- 🗺️ **Peta Interaktif Geospasial:** Pin koordinat lokasi warung secara presisi menggunakan peta OpenStreetMap, memudahkan kurir mengidentifikasi titik penjemputan terdekat.
- 🔐 **Sesi Persisten 30 Hari (Rolling Expiry):** Dirancang untuk mitra lapangan; session diperbarui otomatis setiap kali aplikasi dibuka sehingga pengguna tetap masuk selama aktif dalam rentang 30 hari.
- 📱 **Multi-Platform Ready (Web & APK):** Tampilan responsif optimal di layar ponsel, tablet, hingga komputer desktop, serta dapat dipasang sebagai aplikasi Android native (.apk).
- 📸 **Verifikasi Bukti Fisik:** Collector wajib mengunggah foto timbangan dan mencatat berat kilogram aktual untuk menjamin transparansi data.

---

## 6. Dampak Lingkungan & ESG (Impact Metrics)

Platform WarungSirkular tidak hanya mencatat transaksi logistik, tetapi juga secara otomatis mengonversinya menjadi indikator keberlanjutan terukur:

| Indikator Dampak | Parameter & Formula Perhitungan | Signifikansi Lingkungan & Sirkularitas |
|---|---|---|
| **Pengalihan Limbah TPA** | $\sum \text{Berat Aktual (Kg)}$ | Mencegah penumpukan limbah anorganik di TPA kota. |
| **Offset Emisi Karbon** | $\approx 0.3 - 2.1\text{ kg CO}_2\text{e} \times \text{Kg Limbah}$ | Menurunkan jejak emisi karbon melalui substitusi bahan baku daur ulang sekunder. |
| **Pencegahan Pencemaran Air** | $1\text{ Liter Jelantah} \approx 1.000.000\text{ Liter Air}$ | Mencegah pencemaran air tanah & sungai akibat pembuangan minyak jelantah dan limbah B3 ke saluran drainase. |
| **Bahan Baku Biodiesel & Daur Ulang** | $\sum \text{Kg/Liter Terkumpul}$ | Memasok bahan baku energi terbarukan (Biodiesel) serta mendukung ekonomi daur ulang lokal. |

---

<div align="center">

**WarungSirkular** — *Inovasi Digital Mewujudkan Ekosistem Daur Ulang & Nol Limbah ke TPA.*

[🌐 Buka Live Demo](https://kadang-koding.vercel.app) • [📂 Repositori GitHub](https://github.com/hanifputra2023/KadangKoding) • [🐛 Laporkan Kendala](https://github.com/hanifputra2023/KadangKoding/issues)

</div>
