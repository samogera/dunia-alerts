/* Dunia Alerts: early warning for schools. A Dunia Endelevu pilot.
   Plain JavaScript, no build step. Practice mode runs on example data; Live mode fetches real
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
const DISMISS = ['The reading was wrong', 'Already handled by the school', 'Sent by mistake'];
const ESCALATE_MIN = Number(CFG.escalateMinutes) > 0 ? Number(CFG.escalateMinutes) : 30;
const RULES = `PM2.5 ≥ ${TH.pm25} µg/m³ · rain ≥ ${TH.rainMm} mm · heat ≥ ${TH.heatC} °C`;
const HZ = { air: ['Air', '#17483B'], rain: ['Heavy rain', 'var(--rain)'], heat: ['Heat', 'var(--heat)'] };
const r1 = (x) => Math.round(x * 10) / 10;
const airBand = (pm) => { const v = r1(pm); return AIR.find((b) => v <= b.hi) || AIR[AIR.length - 1]; };
const aqi = (pm) => { const v = r1(pm); if (v > 325.4) return 500; const b = airBand(v); return Math.round((b.ahi - b.alo) / (b.hi - b.lo) * (v - b.lo) + b.alo); };
const hazardOf = (a) => a.hazard === 'air' ? (AIR.find((b) => b.k === a.level) || AIR[2]) : (WEATHER[a.hazard] || WEATHER.rain);
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
  const tomorrow = { s1: 1.0, s2: 1.12, s3: 1.22, s4: 0.9, s5: 0.88, s6: 1.08, s7: 0.95, s8: 1.1 };
  const river = { s1: 2.4, s2: 1.6, s3: 1.3, s4: 1.0, s5: 1.1, s6: 1.4, s7: 1.2, s8: 1.5 };
  const shapeAt = (h) => 0.72 + 0.5 * Math.exp(-((h - 8) ** 2) / 3) + 0.38 * Math.exp(-((h - 19.5) ** 2) / 4) - (h > 1 && h < 5 ? 0.12 : 0);
  const h0 = Math.ceil(now / HOUR) * HOUR;
  const readings = {};
  schools.forEach((s) => {
    const hist = [];
    for (let k = 23; k >= 0; k--) hist.push(r1(nowPm[s.id] / 1.2 * shapeAt(new Date(now - k * HOUR).getHours() + 0.2) * Math.exp(gauss() * 0.08)));
    hist[23] = nowPm[s.id];
    const hours = [];
    for (let i = 0; i < 48; i++) {
      const t = h0 + i * HOUR, hr = new Date(t).getHours(), later = dayStart(t) > dayStart(now);
      const wet = hr >= 13 && hr <= 18;
      hours.push({ t, pm: r1(nowPm[s.id] / 1.22 * shapeAt(hr + 0.2) * (later ? tomorrow[s.id] : 1) * Math.exp(gauss() * 0.05)),
        rain: wet ? r1(Math.max(0, rainToday[s.id] / 6 * (later ? 0.55 : 1) * (0.6 + rnd() * 0.8))) : 0,
        pop: wet ? 55 + Math.round(rnd() * 30) : 8 + Math.round(rnd() * 14), temp: r1(15 + 10.5 * Math.max(0, Math.sin((hr - 7) / 12 * Math.PI)) + (later ? 0.6 : 0)) });
    }
    const days = [0, 1, 2].map((k) => ({ t: dayStart(now) + k * DAY, tmax: 25 + Math.round(rnd() * 2) + (k === 2 && s.id === 's3' ? 5 : 0), rainMm: r1(rainToday[s.id] * [1, 0.55, 0.8][k]), rainChance: 58 + Math.round(rnd() * 27) }));
    readings[s.id] = { pm25: nowPm[s.id], at: now - 4 * MIN, history: hist, source: 'demo', fc: { hours }, days,
      river: { ratio: river[s.id], peakT: dayStart(now) + 2 * DAY }, tempMax: days[0].tmax, rainMm: days[0].rainMm, rainChance: days[0].rainChance };
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
    pupils: Number.isFinite(pupils) && pupils >= 0 && pupils < 100000 ? pupils : null, phone: String(s.phone || '').replace(/[^\d+ ()-]/g, '').slice(0, 24) };
}
function initLive() {
  const saved = read(KEY);
  if (saved && Array.isArray(saved.schools)) return { schools: saved.schools, alerts: Array.isArray(saved.alerts) ? saved.alerts : [], readings: saved.readings || {}, updatedAt: saved.updatedAt || null, seq: saved.seq || 100, city: saved.city || null };
  return { schools: (CFG.schools || []).map(normSchool).filter(Boolean), alerts: [], readings: {}, updatedAt: null, seq: 100 };
}
let live = initLive();
function saveLive() { if (!write(KEY, live)) toast('This browser isn’t saving. Download a backup from Schools before you close the page.'); }
const prefs = read(PREF) || {};

/* ---------- State ---------- */
const VIEWS = ['overview', 'desk', 'parents', 'impact', 'schools'];
const state = {
  mode: prefs.mode === 'live' || prefs.mode === 'demo' ? prefs.mode : 'live', sensors: null,
  view: 'overview', schoolId: null, alertId: null, panel: null, filter: 'open', showAll: false, channel: 'sms',
  editing: null, removing: null, fetching: false, fetchError: false, dismissed: new Set(), demo: buildDemo(),
  draft: { hazard: 'air', value: '', step: '', actions: [], note: '', result: '', reason: '' },
  screen: { schoolId: null, name: '', room: '', lang: 'en' }, health: undefined,
};
function data() {
  if (state.mode === 'demo') { const d = state.demo; return { now: d.now, start: d.start, schools: d.schools, readings: d.readings, alerts: d.alerts }; }
  const times = live.alerts.map((a) => a.raisedAt);
  return { now: Date.now(), start: times.length ? Math.min(...times) : Date.now(), schools: live.schools, readings: live.readings, alerts: live.alerts };
}
const schoolById = (id) => data().schools.find((s) => s.id === id);
const schoolName = (a) => (schoolById(a.schoolId) || {}).name || a.schoolName || 'Removed school';
const openAlertFor = (sid) => data().alerts.find((a) => a.schoolId === sid && !a.closedAt);
const statusOf = (a) => a.dismissedAt ? 'dismissed' : a.expiredAt ? 'expired' : a.closedAt ? (a.ackAt ? 'closed' : 'missed') : a.actionAt ? 'acted' : a.ackAt ? 'acknowledged' : a.escalatedAt ? 'escalated' : 'waiting';
const STATUS = { waiting: ['Waiting for reply', 'var(--wait)'], escalated: ['Escalated', 'var(--bad)'], acknowledged: ['Acknowledged', 'var(--sun)'], acted: ['Action recorded', 'var(--rain)'], closed: ['Closed', 'var(--ok)'], missed: ['No response', 'var(--bad)'], expired: ['Expired', 'var(--bad)'], dismissed: ['Dismissed', 'var(--faint)'] };
const who = () => state.mode === 'demo' ? 'Practice user' : (prefs.who || 'Dunia team');
function addLog(a, at, what, detail, by) {
  a.log = Array.isArray(a.log) ? a.log : [];
  a.log.push({ at, by: by || who(), what, detail: String(detail || '').slice(0, 200) });
  if (a.log.length > 60) a.log = a.log.slice(-60);
}
// Every alert's record: saved entries, or for older alerts the steps rebuilt from their times.
function recordOf(a) {
  if (Array.isArray(a.log) && a.log.length) return { list: a.log, derived: false };
  const list = [{ at: a.raisedAt, what: 'Created and sent', detail: `${hazardOf(a).label}${a.value != null ? ' · ' + a.value : ''}` }];
  if (a.ackAt) list.push({ at: a.ackAt, what: 'Acknowledged', detail: a.ackBy || 'Head teacher' });
  if (a.actionAt) list.push({ at: a.actionAt, what: 'Action recorded', detail: (a.actions || []).join(', ') });
  if (a.parentsAt) list.push({ at: a.parentsAt, what: 'Parents informed', detail: '' });
  if (a.closedAt) list.push({ at: a.closedAt, what: 'Closed', detail: a.result || '' });
  return { list, derived: true };
}
const statusEl = (a) => { const [t, c] = STATUS[statusOf(a)]; return `<span class="status"><span class="dot" style="background:${c}"></span>${t}</span>`; };
function reading(rd, now) {
  if (!rd) return null;
  if (rd.monitor && now - rd.monitor.at < 3 * HOUR) return { value: rd.monitor.pm25, at: rd.monitor.at, source: 'Sensor reading entered by the team', kind: 'measured' };
  if (rd.sensor && now - rd.sensor.at < 3 * HOUR) return { value: rd.sensor.pm25, at: rd.sensor.at, source: `Measured by a sensor ${rd.sensor.km} km away${rd.sensor.provider ? ' (' + rd.sensor.provider + ')' : ''}`, kind: 'measured' };
  if (rd.pm25 == null) return null;
  return { value: rd.pm25, at: rd.at, source: rd.source === 'demo' ? 'Example reading' : 'Model estimate, Copernicus CAMS', kind: rd.source === 'demo' ? 'demo' : 'model' };
}
function ensureSchool(d) {
  if (schoolById(state.schoolId)) return;
  const open = d.alerts.find((a) => !a.closedAt && schoolById(a.schoolId));
  state.schoolId = open ? open.schoolId : (d.schools[0] || {}).id || null;
}
function stats(all, schools) {
  const alerts = all.filter((a) => !a.dismissedAt);
  const acked = alerts.filter((a) => a.ackAt);
  const ackMins = acked.map((a) => mins(a.raisedAt, a.ackAt));
  const acted = alerts.filter((a) => a.actionAt);
  const pupils = acted.reduce((sum, a) => sum + ((schools.find((s) => s.id === a.schoolId) || {}).pupils || 0), 0);
  return { total: alerts.length, ackRate: pct(acked.length, alerts.length), medAck: median(ackMins), actRate: pct(acted.length, alerts.length), toldRate: pct(alerts.filter((a) => a.parentsAt).length, alerts.length), pupils, ackMins, dismissed: all.length - alerts.length };
}
function suggestions(d) {
  const out = [];
  d.schools.forEach((s) => {
    const pm = reading(d.readings[s.id], d.now);
    if (pm && pm.value >= TH.pm25 && !d.alerts.some((a) => a.schoolId === s.id && a.hazard === 'air' && (!a.closedAt || a.raisedAt >= dayStart(d.now))))
      out.push({ s, hazard: 'air', value: pm.value, t: d.now, text: `PM2.5 ${pm.value} µg/m³ now · ${short(airBand(pm.value))}` });
  });
  return out.filter((x) => !state.dismissed.has(state.mode + x.s.id + x.hazard));
}
function upcoming(d) {
  const out = [], end = d.now + 48 * HOUR, now = suggestions(d).map((x) => x.s.id);
  const covered = (sid, hz, t) => d.alerts.some((a) => a.schoolId === sid && a.hazard === hz && (!a.closedAt || dayStart(a.raisedAt) === dayStart(t)));
  d.schools.forEach((s) => {
    const rd = d.readings[s.id]; if (!rd) return;
    const hrs = rd.fc && rd.fc.hours ? rd.fc.hours.filter((h) => h.t > d.now && h.t <= end) : [];
    const i0 = hrs.findIndex((h) => h.pm != null && h.pm >= TH.pm25);
    if (i0 >= 0 && !now.includes(s.id) && !covered(s.id, 'air', hrs[i0].t)) {
      let i1 = i0; while (i1 + 1 < hrs.length && hrs[i1 + 1].pm >= TH.pm25) i1++;
      const peak = r1(Math.max(...hrs.slice(i0, i1 + 1).map((h) => h.pm)));
      out.push({ s, hazard: 'air', t: hrs[i0].t, until: hrs[i1].t + HOUR, value: peak, text: `PM2.5 up to ${peak} µg/m³ · ${short(airBand(peak))}` });
    }
    (rd.days || []).forEach((dy) => {
      if (dy.t + DAY <= d.now || dy.t > end) return;
      if (dy.rainMm != null && dy.rainMm >= TH.rainMm && !covered(s.id, 'rain', dy.t)) {
        const wet = hrs.filter((h) => dayStart(h.t) === dy.t && h.rain > 0);
        const pk = wet.length ? wet.reduce((m, h) => (h.rain > m.rain ? h : m)) : null;
        out.push({ s, hazard: 'rain', t: pk ? pk.t : Math.max(dy.t, d.now), value: dy.rainMm, day: !pk, text: `${r1(dy.rainMm)} mm of rain${dy.rainChance != null ? `, ${dy.rainChance}% chance` : ''}${pk ? `; heaviest around ${fmtTime(pk.t)}` : ''}` });
      }
      if (dy.tmax != null && dy.tmax >= TH.heatC && !covered(s.id, 'heat', dy.t)) out.push({ s, hazard: 'heat', t: dy.t + 13 * HOUR, value: Math.round(dy.tmax), day: true, text: `High of ${Math.round(dy.tmax)}°C` });
    });
    if (rd.river && rd.river.ratio >= 2 && !covered(s.id, 'rain', d.now)) out.push({ s, hazard: 'rain', kind: 'river', t: Math.max(rd.river.peakT || d.now, d.now), day: true, value: null, text: `Nearby river expected at ${r1(rd.river.ratio)}× its usual flow` });
  });
  return out.filter((x) => !state.dismissed.has(state.mode + x.s.id + x.hazard + (x.kind || ''))).sort((a, b) => a.t - b.t);
}
const dayWord = (t, now) => sameDay(t, now) ? 'Today' : sameDay(t, now + DAY) ? 'Tomorrow' : new Date(t).toLocaleDateString('en-GB', { weekday: 'long' });
function whenText(x, now) {
  if (x.t <= now) return 'Now';
  if (x.day) return dayWord(x.t, now);
  if (x.until) return `${dayWord(x.t, now)}, ${fmtTime(x.t)}–${fmtTime(x.until)}`;
  return `${dayWord(x.t, now)}, ${fmtTime(x.t)}`;
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
    n.innerHTML = `<span><b>Practice</b> · Example schools and alerts for training. Nothing here is real.</span><button class="link" type="button" data-action="reset-demo">Start over</button>`;
    return;
  }
  const bad = state.fetchError || !storageOk;
  n.className = 'note ' + (bad ? 'note--warn' : 'note--live');
  const upd = live.updatedAt ? fmtWhen(live.updatedAt, Date.now()).replace('Today, ', '') : null;
  const when = state.fetching ? 'Updating readings…' : state.fetchError ? `Couldn’t reach the forecast service.${upd ? ' Showing readings from ' + upd + '.' : ''}` : upd ? `Updated ${upd}` : 'Loading live readings…';
  const sensors = state.sensors && state.sensors.status === 'connected' ? ` · ${state.sensors.count} air sensors` : '';
  n.innerHTML = `<span><span class="pulse" aria-hidden="true"></span><b>Live</b> · ${esc(when)}${sensors}${saving}</span>${state.fetching ? '' : '<button class="link" type="button" data-action="refresh">Refresh</button>'}`;
}
function emptyLive() {
  const c = live.city, r = c ? reading(c, Date.now()) : null;
  const city = c ? `<section class="stats">
      ${tile('Nairobi air now', r ? `${aqi(r.value)} <small>AQI</small>` : '–', r ? `${esc(short(airBand(r.value)))} · PM2.5 ${r.value} µg/m³` : 'No reading')}
      ${tile('Today', c.tempMax != null ? `${Math.round(c.tempMax)}° <small>high</small>` : '–', c.rainChance != null ? `Rain ${c.rainChance}% · ${r1(c.rainMm || 0)} mm` : '')}
      ${tile('Tomorrow', c.days && c.days[1] ? `${Math.round(c.days[1].tmax)}° <small>high</small>` : '–', c.days && c.days[1] ? `Rain ${c.days[1].rainChance ?? '–'}% · ${r1(c.days[1].rainMm || 0)} mm` : '')}
      ${tile('Air tomorrow', c.fc ? (() => { const m = Math.max(...c.fc.hours.filter((h) => sameDay(h.t, Date.now() + DAY)).map((h) => h.pm).filter((x) => x != null)); return isFinite(m) ? `${aqi(m)} <small>AQI peak</small>` : '–'; })() : '–', 'Forecast, city centre')}
    </section>` : '';
  return city + `<section class="card"><div class="empty"><span class="h">Add your pilot schools</span><span>Each school gets live air and weather readings, a 48-hour forecast and alerts. The figures above are for Nairobi city centre.</span><button class="btn" type="button" data-goto="schools">${icon('plus')}Add a school</button><button class="link" type="button" data-mode="demo">Or try practice mode</button></div></section>`;
}
const tile = (label, value, sub) => `<div class="tile"><span class="label">${label}</span><span class="tile__value num">${value}</span><span class="tile__sub">${sub}</span></div>`;

