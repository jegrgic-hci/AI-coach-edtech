# Pilot users — anonymous rosters, access codes, and data masking

**Scope of this file.** How a pilot teacher is set up to enrol students who are minors, how those
students are identified and signed in, what a teacher can and cannot recover on their behalf, and
what the product does and does not do about personal information appearing in student work. Owns the
`codeRoster` grant, the two identity types, the username scheme, the access-code credential, and the
measurement-improvement export's masking contract.

**Not in this file.** Dimension definitions and scoring stay in `tau-dimensions.md`. Dashboard IA and
the flag/signal surface stay in `teacher-dashboard-design.md`. Component and colour rules stay in
`designsystem.md` (the `.seg` toggle added for this work is registered there). Phases, infrastructure
and cost stay in `built-in-chat-plan.md`. Legal drafting stays in `legal.md` and `legal/`.

**Status (2026-08-29): built and working end to end.** The teacher agreement gap is closed — see
*Consent*. The remaining gap is that there is **no redaction path** for personal information a
student types in running prose; see *Open*.

---

## Why this exists

A pilot class of minors cannot have their names or email addresses in the product. Not "should not" —
the design position is that the tool **never collects** them, so there is nothing to leak, export,
subpoena, or get wrong. Everything below follows from that single constraint.

The consequence is that the ordinary identity path does not apply. That path is: an administrator
enters a name and school email, the account is created with no password, and an emailed single-use
link lets the person set one (`auth.js`, credential tokens). Every step of it requires knowing who
the child is. So a second identity type exists, and the teacher becomes the delivery channel that
email would otherwise have been.

---

## The grant

`codeRoster` is a boolean on a **teacher's** account, set by a platform admin at
`POST /api/admin/teachers` and on `/edit`, audited through `adminEvents` like the other two grants.
It is visible in the Add teacher form as **"Pilot user"** — *anonymous students, and their work used
to improve the measurement*.

**It is one arrangement, not two settings ticked together** (renamed 2026-08-30). Anonymity and
contribution are the same bargain: the students are anonymous *so that* the work can be used, and the
work is used *because* that is what a pilot is for. Naming it for what the teacher **is** rather than
for either half of what it switches on is what stops an admin granting one and assuming the other did
not follow. The field name stays `codeRoster` — renaming a stored flag after accounts exist is a
migration, not an edit.

**What it now implies.** `canContributeImprovement(user)` is true for `improvementEligible` **or**
`codeRoster`, so a Pilot user needs no second grant, and every class they create is stamped at
creation — see *Consent*. `improvementEligible` survives as its own checkbox for the other situation:
a teacher running **named** accounts whose school signed an agreement. Two situations, two controls,
one derived answer.

**It governs creation, not sign-in.** It decides what this teacher's Add students form creates and
changes nothing about anyone who already exists. This matters because a student can end up on two
teachers' classes and must not change how they sign in by being added to the second one — so the
truth about an account lives on the account.

**The grant REPLACES the named form rather than adding to it** (2026-08-30, reversing the opposite
decision made while this was still a roster *mode*). A Pilot user adds students anonymously and only
anonymously:

- `POST /api/classes/:id/students` returns **403** on the email path for them — both branches, so
  adding an *existing* named student is refused as well as creating a new one. An identified child on
  a roster covered by this agreement is the same exposure either way.
- The Named/Anonymous toggle is gone from both Add students doors. Which form shows is derived from
  the account by `applyRosterMode()`, which is the only writer of that state.

The reasoning that previously kept the named path open — that one teacher might run a senior class by
email and a junior one by code — was reasoning about a *mode*. This is an arrangement with an
agreement under it, and a product that lets a teacher enter a child's name and address in two clicks
contradicts a document their school signed. The refusal is the enforcement of that agreement.

**The cost, since the two flags are fused:** a Pilot user genuinely teaching a senior class cannot add
named students at all. Their outs are for a platform admin to untick Pilot user — which also revokes
improvement contribution — or to hold the named arrangement instead via `improvementEligible`. This
is acceptable while every teacher on the system is a pilot teacher. **If that stops being true, the
fix is to separate the two grants again, not to reopen this hole.**

**Existing exposure is reported, not assumed away.** The admin teacher row shows a
`namedStudentCount` chip for any Pilot user whose classes still hold `identity: 'email'` students —
accounts predating the grant or predating this refusal. It should be zero; a non-zero count is the
one thing about this arrangement an administrator could not otherwise see.

---

## The two identity types

Every student account carries `identity`:

