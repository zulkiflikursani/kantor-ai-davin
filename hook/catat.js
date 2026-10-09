#!/usr/bin/env node
// Hook Claude Code untuk Kantor AI.
// Hanya mencatat: waktu, jenis event, nama alat, path file yang disentuh, dan
// kategori aksi eksternal. Tidak pernah mencatat isi file, isi perintah, atau prompt.
// Selalu keluar dengan kode 0 dan tanpa output agar tidak mengganggu Claude Code.
'use strict';
const fs = require('fs');
const path = require('path');

const selesai = () => process.exit(0);
setTimeout(selesai, 2000).unref();
process.on('uncaughtException', selesai);

const EKSTERNAL_BASH = [
  ['deploy', /\b(deploy|vercel|netlify|firebase\s+deploy|fly\s+deploy|heroku|wrangler|kubectl\s+(apply|delete|rollout)|terraform\s+(apply|destroy)|serverless|sls\s+deploy|eb\s+deploy|gcloud\s+.*deploy|aws\s+\S+\s+(deploy|put|create|delete|update|sync|cp))\b/i],
  ['git push', /\bgit\s+push\b/i],
  ['publikasi paket', /\b(npm|yarn|pnpm)\s+publish\b|\btwine\s+upload\b|\bcargo\s+publish\b|\bgem\s+push\b/i],
  ['kirim email', /\b(sendmail|mailx?|mutt|msmtp|swaks)\b|smtp/i],
  ['PR/issue GitHub', /\bgh\s+(pr|issue|release|repo)\s+(create|merge|close|edit|delete|comment)\b/i],
  ['kirim data ke server', /\bcurl\b.*(-X\s*(POST|PUT|PATCH|DELETE)|--data|-d\s|-F\s|--form|--upload-file|-T\s)|\bwget\b.*--post|\b(scp|rsync|sftp)\b.*:|\bssh\s/i],
  ['docker push', /\bdocker\s+push\b/i],
];
const EKSTERNAL_MCP = /(send|post|publish|deploy|create|update|delete|remove|write|reply|forward|upload|merge|comment|message)/i;

function dalamFolder(proj, p) {
  const rel = path.relative(proj, p);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

function olah(raw) {
  const d = JSON.parse(raw || '{}');
  const proj = process.env.CLAUDE_PROJECT_DIR || d.cwd || process.cwd();
  const ev = d.hook_event_name || 'tidak_diketahui';
  const baris = { t: new Date().toISOString(), ev, sesi: d.session_id ? String(d.session_id).slice(0, 8) : undefined };

  if (ev === 'PreToolUse') {
    const alat = String(d.tool_name || '');
    const inp = d.tool_input || {};
    baris.alat = alat;
    const p = inp.file_path || inp.notebook_path || (['Glob', 'Grep', 'LS'].includes(alat) ? inp.path : undefined);
    if (typeof p === 'string' && p) {
      const abs = path.resolve(d.cwd || proj, p);
      if (dalamFolder(proj, abs)) baris.file = path.relative(proj, abs).split(path.sep).join('/') || '.';
      else { baris.file = abs; baris.luar = true; }
    }
    if (alat === 'Bash' && typeof inp.command === 'string') {
      for (const [kat, re] of EKSTERNAL_BASH) if (re.test(inp.command)) { baris.eksternal = kat; break; }
    } else if (alat.startsWith('mcp__') && EKSTERNAL_MCP.test(alat.split('__').pop())) {
      baris.eksternal = 'aksi lewat ' + alat.split('__')[1];
    }
    if (baris.luar && ['Write', 'Edit', 'MultiEdit', 'NotebookEdit'].includes(alat)) baris.eksternal = baris.eksternal || 'ubah file di luar folder';
  }

  const dir = path.join(proj, '.kantor-ai');
  // Sengaja tanpa {recursive:true}: di beberapa path (mis. /proc) opsi itu bisa macet.
  try { fs.mkdirSync(dir); } catch (e) { if (e.code !== 'EEXIST') return; }
  fs.appendFileSync(path.join(dir, 'catatan.jsonl'), JSON.stringify(baris) + '\n');
}

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (c) => { raw += c; });
process.stdin.on('end', () => { try { olah(raw); } catch (_) {} selesai(); });
process.stdin.on('error', selesai);
