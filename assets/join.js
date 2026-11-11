// Join the pilot: checks the form in the browser, sends it to /api/join, then says thank you.
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var form = $('join'), msg = $('msg'), btn = $('submit'), done = $('done');
  if (!form) return;
  var started = Date.now();
  var label = btn.innerHTML;
  var EMAIL = /^[^\s@:,]{1,64}@[^\s@:,]{1,190}\.[a-z]{2,24}$/i;
  var PHONE = /^\+?[0-9][0-9 ()-]{6,19}$/;
  var NAMES = { role: 'who you are', name: 'your name', email: 'a working email', phone: 'a phone number with digits only', org: 'the name of your school or organisation', consent: 'your OK for us to contact you' };

  // Arriving from "Partner with us" or a link like /join?role=funder: choose that role for them.
  var want = new URLSearchParams(location.search).get('role');
  if (want && $('role').querySelector('option[value="' + want.replace(/[^a-z]/g, '') + '"]')) $('role').value = want;

  function show(kind, html) { msg.className = 'msg msg--' + kind; msg.innerHTML = html; msg.hidden = false; }
  function hide() { msg.hidden = true; msg.textContent = ''; }
  function mark(name, on) {
    var el = name === 'consent' ? $('consent').closest('.consent') : $(name);
    if (!el) return;
    if (name === 'consent') { if (on) el.setAttribute('data-invalid', ''); else el.removeAttribute('data-invalid'); return; }
    if (on) el.setAttribute('aria-invalid', 'true'); else el.removeAttribute('aria-invalid');
  }
  function list(names) {
    var words = names.map(function (n) { return NAMES[n] || n; });
    return words.length > 1 ? words.slice(0, -1).join(', ') + ' and ' + words[words.length - 1] : words[0];
  }
  function busy(on) { btn.disabled = on; btn.innerHTML = on ? 'Sending…' : label; }

  function values() {
    var concerns = [].slice.call(form.querySelectorAll('input[name="concerns"]:checked')).map(function (c) { return c.value; });
    return {
      role: $('role').value, name: $('name').value.trim(), email: $('email').value.trim(), phone: $('phone').value.trim(),
      org: $('org').value.trim(), area: $('area').value.trim(), learners: $('learners').value, concerns: concerns,
      message: $('message').value.trim(), consent: $('consent').checked, website: $('website').value, t: Date.now() - started
    };
  }
  function problems(v) {
    var bad = [];
    if (!v.role) bad.push('role');
    if (v.name.length < 2) bad.push('name');
    if (!EMAIL.test(v.email)) bad.push('email');
    if (v.phone && !PHONE.test(v.phone)) bad.push('phone');
    if (v.org.length < 2) bad.push('org');
    if (!v.consent) bad.push('consent');
    return bad;
  }

  ['role', 'name', 'email', 'phone', 'org'].forEach(function (n) {
    $(n).addEventListener('input', function () { mark(n, false); });
    $(n).addEventListener('change', function () { mark(n, false); });
  });
  $('consent').addEventListener('change', function () { mark('consent', false); });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var v = values();
    var bad = problems(v);
    ['role', 'name', 'email', 'phone', 'org', 'consent'].forEach(function (n) { mark(n, bad.indexOf(n) >= 0); });
    if (bad.length) {
      show('bad', 'Please add ' + list(bad) + '.');
      (bad[0] === 'consent' ? $('consent') : $(bad[0])).focus();
      return;
    }
    hide();
    busy(true);
    fetch('/api/join', {
      method: 'POST', credentials: 'same-origin', cache: 'no-store',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(v)
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) { return { status: r.status, d: d }; });
    }).then(function (x) {
      busy(false);
      if (x.status === 201) {
        var first = v.name.split(' ')[0];
        $('done-h').textContent = 'Thank you, ' + first + '. Your reply is in.';
        $('done-p').textContent = 'The Dunia team reads every reply and will get in touch by email' + (v.phone ? ' or phone' : '') + ' about the next step.';
        form.hidden = true;
        var head = document.querySelector('.jform__head'); if (head) head.hidden = true;
        done.hidden = false;
        $('done-h').focus();
        $('form').scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
      if (x.status === 400 && x.d && x.d.fields) {
        x.d.fields.forEach(function (n) { mark(n, true); });
        show('bad', 'Please check ' + list(x.d.fields) + '.');
      } else if (x.status === 429) {
        show('bad', 'We’ve had several replies from this connection. Please try again in an hour, or write to <a href="mailto:hello@duniaendelevu.org">hello@duniaendelevu.org</a>.');
      } else if (x.status === 503) {
        show('info', 'Sign-ups aren’t switched on just yet. Please write to <a href="mailto:hello@duniaendelevu.org">hello@duniaendelevu.org</a> with your school’s name, area and a contact, and we’ll reply.');
      } else {
        show('bad', 'Something went wrong on our side. Please try again, or write to <a href="mailto:hello@duniaendelevu.org">hello@duniaendelevu.org</a>.');
      }
    }).catch(function () {
      busy(false);
      show('bad', 'You seem to be offline. Check your connection and try again. Nothing you typed has been lost.');
    });
  });
})();
