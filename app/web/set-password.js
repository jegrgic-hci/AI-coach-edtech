const $ = (id) => document.getElementById(id);

const token = new URLSearchParams(location.search).get('t') || '';

// Null until the account is known, and null forever for an account type with
// no terms document (a reset, or a teacher). Sent back on submit so the server
// records *which wording* was agreed to rather than merely that a box was
// ticked — see server/terms.js.
let termsVersion = null;

// The server has already refused to serve this page for a bad token, so this
// call is not the access check — it names the account, so someone holding a
// forwarded link can see which one they are about to change, and says whether
// this account has terms to agree to.
async function showIdentity() {
  try {
    const who = await api(`/api/auth/invite?t=${encodeURIComponent(token)}`);
    $('identity').textContent = `for ${who.email}`;
    if (who.termsVersion) {
      termsVersion = who.termsVersion;
      // Named before the box is shown, never after: the tick and the name of
      // the thing being ticked have to appear together.
      $('termsOpen').textContent = who.termsTitle;
      $('termsBlurb').textContent = who.termsBlurb;
      $('termsField').classList.remove('hidden');
      // Only gate once the checkbox is actually on the page. Disabling the
      // button before this resolves would leave a reset — which never shows
      // the box — unsubmittable if the call failed.
      $('submitBtn').disabled = true;
    }
  } catch {
    $('identity').textContent = '';
  }
}

// ---------- terms dialog ----------

// Fetched once, on first open rather than at load: most of this page's work is
// choosing a password, and the document is only needed by someone who asks for
// it.
let termsLoaded = false;

async function openTerms() {
  const dialog = $('termsDialog');
  const body = $('termsBody');

  if (!termsLoaded) {
    body.innerHTML = '<p>Loading…</p>';
    try {
      const doc = await api(`/api/terms?t=${encodeURIComponent(token)}`);
      // Server-authored copy, not user input — the only markup this page
      // renders that it did not write itself, and it comes from terms.js.
      body.innerHTML = doc.html;
      $('termsTitle').textContent = doc.title;
      $('termsVersion').textContent = `Version ${doc.version}`;
      termsLoaded = true;
    } catch {
      body.innerHTML = '<p>The terms could not be loaded. Refresh the page and try again.</p>';
    }
  }

  dialog.showModal();
  // Focus the document rather than the close button: the point of opening is
  // to read, and a keyboard user should be able to scroll immediately.
  body.scrollTop = 0;
  body.focus();
}

function closeTerms() {
  $('termsDialog').close();
}

$('termsOpen').addEventListener('click', openTerms);
$('termsClose').addEventListener('click', closeTerms);
$('termsDone').addEventListener('click', closeTerms);

// Closing returns focus to the tick box, not to the link that opened it: the
// person has finished reading and the next thing they do is agree.
$('termsDialog').addEventListener('close', () => $('termsAgree').focus());

// Clicking the backdrop closes it. <dialog> reports those clicks as landing on
// the dialog itself, so the check is "outside the content box", not the target.
$('termsDialog').addEventListener('click', (e) => {
  const box = $('termsDialog').getBoundingClientRect();
  const outside = e.clientX < box.left || e.clientX > box.right
    || e.clientY < box.top || e.clientY > box.bottom;
  if (outside) closeTerms();
});

// Error prevention over error messaging: an unticked box disables submit
// rather than being reported after a filled-in form is rejected.
$('termsAgree').addEventListener('change', () => {
  $('submitBtn').disabled = !$('termsAgree').checked;
});

// ---------- submit ----------

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
      body: {
        token,
        password: $('password').value,
        // Null when this account has no terms; the server requires a match
        // only where it issued one, so the two stay in step by construction.
        acceptedTermsVersion: termsVersion,
      },
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
