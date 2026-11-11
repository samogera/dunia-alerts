// Pilot sign-ups (team only): lists "Join the pilot" replies from /api/join, lets the team set a status,
// keep a short note, delete a reply on request, and download everything as CSV.
// Everything typed by the public is shown with textContent, never as HTML.
(function () {
  'use strict';
  var $ = function (s) { return document.querySelector(s); };
  var list = $('#list'), filterBox = $('.su-filter'), q = $('#q'), csvBtn = $('[data-act="csv"]'), toastEl = $('#toast');
  var items = [], labels = { roles: {}, learners: {}, concerns: {}, status: {} }, show = 'all', toastT;
  var ORDER = ['new', 'contacted', 'joined', 'not_now'];

  function h(tag, attrs, kids) {
    var el = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v === null || v === undefined || v === false) return;
      if (k === 'text') el.textContent = v;
      else if (k === 'class') el.className = v;
      else el.setAttribute(k, v === true ? '' : v);
    });
    (kids || []).forEach(function (c) { if (c) el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return el;
  }
  function toast(text) {
    toastEl.textContent = text;
    toastEl.classList.add('is-on');
    clearTimeout(toastT);
    toastT = setTimeout(function () { toastEl.classList.remove('is-on'); }, 2600);
  }
  function when(iso) {
    var d = new Date(iso);
    if (isNaN(d)) return '';
    var mins = Math.round((Date.now() - d) / 60000);
    var ago = mins < 1 ? 'just now' : mins < 60 ? mins + ' min ago' : mins < 1440 ? Math.round(mins / 60) + ' h ago' : Math.round(mins / 1440) + ' days ago';
    return ago;
  }
  function stamp(iso) {
    var d = new Date(iso);
    return isNaN(d) ? '' : d.toLocaleString('en-KE', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
  function waLink(phone) {
    var d = String(phone || '').replace(/\D/g, '');
    if (/^0[17]\d{8}$/.test(d)) d = '254' + d.slice(1);
    return d.length >= 9 ? 'https://wa.me/' + d : null;
  }
  function empty(text, extra) {
    list.textContent = '';
    list.appendChild(h('section', { class: 'card' }, [h('div', { class: 'empty' }, [h('p', { class: 'h', text: text })].concat(extra || []))]));
  }

  function api(method, body) {
    return fetch('/api/join', {
      method: method, credentials: 'same-origin', cache: 'no-store',
      headers: body ? { 'Content-Type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined
    }).then(function (r) {
      if (r.status === 401) { location.replace('/login?next=%2Fpilot%2Fsignups'); throw new Error('signed out'); }
      return r.json().catch(function () { return {}; }).then(function (d) { return { status: r.status, d: d }; });
    });
  }

  function load() {
    api('GET').then(function (x) {
      if (x.status === 503) {
        csvBtn.disabled = true;
        return empty('Sign-ups need storage', [h('p', { text: 'Connect Upstash for Redis to this project in Vercel (Storage), then redeploy. Until then, the form asks people to email hello@duniaendelevu.org.' })]);
      }
      if (x.status !== 200) return empty('Couldn’t load sign-ups', [h('p', { text: 'Try again in a moment.' })]);
      items = x.d.items || [];
      labels = x.d.labels || labels;
      render();
    }).catch(function (e) { if (e.message !== 'signed out') empty('You seem to be offline', [h('p', { text: 'Check your connection, then refresh.' })]); });
  }

  function counts() {
    var c = { all: items.length };
    ORDER.forEach(function (s) { c[s] = 0; });
    items.forEach(function (it) { c[it.status] = (c[it.status] || 0) + 1; });
    return c;
  }

  function matches(it) {
    if (show !== 'all' && it.status !== show) return false;
    var term = q.value.trim().toLowerCase();
    if (!term) return true;
    return [it.name, it.org, it.area, it.email, it.phone, it.message, it.note, labels.roles[it.role]].join(' ').toLowerCase().indexOf(term) >= 0;
  }

  function renderFilter() {
    var c = counts();
    filterBox.textContent = '';
    [['all', 'All']].concat(ORDER.map(function (s) { return [s, labels.status[s] || s]; })).forEach(function (o) {
      filterBox.appendChild(h('button', { type: 'button', 'data-show': o[0], 'aria-pressed': show === o[0] ? 'true' : 'false' },
        [o[1] + ' ', h('span', { class: 'su-n', text: String(c[o[0]] || 0) })]));
    });
  }

  function row(it) {
    var role = labels.roles[it.role] || it.role;
    var wa = it.phone ? waLink(it.phone) : null;
    var contact = h('div', { class: 'su-contact' }, [
      h('a', { href: 'mailto:' + it.email, text: it.email }),
      it.phone ? h('a', { href: 'tel:' + it.phone.replace(/[^\d+]/g, ''), text: it.phone }) : null,
      wa ? h('a', { class: 'su-wa', href: wa, target: '_blank', rel: 'noopener', text: 'WhatsApp' }) : null
    ]);
    var facts = h('div', { class: 'su-facts' }, [
      it.area ? h('span', { text: it.area }) : null,
      it.learners && labels.learners[it.learners] ? h('span', { text: labels.learners[it.learners] + (it.learners === 'na' ? '' : ' learners') }) : null
    ].concat((it.concerns || []).map(function (c) { return h('span', { class: 'su-tag', text: labels.concerns[c] || c }); })));

    var sel = h('select', { class: 'select su-status', 'data-id': it.id, 'aria-label': 'Status for ' + it.name, 'data-s': it.status });
    ORDER.forEach(function (s) { var o = h('option', { value: s, text: labels.status[s] || s }); if (s === it.status) o.selected = true; sel.appendChild(o); });
    var note = h('textarea', { class: 'textarea su-note', rows: '2', maxlength: '500', placeholder: 'Team note (not shown to anyone else)', 'data-id': it.id, 'aria-label': 'Team note for ' + it.name });
    note.value = it.note || '';
    var del = h('button', { type: 'button', class: 'link su-del', 'data-del': it.id, text: 'Delete' });

    return h('article', { class: 'card su-item', 'data-status': it.status }, [
      h('div', { class: 'su-main' }, [
        h('div', { class: 'su-who' }, [h('h2', { class: 'su-name', text: it.name }), h('span', { class: 'su-role', text: role })]),
        h('p', { class: 'su-org', text: it.org }),
        facts,
        it.message ? h('blockquote', { class: 'su-msg', text: it.message }) : null,
        contact
      ]),
      h('div', { class: 'su-side' }, [
        h('span', { class: 'mono', title: stamp(it.at), text: when(it.at) + ' · ' + stamp(it.at) }),
        sel, note,
        h('div', { class: 'su-foot' }, [
          it.updatedBy ? h('span', { class: 'mono', text: 'Last change: ' + it.updatedBy.split('@')[0] }) : h('span'),
          del
        ])
      ])
    ]);
  }

  function render() {
    renderFilter();
    csvBtn.disabled = !items.length;
    var shown = items.filter(matches);
    if (!items.length) {
      return empty('No sign-ups yet', [
        h('p', { text: 'Share the form with schools and partners:' }),
        h('a', { class: 'btn btn--sm', href: '/join', text: 'alerts.duniaendelevu.org/join' })
      ]);
    }
    list.textContent = '';
    if (!shown.length) return empty('Nothing matches', [h('p', { text: 'Try another word, or show all.' })]);
    shown.forEach(function (it) { list.appendChild(row(it)); });
  }

  function patch(id, body, okText) {
    return api('PATCH', Object.assign({ id: id }, body)).then(function (x) {
      if (x.status !== 200) { toast('Couldn’t save. Try again.'); return; }
      var i = items.findIndex(function (it) { return it.id === id; });
      if (i >= 0) items[i] = x.d.item;
      if (okText) toast(okText);
      renderFilter();
    });
  }

  // CSV that opens safely in Excel or Sheets: no cell starts with = + - @ (formula injection).
  function cell(v) {
    var s = v === undefined || v === null ? '' : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return '"' + s.replace(/"/g, '""') + '"';
  }
  function csv() {
    var head = ['Received', 'Status', 'Name', 'Role', 'Email', 'Phone', 'School or organisation', 'Area', 'Learners', 'Concerns', 'Message', 'Team note'];
    var rows = items.filter(matches).map(function (it) {
      return [it.at, labels.status[it.status] || it.status, it.name, labels.roles[it.role] || it.role, it.email, it.phone, it.org, it.area,
        labels.learners[it.learners] || '', (it.concerns || []).map(function (c) { return labels.concerns[c] || c; }).join('; '), it.message, it.note];
    });
    var text = '﻿' + [head].concat(rows).map(function (r) { return r.map(cell).join(','); }).join('\r\n');
    var url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
    var a = h('a', { href: url, download: 'dunia-alerts-signups-' + new Date().toISOString().slice(0, 10) + '.csv' });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
    toast('Downloaded ' + rows.length + ' sign-up' + (rows.length === 1 ? '' : 's') + '.');
  }

  document.addEventListener('click', function (e) {
    var t = e.target;
    var f = t.closest('[data-show]');
    if (f) { show = f.getAttribute('data-show'); render(); return; }
    if (t.closest('[data-act="refresh"]')) { load(); toast('Up to date.'); return; }
    if (t.closest('[data-act="csv"]')) { csv(); return; }
    var d = t.closest('[data-del]');
    if (d) {
      if (d.getAttribute('data-sure') !== '1') {
        d.setAttribute('data-sure', '1'); d.textContent = 'Delete for good?';
        setTimeout(function () { if (d.isConnected) { d.removeAttribute('data-sure'); d.textContent = 'Delete'; } }, 4000);
        return;
      }
      var id = d.getAttribute('data-del');
      api('DELETE', { id: id }).then(function (x) {
        if (x.status !== 200) { toast('Couldn’t delete. Try again.'); return; }
        items = items.filter(function (it) { return it.id !== id; });
        render(); toast('Deleted.');
      });
      return;
    }
    if (t.closest('[data-signout]')) {
      fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' }).finally(function () { location.replace('/login?signed_out=1'); });
    }
  });
  document.addEventListener('change', function (e) {
    var s = e.target.closest('.su-status');
    if (s) { s.setAttribute('data-s', s.value); s.closest('.su-item').setAttribute('data-status', s.value); patch(s.getAttribute('data-id'), { status: s.value }, 'Saved: ' + (labels.status[s.value] || s.value) + '.'); return; }
    var n = e.target.closest('.su-note');
    if (n) patch(n.getAttribute('data-id'), { note: n.value }, 'Note saved.');
  });
  q.addEventListener('input', render);
  load();
})();
