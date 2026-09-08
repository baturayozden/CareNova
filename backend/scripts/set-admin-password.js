#!/usr/bin/env node
'use strict';

// Sets a user's password hash directly in the database — used to give the
// seeded super admin a real, known password (migration
// 016_roles_and_superadmin_seed.sql's commented password is no longer valid).
//
// The password is read from a no-echo prompt, NOT from ADMIN_PASSWORD and not
// from argv. Both of those land in the shell history verbatim: `HISTFILE`
// records the whole command line, so `ADMIN_PASSWORD='…' node …` is recorded
// exactly as literally as `node … '…'` would be. An env var is only better
// than an argument for hiding from OTHER users' `ps` output — it does nothing
// about history, which is the threat this script actually cares about.
// ADMIN_PASSWORD is still honoured as a non-interactive fallback (CI, piped
// input) so the script stays scriptable.
require('dotenv').config({ override: true });
const bcrypt = require('bcryptjs');
const { pool } = require('../src/db/index');

// Matches routes/admin.js, which is where platform (super_admin) users are
// otherwise created. auth.js's self-service password change uses 10.
const BCRYPT_ROUNDS = 12;
// Same floor the API enforces on password changes (auth.js).
const MIN_LENGTH = 8;

function readSecret(prompt) {
  return new Promise((resolve, reject) => {
    const { stdin } = process;

    if (!stdin.isTTY) {
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

async function main() {
  const email = (process.env.ADMIN_EMAIL || '').trim();
  if (!email) {
    process.stderr.write(
      'ADMIN_EMAIL gerekli.\n\n' +
      "Kullanım: cd backend && ADMIN_EMAIL=baturay@carenova.ai node scripts/set-admin-password.js\n" +
      'Şifre argüman/ortam değişkeni olarak VERİLMEZ — script gizli girdiyle sorar.\n',
    );
    process.exit(1);
  }

  // Confirm the account exists BEFORE asking for a password, so a typo in the
  // e-mail costs a re-run rather than a pointlessly typed secret.
  const { rows: found } = await pool.query(
    'SELECT id, email, is_active FROM users WHERE lower(email) = lower($1) AND deleted_at IS NULL',
    [email],
  );
  if (found.length === 0) {
    process.stderr.write(`Kullanıcı bulunamadı: ${email} (silinmemiş kayıtlar arasında yok). Hiçbir şey değişmedi.\n`);
    process.exit(1);
  }
  if (found.length > 1) {
    process.stderr.write(`${email} için ${found.length} kayıt var — hangisi olduğu belirsiz. Hiçbir şey değişmedi.\n`);
    process.exit(1);
  }
  if (!found[0].is_active) {
    process.stderr.write(`UYARI: ${email} pasif (is_active=false). Şifre yine de güncellenecek ama giriş yapamayabilir.\n`);
  }

  const password = process.env.ADMIN_PASSWORD
    || await readSecret(`${email} için yeni şifre (girdi görünmez, sonra Enter): `);

  if (!password) {
    process.stderr.write('Boş şifre — hiçbir şey değişmedi.\n');
    process.exit(1);
  }
  if (password.length < MIN_LENGTH) {
    process.stderr.write(`Şifre en az ${MIN_LENGTH} karakter olmalı — hiçbir şey değişmedi.\n`);
    process.exit(1);
  }

  const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const { rowCount } = await pool.query(
    'UPDATE users SET password_hash = $1, updated_at = now() WHERE id = $2',
    [hash, found[0].id],
  );
  if (rowCount !== 1) {
    process.stderr.write(`Beklenmeyen sonuç: ${rowCount} satır güncellendi. Kontrol edin.\n`);
    process.exit(1);
  }

  // Prove the stored hash actually validates the password, so a silent
  // encoding/truncation problem cannot masquerade as success.
  const { rows: after } = await pool.query('SELECT password_hash FROM users WHERE id = $1', [found[0].id]);
  const verified = await bcrypt.compare(password, after[0].password_hash);
  if (!verified) {
    process.stderr.write('DOĞRULAMA BAŞARISIZ: yazılan hash şifreyi doğrulamıyor.\n');
    process.exit(1);
  }

  process.stdout.write(`${email} şifresi güncellendi (bcrypt, ${BCRYPT_ROUNDS} round) ve doğrulandı.\n`);
}

main()
  .catch((err) => {
    process.stderr.write(`${err.message}\n`);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
