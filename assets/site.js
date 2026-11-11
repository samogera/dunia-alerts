// Dunia Alerts home page: screen tabs, counting cards, and a helping hand for old dashboard links.
(function () {
  'use strict';
  var root = document.documentElement;

  // The dashboard used to live at "/". Old bookmarks such as /#desk now open the live pilot.
  var old = { '#overview': 1, '#desk': 1, '#parents': 1, '#impact': 1, '#schools': 1 };
  if (old[location.hash]) { location.replace('/pilot' + location.hash); return; }
  window.addEventListener('hashchange', function () { if (old[location.hash]) location.replace('/pilot' + location.hash); });

  var still = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine = window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  if (!still && 'IntersectionObserver' in window) root.classList.add('js');

  // Tabs (WAI-ARIA tabs pattern: arrow keys, Home and End move between them)
  var list = document.querySelector('[role="tablist"]');
  if (list) {
    var tabs = Array.prototype.slice.call(list.querySelectorAll('[role="tab"]'));
    var select = function (tab, focus) {
      tabs.forEach(function (t) {
        var on = t === tab;
        t.setAttribute('aria-selected', on ? 'true' : 'false');
        t.tabIndex = on ? 0 : -1;
        var panel = document.getElementById(t.getAttribute('aria-controls'));
        if (panel) panel.hidden = !on;
      });
      if (focus) tab.focus();
      tab.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    };
    list.addEventListener('click', function (e) {
      var tab = e.target.closest('[role="tab"]');
      if (tab) select(tab, false);
    });
    list.addEventListener('keydown', function (e) {
      var i = tabs.indexOf(document.activeElement);
      if (i < 0) return;
      var next = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 }[e.key];
      if (next === undefined) return;
      e.preventDefault();
      select(tabs[(next + tabs.length) % tabs.length], true);
    });
  }

  // Counting cards: each digit rolls into place when the cards come into view.
  var grid = document.querySelector('.metrics');
  if (grid && root.classList.contains('js')) {
    var strips = [];
    Array.prototype.forEach.call(grid.querySelectorAll('.metric__num'), function (num) {
      var v = num.querySelector('.metric__v');
      if (!v) return;
      var sr = document.createElement('span');
      sr.className = 'sr';
      sr.textContent = num.textContent.trim();
      Array.prototype.forEach.call(num.children, function (c) { c.setAttribute('aria-hidden', 'true'); });
      var text = v.textContent, html = '', d = 0;
      for (var k = 0; k < text.length; k++) {
        var ch = text.charAt(k);
        if (/\d/.test(ch)) {
          var cells = '';
          for (var n = 0; n < 20; n++) cells += '<span>' + (n % 10) + '</span>';
          html += '<span class="od"><span class="od__strip" data-to="' + (10 + Number(ch)) + '" style="--dur:' + (1.5 + d * 0.22).toFixed(2) + 's">' + cells + '</span></span>';
          d++;
        } else {
          html += '<span class="od-ch">' + ch + '</span>';
        }
      }
      v.innerHTML = html;
      num.appendChild(sr);
      Array.prototype.push.apply(strips, v.querySelectorAll('.od__strip'));
    });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        grid.classList.add('is-in');
        strips.forEach(function (s) { s.style.transform = 'translateY(-' + (Number(s.dataset.to) * 5) + '%)'; });
        io.disconnect();
      });
    }, { threshold: 0.3 });
    io.observe(grid);

    // A gentle 3D tilt that follows the pointer (mouse and trackpad only).
    if (fine) {
      Array.prototype.forEach.call(grid.querySelectorAll('.metric'), function (card) {
        card.addEventListener('pointermove', function (e) {
          var r = card.getBoundingClientRect();
          var x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
          card.classList.add('is-tilting');
          card.style.setProperty('--ry', ((x - 0.5) * 10).toFixed(2) + 'deg');
          card.style.setProperty('--rx', ((0.5 - y) * 8).toFixed(2) + 'deg');
          card.style.setProperty('--mx', (x * 100).toFixed(1) + '%');
          card.style.setProperty('--my', (y * 100).toFixed(1) + '%');
        });
        card.addEventListener('pointerleave', function () {
          card.classList.remove('is-tilting');
          card.style.setProperty('--rx', '0deg');
          card.style.setProperty('--ry', '0deg');
        });
      });
    }
  }

  var y = document.querySelector('[data-year]');
  if (y) y.textContent = String(new Date().getFullYear());
})();
