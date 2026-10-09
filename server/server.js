#!/usr/bin/env node
// Server lokal Kantor AI. Tanpa library tambahan.
// Pemakaian: node server/server.js --project <folder-project> [--port 4321] [--tim tim.json]
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { cocokkan, kerja, MENGUBAH } = require('./cocok');

const arg = (n, def) => { const i = process.argv.indexOf('--' + n); return i > -1 ? process.argv[i + 1] : def; };
const AKAR = path.resolve(__dirname, '..');
const PROJECT = path.resolve(arg('project', process.cwd()));
const PORT = Number(arg('port', 4321));
const HOST = '127.0.0.1';
const TIM_FILE = path.resolve(arg('tim', path.join(AKAR, 'tim.json')));
const LOG_FILE = path.join(PROJECT, '.kantor-ai', 'catatan.jsonl');
const PUBLIK = path.join(AKAR, 'public');
const MAKS_RIWAYAT = 300;

let tim = { divisi: [] };
function muatTim() {
  try { tim = JSON.parse(fs.readFileSync(TIM_FILE, 'utf8')); kirimSemua({ jenis: 'tim', tim }); }
  catch (e) { console.error('Gagal membaca', TIM_FILE, '-', e.message); }
}

// ---- status giliran & riwayat ----
const riwayat = [];   // aksi terbaru (sudah dicocokkan)
const laporan = [];   // laporan Manager
let giliran = [];     // aksi sejak prompt/stop terakhir
let nomor = 0;

function namaKaryawan(id) {
  for (const d of tim.divisi || []) for (const k of d.karyawan || []) if (k.id === id) return k.nama;
  return null;
}

function buatLaporan(t) {
  const per = new Map();
  for (const a of giliran) {
    const kunci = a.karyawan || '(belum terpetakan)';
    if (!per.has(kunci)) per.set(kunci, { karyawan: a.karyawan, nama: namaKaryawan(a.karyawan) || 'Tidak terpetakan', kerja: new Map() });
    const label = a.file ? `${a.kerja} · ${a.file.split('/').pop()}` : a.kerja;
    const e = per.get(kunci).kerja;
    e.set(label, (e.get(label) || 0) + 1);
  }
  const eksternal = giliran.filter((a) => a.eksternal).map((a) => ({ karyawan: a.karyawan, nama: namaKaryawan(a.karyawan), alat: a.alat, jenis: a.eksternal, file: a.file }));
  return {
    id: ++nomor, t,
    jumlahAksi: giliran.length,
    jumlahUbah: giliran.filter((a) => MENGUBAH.has(a.alat)).length,
    orang: [...per.values()].map((o) => ({ karyawan: o.karyawan, nama: o.nama, kerja: [...o.kerja].map(([label, n]) => ({ label, n })) })),
    eksternal,
  };
}

function proses(baris, langsung) {
  if (baris.ev === 'UserPromptSubmit') {
    giliran = [];
    if (langsung) kirimSemua({ jenis: 'prompt', t: baris.t });
  } else if (baris.ev === 'PreToolUse') {
    const a = { t: baris.t, alat: baris.alat, file: baris.file, luar: !!baris.luar, eksternal: baris.eksternal, kerja: kerja(baris.alat), ...cocokkan(tim, baris) };
    giliran.push(a);
    riwayat.push(a); if (riwayat.length > MAKS_RIWAYAT) riwayat.shift();
    if (langsung) kirimSemua({ jenis: 'aksi', aksi: a });
  } else if (baris.ev === 'Stop') {
    const lap = buatLaporan(baris.t);
    giliran = [];
    laporan.push(lap); if (laporan.length > 50) laporan.shift();
    if (langsung) kirimSemua({ jenis: 'laporan', laporan: lap });
  }
}

// ---- membaca catatan secara bertahap ----
let offset = 0, sisa = '';
function bacaBaru(langsung) {
  let st;
  try { st = fs.statSync(LOG_FILE); } catch { return; }
  if (st.size < offset) { offset = 0; sisa = ''; }
  if (st.size === offset) return;
  const fd = fs.openSync(LOG_FILE, 'r');
  const buf = Buffer.alloc(st.size - offset);
  fs.readSync(fd, buf, 0, buf.length, offset);
  fs.closeSync(fd);
  offset = st.size;
  const teks = sisa + buf.toString('utf8');
  const baris = teks.split('\n');
  sisa = baris.pop();
  for (const b of baris) { if (!b.trim()) continue; try { proses(JSON.parse(b), langsung); } catch {} }
}

// ---- SSE ----
const klien = new Set();
function kirimSemua(pesan) {
  const data = `data: ${JSON.stringify(pesan)}\n\n`;
  for (const res of klien) res.write(data);
}

const TIPE = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml' };
const HOST_OK = new Set([`127.0.0.1:${PORT}`, `localhost:${PORT}`]);

const server = http.createServer((req, res) => {
  // Tolak permintaan dengan Host asing (mencegah DNS rebinding).
  if (!HOST_OK.has(String(req.headers.host || '').toLowerCase())) { res.writeHead(403); return res.end('Hanya untuk komputer ini'); }
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname === '/api/stream') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
    res.write(`data: ${JSON.stringify({ jenis: 'awal', tim, riwayat, laporan, giliranBerjalan: giliran.length, project: path.basename(PROJECT) })}\n\n`);
    klien.add(res);
    const detak = setInterval(() => res.write(': detak\n\n'), 20000);
    req.on('close', () => { clearInterval(detak); klien.delete(res); });
    return;
  }
  if (url.pathname === '/api/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ project: PROJECT, catatan: LOG_FILE, ada: fs.existsSync(LOG_FILE), aksi: riwayat.length, laporan: laporan.length, klien: klien.size }));
  }
  const rel = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname).replace(/^\/+/, '');
  const file = path.resolve(PUBLIK, rel);
  if (!file.startsWith(PUBLIK + path.sep)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, isi) => {
    if (err) { res.writeHead(404); return res.end('Tidak ditemukan'); }
    res.writeHead(200, { 'Content-Type': TIPE[path.extname(file)] || 'application/octet-stream' });
    res.end(isi);
  });
});

muatTim();
bacaBaru(false);
fs.watchFile(LOG_FILE, { interval: 250 }, () => bacaBaru(true));
fs.watchFile(TIM_FILE, { interval: 1000 }, muatTim);
server.listen(PORT, HOST, () => {
  console.log(`Kantor AI: http://${HOST}:${PORT}`);
  console.log(`Membaca catatan: ${LOG_FILE}`);
});
