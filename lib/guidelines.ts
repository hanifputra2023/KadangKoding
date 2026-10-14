export interface CategoryGuideline {
  summary: string
  tips: string[]
  acceptable: string[]
  unacceptable: string[]
}

export const DEFAULT_STANDARDS = [
  { label: 'Kondisi Bahan', value: 'Kering & Kosong', hint: 'Kosongkan sisa kuah/minuman' },
  { label: 'Kompaksi Volume', value: 'Dipadatkan', hint: 'Pipihkan kardus & remas botol' },
  { label: 'Pemisahan Limbah', value: '100% Terpilah', hint: 'Wadah terpisah per jenis limbah' },
]

export const DEFAULT_GUIDE_STEPS = [
  {
    num: 1,
    title: 'Pemisahan di Sumber Warung',
    desc: 'Sediakan tempat terpisah untuk kardus, botol plastik, kaleng, dan jerigen minyak jelantah sejak awal operasional dapur.',
  },
  {
    num: 2,
    title: 'Kosongkan & Tiriskan Sisa Isi',
    desc: 'Pastikan botol atau kaleng bebas dari sisa cairan atau saus agar higienis dan tidak mengundang serangga saat disimpan.',
  },
  {
    num: 3,
    title: 'Kompaksi & Kemas Rapi',
    desc: 'Pipihkan boks kardus dan remas botol plastik guna menghemat volume penyimpanan di warung dan kapasitas kurir.',
  },
  {
    num: 4,
    title: 'Wadah Khusus Minyak Jelantah & B3',
    desc: 'Tampung minyak jelantah dingin dalam jerigen tertutup rapat; simpan baterai dan lampu bekas dalam wadah kering tersendiri.',
  },
  {
    num: 5,
    title: 'Estimasi Berat & Unggah Foto',
    desc: 'Timbang estimasi berat/volume dan cantumkan foto kondisi barang saat membuat permohonan jemput kurir sirkular.',
  },
]

export const DEFAULT_GUIDE_FAQS = [
  {
    q: 'Mengapa minyak jelantah tidak boleh dibuang ke wastafel atau selokan?',
    a: 'Minyak jelantah yang membeku menyumbat saluran pipa (fatberg) dan 1 liter minyak dapat mencemari hingga 1 juta liter air tawar serta membunuh biota perairan. Melalui WarungSirkular, jelantah Anda disalurkan untuk diolah menjadi Biodiesel ramah lingkungan.',
  },
  {
    q: 'Apakah botol plastik harus dicuci bersih menggunakan sabun?',
    a: 'Tidak perlu dicuci dengan sabun. Cukup pastikan sisa cairan manis atau minyak telah dikosongkan dan dibilas sedikit air agar tidak berbau dan mengundang lalat.',
  },
  {
    q: 'Bagaimana cara terbaik mengemas kardus dan kaleng kemasan?',
    a: 'Bongkar bagian bawah kardus dan lipat hingga benar-benar pipih, lalu ikat dengan tali rafia. Untuk kaleng susu atau sarden, bilas sisa saus dan pipihkan bila memungkinkan.',
  },
  {
    q: 'Mengapa limbah B3 domestik (seperti baterai & lampu) wajib dipisahkan khusus?',
    a: 'Baterai dan lampu mengandung zat beracun seperti merkuri, timbal, dan kadmium. Jika dibuang ke tempat sampah biasa dan berakhir di TPA, racun ini dapat merembes merusak kualitas air tanah yang dikonsumsi warga.',
  },
  {
    q: 'Berapa batas minimum berat penjemputan per request?',
    a: 'Minimal estimasi per request adalah 2–3 kg (atau 2–3 liter untuk minyak jelantah) guna menjamin efisiensi rute dan kapasitas kendaraan kurir mitra.',
  },
  {
    q: 'Bagaimana jika kurir menemukan sampah tercampur limbah basah/residu kotor?',
    a: 'Kurir akan memberikan catatan evaluasi pemilahan. Warung mitra diharapkan menjaga kebersihan material agar nilai daur ulangnya optimal dan tetap menjadi prioritas penjemputan.',
  },
]

/**
 * Parsing data pedoman dari field description database.
 * Jika berformat JSON maka diambil secara terstruktur, jika berupa teks biasa
 * maka menghasilkan default pedoman yang disesuaikan secara kontekstual.
 */
