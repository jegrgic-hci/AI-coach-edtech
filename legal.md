# Legal — student data, FERPA posture, and the paths forward

**Scope of this file.** How student data may lawfully reach us, what we may do with it once it has,
and what has to be built or signed before each of those things is true. Owns the **regime rule** that
decides which set of obligations applies to an account, the three adoption motions, the retention and
deletion model, and the line between service refinement and research.

**Not in this file.** Security implementation detail lives in `app/README.md` and `app/gcp-setup.md`.
What the dimensions measure stays in `tau-dimensions.md`. The instruments themselves are
`legal/dpa-template.md` (institutional) and `legal/student-terms.md` (student-facing) — this file is
the reasoning, those are the documents.

**Status (2026-08-21): nothing here is signed, reviewed, or built.** A first pass worked through with
Claude, written down so the decisions are visible and an attorney can be briefed cheaply. **Not legal
advice.** Nothing in `legal/` goes to a school or a student before an education-privacy attorney has
reviewed it. **The first pilot is postsecondary** — a university professor, students holding their own
FERPA rights — which is the least constrained of the three motions below. The K-12 motions are
sketched here but are not what we are launching.

---

## The settled understanding

**Our exposure is contractual and state-law, not FERPA-direct.** FERPA has no private right of action
(*Gonzaga v. Doe*, 2002); its enforcement is the Department of Education withdrawing funding from the
*institution*. The realistic failure modes, in order: breach of an agreement we signed, enforcement
under a state student-privacy statute that regulates vendors directly (NY Ed Law § 2-d is sharpest,
then Illinois SOPPA, California SOPIPA), and reputational damage that ends pilots. **What protects us
is the paperwork we sign and honour, and disclosing up front what we intend to do.**

**We operate under the school official exception**, 34 C.F.R. § 99.31(a)(1)(i)(B) — a contractor doing
work the institution would otherwise do with its own staff, under its direct control. Service delivery
needs no student or parent consent under this exception, and it carries no deletion duty.

**Rights transfer on postsecondary enrolment or age 18, whichever comes first** (§ 99.3, § 99.5(a)).
A student past that line is an *eligible student* who holds their own rights: they can accept terms,
and they can consent for themselves. **Age alone is the wrong test in both directions** — a
seventeen-year-old early-admit university student is an eligible student, and an eighteen-year-old
high-school senior still sits inside a district agreement.

**"Delete everything after use, per FERPA" is not a thing.** The express destruction duty sits in the
*studies* exception, § 99.31(a)(6)(ii)(B), a different exception for a different purpose. Our deletion
promise is therefore a **contract term with named triggers and a signed certificate**
(`legal/dpa-template.md` § 7), not a FERPA recital. A district's counsel will check the citation.

**Blanket delete-after-use would also break the product.** Cross-draft and cross-assignment trend
readings need last term's data to exist. Retention is per-category (Schedule D), not global. **If we
ever promise same-term deletion, the trend features must be scoped inside a term** — a product
constraint, not a legal one.

**A student can accept terms; a student cannot accept a DPA.** The DPA binds us and the *institution*
about institutional obligations. A student is not a party to it. Even an adult student accepting terms
of use leaves the institutional agreement still needed.

**Consent to research cannot ride inside terms of use.** § 99.30 requires consent to specify which
records, for what purpose, and to whom — signed and dated, electronic signature permitted under
§ 99.30(d). "We may use your data to improve our services" fails that, and every ethics board rejects
bundled consent on principle. Research consent is separate, specific, opt-in, and revocable.

**De-identification is not a reliable escape hatch for us.** De-identified data falls outside FERPA
(§ 99.31(b)(1)), but the standard is that a reasonable person in the school community couldn't
identify the student with reasonable certainty. Free-text transcripts fail four ways: students name
themselves and their school in prose; personal-narrative topics *are* identifiers with nothing to
strip; class-and-assignment cells are tiny; and writing style identifies — **we ship a
`stylistic-inconsistency` detector, which is a working demonstration that our own transcripts carry
identity independent of any name in them.** Keeping a re-identification key generally collapses the
claim regardless (cf. § 99.31(b)(2)).

---

## Service refinement is not research — but the line is the output, not the label

**Using student work to check and improve how accurately the tool reads it is ordinary maintenance of
the service**, carried out by our own staff, producing changes to the Service rather than findings
about any student. SOPIPA expressly permits use to "maintain, develop, support, improve" the service
(Cal. Bus. & Prof. Code § 22584(e)). This sits **inside** the authorised purpose of the institutional
agreement — `legal/dpa-template.md` § 3.2 — and needs no separate instrument.