| | `identity: 'email'` | `identity: 'code'` |
|---|---|---|
| Created by | pasting a roster of names and addresses | choosing a count, then saving generated labels |
| `email` | the school address | **`null`**, explicitly |
| `username` | — | `austen@karim.tau` |
| Credential | a password the student chooses | an access code the teacher hands over |
| Set up by | an emailed single-use link | already set at creation |
| Recovery | emailed reset link | **the teacher issues a new code** |
| Terms accepted | by the student, at set-up | **never asked** — see *Consent* |

A document written before this feature has no `identity` field and is read as `'email'`.

---

## Identity: the username scheme

    austen@karim.tau
    └ label ┘└teacher┘

**Last word only on both sides, no separators inside either.** "Jane Austen" under "Ms. Karim"
becomes `austen@karim.tau`. A surname is what a class already calls a person and is the shortest
thing a nine-year-old can copy off a slip without losing their place.

**`.tau` is deliberate.** It makes the string a well-formed address, so it passes an email field
without complaint and can reuse the login form unchanged — while being a TLD that does not exist, so
mail to it bounces immediately instead of vanishing. A parent who tries to write to their child's
"address" finds out at once.

**Neither half is ever recomputed.** The teacher's half is a `handle` minted once onto their account
and checked unique across the whole store; the student's half is a `username` stored on theirs. A
teacher who becomes "Mrs. Karim-Lee" in March does not invalidate thirty sign-ins, and renaming a
label does not either. **Changing the slug rules after accounts exist requires a migration, not just
new code** — the stored values are what sign-ins match against.

Slug handling lives in `codes.js` and covers three cases found by running real labels through it:
an apostrophe is part of a name and not a break in it (`O'Brien` → `obrien`); a trailing initial is
not a surname (`Karim J.` → `karim`); a trailing number is a counter and joins the word before it
(`Student 01` → `student01`).

### Labels

The teacher chooses a count, optionally a **naming theme**, and gets an editable list before anything
is created. Generate makes nothing — it fills a form. Accounts and codes come into existence on Save,
because a label that does not match the teacher's own paper list is only fixable before thirty
accounts exist under it, and a code shown for an account nobody saved is a code nobody holds.

A theme ("Authors", "Planets") produces one word each via `complete()` on Vertex. **The only thing
sent is the theme word** — it is not student data and cannot become student data, which is what makes
an LLM call acceptable at this point at all. The model's output is a suggestion, never a roster:
anything blank, duplicated, over 40 characters or containing `@` is dropped, and the shortfall is
made up with numbered labels so Generate always returns exactly the count asked for.

The server enforces what it can: no `@` in a label, no blanks, no duplicates, ≤40 characters, ≤60 per
batch. **Whether a label is a real name is the teacher's judgement**, and the form says so.

---

## The credential

An access code is **ten characters**, one unbroken run, from a 27-symbol alphabet of digits and
consonants — no `0/O/1/I/L` to misread off a printed slip, and no vowels, so a random draw cannot
spell a word a child should not be handed. Roughly 47 bits.

**The code is the account's password.** It is stored through `auth.js`'s own `setPassword`/
`passwordFields` — same scrypt cost, same verifier, same per-account throttle. There is no second
credential path and no second hash: a code account differs from an email account only in what
identifies it, never in how the secret is checked. Comparison normalises case and strips spaces and
hyphens for `identity: 'code'` only, so a child who types `nkh3d5kmgw` gets in exactly as one who
copies `NKH3D-5KMGW`; a chosen password stays byte-exact.

Sign-in is the **existing login form** — username in Email, code in Password. Nothing new to learn
and no second server path.

### What a teacher can and cannot recover

| | |
|---|---|
| **Username** | Always. Listed on the roster, in the admin student list, in the student's own account chip, and printable as a reminder sheet. |
| **Access code** | **Never.** It is hashed at rest. The only answer to "what was their code" is a new one. |

This is stated in the product, at the top of the roster view, rather than left to be discovered. The
roster offers **New code** per student and **New codes for all N** for a class that has lost them;
both invalidate the old code immediately and end any live session, and the username is untouched so
the teacher's paper list stays correct.

**The teacher is the gatekeeper.** The login page's reset form says so — a student signing in with a
username and access code is told to ask their teacher. The reset lookup stays **email-only on
purpose**: answering differently for a username would turn that box into a way to test whether a
given student exists. Administrators can suspend a code account but cannot mail it anything, and
cannot issue a code — so an admin still cannot become a student.

**This is the one place in the product a credential is displayed to somebody other than its owner,
and it is deliberate.** `auth.js` mails a link rather than showing a password because a mailbox is
the safer channel and it closes "an admin can then sign in as them". Neither holds here: there is no
mailbox, so the teacher *is* the delivery channel, and a teacher can already read everything the
account will produce. The codes sheet therefore prints — one cut-apart slip per student, because
handing a child the whole class's codes is the one thing it must not do.

