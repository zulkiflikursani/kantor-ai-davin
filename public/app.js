import * as THREE from 'three';

// ---------- dasar scene ----------
const kanvas = document.getElementById('kanvas');
const lapisLabel = document.getElementById('label');
const renderer = new THREE.WebGLRenderer({ canvas: kanvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf3f5f8);
const kamera = new THREE.PerspectiveCamera(40, 1, 0.1, 400);
scene.add(new THREE.HemisphereLight(0xffffff, 0xdfe5ee, 2.2));
const matahari = new THREE.DirectionalLight(0xffffff, 1.6);
matahari.castShadow = true;
matahari.shadow.mapSize.set(2048, 2048);
matahari.shadow.bias = -0.0005;
scene.add(matahari, matahari.target);

const WARNA_DIVISI = [0xdbeafe, 0xdcfce7, 0xfef3c7, 0xfce7f3, 0xede9fe, 0xccfbf1, 0xffedd5, 0xe0e7ff];
const WARNA_ORANG = [0x60a5fa, 0x34d399, 0xfbbf24, 0xf472b6, 0xa78bfa, 0x2dd4bf, 0xfb923c, 0x818cf8];
const mat = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85, ...o });
const kotak = (w, h, d, m) => { const x = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); x.castShadow = x.receiveShadow = true; return x; };

let dunia = new THREE.Group();
scene.add(dunia);
const karyawan = new Map();   // id -> { grup, layar, gelembung, nama }
const label = [];             // { el, obj, dy }
let manager = null, bos = null;
let pusat = new THREE.Vector3();

function buatOrang(warna) {
  const g = new THREE.Group();
  const badan = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.6, 20), mat(warna));
  badan.position.y = 0.75; badan.castShadow = true;
  const kepala = new THREE.Mesh(new THREE.SphereGeometry(0.16, 20, 16), mat(0xf1d3b8));
  kepala.position.y = 1.2; kepala.castShadow = true;
  const kursi = kotak(0.5, 0.45, 0.5, mat(0x9aa3b2));
  kursi.position.y = 0.22;
  g.add(kursi, badan, kepala);
  return g;
}

function buatMeja(lebar = 1.4) {
  const g = new THREE.Group();
  const atas = kotak(lebar, 0.06, 0.7, mat(0xffffff));
  atas.position.y = 0.74;
  const kaki = kotak(lebar - 0.1, 0.71, 0.6, mat(0xe5e7eb));
  kaki.position.y = 0.355;
  const tiang = kotak(0.06, 0.2, 0.06, mat(0x6b7280));
  tiang.position.set(0, 0.87, -0.18);
  const monitor = kotak(0.64, 0.4, 0.04, mat(0x374151));
  monitor.position.set(0, 1.15, -0.2);
  const layarMat = new THREE.MeshStandardMaterial({ color: 0x1f2937, emissive: 0x000000, roughness: 0.4 });
  const layar = new THREE.Mesh(new THREE.PlaneGeometry(0.58, 0.34), layarMat);
  layar.position.set(0, 1.15, -0.177);
  g.add(atas, kaki, tiang, monitor, layar);
  return { g, layarMat };
}

function tambahLabel(teks, obj, dy, kelas = '') {
  const el = document.createElement('div');
  el.className = 'nama ' + kelas;
  el.textContent = teks;
  lapisLabel.appendChild(el);
  label.push({ el, obj, dy });
  return el;
}
function tambahGelembung(obj, dy, kelas = '') {
  const el = document.createElement('div');
  el.className = 'gelembung ' + kelas;
  lapisLabel.appendChild(el);
  label.push({ el, obj, dy });
  return el;
}

