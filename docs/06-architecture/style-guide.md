# Style Guide — Comic Reader

Dokumen ini berisi KEPUTUSAN FINAL desain, bukan proses brainstorm. Diisi setelah
"token plan" dari skill `comic-design` sudah direview dan disetujui.

Tujuan file ini: supaya opencode (dan kamu) tidak "memutuskan ulang" warna/font
yang berbeda-beda tiap sesi baru — begitu diisi di sini, ini jadi acuan tetap
sampai kamu sendiri yang memutuskan untuk mengubahnya.

> **Catatan penting soal "banyaknya" panduan ini:** dokumen ini sengaja detail
> supaya KONSISTEN di semua halaman, bukan supaya SEMUA elemen dipakai bersamaan
> di satu layar. Sebagian besar isinya adalah aturan konsistensi (spacing, kontras,
> state tombol) yang justru MENCEGAH keramaian, bukan menambah. Elemen yang benar-
> benar "berani" (dog-ear, badge SFX, transisi cover, tema warna dinamis) harus
> dipakai bergantian sesuai konteks halaman masing-masing, TIDAK ditumpuk semua
> di tempat yang sama. Kalau saat implementasi satu layar terasa ramai, itu tanda
> untuk mengurangi, bukan menambah lagi — prinsip restraint dari skill `comic-design`
> tetap berlaku di atas semua rekomendasi di file ini.

## Warna
| Nama Token | Hex | Dipakai untuk |
|---|---|---|
| `--color-bg` | _(isi)_ | Background utama |
| `--color-surface` | _(isi)_ | Card, panel |
| `--color-text` | _(isi)_ | Teks utama |
| `--color-text-muted` | _(isi)_ | Teks sekunder (caption, meta info) |
| `--color-accent` | _(isi)_ | Aksen utama (badge, tombol, highlight) |
| `--color-accent-2` | _(isi, opsional)_ | Aksen kedua kalau perlu |

## Tipografi

> Status: REKOMENDASI awal, belum final. Ganti kolom "Font" kalau setelah dicoba
> kamu pilih arah lain — tapi begitu dipakai, jangan ganti-ganti lagi tanpa dicatat
> di "Catatan Perubahan" di bawah.

Karena ada judul alternatif dalam 3 skrip (Jepang, Korea, China), pakai SATU
keluarga font yang punya varian resmi untuk tiap skrip, supaya terasa konsisten
dan bukan tempelan asal fallback ke font sistem.

| Peran | Font | Alasan dipilih |
|---|---|---|
| Display (judul utama, Latin) | **Cabinet Grotesk** atau **General Sans** | Condensed-bold, berkarakter, cocok untuk judul komik; dipakai secukupnya (hanya judul besar), bukan di semua teks |
| Body (sinopsis, teks panjang, UI) | **IBM Plex Sans** | Netral, mudah dibaca, dan satu keluarga dengan varian CJK di bawah — menjaga konsistensi lintas skrip |
| Judul alternatif — Jepang | **IBM Plex Sans JP** | Varian resmi IBM Plex untuk Jepang, seragam gaya dengan body Latin |
| Judul alternatif — Korea | **IBM Plex Sans KR** | Varian resmi IBM Plex untuk Korea |
| Judul alternatif — China | **IBM Plex Sans SC** (simplified) / **TC** (traditional) | Varian resmi IBM Plex untuk China, pilih SC/TC sesuai mayoritas koleksi |
| Utility (caption/label) | IBM Plex Sans (weight lebih ringan) | Konsisten dengan body, cukup beda lewat ukuran/weight saja |

**Catatan implementasi penting:** jangan load seluruh font CJK sekaligus (bisa >10MB
karena ribuan karakter). Gunakan subsetting — load hanya karakter yang benar-benar
dipakai di judul komik yang ada (parameter `text=` di Google Fonts), atau load
font CJK secara dinamis lewat JS hanya saat halaman menampilkan judul dalam
skrip itu.

## Icon

> Status: REKOMENDASI awal.

