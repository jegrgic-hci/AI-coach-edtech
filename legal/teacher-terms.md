# Tau Thinking — Pilot Agreement (teacher)

**Draft for the pilot. Not legal advice, not reviewed by counsel.** Placeholders are marked
`[LIKE THIS]`.

**What this is and is not.** This is the agreement a *teacher* accepts to run a pilot class. It is
not the Data Processing Agreement — a DPA binds the *institution* and is signed by whoever signs
agreements at the school; a teacher cannot execute one. See `legal/dpa-template.md` for that
document and `legal.md` for why the two are separate.

**What makes this safe to hand a single teacher** is that the pilot runs on the anonymous roster
type: no student name and no student email address ever enters the product. That is the whole
reason this agreement can be short. If a pilot class is ever run on named accounts, this document
is the wrong one — the institutional agreement is required first. See `pilotuser.md`.

Rendered for the product in `app/server/terms.js`. **If one changes, change both**, and bump
`TEACHER_VERSION` whenever the change alters what someone agreed to.

---

Last updated: 2026-08-30

Tau Thinking is provided by `[PROVIDER LEGAL ENTITY NAME]` ("we", "us"). This agreement is between
you and us, for running a pilot class with the tool. It is short on purpose. Please read it — it
says what the tool does and what happens to your students' work.

## 1. What the tool does

Your students work through a writing task with an AI assistant inside the tool, then submit a draft.
The tool produces a reading of *how the student worked* — the moves they made in the conversation,
how their ideas developed, where the writing came from. You see that reading.

It is not a grading tool and it does not judge whether the work is correct. It describes what the
student did, and you decide what that means.

The readings can be wrong, and so can the AI assistant — it will sometimes state things confidently
that are false. Treat both as something to read against the student's work, not as a verdict.

## 2. Your students stay anonymous

For this pilot, **we never ask for and never store a student's name or email address.**

You add students as a count, not as a roster. Each one gets a label you choose (`austen`), a
username built from it (`austen@karim.tau`), and an access code. Which label belongs to which child
is a mapping only you hold, on your own paper or in your own gradebook. We cannot recover it,
because we never had it.

Two things follow from that, and they are the trade for the anonymity:

- **We cannot tell you a student's access code.** Codes are stored hashed, the same way a password
  is. If one is lost, you issue a new one from the roster.
- **We cannot help a student who has lost their sign-in.** They ask you, and you are the only person
  who can help them.

## 3. What we can't stop, and what you can do about it

A student can still type their own name into an essay or a chat message, or paste a document whose
first line is a header you asked for on paper. We scan for common patterns of self-identification —
a `Name:` line, an address, a phone number, "my name is" — and mask them before any of that work
leaves the product. **A student who simply writes their own name mid-sentence is not detectable.**

So: tell your class not to put their name in their work, and check the assignment instructions
don't ask for one.

## 4. What we store

- The conversation, turn by turn, with timestamps.
- The drafts and final work your students submit.
- The readings the tool generates from those.
- Your assignment titles, prompts, and instructions, and your notes.
- Ordinary usage information: which features were used, when, how long a session ran.
- Your own name and email address, as the teacher.

We do not ask for or store home addresses, phone numbers, dates of birth, government identifiers,
health or disciplinary information, or payment details for any student.

## 5. Where it is stored, and where it is processed

**Stored:** on Google Cloud, in the United States. Data is encrypted in transit and at rest. Nothing
is readable by an app in a browser without going through our server, which checks on every request
that you are allowed to see what you asked for. You can reach only your own classes; a student can
reach only their own work.

**Processed:** the AI assistant is a Google model, and conversations, submitted work, and your
assignment text are sent to it to generate the conversation and the reading. We call it through
Google's global endpoint, which means **that text may be processed on Google infrastructure outside
the United States.** We would rather pin this to a US region and will when the model we use is
offered in one. Wherever it runs, Google is contractually barred from using that content to train or
improve its models, and it is not stored there.

> **Drafting note.** Verified 2026-08-30: `gemini-3.1-flash-lite` and `gemini-3.5-flash` return 404
> from `us-central1`, `us-east1/4/5`, `us-west1/4` and `us-south1` on `cta-pilot-dev`. The error text
> is ambiguous between "not offered in that region" and "this project lacks access", so confirm which
> with Google before treating global-only as permanent. If a US region becomes available, pin
> `GCP_LOCATION` (`cloudbuild.yaml`, `cloudbuild.staging.yaml`, `config.json`) and simplify this
> section — `llm.js` already builds a regional host when the location is not `global`.

## 6. How we use it

**We use the conversations and submitted work to check and improve how accurately the tool reads
them.** When it misreads a moment, that is how we find it and fix it. That work is done by our own
staff, on a copy with the identifiers stripped and self-identifying text masked, and it produces
changes to the tool rather than findings about any student.

**This applies to every class you create, from the day you create it.** There is no separate step and
nothing for you to switch on — it is what taking part in the pilot means, and it is why we are able
to keep your students anonymous.

**You can withdraw any class at any time**, from the class menu on your dashboard. Two things are
worth knowing before you need them:

- Withdrawing stops future work being used. It does not reach back into a copy that has already
  left — we cannot un-send something we have already read.
- If you withdraw a class and later resume it, work your students did in between stays out
  permanently. That is deliberate: it was done while you had said no.

Withdrawing is not the same as deleting. If you want the work gone rather than unused, ask us — see
Section 9.

**What we do not do:**

- We do not use your students' work to train AI models — not ours, not anyone else's.
- We do not sell it or share it with advertisers.
- We do not publish anything about a student, a class, or a school.
- We do not use it in marketing, or show it to another customer.
- We do not use it for research intended for publication. If that ever changes we would ask you
  first, separately, and you could say no.

## 7. Who can see it

- **You**, for your own classes.
- **Our staff**, only where needed to run the service or answer a question you have raised.
- **The services we run on** — Google Cloud, as above — which are barred from using it for their own
  purposes.
- **Anyone the law compels us to tell**, and we will tell you first unless we are legally prevented.

Nobody else. Not another teacher, not another school.

## 8. What we ask of you

- Add students anonymously. Don't put a real full name in a label, in an assignment prompt, or in a
  note.
- Hand each student their own access code, not the whole class list.
- Keep your own password to yourself, and tell us at `[SUPPORT EMAIL]` if you think someone else has
  used your account.
- Check that running this pilot is consistent with your school's own rules on classroom software,
  and tell whoever is responsible for that at your school that you are running it. **If your school
  wants a signed agreement, ask us — we have one ready.**
- Tell your students what the tool is and that you will see how they worked. It shouldn't be a
  surprise.

## 9. How long we keep it, and deleting it

We keep the class's work for `[RETENTION PERIOD]` after the pilot ends. **You can ask us to delete a
student, a class, or everything, at any time, by writing to `[PRIVACY EMAIL]` — we will do it within
30 days and confirm when it is done.** You can export your class's work while your account is open.

## 10. Ending the pilot

You can stop at any time, and so can we. Section 9 governs what happens to the work afterwards.

## 11. Availability

We try to keep the tool running and the work safe, but this is a pilot and we cannot promise it will
always be available or error-free. It is provided "as is" to the extent the law allows.

`[LIABILITY LIMITATION — for counsel.]`

## 12. Changes

If we change this agreement in a way that materially affects you, we will show you the new version
and ask you to agree to it before you carry on.

## 13. Contact

Questions about the tool: `[SUPPORT EMAIL]`
Questions about data: `[PRIVACY EMAIL]`

Governed by the laws of `[STATE]`.