export function parseCategoryGuideline(cat: {
  category_name: string
  description?: string | null
  is_maggot_friendly?: boolean
}): CategoryGuideline {
  const raw = cat.description?.trim() || ''

  if (raw.startsWith('{') && raw.endsWith('}')) {
    try {
      const parsed = JSON.parse(raw)
      const summary = typeof parsed.summary === 'string' ? parsed.summary : typeof parsed.desc === 'string' ? parsed.desc : ''
      const tips = Array.isArray(parsed.tips) ? parsed.tips.filter(Boolean) : []
      const acceptable = Array.isArray(parsed.acceptable)
        ? parsed.acceptable.filter(Boolean)
        : Array.isArray(parsed.ok)
        ? parsed.ok.filter(Boolean)
        : []
      const unacceptable = Array.isArray(parsed.unacceptable)
        ? parsed.unacceptable.filter(Boolean)
        : Array.isArray(parsed.no)
        ? parsed.no.filter(Boolean)
        : []

      return {
        summary: summary || getDefaultSummary(cat.category_name),
        tips: tips.length > 0 ? tips : getDefaultTips(cat.category_name, cat.is_maggot_friendly),
        acceptable: acceptable.length > 0 ? acceptable : getDefaultAcceptable(cat.category_name),
        unacceptable: unacceptable.length > 0 ? unacceptable : getDefaultUnacceptable(cat.category_name),
      }
    } catch {
      // JSON parse gagal, gunakan fallback di bawah
    }
  }

  // Teks biasa
  const summary = raw || getDefaultSummary(cat.category_name)
  return {
    summary,
    tips: getDefaultTips(cat.category_name, cat.is_maggot_friendly),
    acceptable: getDefaultAcceptable(cat.category_name),
    unacceptable: getDefaultUnacceptable(cat.category_name),
  }
}

export function serializeCategoryGuideline(guideline: CategoryGuideline): string {
  return JSON.stringify({
    summary: guideline.summary.trim(),
    tips: guideline.tips.filter((t) => t.trim().length > 0),
    acceptable: guideline.acceptable.filter((a) => a.trim().length > 0),
    unacceptable: guideline.unacceptable.filter((u) => u.trim().length > 0),
  })
}

function getDefaultSummary(name: string): string {
  const n = name.toLowerCase()
  if (n.includes('jelantah') || n.includes('minyak') || n.includes('uco')) {
    return 'Minyak sisa penggorengan dapur warung. Pencemar air berat yang disalurkan menjadi bahan baku Biodiesel ramah lingkungan.'
  }
  if (n.includes('kardus') || n.includes('karton') || n.includes('kertas')) {
    return 'Kardus boks kemasan mie, minyak, telur, dan karton duplex yang didaur ulang menjadi bubur kertas pulp baru.'
  }
  if (n.includes('botol') || n.includes('pet') || n.includes('plastik') || n.includes('cup')) {
    return 'Wadah plastik minuman bening (PET/PP) yang dapat didaur ulang menjadi serat tekstil, dakron, dan botol rPET baru.'
  }
  if (n.includes('kaleng') || n.includes('logam') || n.includes('seng') || n.includes('aluminium')) {
    return 'Kemasan kaleng susu, sarden, kornet, dan minuman. Logam sirkular bernilai tinggi yang dapat dilebur ulang 100%.'
  }
  if (n.includes('sachet') || n.includes('kresek') || n.includes('multilayer')) {
    return 'Plastik sachet bumbu dan kantong kresek. Limbah pencemar kritis yang diolah menjadi ecobrick dan aspal plastik.'
  }
  if (n.includes('kaca') || n.includes('beling')) {
    return 'Botol kecap, sirup, saus beling, dan jar kaca selai yang dapat disterilkan untuk reuse atau dilebur ulang.'
  }
  if (n.includes('b3') || n.includes('baterai') || n.includes('lampu')) {
    return 'Limbah B3 domestik berbahaya yang wajib dipisahkan khusus agar racun merkuri/timbal tidak meracuni air tanah warga.'
  }
  return 'Limbah non-organik bernilai daur ulang dan limbah pencemar lingkungan yang wajib dipilah dari sumber warung.'
}

