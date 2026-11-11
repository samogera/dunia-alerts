// The dashboard page, in one place for both doors:
//   demo  → written to demo.html by  node tools/build-pages.js  (open to everyone, example data only)
//   live  → sent by api/pilot.js to signed-in people only
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const TABS = [
  ['overview', 'Overview', '<rect x="4" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5"/>'],
  ['desk', 'School desk', '<path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1.5"/><path d="m9 14 2 2 4-4"/>'],
  ['parents', 'Parents', '<path d="M4 18V7a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3H8z"/><path d="M8.5 9h7M8.5 12.5h4.5"/>'],
  ['impact', 'Impact', '<path d="M4 20h16"/><rect x="6" y="11" width="3" height="6" rx="1"/><rect x="10.5" y="6" width="3" height="11" rx="1"/><rect x="15" y="13" width="3" height="4" rx="1"/>'],
  ['schools', 'Schools', '<path d="M3 20h18"/><path d="M5 20V10l7-5 7 5v10"/><path d="M10 20v-5h4v5"/>'],
];

function dashboard({ mode, user }) {
  const live = mode === 'live';
  const title = live ? 'Dunia Alerts · Pilot' : 'Dunia Alerts · Demo with example schools';
  const desc = live
    ? 'The Dunia Alerts pilot dashboard for the Dunia team.'
    : 'Try the Dunia Alerts dashboard with made-up schools and example data: early warnings for air, heat, rain and rivers at schools in Nairobi.';
  const tabs = TABS.map(([v, label, svg]) => `<button type="button" data-view="${v}"><svg viewBox="0 0 24 24" aria-hidden="true">${svg}</svg><span>${label}</span></button>`).join('\n      ');
  const end = live
    ? `<span class="who-chip" title="Signed in as ${esc(user)}"><span class="who-dot" aria-hidden="true"></span><span class="who-name">${esc(user)}</span></span>
      <button type="button" class="btn-ghost" data-signout>Sign out</button>`
    : `<span class="demo-chip">Demo · example data</span>
      <a class="btn-ghost" href="/login">Pilot sign in</a>`;
  return `<!doctype html>
<html lang="en" data-mode="${live ? 'live' : 'demo'}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${title}</title>
<meta name="description" content="${esc(desc)}">
${live ? '<meta name="robots" content="noindex, nofollow">' : '<link rel="canonical" href="https://alerts.duniaendelevu.org/demo">'}
${live ? `<meta name="da-user" content="${esc(user)}">` : ''}
<meta property="og:type" content="website">
<meta property="og:site_name" content="Dunia Alerts">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="https://alerts.duniaendelevu.org/og-image.png">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#F5F6F4">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<link rel="preload" href="/assets/fonts/inter-tight-latin-wght-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/assets/app.css">
</head>
<body>
<a class="skip" href="#view">Skip to content</a>
<div class="wrap">
  <header class="top">
    <a class="brand" href="/" aria-label="Dunia Alerts home">
      <span class="brand__mark" aria-hidden="true"></span>
      <span class="brand__name">Dunia <span class="brand__sub">Alerts</span></span>
    </a>
    <nav class="tabs" aria-label="Views">
      ${tabs}
    </nav>
    <div class="bar-end">
      ${end}
    </div>
  </header>
  <div class="${live ? 'note note--live' : 'note'}" id="note" role="status">${live
    ? '<span><span class="pulse" aria-hidden="true"></span><b>Live</b> · Loading live readings…</span>'
    : '<span><b>Practice</b> · Example schools and alerts for training. Nothing here is real.</span><button class="link" type="button" data-action="reset-demo">Start over</button>'}</div>
  <main id="view" tabindex="-1">
    <section class="card"><div class="empty"><h1 class="h">${live ? 'Pilot dashboard' : 'Dunia Alerts demo'}</h1><p>${live ? 'Loading your schools…' : 'Made-up schools and example data, so you can try every step safely.'}</p><noscript><p>The dashboard needs JavaScript. Read <a href="/">how Dunia Alerts works</a>.</p></noscript></div></section>
  </main>
  <footer class="foot">
    <span>A <a href="https://duniaendelevu.org/" rel="noopener">Dunia Endelevu</a> pilot, led by Alana Chelangat.</span>
    <span>Data: <a href="https://open-meteo.com/" target="_blank" rel="noopener">Open-Meteo</a> (weather, Copernicus CAMS air, GloFAS rivers), <a href="https://openaq.org/" target="_blank" rel="noopener">OpenAQ</a> sensors when connected. Air bands: US EPA AQI (2024).</span>
  </footer>
</div>
<div class="toast" id="toast" role="status" aria-live="polite"></div>
<input type="file" id="restoreFile" accept="application/json,.json" hidden>
<script src="/assets/config.js"></script>
<script src="/assets/app.js"></script>
</body>
</html>
`;
}

module.exports = { dashboard, esc };
