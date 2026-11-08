/* Dunia Alerts: early warning for schools. A Dunia Endelevu pilot.
   Plain JavaScript, no build step. Demo mode runs on example data; Live mode fetches real
   readings from Open-Meteo and keeps the pilot's records on this device (with backup and restore). */
(() => {
'use strict';
const CFG = Object.assign({ schools: [], refreshMinutes: 15, thresholds: {} }, window.DUNIA_ALERTS_CONFIG || {});
const TH = Object.assign({ pm25: 35.5, rainMm: 30, heatC: 30 }, CFG.thresholds || {});
const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const MIN = 60000, HOUR = 3600000, DAY = 86400000;

/* ---------- Levels: PM2.5 bands (US EPA AQI, 2024) and weather warnings ---------- */
const AIR = [
  { k: 'good', label: 'Good', lo: 0, hi: 9.0, alo: 0, ahi: 50, c: 'var(--aq-good)', hex: '#3BAE6E',
    step: 'No change. Normal outdoor activities.' },
  { k: 'moderate', label: 'Moderate', lo: 9.1, hi: 35.4, alo: 51, ahi: 100, c: 'var(--aq-moderate)', hex: '#D9B22F',
    step: 'Normal activities. Pupils with asthma or breathing problems take it easy during hard outdoor exercise.' },
  { k: 'usg', label: 'Unhealthy for sensitive groups', short: 'Sensitive groups', lo: 35.5, hi: 55.4, alo: 101, ahi: 150, c: 'var(--aq-usg)', hex: '#EE8424',
    step: 'Review hard outdoor activities, especially for pupils with asthma or breathing problems, following the school’s health rules.' },
  { k: 'unhealthy', label: 'Unhealthy', lo: 55.5, hi: 125.4, alo: 151, ahi: 200, c: 'var(--aq-unhealthy)', hex: '#DD4339',
    step: 'Move PE and games indoors or shorten them. Keep vulnerable pupils indoors and inform parents.' },
  { k: 'very', label: 'Very unhealthy', lo: 125.5, hi: 225.4, alo: 201, ahi: 300, c: 'var(--aq-very)', hex: '#8A4CCB',
    step: 'Hold PE, games and assemblies indoors. Keep windows facing busy roads closed. Inform parents.' },
  { k: 'hazardous', label: 'Hazardous', lo: 225.5, hi: 325.4, alo: 301, ahi: 500, c: 'var(--aq-hazardous)', hex: '#7A1D2C',
    step: 'Keep all pupils indoors and follow the head teacher’s emergency plan. Inform parents.' },
];
const WEATHER = {
  rain: { k: 'rain', label: 'Heavy rain warning', c: 'var(--rain)', hex: '#3B78D4',
    step: 'Keep pupils away from drains and flooded areas. Plan a safe, early release if roads flood; pupils go home only with a parent or guardian.' },
  heat: { k: 'heat', label: 'Very hot day', c: 'var(--heat)', hex: '#E5602A',
    step: 'Add water breaks, keep break time in the shade and move PE to the early morning.' },
};
const ACTIONS = {
  air: ['PE moved indoors', 'Outdoor break shortened', 'Pupils with asthma kept indoors', 'Windows facing the road closed', 'Assembly held indoors'],
  rain: ['Pupils kept away from drains', 'Early release to parents', 'Outdoor lessons cancelled', 'Paths checked before home time'],
  heat: ['Water breaks added', 'PE moved to early morning', 'Break time in the shade'],
};
const RESULTS = ['Done, no pupils affected', 'Done, some pupils needed care', 'Needs partner help'];
const HZ = { air: ['Air', '#17483B'], rain: ['Heavy rain', 'var(--rain)'], heat: ['Heat', 'var(--heat)'] };
const r1 = (x) => Math.round(x * 10) / 10;
const airBand = (pm) => { const v = r1(pm); return AIR.find((b) => v <= b.hi) || AIR[AIR.length - 1]; };
const aqi = (pm) => { const v = r1(pm); if (v > 325.4) return 500; const b = airBand(v); return Math.round((b.ahi - b.alo) / (b.hi - b.lo) * (v - b.lo) + b.alo); };
const hazardOf = (a) => a.hazard === 'air' ? (AIR.find((b) => b.k === a.level) || AIR[2]) : WEATHER[a.hazard];
const short = (h) => h.short || h.label;
const AREAS = [
  ['Kibera', -1.3125, 36.786], ['Mukuru kwa Njenga', -1.315, 36.879], ['Industrial Area', -1.305, 36.848], ['Kasarani', -1.221, 36.898],
  ['Westlands', -1.265, 36.803], ['Kayole', -1.276, 36.912], ['Dagoretti', -1.296, 36.723], ['Eastleigh', -1.274, 36.85],
  ['Embakasi', -1.322, 36.9], ['Kawangware', -1.284, 36.746], ['Mathare', -1.26, 36.857], ['Lang’ata', -1.335, 36.76],
  ['Ruaraka', -1.243, 36.876], ['Kangemi', -1.264, 36.75], ['Donholm', -1.296, 36.887], ['South B', -1.311, 36.835],
  ['Githurai', -1.198, 36.912], ['Kariobangi', -1.255, 36.882], ['Karen', -1.319, 36.707], ['Parklands', -1.26, 36.818],
].sort((a, b) => a[0].localeCompare(b[0]));
const areaByName = (n) => AREAS.find((a) => a[0] === n);

/* ---------- Icons ---------- */
const ICONS = {
  air: '<path d="M5 8h8.5a2.5 2.5 0 1 0-2.34-3.24"/><path d="M3 12h15.5a2.5 2.5 0 1 1-2.34 3.24"/><path d="M4 16h5.5a2.5 2.5 0 1 1-2.34 3.24"/>',
  rain: '<path d="M7 18a4.6 4.4 0 0 1 0-9 5 4.5 0 0 1 11 2h1a3.5 3.5 0 0 1 0 7"/><path d="M11 13v2m0 3v2m4-5v2m0 3v2"/>',
  heat: '<path d="M10 13.5a4 4 0 1 0 4 0V5a2 2 0 0 0-4 0v8.5"/><path d="M10 9h4"/>',
  bell: '<path d="M10 5a2 2 0 1 1 4 0 7 7 0 0 1 4 6v3a4 4 0 0 0 2 3H4a4 4 0 0 0 2-3v-3a7 7 0 0 1 4-6"/><path d="M9 17v1a3 3 0 0 0 6 0v-1"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
  down: '<path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/><path d="m7 11 5 5 5-5"/><path d="M12 4v12"/>',
  up: '<path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/><path d="m7 9 5-5 5 5"/><path d="M12 4v12"/>',
  phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/>',
  chat: '<path d="M3 20l1.3-3.9A9 8 0 1 1 7.7 19L3 20"/>',
  sms: '<path d="M4 18V7a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3H8z"/><path d="M8.5 9h7M8.5 12.5h4.5"/>',
  refresh: '<path d="M20 11A8.1 8.1 0 0 0 4.5 9M4 5v4h4"/><path d="M4 13a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
};
const icon = (n) => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[n] || ''}</svg>`;
const hzMark = (a) => { const h = hazardOf(a); return `<span class="hz" style="--c:${h.c}">${icon(a.hazard)}</span>`; };
const chip = (c, text) => `<span class="lvl" style="--c:${c}">${esc(text)}</span>`;

/* ---------- Time ---------- */
const fmtTime = (t) => new Date(t).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
const fmtDay = (t) => new Date(t).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
const fmtDate = (t) => new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
const sameDay = (a, b) => new Date(a).toDateString() === new Date(b).toDateString();
const fmtWhen = (t, now) => sameDay(t, now) ? 'Today, ' + fmtTime(t) : fmtDay(t) + ', ' + fmtTime(t);
const dayStart = (t) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
const mins = (a, b) => Math.max(0, Math.round((b - a) / MIN));
const median = (xs) => { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b), m = s.length >> 1; return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2); };
const pct = (a, b) => b ? Math.round(a / b * 100) : 0;

/* ---------- Demo: eight fictional schools in real Nairobi neighbourhoods, six weeks of example alerts ---------- */
function mulberry(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function demoClock() { const d = new Date(); d.setHours(8, 12, 0, 0); while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() - 1); return d.getTime(); }
function buildDemo() {
  const rnd = mulberry(20261108);
  const gauss = () => { let u = 0, v = 0; while (!u) u = rnd(); while (!v) v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  const pick = (xs) => xs[Math.floor(rnd() * xs.length)];
  const now = demoClock();
  const schools = [
    { id: 's1', name: 'Tumaini Primary School', area: 'Kibera', lat: -1.3125, lng: 36.786, pupils: 1240, base: 33, floods: true, phone: '' },
    { id: 's2', name: 'Neema Junior School', area: 'Mukuru kwa Njenga', lat: -1.315, lng: 36.879, pupils: 960, base: 45, floods: true, phone: '' },
    { id: 's3', name: 'Viwanda Road Primary', area: 'Industrial Area', lat: -1.305, lng: 36.848, pupils: 720, base: 50, phone: '' },
    { id: 's4', name: 'Kasarani Hill Academy', area: 'Kasarani', lat: -1.221, lng: 36.898, pupils: 540, base: 21, phone: '' },
    { id: 's5', name: 'Mvuli Park Primary', area: 'Westlands', lat: -1.265, lng: 36.803, pupils: 610, base: 18, phone: '' },
    { id: 's6', name: 'Upendo Primary School', area: 'Kayole', lat: -1.276, lng: 36.912, pupils: 1380, base: 37, floods: true, phone: '' },
    { id: 's7', name: 'Mlima Primary School', area: 'Dagoretti', lat: -1.296, lng: 36.723, pupils: 830, base: 23, phone: '' },
    { id: 's8', name: 'Amani Crescent Primary', area: 'Eastleigh', lat: -1.274, lng: 36.85, pupils: 1100, base: 40, floods: true, phone: '' },
  ];
  const start = (() => { const d = new Date(now - 41 * DAY); d.setHours(0, 0, 0, 0); while (d.getDay() !== 1) d.setDate(d.getDate() - 1); return d.getTime(); })();
  const today = dayStart(now);
  const days = [];
  for (let t = start; t < today; t += DAY) { const g = new Date(t).getDay(); if (g > 0 && g < 6) days.push(t); }
  const rainsFrom = start + 22 * DAY;                         // the short rains arrive in the fourth week
  const wetDays = days.filter((t) => t >= rainsFrom);
  const rainDays = [wetDays[1], wetDays[5], wetDays[8], wetDays[12]].filter(Boolean);
  const heatDay = days[6];
  const alerts = []; let n = 101;
  const roles = ['Head teacher', 'Deputy head teacher', 'Senior teacher'];
  const settle = (a, slow) => {
    const endOfDay = a.raisedAt + 8 * HOUR;
    if (rnd() > (slow ? 0.86 : 0.94)) { a.closedAt = endOfDay; a.result = 'No response'; return a; }
    const m = Math.min(170, Math.max(2, Math.round(Math.exp(Math.log(slow ? 18 : 10) + gauss() * 0.7))));
    a.ackAt = a.raisedAt + m * MIN; a.ackBy = pick(roles);
    if (rnd() < 0.9) {
      const opts = ACTIONS[a.hazard];
      a.actions = [...new Set(Array.from({ length: 1 + (rnd() < 0.35 ? 1 : 0) }, () => pick(opts)))];
      a.actionAt = a.ackAt + Math.round(6 + rnd() * 30) * MIN;
      if (rnd() < (a.hazard === 'rain' ? 0.95 : 0.74)) a.parentsAt = a.actionAt + Math.round(4 + rnd() * 25) * MIN;
      const r = rnd();
      a.result = a.hazard === 'rain' && r > 0.9 ? RESULTS[2] : (a.hazard === 'air' && r > 0.84 ? RESULTS[1] : RESULTS[0]);
      if (a.result === RESULTS[2]) a.note = 'Water entered two classrooms; asked the county for help clearing the drain.';
      a.closedAt = (a.parentsAt || a.actionAt) + Math.round(30 + rnd() * 200) * MIN;
    } else { a.closedAt = endOfDay; a.result = 'No action recorded'; }
    return a;
  };
  const mk = (s, hazard, level, value, raisedAt, step) => ({ id: 'd' + n, ref: 'DA-' + (n++), schoolId: s.id, schoolName: s.name, hazard, level, value, raisedAt, step, actions: [] });
  days.forEach((t, i) => {
    const wet = t >= rainsFrom;
    const swing = 1 + 0.22 * Math.sin(i / 2.3);
    schools.forEach((s) => {
      const pm = r1(s.base * (wet ? 0.74 : 1) * swing * Math.exp(gauss() * 0.2) * 1.08);
      if (pm >= 35.5 && rnd() < 0.55) { const b = airBand(pm); alerts.push(settle(mk(s, 'air', b.k, pm, t + (7 * 60 + 15 + Math.floor(rnd() * 35)) * MIN, b.step))); }
    });
    if (rainDays.includes(t)) schools.filter((s) => s.floods || rnd() < 0.25).forEach((s) => alerts.push(settle(mk(s, 'rain', 'rain', null, t + (10 * 60 + 20 + Math.floor(rnd() * 25)) * MIN, WEATHER.rain.step))));
    if (t === heatDay) schools.filter((s) => ['s1', 's2', 's3', 's6', 's8'].includes(s.id)).forEach((s) => alerts.push(settle(mk(s, 'heat', 'heat', 29.6, t + (6 * 60 + 55 + Math.floor(rnd() * 10)) * MIN, WEATHER.heat.step), true)));
  });
  const at = (h, m) => today + (h * 60 + m) * MIN;
  alerts.push(Object.assign(mk(schools[7], 'air', 'usg', 44.2, at(7, 30), AIR[2].step), { ackAt: at(7, 36), ackBy: 'Head teacher', actions: ['PE moved indoors'], actionAt: at(7, 50) }));
  alerts.push(mk(schools[2], 'air', 'usg', 48.6, at(7, 38), AIR[2].step));
  alerts.push(Object.assign(mk(schools[1], 'air', 'unhealthy', 61.2, at(7, 41), AIR[3].step), { ackAt: at(7, 52), ackBy: 'Deputy head teacher' }));
  const nowPm = { s1: 31.4, s2: 61.2, s3: 48.6, s4: 15.9, s5: 13.8, s6: 33.2, s7: 20.6, s8: 44.2 };
  const rainToday = { s1: 34, s2: 18, s3: 14, s4: 9, s5: 11, s6: 16, s7: 12, s8: 15 };
  const readings = {};
  schools.forEach((s) => {
    const hist = [];
    for (let k = 23; k >= 0; k--) {
      const h = new Date(now - k * HOUR).getHours() + 0.2;
      const shape = 0.72 + 0.5 * Math.exp(-((h - 8) ** 2) / 3) + 0.38 * Math.exp(-((h - 19.5) ** 2) / 4) - (h > 1 && h < 5 ? 0.12 : 0);
      hist.push(r1(nowPm[s.id] / 1.2 * shape * Math.exp(gauss() * 0.08)));
    }
    hist[23] = nowPm[s.id];
    readings[s.id] = { pm25: nowPm[s.id], at: now - 4 * MIN, history: hist, tempMax: 25 + Math.round(rnd() * 2), rainMm: rainToday[s.id], rainChance: 60 + Math.round(rnd() * 25), source: 'demo' };
  });
  alerts.sort((a, b) => b.raisedAt - a.raisedAt);
  return { now, start, schools: schools.map(({ base, floods, ...s }) => s), readings, alerts };
}

/* ---------- Saving on this device ---------- */
const KEY = 'dunia-alerts:v1', PREF = 'dunia-alerts:prefs';
let storageOk = true;
const read = (k) => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { storageOk = false; return null; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { storageOk = false; return false; } };
function normSchool(s, i = 0) {
  if (!s || !String(s.name || '').trim()) return null;
  const a = areaByName(s.area) || AREAS[0];
  const lat = Number(s.lat), lng = Number(s.lng);
  const pupils = parseInt(s.pupils, 10);
  return { id: String(s.id || 's' + Date.now().toString(36) + i + Math.random().toString(36).slice(2, 6)), name: String(s.name).trim().slice(0, 80), area: a[0],
    lat: Number.isFinite(lat) && s.lat !== '' && s.lat != null ? lat : a[1], lng: Number.isFinite(lng) && s.lng !== '' && s.lng != null ? lng : a[2],
    pupils: Number.isFinite(pupils) && pupils >= 0 ? pupils : null, phone: String(s.phone || '').slice(0, 24) };
}
function initLive() {
  const saved = read(KEY);
  if (saved && Array.isArray(saved.schools)) return { schools: saved.schools, alerts: Array.isArray(saved.alerts) ? saved.alerts : [], readings: saved.readings || {}, updatedAt: saved.updatedAt || null, seq: saved.seq || 100 };
  return { schools: (CFG.schools || []).map(normSchool).filter(Boolean), alerts: [], readings: {}, updatedAt: null, seq: 100 };
}
let live = initLive();
function saveLive() { if (!write(KEY, live)) toast('This browser isn’t saving. Download a backup from Schools before you close the page.'); }
const prefs = read(PREF) || {};

/* ---------- State ---------- */
const VIEWS = ['overview', 'desk', 'parents', 'impact', 'schools'];
const state = {
  mode: prefs.mode === 'live' || prefs.mode === 'demo' ? prefs.mode : (live.schools.length ? 'live' : 'demo'),
  view: 'overview', schoolId: null, alertId: null, panel: null, filter: 'open', showAll: false, channel: 'sms',
  editing: null, removing: null, fetching: false, fetchError: false, dismissed: new Set(), demo: buildDemo(),
  draft: { hazard: 'air', value: '', step: '', actions: [], note: '', result: '' },
};
function data() {
  if (state.mode === 'demo') { const d = state.demo; return { now: d.now, start: d.start, schools: d.schools, readings: d.readings, alerts: d.alerts }; }
  const times = live.alerts.map((a) => a.raisedAt);
  return { now: Date.now(), start: times.length ? Math.min(...times) : Date.now(), schools: live.schools, readings: live.readings, alerts: live.alerts };
}
const schoolById = (id) => data().schools.find((s) => s.id === id);
const schoolName = (a) => (schoolById(a.schoolId) || {}).name || a.schoolName || 'Removed school';
const openAlertFor = (sid) => data().alerts.find((a) => a.schoolId === sid && !a.closedAt);
const statusOf = (a) => a.closedAt ? (a.ackAt ? 'closed' : 'missed') : a.actionAt ? 'acted' : a.ackAt ? 'acknowledged' : 'waiting';
const STATUS = { waiting: ['Waiting for reply', 'var(--wait)'], acknowledged: ['Acknowledged', 'var(--sun)'], acted: ['Action recorded', 'var(--rain)'], closed: ['Closed', 'var(--ok)'], missed: ['No response', 'var(--bad)'] };
const statusEl = (a) => { const [t, c] = STATUS[statusOf(a)]; return `<span class="status"><span class="dot" style="background:${c}"></span>${t}</span>`; };
function reading(rd, now) {
  if (!rd) return null;
  if (rd.monitor && now - rd.monitor.at < 3 * HOUR) return { value: rd.monitor.pm25, at: rd.monitor.at, source: 'AirQo monitor, entered by the team' };
  if (rd.pm25 == null) return null;
  return { value: rd.pm25, at: rd.at, source: rd.source === 'demo' ? 'Example reading' : 'Model estimate, Open-Meteo' };
}
function ensureSchool(d) {
  if (schoolById(state.schoolId)) return;
  const open = d.alerts.find((a) => !a.closedAt && schoolById(a.schoolId));
  state.schoolId = open ? open.schoolId : (d.schools[0] || {}).id || null;
}
function stats(alerts, schools) {
  const acked = alerts.filter((a) => a.ackAt);
  const ackMins = acked.map((a) => mins(a.raisedAt, a.ackAt));
  const acted = alerts.filter((a) => a.actionAt);
  const pupils = acted.reduce((sum, a) => sum + ((schools.find((s) => s.id === a.schoolId) || {}).pupils || 0), 0);
  return { total: alerts.length, ackRate: pct(acked.length, alerts.length), medAck: median(ackMins), actRate: pct(acted.length, alerts.length), toldRate: pct(alerts.filter((a) => a.parentsAt).length, alerts.length), pupils, ackMins };
}
function suggestions(d) {
  const out = []; const t0 = dayStart(d.now);
  const raisedToday = (sid, hz) => d.alerts.some((a) => a.schoolId === sid && a.hazard === hz && a.raisedAt >= t0);
  d.schools.forEach((s) => {
    const rd = d.readings[s.id]; if (!rd) return;
    const pm = reading(rd, d.now);
    if (pm && pm.value >= TH.pm25 && !d.alerts.some((a) => a.schoolId === s.id && a.hazard === 'air' && !a.closedAt) && !raisedToday(s.id, 'air')) out.push({ s, hazard: 'air', value: pm.value, text: `PM2.5 ${pm.value} µg/m³ · ${short(airBand(pm.value))}` });
    if (rd.rainMm != null && rd.rainMm >= TH.rainMm && !raisedToday(s.id, 'rain')) out.push({ s, hazard: 'rain', value: rd.rainMm, text: `${r1(rd.rainMm)} mm of rain expected today` });
    if (rd.tempMax != null && rd.tempMax >= TH.heatC && !raisedToday(s.id, 'heat')) out.push({ s, hazard: 'heat', value: rd.tempMax, text: `High of ${Math.round(rd.tempMax)}°C today` });
  });
  return out.filter((x) => !state.dismissed.has(state.mode + x.s.id + x.hazard));
}

/* ---------- Rendering ---------- */
const busy = () => { const el = document.activeElement; return el && $('#view').contains(el) && el.matches('input, textarea, select'); };
function render(soft) {
  document.querySelectorAll('[data-view]').forEach((b) => { if (b.dataset.view === state.view) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
  document.querySelectorAll('.modes [data-mode]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === state.mode)));
  renderNote();
  if (soft && busy()) return;
  const fn = { overview: viewOverview, desk: viewDesk, parents: viewParents, impact: viewImpact, schools: viewSchools }[state.view];
  $('#view').innerHTML = fn();
}
function renderNote() {
  const n = $('#note');
  const saving = storageOk ? '' : ' This browser isn’t saving: download a backup from Schools.';
  if (state.mode === 'demo') {
    n.className = 'note';
    n.innerHTML = `<span><b>Demo</b> · Example data, not real pilot results.</span><button class="link" type="button" data-action="reset-demo">Reset</button>`;
  } else if (!live.schools.length) {
    n.className = 'note note--live';
    n.innerHTML = `<span><b>Live</b> · Add your pilot schools to start.${saving}</span>`;
  } else {
    n.className = 'note ' + (state.fetchError || !storageOk ? 'note--warn' : 'note--live');
    const when = state.fetching ? 'Updating readings…' : state.fetchError ? `Couldn’t reach the readings service.${live.updatedAt ? ' Showing readings from ' + fmtWhen(live.updatedAt, Date.now()) + '.' : ''}` : live.updatedAt ? `Readings updated ${fmtWhen(live.updatedAt, Date.now()).replace('Today, ', 'at ')}` : 'Readings not loaded yet';
    n.innerHTML = `<span><b>Live</b> · ${esc(when)}${saving}</span>${state.fetching ? '' : '<button class="link" type="button" data-action="refresh">Refresh</button>'}`;
  }
}
function emptyLive() {
  return `<section class="card"><div class="empty"><span class="h">No pilot schools yet</span><span>Add the schools in the pilot. Live air and weather readings start straight away.</span><button class="btn" type="button" data-goto="schools">${icon('plus')}Add a school</button><button class="link" type="button" data-mode="demo">Or explore the demo</button></div></section>`;
}
const tile = (label, value, sub) => `<div class="tile"><span class="label">${label}</span><span class="tile__value num">${value}</span><span class="tile__sub">${sub}</span></div>`;

/* ----- Overview ----- */
function viewOverview() {
  const d = data();
  if (!d.schools.length) return emptyLive();
  ensureSchool(d);
  return statTiles(d) + suggestCard(d)
    + `<div class="grid-main grid-main--fill"><section class="card card--map">${mapCard(d)}</section><aside class="card" id="side">${state.panel === 'raise' ? raiseForm() : schoolPanel()}</aside></div>`
    + recentCard(d);
}
function statTiles(d) {
  const open = d.alerts.filter((a) => !a.closedAt); const waiting = open.filter((a) => !a.ackAt).length;
  let worst = null;
  d.schools.forEach((s) => { const r = reading(d.readings[s.id], d.now); if (r && (!worst || r.value > worst.value)) worst = { ...r, s }; });
  const rds = d.schools.map((s) => d.readings[s.id]).filter(Boolean);
  const maxOf = (k) => { const xs = rds.map((r) => r[k]).filter((x) => x != null); return xs.length ? Math.max(...xs) : null; };
  const tMax = maxOf('tempMax'), rMm = maxOf('rainMm'), rCh = maxOf('rainChance');
  const st = stats(d.alerts, d.schools);
  return `<section class="stats">
    ${tile('Open alerts', open.length, open.length ? (waiting ? `${waiting} waiting for a reply` : 'All acknowledged') : 'All clear')}
    ${tile('Worst air now', worst ? `${aqi(worst.value)} <small>AQI</small>` : '–', worst ? `${esc(short(airBand(worst.value)))} · ${esc(worst.s.area)}` : 'No readings yet')}
    ${tile('Weather today', tMax != null ? `${Math.round(tMax)}° <small>high</small>` : '–', tMax != null ? `Rain ${rCh != null ? rCh + '%' : '–'} · up to ${rMm != null ? r1(rMm) : '–'} mm` : 'No forecast yet')}
    ${tile('Time to respond', st.medAck != null ? `${st.medAck} <small>min</small>` : '–', st.total ? `Median · ${st.ackRate}% of ${st.total} alerts acknowledged` : 'No alerts yet')}
  </section>`;
}
function suggestCard(d) {
  const xs = suggestions(d);
  if (!xs.length) return '';
  return `<section class="card"><div class="card__head"><h2 class="card__title">Suggested alerts</h2><span class="muted">From today’s readings. Check them, then send.</span></div>
    ${xs.map((x) => `<div class="suggest"><span class="hz" style="--c:${x.hazard === 'air' ? airBand(x.value).c : WEATHER[x.hazard].c}">${icon(x.hazard)}</span>
      <span class="arow__main"><b>${esc(x.s.name)}</b><span>${esc(x.text)}</span></span>
      <span class="btns"><button class="btn btn--sm" type="button" data-action="review" data-id="${esc(x.s.id)}" data-v="${x.hazard}" data-val="${x.hazard === 'rain' ? '' : r1(x.value)}">Review</button><button class="btn btn--sm btn--quiet" type="button" data-action="dismiss" data-id="${esc(x.s.id)}" data-v="${x.hazard}">Dismiss</button></span></div>`).join('')}</section>`;
}
function mapCard(d) {
  const open = d.alerts.filter((a) => !a.closedAt).length;
  return `<div class="card__head"><h2 class="card__title">Air at each school now</h2><span class="muted">Column height is PM2.5, µg/m³${open ? ` · <span style="color:var(--wait)">●</span> open alert` : ''}</span></div>
    <div class="mapbox">${mapSVG(d)}</div>
    <div class="keys" aria-label="Air quality bands">${AIR.slice(0, 5).map((b) => `<span><i style="background:${b.c}"></i>${esc(short(b))}</span>`).join('')}</div>`;
}

/* Schematic map: schools spread west to east, north at the back. Columns never share a slot. */
const ISO = { A: 34, B: 17 };
const iso = (u, v, z = 0) => [(u - v) * ISO.A, (u + v) * ISO.B - z];
const P = (pts) => pts.map((p) => p.map((x) => x.toFixed(1)).join(',')).join(' ');
function shade(hex, f) { const n = parseInt(hex.slice(1), 16); const ch = (s) => Math.max(0, Math.min(255, Math.round(((n >> s) & 255) * f))); return `rgb(${ch(16)},${ch(8)},${ch(0)})`; }
function mapWidth() { const vw = $('#view').clientWidth || 1000; return window.innerWidth <= 960 ? vw - 40 : vw - 340 - 20 - 46; }
function mapSVG(d) {
  const cw = mapWidth(), narrow = cw < 600;
  const byLng = [...d.schools].sort((a, b) => a.lng - b.lng);
  const n = byLng.length, maxGap = narrow ? 1.35 : 2, gap = n > 1 ? Math.min(maxGap, 7.5 * maxGap / (n - 1)) : 0;
  const pos = {};
  byLng.forEach((s, i) => { const x = (i - (n - 1) / 2) * gap; const dep = Math.max(3, Math.min(16, 6 + (-1.22 - s.lat) * 80)); pos[s.id] = [(dep + x) / 2, (dep - x) / 2]; });
  const us = Object.values(pos).map((p) => p[0]), vs = Object.values(pos).map((p) => p[1]);
  const mg = narrow ? 0.9 : 1.3, span = narrow ? 4.5 : 6;
  let u0 = Math.min(...us) - mg, u1 = Math.max(...us) + mg, v0 = Math.min(...vs) - mg, v1 = Math.max(...vs) + mg;
  if (u1 - u0 < span) { const m = (u0 + u1) / 2; u0 = m - span / 2; u1 = m + span / 2; }
  if (v1 - v0 < span) { const m = (v0 + v1) / 2; v0 = m - span / 2; v1 = m + span / 2; }
  const T = iso(u0, v0), R = iso(u1, v0), B = iso(u1, v1), L = iso(u0, v1);
  const vbw = R[0] - L[0] + 20;
  const fs = Math.max(10.5, 9.5 * vbw / Math.max(260, cw));
  const tight = fs > 13;
  let g = `<polygon points="${P([T, R, B, L])}" fill="#fff" stroke="var(--line-2)" stroke-width="1"/>`;
  for (let u = Math.ceil(u0); u <= u1; u++) { const a = iso(u, v0), b = iso(u, v1); g += `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="var(--line)"/>`; }
  for (let v = Math.ceil(v0); v <= v1; v++) { const a = iso(u0, v), b = iso(u1, v); g += `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="var(--line)"/>`; }
  g += `<g transform="translate(${L[0] + 26},${L[1] - 18})" aria-hidden="true"><line x1="0" y1="0" x2="0" y2="-30" stroke="var(--ink-2)" stroke-width="1.5"/><polygon points="0,-36 -4.5,-27 4.5,-27" fill="var(--ink-2)"/><text x="0" y="-40" text-anchor="middle" font-size="${fs}" font-weight="600" fill="var(--ink-2)">N</text></g>`;
  let minY = T[1];
  const items = d.schools.map((s) => ({ s, u: pos[s.id][0], v: pos[s.id][1] })).sort((a, b) => (a.u + a.v) - (b.u + b.v));
  items.forEach(({ s, u, v }) => {
    const r = reading(d.readings[s.id], d.now);
    const pm = r ? r.value : null;
    const hex = pm != null ? airBand(pm).hex : '#C9CFCB';
    const h = pm != null ? Math.max(6, Math.min(narrow ? 120 : 150, pm * (narrow ? 1.8 : 2.3))) : 4;
    const k = narrow ? 0.27 : 0.36;
    const N = (z) => iso(u - k, v - k, z), E = (z) => iso(u + k, v - k, z), S = (z) => iso(u + k, v + k, z), W = (z) => iso(u - k, v + k, z);
    const sel = s.id === state.schoolId;
    const open = openAlertFor(s.id);
    const [bx, by] = iso(u, v), [tx, ty] = iso(u, v, h);
    minY = Math.min(minY, ty - (open ? 40 : 26) - fs);
    const o = k + 0.3;
    let b = `<g class="bar-g" data-action="pick-school" data-id="${esc(s.id)}" role="button" tabindex="0" aria-label="${esc(s.name)}, ${esc(s.area)}, ${pm != null ? 'PM2.5 ' + pm : 'no reading'}${open ? ', open alert' : ''}"><title>${esc(s.name)} · ${esc(s.area)}</title>`;
    b += `<ellipse cx="${bx}" cy="${by + 2}" rx="${ISO.A * .8}" ry="${ISO.B * .8}" fill="rgba(18,24,20,.07)"/>`;
    if (sel) b += `<polygon points="${P([iso(u - o, v - o), iso(u + o, v - o), iso(u + o, v + o), iso(u - o, v + o)])}" fill="none" stroke="var(--accent)" stroke-width="1.6" stroke-dasharray="4 3"/>`;
    b += `<polygon points="${P([W(0), S(0), S(h), W(h)])}" fill="${shade(hex, .84)}"/><polygon points="${P([S(0), E(0), E(h), S(h)])}" fill="${shade(hex, .68)}"/><polygon points="${P([N(h), E(h), S(h), W(h)])}" fill="${shade(hex, 1.05)}"/>`;
    if (open) b += `<circle cx="${tx}" cy="${ty - 16 - fs}" r="5" fill="var(--wait)"/><circle cx="${tx}" cy="${ty - 16 - fs}" r="9" fill="none" stroke="var(--wait)" stroke-opacity=".35" stroke-width="2"/>`;
    b += `<text x="${tx}" y="${ty - 9}" text-anchor="middle" font-size="${fs * 1.08}" font-weight="600" fill="var(--ink)" style="font-variant-numeric:tabular-nums">${pm != null ? pm : '–'}</text>`;
    if (!tight || sel) b += `<text x="${bx}" y="${by + 14 + fs}" text-anchor="middle" font-size="${fs}" fill="${sel ? 'var(--accent)' : 'var(--muted)'}" font-weight="${sel ? 600 : 400}">${esc(s.area)}</text>`;
    g += b + '</g>';
  });
  const vx = L[0] - 10, vy = minY - 6, vh = B[1] + 10 - vy;
  return `<svg class="map" viewBox="${vx.toFixed(0)} ${vy.toFixed(0)} ${vbw.toFixed(0)} ${vh.toFixed(0)}" role="img" aria-label="Schematic map of the pilot schools, west to east, north at the back. Each column is as tall as the school's latest PM2.5 reading.">${g}</svg>`;
}
function scaleBar(pm) {
  const v = Math.min(pm, 250), b = airBand(v), i = AIR.indexOf(b);
  const pos = ((i + (v - b.lo) / (b.hi - b.lo)) / AIR.length) * 100;
  return `<div class="scale" aria-hidden="true">${AIR.map((x) => `<span style="background:${x.c}"></span>`).join('')}<i style="left:${Math.max(1, Math.min(99, pos)).toFixed(1)}%"></i></div>`;
}
function sparkline(hist) {
  const W = 290, H = 54, max = Math.max(60, ...hist) * 1.05;
  const pts = hist.map((v, i) => [i * W / (hist.length - 1), H - 4 - (H - 8) * v / max]);
  const line = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join('');
  const y35 = H - 4 - (H - 8) * 35.5 / max, last = pts[pts.length - 1];
  return `<svg class="chart" viewBox="-2 0 ${W + 6} ${H + 14}" role="img" aria-label="PM2.5 over the last 24 hours"><line x1="0" x2="${W}" y1="${y35}" y2="${y35}" stroke="var(--aq-usg)" stroke-dasharray="3 3"/><path d="${line}L${W} ${H}L0 ${H}Z" fill="var(--accent-soft)"/><path d="${line}" fill="none" stroke="var(--accent)" stroke-width="1.6"/><circle cx="${last[0]}" cy="${last[1]}" r="3.5" fill="var(--accent)"/><text x="0" y="${H + 12}" font-size="10" fill="var(--muted)">24 h ago</text><text x="${W}" y="${H + 12}" font-size="10" text-anchor="end" fill="var(--muted)">now</text></svg>`;
}
function schoolPanel() {
  const d = data(); const s = schoolById(state.schoolId); if (!s) return '';
  const rd = d.readings[s.id], r = reading(rd, d.now), a = openAlertFor(s.id);
  return `<div class="vstack"><span class="label">School</span><h2 class="h">${esc(s.name)}</h2><span class="muted">${esc(s.area)}${s.pupils ? ` · ${s.pupils.toLocaleString('en-GB')} pupils` : ''}</span></div>
    <hr class="divider">
    <div class="vstack"><div class="row" style="align-items:center"><span class="label">Air now</span>${r ? chip(airBand(r.value).c, short(airBand(r.value))) : ''}</div>
      ${r ? `<div style="display:flex;align-items:baseline;gap:10px"><span class="big num">${aqi(r.value)}</span><span class="muted num">AQI · PM2.5 ${r.value} µg/m³</span></div>${scaleBar(r.value)}
        <span class="muted" style="font-size:12.5px">${esc(r.source)} · ${fmtWhen(r.at, d.now)}</span>
        ${rd.history && rd.history.length > 2 ? sparkline(rd.history) : ''}` : `<span class="muted">${state.mode === 'live' && state.fetching ? 'Loading the reading…' : 'No reading yet.'}</span>`}
      ${rd && rd.tempMax != null ? `<div class="row"><span class="muted">Today</span><span class="num">${Math.round(rd.tempMax)}° high · rain ${rd.rainChance ?? '–'}%${rd.rainMm != null ? ' · ' + r1(rd.rainMm) + ' mm' : ''}</span></div>` : ''}</div>
    <hr class="divider">
    <div class="vstack"><div class="row" style="align-items:center"><span class="label">Alert</span>${a ? statusEl(a) : '<span class="status"><span class="dot" style="background:var(--ok)"></span>None open</span>'}</div>
      ${a ? `<span><b>${esc(short(hazardOf(a)))}</b> · ${fmtWhen(a.raisedAt, d.now)}</span><button class="btn btn--ghost btn--block" type="button" data-action="open-desk" data-id="${esc(a.id)}">Open in school desk ${icon('arrow')}</button>` : ''}
      <button class="btn btn--block" type="button" data-action="raise">${icon('bell')}${a ? 'Send another alert' : 'Send an alert'}</button></div>`;
}
function raiseForm() {
  const d = data(); const s = schoolById(state.schoolId); const dr = state.draft;
  const v = parseFloat(dr.value);
  const level = dr.hazard === 'air' ? (!isNaN(v) ? airBand(v) : null) : WEATHER[dr.hazard];
  const sendable = dr.hazard !== 'air' || (!isNaN(v) && v >= TH.pm25);
  const preview = dr.hazard === 'air' && !isNaN(v) ? `<div class="row" style="align-items:center"><span>AQI <b class="num">${aqi(v)}</b></span>${chip(airBand(v).c, short(airBand(v)))}</div>${scaleBar(v)}` : '';
  return `<div class="row" style="align-items:center"><span class="label">New alert</span><button class="link" type="button" data-action="cancel">Cancel</button></div>
    <h2 class="h" style="margin:8px 0 18px">${esc(s ? s.name : '')}</h2>
    <div class="form">
      <div class="seg" role="group" aria-label="Hazard" style="display:flex">${[['air', 'Air'], ['rain', 'Heavy rain'], ['heat', 'Heat']].map(([k, l]) => `<button type="button" style="flex:1" data-action="hazard" data-v="${k}" aria-pressed="${dr.hazard === k}">${l}</button>`).join('')}</div>
      ${dr.hazard === 'air' ? `<label class="field" for="rdValue"><span>PM2.5 (µg/m³). Check the nearest AirQo monitor.</span><input class="input num" id="rdValue" data-input="value" inputmode="decimal" placeholder="e.g. 42.5" value="${esc(dr.value)}"></label>${preview}`
        : dr.hazard === 'heat' ? `<label class="field" for="rdValue"><span>Forecast high (°C)</span><input class="input num" id="rdValue" data-input="value" inputmode="decimal" placeholder="e.g. 31" value="${esc(dr.value)}"></label>`
        : '<span class="muted">Send when heavy rain is forecast, or when the Kenya Meteorological Department issues a heavy rainfall advisory for the area.</span>'}
      ${level ? `<label class="field" for="rdStep"><span>Step for the school</span><textarea class="textarea" id="rdStep" data-input="step" rows="4">${esc(dr.step || level.step)}</textarea></label>` : ''}
      <button class="btn btn--block" type="button" data-action="send" ${sendable ? '' : 'disabled'}>${icon('bell')}Send alert</button>
      ${dr.hazard === 'air' && !isNaN(v) ? `<button class="btn btn--ghost btn--block" type="button" data-action="save-reading">Save as the school’s reading only</button>` : ''}
      ${dr.hazard === 'air' && !isNaN(v) && v < TH.pm25 ? `<span class="muted" style="font-size:12.5px">Below ${TH.pm25} µg/m³ no alert is needed.</span>` : ''}
    </div>`;
}
function alertRows(list, sel) {
  const d = data();
  return `<div class="alist">${list.map((a) => { const h = hazardOf(a);
    return `<button class="arow" type="button" data-action="pick-alert" data-id="${esc(a.id)}" aria-current="${a.id === sel}">${hzMark(a)}
      <span class="arow__main"><b>${esc(schoolName(a))}</b><span>${esc(short(h))}${a.hazard === 'air' ? ' · PM2.5 ' + a.value : a.hazard === 'heat' ? ' · ' + a.value + '°C' : ''} · <span class="mono">${esc(a.ref)}</span></span></span>
      <span class="arow__time">${fmtWhen(a.raisedAt, d.now)}</span>${statusEl(a)}</button>`; }).join('')}</div>`;
}
function recentCard(d) {
  const open = d.alerts.filter((a) => !a.closedAt);
  const list = state.filter === 'open' ? open : d.alerts;
  const cap = state.showAll ? 200 : 6;
  return `<section class="card"><div class="card__head"><h2 class="card__title">Alerts</h2>
      <div class="seg" role="group" aria-label="Show"><button type="button" data-action="filter" data-v="open" aria-pressed="${state.filter === 'open'}">Open · ${open.length}</button><button type="button" data-action="filter" data-v="all" aria-pressed="${state.filter === 'all'}">All · ${d.alerts.length}</button></div></div>
    ${list.length ? alertRows(list.slice(0, cap)) : `<div class="empty" style="padding:20px"><span>${state.filter === 'open' ? 'No open alerts. All clear.' : 'No alerts yet.'}</span></div>`}
    ${list.length > cap ? `<div style="display:flex;justify-content:center;margin-top:12px"><button class="btn btn--quiet btn--sm" type="button" data-action="show-all">Show all ${list.length}</button></div>` : ''}</section>`;
}

/* ----- School desk ----- */
function headMessage(a) {
  const h = hazardOf(a), s = schoolName(a);
  const val = a.hazard === 'air' ? ` (PM2.5 ${a.value} µg/m³, AQI ${aqi(a.value)})` : a.hazard === 'heat' ? ` (forecast high ${a.value}°C)` : '';
  return `Dunia Alerts ${a.ref}: ${h.label} at ${s}${val}. Suggested step: ${a.step} Please reply OK when you have seen this.`;
}
const telNumber = (p) => String(p || '').replace(/[^\d+]/g, '');
const waNumber = (p) => { let x = String(p || '').replace(/[^\d+]/g, ''); if (x.startsWith('+')) x = x.slice(1); else if (x.startsWith('0')) x = '254' + x.slice(1); return x; };
function viewDesk() {
  const d = data();
  if (!d.schools.length) return emptyLive();
  ensureSchool(d);
  const s = schoolById(state.schoolId);
  const a = d.alerts.find((x) => x.id === state.alertId && x.schoolId === s.id) || openAlertFor(s.id);
  const open = d.alerts.filter((x) => !x.closedAt && schoolById(x.schoolId));
  const hist = d.alerts.filter((x) => x.schoolId === s.id);
  const toolbar = `<div class="toolbar"><div style="display:flex;gap:10px;align-items:center;flex:1;min-width:0"><label class="sr" for="deskSchool">School</label><select class="select" id="deskSchool" data-change="school">${d.schools.map((x) => `<option value="${esc(x.id)}" ${x.id === s.id ? 'selected' : ''}>${openAlertFor(x.id) ? '● ' : ''}${esc(x.name)}</option>`).join('')}</select></div>
    ${open.length ? `<div class="pills pills--scroll" aria-label="Open alerts"><span class="muted" style="align-self:center;margin-right:4px">Open</span>${open.slice(0, 6).map((x) => `<button class="pill" type="button" data-action="pick-alert" data-id="${esc(x.id)}" aria-pressed="${a && x.id === a.id}">${esc(schoolName(x).replace(/ (Primary|Junior)? ?School$| Primary$| Academy$/, ''))}</button>`).join('')}</div>` : '<span class="muted">No open alerts</span>'}</div>`;
  const main = a ? deskAlert(a, s, d) : `<section class="card"><div class="empty"><span class="h">All clear at ${esc(s.name)}</span><span>${(() => { const r = reading(d.readings[s.id], d.now); return r ? `Air now: AQI ${aqi(r.value)}, ${esc(short(airBand(r.value)).toLowerCase())}.` : 'No reading yet.'; })()}</span><button class="btn" type="button" data-action="raise-from-desk">${icon('bell')}Send an alert</button></div></section>`;
  const lvl = a ? hazardOf(a) : null;
  const side = `<aside class="stack">
    <section class="card"><span class="label">What to do</span>
      ${lvl ? `<div style="margin:12px 0 8px">${chip(lvl.c, lvl.label)}</div><p style="margin:0">${esc(lvl.step)}</p><hr class="divider">` : '<p class="muted" style="margin:10px 0 0">The step for each level is below. Each school agrees them with its health lead.</p><hr class="divider">'}
      <details class="more"><summary>All levels</summary><div class="vstack">${[...AIR.slice(1), WEATHER.rain, WEATHER.heat].map((b) => `<div class="level"><div class="row" style="align-items:center">${chip(b.c, short(b))}${b.lo != null ? `<span class="mono">${b.lo}–${b.hi}</span>` : ''}</div><span style="font-size:13px">${esc(b.step)}</span></div>`).join('')}</div></details></section>
    <section class="card"><div class="card__head" style="margin-bottom:6px"><h2 class="card__title">History</h2><span class="muted num">${hist.length} alert${hist.length === 1 ? '' : 's'}</span></div>
      ${hist.length ? historyRows(hist.slice(0, 8), a && a.id, d) : '<span class="muted">No alerts yet.</span>'}</section></aside>`;
  return toolbar + `<div class="grid-main">${main}${side}</div>`;
}
function historyRows(list, sel, d) {
  return `<div class="alist">${list.map((a) => `<button class="arow arow--compact" type="button" data-action="pick-alert" data-id="${esc(a.id)}" aria-current="${a.id === sel}">${hzMark(a)}
    <span class="arow__main"><b>${esc(short(hazardOf(a)))}</b><span>${fmtWhen(a.raisedAt, d.now)}</span></span>${statusEl(a)}</button>`).join('')}</div>`;
}
function deskAlert(a, s, d) {
  const h = hazardOf(a), st = statusOf(a), dr = state.draft;
  const value = a.hazard === 'air' ? `<span class="big num" style="color:${shade(h.hex, .85)}">${aqi(a.value)}</span><span class="reading__meta"><b>Air quality index</b><span class="muted num">PM2.5 ${a.value} µg/m³</span></span>`
    : a.hazard === 'heat' ? `<span class="big num" style="color:var(--heat)">${a.value ?? '–'}°</span><span class="reading__meta"><b>Forecast high</b><span class="muted">Today</span></span>`
    : `<span class="hz" style="--c:var(--rain);width:56px;height:56px;border-radius:16px">${icon('rain')}</span><span class="reading__meta"><b>Heavy rain expected</b><span class="muted">Follow Kenya Meteorological Department advisories</span></span>`;
  const cls = (done, now) => done ? 'is-done' : now ? 'is-now' : '';
  const phone = (schoolById(a.schoolId) || {}).phone;
  const msg = encodeURIComponent(headMessage(a));
  const notify = !a.closedAt ? `<div class="flow__panel"><span class="muted">Tell the head teacher. The message is written for you.</span>
      ${phone ? `<div class="btns"><a class="btn btn--sm" href="https://wa.me/${waNumber(phone)}?text=${msg}" target="_blank" rel="noopener">${icon('chat')}WhatsApp</a><a class="btn btn--sm btn--ghost" href="sms:${telNumber(phone)}?&body=${msg}">${icon('sms')}SMS</a><a class="btn btn--sm btn--ghost" href="tel:${telNumber(phone)}">${icon('phone')}Call</a></div>`
        : `<div class="btns"><a class="btn btn--sm" href="https://wa.me/?text=${msg}" target="_blank" rel="noopener">${icon('chat')}WhatsApp</a><button class="btn btn--sm btn--ghost" type="button" data-action="copy-head" data-id="${esc(a.id)}">${icon('copy')}Copy message</button></div><span class="muted" style="font-size:12.5px">Add the head teacher’s phone in Schools to message them in one tap.</span>`}</div>` : '';
  return `<section class="card">
    <div class="alerthead">${hzMark(a)}<div><h2 class="card__title">${esc(h.label)}</h2><span class="muted">${esc(s.name)} · ${fmtWhen(a.raisedAt, d.now)}</span></div><span class="mono">${esc(a.ref)}</span></div>
    <div class="reading">${value}</div>${a.hazard === 'air' ? scaleBar(a.value) : ''}
    <div class="stepbox"><span class="label" style="color:var(--accent)">Step for the school</span><p>${esc(a.step)}</p></div>
    <ol class="flow">
      <li class="is-done"><span class="flow__n">1</span><div class="flow__body"><span class="flow__title">Alert sent</span><span class="muted">${fmtWhen(a.raisedAt, d.now)}</span>${st === 'waiting' ? notify : ''}</div></li>
      <li class="${cls(a.ackAt, st === 'waiting')}"><span class="flow__n">2</span><div class="flow__body"><span class="flow__title">Head teacher acknowledges</span><span class="muted">${a.ackAt ? `${esc(a.ackBy || 'Head teacher')} · ${fmtTime(a.ackAt)} · ${mins(a.raisedAt, a.ackAt)} min after the alert` : a.closedAt ? 'Not acknowledged before the end of the school day' : 'Waiting for a reply'}</span>
        ${st === 'waiting' ? `<div class="flow__panel"><button class="btn" type="button" data-action="ack" data-id="${esc(a.id)}">They replied: mark acknowledged</button></div>` : ''}</div></li>
      <li class="${cls(a.actionAt, st === 'acknowledged')}"><span class="flow__n">3</span><div class="flow__body"><span class="flow__title">Record what the school did</span><span class="muted">${a.actionAt ? esc((a.actions || []).join(', ') + (a.note ? ' · ' + a.note : '')) + ' · ' + fmtTime(a.actionAt) : a.closedAt ? 'No action recorded' : 'After the head teacher replies'}</span>
        ${st === 'acknowledged' ? `<div class="flow__panel"><div class="pills">${ACTIONS[a.hazard].map((o) => `<button class="pill" type="button" data-action="toggle-action" data-v="${esc(o)}" aria-pressed="${dr.actions.includes(o)}">${esc(o)}</button>`).join('')}</div>
          <label class="field" for="actNote"><span>Note <span class="muted">(optional, never pupils’ names)</span></span><textarea class="textarea" id="actNote" data-input="note" rows="2">${esc(dr.note)}</textarea></label>
          <button class="btn" type="button" data-action="record" data-id="${esc(a.id)}" ${dr.actions.length || dr.note.trim() ? '' : 'disabled'}>Save action</button></div>` : ''}</div></li>
      <li class="${cls(a.parentsAt, st === 'acted' && !a.parentsAt)}"><span class="flow__n">4</span><div class="flow__body"><span class="flow__title">Inform parents</span><span class="muted">${a.parentsAt ? 'Parents informed · ' + fmtTime(a.parentsAt) : a.closedAt ? 'Not recorded' : 'Always for heavy rain and early release'}</span>
        ${st === 'acted' && !a.parentsAt ? `<div class="flow__panel"><div class="btns"><button class="btn btn--ghost" type="button" data-action="go-parents" data-id="${esc(a.id)}">Write the message</button><button class="btn" type="button" data-action="parents" data-id="${esc(a.id)}">Mark parents informed</button></div></div>` : ''}</div></li>
      <li class="${cls(a.closedAt, st === 'acted')}"><span class="flow__n">5</span><div class="flow__body"><span class="flow__title">Close with the result</span><span class="muted">${a.closedAt ? esc(a.result || 'Closed') : 'Saved for the pilot report'}</span>
        ${st === 'acted' ? `<div class="flow__panel"><label class="field" for="closeResult"><span>Result</span><select class="select" id="closeResult" data-change="result"><option value="">Choose</option>${RESULTS.map((r) => `<option ${dr.result === r ? 'selected' : ''}>${esc(r)}</option>`).join('')}</select></label>
          <button class="btn" type="button" data-action="close" data-id="${esc(a.id)}" ${dr.result ? '' : 'disabled'}>Close alert</button></div>` : ''}</div></li>
    </ol></section>`;
}

/* ----- Parents ----- */
function smsText(a, lang) {
  const n = schoolName(a);
  const T = {
    en: {
      usg: `Dunia Alerts: Air near ${n} is unhealthy for sensitive groups today. Pupils with asthma or breathing problems will skip hard outdoor games. Please send your child's inhaler if they use one.`,
      unhealthy: `Dunia Alerts: Air near ${n} is unhealthy today. PE and outdoor games are moving indoors. Please send your child's inhaler if they use one.`,
      very: `Dunia Alerts: Air near ${n} is very unhealthy today. All pupils will stay indoors. Please send your child's inhaler if they use one.`,
      rain: `Dunia Alerts: Heavy rain is forecast near ${n} today. Pupils will stay away from drains, and the school may close early. Children will only go home with a parent or guardian.`,
      heat: `Dunia Alerts: A very hot day is expected at ${n}. We are adding water breaks and moving PE to the early morning. Please send your child with a water bottle.`,
    },
    sw: {
      usg: `Dunia Alerts: Hewa karibu na ${n} si salama kwa watoto wenye pumu leo. Wanafunzi wenye pumu au matatizo ya kupumua hawatashiriki michezo migumu ya nje. Tafadhali mpe mtoto wako dawa yake ya pumu kama anaitumia.`,
      unhealthy: `Dunia Alerts: Hewa karibu na ${n} si salama leo. Michezo na masomo ya nje yatafanyika ndani. Tafadhali mpe mtoto wako dawa yake ya pumu kama anaitumia.`,
      very: `Dunia Alerts: Hewa karibu na ${n} ni hatari sana leo. Wanafunzi wote watabaki ndani ya madarasa. Tafadhali mpe mtoto wako dawa yake ya pumu kama anaitumia.`,
      rain: `Dunia Alerts: Mvua kubwa inatarajiwa karibu na ${n} leo. Wanafunzi watakaa mbali na mitaro, na shule huenda ikafungwa mapema. Watoto wataondoka tu wakiwa na mzazi au mlezi.`,
      heat: `Dunia Alerts: Siku ya joto kali inatarajiwa katika ${n}. Tutaongeza mapumziko ya kunywa maji na kuhamisha michezo hadi asubuhi mapema. Tafadhali mpe mtoto wako chupa ya maji.`,
    },
  };
  const key = a.hazard === 'air' ? (a.level === 'usg' || a.level === 'moderate' || a.level === 'good' ? 'usg' : a.level === 'unhealthy' ? 'unhealthy' : 'very') : a.hazard;
  return T[lang][key];
}
const smsParts = (t) => t.length <= 160 ? 1 : Math.ceil(t.length / 153);
function msgAlert() { const d = data(); return d.alerts.find((a) => a.id === state.alertId) || d.alerts.find((a) => !a.closedAt) || d.alerts[0]; }
function viewParents() {
  const d = data();
  if (!d.schools.length) return emptyLive();
  const a = msgAlert();
  if (!a) return `<section class="card"><div class="empty"><span class="h">No alerts yet</span><span>When an alert goes out, the message for parents appears here in English and Kiswahili.</span></div></section>`;
  const wa = state.channel === 'whatsapp';
  const phone = (lang, label) => {
    const t = smsText(a, lang), enc = encodeURIComponent(t);
    return `<div class="phonecol"><div class="phonecol__head"><span class="label">${label}</span><span class="mono">${wa ? 'WhatsApp' : `${t.length} characters · ${smsParts(t)} SMS`}</span></div>
      <div class="phone ${wa ? 'phone--wa' : ''}"><div class="phone__screen"><div class="phone__top"><span class="phone__avatar">DA</span><b>${wa ? 'Parents · ' + esc(schoolName(a)) : 'DUNIA'}</b><span class="muted" style="font-size:11.5px">${wa ? 'Group' : 'Text message'}</span></div>
      <div class="phone__body"><span class="phone__meta">${fmtWhen(a.ackAt || a.raisedAt, d.now)}</span><div class="bubble" id="bubble-${lang}">${esc(t)}</div></div></div></div>
      <div class="btns" style="justify-content:center"><button class="btn btn--ghost btn--sm" type="button" data-action="copy" data-lang="${lang}">${icon('copy')}Copy</button>${wa ? `<a class="btn btn--sm" href="https://wa.me/?text=${enc}" target="_blank" rel="noopener">${icon('chat')}Open WhatsApp</a>` : `<a class="btn btn--sm" href="sms:?&body=${enc}">${icon('sms')}Open SMS</a>`}</div></div>`;
  };
  const opts = d.alerts.slice(0, 60).map((x) => `<option value="${esc(x.id)}" ${x.id === a.id ? 'selected' : ''}>${esc(x.ref)} · ${esc(schoolName(x))} · ${esc(short(hazardOf(x)))} · ${fmtWhen(x.raisedAt, d.now)}</option>`).join('');
  return `<div class="toolbar toolbar--center"><label class="sr" for="msgAlert">Alert</label><select class="select" id="msgAlert" data-change="alert" style="max-width:520px">${opts}</select>
      <div class="seg" role="group" aria-label="Channel"><button type="button" data-action="channel" data-v="sms" aria-pressed="${!wa}">SMS</button><button type="button" data-action="channel" data-v="whatsapp" aria-pressed="${wa}">WhatsApp</button></div></div>
    <section class="card"><div class="phones">${phone('en', 'English')}${phone('sw', 'Kiswahili')}</div>
      <hr class="divider" style="margin:26px 0 18px"><div style="display:flex;flex-wrap:wrap;justify-content:center;align-items:center;gap:12px;text-align:center">
        ${a.parentsAt ? `<span class="status"><span class="dot" style="background:var(--ok)"></span>Parents informed · ${fmtWhen(a.parentsAt, d.now)}</span>` : a.closedAt ? '<span class="muted">This alert is closed.</span>' : `<span class="muted">Sent it? Record it for the pilot report.</span><button class="btn" type="button" data-action="parents" data-id="${esc(a.id)}">Mark parents informed</button>`}</div></section>`;
}

