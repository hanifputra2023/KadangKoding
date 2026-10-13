# PRD: WarungSirkular

> **Status:** Draft v0.1  
> **Project:** Hackathon JOINTS 2026  
> **Category:** Sustainability  
> **Product Type:** B2B Micro-Logistics Platform  
> **Document Status:** Living Document  
> **Last Updated:** 2026-08-26

---

## 1. Problem Statement

Warung makan menghasilkan sisa makanan dan bahan organik yang perlu dikelola. Di sisi lain, pembudidaya maggot atau pihak lain yang dapat memanfaatkan bahan organik membutuhkan pasokan yang sesuai dan dapat diperoleh secara konsisten.

Saat ini, proses mempertemukan sumber bahan organik dengan pihak yang membutuhkan serta mengatur proses pengambilannya belum tentu terkoordinasi dengan baik.

**WarungSirkular** dirancang sebagai platform yang membantu mengoordinasikan permintaan pengambilan bahan organik dari beberapa warung dengan pihak pengambil/pemanfaat bahan organik.

> **Catatan validasi:**  
> Besarnya volume sampah organik per warung, kebutuhan aktual pihak penerima, willingness to participate, dan kondisi proses pengambilan saat ini masih harus divalidasi melalui wawancara lapangan.

---

## 2. Goals & Success Metrics

### Product Goals

- Membantu warung melaporkan bahan organik yang siap diambil dengan proses yang sederhana.
- Membantu pihak pengambil melihat permintaan pickup yang tersedia.
- Membantu menentukan urutan pickup berdasarkan lokasi dan kondisi pickup.
- Mencatat jumlah bahan organik yang benar-benar berhasil dikumpulkan.
- Menyediakan data yang dapat menunjukkan dampak penggunaan platform.

### Hackathon MVP Goals

MVP harus mampu mendemonstrasikan alur utama:

```text
Warung membuat pickup request
        ↓
Request masuk ke sistem
        ↓
Collector melihat pickup yang tersedia
        ↓
Sistem menghasilkan rekomendasi rute
        ↓
Collector melakukan pickup
        ↓
Berat aktual dicatat
        ↓
Status pickup selesai
        ↓
Dampak tercatat
```

### Success Metrics

Target awal MVP:

- User dapat membuat pickup request dalam waktu kurang dari 1 menit.
- Collector dapat melihat seluruh pickup yang tersedia dalam satu area.
- Sistem dapat menghasilkan rute pickup berdasarkan data pickup aktif.
- Berat aktual hasil pickup dapat dicatat dan dibandingkan dengan estimasi awal.
- Setiap pickup memiliki status yang jelas: `pending`, `assigned`, `in_progress`, `completed`, atau `cancelled`.
- Sistem dapat menghitung total berat bahan organik yang berhasil dikumpulkan.

> **Catatan:** angka target dan metrik bisnis akan direvisi setelah validasi user.

---

## 3. Target Users

### 3.1 End User — Warung

Pemilik atau pengelola warung yang memiliki bahan organik yang ingin disalurkan.

Kebutuhan utama:

- Melaporkan bahan organik yang tersedia.
- Menentukan estimasi berat.
- Menentukan waktu/ketersediaan pickup.
- Melihat status pickup.
- Melihat riwayat pickup.

---

### 3.2 End User — Collector / Pemanfaat

Pihak yang mengambil bahan organik dari warung, misalnya pembudidaya maggot atau mitra pengelola bahan organik.

Kebutuhan utama:

- Melihat pickup yang tersedia.
- Melihat lokasi pickup.
- Melihat estimasi berat.
- Mendapatkan rekomendasi urutan pickup.
- Memperbarui status pickup.
- Mencatat berat aktual.

> **Catatan:** identitas dan model operasional "collector" masih merupakan hipotesis dan perlu divalidasi.

---

### 3.3 Admin / Stakeholder

Pihak yang mengelola sistem dan memantau aktivitas platform.

Kebutuhan utama:

- Memantau user.
- Memantau pickup.
- Melihat data bahan organik yang terkumpul.
- Mengelola data operasional yang diperlukan.
- Memantau aktivitas yang mencurigakan.

---

### 3.4 AI / Developer

AI coding agent dan developer tim yang membangun serta memelihara aplikasi.