Pakai SVG inline/self-hosted, bukan icon font (FontAwesome dkk — berat & generik):
- **Phosphor Icons** — punya varian weight (thin/regular/bold/duotone), fleksibel untuk dark mode
- Alternatif: **Tabler Icons** — clean, stroke-width konsisten, ringan

Simpan sebagai sprite SVG di `/assets/icons/`, jangan load dari CDN pihak ketiga
supaya tidak bergantung pada koneksi eksternal saat load.

## Desain Card Komik

> Status: REKOMENDASI awal — salah satu bisa jadi Signature Element.

- **Dog-ear/lipatan pojok** di sudut card sebagai indikator progress baca (makin
  banyak dibaca, "lipatan" makin besar) — meniru kebiasaan melipat pojok buku fisik
- **Badge chapter/status** dibuat sedikit miring (skew) dengan border tebal, mirip
  stiker SFX komik — bukan pill badge rounded standar
- **Judul alternatif (CJK)** muncul di bawah judul utama saat hover, ukuran lebih
  kecil & warna muted (`--color-text-muted`) — supaya tidak bikin ramai tampilan
  default tapi tetap tersedia saat dibutuhkan

## Animasi Transisi Halaman

> Status: REKOMENDASI awal.

- Gunakan **View Transitions API** (native browser, tanpa library tambahan) untuk
  transisi antar halaman multi-page — browser lama otomatis fallback ke tanpa
  animasi, jadi aman dipakai progresif
- **Reader mode manga (page-by-page)**: transisi slide horizontal singkat antar
  halaman, arah sesuai orientasi baca
- **Reader mode manhwa (vertical scroll)**: TIDAK perlu animasi buatan — momentum
  scroll natural sudah cukup, jangan dipaksakan (prinsip restraint)
- **Buka chapter dari halaman detail**: transisi "cover meluas jadi full-screen
  reader" via View Transitions API — kandidat kuat untuk Signature Element

## Tema Dinamis per Halaman Detail (berdasar Cover)

> Status: REKOMENDASI awal — fitur opsional, bisa jadi Signature Element kuat kalau dieksekusi rapi.

Ide: saat user membuka halaman detail komik, suasana/aksen warna halaman itu
menyesuaikan warna dominan dari cover komiknya — mirip teknik yang dipakai
Spotify/YouTube Music pada halaman album (warna player menyesuaikan cover
album). Ini HANYA berlaku di halaman detail (dan opsional di reader), TIDAK
mengubah warna dasar situs secara keseluruhan (homepage/catalog tetap pakai
`--color-bg`/`--color-accent` standar).

**Cara kerja teknis:**
1. Ambil gambar cover, proses lewat `<canvas>` di browser (Canvas API) untuk
   menghitung warna dominan/rata-rata dari pixel gambar — ini murni JavaScript,
   tidak perlu library eksternal atau proses server
2. Gunakan warna hasil ekstraksi sebagai `--color-accent-dynamic` KHUSUS di
   scope halaman detail komik tersebut (misal jadi warna gradient tipis di
   background atas, warna border tombol "Baca Sekarang", atau warna badge genre)
3. **WAJIB ada fallback & pengecekan kontras**: setelah dapat warna dominan, cek
   dulu rasio kontrasnya terhadap teks putih/terang di atasnya. Kalau kontrasnya
   di bawah standar aksesibilitas (lihat bagian Aksesibilitas), jangan pakai
   warna itu langsung — gelapkan/terangkan otomatis, atau fallback ke
   `--color-accent` default supaya teks tetap terbaca
4. Hasil ekstraksi warna per komik bisa **di-cache** (misal disimpan sekali di
   `comics.json` sebagai field tambahan `dominantColor`, dihitung manual/lewat
   script sekali saat menambah komik baru) supaya tidak menghitung ulang tiap
   kali halaman dibuka — lebih ringan daripada ekstraksi real-time terus-menerus

**Batasan supaya tidak berlebihan:**
- Efeknya HALUS — cukup gradient/tint lembut di area tertentu (misal bagian atas
  halaman di belakang cover besar), BUKAN mengganti seluruh background halaman
  jadi warna terang mencolok
