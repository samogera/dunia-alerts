// Join the pilot: an application form. Checks each answer in the browser (the server checks again),
// shows a list of problems at the top and next to each question, keeps the progress steps up to date,
// sends the application to /api/join, then shows a confirmation with a reference number.
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var form = $('join');
  if (!form) return;
  var btn = $('submit'), msg = $('msg'), errors = $('errors'), errorList = $('error-list'), done = $('done');
  var started = Date.now();
  var label = btn.innerHTML;
  var EMAIL = /^[^\s@:,]{1,64}@[^\s@:,]{1,190}\.[a-z]{2,24}$/i;
  var PHONE = /^\+?[0-9][0-9 ()-]{6,19}$/;

  // Words for each problem, and where to send the person to fix it.
  var PROBLEM = {
    type: ['Choose who you are applying as', 'type-err', function () { return form.querySelector('input[name="type"]'); }],
    name: ['Enter your full name', 'name-err', function () { return $('name'); }],
    email: ['Enter an email address, like name@example.org', 'email-err', function () { return $('email'); }],
    phone: ['Enter a phone number using digits, like +254 712 345 678', 'phone-err', function () { return $('phone'); }],
    phoneNeeded: ['Enter a phone number so we can call or WhatsApp you', 'phone-err', function () { return $('phone'); }],
    org: ['Enter the name of your school or organisation', 'org-err', function () { return $('org'); }],
    consent: ['Tick the box to agree that we may contact you', 'consent-err', function () { return $('consent'); }]
  };
  var BOX = { type: 's1', name: 'name', email: 'email', phone: 'phone', phoneNeeded: 'phone', org: 'org', consent: 'consent' };

  var params = new URLSearchParams(location.search);
  // Where the link was shared (?src=qr on the printed QR code), kept with the application so the team knows what works.
  var src = String(params.get('src') || params.get('utm_source') || '').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 24);
  // /join?type=funder (or the older ?role=…) opens the form with that choice made.
  var ROLE_TYPE = { head: 'school', teacher: 'school', school: 'school', parent: 'parent', gov: 'gov', partner: 'partner', funder: 'funder', other: 'other' };
  var want = params.get('type') || ROLE_TYPE[params.get('role')];
  if (want) { var r = form.querySelector('input[name="type"][value="' + String(want).replace(/[^a-z]/g, '') + '"]'); if (r) r.checked = true; }

  function radio(name) { var c = form.querySelector('input[name="' + name + '"]:checked'); return c ? c.value : ''; }
  function values() {
    return {
      type: radio('type'), name: $('name').value.trim(), title: $('title').value.trim(), email: $('email').value.trim(),
      phone: $('phone').value.trim(), contact: radio('contact') || 'email', org: $('org').value.trim(),
      schoolType: radio('schoolType'), subcounty: $('subcounty').value, area: $('area').value.trim(), learners: $('learners').value,
      concerns: [].slice.call(form.querySelectorAll('input[name="concerns"]:checked')).map(function (c) { return c.value; }),
      message: $('message').value.trim(), consent: $('consent').checked, website: $('website').value, src: src, t: Date.now() - started
    };
  }
  function problems(v) {
    var bad = [];
    if (!v.type) bad.push('type');
    if (v.name.length < 2) bad.push('name');
    if (!EMAIL.test(v.email)) bad.push('email');
    if (v.phone && !PHONE.test(v.phone)) bad.push('phone');
    else if (!v.phone && v.contact !== 'email') bad.push('phoneNeeded');
    if (v.org.length < 2) bad.push('org');
    if (!v.consent) bad.push('consent');
    return bad;
  }

  // ---- showing and clearing problems ----
  function box(key) {
    var id = BOX[key];
    if (id === 's1') return $('s1');
    if (id === 'consent') return form.querySelector('.ap-declare');
    return form.querySelector('[data-f="' + id + '"]');
  }
  function setProblem(key, on) {
    var p = PROBLEM[key], b = box(key), e = $(p[1]);
    if (b) b.classList.toggle('is-invalid', on);
    if (e) { e.hidden = !on; e.textContent = on ? p[0] : ''; }
    var input = p[2]();
    if (input && input.type !== 'radio') { if (on) input.setAttribute('aria-invalid', 'true'); else input.removeAttribute('aria-invalid'); }
  }
  function clearAll() { Object.keys(PROBLEM).forEach(function (k) { setProblem(k, false); }); }
  function showProblems(bad) {
    clearAll();
    errorList.textContent = '';
    bad.forEach(function (k) {
      setProblem(k, true);
      var a = document.createElement('a');
      a.href = '#' + (k === 'type' ? 's1' : BOX[k]);
      a.textContent = PROBLEM[k][0];
      a.addEventListener('click', function (e) { e.preventDefault(); var el = PROBLEM[k][2](); el.focus(); el.scrollIntoView({ block: 'center', behavior: 'smooth' }); });
      var li = document.createElement('li'); li.appendChild(a); errorList.appendChild(li);
    });
    errors.hidden = !bad.length;
    if (bad.length) { errors.focus(); errors.scrollIntoView({ block: 'start', behavior: 'smooth' }); }
  }
  function show(kind, html) { msg.className = 'msg msg--' + kind; msg.innerHTML = html; msg.hidden = false; msg.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
  function busy(on) { btn.disabled = on; btn.innerHTML = on ? '<span>Sending your application…</span>' : label; }

  // Fix-as-you-go: once a problem is shown, it disappears as soon as the answer is good.
  function recheck() {
    if (errors.hidden) return;
    var bad = problems(values());
    var still = bad.map(function (k) { return BOX[k]; });
    Object.keys(PROBLEM).forEach(function (k) { if (still.indexOf(BOX[k]) < 0 && box(k) && box(k).classList.contains('is-invalid')) setProblem(k, false); });
    [].slice.call(errorList.querySelectorAll('a')).forEach(function (a) {
      var k = Object.keys(PROBLEM).filter(function (x) { return PROBLEM[x][0] === a.textContent; })[0];
      if (k && bad.indexOf(k) < 0) a.parentNode.remove();
    });
    if (!errorList.children.length) errors.hidden = true;
  }

  // ---- the form changes with who is applying ----
  var LABELS = {
    school: ['Your school', 'Where the alerts would go.', 'School name'],
    parent: ['The school you’re suggesting', 'We’ll contact the school with your suggestion.', 'Name of the school'],
    partner: ['Your organisation', 'So we know who you are.', 'Organisation name'],
    gov: ['Your office', 'So we know who you are.', 'County, department or office'],
    funder: ['Your organisation', 'So we know who you are.', 'Organisation or foundation name'],
    other: ['School or organisation', 'So we know who you are.', 'School or organisation name']
  };
  function adapt() {
    var t = radio('type');
    var l = LABELS[t || 'other'];
    $('s3-title').textContent = l[0]; $('s3-sub').textContent = l[1]; $('org-l').textContent = l[2];
    var schoolish = t === 'school' || t === 'parent' || !radio('type');
    [].slice.call(form.querySelectorAll('[data-school]')).forEach(function (el) { el.hidden = !schoolish; });
    $('title').placeholder = t === 'school' ? 'For example, Head teacher' : t === 'parent' ? 'For example, Parent' : 'For example, Programme officer';
  }
  function phoneRule() { $('phone-opt').hidden = radio('contact') !== 'email'; }

  // ---- progress steps ----
  var steps = [].slice.call(document.querySelectorAll('#steps li'));
  function progress() {
    var v = values(), bad = problems(v);
    var ok = {
      s1: !!v.type,
      s2: bad.indexOf('name') < 0 && bad.indexOf('email') < 0 && bad.indexOf('phone') < 0 && bad.indexOf('phoneNeeded') < 0,
      s3: bad.indexOf('org') < 0,
      s4: v.consent
    };
    var n = 0, active = null;
    steps.forEach(function (li) {
      var k = li.getAttribute('data-step');
      li.classList.toggle('is-done', ok[k]);
      if (ok[k]) n++;
      else if (!active) active = li;
    });
    steps.forEach(function (li) { li.classList.toggle('is-active', li === active); });
    $('bar').style.width = (n / steps.length * 100) + '%';
  }

  form.addEventListener('input', function (e) {
    if (e.target.id === 'message') $('count').textContent = e.target.value.length.toLocaleString('en');
    progress(); recheck();
  });
  form.addEventListener('change', function (e) {
    if (e.target.name === 'type') adapt();
    if (e.target.name === 'contact') phoneRule();
    progress(); recheck();
  });
  adapt(); phoneRule(); progress();

  // ---- send ----
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    msg.hidden = true;
    var v = values();
    var bad = problems(v);
    showProblems(bad);
    if (bad.length) return;
    busy(true);
    fetch('/api/join', {
      method: 'POST', credentials: 'same-origin', cache: 'no-store',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(v)
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) { return { status: r.status, d: d }; });
    }).then(function (x) {
      busy(false);
      if (x.status === 201) return finish(v, x.d && x.d.ref);
      if (x.status === 400 && x.d && x.d.fields) {
        showProblems(x.d.fields.filter(function (f) { return PROBLEM[f]; }));
      } else if (x.status === 429) {
        show('bad', 'We’ve had several applications from this connection in the last hour. Please try again later, or write to <a href="mailto:hello@duniaendelevu.org">hello@duniaendelevu.org</a>.');
      } else if (x.status === 503) {
        show('info', '<b>Online applications aren’t switched on just yet.</b> Please write to <a href="mailto:hello@duniaendelevu.org">hello@duniaendelevu.org</a> with your name, your school or organisation and how to reach you, and we’ll reply.');
      } else {
        show('bad', 'Something went wrong on our side, and your application wasn’t sent. Please try again, or write to <a href="mailto:hello@duniaendelevu.org">hello@duniaendelevu.org</a>.');
      }
    }).catch(function () {
      busy(false);
      show('bad', 'You seem to be offline, so your application wasn’t sent. Check your connection and try again. Nothing you typed has been lost.');
    });
  });

  function finish(v, ref) {
    var first = v.name.split(' ')[0];
    $('done-p').textContent = 'Thank you, ' + first + '. The Dunia team reads every application and will get in touch by ' +
      (v.contact === 'whatsapp' ? 'WhatsApp' : v.contact === 'call' ? 'phone' : 'email') + ' about the next step.';
    $('ref').textContent = ref || '—';
    form.hidden = true;
    done.hidden = false;
    steps.forEach(function (li) { li.classList.add('is-done'); li.classList.remove('is-active'); });
    $('bar').style.width = '100%';
    $('form').scrollIntoView({ block: 'start', behavior: 'smooth' });
    $('done-h').focus({ preventScroll: true });
  }

  $('copy').addEventListener('click', function () {
    var b = this, text = $('ref').textContent;
    var ok = function () { b.querySelector('span').textContent = 'Copied'; setTimeout(function () { b.querySelector('span').textContent = 'Copy'; }, 2000); };
    if (navigator.clipboard) navigator.clipboard.writeText(text).then(ok, function () {});
  });
})();
