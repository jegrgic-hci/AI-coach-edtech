# Backlog

Cross-cutting work that doesn't belong to one design doc. **Per-file backlogs stay where they
are** — `patterns.md` (detectors and thresholds) and `built-in-chat-plan.md` (accepted product
gaps) own their own lists; this file is for work that spans files or has no owner.

---

## Documentation cleanup — logged 2026-08-15

**The problem, in one line:** three kinds of statement are interleaved in the same paragraphs and
look identical — **spec** (what is settled), **build state** (what the code does today), and
**history** (what was rejected and why).

`tau-dimensions.md` states the retired model is retired permanently, and also carries a live section
headed *What the code computes today* restating it. Both statements are true. Neither is marked as a
different kind of claim. The cost is real and recurring: a session gets derailed correcting a retired
formula that was surfaced as if current, and the correction costs more than the answer was worth.

**This file does not restate the retired measures.** Cleanup items below name the file and line to
fix and stop there — repeating the old formula anywhere it can be read as spec is what causes the
recurrence in the first place. `tau-dimensions.md`'s *The scoring foundation* is the only authority.

**Scale:** session logs are **2,808 of ~8,100 lines** across the five design docs —
`teacher-dashboard-design.md` 1,212 · `designsystem.md` 922 · `built-in-chat-plan.md` 381 ·
`tau-dimensions.md` 201 · `patterns.md` 92. Over a third of the design documentation is history
stored inside the spec.

### The target shape

| Kind of statement | Where it lives after |
|---|---|
| **Spec** — what is settled | The design doc, present tense, no dated corrections inline |
| **History** — why, what was rejected | `decisions-history.md` (new, one file, sectioned by source doc) |
| **Build state** — what the code does today | `app/README.md`, one "what's actually running" table |

Where a past mistake still constrains a future decision, **the spec keeps the rule as one line and
the history keeps the story.** `patterns.md` keeps *"absence from one surface is not absence from
the system"* as a standing check; the account of two versions built on that wrong premise moves out.

Session logs move **verbatim, not condensed** — the reasoning is cheap to keep and expensive to
reconstruct.

**One history file, not one per doc.** The cross-file corrections — the 2026-08-12 scale change
landed in four files at once — only make sense read together.

### Steps, highest leverage first

1. ~~**Fence `CLAUDE.md`'s Phase 3.**~~ **DONE 2026-08-17.** Phase 3 now opens with an
   `index.html`-only warning, and a new top-level section *The retired scoring model* sits above the
   fold with a three-row table separating the three populations (correct-for-`index.html` /
   retired-but-running in `app/` / history in the design docs). This file loads into every session
   automatically, so that table is the canonical statement — everything else points at it.
2. ~~**Fix `designsystem.md`'s self-contradiction.**~~ **DONE 2026-08-17.** Three *Locked decisions*
   rows corrected in place with dated amendment notes (scores-display, students-see-the-total,
   SAMR-is-a-subtitle), plus two incidental references in the component inventory and colour rules.
   The rows were amended rather than deleted — each records a real reversal worth keeping.
3. **Create `decisions-history.md`** and extract the five session logs plus every block currently
   marked *superseded* / *historical* / *withdrawn*.
4. **Consolidate build state into `app/README.md`.** "Nothing is built" currently appears in four
   files, which means four edits the day something ships — so it will go stale in at least one.
   **This is the change that most protects against recurrence.**
5. **`teacher-guide.md` (line 17) and `README.md` (lines 9, 26) still carry the retired scale.**
   `teacher-guide.md` is educator-facing, so this one leaves the repo.

### Known factual errors to fix in the same pass — found 2026-08-15

All in `patterns.md`, all verified against `app/web/patterns-core.js`. These are wrong facts, not
stale framing, so they mislead even after the spec/history split.

1. **"Thirteen detectors" — there are 14.** `extraction-landing` is absent from the tier table
   because its tier is computed rather than declared (`patterns-core.js:101`).
2. **"Eight of thirteen fired zero" — nine of fourteen fired zero.** *First backfill run* accounts
   for 8 (six AI-label-blocked, `flitting`, `helplessness-loop`) and misses one.
3. **`claim-support` is the unaccounted zero, and it is brittle by construction.** It requires the
   exact contiguous 4-turn sequence `claim → conceptual → extraction → claim`
   (`patterns-core.js:79-83`). At ~50% label agreement, four consecutive correct labels is very
   unlikely — this file's own *"a single mislabelled turn can destroy a sequence detector"* warning
   at its worst case. Decide whether to loosen it or retire it.
4. **"The CTA classifies AI turns too" is wrong** (*Finding 1*). The CTA's LLM call also says
   *"Classify each student turn"* (`index.html:2260`); its AI labels came from
   `classifyAITurnFallback()`, a **regex** match over `AI_PATTERNS` (`index.html:2027`). `app/`
   dropped the regex and replaced it with nothing. So `CLAUDE.md` Phase 2's claim that Call 1
   returns both student and AI labels has never been true in either codebase.
5. **Backlog 1a overstates the work.** Only three AI labels are read by any detector —
   `correction`, `definition`, `argument`. `instruction`, `example` and `content` are read by none.
   It is a 4-way call on the AI turns immediately preceding a student turn, not a 6-way call over
   all of them.

**Also worth a code fix, not a doc fix:** student labels default to `"extraction"` when missing
(`patterns-core.js:54`) — a low-agency label, so an unlabelled turn silently reads as passivity.
Same silent-default family as `getAILabelBefore`'s `|| "content"`. `enrich()` falls back to
`'narrative'` so it should rarely bite, but the default points the wrong way.