/* ----- Overview ----- */
function viewOverview() {
  const d = data();
  if (!d.schools.length) return emptyLive();
  ensureSchool(d);
  return statTiles(d) + attentionCard(d)
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
    ${(() => { const up = upcoming(d); return tile('Next 48 hours', up.length, up.length ? `First: ${esc(up[0].hazard === 'air' ? 'air' : up[0].kind === 'river' ? 'rivers' : up[0].hazard === 'rain' ? 'heavy rain' : 'heat')}, ${esc(whenText(up[0], d.now).toLowerCase())}` : (tMax != null ? `Nothing expected · high ${Math.round(tMax)}°, rain ${rCh ?? '–'}%` : 'Nothing expected')); })()}
    ${tile('Time to respond', st.medAck != null ? `${st.medAck} <small>min</small>` : '–', st.total ? `Median · ${st.ackRate}% of ${st.total} alerts acknowledged` : 'No alerts yet')}
  </section>`;
}
function attentionRow(x, now) {
  const c = x.hazard === 'air' ? airBand(x.value).c : WEATHER[x.hazard].c;
  const when = whenText(x, now);
  return `<div class="suggest"><span class="hz" style="--c:${c}">${icon(x.hazard)}</span>
      <span class="arow__main"><b>${esc(x.s.name)}</b><span>${esc(x.text)}</span></span>
      <span class="suggest__when">${esc(when)}</span>
      <span class="btns"><button class="btn btn--sm" type="button" data-action="review" data-id="${esc(x.s.id)}" data-v="${x.hazard}" data-val="${x.hazard === 'rain' ? '' : r1(x.value)}" data-when="${esc(when === 'Now' ? '' : when)}">Prepare alert</button><button class="btn btn--sm btn--quiet" type="button" data-action="dismiss" data-id="${esc(x.s.id)}" data-v="${x.hazard}${x.kind || ''}">Dismiss</button></span></div>`;
}
function attentionCard(d) {
  const now = suggestions(d), soon = upcoming(d);
  return `<section class="card"><div class="card__head"><h2 class="card__title">Needs attention</h2><span class="muted">From live readings and forecasts. Check each one, then send.</span></div>
    ${now.length ? `<div class="label group-label">Now</div>${now.map((x) => attentionRow(x, d.now)).join('')}` : ''}
    ${soon.length ? `<div class="label group-label">Next 48 hours</div>${soon.slice(0, 8).map((x) => attentionRow(x, d.now)).join('')}` : ''}
    ${!now.length && !soon.length ? '<div class="allclear"><span class="dot" style="background:var(--ok)"></span>Nothing expected at any school in the next 48 hours.</div>' : ''}
    ${soon.length > 8 ? `<div class="muted" style="margin-top:8px;font-size:12.5px">${soon.length - 8} more later in the period.</div>` : ''}</section>`;
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
function fcChart(hours, now) {
  const hs = hours.filter((h) => h.t > now - HOUR).slice(0, 48); if (hs.length < 6) return '';
  const W = 290, H = 96, top = 8, base = 70, n = hs.length, bw = W / n;
  const pms = hs.map((h) => h.pm).filter((x) => x != null), maxPm = Math.max(60, ...pms) * 1.08, maxRain = Math.max(6, ...hs.map((h) => h.rain || 0));
  const y = (v) => base - (base - top) * v / maxPm;
  const pts = hs.map((h, i) => h.pm == null ? null : [(i + 0.5) * bw, y(h.pm)]).filter(Boolean);
  const line = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join('');
  const bars = hs.map((h, i) => h.rain > 0.05 ? `<rect x="${(i * bw + 0.6).toFixed(1)}" y="${(base - 30 * h.rain / maxRain).toFixed(1)}" width="${(bw - 1.2).toFixed(1)}" height="${(30 * h.rain / maxRain).toFixed(1)}" rx="1" fill="var(--rain)" fill-opacity=".55"/>` : '').join('');
  const marks = hs.map((h, i) => new Date(h.t).getHours() === 0 ? `<line x1="${(i * bw).toFixed(1)}" x2="${(i * bw).toFixed(1)}" y1="${top}" y2="${base}" stroke="var(--line-2)" stroke-dasharray="2 3"/><text x="${(i * bw + 3).toFixed(1)}" y="${base + 13}" font-size="10" fill="var(--muted)">${new Date(h.t).toLocaleDateString('en-GB', { weekday: 'short' })}</text>` : '').join('');
  const y35 = y(TH.pm25);
  return `<svg class="chart" viewBox="-2 0 ${W + 4} ${H}" role="img" aria-label="Forecast for the next 48 hours: PM2.5 line and rain bars">${bars}${marks}<line x1="0" x2="${W}" y1="${y35.toFixed(1)}" y2="${y35.toFixed(1)}" stroke="var(--aq-usg)" stroke-dasharray="3 3"/><path d="${line}" fill="none" stroke="var(--accent)" stroke-width="1.7"/><line x1="0" x2="${W}" y1="${base}" y2="${base}" stroke="var(--line-2)"/><text x="0" y="${base + 13}" font-size="10" fill="var(--muted)">Now</text><text x="${W}" y="${base + 13}" font-size="10" text-anchor="end" fill="var(--muted)">+48 h</text></svg>`;
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
    ${rd && rd.fc && rd.fc.hours && rd.fc.hours.length > 6 ? `<hr class="divider"><div class="vstack"><div class="row" style="align-items:center"><span class="label">Next 48 hours</span><span class="fc-key"><i class="k-pm"></i>PM2.5 <i class="k-rain"></i>Rain <i class="k-line"></i>Alert level</span></div>${fcChart(rd.fc.hours, d.now)}
      ${rd.river ? `<div class="row"><span class="muted">Nearby river</span><span class="num">${r1(rd.river.ratio)}× usual flow</span></div>` : ''}</div>` : ''}
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
      ${dr.when ? `<div class="stepbox" style="margin:0"><span class="label" style="color:var(--accent)">Forecast</span><p>Expected ${esc(dr.when.toLowerCase().startsWith('today') || dr.when.toLowerCase().startsWith('tomorrow') ? dr.when.toLowerCase() : 'on ' + dr.when)}. Send it now so the school can plan ahead.</p></div>` : ''}
      ${dr.hazard === 'air' ? `<label class="field" for="rdValue"><span>${dr.when ? 'Forecast PM2.5 (µg/m³)' : 'PM2.5 (µg/m³). Check the nearest AirQo sensor.'}</span><input class="input num" id="rdValue" data-input="value" inputmode="decimal" placeholder="e.g. 42.5" value="${esc(dr.value)}"></label>${preview}`
        : dr.hazard === 'heat' ? `<label class="field" for="rdValue"><span>Forecast high (°C)</span><input class="input num" id="rdValue" data-input="value" inputmode="decimal" placeholder="e.g. 31" value="${esc(dr.value)}"></label>`
        : '<span class="muted">Send when heavy rain is forecast, or when the Kenya Meteorological Department issues a heavy rainfall advisory for the area.</span>'}
      ${level ? `<label class="field" for="rdStep"><span>Step for the school</span><textarea class="textarea" id="rdStep" data-input="step" rows="4">${esc(dr.step || level.step)}</textarea></label>` : ''}
      <button class="btn btn--block" type="button" data-action="send" ${sendable ? '' : 'disabled'}>${icon('bell')}Send alert</button>
      ${dr.hazard === 'air' && !isNaN(v) && !dr.when ? `<button class="btn btn--ghost btn--block" type="button" data-action="save-reading">Save as the school’s reading only</button>` : ''}
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
  const waiting = st === 'waiting' || st === 'escalated';
  const late = waiting && d.now - a.raisedAt >= ESCALATE_MIN * MIN;
  const escal = a.escalatedAt && waiting ? `<div class="flow__panel"><span class="muted">Escalated ${fmtTime(a.escalatedAt)}: the school was called.</span></div>`
    : late ? `<div class="flow__panel"><div class="flow__warn">No reply after ${mins(a.raisedAt, d.now)} minutes. Call the head teacher, or the deputy if they can’t answer.</div><button class="btn btn--ghost btn--sm" type="button" data-action="escalate" data-id="${esc(a.id)}">I called the school: mark escalated</button></div>` : '';
  const rec = recordOf(a);
  const canDismiss = !a.closedAt && !a.actionAt;
  const tools = `<div class="alert-tools">
      ${canDismiss ? `<details class="more"><summary>Dismiss as a false alarm</summary><div class="flow__panel"><label class="field" for="dsReason"><span>Why</span><select class="select" id="dsReason" data-change="reason"><option value="">Choose</option>${DISMISS.map((r) => `<option ${dr.reason === r ? 'selected' : ''}>${esc(r)}</option>`).join('')}</select></label>
        <button class="btn btn--ghost" type="button" data-action="dismiss-alert" data-id="${esc(a.id)}" ${dr.reason ? '' : 'disabled'}>Dismiss alert</button><span class="muted" style="font-size:12.5px">It stays in the record and is left out of response times.</span></div></details>` : ''}
      ${a.closedAt ? `<button class="link" type="button" data-action="reopen" data-id="${esc(a.id)}">Reopen with new evidence</button>` : ''}
      <details class="more"><summary>Record · ${rec.list.length} step${rec.list.length === 1 ? '' : 's'}</summary>
        <ol class="audit">${rec.list.map((e) => `<li><span class="mono">${fmtWhen(e.at, d.now)}</span><span><b>${esc(e.what)}</b>${e.by ? ` <span class="muted">· ${esc(e.by)}</span>` : ''}${e.detail ? `<br><span class="audit__d">${esc(e.detail)}</span>` : ''}</span></li>`).join('')}</ol>
        <p class="muted" style="font-size:12.5px;margin:10px 0 0">${rec.derived ? 'Rebuilt from the alert’s times.' : 'Saved as each step happened; steps can’t be edited.'}${a.source ? ' Evidence: ' + esc(a.source) + '.' : ''}${a.rules ? ' Rules: ' + esc(a.rules) + '.' : ''}</p></details></div>`;
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
      <li class="is-done"><span class="flow__n">1</span><div class="flow__body"><span class="flow__title">Alert sent</span><span class="muted">${fmtWhen(a.raisedAt, d.now)}</span>${waiting ? notify : ''}</div></li>
      <li class="${cls(a.ackAt, waiting)}"><span class="flow__n">2</span><div class="flow__body"><span class="flow__title">Head teacher acknowledges</span><span class="muted">${a.ackAt ? `${esc(a.ackBy || 'Head teacher')} · ${fmtTime(a.ackAt)} · ${mins(a.raisedAt, a.ackAt)} min after the alert` : a.dismissedAt ? 'Dismissed before a reply' : a.closedAt ? 'Not acknowledged before the end of the school day' : 'Waiting for a reply'}</span>
        ${escal}${waiting ? `<div class="flow__panel"><button class="btn" type="button" data-action="ack" data-id="${esc(a.id)}">They replied: mark acknowledged</button></div>` : ''}</div></li>
      <li class="${cls(a.actionAt, st === 'acknowledged')}"><span class="flow__n">3</span><div class="flow__body"><span class="flow__title">Record what the school did</span><span class="muted">${a.actionAt ? esc((a.actions || []).join(', ') + (a.note ? ' · ' + a.note : '')) + ' · ' + fmtTime(a.actionAt) : a.closedAt ? 'No action recorded' : 'After the head teacher replies'}</span>
        ${st === 'acknowledged' ? `<div class="flow__panel"><div class="pills">${ACTIONS[a.hazard].map((o) => `<button class="pill" type="button" data-action="toggle-action" data-v="${esc(o)}" aria-pressed="${dr.actions.includes(o)}">${esc(o)}</button>`).join('')}</div>
          <label class="field" for="actNote"><span>Note <span class="muted">(optional, never pupils’ names)</span></span><textarea class="textarea" id="actNote" data-input="note" rows="2">${esc(dr.note)}</textarea></label>
          <button class="btn" type="button" data-action="record" data-id="${esc(a.id)}" ${dr.actions.length || dr.note.trim() ? '' : 'disabled'}>Save action</button></div>` : ''}</div></li>
      <li class="${cls(a.parentsAt, st === 'acted' && !a.parentsAt)}"><span class="flow__n">4</span><div class="flow__body"><span class="flow__title">Inform parents</span><span class="muted">${a.parentsAt ? 'Parents informed · ' + fmtTime(a.parentsAt) : a.closedAt ? 'Not recorded' : 'Always for heavy rain and early release'}</span>
        ${st === 'acted' && !a.parentsAt ? `<div class="flow__panel"><div class="btns"><button class="btn btn--ghost" type="button" data-action="go-parents" data-id="${esc(a.id)}">Write the message</button><button class="btn" type="button" data-action="parents" data-id="${esc(a.id)}">Mark parents informed</button></div></div>` : ''}</div></li>
      <li class="${cls(a.closedAt, st === 'acted')}"><span class="flow__n">5</span><div class="flow__body"><span class="flow__title">Close with the result</span><span class="muted">${a.closedAt ? esc(a.result || 'Closed') : 'Saved for the pilot report'}</span>
        ${st === 'acted' ? `<div class="flow__panel"><label class="field" for="closeResult"><span>Result</span><select class="select" id="closeResult" data-change="result"><option value="">Choose</option>${RESULTS.map((r) => `<option ${dr.result === r ? 'selected' : ''}>${esc(r)}</option>`).join('')}</select></label>
          <button class="btn" type="button" data-action="close" data-id="${esc(a.id)}" ${dr.result ? '' : 'disabled'}>Close alert</button></div>` : ''}</div></li>
    </ol>${tools}</section>`;
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
    <div class="btns"><button class="btn btn--ghost" type="button" data-action="audit-csv">${icon('down')}Record</button><button class="btn btn--ghost" type="button" data-action="csv">${icon('down')}Download CSV</button></div></div>`;
  if (!d.alerts.length) return head + `<section class="card"><div class="empty"><span class="h">Nothing to report yet</span><span>Results build up as alerts are sent and schools respond.</span></div></section>`;
  const tiles = `<section class="stats stats--5">
    ${tile('Alerts sent', st.total, `${d.schools.length} schools${st.dismissed ? ` · ${st.dismissed} dismissed` : ''}`)}
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
    return `<div class="grid-main">${list}<aside class="stack"><section class="card"><span class="label">Practice mode</span><p style="margin:10px 0 16px">These are made-up schools for training. Switch to Live to add your pilot schools and get real readings.</p><button class="btn btn--block" type="button" data-mode="live">Switch to Live</button></section>${sourcesCard()}</aside></div>`;
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
    <div class="btns"><button class="btn btn--ghost" type="button" data-action="backup">${icon('down')}Download backup</button><button class="btn btn--ghost" type="button" data-action="restore">${icon('up')}Restore</button></div>
    <hr class="divider"><label class="field" for="fWho"><span>Your name on this device <span class="muted">(shown in each alert’s record)</span></span><input class="input" id="fWho" maxlength="40" autocomplete="name" placeholder="e.g. Amani, Dunia team" value="${esc(prefs.who || '')}"></label>
    <button class="btn btn--ghost btn--sm" type="button" data-action="save-who" style="margin-top:10px">Save name</button></section>`;
  if (state.health === undefined) fetchHealth();
  return `<div class="grid-main"><div class="stack">${list}${screensCard(d)}</div><aside class="stack">${form}${backup}${sourcesCard()}</aside></div>`;
}
/* Classroom screens: a link for each classroom's TV or tablet */
const ROOM_ID = /^[a-z0-9][a-z0-9-]{1,39}$/;
function screenUrl(s, sc) {
  const u = new URL('classroom', location.href); u.hash = '';
  const name = String(sc.name || '').replace(/[<>]/g, '').trim().slice(0, 40), room = String(sc.room || '').trim().toLowerCase();
  if (name) u.searchParams.set('name', name);
  u.searchParams.set('school', s.name);
  u.searchParams.set('lat', Number(s.lat).toFixed(4)); u.searchParams.set('lng', Number(s.lng).toFixed(4));
  if (ROOM_ID.test(room)) u.searchParams.set('room', room);
  if (sc.lang === 'sw') u.searchParams.set('lang', 'sw');
  return u.href;
}
function screensCard(d) {
  if (!d.schools.length) return '';
  const sc = state.screen; if (!schoolById(sc.schoolId)) sc.schoolId = state.schoolId && schoolById(state.schoolId) ? state.schoolId : d.schools[0].id;
  const s = schoolById(sc.schoolId), url = screenUrl(s, sc);
  return `<section class="card"><div class="card__head"><h2 class="card__title">Classroom screens</h2><a class="link" href="classroom?demo=1" target="_blank" rel="noopener">See an example</a></div>
    <p class="muted" style="margin:0 0 16px">A wall screen for a classroom TV or tablet: conditions inside (once a sensor is installed) and outside, a daily Climate Detective question, in English or Kiswahili. It shows no names and has no controls for learners.</p>
    <div class="form">
      <div class="form2"><label class="field" for="scSchool"><span>School</span><select class="select" id="scSchool" data-screen="schoolId">${d.schools.map((x) => `<option value="${esc(x.id)}" ${x.id === sc.schoolId ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select></label>
      <label class="field" for="scName"><span>Class</span><input class="input" id="scName" data-screen="name" maxlength="40" autocomplete="off" placeholder="e.g. Class 6 Blue" value="${esc(sc.name)}"></label></div>
      <div class="form2"><label class="field" for="scRoom"><span>Sensor room ID <span class="muted">(optional)</span></span><input class="input" id="scRoom" data-screen="room" maxlength="40" autocomplete="off" placeholder="e.g. baraka-6a" value="${esc(sc.room)}"><span class="muted" id="scRoomBad" style="font-size:12.5px" ${!sc.room || ROOM_ID.test(sc.room.trim().toLowerCase()) ? 'hidden' : ''}>Use lowercase letters, numbers and dashes, as set up for the sensor.</span></label>
      <label class="field" for="scLang"><span>Language</span><select class="select" id="scLang" data-screen="lang"><option value="en" ${sc.lang !== 'sw' ? 'selected' : ''}>English</option><option value="sw" ${sc.lang === 'sw' ? 'selected' : ''}>Kiswahili</option></select></label></div>
      <input class="input" id="scLink" readonly hidden value="${esc(url)}" aria-label="Screen link">
      <div class="btns"><a class="btn" id="scOpen" href="${esc(url)}" target="_blank" rel="noopener">Open screen</a><button class="btn btn--ghost" type="button" data-action="copy-screen">${icon('copy')}Copy link</button></div>
    </div></section>`;
}
async function fetchHealth() {
  state.health = null;
  try { const r = await fetch('api/v1/health', { headers: { Accept: 'application/json' } }); state.health = r.ok ? await r.json() : { none: true }; }
  catch (e) { state.health = { none: true }; }
  if (state.view === 'schools') render(true);
}
function sourcesCard() {
  const sn = state.sensors || {};
  const row = (ok, name, what) => `<li class="src"><span class="dot" style="background:${ok === true ? 'var(--ok)' : ok === false ? 'var(--faint)' : 'var(--wait)'}"></span><span><b>${name}</b><br><span class="muted">${what}</span></span></li>`;
  return `<section class="card"><span class="label">Data sources</span><ul class="srcs">
    ${row(true, 'Weather forecast', 'Open-Meteo: temperature, rain amount and chance, hour by hour for 48 hours')}
    ${row(true, 'Air quality', 'Copernicus CAMS model via Open-Meteo: PM2.5 now and a 3-day forecast')}
    ${row(true, 'River flow', 'Global Flood Awareness System (GloFAS) via Open-Meteo: flow compared with the last 30 days')}
    ${(() => { const h = state.health; const on = h && h.storage && h.devices > 0;
      return row(on ? true : h === null || h === undefined ? null : false, 'Classroom sensors', on ? `${h.devices} sensor${h.devices === 1 ? '' : 's'} registered in ${h.rooms} classroom${h.rooms === 1 ? '' : 's'}. Readings go to the classroom screens.` : h && h.none ? 'Needs the site on Vercel.' : h && !h.storage ? 'Not set up yet: connect Upstash for Redis in Vercel, then add the sensors (see the README).' : h ? 'Storage is ready. Add the sensors to DEVICE_KEYS in Vercel (see the README).' : 'Checking…'); })()}
    ${row(sn.status === 'connected' ? true : sn.status === 'error' ? null : false, 'Air sensors on the ground', sn.status === 'connected' ? `OpenAQ: ${sn.count} PM2.5 sensors reporting near the schools. A school uses its nearest sensor within 5 km.` : 'OpenAQ (includes AirQo sensors). Not connected: add a free OpenAQ API key in Vercel to use measured readings.')}
  </ul><p class="muted" style="margin:12px 0 0;font-size:12.5px">The air model works at a city scale, so nearby schools read alike. Before sending an air alert, check the nearest <a href="https://airqo.net/" target="_blank" rel="noopener">AirQo</a> sensor. For heavy rain, follow the <a href="https://meteo.go.ke/" target="_blank" rel="noopener">Kenya Meteorological Department</a>.</p></section>`;
}

/* ---------- Live readings (Open-Meteo, no key needed) ---------- */
async function getJSON(url) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 12000);
  try { const r = await fetch(url, { signal: ctl.signal }); if (!r.ok) throw new Error('HTTP ' + r.status); return await r.json(); } finally { clearTimeout(t); }
}
const OM = { air: 'https://air-quality-api.open-meteo.com/v1/air-quality', wx: 'https://api.open-meteo.com/v1/forecast', flood: 'https://flood-api.open-meteo.com/v1/flood' };
const asList = (j) => Array.isArray(j) ? j : (j ? [j] : []);
const arr = (o, k) => (o && Array.isArray(o[k]) ? o[k] : []);
const kmBetween = (a, b) => { const R = 6371, dLat = (b.lat - a.lat) * Math.PI / 180, dLng = (b.lng - a.lng) * Math.PI / 180, x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(x)); };
async function forecastFor(points) {
  const now = Date.now();
  const lat = points.map((p) => p.lat.toFixed(4)).join(','), lng = points.map((p) => p.lng.toFixed(4)).join(',');
  const q = `latitude=${lat}&longitude=${lng}`, tz = '&timezone=Africa%2FNairobi';
  const [aq, wx, fl] = await Promise.allSettled([
    getJSON(`${OM.air}?${q}${tz}&current=pm2_5&hourly=pm2_5&past_days=1&forecast_days=3`),
    getJSON(`${OM.wx}?${q}${tz}&hourly=temperature_2m,precipitation,precipitation_probability&daily=temperature_2m_max,precipitation_sum,precipitation_probability_max&forecast_days=3`),
    getJSON(`${OM.flood}?${q}&daily=river_discharge&past_days=30&forecast_days=7`),
  ]);
  if (aq.status !== 'fulfilled' && wx.status !== 'fulfilled') throw new Error('forecast service unreachable');
  const A = aq.status === 'fulfilled' ? asList(aq.value) : [], X = wx.status === 'fulfilled' ? asList(wx.value) : [], F = fl.status === 'fulfilled' ? asList(fl.value) : [];
  return points.map((p, i) => {
    const a = A[i], x = X[i], f = F[i];
    const off = ((a || x || {}).utc_offset_seconds || 0) * 1000, ts = (t) => Date.parse(t + 'Z') - off;
    const pmAt = new Map(); const hist = [];
    const ah = a && a.hourly, apm = arr(ah, 'pm2_5');
    arr(ah, 'time').forEach((t, k) => { const v = apm[k]; if (v == null) return; const T = ts(t); pmAt.set(T, r1(v)); if (T <= now) hist.push(r1(v)); });
    const cur = a && a.current && a.current.pm2_5 != null ? r1(a.current.pm2_5) : hist[hist.length - 1];
    const hours = [];
    const xh = x && x.hourly, xt = arr(xh, 'time'), xr = arr(xh, 'precipitation'), xp = arr(xh, 'precipitation_probability'), xT = arr(xh, 'temperature_2m');
    if (xt.length) xt.forEach((t, k) => { const T = ts(t); if (T < now - HOUR || T > now + 49 * HOUR) return; hours.push({ t: T, pm: pmAt.has(T) ? pmAt.get(T) : null, rain: xr[k] ?? 0, pop: xp[k] ?? null, temp: xT[k] ?? null }); });
    else pmAt.forEach((v, T) => { if (T > now - HOUR && T <= now + 49 * HOUR) hours.push({ t: T, pm: v, rain: 0, pop: null, temp: null }); });
    const xd = x && x.daily, dmax = arr(xd, 'temperature_2m_max'), dsum = arr(xd, 'precipitation_sum'), dpop = arr(xd, 'precipitation_probability_max');
    const days = arr(xd, 'time').map((t, k) => ({ t: dayStart(Date.parse(t + 'T00:00:00')), tmax: dmax[k] ?? null, rainMm: dsum[k] ?? null, rainChance: dpop[k] ?? null }));
    let river = null;
    if (f && f.daily && Array.isArray(f.daily.river_discharge) && Array.isArray(f.daily.time)) {
      const today0 = new Date(now).toISOString().slice(0, 10);
      const past = [], next = [];
      const until = new Date(now + 2 * DAY).toISOString().slice(0, 10);
      f.daily.time.forEach((t, k) => { const v = f.daily.river_discharge[k]; if (v == null) return; if (t < today0) past.push({ t, v }); else if (t <= until) next.push({ t, v }); });
      const usual = past.length ? [...past.map((o) => o.v)].sort((m, n) => m - n)[past.length >> 1] : null;
      if (usual != null && next.length) { const pk = next.reduce((m, o) => (o.v > m.v ? o : m)); river = { ratio: r1(pk.v / Math.max(usual, 0.5)), usual: r1(usual), peak: r1(pk.v), peakT: dayStart(Date.parse(pk.t + 'T00:00:00')) }; }
    }
    return { pm25: cur ?? null, at: a && a.current && a.current.time ? ts(a.current.time) : now, history: hist.slice(-24), source: 'model', fc: { hours }, days, river,
      tempMax: days[0] ? days[0].tmax : null, rainMm: days[0] ? days[0].rainMm : null, rainChance: days[0] ? days[0].rainChance : null };
  });
}
async function fetchSensors(points) {
  if (!points.length) return [];
  try {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 12000);
    const r = await fetch('api/sensors', { signal: ctl.signal, headers: { Accept: 'application/json' } }); clearTimeout(t);
    if (!r.ok) { state.sensors = { status: r.status === 404 ? 'none' : 'error' }; return []; }
    const j = await r.json();
    if (!j.connected) { state.sensors = { status: 'not-set' }; return []; }
    const list = (j.sensors || []).filter((x) => Number.isFinite(x.lat) && Number.isFinite(x.lng) && Number.isFinite(x.pm25) && x.pm25 >= 0 && x.pm25 < 1000);
    state.sensors = { status: 'connected', count: list.length };
    return list.map((x) => ({ ...x, at: Date.parse(x.at) }));
  } catch (e) { state.sensors = { status: 'error' }; return []; }
}
async function fetchReadings() {
  if (state.fetching) return;
  state.fetching = true; renderNote();
  try {
    if (!live.schools.length) {
      const [city] = await forecastFor([{ lat: -1.2864, lng: 36.8172 }]);
      live.city = city; state.fetchError = false; live.updatedAt = Date.now(); saveLive();
    } else {
      const pts = live.schools.map((s) => ({ lat: s.lat, lng: s.lng }));
      const [fresh, sensors] = await Promise.all([forecastFor(pts), fetchSensors(pts)]);
      live.schools.forEach((s, i) => {
        const v = fresh[i], prev = live.readings[s.id];
        if (prev && prev.monitor) v.monitor = prev.monitor;
        const near = sensors.map((x) => ({ x, km: kmBetween(s, x) })).filter((o) => o.km <= 5 && Date.now() - o.x.at < 3 * HOUR).sort((m, n) => m.km - n.km)[0];
        if (near) v.sensor = { pm25: r1(near.x.pm25), at: near.x.at, name: near.x.name, provider: near.x.provider, km: r1(near.km) };
        if (v.pm25 == null && prev) { v.pm25 = prev.pm25; v.at = prev.at; }
        live.readings[s.id] = v;
      });
      state.fetchError = false; live.updatedAt = Date.now(); saveLive();
    }
  } catch (e) { state.fetchError = true; }
  state.fetching = false;
  render(true);
}
let timer = null;
function startLive() {
  clearInterval(timer); expireOld();
  const stale = !live.updatedAt || Date.now() - live.updatedAt > CFG.refreshMinutes * MIN;
  if (stale || Object.keys(live.readings).length < live.schools.length || (!live.schools.length && !live.city)) fetchReadings();
  timer = setInterval(() => { if (state.mode === 'live' && !document.hidden) fetchReadings(); }, CFG.refreshMinutes * MIN);
}
document.addEventListener('visibilitychange', () => { if (!document.hidden && state.mode === 'live' && live.updatedAt && Date.now() - live.updatedAt > CFG.refreshMinutes * MIN) fetchReadings(); });

