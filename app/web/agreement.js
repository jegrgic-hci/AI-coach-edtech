const $ = (id) => document.getElementById(id);

// The version the server served with the document on this page load. Sent back
// on submit so what gets stored is a record of *which wording was on screen*,
// not merely that a box was ticked — the server rejects a mismatch rather than
// accepting the tick against newer text. See server/terms.js.
let version = null;

// Where to go afterwards. The server decides it, same rule as login.js: '/' is
// whichever page this account starts on.
let next = '/';

// Set when this page is the first step of setting an account up rather than a
// gate in front of one that already works. The person has no session yet, so
// every call is proved by the invite token instead — and afterwards they go on
// to the set-up form rather than to a dashboard they cannot reach.
const token = new URLSearchParams(location.search).get('t') || '';

// Long form on purpose. A record someone files and reads back in six months
// should not make them decode "30/08/26".
function longDate(iso) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? null
    : d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

async function load() {
  try {
    const doc = await api(token ? `/api/terms?t=${encodeURIComponent(token)}` : '/api/terms');
    version = doc.version;
    document.title = `${doc.title} — Tau Thinking`;
    $('docTitle').textContent = doc.title;

    // Two states, decided by whether the version on file is the one being
    // served. Outstanding means a decision; current means a record.
    const outstanding = doc.acceptedVersion !== doc.version;

    // A re-ask is told it is one. Presenting changed wording as if it were the
    // first time anyone had seen it is how a person agrees to a change without
    // noticing there was one.
    // Three leads, because the reader is in three different situations. The
    // token one says what happens next, so a person deciding whether to agree
    // knows the account does not exist yet and nothing has been asked of them.
    $('docLead').textContent = !outstanding
      ? 'This is the agreement you accepted. Print it or save it as a PDF for your records.'
      : token
        ? 'Please read this first. Once you agree, you will set up your account.'
        : doc.acceptedVersion
          ? 'We have updated this agreement. Please read it and agree again to carry on.'
          : 'Please read this before you start using the tool with a class.';

    $('agreeBlurb').textContent = doc.blurb;
    // Server-authored copy, not user input — the only markup this page renders
    // that it did not write itself, and it comes from terms.js.
    $('docBody').innerHTML = doc.html;
    $('docVersion').textContent = `Version ${doc.version}`;

    if (outstanding) {
      $('agreeForm').classList.remove('hidden');
      $('declineRow').classList.remove('hidden');
      if (token) {
        // "Sign out" is wrong here — there is nothing to sign out of yet. The
        // alternative on offer is genuinely leaving the link alone, which is
        // what it now says.
        $('signOutBtn').textContent = 'Leave set-up';
        $('submitBtn').textContent = 'Agree and set up your account';
      }
    } else {
      $('recordActions').classList.remove('hidden');
      const on = doc.acceptedAt && longDate(doc.acceptedAt);
      // Falls back to the version alone rather than printing "Invalid Date" or
      // an empty by-line: an incomplete record is still a record, a wrong one
      // is not.
      if (doc.acceptedBy && on) {
        $('docRecord').textContent = `Accepted by ${doc.acceptedBy} on ${on}.`;
        $('docRecord').classList.remove('hidden');
      }
    }
  } catch {
    $('docBody').innerHTML = '<p>The agreement could not be loaded. Refresh the page and try again.</p>';
  }
}

$('printBtn').addEventListener('click', () => window.print());

// Error prevention over error messaging: an unticked box disables submit
// rather than being reported after the form is rejected.
$('agreeCheck').addEventListener('change', () => {
  $('submitBtn').disabled = !$('agreeCheck').checked || !version;
});

$('agreeForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const err = $('formError');
  const submit = $('submitBtn');
  const submitLabel = submit.textContent;
  err.classList.add('hidden');
  submit.disabled = true;
  submit.textContent = 'Saving…';
  try {
    // Same record either way — which version, against which account, at what
    // time. Only the proof of identity differs: a session here, the invite
    // token there, exactly as the two /api/terms routes already differ.
    const result = token
      ? await api('/api/auth/terms-accept', { method: 'POST', body: { token, version } })
      : await api('/api/terms/accept', { method: 'POST', body: { version } });
    location.href = result.next || next;
  } catch (ex) {
    err.textContent = ex.message;
    err.classList.remove('hidden');
    submit.disabled = false;
    submit.textContent = submitLabel;
  }
});

// The honest alternative to agreeing. Signing out is the one that fits an
// account already in use; someone still holding a set-up link has no session,
// so leaving means going back to the sign-in page.
$('signOutBtn').addEventListener('click', () => {
  if (token) location.href = '/login.html';
  else logout();
});

load();
