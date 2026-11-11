#!/usr/bin/env node
// Add someone to the pilot sign-in.
//
//   node tools/new-user.js someone@example.org            makes a strong password and prints it once
//   node tools/new-user.js someone@example.org --ask      type your own password (at least 12 characters)
//   node tools/new-user.js --secret                       prints a new SESSION_SECRET
//
// Then in Vercel → Project → Settings → Environment Variables:
//   PILOT_USERS     add the printed line (one line per person; remove a line to remove someone)
//   SESSION_SECRET  set once; changing it signs everyone out
// and redeploy. Only the hash goes to Vercel: the password itself is shown here once and stored nowhere.
const crypto = require('crypto');
const readline = require('readline');
const { hashPassword, EMAIL } = require('../api/_lib/auth');

const args = process.argv.slice(2);

function strongPassword() {
  // 4 groups of 5 letters and digits, easy to read aloud (no 0/O, 1/l/I)
  const abc = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const pick = () => abc[crypto.randomInt(abc.length)];
  return Array.from({ length: 4 }, () => Array.from({ length: 5 }, pick).join('')).join('-');
}

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  return new Promise((resolve) => rl.question(question, (a) => { rl.close(); resolve(a); }));
}

(async () => {
  if (args[0] === '--secret') {
    console.log('SESSION_SECRET=' + crypto.randomBytes(32).toString('base64url'));
    return;
  }
  const email = String(args[0] || '').trim().toLowerCase();
  if (!EMAIL.test(email)) {
    console.error('Usage: node tools/new-user.js someone@example.org [--ask]   or   node tools/new-user.js --secret');
    process.exit(1);
  }
  let password = strongPassword();
  if (args.includes('--ask')) {
    password = await ask('Password (at least 12 characters): ');
    if (password.length < 12) { console.error('Too short.'); process.exit(1); }
  }
  const line = `${email}:${await hashPassword(password)}`;
  console.log('\nAdd this line to PILOT_USERS in Vercel:\n\n' + line + '\n');
  if (!args.includes('--ask')) console.log(`Password for ${email} (give it to them privately; it is not stored anywhere):\n\n${password}\n`);
})();
