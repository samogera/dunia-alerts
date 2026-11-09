/* Dunia Alerts: classroom wall screen.
   Open on the classroom's TV or tablet with the link made in Schools → Classroom screens, e.g.
   classroom?name=Class%206%20Blue&school=Baraka%20Primary&lat=-1.3125&lng=36.786&room=baraka-6a&lang=sw
   Inside: the classroom sensor through /api/v1/classroom (when a sensor is installed).
   Outside: Open-Meteo weather and Copernicus CAMS air. No names, no personal information, no controls for learners.
   ?demo=1 (or air, co2, heat, stale) shows clearly labelled example data for training. */
(() => {
'use strict';
const CFG = window.DUNIA_ALERTS_CONFIG || {};
const TH = Object.assign({ pm25: 35.5, rainMm: 30, heatC: 30 }, CFG.thresholds || {});
const CL = Object.assign({ co2Open: 1000, co2High: 1500, warmC: 27, hotC: 30, coolC: 18, dryPct: 30, humidPct: 70 }, CFG.classroom || {});
const MIN = 60000;
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ---------- Settings from the link ---------- */
const P = new URLSearchParams(location.search);
const clean = (s, n) => String(s || '').replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, n);
const num = (s, lim) => { const v = parseFloat(s); return Number.isFinite(v) && Math.abs(v) <= lim ? v : null; };
const ROOM = /^[a-z0-9][a-z0-9-]{1,39}$/.test(P.get('room') || '') ? P.get('room') : null;
const LAT = num(P.get('lat'), 90), LNG = num(P.get('lng'), 180);
const PLACE = LAT != null && LNG != null ? { lat: LAT, lng: LNG, custom: true } : { lat: -1.2864, lng: 36.8172, custom: false };
const DEMO = ['1', 'air', 'co2', 'heat', 'stale', 'rain'].includes(P.get('demo')) ? P.get('demo') : null;
const NAME = clean(P.get('name'), 60), SCHOOL = clean(P.get('school'), 80);
const store = { get: (k) => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* screen still works */ } } };
const CACHE = 'dunia-classroom:' + (ROOM || `${PLACE.lat.toFixed(3)},${PLACE.lng.toFixed(3)}`);
let lang = ['en', 'sw'].includes(P.get('lang')) ? P.get('lang') : (store.get('dunia-classroom:lang') || 'en');

