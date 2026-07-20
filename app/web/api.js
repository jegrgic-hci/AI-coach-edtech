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

  window.api = api;
  window.logout = logout;
  window.mountAccountChip = mountAccountChip;
  window.requireLogin = toLogin;
})();
