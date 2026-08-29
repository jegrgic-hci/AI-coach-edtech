# Reliability — what to run, on what, and what it will and won't tell you

**Scope of this file.** A working note on establishing that the coders apply the schemes
consistently: what sample size is actually needed, what can be run today, and what has to be built
first. Written 2026-08-30 to be revisited.

**Not in this file.** `tau-dimensions.md` owns the method — the coding schemes, the three
requirements on the numbers, the measurement model. **It is the source of truth and this file must
not fork it.** What is here is the plan and the build state, kept separate so revisiting it does not
mean re-reading a 1,000-line design document.

---

## The short answer

**Yes, a reliability run is possible today**, on the transcripts already held. It will tell you
whether the classifier is stable at all. It will not yet produce a figure worth citing. Both halves
of that matter — see *What today's run can and cannot say*.

**And the sample you are collecting is the right size for this job.** 10–30 real submissions is
enough for reliability. It is not enough for the correlation structure, and does not need to be.

---

## Why 10–30 is enough

**Agreement is computed over coding units, not over students.** The unit is a turn label — or a
segment, for PQ — not a submission. One transcript with 40 student turns is 40 coding decisions.
Twenty transcripts is roughly 600–1,000 units. For agreement on per-turn labels that is a
comfortable sample, not a thin one.

This is why `tau-dimensions.md` line 207 lists *estimating reliability of the four scores* as
**"Yes, now — no new data needed."** The count was never the bottleneck for this question.

**Drafts count.** Multiple drafts from one student are separate coding material for reliability, even
though they are not independent observations for factor structure. Eight students across twenty
drafts is twenty transcripts' worth of units.

### What needs ~200, and is a different question

The correlation structure between dimensions and the bifactor framing. `tau-dimensions.md` line 240:
roughly 200 submissions for a stable structure over ~12 indicators, and the data is nested (drafts
within students within classes) so effective N sits below the raw count. Its own conclusion if the
pilot yields a few dozen: **the bifactor framing stays a design rationale rather than something
validated, and the work to do now is reliability plus persisting sub-indicators.**

So the two jobs separate cleanly. Do the one the sample fits.

---

## What 10–30 buys that 1–3 cannot

**Variance.** PQ reads 5 on nearly every transcript. With one transcript a flat measure and a correct
measure are indistinguishable. With twenty you see the distribution and find out whether a dimension
discriminates between students at all — a more fundamental problem than its reliability, and cheaper
to detect.

**Usable base rates.** Chance correction uses the base rate of each label. From n=1 those rates are
noise, so the correction is meaningless. `tau-dimensions.md` line 336 warns that raw percent
agreement flatters badly under skewed base rates; you need enough real transcripts to know what the
real skew is.

**Failure modes nobody predicted.** The PII scan flagged "Jacob" — it was Irwin Jacobs, the Qualcomm
founder, discussed by the AI in a conversation about CDMA. Nobody designed for that. It came from
running real data, and more real data surfaces more of it.

**Never the demo seed.** Authored transcripts carry structure real sessions don't. Anything
calibrated on `app/data/` or `seed-data.js` is calibrated on an artifact. The dev store holds 56
submissions and 4 non-fixture accounts — the ratio is the warning.

---

## What can be run today

**The mechanism exists and the storage already does the right thing.**

`POST /api/submissions/:id/reanalyze` ([index.js:1587](app/server/index.js#L1587)) calls
`runAnalysis`, which **adds a new `analyses` document** and repoints the submission at it
([analysis.js:650](app/server/analysis.js#L650)). Nothing deletes the previous one. So repeat runs
accumulate, each preserving its own `classified` array — the per-turn labelling the dimensions are
computed from. Verified 2026-08-30: 5 submissions in the dev store already carry more than one
analysis.

That is the input an agreement statistic needs. Repeat-coding the same transcript N times and
comparing the `classified` arrays turn by turn gives the model's **self-consistency**, which is the
floor: a coder that does not agree with itself cannot agree with anyone.

**Access note.** The HTTP route is gated by `canReadSubmission`, so it runs as the owning teacher — a
platform admin gets 403. For a measurement run, call `runAnalysis(submissionId)` directly from a
script instead; `backfill-analysis-version.js` is the precedent for that shape, including the dry-run
/ `--apply` convention.

**Cost.** Each run makes three LLM calls (classification, provenance, reading), attributed per
student through `llmCalls`. Five repetitions across twenty submissions is 100 runs / 300 calls.
Budget it before starting, not after.

### What today's run can and cannot say

With only 1–3 real transcripts, ~120 coding units, and 11 student labels, most label cells are empty
or near-empty. That is enough to **detect gross instability** — the classifier flipping labels
between identical runs — and not enough for a defensible coefficient with usable confidence
intervals. Run it as a floor check and read it as one.

---

## What is not built

1. **Nothing computes agreement.** The repeat codings will be stored; the κ / Krippendorff's α over
   them has to be written. This is the actual gap, and it is small.
2. **Sub-indicators are not persisted.** `tau-dimensions.md` line 244 names this alongside
   reliability as the work to do at a few dozen submissions.
3. **The non-model anchor.** Line 342: two LLMs share training data and failure modes, so their
   agreement overstates what independent coders would give. Some subset needs human coding, by more
   than one person, against the published codebooks. The masked export is readable prose, so this is
   a scheduling problem rather than an access one.
4. **Boundary agreement for PQ.** Lines 346 and 893: PQ is segment-based, the boundary rule is part
   of the instrument, and coders who segment differently disagree on the reading even when they agree
   on every judgement. Boundary agreement is measured alongside code agreement, not instead of it.

---

## The collection risk — closed 2026-08-30

The `improvement` stamp is date-enforced: `export-improvement.js` exports only work submitted at or
after `grantedAt`, never backwards ([line 142](app/server/export-improvement.js#L142)), so a class
stamped mid-term permanently and silently loses its own first sessions.

**This no longer depends on anybody remembering.** The `codeRoster` grant is now the **Pilot user**
arrangement — anonymous students *and* their work used for improvement — and `POST /api/classes`
writes the stamp in the same document as the class, giving `grantedAt === createdAt`. Nothing to tick
per class, and no window in which sessions run unstamped. See `pilotuser.md` *Consent* for what
happens when the grant is applied to a teacher who already has classes, and after a withdrawal.

---

## The legal position, briefly

Settled, and not a constraint on any of the above.

Checking that the tool codes this cohort's work correctly is **service refinement**, inside the
DPA's authorised purpose (§ 3.2) and needing no separate instrument. Construct validity is
**inherited** from the published schemes the dimensions borrow — Wineburg, Faigley & Witte, and the
rest — so what has to be shown locally is that the coders apply them consistently
(`tau-dimensions.md` lines 267, 332).

The only thing that crosses into § 3.6 research territory is **publishing an agreement coefficient
as evidence the instrument is sound**. Computing one to find out whether the classifier is stable
does not. If publication is ever intended, the determination has to be made *before* collection —
consent cannot be obtained retroactively. See `legal.md`.

---

## Order of work

1. ~~Stamp every pilot class at creation.~~ **Done 2026-08-30** — automatic for a Pilot user.
2. Write the agreement script — repeat `runAnalysis`, read all `analyses` for a submission, compare
   `classified` arrays turn by turn. Chance-corrected, on codes rather than scores.
3. Run it on the real transcripts held today as a floor check on self-consistency.
4. As the pilot lands 10–30 real submissions, re-run for base rates, variance, and whether each
   dimension discriminates.
5. Human-code a subset as the non-model anchor.
6. Persist sub-indicators.
