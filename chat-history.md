# Riwayat Sesi Pengembangan

Dokumen ini merangkum riwayat percakapan yang menghasilkan proyek
**Manajemen Proyek — Gantt Chart + CPM & PERT**, beserta hasil verifikasinya.

| | |
| --- | --- |
| Tanggal sesi | 9 Oktober 2026 |
| Lokasi proyek | `C:/Users/asus/gantt_project_app` |
| Branch | `main` |
| Repo | https://github.com/muhammadfachrurrazyhamimu-design/gantt_project_app |
| Commit awal | `b96bd7ffcd3610c24726738c7a4231a42f6cbdfa` |

---

## 1. Ringkasan proyek

Aplikasi manajemen proyek **React 19 + TypeScript + Vite**, murni client-side
(tidak ada server maupun database). Seluruh data tersimpan di `localStorage`
peramban. Isinya: Gantt Chart interaktif, penjadwalan **Critical Path Method
(CPM)** dengan dukungan **FS** dan **SS** plus jeda (lag) dalam hari kerja,
analisis **PERT** (estimasi tiga titik), manajemen sumber daya, dan kalender
kerja yang dapat dikonfigurasi.

### Lima kemampuan utama

1. **Task Management** — CRUD tugas + sub-tugas parent–child tak terbatas,
   durasi dalam hari kerja, tanggal mulai, prioritas, warna indikator, progres,
   catatan. Tugas beranak otomatis jadi *tugas ringkasan* (tanggal di-roll-up).
2. **Predecessors & Timeline Display** — FS dan SS dengan lag hari kerja
   (boleh negatif), panah dependensi di bagan, bar ringkasan, avatar anggota,
   zoom skala, penanda hari ini, sorotan jalur kritis.
3. **Resource Management** — nama/email/peran/gaji, alokasi ke tugas, rekap
   beban, utilisasi, dan estimasi biaya.
4. **Kalender Proyek** — akhir pekan bebas dikonfigurasi (mis. Jumat–Sabtu),
   hari libur khusus, pratinjau dua minggu pertama.
5. **Analisis** — jalur kritis, tabel CPM lengkap (ES/EF/LS/LF/slack),
   diagram PERT SVG activity-on-node, te = (O+4M+P)/6, varians, σ, dan peluang
   selesai tepat waktu.

---

## 2. Riwayat per ronde

### Ronde 1 — Membangun aplikasi dari nol

Scaffold React + TypeScript + Vite, lalu seluruh fitur inti di atas.
Mesin penjadwalan sengaja dipisahkan dari UI di `src/lib/schedule.ts` agar
rumus CPM dapat diuji langsung tanpa render komponen.

**Desain keputusan:**

- Durasi dinyatakan dalam **hari kerja**, bukan hari kalender; akhir pekan dan
  hari libur dilewati mesin kalender.
- Dependensi hanya menghubungkan **tugas daun**; tugas ringkasan di-roll-up
  dari anaknya.
- **Siklus dependensi dideteksi dan dilaporkan**, bukan menggantung — kasus ini
  punya tes tersendiri.
- Navigasi tab memakai URL hash (`#gantt`, `#resources`, `#calendar`,
  `#analysis`), sehingga tiap tampilan bisa di-*deep link* dan diverifikasi
  satu per satu di peramban.

### Ronde 2 — Drag & drop pada bagan

- Tarik **badan batang** → menggeser `startDate` (diskret per hari, di-snap ke
  hari kerja).
- Tarik **sisi kanan** → mengubah `durationDays` dalam hari kerja.
- **Pratinjau jujur:** selama drag, CPM dijalankan ulang pada salinan sementara,
  sehingga tugas yang terikat predecessor ditandai *"dibatasi
  predecessor/tanggal mulai"* alih-alih seolah bebas digeser.
- Batang ringkasan *read-only*; `Esc` membatalkan.

### Ronde 3 — Pengeditan lewat keyboard

Menutup batasan aksesibilitas tertinggi: bagan bisa diedit penuh tanpa mouse.

- Setiap batang yang dapat diubah memakai `role="button"` + `tabIndex="0"`.
- <kbd>←</kbd>/<kbd>→</kbd> menggeser tanggal mulai satu hari kerja,
  <kbd>Shift</kbd> untuk langkah 5 hari, <kbd>Alt</kbd>+panah mengubah durasi
  (minimal 1 hari kerja), <kbd>Enter</kbd> membuka editor, <kbd>Spasi</kbd>
  memilih tugas.
- Nudge keyboard memakai **jalur *commit* yang sama** dengan drag, sehingga
  kedua rute menghasilkan jadwal identik.
- Hasil setiap perubahan diumumkan lewat wilayah *live* (`role="status"`).

### Ronde 4 — Verifikasi toolchain dan menjalankan aplikasi

`npm install`, `npm run typecheck`, `npm test`, `npm run build` semuanya hijau
sejak awal — tidak ada perbaikan yang diperlukan. Dev server dijalankan dan
alamatnya dilaporkan.

### Ronde 5 — Mengeras `.gitignore` dan README

- `.gitignore`: menegaskan `node_modules` dan `dist`, serta menambahkan blok
  berkas rahasia (`.env*`, `*.pem`, `*.key`, `*.jks`, `id_rsa*`, `.npmrc`,
  `.netrc`) dengan `!.env.example` sebagai templat yang aman di-commit.
- README: menambahkan **Prasyarat**, **Instalasi**, dan **Menjalankan** yang
  berurutan, plus bagian **Rahasia & konfigurasi**. Klaim jumlah tes diperbaiki
  dari 71 menjadi 82.

### Ronde 6 — Inisialisasi git dan push ke GitHub

