# Convolabel — reading, labelling and analysing a student's conversation

**Scope of this file.** The *conversation* as an object of measurement: which turns get classified,
what a turn label means on each side of the exchange, how the two sides combine into a readable
record, and how that record is drawn for a student. Owns the **AI-turn labelling gap** and the
turn-level visual (the *step plot*).

**Not in this file.** Dimension definitions, rubrics and scoring stay in `tau-dimensions.md`. What
counts as a pattern, the detector catalogue and its thresholds stay in `patterns.md`. Colour tokens,
band copy and component rules stay in `designsystem.md`. Teacher surfaces stay in
`teacher-dashboard-design.md`. Infrastructure, phases and cost stay in `built-in-chat-plan.md`.

**Overlaps.** Classification lives in `app/server/analysis.js` (shared with `tau-dimensions.md`).
Detectors live in `app/web/patterns-core.js` (shared with `patterns.md`) and this file changes only
their *input*, never their definitions. The student report renders in `app/web/report-render.js` and
`app/web/report-lab.html` (shared with `built-in-chat-plan.md`).

---

## Status — 2026-08-18 (second entry). The pipeline is built; the step plot is not.

**Backlog 1–3 are done.** `CLASSIFY_PROMPT` now asks for `aiLabel` on the AI turn it was already
printing as context, `studentTurnsWithContext` carries the coach turn object, `classifyStudentTurns`
returns `{ map, aiMap }` keyed by coach turn id, and `enrich` writes the label onto AI entries. The
seed's 76 coach turns were labelled by running that prompt over the transcripts once, offline, and
committing the output as literals in `seed-data.js`. `patterns-core.js` was not touched.

**Two of the six dead detectors now fire; four are still dark, and the reason matters** — see
*What the labels came back as*. Everything below this status block predates the build; the original
statement of the gap is kept because the reasoning is still the record:

> **AI turns are never given a label.** They are sent to the classifier as *context* for the student
> turn that follows, and are then discarded.

Everything downstream followed from that. `enrich()` set `label: null` on every turn and filled it
only for `role === 'student'`, so `getAILabelBefore()` always fell through to its `|| "content"`
default, so **six of the thirteen shipped detectors could not fire in production and never had.**

The four `patterns.md` calls *"the only detectors in this file that need nothing calibrated before a
teacher can be shown them"* are four of the six. The detectors that need no threshold were exactly the
detectors that had no input.

---

## What the pipeline does today

| Step | Where | What it does with the AI turn |
|---|---|---|
| Bundle | `analysis.js` `collectBundle` | Keeps both roles, ordered |
| Pair | `analysis.js:104` `studentTurnsWithContext` | Carries the prior coach turn's **`.text` only** — the turn id is dropped |
| Prompt | `analysis.js:40` `CLASSIFY_PROMPT` | Prints the AI turn as `AI: …` context. **Asks for nothing about it.** Returns `{turnIndex, label, responsive, confidence}` for the student turn |
| Enrich | `analysis.js:164` `enrich` | `label: null` for all turns; filled only when `isStudent` |
| Read back | `patterns-core.js:32` `getAILabelBefore` | Walks back to the nearest `role === 'ai'` turn and returns `label \|\| "content"` — always `"content"` |

**The AI turn's text is already in the classifier payload.** That is the single most important fact
for costing this work: labelling it is one more field on a JSON object that already contains the
material, not a second call and not a second pass over the transcript.

### Label sets

Student labels (shipped, in `CLASSIFY_PROMPT`): `claim`, `conceptual`, `extraction`, `validation`,
`stuck`, `feedback`, `narrative`, `rejection`, `refinement`, `challenge`, `pivot`.

AI labels (specified in `CLAUDE.md` Phase 2, **never implemented**): `correction`, `instruction`,
`example`, `argument`, `definition`, `content`.

Only three of the six are load-bearing today — `argument`, `correction`, `definition` are the ones the
detectors test. `instruction`, `example` and `content` are currently unread, and `content` is what the
fallback returns, so it must stay the neutral default.

---

## What the gap costs

### Six detectors are dead, one is capped

Traced against `patterns-core.js`:

| Detector | Line | Depends on | State today |
|---|---|---|---|
| `argument-engaged` | :88 | `aiLabel === "argument"` | **Never fires** |
| `missed-argument` | :163 | `aiLabel === "argument"` | **Never fires** |
| `correction-held` | :187 | `aiLabel === "correction"` | **Never fires** |
| `capitulation` | :189 | `aiLabel === "correction"` | **Never fires** |
| `assertion-questioned` | :195 | `aiLabel === "definition"` | **Never fires** |
| `assertion-unquestioned` | :197 | `aiLabel === "definition"` | **Never fires** |
| `extraction-landing` | :101 | uses `aiLabel` only to elevate tier | Fires, **permanently stuck at `medium`** |

### Identical student turns cannot be told apart

The bikeguide transcript has four bare `validation` turns. Same label, same row on any chart:

| Turn | Text | What the AI had just done | What it actually is |
|---|---|---|---|
| 19 | *"yes"* | Diagnosed the squeal as contamination | Accepting a diagnosis |
| 34 | *"Yes make the additions."* | Proposed a content split | Approving a proposal |
| 36 | *"yes"* | Answered a placement question | Confirming placement |
| 40 | *"Lets tackle the closing. I like this you proposed…"* | Drafted closing language | Adopting the coach's words |

`correction-held` vs `capitulation` exists precisely to separate these, and cannot.

### Two dimension problems are AI-turn questions in disguise

- **PQ settled on *task initiative*** — "introduces something the AI did not raise"
  (`tau-dimensions.md`). That is a claim about the AI's turns. It cannot be computed from student
  turns alone, whatever `scoreTAU`'s signature becomes.
- **CS is carried by `refinement`, and `refinement` is ambiguous without the AI turn.**
  `tau-dimensions.md` records ten refinement turns supplying 10 of CS's 14.5 points on bikeguide,
  reading *"Make the maintenance at a glance table"* — editorial direction, not skepticism. Genuine
  skepticism is six turns. **Refinement after the AI asserted something** and **refinement as
  document direction** are different acts wearing one label, and the AI turn is what separates them.

---

## The build — **done 2026-08-18**, as specified below

Five changes, one file. Estimated at **~½ day** for the pipeline, ~1 hour for the seed, the remainder
of a day confirming the six detectors fire sanely on real sessions.

1. **`CLASSIFY_PROMPT` (`analysis.js:40`)** — add the six AI labels with definitions, and ask for
   `aiLabel` alongside `label` on each item. The AI turn is already printed as context; this asks the
   model to classify what it is already reading.
2. **`studentTurnsWithContext` (`analysis.js:104`)** — carry the coach **turn object**, not
   `turn.text`, so a returned `aiLabel` can be keyed back to a specific turn id.
3. **`classifyStudentTurns` (`analysis.js:116`)** — build a second map keyed by AI turn id.
   **Dedupe:** consecutive student turns share a `priorCoach`, so the same AI turn appears in the
   prompt more than once and can come back with two different labels. First wins, or the pairing
   emits each AI turn once.
4. **`enrich` (`analysis.js:164`)** — write the label onto AI entries instead of leaving `null`.
5. **`maxTokens`** — currently `100 + items.length * 40`. Add ~10/turn.

### Cost

Effectively unchanged. The AI text is already in the prompt, so input tokens do not move; output grows
by one short string per turn.

### What must NOT be changed

- **`patterns-core.js` needs no edit.** All six detectors already call `getAILabelBefore`. They light
  up the moment the field is populated. Editing them as part of this work would change what students
  have already been told about their own sessions — the exact hazard `patterns.md` flags around its
  thresholds.
- **`scoreTAU` needs no guard.** It filters to `student` at `analysis.js:280` before counting labels,
  so AI labels cannot leak into the dimension counts. Verified 2026-08-18. Do not add a defensive
  filter and do not "fix" the counts.
- **`content` stays the fallback.** `getAILabelBefore` returns `label || "content"`; if `content`
  ever becomes a label a detector tests, every unlabelled historical turn silently joins that
  detector's population.

### The demo seed — done

`t(role, text, label = null)` at `seed-data.js` — every `t('coach', …)` call passed no label, and the
dev seed builds analyses **without any LLM call**. So the six detectors would have worked in
production and stayed dark in the demo.

**Do not hand-label these.** Run the classifier over the seed transcripts once, offline, and commit
the returned `aiLabel`s into `seed-data.js` as literals. That keeps the seed LLM-free at run time —
the property it exists for — while the labels come from the same model doing the same job.

