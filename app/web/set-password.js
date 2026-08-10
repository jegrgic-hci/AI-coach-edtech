const $ = (id) => document.getElementById(id);

const token = new URLSearchParams(location.search).get('t') || '';

// The server has already refused to serve this page for a bad token, so this
// call is not the access check — it only names the account, so someone holding
// a forwarded link can see which one they are about to change.
async function showIdentity() {
  try {
    const who = await api(`/api/auth/invite?t=${encodeURIComponent(token)}`);
    $('identity').textContent = `for ${who.email}`;
  } catch {
    $('identity').textContent = '';
  }
}

// Same landing rule as login.js: '/' is whichever page this account starts on,
// resolved server-side (index.js, homePageFor).

$('setPasswordForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const err = $('formError');
  const submit = $('submitBtn');
  err.classList.add('hidden');

  // Checked here as well as on the server because the two fields matching is
  // the one rule the person can fix without a round trip.
  if ($('password').value !== $('confirm').value) {
    err.textContent = 'Those two passwords are different.';
    err.classList.remove('hidden');
    $('confirm').focus();
    return;
  }

  submit.disabled = true;
  submit.textContent = 'Setting…';
  try {
    await api('/api/auth/set-password', {
      method: 'POST',
      body: { token, password: $('password').value },
    });
    location.href = '/';
  } catch (ex) {
    err.textContent = ex.message;
    err.classList.remove('hidden');
    submit.disabled = false;
    submit.textContent = 'Set password and sign in';
  }
});

showIdentity();
$('password').focus();