`git init` (branch `main`), commit awal, remote `origin`, lalu `git push -u
origin main`. Percobaan push pertama **berhenti menunggu autentikasi
interaktif** Git Credential Manager; pada percobaan ulang push berhasil dan
ref jarak jauh sudah memuat commit yang sama.

---

## 3. Struktur proyek

```
src/
  types.ts                  Model domain (Task, Dependency, Resource, ProjectCalendar)
  lib/
    dateUtils.ts            Aritmetika tanggal ISO bebas timezone
    calendar.ts             Mesin hari kerja (akhir pekan, libur, durasi)
    schedule.ts             Penjadwal CPM (FS/SS, lag, slack, jalur kritis, roll-up)
    pert.ts                 Estimasi tiga titik & statistik PERT
    timeline.ts             Struktur hari/bulan untuk Gantt
    dragUtils.ts            Aritmetika drag/resize & langkah keyboard (murni, teruji)
    sample.ts               Data contoh
    format.ts               Format mata uang & tanggal
  store/useProjectStore.ts  State zustand + persist + hook useSchedule
  components/               GanttView, GanttChart, TaskTable, TaskEditor,
                            ResourceView, CalendarView, AnalysisView, PertDiagram, ui
```

---

## 4. Hasil verifikasi akhir

Dijalankan setelah perubahan sumber terakhir; status exit diambil langsung dari
tiap perintah.

| Perintah | Exit | Hasil |
| --- | --- | --- |
| `npm install` | 0 | `up to date, audited 108 packages` · `0 vulnerabilities` |
| `npm run typecheck` | 0 | `tsc -b` bersih |
| `npm test` | 0 | `Test Files 5 passed (5)` · `Tests 82 passed (82)` |
| `npm run build` | 0 | `40 modules transformed` · `✓ built in 329ms` |
| `npx oxlint` | 0 | `0 warnings and 0 errors` |

**Bundle:** `index-BBTT_s9D.js` 293,26 kB (88,41 kB gzip) · CSS 14,60 kB ·
`index.html` 0,49 kB.

### Verifikasi di peramban sungguhan

UI lewat jsdom bukan bukti tata letak, jadi tiap tampilan juga dimuat di
Chrome headless lewat **CDP**, dengan input nyata:

| Rute | Hasil |
| --- | --- |
| Render semua tab (Gantt, Sumber Daya, Kalender, Analisis) | 19 baris tugas, 16 panah dependensi, 70 sel hari, 14 node PERT, tanpa error JS |
| Drag & drop mouse (`Input.dispatchMouseEvent`) | 10/10 |
| Pengeditan keyboard (`Input.dispatchKeyEvent`) | 10/10 |

---

## 5. Bug yang ditemukan dan diperbaiki

Semuanya diperbaiki di penyebabnya — tidak ada tes yang dilewahkan,
dilemahkan, atau suppression type/lint yang ditambahkan.

| # | Bug | Ditemukan oleh | Perbaikan |
| --- | --- | --- | --- |
| 1 | Argumen kalender terlewat saat memanggil `workingDaysBetween`, sehingga setiap resize melempar `TypeError` | unit test baru di `dragUtils` | ditambahkan argumen yang hilang |
| 2 | State zustand adalah singleton level-modul, sehingga membersihkan `localStorage` saja tidak mengisolasi tes (durasi 9 terbawa ke tes berikutnya) | kegagalan tes UI | reset store di `beforeEach` |
| 3 | Siklus dependensi membocorkan penjadwalan parsial lewat edge siklusnya sendiri | unit test | tugas dalam siklus jatuh kembali ke tanggal mulainya sendiri |
| 4 | Node DOM usang di tes resize (elemen sudah di-render ulang) | kegagalan tes UI | *re-query* setiap event, sesuai perilaku React |
| 5 | Ekspektasi tes negatif `FS` lag salah (`07 Okt` vs `08 Okt`) | unit test | rumus engine yang benar; tes dan komentarnya diperbaiki |
| 6 | Harness verifikasi membandingkan ISO mentah dengan pengumuman berformat Indonesia | 1 pemeriksaan gagal di browser | harness diperbaiki, bukan aplikasinya |

Dua kegagalan resize pada percobaan browser awal ternyata **artefak harness**,
bukan bug aplikasi: baris target terpotong di luar viewport, lalu tertutup
kolom sticky. Dibuktikan dengan `document.elementFromPoint` yang mengembalikan
`SPAN.bar-resize` tepat di posisi kursor.

---

## 6. Batasan yang diketahui

- **Tugas ringkasan tetap read-only** — tanggalnya hasil roll-up, jadi menggeser
  fase harus melalui sub-tugasnya.
- Navigasi antar-batang memakai <kbd>Tab</kbd> urutan DOM; belum ada navigasi
  grid dua dimensi (panah vertikal sengaja dibiarkan bebas).
- **Model biaya sederhana:** gaji ÷ 22 hari kerja × hari teralokasi, tanpa
  persentase alokasi parsial (mis. 50% FTE).
- **Persistensi** memakai satu kunci `localStorage` (`gantt-project-v1`) tanpa
  migrasi skema.
- Verifikasi tata letak bersifat **struktural** (jumlah elemen, geometri,
  hit-testing); penilaian estetika piksel-per-piksel tidak dapat dikonfirmasi
  secara visual oleh pengembangnya.

---

## 7. Perintah yang tersedia

```bash
npm run dev        # server pengembangan -> http://localhost:5173/
npm run typecheck  # TypeScript (tsc -b)
npm test           # unit + UI test (Vitest)
npm run lint       # oxlint
npm run build      # build produksi ke dist/
npm run preview    # pratinjau hasil build -> http://localhost:4173
```
