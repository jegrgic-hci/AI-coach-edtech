// The documents a person agrees to before they can use the tool.
//
// Copy lives here rather than in the page for the same reason the invite
// wording lives in invites.js: it is the part most likely to be edited by
// someone editing nothing else, and it must have exactly one source. The page
// fetches it; nothing hardcodes a second copy.
//
// The versions are the whole point of this module. `legal.md`'s regime rule
// requires us to be able to prove *which wording* a person agreed to, so
// acceptance is stored as the version string against the user, and a person
// holding an older one is asked again at sign-in. Bump one whenever its text
// changes in a way that changes what somebody agreed to — a typo fix does not,
// a change to what we may do with their work does.
//
// **Two documents, two versions, bumped independently.** They say different
// things to people in different positions, and a change to one is not a reason
// to re-ask everyone who accepted the other.
//
// Prose source of truth is `legal/student-terms.md` and
// `legal/teacher-terms.md`. Those are the drafts an attorney reviews; this is
// the rendering of them. If one changes, change both. **Neither has been
// reviewed yet** — see those files' headers.
const STUDENT_VERSION = '2026-08-21';
// 2026-08-30: auto-enrolment and the withdrawal right. A version bump, not a
// typo fix — the previous wording said the work is used without saying it is
// every class from creation, and never mentioned that a class can be
// withdrawn. Anyone holding '2026-08-29' is re-asked at sign-in.
//
// 2026-08-30b: data location. The previous wording said "on Google Cloud, in
// the United States" full stop, which was true of storage and NOT of the model
// calls — those go through Google's global endpoint and may run anywhere.
// Verified the same day that neither model is served from any US region for
// this project, so the honest disclosure is the fix rather than a config
// change. Storage and processing are now stated separately.
const TEACHER_VERSION = '2026-08-30b';

const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || 'support@tauthinking.com';
const PRIVACY_EMAIL = process.env.PRIVACY_EMAIL || 'privacy@tauthinking.com';

const STUDENT_TERMS = `
<h3>What Tau Thinking does</h3>
<p>You work through a writing task with an AI assistant, submit a draft, and the tool produces a
reading of <em>how you worked</em> — the moves you made in the conversation, how your ideas
developed, where your writing came from. Your instructor can see that reading.</p>
<p>It is not a grading tool and it does not judge whether your work is correct. It describes what
you did.</p>

<h3>Your work stays yours</h3>
<p>You own everything you write — your conversations, your drafts, your submissions. Nothing here
transfers copyright to us.</p>
<p>So that we can run the tool at all, you give us permission to store, process, and analyse what
you write, for the purposes below and no others. That permission ends when your work is deleted.</p>
<p>We will never publish your work, quote it publicly, or use it in marketing.</p>

<h3>How we use your work</h3>
<p>We use your conversations and submitted work to check and improve how accurately the tool reads
them. When the tool misreads something, that is how we find it and fix it.</p>
<p>We also collect ordinary usage information: which features you used, when, and how long a
session ran.</p>
<p><strong>What we do not do:</strong></p>
<ul>
  <li>We do not use your work to train AI models — not ours, not anyone else's.</li>
  <li>We do not sell your work or your information, or share it with advertisers.</li>
  <li>We do not publish anything about you as an individual.</li>
  <li>We do not use your work for research intended for publication. If that ever changes, we
      would ask you separately, you could say no, and saying no would not affect your grade or
      your access to the tool.</li>
</ul>

<h3>Who can see your work</h3>
<ul>
  <li><strong>Your instructor</strong> — your conversations, submissions, and the readings from
      them, for the classes you are enrolled in.</li>
  <li><strong>Your institution</strong>, in line with its own policies.</li>
  <li><strong>Our staff</strong>, only where needed to run the service or help you with a
      problem.</li>
  <li><strong>The services we run on</strong>, which are contractually barred from using your work
      for their own purposes, including training AI models.</li>
  <li><strong>Anyone the law compels us to tell</strong> — and we will tell you first unless we are
      legally prevented.</li>
</ul>
<p>Nobody else.</p>

<h3>Your account</h3>
<p>Keep your password to yourself, and tell us at ${SUPPORT_EMAIL} if you think someone else has
used your account. Use the tool for your coursework — do not try to break it, reach other people's
work, or resell access to it.</p>

<h3>Your records</h3>
<p>Your conversations and submissions are part of your education record. Your rights over them — to
see them, and to ask for correction of anything inaccurate or misleading — run through your
institution. Ask them, or write to us at ${PRIVACY_EMAIL} and we will help them answer you. You can
export your own work at any time while your account is open.</p>

<h3>The AI can be wrong</h3>
<p>The AI assistant makes mistakes, and will sometimes state things confidently that are false.
Check anything that matters. The readings the tool produces describe your process rather than
deliver a verdict on your thinking, and they can be wrong too.</p>
<p><strong>Follow your instructor's and your institution's rules on using AI in your
coursework.</strong> This tool being available to you does not mean any particular use of AI is
allowed in any particular assignment. That is your instructor's call.</p>

<h3>Changes</h3>
<p>If we change these terms in a way that materially affects you, we will tell you before it takes
effect and give you the chance to stop using the tool.</p>
`;

