# Skema Data — comics.json

Dokumen ini menjelaskan struktur field untuk setiap entri komik di `comics.json`,
supaya penambahan data baru konsisten dan opencode tidak menebak-nebak struktur.

## Struktur per Komik

```json
{
  "id": "string, unik, dipakai di URL (?id=...)",
  "title": "string, judul komik",
  "cover": "string, path/URL gambar cover (rasio 2:3)",
  "synopsis": "string, sinopsis singkat",
  "type": "manga | manhwa | manhua",
  "status": "ongoing | tamat",
  "genres": ["array of string, misal: Action, Romance, Isekai"],
  "rating": "number, opsional, misal 4.5",
  "tags": ["array of string, opsional, tag tambahan di luar genre"],
  "chapters": [
    {
      "number": "number, nomor chapter",
      "title": "string, opsional, judul chapter",
      "releaseDate": "string, format YYYY-MM-DD",
      "pages": ["array of string, path/URL tiap halaman gambar, urut sesuai urutan baca"]
    }
  ]
}
```

## Aturan
- `id` harus unik di seluruh file, tidak boleh diubah setelah dibuat (dipakai
  sebagai referensi di localStorage untuk bookmark & riwayat baca).
- `chapters` diurutkan dari yang terlama ke terbaru (index 0 = chapter pertama).
- `pages` diurutkan sesuai urutan baca (index 0 = halaman pertama chapter itu).
- Field opsional boleh dikosongkan/dihilangkan, tapi field wajib (`id`, `title`,
  `cover`, `type`, `status`, `chapters`) harus selalu ada.

## Contoh Minimal

```json
{
  "id": "contoh-komik-01",
  "title": "Contoh Komik",
  "cover": "/assets/covers/contoh-komik-01.jpg",
  "synopsis": "Ringkasan singkat cerita di sini.",
  "type": "manhwa",
  "status": "ongoing",
  "genres": ["Action", "Fantasy"],
  "chapters": [
    {
      "number": 1,
      "title": "Awal Mula",
      "releaseDate": "2026-01-10",
      "pages": [
        "/assets/chapters/contoh-komik-01/ch1/001.jpg",
        "/assets/chapters/contoh-komik-01/ch1/002.jpg"
      ]
    }
  ]
}
```