/* ----- Impact ----- */
function viewImpact() {
  const d = data();
  if (!d.schools.length) return emptyLive();
  const st = stats(d.alerts, d.schools);
  const head = `<div class="toolbar"><div><h1 class="h">Pilot results</h1><span class="muted">${d.alerts.length ? `${fmtDay(d.start)} – ${fmtDay(d.now)}` : 'No alerts yet'}${state.mode === 'demo' ? ' · example data' : ''}</span></div>
    <div class="btns"><button class="btn btn--ghost" type="button" data-action="csv">${icon('down')}Download CSV</button></div></div>`;
  if (!d.alerts.length) return head + `<section class="card"><div class="empty"><span class="h">Nothing to report yet</span><span>Results build up as alerts are sent and schools respond.</span></div></section>`;
  const tiles = `<section class="stats stats--5">
    ${tile('Alerts sent', st.total, `${d.schools.length} schools`)}
    ${tile('Acknowledged', st.ackRate + '%', 'by the head teacher')}
    ${tile('Time to respond', `${st.medAck ?? '–'} <small>min</small>`, 'median')}
    ${tile('Action taken', st.actRate + '%', `${st.pupils.toLocaleString('en-GB')} pupil-days covered`)}
    ${tile('Parents told', st.toldRate + '%', 'in English and Kiswahili')}</section>`;
  const wk = (t) => Math.floor((t - dayStart(d.start)) / (7 * DAY));
  const weeks = Math.max(1, wk(d.now) + 1);
  const per = Array.from({ length: weeks }, () => ({ air: 0, rain: 0, heat: 0 }));
  d.alerts.forEach((a) => { const i = wk(a.raisedAt); if (per[i]) per[i][a.hazard] = (per[i][a.hazard] || 0) + 1; });
  const maxW = Math.max(4, ...per.map((p) => p.air + p.rain + p.heat));
  const wl = (i) => fmtDate(dayStart(d.start) + i * 7 * DAY);
  const cols = per.map((p, i) => { const tot = p.air + p.rain + p.heat;
    return `<div class="wk__col" title="Week of ${wl(i)}: ${tot} alerts"><div class="wk__plot"><span class="wk__n num">${tot || ''}</span><div class="wk__stack" style="height:${(86 * tot / maxW).toFixed(1)}%">${['heat', 'rain', 'air'].filter((k) => p[k]).map((k) => `<i style="flex:${p[k]};background:${HZ[k][1]}" title="${p[k]} ${HZ[k][0].toLowerCase()}"></i>`).join('')}</div></div><span class="wk__l">${wl(i)}</span></div>`; }).join('');
  const buckets = [['5 min or less', (m) => m <= 5], ['6–15 min', (m) => m > 5 && m <= 15], ['16–30 min', (m) => m > 15 && m <= 30], ['31–60 min', (m) => m > 30 && m <= 60], ['Over 60 min', (m) => m > 60]];
  const counts = buckets.map(([, f]) => st.ackMins.filter(f).length), maxC = Math.max(1, ...counts);
  const actCount = {};
  d.alerts.forEach((a) => (a.actions || []).forEach((x) => { actCount[x] = (actCount[x] || 0) + 1; }));
  const acts = Object.entries(actCount).sort((a, b) => b[1] - a[1]).slice(0, 6), maxA = Math.max(1, ...acts.map((x) => x[1]));
  const charts = `<div class="grid-2">
    <section class="card span-2"><div class="card__head"><h2 class="card__title">Alerts each week</h2><div class="keys" style="margin:0">${Object.values(HZ).map(([l, c]) => `<span><i style="background:${c}"></i>${l}</span>`).join('')}</div></div>
      <div class="wk" role="img" aria-label="Alerts per week: ${per.map((p, i) => wl(i) + ' ' + (p.air + p.rain + p.heat)).join(', ')}">${cols}</div></section>
    <section class="card"><div class="card__head"><h2 class="card__title">Minutes to acknowledge</h2></div><div class="hbars">${counts.map((c, i) => `<div class="hbar"><span>${buckets[i][0]}</span><span class="hbar__track"><i style="width:${(100 * c / maxC).toFixed(1)}%;background:${i < 2 ? 'var(--accent)' : i < 4 ? 'var(--sun)' : 'var(--bad)'}"></i></span><span class="num">${c}</span></div>`).join('')}</div></section>
    <section class="card"><div class="card__head"><h2 class="card__title">What schools did</h2></div><div class="hbars">${acts.map(([k, c]) => `<div class="hbar hbar--stack"><span>${esc(k)}</span><span class="hbar__track"><i style="width:${(100 * c / maxA).toFixed(1)}%;background:var(--accent)"></i></span><span class="num">${c}</span></div>`).join('') || '<span class="muted">No actions recorded yet.</span>'}</div></section></div>`;
  const rows = d.schools.map((s) => { const al = d.alerts.filter((a) => a.schoolId === s.id), x = stats(al, d.schools);
    return `<tr class="is-click" data-action="pick-school" data-id="${esc(s.id)}" data-goto-desk="1"><td><b>${esc(s.name)}</b><br><span class="muted">${esc(s.area)}</span></td><td class="r num">${x.total}</td><td class="r num">${x.total ? x.ackRate + '%' : '–'}</td><td class="r num hide-sm">${x.medAck ?? '–'}</td><td class="r num hide-sm">${x.total ? x.actRate + '%' : '–'}</td><td class="r num">${x.total ? x.toldRate + '%' : '–'}</td></tr>`; }).join('');
  const table = `<section class="card"><div class="card__head"><h2 class="card__title">By school</h2></div><div class="tablewrap"><table><thead><tr><th>School</th><th class="r">Alerts</th><th class="r">Acknowledged</th><th class="r hide-sm">Median min</th><th class="r hide-sm">Action</th><th class="r">Parents told</th></tr></thead><tbody>${rows}</tbody></table></div></section>`;
  return head + tiles + charts + table;
}