function bangun(tim) {
  scene.remove(dunia);
  dunia = new THREE.Group();
  scene.add(dunia);
  karyawan.clear();
  label.length = 0;
  lapisLabel.innerHTML = '';

  const divisi = (tim && tim.divisi) || [];
  const PX = 2.2, PZ = 2.6;
  const ruang = divisi.map((d) => {
    const n = Math.max(1, (d.karyawan || []).length);
    const kol = Math.min(3, n), bar = Math.ceil(n / 3);
    return { d, kol, bar, w: kol * PX + 1.2, dd: bar * PZ + 1.0 };
  });
  const perBaris = Math.max(1, Math.ceil(Math.sqrt(ruang.length)));
  let z = 0, iBaris = 0;
  const baris = [];
  for (let i = 0; i < ruang.length; i += perBaris) baris.push(ruang.slice(i, i + perBaris));
  let lebarMaks = 0;
  for (const b of baris) lebarMaks = Math.max(lebarMaks, b.reduce((a, r) => a + r.w, 0) + (b.length - 1) * 0.8);

  baris.forEach((b) => {
    const total = b.reduce((a, r) => a + r.w, 0) + (b.length - 1) * 0.8;
    let x = -total / 2;
    const dalam = Math.max(...b.map((r) => r.dd));
    b.forEach((r) => {
      const idx = divisi.indexOf(r.d);
      const g = new THREE.Group();
      g.position.set(x + r.w / 2, 0, z + dalam / 2);
      const lantai = kotak(r.w, 0.04, dalam, mat(WARNA_DIVISI[idx % WARNA_DIVISI.length]));
      lantai.position.y = 0.02; lantai.castShadow = false;
      const dinding = mat(0xffffff, { transparent: true, opacity: 0.9 });
      const belakang = kotak(r.w, 0.7, 0.06, dinding); belakang.position.set(0, 0.35, -dalam / 2);
      const kiri = kotak(0.06, 0.7, dalam, dinding); kiri.position.set(-r.w / 2, 0.35, 0);
      const kanan = kotak(0.06, 0.7, dalam, dinding); kanan.position.set(r.w / 2, 0.35, 0);
      g.add(lantai, belakang, kiri, kanan);
      const papan = new THREE.Object3D(); papan.position.set(-r.w / 2 + 0.6, 0.85, -dalam / 2); g.add(papan);
      tambahLabel(r.d.nama || r.d.id, papan, 0, 'ruang');

      (r.d.karyawan || []).forEach((k, j) => {
        const kx = (j % 3 - (Math.min(3, r.d.karyawan.length) - 1) / 2) * PX;
        const kz = -dalam / 2 + 1.0 + Math.floor(j / 3) * PZ;
        const meja = buatMeja();
        meja.g.position.set(kx, 0, kz);
        const orang = buatOrang(WARNA_ORANG[idx % WARNA_ORANG.length]);
        orang.position.set(kx, 0, kz + 0.75);
        g.add(meja.g, orang);
        tambahLabel(k.nama || k.id, orang, 0.05);
        const gelembung = tambahGelembung(orang, 1.75);
        karyawan.set(k.id, { grup: orang, layar: meja.layarMat, gelembung, nama: k.nama || k.id, tHilang: 0, tMati: 0 });
      });
      dunia.add(g);
      x += r.w + 0.8;
    });
    z += dalam + 0.8;
    iBaris++;
  });

  // Ruang manager & bos di depan
  const g = new THREE.Group();
  g.position.set(0, 0, z + 2.2);
  const lantai = kotak(Math.max(8, Math.min(lebarMaks, 12)), 0.04, 3.4, mat(0xf1f5f9));
  lantai.position.y = 0.02; lantai.castShadow = false;
  g.add(lantai);
  const mejaM = buatMeja(); mejaM.g.position.set(-2, 0, -0.4);
  const mejaB = buatMeja(2); mejaB.g.position.set(2, 0, -0.4);
  const orangM = buatOrang(0x2f7cf6); orangM.position.set(-2, 0, 0.35);
  const orangB = buatOrang(0x374151); orangB.position.set(2, 0, 0.35);
  g.add(mejaM.g, mejaB.g, orangM, orangB);
  dunia.add(g);
  tambahLabel('Manager', orangM, 0.05, 'peran-khusus');
  tambahLabel('Bos (Anda)', orangB, 0.05, 'peran-khusus');
  manager = { grup: orangM, layar: mejaM.layarMat, gelembung: tambahGelembung(orangM, 1.75, 'manager'), asal: orangM.position.clone() };
  bos = { grup: orangB, gelembung: tambahGelembung(orangB, 1.75), posisi: orangB.position.clone() };

  const kotakDunia = new THREE.Box3().setFromObject(dunia);
  kotakDunia.getCenter(pusat);
  const ukuran = kotakDunia.getSize(new THREE.Vector3());
  orbit.r = Math.max(10, Math.max(ukuran.x, ukuran.z) * 1.35);
  matahari.position.set(pusat.x + 8, 20, pusat.z + 10);
  matahari.target.position.copy(pusat);
  const s = Math.max(ukuran.x, ukuran.z);
  Object.assign(matahari.shadow.camera, { left: -s, right: s, top: s, bottom: -s, far: 80 });
  matahari.shadow.camera.updateProjectionMatrix();
  minta();
}

// ---------- kamera (seret & zoom, tanpa addon) ----------
const orbit = { theta: 0.35, phi: 0.95, r: 18 };
let seret = null;
kanvas.addEventListener('pointerdown', (e) => { seret = { x: e.clientX, y: e.clientY }; kanvas.setPointerCapture(e.pointerId); });
kanvas.addEventListener('pointermove', (e) => {
  if (!seret) return;
  orbit.theta -= (e.clientX - seret.x) * 0.005;
  orbit.phi = Math.min(1.4, Math.max(0.25, orbit.phi - (e.clientY - seret.y) * 0.005));
  seret = { x: e.clientX, y: e.clientY };
  minta();
});
kanvas.addEventListener('pointerup', () => { seret = null; });
kanvas.addEventListener('wheel', (e) => { e.preventDefault(); orbit.r = Math.min(80, Math.max(5, orbit.r * (1 + Math.sign(e.deltaY) * 0.1))); minta(); }, { passive: false });