// Deliberately NOT the DPA. A DPA binds the institution and is signed by
// whoever signs agreements at the school; a teacher accepting a click-through
// cannot execute one, and a document that implied otherwise would be worse
// than none — see `legal.md`, and `legal/dpa-template.md` for the instrument
// itself. What this covers is what a teacher can actually agree to: how the
// tool works, what it stores, and what we ask of them.
//
// It is short because the pilot runs on the anonymous roster: no student name
// and no student email ever enters the product, which is what removes the
// institutional obligations a named roster would carry. If a pilot is ever run
// on named accounts, this is the wrong document.
const TEACHER_TERMS = `
<h3>What the tool does</h3>
<p>Your students work through a writing task with an AI assistant, then submit a draft. The tool
produces a reading of <em>how the student worked</em> — the moves they made in the conversation,
how their ideas developed, where the writing came from. You see that reading.</p>
<p>It is not a grading tool and it does not judge whether the work is correct. It describes what the
student did, and you decide what that means. The readings can be wrong, and so can the AI assistant
— it will sometimes state things confidently that are false. Read both against the student's work
rather than taking either as a verdict.</p>

<h3>Your students stay anonymous</h3>
<p>For this pilot, <strong>we never ask for and never store a student's name or email
address.</strong> You add students as a count, not as a roster. Each one gets a label you choose,
a username built from it, and an access code. Which label belongs to which child is a mapping only
you hold — we cannot recover it, because we never had it.</p>
<p>Two things follow from that, and they are the trade for the anonymity:</p>
<ul>
  <li><strong>We cannot tell you a student's access code.</strong> Codes are stored hashed, the same
      way a password is. If one is lost, you issue a new one from the roster.</li>
  <li><strong>We cannot help a student who has lost their sign-in.</strong> They ask you, and you
      are the only person who can help them.</li>
</ul>

<h3>What we cannot stop</h3>
<p>A student can still type their own name into an essay or a chat message, or paste a document
whose first line is a header you asked for on paper. We scan for common patterns of
self-identification — a "Name:" line, an address, a phone number, "my name is" — and mask them
before any of that work leaves the product. <strong>A student who simply writes their own name
mid-sentence is not detectable.</strong></p>
<p>So tell your class not to put their name in their work, and check your assignment instructions
do not ask for one.</p>

<h3>What we store</h3>
<ul>
  <li>The conversation, turn by turn, with timestamps.</li>
  <li>The drafts and final work your students submit.</li>
  <li>The readings the tool generates from those.</li>
  <li>Your assignment titles, prompts and instructions, and your notes.</li>
  <li>Ordinary usage information: which features were used, when, how long a session ran.</li>
  <li>Your own name and email address, as the teacher.</li>
</ul>
<p>We do not ask for or store home addresses, phone numbers, dates of birth, government
identifiers, health or disciplinary information, or payment details for any student.</p>

<h3>Where it is stored, and where it is processed</h3>
<p><strong>Stored:</strong> on Google Cloud, in the United States. Data is encrypted in transit and
at rest. Nothing is readable by a browser without going through our server, which checks on every
request that you are allowed to see what you asked for: you can reach only your own classes, and a
student can reach only their own work.</p>
<p><strong>Processed:</strong> the AI assistant is a Google model, and conversations, submitted work
and your assignment text are sent to it to generate the conversation and the reading. We call it
through Google's global endpoint, which means <strong>that text may be processed on Google
infrastructure outside the United States.</strong> We would rather pin this to a US region and will
when the model we use is offered in one. Wherever it runs, Google is contractually barred from using
that content to train or improve its models, and it is not stored there.</p>

<h3>How we use it</h3>
<p>We use the conversations and submitted work to check and improve how accurately the tool reads
them. When it misreads a moment, that is how we find it and fix it. That work is done by our own
staff, on a copy with the identifiers stripped and self-identifying text masked, and it produces
changes to the tool rather than findings about any student.</p>
<p><strong>This applies to every class you create, from the day you create it.</strong> There is no
separate step and nothing for you to switch on — it is what taking part in the pilot means, and it
is why we are able to keep your students anonymous.</p>
<p><strong>You can withdraw any class at any time</strong>, from the class menu on your dashboard.
Two things are worth knowing before you need them:</p>
<ul>
  <li>Withdrawing stops future work being used. It does not reach back into a copy that has already
      left — we cannot un-send something we have already read.</li>
  <li>If you withdraw a class and later resume it, work your students did in between stays out
      permanently. That is deliberate: it was done while you had said no.</li>
</ul>
<p>Withdrawing is not the same as deleting. If you want the work gone rather than unused, ask us —
see <em>How long we keep it</em> below.</p>
<p><strong>What we do not do:</strong></p>
<ul>
  <li>We do not use your students' work to train AI models — not ours, not anyone else's.</li>
  <li>We do not sell it or share it with advertisers.</li>
  <li>We do not publish anything about a student, a class, or a school.</li>
  <li>We do not use it in marketing, or show it to another customer.</li>
  <li>We do not use it for research intended for publication. If that ever changes we would ask you
      first, separately, and you could say no.</li>
</ul>

<h3>Who can see it</h3>
<ul>
  <li><strong>You</strong>, for your own classes.</li>
  <li><strong>Our staff</strong>, only where needed to run the service or answer a question you have
      raised.</li>
  <li><strong>The services we run on</strong> — Google Cloud, as above — which are barred from using
      it for their own purposes.</li>
  <li><strong>Anyone the law compels us to tell</strong>, and we will tell you first unless we are
      legally prevented.</li>
</ul>
<p>Nobody else. Not another teacher, not another school.</p>

<h3>What we ask of you</h3>
<ul>
  <li>Add students anonymously. Do not put a real full name in a label, an assignment prompt, or a
      note.</li>
  <li>Hand each student their own access code, not the whole class list.</li>
  <li>Keep your own password to yourself, and tell us at ${SUPPORT_EMAIL} if you think someone else
      has used your account.</li>
  <li>Check that running this pilot is consistent with your school's own rules on classroom
      software, and tell whoever is responsible for that at your school that you are running it.
      <strong>If your school wants a signed agreement, ask us — we have one ready.</strong></li>
  <li>Tell your students what the tool is and that you will see how they worked. It should not be a
      surprise.</li>
</ul>

<h3>How long we keep it, and deleting it</h3>
<p>We keep the class's work for the duration of the pilot and the school year it runs in.
<strong>You can ask us to delete a student, a class, or everything, at any time, by writing to
${PRIVACY_EMAIL}</strong> — we will do it within 30 days and confirm when it is done. You can export
your class's work while your account is open.</p>

<h3>Ending the pilot</h3>
<p>You can stop at any time, and so can we. Deletion works as above.</p>

<h3>Availability</h3>
<p>We try to keep the tool running and the work safe, but this is a pilot and we cannot promise it
will always be available or error-free. It is provided "as is" to the extent the law allows.</p>

<h3>Changes</h3>
<p>If we change this agreement in a way that materially affects you, we will show you the new
version and ask you to agree to it before you carry on.</p>
`;

