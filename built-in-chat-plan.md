# Built-In Chat — Path B Plan & Tracking Doc

Living document for the shift from single-file paste-in analysis to Path B: built-in AI chat + accounts + server backend. Problem-space design settled 2026-07-16; this doc is the source of truth for build sessions.

**Preservation guarantee:** the existing single-file tool (`index.html`, `teacher-dashboard.html`, current docs) is not modified by Path B work. Path B develops in new files; the paste-in CTA remains the working fallback. Pre-Path-B state committed as `1b1c36c`.

---

## Guiding Principle

**The tool is not foolproof and the scoring is not meant to be 100% accurate. Its purpose is to help students develop agency and critical thinking while using generative AI. Cheating is not prevented — it is made more work than honesty. We accept that.**

What this buys the design:
- **Goodhart works for us** — faking critical-thinking behaviors (challenge, refinement) ≈ practicing them; gaming the metric converges on developing the skill
- **Precision pressure drops** — directionally-right + legible beats forensically exact; cheap models suffice
- **Integrity flags are conversation-starters, never verdicts** — dashboard language says so
- **Positioning:** AI literacy as curriculum, in the lineage of library-skills and computer literacy — not integrity policing. Generative AI is a medium shift like the computer (2000s) and the library before it; requiring engagement is a legitimate literacy expectation ("cite three sources," 2026 edition)

**Scope boundary:** the teacher assesses the product (essay, their rubric — untouched by the tool). The tool assesses the process (AI use). The tool never grades essays.

---

## Architecture Decisions

| Decision | Rationale |
|---|---|
| **Vertex AI** (not free AI Studio key) | School DPA compliance; no training on student data (minors' PII) |
| **Vertex key server-side only** (Cloud Run) | Shared school key cannot live client-side |
| **Firestore for all data** | Single compliance boundary (one Google DPA covers Vertex + Cloud Run + Firestore); auth-integrated security rules make permissions nearly free to build; scale-to-zero billing; document shape fits (append-only turns, blobs). Postgres revisit point: district-scale reporting |
| **Google SSO, domain-restricted** (Firebase Auth) | No passwords for minors (COPPA/FERPA); free tier |
| **Cloud Run scale-to-zero** | $0 idle; no `min-instances` (cold starts acceptable at pilot scale) |
| **Every turn persisted server-side as sent** | Eliminates loss/truncation/copy-paste failures at the root; integrity record |
| **One Firestore database per school** (2026-08-05) | Isolation is structural, not disciplinary. A missing `where schoolId` returns *another school's students* — silent and plausible-looking; a wrong database name returns nothing. We already shipped that bug class once (`teacherScope()`, 2026-08-04). Also makes per-school export and deletion single operations, which is what the DPA's return-or-destroy clause will require |
| **School resolved from email domain, never client-asserted** (2026-08-05) | Same principle as server-derived roles: identity and tenancy are both derived from the verified Google ID token, so neither can be spoofed |
| **`platform-admin` cannot read into any school** (2026-08-05) | Extends the existing "admin is not a super-teacher" rule one level up. No impersonation, deliberately — onboarding failures are configuration failures, visible in the registry without ever opening a school's database. The absolute guarantee is worth more in procurement than it costs in support |

**Two external gates (district IT, pursue in parallel with build):**
1. Is Vertex AI enabled in a GCP project (not just the Gemini Workspace app)?
2. Will they sign a DPA covering the Cloud Run + Firestore + Vertex flow?

---

## Multi-School Architecture (settled 2026-08-05)

The tool serves more than one school from one running instance. Everything school-specific is
resolved configuration, never a constant — which is also what keeps the three deployment models
below a config value rather than a code branch.

### Deployment models

| Model | Data at rest | Inference | Operated by | Status |
|---|---|---|---|---|
| **1 — SaaS** | Our Firestore | Our Vertex | Us | **Default** |
| **2 — BYO-inference** | Our Firestore | *School's* Vertex project | Us | Supported; a config value per school |
| **3 — In-district** | School's Firestore | School's Vertex | School IT | Code stays capable of it; not offered |

Model 2 exists because the fear being sold against is not "where is the database" — it is *"is an AI
company reading my students' work."* Pointing inference at the district's own Vertex project answers
that precisely: prompts cross into Google under **their** DPA, billing lands in **their** console,
and we still operate and support the app. Most of model 3's political value at almost none of its
operational cost. Model 2 requires one IAM grant on their side (`roles/aiplatform.user` for our
service account) — which is a selling point, since it lets them see and cap our usage themselves.

Model 3 is deliberately not offered. It costs the most and almost no K-12 district wants to run
infrastructure. Its real price is invisible until it bites: **no access to the data the product
improves on** — no transcripts to tune classification prompts against, no visibility into failed
analyses, `admin.html` telemetry dark for that district. Backlog #9 was only findable because we
could read real transcripts. If a district ever insists, the contractual answer is a carve-out for
anonymised aggregate telemetry, designed while the `usage` write path is being built.

### Who configures what — policy vs plumbing (settled 2026-08-05)

A school admin configures **policy**, never **plumbing**. Two independent reasons, both hard:

- **Liability does not transfer through a UI.** Under FERPA the school is the controller and we are a
  vendor acting under their direction; that is created by a signed contract between organizations, not
  by an admin ticking a confirmation box. The danger is not that the checkbox fails to protect us — it
  is that it makes us *think* we are protected, so we build differently and find out late.
- **Config that routes data is a security boundary.** If a school admin can change the Vertex project,
  a compromised school-admin account redirects every student prompt to an attacker's GCP project. If
  they can add a domain, they can add `gmail.com`. These are exfiltration channels wearing dropdowns.

| Platform admin sets (at provisioning, under contract) | School admin sets (self-serve, genuinely theirs) |
|---|---|
| Vertex project / deployment model | Which teachers exist |
| Email domains | Default coaching fade pattern |
| Firestore database | **Whether integrity flags are surfaced at all** |
| Maximum retention window | Retention *within* the contracted maximum |
| | Whether students see their own reports; term boundaries |

The rule of thumb: **give them every switch that reduces what the tool does or retains** — flags off,
shorter retention, reports hidden. Those can only fail safe. Some districts hold that anything
resembling cheating detection does not belong in a classroom tool; that is a real policy call and it is
theirs.

Real shared responsibility comes from three mechanisms, none of them a settings page: the **signed
DPA**, **model 2's IAM grant** (they grant, see, cap, audit, and revoke our access in their own
console), and a **counter-signed verification gate** stored against the school — "we both checked,"
not "you agreed so it's on you."

Note the pitch inverts favourably: *"compliance is configured by us, under the agreement we signed with
you"* is what a district wants to hear. They are not seeking configuration authority; they are seeking
assurance that someone competent already handled it.

### Building for 1 and 2 while staying capable of 3 (settled 2026-08-05)

**Build the app as if it will run somewhere we cannot see.** Models 1 and 2 are then the case where
"somewhere" happens to be our project. Six rules, each free-if-early and expensive-to-impossible if
retrofitted:

1. **Config from environment only; nothing school-specific in the image.** `resolveSchool()` returns
   the same shape whether it read a multi-school registry or a single env-provided config, so a
   single-tenant deploy is a different variable, not a different code path.
2. **Never log student content.** Turn text and essay text must not reach logs — log IDs, error codes,
   token counts, latencies. This is what makes `roles/logging.viewer` safe to accept in someone else's
   project, and therefore what makes model 3 debuggable at all. **Concrete instance already in the
   code:** `llm.js` throws `` `Groq ${res.status}: ${body.slice(0, 300)}` `` — provider error bodies
   routinely echo the offending request, so that line can put prompt content into a log. Carry the
   status and an error code, not the body. Also correct for models 1 and 2: a support engineer reading
   production logs should not be reading a fifteen-year-old's essay.
3. **No call-home dependency.** The container boots and runs on its own config, its own database, and a
   Vertex endpoint — nothing else. No licence check, no remotely-fetched prompt templates, no runtime
   feature flags. Prompts stay in `coach.js` / `analysis.js` in the image. This is the easiest rule to
   break by accident and the one that forecloses model 3 by construction.
4. **Schema versioning.** A `_meta` doc per database carries a schema version; the app migrates forward
   on boot and **refuses to start against a version newer than the code**. Forward-only and idempotent
   (the seed already is). Without this, schools drift and nothing can tell what is running.
5. **One image, many deployments.** Byte-identical regardless of where it runs. No build-time config,
   no per-customer builds.
6. **Telemetry pushes out, never pulls in.** The `usage` aggregate push is fire-and-forget,
   failure-tolerant, and disableable; with it off the app behaves identically. Content never leaves.

**Provision our own infrastructure with Terraform from day one.** If we click through Cloud Run and
Firestore setup by hand we have no artifact to hand a district; if it is Terraform, the model-3 bundle
*is* that same Terraform with different variables. This is the one that is free only if done first.

If model 3 is ever sold, the deploy shape is **customer-owned project, vendor-operated deploy**: they
grant our CI `roles/run.admin` in their project — and deliberately **no Firestore data role** — so we
can ship code and genuinely cannot read a transcript. The same policy/plumbing line as above, drawn in
IAM instead of a settings page, and enforced by Google rather than by our good intentions. They revoke
it unilaterally, in their own console.

### The identity chain

A person never asserts who they are or which school they belong to. Both are derived, in order:

