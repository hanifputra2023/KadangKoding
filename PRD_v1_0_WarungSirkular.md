# PRD: WarungSirkular

> **Status:** Draft v1.0 (Merged & Refined)
> **Project:** Hackathon JOINTS 2026
> **Category:** Sustainability
> **Product Type:** B2B Micro-Logistics Platform
> **Document Status:** Living Document
> **Supersedes:** v0.1 (2026-08-26), v0.2 (2026-08-28)
> **Last Updated:** 2026-08-28

---


## Daftar Isi

1. Problem Statement
2. Goals & Success Metrics
3. Target Users
4. User Stories & Acceptance Criteria
5. Functional Requirements
6. Non-Functional Requirements
7. Scope
8. Business Rules
9. Data Model — Relational Schema
10. AI Agent Rules
11. Technical Constraints
12. Open Questions & Assumptions
13. PRD Governance
14. Change Log

---

## 1. Problem Statement

Warung makan menghasilkan sisa makanan dan bahan organik yang berpotensi dimanfaatkan kembali. Di sisi lain, pembudidaya maggot (BSF) atau pengolah sampah organik membutuhkan pasokan bahan baku organik yang konsisten dan sesuai dengan kriteria budidaya (misalnya: tidak tercampur minyak jelantah pekat, bahan kimia, atau sampah non-organik/plastik).

Saat ini terdapat beberapa permasalahan utama dalam rantai pasok sampah organik mikro:

1. **Ketidakpastian Kualitas & Jenis Bahan** — Pengambil sampah sering mendapati sampah yang sudah membusuk ekstrem atau tercampur limbah anorganik karena tidak adanya kategorisasi di awal.
2. **Koordinasi & Visibilitas Waktu** — Warung tidak memiliki kepastian kapan sampah akan diambil, sedangkan pengambil (*collector*) tidak memiliki visibilitas mengenai lokasi warung mana saja yang memiliki bahan siap jemput beserta jendela waktu (*time window*) operasionalnya.
3. **Logistik yang Tidak Efisien** — Pengambilan dilakukan secara acak tanpa memperhatikan kapasitas kendaraan pengambil (*vehicle capacity limit*) maupun rute perjalanan yang optimal.
4. **Risiko Penumpukan Sampah** — Sampah organik cepat membusuk dan menimbulkan bau. Jika tidak diambil dalam kurun waktu tertentu, sampah tersebut terpaksa dibuang ke TPA.

**WarungSirkular** dirancang sebagai platform mikro-logistik B2B yang mengoordinasikan permintaan penjemputan (*pickup request*) bahan organik dari warung makan kepada pembudidaya maggot/mitra pengelola secara efisien, terstruktur, dan terukur.

> **Catatan validasi:** Besaran volume sampah organik per warung, kebutuhan aktual pihak collector, *willingness to participate*, dan kondisi proses pengambilan saat ini masih perlu divalidasi melalui wawancara lapangan (lihat Bagian 12).

---

## 2. Goals & Success Metrics

### 2.1 Product Goals

- **Kategorisasi & Validasi Visual** — Membantu warung melaporkan bahan organik siap jemput lengkap dengan kategori, estimasi berat, jendela waktu, dan foto kondisi sampah.
- **Manajemen Rute & Kapasitas** — Membantu *collector* melihat *pickup request* yang tersedia dan mendapatkan urutan rute penjemputan efisien yang mempertimbangkan batas kapasitas kendaraan.
- **Pencatatan Akurat & Validasi Lapangan** — Mencatat berat aktual dan foto bukti penjemputan di lapangan untuk menjamin akurasi data.
- **Penanganan Otomatis Request Kedaluwarsa** — Mengatur mekanisme *auto-expiration* untuk sampah yang tidak terambil dalam jangka waktu tertentu guna menjaga integritas data dashboard.
- **Impact Analytics** — Menyediakan metrik dampak lingkungan (total sampah organik terkumpul, estimasi reduksi jejak karbon/metana, dan jumlah warung aktif).

### 2.2 Hackathon MVP Goals

MVP harus mampu mendemonstrasikan alur utama end-to-end:

```text
Warung membuat pickup request (Kategori, Estimasi Berat, Time Window, Foto)
        ↓
Request masuk ke sistem (Status: pending)
        ↓
Collector melihat pickup yang tersedia & memfilter sesuai lokasi/kapasitas
        ↓
Collector mengklaim pickup & sistem menghasilkan recommended route (termasuk cek kapasitas)
        ↓
Status berubah menjadi assigned → in_progress
        ↓
Collector melakukan penjemputan di lokasi warung
        ↓
Berat aktual & foto bukti diunggah (Status: completed)
        * Jika ada kendala di lapangan → Status: failed (dengan alasan)
        * Jika tidak ada collector dalam 24 jam → Status: expired (otomatis)
        ↓
Dampak lingkungan tercatat di Dashboard Analytics
```

### 2.3 Success Metrics

Target awal MVP:

