-- ============================================================
-- WarungSirkular - 0011 (Limbah Non-Organik & Pencemar Lingkungan)
-- Memperbarui master kategori limbah dari organik menjadi
-- anorganik bernilai sirkular tinggi & limbah pencemar lingkungan
-- ============================================================

-- 1) Update kategori lama agar tidak merusak relasi foreign key
UPDATE public.waste_categories
SET category_name = 'Minyak Jelantah (UCO)',
    is_maggot_friendly = TRUE,
    description = '{"summary":"Minyak sisa penggorengan dapur warung. Pencemar air berat yang disalurkan menjadi bahan baku Biodiesel ramah lingkungan.","tips":["Tunggu minyak hingga dingin sebelum dituang ke dalam wadah jerigen atau botol tebal","Saring sisa remah makanan atau endapan tepung gosong menggunakan saringan kawat","Tutup rapat jerigen dan simpan di area teduh jauh dari kompor"],"acceptable":["Minyak goreng bekas gorengan ayam, ikan, tahu, tempe","Minyak sisa tumisan yang sudah disaring dari bumbu kasar","Minyak sawit atau kelapa bekas pakai yang sudah berubah warna gelap"],"unacceptable":["Minyak yang dicampur air, kuah sayur, atau sabun cuci","Minyak pelumas/oli mesin kendaraan atau zat kimia bengkel","Minyak yang masih dalam kondisi panas mendidih"]}'
WHERE category_name IN ('Sisa Nasi/Lauk', 'Minyak Jelantah (UCO)');

UPDATE public.waste_categories
SET category_name = 'Kardus & Karton Kemasan',
    is_maggot_friendly = TRUE,
    description = '{"summary":"Kardus boks bekas mie, minyak, telur, dan karton duplex. Didaur ulang menjadi bubur kertas (pulp) untuk mencegah deforestasi.","tips":["Bongkar bagian bawah kardus dan lipat hingga benar-benar pipih","Ikat tumpukan kardus dengan tali rafia agar rapi dan mudah ditimbang kurir","Pastikan kardus tersimpan di tempat kering dan tidak terkena hujan atau tumpahan kuah"],"acceptable":["Box kardus mie instan, dus minyak goreng, dus biskuit, dan karton telur (egg tray)","Kertas pembungkus coklat dan amplop non-laminasi","Kertas nota dan struk kertas bersih non-residu"],"unacceptable":["Kardus basah kuyup, berjamur, atau terkena tumpahan kuah gulai/rendang","Kertas minyak pembungkus nasi yang berlaminasi plastik lengket","Tissue basah atau tissue bekas lap dapur"]}'
WHERE category_name IN ('Sayur/Buah', 'Kardus & Karton Kemasan');

UPDATE public.waste_categories
SET category_name = 'Botol Plastik PET & Cup',
    is_maggot_friendly = TRUE,
    description = '{"summary":"Wadah plastik minuman bening (PET/PP) yang dapat didaur ulang menjadi serat tekstil, dakron, dan botol rPET baru.","tips":["Kosongkan sisa cairan hingga tuntas dan bilas sedikit air agar tidak berbau","Remas atau injak botol hingga pipih untuk menghemat volume hingga 70%","Pisahkan tutup botol dan sedotan ke kantong terpisah"],"acceptable":["Botol air mineral, botol teh/soda, dan botol kecap/sirup plastik bening (PET kode 1)","Gelas cup plastik es teh / kopi (PP kode 5)","Galon plastik sekali pakai (PET)"],"unacceptable":["Botol yang masih penuh berisi cairan sisa minuman manis","Botol plastik yang kotor terkena oli mesin, cat, atau pestisida","Wadah plastik mika rapuh atau styrofoam"]}'
WHERE category_name IN ('Campuran', 'Botol Plastik PET & Cup');

UPDATE public.waste_categories
SET category_name = 'Kaleng Seng & Logam',
    is_maggot_friendly = TRUE,
    description = '{"summary":"Kemasan kaleng susu kental manis, sarden, kornet, dan minuman. Logam sirkular bernilai tinggi yang dapat dilebur ulang 100%.","tips":["Bilas sisa susu kental atau saus sarden dengan air secukupnya","Hati-hati dengan tepi tajam tutup kaleng saat membersihkan","Tekan atau pipihkan kaleng aluminium jika memungkinkan"],"acceptable":["Kaleng susu kental manis, kaleng krimer, dan kaleng santan","Kaleng sarden, kornet, dan kaleng jamur/buah","Kaleng minuman bersoda dan teh aluminium"],"unacceptable":["Kaleng aerosol bertekanan tinggi (pengharum ruangan, pembasmi serangga)","Kaleng bekas cat minyak, thinner, atau zat kimia industri","Besi berkarat lapuk atau tercampur jarum dan silet cukur"]}'