AI/dev harus menggunakan PRD ini sebagai sumber utama requirement.

AI/dev **tidak boleh menganggap asumsi sebagai fakta**.

---

## 4. User Stories & Acceptance Criteria

### 4.1 Warung — Membuat Pickup Request

**User Story**

> Sebagai pemilik warung, aku ingin melaporkan bahan organik yang siap diambil supaya pihak pengambil mengetahui bahwa ada bahan yang tersedia.

**Acceptance Criteria**

- User harus login.
- User dapat memasukkan estimasi berat.
- User dapat memilih waktu/ketersediaan pickup.
- Lokasi pickup harus tersedia.
- Sistem melakukan validasi input.
- Request tersimpan dengan status `pending`.
- User mendapatkan konfirmasi bahwa request berhasil dibuat.

---

### 4.2 Warung — Melihat Status Pickup

**User Story**

> Sebagai pemilik warung, aku ingin melihat status pickup supaya aku tahu apakah bahan organikku sudah dijadwalkan atau diambil.

**Acceptance Criteria**

Status minimal:

```text
Pending
Assigned
In Progress
Completed
Cancelled
```

User hanya dapat melihat pickup yang berkaitan dengan akunnya.

---

### 4.3 Collector — Melihat Pickup Aktif

**User Story**

> Sebagai collector, aku ingin melihat pickup yang tersedia supaya aku dapat menentukan pickup yang perlu dilakukan.

**Acceptance Criteria**

- Collector harus login.
- Hanya pickup aktif yang ditampilkan.
- Informasi minimal:
  - lokasi
  - estimasi berat
  - waktu pickup
  - status
- Collector dapat memilih pickup yang ingin ditangani.

---

### 4.4 Collector — Mendapatkan Rekomendasi Rute

**User Story**

> Sebagai collector, aku ingin mendapatkan urutan pickup yang direkomendasikan supaya perjalanan pengambilan dapat dilakukan secara lebih efisien.

**Acceptance Criteria**

- Sistem menerima kumpulan pickup aktif.
- Sistem mempertimbangkan lokasi pickup.
- Sistem menghasilkan urutan pickup.
- Total jarak rute dapat ditampilkan.
- Sistem tidak mengklaim rute sebagai "optimal" jika algoritma hanya menghasilkan pendekatan/heuristik.

---

### 4.5 Collector — Mencatat Pickup

**User Story**

> Sebagai collector, aku ingin mencatat berat bahan yang benar-benar diambil supaya data pickup sesuai dengan kondisi di lapangan.

**Acceptance Criteria**

- Collector dapat memasukkan berat aktual.
- Berat aktual harus divalidasi.
- Data pickup tidak dapat dinyatakan `completed` tanpa berat aktual.
- Sistem menyimpan waktu penyelesaian.
- Berat aktual digunakan untuk perhitungan dampak.

---

### 4.6 Admin — Memantau Aktivitas

**User Story**

> Sebagai admin, aku ingin melihat aktivitas pickup supaya aku dapat memantau operasional platform.

**Acceptance Criteria**

- Admin dapat melihat daftar pickup.
- Admin dapat memfilter berdasarkan status.
- Admin dapat melihat detail pickup.
- Admin tidak dapat melihat atau mengubah password user.
- Aktivitas penting dicatat dalam audit log.

---

## 5. Functional Requirements

### Authentication & Authorization

- [ ] User registration/login.
- [ ] Role-based access control.
- [ ] Role minimal:
  - `warung`
  - `collector`
  - `admin`
- [ ] User hanya dapat mengakses resource sesuai role.
- [ ] Session/token harus dikelola dengan aman.
- [ ] Logout harus membatalkan sesi sesuai mekanisme authentication yang digunakan.

### Warung

- [ ] Membuat pickup request.
- [ ] Mengubah pickup request selama masih diperbolehkan.
- [ ] Membatalkan pickup sesuai business rules.
- [ ] Melihat status pickup.
- [ ] Melihat riwayat pickup.

### Collector

- [ ] Melihat pickup aktif.
- [ ] Mengambil/assign pickup.
- [ ] Melihat detail pickup.
- [ ] Melihat rekomendasi rute.
- [ ] Mengubah status pickup.
- [ ] Memasukkan berat aktual.
- [ ] Menyelesaikan pickup.