- User warung dapat membuat *pickup request* lengkap dalam waktu **< 1 menit**.
- *Collector* dapat melihat seluruh *pickup request* aktif dalam radius/area layanannya.
- Sistem dapat memberikan rekomendasi rute tanpa melebihi batas kapasitas beban kendaraan *collector*.
- 100% penjemputan sukses (*completed*) wajib memiliki data `actual_weight_kg` dan foto bukti penimbangan/penjemputan.
- Sistem otomatis memperbarui status *request* menjadi `expired` jika melewati batas *time window* / 24 jam.
- Dashboard mampu menampilkan agregasi berat bahan organik yang berhasil diselamatkan dari TPA.
- Berat aktual dapat dibandingkan dengan estimasi awal untuk mengukur akurasi pelaporan warung dari waktu ke waktu.

> **Catatan:** angka target di atas bersifat hipotesis awal hackathon dan akan direvisi setelah validasi user lapangan.

---

## 3. Target Users

### 3.1 End User — Warung

Pemilik atau pengelola warung makan yang menghasilkan sisa bahan organik siap olah.

**Kebutuhan utama:**
- Melaporkan ketersediaan bahan organik secara cepat dan sederhana.
- Mengidentifikasi jenis/kategori bahan organik (mis. sisa nasi/lauk, sayur/buah, campuran).
- Menentukan estimasi berat dan *time window* siap jemput.
- Menambahkan foto pratinjau kondisi sampah.
- Memantau status penjemputan secara real-time.
- Melihat riwayat penjemputan dan kontribusi dampak lingkungan warungnya.

### 3.2 End User — Collector / Pemanfaat

Pihak pengambil bahan organik, seperti pembudidaya maggot BSF, peternak, atau pengompos mikro.

> **Catatan:** identitas dan model operasional "collector" (individu vs. badan usaha, mandiri vs. berjejaring) masih merupakan hipotesis dan perlu divalidasi lapangan.

**Kebutuhan utama:**
- Melihat daftar *pickup request* aktif di area sekitar.
- Melihat detail kategori sampah, foto kondisi, dan estimasi berat.
- Mengatur kapasitas kendaraan penjemput (*vehicle capacity*).
- Mendapatkan rekomendasi urutan rute penjemputan (*recommended route*) yang sesuai dengan akumulasi beban kendaraan.
- Memperbarui status penjemputan (`assigned`, `in_progress`, `completed`, `failed`).
- Menginput berat aktual dan mengunggah foto bukti penjemputan.

### 3.3 Admin / Stakeholder

Pengelola platform dan pemantau operasional.

**Kebutuhan utama:**
- Pengelolaan data user (Warung, Collector) tanpa akses ke kredensial (admin **tidak** dapat melihat/mengubah password user).
- Monitoring seluruh transaksi penjemputan dan statusnya, dengan filter tanggal, status, dan kategori sampah.
- Mengakses statistik operasional dan agregasi dampak lingkungan (*Impact Dashboard*).
- Memantau *audit log* untuk keamanan dan penanganan klaim kejanggalan data.

### 3.4 AI / Developer

AI coding agent dan software engineer yang membangun serta memelihara sistem.

**Aturan dasar AI/Dev:**
- PRD v1.0 ini adalah **single source of truth**.
- AI/Dev **dilarang membuat asumsi sendiri** tanpa mengonfirmasi pada dokumen ini.
- AI/Dev **tidak boleh menganggap hipotesis/asumsi kerja (Bagian 12) sebagai fakta yang sudah tervalidasi**.
- Lihat Bagian 10 untuk aturan teknis lengkap.

---

## 4. User Stories & Acceptance Criteria

### 4.1 Warung — Membuat Pickup Request

**User Story**
> Sebagai pemilik warung, aku ingin melaporkan bahan organik yang siap diambil lengkap dengan kategori, foto, dan jadwal penjemputan agar collector yang sesuai dapat mengambilnya tepat waktu.

**Acceptance Criteria**
- Warung harus dalam kondisi *authenticated* (login).
- Warung wajib memilih Kategori Sampah (`waste_category_id`).
- Warung memasukkan estimasi berat (`estimated_weight_kg` > 0).
- Warung menentukan *time window* penjemputan (`pickup_window_start` & `pickup_window_end`).
- Warung wajib mengunggah foto pratinjau kondisi sampah (`sample_photo_url`).
- Koordinat lokasi penjemputan diambil secara otomatis dari `WarungProfile` (dapat disesuaikan jika titik jemput berbeda).
- Sistem melakukan validasi input di sisi server sebelum menyimpan.
- Sistem menyimpan *request* dengan status awal `pending`.
- Warung menerima notifikasi/konfirmasi visual bahwa *request* berhasil dibuat.

### 4.2 Warung — Melihat & Mengelola Status Pickup

**User Story**
> Sebagai pemilik warung, aku ingin melihat status penjemputan sampaku dan mengubah/membatalkannya selama masih memungkinkan, agar aku tahu perkembangan penjemputan dan tetap punya kendali sebelum diproses collector.