/* ----- Schools ----- */
function viewSchools() {
  const d = data(), isLive = state.mode === 'live';
  const rows = d.schools.map((s) => { const rd = d.readings[s.id], r = reading(rd, d.now);
    return `<tr class="is-click" data-action="pick-school" data-id="${esc(s.id)}" data-goto-overview="1"><td><b>${esc(s.name)}</b><br><span class="muted">${esc(s.area)}${s.pupils ? ' · ' + s.pupils.toLocaleString('en-GB') + ' pupils' : ''}</span></td>
      <td>${r ? `${chip(airBand(r.value).c, String(r.value))}` : '<span class="muted">–</span>'}</td>
      <td class="num hide-sm">${rd && rd.tempMax != null ? `${Math.round(rd.tempMax)}° · ${rd.rainChance ?? '–'}%` : '<span class="muted">–</span>'}</td>
      <td class="hide-sm">${s.phone ? '<span class="status"><span class="dot" style="background:var(--ok)"></span>Saved</span>' : '<span class="muted">–</span>'}</td>
      ${isLive ? `<td class="r"><button class="link" type="button" data-action="edit-school" data-id="${esc(s.id)}">Edit</button></td>` : ''}</tr>`; }).join('');
  const list = `<section class="card"><div class="card__head"><h2 class="card__title">Pilot schools</h2><span class="muted num">${d.schools.length}</span></div>
    ${d.schools.length ? `<div class="tablewrap"><table><thead><tr><th>School</th><th>PM2.5 now</th><th class="hide-sm">Today</th><th class="hide-sm">Head teacher</th>${isLive ? '<th></th>' : ''}</tr></thead><tbody>${rows}</tbody></table></div>`
      : '<div class="empty" style="padding:24px"><span>No schools yet. Add the first one.</span></div>'}</section>`;
  if (!isLive) {
    return `<div class="grid-main">${list}<aside class="stack"><section class="card"><span class="label">Demo</span><p style="margin:10px 0 16px">These are example schools. Switch to Live to add your pilot schools and get real readings.</p><button class="btn btn--block" type="button" data-mode="live">Switch to Live</button></section>${sourcesCard()}</aside></div>`;
  }
  const e = state.editing ? live.schools.find((s) => s.id === state.editing) : null;
  const form = `<section class="card"><div class="card__head"><h2 class="card__title">${e ? 'Edit school' : 'Add a school'}</h2>${e ? '<button class="link" type="button" data-action="cancel-edit">Cancel</button>' : ''}</div>
    <div class="form">
      <label class="field" for="fName"><span>School name</span><input class="input" id="fName" autocomplete="off" maxlength="80" value="${esc(e ? e.name : '')}"></label>
      <div class="form2"><label class="field" for="fArea"><span>Area</span><select class="select" id="fArea">${AREAS.map((a) => `<option ${e && e.area === a[0] ? 'selected' : ''}>${esc(a[0])}</option>`).join('')}</select></label>
      <label class="field" for="fPupils"><span>Pupils</span><input class="input num" id="fPupils" inputmode="numeric" placeholder="e.g. 850" value="${esc(e && e.pupils != null ? e.pupils : '')}"></label></div>
      <label class="field" for="fPhone"><span>Head teacher’s phone <span class="muted">(stays on this device)</span></span><input class="input" id="fPhone" type="tel" inputmode="tel" placeholder="+254" value="${esc(e ? e.phone : '')}"></label>
      <button class="btn btn--block" type="button" data-action="save-school">${e ? 'Save changes' : `${icon('plus')}Add school`}</button>
      ${e ? `<button class="btn btn--danger btn--block" type="button" data-action="remove-school" data-id="${esc(e.id)}">${state.removing === e.id ? 'Tap again to remove' : 'Remove school'}</button>` : ''}
    </div></section>`;
  const backup = `<section class="card"><span class="label">Your records</span><p style="margin:10px 0 16px">Alerts and schools are saved in this browser. Download a backup every week, and to move to another device.</p>
    <div class="btns"><button class="btn btn--ghost" type="button" data-action="backup">${icon('down')}Download backup</button><button class="btn btn--ghost" type="button" data-action="restore">${icon('up')}Restore</button></div></section>`;
  return `<div class="grid-main">${list}<aside class="stack">${form}${backup}${sourcesCard()}</aside></div>`;
}
function sourcesCard() {
  return `<section class="card"><span class="label">Where readings come from</span>
    <p style="margin:10px 0 0;font-size:13px">Air: Copernicus (CAMS) model estimates via Open-Meteo, refreshed every ${CFG.refreshMinutes} minutes. It is a regional model, so schools close together read alike. Before sending an air alert, check the nearest <a href="https://airqo.net/" target="_blank" rel="noopener">AirQo</a> monitor and enter its reading.</p>
    <p style="margin:10px 0 0;font-size:13px">Weather: Open-Meteo forecast. For heavy rain, also follow the <a href="https://meteo.go.ke/" target="_blank" rel="noopener">Kenya Meteorological Department</a>.</p></section>`;
}