### Routing

- [ ] Menerima daftar lokasi pickup.
- [ ] Menghasilkan urutan pickup.
- [ ] Menghitung total jarak rute.
- [ ] Menampilkan hasil rute pada interface.
- [ ] Menyediakan baseline untuk membandingkan rute sebelum dan sesudah optimasi.

> **Catatan teknis:** pendekatan algoritma belum dikunci pada PRD v0.1. Kandidat seperti heuristik nearest-neighbor/Greedy dapat dipertimbangkan setelah constraint routing ditentukan.

### Admin

- [ ] Melihat user.
- [ ] Melihat pickup.
- [ ] Filter pickup berdasarkan status.
- [ ] Melihat statistik operasional.
- [ ] Melihat audit log.

### Impact Tracking

- [ ] Menghitung total berat bahan organik yang berhasil dikumpulkan.
- [ ] Menampilkan jumlah pickup selesai.
- [ ] Menampilkan jumlah warung aktif.
- [ ] Menampilkan metrik dampak pada dashboard.

---

## 6. Non-Functional Requirements

### Performance

- Halaman utama MVP ditargetkan dapat dimuat dalam < 2 detik pada kondisi jaringan yang wajar.
- Aksi CRUD utama ditargetkan mendapatkan respons < 1 detik pada kondisi normal.
- Routing harus menghasilkan hasil dalam waktu yang cukup singkat untuk kebutuhan demo dan penggunaan normal.

### Security

- Authentication wajib untuk area yang membutuhkan akun.
- Authorization harus diterapkan di server/backend, bukan hanya disembunyikan di frontend.
- Semua input dari client dianggap **untrusted input**.
- Input harus divalidasi dan disanitasi sesuai konteks.
- Password tidak boleh disimpan dalam plaintext.
- Secret/API key tidak boleh disimpan di source code atau repository.
- Environment variable digunakan untuk secret.
- Database harus menggunakan access policy yang sesuai.
- User tidak boleh dapat mengakses atau memodifikasi data milik user lain hanya dengan memanipulasi ID/resource.
- Endpoint sensitif harus memiliki authorization check.
- Error response tidak boleh membocorkan secret, stack trace sensitif, atau informasi internal.
- Dependency yang digunakan harus memiliki lisensi yang sesuai.
- Perubahan schema database harus dilakukan melalui migration yang terdokumentasi.

### Reliability

- Sistem harus menangani kegagalan API secara graceful.
- Status pickup tidak boleh berubah secara tidak konsisten akibat request berulang.
- Operasi penting harus memiliki validasi server-side.
- Data pickup yang sudah selesai tidak boleh diubah sembarangan.

### Usability

- User baru harus dapat memahami cara membuat pickup tanpa tutorial panjang.
- Flow utama harus sederhana.
- Status pickup harus mudah dipahami.
- Informasi penting tidak boleh hanya disampaikan melalui warna.

### Maintainability

- Kode menggunakan struktur yang konsisten.
- Business logic tidak ditempatkan seluruhnya di UI.
- API contract harus terdokumentasi.
- README harus menjelaskan setup project.
- Tidak boleh ada hardcoded secret.
- Komponen/fungsi yang digunakan berulang harus dapat digunakan kembali.

---

## 7. Scope

### In Scope — MVP

#### Warung

- Authentication.
- Dashboard sederhana.
- Membuat pickup request.
- Estimasi berat.
- Lokasi pickup.
- Status pickup.
- Riwayat pickup.

#### Collector

- Dashboard pickup.
- Melihat pickup aktif.
- Memilih/assign pickup.
- Rekomendasi rute.
- Melihat total jarak.
- Update status.
- Input berat aktual.

#### Admin

- Dashboard monitoring.
- Daftar user.
- Daftar pickup.
- Statistik dasar.
- Audit log dasar.

#### Core Technology

- Database.
- Authentication.
- API/backend.
- Routing engine/algorithm.
- Interactive map.
- Basic analytics.

---

### Out of Scope — v0.1

Fitur berikut **tidak boleh dibuat oleh AI agent kecuali secara eksplisit ditambahkan ke PRD**:

- Marketplace bahan pangan.
- Sistem voucher.
- Sistem poin/reward kompleks.
- Payment gateway.
- Chat antar user.
- Push notification.
- Rating/review.
- Multi-city operation.
- Dynamic pricing.
- Advanced AI prediction.
- Native mobile application.
- Fleet management kompleks.
- Integrasi perangkat IoT.
- Automatic weight detection.

> **Catatan:** reward system masih berupa hipotesis. Jangan membangun sistem reward hanya karena konsep awal menyebutkannya. Keputusan akan dibuat setelah validasi user.

---

# 8. Business Rules

Bagian ini merupakan tambahan khusus untuk menjaga konsistensi implementasi.

### Pickup

- Pickup hanya dapat dibuat oleh user dengan role `warung`.
- Pickup harus memiliki lokasi.
- Pickup harus memiliki estimasi berat > 0.
- Pickup yang sudah `completed` tidak boleh kembali menjadi `pending`.
- Berat aktual menjadi sumber data untuk metrik dampak.
- Collector tidak boleh menyelesaikan pickup yang tidak ditugaskan kepadanya.

### Ownership

- Warung hanya dapat melihat dan mengubah pickup miliknya sesuai status yang diizinkan.
- Collector hanya dapat mengakses pickup yang ditugaskan/tersedia untuknya.
- Admin memiliki akses operasional sesuai permission.

### Routing

- Routing bekerja berdasarkan pickup yang memenuhi kondisi untuk dimasukkan ke rute.
- Sistem harus menjelaskan constraint yang digunakan.
- "Optimal" hanya boleh digunakan jika terdapat dasar pengukuran yang sesuai.
- Jika menggunakan heuristik, UI/dokumentasi harus menyebutnya sebagai **recommended route** atau istilah setara.

---

# 9. Data Model — Initial

Model awal yang dipertimbangkan:

```text
User
├── id
├── name
├── email
├── role
├── created_at
└── updated_at

WarungProfile
├── id
├── user_id
├── business_name
├── address
├── latitude
└── longitude

CollectorProfile
├── id
├── user_id
├── name
├── capacity
└── service_area

PickupRequest
├── id
├── warung_id
├── collector_id
├── estimated_weight
├── actual_weight
├── latitude
├── longitude
├── pickup_time
├── status
├── created_at
├── assigned_at
└── completed_at

Route
├── id
├── collector_id
├── total_distance
├── status
└── created_at

RouteStop
├── id
├── route_id
├── pickup_request_id
└── sequence

AuditLog
├── id
├── user_id
├── action
├── resource_type
├── resource_id
├── metadata
└── created_at
```

> **Status:** Draft. Schema final harus mengikuti kebutuhan hasil validasi dan implementasi.

---

# 10. AI Agent Rules

AI coding agent harus mengikuti aturan berikut.

## General

1. PRD ini adalah **source of truth** untuk requirement.
2. Jangan membuat fitur yang tidak tercantum dalam scope tanpa persetujuan.
3. Jangan mengubah business rules tanpa menjelaskan perubahan.
4. Jika requirement ambigu dan berdampak pada architecture/security/data, **STOP dan tanyakan terlebih dahulu**.
5. Jangan menganggap assumption sebagai fakta.
6. Jangan menghapus requirement hanya karena lebih mudah diimplementasikan.

## Security

7. Jangan pernah hardcode API key, password, token, atau secret.
8. Jangan menonaktifkan authentication/authorization untuk "sementara" tanpa persetujuan eksplisit.
9. Jangan mempercayai data dari frontend.
10. Semua input user harus divalidasi di server/backend.
11. Jangan membuat endpoint yang memungkinkan user mengakses resource milik user lain.
12. Jangan menggunakan `user_id` dari request body sebagai satu-satunya dasar authorization.
13. Jangan mengekspos stack trace atau secret dalam response production.
14. Jangan menggunakan `dangerouslySetInnerHTML` atau mekanisme HTML injection serupa tanpa alasan yang tervalidasi.
15. Jangan membuat SQL/query yang rentan injection.
16. Jangan menyimpan password plaintext.
17. Jangan commit file `.env` atau secret ke Git.
18. Gunakan dependency yang terawat dan memiliki lisensi yang sesuai.