**Acceptance Criteria**
- Warung hanya dapat melihat, mengubah, dan membatalkan daftar *pickup request* milik akunnya sendiri (lihat Business Rules — Ownership, Bagian 8.2).
- Warung dapat membatalkan *request* (`cancelled`) **hanya** selama status masih `pending`.
- Warung dapat melihat riwayat *pickup request* beserta kontribusi dampak lingkungannya.
- Status yang didukung sistem secara lengkap:
  ```text
  Pending      : Memenuhi syarat penjemputan, menunggu diambil collector
  Assigned     : Telah diklaim oleh collector / dimasukkan ke rute
  In Progress  : Collector dalam perjalanan/proses menuju lokasi
  Completed    : Sampah berhasil diambil dan ditimbang di lokasi
  Cancelled    : Dibatalkan oleh Warung (sebelum diproses)
  Failed       : Gagal diambil di lapangan (mis. warung tutup / sampah rusak)
  Expired      : Melewati batas waktu 24 jam tanpa ada collector yang mengambil
  ```

### 4.3 Collector — Melihat & Mengklaim Pickup Aktif

**User Story**
> Sebagai collector, aku ingin melihat daftar penjemputan yang tersedia lengkap dengan foto, jenis sampah, dan lokasi agar aku dapat memilih sampah yang cocok dengan kebutuhan budidaya dan kapasitas kendaraanku.

**Acceptance Criteria**
- Collector harus login.
- Sistem hanya menampilkan *pickup request* berstatus `pending` yang berada dalam area layanan (`service_area`) collector.
- Informasi yang ditampilkan mencakup: Nama Warung, Alamat, Kategori Sampah, Estimasi Berat, Foto Pratinjau, dan *Time Window*.
- Sistem memberikan peringatan visual jika estimasi berat total melebihi `vehicle_capacity_kg` milik collector.
- Collector dapat mengklaim satu atau beberapa *request* sekaligus untuk dimasukkan ke dalam rute harian.
- Collector hanya dapat mengakses/mengubah *pickup request* yang ditugaskan/diklaim kepadanya (lihat Business Rules — Ownership, Bagian 8.2).

### 4.4 Collector — Rekomendasi Rute Penjemputan

**User Story**
> Sebagai collector, aku ingin mendapatkan rekomendasi urutan penjemputan efisien yang tidak melebihi kapasitas kendaraanku agar perjalanan logistik lebih hemat waktu dan BBM.

**Acceptance Criteria**
- Sistem menerima kumpulan *pickup request* yang diklaim oleh collector.
- Algoritma routing menghitung urutan penjemputan berdasarkan jarak lokasi (algoritma Nearest-Neighbor / heuristik sejenis) dan batasan *time window*.
- Sistem melakukan validasi akumulasi berat: **Total Estimasi Berat Rute ≤ Kapasitas Kendaraan Collector**.
- Sistem menampilkan urutan titik singgah (*sequence*), total estimasi jarak (km), dan perkiraan total akumulasi beban.
- UI/dokumentasi **wajib** menyebut hasil ini sebagai **"Recommended Route"**, bukan "rute optimal", karena algoritma bersifat heuristik dan belum tentu menghasilkan solusi optimal secara matematis.

### 4.5 Collector — Mencatat & Menyelesaikan Penjemputan

**User Story**
> Sebagai collector, aku ingin mencatat berat aktual yang ditimbang di lokasi serta mengunggah foto bukti agar transaksi penjemputan sah dan tercatat di sistem.

**Acceptance Criteria**
- Collector mengubah status menjadi `in_progress` saat mulai bergerak/memproses penjemputan.
- Untuk menyelesaikan penjemputan (`completed`):
  - Collector wajib memasukkan berat aktual (`actual_weight_kg` > 0).
  - Collector wajib mengunggah foto bukti penimbangan/penjemputan (`proof_photo_url`).
  - Sistem mencatat timestamp `completed_at`.
  - Berat aktual menjadi sumber data untuk perhitungan Impact Analytics.
- Jika penjemputan gagal (`failed`):
  - Collector wajib memilih/memasukkan alasan kegagalan (`failure_reason`).
  - Status berubah menjadi `failed` dan timestamp dicatat; *request* yang `failed` tidak dapat langsung diisi beratnya.
- Collector tidak dapat menyelesaikan atau menggagalkan *pickup request* yang tidak ditugaskan kepadanya.

### 4.6 System — Auto-Expiration Worker

**User Story**
> Sebagai pengelola sistem, aku ingin request yang tidak diambil dalam kurun waktu 24 jam berubah menjadi kedaluwarsa secara otomatis agar data tidak mengendap di dashboard collector.

**Acceptance Criteria**
- Sistem menjalankan *scheduled job* (cron worker) secara berkala.
- Setiap *pickup request* berstatus `pending` yang telah melewati `pickup_window_end` atau 24 jam sejak `created_at` diubah statusnya menjadi `expired`.
- Timestamp `expired_at` dicatat secara otomatis.

### 4.7 Admin — Monitoring & Audit Log

**User Story**
> Sebagai admin, aku ingin memantau seluruh transaksi penjemputan dan aktivitas user untuk memastikan operasional platform berjalan lancar dan aman.