---

## Consent

**A code student is never asked to accept the Terms of Use, and that is a decision, not a missing
screen.** A child cannot give the consent that acceptance represents, and asking would mean
identifying them — the thing the roster type exists to avoid. Their account records
`termsCoveredBy: <teacherId>` with `termsVersion: null`, which is what distinguishes "covered by the
school" from "has not accepted yet".

**Closed 2026-08-29.** `terms.js` now carries a second document — the **Pilot Agreement**, versioned
independently of the student Terms of Use — and a teacher accepts it before they can reach any page.
`termsCoveredBy` therefore now points at a person who holds a stored `termsVersion`, so the chain
ends in a version of a document rather than in a name.

**The Pilot Agreement is deliberately not the DPA.** A DPA binds the *institution* and is signed by
whoever signs agreements at the school; a teacher clicking a checkbox cannot execute one, and a
document that implied otherwise would be worse than none — `legal.md`'s settled understanding, and
NY Ed Law § 2-d specifically. What a teacher can agree to is what the tool does, what it stores,
where it is kept, and what we ask of them. The agreement is short **because the pilot runs on the
anonymous roster**: no student name and no student email enters the product, which is what removes
the institutional obligations a named roster would carry. Running a pilot on named accounts makes it
the wrong document, and the institutional agreement is required first. It tells the teacher so, and
tells them to ask us if their school wants something signed — which is how the DPA gets in front of
the person who can sign it.

Prose lives in `legal/teacher-terms.md`; the rendering is `terms.js`. **If one changes, change
both**, and bump `TEACHER_VERSION` only when the change alters what someone agreed to.

**How the gate works.** `needsToAccept(user)` in `terms.js` answers "does this account owe an
acceptance" — no stored version, or one that is not the current one — and `redirectedToOwnPage` in
`index.js` runs it before the role check, so an unaccepted teacher cannot reach the dashboard by any
route. `termsCoveredBy` is checked **first and short-circuits**: a code student's `termsVersion` is
null by design and no acceptance will ever change it, so without that guard they would be redirected
forever. Acceptance for an account that already exists is `POST /api/terms/accept`, which requires
the submitted version to match what the server would serve — so what gets stored is a record of
which wording was on screen, not that a box was ticked on a page open since before the last edit.

This also, finally, keeps the promise `auth.js` makes when it declines to re-ask on a password reset
— "a version bump is re-asked at sign-in". Nothing kept it before: the old `TERMS_VERSION` export
was read by no one.

---

## Personal information in student work

**What the tool collects: nothing identifying.** No name, no email, no identifier is ever asked for
about a code student. That guarantee is absolute because it is about collection, not detection.

**What the tool cannot prevent: what a child types.** Their essays and chat turns are their own
writing. A student who signs their draft, pastes a `.docx` whose first line is the header their
teacher asked for on paper, or writes "my name is —" puts personal information into the record.
Uploads are `.docx`/`.txt` extracted to raw text in the browser, so document *metadata* never
travels — but a header line does.

### What we do not attempt

**Deciding whether a string is a person's name.** It is unanswerable without knowing the referent:
"Jane Austen" in an essay about Austen is the subject, and in a themed roster half the class is
*labelled* `austen`. A name detector fires on the roster itself. This is not a limitation to work
around; it is the wrong question.

*Demonstrated during the export build:* a crude name check flagged "Jacob" in a transcript — it was
**Irwin Jacobs**, the Qualcomm founder, discussed by the AI in a conversation about CDMA.

### What we do instead

**Detect self-identification, not names.** The signal is carried by the frame, not by the name inside
it — nobody writes "Name: Sam Lee" about a character. `pii.js` matches four frames and captures
whatever they contain: a `Name:`/`By:`/`Class:` header line anchored to the start of a line, an
address, a phone number, and first-person identity claims (`my name is`, `call me`).

Precision is chosen over recall on purpose: a false positive silently rewrites a student's sentence
in the corpus the measurement is calibrated on. `I'm X` is deliberately absent — it takes an
adjective far more often than a name. The phone pattern was tightened after the first real run
matched `0.000002` and `0.000008` in a science essay and a 12-digit reference number; a bare 12-digit
string is now missed on purpose.

**The residual risk, stated rather than buried:** a child who writes their own name in running prose
("Sam walked home") is not detectable and is not meant to be. Every export run prints this line.

### Layers, and what is built

