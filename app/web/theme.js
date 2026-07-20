/* Theme selection. Loaded as a blocking script in <head> on every page.
 *
 * It must stay blocking: applying the stored theme after first paint gives a
 * dark-mode reader a white flash on every navigation, which is a worse
 * experience than having no toggle at all.
 *
 * Light is the product default. An absent choice means light — deliberately
 * NOT the OS preference, so a teacher demoing on a machine that happens to be
 * in dark mode gets the same screen the class does.
 */
(function () {
  var KEY = 'tau-theme';
  var root = document.documentElement;

  // Safari in private mode throws on storage access rather than returning null.
  function stored() {
    try { return localStorage.getItem(KEY); } catch (e) { return null; }
  }
  function remember(theme) {
    try { localStorage.setItem(KEY, theme); } catch (e) { /* preference is per-session then */ }
  }

  function apply(theme) {
    root.setAttribute('data-theme', theme === 'dark' ? 'dark' : 'light');
  }
  function current() {
    return root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  }

  apply(stored() || 'light');

  function sync() {
    var dark = current() === 'dark';
    var label = dark ? 'Switch to light theme' : 'Switch to dark theme';
    var buttons = document.querySelectorAll('.theme-toggle');
    for (var i = 0; i < buttons.length; i++) {
      var btn = buttons[i];
      btn.setAttribute('aria-pressed', String(dark));
      btn.setAttribute('aria-label', label);
      btn.setAttribute('title', label);
      var icon = btn.querySelector('.theme-toggle-icon');
      if (icon) icon.textContent = dark ? '☀' : '☾';
    }
  }

  function set(theme) {
    apply(theme);
    remember(current());
    sync();
  }

  window.tauTheme = {
    get: current,
    set: set,
    toggle: function () { set(current() === 'dark' ? 'light' : 'dark'); }
  };

  document.addEventListener('DOMContentLoaded', function () {
    var buttons = document.querySelectorAll('.theme-toggle');
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].addEventListener('click', function () { window.tauTheme.toggle(); });
    }
    sync();
  });

  // A second tab is the same reader; keep their choice consistent across tabs.
  window.addEventListener('storage', function (e) {
    if (e.key === KEY && e.newValue) { apply(e.newValue); sync(); }
  });
})();