**Acceptance Criteria**
- Admin dapat melihat tabel pengguna (Warung & Collector) serta detail *pickup request*, tanpa akses ke password user.
- Admin dapat memfilter penjemputan berdasarkan rentang tanggal, status, dan kategori sampah.
- Admin dapat melihat statistik operasional dasar (jumlah request per status, jumlah warung/collector aktif).
- Setiap aksi sensitif (perubahan role, pembatalan sistem, penghapusan data) tercatat pada tabel `audit_logs`.

---

## 5. Functional Requirements

### 5.1 Authentication & Authorization
- [ ] Registrasi & login multi-role (`warung`, `collector`, `admin`).
- [ ] Authorization server-side berbasis JWT / Session Token.
- [ ] Session/token dikelola dengan aman; logout membatalkan sesi sesuai mekanisme yang digunakan.
- [ ] User role-based data access control (Warung hanya bisa edit request sendiri; Collector hanya bisa update request yang di-assign kepadanya).

### 5.2 Module Warung
- [ ] Create Pickup Request (Input: `waste_category_id`, `estimated_weight_kg`, `pickup_window_start`, `pickup_window_end`, `sample_photo_url`).
- [ ] Edit Pickup Request selama status masih mengizinkan perubahan.
- [ ] Cancel Pickup Request (hanya jika status masih `pending`).
- [ ] View Active & Historical Pickup Requests.

### 5.3 Module Collector
- [ ] Dashboard Active Pickups dengan filter spasial (area layanan) & kategori.
- [ ] Claim/Assign Pickup Request ke rute aktif.
- [ ] Vehicle Capacity Setting (`vehicle_capacity_kg`).
- [ ] Complete Pickup (Input: `actual_weight_kg`, upload `proof_photo_url`).
- [ ] Fail Pickup (Input: `failure_reason`).

### 5.4 Module Routing Engine
- [ ] Generate Recommended Route berdasarkan titik-titik yang telah diklaim collector.
- [ ] Akumulasi total berat & validasi terhadap `vehicle_capacity_kg`.
- [ ] Hitung total estimasi jarak (km) rute.
- [ ] Sediakan baseline pembanding rute sebelum vs. sesudah optimasi (untuk keperluan demo/evaluasi).

### 5.5 Module System / Background Worker
- [ ] Auto-expire worker untuk *pending request* yang basi (> 24 jam / melewati *time window*).

### 5.6 Module Admin & Analytics
- [ ] Operations Dashboard (daftar request, breakdown status).
- [ ] Impact Tracking Dashboard:
  - Total Waste Collected (kg / ton).
  - Total Completed Pickups.
  - Active Warung Count.
  - Carbon Offsetting / Methane Avoidance Estimator (Formula: Total Weight × Emission Factor).
- [ ] Audit Log Viewer dengan filter.

---

## 6. Non-Functional Requirements

### 6.1 Performance
- Waktu muat halaman utama dashboard **< 2 detik** pada kondisi jaringan wajar.
- Response time API CRUD **< 1 detik** pada kondisi normal.
- Algoritma routing harus merespons hasil rekomendasi dalam **< 1.5 detik** untuk maksimal 20 titik singgah.

### 6.2 Security
- Semua input dari client dianggap **untrusted input**; wajib divalidasi & disanitasi di server (pencegahan SQL Injection, XSS).
- Password di-hash menggunakan algoritma aman (Bcrypt / Argon2); tidak boleh disimpan dalam plaintext.
- Secret/API key tidak boleh disimpan di source code, repository, atau plaintext — gunakan environment variable.
- Penanganan file upload (foto pratinjau & bukti) wajib memvalidasi mime-type (hanya JPG/PNG/WebP, maks. 5MB) dan disimpan di Object Storage aman.
- User tidak boleh dapat mengakses/memodifikasi data milik user lain hanya dengan memanipulasi ID/resource; endpoint sensitif wajib memiliki authorization check.
- CORS policy dan HTTPS enforcement.
- Error handling tidak menampilkan stack trace/secret internal pada lingkungan produksi.

### 6.3 Reliability & Data Integrity
- Transaksi perubahan status pickup dibungkus dalam Database Transaction untuk mencegah *race condition* (mis. dua collector mengklaim request yang sama secara bersamaan).
- Status pickup tidak boleh berubah secara tidak konsisten akibat request berulang (idempotency pada aksi transisi status).
- Sistem menangani kegagalan API secara graceful.
- *Soft delete* diterapkan pada data profil user.

### 6.4 Usability
- User baru harus dapat memahami cara membuat pickup request tanpa tutorial panjang.
- Alur utama (pembuatan request → klaim → penyelesaian) harus sederhana dan minim langkah.
- Status pickup ditampilkan dengan label teks yang jelas, tidak hanya mengandalkan warna.

### 6.5 Maintainability
- Struktur kode konsisten; business logic tidak ditempatkan seluruhnya di UI component.
- API contract terdokumentasi.
- README menjelaskan setup project.
- Setiap perubahan schema database wajib menggunakan Database Migration terdokumentasi (mis. Prisma Migration, Knex, TypeORM).
- Komponen/fungsi yang dipakai berulang harus dapat digunakan kembali (reusable).

---

## 7. Scope

