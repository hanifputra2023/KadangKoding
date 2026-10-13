# Rencana Implementasi: Pagination, Filter Lanjutan, & Pencegahan Overload Kapasitas Collector

Dokumen ini menjelaskan langkah perbaikan dan penambahan fitur limit, pagination, filter terstruktur, serta perlindungan kapasitas kendaraan (anti-overload) pada portal **Admin**, **Collector**, dan **Warung**.

---

## 1. Pencegahan Bug Krusial Overload Kapasitas Collector (Zero-Overload Safeguard)

### Masalah Saat Ini:
1. Collector dapat memilih sembarang checkbox di *Available Pickups* hingga berat kumulatif melampaui kapasitas (misal `65.5 / 50 kg`).
2. Jika collector memiliki rute aktif yang sedang berjalan dan belum dibongkar/diselesaikan, muatan lama di kendaraan tidak diperhitungkan ke sisa kapasitas saat mengambil pickup baru.

### Solusi Komprehensif:
1. **Frontend (App Collector):**
   * Menghitung **Muatan Berjalan (Active On-Board Load)** dari rute yang berstatus `active` yang belum selesai (`currentActiveWeight`).
   * Menghitung **Sisa Kapasitas Nyata:** `remainingCapacity = capacity - currentActiveWeight`.
   * Di daftar *Available Pickups*, item yang beratnya `> remainingCapacity - selectedWeight` akan otomatis **ter-disable** dengan label badge *"Melebihi sisa kapasitas"*, sehingga mustahil dipilih.
   * Memberikan indikator status visual kapasitas yang jelas di header antrian:
     `Kapasitas: 50 kg | Muatan Berjalan: 20 kg | Terpilih: 15/30 kg`.
   * Jika kapasitas habis, tampilkan banner peringatan: *"Muatan kendaraan penuh! Selesaikan rute aktif dan bongkar muatan terlebih dahulu."*
2. **Backend API (`/api/collector/route/recommend`):**
   * Menambahkan validasi ketat: `activeRoutesWeight + newSelectedWeight <= vehicle_capacity_kg`. Jika melampaui, return HTTP 400.

---

## 2. Fitur Limit & Pagination

Akan dibuat komponen pagination yang seragam dan elegan (Tombol *Previous*, *Next*, nomor halaman, dan dropdown *Items per page: 5 / 10 / 25*):

1. **Di Portal Admin (`/admin`):**
   * **Pickups Management:** Pagination (default 10 per halaman).
   * **User Directory:** Pagination (default 10 per halaman).
   * **Audit Logs:** Pagination (default 10 per halaman).
   * **Waste Categories & Routes:** Pagination jika data banyak.
2. **Di Portal Collector (`/collector`):**
   * **Available Pickups (Daftar Tersedia):** Pagination (default 6 grid card per halaman).
   * **Riwayat Selesai (Completed / History):** Pagination (default 8 item per halaman).
3. **Di Portal Warung (`/warung`):**
   * **Pickup History (Riwayat Penjemputan):** Pagination (default 6-8 item per halaman).
   * **Recent Pickups:** Limit 4 item terbaru dengan link *"View All"*.

---

## 3. Fitur Filter Lanjutan

1. **Di Portal Admin:**
   * **Filter Pickups:** Status (`All`, `Pending`, `Assigned`, `In Progress`, `Completed`, `Cancelled`), Search ID / Warung / Collector.
   * **Filter Users:** Role (`All`, `Warung`, `Collector`, `Admin`), Status Akun (`Semua`, `Aktif`, `Dinonaktifkan`), Search Nama/Email.
   * **Filter Audit Logs:** Filter modul/aksi, search teks.
2. **Di Portal Collector:**
   * **Filter Pickups:** Kategori sampah (`Semua`, `Organik`, `Maggot`, `Restoran`), Filter Radius Jarak (slider / preset: 5km, 10km, 25km, Semua), Search nama warung / alamat.
3. **Di Portal Warung:**
   * **Filter Riwayat:** Status pickup (`Semua`, `Aktif`, `Selesai`, `Batal`), Pencarian ID / Kategori.

---

## Proposed Changes

### Backend API
#### [MODIFY] [route.ts](file:///c:/xampp/htdocs/Project%20Besar/warungsirkular-app/app/api/collector/route/recommend/route.ts)
* Tambahkan pengecekan muatan rute aktif (`activeRoutesWeight`) pada collector sebelum mengizinkan pembuatan rute baru.

### Komponen & Portal Frontend
#### [MODIFY] [collector/page.tsx](file:///c:/xampp/htdocs/Project%20Besar/warungsirkular-app/app/collector/page.tsx)
* Implementasi pencegahan overload seleksi secara instan (disable item berlebih).
* Tambahkan filter radius, search alamat/toko, dan pagination pada Available & Completed Pickups.

#### [MODIFY] [warung/page.tsx](file:///c:/xampp/htdocs/Project%20Besar/warungsirkular-app/app/warung/page.tsx)
* Tambahkan filter status & pagination di menu Riwayat Penjemputan (*History*).

#### [MODIFY] [admin/page.tsx](file:///c:/xampp/htdocs/Project%20Besar/warungsirkular-app/app/admin/page.tsx)
* Tambahkan pagination & filter terintegrasi di tabel Pickups, Users, dan Audit Logs.

---

## Verification Plan

### Manual & UI Testing:
1. **Uji Overload Kapasitas:**
   - Coba pilih beberapa pickup di Collector sampai mendekati batas kapasitas (misal 45/50 kg).
   - Pastikan item berikutnya yang beratnya > 5 kg tidak bisa dicentang dan ada indikator jelas.
   - Coba buat rute dengan rute aktif berjalan, pastikan sisa kapasitas berkurang sesuai sisa muatan.
2. **Uji Filter & Search:**
   - Coba cari berdasarkan keyword dan filter kategori/status di Admin, Collector, dan Warung.
3. **Uji Pagination:**
   - Pindah antar halaman (Previous / Next / Angka halaman) dan ubah item per page untuk memastikan tampilan rapi dan tidak melompat.
