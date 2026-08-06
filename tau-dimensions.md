# TAU Dimensions — measurement design and validity

**Scope of this file.** The four TAU dimensions: what each one is specified to measure, what the code
actually computes, and whether that is valid. Dimension definitions, scoring formulas, rubrics, and
validation evidence live here.

**Not in this file.** Infrastructure, phases, cost, multi-school architecture, and the migration —
those stay in `built-in-chat-plan.md`. This file was split out of it on 2026-08-05 so measurement work
can proceed in its own session without entangling the Vertex/Firestore migration. The two touch in one
place: dimension changes are implemented in `app/server/analysis.js`, which the migration also edits.

**Status (2026-08-05):** PQ is under active review and is currently **not discriminating** — it reads
5 on nearly every transcript. Backlog #9 is closed; a larger validity problem it exposed is open. SU,
CS and OC have not been examined at all.

---

## Why this matters

Each dimension is 25% of the TAU score, and the total maps directly to the SAMR level a student sees
on their report. A dimension that reads the same value for a strong and a weak transcript is not a
neutral failure — it silently shifts a quarter of the score to a constant, and the remaining three
dimensions decide the SAMR band on their own.

The requirement PQ has to meet, stated 2026-08-05: **it must accurately detect when students are
*not* asking good questions or prompts.** Sensitivity at the low end is the priority. Overlap with
Calibrated Skepticism is accepted and expected — "different flavours" — so avoiding overlap is not a
design constraint.

---

## What the code computes today

From `app/server/analysis.js` (`scoreTAU`), over student turns only. `total` = student turn count.

```
mapTo5:  raw >= 0.6 → 5 | >= 0.4 → 4 | >= 0.22 → 3 | >= 0.1 → 2 | else 1

PQ_raw = (responsiveCount + challengeCount) / total
SU_raw = highFollowups / extractionEvents        (extraction turns followed by a
                                                  high-agency turn; if there are no
                                                  extraction events, falls back to the
                                                  overall high/(high+low) agency mix)
CS_raw = (rejection * 1.5 + refinement) / total
OC_raw = (studentBorn + prior + synthesized*0.6) / concepts   (from provenance;
                                                  falls back to a claim/narrative ratio
                                                  penalised by passive rate)

HIGH_AGENCY = claim, conceptual, challenge, rejection, refinement
LOW_AGENCY  = extraction, validation, stuck

totalScore = PQ + SU + CS + OC   →  ≥17 Redefinition | ≥13 Modification | ≥9 Augmentation | else Substitution
```

A hard constraint from `CLAUDE.md` governs any redesign:

> No scoring of individual turns — only patterns and sequences.

So a dimension may not become a per-turn 1–5 rating. A per-turn **categorical** judgement aggregated
into a ratio is consistent with how `label` already works, and is the shape any proposal here should
take.

---

## PQ — Prompting Quality

Specified as: *measures question responsiveness and challenge; does NOT count question marks.*

### The original bug (backlog #9, logged 2026-07-19) — CLOSED 2026-08-05

`responsive` was set by `isResponsiveToAI()`, a lexical test: a turn-initial discourse marker
("but", "so", "actually"…), or ≥2 shared words longer than 5 characters with the prior coach turn.
Two faults:

1. It ran on the regex fallback path **even when the LLM was available** — only `label` came from the
   model. Fallback code was doing production work.
2. Word overlap means a student who **paraphrases** scores lower than one who **parrots**. PQ is
   specified to measure engagement quality; this measured vocabulary echo, roughly its inverse.

Surfaced while authoring seed transcripts: honestly-written strong transcripts scored PQ 1–2.

**What was changed (2026-08-05).** The lexical test is gone. The classifier now receives the coach
turn preceding each student turn — it previously saw student turns in isolation, which is *why*
responsiveness had to be guessed lexically — and returns `responsive` as a judgement of meaning, with
the prompt explicitly instructing that paraphrase counts and echo does not. A structural rule
outranks the model: a turn that opens a conversation has nothing to be responsive to.

The dev seed builds demo analyses without any LLM call, so `enrich()` falls back to
`RESPONSIVE_BY_LABEL` = {rejection, refinement, validation, challenge} — the four labels that are
definitionally *about* the coach's previous turn. The fallback claims no more than the labels assert.