### 7.1 In Scope — MVP (v1.0)
- Multi-role Authentication (Warung, Collector, Admin).
- Form Request Sampah lengkap dengan Kategori, Time Window, Estimasi Berat, & Upload Foto Pratinjau.
- Dashboard Collector untuk *browse* & filter request berdasarkan area dan kapasitas.
- Algoritma Rekomendasi Rute sederhana (Nearest-Neighbor) dengan batasan kapasitas kendaraan.
- Form Penyelesaian Pickup (Berat Aktual + Upload Foto Bukti Timbangan) & Form Kegagalan.
- Automated Expired Request Background Job.
- Admin Operations & Impact Dashboard (agregasi berat total, jumlah warung aktif, estimasi dampak karbon) + Audit Log Viewer.

### 7.2 Out of Scope — v1.0

Fitur berikut **tidak boleh dibuat oleh AI agent kecuali secara eksplisit ditambahkan ke PRD**:

- Integrasi Payment Gateway / transaksi keuangan langsung.
- Marketplace bahan pangan.
- Sistem voucher / poin / reward kompleks (ditunda sampai validasi bisnis selesai — lihat catatan di Bagian 12).
- Real-time GPS Tracking kendaraan collector secara live di peta.
- Chat/messaging in-app antara Warung dan Collector.
- Push notification.
- Rating/review antar pihak.
- Multi-city operation.
- Dynamic pricing.
- Advanced AI prediction.
- Native Mobile App (Android/iOS) — MVP difokuskan pada Responsive Web App (PWA-friendly).
- Fleet management kompleks.
- Integrasi sensor IoT / automatic weight detection.

---

## 8. Business Rules

### 8.1 Pickup Lifecycle
1. **Pembuatan Request:** Pickup request hanya dapat dibuat oleh role `warung`. Estimasi berat harus > 0 kg dan lokasi wajib tersedia.
2. **Kapasitas Kendaraan:** Total estimasi berat dari kumpulan *pickup request* yang dimasukkan ke dalam satu rute oleh collector tidak boleh melebihi `vehicle_capacity_kg` collector tersebut.
3. **Syarat Penyelesaian (Completion Threshold):** Request tidak dapat diubah statusnya menjadi `completed` tanpa data `actual_weight_kg` dan `proof_photo_url`.
4. **Mekanisme Kegagalan:** Jika penjemputan gagal (`failed`), collector wajib mengisi `failure_reason`. Request yang `failed` tidak dapat langsung diisi beratnya.
5. **Auto-Expiration:** Request `pending` yang melebihi `pickup_window_end` atau durasi 24 jam otomatis berstatus `expired` oleh sistem.
6. **Imutabilitas Data:** Request yang sudah berstatus `completed`, `failed`, `cancelled`, atau `expired` tidak dapat diubah kembali menjadi `pending` atau `assigned`.

### 8.2 Ownership & Access
- Warung hanya dapat melihat dan mengubah pickup miliknya sendiri, sesuai status yang diizinkan.
- Collector hanya dapat mengakses pickup yang ditugaskan/tersedia untuknya; tidak boleh menyelesaikan pickup yang tidak ditugaskan kepadanya.
- Admin memiliki akses operasional sesuai permission, tanpa akses ke password user.

### 8.3 Routing
- Routing bekerja berdasarkan pickup yang memenuhi kondisi untuk dimasukkan ke rute (status `assigned`/diklaim, dalam batas kapasitas).
- Sistem/dokumentasi harus menjelaskan constraint yang digunakan (jarak, *time window*, kapasitas).
- Istilah **"optimal"** hanya boleh digunakan jika terdapat dasar pengukuran yang sesuai; selama menggunakan heuristik, UI/dokumentasi wajib menyebutnya sebagai **"Recommended Route"**.

---

## 9. Data Model — Relational Schema

### 9.1 Entity Relationship Overview

```text
[User] 1 ──── 1 [WarungProfile] (via user_id)
[User] 1 ──── 1 [CollectorProfile] (via user_id)

[WasteCategory] 1 ──── N [PickupRequest] (via waste_category_id)
[WarungProfile] 1 ──── N [PickupRequest] (via warung_id)
[CollectorProfile] 0..1 ──── N [PickupRequest] (via collector_id)

[CollectorProfile] 1 ──── N [Route] (via collector_id)
[Route] 1 ──── N [RouteStop] (via route_id)
[PickupRequest] 1 ──── 0..1 [RouteStop] (via pickup_request_id)

[User] 1 ──── N [AuditLog] (via user_id)
```

### 9.2 Skema Database SQL (PostgreSQL Dialect Compatible)