/* ---------- Live readings (Open-Meteo, no key needed) ---------- */
async function getJSON(url) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 12000);
  try { const r = await fetch(url, { signal: ctl.signal }); if (!r.ok) throw new Error('HTTP ' + r.status); return await r.json(); } finally { clearTimeout(t); }
}
async function fetchReadings() {
  if (state.fetching || !live.schools.length) return;
  state.fetching = true; renderNote();
  const now = Date.now();
  const res = await Promise.allSettled(live.schools.map(async (s) => {
    const q = `latitude=${s.lat.toFixed(4)}&longitude=${s.lng.toFixed(4)}&timezone=Africa%2FNairobi`;
    const [aq, wx] = await Promise.all([
      getJSON(`https://air-quality-api.open-meteo.com/v1/air-quality?${q}&current=pm2_5&hourly=pm2_5&past_days=1&forecast_days=1`),
      getJSON(`https://api.open-meteo.com/v1/forecast?${q}&daily=temperature_2m_max,precipitation_sum,precipitation_probability_max&forecast_days=1`).catch(() => null),
    ]);
    const off = (aq.utc_offset_seconds || 0) * 1000;
    const ts = (x) => Date.parse(x + 'Z') - off;
    const hist = [];
    (aq.hourly && aq.hourly.time || []).forEach((t, i) => { const v = aq.hourly.pm2_5[i]; if (v != null && ts(t) <= now) hist.push(r1(v)); });
    const cur = aq.current && aq.current.pm2_5 != null ? r1(aq.current.pm2_5) : hist[hist.length - 1];
    if (cur == null) throw new Error('no reading');
    const dl = wx && wx.daily;
    return [s.id, { pm25: cur, at: aq.current && aq.current.time ? ts(aq.current.time) : now, history: hist.slice(-24), source: 'model',
      tempMax: dl && dl.temperature_2m_max ? dl.temperature_2m_max[0] : null, rainMm: dl && dl.precipitation_sum ? dl.precipitation_sum[0] : null, rainChance: dl && dl.precipitation_probability_max ? dl.precipitation_probability_max[0] : null }];
  }));
  let ok = 0;
  res.forEach((r) => { if (r.status === 'fulfilled') { ok++; const [id, v] = r.value; const prev = live.readings[id]; if (prev && prev.monitor) v.monitor = prev.monitor; live.readings[id] = v; } });
  state.fetching = false; state.fetchError = ok === 0;
  if (ok) { live.updatedAt = Date.now(); saveLive(); }
  render(true);
}
let timer = null;
function startLive() {
  clearInterval(timer);
  const stale = !live.updatedAt || Date.now() - live.updatedAt > CFG.refreshMinutes * MIN;
  if (stale || Object.keys(live.readings).length < live.schools.length) fetchReadings();
  timer = setInterval(() => { if (state.mode === 'live' && !document.hidden) fetchReadings(); }, CFG.refreshMinutes * MIN);
}
document.addEventListener('visibilitychange', () => { if (!document.hidden && state.mode === 'live' && live.updatedAt && Date.now() - live.updatedAt > CFG.refreshMinutes * MIN) fetchReadings(); });