### The problem this exposed — OPEN

Responsiveness is **near-universal in any conversation**, so the term carries almost no information.

Measured through the LLM path, real sessions, 6 sessions per level:

| Condition | Responsive | `challenge` |
|---|---|---|
| full coaching | 89/110 = **81%** | 3 |
| questions-only | 18/24 = **75%** | 0 |
| sounding-board | 24/30 = **80%** | 0 |
| `bikeguide` — no coach persona at all (Claude.ai doc co-creation) | 36/44 = **82%** | 1 |

The hypothesis that the ceiling was an artifact of the coach doing the prompting is **not supported**:
responsiveness holds at ~80% even at sounding-board, and even with no coach. Turn-taking is what a
conversation *is*. The old lexical test appeared to discriminate only because it was accidentally
measuring something else, and measuring it badly.

`challenge`, PQ's other term, is close to extinct across all levels (3/110, then 0, 0, 1). PQ cannot
lean on it.

### PQ before and after, four seed tiers

| Tier | PQ, lexical (before) | PQ, seed fallback (after) | PQ, LLM path (after) | Label agreement, model vs hand |
|---|---|---|---|---|
| strong | 4 — responsive 6/17 | 4 — 8/17 | **5** — 13/17, challenge 0 | 8/17 |
| flat | 1 — responsive 0/12 | 3 — 4/12 | **5** — 9/12, challenge 0 | 5/12 |
| flagged | 1 — responsive 0/12 | 2 — 2/12 | **5** — 9/12, challenge 0 | 7/12 |
| bikeguide | 3 — responsive 5/44 | 5 — 22/44 | **5** — 36/44, challenge 1 | 24/44 |

Two things to read off this. The lexical test fired on **0 of 12 turns** for two tiers — including
`flagged`, the high-fluency AI-echoing tier it should have fired on hardest, which is evidence it
never measured echo reliably either. And PQ has gone from wrong-but-varying to correct-but-flat.

On a real 88-turn session (Maya, `f4032a5f`), the change moved PQ 2 → 5 and the total 13 → 17,
i.e. Modification → Redefinition. That is a quarter of the score moving on one term.

### What the coaching fade *does* move — the promising signal

The label mix shifts sharply as scaffolding fades, which is what PQ is supposed to detect:

| | `claim` | `extraction` | `refinement` |
|---|---|---|---|
| full | 10/110 = 9% | 12% | 25% |
| questions | 8/24 = **33%** | 0% | 13% |
| sounding-board | 11/30 = **37%** | 7% | 20% |

Students assert their own positions ~4× more often as a proportion, and stop asking the AI to do
work. The signal PQ needs is already in the data — just not in the term PQ currently reads.

**Caveats that bound this.** Samples are small (24 and 30 turns for the faded levels, 6 sessions per
level). More importantly these are **authored** transcripts — the label mix partly reflects how the
fade was written, not how students behave under it. Re-check against pilot data before trusting the
magnitude.

### Proposed redesign — NOT YET BUILT

Read whether the ask carries the student's own direction, rather than whether a response occurred.
Designed around detecting *bad* prompting, so the low anchor is the crisp one.

| Level | The turn… | Examples |
|---|---|---|
| `low` | gives the AI nothing but a topic | "write my intro", "is this good?", "i don't get it", re-asking without changing anything |
| `mid` | is specific but doesn't advance thinking | a well-scoped factual ask, accepting output with a cosmetic tweak |
| `high` | supplies what only the student could | their own position, a constraint from their context, an objection, a distinction, a demand for justification |

```
PQ_raw = (high + mid*0.5) / total
```

Replaces `responsive` entirely; that term retires. Overlaps CS by design — a rejection usually reads
`high` — but CS counts *whether* pushback happened while PQ reads *what the asks are made of*.

Seed fallback mapping (no LLM available) would need defining: probably `high` ← rejection, refinement,
challenge, claim; `mid` ← conceptual, feedback; `low` ← extraction, validation, stuck.

### Validation plan — the actual work

A rubric that discriminates on four transcripts is not a validated rubric.

1. **Known-groups.** `strong` must score materially above `flat`. These tiers were authored before
   this measure existed, so they are honest ground truth. Pass = clear separation, not a 1-point wobble.