#### 1. `users`
| Field | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() | Unique identifier |
| `name` | VARCHAR(100) | NOT NULL | Nama pengguna |
| `email` | VARCHAR(150) | UNIQUE, NOT NULL | Alamat email login |
| `password_hash` | VARCHAR(255) | NOT NULL | Encrypted password |
| `role` | VARCHAR(20) | NOT NULL, CHECK (role IN ('warung', 'collector', 'admin')) | Role pengguna |
| `phone_number` | VARCHAR(20) | NULL | Nomor kontak WhatsApp/HP |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Timestamp registrasi |
| `updated_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Timestamp pembaharuan |

#### 2. `warung_profiles`
| Field | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() | Unique identifier |
| `user_id` | UUID | FOREIGN KEY (users.id) ON DELETE CASCADE | Relasi ke user |
| `business_name` | VARCHAR(150) | NOT NULL | Nama Warung Makan |
| `address` | TEXT | NOT NULL | Alamat lengkap warung |
| `latitude` | DECIMAL(10, 8) | NOT NULL | Koordinat Latitude |
| `longitude` | DECIMAL(11, 8) | NOT NULL | Koordinat Longitude |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Timestamp pembuatan |

#### 3. `collector_profiles`
| Field | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() | Unique identifier |
| `user_id` | UUID | FOREIGN KEY (users.id) ON DELETE CASCADE | Relasi ke user |
| `vehicle_type` | VARCHAR(50) | NOT NULL | Jenis kendaraan (Motor, Tossa, Pick-up) |
| `vehicle_capacity_kg` | DECIMAL(8, 2) | NOT NULL, DEFAULT 50.00 | Batas maksimal angkut (kg) |
| `service_area` | VARCHAR(100) | NULL | Area jangkauan operasional |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Timestamp pembuatan |

#### 4. `waste_categories`
| Field | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() | Unique identifier |
| `category_name` | VARCHAR(50) | NOT NULL | Mis. Sisa Nasi/Lauk, Sayur/Buah, Campuran |
| `description` | TEXT | NULL | Deskripsi kelayakan untuk maggot |
| `is_maggot_friendly` | BOOLEAN | DEFAULT TRUE | Indikator kesesuaian maggot |

#### 5. `pickup_requests`
| Field | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() | Unique identifier |
| `warung_id` | UUID | FOREIGN KEY (warung_profiles.id) | Warung pembuat request |
| `collector_id` | UUID | NULLABLE, FOREIGN KEY (collector_profiles.id) | Collector yang mengklaim |
| `waste_category_id` | UUID | FOREIGN KEY (waste_categories.id) | Jenis bahan organik |
| `estimated_weight_kg` | DECIMAL(8, 2) | NOT NULL, CHECK (estimated_weight_kg > 0) | Estimasi berat awal |
| `actual_weight_kg` | DECIMAL(8, 2) | NULLABLE | Berat hasil penimbangan aktual |
| `sample_photo_url` | TEXT | NULLABLE | Foto kondisi sampah saat request |
| `proof_photo_url` | TEXT | NULLABLE | Foto penimbangan/bukti penjemputan |
| `latitude` | DECIMAL(10, 8) | NOT NULL | Titik penjemputan Latitude |
| `longitude` | DECIMAL(11, 8) | NOT NULL | Titik penjemputan Longitude |
| `pickup_window_start` | TIMESTAMP | NOT NULL | Awal jendela waktu jemput |
| `pickup_window_end` | TIMESTAMP | NOT NULL | Akhir jendela waktu jemput |
| `status` | VARCHAR(20) | DEFAULT 'pending' | `pending`, `assigned`, `in_progress`, `completed`, `cancelled`, `failed`, `expired` |
| `failure_reason` | TEXT | NULLABLE | Catatan jika penjemputan `failed` |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Waktu request dibuat |
| `assigned_at` | TIMESTAMP | NULLABLE | Waktu diklaim collector |
| `completed_at` | TIMESTAMP | NULLABLE | Waktu penjemputan selesai |
| `expired_at` | TIMESTAMP | NULLABLE | Waktu kedaluwarsa |

#### 6. `routes`
| Field | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() | Unique identifier |
| `collector_id` | UUID | FOREIGN KEY (collector_profiles.id) | Collector pemilik rute |
| `total_distance_km` | DECIMAL(8, 2) | DEFAULT 0.00 | Total estimasi jarak rute |
| `total_weight_kg` | DECIMAL(8, 2) | DEFAULT 0.00 | Total estimasi akumulasi berat |
| `status` | VARCHAR(20) | DEFAULT 'active' | `active`, `completed`, `cancelled` |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Waktu rute dibuat |
| `completed_at` | TIMESTAMP | NULLABLE | Waktu rute selesai |

#### 7. `route_stops`
| Field | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() | Unique identifier |
| `route_id` | UUID | FOREIGN KEY (routes.id) ON DELETE CASCADE | Relasi ke rute utama |
| `pickup_request_id` | UUID | FOREIGN KEY (pickup_requests.id) | Relasi ke request penjemputan |
| `sequence_number` | INT | NOT NULL | Urutan titik singgah (1, 2, 3...) |
| `status` | VARCHAR(20) | DEFAULT 'pending' | Status titik singgah |

#### 8. `audit_logs`
| Field | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() | Unique identifier |
| `user_id` | UUID | FOREIGN KEY (users.id) | User pelaku aksi |
| `action` | VARCHAR(100) | NOT NULL | Jenis aksi (mis. `CREATE_PICKUP`, `CLAIM_PICKUP`) |
| `resource_type` | VARCHAR(50) | NOT NULL | Nama entitas (mis. `pickup_requests`) |
| `resource_id` | UUID | NULLABLE | ID entitas terkait |
| `metadata` | JSONB | NULLABLE | Detail konteks tambahan dalam format JSON |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Waktu aksi dicatat |

---

## 10. AI Agent Rules

### 10.1 General
1. **Source of Truth:** Dokumen PRD v1.0 ini adalah referensi mutlak. Jangan pernah menambah/mengubah fitur atau aturan tanpa persetujuan PRD.
2. Jangan membuat fitur yang tidak tercantum dalam Scope (Bagian 7) tanpa persetujuan.
3. Jangan mengubah business rules (Bagian 8) tanpa menjelaskan perubahannya.
4. Jika requirement ambigu dan berdampak pada arsitektur/security/data, **STOP dan tanyakan terlebih dahulu**.
5. Jangan menganggap asumsi/hipotesis (Bagian 12) sebagai fakta yang sudah tervalidasi.
6. Jangan menghapus requirement hanya karena lebih mudah diimplementasikan.

### 10.2 Security
7. Selalu lakukan validasi data di sisi backend (server-side); jangan mempercayai data dari frontend.
8. Jangan pernah hardcode API key, secret, token, atau password dalam plaintext.
9. Jangan menonaktifkan authentication/authorization "sementara" tanpa persetujuan eksplisit.
10. Gunakan ORM / Parameterized Queries untuk mencegah SQL Injection.
11. Jangan membuat endpoint yang memungkinkan user mengakses resource milik user lain; jangan gunakan `user_id` dari request body sebagai satu-satunya dasar authorization.
12. Jangan mengekspos stack trace atau secret dalam response production.
13. Jangan menggunakan `dangerouslySetInnerHTML` atau mekanisme HTML injection serupa tanpa alasan yang tervalidasi.
14. Jangan menyimpan password plaintext.
15. Jangan commit file `.env` atau secret ke Git.
16. Gunakan dependency yang terawat dan memiliki lisensi yang sesuai.

### 10.3 Database Integrity
17. Setiap perubahan schema **wajib** menggunakan file Database Migration (mis. Prisma Migration, Knex, atau TypeORM) — jangan mengubah schema secara manual.
18. Perubahan status pada `pickup_requests` harus memvalidasi status sebelumnya (mis. `completed` tidak boleh diubah kembali ke `pending`).
19. Dalam logika pencarian/rekomendasi rute, pastikan total estimasi berat dari kumpulan request tidak melebihi `vehicle_capacity_kg` dari collector terkait.
20. Jangan menghapus data menggunakan destructive query tanpa konfirmasi.
21. Semua relasi dan ownership harus divalidasi; database access policy mengikuti role dan ownership user.

### 10.4 Code Quality
22. Jangan membuat duplicate implementation jika abstraksi yang sesuai sudah tersedia.
23. Jangan memasukkan business logic kompleks langsung ke UI component.
24. Error handling harus eksplisit.
25. Jangan menggunakan `any` secara berlebihan hanya untuk menghilangkan TypeScript error.
26. Jangan menambahkan dependency hanya untuk menyelesaikan masalah sederhana.
27. Setelah perubahan signifikan, update dokumentasi yang relevan.

### 10.5 Testing
28. Setiap fitur kritis harus memiliki minimal happy-path test.
29. Test juga harus mencakup invalid input dan unauthorized access.
30. Sebelum menyatakan task selesai, jalankan lint/typecheck/test yang tersedia.
31. Jangan menyatakan fitur "working" jika hanya berhasil pada happy path.

### 10.6 Git
32. Commit harus menjelaskan perubahan secara jelas.
33. Jangan melakukan force push atau destructive Git operation tanpa persetujuan.
34. Jangan menghapus branch/commit untuk "membersihkan" history tanpa persetujuan.
35. Jangan memasukkan secret atau credential ke repository.

---

## 11. Technical Constraints

- **Frontend:** React / Next.js (Tailwind CSS, Leaflet.js / Mapbox untuk UI peta).
- **Backend:** Node.js (Express / NestJS) atau Python (FastAPI).
- **Database:** PostgreSQL (disarankan dengan ekstensi PostGIS jika diperlukan query spasial jarak lanjutan).
- **Object Storage:** Cloudinary / Supabase Storage / AWS S3 (untuk file foto pratinjau dan bukti timbangan).
- **Background Worker:** Node-cron / BullMQ / Celery (untuk pekerjaan otomatisasi `auto-expire` request).

**Prinsip pemilihan teknologi** (berlaku bila ada kebutuhan penyesuaian/penggantian komponen di atas): mempertimbangkan kemampuan tim, waktu hackathon, maintainability, security, ketersediaan API, biaya, lisensi, dan kemudahan deployment. AI agent **tidak boleh mengganti stack utama** tanpa persetujuan tim.

---

## 12. Open Questions & Assumptions

### 12.1 Open Questions (Perlu Validasi Lapangan)
- [ ] Berapa rata-rata bahan organik yang benar-benar dihasilkan warung target, dan berapa persen deviasi antara estimasi berat warung dengan berat aktual timbangan collector?
- [ ] Bagaimana warung mengelola sisa makanan saat ini, dan apakah warung bersedia memilah bahan organik dari sampah anorganik (plastik/tisu)?
- [ ] Siapa pihak yang paling realistis menjadi collector, dan berapa kebutuhan bahan organik collector/pembudidaya maggot secara berkala?
- [ ] Apakah kualitas bahan (kadar air, tingkat kebusukan) menjadi *constraint* utama kelayakan pengambilan, dan apakah foto pratinjau sudah cukup untuk menilai hal ini?
- [ ] Siapa yang menanggung biaya transportasi penjemputan — apakah pembudidaya maggot bersedia berkontribusi, atau beban ditanggung bersama?
- [ ] Apakah sistem reward/insentif diperlukan? Jika ya, siapa yang menyediakan/mendanainya?
- [ ] Apakah model bisnis membutuhkan pembayaran dari collector, warung, atau pihak ketiga?
- [ ] Apakah pickup harus memiliki jadwal rutin/berkala, atau selalu bersifat ad-hoc per request?
- [ ] Apakah data lokasi cukup menggunakan koordinat warung, atau dibutuhkan titik jemput terpisah?
- [ ] Apakah routing membutuhkan integrasi external map/routing API (mis. Google Directions, OSRM) untuk jarak riil, atau estimasi jarak lurus (Haversine) cukup untuk MVP?

### 12.2 Assumptions (Hipotesis Kerja MVP)

> Semua item berikut **belum dianggap fakta** sampai divalidasi lapangan.

- Warung siap memilah sisa makanan dari sampah anorganik jika antarmuka aplikasi sederhana.
- Collector memiliki timbangan gantung/portabel saat melakukan pengambilan di lokasi warung.
- Lokasi titik penjemputan mayoritas sama dengan lokasi fisik warung.
- Pengumpulan dari beberapa warung sekaligus (konsolidasi) dapat memberikan efisiensi logistik yang berarti bagi collector.
- Warung bersedia menggunakan sistem digital selama prosesnya mudah dan cepat (< 1 menit per request).

---

## 13. PRD Governance

PRD ini adalah **living document**. Setiap perubahan besar pada problem, target user, business logic, arsitektur, security, scope, atau core feature **harus diperbarui di dokumen ini terlebih dahulu** sebelum AI coding agent mengimplementasikan perubahan tersebut.

**Prioritas keputusan:**

```text
Validated User Evidence
        ↓
