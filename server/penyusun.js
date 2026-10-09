#!/usr/bin/env node
// Menyusun tim.json awal dari folder yang ada di project. Hanya MEMBACA nama folder/file.
// Pemakaian: node server/penyusun.js <folder-project> [--keluar tim.json] [--timpa]
'use strict';
const fs = require('fs');
const path = require('path');

const proj = path.resolve(process.argv[2] || process.cwd());
if (!fs.existsSync(proj) || !fs.statSync(proj).isDirectory()) {
  console.error(`Folder project tidak ditemukan: ${proj}\nGanti dengan folder yang benar-benar ada, misalnya: ~/Desktop/PROJECT/proyek-saya`);
  process.exit(1);
}
const i = process.argv.indexOf('--keluar');
const keluar = path.resolve(i > -1 ? process.argv[i + 1] : path.join(__dirname, '..', 'tim.json'));
const ABAI = new Set(['node_modules', '.git', '.claude', '.devin', '.kantor-ai', 'dist', 'build', '.next', '.cache', 'vendor', '__pycache__', '.venv', 'venv', 'coverage']);
const NAMA = ['Sari', 'Budi', 'Rina', 'Dimas', 'Ayu', 'Fajar', 'Putri', 'Agus', 'Wulan', 'Rizky', 'Dewi', 'Hendra', 'Lestari', 'Bayu', 'Nadia', 'Yoga', 'Intan', 'Rudi', 'Maya', 'Eko', 'Tari', 'Andi', 'Citra', 'Joko'];
const KATA_UMUM = new Set(['index', 'readme', 'main', 'test', 'spec', 'the', 'and', 'new', 'old', 'copy', 'final', 'draft', 'file', 'data', 'md', 'txt']);
let n = 0;
const namaBaru = () => NAMA[n++ % NAMA.length] + (n > NAMA.length ? ' ' + Math.ceil(n / NAMA.length) : '');
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'x';
const judul = (s) => s.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

function isi(dir) { try { return fs.readdirSync(dir, { withFileTypes: true }); } catch { return []; } }
function semuaFile(dir, maks = 400, hasil = []) {
  for (const e of isi(dir)) {
    if (hasil.length >= maks) break;
    if (e.isDirectory()) { if (!ABAI.has(e.name) && !e.name.startsWith('.')) semuaFile(path.join(dir, e.name), maks, hasil); }
    else hasil.push(e.name);
  }
  return hasil;
}
function kataSering(files) {
  const hitung = new Map();
  for (const f of files) {
    const dasar = f.replace(/\.[^.]+$/, '').toLowerCase();
    for (const k of new Set(dasar.split(/[^a-z0-9]+/))) if (k.length >= 3 && !KATA_UMUM.has(k) && !/^\d+$/.test(k)) hitung.set(k, (hitung.get(k) || 0) + 1);
  }
  return [...hitung].filter(([, c]) => c >= 2).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k]) => k);
}

const divisi = [];
for (const e of isi(proj)) {
  if (!e.isDirectory() || ABAI.has(e.name) || e.name.startsWith('.')) continue;
  const dir = path.join(proj, e.name);
  const sub = isi(dir).filter((x) => x.isDirectory() && !ABAI.has(x.name) && !x.name.startsWith('.')).slice(0, 5);
  const karyawan = [];
  for (const s of sub) karyawan.push({ id: slug(e.name + '-' + s.name), nama: namaBaru(), peran: judul(s.name), aturan: { folder: [`${e.name}/${s.name}`] } });
  if (!sub.length) for (const k of kataSering(semuaFile(dir))) karyawan.push({ id: slug(e.name + '-' + k), nama: namaBaru(), peran: judul(k), aturan: { namaMengandung: [k] } });
  karyawan.push({ id: slug(e.name + '-umum'), nama: namaBaru(), peran: 'Umum', aturan: {} });
  divisi.push({ id: slug(e.name), nama: judul(e.name), folder: [e.name], karyawan });
}
const akarFiles = isi(proj).filter((e) => e.isFile()).length;
if (akarFiles || !divisi.length) divisi.push({ id: 'akar', nama: 'Kantor Pusat', folder: [], karyawan: [{ id: 'akar-umum', nama: namaBaru(), peran: 'File di folder utama', aturan: { akar: true } }] });

// Aksi tanpa file (perintah shell, riset web, delegasi) dicocokkan lewat nama alat.
divisi.push({ id: 'operasional', nama: 'Operasional', folder: [], karyawan: [
  { id: 'ops-perintah', nama: namaBaru(), peran: 'Perintah & deploy', aturan: { alat: ['Bash', 'exec'] } },
  { id: 'ops-riset', nama: namaBaru(), peran: 'Riset web', aturan: { alat: ['WebFetch', 'WebSearch', 'fetch', 'web_search'] } },
] });

const tim = { _catatan: 'Disusun otomatis dari folder project. Boleh diedit bebas; server memuat ulang otomatis.', project: path.basename(proj), divisi };
if (fs.existsSync(keluar) && !process.argv.includes('--timpa')) {
  const cad = `${keluar}.bak-${new Date().toISOString().replace(/[:.]/g, '-')}`;
  fs.copyFileSync(keluar, cad);
  console.log('Salinan lama disimpan di', cad);
}
fs.writeFileSync(keluar, JSON.stringify(tim, null, 2) + '\n');
console.log(`tim.json: ${divisi.length} divisi, ${divisi.reduce((a, d) => a + d.karyawan.length, 0)} karyawan -> ${keluar}`);
