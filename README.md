# Manajemen Proyek — Gantt Chart + CPM & PERT

Aplikasi manajemen proyek berbasis **React 19 + TypeScript + Vite** dengan Gantt Chart,
perhitungan **Critical Path Method (CPM)**, dan analisis **PERT**.

## Prasyarat

- **Node.js 20.19+ atau 22.12+** (syarat mesin dari Vite 8) dan npm 10+.
- Tidak ada layanan eksternal, database, atau API key yang dibutuhkan —
  seluruh data tersimpan di `localStorage` peramban.

## Instalasi

```bash
# 1. masuk ke folder proyek
cd gantt_project_app

# 2. pasang dependensi (hanya ini yang diperlukan)
npm install
```

Tidak ada variabel lingkungan, file `.env`, atau kredensial yang perlu diisi.

## Menjalankan

### Mode pengembangan

```bash
npm run dev
```

Vite akan menampilkan alamatnya, secara bawaan:

```
➜  Local:   http://localhost:5173/
```

Buka alamat itu di peramban. Halaman akan memuat ulang otomatis setiap kali
kode di `src/` berubah (hot module replacement).

### Perintah lain

```bash
npm run typecheck  # TypeScript (tsc -b)
npm test           # unit + UI test (Vitest)
npm run lint       # oxlint
npm run build      # build produksi ke dist/
npm run preview    # pratinjau hasil build (http://localhost:4173)
```

## Fitur

### 1. Task Management
- Tambah / ubah / hapus tugas, termasuk sub-tugas (**parent–child**, kedalaman tak terbatas).
- **Durasi dalam hari kerja** — akhir pekan dan hari libur dilewati otomatis.
- Tanggal mulai, prioritas (Rendah/Sedang/Tinggi/Kritis), **warna indikator**,
  progres 0–100%, alokasi anggota tim, dan catatan.
- Tugas yang punya sub-tugas otomatis menjadi **tugas ringkasan**: tanggalnya
  dihitung dari anak-anaknya (roll-up).
- Baris dapat dibuka/ditutup (collapse) dan ditambah sub-tugas langsung dari tabel.

### 2. Predecessors & Timeline Display
- Hubungan antar tugas: **Finish-to-Start (FS)** dan **Start-to-Start (SS)**.
- **Jeda (lag) dalam hari kerja**, boleh negatif untuk tumpang tindih.
- Tampilan **Gantt Chart** interaktif: header bulan + tanggal, penanda hari ini,
  pewarnaan akhir pekan/hari libur, bar progres, avatar anggota tim,
  serta **garis panah dependensi** (putus-putus untuk SS).
- **Drag & drop langsung di bagan**:
  - tarik badan batang untuk menggeser **tanggal mulai** (diskret 1 hari kerja);
  - tarik **sisi kanan** batang untuk mengubah **durasi** dalam hari kerja;
  - selama drag, mesin CPM dijalankan ulang pada salinan sementara sehingga
    pratinjau jujur: tugas yang terikat predecessor/ tanggal mulai ditandai
    “dibatasi predecessor/tanggal mulai” alih-alih seolah bebas digeser;
  - batang tugas ringkasan bersifat *read-only* karena tanggalnya hasil roll-up;
  - <kbd>Esc</kbd> membatalkan drag, dan klik tanpa geser tetap sekadar memilih.
- **Pengeditan lewat keyboard** (tanpa mouse): setiap batang dapat difokuskan
  dengan <kbd>Tab</kbd> dan memakai jalur *commit* yang sama dengan drag.
  - <kbd>←</kbd>/<kbd>→</kbd> menggeser tanggal mulai satu hari kerja,
    <kbd>Shift</kbd> untuk langkah 5 hari;
  - <kbd>Alt</kbd>+<kbd>←</kbd>/<kbd>→</kbd> mengubah durasi (minimal 1 hari kerja);
  - <kbd>Enter</kbd> membuka editor, <kbd>Spasi</kbd> memilih tugas;
  - batang ringkasan tetap tidak dapat diubah; setiap perubahan diumumkan lewat
    wilayah *live* (`role="status"`) sehingga terbaca pembaca layar.
- Zoom skala hari, sorotan jalur kritis, deteksi siklus dependensi.

### 3. Resource Management
- Pendaftaran anggota tim: **nama, email, peran, gaji** bulanan.
- Alokasi anggota ke tugas (dari editor tugas).
- Rekap beban kerja: jumlah tugas, hari kerja teralokasi, utilisasi,
  dan estimasi biaya (gaji ÷ 22 hari kerja × hari teralokasi).

### 4. Kalender Proyek
- Pengaturan **akhir pekan** (bebas pilih kombinasi hari, mis. Jumat–Sabtu).
- Penambahan **hari libur khusus**.
- Perubahan kalender langsung menghitung ulang seluruh jadwal.
- Pratinjau dua minggu pertama sebagai verifikasi visual.