- Teks utama (judul, sinopsis) tetap pakai `--color-text` standar, bukan ikut
  berubah warna — yang berubah hanya elemen aksen/dekoratif
- Kalau warna dominan hasil ekstraksi terlalu terang/neon dan bikin halaman
  terasa norak dibanding halaman lain, turunkan saturasi/opacity-nya sebelum
  dipakai (misal terapkan lewat CSS `filter` atau blend dengan `--color-bg`)

## Model Navigasi Reader

> Status: REKOMENDASI awal.

**Mode page-by-page (manga/manhua halaman per halaman):**
- Tap zone 3 bagian layar: tap kiri = halaman sebelumnya, tap kanan = halaman
  berikutnya, tap tengah = toggle tampil/sembunyikan navbar & kontrol
- Sediakan toggle **arah baca** (kanan-ke-kiri untuk manga Jepang tradisional vs
  kiri-ke-kanan) di panel setting reader — tap zone di atas mengikuti arah yang dipilih
- Keyboard (desktop): panah kiri/kanan atau spasi untuk ganti halaman
- Swipe kiri/kanan (mobile) sebagai alternatif tap zone, jangan bentrok dengan
  gesture swipe-back bawaan browser di edge layar

**Mode vertical scroll (manhwa):**
- Navigasi utama cukup scroll natural, tidak perlu tap zone
- Sediakan **tombol mengambang** (floating action button) untuk buka daftar
  chapter cepat (drawer/list), supaya user bisa lompat chapter tanpa scroll
  balik ke atas atau kembali ke halaman detail

**Progress & perpindahan chapter:**
- Progress bar chapter bisa **di-drag/diklik langsung** untuk loncat ke halaman
  tertentu (seperti scrubber video), bukan cuma indikator visual pasif —
  penting untuk chapter panjang (40+ halaman)
- Saat mencapai halaman terakhir chapter, tap "next" **langsung lanjut ke
  halaman pertama chapter berikutnya** (kalau ada), bukan dead-end yang
  memaksa user kembali ke halaman detail dulu

**Panel pengaturan reader:**
- Satu tombol kecil (pojok atas) membuka panel setting ringkas: toggle mode
  (scroll/page), arah baca, kecerahan/dim overlay, warna background reader
  (hitam/putih/sepia) — supaya kontrol tidak menumpuk di navbar utama

## Sistem Spacing & Grid

> Status: REKOMENDASI awal.

- Pakai skala spacing berbasis kelipatan 8px (4, 8, 16, 24, 32, 48, 64px) —
  konsisten dipakai di semua halaman supaya rapi tanpa harus mikir ulang tiap komponen
- Breakpoint responsif yang disarankan: mobile `<640px`, tablet `640–1024px`, desktop `>1024px`
- Grid katalog: 2 kolom di mobile, 3 di tablet, 5–6 di desktop (sesuaikan dengan ukuran cover)

## Shadow & Elevation

> Status: REKOMENDASI awal.

Karena tema dasar gelap, hindari box-shadow hitam biasa (nggak keliatan di background
gelap). Alternatif:
- Elevation lewat **perbedaan warna surface** (card sedikit lebih terang dari
  background) + border tipis 1px semi-transparan, bukan shadow drop klasik
- Kalau tetap mau shadow (misal untuk modal/dropdown), pakai shadow dengan opacity
  tinggi dan warna gelap pekat, bukan hitam solid biasa

## Tombol & Interactive States

> Status: REKOMENDASI awal.

- Definisikan minimal 4 state untuk tombol: default, hover, active/pressed, disabled
  — jangan cuma bikin hover, pengguna butuh feedback jelas juga saat menekan
- Tombol primer (misal "Baca Sekarang") pakai `--color-accent` solid; tombol sekunder
  (misal "Tambah ke Favorit") pakai outline/ghost style supaya hierarki visual jelas
- Semua elemen interaktif WAJIB punya visible focus state (outline/ring) untuk
  navigasi keyboard — jangan dihilangkan demi estetika