### Not in scope without a separate decision

**Rewriting `teacher-dashboard-design.md`'s body.** Extracting its 1,212-line session log is safe
and mechanical. Rewriting the remaining ~1,900 lines into a clean spec is a genuine rewrite —
much of the body is layered supersessions, and separating settled from historical there means
making judgement calls about what is still true. Do that one deliberately, with a decision on each
call, not in a bulk pass.

---

## Measurement — unblocks the teacher dashboard

Logged 2026-08-15 alongside the dashboard levels work. Detail lives in `tau-dimensions.md` and
`patterns.md`; these are here because they gate dashboard design specifically.

1. **Run test-retest.** Same transcripts, three runs, temperature 0.1, via the existing
   `POST /api/submissions/:id/reanalyze`. No new data, no hand labels. Until it exists, **you do
   not know whether a one-band difference is a real difference**, which puts every "improved /
   declined" affordance on hold. Single biggest constraint on what the dashboard may show.
2. **Check `AI_TURN_MAX_CHARS`** (`app/server/analysis.js:16`, used at `:245`). Provenance decides
   *"did the AI introduce this idea first"* against only the **first 400 characters** of each AI
   turn. AI turns in this product are long — drafts, tables, full sections — so ideas introduced
   late in a response are invisible to the origin trace and default to `student-born` / `prior`.
   That biases **OC upward, systematically, and worst on the sessions where the AI wrote the most.**
   Direction is structural; magnitude unmeasured. OC is a band on every dashboard surface.
3. **Label AI turns** — narrower than `patterns.md` backlog 1a states. Only three AI labels are read
   by any detector (`correction`, `definition`, `argument`); `instruction`, `example` and `content`
   are read by none. So it is a **4-way call on only the AI turns immediately preceding a student
   turn**, not a 6-way call over all of them. Unlocks six detectors — three matched pairs
   (rose / folded) that are the whole response-to-AI axis, and four of the six are competence-side.
   Also correct `patterns.md`: the CTA never sent AI turns to the LLM either — it regex-matched them
   locally via `AI_PATTERNS` (`index.html:2027`), and `app/` dropped the regex without replacing it.

---

## Home flow diagrams — open items, logged 2026-08-16

Built and shipped into `dashboard.html`; full rationale in `teacher-dashboard-design.md`'s session
log for the same date. These are the parts that are knowingly provisional.

1. **Every band on Home is a shim.** The four dimension flows read `bandFromLegacyScore()` off the
   retired ratios. Real bands need `scoreTAU`'s signature change — the same blocker as everything
   else in `tau-dimensions.md`. Nothing on this page is a measurement claim until then.
2. **`flowState`'s thresholds are guesses** — floor and ceiling both fire at >0.5 of the readable
   cohort. No data to fix them on, and per the standing rule they must not be calibrated on the
   demo seed.
3. **`FLOW_BUCKETS = 3` is a guess.** Three calendar buckets was chosen for a term; nobody has
   asked what a teacher wants to see, and the answer probably differs by term length.
4. **Dead code left in place**: `renderCompHTML`, `levelComposition`, `bandDistributions`,
   `bandsFinding`, `dimNote`, `dbarMarkup`, `keyItem`. Definitions with no call sites since the
   flow diagrams replaced Home's snapshot sections. Kept because the class and assignment tiers
   will want some of them; delete whatever is still unused once those are rebuilt.
5. **`class-lab.html` carries the same form on an assignment axis** and its `flowPaths()` is
   fixture-only scaffolding — it derives per-student paths from per-assignment counts. It gets
   deleted when real histories are read from `SUBMISSIONS`.
6. **The class and assignment tiers have not been rebuilt.** Only Home moved to the flow form. The
   four-level presentation inventory from this session — what each tier can defensibly show — is
   still only in conversation, not in `teacher-dashboard-design.md`.

---

## Promises the Pilot Agreement makes that the code does not keep — logged 2026-08-30

Both surfaced by checking the agreement's factual claims against the code rather than against the
design docs. **The agreement is a statement to a customer, not a draft clause for counsel** — the
same sentence carries a different weight there than in `legal/dpa-template.md`, which is why these
are tracked as build items rather than drafting notes.

1. **Teacher-facing export.** The agreement said *"You can export your class's work while your
   account is open."* No such surface exists — `export-improvement.js` is a CLI script producing a
   masked corpus for **our** measurement work, is not the teacher's own data, and is not reachable by
   them. The sentence has been left in as an intention; **build the export or cut the sentence
   before a real teacher accepts it.** Minimum viable version: the teacher's own classes as JSON —
   rosters, transcripts, submissions, readings — mirroring DPA § 7.7's format promise. Unmasked,
   since it is their own students' work going back to them.

2. **Deletion on request is manual, by decision** (2026-08-30). The agreement promises deletion of a
   student, a class, or everything within 30 days with confirmation. There is no account-, class- or
   student-level deletion path: accounts are **suspended, never deleted**, deliberately — a teacher
   owns classes, assignments and every submission against them, and deleting the account orphans all
   of it. For the pilot this is fulfilled by hand in the Firestore console, and the promise is
   keepable at pilot volume.

   **Two dependencies to keep in view.** It collides with the IAM least-privilege change: dropping
   `roles/owner` removes console access, so deletion would run through the break-glass grant — which
   is workable, and is exactly the kind of deliberate, logged act that grant is for. And DPA § 7.6
   promises a **certificate of destruction**, which no manual process produces; a school-signed
   deployment needs the real path.
