# Patterns — behavioural detection design and validity

**Scope of this file.** What counts as a *pattern* (as opposed to a score or a flag), the catalogue of
pattern detectors, how each is computed, and whether it is valid. Also owns the **level-signal vs
pattern** split and the cohort-relative scoring rule that bounds the teacher's triage queue.

**Not in this file.** Dimension definitions, scoring formulas and rubrics stay in `tau-dimensions.md`.
Dashboard IA, where patterns are displayed, and the flag/signal *surface* stay in
`teacher-dashboard-design.md`. Infrastructure, phases and cost stay in `built-in-chat-plan.md`.
Overlaps: detectors are implemented in `app/server/analysis.js` (shared with `tau-dimensions.md`), the
rollup and cards live in `app/web/dashboard.html` (shared with `teacher-dashboard-design.md`).

**Status (2026-08-14): the central claim of this file's first two versions was wrong.** They said
"nothing built" and specified six detectors from scratch. **A thirteen-detector library was already
shipping** — `detectPatterns(classified)`, written, tiered high/low, running on every student report.
It was invisible to this file because it lived in the browser (`report-render.js`) and ran at render
time, so its output reached the student and was never stored, never aggregated, and never seen by a
teacher. Absence from the teacher surface was read as absence from the codebase.

Corrected below. What is *actually* true:

- **Detection exists and is now server-side.** Moved to `app/web/patterns-core.js` (one copy, required
  by `analysis.js`, loaded as a script by `report.html`), called from `runAnalysis`, stored as
  `patterns` on the analysis doc. `backfill-patterns.js` recomputes it over history for free.
- **Four of the six detectors specified here duplicate shipped ones**, under different definitions —
  see *Catalogue*. Building them as written would have contradicted what students have already been
  told about their own sessions.
- **Four detectors have no threshold at all** — the interaction moments, which this file missed
  entirely. They are the ones a teacher can be shown today.
- **What is still blocked is thresholds, not detection.** "3 consecutive extractions", "4 alternating
  turns", "3 pivots" are guesses, and the run that would set them **cannot use seed data** — see the
  warning in *Validation plan*.
- **What is still unbuilt is the teacher surface**: payload, aggregation, cards.

The status paragraph this replaced is kept in the session log, because *how* it was wrong is the
reusable lesson: this file was written from the dashboard inward and never grepped the report.

**Read `tau-dimensions.md`'s *The measurement model* section before changing anything here.** The four
dimensions are facets of one construct on a 2×2 grid, and the shared-evidence rule (two measures may
correlate, but must not increment off the same observed event) applies to patterns exactly as it does
to dimensions. That rule already cost this file one detector — see *Divergence*.

---

## Why this matters

Two separate jobs are currently being done by one mechanism, badly.

**Triage** — "which students should I talk to this week?" This must be bounded. At 50–100 students, a
list that names 70 of them carries no information and produces flag fatigue; the teacher clears it by
ignoring it. Bounded-ness is a design requirement, not a nice-to-have.

**Teaching** — "what should I teach next week?" This is the opposite: when most of a class shows the
same behaviour, that *is* the finding, and suppressing it because it isn't exceptional would hide the
most actionable thing on the page.

A single threshold cannot serve both. Below a common cutoff, a weak class floods triage; above one, a
class-wide problem vanishes. The split in this file exists to let each job have its own rule.

---

## What the code computes today

**Two separate layers, and this file originally described only one of them.**

### Layer 1 — the real detectors (`patterns-core.js`)

Thirteen, tiered, reading turn order and the two-sided record. Now server-side and stored on every
analysis doc.

| Tier | Detectors |
|---|---|
| High agency | Challenge Arc · Rejection → Redirect · Claim-Support Cycle · Argument Engaged · Held Ground · Questioned Assertion |
| Medium | Extraction → Insight (elevates to high when the AI was arguing) |
| Low agency | Extraction Loop · Validation Spiral · Helplessness Loop · Flitting · Missed Argument · Capitulation · Unquestioned Assertion |

**The interaction moments are the part this file never imagined.** Four of the thirteen key on the AI
turn *and* the student's reply together: the AI corrected them — did they hold or fold (Held Ground /
Capitulation); the AI asserted a definition — did they question it or take it (Questioned /
Unquestioned Assertion). They read a fifth source this file's *What qualifies as a pattern* table
doesn't list — see the amendment there — and, being single-turn two-sided reads, **they carry no
threshold**, so nothing gates them.

**This layer also gives the file a high-agency vocabulary it lacked.** Every detector specified here
names a deficit. Six shipped ones name a competence, which is what makes a teacher surface something
other than a list of who is failing.

### Layer 2 — the naming layer (`dashboard.html`)