| Layer | Status |
|---|---|
| Never collect it | **Built** — the whole roster type |
| Mask it at the export boundary | **Built** — see below |
| Stop the coach eliciting or echoing personal details | **Not built** — a prompt edit in `coach.js` |
| Strip a `Name:` header from an uploaded `.docx` before submission | **Not built** |
| Warn the student at input | **Not built**; if built, must warn and not block — a false positive that stops a ten-year-old mid-thought costs more than the case it prevents |
| **Remove it once written** | **Not built, and the real gap** — see *Open* |

---

## The measurement-improvement export

`app/server/export-improvement.js`. Dry run by default; `--write <path>` to produce the file. A
script and not an HTTP route: bulk egress of student work should not have a web surface.

**Code-roster students are not excluded from this export, and excluding them would be backwards.**
Their accounts carry no name, no email and no identifier — a *named* student's account carries a real
first and last name and a school address. The rules below are what make both safe, and they are why
there is no rule keyed to roster type.

**Two independent guarantees:**

1. **No identity leaves.** Every actor becomes a per-export pseudonym (`stu_1`, `cls_1`, `asg_1`),
   regenerated each run, so two exports cannot be joined to each other and nothing in the file maps
   back to a person without the store. Verified against the whole store: no user id, class id,
   session id, submission id, email or username appears in the output.
2. **What the student typed is scanned.** After (1), prose is the only channel a person can arrive
   through, so every free-text field goes through `pii.js` on the way out. Each run reports what it
   redacted, by kind.

**Consent is date-enforced.** The class `improvement` stamp carries `grantedAt`, and only work
submitted at or after it is exported. Work made before anyone agreed is outside what they agreed to.
Revoking clears the stamp and the class stops appearing; nothing already exported is recalled.

**Which is why a Pilot user's classes are stamped at creation** (2026-08-30). The stamp only reaches
forward, so a class marked halfway through a term loses its own first sessions **permanently and
silently** — the export simply reports fewer drafts than the teacher ran. Creation is the only moment
that cannot be too late, so `POST /api/classes` writes the stamp in the same document as the class
when `codeRoster` is set, giving `grantedAt === createdAt` exactly.

That is not consent assumed on the teacher's behalf. It is what they accepted in the Pilot Agreement,
which says in its own words that the work is used to check how accurately the tool reads it. A
named-roster teacher is the other case and still marks each class themselves, behind the attestation
modal.

Three rules keep the date honest once the grant moves around:

| Event | Stamp |
|---|---|
| Pilot user creates a class | `grantedAt = createdAt` |
| Grant applied to a teacher who already has classes | Unstamped ones stamped **at grant time**, never backdated — sessions run before anyone agreed stay out. Already-stamped ones keep their own earlier date; a class the teacher deliberately withdrew is not silently re-enrolled by an unrelated admin edit |
| Withdrawn, then resumed | A **new** date. Work submitted during the gap was submitted under a withdrawal, and reaching back over it would export exactly the window someone said no to |

The dashboard does not ask a Pilot user to attest when resuming — they already agreed, an
attestation nobody can decline is not an attestation, and asking twice implies the first one was not
the agreement. It tells them the gap stays out instead.

**`agreement.html` is a gate and a record, chosen by whether the stored version matches the served
one** (2026-08-30). Outstanding → the tick box and *Agree and continue*, with Sign out as the honest
alternative. Current → the same document with *Accepted by ‹name› on ‹date›*, a print action, and the
way back. **The reverse redirect was removed to allow this**: the page used to bounce anyone who had
already accepted, which kept an accepted agreement from being re-presented as a gate but also made it
unreachable — and a person cannot keep a record of something they can never open again. Rendering a
record rather than a gate solves the original concern without taking the document away.

Reached from the account chip, labelled with the document's own name, and **gated on a stored
`termsVersion` rather than on role** — a code-roster student never accepted anything, and offering
them a copy would misrepresent whose agreement it is. The print rules matter more than they look:
`.agreement-doc` caps at 28rem with `overflow-y:auto` on screen, which prints exactly one screenful
and silently loses the rest.

**The agreement had to say all of this, and now does** (`TEACHER_VERSION` 2026-08-30). The previous
wording said the work is used without saying it is *every class from creation* — a teacher could
reasonably have expected the opt-in step the product had until 2026-08-30 — and it never mentioned
the withdrawal control at all. **An agreement silent about a right the person actually holds is worse
than one silent about a restriction**: they may simply never use it. Auto-enrolment without the
matching disclosure is the version of this feature that would have been indefensible.

**The store is never modified.** Turns are an append-only integrity record and redaction happens on
the copy — the artifact an analysis was computed from has to stay exactly what it was.