Done: all 76 coach turns across the four tiers carry a committed label (75 labelled, 1 null — the
last coach turn of bikeguide has no student turn after it, so the pairing never showed it to the
classifier). `seed.js` passes them to `enrich` as an id-keyed map; `analysis.js` exports
`classifyStudentTurns`/`studentTurnsWithContext` so the generator script could reuse the shipped path
rather than reimplement it.

### What the labels came back as

Over the whole seed (76 coach turns): `content` 29, `instruction` 26, `argument` 15, `definition` 5,
**`correction` 0, `example` 0**.

Re-running `detectPatterns` before and after is **purely additive** — no existing pattern moved or
disappeared:

| Detector | Before | After |
|---|---|---|
| `argument-engaged` | never | strong ×4, flat ×1, flagged ×1, bikeguide ×2 |
| `assertion-unquestioned` | never | bikeguide ×4 |
| `missed-argument` | never | still never — no run of 3 passive turns under `argument` |
| `assertion-questioned` | never | still never — nothing challenges a `definition` in the seed |
| `correction-held` / `capitulation` | never | still never — **`correction` is returned zero times** |
| `extraction-landing` | always `medium` | still `medium` — no extraction lands on an `argument` turn |

**The zero `correction` rate is not obviously a prompt bug.** The detector's own definition is *the AI
corrected or disagreed with the student*, and in these transcripts the correction runs the other way:
bikeguide's student catches the AI twice — *"This doesn't exist"* — and the AI's reply (*"You're
right, I fabricated that reference"*) is a concession, not a correction, and came back `content`. The
coach tiers ask questions rather than contradict. So the pushback pair may be dark because the seed
contains no pushback, which is a fact about the seed, not a fault in the field. **This cannot be
settled on the seed** (`tau-dimensions.md`) — it needs a real transcript where the AI does tell a
student they are wrong. Until then, do not tune the prompt to manufacture `correction`s.

`example` at zero is weaker evidence than it looks: examples in these transcripts are embedded in
turns that are mostly document prose, and the prompt's dominance rule sends those to `content` by
design. Nothing reads `example`, so it costs nothing today.

### Existing analyses

`backfill-patterns.js` re-runs `detectPatterns` over stored analyses and rewrites `patterns` for free,
but **cannot invent AI labels** — the stored `classified` arrays have `label: null` on every AI turn.
Options: a re-classify LLM pass over stored transcripts (costed, not free), or accept
new-analyses-only and let history stay unlabelled. **Undecided.**

---

## Validation

**The pair-agreement number does not exist and should be measured once the field does.** A detector
conditioned on two labels multiplies two error rates. Student-label agreement on bikeguide was
**24 of 44 ≈ 55%** (Gemini vs. stored, `tau-dimensions.md`). If AI labels land anywhere near that, a
two-label detector is close to a coin flip, and the four "no threshold, trust them today" detectors
would be trustworthy in *form* while unreliable in *fact*.

**This cannot be measured on the seed.** `tau-dimensions.md`: *never validate a measure against the
demo seed* — authored transcripts carry structure real sessions don't. A hand-coded seed produces a
ground truth that is not permitted as ground truth. Pair agreement has to come from a real transcript,
hand-coded by a person, and bikeguide is currently the only real transcript in the repo.

**Prompt risk.** The model has never been asked to do this job. `argument` vs `instruction` vs
`content` is a fuzzier distinction than most student labels, and three of the six detectors hang on
`argument` alone. Expect a pass or two of prompt work, and check the `argument` rate before trusting
`argument-engaged` or `missed-argument`.

---

## The reading surface — the step plot

**Where this stands.** Explored in artifacts on 2026-08-18, **not built, not in `report-lab.html`.**
The lab still carries `Agency Chart` and `Who's Driving` as untouched placeholders
(`report-lab.html:1397-1405`).

### What the two shipped charts do wrong

Both read the same 44 turns and the same patterns through the same
`buildAgencyTurnsAndPatterns()` (`report-render.js:358`) — one fact, two tabs. Beyond that:

- **Both draw a line.** A 3-turn moving average (`:458`) and a 5-turn rolling share (`:670`), both
  computed over *ordinal codes* the file's own comment (`:417`) admits are "not a measured quantity".
- **Five encodings for one variable** on the agency chart — direction, height, a green ramp, a terra
  ramp, the trend line. The ramp is acknowledged debt at `:392-398`, literal hex outside the tokens.