`TREND_META` (`app/web/dashboard.html:1554`) defines four patterns. `REASON_TO_TREND`
(`dashboard.html:1585`) maps five signal reasons onto them. `detectTrends()` (`dashboard.html:1621`)
iterates students, reads `getStudentSignal()`, and groups the attention-tier signals it finds — so a
pattern is an aggregation *of the per-student signals*, never of anything else.

Each signal reason, traced back to `_computeStudentSignal()` (`dashboard.html:1677`):

| Pattern | Detected by |
|---|---|
| `low-skepticism` | `avgCS < 2.5` |
| `ai-ideas` | `avgOC < 2.5` |
| `passive` | `avgTotal < 9`, **or** `avgCS < 2.5 && avgPQ < 2.5` |
| `declining` | ≥3 submissions and last total < first total − 2 |

### The finding

**Three of the four patterns are a dimension threshold wearing a prose name.** `low-skepticism` *is*
`avgCS < 2.5`. `ai-ideas` *is* `avgOC < 2.5`. `passive`'s conjunction is a co-decline, catching only
students already inside both single-dimension sets. Nothing in the pattern layer reads anything the
dimension layer didn't already produce.

The tell is in the copy. `TREND_META.passive.what` (`dashboard.html:1559`) reads *"They validate and
extract rather than challenge and refine — the AI leads the conversation, not the student."* That
describes a **turn-level shape**: a run of extraction and validation moves with no challenge between
them. Nothing detects that. It is inferred from an average being under 9, and the prose is doing
descriptive work the detector never did.

Two consequences. The pattern cards make claims the detection can't support. And because patterns are
computed *from* the per-student signals, making those signals cohort-relative (to bound triage) would
propagate relativity into the pattern cards — so the louder a class-wide problem got, the quieter the
display would become. Fixing triage volume without this split actively breaks the teaching view.

---

## What qualifies as a pattern

The dimensions are themselves label aggregates, so **any per-student count over turn labels will
re-derive a dimension.** That is how the current layer collapsed. What the scoring formulas discard is
*order* and *time*, and what they can't express is *disagreement between dimensions*. Hence three
legitimate sources and one disqualifier:

| Source | What it uses | Example |
|---|---|---|
| **Sequence** | order/adjacency of turn labels within a session | Validation spiral |
| **Trajectory** | a dimension across submissions over time | `declining` |
| **Divergence** | two dimensions contradicting each other at the same time | High CS + low SU |
| **Interaction moment** | one AI turn paired with the student's reply to it | Capitulation, Held Ground |
| ~~**Co-decline**~~ | two dimensions both low | `passive` — **disqualified** |

**Interaction moment added 2026-08-14**, on discovering four already shipping. It is a distinct
source, not a special case of sequence: sequence reads *the student's own turns in order*, and this
reads *one turn from each side, together*. The AI's move is what makes the student's meaningful — a
`validation` after an AI **correction** is a capitulation, and the identical `validation` after an AI
**example** is nothing at all. No dimension reads the AI's labels, so this cannot re-derive one, and
it satisfies the checkable test below decisively: no count of student labels reproduces it.

**Why co-decline is disqualified.** It adds no information beyond the levels it is built from — every
student it catches is already in each single-dimension set. It is "low twice" with a name.

**Why divergence qualifies.** A high-PQ/low-OC student trips no threshold anywhere and appears on no
list today, at any cutoff. Divergence patterns are invisible to the level layer by construction, which
is exactly what makes them worth detecting separately.

**The checkable test, for anything proposed later:** *could this be reproduced by counting labels or
thresholding a dimension average at a single point in time?* If yes, it is a level, not a pattern.

---

## Catalogue

Six live detectors, two parked, one withdrawn. Definitions are the design intent; every numeric threshold is a
strawman pending the seed run.

> **Read this before building anything below — added 2026-08-14.** Four of the six already exist in
> `patterns-core.js`, under **different definitions**, and the shipped ones are what students have
> already been shown. Each entry now carries a **Shipped as** line. Where the two disagree, the
> shipped definition wins by default and any change to it is a deliberate decision about existing
> student reports, not a fresh spec. The mapping:
>
> | Specified here | Shipped as | Same detector? |
> |---|---|---|
> | #1 Validation spiral | `validation-spiral` | **No** — different shape *and* different threshold |
> | #4 Pivot churn | `flitting` | Yes, and its threshold is already set |
> | #5 Post-extraction drift | `extraction-loop` + `helplessness-loop` | Overlapping, not identical |
> | #2 Abandoned challenge | `capitulation` | **No** — related, and the difference matters |
> | #3 Ownership fade | — | Genuinely new |
> | #6 Declining | — | Genuinely new (trajectory, cross-submission) |

### Sequence

