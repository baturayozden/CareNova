#!/usr/bin/env node
'use strict';

// Writes one secret into backend/.env. The key NAME comes from argv, the
// VALUE only ever from a no-echo prompt — so the secret never lands in the
// shell history, the process table (`ps` shows argv), or this script's output.
const fs = require('fs');
const path = require('path');

const ENV_PATH = path.resolve(__dirname, '..', '.env');
// Restricting the name to word characters is also what makes it safe to
// interpolate straight into the assignment regex below.
const KEY_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;
// Characters that dotenv reads correctly without quoting. A JWT, an sk-… key
// and a URL all fall inside this set; anything else gets JSON-quoted.
const BARE_VALUE = /^[A-Za-z0-9_.\-:/+=~@]+$/;

function assignmentRe(key) {
  return new RegExp(`^\\s*(?:export\\s+)?${key}\\s*=`);
}

function formatValue(value) {
  return BARE_VALUE.test(value) ? value : JSON.stringify(value);
}

function parseValue(line) {
  const raw = line.slice(line.indexOf('=') + 1).trim();
  if (raw.startsWith('"')) {
    try { return JSON.parse(raw); } catch { return raw; }
  }
  return raw;
}

// Reads without echoing. Raw mode is what actually silences the terminal;
// readline's line editing is not usable here because it echoes.
function readSecret(prompt) {
  return new Promise((resolve, reject) => {
    const { stdin } = process;

    if (!stdin.isTTY) {
      // Piped input (`… | node set-env.js KEY`) — nothing to echo, and it
      // keeps the script usable from a password manager's CLI.
      let buffer = '';
      stdin.setEncoding('utf8');
      stdin.on('data', (chunk) => { buffer += chunk; });
      stdin.on('end', () => resolve(buffer.split('\n')[0].trim()));
      return;
    }

    process.stderr.write(prompt);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');

    let value = '';
    const stop = () => {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.removeListener('data', onData);
      process.stderr.write('\n');
    };
    const onData = (chunk) => {
      // A paste arrives as one multi-character chunk, not one keystroke.
      for (const ch of chunk) {
        if (ch === '\r' || ch === '\n' || ch === '\u0004') { stop(); resolve(value); return; }
        if (ch === '\u0003') { stop(); reject(new Error('İptal edildi.')); return; }
        if (ch === '\u007f' || ch === '\b') { value = value.slice(0, -1); continue; }
        if (ch < ' ') continue;
        value += ch;
      }
    };
    stdin.on('data', onData);
  });
}

function writeAtomic(file, content) {
  const tmp = `${file}.tmp-${process.pid}`;
  try {
    fs.writeFileSync(tmp, content, { mode: 0o600 });
    fs.renameSync(tmp, file);
  } catch (err) {
    if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
    throw err;
  }
  fs.chmodSync(file, 0o600);
}

async function main() {
  const key = process.argv[2];
  if (!key || !KEY_NAME.test(key)) {
    process.stderr.write(
      'Kullanım: node backend/scripts/set-env.js <ANAHTAR_ADI>\n' +
      'Örnek:    node backend/scripts/set-env.js SUPABASE_SERVICE_ROLE_KEY\n\n' +
      'Değer argüman olarak VERİLMEZ — script gizli girdiyle sorar.\n',
    );
    process.exit(1);
  }

  const original = fs.existsSync(ENV_PATH) ? fs.readFileSync(ENV_PATH, 'utf8') : '';
  const lines = original.split('\n');
  const re = assignmentRe(key);
  const hits = [];
  lines.forEach((line, i) => {
    if (!line.trimStart().startsWith('#') && re.test(line)) hits.push(i);
  });

  // Two live definitions means we cannot know which one the app reads, so
  // guessing would be worse than stopping.
  if (hits.length > 1) {
    process.stderr.write(
      `${key} .env içinde ${hits.length} kez tanımlı (satır ${hits.map(i => i + 1).join(', ')}).\n` +
      'Hangisinin geçerli olduğu belirsiz — önce elle temizleyin. Hiçbir şey yazılmadı.\n',
    );
    process.exit(1);
  }

  const value = await readSecret(`${key} değeri (girdi görünmez, sonra Enter): `);
  if (!value) {
    process.stderr.write('Boş değer — hiçbir şey yazılmadı.\n');
    process.exit(1);
  }

  const assignment = `${key}=${formatValue(value)}`;
  let next;
  if (hits.length === 1) {
    lines[hits[0]] = assignment;          // yerinde güncelle: sıra ve yorumlar korunur
    next = lines.join('\n');
  } else if (original === '') {
    next = `${assignment}\n`;
  } else {
    next = original.endsWith('\n') ? `${original}${assignment}\n` : `${original}\n${assignment}\n`;
  }

  writeAtomic(ENV_PATH, next);
  process.stdout.write(`${key} yazıldı (uzunluk: ${value.length}, son 4: ****${value.slice(-4)})\n`);

  // Read back from disk rather than trusting what we just wrote.
  const after = fs.readFileSync(ENV_PATH, 'utf8').split('\n');
  const found = after.filter(line => !line.trimStart().startsWith('#') && re.test(line));
  if (found.length !== 1) {
    process.stderr.write(`DOĞRULAMA BAŞARISIZ: ${key} ${found.length} satırda görünüyor.\n`);
    process.exit(1);
  }
  const readBack = parseValue(found[0]);
  if (!readBack) {
    process.stderr.write(`DOĞRULAMA BAŞARISIZ: ${key} boş.\n`);
    process.exit(1);
  }
  if (readBack !== value) {
    process.stderr.write(`DOĞRULAMA BAŞARISIZ: ${key} diskte farklı okundu (uzunluk: ${readBack.length}).\n`);
    process.exit(1);
  }
  const mode = (fs.statSync(ENV_PATH).mode & 0o777).toString(8);
  process.stdout.write(`Doğrulandı: tek satır, dolu (uzunluk: ${readBack.length}), izin: ${mode}\n`);
}

main().catch((err) => {
  process.stderr.write(`${err.message}\n`);
  process.exit(1);
});