**What decides the treatment is the intended output, not what we call it.** The Common Rule defines
research as a systematic investigation designed to contribute to **generalisable knowledge**
(45 C.F.R. § 46.102(l)); internal quality assurance that isn't meant to generalise is explicitly not
research.

| Intended output | Treatment |
|---|---|
| "The tool reads this cohort's work correctly" | Service refinement. Inside the DPA. No extra instrument. |
| "The TAU dimensions are a valid measure of critical thinking" | Generalisable knowledge. Research, whatever we call it. |

**The trap is `tau-dimensions.md`'s concern with validity evidence.** Construct validity is inherently
a general claim about the instrument, not a claim about one class. **The moment that evidence appears
in a paper, a talk, or a marketing line like "validated instrument," it is research — and the
determination has to have been made before collection.** Consent cannot be obtained retroactively.

**So: get an ethical-review *determination*, not approval.** A short form; the answer we want is a
letter finding this is not human-subjects research. It costs almost nothing and is a shield if someone
later argues review was required. If the board comes back saying it *is* research, we learn that
before collecting rather than after — the only time that is useful.

**Note also:** usage telemetry and student writing are not the same category, and presenting them as
equivalent reads as flattening a sensitive category into a benign one. Click counts are operational
data about the product; an essay is an education record and the student's copyright. Say the specific
thing (`legal/student-terms.md` § 4), not "we may use your data to improve our tool."

---

## The regime rule

**One explicit setting, chosen by a named adult at onboarding, decides which regime an account runs
under.** Never inferred from a data field.

> At setup, a teacher or admin selects **postsecondary** or **K-12** and ticks an attestation. We store
> their name, the timestamp, and the **version of the exact text** they agreed to.

| | **Postsecondary** | **K-12** |
|---|---|---|
| Students are | Eligible students, holding their own rights | Minors, regardless of any individual's actual age |
| Student PII we take | Name and institutional email | **None — pseudonymous only** |
| Who accepts terms | The student, at first login | Nobody; the district signs |
| Research consent | Separate opt-in screen, revocable | Not available |

**Why not infer it from whether a student was added by email.** Email correlates with *institution
type*, not age — every K-12 district on Google Workspace issues addresses to nine-year-olds. An
assumption is also not a defence: a minor's rights belonged to their parent whatever our system
assumed, and arranging not to know is not a shield. An inference from a field has no accountable
person behind it and produces no record; **an attestation names someone and stores what they agreed
to.**