**1. Validation spiral** — ≥3 consecutive student turns drawn from {`extraction`, `validation`} with no
`claim`/`conceptual`/`challenge`/`rejection`/`refinement` breaking the run.
*Not a dimension:* CS counts pushback as a rate over the whole session; this counts uninterrupted runs.
Two sessions with identical CS can have zero and three spirals respectively.
*Threshold at risk:* run length 3. Needs the label-volume check below.
***Shipped as `validation-spiral` — and it is not this detector.*** The shipped one requires the two
labels to **alternate** (`labels[i] !== labels[i+1]`) and the span to be **≥4**; this spec requires
neither alternation nor more than 3. Three extractions in a row fire this spec and are invisible to
the shipped one — they fire `extraction-loop` instead. **Two different behaviours under one name is
the worst of the three outcomes here**, because a teacher card and a student report would use the same
words for different findings. Resolve the name before either is surfaced to a teacher.

**2. Abandoned challenge** — a `challenge`, `rejection` or `refinement` turn whose **next student turn**
is `extraction` or `validation`. Pushed back, then took the answer anyway.
*Not a dimension:* CS scores this as **good** — it counts the pushback and never looks at what followed.
This is the case where the dimension and the behaviour point in opposite directions.
*Cheap to compute:* `followedBy` already exists on every student turn (`analysis.js:198`).
***Shipped as `capitulation` — related, and the difference is worth keeping both.*** Capitulation fires
when **the AI** corrects and the student folds; this fires when **the student** pushes back and then
folds regardless of what the AI did. Capitulation is an interaction moment, this is a sequence. They
catch different students: a student who never pushes back but folds under every correction trips
capitulation only; a student who challenges into silence trips this only. **Build it, and keep the
names distinct** — this one is still genuinely missing.

**3. Ownership fade** — `claim`/`challenge` turns concentrated in the first third of a session and
absent from the final third.
*Not a dimension:* within a single session. Distinct from `declining`, which is across submissions.
*Threshold at risk:* thirds are arbitrary; short sessions may not support the split at all — needs a
minimum turn count.

**4. Pivot churn** — repeated `pivot` turns with few turns between them. Threads opened, never developed.
*Not a dimension:* no dimension reads `pivot` at all.
*Threshold at risk:* both the pivot count and the spacing. `pivot` volume is entirely unmeasured.
***Shipped as `flitting`, with both numbers already set*** — ≥3 pivots, spacing defined as "no
high-agency or conceptual turn in between." So this entry's "entirely unmeasured" was wrong about the
spec, not just about the volume: the detector shipped, and a pivot count now falls out of
`backfill-patterns.js` for free. **Don't build this. Rename the entry to `flitting` and check its
volume.**

**5. Post-extraction drift** — an `extraction` turn whose next student turn is also low-agency
(`extraction`, `validation`, `stuck`). Asked the AI to do the work, then did it again.
*Provenance:* this **was SU** (`highFollowups / extractionEvents`). It moved here on 2026-08-10 when SU
was redesigned around discrimination over AI-offered material — see `tau-dimensions.md`. It is a
turn-order shape, which is this file's subject, and it was never a statement about what the student
*used*, which is what the name *Selective Use* claims.
*Not a dimension:* no dimension reads it any more, by construction. Nothing else in the system looks at
what follows an extraction.
*Free to build:* the logic already exists and is already correct — `followedBy` plus the `LOW_AGENCY`
set — so this is a relocation, not a new detector. Do it in the same pass that changes SU, or the
signal is lost in the gap.
*Known weakness inherited:* the original was a ratio over extraction events, so one extraction with one
bad follow-up read as total failure. As a pattern it should be a count with a floor, not a ratio.
***Shipped as `extraction-loop` (3+ consecutive extractions) and `helplessness-loop` (a `stuck` turn
followed by more passivity) — overlapping, not identical.*** Both are already runs with a floor, which
is the shape the "known weakness" above asks for, so that weakness is resolved rather than pending.
What the pair does **not** cover is `extraction → validation`: passivity that changes form. Either
extend `extraction-loop` or accept the gap deliberately — do not add a third detector overlapping both.
*Coupling note, unchanged:* this still must move out of SU in the same pass SU is redesigned, or SU and
a pattern increment off the same event, which the shared-evidence rule forbids. **That coupling is now
live**, because these detectors are stored per submission today while the old SU formula still runs —
so the two overlap until SU changes. Acceptable only because nothing surfaces them to a teacher yet.

### Trajectory

**6. Declining engagement** — ≥3 submissions, last total < first total − 2. **Unchanged from the current
implementation**; it was always a legitimate trajectory pattern.
*Worth revisiting later:* first-vs-last ignores the shape between, so a dip-and-recover reads as flat and
a late collapse reads the same as a steady slide.

### Divergence