## Database

19. Jangan mengubah database schema secara manual tanpa migration.
20. Jangan menghapus data menggunakan destructive query tanpa konfirmasi.
21. Semua relasi dan ownership harus divalidasi.
22. Database access policy harus mengikuti role dan ownership user.

## Code Quality

23. Jangan membuat duplicate implementation jika abstraction yang sesuai sudah tersedia.
24. Jangan memasukkan business logic kompleks langsung ke UI component.
25. Error handling harus eksplisit.
26. Jangan menggunakan `any` secara berlebihan hanya untuk menghilangkan TypeScript error.
27. Jangan menambahkan dependency hanya untuk menyelesaikan masalah sederhana.
28. Setelah perubahan signifikan, update dokumentasi yang relevan.

## Testing

29. Setiap fitur kritis harus memiliki minimal happy-path test.
30. Test juga harus mencakup invalid input dan unauthorized access.
31. Sebelum menyatakan task selesai, jalankan lint/typecheck/test yang tersedia.
32. Jangan menyatakan fitur "working" jika hanya berhasil pada happy path.

## Git

33. Commit harus menjelaskan perubahan.
34. Jangan melakukan force push atau destructive Git operation tanpa persetujuan.
35. Jangan menghapus branch/commit untuk "membersihkan" history tanpa persetujuan.
36. Jangan memasukkan secret atau credential ke repository.

---

# 11. Technical Constraints

- Frontend: **TBD**
- Backend: **TBD**
- Database: **TBD**
- Authentication: **TBD**
- Map provider: **TBD**
- Routing engine: **TBD**
- Deployment: **TBD**

Technology selection harus mempertimbangkan:

- kemampuan tim;
- waktu hackathon;
- maintainability;
- security;
- API availability;
- cost;
- license;
- kemudahan deployment.

AI agent tidak boleh mengganti stack utama tanpa persetujuan tim.

---

# 12. Open Questions & Assumptions

## Open Questions

- [ ] Berapa rata-rata bahan organik yang benar-benar dihasilkan warung target?
- [ ] Bagaimana warung mengelola sisa makanan saat ini?
- [ ] Apakah warung bersedia memilah bahan organik?
- [ ] Apakah warung membutuhkan pickup eksternal?
- [ ] Siapa pihak yang paling realistis menjadi collector?
- [ ] Berapa kebutuhan bahan organik collector/maggot farmer?
- [ ] Apakah kualitas bahan menjadi constraint utama?
- [ ] Siapa yang menanggung biaya transportasi?
- [ ] Apakah reward diperlukan?
- [ ] Jika reward diperlukan, siapa yang menyediakan/mendanainya?
- [ ] Apakah model bisnis membutuhkan pembayaran dari collector, warung, atau pihak ketiga?
- [ ] Constraint kendaraan apa yang perlu dimasukkan ke routing?
- [ ] Apakah pickup harus memiliki jadwal tertentu?
- [ ] Apakah data lokasi cukup menggunakan koordinat warung?
- [ ] Apakah routing membutuhkan external map/routing API?

## Assumptions

> Semua item berikut **belum dianggap fakta** sampai divalidasi.

- Warung memiliki bahan organik yang dapat disalurkan.
- Collector membutuhkan pasokan bahan organik.
- Pengumpulan dari beberapa warung dapat memberikan efisiensi logistik.
- Warung bersedia menggunakan sistem digital jika prosesnya mudah.
- Data lokasi dapat digunakan untuk membantu menentukan rute.

---

# 13. Change Log

### v0.1 — 2026-08-26

Initial PRD draft.

- Mendefinisikan problem awal.
- Mendefinisikan tiga role utama user.
- Mendefinisikan core pickup flow.
- Mendefinisikan routing sebagai core technical feature.
- Menambahkan security requirements.
- Menambahkan AI coding agent rules.
- Menandai reward system sebagai hypothesis.
- Menambahkan open questions untuk validasi lapangan.

---

## PRD Governance

PRD ini adalah **living document**.

Setiap perubahan besar pada:

- problem;
- target user;
- business logic;
- architecture;
- security;
- scope;
- core feature;

harus diperbarui di dokumen ini sebelum AI coding agent mengimplementasikan perubahan tersebut.

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