Hackathon Requirement
        ↓
PRD
        ↓
Architecture
        ↓
Implementation
```

AI agent tidak boleh membalik urutan tersebut dengan membangun fitur terlebih dahulu lalu mencari alasan bisnis setelahnya.

---

## 14. Change Log

### v1.0 — 2026-08-28 (Merged & Refined)
Menggabungkan dan merapikan PRD v0.1 dan v0.2 menjadi satu dokumen tunggal yang konsisten:
- **Base konten teknis dari v0.2:** Problem Statement diperluas (isu kontaminasi & efisiensi rantai pasok), kategori sampah (`waste_categories`), foto pratinjau & bukti (`sample_photo_url`, `proof_photo_url`), *time window* & *auto-expire*, status lapangan lengkap (`failed`/`expired`), validasi kapasitas routing, dan skema database relasional penuh dipertahankan sebagai standar.
- **Struktur & kedalaman proses dari v0.1 dikembalikan/ditambahkan kembali:** AI Agent Rules diperluas dari 4 menjadi 35 aturan terstruktur (General, Security, Database, Code Quality, Testing, Git); NFR ditambah bagian Usability & Maintainability; Business Rules ditambah sub-bagian Ownership & Access dan aturan penamaan "Recommended Route" vs "optimal"; PRD Governance (prioritas keputusan) ditambahkan kembali karena sebelumnya hilang di v0.2.
- **Open Questions & Assumptions** digabung dan dirapikan dari kedua draft (v0.1 lebih lengkap, v0.2 lebih ringkas) menjadi satu daftar tanpa duplikasi.
- **Scope & Functional Requirements** disatukan mengikuti struktur v0.2 yang lebih matang, dengan tambahan item Edit Pickup Request dari v0.1.
- Menghapus duplikasi penomoran/penamaan bagian dan menyamakan gaya penulisan di seluruh dokumen.

### v0.2 — 2026-08-28 (superseded)
- Penyempurnaan Problem Statement (isu kontaminasi, ketidakpastian jenis, efisiensi rantai pasok).
- Penambahan kategori sampah & foto (`waste_categories`, `sample_photo_url`, `proof_photo_url`).
- Penyempurnaan time window & mekanisme *auto-expire*.
- Penanganan status lapangan lengkap (`failed` + `failure_reason`, `expired`).
- Constraint kapasitas routing pada algoritma rekomendasi rute.
- Normalisasi database relasional lengkap dengan PK, FK, enum, dan indexing guidelines.

### v0.1 — 2026-08-26 (superseded)
- Draft awal PRD: definisi problem dasar, 3 role user, alur pickup inti, routing awal, security dasar, AI agent rules lengkap, PRD governance.

---

*Dokumen ini menggantikan PRD v0.1 dan v0.2. Referensi ke draft sebelumnya sebaiknya diarahkan ke dokumen ini.*