/* ---------- Actions ---------- */
function toast(t) { const el = $('#toast'); el.textContent = t; el.classList.add('is-on'); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('is-on'), 2600); }
function resetDraft(hazard = 'air') { state.draft = { hazard, value: '', step: '', actions: [], note: '', result: '' }; }
const stamp = () => state.mode === 'demo' ? (state.demo.now += 3 * MIN) : Date.now();
function patchAlert(id, patch) {
  const list = state.mode === 'demo' ? state.demo.alerts : live.alerts;
  const a = list.find((x) => x.id === id); if (!a) return false;
  Object.assign(a, patch); if (state.mode === 'live') saveLive(); return true;
}
function download(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a'); a.href = url; a.download = name; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
const today = () => new Date().toISOString().slice(0, 10);
function setView(v, focus) {
  state.view = v; state.panel = null; state.editing = null; state.removing = null; resetDraft();
  if (location.hash.slice(1) !== v) history.replaceState(null, '', '#' + v);
  render(); window.scrollTo({ top: 0 });
  if (focus) $('#view').focus({ preventScroll: true });
}
function setMode(m) {
  if (m === state.mode) return;
  state.mode = m; state.schoolId = null; state.alertId = null; state.panel = null; state.editing = null; resetDraft();
  write(PREF, { mode: m });
  render();
  if (m === 'live') startLive();
}
function prefillRaise(hazard, value) {
  resetDraft(hazard);
  if (value != null && value !== '') state.draft.value = String(value);
  else if (hazard === 'air') { const r = reading(data().readings[state.schoolId], data().now); if (r) state.draft.value = String(r.value); }
  else if (hazard === 'heat') { const rd = data().readings[state.schoolId]; if (rd && rd.tempMax != null) state.draft.value = String(Math.round(rd.tempMax)); }
  state.panel = 'raise';
}
async function act(el) {
  const k = el.dataset.action, id = el.dataset.id, v = el.dataset.v;
  switch (k) {
    case 'pick-school':
      state.schoolId = id; state.alertId = null; state.panel = null; resetDraft();
      if (el.dataset.gotoDesk) return setView('desk');
      if (el.dataset.gotoOverview) return setView('overview');
      break;
    case 'pick-alert': { const a = data().alerts.find((x) => x.id === id); if (!a) break; state.alertId = id; if (schoolById(a.schoolId)) state.schoolId = a.schoolId; resetDraft(); if (state.view === 'overview') return setView('desk'); break; }
    case 'open-desk': state.alertId = id || null; return setView('desk');
    case 'go-parents': state.alertId = id; return setView('parents');
    case 'raise': prefillRaise('air'); break;
    case 'raise-from-desk': setView('overview'); prefillRaise('air'); break;
    case 'review': state.schoolId = id; prefillRaise(v, el.dataset.val); render(); $('#side') && $('#side').scrollIntoView({ behavior: 'smooth', block: 'nearest' }); return;
    case 'dismiss': state.dismissed.add(state.mode + id + v); break;
    case 'cancel': state.panel = null; resetDraft(); break;
    case 'hazard': prefillRaise(v); break;
    case 'filter': state.filter = v; state.showAll = false; break;
    case 'show-all': state.showAll = true; break;
    case 'channel': state.channel = v; break;
    case 'toggle-action': { const xs = state.draft.actions; const i = xs.indexOf(v); if (i >= 0) xs.splice(i, 1); else xs.push(v); break; }
    case 'reset-demo': state.demo = buildDemo(); state.schoolId = null; state.alertId = null; state.panel = null; state.dismissed.clear(); resetDraft(); toast('Demo reset.'); break;
    case 'refresh': fetchReadings(); return;
    case 'ack': if (patchAlert(id, { ackAt: stamp(), ackBy: 'Head teacher' })) { resetDraft(); toast('Marked as acknowledged.'); } break;
    case 'record': { const dr = state.draft; if (patchAlert(id, { actions: [...dr.actions], note: dr.note.trim().slice(0, 300), actionAt: stamp() })) { resetDraft(); toast('Action saved.'); } break; }
    case 'parents': if (patchAlert(id, { parentsAt: stamp() })) toast('Parents marked as informed.'); break;
    case 'close': { const res = state.draft.result; if (!res) break; if (patchAlert(id, { result: res, closedAt: stamp() })) { resetDraft(); toast(res === RESULTS[2] ? 'Closed. Follow up with partners.' : 'Alert closed.'); } break; }
    case 'send': case 'save-reading': raise(k === 'send'); return;
    case 'copy': case 'copy-head': {
      const a = k === 'copy' ? msgAlert() : data().alerts.find((x) => x.id === id); if (!a) return;
      const t = k === 'copy' ? smsText(a, el.dataset.lang) : headMessage(a);
      try { await navigator.clipboard.writeText(t); toast('Copied.'); }
      catch (e) { const b = $('#bubble-' + el.dataset.lang); if (b) { const r = document.createRange(); r.selectNodeContents(b); const s = getSelection(); s.removeAllRanges(); s.addRange(r); } toast('Select the text and copy it.'); }
      return;
    }
    case 'csv': exportCsv(); return;
    case 'backup': download(`dunia-alerts-backup-${today()}.json`, JSON.stringify({ app: 'dunia-alerts', version: 1, exportedAt: new Date().toISOString(), ...live }, null, 1), 'application/json'); toast('Backup downloaded.'); return;
    case 'restore': $('#restoreFile').click(); return;
    case 'edit-school': state.editing = id; state.removing = null; render(); $('#fName') && $('#fName').focus(); return;
    case 'cancel-edit': state.editing = null; state.removing = null; break;
    case 'save-school': saveSchool(); return;
    case 'remove-school':
      if (state.removing !== id) { state.removing = id; break; }
      live.schools = live.schools.filter((s) => s.id !== id); delete live.readings[id]; saveLive();
      state.editing = null; state.removing = null; toast('School removed. Its past alerts stay in the report.'); break;
  }
  render();
}
function raise(send) {
  const dr = state.draft, s = schoolById(state.schoolId); if (!s) return;
  const v = parseFloat(dr.value), t = stamp();
  const readings = state.mode === 'demo' ? state.demo.readings : live.readings;
  if (dr.hazard === 'air' && !isNaN(v)) {
    const prev = readings[s.id] || {};
    if (state.mode === 'demo') readings[s.id] = { ...prev, pm25: r1(v), at: t, history: [...(prev.history || []).slice(-23), r1(v)] };
    else readings[s.id] = { ...prev, monitor: { pm25: r1(v), at: t } };
  }
  if (send) {
    const level = dr.hazard === 'air' ? airBand(v).k : dr.hazard;
    const step = (dr.step || (dr.hazard === 'air' ? airBand(v).step : WEATHER[dr.hazard].step)).trim().slice(0, 600);
    const seq = state.mode === 'demo' ? 100 + state.demo.alerts.length + 1 : ++live.seq;
    const alert = { id: 'a' + t.toString(36) + Math.random().toString(36).slice(2, 6), ref: 'DA-' + seq, schoolId: s.id, schoolName: s.name, hazard: dr.hazard, level,
      value: dr.hazard === 'rain' ? null : (isNaN(v) ? null : r1(v)), raisedAt: t, step, actions: [] };
    (state.mode === 'demo' ? state.demo.alerts : live.alerts).unshift(alert);
    if (state.mode === 'live') saveLive();
    state.alertId = alert.id; toast('Alert created. Now tell the head teacher.');
    return setView('desk');
  }
  if (state.mode === 'live') saveLive();
  state.panel = null; resetDraft(); toast('Reading saved.'); render();
}
function saveSchool() {
  const name = ($('#fName').value || '').trim();
  if (!name) { toast('Add the school’s name.'); $('#fName').focus(); return; }
  const fields = { name, area: $('#fArea').value, pupils: $('#fPupils').value, phone: ($('#fPhone').value || '').trim() };
  if (state.editing) {
    const i = live.schools.findIndex((s) => s.id === state.editing);
    const areaChanged = live.schools[i].area !== fields.area;
    live.schools[i] = normSchool({ ...live.schools[i], ...fields, lat: areaChanged ? null : live.schools[i].lat, lng: areaChanged ? null : live.schools[i].lng });
    if (areaChanged) delete live.readings[live.schools[i].id];
    toast('Saved.');
  } else {
    const s = normSchool(fields); live.schools.push(s); state.schoolId = s.id; toast(name + ' added.');
  }
  state.editing = null; state.removing = null; saveLive(); render(); fetchReadings();
}
function exportCsv() {
  const d = data();
  const q = (x) => '"' + String(x ?? '').replace(/"/g, '""') + '"';
  const iso8601 = (t) => t ? new Date(t).toISOString() : '';
  const dataset = state.mode === 'demo' ? 'EXAMPLE DATA (demo, not real pilot results)' : 'pilot';
  const lines = [['dataset', 'ref', 'school', 'area', 'hazard', 'level', 'value', 'raised', 'acknowledged', 'minutes_to_acknowledge', 'actions', 'note', 'parents_informed', 'closed', 'result'].join(',')];
  d.alerts.forEach((a) => { const s = schoolById(a.schoolId) || {};
    lines.push([dataset, a.ref, schoolName(a), s.area, a.hazard, hazardOf(a).label, a.value, iso8601(a.raisedAt), iso8601(a.ackAt), a.ackAt ? mins(a.raisedAt, a.ackAt) : '', (a.actions || []).join('; '), a.note, iso8601(a.parentsAt), iso8601(a.closedAt), a.result].map(q).join(',')); });
  download(`dunia-alerts-${state.mode === 'demo' ? 'demo-example-data' : 'pilot'}-${today()}.csv`, '﻿' + lines.join('\r\n'), 'text/csv;charset=utf-8');
  toast('CSV downloaded.');
}
$('#restoreFile').addEventListener('change', async (e) => {
  const f = e.target.files && e.target.files[0]; e.target.value = ''; if (!f) return;
  try {
    const o = JSON.parse(await f.text());
    if (o.app !== 'dunia-alerts' || !Array.isArray(o.schools) || !Array.isArray(o.alerts)) throw new Error('not a backup');
    live = { schools: o.schools.map(normSchool).filter(Boolean), alerts: o.alerts.filter((a) => a && a.id && a.schoolId && a.raisedAt), readings: o.readings || {}, updatedAt: o.updatedAt || null, seq: o.seq || 100 + o.alerts.length };
    saveLive(); state.schoolId = null; state.alertId = null; toast(`Restored ${live.schools.length} schools and ${live.alerts.length} alerts.`);
    if (state.mode !== 'live') setMode('live'); else { render(); fetchReadings(); }
  } catch (err) { toast('That file isn’t a Dunia Alerts backup.'); }
});

/* ---------- Events ---------- */
document.addEventListener('click', (e) => {
  const t = e.target.closest('[data-view]'); if (t) { setView(t.dataset.view, true); return; }
  const m = e.target.closest('[data-mode]'); if (m) { setMode(m.dataset.mode); return; }
  const g = e.target.closest('[data-goto]'); if (g) { setView(g.dataset.goto, true); return; }
  const b = e.target.closest('[data-action]'); if (b && !b.disabled) { if (b.tagName === 'A') return; act(b); }
});
document.addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('g[data-action], tr[data-action]')) { e.preventDefault(); act(e.target); } });
document.addEventListener('input', (e) => {
  const k = e.target.dataset.input; if (!k) return;
  state.draft[k] = e.target.value;
  if (k === 'value' && $('#side')) { const pos = e.target.selectionStart; $('#side').innerHTML = raiseForm(); const inp = $('#rdValue'); inp.focus(); try { inp.setSelectionRange(pos, pos); } catch (_) {} }
  if (k === 'note') { const btn = $('[data-action="record"]'); if (btn) btn.disabled = !(state.draft.actions.length || state.draft.note.trim()); }
});
document.addEventListener('change', (e) => {
  const k = e.target.dataset.change; if (!k) return;
  if (k === 'school') { state.schoolId = e.target.value; state.alertId = null; resetDraft(); render(); }
  if (k === 'alert') { state.alertId = e.target.value; render(); }
  if (k === 'result') { state.draft.result = e.target.value; const btn = $('[data-action="close"]'); if (btn) btn.disabled = !state.draft.result; }
});
window.addEventListener('hashchange', () => { const h = location.hash.slice(1); if (VIEWS.includes(h) && h !== state.view) setView(h); });
let lastW = window.innerWidth, rT = 0;
window.addEventListener('resize', () => { clearTimeout(rT); rT = setTimeout(() => { if (Math.abs(window.innerWidth - lastW) > 60 && state.view === 'overview') { lastW = window.innerWidth; render(true); } }, 150); });

/* ---------- Start ---------- */
const h0 = location.hash.slice(1);
if (VIEWS.includes(h0)) state.view = h0;
render();
if (state.mode === 'live') startLive();
})();
