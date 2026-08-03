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
  { email: 'teacher@school.dev', note: 'teacher — dashboard + roster across all 3 classes' },
];

function renderTestAccounts() {
  const ul = $('testAccounts');
  for (const acct of TEST_ACCOUNTS) {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'test-account';
    btn.textContent = acct.email;
    btn.onclick = () => {
      $('email').value = acct.email;
      $('password').value = 'coach1234';
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

function landingFor(role) {
  const roleHome = role === 'teacher' ? '/dashboard.html' : '/index.html';
  const next = new URLSearchParams(location.search).get('next');
  // Only honour same-origin relative paths — never redirect to an absolute URL
  // supplied in the query string. A teacher bounced off the student app's
  // index.html (401 -> ?next=/index.html) should still land on their own
  // dashboard, not back on the page that rejected them.
  if (next && next.startsWith('/') && !next.startsWith('//') && next !== '/index.html') {
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

renderTestAccounts();
$('email').focus();
