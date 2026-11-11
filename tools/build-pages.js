#!/usr/bin/env node
// Writes demo.html from the shared dashboard shell (api/_lib/shell.js). Run after changing the shell:
//   node tools/build-pages.js
const fs = require('fs');
const path = require('path');
const { dashboard } = require('../api/_lib/shell');

const out = path.join(__dirname, '..', 'demo.html');
fs.writeFileSync(out, dashboard({ mode: 'demo' }));
console.log('Wrote', path.relative(process.cwd(), out));
