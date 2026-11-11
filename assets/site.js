// Dunia Alerts home page: screen tabs, and a helping hand for old dashboard links.
(function () {
  'use strict';

  // The dashboard used to live at "/". Old bookmarks such as /#desk now open the live pilot.
  var old = { '#overview': 1, '#desk': 1, '#parents': 1, '#impact': 1, '#schools': 1 };
  if (old[location.hash]) { location.replace('/pilot' + location.hash); return; }
  window.addEventListener('hashchange', function () { if (old[location.hash]) location.replace('/pilot' + location.hash); });

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

  var y = document.querySelector('[data-year]');
  if (y) y.textContent = String(new Date().getFullYear());
})();
