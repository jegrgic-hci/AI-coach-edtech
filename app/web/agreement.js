const $ = (id) => document.getElementById(id);

// The version the server served with the document on this page load. Sent back
// on submit so what gets stored is a record of *which wording was on screen*,
// not merely that a box was ticked — the server rejects a mismatch rather than
// accepting the tick against newer text. See server/terms.js.
let version = null;

// Where to go afterwards. The server decides it, same rule as login.js: '/' is
// whichever page this account starts on.
let next = '/';

async function load() {
  try {
    const doc = await api('/api/terms');
    version = doc.version;
    document.title = `${doc.title} — Tau Thinking`;
    $('docTitle').textContent = doc.title;
    // A re-ask is told it is one. Presenting changed wording as if it were the
    // first time anyone had seen it is how a person agrees to a change without
    // noticing there was one.
    $('docLead').textContent = doc.acceptedVersion
      ? 'We have updated this agreement. Please read it and agree again to carry on.'
      : 'Please read this before you start using the tool with a class.';
    $('agreeBlurb').textContent = doc.blurb;
    // Server-authored copy, not user input — the only markup this page renders
    // that it did not write itself, and it comes from terms.js.
    $('docBody').innerHTML = doc.html;
    $('docVersion').textContent = `Version ${doc.version}`;
  } catch {
    $('docBody').innerHTML = '<p>The agreement could not be loaded. Refresh the page and try again.</p>';
  }
}

// Error prevention over error messaging: an unticked box disables submit
// rather than being reported after the form is rejected.
$('agreeCheck').addEventListener('change', () => {
  $('submitBtn').disabled = !$('agreeCheck').checked || !version;
});

$('agreeForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const err = $('formError');
  const submit = $('submitBtn');
  err.classList.add('hidden');
  submit.disabled = true;
  submit.textContent = 'Saving…';
  try {
    const result = await api('/api/terms/accept', { method: 'POST', body: { version } });
    location.href = result.next || next;
  } catch (ex) {
    err.textContent = ex.message;
    err.classList.remove('hidden');
    submit.disabled = false;
    submit.textContent = 'Agree and continue';
  }
});

// Signing out is the honest alternative to agreeing. logout() is api.js's, the
// same one behind the account chip everywhere else.
$('signOutBtn').addEventListener('click', () => logout());

load();
