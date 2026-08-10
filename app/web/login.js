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

// A school administrator is a teacher with a grant, so their home stays the
// dashboard — teaching is the job they do daily, administration the one they
// do occasionally. They reach it from the account chip, which api.js shows
// whenever /api/me reports canAdmin.
const ROLE_HOMES = { teacher: '/dashboard.html', 'platform-admin': '/admin.html', student: '/index.html' };

function landingFor(role) {
  const roleHome = ROLE_HOMES[role] || ROLE_HOMES.student;
  const next = new URLSearchParams(location.search).get('next');
  // Only honour same-origin relative paths — never redirect to an absolute URL
  // supplied in the query string. And never honour a `next` that is some
  // *other* role's home: someone bounced off a page they can't read (401 ->
  // ?next=/dashboard.html) should land on their own home, not be sent back to
  // the page that rejected them to be rejected again.
  const otherRoleHome = Object.values(ROLE_HOMES).some((h) => h === next && h !== roleHome);
  if (next && next.startsWith('/') && !next.startsWith('//') && !otherRoleHome) {
    return next;
  }
  return roleHome;
}

$('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const err = $('loginError');
  const submit = $('loginSubmit');
  err.classList.add('hidden');
  submit.disabled = true;
  submit.textContent = 'Signing in…';
  try {
    const me = await api('/api/auth/login', {
      method: 'POST',
      body: { email: $('email').value, password: $('password').value },
    });
    location.href = landingFor(me.role);
  } catch (ex) {
    err.textContent = ex.message;
    err.classList.remove('hidden');
    submit.disabled = false;
    submit.textContent = 'Sign in';
  }
});

revealTestAccounts();
$('email').focus();