**A fixture guard.** The script refuses to run against `cta-pilot-dev` without `--allow-demo`,
because that project holds authored demo transcripts and putting them into the measurement corpus is
the one thing `tau-dimensions.md` forbids. Once anonymised they would be indistinguishable from real
work.

---

## Open

1. **No redaction path.** If a student writes their own name in prose, nobody — teacher, admin or us
   — can take it out, because turns are append-only. The clean answer is a redaction *record* rather
   than a mutation: the turn stays in the chain, its content is masked for display and export, and
   the redaction itself is auditable. A design decision, not a quick fix.
2. **Three unbuilt masking layers** (coach prompt, `.docx` header strip, input warning) — see the
   table above. The first two are small and self-contained.
3. **No migration from named to code identity.** Create-time only. A school arriving mid-year already
   using email addresses is a separate job.
4. **The Pilot Agreement has not been reviewed by counsel**, and it carries four placeholders that
   are choices rather than drafting: retention period, liability limitation, support and privacy
   addresses, governing law. It also promises deletion on request within 30 days, which
   `legal.md` notes there is no built path for — `col().delete()` exists, an account- or class-level
   deletion path does not.
5. **Parental consent is not captured anywhere.** The `codeRoster` grant records that we were *told*
   these are minors; nothing records anyone asserting that parental consent was collected. Whether
   that belongs in the product or in the signed agreement is a policy call.

---

## Session log

**2026-08-29 — built.** Grant, both identity types, username scheme and teacher handle, access codes
as passwords, themed label generation, the roster surface (view/add tabs, per-student and bulk code
reissue, printable code slips and username reminder sheets), `pii.js`, and the export script.
Login, `/api/me`, the account chip and the admin surfaces were made null-email-safe throughout — note
that `login()` scanning `u.email.toLowerCase()` without a guard throws on the *first* email-less
document it reaches, which would have broken sign-in for every account in the store, not just the new
ones.

**2026-08-29 — the Pilot Agreement, closing the consent chain.** The ask was "present our DPA to
teachers"; the DPA is the wrong instrument for a teacher and the right one for their school, so what
was built is a teacher-acceptable agreement that *routes* to the DPA rather than substituting for it
("if your school wants a signed agreement, ask us"). `terms.js` went from one document to a
role-keyed pair with independent versions, plus `needsToAccept()`. Two surfaces, and only one of them
is new:

- **The invite path needed no new screen.** `set-password.html` already had the checkbox, the
  document dialog and the version footer, hidden purely on `termsVersion === null` — so returning a
  teacher document from `termsFor()` lit the whole path up. The only markup change was emptying the
  hardcoded "Terms of Use" and its blurb so both come from the server: which document an account
  agrees to is the server's decision, and a wrong name on a consent is worse than a late one.
- **`agreement.html` is new** — the gate for accounts that already exist and never pass through
  set-up again. A full page, not a dismissible banner, because it is a required decision. The
  document renders inline rather than behind a dialog: on the set-up form the document is a reference
  and the password is the job, here the document *is* the job. It carries a Sign out link, because a
  required agreement with no alternative to accepting is a dark pattern.

**2026-08-30 — `codeRoster` became "Pilot user", and consent moved to class creation.** The grant was
two things a platform admin had to remember to tick together; it is now one named arrangement, and
`canContributeImprovement()` derives the answer from either flag rather than a third stored field
that could disagree with them. The substantive change is *when* a class is stamped: at creation, so
`grantedAt === createdAt` and the forward-only export can never silently lose a term's first
sessions. Verified end to end — auto-stamp on create, a grant edit stamping only the unstamped
classes and leaving an earlier date alone, and a resume after withdrawal minting a later date so the
withdrawn window stays excluded. Audit lines read *granted Pilot user* / *revoked Pilot user*.

**Seeded accounts are stamped, not exempted** (`seed.js`, `upsertUser`). A fixture never passes
through the set-up form, so without the stamp every demo login hit the gate before reaching the
surface it exists to demonstrate. The gate itself stays the one production runs.

**2026-08-30 — the named path closed.** A Pilot user could still add students by name and email,
which contradicted the agreement they had just accepted. `POST /api/classes/:id/students` now returns
403 on the email path for them (both creating a new account and adding an existing one), the
Named/Anonymous toggle was removed from both Add students doors, and `applyRosterMode()` became the
sole writer of that state so no path can leave a pilot account showing a paste box. The admin teacher
row gained a `namedStudentCount` chip so pre-existing exposure is visible rather than assumed away —
it reads 8 on the demo store, all of them seeded fixtures that predate the grant. See *The grant* for
why this reverses the earlier decision and what it costs.