// ---------- render hanya saat perlu (kantor diam = tidak ada gerakan) ----------
const tween = [];
let dijadwalkan = false;
function minta() { if (!dijadwalkan) { dijadwalkan = true; requestAnimationFrame(gambar); } }
const v = new THREE.Vector3();
function gambar(t) {
  dijadwalkan = false;
  for (let i = tween.length - 1; i >= 0; i--) {
    const tw = tween[i];
    const p = Math.min(1, (t - (tw.mulai ??= t)) / tw.lama);
    tw.langkah(p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2);
    if (p >= 1) { tween.splice(i, 1); tw.selesai && tw.selesai(); }
  }
  kamera.position.set(
    pusat.x + orbit.r * Math.sin(orbit.phi) * Math.sin(orbit.theta),
    orbit.r * Math.cos(orbit.phi),
    pusat.z + orbit.r * Math.sin(orbit.phi) * Math.cos(orbit.theta));
  kamera.lookAt(pusat);
  renderer.render(scene, kamera);
  const w = kanvas.clientWidth, h = kanvas.clientHeight;
  for (const l of label) {
    l.obj.getWorldPosition(v); v.y += l.dy; v.project(kamera);
    const tampak = v.z < 1;
    l.el.style.display = tampak ? '' : 'none';
    if (tampak) { l.el.style.left = ((v.x + 1) / 2 * w) + 'px'; l.el.style.top = ((1 - v.y) / 2 * h) + 'px'; }
  }
  if (tween.length) minta();
}
function ubahUkuran() {
  const w = kanvas.clientWidth, h = kanvas.clientHeight;
  renderer.setSize(w, h, false);
  kamera.aspect = w / h; kamera.updateProjectionMatrix();
  minta();
}
addEventListener('resize', ubahUkuran);

// ---------- reaksi terhadap aksi nyata ----------
function layar(m, nyala) {
  m.color.set(nyala ? 0xe0ecff : 0x1f2937);
  m.emissive.set(nyala ? 0x3b82f6 : 0x000000);
  m.emissiveIntensity = nyala ? 0.55 : 0;
  minta();
}
const namaFile = (f) => (f || '').split('/').pop();
const teksAksi = (a) => a.file ? `${a.kerja} · ${namaFile(a.file)}` : a.kerja;

function tampilkanAksi(a) {
  const k = karyawan.get(a.karyawan);
  if (!k) return;
  layar(k.layar, true);
  k.gelembung.textContent = teksAksi(a) + (a.eksternal ? ` · ${a.eksternal}` : '');
  k.gelembung.classList.toggle('eksternal', !!a.eksternal);
  k.gelembung.classList.add('tampil');
  clearTimeout(k.tHilang); clearTimeout(k.tMati);
  k.tHilang = setTimeout(() => k.gelembung.classList.remove('tampil'), 8000);
  k.tMati = setTimeout(() => layar(k.layar, false), 20000);
  minta();
}

function semuaDiam() {
  for (const k of karyawan.values()) {
    clearTimeout(k.tHilang); clearTimeout(k.tMati);
    k.gelembung.classList.remove('tampil');
    layar(k.layar, false);
  }
}

function managerMelapor(lap) {
  if (!manager) return;
  const ringkas = lap.jumlahAksi
    ? `Laporan: ${lap.jumlahAksi} aksi oleh ${lap.orang.length} orang${lap.eksternal.length ? ` · ${lap.eksternal.length} di luar folder` : ''}`
    : 'Laporan: tidak ada aksi alat';
  manager.gelembung.textContent = ringkas;
  manager.gelembung.classList.toggle('eksternal', lap.eksternal.length > 0);
  manager.gelembung.classList.add('tampil');
  layar(manager.layar, true);
  const dari = manager.asal.clone();
  const ke = bos.posisi.clone().add(new THREE.Vector3(-0.8, 0, 0.5));
  tween.push({ lama: 1400, langkah: (p) => manager.grup.position.lerpVectors(dari, ke, p), selesai: () => {
    bos.gelembung.textContent = 'Diterima';
    bos.gelembung.classList.add('tampil');
    setTimeout(() => {
      bos.gelembung.classList.remove('tampil');
      tween.push({ lama: 1400, langkah: (p) => manager.grup.position.lerpVectors(ke, dari, p), selesai: () => {
        layar(manager.layar, false);
        setTimeout(() => manager.gelembung.classList.remove('tampil'), 4000);
      } });
      minta();
    }, 2500);
  } });
  minta();
}

