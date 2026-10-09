#!/usr/bin/env node
// Memasang hook Kantor AI ke <folder-project>/.claude/settings.local.json.
// Salinan lama selalu disimpan dulu sebagai settings.local.json.bak-<waktu>.
'use strict';
const fs = require('fs');
const path = require('path');

const proj = path.resolve(process.argv[2] || process.cwd());
if (!fs.existsSync(proj) || !fs.statSync(proj).isDirectory()) {
  console.error(`Folder project tidak ditemukan: ${proj}\nGanti dengan folder yang benar-benar ada, misalnya: ~/Desktop/PROJECT/proyek-saya`);
  process.exit(1);
}
const hookPath = path.join(__dirname, 'catat.js');
// Path node absolut: Devin CLI/Desktop dan Claude Code tidak selalu punya PATH
// yang sama dengan terminal (mis. node dari nvm), dan hook yang gagal dilewati diam-diam.
const perintah = `${JSON.stringify(process.execPath)} ${JSON.stringify(hookPath)}`;
const lama = (c) => /catat\.js"?$/.test(c || '') && c !== perintah;
const dir = path.join(proj, '.claude');
const file = path.join(dir, 'settings.local.json');

fs.mkdirSync(dir, { recursive: true });
const adaFile = fs.existsSync(file);
let cfg = adaFile ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
cfg.hooks = cfg.hooks || {};
let berubah = false;
const entri = { type: 'command', command: perintah, timeout: 5 };
for (const ev of ['PreToolUse', 'Stop', 'UserPromptSubmit']) {
  let daftar = (cfg.hooks[ev] = cfg.hooks[ev] || []);
  // Buang entri Kantor AI versi lama (perintah berbeda) supaya tidak tercatat dua kali.
  const sebelum = JSON.stringify(daftar);
  daftar = cfg.hooks[ev] = daftar
    .map((g) => ({ ...g, hooks: (g.hooks || []).filter((h) => !(h.command && h.command.includes(hookPath) && lama(h.command))) }))
    .filter((g) => g.hooks.length);
  if (JSON.stringify(daftar) !== sebelum) berubah = true;
  const sudahAda = daftar.some((g) => (g.hooks || []).some((h) => h.command === perintah));
  if (sudahAda) continue;
  berubah = true;
  daftar.push(ev === 'PreToolUse' ? { matcher: '*', hooks: [entri] } : { hooks: [entri] });
}
if (!berubah) { console.log('Hook sudah terpasang di', file, '- tidak ada yang diubah.'); process.exit(0); }
if (adaFile) {
  const cadangan = `${file}.bak-${new Date().toISOString().replace(/[:.]/g, '-')}`;
  fs.copyFileSync(file, cadangan);
  console.log('Salinan lama disimpan di', cadangan);
}
fs.writeFileSync(file, JSON.stringify(cfg, null, 2) + '\n');
console.log('Hook terpasang di', file);
console.log('Catatan akan ditulis ke', path.join(proj, '.kantor-ai', 'catatan.jsonl'));
