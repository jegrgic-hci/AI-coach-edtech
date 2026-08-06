// Shared fetch wrapper. Loaded as a plain script before every page's own
// script — the app has no bundler, so these hang off window by design.
//
// The point of centralising: a 401 (expired or missing session) must send the
// student to the login page from every surface, not fail four different ways.

(function () {
  function toLogin() {
    if (location.pathname !== '/login.html') {
      location.href = `/login.html?next=${encodeURIComponent(location.pathname + location.search)}`;
    }
  }

  async function api(path, opts = {}) {
    const res = await fetch(path, {
      headers: { 'Content-Type': 'application/json' },
      ...opts,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    // A 401 from the login endpoint is "wrong password", not "session expired" —
    // let it fall through so the form can show the real message.
    if (res.status === 401 && path !== '/api/auth/login') {
      toLogin();
      throw new Error('not signed in');
    }
    if (!res.ok) {
      const detail = await res.json().catch(() => ({}));
      throw new Error(detail.error || res.statusText);
    }
    return res.json();
  }

  // Product telemetry: fire-and-forget record that someone opened a content
  // area. Never awaited and never allowed to throw — a metrics write must not
  // be able to break the interaction it is measuring, and a 401 here must not
  // bounce the page to login mid-click (hence raw fetch, not api()).
  //
  // Call this on explicit opens only — a tab click, a panel open, a jump-nav
  // click. Not on render, and not from a scroll handler: a scrollspy fires
  // continuously and would drown every deliberate signal in the ranking.
  function logUse(surface, area) {
    fetch('/api/usage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ surface, area }),
    }).catch(() => {});
  }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    location.href = '/login.html';
  }

  // Renders the signed-in user into a container, with a sign-out button.
  async function mountAccountChip(el) {
    if (!el) return null;
    const me = await api('/api/me');
    el.innerHTML = '';
    const name = document.createElement('span');
    name.className = 'account-name';
    name.textContent = me.displayName;
    const out = document.createElement('button');
    out.className = 'account-signout';
    out.textContent = 'Sign out';
    out.onclick = logout;
    el.append(name, out);
    return me;
  }

  // Populates the shared nav's breadcrumb — used by both the SPA (app.js)
  // and the report page (report-boot.js) so the two never drift onto their
  // own markup for the same component. A segment is exactly one of: current
  // (plain text, bold), a link (href, real navigation), a click (in-SPA
  // action), or a plain label (no destination exists for that level yet).
  function renderNavCrumbs(container, segments) {
    if (!container) return;
    container.innerHTML = '';
    segments.forEach((seg, i) => {
      if (i > 0) {
        const sep = document.createElement('span');
        sep.className = 'crumb-sep';
        sep.textContent = '›';
        container.append(sep);
      }
      if (seg.current) {
        container.append(el('span', 'crumb-current', seg.label));
      } else if (seg.onClick) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'crumb-link';
        btn.textContent = seg.label;
        btn.onclick = seg.onClick;
        container.append(btn);
      } else if (seg.href) {
        const a = document.createElement('a');
        a.className = 'crumb-link';
        a.href = seg.href;
        a.textContent = seg.label;
        container.append(a);
      } else {
        container.append(el('span', 'crumb-label', seg.label));
      }
    });
  }

  // Populates the local Report/Session toggle. Pass an empty array to
  // hide it — the toggle is scoped to one draft and only makes sense when
  // both a session and a report actually exist for it.
  function renderNavLocal(container, options) {
    if (!container) return;
    container.innerHTML = '';
    if (!options || !options.length) {
      container.classList.add('hidden');
      return;
    }
    container.classList.remove('hidden');
    for (const opt of options) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'tau-nav-local-opt' + (opt.active ? ' active' : '');
      btn.textContent = opt.label;
      if (!opt.active && opt.onClick) btn.onclick = opt.onClick;
      container.append(btn);
    }
  }

  // Minimal DOM helper — api.js loads before app.js/report-boot.js define
  // their own, and this file has no other dependency to reach for one.
  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  window.api = api;
  window.logUse = logUse;
  window.logout = logout;
  window.mountAccountChip = mountAccountChip;
  window.requireLogin = toLogin;
  window.renderNavCrumbs = renderNavCrumbs;
  window.renderNavLocal = renderNavLocal;
})();
