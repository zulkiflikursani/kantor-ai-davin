#!/usr/bin/env node
// Memasang hook Kantor AI ke <folder-project>/.claude/settings.local.json.
// Salinan lama selalu disimpan dulu sebagai settings.local.json.bak-<waktu>.
'use strict';
const fs = require('fs');
const path = require('path');

const proj = path.resolve(process.argv[2] || process.cwd());
const hookPath = path.join(__dirname, 'catat.js');
const perintah = `node ${JSON.stringify(hookPath)}`;
const dir = path.join(proj, '.claude');
const file = path.join(dir, 'settings.local.json');

fs.mkdirSync(dir, { recursive: true });
const adaFile = fs.existsSync(file);
let cfg = adaFile ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
cfg.hooks = cfg.hooks || {};
let berubah = false;
const entri = { type: 'command', command: perintah, timeout: 5 };
for (const ev of ['PreToolUse', 'Stop', 'UserPromptSubmit']) {
  const daftar = (cfg.hooks[ev] = cfg.hooks[ev] || []);
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
