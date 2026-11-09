#!/usr/bin/env node
// Make a secret key for one classroom sensor.
//   node tools/new-device.js <device_id> <room_id>
// Example: node tools/new-device.js dev-baraka-6a baraka-6a
//
// 1. Put the KEY on the sensor only (it sends it as "Authorization: Bearer <key>").
// 2. Add the LINE to DEVICE_KEYS in Vercel → Settings → Environment Variables (comma between devices). Redeploy.
// The server stores only the hash, so the key can't be read back. Lost it? Make a new one and replace the line.
const crypto = require('crypto');
const [id, room] = process.argv.slice(2);
const ok = (s) => /^[a-z0-9][a-z0-9-]{1,39}$/.test(s || '');
if (!ok(id) || !ok(room)) {
  console.error('Usage: node tools/new-device.js <device_id> <room_id>\nUse 2–40 lowercase letters, numbers or dashes, e.g. dev-baraka-6a baraka-6a');
  process.exit(1);
}
const key = 'dak_' + crypto.randomBytes(24).toString('base64url');
const hash = crypto.createHash('sha256').update(key).digest('hex');
console.log(`Device:  ${id}\nRoom:    ${room}\n\nKEY (put on the sensor, keep secret):\n  ${key}\n\nLINE (add to DEVICE_KEYS in Vercel):\n  ${id}:${room}:${hash}`);