- **Three palettes across two adjacent tabs** — raw green/terra, `--tau-origin-*`, `--tau-band-*`.
- **No finding, only a mark.** `designsystem.md` Hard Constraints: *"On a single subject, the finding
  leads and the mark is subordinate."* A student report is always n=1.
- **"Who's Driving" poses a question rather than naming content** — the labelling fault the
  `product-design-review` skill exists to catch.

**The gap objection does not apply here.** The "change over time is a flow, never a line" rule is
about readings separated by an unmeasured gap. Consecutive turns are contiguous measured events, and
the surface is a **map** — its job is locating a moment, not asserting a rate. A turn-level mark is
therefore permitted; what is not permitted is interpolating a value *between* two turns.

### The step plot, as explored

- A turn is a square at one of four heights. **Position carries the level**; nothing is drawn between
  two turns; no trend line.
- Four rows, labelled **High agency / Student-led / Shared / Low agency**. Four labels, nothing else
  in the gutter — turn counts and classifier membership were tried and rejected as clutter,
  2026-08-18.
- Pattern runs are shaded bands behind the squares with **the name printed on the chart**, not in a
  tooltip.
- Clicking a square reads the turn out below; clicking a band reads the run out.
- The finding leads in prose above the plot; the mark sits under it.

### Verified on bikeguide

Thirty of forty-four turns sit in the bottom two rows, with isolated spikes at 3–5, 21, 26–27, 33.
That is `tau-dimensions.md`'s human read — *"a competent, directive user who catches two factual
errors and supplies real personal context, while delegating most of the writing"* — arrived at from
the picture rather than the prose. Useful evidence for the form.

### What the real transcript exposed

- **It is one unbroken sitting.** Session breaks were the strongest idea in the earlier exploration
  and the only real transcript cannot exercise them. Do not make them load-bearing on this evidence.
- **The sharpest turns are the shortest.** *"Why tyres instead of tires?"* is five words in the top
  row; turn 39 runs sixty words in row two (also recorded at `tau-dimensions.md:108`). **Never encode
  turn length** — as width, opacity or size. It inverts the reading.

### Open, and blocking the build

