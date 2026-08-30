const $ = (id) => document.getElementById(id);

const token = new URLSearchParams(location.search).get('t') || '';

// Null until the account is known, and null forever for an account type with
// no terms document (a reset, or a platform admin). Sent back on submit so the server
// records *which wording* was agreed to rather than merely that a box was
// ticked — see server/terms.js.
let termsVersion = null;

// Null unless this is a Pilot user setting their account up, which is the only
// case that asks for a name and a handle. The server decides — the page never
// infers it from a role it could be told.
let rosterTld = null;

// The server has already refused to serve this page for a bad token, so this
// call is not the access check — it names the account, so someone holding a
// forwarded link can see which one they are about to change, and says whether
// this account has terms to agree to.
async function showIdentity() {
  try {
    const who = await api(`/api/auth/invite?t=${encodeURIComponent(token)}`);
    $('identity').textContent = `for ${who.email}`;
    if (who.roster) {
      rosterTld = who.roster.tld;
      // Prefilled, not blank: the suggestion is what would have been minted
      // silently before this form existed, so leaving both untouched gives the
      // old behaviour rather than an empty required field.
      $('displayName').value = who.roster.displayName || '';
      $('handle').value = who.roster.handle || '';
      showHandlePreview();
      $('rosterFields').classList.remove('hidden');
      $('pageTitle').textContent = 'Set up your account';
      $('submitBtn').textContent = 'Create account and sign in';
    }
    if (who.termsVersion) {
      termsVersion = who.termsVersion;
      // Named before the box is shown, never after: the tick and the name of
      // the thing being ticked have to appear together.
      $('termsOpen').textContent = who.termsTitle;
      $('termsBlurb').textContent = who.termsBlurb;
      $('termsField').classList.remove('hidden');
      $('termsFindAgain').classList.remove('hidden');
      // Only gate once the checkbox is actually on the page. Disabling the
      // button before this resolves would leave a reset — which never shows
      // the box — unsubmittable if the call failed.
      $('submitBtn').disabled = true;
    }
  } catch {
    $('identity').textContent = '';
  }
}

// ---------- roster identity ----------

// What the handle box will actually become — lowercased, with everything the
// username scheme cannot carry removed. Shown live rather than enforced as the
// person types, because rewriting an input under a cursor loses their place;
// the field is normalised on blur instead, so what they see is what is stored.
function cleanHandle(value) {
  return String(value).toLowerCase()
    .replace(/[^a-z0-9-]+/g, '')
    .slice(0, 20)
    // Trimmed at both ends because the server's pattern requires the string to
    // start and end alphanumeric — without this the preview would show a value
    // as if it were fine and the submit would come back rejected.
    .replace(/^-+|-+$/g, '');
}

function showHandlePreview() {
  const handle = cleanHandle($('handle').value) || '…';
  $('handlePreview').textContent = `austen@${handle}.${rosterTld}`;
}

$('handle').addEventListener('input', showHandlePreview);
$('handle').addEventListener('blur', () => {
  $('handle').value = cleanHandle($('handle').value);
  showHandlePreview();
});

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
  const submitLabel = submit.textContent;
  err.classList.add('hidden');

  const fail = (message, field) => {
    err.textContent = message;
    err.classList.remove('hidden');
    field.focus();
  };

  // Checked here as well as on the server because emptying a field you were
  // handed a value in is a mistake the person can fix without a round trip.
  if (rosterTld) {
    $('handle').value = cleanHandle($('handle').value);
    if (!$('displayName').value.trim()) return fail('Enter the name your students should see.', $('displayName'));
    if (!$('handle').value) return fail('Enter a roster handle — lowercase letters and numbers.', $('handle'));
  }

  if ($('password').value !== $('confirm').value) {
    return fail('Those two passwords are different.', $('confirm'));
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
        // Sent only where the form asked for them. The server decides again
        // from the token whether this account may set them, so an account that
        // was never offered the fields cannot acquire a handle by replaying
        // this body.
        displayName: rosterTld ? $('displayName').value : undefined,
        handle: rosterTld ? $('handle').value : undefined,
      },
    });
    location.href = '/';
  } catch (ex) {
    err.textContent = ex.message;
    err.classList.remove('hidden');
    submit.disabled = false;
    submit.textContent = submitLabel;
  }
});

// Focus follows the shape of the form, so it waits for the shape to settle: a
// Pilot user starts at their name, everyone else at the password, and neither
// gets a field pushed down the page under a cursor already in it.
showIdentity().finally(() => {
  const first = rosterTld ? $('displayName') : $('password');
  if (!document.activeElement || document.activeElement === document.body) first.focus();
});
