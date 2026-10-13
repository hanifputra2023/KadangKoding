# Tutorial: Mengaktifkan Realtime Supabase (WarungSirkular)

Panduan ini menjelaskan langkah-langkah untuk mengaktifkan **Realtime** Supabase di project
**WarungSirkular**, sehingga halaman warung menampilkan `Jendela Waktu` yang **auto-update**
tanpa perlu refresh manual saat collector mengubah jadwal layanan atau saat pickup baru masuk.

Project: `https://uzokxpyxlgfubgxbmqqx.supabase.co`

> Buka [Supabase Dashboard](https://supabase.com/dashboard) → klik project kamu →
> menu kiri **SQL Editor** → tempel perintah → klik **Run**.

---

## Persiapan

- Pastikan project sudah di-*link* dengan kode ini.
- Pastikan `npm run dev` berjalan di `warungsirkular-app` (server lokal aktif).
- Login Supabase Dashboard dengan akun pemilik project.

---

## Langkah 1 — Aktifkan jadwal collector (migrasi `0006`)

Fitur `Jendela Waktu` dinamis butuh 3 kolom tambahan pada tabel `collector_profiles`.
Tempel di SQL Editor lalu **Run**:

```sql
alter table public.collector_profiles
  add column if not exists service_start         text not null default '07:00',
  add column if not exists service_end           text not null default '17:00',
  add column if not exists max_pickups_per_slot  int  not null default 5;
```

**Penjelasan kolom:**
| Kolom | Tipe | Default | Fungsi |
|---|---|---|---|
| `service_start` | `text` (HH:MM, 24 jam) | `07:00` | Jam mulai layanan collector |
| `service_end` | `text` (HH:MM, 24 jam) | `17:00` | Jam selesai layanan collector |
| `max_pickups_per_slot` | `int` | `5` | Maksimum pickup per slot waktu (2 jam) |

Verifikasi kolom sudah ada:

```sql
select user_id, service_start, service_end, max_pickups_per_slot
from public.collector_profiles;
```

---

## Langkah 2 — Daftarkan tabel ke Realtime publication

Realtime hanya memantau tabel yang sudah masuk **publication** `supabase_realtime`.

### 2a. Tandai semua tabel agar direplikasi (REPLICA IDENTITY FULL)

```sql
alter table public.pickup_requests      replica identity full;
alter table public.collector_profiles   replica identity full;
alter table public.warung_profiles      replica identity full;
alter table public.routes               replica identity full;
alter table public.route_stops          replica identity full;
alter table public.users                replica identity full;
alter table public.waste_categories     replica identity full;
alter table public.audit_logs           replica identity full;
```

### 2b. Tambahkan ke publication (idempoten, aman diulang)

Blok `DO` di bawah otomatis mengecek dulu, jadi aman dijalankan berkali-kali untuk semua tabel:

```sql
do $$
declare
  t text;
  tables text[] := array[
    'pickup_requests', 'collector_profiles', 'warung_profiles',
    'routes', 'route_stops', 'users', 'waste_categories', 'audit_logs'
  ];
begin
  foreach t in array tables loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
```

Verifikasi tabel sudah masuk publication:

```sql
select schemaname, tablename
from pg_publication_tables
where pubname = 'supabase_realtime'
order by tablename;
```


---

## Langkah 3 — Pastikan RLS & grant tidak memblokir event

Realtime membaca data **dengan RLS dari sisi client yang subscribe** (mis. warung yang login).
Kalau RLS/grant salah, WebSocket bisa tersambung (`SUBSCRIBED`) tapi **tidak ada event yang sampai**.

### 3a. Cek policy SELECT tiap tabel

```sql
select tablename, policyname, cmd, roles
from pg_policies
where schemaname = 'public'
  and tablename in ('pickup_requests', 'collector_profiles', 'routes', 'route_stops')
order by tablename, cmd;
```

Jika `collector_profiles` tidak punya policy `SELECT` untuk `authenticated`, buat:

```sql
drop policy if exists "realtime_select_all_authed" on public.collector_profiles;
create policy "realtime_select_all_authed"
  on public.collector_profiles for select
  to authenticated
  using (true);
```

**Penting — `pickup_requests`:** tabel ini **WAJIB** punya policy `SELECT`, kalau tidak event
realtime `pickup_requests` tidak akan pernah sampai ke browser (WebSocket connect tapi tak ada
event). Pastikan policy `pickup_read` ada dengan menjalankan:

```sql
drop policy if exists "pickup_read" on public.pickup_requests;
create policy "pickup_read" on public.pickup_requests
  for select using (
    (select exists (select 1 from public.warung_profiles w
                    where w.id = pickup_requests.warung_id and w.user_id = auth.uid())) or
    (select exists (select 1 from public.collector_profiles c
                    where c.id = pickup_requests.collector_id and c.user_id = auth.uid())) or
    pickup_requests.status = 'pending' or
    public.is_admin()
  );
```

> Catatan: `routes` & `route_stops` punya policy SELECT terbatas (hanya pemilik). Itu wajar
> dan tidak memengaruhi fitur "jendela waktu", yang bergantung pada `collector_profiles`
> dan `pickup_requests`.

### 3b. Catatan: role `supabase_realtime` (lewati)

Di beberapa versi Supabase ada instruksi `GRANT SELECT ... TO supabase_realtime`. **Di project ini
role tersebut tidak ada** — jika kamu jalankan akan muncul error:

```
ERROR: 42704: role "supabase_realtime" does not exist
```

**Abaikan / lewati langkah grant ini.** Project ini tidak memakai role tersebut, jadi tidak perlu
dibuat. Yang penting hanyalah:
- Tabel masuk publication `supabase_realtime` (Langkah 2) ✅ dan
- policy `SELECT` untuk `authenticated` (Langkah 3a).

Setelah 3a, lanjut ke Langkah 4.

---

## Langkah 4 — Uji real-time

1. Pastikan semua langkah 1–3 selesai.
2. Buka **dua tab** browser:
   - Tab A → login sebagai **Warung**.
   - Tab B → login sebagai **Collector**.
3. Di Tab B (collector): buka **Atur Jadwal Layanan**, ubah jam mulai/selesai → **Simpan**.
4. Di Tab A (warung): perhatikan halaman `Jendela Waktu` — **harus berubah otomatis tanpa refresh**.
5. Alternatif: buat pickup baru di warung → slot-nya langsung tampak terpakai di tab warung lain
   (dan di collector) tanpa reload.

---

## Troubleshooting

### A. Cek status subscription di Console/Network browser
1. Buka halaman warung → **F12 → Console**.
2. Cek ada WebSocket ke `wss://...supabase.co/realtime/v1`.
3. Jika muncul `SUBSCRIBED`, koneksi berhasil.
4. Ubah data di collector → cek apakah muncul event/re-fetch di konsol tab warung.

### B. Tabel belum jadi anggota publication
```sql
select schemaname, tablename
from pg_publication_tables
where pubname = 'supabase_realtime'
order by tablename;
```
Pastikan keempat tabel ada di daftar.

### C. Policy SELECT belum benar di `collector_profiles`
```sql
select tablename, policyname, cmd, roles
from pg_policies
where schemaname = 'public' and tablename = 'collector_profiles';
```
Harus ada baris `cmd = SELECT` dengan roles `{authenticated}`.

### D. Role `supabase_realtime` tidak ada
Jika muncul `42704: role "supabase_realtime" does not exist`, **abaikan** — role ini tidak
dipakai di project ini. Jangan buat role / jangan jalankan grant. Lanjutkan ke pemeriksaan
policy SELECT (bagian C).

### E. Data diubah oleh akun yang sama
Pastikan tab warung dan tab collector **login sebagai akun berbeda**, dan keduanya
terautentikasi (bukan di halaman login). Realtime antar peran baru terlihat dengan 2 akun.

### F. Error `42710 relation already member of publication`
Ini **bukan** masalah — artinya tabel sudah masuk publication. Gunakan blok `DO` pada
Langkah 2b (idempoten) agar aman dijalankan ulang.

### G. Error `42P01 relation "supabase_realtime.subscription" does not exist`
Project ini tidak punya skema `supabase_realtime`. Jangan pakai `INSERT INTO
supabase_realtime.subscription`. Cukup ikuti Langkah 2 (publication).

---

## Ringkasan alur

```
Migrasi 0006 (kolom jadwal)
        │
        ▼
Replica Identity FULL + masuk publication supabase_realtime
        │
        ▼
Policy SELECT (authenticated) untuk tabel yg di-subscribe
        │
        ▼
WebSocket subscribe di browser (useRealtimeTables)
        │
        ▼
Event postgres_changes → re-fetch → Jendela Waktu auto-update
```