/* ---------- Words (English / Kiswahili) ---------- */
const T = {
  en: {
    app: 'Classroom', classroom: 'Our classroom', city: 'Nairobi city centre', inside: 'Inside our classroom', outside: 'Outside now',
    temp: 'Temperature', co2: 'Fresh air', pm: 'Dust in the air', rh: 'Humidity', air: 'Air quality', rain: 'Rain today', tempOut: 'Temperature',
    hTemp: 'How warm the room is', hCo2: 'Lower number, fresher air', hPm: 'Tiny dust you cannot see', hRh: 'Water vapour in the air',
    comfortable: 'Comfortable', warm: 'Warm', hot: 'Hot', cool: 'Cool', fresh: 'Fresh', open: 'Open windows', stuffy: 'Stuffy', dry: 'Dry', humid: 'Humid',
    good: 'Good', moderate: 'Moderate', usg: 'Not good for some', unhealthy: 'Unhealthy', very: 'Very unhealthy', hazardous: 'Hazardous',
    up: 'Rising', down: 'Falling', steady: 'Steady', na: 'Not available', checkSensor: 'Sensor needs checking', checking: 'Being checked',
    noSensor: 'No indoor sensor in this classroom yet. These are the conditions outside.', upTo: (v) => `Up to ${v}°`, mm: (mm) => `${mm} mm expected`,
    goodH: 'Our classroom is ready for learning.', goodSub: 'Fresh air and a comfortable room.', goodSubOut: 'No warnings for our school today.',
    cityH: 'No air or weather warnings today.', citySub: 'To set this screen up for a classroom, use Dunia Alerts → Schools → Classroom screens.',
    airH: 'The air outside is not clean today.', airSub: 'Play and exercise indoors, and follow your teacher.',
    dustH: 'The air in our classroom is dusty.', dustSub: 'Tell your teacher. Close the windows that face the road.',
    rainH: 'Heavy rain is expected today.', rainSub: 'Keep away from drains and flooded paths. Your teacher will tell you about home time.',
    co2HighH: 'Time for fresh air.', co2HighSub: 'Open the windows and the door for a few minutes.',
    co2MidH: 'Let some fresh air in.', co2MidSub: 'Open a window or the door.',
    windowsCare: 'Ask your teacher before opening windows: the air outside is not clean.',
    hotH: 'It is hot today.', hotSub: 'Drink water often and rest in the shade at break.',
    warmH: 'It is getting warm in here.', warmSub: 'Open the windows if the air outside is clean, and drink water.',
    staleH: 'Data not current', staleSub: (t) => `Last reading at ${t}. Please tell your teacher.`, staleNever: 'No reading yet. Please tell your teacher.',
    detective: 'Climate Detective', qHint: 'Question of the day. Talk about it with your class.',
    live: 'Live', example: 'Example data, not real readings', updated: 'Updated', sensor: 'classroom sensor', model: 'Open-Meteo and Copernicus',
    privacy: 'This screen shows no names or personal information.', fs: 'Full screen', exitFs: 'Exit full screen', loading: 'Loading…', offline: 'No connection',
  },
  sw: {
    app: 'Darasani', classroom: 'Darasa letu', city: 'Katikati ya jiji la Nairobi', inside: 'Ndani ya darasa letu', outside: 'Nje sasa hivi',
    temp: 'Joto', co2: 'Hewa safi', pm: 'Vumbi hewani', rh: 'Unyevu hewani', air: 'Ubora wa hewa', rain: 'Mvua leo', tempOut: 'Joto',
    hTemp: 'Jinsi chumba kilivyo na joto', hCo2: 'Namba ndogo, hewa safi zaidi', hPm: 'Vumbi dogo lisiloonekana kwa macho', hRh: 'Mvuke wa maji hewani',
    comfortable: 'Inafaa', warm: 'Joto kiasi', hot: 'Joto kali', cool: 'Baridi', fresh: 'Safi', open: 'Fungua madirisha', stuffy: 'Hewa nzito', dry: 'Kavu', humid: 'Unyevu mwingi',
    good: 'Nzuri', moderate: 'Wastani', usg: 'Si nzuri kwa baadhi', unhealthy: 'Si nzuri kwa afya', very: 'Mbaya sana kwa afya', hazardous: 'Hatari',
    up: 'Inapanda', down: 'Inashuka', steady: 'Haibadiliki', na: 'Haipatikani', checkSensor: 'Kipima kinahitaji kukaguliwa', checking: 'Kinakaguliwa',
    noSensor: 'Bado hakuna kipima hewa darasani. Hizi ni hali za nje.', upTo: (v) => `Hadi ${v}°`, mm: (mm) => `Milimita ${mm} zinatarajiwa`,
    goodH: 'Darasa letu liko tayari kwa masomo.', goodSub: 'Hewa safi na chumba kinafaa.', goodSubOut: 'Hakuna tahadhari kwa shule yetu leo.',
    cityH: 'Hakuna tahadhari ya hewa wala ya hali ya hewa leo.', citySub: 'Ili kuweka skrini hii kwa darasa, tumia Dunia Alerts → Schools → Classroom screens.',
    airH: 'Hewa ya nje si safi leo.', airSub: 'Chezeni na fanyeni mazoezi ndani, na mfuate maelekezo ya mwalimu.',
    dustH: 'Hewa ya darasa letu ina vumbi.', dustSub: 'Mwambieni mwalimu. Fungeni madirisha yanayoelekea barabarani.',
    rainH: 'Mvua kubwa inatarajiwa leo.', rainSub: 'Kaeni mbali na mitaro na njia zilizojaa maji. Mwalimu atawaambia kuhusu muda wa kwenda nyumbani.',
    co2HighH: 'Ni wakati wa hewa safi.', co2HighSub: 'Fungueni madirisha na mlango kwa dakika chache.',
    co2MidH: 'Tuingize hewa safi.', co2MidSub: 'Fungueni dirisha au mlango.',
    windowsCare: 'Mwulizeni mwalimu kabla ya kufungua madirisha: hewa ya nje si safi.',
    hotH: 'Leo kuna joto kali.', hotSub: 'Kunyweni maji mara kwa mara na pumzikeni kivulini wakati wa mapumziko.',
    warmH: 'Darasani kunaanza kuwa na joto.', warmSub: 'Fungueni madirisha kama hewa ya nje ni safi, na kunyweni maji.',
    staleH: 'Takwimu si za sasa', staleSub: (t) => `Kipimo cha mwisho saa ${t}. Tafadhali mwambieni mwalimu.`, staleNever: 'Bado hakuna kipimo. Tafadhali mwambieni mwalimu.',
    detective: 'Mpelelezi wa Hali ya Hewa', qHint: 'Swali la leo. Jadilini na wanafunzi wenzenu.',
    live: 'Moja kwa moja', example: 'Takwimu za mfano, si vipimo halisi', updated: 'Imesasishwa', sensor: 'kipima cha darasa', model: 'Open-Meteo na Copernicus',
    privacy: 'Skrini hii haionyeshi majina wala taarifa binafsi.', fs: 'Skrini nzima', exitFs: 'Funga skrini nzima', loading: 'Inapakia…', offline: 'Hakuna mtandao',
  },
};
const QUESTIONS = [
  ['Why might this classroom feel cooler than the one next door?', 'Kwa nini darasa hili linaweza kuwa na baridi zaidi kuliko darasa la jirani?'],
  ['When does the fresh-air number (CO₂) go up in our classroom, and why?', 'Namba ya hewa safi (CO₂) hupanda lini darasani kwetu, na kwa nini?'],
  ['What happens to the CO₂ number five minutes after we open the windows?', 'Nini hutokea kwa namba ya CO₂ dakika tano baada ya kufungua madirisha?'],
  ['Is the air dustier in the morning or in the afternoon? Why?', 'Je, hewa ina vumbi zaidi asubuhi au mchana? Kwa nini?'],
  ['Which part of our school is coolest at lunchtime? How could we find out?', 'Ni sehemu gani ya shule yetu yenye baridi zaidi wakati wa chakula cha mchana? Tunawezaje kujua?'],
  ['How do trees help to keep a school cool?', 'Miti husaidiaje kuifanya shule iwe na baridi?'],
  ['Where does the dust in the air near our school come from?', 'Vumbi lililo hewani karibu na shule yetu linatoka wapi?'],
  ['How much rain fell yesterday? How could we measure it ourselves?', 'Mvua kiasi gani ilinyesha jana? Tungeipimaje sisi wenyewe?'],
  ['Why is it important to drink water on hot days?', 'Kwa nini ni muhimu kunywa maji siku za joto?'],
  ['What could we change in our classroom to let in more fresh air?', 'Tungebadilisha nini darasani ili kuingiza hewa safi zaidi?'],
  ['Does the temperature inside follow the temperature outside? Watch both numbers today.', 'Je, joto la ndani hufuata joto la nje? Angalieni namba zote mbili leo.'],
  ['Why do roads near the school flood when it rains hard?', 'Kwa nini barabara karibu na shule hujaa maji mvua kubwa inaponyesha?'],
  ['What is one thing a family could do to make the air at home cleaner?', 'Ni jambo gani moja familia ingeweza kufanya ili hewa ya nyumbani iwe safi zaidi?'],
  ['Why does the CO₂ number go down during break time?', 'Kwa nini namba ya CO₂ hushuka wakati wa mapumziko?'],
  ['Which is hotter at midday: an iron roof or the shade of a tree?', 'Ni kipi chenye joto zaidi saa sita mchana: paa la bati au kivuli cha mti?'],
  ['How can we tell that heavy rain is coming?', 'Tunawezaje kujua kwamba mvua kubwa inakuja?'],
];