### 5. Analisis Proyek
- **Jalur kritis (Critical Path)**: tugas dengan total float = 0.
- Tabel CPM lengkap: ES, EF, LS, LF, dan slack per tugas.
- **Diagram PERT** (activity-on-node, SVG) dengan jalur kritis disorot merah.
- Estimasi tiga titik: `te = (O + 4M + P) / 6`, varians `((P−O)/6)²`,
  durasi harapan, deviasi standar, dan peluang selesai tepat waktu.

### Lain-lain
- Nama proyek dapat diubah langsung dari header.
- **Ekspor / impor JSON** dan reset ke data contoh.
- Perubahan tersimpan otomatis di `localStorage` (zustand `persist`).
- Navigasi tab memakai URL hash (`#gantt`, `#resources`, `#calendar`, `#analysis`).

## Rahasia & konfigurasi

Proyek ini **tidak memerlukan kredensial apa pun**: tidak ada API key, token,
varian `.env`, atau koneksi database. Seluruh data proyek disimpan di
`localStorage` peramban, dan data contoh dibuat di `src/lib/sample.ts`.

Karena itu, **tidak ada file rahasia yang boleh ada di dalam repo**. `.gitignore`
sudah mengecualikan `node_modules/`, `dist/`, serta berkas yang lazim memuat
rahasia (`.env*`, `*.pem`, `*.key`, `*.p12`, `*.pfx`, `*.jks`, `id_rsa*`,
`.npmrc`, `.netrc`). Satu-satunya pengecualian yang disengaja adalah
`.env.example` sebagai templat kosong, yang aman untuk di-commit.

Jika nanti Anda menambahkan integrasi yang butuh kredensial, simpan di `.env`
(sudah diabaikan) dan jangan pernah menulis nilainya langsung di dalam `src/`.

## Arsitektur

```
src/
  types.ts                  Model domain (Task, Dependency, Resource, ProjectCalendar)
  lib/
    dateUtils.ts            Aritmetika tanggal ISO yang bebas timezone
    calendar.ts             Mesin hari kerja (akhir pekan, libur, durasi)
    schedule.ts             Penjadwal CPM (FS/SS, lag, slack, jalur kritis, roll-up)
    pert.ts                 Estimasi tiga titik & statistik PERT
    timeline.ts             Struktur hari/bulan untuk Gantt
    dragUtils.ts            Aritmetika drag/resize batang (murni, teruji)
    sample.ts               Data contoh
    format.ts               Format mata uang & tanggal
  store/useProjectStore.ts  State zustand + persist + hook `useSchedule`
  components/               GanttView, GanttChart, TaskTable, TaskEditor,
                            ResourceView, CalendarView, AnalysisView, PertDiagram, ui
```

### Aturan penjadwalan

Dengan `lag` dalam hari kerja:

| Tipe | Rumus |
| --- | --- |
| FS | `successor.start ≥ addWorkDays(predecessor.finish, lag + 1)` |
| SS | `successor.start ≥ addWorkDays(predecessor.start, lag)` |

Forward pass menghitung ES/EF (dibatasi juga oleh tanggal mulai tugas), lalu
backward pass menghitung LS/LF dengan late finish dibatasi tanggal selesai proyek.
`slack = jumlah hari kerja antara ES dan LS`; tugas dengan slack 0 dianggap kritis.

Dependensi hanya menghubungkan **tugas daun**; tugas ringkasan di-roll-up dari anaknya.
Siklus dependensi terdeteksi dan dilaporkan (tidak membuat aplikasi hang).

## Pengujian

82 tes berjalan di Vitest:

- `src/lib/calendar.test.ts` — hari kerja, akhir pekan kustom, hari libur, durasi.
- `src/lib/schedule.test.ts` — FS/SS, lag positif & negatif, slack, jalur kritis,
  libur, akhir pekan kustom, roll-up ringkasan, deteksi siklus.
- `src/lib/pert.test.ts` — rumus te, varians, CDF normal, agregasi jalur kritis.
- `src/lib/dragUtils.test.ts` — geser tanggal, ubah durasi, batas minimum 1 hari,
  akhir pekan/libur di dalam rentang, konversi piksel→hari, langkah keyboard.
- `src/App.test.tsx` — alur nyata lewat UI: buat/hapus tugas, sub-tugas, predecessor,
  perubahan durasi mengubah timeline, sumber daya, kalender, analisis,
  serta drag (geser, resize, ambang gerak minimum, batal dengan Esc, ringkasan
  tidak dapat digeser) dan pengeditan keyboard (geser arah maju/mundur dengan
  snap ke hari kerja, langkah 5 hari, resize, batas minimum, live region,
  <kbd>Enter</kbd>/<kbd>Spasi</kbd>).