**High CS, low SU — WITHDRAWN 2026-08-10, same day it was proposed.** *"Challenges the AI, then uses the
output anyway"* was a genuine divergence against the *old* SU (post-extraction turn order). The SU
redesign in `tau-dimensions.md` makes SU a **rate conditional on CS** — of the pushback that occurred,
what proportion changed what survived — so this divergence is now precisely what the dimension itself
computes. Building it as a pattern would double-count against the dimension, which the shared-evidence
rule forbids.

Recorded rather than deleted because it is the clearest worked example of a trap this file exists to
avoid: a valid pattern can be *invalidated by a change to a dimension it was defined against*. Any
divergence detector here has a dependency on two dimension definitions, and must be re-checked whenever
either moves.

**What survives:** the convergence check. **Abandoned challenge** (#2) is the turn-level signature of
what conditional SU measures in aggregate. If the detector and the dimension systematically disagree
about a student, one of them is wrong — and that check is now more valuable, not less, because it
crosses a pattern against a dimension rather than one pattern against another.

### Parked — blocked on PQ

Both are specified now so they are ready when PQ is reworked, rather than rediscovered later.

**7. High PQ, low OC** — drives the conversation, but the essay's ideas are still the AI's. Probably the
most pedagogically interesting pattern on this list.

**8. High OC, low PQ** — brings their own ideas, never drives the conversation. Uses the AI as
transcription.

**Why parked:** PQ reads 5 on nearly every transcript, so "high PQ" is an artefact, not a measurement.
Either would fire on most of a roster. **Do not build these until PQ discriminates.** Both are phrased
against PQ-as-initiative (`tau-dimensions.md`, PQ redesign), not against the current `responsive`-based
PQ — under the old definition "high PQ" means little more than "held a conversation".

### Retired

`passive`, `low-skepticism`, `ai-ideas` cease to be patterns and become level signals (below). Keeping
them alongside the six would put two competing pattern vocabularies on Home.

---

## Consequence for the teacher surfaces — added 2026-08-12

**Written because `tau-dimensions.md` asks for it by name**, and because the thing it prevents will
look entirely reasonable right up until it is wrong.

The dimensions are **ordinal bands, 1–4 or "not enough here."** So:

- **A class mean of a dimension is not a number.** Report the **distribution** — how many students
  in each band. A "class average PQ" tile is the specific thing this paragraph exists to stop.
- **The four are never summed and never averaged.** They are measured in four different units
  (discourse segments, AI claims, directed changes, essay ideas). Numbers in different units can be
  read side by side; they cannot be combined.
- **A count never becomes a band.** Counts display *beside* a band so a reader can check it.

Every teacher surface is respec'd against this in `teacher-dashboard-design.md` (2026-08-12) — see
*The unit of every aggregate* there, which is the authority on rendering. This file stays the
authority on what a pattern is.

**Two consequences land in this file specifically:**

1. **The cohort-relative rule below does not survive the ordinal scale.** See the amendment on
   *Level signals vs patterns*.
2. **`detectPatterns` is now on the teacher dashboard's critical path**, not parallel work. Three of
   the four `TREND_META` cards are dimension thresholds (see *The finding*); when the thresholds go,
   those cards have no detector at all and Home's pattern section is mostly empty until the six
   detectors in *Catalogue* ship. The *Pipeline* section below is that build order.

---

## Level signals vs patterns

**Amended 2026-08-12 — the cohort-relative half is retired.** The split itself (a level signal asks
who stands out, a pattern asks what shape is occurring) is unchanged and still load-bearing. What
doesn't survive is **bottom-decile scoring**: it was designed against a continuous score, and on a
four-value ordinal a percentile is mostly ties, with the absolute floor underneath doing all the
work anyway. So **band 1 is the flag**, absolutely.

The guardrail the decile rule existed to provide is inherent in an absolute band rather than lost:
a class where nobody sits at band 1 correctly produces zero flags, which is exactly what the
"a student at OC 3.8 in a strong room is not worth a teacher's attention" case was asking for. The
minimum-cohort-size guardrail becomes moot with no percentile to compute.

**Volume is therefore unbounded on both sides of the table now**, which reverses this section's own
"bounded by construction" column. Handled at the surface instead of in the scoring: the triage tile
carries its denominator and the copy turns over past a proportion, so a class-wide problem reads
*louder*, not quieter — see `teacher-dashboard-design.md`, *Triage queue inputs*. That was
always the real requirement; bounding the count was one way to meet it and not the only one.

The original text follows.

The same underlying scores, asked two different questions, computed two different ways.

| | Level signal | Pattern |
|---|---|---|
| Question | Who stands out from the room? | What shape is occurring, and how widely? |
| Scoring | **Cohort-relative** — bottom decile | **Absolute** — the shape occurs or it doesn't |
| Surface | Per-student triage queue, "Worth a chat" | Home pattern cards |
| Volume | Bounded by construction (≤~10% of a class) | Unbounded by design — that's the point |

**Two guardrails on the relative rule:**

- **Absolute floor.** Flag = bottom decile **and** below the absolute bar. Pure percentile always finds a
  bottom decile, including in a class where everyone is doing well; a student at OC 3.8 in a strong room
  is not worth a teacher's attention. In a strong class this correctly yields zero flags.
- **Minimum cohort size.** "Bottom decile" of a class of 8 is 0.8 students. Below roughly n=12 the
  percentile is noise — fall back to absolute-only. **Cohort = the class**, not the teacher's full
  roster: the class is the room the student is actually in.

Patterns need neither guardrail. A behavioural shape is not a percentile, so the cohort-dependence
problem never arises — which is what makes the class-wide case surface correctly.

**Pattern card threshold.** `detectTrends` currently fires a card at `minCount = 2` students
(`dashboard.html:1610`). Once cards are proportion-based that is the wrong unit — 2 of 90 is not a
pattern, 2 of 8 might be. Proposed: **≥25% of the cohort**, with a small absolute floor so a small class
can still trigger one. Both numbers are guesses.

---

## Pipeline

**The data already exists.** `classified` — every turn with `label`, `responsive` and `followedBy` — is
stored in full on each analysis doc (`analysis.js:449`, written by `runAnalysis`). Sequence detection
needs **no new LLM calls and no re-analysis**, and can be backfilled over every historical submission
for free.

**The gap:** the dashboard payload carries only the four scores plus `integrityFlags`
(`index.js:1986`). Turn labels never reach the browser, and shipping full transcripts to it to detect
client-side would be the wrong shape — detection belongs next to the data.

Build order — **steps 1–3 are done as of 2026-08-14**:

1. ~~`detectPatterns(classified)` in `analysis.js`~~ — **done, by moving rather than writing.** It
   already existed in `report-render.js`; it now lives in `app/web/patterns-core.js` as the single
   copy, required by `analysis.js` and loaded as a `<script>` by `report.html`. It sits under `web/`
   because that is the only direction that works without a build step — the server can require a
   browser script, the browser cannot require a server module. Returns ids, tiers **and `start`/`end`
   turn spans**, so the evidence-indices requirement was already satisfied. Display copy stays with
   each surface; this file owns what was detected and where.
2. ~~Called from `runAnalysis`, stored as `patterns`~~ — **done**, alongside `classified`. Also wired
   into `seed.js`, derived rather than authored.
3. ~~Backfill script~~ — **done**: `backfill-patterns.js`, dry-run by default, `--write` to persist.
   **It is also the label-volume instrument** — it prints per-label and per-pattern counts over every
   stored analysis, which is backlog #1. That check was never gated on new infrastructure; it was
   gated on a corpus, and it now runs over whatever corpus exists.
4. Dashboard payload gains `patterns` per submission (`index.js:1986`). **This is the first unbuilt
   step** — detection is no longer the blocker, the teacher surface is.
5. `detectTrends` reads submission patterns instead of `REASON_TO_TREND`; level signals split off and go
   relative in `_computeStudentSignal`.
6. `TREND_META` copy rewritten for the six; **the prose must describe what the detector actually reads** —
   that mismatch is what produced the current layer's overclaiming.
7. `seed.js` runs the detector too, so demo data shows real patterns rather than none.

Trajectory (#6) is cross-submission, so it stays in the dashboard rollup rather than on the analysis
doc — a single submission cannot carry it. The five sequence detectors (#1–#5) are per-submission and
belong on the analysis doc. With the divergence detector withdrawn, nothing in the live set needs to
read two dimensions at once.

---

## First backfill run — 2026-08-14

`node app/server/backfill-patterns.js` against `cta-pilot-dev`, 51 analyses with turns.

> ⚠️ **These numbers set no threshold.** This is the demo project — largely one authored transcript
> per tier cloned across students (`seed-data.js`), so the counts are not 51 independent observations.
> Per *Validation plan* below, seed data is disqualified for calibration. What a run like this **can**
> establish is the one thing that doesn't depend on distribution shape: **whether a detector is
> capable of firing at all.** Two structural findings below are of that kind and hold regardless.

| Label | n | | Label | n |
|---|---|---|---|---|
| extraction | 145 | | narrative | 52 |
| refinement | 103 | | challenge | **45** |
| claim | 68 | | rejection | 38 |
| validation | 67 | | stuck | 5 |
| conceptual | 53 | | **pivot** | **2** |

Patterns fired: `extraction-landing` 46 · `rejection-redirect` 17 · `extraction-loop` 9 ·
`challenge-arc` 8 · `validation-spiral` 6. **Eight of thirteen fired zero times.**

### Finding 1 — six detectors are structurally dead: AI turns are never labelled

`enrich()` assigns `label` **only to student turns** (`analysis.js`); `classifyStudentTurns` is exactly
what its name says. Every AI turn carries `label: null`, and `getAILabelBefore` falls back to
`"content"` for all of them. So every detector keyed to an AI label can never fire in `app/`:

| Detector | Needs | Can fire? |
|---|---|---|
| Held Ground / Capitulation | AI `correction` | **No** |
| Questioned / Unquestioned Assertion | AI `definition` | **No** |
| Argument Engaged / Missed Argument | AI `argument` | **No** |
| Extraction → Insight | AI `argument` to reach `high` | Fires, permanently capped at `medium` |

This is a port gap, not a design flaw. The CTA classifies AI turns too — `CLAUDE.md` Phase 2 lists the
six AI labels (`correction`, `instruction`, `example`, `argument`, `definition`, `content`) — and the
built-in chat pipeline dropped them. `report-render.js` was written against a two-sided record it has
never actually received.

**This inverts the recommendation made earlier the same day.** The interaction moments were identified
as the four detectors to surface first *because* they carry no threshold. True and irrelevant: they
carry no threshold and **no input**. They are the most valuable detectors in the system and the
furthest from working, and the unlock is one prompt change — label AI turns — not a calibration run.

### Finding 2 — `flitting` cannot fire

`pivot` = 2 occurrences across 51 analyses, and the detector needs 3 in one session. `patterns.md`
recorded `pivot` volume as "completely unmeasured"; it is now measured, and the answer is
approximately zero. **This one survives the seed-data caveat**: authored transcripts would *over*-state
a deliberate behaviour like pivoting, not hide it. Either the classifier doesn't assign `pivot`, or
students don't pivot. Check which before touching the detector.

`helplessness-loop` also fired zero (`stuck` = 5, no runs) — too thin to conclude anything from.

### What actually works today

Five detectors, all student-side sequences: `extraction-landing`, `rejection-redirect`,
`extraction-loop`, `challenge-arc`, `validation-spiral`. **That is the honest inventory for a teacher
surface right now** — and note that two of the five (`rejection-redirect`, `challenge-arc`) are
high-agency, so a competence card is available immediately.

---

## Validation plan

Adapted from `tau-dimensions.md`'s *Validation plan*. Same standard: *a detector that discriminates on four transcripts
is not a validated detector.*

> ⚠️ **Read `tau-dimensions.md`'s *Do not validate against seed data* first — established 2026-08-10.**
> Every step below was written to run against the four seed tiers, and seed transcripts are now known
> to carry structure real sessions don't (measured: turn length predicts agency label at d = 0.83 in
> seed data, d = 0.12 in the one real transcript). Steps 1–3 in particular — label volumes and
> threshold-setting — would calibrate these detectors on an authoring artifact. **Run them against
> real transcripts.** Seed runs are useful only as a smoke test that the code executes.

1. **Label volume check — do this first.** Count `extraction`, `validation`, `challenge`, `rejection`,
   `refinement`, `claim`, `pivot` across the seed tiers. A detector keyed to a label that barely occurs
   cannot fire, whatever its threshold. **`challenge` is already known to be near-extinct** (0 across
   three tiers — see `tau-dimensions.md`, *Cross-cutting: label validity*) — which is why *abandoned
   challenge* keys on three labels, not
   one. `pivot` volume is completely unmeasured.
2. **Known-groups.** The `flat` tier should show validation spirals; the `strong` tier should not. Pass =
   clear separation, not a one-instance wobble.
3. **Threshold setting.** Run-length, thirds, and pivot-spacing get their numbers from the distributions
   this run produces, not from the guesses in this file.
4. **Convergence.** Do *abandoned challenge* (sequence) and *high CS / low SU* (divergence) agree on the
   same students? Systematic disagreement means one of the two is measuring something else.
5. **Volume simulation.** Against the demo roster, how many students does each detector name? A detector
   that fires on most of a cohort has failed the triage requirement even if it is "correct".
6. **Stability.** Same transcript, 3 runs at temperature 0.1 — a pattern must not appear and disappear
   across runs of the classifier underneath it.

---

## Known weaknesses

**Sequence detectors are more label-fragile than dimensions are.** The classifier agrees with the
hand-authored seed labels roughly half the time (`tau-dimensions.md`, *Cross-cutting: label validity*).
A ratio over 40 turns averages that noise out; a run-of-3 detector can be created or destroyed by a
single mislabelled turn. **The label-validity ceiling therefore binds harder here than it does on the
scores**, and this may need resolving before any threshold in this file is trusted.

**The seed transcripts are authored in-house**, so known-groups is n=4 and tests the detectors against
their author's idea of the behaviour — the same circularity `tau-dimensions.md` flags about its own
floor and ceiling tests. The genuinely external check is teacher adjudication (below).

**No recall instrument.** Everything here measures whether what we surface is right. Nothing measures
what we failed to surface, because misses are invisible. This would need a way for a teacher to flag a
student the system didn't — which does not exist.

---

## What "good enough" is measured against

Stated so tuning passes have a bar, in the role `tau-dimensions.md`'s validation plan plays for scores.

1. **Volume** — a queue a teacher can clear in one sitting, bounded as a proportion of roster.
2. **Precision** — most of what's raised gets acted on. A detector routinely raised and routinely ignored
   should be **retired, not retuned**.
3. **Recall** — no student a teacher independently worried about was absent from the queue.
4. **Stability** — a student doesn't flicker in and out draft to draft on noise.
5. **Cohort independence** — a strong class and a weak class both produce a workable queue length.

**Where the current design lands:** relative scoring addresses 1 and 5. The `Noted` disposition (see
`teacher-dashboard-design.md`) makes 2 *measurable* — a teacher clearing a flag without acting is
telling you it was a false positive, per detector, on real teachers rather than on transcripts we wrote
ourselves. That sidesteps the circularity above. Caveat: bulk clears from a pattern card are
queue-clearing, not judgement, and must be counted separately from single-row clears. 3 and 4 remain
unmeasured and undefined.

---

## Backlog

1. Label volume check — **the instrument now exists** (`node app/server/backfill-patterns.js`, dry run,
   prints label and pattern counts). Still **against real transcripts, not seed tiers** (see the
   warning in *Validation plan*); a run against `cta-pilot-dev` counts authored data and sets nothing.
   Blocks every threshold, and is blocked in turn only by corpus size. **First run done** — see
   *First backfill run*.
1a. **Label AI turns.** Six detectors cannot fire without it, including all four interaction moments.
   One prompt change; the labels are already specified in `CLAUDE.md` Phase 2. **This now outranks
   every remaining item in this list** — it is the difference between five working detectors and
   eleven, and no threshold work is needed to get there.
1b. **Diagnose `pivot`** — 2 occurrences in 51 analyses. Classifier problem or real absence? `flitting`
   is dead either way until this is answered.
2. ~~`detectPatterns()` + evidence indices~~ — **done 2026-08-14.** Remaining detector work is narrower
   than this line implied: **#3 ownership fade** and **#2 abandoned challenge** are genuinely missing;
   #1 and #4 exist under other definitions; #5 is substantially covered.
3. ~~Backfill, `seed.js`~~ — **done.** Remaining: payload, `detectTrends` rewrite.
   **3a. Resolve the `validation-spiral` name collision** before anything reaches a teacher — the spec
   and the shipped detector describe different behaviours under one label.
4. Level signals → cohort-relative, with both guardrails.
5. `TREND_META` copy rewritten against what each detector actually reads.
6. Pattern card proportion threshold — set from the volume simulation, not guessed.
7. **Coupled to `tau-dimensions.md`:** *post-extraction drift* (#5) must land in the same pass that
   redesigns SU, or the signal disappears in the gap between the two changes.
8. **Blocked on PQ:** divergences #7 and #8, both phrased against PQ-as-initiative.
9. **Open:** recall instrument — a way for teachers to flag students the system missed.
10. **Open:** `declining` uses first-vs-last only, ignoring the shape between.
11. **Standing check:** every divergence detector depends on two dimension definitions. Re-verify them
    whenever a dimension moves — one was withdrawn the day it was written for exactly this reason.

---

## Session log

- **2026-08-14 — this file was wrong about its own subject; detection moved server-side.** Started
  from the dashboard lab's placeholder note ("until `detectPatterns` ships, this section is mostly
  empty") and grepped for what existed before writing it. **`detectPatterns` had shipped** — thirteen
  detectors in `report-render.js`, running client-side on every student report.

  The superseded status line, kept verbatim as the lesson: *"design agreed, nothing built, and
  blocked … Six detectors are specified here; none exists in code."* **How it went wrong:** this file
  was written from the teacher dashboard inward. `TREND_META` was traced back through
  `_computeStudentSignal` and correctly found to be a naming layer — and "the teacher surface has no
  detectors" became "the codebase has no detectors" without anyone grepping the student report. Two
  versions and a full catalogue were built on it. **Standing lesson: absence from one surface is not
  absence from the system.**

  What it cost: four of six specified detectors duplicate shipped ones, one of them
  (`validation-spiral`) under a **different definition with the same name** — building it as specified
  would have contradicted reports students have already read. And the file missed the
  **interaction moments** entirely, which are both a fifth pattern source and the only four detectors
  in the system with no threshold to calibrate.

  **Built:** `patterns-core.js` (single copy, server + browser), required by `analysis.js`, called in
  `runAnalysis`, stored as `patterns` on the analysis doc, derived in `seed.js`, and
  `backfill-patterns.js` — which turned out to *be* backlog #1's label-volume check, never gated on
  anything but corpus size. No detector logic was changed in the move, deliberately: thresholds are
  marked as guesses in place rather than corrected, because changing them mid-move would silently
  alter what students have been told. **Unchanged: every threshold is still a guess, and the teacher
  surface is still unbuilt** — but the blocker is now the payload and the cards, not detection.

  **Then the backfill immediately falsified the day's own recommendation.** Its first run (see *First
  backfill run*) showed eight of thirteen detectors firing zero times, and the reason for six of them
  is structural: **`app/` never labels AI turns**, so every two-sided detector is reading a constant.
  The interaction moments had been called the safest to surface first because they need no
  calibration — correct, and useless, because they also receive no input. Worth keeping as a method
  note: **the run that was framed as "set the thresholds" was worth doing for a reason nobody
  predicted** — it answered *can this fire at all*, which needs no distribution and would have been
  caught at any corpus size, including this one.

- **2026-08-12 — ordinal scale landed; cohort-relative scoring retired, `detectPatterns` promoted.**
  Came out of respec'ing the teacher dashboard for `tau-dimensions.md`'s settled band/level scale.
  Wrote the *Consequence for the teacher surfaces* section that file asks for by name (distribution,
  never a mean). Retired the bottom-decile rule — a percentile over four ordinal values is mostly
  ties, so band 1 is the flag directly, and triage volume is bounded at the surface (denominator on
  the tile, copy turning over past a proportion) rather than in the scoring. Recorded that
  `detectPatterns` is now a blocker for Home rather than parallel work: three of the four current
  cards lose their detectors outright when the dimension thresholds go. No code; the analysis
  signature change still gates everything.

- **2026-08-10 — file created; pattern layer found to be a naming layer.** Started from a triage
  question (how does a teacher retire a "Worth a chat" flag, and what's the rule for showing missing
  work on Home) and traced it back through the signal code. Found that three of four pattern cards are
  dimension thresholds with prose names, and that `TREND_META`'s copy describes turn-level shapes
  nothing detects. Also found the coupling that made the volume fix dangerous: patterns are aggregated
  from per-student signals, so cohort-relative scoring would have suppressed exactly the class-wide
  case the pattern cards exist to show.

  Decisions taken: level/pattern split with relative and absolute scoring respectively; the three
  legitimate pattern sources (sequence, trajectory, divergence) and co-decline as the disqualifier; six
  live detectors and two parked behind PQ; `passive`/`low-skepticism`/`ai-ideas` retired as patterns.

  **Nothing built.** Every threshold here is a strawman, and the label volume check (backlog #1) may
  invalidate specific detectors before any of them is written — `challenge` is already known to be
  near-extinct, and `pivot` has never been counted.

- **2026-08-10 (same session, after the dimension work) — catalogue revised against the measurement
  model.** The conversation continued into `tau-dimensions.md` and settled the 2×2 grid plus the
  bifactor framing, which fed straight back here.

  **Gained a detector.** SU's redesign vacated the post-extraction turn-order logic
  (`highFollowups / extractionEvents`), which arrives as **#5 post-extraction drift**. Not new code —
  the logic exists and is correct; it changes owner. Must move in the same pass that changes SU or the
  signal is lost in between.

  **Lost a detector, the day it was written.** *High CS / low SU* was a valid divergence against the
  old SU. Conditional SU — of the pushback that occurred, what proportion changed what survived — now
  computes that divergence as the dimension itself, so building it here would double-count under the
  shared-evidence rule. Kept in the file as a worked example: **a divergence detector is defined
  against two dimension definitions and can be invalidated when either moves.** Added as standing
  backlog check #11.

  Net: six live detectors instead of six, but a different six — five sequence, one trajectory, zero
  divergence until PQ discriminates.

- **2026-08-10 (later, same day) — seed data disqualified as a calibration source.** A
  nuisance-variable check in `tau-dimensions.md` established that authored seed transcripts carry
  structure real sessions don't (turn length predicts agency label at d = 0.83 in seed data, d = 0.12
  in the one real transcript). **This file's entire validation plan was written against the four seed
  tiers**, so steps 1–3 would have calibrated every detector threshold on an authoring artifact.
  Warning added to *Validation plan*, backlog #1 rewritten.

  **Practical effect: this file is now blocked earlier than it looked.** Backlog #1 (label volumes)
  gates everything, and it needs real transcripts — of which there is currently one. Building the
  detectors against seed data would produce code that runs and thresholds that mean nothing.
