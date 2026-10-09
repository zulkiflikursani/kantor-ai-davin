'use strict';
// Mencocokkan satu aksi dengan divisi & karyawan berdasarkan tim.json.
const KERJA = {
  Write: 'nulis', Edit: 'ngedit', MultiEdit: 'ngedit', NotebookEdit: 'ngedit',
  Read: 'baca', Glob: 'cari file', Grep: 'cari isi', LS: 'lihat folder',
  Bash: 'jalanin perintah', WebFetch: 'riset web', WebSearch: 'riset web',
  Task: 'delegasi', TodoWrite: 'susun rencana',
  // nama alat Devin CLI / Desktop
  edit: 'ngedit', write: 'nulis', read: 'baca', grep: 'cari isi', glob: 'cari file',
  exec: 'jalanin perintah', fetch: 'riset web', web_search: 'riset web',
};
const MENGUBAH = new Set(['Write', 'Edit', 'MultiEdit', 'NotebookEdit', 'edit', 'write']);

function kerja(alat) {
  if (KERJA[alat]) return KERJA[alat];
  if (alat && alat.startsWith('mcp__')) return alat.split('__').slice(1).join(' · ');
  return alat || '?';
}

const kecil = (s) => String(s || '').toLowerCase();
const awalan = (file, folder) => {
  const f = kecil(folder).replace(/^\.?\/+|\/+$/g, '');
  return f && (kecil(file) === f || kecil(file).startsWith(f + '/'));
};

function cocokAturan(a, aksi) {
  a = a || {};
  const file = aksi.file || '';
  const nama = kecil(file.split('/').pop());
  if (a.alat && a.alat.includes(aksi.alat)) return true;
  if (!file) return false;
  if (a.namaMengandung && a.namaMengandung.some((k) => nama.includes(kecil(k)))) return true;
  if (a.ekstensi && a.ekstensi.some((e) => nama.endsWith(kecil(e)))) return true;
  if (a.folder && a.folder.some((f) => awalan(file, f))) return true;
  return false;
}

function cocokkan(tim, aksi) {
  const divisi = (tim && tim.divisi) || [];
  // 1) aturan karyawan yang spesifik menang
  for (const d of divisi) for (const k of d.karyawan || []) {
    if (cocokAturan(k.aturan, aksi)) return { divisi: d.id, karyawan: k.id };
  }
  // 2) folder divisi (awalan terpanjang) -> karyawan umum divisi itu (tanpa aturan), atau yang pertama
  let terbaik = null, panjang = -1;
  if (aksi.file) for (const d of divisi) for (const f of d.folder || []) {
    if (awalan(aksi.file, f) && f.length > panjang) { terbaik = d; panjang = f.length; }
  }
  if (terbaik && terbaik.karyawan && terbaik.karyawan.length) {
    const kosong = (a) => !a || Object.values(a).every((v) => !v || !v.length);
    const k = terbaik.karyawan.find((x) => kosong(x.aturan)) || terbaik.karyawan[0];
    return { divisi: terbaik.id, karyawan: k.id };
  }
  return { divisi: null, karyawan: null };
}

module.exports = { cocokkan, kerja, MENGUBAH };