// ---------- panel kanan ----------
const elAkt = document.getElementById('aktivitas');
const elLap = document.getElementById('laporan');
const elStatus = document.getElementById('status');
const elStatusTeks = document.getElementById('status-teks');
let tim = { divisi: [] };
const namaKaryawan = (id) => { for (const d of tim.divisi || []) for (const k of d.karyawan || []) if (k.id === id) return k.nama; return null; };
const jam = (t) => new Date(t).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
function el(tag, kelas, teks) { const e = document.createElement(tag); if (kelas) e.className = kelas; if (teks != null) e.textContent = teks; return e; }
function kosongkan(ol) { const k = ol.querySelector('.kosong'); if (k) k.remove(); }

function status(jenis, teks) { elStatus.className = jenis; elStatusTeks.textContent = teks; }

function barisAksi(a, baru) {
  kosongkan(elAkt);
  const li = el('li', baru ? 'baru' : '');
  li.append(el('span', 'jam', jam(a.t)));
  const isi = el('span');
  const nama = namaKaryawan(a.karyawan);
  isi.append(el('span', 'siapa' + (nama ? '' : ' tanpa'), nama || 'tanpa pemilik'), el('span', '', teksAksi(a)));
  if (a.eksternal) { const b = el('span', 'lencana', 'LUAR'); b.title = a.eksternal; isi.append(b, el('span', 'jam', ' ' + a.eksternal)); }
  if (a.file) isi.title = a.file;
  li.append(isi);
  elAkt.prepend(li);
  if (baru) setTimeout(() => li.classList.remove('baru'), 50);
  while (elAkt.children.length > 200) elAkt.lastChild.remove();
}

function kartuLaporan(lap) {
  kosongkan(elLap);
  const li = el('li', lap.eksternal.length ? 'ada-eksternal' : '');
  const atas = el('div', 'lap-atas');
  atas.append(el('span', '', `Giliran #${lap.id} · ${jam(lap.t)}`), el('span', '', `${lap.jumlahAksi} aksi · ${lap.jumlahUbah} mengubah file`));
  li.append(atas);
  if (!lap.jumlahAksi) li.append(el('div', 'lap-orang', 'Tidak ada aksi alat di giliran ini (hanya menjawab).'));
  for (const o of lap.orang) {
    const d = el('div', 'lap-orang');
    d.append(el('span', 'siapa' + (o.karyawan ? '' : ' tanpa'), (namaKaryawan(o.karyawan) || o.nama) + ':'));
    d.append(document.createTextNode(o.kerja.map((k) => k.n > 1 ? `${k.label} (${k.n}×)` : k.label).join(', ')));
    li.append(d);
  }
  if (lap.eksternal.length) {
    const d = el('div', 'lap-eksternal', 'Mengubah sesuatu di luar folder ini:');
    for (const e of lap.eksternal) d.append(el('div', '', `${namaKaryawan(e.karyawan) || 'tanpa pemilik'} · ${e.jenis}${e.file ? ' · ' + e.file : ''}`));
    li.append(d);
  }
  elLap.prepend(li);
}

// ---------- koneksi ke server ----------
function sambung() {
  const es = new EventSource('/api/stream');
  es.onmessage = (m) => {
    const p = JSON.parse(m.data);
    if (p.jenis === 'awal') {
      tim = p.tim; bangun(tim);
      document.getElementById('nama-project').textContent = p.project || '';
      elAkt.innerHTML = ''; elLap.innerHTML = '';
      elAkt.append(el('li', 'kosong', 'Belum ada aksi tercatat.'));
      elLap.append(el('li', 'kosong', 'Belum ada laporan. Laporan muncul setiap kali agent selesai menjawab.'));
      for (const a of p.riwayat) barisAksi(a, false);
      for (const l of p.laporan) kartuLaporan(l);
      if (p.giliranBerjalan) status('kerja', `Sedang bekerja · ${p.giliranBerjalan} aksi di giliran ini`);
      else status('diam', 'Diam · tidak ada pekerjaan berjalan');
    } else if (p.jenis === 'tim') {
      tim = p.tim; bangun(tim);
    } else if (p.jenis === 'prompt') {
      status('kerja', 'Sedang bekerja · perintah baru diterima');
    } else if (p.jenis === 'aksi') {
      status('kerja', `Sedang bekerja · ${teksAksi(p.aksi)}`);
      barisAksi(p.aksi, true);
      tampilkanAksi(p.aksi);
    } else if (p.jenis === 'laporan') {
      kartuLaporan(p.laporan);
      status('diam', 'Diam · giliran selesai, laporan masuk');
      setTimeout(semuaDiam, 3000);
      managerMelapor(p.laporan);
    }
  };
  es.onerror = () => status('putus', 'Terputus dari server · mencoba lagi…');
}

ubahUkuran();
sambung();