WHERE category_name IN ('Makanan Basi Cair', 'Kaleng Seng & Logam');

-- 2) Tambah kategori limbah pencemar & daur ulang baru jika belum ada
INSERT INTO public.waste_categories (category_name, is_maggot_friendly, description)
SELECT 'Plastik Sachet & Kresek (Multilayer)', TRUE,
       '{"summary":"Plastik sachet bumbu, pouch saus/kecap, dan kantong kresek. Limbah pencemar lingkungan kritis yang diolah menjadi ecobrick & aspal plastik.","tips":["Kumpulkan sachet dalam satu kantong kresek besar dan padatkan","Pastikan kemasan sachet sudah kosong dari sisa pasta/saus basah","Pisahkan kresek bersih dari plastik yang berminyak pekat"],"acceptable":["Bungkus sachet bumbu penyedap, kecap pouch sachet, bumbu racik, dan kopi sachet","Kantong plastik kresek belanjaan bening atau warna","Plastik bubble wrap dan plastik pembungkus belanjaan"],"unacceptable":["Plastik yang berlumuran oli mesin atau kotoran tanah tebal","Plastik kemasan obat-obatan medis berbahaya atau jarum suntik","Plastik yang hangus atau meleleh bekas dibakar"]}'
WHERE NOT EXISTS (SELECT 1 FROM public.waste_categories WHERE category_name = 'Plastik Sachet & Kresek (Multilayer)');

INSERT INTO public.waste_categories (category_name, is_maggot_friendly, description)
SELECT 'Botol Kaca & Pecah Belah', TRUE,
       '{"summary":"Botol kecap, sirup, saus beling, dan jar kaca. Kaca butuh 1 juta tahun terurai di alam sehingga harus digunakan kembali atau dilebur ulang.","tips":["Bersihkan dan keringkan sisa isi kecap/sirup","Simpan botol kaca dalam posisi berdiri di dalam peti/kardus dengan sekat","Beri label AWAS KACA jika ada pecahan agar tidak mencelakai kurir"],"acceptable":["Botol kaca kecap manis/asin, saus sambal, dan botol sirup beling","Jar kaca toples makanan atau selai","Botol beling minuman suplemen energi"],"unacceptable":["Kaca cermin dan lampu kaca neon (mengandung merkuri)","Pecahan beling berserakan tanpa wadah pengaman","Kaca pyrex tahan panas atau keramik piring pecah"]}'
WHERE NOT EXISTS (SELECT 1 FROM public.waste_categories WHERE category_name = 'Botol Kaca & Pecah Belah');

INSERT INTO public.waste_categories (category_name, is_maggot_friendly, description)
SELECT 'Limbah B3 Domestik (Baterai & Lampu)', FALSE,
       '{"summary":"Limbah Bahan Berbahaya & Beracun (B3) warung makan seperti baterai timbangan dan lampu neon mati. Wajib dipisahkan agar tidak meracuni air tanah.","tips":["Simpan baterai bekas dalam wadah plastik kering tertutup","Beri isolasi/selotip pada kutub baterai untuk mencegah korsleting","Jangan memecahkan bohlam neon karena gas uap merkuri di dalamnya beracun jika terhirup"],"acceptable":["Baterai bekas timbangan digital, remote TV/AC, jam dinding (AA, AAA, 9V, koin)","Lampu bohlam LED atau lampu neon hemat energi yang sudah mati","Baterai cas / powerbank rusak"],"unacceptable":["Aki basah mobil/motor bermuatan air keras bocor","Limbah jarum suntik medis atau obat kedaluwarsa beracun","Tabung gas elpiji bocor atau bahan peledak"]}'
WHERE NOT EXISTS (SELECT 1 FROM public.waste_categories WHERE category_name = 'Limbah B3 Domestik (Baterai & Lampu)');

-- Verifikasi hasil
SELECT id, category_name, is_maggot_friendly FROM public.waste_categories ORDER BY category_name;