```
Google ID token  →  verified email
      ↓
email domain     →  school                (reject if no match)
      ↓
school           →  Firestore database    (cannot physically reach another)
      ↓
user doc         →  role                  (never from the client)
      ↓
role + ownership →  visible data          (teacherScope(), unchanged)
```

Five independent gates; a failure in one does not cascade. This is the sequence to hand district IT.

### The schools registry — the only global collection

Read *before* the school is known, so it lives outside every school's database. Carries no student
data:

```
schools  { id, name,
           domains: ['riverside.k12.us', 'stu.riverside.k12.us'],
           firestoreDb, gcpProject, location,
           status: 'draft' | 'active' | 'suspended' | 'closed',
           createdAt }
```

`domains` is a list because districts routinely split staff and student domains — a missed domain
locks out everyone on it, and it is the most common day-one failure.

### Roles

The current `admin` conflates two different people and must split:

| Role | Scope | Can see |
|---|---|---|
| `student` | Own work | Their reports; never flags |
| `teacher` | Own classes, within their school | Their students, transcripts, flags |
| `school-admin` | One school | Teacher accounts, aggregate metrics — **no student names, transcripts, or flags** |
| `platform-admin` | Us | Schools registry, cross-school aggregates — **no route into any school's data** |

`school-admin` is today's `admin` with a school attached. `platform-admin` is new and is *not* a
super-school-admin, for the same reason `admin` is not a super-teacher.

### School lifecycle

| State | Sign-in | Data | Use |
|---|---|---|---|
| `draft` | Blocked | None | Configured during procurement, pre-DPA |
| `active` | Open | Live | Normal |
| `suspended` | Blocked | Retained | Non-payment, incident, summer |
| `closed` | Blocked | Export + deletion pending | Contract ended |

`suspended` vs `closed` is the load-bearing distinction — one is reversible and keeps the data, the
other starts a deletion clock. Conflating them means either deleting a district's records or
retaining them past contract.

---

## School Onboarding (settled 2026-08-05)

Two separate onboardings. Only the first is new — levels 2–4 are already built and need school-scoping.

| Who | Creates | Surface |
|---|---|---|
| **Platform admin (us)** | Schools, each school's first admin | A script (`provision-school.js`), not a UI |
| **School admin** | Teachers | `admin.html`, school-scoped |
| **Teacher** | Classes, students (by email), assignments | `teacher.html` |
| **Student** | Nothing — signs in and works | — |

Each level creates only the level below. Nobody promotes themselves; role is always assigned.

**Students are added by teachers, by email** — not auto-provisioned on domain match. It matches the
existing class model (a class holds a student list), keeps the population to the pilot cohort rather
than every student in the district, and 24 emails typed once is nothing. A teacher-entered email
creates a placeholder; first sign-in with that address links it and lands the student in the class.

**Script, not UI, for the first several schools.** The flow will change shape within three schools,
and a self-serve surface built now is built against guesses. The `platform-admin` surface needs
exactly two things for the pilot: list schools, and cross-school aggregate health.

### Intake — collected before anything is provisioned

| Field | Blocks | Gotcha |
|---|---|---|
| Email domains (all of them) | SSO restriction + school resolution | Staff/student split is common; a missed domain locks out everyone on it |
| Deployment model (1 or 2) | `gcpProject` | Model 2 needs their project ID + IAM grant |
| First school-admin (name, email) | Nobody can create teachers without one | Must be on a declared domain |
| Workspace SSO status | Whether sign-in works at all | Many districts block third-party OAuth by default — five minutes on their side, but the most common launch-day failure |
| Retention + deletion terms | Offboarding | Whatever the DPA says has to be technically true |

### Provisioning sequence

```
DPA signed ─────────────────────┐
                                ↓
  create school record  →  create Firestore database
                                ↓
  register domains in Firebase Auth (SSO restriction)
                                ↓
  [model 2 only] district grants our service account
                 roles/aiplatform.user in their project
                                ↓
  create first school-admin  →  invite
                                ↓
                        VERIFICATION GATE
                                ↓
                    school self-serves from here
```

A school may sit in `draft` before the DPA is signed — configuration is not student data. That is what
allows demo and setup *during* procurement instead of after it.

### Verification gate — run before any student signs in

Also the artifact handed to district IT:

- [ ] Sign-in succeeds from **each** declared domain
- [ ] Sign-in from a non-declared domain is rejected
- [ ] A teacher in this school cannot load another school's roster (isolation proof, run explicitly)
- [ ] One full cycle: chat → submit → analysis → report renders with scores
- [ ] Integrity flags absent from the student payload, present for the teacher
- [ ] Per-student token budget and rate limit live
- [ ] Billing alert configured (model 2: pointed at *their* console)

The token budget is therefore an onboarding gate, not deferrable hardening.

### Offboarding — designed now, not at contract end

Per-database isolation makes it cheap: **export = dump one database; delete = drop one database**,
with no risk of catching another school's records. Two decisions still open: the export format
(teachers will want readable reports and transcripts, not raw JSON) and how long `closed` sits before
deletion actually runs.

### The non-technical half

Onboarding steps with owners and dates, not documentation that exists somewhere. Backlog #6 (teacher
enablement), #5 (practice assignment — ungraded, burns off tool novelty, protects the baseline), and
#7 (flag misfire disclosure) are all onboarding deliverables. A teacher's first encounter with
`unnatural-fluency` on an ELL student's draft will define their trust in the entire instrument.

---

## Cost Model (pilot: 14 students, 1 semester, 5 assignments, ~5 submissions each)

| Line item | Cost |
|---|---|
| Chat (Gemini Flash-Lite, ~$0.03/assignment-instance) | ~$2 |
| Analysis (Gemini Flash, ~$0.02/submission × 350) | ~$6 |
| Embeddings | ~$0.10 |
| Cloud Run / Firestore / Firebase Auth / Hosting | $0 (free tiers) |
| **Semester total** | **~$10–30** |

**Budget ceiling to quote: $30–50** (2× headroom over worst case). Per student: ~$1–3/semester at next-gen model prices.

**Re-baselined 2026-08-05 against live Vertex pricing** (the table above assumed ~$0.10/$0.40 per
MTok; current Gemini 3.1 Flash-Lite is $0.25/$1.50, 3.5 Flash $1.50/$9.00). Bottom-up from the real
call sites — chat resends full history per turn (~78% of all input tokens), plus 3 analysis calls and
~1.5 auditor calls per draft — a **24-student, 4-assignment, 3-draft semester is ~56K input / 7.6K
output tokens per draft, 288 drafts, ≈16M input / 2.2M output total**:

| Setup | Semester |
|---|---|
| All on 3.1 Flash-Lite | ~$7 |
| Chat on Flash-Lite, analysis on 3.5 Flash | ~$18 |
| Same, analysis submitted to the Batch tier (50% off) | **~$11 — recommended** |
| All on 3.5 Flash | ~$44 |