function getDefaultTips(name: string, isRecyclable = true): string[] {
  const n = name.toLowerCase()
  if (n.includes('jelantah') || n.includes('minyak') || n.includes('uco')) {
    return [
      'Tunggu minyak hingga dingin sebelum dituang ke dalam wadah jerigen atau botol tebal',
      'Saring sisa remah makanan atau endapan tepung gosong menggunakan saringan kawat',
      'Tutup rapat jerigen dan simpan di area teduh jauh dari kompor api',
    ]
  }
  if (n.includes('kardus') || n.includes('karton') || n.includes('kertas')) {
    return [
      'Bongkar bagian bawah kardus dan lipat hingga benar-benar pipih',
      'Ikat tumpukan kardus dengan tali rafia agar rapi dan mudah ditimbang kurir',
      'Pastikan kardus tersimpan di tempat kering dan tidak terkena air atau tumpahan kuah',
    ]
  }
  if (n.includes('botol') || n.includes('pet') || n.includes('plastik') || n.includes('cup')) {
    return [
      'Kosongkan sisa cairan hingga tuntas dan bilas sedikit air agar tidak berbau',
      'Remas atau injak botol hingga pipih untuk menghemat volume ruang hingga 70%',
      'Pisahkan tutup botol dan sedotan plastik ke kantong terpisah',
    ]
  }
  if (n.includes('kaleng') || n.includes('logam') || n.includes('seng') || n.includes('aluminium')) {
    return [
      'Bilas sisa susu kental manis atau saus sarden dengan air secukupnya',
      'Hati-hati dengan tepi tajam tutup kaleng saat membersihkan dan mengemas',
      'Tekan atau pipihkan kaleng aluminium jika memungkinkan untuk efisiensi muatan',
    ]
  }
  if (n.includes('sachet') || n.includes('kresek') || n.includes('multilayer')) {
    return [
      'Kumpulkan sachet dalam satu kantong kresek besar dan padatkan',
      'Pastikan kemasan sachet sudah kosong dari sisa pasta saus basah',
      'Pisahkan kresek bersih dari plastik yang terkena minyak pekat',
    ]
  }
  if (n.includes('kaca') || n.includes('beling')) {
    return [
      'Bersihkan dan keringkan sisa isi kecap atau sirup',
      'Simpan botol kaca dalam posisi berdiri di dalam peti atau kardus bersekat',
      'Beri tanda AWAS KACA jika ada botol yang retak/pecah demi keselamatan kurir',
    ]
  }
  if (n.includes('b3') || n.includes('baterai') || n.includes('lampu')) {
    return [
      'Simpan baterai bekas dalam wadah plastik kering tertutup dan jauh dari panas api',
      'Beri selotip pada kutub baterai untuk mencegah percikan korsleting listrik',
      'Jangan memecahkan bohlam neon karena gas uap merkuri di dalamnya beracun jika terhirup',
    ]
  }
  return [
    'Pastikan limbah dalam kondisi kering dan bebas dari sisa makanan basah',
    isRecyclable ? 'Material bernilai daur ulang tinggi untuk sirkularitas industri' : 'Memerlukan penanganan khusus demi perlindungan kelestarian lingkungan',
    'Kemas rapi di titik penjemputan yang mudah dijangkau kurir logistik',
  ]
}