**Where it lives in the code.** There is no schools collection yet —
[`school.js:12`](app/server/school.js#L12) says so — so for the pilot the flag hangs on the teacher's
user record and gates the roster path at [`index.js:1870`](app/server/index.js#L1870): postsecondary
accepts `email` and `displayName`, K-12 refuses both. **Version the attestation text** so we can prove
which wording someone agreed to.

---

## Path 1 — Postsecondary (the pilot, and the current priority)

The professor's institution still signs an agreement — lighter than a K-12 DPA, but covering security,
liability, and IP. The student accepts terms for themselves.

**Build:**

1. **Three separate consent surfaces at first login, not one** — terms of use (click-through),
   privacy notice (acknowledgement), and, if we ever need it, research participation (separate screen,
   explicit opt-in, revocable).
2. **Research consent must be invisible to the instructor until grades are final.** A professor
   recruiting their own enrolled students is a power-imbalance problem every ethics board scrutinises;
   the standard condition is that participation cannot affect grades and the instructor cannot know
   who opted in. **The teacher scope has no notion of this today** — it needs a stored field and a
   visibility rule.
3. **Copyright licence in the terms.** Students own their essays. `legal/student-terms.md` § 3 grants a
   narrow, purpose-bounded licence that ends on deletion. Awkward to add later.

**Sign:** institutional agreement; ethical-review determination letter.

## Path 2 — K-12 district-signed (the sales motion)

1. **Get `legal/dpa-template.md` reviewed** by an education-privacy attorney. Fixed fee, bounded scope:
   review the DPA, name the state riders our target districts need.
2. **Fix the four things the draft overstates** — see its *Drafting notes*: Vertex routing vs the
   US-only clause, aspirational security controls, cyber insurance, backup window. A lawyer cannot
   verify these; we can, and must.
3. **Prefer the district's own template** when offered. Their counsel has already approved it; ours
   just checks we can honestly comply.
4. **Fix the liability cap.** An indemnity swallowed by a twelve-months-fees cap is decorative. Carve
   the data-breach indemnity out, or accept a super-cap. District counsel look here specifically.

## Path 3 — K-12 single teacher (distribution)

Requires build work. Not safe to launch as the app currently stands, because a teacher cannot
authorise district-level things and under NY 2-d a vendor receiving student data with no agreement
with the *educational agency* is itself the violation.

1. **Pseudonymous student tier.** Class join code plus teacher-issued passcode; no email anywhere. The
   teacher holds the "Student 07 is Maya" mapping in their own gradebook. Touches
   [`index.js:1870`](app/server/index.js#L1870), [`auth.js`](app/server/auth.js), and the invite flow —
   a real seam change, not a flag.
2. **Reduce free-text leakage.** System-prompt the AI never to ask for or use a name; a line in the
   student UI; a scrubbing pass over stored turns. **Build for pseudonymity, never advertise
   anonymity** — claiming "we hold no identifiable data" over a transcript full of first names is worse
   than not claiming it.
3. **Cap the tier**: one class, auto-delete at term end.
4. **Gate the escalation**: at the paid tier, or the third teacher from one school, require a district
   agreement. This is a sales asset — it is how we get introduced to the person who signs.

**The realistic failure mode here is not a lawsuit.** It is a district privacy officer finding thirty
teachers pushing student emails into an unvetted vendor and banning us domain-wide — losing the school
we were about to sell to.

---

## Controls that apply whichever path

- **Keep the corpora separated from the start.** Retrofitting a boundary after mixing service data
  across regimes is genuinely painful.
- **Minimise.** Only the fields and cohorts actually needed. Never mirror the database.
- **Named individuals, under confidentiality agreements, access logged and revoked.** When an
  institution asks who read their students' writing, we need a list.
- **Delete on the stated date**, including from backups, and be able to certify it.
- **Never a transcript excerpt from an identifiable student** in anything published, however
  anonymised it looks. Minimum cell sizes on aggregates.

---

## Open questions

- **Vertex region.** [`school.js:72`](app/server/school.js#L72) defaults to the `global` endpoint,
  which Google may route outside the US. Pin a US region, or narrow the data-location clause and
  disclose routing honestly. **Blocks DPA § 10.2.**
- **Vertex terms for our tier** — retention window and training prohibition, verified rather than
  assumed. If inputs can be retained or trained on, every promise in both documents is hollow.
  **Blocks DPA § 3.4 and student-terms § 4.**
- **Backup policy.** There isn't one, so the `[35]` days in DPA § 7.5 and Schedule D matches nothing.
- **Retention periods** in Schedule D and student-terms § 6 are placeholders. Choosing them is a
  product decision about how far back trends should reach.
- **Does deletion actually delete?** `col().delete()` exists
  ([`store.js:212`](app/server/store.js#L212)) but there is no account- or class-level deletion path
  and no certificate mechanism.
- **Liability limitation in student-terms § 8** — may be unenforceable against a consumer in some
  states, and must square with the institutional agreement.
- **Attorney not yet engaged.** Two quotes, fixed fee, education-privacy specialist — not a general
  commercial lawyer.
- **Ethical-review determination not yet requested** from the pilot institution.

---

## What to hand the attorney

Starting from a blank page they bill for hours of asking what the system stores. Starting from these
documents they are reviewing rather than investigating.

- `legal/dpa-template.md` — schedules built from the real collections, subprocessors, and security
  controls, with *Drafting notes* marking where it overstates what we do
- `legal/student-terms.md` — the postsecondary student-facing version
- This file — the regime rule, the three motions, and the refinement/research line
- A plain-English brief: what the tool does, what data it touches, what we want to be allowed to do

---

## Decision log

**2026-08-21 — first pass.** Worked through the FERPA posture from scratch. Settled: school official
exception for service delivery; deletion as a contract term rather than a FERPA recital; no
student-facing consent for minors; no reliance on de-identification. Produced
`legal/dpa-template.md`.

**2026-08-21 — postsecondary pilot, and the refinement/research line.** The first pilot is a
university professor with eligible students, which unlocks student-accepted terms and makes Path 1 the
priority. Settled that **checking and improving how accurately the tool reads student work is service
refinement, inside the authorised purpose** — not research — and that the line is drawn by intended
output, not by label. Restructured DPA § 3 accordingly: new § 3.2 permits service refinement
affirmatively, § 3.3 narrows the prohibitions to model training, marketing, and generalisable
research, and new § 3.6 carries the research machinery. **The earlier draft's § 3.2(e) prohibited
exactly what we intend to do** and would have blocked it. Produced `legal/student-terms.md`.

**2026-08-21 — the regime rule.** Rejected inferring adulthood from whether a student was added by
email: email tracks institution type rather than age, an assumption is not a defence, and an inference
has no accountable person behind it. Replaced with an explicit postsecondary/K-12 selection plus a
stored, versioned attestation at onboarding. **Not built.**
