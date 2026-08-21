// The terms a student agrees to when they set up their account.
//
// Copy lives here rather than in the page for the same reason the invite
// wording lives in invites.js: it is the part most likely to be edited by
// someone editing nothing else, and it must have exactly one source. The page
// fetches it; nothing hardcodes a second copy.
//
// VERSION is the whole point of this module. `legal.md`'s regime rule requires
// us to be able to prove *which wording* a person agreed to, so acceptance is
// stored as this string against the user, and a person who accepted an older
// one can be told and asked again. Bump it whenever the text below changes in
// a way that changes what someone agreed to — a typo fix does not, a change to
// what we may do with their work does.
//
// Prose source of truth is `legal/student-terms.md`. That file is the draft an
// attorney reviews; this is the rendering of it. If one changes, change both.
// **Neither has been reviewed yet** — see that file's header.
const VERSION = '2026-08-21';

const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || 'support@tauthinking.com';
const PRIVACY_EMAIL = process.env.PRIVACY_EMAIL || 'privacy@tauthinking.com';

// Only students are asked today. A teacher redeeming an invite is agreeing to
// something different — they are the one being shown other people's work, not
// the one whose work is read — and writing that document is a separate job.
// termsFor() returns null for them rather than serving the wrong text, and the
// set-password page shows no checkbox when it gets null.
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

function termsFor(role) {
  if (role !== 'student') return null;
  return { version: VERSION, title: 'Terms of Use', html: STUDENT_TERMS };
}

module.exports = { termsFor, TERMS_VERSION: VERSION };