/* ---------- Levels ---------- */
const AIR = [['good', 9.0, '#2E9A5F'], ['moderate', 35.4, '#B8901A'], ['usg', 55.4, '#D9701A'], ['unhealthy', 125.4, '#C8423A'], ['very', 225.4, '#7C45B8'], ['hazardous', Infinity, '#7A1D2C']];
const AQI_BP = [[0, 9, 0, 50], [9.1, 35.4, 51, 100], [35.5, 55.4, 101, 150], [55.5, 125.4, 151, 200], [125.5, 225.4, 201, 300], [225.5, 325.4, 301, 500]];
const r1 = (x) => Math.round(x * 10) / 10;
const airBand = (pm) => AIR.find((b) => r1(pm) <= b[1]);
const aqi = (pm) => { const v = r1(pm); if (v > 325.4) return 500; const b = AQI_BP.find((x) => v <= x[1]) || AQI_BP[0]; return Math.round((b[3] - b[2]) / (b[1] - b[0]) * (v - b[0]) + b[2]); };
// level: 0 good, 1 check, 2 act. Shapes (circle, triangle, square) so meaning never rests on colour alone.
function judge(k, v) {
  if (k === 'temp_c') return v >= CL.hotC ? [2, 'hot'] : v >= CL.warmC ? [1, 'warm'] : v < CL.coolC ? [1, 'cool'] : [0, 'comfortable'];
  if (k === 'co2_ppm') return v >= CL.co2High ? [2, 'stuffy'] : v >= CL.co2Open ? [1, 'open'] : [0, 'fresh'];
  if (k === 'rh_pct') return v > CL.humidPct ? [1, 'humid'] : v < CL.dryPct ? [1, 'dry'] : [0, 'comfortable'];
  const b = airBand(v); return [b[0] === 'good' || b[0] === 'moderate' ? 0 : b[0] === 'usg' ? 1 : 2, b[0]];
}
const SHAPE = ['<circle cx="12" cy="12" r="7"/>', '<path d="M12 4.5 20.5 19h-17z"/>', '<rect x="5" y="5" width="14" height="14" rx="2"/>'];
const shape = (lvl) => `<svg class="cr-shape" viewBox="0 0 24 24" aria-hidden="true">${SHAPE[lvl]}</svg>`;
const ARROW = { up: '↑', down: '↓', steady: '→' };

