# Kantor AI

Kantor 3D yang menampilkan aksi agent (Devin CLI / Devin Desktop / Claude Code) secara langsung.
Semua yang tampil berasal dari catatan hook. Tidak ada aksi berarti kantor diam.

## Pakai

```bash
# 1. Pasang hook ke project (salinan lama .claude/settings.local.json disimpan dulu)
node hook/pasang.js /path/ke/project

# 2. Susun tim awal dari folder project (bisa diedit bebas: tim.json)
node server/penyusun.js /path/ke/project

# 3. Jalankan server (hanya bisa diakses dari komputer ini)
node server/server.js --project /path/ke/project
# buka http://127.0.0.1:4321
```

## Yang dicatat

`hook/catat.js` menulis ke `<project>/.kantor-ai/catatan.jsonl`, satu baris per event:
waktu, jenis event, nama alat, path file yang disentuh, dan kategori aksi eksternal
(misalnya `deploy`, `git push`, `kirim email`). Isi file, isi perintah, dan isi prompt tidak dicatat.
Hook selalu keluar dengan kode 0 dan tanpa output, jadi tidak bisa menghambat agent.

Tambahkan `.kantor-ai/` ke `.gitignore` project bila perlu.

## tim.json

Setiap divisi punya `folder`. Setiap karyawan punya `aturan`:

- `namaMengandung`: kata di nama file, misalnya `["iklan"]`
- `ekstensi`: misalnya `[".md"]`
- `folder`: awalan path, misalnya `["konten/blog"]`
- `alat`: nama alat, misalnya `["exec", "Bash"]`
- `akar`: `true` untuk file di folder utama

Aturan karyawan dicek lebih dulu. Kalau tidak ada yang cocok, file di folder divisi diberikan ke
karyawan tanpa aturan (atau karyawan pertama). Aksi yang tidak cocok dengan siapa pun tampil sebagai
"tanpa pemilik".
