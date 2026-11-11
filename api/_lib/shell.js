// The dashboard page, in one place for both doors:
//   demo  → written to demo.html by  node tools/build-pages.js  (open to everyone, example data only)
//   live  → sent by api/pilot.js to signed-in people only
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const TABS = [
  ['overview', 'Overview', 'overview'],
  ['desk', 'School desk', 'desk'],
  ['parents', 'Parents', 'parents'],
  ['impact', 'Impact', 'impact'],
  ['schools', 'Schools', 'school'],
];

function dashboard({ mode, user }) {
  const live = mode === 'live';
  const title = live ? 'Dunia Alerts · Pilot' : 'Dunia Alerts · Demo with example schools';
  const desc = live
    ? 'The Dunia Alerts pilot dashboard for the Dunia team.'
    : 'Try the Dunia Alerts dashboard with made-up schools and example data: early warnings for air, heat, rain and rivers at schools in Nairobi.';
  const tabs = TABS.map(([v, label, ic]) => `<button type="button" data-view="${v}"><svg class="pi" aria-hidden="true"><use href="/assets/icons.svg#${ic}"/></svg><span>${label}</span></button>`).join('\n      ');
  const end = live
    ? `<a class="btn-soft" href="/pilot/signups"><svg class="pi" aria-hidden="true"><use href="/assets/icons.svg#learners"/></svg><span>Sign-ups</span></a>
      <span class="who-chip" title="Signed in as ${esc(user)}"><span class="who-dot" aria-hidden="true"></span><span class="who-name">${esc(user)}</span></span>
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
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="Dunia Alerts: early warnings that reach children at school, shown on a laptop.">
<meta property="og:locale" content="en_KE">
${live ? '' : '<meta property="og:url" content="https://alerts.duniaendelevu.org/demo">'}
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${title}">
<meta name="twitter:description" content="${esc(desc)}">
<meta name="twitter:image" content="https://alerts.duniaendelevu.org/og-image.png">
<meta name="theme-color" content="#F2F3F1">
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

// The team's list of "Join the pilot" replies. Sent by api/signups.js to signed-in people only.
function signups({ user }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Sign-ups · Dunia Alerts pilot</title>
<meta name="robots" content="noindex, nofollow">
<meta name="da-user" content="${esc(user)}">
<meta name="theme-color" content="#F2F3F1">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="preload" href="/assets/fonts/inter-tight-latin-wght-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/assets/app.css">
</head>
<body class="su-page">
<a class="skip" href="#su">Skip to content</a>
<div class="wrap">
  <header class="top top--su">
    <a class="brand" href="/" aria-label="Dunia Alerts home">
      <span class="brand__mark" aria-hidden="true"></span>
      <span class="brand__name">Dunia <span class="brand__sub">Alerts</span></span>
    </a>
    <a class="su-back" href="/pilot"><span aria-hidden="true">← </span>Pilot dashboard</a>
    <div class="bar-end">
      <span class="who-chip" title="Signed in as ${esc(user)}"><span class="who-dot" aria-hidden="true"></span><span class="who-name">${esc(user)}</span></span>
      <button type="button" class="btn-ghost" data-signout>Sign out</button>
    </div>
  </header>
  <main id="su" tabindex="-1">
    <section class="su-head">
      <div>
        <span class="label">Private · Dunia team only</span>
        <h1 class="h su-title">Pilot sign-ups</h1>
        <p class="muted">Replies from the <a href="/join">Join the pilot</a> form, newest first. Change the status as you go, and delete a reply when someone asks.</p>
      </div>
      <div class="su-actions">
        <button type="button" class="btn btn--ghost btn--sm" data-act="refresh">Refresh</button>
        <button type="button" class="btn btn--sm" data-act="csv" disabled>Download CSV</button>
      </div>
    </section>
    <div class="su-bar">
      <div class="seg su-filter" role="group" aria-label="Show"></div>
      <label class="su-search"><span class="sr">Search sign-ups</span><input class="input" id="q" type="search" placeholder="Search name, school, area…" autocomplete="off"></label>
    </div>
    <div id="list" aria-live="polite"><section class="card"><div class="empty"><p>Loading sign-ups…</p></div></section></div>
  </main>
</div>
<div class="toast" id="toast" role="status" aria-live="polite"></div>
<script src="/assets/signups.js"></script>
</body>
</html>
`;
}

module.exports = { dashboard, signups, esc };