/* ---------- Data ---------- */
let inside = null;      // { configured, status, latest, trend, sensors, at }
let outside = null;     // { tempNow, rhNow, tmax, rainMm, rainChance, pm25, at }
let lastOk = { in: null, out: null };
let skew = 0;                                               // server clock minus this screen's clock
const FRESH_MS = 15 * MIN, OUT_MS = 3 * 3600e3;
const isFresh = (x) => x && Date.now() + skew - Date.parse(x.observed_at) <= FRESH_MS;
const cached = store.get(CACHE);
if (cached && !DEMO) { inside = cached.inside || null; outside = cached.outside || null; lastOk = cached.lastOk || lastOk; }

async function getJSON(url, ms = 12000) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), ms);
  try { const r = await fetch(url, { signal: ctl.signal, headers: { Accept: 'application/json' } }); if (!r.ok && r.status !== 404) throw new Error(String(r.status)); return { status: r.status, body: await r.json() }; }
  finally { clearTimeout(t); }
}
async function loadInside() {
  if (!ROOM) { inside = null; return; }
  try {
    const { status, body } = await getJSON(`api/v1/classroom?room=${encodeURIComponent(ROOM)}&history=1`);
    if (status === 404 || !body.configured) inside = { configured: false };
    else {
      const st = Date.parse(body.server_time); if (Number.isFinite(st)) skew = st - Date.now();
      inside = { configured: true, status: body.status, latest: body.latest || {}, trend: body.trend || {}, sensors: body.sensors || [], at: Date.now() }; lastOk.in = Date.now();
    }
  } catch (e) { if (inside) inside.failed = true; else inside = { configured: true, status: 'no_data', latest: {}, trend: {}, failed: true }; }
}
async function loadOutside() {
  const q = `latitude=${PLACE.lat.toFixed(4)}&longitude=${PLACE.lng.toFixed(4)}&timezone=Africa%2FNairobi`;
  const [wx, aq] = await Promise.allSettled([
    getJSON(`https://api.open-meteo.com/v1/forecast?${q}&current=temperature_2m,relative_humidity_2m&daily=temperature_2m_max,precipitation_sum,precipitation_probability_max&forecast_days=1`),
    getJSON(`https://air-quality-api.open-meteo.com/v1/air-quality?${q}&current=pm2_5`),
  ]);
  if (wx.status !== 'fulfilled' && aq.status !== 'fulfilled') { if (outside) outside.failed = true; return; }
  const w = wx.status === 'fulfilled' ? wx.value.body : {}, a = aq.status === 'fulfilled' ? aq.value.body : {};
  const c = w.current || {}, d = w.daily || {}, first = (k) => (Array.isArray(d[k]) ? d[k][0] : null);
  const prev = outside || {};
  outside = {
    tempNow: c.temperature_2m ?? prev.tempNow ?? null, rhNow: c.relative_humidity_2m ?? prev.rhNow ?? null,
    tmax: first('temperature_2m_max') ?? prev.tmax ?? null, rainMm: first('precipitation_sum') ?? prev.rainMm ?? null, rainChance: first('precipitation_probability_max') ?? prev.rainChance ?? null,
    pm25: a.current && a.current.pm2_5 != null ? r1(a.current.pm2_5) : prev.pm25 ?? null, at: Date.now(),
  };
  lastOk.out = Date.now();
}
function demoData() {
  const now = Date.now(), iso = new Date(now - 2 * MIN).toISOString();
  const m = (v, unit) => ({ value: v, unit, observed_at: iso, quality: 'ok' });
  const v = { co2: DEMO === 'co2' ? 1620 : 710, temp: DEMO === 'heat' ? 30.8 : 25.6, pm: 12, rh: 54 };
  inside = { configured: true, status: DEMO === 'stale' ? 'stale' : 'live', at: now, example: true,
    latest: { temp_c: m(v.temp, '°C'), co2_ppm: m(v.co2, 'ppm'), pm25_ugm3: m(v.pm, 'µg/m³'), rh_pct: m(v.rh, '%') },
    trend: DEMO === 'co2' ? { co2_ppm: 'up', temp_c: 'steady', pm25_ugm3: 'steady', rh_pct: 'steady' } : { temp_c: 'up', co2_ppm: 'steady', pm25_ugm3: 'down', rh_pct: 'steady' } };
  if (DEMO === 'stale') { Object.values(inside.latest).forEach((x) => { x.observed_at = new Date(now - 97 * MIN).toISOString(); }); }
  outside = { tempNow: DEMO === 'heat' ? 31 : 24, rhNow: 58, tmax: DEMO === 'heat' ? 32 : 27, rainMm: DEMO === 'rain' ? 38 : 2.1, rainChance: DEMO === 'rain' ? 90 : 40, pm25: DEMO === 'air' ? 61.2 : 14.6, at: now, example: true };
  lastOk = { in: now, out: now };
}

