// Pilot sign in: posts to /api/auth/login and goes on to the page that was asked for.
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var form = $('form'), email = $('email'), pw = $('password'), btn = $('submit'), msg = $('msg'), reveal = $('reveal');
  var params = new URLSearchParams(location.search);

  // Only ever go on to a page on this site (never "//elsewhere" or "/\elsewhere").
  function safeNext(v) {
    if (!v || v.length > 200 || v.charAt(0) !== '/' || /^\/[\/\\]/.test(v) || /[\u0000-\u001f]/.test(v)) return '/pilot';
    if (/^\/(login|api\/)/.test(v)) return '/pilot';
    return v;
  }
  var next = safeNext(params.get('next'));

  function show(kind, text) {
    msg.className = 'msg msg--' + kind;
    msg.textContent = text;
    msg.hidden = false;
  }
  function hide() { msg.hidden = true; msg.textContent = ''; }
  function invalid(on) {
    [email, pw].forEach(function (el) { if (on) el.setAttribute('aria-invalid', 'true'); else el.removeAttribute('aria-invalid'); });
  }
  function busy(on) {
    btn.disabled = on;
    btn.textContent = on ? 'Signing in…' : 'Sign in';
  }

  if (params.get('signed_out') === '1') show('ok', 'You’re signed out. See you next time.');
  else if (params.get('next')) show('info', 'Sign in to open the live pilot.');

  // Already signed in? Go straight on. Not switched on yet? Say so before anyone types.
  fetch('/api/auth/me', { credentials: 'same-origin', cache: 'no-store' })
    .then(function (r) { return r.json().catch(function () { return {}; }); })
    .then(function (d) {
      if (d && d.signedIn) { location.replace(next); return; }
      if (d && d.configured === false) show('info', 'Pilot sign-in isn’t switched on yet. You can try the demo in the meantime.');
    })
    .catch(function () { /* offline: the form still explains itself on submit */ });

  reveal.addEventListener('click', function () {
    var on = pw.type === 'password';
    pw.type = on ? 'text' : 'password';
    reveal.textContent = on ? 'Hide' : 'Show';
    reveal.setAttribute('aria-pressed', on ? 'true' : 'false');
    reveal.setAttribute('aria-label', on ? 'Hide password' : 'Show password');
    pw.focus();
  });
  reveal.setAttribute('aria-label', 'Show password');

  [email, pw].forEach(function (el) { el.addEventListener('input', function () { invalid(false); }); });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var em = email.value.trim(), p = pw.value;
    if (!em || !p) {
      invalid(true);
      show('bad', 'Enter your email and password.');
      (em ? pw : email).focus();
      return;
    }
    hide();
    busy(true);
    fetch('/api/auth/login', {
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: em, password: p })
    }).then(function (r) {
      if (r.ok) { pw.value = ''; location.replace(next); return; }
      busy(false);
      if (r.status === 401) {
        invalid(true);
        show('bad', 'That email and password don’t match. Check them and try again.');
        pw.select();
        pw.focus();
      } else if (r.status === 429) {
        show('bad', 'Too many tries. For your safety, wait 15 minutes and try again.');
      } else if (r.status === 503) {
        show('info', 'Pilot sign-in isn’t switched on yet. You can try the demo in the meantime.');
      } else if (r.status === 400) {
        invalid(true);
        show('bad', 'Enter a valid email and password.');
      } else {
        show('bad', 'Something went wrong on our side. Please try again in a minute.');
      }
    }).catch(function () {
      busy(false);
      show('bad', 'Couldn’t reach the server. Check your connection and try again.');
    });
  });
})();