/* ---------- Actions ---------- */
function toast(t) { const el = $('#toast'); el.textContent = t; el.classList.add('is-on'); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('is-on'), 2600); }
function resetDraft(hazard = 'air') { state.draft = { hazard, value: '', step: '', actions: [], note: '', result: '', reason: '' }; }
const stamp = () => state.mode === 'demo' ? (state.demo.now += 3 * MIN) : Date.now();
function patchAlert(id, patch, at, what, detail) {
  const list = state.mode === 'demo' ? state.demo.alerts : live.alerts;
  const a = list.find((x) => x.id === id); if (!a) return false;
  if (what && !(Array.isArray(a.log) && a.log.length)) a.log = recordOf(a).list.map((e) => ({ ...e, by: e.by || 'Dunia team' }));
  Object.assign(a, patch);
  if (what) addLog(a, at, what, detail);
  if (state.mode === 'live') saveLive(); return true;
}
// Alerts nobody answered by the end of the school day are closed as expired, so the open list stays true.
function expireOld() {
  if (state.mode !== 'live') return;
  const t0 = dayStart(Date.now()); let n = 0;
  live.alerts.forEach((a) => {
    if (a.closedAt || a.ackAt || a.raisedAt >= t0) return;
    if (!(Array.isArray(a.log) && a.log.length)) a.log = recordOf(a).list;
    a.expiredAt = a.closedAt = Date.now(); a.result = 'Expired: no reply before the end of the school day';
    addLog(a, a.expiredAt, 'Expired', 'Still waiting for a reply when the school day ended', 'Dunia Alerts'); n++;
  });
  if (n) saveLive();
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
  prefs.mode = m; write(PREF, prefs);
  render();
  if (m === 'live') startLive();
}
function prefillRaise(hazard, value, when) {
  resetDraft(hazard);
  if (value != null && value !== '') state.draft.value = String(value);
  else if (hazard === 'air') { const r = reading(data().readings[state.schoolId], data().now); if (r) state.draft.value = String(r.value); }
  else if (hazard === 'heat') { const rd = data().readings[state.schoolId]; if (rd && rd.tempMax != null) state.draft.value = String(Math.round(rd.tempMax)); }
  if (when) { const v = parseFloat(state.draft.value); const lvl = hazard === 'air' ? (!isNaN(v) ? airBand(v) : AIR[2]) : WEATHER[hazard]; state.draft.step = `Expected ${when.toLowerCase().startsWith('today') || when.toLowerCase().startsWith('tomorrow') ? when.toLowerCase() : 'on ' + when}: ${lvl.step}`; state.draft.when = when; }
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
    case 'review': state.schoolId = id; prefillRaise(v, el.dataset.val, el.dataset.when); render(); $('#side') && $('#side').scrollIntoView({ behavior: 'smooth', block: 'nearest' }); return;
    case 'dismiss': state.dismissed.add(state.mode + id + v); break;
    case 'cancel': state.panel = null; resetDraft(); break;
    case 'hazard': prefillRaise(v); break;
    case 'filter': state.filter = v; state.showAll = false; break;
    case 'show-all': state.showAll = true; break;
    case 'channel': state.channel = v; break;
    case 'toggle-action': { const xs = state.draft.actions; const i = xs.indexOf(v); if (i >= 0) xs.splice(i, 1); else xs.push(v); break; }
    case 'reset-demo': state.demo = buildDemo(); state.schoolId = null; state.alertId = null; state.panel = null; state.dismissed.clear(); resetDraft(); toast('Practice reset.'); break;
    case 'refresh': fetchReadings(); return;
    case 'ack': { const t = stamp(); if (patchAlert(id, { ackAt: t, ackBy: 'Head teacher' }, t, 'Acknowledged', 'Head teacher replied')) { resetDraft(); toast('Marked as acknowledged.'); } break; }
    case 'record': { const dr = state.draft, t = stamp(); if (patchAlert(id, { actions: [...dr.actions], note: dr.note.trim().slice(0, 300), actionAt: t }, t, 'Action recorded', [...dr.actions, dr.note.trim()].filter(Boolean).join(', '))) { resetDraft(); toast('Action saved.'); } break; }
    case 'parents': { const t = stamp(); if (patchAlert(id, { parentsAt: t }, t, 'Parents informed', 'English and Kiswahili message')) toast('Parents marked as informed.'); break; }
    case 'close': { const res = state.draft.result; if (!res) break; const t = stamp(); state.alertId = id; if (patchAlert(id, { result: res, closedAt: t }, t, 'Closed', res)) { resetDraft(); toast(res === RESULTS[2] ? 'Closed. Follow up with partners.' : 'Alert closed.'); } break; }
    case 'escalate': { const t = stamp(), a0 = data().alerts.find((x) => x.id === id); if (a0 && patchAlert(id, { escalatedAt: t }, t, 'Escalated', `No reply after ${mins(a0.raisedAt, t)} minutes: called the school`)) toast('Marked as escalated.'); break; }
    case 'dismiss-alert': { const why = state.draft.reason; if (!why) break; const t = stamp(); state.alertId = id; if (patchAlert(id, { dismissedAt: t, closedAt: t, result: 'Dismissed: ' + why }, t, 'Dismissed', why)) { resetDraft(); toast('Alert dismissed. It stays in the record.'); } break; }
    case 'reopen': { const t = stamp(); if (patchAlert(id, { closedAt: null, dismissedAt: null, expiredAt: null, result: '', reopenedAt: t }, t, 'Reopened', 'New evidence')) { resetDraft(); toast('Alert reopened.'); } break; }
    case 'save-who': { const v = ($('#fWho').value || '').replace(/[<>]/g, '').trim().slice(0, 40); prefs.who = v; write(PREF, prefs); toast(v ? 'Saved. Your records will show ' + v + '.' : 'Saved.'); break; }
    case 'copy-screen': { const s0 = schoolById(state.screen.schoolId) || data().schools[0]; if (!s0) return; const u = screenUrl(s0, state.screen);
      try { await navigator.clipboard.writeText(u); toast('Link copied. Open it on the classroom screen.'); } catch (e) { const i = $('#scLink'); if (i) { i.hidden = false; i.select(); } toast('Select the link and copy it.'); } return; }
    case 'audit-csv': exportAudit(); return;
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
  const before = reading(readings[s.id], t);
  const source = dr.when ? `Forecast for ${dr.when.toLowerCase()} (Open-Meteo)` : dr.hazard === 'air' ? (before && !isNaN(v) && Math.abs(before.value - v) < 0.05 ? before.source : 'Reading entered by the team')
    : dr.hazard === 'heat' ? 'Open-Meteo forecast' : 'Rain forecast or Kenya Meteorological Department advisory';
  if (dr.hazard === 'air' && !isNaN(v) && !dr.when) {
    const prev = readings[s.id] || {};
    if (state.mode === 'demo') readings[s.id] = { ...prev, pm25: r1(v), at: t, history: [...(prev.history || []).slice(-23), r1(v)] };
    else readings[s.id] = { ...prev, monitor: { pm25: r1(v), at: t } };
  }
  if (send) {
    const level = dr.hazard === 'air' ? airBand(v).k : dr.hazard;
    const step = (dr.step || (dr.hazard === 'air' ? airBand(v).step : WEATHER[dr.hazard].step)).trim().slice(0, 600);
    const seq = state.mode === 'demo' ? 100 + state.demo.alerts.length + 1 : ++live.seq;
    const alert = { id: 'a' + t.toString(36) + Math.random().toString(36).slice(2, 6), ref: 'DA-' + seq, schoolId: s.id, schoolName: s.name, hazard: dr.hazard, level,
      value: dr.hazard === 'rain' ? null : (isNaN(v) ? null : r1(v)), raisedAt: t, step, actions: [], expected: dr.when || null, rules: RULES, source };
    addLog(alert, t, 'Created and sent', `${hazardOf(alert).label}${alert.value != null ? ' · ' + alert.value + (dr.hazard === 'air' ? ' µg/m³' : ' °C') : ''} · ${source}`);
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
  const lines = [['dataset', 'ref', 'school', 'area', 'hazard', 'level', 'value', 'status', 'source', 'rules', 'expected', 'raised', 'escalated', 'acknowledged', 'minutes_to_acknowledge', 'actions', 'note', 'parents_informed', 'closed', 'result'].join(',')];
  d.alerts.forEach((a) => { const s = schoolById(a.schoolId) || {};
    lines.push([dataset, a.ref, schoolName(a), s.area, a.hazard, hazardOf(a).label, a.value, STATUS[statusOf(a)][0], a.source, a.rules, a.expected, iso8601(a.raisedAt), iso8601(a.escalatedAt), iso8601(a.ackAt), a.ackAt ? mins(a.raisedAt, a.ackAt) : '', (a.actions || []).join('; '), a.note, iso8601(a.parentsAt), iso8601(a.closedAt), a.result].map(q).join(',')); });
  download(`dunia-alerts-${state.mode === 'demo' ? 'demo-example-data' : 'pilot'}-${today()}.csv`, '﻿' + lines.join('\r\n'), 'text/csv;charset=utf-8');
  toast('CSV downloaded.');
}
// One row per step of every alert: who did what, when. For the pilot's audit and evaluation.
function exportAudit() {
  const d = data();
  const q = (x) => '"' + String(x ?? '').replace(/"/g, '""') + '"';
  const dataset = state.mode === 'demo' ? 'EXAMPLE DATA (demo, not real pilot results)' : 'pilot';
  const lines = [['dataset', 'ref', 'school', 'hazard', 'time', 'step', 'by', 'detail', 'rebuilt_from_times'].join(',')];
  d.alerts.slice().reverse().forEach((a) => { const r = recordOf(a);
    r.list.forEach((e) => lines.push([dataset, a.ref, schoolName(a), a.hazard, new Date(e.at).toISOString(), e.what, e.by || '', e.detail, r.derived ? 'yes' : 'no'].map(q).join(','))); });
  download(`dunia-alerts-record-${state.mode === 'demo' ? 'demo-example-data' : 'pilot'}-${today()}.csv`, '﻿' + lines.join('\r\n'), 'text/csv;charset=utf-8');
  toast('Record downloaded.');
}
$('#restoreFile').addEventListener('change', async (e) => {
  const f = e.target.files && e.target.files[0]; e.target.value = ''; if (!f) return;
  try {
    if (f.size > 5 * 1024 * 1024) throw new Error('too big');
    const o = JSON.parse(await f.text());
    if (!o || o.app !== 'dunia-alerts' || !Array.isArray(o.schools) || !Array.isArray(o.alerts)) throw new Error('not a backup');
    const alerts = o.alerts.slice(0, 20000).map(cleanAlert).filter(Boolean);
    live = { schools: o.schools.slice(0, 500).map(normSchool).filter(Boolean), alerts, readings: {}, updatedAt: null, seq: Number.isInteger(o.seq) && o.seq > 0 ? o.seq : 100 + alerts.length, city: null };
    saveLive(); state.schoolId = null; state.alertId = null; toast(`Restored ${live.schools.length} schools and ${live.alerts.length} alerts.`);
    if (state.mode !== 'live') setMode('live'); else { render(); fetchReadings(); }
  } catch (err) { toast('That file isn’t a Dunia Alerts backup.'); }
});

/* Backups are files from outside the app: keep only known fields, with checked types and lengths */
const LEVELS = [...AIR.map((b) => b.k), 'rain', 'heat'];
const str = (v, n) => (typeof v === 'string' ? v.slice(0, n) : '');
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
function cleanAlert(a) {
  if (!a || typeof a !== 'object' || !['air', 'rain', 'heat'].includes(a.hazard)) return null;
  const raisedAt = num(a.raisedAt);
  if (!raisedAt || a.id == null || a.schoolId == null) return null;
  return { id: String(a.id).slice(0, 40), ref: str(a.ref, 20) || 'DA-?', schoolId: String(a.schoolId).slice(0, 60), schoolName: str(a.schoolName, 80),
    hazard: a.hazard, level: LEVELS.includes(a.level) ? a.level : (a.hazard === 'air' ? 'usg' : a.hazard), value: num(a.value), raisedAt, step: str(a.step, 600),
    actions: Array.isArray(a.actions) ? a.actions.filter((x) => typeof x === 'string').slice(0, 8).map((x) => x.slice(0, 80)) : [], note: str(a.note, 300),
    ackAt: num(a.ackAt), ackBy: str(a.ackBy, 60), actionAt: num(a.actionAt), parentsAt: num(a.parentsAt), closedAt: num(a.closedAt), result: str(a.result, 80), expected: str(a.expected, 60) || null,
    escalatedAt: num(a.escalatedAt), dismissedAt: num(a.dismissedAt), expiredAt: num(a.expiredAt), reopenedAt: num(a.reopenedAt), rules: str(a.rules, 100), source: str(a.source, 140),
    log: Array.isArray(a.log) ? a.log.slice(-60).filter((e) => e && num(e.at)).map((e) => ({ at: e.at, by: str(e.by, 60), what: str(e.what, 40), detail: str(e.detail, 200) })) : [] };
}

/* ---------- Events ---------- */
document.addEventListener('click', (e) => {
  const t = e.target.closest('[data-view]'); if (t) { setView(t.dataset.view, true); return; }
  const m = e.target.closest('[data-mode]'); if (m) { setMode(m.dataset.mode); return; }
  const g = e.target.closest('[data-goto]'); if (g) { setView(g.dataset.goto, true); return; }
  const b = e.target.closest('[data-action]'); if (b && !b.disabled) { if (b.tagName === 'A') return; act(b); }
});
document.addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('g[data-action], tr[data-action]')) { e.preventDefault(); act(e.target); } });
document.addEventListener('input', (e) => {
  const sk = e.target.dataset.screen;
  if (sk) { state.screen[sk] = e.target.value; const s0 = schoolById(state.screen.schoolId) || data().schools[0]; const u = s0 ? screenUrl(s0, state.screen) : '#'; const o = $('#scOpen'); if (o) o.href = u; const l = $('#scLink'); if (l) l.value = u; const bad = $('#scRoomBad'); if (bad) bad.hidden = !state.screen.room || ROOM_ID.test(state.screen.room.trim().toLowerCase()); return; }
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
  if (k === 'reason') { state.draft.reason = e.target.value; const btn = $('[data-action="dismiss-alert"]'); if (btn) btn.disabled = !state.draft.reason; }
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