1. **Which row `refinement` belongs in.** Ten of bikeguide's fifteen row-two turns are `refinement`.
   Row one reads as a near-passive session; row three reads as leading throughout. Row two is a
   hedge. **This is a measurement question, not a visual one**, and it is the same question the
   CS section above raises — which is why labelling the AI turns may settle it rather than the chart
   design settling it.
   **Answered 2026-08-18, in the negative: the AI labels do not settle it.** Nine of bikeguide's ten
   `refinement` turns follow `content` and the tenth follows `argument`, and that tenth ("Lets add the
   hint to look for the small Nm on the bolt head") is directive too. All ten are the same act — the
   AI produced prose, the student directed the next edit — which confirms `tau-dimensions.md`'s read
   but offers no cut. This stays open on item 5 and the CS work, not on the labels.
2. **The agency ramp has no token.** `--tau-scale-N` is documented for "four bands plotted together
   as magnitude", but its stated direction puts the darkest step on band 1, because the cohort finding
   it was built for is where the mass sits at the low end. On one student's own turns that puts visual
   weight on their worst moments. The artifacts used a forest ramp on hue 162 (matching
   `--tau-origin-you`, so more forest reads as more of the student's own thinking) — which is a fifth
   ramp. **Reuse against the stated direction, or fork the token: undecided, and a gap in
   `designsystem.md` rather than licence to improvise.**
3. **Where the AI turn goes.** Once AI turns carry labels, the AI's move is what makes a student turn
   readable, and a chart with one row per student turn has nowhere to put it. A paired-column form —
   the AI's move above, the student's response below — was proposed and not explored. **This should
   be settled before the step plot is committed to the lab**, or the chart gets built twice.
   **Sharpened by the labels, 2026-08-18:** bikeguide's four identical `validation` turns now separate
   — 19 and 34 follow an `argument`, 36 follows a `definition`, 40 follows `content` — which is the
   case for a second column made from data rather than assertion. But turn 36 already fires
   `assertion-unquestioned`, so the **pattern band** carries the AI's move onto the chart for free.
   Decide whether the band is the answer before drawing a column.
4. **Pattern bands now overlap.** With AI labels populated, bikeguide goes from 7 pattern runs to 13,
   and three share a turn — including bands of opposite tiers, plus four single-turn interaction
   moments that are point events rather than runs. The explored form shades a run and prints its name
   on the chart, which has no drawing for two names behind one square. **This is a rendering question
   only:** the one case that was a detection fault (`extraction-landing`'s elevation clause) was fixed
   in `patterns-core.js` on 2026-08-18, and the remaining overlaps are signal — see `patterns.md`,
   *One detector mixed two sources*. Do not resolve this by suppressing the lower-tier band.

---

## Backlog

| # | Item | Blocked on |
|---|---|---|
| ~~1~~ | ~~Label AI turns in `CLASSIFY_PROMPT`; key back by turn id~~ | **done 2026-08-18** |
| ~~2~~ | ~~Generate and commit seed `aiLabel`s via one-off script~~ | **done 2026-08-18** |
| 3 | Confirm the six detectors fire sanely on **a real session** — checked on the seed only, where two fire and four stay dark for reasons above | a live submission through `runAnalysis` |
| 4 | Prompt iteration on `correction` (zero rate) before `argument` / `instruction` / `content` | 3 |
| 5 | Hand-code one real transcript; measure pair agreement | a second real transcript would be better than bikeguide alone |
| 6 | Decide: re-classify stored analyses, or new-only | 1 |
| 7 | Settle where the AI turn sits in the turn-level chart | 1 |
| 8 | Settle `refinement`'s row | 5, and `tau-dimensions.md`'s CS work |
| 9 | Settle the agency ramp token | `designsystem.md` |
| 10 | Build the step plot into `report-lab.html` | 7, 8, 9 |

Items 1–4 and 6 are independent of the `scoreTAU` signature change that gates the four dimensions.
This work does not queue behind it.

---

## Session log

### 2026-08-18 (second session) — the labelling pipeline built; the charts untouched

Backlog 1–2 built exactly as specified above, plus the seed generator. `patterns-core.js` unedited,
`scoreTAU` unguarded (it filters to `student` before counting, re-verified), `content` still the
`getAILabelBefore` fallback and still not tested by any detector.

Ran the shipped prompt over the seed transcripts once, offline, and committed the 76 returned labels
into `seed-data.js`. The before/after `detectPatterns` diff is additive: `argument-engaged` fires in
all four tiers and `assertion-unquestioned` four times in bikeguide; nothing that fired before
stopped firing.

**The finding worth carrying forward:** `correction` came back **zero times out of 76**, so the
pushback pair (`correction-held` / `capitulation`) is still dark. On inspection this looks like a
property of the seed rather than a broken label — in bikeguide the *student* corrects the *AI*, and
the AI's concession is not what the detector is defined on. Resisted tuning the prompt to force the
label; that decision has to be made against a real transcript.

**Not done:** the step plot, and open questions 1–3 (`refinement`'s row, the agency ramp token, where
the AI turn sits) all stand. No lab markup changed.

### 2026-08-18 — the gap found and specified; nothing built

Started from "did we update the student report to the new measurement?" The answer is no — the
student view is the one surface not rebuilt, and `report-render.js` still emits `totalScore`, `/20`
and a SAMR hero (`:983`, `:1441`, `:1452`). Variant **D** in `report-lab.html` (vertical
`.level-scale`, the lab's default via `body[data-variant="d"]` and the `#d` hash fallback at `:1481`)
is the settled design for the hero; the two turn-level charts below it are placeholders.

Explored four encodings for the turn-level map, then drew the chosen one on the real bikeguide
transcript. The step plot survived contact with real data — see *Verified on bikeguide*.

**The finding that redirected the session** came from asking whether AI turns were being tracked. They
are read as context and never labelled, which means six detectors — including the four `patterns.md`
calls the only trustworthy ones — have never fired. That was traced through
`CLASSIFY_PROMPT` → `enrich` → `getAILabelBefore` and is recorded in *What the pipeline does today*.

**One estimate was wrong and is corrected here.** Seed coach turns were first costed as a day of hand
labelling. They should be generated by running the classifier once offline and committing the output;
hand-coding the seed would also have produced a ground truth `tau-dimensions.md` forbids using as
ground truth. Revised from ~1½–2 days to **~1 day**.

**Not done:** no code changed, no lab markup changed. This file is the handoff.