// Keyed by role, so "which document does this account get" is answered in one
// place rather than by whoever is rendering a page. A role with no entry
// returns null and every caller treats that as "nothing to agree to" — which
// is still the right answer for a platform admin.
// `blurb` is the one line under the tick box on the set-up form, and it is
// here rather than in the page for the same reason the document is: it is copy
// about a specific document, and the form has no business knowing which one it
// is showing.
const DOCS = {
  student: {
    version: STUDENT_VERSION,
    title: 'Terms of Use',
    blurb: 'Covers what the tool does with your work, and what it will never do with it.',
    html: STUDENT_TERMS,
  },
  teacher: {
    version: TEACHER_VERSION,
    title: 'Pilot Agreement',
    blurb: 'Covers what the tool stores about your students, where it is kept, and what we ask of you.',
    html: TEACHER_TERMS,
  },
};

function termsFor(role) {
  return DOCS[role] || null;
}

// True when this account owes an acceptance — no document, an old one, or none
// at all. Used both by the sign-in gate and by the page that resolves it, so
// the two cannot disagree about who is blocked.
//
// `termsCoveredBy` is the exception and has to be checked first: a code-roster
// student is covered by the teacher who created them and is deliberately never
// asked (see pilotuser.md). Without this they would be redirected forever,
// since their termsVersion is null by design and no acceptance will change it.
function needsToAccept(user) {
  if (user.termsCoveredBy) return false;
  const doc = termsFor(user.role);
  if (!doc) return false;
  return user.termsVersion !== doc.version;
}

module.exports = { termsFor, needsToAccept };
