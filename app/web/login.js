const $ = (id) => document.getElementById(id);

// POC convenience only. These are dev fixtures, not a directory — the seed
// creates them and there is no endpoint that enumerates users.
const TEST_ACCOUNTS = [
  { email: 'maya@school.dev', note: 'student — English 10, strong arc, on open draft 1 (scored)' },
  { email: 'devon@school.dev', note: 'student — English 10, flat arc, open draft 1 in progress' },
  { email: 'priya@school.dev', note: 'student — English 10, integrity flags, open draft 1 pending analysis' },
  { email: 'luis@school.dev', note: 'student — English 10, open draft 1 analysis errored' },
  { email: 'sam@school.dev', note: 'student — English 10, no history on the open assignment yet' },
  { email: 'jamie@school.dev', note: 'student — American Literature, open assignment complete (all 3 drafts)' },
  { email: 'elena@school.dev', note: 'student — American Literature, on the final open draft (in progress)' },
  { email: 'marcus@school.dev', note: 'student — American Literature, integrity flags, open assignment complete' },
  { email: 'teacher@school.dev', note: 'teacher + school administrator — dashboard, roster, and teacher accounts' },
  { email: 'newteacher@school.dev', note: 'teacher — nothing set up yet: the new-teacher Home, named rosters' },
  { email: 'pilotteacher@school.dev', note: 'teacher — nothing set up yet: the same Home, anonymous rosters (Pilot user)' },
  { email: 'admin@school.dev', note: 'platform administrator — accounts, product metrics, and cost' },
];

// The list above describes seeded state, so it is only true on an instance the
// demo seed populated. A real instance gets a plain sign-in form: no fixture
// list, no shared password, and no divider offering an alternative that isn't
// there. The server is the authority (SEED_DEMO), not the hostname.
async function revealTestAccounts() {
  let demo;
  try {
    demo = await api('/api/auth/demo');
  } catch {
    return;
  }
  if (!demo.demo) return;
  // The reset view may already be showing (an expired link lands straight on
  // it), and this request resolves after that decision — revealing the fixture
  // list now would put a published password under a recovery form.
  if (!$('resetForm').classList.contains('hidden')) return;
  $('demoPassword').textContent = demo.password;
  renderTestAccounts(demo.password);
  $('demoDivider').hidden = false;
  $('demoAccounts').hidden = false;
}

function renderTestAccounts(password) {
  const ul = $('testAccounts');
  for (const acct of TEST_ACCOUNTS) {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'test-account';
    btn.textContent = acct.email;
    btn.onclick = () => {
      $('email').value = acct.email;
      $('password').value = password;
      $('loginError').classList.add('hidden');
      $('password').focus();
    };
    const note = document.createElement('span');
    note.className = 'test-note';
    note.textContent = acct.note;
    li.append(btn, note);
    ul.appendChild(li);
  }
}

// Which page each role starts on is the server's decision (index.js,
// homePageFor) rather than a table here: '/' means "this account's home", and
// a `next` the account can't use — someone bounced off /dashboard.html by a
// 401 — is redirected to that same home instead of being rendered and
// rejected again. Keeping a second copy of the mapping in the browser is what
// let the two drift, so the sign-in form knew the rule and nothing else did.
function landingFor() {
  const next = new URLSearchParams(location.search).get('next');
  // Only honour same-origin relative paths — never an absolute URL supplied in
  // the query string — and never a bounce straight back to sign-in.
  const loops = next === '/login.html' || next?.startsWith('/login.html?') || next?.startsWith('/set-password.html');
  if (next && next.startsWith('/') && !next.startsWith('//') && !loops) {
    return next;
  }
  return '/';
}

$('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const err = $('loginError');
  const submit = $('loginSubmit');
  err.classList.add('hidden');
  submit.disabled = true;
  submit.textContent = 'Signing in…';
  try {
    await api('/api/auth/login', {
      method: 'POST',
      body: { email: $('email').value, password: $('password').value },
    });
    location.href = landingFor();
  } catch (ex) {
    err.textContent = ex.message;
    err.classList.remove('hidden');
    submit.disabled = false;
    submit.textContent = 'Sign in';
  }
});

// ---------- password reset ----------

// Why the sign-in form is showing instead of the set-password page the person
// clicked through to. Only ever states the link's condition — never whether an
// account exists for it.
const LINK_NOTICES = {
  expired: 'That link has expired. Enter your email below and we will send you a new one.',
  invalid: 'That link has already been used or is no longer valid. Enter your email below and we will send you a new one.',
};

function showResetView(show) {
  $('loginForm').classList.toggle('hidden', show);
  $('resetForm').classList.toggle('hidden', !show);
  const demo = $('demoAccounts');
  const divider = $('demoDivider');
  // The demo fixture list belongs to signing in, not to recovery — leaving it
  // under the reset form offers a password to someone who just said they
  // haven't got one.
  if (demo && !demo.hidden) demo.style.display = show ? 'none' : '';
  if (divider && !divider.hidden) divider.style.display = show ? 'none' : '';
  if (show) $('resetEmail').focus(); else $('email').focus();
}

$('showReset').addEventListener('click', () => {
  $('resetEmail').value = $('email').value;
  showResetView(true);
});
$('backToSignIn').addEventListener('click', () => showResetView(false));

$('resetForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const submit = $('resetSubmit');
  const done = $('resetDone');
  submit.disabled = true;
  submit.textContent = 'Sending…';
  try {
    await api('/api/auth/request-reset', { method: 'POST', body: { email: $('resetEmail').value } });
  } catch {
    // Deliberately swallowed. The server answers identically for a real and an
    // unknown address; surfacing a transport error here would be the one thing
    // that tells the two apart.
  }
  // Fixed wording, no address echoed back — the message must be identical
  // whether or not an account exists, or the form enumerates who has one.
  done.textContent = 'If that email has an account, a reset link is on its way. It expires in 1 hour.';
  done.classList.remove('hidden');
  submit.disabled = false;
  submit.textContent = 'Send reset link';
});

const linkState = new URLSearchParams(location.search).get('link');
if (LINK_NOTICES[linkState]) {
  $('linkNotice').textContent = LINK_NOTICES[linkState];
  $('linkNotice').classList.remove('hidden');
  showResetView(true);
}

revealTestAccounts();
if ($('resetForm').classList.contains('hidden')) $('email').focus();