2. **Floor test.** A transcript of nothing but lazy prompts must score PQ 1. If a deliberately bad
   transcript does not bottom out, the measure cannot do the job it exists for.
3. **Ceiling test.** A transcript of demanding, well-directed prompts must score 5 — guards against a
   measure that is merely pessimistic.
4. **Stability.** 3 runs per transcript at temperature 0.1; the level must not move.
5. **Coaching-fade check.** PQ should rise across full → questions → sounding-board, tracking the
   9% → 37% shift in student-driven turns.

**Known weakness of this plan.** Tests 2 and 3 use transcripts written by whoever builds the measure,
so they test the rubric against its author's idea of bad prompting — circular. Known-groups is n=2.
**The one genuinely external test is a hand-labeled sample**: ~20 student turns labeled low/mid/high
by hand, scored for agreement against the classifier. Worth 15 minutes given PQ is 25% of the score.

---

## SU — Selective Use

**Not yet examined.** Specified as: what follows an extraction event; extraction is neutral, the
pattern after it is the signal.

Two things worth checking when this comes up:

- The no-extraction fallback (`highTotal / (highTotal + lowTotal)`) measures something quite different
  from the primary path (`highFollowups / extractionEvents`) — a general agency mix rather than a
  post-extraction pattern. A transcript with no extraction is scored on a different construct under
  the same name.
- SU is a ratio over extraction *events*, so a transcript with one extraction and one good follow-up
  scores 5. Sensitivity to tiny denominators is unexamined.

## CS — Calibrated Skepticism

**Not yet examined.** `CS_raw = (rejection*1.5 + refinement) / total`. Resubmission was deferred at
design time. Note `refinement` was the single most common label in the `full` sample (27/110), which
suggests CS may be close to saturated for the same structural reason PQ was — worth measuring.

## OC — Original Contribution

**Not yet examined.** Scored from the provenance trace. The concern to test is that OC is a ratio over
*concepts the model chose to extract*, so the denominator is model-determined rather than fixed — a
model that surfaces more AI-born concepts mechanically lowers OC without the student behaving
differently.

---

## Cross-cutting: label validity

Everything above sits on top of the 11-way turn classification, and the model agrees with the
hand-authored seed labels only about half the time (8/17, 5/12, 7/12, 24/44). Some disagreement is
expected on an 11-way scheme with fuzzy boundaries, and the hand labels are not themselves validated.
But **no dimension can be calibrated more precisely than the labels underneath it**, so this may need
resolving before any dimension rubric is tuned.

Also open: `challenge` almost vanished once the classifier was given coach context (5 → 1 on
bikeguide, 0 across three tiers). Either the earlier count was inflated by seeing turns in isolation,
or the new prompt suppresses it. Unresolved, and it matters because `challenge` is a PQ term.

---

## Session log

- **2026-08-05 — PQ investigated, backlog #9 closed, larger problem opened.** Replaced the lexical
  responsiveness test with a classifier judgement and gave the classifier the coach turn it had never
  seen. This fixed the specified bug — paraphrase no longer scores below parroting — and revealed
  that the term was never load-bearing: responsiveness sits at 75–82% in every condition tested,
  including with no coach at all, so PQ now reads 5 almost everywhere. Measured the coaching fade and
  found the discriminating signal lives in the label mix (claim 9% → 37%), not in responsiveness.
  Proposed a low/mid/high prompt-direction rubric and a five-test validation plan; **neither built**.
  Decision taken: do not redesign PQ against four authored transcripts without external labels.
  File created to carry this work separately from the Vertex/Firestore migration.

  **Code state at the end of this session:** the responsiveness change is *in* `app/server/analysis.js`
  and PQ therefore reads 5 on most transcripts. It was left in rather than reverted because reverting
  reinstates a known-inverted signal, and because the classifier's new coach context improves labels
  generally. If that flatness is worse than the old bug for demo purposes, reverting is a small,
  contained change — see the diff for `enrich()`, `CLASSIFY_PROMPT`, and `studentTurnsWithContext()`.

  **Stored demo analyses are unaffected.** `seed.js` computes TAU at seed time, so existing reports in
  `app/data/` still show pre-change scores. They will only pick up the new logic on a re-seed from
  empty, or via `POST /api/submissions/:id/reanalyze`.
