export interface CategoryGuideline {
  summary: string
  tips: string[]
  acceptable: string[]
  unacceptable: string[]
}

export const DEFAULT_STANDARDS = [
  { label: 'Kadar Air', value: '<70%', hint: 'Tiriskan sebelum dikemas' },
  { label: 'Kontaminan', value: '0%', hint: 'Bebas plastik & kawat' },
  { label: 'Ukuran Potongan', value: '≤5 cm', hint: 'Mempercepat biokonversi' },
]

export const DEFAULT_GUIDE_STEPS = [
  {
    num: 1,
    title: 'Pemisahan di Sumber Dapur',
    desc: 'Sediakan wadah terpisah khusus sampah organik sejak awal proses memasak di dapur warung.',
  },
  {
    num: 2,
    title: 'Tiriskan & Kemas Rapat',
    desc: 'Kurangi kadar kuah/cairan berlebih dan simpan dalam wadah tertutup untuk mencegah bau dan lalat.',
  },
  {
    num: 3,
    title: 'Estimasi Berat Akurat',
    desc: 'Timbang atau estimasi berat saat permohonan penjemputan guna membantu optimasi kapasitas kurir.',
  },
  {
    num: 4,
    title: 'Penempatan di Titik Jemput',
    desc: 'Letakkan wadah di lokasi yang mudah diakses kurir saat rentang jendela waktu penjemputan tiba.',
  },
  {
    num: 5,
    title: 'Dokumentasikan Foto Sampel',
    desc: 'Unggah foto kondisi sampah saat membuat request untuk validasi kelayakan awal oleh sistem dan kurir.',
  },
]

export const DEFAULT_GUIDE_FAQS = [
  {
    q: 'Apakah sampah berminyak masih dapat diterima?',
    a: 'Sedikit sisa minyak pada masakan masih dapat diproses. Namun kuah sangat berminyak atau minyak jelantah murni sebaiknya dipisahkan karena dapat menghambat aerasi media maggot BSF.',
  },
  {
    q: 'Berapa batas minimum berat sampah per request?',
    a: 'Minimal estimasi per request adalah 1 kg. Untuk efisiensi operasional dan rute kurir sirkular, disarankan mengumpulkan 3–5 kg per pengajuan.',
  },
  {
    q: 'Apakah makanan yang sudah basi atau berbau boleh disalurkan?',
    a: 'Boleh. Larva maggot BSF secara alami mencerna bahan organik yang telah mengalami pembusukan awal, asalkan belum terkontaminasi bahan kimia atau pestisida.',
  },
  {
    q: 'Mengapa kontaminasi plastik harus 0%?',
    a: 'Plastik, staples, atau karet tidak dapat terurai oleh maggot dan berisiko merusak mesin pencacah serta menurunkan mutu pupuk organik kasgot yang dihasilkan.',
  },
  {
    q: 'Bagaimana jika kurir mendapati sampah tidak sesuai kategori?',
    a: 'Kurir akan memberikan catatan pada status penjemputan. Tidak ada denda langsung, namun kepatuhan pemilahan berdampak positif pada prioritas jadwal jemput warung Anda.',
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
  if (n.includes('nasi') || n.includes('lauk')) return 'Sisa nasi putih, sayur masak, mie, dan sisa olahan lauk warung.'
  if (n.includes('sayur') || n.includes('buah')) return 'Sisa sayuran mentah, potongan buah, ampas kupasan bumbu dan kulit buah segar.'
  if (n.includes('cair')) return 'Sisa kuah masakan, air rebusan bumbu kaldu, atau makanan basi bertekstur cair.'
  if (n.includes('kopi') || n.includes('teh')) return 'Ampas bubuk kopi, daun teh seduh, dan sisa ampas rempah dapur.'
  return 'Bahan organik dapur warung yang layak diolah menjadi pakan maggot BSF dan pupuk kasgot.'
}

function getDefaultTips(name: string, isMaggotFriendly = true): string[] {
  const n = name.toLowerCase()
  if (n.includes('cair')) {
    return [
      'Gunakan jerigen atau wadah ember bertutup kedap agar tidak tumpah di perjalanan',
      'Hindari mencampur dengan residu padat anorganik seperti plastik atau tusuk gigi',
      'Kumpulkan maksimal 2 hari agar tidak mengalami bau amonia yang menyengat',
    ]
  }
  if (n.includes('nasi') || n.includes('lauk')) {
    return [
      'Tiriskan kuah berlebih sebelum dimasukkan ke dalam wadah pengumpulan',
      'Simpan dalam wadah tertutup untuk mencegah hinggapan lalat hijau liar',
      'Pisahkan dari tulang besar sapi/kambing yang tidak dapat dicerna larva',
    ]
  }
  if (n.includes('sayur') || n.includes('buah')) {
    return [
      'Tiriskan air bilasan sayur agar kadar kelembapan tidak becek berlebihan',
      'Potong bagian sayur yang panjang atau buah yang besar menjadi ukuran lebih kecil',
      'Pastikan stiker label buah dan kawat pengikat sayur sudah dilepas',
    ]
  }
  return [
    'Pastikan kadar air terkontrol dan tidak becek berlebih sebelum dijemput kurir',
    isMaggotFriendly ? 'Sangat cocok untuk media konversi larva maggot Black Soldier Fly' : 'Akan diproses melalui pengomposan aerobik terstandar',
    'Simpan di tempat teduh dan tertutup sampai kurir tiba di lokasi',
  ]
}

function getDefaultAcceptable(name: string): string[] {
  const n = name.toLowerCase()
  if (n.includes('cair')) {
    return [
      'Sisa kuah gulai, soto, atau kaldu sup tanpa tulang besar',
      'Air tajin atau air rebusan bahan makanan dapur',
      'Sisa minuman olahan nabati (susu kedelai, jus basi)',
    ]
  }
  if (n.includes('nasi') || n.includes('lauk')) {
    return [
      'Sisa nasi putih, nasi kuning, atau nasi uduk',
      'Olahan lauk pauk (tahu, tempe, telur, potongan daging)',
      'Sisa olahan mie, bihun, dan pasta basah',
    ]
  }
  if (n.includes('sayur') || n.includes('buah')) {
    return [
      'Kulit dan potongan buah (pisang, pepaya, semangka, mangga)',
      'Batang dan daun sayuran sisa potongan dapur',
      'Ampas perasan kelapa dan kupasan bumbu alami',
    ]
  }
  return [
    'Sisa makanan organik dapur warung sehari-hari',
    'Kupasan bahan pangan segar atau olahan non-kemasan',
    'Ampas nabati atau rempah alami sisa pengolahan',
  ]
}

function getDefaultUnacceptable(name: string): string[] {
  const n = name.toLowerCase()
  if (n.includes('cair')) {
    return [
      'Minyak jelantah murni (pisahkan ke penampung jelantah khusus)',
      'Air deterjen, sabun cuci piring, atau cairan pembersih lantai',
      'Bahan kimia atau cairan pengawet berbahaya',
    ]
  }
  return [
    'Plastik pembungkus, mika, sedotan, dan styrofoam',
    'Tusuk sate bambu tajam, kawat staples, dan karet gelang',
    'Bahan makanan yang sudah terkontaminasi sabun pembersih kimia',
    'Tulang hewan besar atau cangkang keras berukuran tebal',
  ]
}