Analysis is already async post-submit, so the Batch tier is nearly free money. Infrastructure stays
~$0 (288 cycles ≈ 8K turn writes across a whole semester against a 20K writes/**day** free
allowance), though Vertex requires Blaze billing. **The "under $50 per classroom per semester" claim
in the stakeholder summary survives at nearly double the class size it was written for** — but only
with `thinkingBudget` capped: Gemini 3.x models think by default and thinking bills as output, which
turns a $15 semester into ~$120. That guardrail is the single highest-leverage line in the migration.

**Guardrails (build these into v1, not later):**
- `thinkingBudget: 0` for chat; capped for analysis (thinking tokens bill as output — the classic 8× surprise)
- `maxOutputTokens` ~500 on chat
- Per-student daily token budget enforced in Cloud Run — the real spending cap
- Every request requires a valid domain-restricted Firebase Auth token *before* touching Vertex
- Budget alerts at $10/$25/$50 (GCP has no hard cap)
- Rate limiting per user (catches bugs, loops, scripted abuse)
- Teacher dashboard uses one-shot reads, not realtime listeners

Cost note: unlimited conversations *reduce* cost — context is resent per turn, so input tokens grow ~quadratically with conversation length; several focused chats < one monolith. Gemini implicit caching cuts real input costs further (not counted above).

**How much that quadratic actually bites (2026-08-05):** the same 40 coach replies in a day cost
**352K tokens (~11¢) as one conversation, 106K (~4¢) as four, 65K (~3¢) as eight** — a 5.4× swing on
conversation shape alone. Message 1 costs ~460 input tokens; message 40 costs ~16,400, because it pays
to re-read messages 1–39. This is not a marginal effect and it drives the cap design below.

### Usage caps — two tiers (settled 2026-08-05)

The cap is **not a cost control** at pilot scale. The most extravagant plausible student day costs
about eleven cents; the cap exists to catch a bug, a loop, or scripted abuse, which look nothing like
40 replies — they look like 40,000. So be generous: the cost of generosity is cents, the cost of
stinginess is a student locked out of their homework at 9pm.

| Tier | Unit | Value | Purpose | Visible to |
|---|---|---|---|---|
| **Soft** | Coach replies/day | ~40 | Comprehensible, fair, warns and stops cleanly | Student + teacher |
| **Hard** | Input tokens/day | ~1M | Backstop for bugs and abuse only; should page us | Nobody |

**Replies, not tokens, for the student-facing limit.** A token cap gives two identically-behaved
students wildly different allowances — one working in a single long thread gets ~12 replies, one who
starts fresh per topic gets 40+. Unfair, unexplainable, and it penalises exactly the student most
immersed in one line of thinking. Tokens still bound the hard tier, which is where the leeway goes:
3× above the worst realistic case, so a real student never reaches it and anything that does is broken.

Four behavioural rules, which matter more than the numbers:

1. **Check at the turn boundary, never mid-stream.** Refuse to *start* a reply without budget for a
   whole one. A conversation that ends cleanly reads completely differently from one that dies
   mid-sentence.
2. **Warn at ~80%** — "about 8 messages left today." Nobody meets a limit they couldn't see coming.
3. **Submitting a draft is never blocked.** Analysis budget is reserved separately from chat budget.
   A student who chatted a lot and then cannot submit — or submits and gets no report — is the one
   failure that would actually damage trust in the tool.
4. **Teachers can grant more**, one button on the student's row. The escape valve is what lets the
   limit be set sensibly rather than defensively.

### Cost measurement (Phase D deliverable, settled 2026-08-05)

One row per LLM call, in its own collection — same reasoning that keeps `usage` out of `events`.
`usage` answers "which parts of the tool get opened"; this answers "what did that cost."

```
llmCalls  { id, ts, schoolId, studentId, assignmentId, submissionId,
            purpose: 'chat' | 'auditor' | 'classify' | 'provenance' | 'snapshot',
            model, inputTokens, cachedInputTokens, outputTokens, thinkingTokens,
            latencyMs }
```

`purpose` is what makes it useful — it says whether chat or analysis drives cost, which is the lever
we would actually pull. Estimate says chat is ~78% of input; real data confirms or overturns it.

**Store tokens, never dollars.** Prices change — Gemini's have moved 2.5–4× since the table above was
written. Dollar amounts make history incomparable and make "what would last semester have cost at
today's prices?" or "what if analysis moved to Batch?" unanswerable. Keep a versioned price table in
config and derive cost at read time; that turns the log into a model we can run scenarios against.

**Two sources of truth, reconciled monthly.** `llmCalls` gives *attribution* (which student, school,
purpose); GCP billing export gives *actual dollars*. Ours will run slightly under (retries, failed
calls, caching). Divergence beyond a few percent means our accounting has a hole.

**Watch the distribution, not the average.** Pricing per seat at the mean loses money on the tail. The
numbers that matter are p50 / p90 / max student, and specifically whether the heaviest student is 2×
the median or 20×. The 5.4× conversation-shape swing above suggests the tail is real.

**What this is for — and what it is not.** At ~50–75¢ per student per semester, infrastructure cost
will not set the price; a district paying even $5/student/year leaves ~90% gross margin. Pricing is
driven by value, not cost. So this system has exactly three jobs: **catch anomalies** before the bill
does, **substantiate the "under $50 per classroom" claim** with real data (a procurement asset), and
**detect when the assumption breaks** — a model price change or an unpredicted usage pattern. Build it
accurate enough for those three. It is not a billing engine.

Surfaces in the `platform-admin` view: cost per school, per-student distribution, chat-vs-analysis
split, trend. Model 2 schools need a per-school report too, since the cost lands on *their* Google bill
and they will ask what drove it.

---

## Student Flow

**No free-floating chat — sessions exist only inside assignments** (primary off-task mitigation).

1. Teacher creates assignment: prompt, due date, **draft budget** (e.g. 3 before final), per-draft due dates. The prompt is shown to the student; since 2026-08-14 it is *not* given to the chat (see *Coach: Scaffolding Fade — REMOVED*)
2. Student signs in (school Google SSO) → assignment list with status
3. Student opens assignment → chats with the AI
4. **Submission is a hard marker that ends the session.** Assignment = discrete revision cycles: Session 1 → draft 1 (locks) → offline feedback/reflection → Session 2 → draft 2 → … → final. Confirmation friction on submit ("ends your session, uses 1 of 3 drafts")
5. Essay lives in Google Docs; student pastes current draft at each submission. Submission = (all of the cycle's conversations, essay draft N) → analysis → teacher dashboard + student agency snapshot

**Conversations (mimic real generative AI):**
- ChatGPT-style sidebar; **unlimited conversations per cycle**; submission locks and bundles ALL of them (no selective evidence)
- Submitted conversations stay readable (revisit, copy quotes) but input-locked
- **Blank-context chat** — a new conversation knows nothing at all: not the assignment, not the other conversations (as of 2026-08-14 it is not even given the assignment brief). Student has full recall, the AI has none → continuity is a student act (re-read, curate, re-articulate), and briefing the AI is itself a measurable move. Protects turn-order provenance
- Save & close button for the student's sense of control; auto-persist underneath; save/resume boundaries recorded as **work episodes** (temporal signal)
- Three deliberate departures from real gen AI, all absences: no cross-chat memory, no delete (rename ok), no free-floating chat
- Deferred (cost/scope, not measurability): web search, file upload, voice, canvas/in-tool editor

**Three feedback routes for a draft:**
1. *Writing feedback* — paste draft into a conversation (free; the AI responds as any assistant would — since 2026-08-14 it will rewrite if asked, and that choice is a signal the analysis reads rather than a rule the tool enforces)
2. *Agency feedback* — **Evaluate button**: on-demand rough auditor read of the current conversation. Two voices: the AI converses; the auditor speaks only when summoned, visually distinct. Evaluate exchanges = meta-turns excluded from TAU; Evaluate *events* logged as metacognitive signal
3. *Formal review* — draft submission (spends a slot, ends session, full analysis)

**Post-submission report (REVISED 2026-07-16 — full disclosure at the draft marker):**
- Full TAU: all four dimension scores + total + SAMR level, with the divergence chart — the score is part of the learning, not a hidden teacher metric
- Plus the narrative snapshot: 2–3 observed strengths quoted from their conversation; 1–2 growth moves; bridge to the next cycle (primes the blank-session first turn)
- Still never shown to students: integrity flags (teacher-only conversation-starters)
- Timing: at the draft marker only, **never live during a session** (live meters induce performative behavior and break mimicry) — this boundary is what the original "no numbers" decision was actually protecting
- One Flash-Lite call (~1¢) for the narrative; teacher sees the same report → shared artifact

---

## Coach: Scaffolding Fade — **REMOVED 2026-08-14**

**The coach is gone. The chat is an ordinary Gen AI chat: no system prompt, no persona, no coaching level, no assignment context.** Coaching interfered too much with natural use — the thing the tool measures is how a student works with the AI they will actually meet, and a chaperoned assistant that refuses to draft is not that AI. Measuring behaviour against a modified assistant measures the modification.

What this removed, in code: the three personas and their shared "never write the essay" rules (`server/coach.js`, now only the auditor prompt + a plain history builder), `coachingLevels` on assignments (creation, edit, validation, the per-draft picker in `dashboard.html`), `coachingLevel` on sessions and analyses, the mode banner in the workspace, and the snapshot's "next cycle will be in X mode" bridge. The `coach` turn role stays as the stored value — it is the AI side of the transcript, and renaming it would rewrite history for no gain. Students now read that side as **AI**.

What survives: the **auditor** (Evaluate), unchanged and still the only prompt that sees the assignment brief; the draft budget and per-draft due dates; every event type; the whole analysis pipeline.

Measurement consequences:
- **The "TAU at level X" qualifier is gone.** Every analysis is now TAU against the same unmodified assistant, which makes drafts comparable in a way they were not before — see `tau-dimensions.md`'s known-limitation note on coaching level, which this change resolves by deletion rather than by modelling.
- The trajectory no longer reads as "does thinking hold as the scaffold withdraws" — there is no scaffold. It reads as growth against a constant, which is a weaker pedagogical story and a cleaner measurement one.
- **Open question, not yet decided:** the fade was the mechanism for building independence. Nothing replaces it. If independence is still a goal, it has to come from assignment design or the report, not from crippling the assistant.
- **We measure the ask, not just the answer** — extraction attempts against a refusing coach stay classified and visible

---

## Measurement

**Mimicry = ecological validity:** the closer the chat feels to real gen AI, the more the measured behavior generalizes to real AI use.

**Log from day one, even before scoring uses them (retrofitting is impossible):**
- UI events: copy (= observed extraction), regenerate (= implicit rejection), edit-my-message (= refinement), stop-generating
- Evaluate invocations (metacognitive self-checks — timing/frequency)
- Work episode boundaries (save/resume)
- First turn of each blank session (purest agency snapshot per cycle)
- Conversation topology (task decomposition: focused thread-per-idea vs drifting monolith; turn-efficiency vs conversation length)

**Per-cycle analysis:** each submission's TAU covers only that cycle's conversations — trajectory is a clean sequence of independent measurements. **Delta provenance:** concepts in draft N-1 count as established for draft N; trace only new material ("3 new concepts: 2 student-born, 1 AI-born unchallenged").

**Off-task mitigation layers:** structural (assignment scoping) → detection (embedding drift from assignment prompt, reuses Phase 5 embeddings, ~zero cost → dashboard flag; teachers review flagged sessions only) → framing (the log is the assessed artifact; misuse is self-documenting) → UI cue ("visible to your teacher") → backstop (daily token cap). Jailbreak attempts are logged, classified, TAU-visible low-agency turns.

**Accepted imperfections (per guiding principle):** copying AI text between conversations reads as student-introduced; cross-session provenance loses threads (session-1 idea surfacing in draft 3 reads as "prior"); external essay means provenance can't distinguish prior knowledge from shadow AI elsewhere — shadow-session flag characterizes, never proves. Voluntary draft pastes partially erode this blind spot (free timestamped essay snapshots). Standing argument for an eventual in-tool essay view — door open, not building.

---

## Teacher Side

Existing dashboard (see `teacher-dashboard-design.md`) = the triage layer ("guide first, detail on demand"). Path B adds the detail layer:

**Student conversation view** (absorbs the old doc's unbuilt "Submission detail view" + "Per-student growth view" + "Teacher mode in CTA"):
1. **Trajectory strip** — per-cycle divergence charts side by side, labeled with coaching level (growth with the fade as x-axis)
2. **Conversation-ready moments** — 2–4 quoted turns per cycle (best challenge, unchallenged AI-born concept reaching the essay, first turns), deep-linking into the transcript. "Show me what you meant here," not a score
3. **What the student was told** — their agency snapshots verbatim
4. **Delta provenance in plain language**
5. **Full transcript, teacher mode** — turn labels, episode gaps, meta-turns, flag context inline

Lean: teacher note attached to a submission, visible to the student beside their snapshot (auditor's read + human read side by side).

---

## Backlog (accepted gaps from teacher-lens review, 2026-07-16)

1. **Semester-scale measurement** — cross-assignment growth is confounded by topic/difficulty; candidate: hold draft-1 coaching level constant as a repeated comparable probe. *Needs its own design session — the claim schools most want supported*
2. **Student self-set goal + calibration gap** — "what will you try next draft?" at snapshot time; next snapshot opens against it; self-read vs auditor-read gap = prime conference material. One text box
3. **Class-level instructional view** — pattern roll-up ("9 of 14 in Validation Spiral") answering "what should I teach next week?"
4. **Intervention playbook** — side-tray next-steps for developmental patterns, not just integrity flags
5. **Practice assignment** — ungraded, unmeasured first exposure; burns off tool-novelty, protects the baseline
6. **Teacher enablement curriculum** — reading the instrument, pattern literacy, annotated exemplars, conference craft, flag literacy (incl. ELL/IEP misfire profiles), dial pedagogy, student framing. `teacher-guide.md` is the seed; pilot teacher co-authors
7. **Flag misfire disclosure** — unnatural-fluency / stylistic-inconsistency have false-positive profiles for ELL (translators) and IEP accommodations; side tray discloses per flag
8. **Build-time check** — scoring must reward sparse-but-excellent usage profiles (TAU formulas are ratio-based so quality-density should win; verify with a gifted-student sample log)
9. **`school-admin` as a role of its own** — today it is a `schoolAdmin: true` grant on a teacher, so every school administrator is also a teacher and homes to the teacher dashboard. There is no way to create a non-teaching administrator, and the *Roles* table above (which gives `school-admin` its own scope: teacher accounts and aggregate metrics, **no** student names, transcripts, or flags) is therefore unimplemented. Raised 2026-08-10 while fixing post-sign-in landing — the landing rule (`homePageFor` in `app/server/index.js`) is where the fourth role would gain its own home page
10. ~~**PQ is partly measuring vocabulary echo**~~ — **closed 2026-08-05.** The lexical `isResponsiveToAI()` test is gone; the classifier now receives the preceding coach turn and judges responsiveness by meaning, so paraphrase no longer scores below parroting. Fixing it exposed a larger validity problem: responsiveness runs at 75–82% in *every* condition tested, including with no coach at all, so PQ now reads 5 almost everywhere. **All dimension definition and validity work now lives in `tau-dimensions.md`**, split out on 2026-08-05 so it does not entangle the migration

---

## Build Phases

**State as of 2026-08-06:** B, C, C2, E, F built. **D (Vertex) and B' (Firestore) done; deployed to
Cloud Run and public.** A is most of the way — caps, cost accounting, least-privilege service account
and Firestore rules are in; rate limiting and SSO are not. G unstarted.

**Build strategy (2026-07-16): local-first.** Phases B+C built now against dev seams in `app/` (dev password auth / Groq / JSON store shaped as Firestore); Phases A+D become seam swaps once the GCP project + DPA exist. See `app/README.md`.

**Migration order (revised 2026-08-05, followed 2026-08-05/06 — D, B' and the deploy are done):
D → B' → A → deploy, not A → D.** The LLM swap is the only
one carrying real unknowns — whether Gemini Flash-Lite matches `llama-3.3-70b-versatile` on
classification and provenance, and whether `extractJSON()` survives a different model's output habits.
Find that out first, locally, while the JSON store and dev login still work and iteration is instant.
Firestore and Firebase Auth are mechanical by comparison: you already know what they will do.

**Firestore swap is bigger than "mechanical."** The `col()` API mirrors Firestore's *shape*, but it is
**synchronous** and Firestore is not — 153 call sites (106 in `index.js` alone) each need `await`.
Most sit inside handlers that are already `async`; the fiddly ones are `col().list()` nested inside
synchronous callbacks (`.filter()` predicates, sort comparators), which need restructuring rather than
an `await`. Budget a focused day plus a careful review pass.

**Firestore security rules are smaller than Phase B assumes.** The architecture is fully
server-mediated — every client call goes through `/api/*`, and the Admin SDK bypasses rules entirely.
The correct rule set is `allow read, write: if false;`. Browsers never touch Firestore directly, so
`teacherScope()` remains the real permission system and rules are a lock on the back door.

- [~] **Phase A — Backend skeleton:** Cloud Run proxy (auth-gated, rate-limited, token budgets) + Firebase Auth (Google SSO, domain-restricted). *Dev stand-in running: node server + real per-user login (email/password, scrypt, HttpOnly session cookie) behind the same `auth.js` seam — every `/api/*` route now requires a session and role is server-derived, so the swap to SSO is one file. **Passwords are a POC stand-in, not the plan for minors.** Admin-created teacher accounts and per-request suspension landed 2026-08-04. **Two-tier usage caps built and verified 2026-08-05** (`app/server/budget.js`) — all four behavioural rules tested, including that a chat-blocked student can still submit and get a report. **Deployed to Cloud Run 2026-08-06** on a least-privilege service account (`aiplatform.user` + `datastore.user` only), public, with the password path hardened (see the security session-log entry). Still missing: **rate limiting** (now the only unblocked item, and more pressing since the endpoint is public — the sole throttle today is on failed logins) and **the SSO itself**, which stays blocked on a pilot school's domains and their IT approval*
- [x] **Phase B — Data model:** collections (users/roles, assignments, sessions, conversations, turns, submissions, analyses, events, usage) **now running on real Firestore (swapped 2026-08-05)**; append-only turns with `meta.supersedes`. Three roles (`student`/`teacher`/`admin`) plus `users.status` for suspension. 1,373 documents migrated with ids preserved via `app/server/migrate-to-firestore.js`. **Firestore security rules deployed 2026-08-06** (`firestore.rules`, deny-all — there were none at all before, since the database was created via `gcloud` rather than the Firebase console). Three collections added since: `llmCalls`, `budgetGrants`, `loginFailures`. *Remaining: a pass to convert the surviving full-collection `list(predicate)` scans to queries as data grows — they are commented at each call site with why equality can't express them*
- [x] **Phase C — Chat UI:** conversation sidebar, streaming, episode handling, Evaluate button (auditor voice), submit flow with confirmation friction; event logging (copy/regenerate/edit/stop/evaluate/episode) from day one. *Remaining: polish passes as real use reveals gaps*
- [x] **Phase C2 — Student account view:** login page (Google SSO button present, disabled until Phase A) and a student home showing current work with the coaching level for the next draft, past assignments with per-draft score chips linking to their reports, teacher-note badges, and a growth sparkline across submitted drafts. Score dimensions are named in student language here rather than by acronym; no class comparison or ranking. Demo class of 5 students with pre-baked analyses in `app/server/seed-data.js`
- [~] **Phase D — Vertex migration (now first — see migration order above):** **done 2026-08-05** — `llm.js` on Vertex Gemini via ADC (no API key, zero dependencies), all 3 analysis calls migrated and verified against the seeded baseline, `school.js` landed, `thinkingBudget: 0` everywhere (capping analysis turned out to be impossible — see the session log), Groq 429 loop deleted, provider error bodies no longer reachable from the throw, and `extractJSON()` hardened with structural JSON output. **`llmCalls` cost measurement landed 2026-08-05** (one row per call, tokens never dollars). **Backlog #9 closed** — and the larger PQ validity problem it exposed now lives in `tau-dimensions.md`, not here. *Remaining: coach + auditor system prompts per coaching level; a versioned price table (deferred until the platform-admin cost view reads these rows); embeddings (CTA Call 3) were never ported, so that call moves with the divergence chart rather than this swap; and a systematic Flash-Lite vs 3.5 Flash comparison on provenance*
- [x] **Phase E — Submission pipeline:** bundle cycle conversations + essay → analysis (classification, provenance+flags, TAU ported from CTA) → snapshot narrative → storage; student draft report with full TAU disclosure, flags teacher-only. *Remaining: divergence chart embeddings, delta provenance, event-derived scoring signals*
- [x] **Phase F — Teacher dashboard integration:** assignment creation (prompt, budget, dial with default-fade prefill), roster with per-cycle TAU chips + flag markers, student conversation view (trajectory strip, conversation-ready moments, snapshots verbatim, transcripts in teacher mode with events inline), teacher note per submission surfaced on the student's report. Triage dashboard ported from `teacher-dashboard.html` (real data via `/api/teacher/dashboard`, mock shape preserved) with drill-down links into the detail layer. *Remaining: real classes in the data model (one synthesized class for pilot), class-level instructional view (backlog #3)*
- [ ] **Phase G — Multi-school (new 2026-08-05):** `school.js` seam (resolve email domain → school config); `schools` registry as the one global collection; role split (`admin` → `school-admin` + `platform-admin`); one Firestore database per school; `provision-school.js`; verification-gate checklist; export/delete path. **Contains a latent leak to close:** the `/api/admin/overview` counts (search `index.js` for `role: 'student'` — around the `scale` and `audienceSize` blocks) count *every* user in the database with no school scope. Correct with one school; the identical bug class as the 2026-08-04 `teacherScope()` fix and the 2026-08-05 `canReadSubmission()` fix the moment there are two. **Both of those were found by testing cross-tenant access rather than reading code — do the same here before trusting it.** Line numbers deliberately omitted: they have moved twice already. Per-school Firestore databases replace the old `app/data/<schoolId>/` idea, which died with the JSON store
- [ ] **Parallel:** district IT gates (Vertex project? DPA?)

---

## Stakeholder Summary (ready to share)

> **Critical Thinking Auditor — Built-In AI Chat: a classroom tool that makes student AI use visible, safe, and teachable.**
>
> Students already use generative AI invisibly, on personal accounts. This tool gives them a school-controlled AI chat that looks and feels like ChatGPT — then measures *how* they used it and turns that into feedback for the student and insight for the teacher. It does not grade essays; the essay stays the teacher's domain. It assesses the process: agency, skepticism, and original thinking while working with AI.
>
> Students sign in with school Google accounts, work on assignments through the built-in chat, submit drafts as deliberate milestones, and receive plain-language feedback on how they worked. The chat is an ordinary AI assistant — nothing is withheld and nothing is coached, because the point is to measure how students work with the AI they will actually meet. Teachers set the draft schedule, see the class at a glance, and get quoted moments from real conversations to anchor feedback — never accusations. Integrity signals are teacher-only conversation-starters; the tool is not a cheating detector and doesn't claim to be.
>
> All data stays in the school's Google Cloud environment under a single data-processing agreement; student data is never used to train AI. Cost is negligible: under $50 per classroom per semester. Pilot: one class, one semester, five assignments.

---

## Session Log

- **2026-08-14 — Coaching removed: the chat is now a plain Gen AI chat.**
  The coach interfered too much with natural use. The three personas (full / questions-only /
  sounding-board) and their shared hard rules — never draft, never rewrite, stay on-task — meant
  every measurement was taken against a modified assistant, not the one students actually use.
  `server/coach.js` is now the auditor prompt plus a history builder: **the chat sends no system
  prompt at all**, and is not even given the assignment brief. Students brief it themselves, which
  is a move the analysis can read. Removed with it: `coachingLevels` on assignments (creation,
  edit, server validation, and the per-draft `<select>` column in `dashboard.html` — the per-draft
  due-date rows stay, and `.level-selects` is now `.draft-slot-rows`), `coachingLevel` on sessions
  and analyses, the workspace mode banner (kept only for its "all drafts submitted" state), the
  snapshot's "next cycle will be in X mode" bridge, and the fade line on teacher assignment cards.
  Kept: the auditor and its Evaluate button, unchanged — it only speaks when summoned, so it never
  shaped ordinary use, and it is now the only prompt that sees the assignment. The stored turn role
  is still `coach`; students read that side as **AI**, and the classifier prompt says AI too.
  Verified end to end against the demo seed: a student asking "just give me the paragraph" now gets
  the paragraph, the auditor still returns a process read, and assignment create/edit/delete
  round-trip without the field. Legacy assignment docs keep a dead `coachingLevels` array; nothing
  reads it. **Open: nothing replaces the fade as the mechanism for building independence** — if
  that is still a goal it has to come from assignment design or the report.

- **2026-08-10 — The landing rule moved to the server: an account now starts on its own page.**
  Signing in as the platform admin landed on the teacher dashboard. The mapping itself was never
  wrong — `login.js` knew `platform-admin → /admin.html` — but *only the sign-in form knew it*.
  Everything else ignored role entirely: `GET /` hardcoded `index.html`, so the student app was the
  default for every role, and every page served to anyone who asked, so a platform admin on
  `/dashboard.html` got a dashboard that 403s its own data. Typing the bare domain, a bookmark, or a
  `?next=` from an earlier 401 bounce was enough to miss the one place the rule lived.

  Now `homePageFor()` in `app/server/index.js` decides, alongside the sign-in gate and for the same
  reason: state that changes what you see resolves before first paint, holds with JS off, and lives
  in one place. `/` is not a page — it means "this account's home" (302). `PAGE_ACCESS` sends a
  role-mismatched page request to that same home rather than rendering a shell that cannot load.
  `index.html` and `report.html` stay open to all roles on purpose: the student app doubles as the
  teacher's preview of it, and a report is gated by ownership, not by role.

  Both browser copies of the table are gone — `login.js` and `set-password.js` redirect to `/` and
  let the server answer. Three copies of one rule is what let it drift in the first place. Knock-on:
  the account menu's "Preview student app" points at `/index.html`, since `/` would bounce a teacher
  back to the dashboard. The report crumb "All assignments" keeps `/` and improves — it used to send
  teachers into the student app.

  A school administrator homes to the *dashboard*: the grant sits on a teacher account, teaching is
  the daily job, administration is one click away in the account menu. That a non-teaching
  `school-admin` cannot exist at all is now backlog item 9.

  *Verified:* all five surfaces against platform-admin, school-admin teacher, plain teacher (grant
  temporarily revoked and restored), student, and signed-out — each lands on its own page, is
  redirected off the pages it cannot use, and deep links (`/report.html?id=…`) still survive the
  sign-in round trip.

- **2026-08-10 — Account creation by emailed invite; temp passwords deleted entirely.** An invited
  account is now created with **no password at all** and an emailed single-use link sets one
  (`credentialTokens` in `auth.js`; invite 7 days, reset 1 hour, tokens SHA-256 hashed at rest like
  `authSessions` already were). No credential is ever displayed to an administrator or carried in
  an email, which closes the item this log recorded as accepted-not-fixed on 2026-08-05: *an admin
  who resets a teacher's password can sign in as them.* An admin can now start a recovery and still
  cannot complete one. `verifyPassword()` already refused a user with no hash, so a pending account
  is unusable by construction rather than by a flag somebody has to check.

  New surfaces: `web/set-password.html` (+ `.js`), gated **server-side before first paint** by
  `redirectedForBadToken()` — an expired link 302s to `/login.html?link=expired` with the recovery
  form already open, rather than rendering a form that only fails once filled in. Self-serve reset
  on the login page answers identically for a real and an unknown address, and a request for an
  address with no account is logged to console only — never to `adminEvents`, which would turn the
  audit log into an enumeration oracle for whoever reads it later. Redeeming deletes every token
  **and every live `authSession`** for that account, so a reset evicts whoever prompted it.
  Password rules per NIST SP 800-63B: 12-char minimum, no composition rules, no rotation, tiny
  blocklist. `/api/admin/{teachers,students}/:id/reset-password` are gone; `send-reset` and
  `resend-invite` replace them, and `showPassword()` and its modal are deleted.

  **Mail: SMTP2GO over its HTTP API** (`server/mail.js`, `server/invites.js`), *not* SMTP —
  Cloud Run blocks outbound 25 unconditionally and 465/587 without a VPC connector, so the SMTP
  half of the provider is unreachable from the deployed app. No new npm dependency. With no API
  key configured the seam prints the message to the console, so localhost and the demo instance
  run the whole flow with no credentials and no cost — chosen by the absence of a key, not by
  `NODE_ENV`, and a *production* instance with no key refuses to send rather than printing invite
  links into a log.

  **Delivery tracking, because acceptance is not delivery.** The send API answers 200 the moment it
  accepts a message; a hard bounce or a school filter rejection arrives minutes later. Every send
  is recorded in `emailSends` (with `day`/`month` buckets so counting today's volume is an equality
  query, not a full scan), and `POST /api/webhooks/smtp2go` annotates the row with the
  real outcome. That route is the only unauthenticated non-page route in the app: it is
  authenticated by a shared secret in the `Authorization` header (constant-time compared), which
  SMTP2GO's webhook config supports — a secret in the path would have been copied into every access
  log on the way. It may **only** annotate an existing send — never create or mutate a user, never
  consume a token — so even a leaked secret buys nothing but a false status on a row. New
  *Operations → Email delivery* view: today and this month against the plan's 200/day and
  1,000/month, plus time since the last send (a count of zero reads the same whether nothing needed
  sending or sending broke — the timestamp is what separates those). Roster rows carry the
  support answer inline, naming **the address the message actually went to**, since a typo is the
  commonest cause of "they never got it" and the only one visible without asking anyone.

  *Verified* against an in-memory store stub (ADC was unavailable): invite creates no password and
  returns none; the invitee cannot sign in until redemption; good token serves the page while a
  missing or junk one 302s; the 12-char rule; single-use; the session issued at redemption works;
  reset request is indistinguishable for known and unknown addresses; redeeming a reset 401s the
  old cookie and the old password while the new one works; adding an existing student to a second
  class does *not* re-invite them; webhook 404s on a wrong or absent secret and records a bounce on
  the right one; `tempPassword` appears nowhere in `app/`. **Not verified visually** — no screenshot
  pass on the new page or the Email delivery view yet, which designsystem.md treats as non-optional.

  Still open: no route creates a **platform admin** (still only `bootstrap-admin.js`), and whether
  pilot students have mailboxes that accept external mail — if not, the student path needs the same
  token as a teacher-printable list rather than an email.

- **2026-08-08 — Split demo from product: real users get their own GCP project.** Until today local
  dev and the deployed instance were the *same* Firestore database in `cta-pilot-dev`, so the demo
  students were literally the public site's students. Real users arriving makes that untenable.

  **`tau-thinking-prod`** now holds real schools: own Firestore (`us-central1`, deny-all rules
  released through the firebaserules API, same as dev), own `cta-run@` runtime identity with exactly
  `roles/aiplatform.user` + `roles/datastore.user`, own Artifact Registry repo. `cloudbuild.yaml`
  deploys there. Local work is unchanged — `config.json` still points at `cta-pilot-dev`, the demo
  class is still seeded, `teacher@school.dev` still signs in.

  **The seed became opt-in, because the old guard failed open.** It used to skip when
  `NODE_ENV=production` — but Cloud Run replaces its whole env set on every `--set-env-vars`, so
  dropping one line from `cloudbuild.yaml` was enough to silently reseed the live store. Now
  `SEED_DEMO=1` is required, and it *throws* if `NODE_ENV=production` is also set: two switches that
  have to agree, both failing closed. `npm run start:demo` is the everyday command.

  Same flag gates the login page's test-account list (`GET /api/auth/demo`) — a real instance shows a
  plain sign-in form rather than ten fixture accounts and a published password. The block is hidden
  in the markup and only revealed on a positive answer, so a failed request can't leak it. And
  `DEV_PASSWORD` moved from `seed-data.js` into `auth.js`, so a production process no longer loads
  the demo fixtures module at all.

  **`bootstrap-admin.js`** opens the chicken-and-egg an empty production store creates: every route
  that makes an account needs an authenticated platform-admin, and only the seed ever made one. A CLI
  rather than an HTTP route on purpose — "create the first admin if none exists" is a public
  privilege-escalation route for the entire window between deploy and first use.

  *Verified:* both modes locally (seed runs / doesn't, demo endpoint answers accordingly, no password
  in the served HTML); the both-switches guard throws; the app reads and writes `tau-thinking-prod`
  Firestore; a Vertex call succeeds there; the bootstrapped admin signs in.

  *Open:* the `deploy-main` trigger still lives in `cta-pilot-dev` — its GitHub App connection does,
  and creating one in prod needs a browser OAuth step. The build executes in the demo project while
  the image and service land in prod, so shipping depends on the demo project existing. Also unsettled:
  whether the public demo instance keeps getting deploys (it no longer does) and whether it earns a
  second trigger.

- **2026-08-06 — Deployed to Cloud Run, with the two open security items closed first.** The app runs
  at `https://cta-714032495709.us-central1.run.app`, **not publicly reachable** — deployed
  `--no-allow-unauthenticated`, so Cloud Run IAM 403s anonymous callers and the app's own session
  layer still 401s even an IAM-authenticated one. Two independent gates, verified separately.

  **Least privilege:** a dedicated `cta-run` service account holding exactly `roles/aiplatform.user`
  and `roles/datastore.user`. Worth pinning explicitly rather than accepting the default — the compute
  service account Cloud Run would otherwise have used carries `roles/editor`.

  **Firestore rules deployed** (`firestore.rules`, deny-all). There were none at all beforehand: the
  database was created through `gcloud` rather than the Firebase console, so no ruleset was ever
  attached and IAM was the only thing standing between the data and a client SDK. Nothing legitimate
  is denied — no browser holds a Firestore handle — but registering a Firebase web app later can no
  longer hand out a client key against a database whose rules were never decided. Note the rules file
  is inert on its own; changing it requires re-releasing through the firebaserules API.

  **The metadata-server credential path finally ran.** `llm.js` was written months ahead of any
  deploy to fall through to Cloud Run's metadata server when no ADC file exists; that branch had
  never executed. It works: streaming coach replies came back through Vertex on the deployed
  instance, and an `llmCalls` row landed with real token counts. Config moved to environment
  variables at the same time, since `config.json` is gitignored and deliberately excluded from the
  image — there is now no credential and no config file inside the container at all.

  **Opened to the public the same day**, on the basis that every record in `cta-pilot-dev` is
  fabricated and the project is disposable. Two properties make that defensible: the session layer
  still gates `/api/*` (removing Cloud Run's IAM gate removed a layer, not the only one), and the
  usage caps bound spend to about a dollar a day even if strangers max all ten demo accounts — the
  cap work paying for itself, since a public demo would otherwise have been an open tab on the Vertex
  bill. **The standing rule this creates: `cta-pilot-dev` must never hold real student data while a
  password published in this repo signs into it.** A real pilot gets its own project, which the setup
  doc already assumes.

- **2026-08-05 — Security audit of the password path. One real vulnerability found.** Any teacher
  account could read any student's report, essay, full 88-turn transcript and **integrity flags** by
  submission id. The three `/api/submissions/:id/*` routes checked `role === 'teacher'` but never
  *whose* student — they reach the same data the roster routes reach, but by a different door, and
  `teacherScope()` was only ever applied to the roster door. Invisible while the seed created exactly
  one teacher; live from 2026-08-04, when admins gained the ability to create a second. **Found by
  creating a second teacher and trying it, not by reading the code** — which is the lesson worth
  keeping: the isolation guarantee in the design docs was not the isolation the code enforced.
  Verification gate should include the cross-teacher probe explicitly, since it already does for
  rosters but that is not where the hole was.

  Password hardening, all of it stand-in work that SSO eventually deletes: scrypt N raised to 2^16
  with per-user params and upgrade-on-login (so the work factor can rise again without a reset);
  session tokens stored hashed rather than plaintext; logout deletes rather than expires; 7-day
  sessions; `Secure` cookie under `NODE_ENV=production`; equal work burned on unknown emails to close
  the enumeration timing oracle; 10-failures-per-account throttle.

  **Lockout is per-account and never per-IP, and that is a school-specific decision.** Built it with
  an IP throttle first, then watched an unrelated student with the correct password get refused,
  because every device in a school shares one NAT address — an IP lockout locks out the class.
  Spraying is logged (25+ distinct accounts from one address) rather than blocked.

  Production guards added because the demo seed writes ten accounts sharing one published password:
  the seed refuses to run under `NODE_ENV=production`, and admin-created accounts get a random temp
  password there instead of the dev constant. Accepted and logged, not fixed: an admin who resets a
  teacher's password can sign in as them.

- **2026-08-05 — Cost accounting + usage caps (Phase D leftover and half of Phase A).** `llmCalls` now
  records one row per Vertex call — purpose, model, input/cached/output/thinking tokens, latency,
  `billsTo`, and attribution down to the submission. Confirmed first that streaming replies report
  usage (several chunks carry `usageMetadata`; the last holds the totals), since chat is ~78% of
  estimated input and an unmeasurable chat path would have made the whole log pointless. Tokens only,
  never dollars. The versioned price table is deliberately **not** built yet: nothing reads these rows
  until the platform-admin cost view exists, and the urgent half was the recording, which cannot be
  reconstructed later.

  `budget.js` implements the two-tier cap. All four behavioural rules are built and each was tested,
  not just written: the check happens **before the student's turn is persisted**, so a refused message
  does not strand a question in the transcript with no answer; the 80% warning arrives as an SSE
  `notice` on the reply that crosses it; a teacher grant is one POST and takes effect immediately;
  and **a chat-blocked student can still submit and get a full report** — verified by exhausting the
  cap, submitting, and watching all three analysis calls run and complete. Regenerate and Evaluate
  draw on the same budget, since both are Vertex calls and Evaluate is available at every coaching
  level, which makes it the easiest loop to spin if it were free.

  Grants are additive and expire daily. The hard tier (1M input tokens/day) logs loudly and phrases
  itself as our fault, not the student's — reaching it means a bug or abuse, never homework.

- **2026-08-05 — Firestore swap (Phase B', same session as the Vertex swap).** `store.js` now talks to
  real Firestore in `cta-pilot-dev`. The plan's "153 call sites" estimate was exact. Decision taken:
  **`firebase-admin` via npm**, ending the zero-npm-dependency property. The alternative — a REST
  client reusing the ADC token minting from `llm.js` — meant hand-writing Firestore's typed-value
  encoder, queries, pagination, transactions and retries underneath the collection holding student
  records. Wrong place to spend that property; the browser side stays dependency-free.

  **The plan called this "mechanical" and it mostly was, but three things were not.** First, a literal
  translation of `list(predicate)` reads the entire collection and filters in memory — acceptable for
  `users`, ruinous for `turns`, which holds every message ever sent and is billed per document read.
  `list()` now takes an equality object that compiles to `where()`; hot paths use it, and the
  predicates that survive are the ones equality genuinely cannot express. Second, and the real
  hazard: `await col('x').list(...).sort(...)` is valid syntax that calls `.sort()` on a Promise.
  36 chains needed parenthesising, none of which a syntax check would have caught — and the same trap
  bit the helpers that became async (`await teacherScope(user).students` reads a property off the
  Promise). Third, `.some()`/`.map()`/`.filter()` bodies cannot await, so they became loops; the
  `.some()` conversions kept their early `break` so read counts did not change.

  Approach that worked: add `await` to *every* store call mechanically, then let `node --check` find
  each enclosing function that had to become async. Over-applying `await` fails loudly; under-applying
  it fails silently. Then an explicit audit of every async function's call sites, since the parser has
  nothing to say about a missing await.

  Verified end to end against migrated data: login, student home, assignment list, conversation
  create, streaming coach reply, submit → analysis → report, teacher dashboard, teacher transcript
  route, and the role-scoped disclosure boundary (integrity flags present for the teacher, absent for
  the student). Boot is now ~20s because the idempotent seed does a network round-trip per check.

  Still open: security rules, and `app/data/*.json` is now stale — read by nothing, kept only as the
  snapshot `migrate-to-firestore.js` replays.

- **2026-08-05 — GCP setup + the Vertex swap itself (Phase D, part 1).** Project `cta-pilot-dev` is
  live: billing linked, five APIs on, Firestore in `us-central1` (Native, delete protection off —
  fine for dev, must be on for a school's project), budget alert at $25. `gcp-setup.md` was rewritten
  against what actually happened, since roughly half its steps failed as written — macOS ships Python
  3.9 and gcloud needs 3.10+, project display names reject punctuation, and the ADC consent screen
  hides a checkbox whose omission produces a "web authentication problem" error that names the wrong
  cause.

  **`llm.js` now runs on Vertex Gemini with no API key anywhere** — ADC in dev, the metadata server on
  Cloud Run, same code path. Zero dependencies: minting an access token from the refresh token is ~25
  lines of `fetch`, so the no-build-step constraint survives the migration and `google-auth-library`
  never enters the tree. `school.js` landed alongside it, as planned, so the "which project does this
  bill to" question exists before Firestore makes it async. The Groq 429 loop is gone, and provider
  error bodies no longer reach the throw — `index.js` pipes `err.message` straight to the browser over
  SSE, so that throw was a request-echo waiting to happen.

  **Two planned decisions were overturned by measurement, both about thinking.** `thinkingBudget` is
  advisory, not a cap: 3.5 Flash asked for 512 spent 777. And thinking is drawn from
  `maxOutputTokens`, so a 300-token analysis budget with 512 of thinking returned one token and a
  truncation. "Capped for analysis" is therefore not a thing that exists — the choice is 0 or
  uncapped, and uncapped is the ~$120 semester. Everything now runs `gemini-3.1-flash-lite` with
  thinking off, model overridable from `config.json`. With thinking off, 3.5 Flash's 6× price buys
  nothing measurable; it mislabeled a turn Flash-Lite got right. Small sample — a real provenance
  comparison against the seed transcripts is still owed.

  **`extractJSON()` did survive, but only after a fix** — the plan flagged it as an unknown and it
  was right. All three analysis calls now use `responseMimeType: application/json`, and the parser
  parses the whole body first, falling back to a brace-balanced scan that stops at the *matching*
  close. The old greedy `/\{[\s\S]*\}/` spanned first-brace to last-brace, which broke intermittently
  when Gemini emitted a complete object followed by a second one, and would also have broken on a
  brace inside a string — a latent bug the provider swap merely exposed.

  Verified end to end against the real pipeline on Maya's 88-turn seeded session: three consecutive
  runs at TAU 12–13 against the hand-labeled baseline of 13, stable labels and provenance, ~8.7s.
  Streaming, stop-mid-generation, and the coach persona all confirmed through the actual HTTP server.
  Still open in Phase D: the `llmCalls` cost collection, backlog #9 (PQ), and coach/auditor prompts
  per coaching level.

- **2026-08-05 — Migration planning session (no code).** Decided to pull the trigger on Vertex/Firebase
  and, in the course of costing it, settled the multi-school architecture the migration has to carry.
  Four outcomes, all recorded above rather than here: (1) **cost re-baselined** against live Vertex
  pricing, which has roughly 2.5–4× since the original table — bottom-up from the actual call sites, a
  24-student semester lands at ~$11–18 on a Flash-Lite chat / batched-Flash analysis split, so the
  public "under $50 per classroom" claim survives at nearly double the class size, contingent entirely
  on capping `thinkingBudget`. (2) **Migration order inverted** to D → B' → A → deploy: the LLM swap is
  the only step with unknowns, so it goes first while iteration is still instant; Firestore's swap is
  also bigger than the docs implied (153 synchronous `col()` call sites), and its security rules are
  smaller (server-mediated architecture means `allow read, write: if false`). (3) **Anthropic
  compared and declined** — Claude for Teachers (July 2026) ships FERPA-aligned K-12 terms but is a
  chat product for individual educators, not API access, and Haiku 4.5 would cost about the same as
  Gemini; the deciding factor is that Firestore/Cloud Run/Auth stay on Google regardless, so splitting
  inference to a second vendor doubles the DPA surface for no gain. Vertex stands. (4) **Multi-school
  designed end to end** — deployment models 1/2/3, the identity chain, the schools registry, the
  `admin` → `school-admin` + `platform-admin` split, per-school databases, and the onboarding ladder
  (we create schools + first admin by script; school admins create teachers; teachers create classes,
  students by email, and assignments). Two things fell out that were not on any list: the
  `/api/admin/*` routes carry a **latent cross-school leak** — the same unscoped-query bug fixed for
  teachers on 2026-08-04, one level up, currently invisible because there is one school — and
  **offboarding needs designing now**, since the DPA's return-or-destroy clause becomes a contractual
  promise about code that does not exist yet. Per-school databases make both cheap. Deliberately
  rejected: `platform-admin` impersonation of a school admin (kills the absolute guarantee for support
  friction that configuration visibility already covers), and model 3 as an offering. New file
  `app/gcp-setup.md` holds the Phase 0 setup, rewritten mid-session for a non-specialist reader
  (expected output per step, a glossary, a troubleshooting table, budget alert moved ahead of any
  possible spend). Also settled late in the session: **policy vs plumbing** (a school admin configures
  what the tool does for them, never where data flows or who gets in — liability does not transfer
  through a UI, and a routing setting is an exfiltration channel wearing a dropdown); **six rules that
  keep model 3 reachable** while building 1 and 2, of which two are free-now/impossible-later (config
  from environment only, never log student content — with a live instance already in `llm.js`); a
  **two-tier usage cap** (soft = replies, hard = tokens, because the same 40 replies span 65K–352K
  tokens depending on conversation shape, so a token cap would give identically-behaved students
  wildly different allowances); and **cost measurement** via a new `llmCalls` collection storing tokens
  rather than dollars, so history stays re-priceable when Google moves prices again. Nothing under
  `app/server/` touched yet.
- **2026-08-04 — Admin role + administration surface; per-teacher scoping fixed.** Third role added
  (`admin`), so the operating model finally has its first step: **admin creates teachers → each
  teacher builds their own workspace**. Previously teachers existed only because `seed.js` made
  them. New `web/admin.html`: *Teachers* (create / edit / reset password / suspend — never delete,
  since a teacher owns classes, assignments and submission history), *Content areas*, *Student work
  patterns*. Suspension is checked in `authenticate()` per request, not just at login, so it ends a
  tab already open rather than waiting out a 30-day cookie.
  **Admin is deliberately not a super-teacher** — the teacher gate still requires `role === 'teacher'`,
  so every teacher route 403s for an admin, and `/api/admin/overview` was written to carry no student
  name, transcript, essay, or integrity flag. That boundary is what keeps the "flags are teacher-only"
  guarantee true once a role above teacher exists; verified by asserting those strings are absent from
  the payload, not just by reading the code.
  **The security fix this required:** `/api/teacher/dashboard` and `/api/teacher/assignments` listed
  *every* student and class in the install (`col('users').list(u => u.role === 'student')`,
  `col('classes').list()`), and the student-detail, assignment-edit, assignment-note and
  submission-note routes had no ownership check whatsoever. Invisible while the seed created exactly
  one teacher; a straight cross-teacher leak of rosters, scores and integrity flags the moment an
  admin can create a second. Now all funnel through `teacherScope()`. Proven by diffing the demo
  teacher's full dashboard response before and after (byte-identical once timestamps are normalised —
  a pure security fix, zero behaviour change) and by creating a second teacher in a real browser and
  confirming an empty workspace plus a 403 on a hand-forged read of another teacher's student.
  **On metrics, the brief was explicitly not analytics** — *"less concerned with usage metrics and
  more what content should be prioritised"* — so the surface answers "which parts earn attention and
  which are ignored." New `usage` collection, kept separate from `events` (the append-only integrity
  record feeding TAU; product telemetry has no business in it), written only for explicit opens
  against a server-side allowlist. **Areas that render inline with no open of their own were dropped
  from the allowlist rather than logged** — trajectory strip, ready moments, snapshots, integrity
  signals — because a count attached to them would have been a count of page loads wearing a
  section's name. *Student work patterns* needs no instrumentation at all: conversations per draft,
  Evaluate uptake, completion rate and analysis health all come from records the pipeline already
  persists, so that block is complete on day one while the ranking above it is still filling up.
  Two design corrections caught by running it rather than reading it: bars were first scaled to the
  busiest row, which rendered every tied row full-width and read as "heavily used" when it meant "one
  person, once" — rescaled to reach against the real population (`audienceSize`), which also made the
  numbers actionable ("1 of 8 students"); and the per-row value then wrapped mid-phrase, fixed by
  dropping the noun the section note already supplies. Verified in Chromium across all three roles:
  real clicks produced real ranked rows, full teacher lifecycle exercised through the UI (add,
  duplicate-email refusal, suspend → live session 401s → reactivate → 200), zero console errors, zero
  horizontal overflow at 1440/900/700, light and dark both checked by screenshot. Known pre-existing
  gap left alone: the shared `.account-signout` control is 27px tall against the system's 44px
  minimum — it ships on all five pages and belongs to `components.css`, so fixing it from this page's
  sheet would violate the placement rule.
- **2026-07-26 (WIP, uncommitted)** — Report information architecture rebuilt: the three tab panes (My Session / Agency Chart / Who's Driving) are now permanently-visible sections instead of hidden panes, with a new sticky jump nav between the hero and the sections (five buttons, click-to-scroll, scrollspy) so a student always has a map of the report and a way back to any part of it without re-clicking through tabs. The hero stays pinned at the top unchanged; a mini score chip (`score/20 · band label`) docks into the same sticky nav bar — rather than opening a second sticky element — once the hero scrolls out of view, so the score stays glanceable at any scroll depth without spending permanent vertical space on a second copy of it. Follow-up in the same session: the five section labels are now a dedicated `.report-section-title` (bigger, ink-coloured) instead of the small uppercase `.eyebrow` micro-label, and all five sections were standardised onto `.card-lg` so the title sits at the same offset in every section — two of them had been on plain `.card`'s smaller padding, which was the actual "position inconsistent" bug. Full design rationale and the exact CSS/JS mechanics are logged in `designsystem.md`'s own session log (2026-07-26 entry) rather than duplicated here. Verified server-side (login, submissions list, report endpoint all 200 with real data); **not yet verified in an actual browser** — no headless-browser tool was available in this environment — and **not yet committed**, so treat this as WIP until a session closes it out with a commit.
- **2026-07-19 (build session 7)** — Student home redesigned for content hierarchy. Diagnosis: the page had no primary action (every assignment card carried an identical button, and the largest text was an uninformative greeting), scores were unreadable (`Draft 1 · 12` with the scale and SAMR band hidden in a `title` tooltip), the teacher note — the only human message on the page — sat as a small badge on the lowest section, and `snapshot.growthMoves` was never surfaced outside the report. New order is **one action → one human message → one thing to improve → trend → history**: a hero for the single assignment to open next (soonest deadline, then work already underway; eyebrow states *why* it's shown, and the coaching level is spelled out in behavior rather than named), a full-width teacher-note panel, a last-draft panel with score over 20 + SAMR + a plain-language read + four named dimension bars + the growth move, then compact rows for other work, the existing sparkline, and compact completed cards. Server: `/api/student/home` now returns `growthMove`, `teacherNote` text, `assignmentTitle` per draft and `nextCoachNote` per assignment (no new disclosure — flags stay unselected, note text already served by the report route). Verified headless against all five demo students; two bugs caught only by running against real seed data — the hero tie-break pointed a mid-draft student at an untouched assignment, and the eyebrow read "No due date" (the seed sets none). **Then widened to two columns** on the objection that a narrow single column reads as a feed. The substantive problem behind that: vertical rank was the only encoding, so ranks 4–6 sat below the fold on a Chromebook — a hierarchy half of which is invisible. Fixed with an asymmetric grid (main `minmax(0,1fr)` capped at 680px for reading measure, since the note and growth-move blocks are prose and break past ~70ch; 320px rail for glanceable status: other work, growth, completed). Rail cards drop their shadow so they read as context, not rival actions. DOM order is rank order, so the ≤960px collapse needs no reordering — it caps the grid (not just the main column) at 680 and centers, and restores row layouts where the width returns. `.no-rail` collapses the gutter when a student has no history. Priya's entire page now fits above the fold at 1440×900.
- **2026-07-19 (build session 7b)** — Student home restructured again, to the three-chunk model: **permanent left rail (identity + progress) as the dashboard's fixed ground; current assignments as the main content, all of them, ordered by due date; past assignments as a review-only archive.** This retired the "hero" from 7a — singling out one assignment was the wrong call once every open assignment gets a card with its own internal hierarchy: due/status eyebrow → title → state (draft N of M as pips, open conversations + last worked) → what the coaching level actually does → that assignment's own last growth move → teacher note if any → action + submitted-draft chips → prompt. The per-assignment framing also fixed a scoping bug in 7a, where the growth move shown was the globally-most-recent one rather than the one belonging to the assignment being opened. Server adds `conversationCount` / `lastActiveAt` per current assignment. **Progress viz reworked** per the dataviz skill: one hero figure (the total, ≥48px, exactly one per view), meters whose unfilled track is a lighter step of the same ramp, and per-dimension deltas. Two honesty fixes — the trend is drawn as **one polyline per assignment with a dashed split rule** rather than one continuous line (the scores are not a single trajectory; a connected line asserts that opening a new essay at 12 after finishing one at 20 is a regression), and the headline delta is **withheld across assignments**, shown only against a previous draft of the same one. Also corrected the SAMR ramp from a four-hue rainbow (slate/blue/green/purple) to one blue hue light→dark, since SAMR is an ordered scale — hue rides a border rule, the label stays ink so it never fails contrast. Verified headless at 1440 and 900 (rail collapses to a three-block horizontal stat band) across maya/devon/priya/sam.
- **2026-07-19 (build session 6)** — Student login + account view, ahead of the Vertex/Firebase migration. `auth.js` rewritten behind the same seam: email/password (scrypt + per-user salt), opaque token in an HttpOnly cookie, `authSessions` collection; every `/api/*` route now 401s without a session and all four client surfaces share `web/api.js` so an expired session lands on the login page from anywhere. **Security fix:** the previous teacher gate was not a gate — `X-Dev-Role: teacher` was a client-set header, so any student could read `/api/teacher/dashboard` including classmates' integrity flags; `GET /api/me` also returned the raw user doc (now carrying a password hash). Both closed and verified (student + header → 403, cross-student report → 403, no `flags` key in student payloads, logout invalidates the token). New student home: current work with the next draft's coaching level, past assignments with per-draft score chips into the existing report page, teacher-note badges, growth sparkline (hidden below two points), dimensions named in student language. Demo class of 5 students seeded with pre-baked analyses derived by running hand-labeled transcripts through the real `enrich()`/`scoreTAU()` rather than hardcoding vectors — arcs 12→18→20, 5→6→8, and 9→12→12 with three integrity flags; no LLM call needed to browse reports. Full pipeline re-verified end to end (chat streaming, submit → real analysis → score in both student home and teacher dashboard) plus a cold start on an empty `app/data/`. Palette alignment deliberately deferred to the coming design-system pass — no existing tokens changed. Surfaced backlog #9 (PQ measuring lexical echo).
- **2026-07-17 (build session 5)** — Existing teacher dashboard adopted as the Phase F starting point (per design intent: triage layer + detail on demand). `teacher-dashboard.html` ported verbatim to `app/web/dashboard.html`; mock generator (240 lines) replaced by an API loader hitting `/api/teacher/dashboard`, which reproduces the mock data shape exactly — all dashboard render code unchanged. Drill panels now deep-link: "Report →" per submission (teacher-mode report), "Conversation view →" (`teacher.html` hash route). Yesterday's `teacher.html` repositioned as the detail layer behind the dashboard. Original `teacher-dashboard.html` untouched.
- **2026-07-17 (build session 4)** — Phase F: teacher side built on real data. `teacher.html`: assignment creation with per-slot coaching dial (default fade prefilled), roster with TAU/SAMR chips + flag markers, student detail = trajectory strip → conversation-ready moments → snapshot verbatim → integrity signals → full transcripts (labels, meta-turns, superseded turns, UI events interleaved chronologically) → teacher note (student sees it beside their snapshot). Report page gains `?role=teacher`: flags panel with ELL/IEP misfire disclosure. Role gate verified: student requests to teacher routes 403.
- **2026-07-17 (build session 3)** — CTA results presentation ported whole into the app: new `report.html` page reuses the CTA's CSS + render functions verbatim (agency chart with pattern detection, My Session dashboard, essay heatmap/concept inventory, pattern guide) fed from the report API instead of local parsing; simple hand-rolled report view replaced. AI-turn labels + turn quality computed client-side the CTA way. Added Groq 429 retry/backoff + reanalyze endpoint after free-tier TPM limit broke an analysis run. CTA `index.html` still untouched — code copied out, never modified.
- **2026-07-16 (build session 2)** — Design revision: **full TAU disclosure to the student at the submission marker** (score is part of the learning); the live-tracker prohibition stands — nothing shown mid-session. Phase E built and verified: `app/server/analysis.js` (classification + provenance/flags + `scoreTAU` ported verbatim from CTA + snapshot narrative), async after submit, report endpoint gates flags to teacher role. Student report view: SAMR hero, TAU dimension cards, provenance breakdown, quoted strengths + growth moves + coaching-level bridge. Test run: 5-turn session scored PQ 4 / SU 5 / CS 2 / OC 4 → Modification; flag gate verified both roles.
- **2026-07-16 (build session 1)** — Local-first build: `app/` created with zero-dep node server + three prod seams (auth/llm/store). Phases B & C functional end-to-end: streaming coach chat at all three coaching levels, blank-context conversations, auditor Evaluate, submit→lock→next-cycle flow verified (cycle 2 opened at `questions` level), all seven event types logging. Turns append-only (`meta.supersedes` for edit/regenerate). CTA `index.html` untouched.
- **2026-07-16** — Problem space developed and settled: cost model, architecture, guiding principle, session-per-cycle flow, gen-AI mimicry boundaries, scaffolding fade, three-timescale feedback (Evaluate / snapshot / trajectory), teacher conversation view, unlimited conversations, teacher-lens gap review (2 points rejected and revised: gifted-writer blind spot → library-lineage positioning; rubric integration → teacher enablement). Preservation commit `1b1c36c`.
