# TAU Dimensions — measurement design and validity

**Scope of this file.** The four TAU dimensions: what each one is specified to measure, what the code
actually computes, and whether that is valid. Dimension definitions, scoring formulas, rubrics, and
validation evidence live here.

**Not in this file.** Infrastructure, phases, cost, multi-school architecture, and the migration —
those stay in `built-in-chat-plan.md`. This file was split out of it on 2026-08-05 so measurement work
can proceed in its own session without entangling the Vertex/Firestore migration. The two touch in one
place: dimension changes are implemented in `app/server/analysis.js`, which the migration also edits.

**Status (2026-08-12):** **The scoring foundation and the scale are both settled — read *The scoring
foundation* and then *The scoring scale* before anything else in this file.** All four dimensions are
specified against published coding schemes, each worked through against the one real transcript.
**Nothing is built.**

Each dimension is a question read from the transcript, the essay and the assignment together, and the
output is coded evidence — a claim, the moments supporting it, and the moment that doesn't. On top of
that evidence sits a **rubric band, 1–4 (or "not enough here")**, chosen by reading, never derived
from a count; and above the four sits **one named overall level** on a SAMR-vocabulary agency ladder,
read from the four bands plus the assignment plus the shape of the session. **There is still no total
and no average, and no band is ever computed from a ratio.** Everything above *The scoring foundation*
describing formulas, `mapTo5`, or a 4–20 total is **historical**, kept for the reasoning that produced
the change.

The shipped code still runs the original formulas and PQ still reads 5 on nearly every transcript.
`scoreTAU(classified, provenanceData)` (`analysis.js:275`) receives labelled turns and a concept list —
**it never sees the transcript, the essay, or the assignment**, which is why every dimension is
currently a ratio over an 11-way label taxonomy rather than a reading of what was said. Every redesign
in this file depends on changing that signature.

A measurement model for how the four relate was settled 2026-08-10 (*The measurement model*) — read
that before touching any single dimension, because it determines what each one is allowed to read.

**Companion file:** `patterns.md` owns behavioural pattern detection (sequence, trajectory and
divergence shapes) and the level-signal/pattern split on the teacher dashboard. The boundary: this
file owns *what a dimension measures*; `patterns.md` owns *shapes across turns, time, or between
dimensions*. Both edit `app/server/analysis.js`.

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

## Do not validate against seed data — established 2026-08-10

**`app/data/` and `seed-data.js` are a design fixture. They populate dashboards and reports so the UI
can be built and reviewed. They are not measurement data and no validity claim may rest on them.**

Established by measuring it. The nuisance-variable check (below) run on the 11 authored seed
transcripts showed turn length strongly predicting agency label — Cohen's d = 0.83, a large effect,
which would mean the scores partly measure verbosity. Run on the one **real** transcript in the corpus
(bikeguide, 44 student turns), the same test gives **d = 0.12 — negligible**. High-agency turns
averaged 19.5 words, low-agency 18.0.

The seed effect is an authoring artifact: a turn written to exemplify `validation` is written short
("yes", "looks good") because that is what a clear example looks like. Real sessions do not have that
structure — in bikeguide the sharpest agency moments are among the shortest turns ("Why tyres instead
of tires?", 5 words, `challenge`) and the longest turns are passive delegation (47 words,
`extraction`).

**Consequences, which apply to every validation plan in this file and in `patterns.md`:**

- Known-groups tests across the four seed tiers test the *authoring*, not the measure.
- Label-volume counts from seed transcripts do not predict label volume in real sessions.
- Thresholds calibrated on seed data are calibrated on an artifact.
- Anything that reads as a validity finding on seed data must be re-run on real transcripts before it
  is believed — in either direction.

The corpus of real material is currently one transcript. Expanding it is the precondition for almost
everything else here.

---

## The measurement model

**Settled 2026-08-10.** Until now the four dimensions were four independent measures that happened to
sit in one total, and every design conversation about one of them stalled on "but doesn't that overlap
with another?" This section answers that once: **overlap is expected and is not a defect.** What
follows constrains every dimension redesign in this file.

### The four dimensions are facets of one construct

The four are not independent measures. They are facets of a single underlying construct — student
**agency** in AI-assisted work — with each reading a different aspect of it. Formally this is a
hierarchical (bifactor) structure: a general factor plus specific factors.

Two consequences, and the second is the operative one:

- Facets are **expected to correlate**. Demanding orthogonality between dimensions would be the error,
  not the overlap. Overlap between PQ and CS was already accepted on these grounds ("different
  flavours", 2026-08-05); this generalises it to all four.
- **What each facet needs is incremental validity** — something it reads that no other facet does.
  Correlation is fine; a facet with no unique cell is not a facet.

### The grid — what each dimension uniquely owns

Two axes: whose material is being read, and where it is observed.

|  | Observed in the conversation | Observed in the essay |
|---|---|---|
| **Student-originated material** | **PQ** — did you drive it? | **OC** — is the thinking yours? |
| **AI-originated material** | **CS** — did you evaluate it? | **SU** — what survived, and why? |

Each dimension shares one axis with two neighbours, which is exactly the moderate correlation the
model predicts, and owns one cell alone. Read the grid before proposing any change to a dimension: a
proposal that moves a dimension out of its cell is a proposal to delete it.

The grid is also diagnostic. It is what identified PQ's actual defect — `responsive` measures
*reaction to the AI*, which is CS's cell. PQ was scoring in the wrong cell, which is why it saturated:
reaction is near-universal in any conversation (~80% in every condition tested, including with no
coach at all), so a measure that reads it carries no information about the student.

Boundaries that follow directly, and that earlier designs kept violating:

- PQ is **conversation-only**. An idea the student raises that never reaches the essay still counts for
  PQ and not OC. An essay idea never discussed counts for OC and not PQ.
- Reframing the problem is PQ (it substitutes the student's frame). Challenging a claim is CS (it
  evaluates the AI's).
- SU's domain is **AI-originated ideas only**. Student-introduced → AI-refined → used is `synthesized`
  and belongs to OC. Scoring it in SU would count one event in two dimensions.

### The shared-evidence rule

Correlation between dimensions is a property of the construct. **Two dimensions incrementing off the
same observed event is arithmetic error**, and it inflates the total non-linearly.

The test for any proposal: *can a single turn, or a single idea, raise two dimensions?* If yes, it is
double-counting, not overlap, and the split has to be by which *aspect* of the observation each
dimension reads — not by which dimension noticed it first.

The rule bites hardest on CS/SU. "CS = the act of evaluating, SU = whether evaluation changed the
output" is not overlap but **nesting**: SU's positive case is a strict subset of CS's, since nothing
can change without pushback first. Two nested measures move together by construction and a student
with no pushback scores zero on both. **SU is therefore specified as a conditional rate** — *of the
pushback that occurred, what proportion changed what survived* — which is independent of the base rate
CS measures. See the SU section.

### Known structural weaknesses of the total

- **The total is a naive sum of correlated facets.** `PQ + SU + CS + OC` with equal weights counts the
  shared variance four times, so the total is the general factor plus accumulated duplication, and the
  SAMR band inherits the error. Already visible: Maya moved 13 → 17, Modification → Redefinition, on
  one term changing. No weighting scheme is proposed — there is no data to fit one on — but the total
  should not be described as if the four were independent.
- **Method variance is not separable.** All four dimensions come from the same model reading the same
  transcript, so a general factor is *guaranteed* to appear whether or not agency exists as one. No
  amount of data separates construct from method when every indicator shares a method. The only fix is
  at least one indicator that does not come from the LLM — which is the strongest argument for the
  deterministic components specified in PQ and SU below, independent of their merits as measures.

### Feasibility — what can and cannot be validated

| | Feasible? |
|---|---|
| Estimating reliability of the four scores | **Yes, now** — no new data needed |
| Testing the correlation structure | **Yes, once PQ has variance and reliability is known** |
| Formally validating the bifactor model | **No — not with four scores** |
| Separating agency from method variance | **No, as currently built** |

**Why the bifactor model is not identifiable.** Each specific factor needs at least three indicators.
Four dimension scores give four indicators total — enough to fit a single-factor model and nothing
more. This is structural, not a sample-size problem, and more submissions will not fix it.

**The fix is already in place — corrected 2026-08-10.** An earlier draft of this section claimed the
components were collapsed before storage and had to be persisted urgently. That was wrong. `scoreTAU`
returns them and they are stored: `counts` (all eleven labels), `total`, `responsiveCount`,
`challengeCount`, `extractionEvents`, `highFollowups`, `lowFollowups`, `provenanceCounts`
(`analysis.js:353`), all written onto the analysis doc inside `tau`. That is ~20 indicators already
accumulating on every historical submission, so **identifiability is not blocked and no data is being
lost.**

What *is* thin is the dashboard payload, which forwards only the four 1–5 values and
`provenanceCounts` — a display-layer limit, not a storage one. Any structural analysis should read the
analysis docs directly, not the dashboard API.

**Do reliability first.** `POST /api/submissions/:id/reanalyze` already exists: run the same transcripts
three times at temperature 0.1 and measure how far each dimension moves. No hand labels, no ground
truth, no new transcripts. It answers a question that matters on its own — a score that moves a band
between two identical runs is not defensible to a school — and it is a *prerequisite for interpreting
anything else*, because observed correlations are bounded by the square root of the product of the two
reliabilities. With label agreement near 50%, a true correlation of 0.9 could read as 0.45. **No
correlation between dimensions can be interpreted before reliability is estimated.**

**PQ blocks the structural work.** A constant correlates with nothing, so PQ's row of the matrix is
undefined until it discriminates. PQ is not only a broken dimension; it is blocking analysis of the
other three.

**Open question:** roughly 200 submissions are needed for a stable structure over ~12 indicators, and
the data is nested (drafts within students within classes), so effective N is below the raw count. If
the pilot produces a few hundred, the programme is feasible this term. If it produces a few dozen, the
bifactor framing stays a *design rationale* — a defensible reason the dimensions overlap — rather than
something validated, and the work to do now is reliability plus persisting sub-indicators.

---

## The scoring foundation — settled 2026-08-11

**This section governs all four dimensions and supersedes every scoring formula above it.** The
dimensions are not scored. They are *read*, and the reading is the output.

### The four questions

Each dimension is a question asked of the transcript, the essay and the assignment together. The
question is the dimension — the formal name is a label on it, not a definition of it.

| Dimension | The question | Construct | Source |
|---|---|---|---|
| **Prompting Quality** | Did you drive the chat? | task initiative | Chu-Carroll & Brown 1997 |
| **Calibrated Skepticism** | Did you check what you were told? | sourcing / corroboration / contextualization | Wineburg |
| **Selective Use** | What survived? | surface vs meaning revision | Faigley & Witte 1981 |
| **Original Contribution** | Is the thinking yours? | knowledge transforming vs telling | Bereiter & Scardamalia 1987 |

Every one is an established coding scheme with published category definitions. **Nothing here is an
invented formula.** That is the entire basis of the academic defence: construct validity is inherited
from the scheme, applied as published. What has to be demonstrated locally is reliability, not
validity — the same position as any paper adopting an existing instrument.

### The output is evidence, not a number

**A count was only ever a compression of the evidence, and it compressed away the useful part.**
For each dimension the report carries:

1. **The claim** — what the student did, stated plainly.
2. **The moments that support it** — quoted from the transcript, attributed.
3. **The moment that doesn't** — the counterexample.

The third is structural, not optional. It is what makes the output feedback rather than praise, and
it is what the standing requirement — *sensitivity at the low end* — was always asking for. It gets a
fixed slot precisely so it cannot be quietly dropped when a session goes well.

Every claim is falsifiable against the transcript. A teacher can check a quote. Nobody can check a 3.

### What this retires

| Retired | Why |
|---|---|
| The 1–5 mapping (`mapTo5`) | Discards the denominator, which *is* the confidence. 10-of-11 and 2-of-2 print identically and are not the same claim. Also implies equal intervals it doesn't have. **A number came back on 2026-08-12 — as a rubric band read from the evidence, never derived from a ratio. See *The scoring scale*.** |
| The 4–20 total | Sums facets this file's own measurement model says are correlated. Averaging a strong reading and a weak one returns the one thing the session was not. **Still retired, permanently.** |
| SAMR from the total | Inherits the error. **Superseded 2026-08-12** — SAMR is now read directly as an agency ladder, not derived from anything. See *The scoring scale*. The bikeguide comparison that used to sit here was comparing two different constructs; corrected in *The bikeguide case*. |
| Dependence on the 11-way turn labels | Every dimension now reads text. The label-validity ceiling stops binding, because nothing sits on the labels. |

### Units — one per dimension, and never the turn

Turn boundaries are typing artifacts, not units of thinking. Bikeguide turn 335 carries five moves in
one turn — a process directive, a deletion and three content requests. A student with a different
typing habit sends the same thinking as five turns and scores differently. **Any measure whose
denominator is turns is measuring keystroke habits.**

| Dimension | Unit |
|---|---|
| PQ | discourse segment |
| CS | an AI claim the student took a position on |
| SU | a change the student directed |
| OC | an idea in the finished essay |

Each unit comes from its own scheme, and each is defined by the task rather than by the interface.

### The summary layer

Above the four readings sits one summary. **It is the shape of the profile — specifically, the
tension between the strongest and the weakest reading.** That tension is where the information is,
and it is exactly what a sum destroys.

Three parts:

1. One sentence naming what kind of session this was — a description, not a rating.
2. Both sides of the tension, drawing on evidence already established in the four readings.
3. One change, derived from the gap between them.

Uniform profiles get a summary that says so. **All-low is the case the tool exists to catch and must
be stated plainly**, not softened. All-high says so once and stops — inventing a weakness to fill a
slot is how feedback stops being believed.

**Do not build a taxonomy of profile names.** "The Director", "The Delegator" — that is the trap
`patterns.md` already documents: a naming layer that reads as a detection layer. Describe the shape
in the terms of that session, from that transcript.

### How this is defended

Construct validity is inherited. What must be shown locally is that the coders apply the schemes
consistently. The coders are models, which makes this cheaper than the human-coder tradition, not
weaker — with three requirements:

1. **Chance-corrected agreement.** Krippendorff's α or Cohen's κ. Never raw percent agreement, which
   flatters badly with few categories and skewed base rates.
2. **Agreement on instances, not on totals.** Do two coders surface the *same moments*? Two coders can
   agree on a count while pointing at entirely different turns. This is a better question than the
   scalar version and only becomes askable once the output is evidence.
3. **Different model families, not repeated runs of one.** Correlated errors are the real weakness —
   two LLMs share training data and failure modes, so their agreement overstates what independent
   coders would give. State it; don't hide it. It is also the standing argument for keeping at least
   one deterministic indicator.

For segment-based schemes (PQ), **boundary agreement is measured alongside code agreement.** Two
coders who segment differently will disagree on the reading even when they agree on every judgement.

**Hand-labelling is rejected** and earlier recommendations for it in this file are withdrawn. The
tool's claim *is* "read the transcript, produce the judgement." Validating that against labels
produced by whoever built the measure tests imitation, not measurement.

### What this requires of the code

`scoreTAU(classified, provenanceData)` (`analysis.js:275`) receives labelled turns and a concept
list. It cannot implement any of the above. **The analysis call takes the transcript, the essay and
the assignment together, and returns coded instances with quotes.** That signature change is the
precondition for all four dimensions.

### Open — the cost taken deliberately

Comparison across students and across assignments was cheap with a scalar and is not with evidence.
That cost is taken knowingly. It is a separate question from how a single session is evaluated, and
it should be solved without reintroducing a score of record.

**Partly answered 2026-08-12.** The rubric band restores comparison — four bands and a named level
are directly comparable across students and assignments — without restoring a score of record, since
nothing is summed and the evidence stays attached. What remains genuinely lost is comparison of the
*evidence* itself, which is written from each session and is not meant to be commensurable.

---

## The scoring scale — settled 2026-08-12

**This section is how the readings above become something a person can glance at.** It does not
replace *The scoring foundation* — the evidence is still the output, and every number here is a
judgement about evidence, never a calculation over it.

### Each dimension: a rubric band, 1–4

Each dimension is scored **1–4** by reading the transcript, the essay and the assignment against
written band descriptors, and choosing the band that fits. This is analytic rubric scoring, exactly
as a teacher marks an essay against criteria: read the whole thing, find the band, mark it.

**The number is read, not computed.** `10 of 11 → 0.91 → 4` is `mapTo5` with a new coat of paint and
is prohibited. The counts stay — displayed beside the band so a reader can check it — but they are
never the input. A student who tested two claims out of two is not automatically above one who tested
eight of eighteen; *which* claims, and whether the misses mattered, is the judgement.

| Band | What it means |
|---|---|
| **4** | Consistent, and it held at the hard moments. |
| **3** | There most of the time, with real gaps. |
| **2** | It happened, but not where it counted. |
| **1** | It didn't happen. The behaviour is absent, not weak. |

**The seam sits between 2 and 3, and the resolution is deliberately in the bottom half.** The
standing requirement on this instrument is *sensitivity at the low end* (see *Why this matters*), so
two of the four bands describe distinct failures rather than degrees of success. The 1/2 distinction
is the one a teacher can act on: a student who checked three trivial claims and none of the
load-bearing ones needs a different conversation from one who checked nothing.

**Four bands, not five.** A five-point scale supplies a midpoint that raters take when the evidence
is mixed — which is precisely when a directional call carries the most information — and it reads as
a grade, which invites the total back in.

### "Not enough here" — a non-score

Some sessions cannot support a reading. A six-turn transcript gives Calibrated Skepticism nothing to
code. **Scoring that 1 converts "we could not see it" into "you did not do it", which is a false
finding with a number on it** — a worse error than any scale choice.

So the scale is **1–4, or "not enough here."** The non-score is not a zero and does not sit on the
scale. It reports that the session was too thin to judge, which is itself actionable, and it protects
band 1 from filling with unreadable sessions until it means nothing.

### The overall: SAMR, read as an agency ladder

Above the four sits **one overall level**, named — Substitution, Augmentation, Modification,
Redefinition — and **never numbered**. Numbering the rungs makes Augmentation read as a failing
grade, which is SAMR's documented failure mode and is not what the level says.

**The construct is the AI's impact on the student's agency**, from *the AI did the thinking* to *the
student led, resisted, and the thinking that survived is theirs*:

| Level | What it says |
|---|---|
| **Substitution** | The AI did the thinking. The student set the task and took what came back. |
| **Augmentation** | The AI set the direction; the student improved what it handed them. Agency shows up in reaction, not initiation. |
| **Modification** | The student led. The AI worked to their brief, and the conversation went where they took it. |
| **Redefinition** | The student led and resisted. They pushed back where it mattered, and the thinking that survived is theirs. |

Each level is a **profile shape**, not a threshold on one dimension. An earlier draft separated
Modification from Redefinition by pushback alone, which would put a quarter of the instrument in
charge of the headline and make the top boundary unstable.

**This is a departure from SAMR as published**, and it has to be stated wherever the ladder appears
rather than absorbed quietly. Puentedura's levels describe *task* transformation; these describe
*agency*. SAMR also has no empirical validation and a rigid hierarchy with no evidence that higher is
better (Hamilton, Rosenberg & Akcaoglu 2016) — so unlike the four dimensions, whose construct
validity is inherited from their schemes, **the ladder is a communication frame borrowed to carry a
judgement, and should not be presented as an instrument on the same footing.** It survives because
teachers already have the vocabulary, and because the brand encodes it.

### How the overall is decided — the residual

It is **not** derived from the four bands. It is read from three things together:

1. **The four dimension scores** — the shape they make, never their sum.
2. **The assignment** — what was asked for, and whether the way the student worked suited it.
3. **The session as a whole** — whether control grew or collapsed across it, whether the weak moments
   landed on things that mattered, whether it reads as one person working a problem.

Points 2 and 3 are **the residual: what the overall can see and no dimension can.** Naming it is not
optional. Holistic scoring's documented failure mode is collapsing into an average of the rubric rows
— the rater has nothing else to hold, so they re-read the criteria and split the difference. Without
a stated residual the level is a mean wearing a name.

Because the level is the general factor of the four facets, it is **not independent evidence** and
cannot be used as a consistency check on them in any strong sense. What it must do is not contradict
them silently: **when the level lands somewhere the four bands would not predict, it states in one
sentence what it read to get there, and that sentence points at something checkable in the transcript
or the assignment.** When it doesn't depart, it says nothing extra.

That departure sentence is also the better reliability target. Agreement on the level is weak
evidence if both coders simply averaged; agreement on *what they read to depart* is the real test.

### What is never done

- **The four are never summed.** No total, no 4–16, no 4–20.
- **They are never averaged.** A session strong on one facet and weak on another is not a middling
  session; the average returns the one description that is certainly wrong.
- **A count is never converted into a band.** No ratios, no thresholds, no percentages.
- **The overall is never derived from the four.** Informed by them, not calculated from them.

The reason is the same each time: the four are measured in four different units — discourse segments,
AI claims, directed changes, essay ideas (see *Units*). Numbers in different units can be read side by
side. They cannot be combined.

**Consequence for the teacher surfaces:** these are ordinal, so a class *mean* of a dimension is not a
number. Report the distribution — how many students in each band. This needs writing into
`patterns.md` before a "class average PQ" tile gets built, because it will look reasonable right up
until it is wrong.

### The report describes; the teacher teaches

Settled while designing the student report, and it constrains what the scoring output is allowed to
say. Three registers were in the draft and only two belong to the tool:

- **Description** — *"you opened with a brief rather than a question"*, *"twice you refused the frame
  you were handed."* Only the tool can produce this; it read all 44 turns and the teacher did not.
  This is the value.
- **Evaluation against a published standard** — the band, the level, the evidence under them.
  Defensible because the standard is stated and the evidence is shown.
- **Instruction** — *"decide the structure before you ask for it"*, *"the moment right after a source
  fails is when to check hardest."* **This is the teacher's material and comes out of the student
  report.** It arrives without knowing what the class has covered, it can contradict what was taught,
  and it is the part that ages worst.

Where the report must point at a gap, it **names the gap rather than prescribing the fix** — *"that
spine is the one thing you never argued with"*, not *"decide the structure first."* Naming it makes
the student think; prescribing does the thinking for them, which is also the position the rest of
this file takes on evidence versus verdicts.

The prescriptive material is not lost — it belongs on the **teacher** surface as a conversation
prompt, the same treatment integrity flags already get.

**Open, and deliberate:** the student report now tells the student to do nothing. That is correct with
a teacher in the loop and a real hole without one. If this ever ships direct-to-student, it is a
different product and wants a different report.

### What this requires of designsystem.md

Two Hard Constraints encode the retired model and block this from shipping:

- *"Scores display as 1–5 per dimension, 4–20 total. Never a percentage."* — wrong in both halves.
  Becomes 1–4 per dimension or "not enough here", no total.
- *"SAMR is a subtitle, never the primary label."* — written when SAMR was arithmetic off a total it
  didn't deserve. Now that it is a reading in its own right it leads the report. **A deliberate
  reversal to record, not drift.**

**Both amended in `designsystem.md` on 2026-08-12**, and the consequences for the teacher surfaces
are specified in `teacher-dashboard-design.md` the same day — *The unit of every aggregate* is the
authority on how a band, a level and "not enough here" render; *Evidence on the teacher surface*
covers the three-slot evidence block, the departure sentence, and where the instruction register
lands now that it is out of the student report. `patterns.md` carries the *"a class mean is not a
number"* consequence this section asked for.


---

## The bikeguide case — scores against the transcript

**Added 2026-08-10.** The one real transcript we have (44 student turns, a student co-writing a bicycle
maintenance guide with Claude.ai, no coach persona), audited turn by turn against what the formulas
produced. Single case, so it proves nothing on its own — but it is the only evidence in this file that
does not come from data we authored, and it agrees with three redesigns arrived at independently.

**Caveat on the stored numbers.** The stored analysis predates the 2026-08-05 responsiveness change
(`responsiveCount` = 5/44 is the old lexical test). Current code scores PQ 5 on this transcript, not 3.

**Superseded as a scoring comparison 2026-08-11** — the 1–5 column no longer exists. Kept because the
diagnosis in it is what produced the redesign, and because it records what the old formulas did.

| | Stored | Current code | Under the settled schemes |
|---|---|---|---|
| PQ | 3 | **5** | initiative in **10 of 11 segments** |
| SU | 4 | 4 | **11 of 14 changes altered meaning**, 3 structural |
| CS | 3 | 3 | **8 instances** across ~18 engaged claims |
| OC | 3 | 3 | **~3 of 12 ideas** the student's or reorganised |
| Total | 13 (Modification) | 15 (Modification) | **no total** — see *The scoring foundation* |

**Under the settled scale (2026-08-12): PQ 4, CS 3, SU 3, OC 2, overall Modification.** The overall
was *held* at Modification rather than raised, on the residual: the one claim taken unchecked was the
replacement reference, in a document meant to be shared, immediately after that same source had
already been caught fabricating one. That is a judgement CS cannot express — it records eight checks
and a miss, and cannot say the miss was the expensive one.

**Correction, 2026-08-12.** This section previously argued that the sum's clearest failure was landing
on Modification "while the profile plainly reads as Augmentation." That was comparing two different
constructs: Augmentation is the right read on a *task-transformation* ladder (a guide a knowledgeable
cyclist could have written unaided), and Modification is the right read on the *agency* ladder that
was settled. The total is still retired — ordinal facets in four different units do not add — but this
was never evidence for it, and the argument is withdrawn rather than left standing.

**CS is carried by `refinement`, and `refinement` here is editorial direction, not skepticism.** Ten
refinement turns supply 10 of CS's 14.5 points, and they read: *"Make the maintenance at a glance
table"*, *"Now add the Future Shock user manual as a reference"*. The genuine skepticism is six turns —
catching a fabricated citation (*"British Cycling (2022). Women's bike fit guide. This doesn't
exist."*), catching a wrong sealant volume against the bottle in front of them, and demanding
verification (*"Double check the seallant volumes"*). Six of 44 would score CS 2. **This is the
saturation this file predicted for CS, now observed on real data.**

**SU = 4 is not defensible as a claim about selection.** The AI wrote all five sections of the guide
and provenance records 7 of 12 concepts as AI-born, yet SU scores 4/5 — because "4" only means five of
eleven extraction requests happened to be followed by a directive turn. A score that reads as praise
for selectivity, on a session where very little was declined, is the naming problem in its most
concrete form.

**PQ under the initiative redesign matches the human read; current PQ does not.** Roughly 17 of 44
turns introduce something the AI did not raise — the format spec, the two error catches, personal
context (Canada, tyre size, Tiagra groupset, carries tubes not a plug kit), the call to generalise the
closing away from themselves, and the question of whether Claude belongs in the references. That is
≈0.39 → PQ 3–4. Current code says 5. **Independent support for the initiative definition from real
data.**

**Integrity flags: none, correctly.** Nothing in this session warrants one.

**Net:** a competent, directive user who catches two factual errors and supplies real personal context,
while delegating most of the writing. The SAMR band is defensible; two of the four numbers under it
are not.

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

| Tier | PQ, lexical (before) | PQ, seed fallback (after) | PQ, LLM path (after) | Label agreement, Gemini vs stored |
|---|---|---|---|---|
| strong | 4 — responsive 6/17 | 4 — 8/17 | **5** — 13/17, challenge 0 | 8/17 |
| flat | 1 — responsive 0/12 | 3 — 4/12 | **5** — 9/12, challenge 0 | 5/12 |
| flagged | 1 — responsive 0/12 | 2 — 2/12 | **5** — 9/12, challenge 0 | 7/12 |
| bikeguide | 3 — responsive 5/44 | 5 — 22/44 | **5** — 36/44, challenge 1 | 24/44 |

Two things to read off this. The lexical test fired on **0 of 12 turns** for two tiers — including
`flagged`, the high-fluency AI-echoing tier it should have fired on hardest, which is evidence it
never measured echo reliably either. And PQ has gone from wrong-but-varying to correct-but-flat.

**Three of these four rows are seed tiers**, so read them as illustrations of the formula's behaviour,
not as evidence about students (*Do not validate against seed data*). The `bikeguide` row is the only
real transcript here — and it is the row where the change is largest and least defensible: PQ 3 → 5 on
a session that a turn-by-turn read scores 3–4. See *The bikeguide case*.

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

### Superseded proposal — the low/mid/high ask-quality rubric

A three-level rubric reading *what the ask is made of* (`low` = gives the AI nothing but a topic;
`mid` = specific but doesn't advance thinking; `high` = supplies what only the student could), scored
`(high + mid*0.5) / total`. **Superseded 2026-08-10, never built.**

Two faults, both visible only once the grid existed. It read **ask quality**, which is one component of
initiative (specification) and misses the other two entirely — a student can reframe the whole problem
or open a direction the AI never raised without their *ask* being especially well-made. And its
proposed seed fallback (`high` ← rejection/refinement/challenge/claim, `low` ← extraction/validation/
stuck) is construct-identical to SU's no-extraction fallback, so on a zero-extraction transcript the
two dimensions would have computed the same number by different routes.

Recorded rather than deleted because the low anchor is still the right design instinct — the stated
requirement is sensitivity at the low end — and the examples under `low` remain usable as anchors for
the rubric below.

### Settled — task initiative — SPECIFIED 2026-08-11, NOT BUILT

**PQ measures who determines how the task gets accomplished.**

The construct is **task initiative**, from Chu-Carroll & Brown (1997), which separates two things the
old PQ ran together: *dialogue* initiative (who controls conversational flow — who asks, who answers)
and *task* initiative (who controls the goal). A student can hold dialogue initiative continuously
while ceding task initiative entirely. **PQ's saturation was this confusion: `responsive` measures
dialogue initiative, and turn-taking is what a conversation is.**

Task initiative sits in PQ's cell of the grid — student-originated material, observed in the
conversation.

#### The coding scheme

**Input:** the whole transcript, the essay, and the assignment, read together. Not a label layer — the
11-way turn taxonomy is not consulted. Judgements are made against everything established in the
session so far, not against the immediately prior turn.

**Unit: the discourse segment** — a contiguous stretch of the session pursuing one sub-goal. This is
what Chu-Carroll & Brown specify, and the reason is that utterance boundaries are noise. Turn-level
coding was tried first and abandoned the same day; see *Why not turns* below.

**Boundaries come from the task structure the assignment implies** — for the bike guide, the guide's
own sections — plus explicit topic shifts. Not coder intuition. The boundary rule is part of the
instrument, and boundary agreement is measured alongside code agreement.

**Student holds task initiative in a segment if they:**

| | |
|---|---|
| **A1 — set the goal** | name what to work on, or open a direction not raised anywhere in the session so far |
| **A2 — supply the determining constraint** | give their context, equipment, reader, or convention — **unprompted** |
| **A3 — override on a criterion** | reject the AI's solution and state what it failed against |

**The AI holds it if the student:** requests content and takes what comes back; answers a question the
AI posed; or accepts without applying a criterion.

**Output:** the segments held, with the moments that establish each — not a ratio. Per *The scoring
foundation*.

#### Why not turns — corrected 2026-08-11

Turn boundaries are typing artifacts. Turn 335 of bikeguide carries five moves in one turn:

> "Let's edit each section one at a time before editing the artifact. In System 1: remove 'you're
> already doing this. Well done.' How should I clean and lube the chain? How do I check the chain for
> wear? Should I be cleaning the cassette and the derailleurs?"

Coded as one initiative turn. Sent as five turns by a student with different typing habits, it reads
as one initiative and three cedings. **The reading moves; the thinking didn't.**

The correction is not cosmetic — it changed the result. Turn-level coding gave 31/44; segment-level
gives 10 of 11. Recorded because it is the clearest demonstration in this file of why the unit is
load-bearing, and why a unit inherited from the interface is always the wrong one.

**The load-bearing rule: elicited information does not confer initiative.** If the AI asked, answering
is ceding — however substantive the answer. Without this rule the measure re-saturates immediately;
it is the exact hole `responsive` fell through.

**Second rule: whole-session novelty, not prior-turn novelty.** "New since the AI's last turn" is a
trivially easy bar and inflates the score. Both were coded on bikeguide and the difference is real:
*"What is the crank?"* is new against the prior turn but sits inside the Drivetrain scope the AI
established twenty turns earlier — it codes as AI initiative under the correct rule.

#### Coded against bikeguide

Eleven segments: opening brief, references dispute, intro rewrite, System 1 drivetrain, System 2
brakes, System 3 tyres and sealant, System 4 cockpit, pedals taxonomy, System 5 and Future Shock, the
closing, attribution.

**The student holds initiative in ten of them.**

The one they don't is **System 2 (brakes)** — the AI's structure determined what got covered (pad
thickness, contamination, fluid) and the student's four turns are content requests inside that list.
Their disc-brake correction is about their own equipment, not the segment's direction. Recorded
because the minority case is where a scheme is checkable.

The moments that establish the ten, none of which the current formula can see:

- *"I need to write a 1000 word essay in the format I want… Let's break it down by system."* — A1,
  before the AI proposed anything. Format, audience and structure were all the student's.
- *"Remove the citation because specific pages should be referenced."* — A3. The AI offered a binary
  (5th or 6th edition); the student refused the frame and took a third option.
- *"What about the pedals you clip your shoes in, what system do they belong to?"* — the student finds
  the one thing the AI's own five-system taxonomy cannot place.
- *"My breaks were a little squeaky, like a small fog horn but inconsistently."* — A1+A2, unprompted
  evidence opening a direction. Currently labelled `extraction`.
- *"The closing is very specific to me, lets make it more general."* — reframes the artifact's audience.
- *"should we also add that the document was created with the help of claude?"* — raises an attribution
  question the AI never touched.

#### What the bikeguide result establishes

**Holding ten of eleven segments is not a flattering finding to be explained away — it is correct.**
This student *is* directive. An earlier note in this file calling their PQ "too generous" was
conflating *driving* with *authorship*.

**Task initiative is orthogonal to delegation.** You can direct everything and write none of it, which
is exactly this session. The weak reading belongs to OC. Strong PQ alongside weak OC is the grid
working, not failing — and it is the tension the summary layer is built to surface.

**Limit, stated once:** n=1 shows the scheme is codeable and that its decision rules bite. It cannot
show discrimination. That needs a contrasting session on the same assignment.

#### Retired with this change

- **`responsive` retires entirely.** It scored in CS's cell and measured dialogue initiative.
- **`challenge`'s near-extinction stops being PQ's problem** — initiative never reads it. It still
  matters for CS.
- **No seed fallback is specified.** The scheme requires reading text; a label-based fallback would be
  a different measure wearing the same name. If a no-LLM path is needed, it returns null, not a number.

**~~Known limitation — coaching level is not modelled.~~ Resolved by deletion 2026-08-14: coaching
was removed from the product.** Coaching level was itself an initiative manipulation — full coaching
meant the AI drove, sounding-board meant the student had to — and normalising against it was
deliberately rejected 2026-08-10 on the grounds that coaching is an add-on and should not enter
scoring. There is now no level to normalise against: every session runs against the same unmodified
assistant with no system prompt. Cross-draft PQ comparison is supported in a way it previously was
not. Sessions recorded before 2026-08-14 carry a `coachingLevel` on their analysis and are **not**
comparable with later ones; treat the removal date as a break in the series.

### How PQ gets checked — decided 2026-08-11

**Hand-labelling is rejected.** The tool's claim *is* "read the transcript, produce the judgement."
Validating that against labels produced by whoever built the measure tests imitation, not measurement,
and is circular twice over. Earlier drafts of this file recommended it; that recommendation is
withdrawn.

The validity chain instead closes the way it does for any published coding scheme:

- **Construct validity** ← inherited from the published scheme, applied as published.
- **Reliability** ← measured on the coders. The coders are models, which makes this cheaper, not weaker.

Three requirements on the reliability numbers:

1. **Chance-correct them.** Krippendorff's α or Cohen's κ, never raw percent agreement. With two
   categories and skewed base rates, raw agreement flatters badly — the ~50% figure quoted elsewhere in
   this file is uncorrected and worse than it reads.
2. **Agree on codes, not scores.** Two coders can disagree on every turn and produce the same ratio.
   Measure α at the turn level, before aggregation.
3. **Use different model families, not two runs of one.** Correlated errors are the real weakness —
   two LLMs share training data and failure modes, so their agreement is inflated relative to what
   independent human coders would give. This is a limitation to state, not one to hide, and it is the
   standing argument for keeping at least one deterministic indicator that shares no training data.

Beyond reliability, there was one behavioural check that needed no labels: PQ should rise across
full → questions → sounding-board, because the coaching fade *is* a task-initiative manipulation —
a known-groups test with ground truth by design. **Unavailable as of 2026-08-14: coaching was removed
from the product, so the manipulation no longer exists.** Any replacement known-groups test has to
come from something else that plausibly moves initiative — assignment type, or drafts within a
student — and none of those carry ground truth the way the fade did. This is a real loss to PQ's
validation plan, not a gap that closed itself.

---

## SU — Selective Use

### What it computes today, and why that isn't the construct

`highFollowups / extractionEvents` — for each `extraction` turn, was the *next student turn*
high-agency. It reads turn labels and nothing else; **`essayText` is never passed to `scoreTAU`**. So
the current measure is a turn-order shape, not a statement about what the student used.

Faults, in order of severity:

- **It is not measuring selection.** "What label came next" says nothing about which AI material the
  student judged worth keeping. A name that reads as *Selective Use* while computing post-extraction
  turn order is a validity problem, not just a naming one.
- The no-extraction fallback (`highTotal / (highTotal + lowTotal)`) is a general agency mix — a
  different construct under the same name, and the one the superseded PQ proposal would have collided
  with.
- It is a ratio over extraction *events*, so one extraction with one good follow-up scores 5.
  Sensitivity to tiny denominators is unexamined.

**The post-extraction shape is worth keeping — as a pattern, not as a dimension.** It moves to
`patterns.md`, where turn-order shapes belong.

### Redesign — discrimination over AI-offered material — NOT YET BUILT

**SU measures whether the student's uptake of AI material shows evidence of criteria.** Its cell in
the grid is AI-originated material, observed in the essay. Its denominator is **AI-originated ideas
only** — student-introduced ideas the AI refined are `synthesized` and belong to OC.

**What was rejected, and why it matters.** The obvious measure is an uptake ratio: of the ideas the AI
offered, how many reached the essay. **This is not a discrimination measure.** In the appropriate-
reliance literature (Lee & See 2004 on trust calibration; Schemmer et al. 2023) the construct is
defined against ground truth about the AI's output — accepting is optimal when the AI is right and
harmful when it isn't, so accept-rate alone is content-free. We have no ground truth about whether an
AI-offered idea deserved to be used. A student who had a meandering session and grabbed the last three
things scores identically to one who discriminated carefully. **Any version of SU built on an uptake
proportion is measuring session shape, not judgement.**

Manufacturing ground truth by having the model rate the relevance of its own suggestions was
considered and rejected: it grades the student on whether they should have listened to the model, as
judged by the model, and penalises a student who correctly rejects a bad suggestion. That is a
systematic bias pointing away from the behaviour the product exists to encourage, and a sharper form
of the model-determined-denominator problem already flagged against OC.

### Settled — revision analysis — SPECIFIED 2026-08-11, NOT BUILT

**The question: what survived?**

**Construct:** **surface vs text-base revision** (Faigley & Witte 1981) — an established taxonomy for
coding changes between drafts, split further into microstructure and macrostructure. It applies here
directly, and it dodges the ground-truth problem entirely: **you are not judging whether a change was
good, only whether it was substantive.**

**Unit:** a change the student directed.

| Code | The change… |
|---|---|
| **Surface** | alters form without altering meaning — spelling, punctuation, formatting, layout |
| **Meaning — micro** | alters what the text says at the level of a claim or fact |
| **Meaning — macro** | alters how the work is organised, or who it addresses |

**Use the in-session artifact trail, not draft submissions.** `GUIDE_ASSIGNMENT` has
`draftBudget: 1`, so a draft-pair analysis has nothing to compare — but the artifact was revised
continuously *inside* the chat. That is the richer record, and it is captured at full fidelity now
that the conversation happens in the tool. Draft pairs remain usable where an assignment has several;
they are not the primary source.

**Fit is out of scope.** A student can thoughtfully refine an idea that had no business in the essay.
Judging that needs the assignment goal, and the product's line is explicit — feedback is about *how*
they worked with the AI, never about essay quality. SU codes the change, not its merit.

**A deterministic component is available and should be built.** Word-for-word carryover from AI turns
into the essay is computable by n-gram matching with no LLM call. The load-bearing detail: attribute
each n-gram to whoever said it **first, anywhere in the conversation** — a coach paraphrases the
student constantly, and matching against AI turns alone would attribute the student's own phrasing
back to the AI. It has **no label dependency and no model dependency**, which is what makes it the
one indicator that can separate construct from method variance. Two caveats: exact reuse is near zero
for most students, so it is a good detector and a poor scale — it may belong with the integrity flags;
and it misses near-paraphrase, the common real case.

**Why SU survives as a separate dimension from CS.** Its content is the same family — judgement
applied to AI output. The distinction: **CS codes the act of evaluating; SU codes whether evaluation
changed what survived.** Skepticism that never alters the artifact is performance. Under the
shared-evidence rule the two read different aspects of the same events — CS reads the appeal made, SU
reads the consequence — so neither increments off the other's observation.

#### Coded against bikeguide

**Fourteen directed changes: three surface, eleven meaning — three of those macrostructural.**

| Surface | Meaning |
|---|---|
| remove m-dashes throughout | drop the fabricated reference |
| tyres → tires (and practise, centre) | remove the plug kit from the tool list |
| "maintenance at a glance" table | correct the sealant volumes against the bottle |
| | split pedal content across two systems *(macro)* |
| | generalise System 5 while keeping personal detail *(macro)* |
| | rewrite who the closing addresses *(macro)* |

**This is the case where the current code and the scheme agree on the shape and disagree completely
on the reason.** Today's `highFollowups / extractionEvents` reads 4 on this session, which the earlier
audit in this file called indefensible — correctly, because it computes post-extraction turn order and
never touches the artifact. Under revision analysis the strong reading is right: this student drove
meaning-level change, including three structural ones.

**The weakest counterexample of the four.** The m-dashes and spellings each took several rounds, which
is true but thin. That SU's "where you didn't" reads weaker than the other three suggests its
counterexample may need a different question — noted, unresolved.

## CS — Calibrated Skepticism

**The question: did you check what you were told?**

### Settled — source-evaluation heuristics — SPECIFIED 2026-08-11, NOT BUILT

**Construct:** Wineburg's **sourcing, corroboration and contextualization** — a coding scheme built
for think-aloud protocols of people assessing sources. A chat transcript is a closer analogue than
what the scheme was designed for.

**Why not the obvious literature.** Appropriate reliance / trust calibration (Lee & See 2004;
Schemmer et al. 2023) is the nearer-sounding fit and is unusable: it defines the construct against
ground truth about whether the AI was right. We don't have that and must not manufacture it from the
model — see the rejection recorded under SU.

**Unit:** an AI claim the student took a position on.

| Code | The student… |
|---|---|
| **Sourcing** | asks where it comes from, who says it, whether it can be verified |
| **Corroboration** | checks it against another source — a bottle, their own bike, another reference |
| **Contextualization** | tests whether it applies to *their* situation |
| **Uncritical** | engaged, applied nothing |

Content the student never touched is outside the scheme entirely — in neither the instances nor the
denominator. That is what keeps CS from double-counting against SU, per *The shared-evidence rule*.

**Directing format applies no epistemic heuristic and produces no instance.** This is the scheme
ruling, not taste, and it is the fix for the saturation this file predicted and then observed: ten
`refinement` turns currently carry CS, and they read *"Make the maintenance at a glance table"*.

#### Coded against bikeguide

Eight instances across roughly eighteen engaged claims:

| Moment | Code |
|---|---|
| *"British Cycling (2022). Women's bike fit guide. This doesn't exist."* | sourcing |
| *"…I don't have it so it's hard to check the sources"* (Zinn) | sourcing |
| *"Remove the citation because specific pages should be referenced."* | sourcing |
| *"Double check the seallant volumes"* | sourcing |
| *"The bottle says 30-40ml for a top up…"* | corroboration |
| *"No i have disk breaks…"* — correcting the AI's inference against their actual bike | corroboration |
| *"I wont be carrying a plug kit, I just carry extra tubes."* | contextualization |
| *"Why tyres instead of tires?"* | contextualization |

**The counterexample, and it is the sharpest finding in the session:** when the AI admitted
fabricating the British Cycling reference and replaced it with Kotler et al. (2023), **the student
took the replacement without checking it.** The moment after a source fails is when to check hardest.
No formula in this file could ever have surfaced that; the scheme surfaces it as an absence.

## OC — Original Contribution

**The question: is the thinking yours?**

### Settled — knowledge transforming vs telling — SPECIFIED 2026-08-11, PARTLY ALREADY BUILT

**Construct:** **knowledge transforming vs knowledge telling** (Bereiter & Scardamalia 1987), one of
the most-cited constructs in writing research and a direct statement of the question. *Telling* =
content arrives in the essay in the form it already had. *Transforming* = the content changed because
of the writer's rhetorical goal.

**Unit:** an idea in the finished essay.

**This was already built once.** The **Type Match Ratio** in `index.html` — comparing relationship
structure between the conversation's knowledge graph and the essay's — *is* an operationalisation of
transformation. Same concepts with preserved relationships is telling; same concepts with reorganised
relationships is transforming. `app/` dropped it and substituted counting provenance origin tags,
which is a regression: origin tags record *where an idea came from*, never *whether it changed*.
Porting it forward is the job. See the memory note *Critical Thinking Graph Analysis* and Phase 3 of
the original TAU migration.

Per the grid, OC's cell is **student-originated material observed in the essay** — *whose idea*, not
*whose words*. A student who takes an AI-born idea and expresses it entirely in their own voice reads
low here and should; a student who holds their own idea and lets the AI phrase it reads high and
should. The words question belongs to SU's deterministic component. Stated explicitly because a "did
you copy" measure is the obvious thing to reach for when OC reads low, and it would be scoring in the
wrong cell.

**The standing concern, unchanged:** the idea inventory is model-determined, so a model that surfaces
more AI-born concepts lowers OC without the student behaving differently. Transformation coding
reduces but does not remove this, because the denominator is still an enumeration the model produced.

#### Coded against bikeguide

**The frame is the student's; the structure is the AI's.** Roughly three of twelve substantive ideas
originated with the student or were reorganised by them.

Theirs: the reader and the reason the guide exists (*"usable for female riders who rely on partners"*
— the AI never proposed either), the opening prose they wrote and dropped in whole, and their own
practice changing what the guide recommends (*"I wont be carrying a plug kit"*).

**Where it isn't:** the five-system structure, the maintenance tables and the service intervals came
from the AI and stayed in the shape they arrived in. That is the guide's spine, and it is the one
thing the student accepted without argument — in a session where they argued with nearly everything
else.

---

## Cross-cutting: label validity

Everything above sits on top of the 11-way turn classification, and agreement with the labels stored
in `seed-data.js` is only about half (8/17, 5/12, 7/12, 24/44). **No dimension can be calibrated more
precisely than the labels underneath it**, so this may need resolving before any dimension rubric is
tuned.

**Corrected 2026-08-10 — this was previously described as "model vs hand", and it isn't.** The labels
hardcoded in `seed-data.js` were produced by running the transcripts through the *original CTA
analysis on Groq*, then transcribed in by hand. They are model output, not human judgement. Two
consequences:

- Those agreement figures are **model versus model** — Groq/llama disagreeing with Gemini on an 11-way
  scheme with fuzzy boundaries. That is expected, and much less alarming than a model disagreeing with
  a domain expert.
- **There is no human-labelled reference anywhere in this project.** Not for the seed tiers, not for
  bikeguide. The label-validity ceiling is therefore *unmeasured*, not measured at ~50%. Any claim
  about it — in either direction — is currently unsupported.

The cheapest fix remains the one already identified: ~20 student turns from a **real** transcript,
labelled by hand, scored for agreement. Until that exists, the ceiling is an open question rather than
a known constraint.

Also open: `challenge` almost vanished once the classifier was given coach context (5 → 1 on
bikeguide, 0 across three tiers). Either the earlier count was inflated by seeing turns in isolation,
or the new prompt suppresses it. Unresolved — but **no longer blocking PQ**, which under the initiative
redesign never reads `challenge`. It now matters for CS, whose cell the label falls into, and for
`patterns.md`'s *abandoned challenge* detector, which keys on three labels rather than one precisely
because of this scarcity.

**The label-validity ceiling binds unevenly**, which is worth knowing before choosing what to build:

- **Ratio measures** (all four dimensions as currently specified) average label noise out across dozens
  of turns.
- **Sequence detectors** (`patterns.md`) can be created or destroyed by a single mislabelled turn, so
  the ceiling binds much harder there.
- **Deterministic components** (PQ's novelty check, SU's n-gram carryover) do not sit on labels at all
  and are not capped by this. That is their main argument, independent of what they measure.

---

## Session log

- **2026-08-12 — the scale settled; a number came back, the total did not; nothing built.** The
  session started from a design question — how a reader understands an evidence report at a glance,
  which the retired 1–5 did cheaply — and ended up settling how scoring works.

  **Rubric bands, 1–4, read not computed.** The evidence output stays; a band sits on top of it,
  chosen by reading against written descriptors the way a teacher marks against criteria. Converting
  a count into a band is prohibited — that is `mapTo5` again. Four bands rather than five (no safe
  midpoint), with **the seam between 2 and 3 and the resolution in the bottom half**, because the
  standing requirement on this instrument is sensitivity at the low end. Added **"not enough here"**
  as a non-score: a thin transcript scored 1 turns *we couldn't see it* into *you didn't do it*.

  **The overall is a fifth judgement, not a total.** SAMR names, redefined as an **agency** ladder —
  how much the AI displaced the student's thinking — after the task-transformation version was
  rejected as not what this tool measures. Named, never numbered. Read from the four bands, **the
  assignment**, and the shape of the session; the last two are the *residual*, the thing the overall
  can see that no dimension can, and naming it is what stops holistic scoring collapsing into an
  average of the rubric rows. Departures from the profile must carry a one-sentence justification
  pointing at the transcript.

  **The report describes; the teacher teaches.** Instructional copy came out of the student report —
  it arrives without knowing what the class has covered and can contradict it. Where the report points
  at a gap it names the gap instead of prescribing the fix. The prescriptive material moves to the
  teacher surface, same treatment as integrity flags.

  **Corrected:** the claim at *What this retires* that bikeguide's sum "lands on Modification while
  the profile plainly reads as Augmentation." Two different constructs — Augmentation is right on a
  task ladder, Modification on the agency ladder. The total stays retired on the arithmetic, but that
  argument is withdrawn.

  **Bikeguide under the settled scale:** PQ 4, CS 3, SU 3, OC 2, overall **Modification**, held rather
  than raised on the unchecked replacement reference.

  **Blocks `designsystem.md`:** two Hard Constraints encode the retired model ("1–5 per dimension,
  4–20 total"; "SAMR is a subtitle, never the primary label"). Both need rewriting — the second is a
  deliberate reversal, since SAMR now leads the report.

  **Also:** dimension bands are ordinal, so no class means on teacher surfaces — distributions only.
  To be written into `patterns.md`.

  **Student report artifact updated** to the settled scale — level-led hero, four collapsible
  rubric-scored readings: https://claude.ai/code/artifact/8b8445d8-b702-45dd-85f4-976428c63fb8

  **Nothing built.** `scoreTAU`'s signature is still the blocker for all of it.

- **2026-08-11 (later, same day) — the scoring foundation settled; all four dimensions specified;
  nothing built.** The session continued past PQ and changed what a dimension *is*.

  **The output is evidence, not a number.** A count was only ever a compression of the evidence, and
  it compressed away the useful part — the denominator (which is the confidence), the composition
  (which is what a teacher can act on), and the moment the student *missed* (which is the feedback).
  Each dimension now yields a claim, the quoted moments supporting it, and the counterexample. The
  1–5 mapping, the 4–20 total, SAMR-from-the-sum, and all dependence on the 11-way turn labels are
  retired. Recorded in a new section, *The scoring foundation*, which governs the whole file.

  **All four matched to published coding schemes** — PQ task initiative (Chu-Carroll & Brown 1997),
  CS sourcing/corroboration/contextualization (Wineburg), SU surface vs meaning revision (Faigley &
  Witte 1981), OC knowledge transforming vs telling (Bereiter & Scardamalia 1987). Construct validity
  is inherited from the scheme; only reliability has to be shown locally. Each was coded against
  bikeguide.

  **PQ corrected from turns to segments, same day it was specified.** Turn boundaries are typing
  artifacts — bikeguide turn 335 carries five moves in one turn. The correction changed the result
  (31/44 → 10 of 11 segments), which is the file's clearest evidence that a unit inherited from the
  interface is always wrong. Every dimension now has its own task-defined unit; none is the turn.

  **Two findings the schemes surfaced that no formula could.** CS's real counterexample is an
  *absence*: when the AI admitted fabricating a reference and supplied a replacement, the student took
  the replacement unchecked. And OC's is that the one thing this student accepted without argument was
  the guide's structure — in a session where they argued with nearly everything else.

  **OC is a port, not an invention.** Type Match Ratio in `index.html` already operationalises
  transformation; `app/` replaced it with counting provenance origin tags, which records where an idea
  came from and never whether it changed.

  **An alternative student report was built as an artifact** to see the output form — summary, then
  four question-led readings with quoted evidence and a fixed counterexample slot. It reads as a
  document rather than a scorecard. **It breaks a `designsystem.md` Hard Constraint** ("Scores display
  as 1–5 per dimension, 4–20 total") — that line encodes the retired model and needs updating if this
  direction ships.

  **Nothing built.** The blocker for all four is unchanged and now explicit: `scoreTAU`'s signature.

- **2026-08-11 — PQ settled on task initiative; scored 4 on bikeguide; nothing built.** The session
  reset scope: stop generating validation programmes, answer whether prompt quality can be measured.
  It can. *(The 1–5 result in this entry was superseded later the same day — see the entry above.)*

  **The construct.** Task initiative (Chu-Carroll & Brown 1997), which separates task initiative from
  *dialogue* initiative. That distinction is the whole diagnosis — `responsive` measured dialogue
  initiative, and turn-taking is universal, so PQ read 5 by arithmetic. Each dimension was matched to an
  established coding scheme rather than an invented formula: PQ → task initiative, CS → Wineburg's
  sourcing/corroboration/contextualization, OC → knowledge transforming vs telling (Bereiter &
  Scardamalia 1987), SU → revision analysis (Faigley & Witte 1981). Only PQ was worked through.

  **Two decisions that changed the shape of the work.**
  1. **Dimensions read text, not labels.** The 11-way taxonomy is a lossy intermediate and the source of
     the label-validity ceiling. Scoring reads the transcript, essay and assignment together. This is
     blocked by `scoreTAU`'s signature, now recorded in the status header.
  2. **Whole-session context, not prior-turn.** Sessions captured in the tool are verbatim on both
     sides, so there is no reason to code against a sliding window. Changes real codings — *"What is the
     crank?"* is initiative against the prior turn and not against the session.

  **Hand-labelling rejected**, and the earlier recommendation for it withdrawn. Construct validity is
  inherited from the published scheme; reliability is measured across model coders, chance-corrected, at
  the code level, across different model families. See *How PQ gets checked*.

  **Result:** bikeguide 31/44 = 0.70 → **PQ 4**, against 5 from current code. Bands set from the
  construct rather than reused from `mapTo5`. The result also sharpened the grid: task initiative is
  orthogonal to delegation, so PQ 4 / OC 2 — a competent director who wrote little — is the instrument
  working. An earlier note in this file calling bikeguide's PQ "too generous at 3–4" was conflating
  driving with authorship.

  **Nothing built.** CS, OC and SU still to do.

- **2026-08-10 — measurement model settled; PQ and SU redesigned; nothing built.** Started from a
  teacher-dashboard triage question and arrived here by way of `patterns.md`: the dashboard's pattern
  cards turned out to be dimension thresholds wearing prose names, which forced the question of what
  the dimensions are actually for.

  **The framing decision.** The four dimensions are facets of one construct (agency), not independent
  measures — so overlap is expected and orthogonality is not a design goal. What each facet needs is
  incremental validity. The 2×2 grid (whose material × where observed) gives each dimension exactly one
  cell it owns, and immediately diagnosed PQ's real defect: `responsive` scores in CS's cell, which is
  *why* it saturated rather than merely how.

  **PQ** redesigned from ask-quality to **conversational initiative** — agenda, specification,
  reframing. `responsive` retires. Dissolves two standing blockers rather than solving them: the ~80%
  responsiveness ceiling and `challenge`'s near-extinction both stop being PQ's problem. Coaching-level
  normalisation was designed and then **deliberately cut** — coaching is an add-on and shouldn't enter
  scoring; the cost is that cross-level PQ comparison isn't supported, recorded in the PQ section.

  **SU** redesigned from post-extraction turn order to **discrimination over AI-offered material**.
  Two findings drove it: the current measure never touches the essay at all, and an uptake ratio is
  formally not a discrimination measure without ground truth about the AI's output — which we don't
  have and shouldn't manufacture from the model. Landed on differential treatment, articulated
  criteria, and counterfactual influence across drafts, conditional on CS so the two aren't nested.
  The post-extraction shape moves to `patterns.md`.

  **Feasibility assessed honestly.** The bifactor model is *not identifiable* with four scores — a
  structural limit, not a sample-size one. Two consequences with deadlines attached: persist the
  sub-indicators `scoreTAU` already computes (storage change, no measurement change, and every day
  it's deferred is data that can't answer the question later), and run test-retest via `reanalyze`
  before interpreting any correlation, since observed correlations are bounded by reliability.
  Method variance can't be separated while every indicator comes from the same model on the same
  transcript — which is the real argument for the deterministic components in PQ and SU.

  **Corrected during the session:** an earlier claim that two dimensions correlating above ~0.85 are
  one dimension. That threshold is meaningless without reliability estimates; with label agreement
  near 50%, a true correlation of 0.9 could read as 0.45.

  **Nothing built.** No code changed. Open question gating the programme: how many submissions the
  pilot will produce this term — a few hundred makes the structure testable, a few dozen leaves the
  bifactor framing as design rationale rather than validated fact.

- **2026-08-10 (later, same day) — first nuisance-variable check run; seed data disqualified as
  measurement material.** Ran TAU against turn count, turn length, essay length and draft number to
  test whether the scores are a productivity measure wearing an agency label.

  **The headline: the check passes on real data.** On the bikeguide transcript, turn length does not
  predict agency label (Cohen's d = 0.12). On the 11 authored seed transcripts the same test gave
  d = 0.83 — a large effect that would have been disqualifying if real. It was an authoring artifact.
  Recorded in *Do not validate against seed data*, which is now a standing constraint on every
  validation plan in this file and in `patterns.md`.

  **Two corrections to what this file said yesterday**, both of which had made things sound worse than
  they are:
  1. Sub-indicators were claimed to be discarded before storage and needing urgent persistence. Wrong —
     `scoreTAU` returns ~20 of them and they are all stored (`analysis.js:353`). Nothing is being lost.
  2. The ~50% label agreement was described as model-vs-hand. Wrong — the `seed-data.js` labels are
     Groq output from the original CTA, so the figure is model-vs-model, and **no human-labelled
     reference exists anywhere in this project.**

  **Bikeguide audited turn by turn** (new section). Two predictions in this file were confirmed on real
  data — CS is saturated by `refinement`, and SU's score is unrelated to selection — and PQ-as-initiative
  independently matched a human read of the transcript where the current formula did not.

  **Still not run:** the perturbation test (compress high-agency turns, pad low-agency ones, re-classify)
  to check whether the *current* Gemini classifier is length-sensitive the way Groq's labels were not.
  Blocked only on `gcloud auth application-default login`.

  **Nothing built.** No code changed.

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