function getDefaultAcceptable(name: string): string[] {
  const n = name.toLowerCase()
  if (n.includes('jelantah') || n.includes('minyak') || n.includes('uco')) {
    return [
      'Minyak goreng bekas gorengan ayam, ikan, tahu, atau tempe',
      'Minyak sisa tumisan yang sudah disaring dari bumbu kasar',
      'Minyak sawit atau kelapa bekas pakai yang sudah berubah warna gelap',
    ]
  }
  if (n.includes('kardus') || n.includes('karton') || n.includes('kertas')) {
    return [
      'Box kardus mie instan, dus minyak goreng, dus biskuit, dan karton telur (egg tray)',
      'Kertas pembungkus coklat dan amplop non-laminasi',
      'Kertas nota dan struk kertas bersih non-residu',
    ]
  }
  if (n.includes('botol') || n.includes('pet') || n.includes('plastik') || n.includes('cup')) {
    return [
      'Botol air mineral, botol teh/soda, dan botol kecap/sirup plastik bening (PET kode 1)',
      'Gelas cup plastik es teh / kopi (PP kode 5)',
      'Galon plastik sekali pakai (PET)',
    ]
  }
  if (n.includes('kaleng') || n.includes('logam') || n.includes('seng') || n.includes('aluminium')) {
    return [
      'Kaleng susu kental manis, kaleng krimer, dan kaleng santan',
      'Kaleng sarden, kornet, dan kaleng jamur/buah',
      'Kaleng minuman bersoda dan teh aluminium',
    ]
  }
  if (n.includes('sachet') || n.includes('kresek') || n.includes('multilayer')) {
    return [
      'Bungkus sachet bumbu penyedap, kecap pouch sachet, bumbu racik, dan kopi sachet',
      'Kantong plastik kresek belanjaan bening atau warna',
      'Plastik bubble wrap dan plastik pembungkus belanjaan',
    ]
  }
  if (n.includes('kaca') || n.includes('beling')) {
    return [
      'Botol kaca kecap manis/asin, saus sambal, dan botol sirup beling',
      'Jar kaca toples makanan atau selai',
      'Botol beling minuman suplemen energi',
    ]
  }
  if (n.includes('b3') || n.includes('baterai') || n.includes('lampu')) {
    return [
      'Baterai bekas timbangan digital, remote TV/AC, jam dinding (AA, AAA, 9V, koin)',
      'Lampu bohlam LED atau lampu neon hemat energi yang sudah mati',
      'Baterai cas / powerbank rusak',
    ]
  }
  return [
    'Material anorganik kering bersih',
    'Kemasan produk bahan baku warung makan yang sudah kosong',
    'Limbah padat non-makanan yang dapat dipadatkan',
  ]
}

function getDefaultUnacceptable(name: string): string[] {
  const n = name.toLowerCase()
  if (n.includes('jelantah') || n.includes('minyak') || n.includes('uco')) {
    return [
      'Minyak yang dicampur air, kuah sayur, atau sabun cuci',
      'Minyak pelumas/oli mesin kendaraan atau zat kimia bengkel',
      'Minyak yang masih dalam kondisi panas mendidih',
    ]
  }
  if (n.includes('kardus') || n.includes('karton') || n.includes('kertas')) {
    return [
      'Kardus basah kuyup, berjamur, atau terkena tumpahan kuah gulai/rendang',
      'Kertas minyak pembungkus nasi yang berlaminasi plastik lengket',
      'Tissue basah atau tissue bekas lap dapur',
    ]
  }
  if (n.includes('botol') || n.includes('pet') || n.includes('plastik') || n.includes('cup')) {
    return [
      'Botol yang masih penuh berisi cairan sisa minuman manis',
      'Botol plastik yang kotor terkena oli mesin, cat, atau pestisida',
      'Wadah plastik mika rapuh atau styrofoam',
    ]
  }
  if (n.includes('kaleng') || n.includes('logam') || n.includes('seng') || n.includes('aluminium')) {
    return [
      'Kaleng aerosol bertekanan tinggi (pengharum ruangan, pembasmi serangga)',
      'Kaleng bekas cat minyak, thinner, atau zat kimia industri',
      'Besi berkarat lapuk atau tercampur jarum dan silet cukur',
    ]
  }
  if (n.includes('sachet') || n.includes('kresek') || n.includes('multilayer')) {
    return [
      'Plastik yang berlumuran oli mesin atau kotoran tanah tebal',
      'Plastik kemasan obat-obatan medis berbahaya atau jarum suntik',
      'Plastik yang hangus atau meleleh bekas dibakar',
    ]
  }
  if (n.includes('kaca') || n.includes('beling')) {
    return [
      'Kaca cermin dan lampu kaca neon (mengandung merkuri)',
      'Pecahan beling berserakan tanpa wadah pengaman',
      'Kaca pyrex tahan panas atau keramik piring pecah',
    ]
  }
  if (n.includes('b3') || n.includes('baterai') || n.includes('lampu')) {
    return [
      'Aki basah mobil/motor bermuatan air keras bocor',
      'Limbah jarum suntik medis atau obat kedaluwarsa beracun',
      'Tabung gas elpiji bocor atau bahan peledak',
    ]
  }
  return [
    'Sisa makanan basi basah atau kuah berminyak yang tidak dipisahkan',
    'Bahan peledak atau zat kimia terlarang',
    'Limbah medis infeksius berbahaya',
  ]
}