## Badge & Tag Genre

> Status: REKOMENDASI awal.

- Beri **pengelompokan warna** pada tag genre (misal: Action=merah, Romance=pink,
  Comedy=kuning, Horror=ungu tua) supaya user bisa scan visual dengan cepat tanpa
  baca teks satu-satu — tapi tetap dalam batas palet utama, jangan sampai keluar
  dari 4–6 warna inti yang sudah ditentukan
- Badge tipe komik (Manga/Manhwa/Manhua) sebaiknya beda bentuk/ikon kecil per tipe
  (bukan cuma teks), supaya cepat dibedakan di grid katalog padat

## Empty, Loading, dan Error State

> Status: REKOMENDASI awal.

- **Loading**: skeleton berbentuk panel komik kosong dengan border tebal (konsisten
  dengan tema panel komik), bukan shimmer generik
- **Empty state** (riwayat baca kosong, hasil pencarian nihil, dsb): ilustrasi/icon
  sederhana + microcopy aktif sesuai konteks (sudah dibahas sebelumnya), bukan cuma
  teks polos "No data"
- **Error state** (gambar gagal load, chapter gagal dimuat): jangan biarkan area
  kosong tanpa penjelasan — tampilkan pesan singkat + tombol retry

## Navigasi & Struktur Halaman

> Status: REKOMENDASI awal.

- Navbar sticky di atas, berisi: logo/nama situs, search bar (selalu terlihat),
  toggle dark/light kalau nanti mau ditambah opsi light mode
- Tombol "kembali ke atas" muncul setelah scroll cukup jauh di halaman katalog/panjang
- Reader: navigasi next/prev chapter ditempatkan di posisi yang mudah dijangkau ibu
  jari di mobile (bawah layar), bukan cuma di atas

## Micro-interaction & Notifikasi

> Status: REKOMENDASI awal.

- Saat user bookmark/tambah favorit, beri feedback instan berupa toast kecil
  ("Ditambahkan ke Favorit") yang muncul singkat dan hilang otomatis — supaya user
  yakin aksinya berhasil tanpa perlu pindah halaman
- Reader: swipe gesture kiri/kanan untuk ganti halaman di mode page-by-page (mobile),
  swipe ini terpisah dari scroll vertikal manhwa

## Aksesibilitas

> Status: REKOMENDASI awal — bagian ini WAJIB dipatuhi minimal levelnya, bukan opsional.

- Kontras warna teks terhadap background minimal rasio 4.5:1 (standar WCAG AA),
  terutama untuk teks sinopsis dan label UI kecil
- Hormati `prefers-reduced-motion` — matikan/kurangi animasi transisi (termasuk View
  Transitions) untuk user yang mengaktifkan pengaturan ini di sistem operasinya
- Semua gambar cover/chapter punya `alt` text yang bermakna (minimal judul komik/nomor
  halaman), bukan dikosongkan

## Branding & Identitas Kecil

> Status: REKOMENDASI awal.

- Buat favicon sederhana yang konsisten dengan tema (misal ikon panel komik kecil
  atau inisial, bukan default globe/file icon)
- Kalau nanti mau dibagikan linknya, siapkan juga gambar preview untuk social share
  (Open Graph image) — meski situs personal, ini kecil tapi bikin terasa lebih "jadi"

## Layout
- Grid katalog: _(isi jumlah kolom mobile/desktop, lihat rekomendasi di "Sistem Spacing & Grid")_
- Rasio cover: 2:3 (default, ubah kalau berbeda)
- _(tambahkan aturan spacing/breakpoint spesifik kalau berbeda dari rekomendasi di atas)_

## Signature Element
Elemen unik yang membedakan desain ini dari template comic-reader lain:
_(isi — misal: transisi buka chapter meniru membalik halaman, badge chapter baru
berbentuk SFX komik, dsb)_

## Catatan Perubahan
Kalau style guide ini direvisi di kemudian hari, catat di sini kapan dan kenapa,
supaya ada jejak keputusan desain.

- _(tanggal)_ — _(perubahan apa dan alasannya)_
