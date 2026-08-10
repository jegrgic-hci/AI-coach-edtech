// Shared fetch wrapper. Loaded as a plain script before every page's own
// script — the app has no bundler, so these hang off window by design.
//
// The point of centralising: a 401 (expired or missing session) must send the
// student to the login page from every surface, not fail four different ways.

(function () {
  // Every surface had its own copy of this; the account menu is the first
  // shared component here that interpolates user-supplied text into markup.
  function esc(v) {
    return String(v ?? '').replace(/[&<>"']/g, (c) => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
  }

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

  // ---------- menus ----------

  // One dropdown behaviour for the whole app, following the WAI-ARIA menu
  // button pattern. Every surface had been doing some subset of this by hand:
  // dashboard.html had a real panel but only Escape (which left focus stranded
  // on whatever was behind it), and the other four pages had no menu at all —
  // just a name and a Sign out button in a row, which is why there was nowhere
  // to put a second destination when one was needed.
  //
  // What the pattern requires, and what each line below is for:
  //   - trigger says it opens a menu (aria-haspopup) and whether it is open
  //   - items are reachable by arrow keys, not Tab: the menu is one stop
  //   - roving tabindex, so focus position is unambiguous to a screen reader
  //   - Escape closes AND returns focus to the trigger, or the keyboard user
  //     is dropped at the top of the document
  //   - clicking away, or focus leaving entirely, closes it
  const openMenus = new Set();

  function closeAllMenus(except) {
    for (const m of openMenus) if (m !== except) m.close();
  }

  function tauMenu(trigger, panel) {
    if (!trigger || !panel) return null;

    trigger.setAttribute('aria-haspopup', 'menu');
    trigger.setAttribute('aria-expanded', 'false');
    if (!panel.id) panel.id = `menu-${Math.random().toString(36).slice(2, 8)}`;
    trigger.setAttribute('aria-controls', panel.id);
    panel.setAttribute('role', 'menu');

    // Read fresh on every open: the account menu's items are decided from
    // /api/me and the dashboard's picker hides rows as features land, so a
    // list captured once here would go stale the first time either changed.
    const items = () => [...panel.querySelectorAll('.menu-item:not([hidden])')];

    function focusItem(i) {
      const list = items();
      if (!list.length) return;
      const target = list[(i + list.length) % list.length];
      list.forEach((el) => el.setAttribute('tabindex', el === target ? '0' : '-1'));
      target.focus();
    }

    const menu = {
      get isOpen() { return !panel.hidden; },
      open(focus) {
        closeAllMenus(menu);
        panel.hidden = false;
        trigger.setAttribute('aria-expanded', 'true');
        openMenus.add(menu);
        items().forEach((el) => {
          el.setAttribute('role', 'menuitem');
          el.setAttribute('tabindex', '-1');
        });
        if (focus === 'first') focusItem(0);
        if (focus === 'last') focusItem(items().length - 1);
      },
      close(returnFocus) {
        if (panel.hidden) return;
        panel.hidden = true;
        trigger.setAttribute('aria-expanded', 'false');
        openMenus.delete(menu);
        if (returnFocus) trigger.focus();
      },
      toggle() { menu.isOpen ? menu.close() : menu.open(); },
    };

    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      menu.toggle();
    });

    trigger.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        menu.open('first');
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        menu.open('last');
      }
    });

    panel.addEventListener('click', (e) => e.stopPropagation());

    panel.addEventListener('keydown', (e) => {
      const list = items();
      const at = list.indexOf(document.activeElement);
      if (e.key === 'ArrowDown') { e.preventDefault(); focusItem(at + 1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); focusItem(at - 1); }
      else if (e.key === 'Home') { e.preventDefault(); focusItem(0); }
      else if (e.key === 'End') { e.preventDefault(); focusItem(list.length - 1); }
      else if (e.key === 'Escape') { e.preventDefault(); menu.close(true); }
      // Tab out of a menu closes it rather than trapping: a menu is not a
      // dialog, and the next thing in the page is a legitimate destination.
      else if (e.key === 'Tab') { menu.close(); }
    });

    return menu;
  }

  document.addEventListener('click', () => closeAllMenus());

  // ---------- account menu ----------

  // Which destinations this account gets, decided once here rather than by
  // each page guessing. The rule is symmetry: whatever gets you into a place
  // exists in that place to get you back out — the reason admin.html was a
  // dead end reachable only by the browser's back button.
  function accountDestinations(me, path) {
    const here = (p) => path.endsWith(p);
    const out = [];

    if (me.canAdmin && !here('/admin.html')) {
      out.push({
        href: '/admin.html', icon: '⚙', label: 'Administration',
        desc: 'Teacher and student accounts',
      });
    }
    // The return leg. Offered only to teachers: a platform admin has no
    // teacher dashboard to go back to — every route behind it is role-gated —
    // so the link would be a 403 wearing a friendly label.
    if (here('/admin.html') && me.role === 'teacher') {
      out.push({
        href: '/dashboard.html', icon: '←', label: 'Teacher dashboard',
        desc: 'Your classes, assignments, and students',
      });
    }
    // A preview of someone else's experience, not a role this person holds —
    // which is why it stays a menu item rather than becoming a third option in
    // any role switcher.
    if (me.role === 'teacher' && !here('/index.html') && path !== '/') {
      out.push({
        href: '/', icon: '👁', label: 'Preview student app',
        desc: 'Opens in a new tab',
        newTab: true,
      });
    }
    return out;
  }

  // Renders the account control — trigger plus panel — into a container.
  // Returns the /api/me payload, as the old chip did, so callers that only
  // wanted to know who is signed in keep working unchanged.
  // `opts.extras` lets one page add its own menu items — {label, desc, icon,
  // onClick} — without that page rebuilding the menu. They sit with the
  // navigation destinations, above Appearance, because they are the same kind
  // of thing: somewhere else to go, not a setting.
  async function mountAccountChip(el, opts = {}) {
    if (!el) return null;
    const me = await api('/api/me');

    const dests = accountDestinations(me, location.pathname);
    const extras = opts.extras || [];

    el.classList.add('menu-wrap');
    el.innerHTML = `
      <button type="button" class="avatar-trigger">
        <span class="whoami-name">${esc(me.displayName)}</span>
        <span class="menu-chevron" aria-hidden="true">▾</span>
      </button>
      <div class="menu-panel" hidden>
        <div class="menu-account-head">
          <div class="mn">${esc(me.displayName)}</div>
          <div class="mr">${esc(me.email || '')}</div>
        </div>
        ${dests.length || extras.length ? '<div class="menu-divider"></div>' : ''}
        ${dests.map((d) => `<a href="${d.href}" class="menu-item"${d.newTab ? ' target="_blank" rel="noopener"' : ''}>
          <span class="mi-icon" aria-hidden="true">${d.icon}</span>
          <span class="mi-body">${esc(d.label)}<span class="mi-desc">${esc(d.desc)}</span></span>
        </a>`).join('')}
        ${extras.map((x, i) => `<button type="button" class="menu-item" data-extra="${i}">
          <span class="mi-icon" aria-hidden="true">${x.icon || ''}</span>
          <span class="mi-body">${esc(x.label)}${x.desc ? `<span class="mi-desc">${esc(x.desc)}</span>` : ''}</span>
        </button>`).join('')}
        <div class="menu-divider"></div>
        <button type="button" class="menu-item theme-toggle" aria-pressed="false" aria-label="Switch to dark theme">
          <span class="mi-icon" aria-hidden="true">◐</span>
          <span class="mi-body">Appearance</span>
          <span class="theme-toggle-icon" aria-hidden="true">&#9790;</span>
        </button>
        <div class="menu-divider"></div>
        <button type="button" class="menu-item" data-signout>
          <span class="mi-icon" aria-hidden="true">⇥</span>
          <span class="mi-body">Sign out</span>
        </button>
      </div>`;

    el.querySelector('[data-signout]').addEventListener('click', logout);
    el.querySelectorAll('[data-extra]').forEach((btn) => {
      btn.addEventListener('click', () => {
        closeAllMenus();
        extras[Number(btn.dataset.extra)].onClick();
      });
    });
    // theme.js binds .theme-toggle on DOMContentLoaded, which has already
    // fired by the time this async mount runs — so this instance binds itself
    // and then asks theme.js to sync every toggle's label and icon.
    const toggle = el.querySelector('.theme-toggle');
    toggle.addEventListener('click', (e) => {
      e.stopPropagation();
      window.tauTheme.toggle();
    });
    if (window.tauTheme) window.tauTheme.set(window.tauTheme.get());

    tauMenu(el.querySelector('.avatar-trigger'), el.querySelector('.menu-panel'));
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
  // Exported so dashboard.html's "+ Add" picker gets the same keyboard model
  // as the account menu instead of keeping its own half of the behaviour.
  window.tauMenu = tauMenu;
  window.closeAllMenus = closeAllMenus;
})();