/* ---------- Render ---------- */
const L = () => T[lang];
const fmtTime = (t) => new Date(t).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Nairobi' });
function freshIn() { return inside && inside.configured && inside.latest && Object.values(inside.latest).some(isFresh); }
const outFresh = () => Boolean(outside && lastOk.out && Date.now() - lastOk.out <= OUT_MS);
function headline() {
  const t = L(), lat = inside && inside.latest || {}, out = outFresh() ? outside : {};
  const val = (k) => (isFresh(lat[k]) && lat[k].quality === 'ok' ? lat[k].value : null);
  const hasSensor = inside && inside.configured;
  if (hasSensor && !freshIn()) {
    const times = Object.values(lat).map((x) => Date.parse(x.observed_at)).filter(Number.isFinite);
    return ['stale', t.staleH, times.length ? t.staleSub(fmtTime(Math.max(...times))) : t.staleNever];
  }
  const outBad = out.pm25 != null && out.pm25 >= TH.pm25;
  const co2 = val('co2_ppm'), pmIn = val('pm25_ugm3'), tIn = val('temp_c');
  if (outBad) return ['care', t.airH, co2 != null && co2 >= CL.co2Open ? `${t.airSub} ${t.windowsCare}` : t.airSub];
  if (pmIn != null && pmIn >= TH.pm25) return ['care', t.dustH, t.dustSub];
  if (out.rainMm != null && out.rainMm >= TH.rainMm) return ['care', t.rainH, t.rainSub];
  if (co2 != null && co2 >= CL.co2High) return ['act', t.co2HighH, t.co2HighSub];
  if ((tIn != null && tIn >= CL.hotC) || (out.tmax != null && out.tmax >= TH.heatC)) return ['act', t.hotH, t.hotSub];
  if (co2 != null && co2 >= CL.co2Open) return ['act', t.co2MidH, t.co2MidSub];
  if (tIn != null && tIn >= CL.warmC) return ['act', t.warmH, t.warmSub];
  if (!PLACE.custom && !hasSensor && !NAME) return ['good', t.cityH, t.citySub];
  return ['good', t.goodH, hasSensor ? t.goodSub : t.goodSubOut];
}
const HEAD_ICON = {
  good: '<path d="M5 12.5 10 17.5 19 7"/>',
  act: '<path d="M4 9h11a3 3 0 1 0-3-3M3 13h15a3 3 0 1 1-3 3M5 17h5"/>',
  care: '<path d="M12 4 21 19H3z"/><path d="M12 10v4M12 16.5v.5"/>',
  stale: '<circle cx="12" cy="12" r="8"/><path d="M12 8v4.5l3 2"/>',
};
function tileIn(k, label, hint, unit, dp) {
  const t = L(), x = inside && inside.latest ? inside.latest[k] : null;
  if (!x) return `<article class="cr-tile is-na"><span class="cr-tile__label">${esc(label)}</span><span class="cr-tile__value">–</span><span class="cr-tile__state">${esc(t.na)}</span><span class="cr-tile__hint">${esc(t.checkSensor)}</span></article>`;
  const v = dp ? r1(x.value).toFixed(1) : Math.round(x.value);
  const old = !isFresh(x), odd = x.quality !== 'ok';
  const [lvl, word] = judge(k, x.value);
  const tr = !old && inside.trend && inside.trend[k];
  const state = old ? `<span class="cr-tile__state is-old">${esc(t.staleH)}</span>` : odd ? `<span class="cr-tile__state">${esc(t.checking)}</span>`
    : `<span class="cr-tile__state lv${lvl}">${shape(lvl)}${esc(t[word])}${tr ? `<span class="cr-trend" title="${esc(t[tr])}"><span aria-hidden="true">${ARROW[tr]}</span><span class="sr">${esc(t[tr])}</span></span>` : ''}</span>`;
  return `<article class="cr-tile${old || odd ? ' is-dim' : ''} lv${old || odd ? 'x' : lvl}"><span class="cr-tile__label">${esc(label)}</span><span class="cr-tile__value num">${v}<small>${esc(unit)}</small></span>${state}<span class="cr-tile__hint">${esc(hint)}</span></article>`;
}
function render() {
  const t = L();
  document.documentElement.lang = lang;
  document.querySelectorAll('.cr-lang [data-lang]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === lang)));
  $('#appName').textContent = t.app;
  $('#roomName').textContent = NAME || (PLACE.custom ? t.classroom : t.city);
  $('#schoolName').textContent = SCHOOL;
  $('#inTitle').textContent = t.inside; $('#outTitle').textContent = t.outside; $('#qTitle').textContent = t.detective;

  const [kind, h, sub] = (inside || outside) ? headline() : ['load', t.loading, ''];
  $('#head').className = 'cr-head is-' + kind;
  $('#headIcon').innerHTML = HEAD_ICON[kind] ? `<svg viewBox="0 0 24 24">${HEAD_ICON[kind]}</svg>` : '';
  $('#headline').textContent = h; $('#headSub').textContent = sub;

  const hasSensor = inside && inside.configured;
  $('#inside').closest('.cr-sec').hidden = false;
  $('#inside').innerHTML = hasSensor
    ? tileIn('temp_c', t.temp, t.hTemp, '°C', 1) + tileIn('co2_ppm', t.co2 + ' · CO₂', t.hCo2, 'ppm', 0) + tileIn('pm25_ugm3', t.pm + ' · PM2.5', t.hPm, 'µg/m³', 0) + tileIn('rh_pct', t.rh, t.hRh, '%', 0)
    : `<p class="cr-nosensor">${esc(t.noSensor)}</p>`;
  $('#cr').classList.toggle('no-sensor', !hasSensor);

  const o = outFresh() ? outside : {};
  const band = o.pm25 != null ? airBand(o.pm25) : null;
  const lvA = o.pm25 != null ? judge('pm25_ugm3', o.pm25)[0] : 0;
  $('#outside').innerHTML = `
    <div class="cr-o"><span class="cr-o__label">${esc(t.tempOut)}</span><span class="cr-o__value num">${o.tempNow != null ? Math.round(o.tempNow) + '°' : '–'}</span><span class="cr-o__sub">${o.tmax != null ? esc(t.upTo(Math.round(o.tmax))) : ''}</span></div>
    <div class="cr-o"><span class="cr-o__label">${esc(t.air)}</span><span class="cr-o__value num">${o.pm25 != null ? aqi(o.pm25) : '–'}<small>AQI</small></span><span class="cr-o__sub lv${lvA}">${band ? shape(lvA) + esc(t[band[0]]) : ''}</span></div>
    <div class="cr-o"><span class="cr-o__label">${esc(t.rain)}</span><span class="cr-o__value num">${o.rainChance != null ? o.rainChance + '%' : '–'}</span><span class="cr-o__sub">${o.rainMm != null ? esc(t.mm(r1(o.rainMm))) : ''}</span></div>`;

  const day = Math.floor((Date.now() + 3 * 3600e3) / 864e5);
  $('#question').textContent = QUESTIONS[day % QUESTIONS.length][lang === 'sw' ? 1 : 0];
  $('#qHint').textContent = t.qHint;

  const times = [inside && inside.configured && lastOk.in, lastOk.out].filter(Boolean);
  const upd = times.length ? fmtTime(Math.max(...times)) : null;
  const src = [hasSensor ? t.sensor : null, t.model].filter(Boolean).join(' · ');
  const offline = navigator.onLine === false;
  $('#status').innerHTML = DEMO ? `<span class="cr-pill is-example">${esc(t.example)}</span>`
    : `<span class="cr-pill${offline || kind === 'stale' ? ' is-off' : ''}"><span class="cr-dot"></span>${esc(offline ? t.offline : kind === 'stale' ? t.staleH : t.live)}</span>${upd ? ` ${esc(t.updated)} ${upd}` : ''} · ${esc(src)}`;
  $('#privacy').textContent = t.privacy;
  $('#fsLabel').textContent = document.fullscreenElement ? t.exitFs : t.fs;
}
function tick() {
  const now = new Date();
  $('#time').textContent = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Nairobi' });
  let date; try { date = now.toLocaleDateString(lang === 'sw' ? 'sw-KE' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Africa/Nairobi' }); } catch (e) { date = now.toDateString(); }
  $('#date').textContent = date;
}

/* ---------- Loop ---------- */
async function refresh(which) {
  if (DEMO) { demoData(); render(); return; }
  await Promise.all([which !== 'out' ? loadInside() : null, which !== 'in' ? loadOutside() : null]);
  store.set(CACHE, { inside, outside, lastOk });
  render();
}
let wake = null;
async function keepAwake() { try { if ('wakeLock' in navigator && document.visibilityState === 'visible' && !wake) { wake = await navigator.wakeLock.request('screen'); wake.addEventListener('release', () => { wake = null; }); } } catch (e) { /* not supported */ } }
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { keepAwake(); refresh(); } });
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-lang]'); if (b) { lang = b.dataset.lang; store.set('dunia-classroom:lang', lang); tick(); render(); return; }
  if (e.target.closest('#fs')) { if (document.fullscreenElement) document.exitFullscreen(); else if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => {}); }
  keepAwake();
});
document.addEventListener('fullscreenchange', render);
window.addEventListener('online', () => refresh());
window.addEventListener('offline', render);
let idle = 0; const wakeCursor = () => { document.body.classList.remove('idle'); clearTimeout(idle); idle = setTimeout(() => document.body.classList.add('idle'), 4000); };
['mousemove', 'touchstart', 'keydown'].forEach((ev) => document.addEventListener(ev, wakeCursor, { passive: true })); wakeCursor();

tick(); render(); refresh(); keepAwake();
setInterval(tick, 15000);
setInterval(() => { if (document.visibilityState === 'visible') refresh('in'); }, 60000);
setInterval(() => { if (document.visibilityState === 'visible') refresh('out'); }, 15 * MIN);
setInterval(render, 60000);                                   // ages and "data not current" move on even without new data
setTimeout(() => { if (navigator.onLine !== false && !DEMO) location.reload(); }, 6 * 3600e3);   // pick up updates on screens left on all day
})();
