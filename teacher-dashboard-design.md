# Teacher Dashboard — Design Documentation

## Purpose

A teacher-facing view of the Critical Thinking Auditor. Gives educators a structured way to see how
their classes, assignments and individual students are working with AI. Surfaces integrity flags
without exposing them to students.

The guiding principle: **guide first, detail on demand.** Teachers have many students and limited
time. The dashboard surfaces who needs attention and why in plain language.

**Rewritten 2026-08-12 for the band/level scoring model.** `tau-dimensions.md` settled that each
dimension is **read as a band 1–4, or "not enough here"**, and that the overall is **a named level
read directly** — no total, no average, no band derived from a count. Roughly a third of this page
was arithmetic that has no inputs under that model. The principle above survives unchanged; what
died is the arithmetic that had quietly become the primary display anyway (`12/20` on every roster
row, "Averaging 2.1 of 5" on the fleet cards, a mean on every aggregate tile).

**What the dashboard reports now: the composition of a room, and the evidence under each student.
Never a rank.** Counts across the four levels and the four bands carry more than a mean ever did —
*"most of this class improves what the AI hands them rather than directing it — 11 of 24 at
Augmentation"* is a teaching decision; *"2.6"* is not.

Three operations are prohibited on every surface in this file. Cite this line rather than
re-arguing it locally:

1. **No total.** The four dimensions are measured in four different units and are never summed.
2. **No mean of a dimension, at any tier.** These are ordinal bands. A class figure is a
   **distribution** — how many students in each band.
3. **No band or level derived from a count.** Counts are displayed *beside* a band so a reader can
   check it; they are never the input to one.

**The headline rule that follows.** A class-level headline is a **modal claim with its
denominator** — "11 of 24 at Augmentation" — never a central tendency. Where no band or level holds
a plurality, the headline says the room is **split** and names the two groups. It never averages
them into a middle that describes nobody. `split` replaces the old `skewed` flag (`cohort range
≥ 2`), which was a spread measure on a continuous scale that no longer exists.

---

## Where the surfaces stand — read this first (2026-08-17)

**The dashboard was rebuilt across 2026-08-16/17 and large parts of this file now describe surfaces
that no longer exist.** Sections marked **⚠ SUPERSEDED** below are kept for the arguments in them,
not as a spec. This table is authoritative; where it and a body section disagree, this wins.

| Surface | What it renders now | Entry point |
|---|---|---|
| **Home** | triage tiles · classes · **patterns (Layer 1)** · **two Movement mounts** — agency alone (no selector), then the four dimensions behind tabs. Calendar buckets. | `renderHome()` |
| **Class** | overview card with Overview / Patterns / **Trends** (the same Movement organism, assignment axis) · then Open and Closed assignment cards | `renderClassDetail()` |
| **Assignment card — open** | tiles · submitted-vs-readable pace line · patterns (Layer 1). **No distribution, no origin mix.** | `renderAssignmentAggregateContent(a, s, 'summary')` |
| **Assignment card — closed** | tiles · **agency composition, and nothing else** (2026-08-18). No bands, no finding prose, no flows — the card repeats in a list, so it carries one chart and the link out. | same, `'summary'` |
| **Assignment Detail** | draft schedule · **the summary is two Movement mounts on the draft axis** (2026-08-18) — agency, then the four dimensions behind tabs — plus coaching note, patterns, origin mix · timeline of per-draft snapshots, each closed one carrying **agency + bands side by side** (`.cols-2up`) | `renderAssignmentDetail()` |
| **Student** | rows and drill panel read **level**, not a total. Each expanded assignment leads with a **Trace** — the finding, then agency + four dimension rows across the closed drafts (2026-08-17) | `renderStudentDetail()` · `renderStudentTrace()` |
| **Browse Students** | Student · **Agency** (latest readable level) · Signal. The mean-of-totals column is gone. | `renderBrowseStudents()` |

**There is no line chart anywhere in `dashboard.html`.** `svgLineChart`, `FINAL_METRICS`,
`classAssignmentSeries`, `classSeriesOutlierNote`, `classDimensionTrend`, `dimensionRowsFromCohort`,
`TAU_DIMENSIONS`, `renderTeachingSection` and the whole per-draft histogram are deleted.

### The two rules the rebuild rests on

1. **A bar is a reading of ONE TASK; a flow is a reading of A SEQUENCE.** A surface gets a bar only
   if its scope names a shared task, and a flow only if it has two closed windows. This is why Home
   has no composition — pooling levels across classes running different work asserts a comparison the
   material does not support — and why the class tier's compositions live inside its assignment cards
   rather than in a class-level strip.
2. **On an incomplete cohort, show what has a per-student denominator; withhold what has a per-class
   one.** A pattern stays true as more students arrive; a distribution's *shape* is dominated by who
   has not submitted. **Never fix this with a caveat** — a caveat under a misleading chart is weaker
   than not drawing the chart.

### Invariants a change must not break

- **The composition IS the flow's final column**, by construction — both read
  `assignmentReadingCohort()`, i.e. the last closed draft. They disagreed once (2026-08-16, sixth
  entry); do not reintroduce a second cohort function.
- ~~Every band/level on every surface is still a **shim**~~ **No longer true — 2026-08-23.** Every
  band and level on every surface now reads `analysis.reading`, the same one `report.html` renders.
  `total()`, `levelFromTotal()` and `bandFromLegacyScore()` are deleted; `subLevel(sub)` /
  `subBand(sub, key)` replace them and compute nothing. **This was a live bug, not a tidy-up:** the
  shim derived a level from `PQ+SU+CS+OC` bucketed at 17/13/9 while the student's report rendered the
  reading, so one draft read two different levels — often two rungs apart — depending on who opened
  it. Reported by a tester. See the session log's last entry.
- **The reading was never gated on `scoreTAU`.** `readSession()` is a separate LLM read that has been
  coding a level and four bands off the transcript, essay and assignment on every real submission
  since it shipped; the dashboard was simply never wired to it. `scoreTAU` still gates the flag and
  signal detectors (item 3b) and nothing else on this page.
- **Never calibrate a threshold or a distribution shape on the demo seed** (`tau-dimensions.md`).
- **Three flow axes, and the surface's scope picks one.** `FLOW_AXIS_TIME` (calendar buckets — Home,
  which spans classes running different work), `FLOW_AXIS_ASSIGNMENT` (one class, everyone did the
  same ones), `FLOW_AXIS_DRAFT` (one assignment — the strongest of the three, since a column is a
  fair comparison by construction). The axis carries its own decoder copy, which is why it is a
  parameter and not three components.
- **The trend finding, and everything it must not do**, is now a Hard Constraint in
  `designsystem.md` (2026-08-18). Short version: a sentence to the teacher, no counts, no dimension
  name, no colour, and the action answers the state. `dimensionCopy` / `agencyCopy` in `viz.js`.
- **`.trend-lede`, not `.viz-lede`, above a flow.** The grey left rule is a container device; the
  finding hands off to the blue action block directly beneath it, and two stacked rules read as two
  unrelated notices. `renderComposition` took `.trend-lede` too on 2026-08-17, with `LEVEL_GLOSS`
  rewritten to the second person to match.
- **Movement's selector is `.card-tab`, and carries NO state word** (2026-08-17). Anything below
  describing a boxed `.trend-chip` with "Improving" / "At the floor" under the name is history —
  `.trend-chip*`, `.flow-state*`, `flowState()` and `flowStateShort()` are all deleted. The word was
  a third telling of one fact (the ribbons show direction, the lede counts it), and the argument that
  kept it — that one strip stood in for five readings — expired when agency got its own chart.
  **Agency is never a tab beside the four**: a level reads the whole session, the four are facets of
  one construct, so it is not their peer. Same rule that keeps Composition off the band panel.

### Open, in the order agreed

1. **Two pattern sources on one screen.** The class card's Patterns tab still calls `detectTrends()` —
   the naming layer, where `low-skepticism` *is* `avgCS < 2.5` (`patterns.md`, *The finding*).
   Everything else uses `assignmentPatternGroups`/`detectPatternGroups`, the real detectors. Convert
   the class tab.
2. ~~**Three trend controls.**~~ **Done 2026-08-17** — Home and class both mount `renderMovement()`.
   What is left is deliberate, not residue: the assignment card's flows stay inside its band and
   composition rows, because there the scope is a shared task and *composition leads, movement lives
   inside it* (`designsystem.md` Hard Constraints).
3. **Collapse the closed assignment list**, finding on the closed row, newest first, latest open.
   Designed but not built: https://claude.ai/code/artifact/f7975efe-cd68-4cdd-b646-72e3b62ffd9b
3b. **The flag and signal COPY** — the one pocket still speaking in totals: `FLAG_META`'s
   `score-spike` / `reflection-score-mismatch` / `reflection-delta-mismatch`, the flag tray, the signal
   `reason` strings, and the drill row's "Score jumped +N points". Their detectors are gated on
   `scoreTAU` and the flag NAMES are part of the flag system's IA, so this is one job — half of it leaves
   a row line contradicting its own "Learn more". Currently unreachable in the demo seed.
4. ~~**The student tier**~~ **Done 2026-08-17** — see the fourth session-log entry. The original note
   below is kept because its reasoning is what produced Trace: a cohort
   flow degenerates at n=1 and does not belong on a student-facing report at all (`designsystem.md`).

### Component layer

**The organisms live in `app/web/viz.js`** — extracted from `dashboard.html` 2026-08-17. Colour, type
and chrome are in `components.css` (`.comp-*`, `.dbar-*`, `.dist-*`, `.viz-*`, and since 2026-08-17
`.flow-*` and `.trend-*`); geometry, copy and the flow's renderer (`drawFlow`, `flowSVG`,
`mountFlows`, the geometry constants) are in `viz.js`. Two files, one axis each.

**The boundary is one rule: `viz.js` reads no app state.** No `SUBMISSIONS`, no `STUDENTS`, no
`ASSIGNMENTS`. Every function in it takes a cohort, a flow, or an array of readings and returns
markup — which is what lets it be mounted against fixtures rather than only against a logged-in
demo roster. **Choosing which students and which submissions is the host's job**, so the per-surface
adapters stay in `dashboard.html`. The host owes `viz.js` exactly one thing back: `setFlowMetric(scope,
key)`, the re-render hook Movement's chips call.

Four organisms, deliberately not three: **Composition**, **Distribution**, **Movement**, **Trace**.
Each occurs alone somewhere in the shipped app, so none may assume a sibling is on the page with it.

**Each is one function with one entry point, and each takes a cohort, its flows, or its readings —
never a surface's own object:**

| Organism | Entry point (`viz.js`) | Adapters (`dashboard.html`) |
|---|---|---|
| **Composition** | `renderComposition(cohort, { label, flow?, noFlowNote? })` | `renderAgencyDistribution(a, students)` · `renderDraftAgency(a, slot, students)` |
| **Distribution** | `renderBandSection(cohort, { label, summary, lede, flowFor? })` | `renderAssignmentDimensions(a, students)` · `renderDraftBands(a, slot, students)` |
| **Movement** | `renderMovement(scope, entries, summary, axis, { title })` + `agencyEntries` / `dimensionEntries` / `movementEntries` | Home **twice** · assignment detail **twice** · class once |
| **Trace** (n=1) | `renderTrace(stageNames, bands, levels)` + `traceMove` / `traceFinding` | `renderStudentTrace(a, studentId)` |

**Trace is the odd one out and stays that way:** it takes a student and an assignment, not a cohort,
because its subject *is* one student — a one-row cohort would be a cohort function pretending. The other
three never render it and it never renders them.

The optional argument on each is where its sibling plugs in — `flow`, `flowFor` — so a scope with no
sequence renders the bars alone rather than an empty drawer, and Movement mounts with nothing above it.
**Movement's scope is a string** (`'home'`, `'class:<id>'`), which is the whole reason one component
can serve both rooms; `flowMetric[scope]` holds the selection.

---

## The unit of every aggregate

**Added 2026-08-12.** The one place this vocabulary is defined. No surface below re-derives it, and
nothing on this page states a measurement in a unit that isn't in this table.

| Thing | Unit | Rendering |
|---|---|---|
| A student, overall | One named level, never numbered | Level name |
| A student, per dimension | Band 1–4, or "not enough here" | Band pill, count beside it |
| A class/assignment, overall | Counts across the four levels | **Level composition strip** |
| A class/assignment, per dimension | Counts across the four bands | **Band distribution row** |
| Movement over time | Students who moved a band, up and down | A sentence carrying two counts |

**The levels are never numbered.** Substitution / Augmentation / Modification / Redefinition, by
name. Numbering the rungs makes Augmentation read as a failing grade, which is SAMR's documented
failure mode and is not what the level says (`tau-dimensions.md`, *The overall*).

### "Not enough here" sits outside the ladder, always

It is **not band 0**. It never shares a cell, a colour-ramp position, or a count with band 1.
Band 1 means *the behaviour is absent*; "not enough here" means *the session was too thin to judge*.
Collapsing them converts "we could not see it" into "you did not do it" — a false finding with a
number on it, and the specific error `tau-dimensions.md` created the non-score to prevent.

They also route to different conversations, which is why they can never share a queue: band 1 is
about the student's thinking, "not enough here" is about how much they used the tool.

**It is never hidden and never collapsed.** A surface that shows the four band cells shows this one
too, at zero, visibly. It is a real state of a real student, not an empty state — per the standing
required-vs-hidden check in `.claude/skills/product-design-review`, a computed default is a starting
point for review, not a reason to background something.

### Colour

The four levels and the four bands use the **existing `--tau-band-1..4` ramp**, stepping in
lightness, never reordered — the same ramp `.band-*`/`.samr-*` already use, a third treatment of one
scale rather than a second scale. "Not enough here" is visually detached from the ramp so it reads as
off-scale rather than as its low end: `--tau-surface-2` ground, `--tau-ink-faint` text, an outline
rather than a fill — the construction `.chip-grey` already uses (`components.css:668`).

*(**There is no `--tau-grey` token.** *Visual Language* below names one for the "Not started" status
chip; that reference is wrong and predates this section. `.chip-grey` is built from `--tau-surface-2`
+ `--tau-ink-soft` + a `--tau-line` border. Flagged here rather than silently propagated.)*

**Semantic colour never touches any of it** — per `designsystem.md` Hard Constraints, *"semantic
colour (positive/caution/attention) never touches a student's own score. A level is a position on a
path, not a verdict."* This holds at class level too: a distribution sitting mostly in band 1 is
rendered in the band ramp, and the *words* around it carry that it's a problem.

---

## Navigation Model

**Rebuilt 2026-07-28 — tab bar replaced with one persistent sidebar.** The previous four-tab
structure (Overview / Class / Assignment / Student, each with its own sidebar) independently
re-implemented the same "show students with signals" rendering in four places, which is why the
same bug (a "Missing" checkpoint mislabel) kept getting fixed in one tab and resurfacing in another.
Rather than patch that again, the navigation was rebuilt around a single always-visible sidebar and
five screens, with the shared rendering that fix actually required (see *Implementation* below).

The sidebar has, top to bottom: a global search box, a **Home** link (the landing screen), a
**Classes** group (flat list — a teacher has a handful, so it's enumerated directly), an
**Assignments** group, and a **Students** group.

**Revised 2026-07-30, then corrected same day — one primary destination per section, filters
demoted beneath it, and the two groups now use the identical shape.** First pass kept Assignments
enumerating `Open` directly (reasoning: bounded and actionable, like Classes) with a demoted "All
assignments" link beneath it. That was inconsistent with Students, which enumerates *no* individual
names at all — and was corrected the same day to match exactly:

- **Assignments** — **All assignments** is the primary row (two-line, matching a Classes row —
  name plus an assignment-count caption), opening **Browse Assignments** with no filter applied.
  **Open** sits below it as demoted sub-nav (smaller text, indented, a trailing count) — the same
  screen with `open` preselected, not a separate destination.
- **Students** — **All students** is the primary row, same shape, opening **Browse Students**
  unfiltered. **Worth a chat** and **Missing assignments** are demoted sub-nav beneath it, each the
  same screen with its filter preselected.

Neither group enumerates individual rows in the sidebar any more. An individual assignment or
student is reached by clicking into its row from inside the relevant Browse screen (or from a Class
detail page, for assignments), not from the sidebar directly — the sidebar's job is narrowing to a
filtered list, not listing every entity by name.

Demoted sub-nav reuses `.rail-item-nested` (indent + a size step down + a right-aligned
`.rail-item-meta` count) — one shared modifier, not a new component per section.

**Since 2026-08-07 the whole rail is `components.css` §13 (`.rail`)**, shared with the student home,
the workspace session list, and admin. This page no longer owns any rail chrome; what stays in its
inline sheet is the global-search field and its results overlay, which no other rail has. The
forest-tinted active row is gone — see `designsystem.md`'s session log for why the tint was a
constraint violation and why a toned rail makes it unnecessary. Width is `--tau-rail-w` (272px),
not the 240px this page used to set.

| Screen | Reached via | Content |
|---|---|---|
| Home | Sidebar "Home" link, default on load | Stat tiles, behavioral-pattern cards, a missing-checkpoints card, classes-at-a-glance rollup |
| Class detail | Sidebar Classes list | Assignment list for that class (Draft / Due / Completed / Trends / Worth a chat), expandable per assignment |
| Browse Assignments | Sidebar's "All assignments" row + its demoted "Open" sub-nav filter | Full assignment list (name, classes, due date, Open/Closed, students, missing, worth-a-chat), filterable by status (All/Open/Closed), searchable by name, expandable per assignment |
| Assignment detail | "View full assignment →" inside an expanded row (Browse Assignments or Class detail) | A timeline: the assignment's goal, then one snapshot per closed draft (Overview / Dimension bands tabs), a live in-progress card, and ghosted future checkpoints — no student roster (rebuilt 2026-07-31, see *Assignment Detail — a timeline, not a roster*) |
| Browse Students | Sidebar's "All students" row + its two demoted sub-nav filters | Full student roster, grouped by class, filterable |
| Student detail | Any student row/link anywhere | One student's assignments, grouped into a panel per class they belong to |

Browse Assignments reverses the earlier "no All-assignments landing page" call (2026-07-28, below)
for the same reason Browse Students was ever built: an enumerated list that grows without bound
needs a real screen behind it, not more rail space — Closed assignments only ever accumulate over a
term, so leaving them enumerated in the rail alongside Open was on the same collision course a flat
student-name list already hit.

**Students in the sidebar — the scale fix.** A flat list of every student name doesn't fit the
rail once a class has more than a handful of students, and scrolling a name list isn't actually how
a teacher finds someone anyway — after a conversation with a specific student, they know the name
and want to type it, not scroll to it. So the Students group shows the bounded, count-based rows
described above instead of names, all opening the same **Browse Students** screen with a different
starting filter. No dot indicator on any of them: the label text already states the condition, so a
colored dot next to it would just repeat information already on the row, not add any.

**Global search** (the sidebar's search box) matches students, classes, and assignments by name and
shows up to a handful of each as a dropdown beneath the box — the fast path to a *known* name at any
roster size, complementing the bounded Students shortcuts above rather than replacing them.

**Assignment sidebar dot — removed 2026-07-28.** The class/assignment sidebar rows no longer carry
a trailing dot at all (neither the amber "worth a chat" nor the red "missing checkpoint" variant
this section used to describe). Per `designsystem.md`'s dot rule, a colour-only circle next to a
row that states nothing about a flag or a missing checkpoint in its own text is decoration, not
information — and this page's own `.sb-shortcut` comment already argued exactly that case two
paragraphs up. The missing-first sort (`byMissingThenOrder`, unchanged) and the bounded Students
shortcuts' counts are what actually carry this information now.

Clicking across screens navigates contextually — e.g. clicking an assignment inside Class detail
expands it inline rather than leaving the page.

---

## Home

**Rebuilt 2026-07-28**, replacing the old Overview tab. Same landing-screen job — most of what a
teacher sees on first load — but individual students are no longer named on it (see *Patterns*
below); everything here is either a count, an aggregate, or a link into a filtered detail screen.

**Stat tiles** — Worth a chat count, behavioral patterns detected, missing work (only if >0), open
assignments, total students. Clicking "Worth a chat" or "Missing work" opens Browse Students
pre-filtered; the other tiles are informational only.

**Section order (2026-08-04, reaffirmed 2026-08-12): tiles → Patterns worth noticing → Students by
level → Dimension bands → Classes at a glance.** Patterns stays above the dimension rollup because
it's the one most likely to need action today (per-student, time-sensitive); the rollup rarely moves
week to week, so it reads better as context underneath the thing worth acting on first, not
competing with it for the top of the page.

**Triage stays first — decided 2026-08-12, and it was a real fork.** The band/level model makes a
strong case for leading with composition: Home would open on what the room is doing, and *"who needs
a chat"* would demote to a filter, matching this file's own three-tier framework where the class tier
asks *"do I need to teach differently?"* That was considered and turned down. A teacher opening this
page on a Monday still needs today's list before this term's shape, and the composition strip is
context for the queue rather than a replacement for it. Recorded as a decision, not an oversight —
if Home later feels like it buries the teaching view, this is the paragraph to revisit.

### Triage queue inputs — respec'd 2026-08-12

**All five of the old Tier-2 conditions are gone**, because all five were arithmetic on averages
(`avgTotal < 9`, three `avg* < 2.5` combinations, and a `last − first > 2` delta). Four replacements:

| Input | Rule | Notes |
|---|---|---|
| **Band 1 on any dimension** | Absolute | "It didn't happen" — the behaviour is absent, not weak. The *number* of band-1 dimensions orders the queue |
| **"Not enough here"** | Its own queue, its own copy | A thin-session problem, not a thinking problem. **Never counted with band 1** — see *The unit of every aggregate* |
| **Integrity flags** | Unchanged | Four of the seven survive untouched; three need respec — see *Flag System* |
| **Dropped a band across drafts** | An ordinal move, not a delta | The only survivor of the old `declining` signal |

**The cohort-relative rule is retired — a reversal, recorded with its reason.** `patterns.md`'s
*Level signals vs patterns* specifies bottom-decile scoring with an absolute floor underneath it, so
triage volume stays bounded in a strong class. That was designed against a continuous score. On a
four-value ordinal, a percentile is mostly ties and the absolute floor does all the work anyway —
so **band 1 is the flag**, directly. The guardrail the decile rule existed to provide (don't flag a
student doing fine just because someone has to be bottom) is inherent in an absolute band: a class
where nobody is at band 1 correctly produces zero flags.

**Volume is not capped, and that's deliberate.** In a weak class, "band 1 on any dimension" could be
half the room. The tile states its denominator ("9 of 24") and the copy turns over past a
proportion: at that point the finding is no longer a triage list, it *is* the room, and the card says
so and points at *Students by level*. This is the direct answer to `patterns.md`'s objection that
relative scoring makes a class-wide problem quieter the worse it gets. **The exact proportion where
the wording turns over is unset** — it is a judgement about a real roster and there is no data to
fix it on; leaving it unset is honest, guessing it is not.

### Patterns worth noticing

A cross-student rollup of the four behavioral pattern types (`TREND_META`/`REASON_TO_TREND`:
Passive AI engagement, Low critical evaluation, AI-originated ideas, Declining engagement), shown as
a card only once **≥2 students** share it — a single student's pattern belongs in their own drill
panel, not a class-wide card. Zero to four cards render depending on the day's data, never a fixed
set.

**Three of these four cards lose their detector entirely — 2026-08-12.** `patterns.md` already
established that `low-skepticism` *is* `avgCS < 2.5`, `ai-ideas` *is* `avgOC < 2.5`, and `passive` is
a co-decline of both: a naming layer, not a detection layer. When those thresholds go, the cards have
nothing underneath them. `declining` survives, restated as the ordinal band move above.

**So `detectPatterns` moves onto this page's critical path.** `patterns.md`'s *Pipeline* section
(the six real detectors — sequence shapes read off `classified`, which is already stored on every
analysis doc and needs no new LLM calls) was scoped as parallel work. It isn't: **this section is
mostly empty until it ships.** Everything below about card anatomy, collapse behaviour, counts and
colour is unaffected and carries straight over to the six — it's the detectors that change, not the
card.

**Corrected 2026-08-14 — "mostly empty until it ships" was wrong, and this page inherited the error.**
`detectPatterns` had already shipped: **thirteen** detectors, not six, running client-side in
`report-render.js` on every student report since before this section was written. They were invisible
here because they ran in the browser at render time and were never stored — so the teacher surface saw
nothing and the design docs concluded nothing existed. They are now server-side
(`app/web/patterns-core.js` → `analysis.js`) and stored on the analysis doc.

Three consequences for this page, all of them expansions:

- **The section is not empty.** The blocker is the payload (`index.js:1968`) and this page's
  aggregation, not detection. Everything about card anatomy, collapse and colour carries over
  unchanged, as the paragraph above already anticipated.
- **Some cards will name a competence, not a deficit.** Six of the thirteen are high-agency — Held
  Ground, Questioned Assertion, Challenge Arc. Every pattern this page has ever rendered was a
  deficit, and *Patterns worth noticing* was specced on that assumption. A card reading *"7 students
  held their ground when the AI corrected them"* is a legitimate finding and this page currently has
  no treatment for it. **It cannot borrow `--tau-positive`** — semantic colour never touches a score
  or a level, and a high-agency pattern is the same class of object as a low-agency one. Open.
- **Four detectors carry no threshold** (the interaction moments — Held Ground / Capitulation /
  Questioned / Unquestioned Assertion, each a single AI turn paired with the student's reply). They
  are the ones that can be surfaced without waiting on the calibration `patterns.md` is blocked on,
  and are the right first cards for that reason alone.

**Cards collapse — 2026-08-08.** Prompted by feedback that Home is "a lot of data." The volume was
never the count of findings, it was the prose: the four `TREND_META` entries carry **343 words** of
`what` + `whatToTry` between them, and every word of it rendered permanently expanded. Each card is
now a `<details>` closed by default:

| | |
|---|---|
| **Closed** | Pattern label, then a standing line: `3 students · English 10 2 · American Literature 1` |
| **Open** | *What this looks like* → *What to try* → *View the N students →* |

The *finding* never folds — label, count, unit and class spread all stay on the closed card, so a
teacher can act on this page without opening anything. Only the explanation and the intervention
hide, which is the only thing progressive disclosure is legitimate for (see the required-vs-hidden
rule in `.claude/skills/product-design-review`). Order inside an open card is **meaning → action →
evidence → exit**: a teacher expands to learn what a finding means and what to do about it, so the
supporting number is the justification for that advice and reads after it.

**The count is never a bare numeral or a chip.** It sits in the phrase that names its unit
("**3** students"), weighted and coloured inside that sentence so it still reads first. The old
`chip-neutral` "3 students" badge is gone: enclosure is reserved for values that are both actionable
and rare, and a chip on every card is neither. The section head carries the denominator
(`3 patterns · 7 of 8 students`) so a count has scale as well as unit.

**Missing checkpoints carries no blue at all** — an overdue draft is a date, not something the tool
has a reading on, so there is no *What to try* on that card and nothing for the tool's voice to say.

**Missing checkpoints is not a behavioral pattern** — a Tier-1 logistics fact (an overdue draft), so
it gets its own card, separated by its attention-tier count and its wording ("students with overdue
drafts") rather than by different chrome. Conflating "overdue"
with "disengaged" was a real mistake this dashboard already made once (see the 2026-07-28
"Missing submissions" IA entry further down); keeping them as two different kinds of card is
deliberate, not an oversight.

**All-clear state** — no pattern cards and no missing-checkpoints card: a single centred card, a
check mark, "All students on track."

### Dimension trends

> **⚠ SUPERSEDED 2026-08-16.** The section it describes (`renderTeachingSection`) is deleted —
> it printed "Averaging 2.1 of 5" across every class, which is a mean of ordinals.
>
> Kept for the argument in it, not as a spec. See *Where the surfaces stand*, top of file.

**Was "How your teaching is landing"; rebuilt and renamed 2026-08-08.** A fleet-wide rollup of the
four TAU dimensions — `renderTeachingSection()` over `fleetDimensionTrend()`, same
`dimensionRowsFromCohort()` classification the class tier uses, scoped to every class at once.

Two things changed together, both failures of an existing rule rather than taste:

1. **The label.** "How your teaching is landing" is a process phrase, not the name of its contents —
   the reader translates before knowing what's inside. What's inside is the four dimensions rolled
   up, so the label names that. Fixed vocabulary: **Prompting Quality, Selective Use, Calibrated
   Skepticism, Original Contribution**, and nothing else is a dimension. Any other proper noun in
   this section is an assignment or a class, and the sentence must say which — a condensed outlier
   note that read "Lowest on Rhetorical Analysis" made an *assignment* look like a fifth dimension.
2. **The two visual tiers are gone.** A dimension with news got a tool-info-blue card; the quiet ones
   shared a `.dim-line-group`. But the blue card carried "Averaging 2.1 / 5" — a **measured average
   on the tool's-voice ground**, which inverts what that colour means (see *Colour: measured vs the
   tool talking* below). All four dimensions now use the same collapsed `.pattern-card` as Behavioral
   patterns, in canonical PQ/SU/CS/OC order so a dimension's position on the page is stable, and the
   *words* carry which one matters ("lowest of the four" vs "holding steady") instead of the chrome.

| | |
|---|---|
| **Closed** | `Calibrated Skepticism — lowest of the four` · `Averaging 2.1 of 5 across your classes` |
| **Open** | *What this looks like* (the row's `note`) → the outlier evidence box, when there is one |

The outlier callout still appears on the floor row only, and **its link now lives inside the evidence
box** rather than at card level: that sentence is the only thing on the card naming an assignment,
and a link two blocks below it leaves "view what?" to inference on a card whose own title is a
dimension name. The link sits on its own line inside the box, never trailing the prose.

**Split into two sections 2026-08-12 — see *Students by level* and *Dimension bands* below.** The
card anatomy, the collapse behaviour, the fixed PQ/SU/CS/OC order and the outlier-box rules above
all survive; the second line of the closed card ("Averaging 2.1 of 5") is the only thing that dies,
and it takes the rest of the section's framing with it because a "trend" on an ordinal band isn't a
trend, it's a movement between bands.

### Students by level

**Added 2026-08-12.** The level composition of every class at once: how many students are working at
Substitution, Augmentation, Modification, Redefinition, plus "not enough here" detached beneath.
**This is the section the whole page's aggregate story now rests on** — the four dimensions explain
*why* a room sits where it does, but the level is where it sits.

The closed card carries the **modal claim with its denominator**, per the headline rule in
*Purpose* — `Most of your students are at Augmentation` · `11 of 24 across your classes`. When no
level holds a plurality the card says the room is split and names both groups instead.

**The label names its contents**, per the same Morville labeling rule that produced "Dimension
trends" on 2026-08-08: it's students, counted by level. "How your students are working with AI" was
drafted and rejected as the identical process-phrase mistake "How your teaching is landing" already
made once on this page.

**Where SAMR now leads.** `designsystem.md`'s *"SAMR is a subtitle, never the primary label"* is
reversed as of 2026-08-12 — written when SAMR was arithmetic off a total it didn't deserve, and now
that the level is a reading in its own right it leads. **The departure has to be stated wherever the
ladder appears**: these levels describe *agency*, not task transformation as Puentedura published
them, and the ladder is a communication frame rather than an instrument on the same footing as the
four dimensions (`tau-dimensions.md`, *The overall*). One line of copy, not a footnote to hunt for.

### Dimension bands

**Added 2026-08-12, replacing *Dimension trends*' contents.** Four rows, canonical PQ/SU/CS/OC order,
each a **band distribution** — how many students at each of 1/2/3/4, plus the "not enough here"
cell. The fixed order is unchanged and still right: a dimension's position on the page is stable and
learnable, and the *words* carry which one matters.

| | |
|---|---|
| **Closed** | `Calibrated Skepticism — the floor of the four` · `9 at band 1, 10 at band 2, 4 at band 3 · 1 not enough here` |
| **Open** | *What this looks like* (the row's `note`) → the outlier evidence box, when there is one → **the conversation prompt** |

**The form — settled 2026-08-13 after building it.** A **diverging stacked bar split at the 2|3
seam**, one row per dimension, with the seam locked to the same x on every row so the four are
directly comparable. The data's job is an ordered-scale share (the Likert case), which is the form
that fits it, and the seam is not invented — `tau-dimensions.md` already puts it between bands 2 and
3. Mass left of the line is the share of the room the behaviour didn't happen for.

Three things this replaced or fixed, each for a checkable reason:

- **Four coloured count-cells, dropped.** They rendered in `--tau-band-1..4`, which is a *chip*
  palette — one band at a time on one student's report. As a chart palette all four sit at
  L 0.949–0.952 (a 0.005 spread, so no visual order at all) and bands 2↔3 are **ΔE 1.4** apart for
  normal vision. Four near-identical pastels side by side is the rainbow anti-pattern.
- **One hue, not a diverging pair.** A diverging palette wants two hues, and **this system cannot
  supply a non-semantic pair**: the only pair passing all six checks is violet/green whose green pole
  *is* `--tau-positive` in all but name; every warm hue is already a semantic tier (caution 68,
  attention 18); and two cool hues fail hard (violet↔blue, **ΔE 0.9** deutan). So **polarity is
  carried by position** — which side of the seam — and colour carries only the ordinal step. Hue 242
  is the one hue that is neither a semantic tier nor a voice (auditor 300, tool-info 205). Validated
  in the **ordinal** mode, not the categorical one: monotone lightness, adjacent ΔL ≥ 0.06, light end
  clearing 2:1, single hue. *(Validating it as categorical the first time shipped a light end at
  1.48:1 that would have washed out on white.)* This is also the better outcome on its own terms —
  rendering a class's skepticism as red-versus-green is the verdict *"voice is coach, not judge"*
  exists to prevent.
- **Band 1 must never be the least legible mark.** A first pass dropped the numeral from any segment
  under 20px, which made band 1 — the band this instrument is most required to be sensitive to —
  invisible on three rows. Bands 1 and 4 are the extremities, so when too narrow their count renders
  *outside* the bar end, a position that cannot collide; no non-zero segment renders below 6px.

**A ridgeline plot was considered and rejected.** It needs a continuous x-axis with enough
observations per row to estimate a density; ours is four ordinal bands, and there is no band 2.5 —
the seam is a boundary, not a region. A smoothed curve would draw mass where no value can exist.
This repeats a call this page already made: the Distributions histogram deliberately carries no
fitted density overlay, for the same reason. The axis will not become continuous later either —
`tau-dimensions.md` refuses a fifth band by design.

- **The floor row's callout survives**, rewritten off band counts rather than `mean ± delta`. Which
  dimension is "the floor" is now a statement about where the mass of the distribution sits, and the
  card must be able to say that in words — *"nine students didn't do it at all"* is the finding, not
  a position on a scale.
- **The finding leads; the distributions are the evidence — 2026-08-13.** One templated sentence
  above the four rows names the floor and its size (*"Calibrated Skepticism is the floor. 64 of 90
  students sit left of the seam — the only dimension where most of the room does."*). Same
  conclusion-first call the assignment tier's coaching note settled on 2026-07-31, for a sharper
  reason here: three of the four rows usually look alike, so leading with the bars asks a teacher to
  compare four near-identical distributions to find the one that differs. **Templated, never
  free-generated**, so it cannot claim something the bars don't show — and when no dimension stands
  out it says *that*, rather than manufacturing a floor.
- **Each row counts every student, and the rows are four partitions of one cohort.** Bands + "not
  enough here" = *n*, on every row. Never add across rows. **"Not enough here" is per dimension** — a
  thin session can show Prompting Quality clearly and give Calibrated Skepticism nothing — so the
  off-scale counts differ per row, and they differ from the Home tile, which counts students
  unreadable on *at least one* dimension. That union cannot be derived from the rows (bounded below
  by the largest, above by their sum) and must be carried as its own field in the payload. The
  section states this in one line, because the alternative reading — that the rows and the tile
  contradict each other — is the one a reader reaches first.
- **The count is never a bare numeral**, unchanged rule: it sits in a phrase naming its unit.
- **A distribution with no plurality reads as split**, and the note says which two groups. This is
  where `split` earns itself: a class with nine students at band 1 and eleven at band 3 is the case
  a mean was worst at describing, and it's common.

**The missing *What to try* is now fillable** — this was flagged open on 2026-08-08 (the four
dimensions had no authored recommendation copy, so there was nothing legitimate for a tool-voice
block). `tau-dimensions.md` resolves it from the other end: the **instruction register comes out of
the student report** — *"decide the structure before you ask for it"* — because it arrives without
knowing what the class has covered and can contradict what was taught. **It belongs here instead**,
as a conversation prompt, the same treatment integrity flags already get. Blue, tool's voice,
discountable — the existing colour rule applies unchanged.

The distinction that keeps it honest, from the same source: **the report names a gap; it doesn't
prescribe a fix to the student.** On the teacher surface the prescription is fine, because a teacher
can weigh it against what they actually taught.

### Colour: measured vs the tool talking

`--tau-tool-info` (blue) means **the tool is talking** — Hard Constraints already says it is a voice,
not a severity tier. What 2026-08-08 pinned down is where that voice starts, because the first draft
of this rebuild got it wrong in both directions:

| Content | Treatment | Why |
|---|---|---|
| A count that is itself the signal | Amber numeral, in a phrase naming its unit | Pattern counts are caution-tier; the pattern name beside it means colour is never the only channel |
| A band or a level | Ink text, or the `--tau-band-N` ramp | Semantic colour never touches a score — a level is a position on a path, and that holds at class level too. Amended 2026-08-12: "a score" became "a band or a level"; the rule is unchanged, only its subject |
| A band count | Ink numeral, tabular | It is measured. The distribution *shape* is the finding, and the words beside it say so — the numerals stay neutral |
| A second computed fact | White, hairline, tabular | Blue under a measured number tells a teacher the number is an opinion |
| **The explainer** ("What this looks like") | **Neutral, no container** | It *describes what was measured*, so it belongs to the metric. Tinting a definition makes it read as an opinion — this is the distinction the first draft collapsed, folding the explainer into the blue alongside the advice |
| **The recommendation** ("What to try") | **Blue rule + tint** | The only block on a card the tool *authored* rather than computed, and the only one a teacher should feel free to discount |
| The link | Forest | Interactive text, one per card |

**Classes at a glance** — one row per class: student count and either a "✓ On track" note or a
worth-a-chat count. Unchanged in spirit from the old Overview tab's class-health rail.

---

## Browse Students

**New 2026-07-28.** The full student roster — grouped by class, not enumerated in the sidebar (see
*Navigation Model* for why). Reached via the sidebar's three Students shortcuts, a pattern card's
"View" link, or clicking through from anywhere else.

**Search + filters — added 2026-07-28.** A free-text name search box sits to the left of the filter
row (`#browseSearchInput` → `setBrowseSearch()`), separate from the sidebar's global search (see
*Global Search* below): this one filters the roster **in place** — narrows the same screen, class
grouping and all — rather than navigating away to a single student. It composes with whichever
filter chip or pattern is active rather than replacing them, live per keystroke, and updates only
the table body (`#browse-roster-tbody`) rather than the whole screen — replacing the input's own
container on every keystroke would lose focus and cursor position mid-type. Resets to empty whenever
the screen is entered fresh via a sidebar shortcut or a pattern-card link (`gotoStudents()`), so a
teacher doesn't land on "Missing work" still scoped to whatever name they last typed.

Below the search box: three fixed chips (All / Worth a chat / Missing work) plus a **Patterns ▾**
dropdown. The chips are muted by default and only take their full semantic colour when active (amber
for Worth a chat, terra for Missing work, forest for All) — hardcoding the colour on regardless of
selection state was a real bug caught and fixed the same session (see *Visual Language*). The
Patterns dropdown lists only patterns with **≥1 student** today — a looser threshold than Home's
≥2, since a pattern can be real and worth filtering on before it's common enough to earn a Home
card — and is empty ("No patterns detected today") rather than showing four dead options when
nothing qualifies.

**Separate table per class — 2026-07-28.** The roster used to be one shared `<table>` with a
non-interactive `.group-row` divider between classes. Rebuilt into one independent
`table.roster` per class (`browseRosterTables()`), each with its own sortable headers
(`browseSort[classId]`, `toggleBrowseSort()`) — sorting "How they're using AI" in one class no
longer reorders every other class's students underneath it, and a teacher scanning one class's
table doesn't have another class's rows scroll past mid-list. Search/filter/pattern selection
still applies across all classes at once (unchanged); only sort is now per-class.

**Row shape — revised 2026-08-12: Student → How they're using AI → Bands → Signal.** The
**Average** column is deleted, not converted: it was a mean total across every submission, and there
is no total and no mean. Its 12% goes to the Signal column, which the 2026-08-08 every-chip change
already wanted room for.

- *How they're using AI*: the level, by name (`.band-plain`) — unchanged in treatment, and now
  load-bearing rather than a plain-language gloss on a number. The rule this column was built on
  ("never a bare score leading") is what makes it survive the scale change untouched.
- *Bands*: the student's four dimension bands, in canonical order, compact. **Not four numbers with
  no labels** — the lab has to settle what this looks like at roster width; the requirement is that
  a reader can tell which dimension is which without a legend.

**Sorting** — by level (ordinal), or by count of band-1 dimensions. Both are orderings a teacher can
act on. Neither is a rank, and there is no column left that could produce one.
- *Signal*: **every** true signal as its own chip (2026-08-08), not one chip plus a `+N`. Overdue is
  the one thing that takes the whole cell instead — Act outranks Notice.
- No separate Class column — redundant under a class group header.

**Column widths are shared across the class tables — 2026-08-08.** Each class table sizing its own
columns from its own content was the cost of the separate-table rebuild above: three grids that
never lined up down the page. `table.roster-browse` is `table-layout: fixed` with one colgroup
(24 / 12 / 26 / 38) so the tables read as one roster split by heading. `min-width: 760px` keeps
`.tbl-wrap`'s existing `overflow-x` doing the narrow-screen work.

**No initials avatar — 2026-08-08.** The Student cell is the name alone. The avatar circle was
decoration: these students have no photo, so it rendered initials directly beside the full name it
was abbreviating, and it identified nothing the name didn't. Removing it also gave the Signal
column the width its chips wanted (Student 28% → 24%). The avatar stays in global search results,
where a compact row genuinely benefits from a fixed-width leading mark.

---

## Data Model

*Served from `/api/teacher/dashboard` (real `app/data/` records) as of the `app/` port — this
section described a hardcoded mock generator when first written; the shape below is what the mock
was designed to match and turned out to need no changes when the real endpoint replaced it.*

**Revised 2026-07-28 — per-draft due dates.** An assignment isn't one deadline, it's a sequence of
draft checkpoints, each with its own due date, submitted in strict order (a student can't start
Draft 2 until Draft 1 is in — enforced server-side, `app.js`). The schema (`store.js`) already
modeled this from early on (`draftDueDates[]`, ascending, `draftDueDates[draftBudget-1] === dueDate`)
but nothing used it: the teacher creation form only collected one due date, and the dashboard API/UI
had zero awareness of checkpoints. All three are now wired:

- **Assignment** — `draftBudget` (number of draft slots) and `draftDueDates[]` (one ascending due
  date per slot; the last one **is** the assignment's overall due date — not a separate field a
  teacher sets independently). **Assignment-level `Open`/`Closed` is unchanged** — governed only by
  that final due date. A teacher sets all of this at creation time now (`teacher.html`'s "+ New
  assignment" form: one due-date input per draft slot, replacing the old single "Due date" field).
- **Submission** — one TAU session result per student per assignment per draft slot (`cycleIndex`,
  0-based). Because drafts are sequential and gated, `subs.length` (how many the student has
  submitted so far) **is** the index of the next checkpoint they haven't reached — no separate
  lookup needed to know which draft is "current."
- **Checkpoint status** (`checkpointStatus()` in `dashboard.html`, replaces the old
  status-window–only `submissionStatus()`) — per student per assignment:
  - `Final` — student has submitted every draft slot, including the last (regardless of whether the
    assignment's overall due date has passed yet — finishing early is still Final, not "Draft").
  - `Missing` — the next checkpoint's own due date has passed and the student hasn't submitted it.
    **This is the key change: a checkpoint can be missing on an assignment that's still `Open`
    overall** — e.g. Draft 1's due date passed but the assignment doesn't close until Draft 3 (the
    final)'s due date. Label names the specific slot: "Draft 2 missing," "Final missing."
  - `Draft N` — student is between checkpoints, next one not yet overdue.
  - `Not started` — no submissions yet, first checkpoint not yet overdue.
- **`hasMissingCheckpoint(assignment, studentId)`** — the boolean aggregate used everywhere a
  sidebar/overview/card needs "does this need follow-up." Generalizes the old closed-only "Missing"
  check; ascending due dates guarantee it still reduces to the original behavior for a fully-
  unsubmitted closed assignment (draft 1's due date ≤ the final's, which has passed).
- **Language rule** — assignments are `Open` / `Closed` (whole-assignment, final-due-date-only);
  student progress is `Final` / `Draft N` / `Missing` / `Not started` (per-checkpoint). Never use
  "closed" or "final" for the wrong entity, and never say an assignment is "missing" — it's a
  specific checkpoint on a specific student that's missing, always name which one.
- **`checkpointStatus()` label format — changed 2026-07-28.** Now always states the slot out of the
  total budget (`Draft 2/3`, `Final`, `Not started`) — the word "missing" no longer appears in the
  label itself. The attention colour on the chip plus the row's own Signal column now carry that
  fact; saying it a second time in the label text was redundant once both were visible in the same
  row (see the *Assignment View* and *Class View* row shapes below).

**Classes — added 2026-07-28.** A real `classes` collection (`{ id, teacherId, name, studentIds }`)
replaced the single class the API used to synthesize for every teacher. Assignments gained
`classIds` — usually one class, but a teacher can give the same assignment to more than one section
of the same course, and a student can belong to more than one class at once (a core class plus an
elective, say). `classesFor(assignment)` / `studentsFor(assignment)` / `classesForStudent(studentId)`
in `dashboard.html` are the helpers every roster/sidebar/pattern computation now goes through rather
than assuming one flat student list — an assignment or student list that doesn't scope through these
will silently include students who were never assigned that work.

---

## Flag System — Two-Tier Hierarchy

*Revised 2026-07-27 — the colour model and copy below drifted from what shipped; corrected against
`dashboard.html` as it stands today. The tier split itself (submission-level vs. assignment-level)
is unchanged.*

Flags are split into two distinct tiers with different visual weight. The goal is to avoid alert
fatigue — if everything is P0, nothing is.

**Both tiers render in `--tau-caution` (amber), never terra/red, and never with a `⚑` glyph.**
This was a real voice-rule violation caught and fixed in the 2026-07-20 rebuild (session 6) and a
follow-up sweep on 2026-07-22: a "worth a chat" signal is a conversation-starter, not a verdict, so
it can't render in the same red the app uses for an actual deadline problem. **Terra/`--tau-
attention` is reserved for missing submissions only** — a real overdue-work fact, the one thing on
this page that *is* an alert. Conflating the two (as the original terra-for-everything model did)
either downgrades a real deadline problem or over-escalates a conversation-starter into one.

### Tier 1 — Submission-level flags
Discrete events on a specific submission. The detail lives on the submission row itself. The signal
pill on the row (`.flagdot`, a quiet caution-coloured dot + text, never a glyph) is shorthand for
"expand to see what happened" — no banner is shown because the flagged sub-row already surfaces the
full context.

| Key | Signal |
|---|---|
| `stylistic-inconsistency` | Vocabulary/complexity shifts sharply between student turns |
| `unnatural-fluency` | Student turns lack hedging and false starts typical of live composition |
| `provenance-mismatch` | Concept in essay attributed to student but AI introduced it first |
| `shadow-session-pattern` | High passive acceptance, very low pushback — consistent with pre-polished inputs |
| `score-spike` | TAU score jumped significantly between two submissions in a short window (≤10 min, +5 pts total or +3 on any single dimension) |
| ~~`reflection-score-mismatch`~~ | **Deleted 2026-08-30** — see the bullet below |
| ~~`reflection-delta-mismatch`~~ | **Deleted 2026-08-30** — see the bullet below |

The last two weren't in the original spec — added once the reflection feature shipped in
`index.html` and gave the tool a second source (the student's own words) to check scores against.
They came across with the dashboard port and never fired in `app/`, because nothing wrote
`sub.reflection` until 2026-08-30.

**Three of these seven need respec'ing for bands — 2026-08-12.** The first four read the transcript
and the provenance map and are untouched by the scale change.

- `score-spike` becomes an **implausible band jump** in a short window. The thing it was ever trying
  to catch is a discontinuity, not a magnitude, so it survives the unit change intact — but the
  threshold is a fresh judgement, not a conversion of `+5`.
- ~~Both reflection mismatches read **band 1–2** where they read `< 2.5`.~~ **⚠ SUPERSEDED
  2026-08-30 — both signals are deleted from `dashboard.html`, and re-banding was the wrong fix.**
  Reflection *capture* shipped that day (student submit modal → `submissions.reflection`), which
  would have woken two detectors that had never once fired, both deciding the mismatch
  arithmetically: `sub.cs < 2.5` on the retired 1–5 score and `legacyTotal(sub) <=
  legacyTotal(prev)` on the retired 4–20 total. Swapping in a band threshold keeps the arithmetic
  and only moves the number, and **the model has no arithmetic in it** — a dimension is *read*, and
  the reading already carries the moments that support it and the one that doesn't
  (`tau-dimensions.md`, *The output is evidence, not a number*).
  **The right form is a presence question against that coded evidence**: the student says they
  pushed back; the Calibrated Skepticism reading either holds such a moment or it doesn't. No
  threshold, and checkable by a teacher against a quote. That belongs *in* the reading, so it lands
  with `scoreTAU`'s signature change, not as a detector on this page. `FLAG_META`/`guides.js` copy
  for both is kept for the rebuild.

**And the evidence layer makes these flags checkable for the first time.** A `provenance-mismatch`
can now cite the moment; a reflection mismatch can sit next to the counterexample it contradicts.
Nothing about the flags changes, but the "Learn more" tray has something real to open onto.

### Tier 2 — Assignment-level signals
Behavioral patterns computed across all submissions for a student on an assignment. Not tied to any
single submission. **These no longer render as a per-student banner** — the original spec's "amber
banner at the top of the drill panel" shipped, then was quietly simplified to a single muted-grey
text line at the bottom of the drill panel (`engagementNote` in `renderDrillPanel()`) with no
background fill, no icon, no `●` glyph. There is also a cross-student rollup — see *Patterns worth
noticing* under *Home* — which is where this tier gets most of its visual weight, plus (as of
2026-07-28) a pill of its own everywhere a signal renders — see *Student Signal System* below.

**Superseded wholesale 2026-08-12 — see *Triage queue inputs* under *Home*.** All five
conditions below are arithmetic on averages that no longer exist. Kept because the reasons they
render are the copy the four replacements have to beat, and because two of them are the exact
overclaiming `patterns.md` diagnosed: "Passive engagement" is `avgTotal < 9` with a prose name on it.

| Condition | Reason shown |
|---|---|
| Latest score < first score by >2 pts (min 3 submissions) | "Engagement declining across recent submissions" |
| Average total < 9 | "Passive engagement across all submissions" |
| Average CS < 2.5 and PQ < 2.5 | "Tends to accept AI responses without questioning" |
| Average CS < 2.5 | "Rarely challenges or refines AI suggestions" |
| Average OC < 2.5 | "Most ideas appear AI-initiated" |

### Flag UX rules
- Flags are **never shown to students** — teacher view only
- The whole "worth a chat" surface is deliberately not called "flags" anywhere a teacher reads it —
  the header button reads **"Worth a chat, explained"** (was "Flag detection"), the filter chip
  reads **"Worth a chat"** (was "⚑ Review"), the column header reads **"Worth a chat"**. The
  underlying data/state names (`status: 'review'`, `FLAG_META`, `checkFlag()`) still use the old
  vocabulary internally — only the teacher-facing copy changed.
- **Review pill** — indicates at least one flagged submission; the specific flags are visible
  inside the drill panel on the submission row, not echoed as a banner
- **Assignment-level reason** — a single quiet text line at the bottom of the expanded drill panel,
  no fill, no icon (see Tier 2 above)
- "Learn more" link on each submission flag opens a side tray with full context
- **A teacher can mark a flagged draft "followed up" — added 2026-08-21.** It changes presentation
  and nothing else: the flags stay on the analysis, stay rendered under the draft, and the mark is
  reversible in place. What it removes is salience — the draft stops tinting its row, stops
  colouring the student amber, and stops counting them into the Worth-a-chat tiles, rail count and
  filter.
  - **The mark keys to a DRAFT, not a student**, because every piece of review-tier evidence already
    does: an integrity flag lives on the submission, and a score spike is attributed to the later of
    the pair. That is what makes the signal self-renewing without any expiry rule — the next flagged
    draft is unmarked by construction, so the amber returns on its own. A student reads as clear only
    when *every* flagged draft of theirs is marked.
  - **The control sits on the draft's own card**, in the action bar at its foot, under the flag
    lines it acts on — never on the roster chip, where a teacher would be clearing a flag they
    haven't read. It renders only on a row that has flags.
  - **A cleared student is not an unflagged student.** The roster chip goes `.chip-neutral` and reads
    **"Followed up"** rather than going blank — amber can't survive on a label that no longer states
    an actionable fact (designsystem.md's alert-colour rule), but rendering the two identically would
    make the mark look like it deleted something. It yields to a live behavioural pattern: that chip
    is the louder true thing, and the mark still shows on the draft it belongs to.
  - **Scoped per teacher** (`signalMarks`, keyed `${teacherId}_${submissionId}`) — "I've had this
    conversation" is a fact about a person, so a co-teacher still sees the flag as open.
  - Known and accepted: re-running analysis on an already-marked draft can add a flag underneath the
    mark. Retry-analysis is a rare admin repair, and the mark records a real reading of that draft.

---

## Student Signal System

Converts raw TAU scores and flags into a plain-language status. Used everywhere a student name appears. `getStudentSignal(studentId, assignmentId?)` — if `assignmentId` is provided, scoped to that assignment only.

**2026-08-12 — the conditions change, the structure doesn't.** `_computeStudentSignal()`'s return
shape (`{ status, reason, learnMoreKey, signals }`, every true signal priority-ordered, with the
first three mirroring `signals[0]` so existing callers keep working) survives the scale change
untouched, and so does every rendering rule below it. What changes is what goes *in*: the four
inputs in *Triage queue inputs* under *Home*, replacing the five average thresholds above.

**One addition to the priority order: "not enough here" is its own status, not a reason under an
existing one.** It cannot sort into the same list as band 1 — see *The unit of every aggregate*.
A student can be both (a thin session on one assignment, absent behaviour on another), which the
multi-signal return shape already handles correctly.

### Signal levels

*Extended 2026-07-28 — `signalPill()` now renders for `attention` too, not just `review`. Between
2026-07-27 and this pass, an `attention`-only student was visually indistinguishable from `on-track`
everywhere except their own drill panel and the Home rollup; the whole point of surfacing patterns
more (Home cards, the roster's Patterns filter) fell apart if a flagged student still looked
identical to an unflagged one in every roster row. The pill now shows the pattern's short label
(`TREND_META[id].short`, e.g. "Passive engagement") in the same amber treatment as "Worth a chat" —
same tier of conversation-starter, so it gets the same look, not a second unstyled one.*

| Status | Display | Tier |
|---|---|---|
| `review` | "Worth a chat" pill (`.signal-pill-review`, amber dot + text) | Submission-level — integrity flag or score spike detected |
| `attention` | Pattern-name pill (`.signal-pill-review`, same visual treatment, different text) + a quiet text line in the drill panel | Assignment-level — passive or declining behavioral pattern |
| `on-track` | _(no indicator)_ | No signals |

**Corrected 2026-08-03 — a student can genuinely trip more than one signal at once, and the
original cascade silently discarded every one but the first.** `_computeStudentSignal()` used to
return as soon as it found a match: an integrity flag returned immediately (never even computing
the behavioral checks below it), and the five behavioral checks were themselves an if/elif chain
that stopped at the first hit. A student who was simultaneously a review case (say, a score spike)
*and* showing declining engagement only ever surfaced the review flag — the drill panel, whose whole
job is "detail on demand," showed exactly the same one fact the roster pill did. That was a real
information loss, not just a scan-speed simplification, caught when asked directly "what if there
are multiple signals — shouldn't we show them?"

`_computeStudentSignal()` now returns `{ status, reason, learnMoreKey, signals }`, where `signals`
is every true signal, priority-ordered (review first, then the original behavioral priority:
declining > passive > low-skepticism > ai-ideas > reflection mismatches). `status`/`reason`/
`learnMoreKey` mirror `signals[0]`, so every caller that only ever read the top signal — the roster
pill, the sort order, the stat-tile counts — keeps working unchanged. Two things stayed deliberately
mutually exclusive rather than becoming separate list entries: the broad "passive engagement"
check (avg total < 9) and the narrower "tends to accept AI responses" check (avg CS and PQ both <
2.5) are the same underlying fact at two granularities, so only the more specific one that actually
fired is kept, exactly as the original cascade already did.

Roster scan speed is unchanged by design — a row still shows one pill, one colour. What changed is
that the pill now carries a quiet `+N` count (`.signal-pill-count`) whenever more signals are true,
and `detectTrends()`/the Browse Students Patterns filter now scan every attention-tier signal a
student has, not just their primary one — a student whose headline signal is a review flag still
correctly counts toward a behavioral pattern's Home card or filter if they also match it, which the
old primary-only scan silently missed.

**Reversed for Browse Students — 2026-08-08.** "One pill, one colour" was the right call for scan
speed and the wrong one for truth: a `+3` was four distinct signals wearing a single label, and the
only way to learn which four was to click in. That roster now renders every labelled signal as its
own chip (`signalPill(sig, { all: true })`, chips wrapping in `.signal-cell`), which the shared
column widths above give it the room for. Labels come from `signalChipLabel()`: `TREND_META.short`
for the four behavioural patterns, one "Worth a chat" covering all review-tier reasons, and
"Reflection mismatch" for the two reflection signals — a `+N` survives only for a signal with no
label of its own. The two fixed-150px call sites (class card, student list) still take the
single-label form; the paragraph above describes them.

### Where signals appear

| Surface | Review | Attention |
|---|---|---|
| Browse Students rows | Every labelled signal as its own chip | Every labelled signal as its own chip |
| Class / Assignment rows | Pill, `+N` count if more signals are true | Pill (pattern name), `+N` count if more signals are true |
| Class detail's inline expand | Pill | Pill (pattern name) |
| Drill panel | Flagged submissions show their own flags inline (unchanged); an "Also noticed" list beneath the history shows every other attention-tier signal, not just one | Every attention-tier signal listed, each its own line, `learnMoreKey` links preserved per line |
| Student detail header | Pill (no reason text) | Pill (no reason text) |
| Home | Listed via the "Worth a chat" stat tile → Browse Students | Rolled up into a pattern card if ≥2 students share the reason (scanning each student's full signal list, not just their primary one), filterable individually in Browse Students at ≥1 |

---

## Band distributions at the class and assignment tiers

> **⚠ SUPERSEDED IN PART, 2026-08-16.** Both tiers moved to bands and flows; the histogram is
> deleted. What survives is the reasoning about what a distribution can honestly claim.
>
> Kept for the argument in it, not as a spec. See *Where the surfaces stand*, top of file.

**Added 2026-08-12.** One substitution, applied identically at both tiers — described once here, and
cited rather than restated by *Class View*, *Assignment View* and *Assignment Detail* below.

**What changes.** `dimensionRowsFromCohort()`'s five-state trend classification — up / down / floor /
ceiling / mid, thresholded at `|avg delta| ≥ 0.3`, `avg ≤ 2`, `avg ≥ 4` — is entirely arithmetic on a
1–5 mean. It's replaced by a **band distribution plus a movement sentence**.

**What survives, and it's most of it:**

- The **three-column row shape** — Dimension → (what it's doing) → Note. Only the middle column's
  content changes.
- **Dimension leads, always** (the dataviz skill's `label → value → delta` stat-tile contract).
- **Fixed PQ/SU/CS/OC order, never ranked by urgency** — a stable position per dimension is
  learnable over repeated use; a ranking reshuffles every time.
- **Every dimension keeps its full row and its note, always.** Explicitly considered and turned down
  on 2026-07-31, and the reasoning holds harder now: a table whose shape changes assignment to
  assignment makes a teacher re-learn what's on screen every time.
- **Floor and ceiling stay distinct.** The same "no change" is a real problem at the floor and a
  non-issue at the ceiling — conflating them was a corrected mistake once already. In band terms:
  mass sitting at band 1–2 and mass sitting at band 4 are opposite findings, and the note says which.
- **The note carries what the distribution can't.** Unchanged job, now with more to do — a split
  distribution is exactly the case that needs a sentence.

**Movement over time is two counts in a sentence**, never a delta: *"Six students moved up a band on
Calibrated Skepticism since draft 1; two moved down."* Reporting both directions is not decoration —
a net figure hides a class that churned, which is a different teaching situation from one that moved
together.

**Movement belongs to the assignment tier, not to Home — decided 2026-08-13.** Home is a
**descriptive snapshot of current performance**: what the room looks like right now. Movement needs
a baseline to be movement, and on Home the only available baseline is "some earlier draft of some
assignment," which is not a thing a teacher can act on. Scoped to one assignment, draft 1 → draft 2
is a real comparison against a fixed task, and that is where the sentence above earns its place.

This also settles a question the band scale reopened: *what is Home for?* It answers **"what does
this room look like today"**, and the class and assignment tiers answer **"is it changing"**. The
three-tier framework already implied that split; the snapshot/movement boundary is what makes it
checkable.

**The Distributions tab is promoted, not invented.** `draftHistogramBins()`
(`dashboard.html:2952`) already bins the total on the four SAMR bands and each dimension on its own
integers — the exact shape every tier now needs, currently reachable only inside one tab of one
screen. It gets retargeted (each dimension bins 1–4 plus a "not enough here" cell; the overall bins
the level read directly rather than via `samr(total)`) and reused everywhere. **This is the one
place the scale change reduces work rather than adding it**, and its own comment already stated the
principle: *"bins are never arbitrary numeric buckets."*

**The average line charts are deleted.** `svgLineChart()`, `assignmentDraftSeries()` and
`seriesArcNote()` all plot per-draft means. They go with the mean. The 2026-07-31 reasoning that
justified the chart as a deliberate exception — *every vertex is a real per-draft average, not a
fitted value* — depended on the average being real, and it no longer is. Band-to-band movement is
the sentence above, which also keeps this page on the right side of the standing no-sparkline
constraint.

**Stat tiles**: `Avg. TAU score — 13.4 / 20` + `bandChip()` becomes the modal level with its
denominator. The tile stays inert (a fact, not a filter), same distinction that already separates it
from the clickable Missing / Worth-a-chat pair.

---

## Class View

> **⚠ SUPERSEDED IN PART, 2026-08-16.** The Trends tab is now a chip selector over one flow.
> The arc line chart, `FINAL_METRICS` and outlier-note passages describe deleted code.
>
> Kept for the argument in it, not as a spec. See *Where the surfaces stand*, top of file.

**Rebuilt 2026-07-31 as a timeline of assignments, not a sortable table.** Reached from the
sidebar's Classes list, not from a tab-level "all classes" overview any more (see *Navigation
Model*). The table-of-assignment-rows shape described in every earlier version of this section is
gone — replaced by the same idea Assignment Detail already proved out: walk the teacher through the
sequence one unit at a time, each unit getting its own full overview, instead of a table where every
fact lives in a column. Assignment Detail's unit is a draft checkpoint; this page's unit, one level
up, is a whole assignment. Prompted directly: a teacher jumping into a class wants to be walked
through its assignments, not handed a spreadsheet to interpret.

**Class overview card — added 2026-07-31, the class tier of the three-tier framework.** Sits
between the header and the assignment timeline below it, answering that tier's own question — "how
is the class doing over time, across assignments — do I need to teach differently?" — the one item
on the *Open/Future Work* checklist this page hadn't built yet, even though the assignment tier
shipped the same week. `renderClassAggregateCard()`, reusing the assignment tier's own building
blocks rather than inventing parallel ones:
- **Stat row** — students / missing-a-checkpoint / worth-a-chat, same `.stat-tile` component and
  click-through (`gotoStudents('missing')`/`('review')`) as the assignment tier's own card.
- **Recurring patterns across assignments** — `detectTrends()` gained an optional `scopeIds` param
  so this card can run the exact same behavioral-pattern rollup Home uses (≥2 students sharing a
  pattern), scoped to just this class's roster instead of every student — the same detector, not a
  second implementation of "who shares a pattern."
- **Dimension trend across assignments** (`classDimensionTrend()`) — **superseded 2026-08-12 by
  *Band distributions at the class and assignment tiers*, above**; the cohort-pairing logic (each
  student's two most recent assignments with a completed submission) survives, the classification it
  feeds does not. Original text follows — draft-over-draft's own
  classification math (`dimensionRowsFromCohort()`, extracted from `assignmentDimensionTrend()` so
  both tiers share one function) applied one level up: the cohort pairs each student's two most
  recent *assignments* with a completed submission, instead of two most recent drafts within one
  assignment. Same trend/floor/ceiling/skewed rules, same fixed PQ/SU/CS/OC row order, same "not
  enough data yet" fallback.
- **Idea-origin mix** (`classProvenanceMix()`) — each student's single most recent completed
  submission across every assignment in the class (not one specific assignment), same
  student-born/synthesized/AI-born pills.
- **Coaching note** (`classCoachingNote()`) — same templated floor/skewed/ceiling shape as the
  assignment tier's note, reworded from "next checkpoint" to "next assignment" since this tier's unit
  of progression is a whole assignment, not a draft.

**The assignment timeline, below the overview card.** One card per assignment
(`renderClassAssignmentCard()`), grouped **Open first, then Closed** — a teacher who just jumped into
the class wants what's actionable now before what's already settled, not strict chronological order
across the two groups. Within each group, most-recently-due first (unchanged sort). Each card renders
the exact same open/closed split Assignment Detail's own top card uses, not a fourth independent
summary invented for this page:
- **Open → `renderAssignmentAggregateContent()`** — draft-over-draft dimension trend within that
  assignment, idea-origin mix, a coaching note. Same content Browse Assignments' own quick-expand and
  Assignment Detail's Overview card already show.
- **Closed → `renderFinalAssignmentSummaryContent()`** — added 2026-07-31, same day as the Final
  Assignment Summary itself. Factored out of `renderFinalAssignmentSummary()` (Assignment Detail's own
  wrapper, which adds the "Final assignment summary — how the class did over N drafts" eyebrow this
  card doesn't need, since its own name/status header already says which assignment this is) so both
  surfaces render from one function, not two independently-maintained copies of the Overview/Trend tabs,
  the line charts, and "How they worked"/"How the class engaged." Same one-computation-two-wrappers
  shape `renderAssignmentAggregateContent()` already established for the open state.

The card's header states whichever fact is still live — current checkpoint + its own due date, while
the assignment is open — or settled — its own due date, once closed — and the content beneath degrades
gracefully through the same "not enough data yet" states the assignment tier already handles, so an
assignment with only one completed draft reads as early, not broken. Each card links out via "View
full assignment →" to Assignment Detail, same as everywhere else that link appears. `finalTab`/
`finalMetric` (the Final Summary's own tab/chip state, keyed by assignment id) are reset in
`gotoClass()` now too, alongside `gotoAssignment()`'s existing reset — a class timeline can render
several closed assignments' Final Summary cards at once, so a fresh visit should start every one of
them on Overview, not wherever they were last left across two different screens.

**No names anywhere on this page any more** — same rule as Browse Assignments' own expand and
Assignment Detail. This retires the last surface that still showed a per-student roster inline
(Class View's old expand-in-place drill, `renderClassDrillPanel()`/`studentAssignmentRowData()`/
`assignmentDrillRow()`, all deleted along with the sortable-table plumbing they supported —
`classSort`, `sortAssignments()`, `expandedInClass`, `toggleClassDrill()`). A student is reached via
Browse Students, this class's own roster search, or global search — same "consequence accepted, not
overlooked" trade-off Assignment Detail already made when it dropped its own roster.

**Class overview card rebuilt into three tabs, plus a full-term arc — added 2026-08-02.**
Brainstormed directly: the card as shipped 2026-07-31 answered "how did the last two assignments
compare" (`classDimensionTrend()`'s own two-most-recent-assignments cohort), not "how has this
class moved across the whole term" — the actual question a teacher reflecting on a semester or
year is asking, per a direct product conversation about what this tier is *for* (steering how the
teacher approaches the class over time, individual students being the secondary goal Browse
Students already covers). Two changes, designed first as a Claude artifact before any code, same
precedent as Assignment Detail's own build:

- **A full-term arc, not just a two-point comparison.** `classAssignmentSeries(students,
  assignments)` (new) is the class-tier counterpart to `assignmentDraftSeries()` — one point per
  *closed* assignment in `classAssignmentSequence()` order (not per draft), each point averaging
  every student's own latest completed submission on that assignment. Feeds the same
  `svgLineChart()`/`FINAL_METRICS`/`finalMetricSeriesPoints()` machinery Assignment Detail's Trend
  tab already built, via the same metric-chip idiom (TAU score / PQ / SU / CS / OC). `seriesArcNote()`
  gained one optional `opts.scope` string (default `'the assignment'`, unchanged for every existing
  call site) so the class tier can say "across the term" without forking the function.
- **An outlier callout, not just an implied trend.** Assignments aren't interchangeable ticks the
  way drafts within one assignment are — a persuasive essay and a research paper are different
  tasks that can legitimately score differently for reasons that have nothing to do with the class
  getting better or worse. A pure line chart risks reading "this class is declining" when the
  honest story is "one hard assignment." `classSeriesOutlierNote()` (new) finds the single
  assignment with the largest deviation from the series' own mean and names it directly ("Research
  Paper is the outlier — Calibrated Skepticism averaged 2.1, well below the 3.4 average the other
  four assignments hold..."), only firing once the deviation clears the same `deltaThresh`
  `seriesArcNote()` already uses to call something a real rise or fall — a flat term never gets a
  callout invented for it. Rendered in the tool's own `--tau-tool-info` voice, same as every other
  generated callout on this page.
- **Graceful degradation, sized for this tier specifically.** Assignments accumulate slower than
  drafts, so the arc only renders once **three or more** closed assignments have completed
  submissions — a higher floor than the draft-level Trend tab's "at least two," since two points
  barely earns the word "trend" at this tier. Below three, the Trends tab falls back to the
  original two-point `classDimensionTrend()`/`dim-row`/`dim-badge` pairwise view unchanged, just
  relocated — an early-term class reads as early, not broken.
- **Split into Overview / Patterns / Trends tabs**, direct follow-up ask once the arc pushed the
  card past five stacked blocks. Reuses `.card-tabs`/`.tab-panel` verbatim —
  `renderFinalAssignmentSummaryContent()`'s own Overview/Trend component, a third reuse rather than
  a new tab idiom. **Overview** — stat row, coaching note, idea-origin mix (stays here, not moved
  into Trends, per direct instruction — origin mix answers "where things stand," which is an
  Overview question even though it's also about progression). **Patterns** — the existing
  recurring-patterns cards; the tab label carries a count chip (`.tab-count`, new CSS, styled off
  `--tau-positive`/`--tau-surface-2` the same way `.stat-tile` already distinguishes active from
  inert), omitted at zero per the app's existing omit-inert-zero idiom, with an explicit "No
  recurring patterns yet" empty state rather than a blank tab. **Trends** — the arc + chips +
  outlier callout, or the pairwise fallback below three assignments. Per-class tab/metric state —
  `classTab{}`/`classMetric{}` keyed by class id, `setClassTab()`/`setClassMetric()` — mirrors
  `finalTab`/`finalMetric`'s exact shape and resets alongside it in `gotoClass()`, so re-entering a
  class always starts on Overview.

No headless browser available in this environment (same recurring caveat logged elsewhere in this
doc) — verified by starting the real dev server against seeded data and reading the rendered
output for a class with 3+ closed assignments (arc path) and one with 1-2 (fallback path); a live
visual pass in an actual browser is still worth doing before calling this fully settled.

---

## Class & Student Management — added 2026-07-31

The first teacher-driven (not seed-script-driven) way to create a class and put students on it.
Before this, `classes`/`users` existed only via `seed.js`'s idempotent `upsertUser()`/`upsertClass()`
helpers — real, but not reachable from the running app. Prompted directly: "update the global header
...create basic teacher permission functionality...this will be student management where a teacher
creates a class, adds students."

**Manual add-by-email, not self-serve signup — an explicit, asked-for scope call.** The real plan
(stated in `auth.js`'s own header comment) is domain-restricted Google SSO once this is a real school
deployment — no passwords at all at that point. Asked directly which shape to build toward that in the
meantime (an inline account-creation form vs. picking from existing accounts vs. both); the answer was
manual add by email now, SSO later — so this is deliberately a bridge, not the final shape, and every
new account it creates gets the same shared dev password every seeded account already has
(`DEV_PASSWORD`, `seed-data.js`) rather than inventing a per-account password with no delivery
mechanism to hand it to the student (no email sending in this POC).

**Header entry point rebuilt twice since, and this section had drifted out of sync with both
rebuilds — corrected here 2026-08-03 against `dashboard.html` as it actually stands.** The
"Classes & students" two-view-modal hub this section used to describe here does not exist in the
running code; somewhere between 2026-07-31 and 2026-08 the header moved to a "⚙ Manage" dropdown
(New class / Add students as inline sub-views inside a ~300px panel) without this doc being updated
to match. That intermediate shape is itself gone now — see *Navigation Model* and the Session Log's
2026-08-03 entries for the two passes that replaced it:

- **One "+ Add" trigger, not "Classes & students."** The global header has a single primary
  `+ Add` button (`#trig-manage`/`#panel-manage`, ids kept from the old Manage dropdown to avoid
  touching `HEADER_MENUS`/`toggleHeaderMenu`) opening a small picker with exactly three rows —
  **New class**, **Add students**, **New assignment** — each closing the picker and opening its own
  full-size modal, rather than switching between cramped inline sub-views the way the old Manage
  dropdown did.
- **New class modal** (`openNewClassModal()`/`closeNewClassModal()`, `#new-class-modal-overlay`) —
  the class-name field, plus (2026-08-03) a "What happens next" roadmap shown from the start, not
  only after creating: three numbered steps (name the class → add students, whenever → assign work,
  goes to everyone automatically), current step visually distinct by badge fill + text weight +
  opacity together, never colour alone (designsystem.md Hard Constraints: colour is never the only
  channel). Prompted directly — "when adding a class, it's just the class name... we have space for
  a larger modal where all the functionality can be present to inform the teacher." On successful
  creation the same modal swaps to a success view (`#new-class-view-success`) with two shortcuts —
  "Add students" (opens the Add students modal, this class pre-selected) and "Create an assignment"
  (opens the New assignment modal, this class pre-checked) — same two next-actions the roadmap just
  described, now actionable.
- **Add students modal** (`openAddStudentsModal()`/`closeAddStudentsModal()`,
  `#add-students-modal-overlay`) — a class `<select>` (any class, not scoped to one) plus a 7-row
  roster-paste textarea and live per-row preview (`renderRosterPreview('hdr')` — the same parser the
  per-class roster modal below uses, one implementation, two mount points via `ROSTER_SCOPES`). Gained
  a quiet footer line 2026-08-03 tying it back to the same next-step chain the New class roadmap
  states: assigning work comes next and goes to the whole class automatically.
- **This is deliberately not the same modal as the per-class roster view described below.** The
  header's Add students modal targets *any* class (a `<select>`, since you may not be looking at a
  specific class's page); the per-class roster modal (`openRosterModal(cid)`) is reached only from
  that class's own Class View and is already scoped, so it skips the picker. Both submit through the
  same `submitRosterAdd(scope)`/`ROSTER_SCOPES` machinery.
- **Both new modals reuse the app's one shared modal chrome** (`.scrim.modal-overlay` /
  `.confirm.modal` / `.tray-header` / `.tray-body`) — the same pattern the New assignment, Goal, and
  per-class roster modals already use — specifically so a roster paste or a class-scope decision gets
  the same amount of room those already had, not a shrunk dropdown-sized copy. Prompted directly:
  "we don't want to box teachers into small difficult forms."

`activeRosterClassId` remains the per-class roster modal's own scoping variable, unchanged by this
pass — it never became a shared "which view is showing" flag the way an earlier, now-superseded
design considered.

**Roster view (the per-class modal, reached from Class View's "Manage roster" button), two parts:**
- **Current roster** — each student as a name/email row with a "Remove" button. Removing only takes
  the student off *this* class's roster (`studentIds`) — the account itself isn't touched, since the
  student may belong to another class. No confirmation step; low-stakes and instantly reversible
  (re-adding by the same email finds the existing account again, doesn't create a duplicate).
- **Add a student** — email (required) + name (only required for a brand-new account). Reuses an
  existing student account by email if one already exists (so a student already in another class can
  be added to a second one without re-creating them), rejects if the email belongs to a non-student
  account, and is idempotent — adding someone already on the roster is a no-op, not an error.

**Server: `POST /api/classes`** (create) **and `POST /api/classes/:id/students`** (add/remove, one
route not two — the minimal router here only destructures three path segments after `/api/`, so a
fourth segment for a student id on a proper `DELETE` route isn't reachable without widening it;
branching on `{ studentId, remove: true }` in the body was simpler than that for one route). Both
added to the existing teacher-only route guard. Validates the same shape the client always sends
(non-empty class name; a syntactically valid email; a display name only enforced when actually
creating a new account) and rejects reusing a non-student email. **One real bug caught in testing, not
from reading the code:** the add-student route's success response first returned
`col('users').get(student.id)` directly — the *raw* user doc, including `passwordHash`/`passwordSalt`.
Every other user-returning route in this codebase (`/api/me`, the teacher-note response) explicitly
strips those fields before sending anything to the client; this one didn't, until caught by actually
reading the curl response during testing rather than trusting the code. Fixed to return only
`{ id, email, displayName }`.

Verified against the live running server, not just `node --check`: created a class, added a brand-new
student by email (confirmed the new account can actually log in with the shared dev password),
added an *existing* seeded student (Maya) by email to the same class (confirmed the account was reused,
not duplicated), re-added her a second time (confirmed no duplicate `studentId` and no error), and
confirmed a teacher's own email is rejected with a 400. Test classes/accounts created during this pass
were deleted from `app/data/*.json` afterward (the store has no delete API, so this meant editing the
JSON files directly with the server stopped) so the seed data wasn't left with test cruft. No headless
browser available in this environment — the header button placement, the roster modal's layout, and
the remove-button interaction have not been visually confirmed; worth a live check before calling this
fully settled.

**Rebuilt again 2026-08 (implementation session) — non-linear, no hidden required fields, modal grows
to fit.** The three modals above (and the header picker's own order) were redesigned in an artifact
first, iterated through several corrections from live feedback, then implemented for real here. What
changed from the shape described above:

- **Header picker order is now New assignment → Add students → New class** — ranked by how much
  content each door actually holds, not by dependency order. Class-picking, previously the *first*
  field on both New Assignment and Add Students (a real complaint — "class selection was sitting up
  top like a gate you had to clear first"), moved to where it's used: a `.class-checklist` positioned
  after Description/Purpose/Requirements on New Assignment, and after the roster textarea on Add
  Students. Both checklists/selects gained a trailing **"+ New class"** row/option — a name field
  revealed in place (`revealAssignNewClassInput()` / `handleAddStudentsClassSelect()`), not a detour
  to the New Class modal — so starting a class you don't have yet is a variant of picking one, not a
  different task.
- **New Assignment's "Customize schedule & coaching" `<details>` disclosure is gone.** It only ever
  wrapped `draftBudget`/per-draft rows/`teacherNote` (title/description/purpose/requirements were
  already outside it), but those first three are still server-required (`POST /api/assignments`
  rejects a mismatched `draftDueDates` count) — hiding required fields behind a click
  was flagged directly ("why are you hiding stuff? this is the opposite of make it easy and clear")
  and doesn't get a carve-out just because the fields are further down the form. The whole form is now
  one flat scroll, grouped under `.eyebrow` labels (*What students see* / *Who* / *When & how* / *Note
  to yourself*) rather than required-vs-optional visibility tricks.
- **New Class gained two optional attach panels** (`.attach`/`.attach-head`/`.attach-body`, new
  page-local component) — **Students** (the same roster textarea/preview as Add Students, scoped
  `newclass`) and **Assignment** (the *exact same field set* as the New Assignment modal, via a shared
  `assignmentFullFields`-equivalent — no stub). Both collapsed by default (a bare class is still a
  complete, one-field action), but opening Assignment shows every field immediately, no click-through
  gate. One submit (`hdrNewClassForm`'s handler) validates the assignment fields first if a title was
  entered, then sequences `POST /api/classes` → per-row `POST /api/classes/:id/students` → `POST
  /api/assignments`, so a half-filled assignment can't leave a class-and-roster created with the
  assignment silently dropped. The success view's two shortcuts (Add students / Create an assignment)
  now hide themselves when that action already happened inline.
- **The modal grows to fit what's open, with motion — then reverted the same session, in favor of one
  consistent width.** First implementation: New Class started at 440px (bare-class width) and animated
  to 640px when the Assignment panel opened, via a FLIP transform (`animateModalResize()`) — capture
  the box before the DOM mutation, apply it, then animate *from* the old apparent size *to* the new one
  using only `transform: translate()/scale()`, never `width`/`max-width` directly, per designsystem.md's
  own Hard Constraint ("transform/opacity only for movement"). It worked (confirmed both normal and
  `reducedMotion: 'reduce'`), but got a direct correction: *"why don't we just use the same modal size
  as the create assignment, instead of different size modals — this would be way simpler and more
  consistent."* Right call — three different bespoke widths for what's the same kind of thing (a form
  in an overlay) was complexity the resize animation existed to paper over, not something worth
  animating around. `animateModalResize()` and both modals' inline `max-width` overrides (440px / 480px)
  are gone; all three add-flow modals now render at the same width as the base `.modal` rule already
  gives New Assignment (`min(680px, 92vw)`) — confirmed identical (680px) across all three in a 1280px
  viewport. Panel content still isn't a hard jump: `.attach.open .attach-body` already runs `tau-reveal`
  (opacity + translateY), the same entrance this app already uses for a menu panel or a disclosure
  opening — one shared motion primitive doing the job a bespoke one used to.
- **Two real bugs caught by testing against the live server + a headless browser** (Playwright,
  installed into the scratchpad for this session — none was available in earlier passes, which is why
  those settled for "worth a live check" instead), not by reading the code:
  1. A leftover `.section-note { margin-top: -8px }` (from an earlier, discarded draft of this same
     work, prototyped first as a review artifact) overlapped the locked-class pill with the note below
     it once reused inside `.attach-body`'s own flex gap — the negative margin was never needed in this
     context and was removed rather than special-cased.
  2. The New Class success view's "Add students"/"Create an assignment" shortcut buttons weren't
     actually hiding when set `.hidden = true` — `.menu-item`'s own `display: flex` (author-origin, no
     `!important`) beats the UA stylesheet's `[hidden] { display: none }`, the same failure class
     `.roster-preview[hidden] { display: none; }` was already patched for elsewhere in this file. Fixed
     with the matching `.menu-item[hidden] { display: none; }` rule.
- Test class/roster/assignment records created twice while verifying the combined submit end-to-end
  (via `POST` through the real running server, not mocked) were deleted from `app/data/*.json`
  afterward with the server stopped, same as the 2026-07-31 pass did.

**Known limitations as of this section — the first two were solved 2026-08-08 (see the Session Log's
object-action-menus entry): class rename and archive now exist on a class's own action menu, and
moving a student between classes is one step on the student's.** What remains open below is the
teacher-scoping gap. Original text:

no class-rename or class-delete yet (only create); no way to
move a student between classes in one step (remove from one, add to the other, two separate actions);
`GET /api/teacher/dashboard` still returns every class and every student globally rather than scoped to
the requesting teacher (pre-existing, not introduced by this pass — fine while there's one teacher
account in the seed data, a real gap once there's more than one). The New Class door's Assignment panel
targets only the class being created (a locked field, "add more classes later from the assignment's own
Edit view") — retargeting an *existing* assignment to a newly-created class from inside New Class was
explored in the design artifact but deliberately not built here, to keep this pass scoped to what was
actually asked for.

---

## Browse Assignments

Reached via the sidebar's "All assignments" row or its "Open" sub-nav filter (see *Navigation
Model*). Still the one remaining table-of-assignment-rows surface in the app (Class View moved to a
card timeline in the 2026-07-31 rebuild, see *Class View* above) — this screen spans every class at
once, so a flat sortable/searchable table is still the right shape here even though it no longer is
one level down. A row expands in place via `renderAssignmentAggregatePanel()` rather than navigating
away — the same no-names aggregate content (dimension trend, idea-origin mix, coaching note) Class
View's own timeline cards render permanently, here shown on demand instead since this list can run
long. **2026-07-30 history, superseded 2026-07-31:** this expand originally called
`renderClassDrillPanel()` (a per-student list) to match what Class View did at the time; that
function no longer exists in either place — both surfaces converged on the aggregate-only content
once Class View's own rebuild retired its per-student expand too. `expandedInBrowseAssignments`
tracks which row is open, reset on every fresh entry via `gotoAssignments()`.

---

## Assignment Detail — a timeline, not a roster

> **⚠ SUPERSEDED IN PART, 2026-08-16.** The timeline survives. The per-draft Distributions
> histogram is now a Dimension bands tab — band bars, no metric chips, no 1–5 axis — and the
> Overview/Trend tab pair is deleted.
>
> Kept for the argument in it, not as a spec. See *Where the surfaces stand*, top of file.

**Rebuilt 2026-07-31 (later same day), replacing the student-roster page this section used to
describe.** The old shape (Student / Draft / How they're using AI / Total / Change / Worth a chat,
one row per student, grouped by class) is gone from this page entirely — prompted by a direct
product conversation about what a teacher actually needs from "the full assignment," not a shrunk
copy of Browse Students scoped to one assignment. Reframed as a chronological timeline instead:
the assignment's own goal at the top, then one **snapshot** per draft checkpoint once it closes,
with a live read of what's happening while the next one is still open. **No student names appear
anywhere on this page any more** — Browse Students, Class detail, and search remain the places to
reach an individual student; see the *No student names* note under the next section for the one
sentence there that this correction made stale.

Designed and iterated as a Claude artifact before any code — following the same
design-in-artifact-first precedent as the 2026-07-30 aggregate-tier pass below. **Built 2026-07-31**
(same day as the design pass) — `draftSchedule()`, `draftCompleteSubs()`/`draftAnySubs()`,
`draftHistogramBins()`, `draftTimingNote()`/`draftSessionNote()`/`draftEngagementNote()`,
`renderAssignmentGoal()`, `renderAssignmentOverviewCard()`, `renderAssignmentTimeline()` and its
per-slot renderers (`renderDraftSnapshot()`/`renderDraftLive()`/`renderDraftFuture()`), all new in
`dashboard.html`; `/api/teacher/dashboard` gained `prompt`/`teacherNote` on each assignment and
`conversationCount` on each submission (`index.js`) — none of the three existed on that endpoint
before. Verified live (Playwright against the running dev server, real seed data, both themes, no
console errors) rather than by inspection alone — see the Session Log entry below.

**Anchor 0 — The goal, moved into a modal, 2026-07-31 (later same day).** Originally rendered inline
at the top of the page as `renderAssignmentGoal()` — Description/Purpose/Requirements each in a
labelled field-preview box (`.goal-field`), plus `teacherNote`, plus the draft schedule, all in one
`.overview-card`. Corrected the same day, prompted directly: assuming each field is realistically a
couple of sentences, three stacked field-preview boxes still pushed the actually-useful content
(Overview/Final Summary, the timeline) down the page on *every single visit*, for text a teacher
already wrote and rarely needs to re-read. Read-once reference material doesn't belong competing for
the top of the page with what changes every visit.

Split in two: the **draft schedule** (`renderDraftScheduleCard()`) stays inline, right after the
header — operational, at-a-glance info ("when's the next thing due") worth a quick scan on every
visit. **Description, Purpose, Requirements, and teacherNote** moved into a **"Goal & requirements"
modal** (`openGoalModal()`/`closeGoalModal()`/`goalModalBody()`), reached via a button in the content
header next to the Open/Closed chip — same modal chrome (`.scrim.modal-overlay` / `.confirm.modal` /
`.tray-header`/`.tray-body`) the Flag modal and New Assignment modal already use, a static overlay in
the page body whose content is populated per-assignment on open rather than a new modal system. The
field-preview treatment (`.goal-field`, anticipating a future structured-requirements form) is
unchanged, just relocated; `teacherNote` keeps its own violet `.card-edge-auditor` voice inside the
modal for the same reason as before — the teacher's own quoted words, not a requirement field.

An inline collapsible disclosure (reusing the app's existing chevron-toggle pattern from the
reflection-details triangle) was the first idea raised for this fix and explicitly turned down in
favor of the modal, once proposed directly — a header button keeps the assignment page itself
uncluttered at every scroll position, where an inline disclosure still reserves a header row and a
toggle affordance on the page even collapsed.

**Header cleaned up further, same day, follow-up — due date and the whole content-meta line
removed; Goal & requirements and a new Edit button moved to their own row under the title.** The
due date was redundant with the draft schedule card directly below it (the final slot's own due date
*is* the assignment's due date, per the schema's own invariant); once that went, the rest of
`content-meta` (class count, student count, missing/worth-a-chat) was cut too rather than left
half-empty — those counts already live in the Overview/Final Summary card's own stat tiles one
scroll down, so the header wasn't the only place carrying them. `renderAssignmentDetail()`'s header
is now just the title + Open/Closed chip, then a second row with two buttons: **Goal & requirements**
(unchanged) and **Edit** (new).

**Edit reuses the New Assignment modal's own form and chrome, not a second one.** `openEditAssignmentModal(aid)`
sets a module-level `editingAssignmentId`, retitles the shared modal ("Edit assignment" / "Save
changes"), and pre-fills every field — including the per-draft due-date/coaching-level rows, via a
new `naLevelSelectsHtml(n, dates, levels)` factored out of `naSyncLevelSelects()` so both the
create-and-resize path and the edit-prefill path build the same row markup from one function instead
of two. **One real bug caught in testing, not from reading the code:** the seeded `draftDueDates` are
full ISO datetimes (`seed.js` computes them as `Date` objects), but `<input type="date">` only accepts
a bare `YYYY-MM-DD` value — pre-filling with the raw ISO string would have silently left every date
field blank. Fixed by slicing to the date portion (`new Date(d).toISOString().slice(0, 10)`) before
building the rows. The form also gained a `teacherNote` textarea (it didn't have one before — creation
never set this field, only the unused `/api/assignments/:id/note` endpoint could, and nothing called
that either) so both creating and editing can set the teacher's own note in one place.

**Server: new `POST /api/assignments/:id/edit`** (`index.js`), added to the existing teacher-only
route guard alongside `/note`. Same field validation as creation (required text fields, one due date
per draft slot, ascending order) since the client reuses the exact same
form — plus one guard creation doesn't need: **`draftBudget` can't shrink below any student's
already-reached checkpoint** (`Math.max` over existing submissions' `cycleIndex` for this assignment),
since `checkpointStatus()`/`cycleIndex` assume the schedule only ever grows, never shrinks, out from
under submissions that already exist. **Correction 2026-08-03:** this paragraph used to claim the
form has no class picker at all, falling back silently to the assignment's existing `classIds`. That
was stale even when checked against the code at the time — `assign-class-checklist` (a checkbox per
class, `renderAssignClassChecklist()`) has been part of this shared form since it was ported into
`dashboard.html`, on both the create and edit paths; nothing here falls back silently. Verified
against the live seeded "Persuasive essay" assignment: a
valid edit round-tripped correctly; an out-of-order due-date edit was rejected with a 400 and the
expected message; a same-or-larger `draftBudget` edit was accepted. The test edits were reverted back
to the assignment's original field values afterward so the seed data wasn't left corrupted.

Client-side, `api()` throws on a non-2xx response rather than returning an error body (see `api.js`) —
the shared form's submit handler needed a `try`/`catch` around the `api()` call it didn't have before
(the creation-only version relied on the client-side checks above it catching everything, which no
longer holds now that the edit endpoint has a server-only validation rule), alerting `err.message` on
rejection rather than left as an unhandled promise rejection.

**Assignment Overview card, directly below the draft schedule.** Deliberately **not** a new summary —
`renderAssignmentOverviewCard()` renders the exact same content as Browse Assignments' quick-expand
(stat row, coaching note, dimension trend, idea-origin mix) via one shared function,
`renderAssignmentAggregateContent(a, students)`, that both surfaces call. Two wrappers, one
computation: the quick-expand wraps it in `.drill` plus a "View full assignment →" link; this card
wraps it in `.overview-card` with no link, since a teacher who's already here doesn't need a link back
to where they are. **Missing/Worth-a-chat stat tiles are clickable** (`.stat-tile-clickable`, the same
component Home's own stat tiles use) — routing to Browse Students pre-filtered
(`gotoStudents('missing')`/`gotoStudents('review')`), same global filter keys as everywhere else this
pattern appears. This is the **global** roster, not scoped to this one assignment — there's no
per-assignment student list left anywhere on this page (see *Consequence accepted*, above) — a real,
named limitation, not a silent one.

**Per-draft snapshot (once a checkpoint closes).** A stat row — submitted count, TAU average,
range, and average conversations per student for that draft — followed by two tabs:
- **Overview** — two tool-generated callouts, both aggregate-only, no names: **"How they worked"**
  (the submission-timing pattern for this checkpoint — clustered near the deadline vs. spread out —
  plus a conversation-count usage note) and **"How the class engaged"** (which
  dimensions were strongest/weakest this round). Both render in the tool's own voice —
  blue/`--tau-tool-info`, not violet — see *Visual Language*. An earlier draft also had a standalone
  "N students well below the group" outlier line under the tabs; **removed 2026-07-31** once the
  Distributions tab existed, since a lone low bar in a histogram already shows the same fact — the
  text line was saying it a second time.
- **Distributions** — a metric-chip row (**TAU score**, default, plus the four dimensions) driving a
  histogram: student count on the y-axis, score on the x-axis. This went through two real design
  passes before landing here, not a straight build: first a strip plot (one dot per student along a
  0–20 line), then — once shown a reference histogram — rebuilt as true bars-with-bins to match.
  Bins are never arbitrary numeric buckets: the **TAU score** bins on the four SAMR bands already
  meaningful elsewhere in this app (Substitution 4–8 / Augmentation 9–12 / Modification 13–16 /
  Redefinition 17–20); each **dimension** bins on its own raw 1–5 integer, since that scale has
  nothing finer to bucket in the first place. **Deliberately no fitted density-curve overlay** — with
  a handful of students per draft, fitting a smooth curve to 4–5 discrete points would be a
  statistical fiction, not a real fit; bars alone are the honest read at this sample size. Switching
  chips rescales the axis with it (0–20 vs. 0–5), not just the bars.
  **Retargeted 2026-08-12, not replaced** — the TAU-score chip becomes the level, binned directly
  rather than via `samr(total)`; each dimension bins on 1–4 plus a **"not enough here"** cell held
  off the ramp; the axis rescale goes away with the two numeric scales. **Everything else here
  survives, and this tab is now the model for the rest of the page** — the "bins are never arbitrary
  numeric buckets" principle and the refusal of a density overlay are exactly right for ordinal
  bands. See *Band distributions at the class and assignment tiers*.

**In-progress card (checkpoint still open).** A submission-pace read — how many have submitted so
far, compared to the previous checkpoint's pace at the same point before its own due date — plus a
"worth watching" note that connects a real pattern from the last checkpoint (e.g., early vs.
late submitters diverging on a specific dimension) to what to look for once this one closes. This
card can only honestly talk about *timing*, never quality — there are no scores yet for students who
haven't submitted.

**Future checkpoints** render as ghosted placeholder cards (dashed border, faint text, no shadow) so
the timeline's eventual full shape — how many checkpoints, when they land — is visible before they
close, not just revealed one at a time as the term progresses.

**Final assignment summary — added 2026-07-31, replaces the Overview card once closed, corrected the
same day into a two-tab shape.** The governing rule, stated explicitly: **open → Assignment Overview
card; closed → Final Assignment Summary card.** Never both — the two are mutually exclusive states of
the same slot in `renderAssignmentDetail()`, not an addition. Open means "here's where things stand
mid-flight" (the existing draft-over-draft Overview content); closed means "here's the final answer,"
a different question with its own card, not the same card plus an appendix. The first pass here
rendered the Final Summary *underneath* the Overview card on every closed assignment — corrected the
same day once it was pointed out the rule is a replacement, not an addition.

> **Superseded in part, 2026-08-12** — see *Band distributions at the class and assignment tiers*.
> The Overview tab's Avg. TAU stat and dimension-average row become the modal level with its
> denominator plus four band distributions; the **Trend tab is deleted outright**, since its whole
> content is line charts over per-draft means. The tab structure, the "where the class landed, not a
> running average" scoping rule, and the Distributions tab all survive — Distributions is in fact
> the surface the rest of this page is now built from.

**Overview tab** — where the class ended up. A stat row (Avg. TAU score — with its SAMR band riding
alongside via `bandChip()`, plain-language classification never leading the raw number, same rule as
everywhere else this pairing appears — Missing a checkpoint, Worth a chat) plus a dimension-average
row (PQ/SU/CS/OC, fixed order, plain final values — no trend badge, no chart) — all read from the
*last* closed draft's own completed submissions (`assignmentDraftSeries()`'s final entry), not an
all-drafts blend. "How did it go" is answered by where the class landed, not a running average across
early drafts that no longer represent the students' finished work.

**Missing/Worth-a-chat corrected to the shared `.stat-tile`/`.stat-tile-clickable` component, 2026-07-31,
same day.** These two had shipped as plain, inert `.draft-stat` tiles — the one place in the app these
two counts didn't behave like they do everywhere else they appear (Home, `renderAssignmentAggregateContent()`).
Corrected to match exactly: clickable, tinted attention/caution, routing to the same global Browse
Students filters (`gotoStudents('missing')`/`('review')`), and omitted entirely rather than shown as an
inert zero when the count is zero — same `${count ? statTile(...) : ''}` idiom used everywhere else
this pair of stats renders. The Avg. TAU tile stays its own non-clickable `.draft-stat` — it's a
number, not a filter, same distinction Home's own inert tiles (Open assignments, Students) already draw
against its clickable ones.

**"How they worked" / "How the class engaged" — added 2026-07-31, same day, follow-up.** The same two
callouts `renderDraftSnapshot()`'s own Overview tab already shows per draft, generalized across the
whole assignment instead of one round — a direct ask ("we should also provide a summary of how they
worked, how the class engaged"), not a new idea invented for this tab. `allClosedCompleteSubs()` pools
every completed submission across every closed draft (each tagged with its own draft's due date, since
drafts don't share one deadline); `assignmentTimingNote()`/`assignmentSessionNote()`/
`assignmentEngagementNote()` are reworded siblings of `draftTimingNote()`/`draftSessionNote()`/
`draftEngagementNote()` — same computation, "this draft"/"this round" swapped for "across the
assignment" — kept as separate functions rather than parameterized, matching this doc's own precedent
(`classCoachingNote()` vs. `assignmentCoachingNote()`) of a small deliberate duplication when the copy
genuinely differs by tier rather than forcing one function to cover both. Same `.teach-note` tool-voice
treatment, same "how they worked" → "how the class engaged" order, same fallback (nothing renders if
there's no data yet) as the per-draft version.

**"How the assignment did" — addressed via the SAMR band chip, not a third paragraph.** Considered a
separate narrative sentence synthesizing overall performance and decided against it: `bandChip()`
next to the Avg. TAU stat tile already states the plain-language classification (e.g. "Steering a
little") the raw score maps to, and a second sentence saying the same thing in prose would repeat it.
If a real synthesis is wanted later, it belongs in the Trend tab's per-metric analysis line
(`seriesArcNote()`), not a new paragraph competing with the band chip for the same fact.

**Trend tab** — how the class got there. One metric at a time, never all five simultaneously — a
metric-chip row (`FINAL_METRICS`: TAU score, then PQ/SU/CS/OC, mirroring the per-draft Distributions
tab's own chip idiom, `renderDraftSnapshot()`, rather than inventing a second chip pattern) drives a
single line chart for whichever metric is selected (`setFinalMetric()`), plus one analysis sentence
scoped to that same metric. The first pass here rendered the TAU chart and all four dimension mini-
charts permanently, all at once; corrected the same day to this chip-driven single-chart shape once
it was pointed out that "all at once" wasn't what was being asked for — the Overview tab already gives
the where-things-landed summary, so the Trend tab's job is a focused look at one metric's arc, not a
second dashboard's worth of charts on the same card.

`assignmentDraftSeries(a, students)` (new) walks every closed draft slot in order via
`draftSchedule()`, averaging each dimension and the TAU total across that draft's completed
submissions (`draftCompleteSubs()`, the same per-draft cohort the Distributions histogram already
uses) — one data point per real, completed draft, not an interpolation. Distinct from
`assignmentAggregateContent()`'s own dimension trend (`assignmentDimensionTrend()`/
`assignmentTrendCohort()`), which only ever compares each student's two *most recent* completed
drafts — that function still powers Browse Assignments' quick-expand and Class View's own
per-assignment cards unchanged; this is a new, separate whole-arc computation for Assignment Detail
specifically.

**The line chart itself — a deliberate exception to the "trend badge, not a raw number" rule** the
draft-over-draft and assignment-tier/class-tier cards all follow elsewhere. The distinction: those
cards compare exactly two points, where a decimal average implies more precision than a 2-3 student
sample supports — a trend word is the honest read there. This chart plots the *whole sequence* of an
assignment's drafts for one metric, genuinely the "trend over time" job a line chart exists for (see
the dataviz skill's own form table), and every vertex is a real per-draft average, not a fitted or
interpolated value — same "no invented precision" discipline, satisfied a different way. `svgLineChart()`
(new, `dashboard.html`) draws straight segments only between real points (no curve fitting, matching
the Distributions histogram's own deliberately-dropped density overlay), a direct end-label on the
final value, and a hover/focus tooltip per point (`showLineTip()`/`hideLineTip()`, one shared tooltip
element for every chart on the page) — every value stays reachable via the axis tick or end-label
without hovering, per the dataviz skill's "tooltips enhance, never gate" rule. Colour is always
`--tau-tool-info` regardless of which metric is selected (the tool's own generated synthesis, not the
teacher's voice — same colour rule *Visual Language* already established for this page's other
generated callouts) — a deliberate choice not to mint a per-dimension categorical palette: this app
already treats the four TAU dimensions as parallel, label-distinguished, never colour-coded rows
everywhere else, and its existing hue budget (`--tau-forest`/`positive`/`caution`/`attention`/
`auditor`/`tool-info`/the four SAMR bands) has no clean, unclaimed room for a 5th categorical family
in any case.

`seriesArcNote(series, key, label, opts)` generalizes across both scales via `opts` (delta threshold,
floor/ceiling, value formatter) rather than needing a second copy for the TAU total's 0–20 scale vs. a
dimension's 1–5 scale — first completed draft vs. last (not draft-over-draft), same floor/ceiling
distinction (flat-and-low is a problem, flat-and-high isn't) the draft-over-draft note already uses.

Falls back to a plain "not enough completed drafts to chart a trend" line in the Trend tab when fewer
than two drafts closed with any completed submissions, and "no completed drafts yet to summarize" in
the Overview tab when none have — an assignment can be `status: closed` (its final due date passed)
while still genuinely too early to show real data.

No headless browser available in this environment to screenshot the rendered charts — the SVG
generator itself was verified by extracting and executing it standalone against sample data (correct
point/label counts, no `NaN` in the output), but the on-page layout (tab/chip switching, tooltip
positioning near the page edge) has not been visually confirmed; worth a live check before calling
this fully settled.

**Consequence accepted, not overlooked:** removing the roster means there is currently no "every
student on this one assignment" list anywhere in the app — Browse Students and Class detail both
show a student's assignments, not an assignment's students. Raised directly during design and
accepted for now rather than solved; if it's missed in practice, it comes back as its own link off
this page rather than reviving the roster table here.

---

## Assignment View — aggregate-first, a teaching tool not a monitor

> **⚠ SUPERSEDED IN PART, 2026-08-16.** "Aggregate-first, no roster" survives. The
> dimension-trend table it specifies is replaced by bands and flows.
>
> Kept for the argument in it, not as a spec. See *Where the surfaces stand*, top of file.

**Built 2026-07-31.** Designed and settled 2026-07-30 as a standalone artifact (three states — All
assignments / expanded / clicked open — walking one real assignment through the flow); shipped the
next day in `dashboard.html` — `assignmentDimensionTrend()`, `assignmentProvenanceMix()`,
`assignmentCoachingNote()`, `renderAssignmentAggregatePanel()` (Browse Assignments' expand),
`renderPersistedAggregateCard()` (Assignment Detail's persisted card), plus the roster filter chips
on Assignment Detail. One real correction from the design phase: it was assumed building this "for
real" would need new server-side aggregation (see the old *What doesn't exist yet* note, below what
this section used to say) — turned out unnecessary. `/api/teacher/dashboard` already sent every
submission's raw `pq`/`su`/`cs`/`oc`; the trend classification (up/down/floor/ceiling, the skew
check) all runs client-side off data that was already there. The only server change needed was
exposing `analysis.tau.provenanceCounts` per submission (one field, `index.js`) — it was already
computed for OC scoring, just never sent to the client before.

**The three-tier framework this comes from.** A conversation about "what does a teacher actually
need at each level" produced this split, which reframes every aggregate surface in the app,
not just this one:

| Level | Answers | Flag prompts |
|---|---|---|
| **Class** | How is the class doing over time, across assignments — do I need to teach differently? | Modify how I teach (a recurring pattern across *several* assignments, or a dimension trending down class-wide) |
| **Assignment** | How are students doing, in aggregate, on *this* assignment across its drafts — how do I refine feedback on it specifically? | Adjust this assignment's scaffolding or next-checkpoint instructions |
| **Student** | How is this student doing across every assignment and draft — what should I actually tell them to improve? | Have a conversation with this specific student |

Each tier's flag should be traceable to the tier below it (a class-level "Calibrated Skepticism is
flat" claim should be able to answer *which* assignment is driving that, which should answer *which
students*, down to the specific submission) — same underlying data, three roll-ups, one drill path.
This section covers the **assignment** tier only.

**No student names — updated 2026-07-31, second half now stale.** Both the Browse Assignments list
*and* its expanded row stay names-free — aggregate counts and patterns only, unchanged. The second
half of this claim no longer holds: it used to say names exist in exactly one place, "the full
assignment page reached via 'View full assignment →.'" That page went names-free too in the same-day
timeline rebuild (see *Assignment Detail — a timeline, not a roster*, above) — so names now live only
in Browse Students, Class detail, and search, nowhere scoped to one assignment. The original
correction this paragraph describes — the first pass at the expanded row being a shrunk copy of the
student table, not a distinct tier of information — is still the right reasoning; it just no longer
terminates at a roster the way it used to.

**What the expanded row shows instead (replacing the shrunk student list) — `renderAssignmentAggregatePanel()`:**
1. The existing admin counts (students / missing / worth a chat), smaller now — present, not the
   point.
2. **A coaching note** (`assignmentCoachingNote()`) — **revised 2026-07-31 to render here, second,
   right after the counts** (was last, after the full trend table and origin mix). The note is the
   only sentence in the panel that synthesizes everything below it into "what to actually do"; putting
   it last meant a teacher read all the evidence before reaching the conclusion it was building toward.
   Conclusion first, evidence after. Content is unchanged — templated, not free-generated: it surfaces
   at most one floor finding, one skewed finding, and one reassuring ceiling finding, built directly
   from the same trend/skewed flags the rows below already show, so the note can never claim something
   the rows don't back up. **Voice — revised the same day:** the note's card now uses `--tau-auditor`
   (violet), not forest — see *Visual Language* below for why.
3. **Draft-over-draft dimension trend** (`assignmentDimensionTrend()`) — each student's most recent
   two *completed* submissions (`analysisStatus === 'complete'`; pending/error submissions carry a
   `0` placeholder score and would corrupt an average, so they're excluded from the cohort, not
   counted as zero), stated with an explicit sample size and, when nobody yet qualifies, an honest
   "not enough data yet" state rather than an empty panel.
4. **Idea-origin mix** (`assignmentProvenanceMix()` — student-born / synthesized / AI-born, each
   student's latest completed submission only, "where the class's ideas are right now" not a running
   total), reusing the existing origin-encoding tokens and non-evaluative rule from `designsystem.md`
   (forest / sage / faint-grey) — a teacher-facing extension of a rule that previously only applied
   to the student-facing provenance bar.

**Row format for dimension movement — settled shape, three columns:** Dimension → Trend → Note.

> **Superseded in part, 2026-08-12.** The three-column shape, the dimension-leads rule, the fixed
> order and the every-row-always rule all survive — see *Band distributions at the class and
> assignment tiers*, above, which is now the specification for the middle column. The five trend
> states and their thresholds below are historical: they are arithmetic on a 1–5 mean. Kept for the
> reasoning, which is what produced the floor/ceiling distinction the band version inherits.

- **Dimension leads, always.** Per the dataviz skill's stat-tile contract (`references/marks-and-
  anatomy.md`, `label → value → delta`) — a trend badge with no name attached is unreadable, the
  label is what the rest of the row is relative to.
- **Trend, not a number.** One of four states — Trending up, Trending down, Flat (floor), Flat
  (ceiling) — no decimal average, no range. A raw score like "2.3 → 2.8" was tried and dropped: on a
  1–5 scale averaged across 2–3 students, a decimal implies more precision than the sample supports,
  and it's the *direction* that actually transfers to a decision, not the digit. Floor and ceiling
  get their own badge states rather than collapsing into one "flat" — the same "no change" is a real
  problem at the floor and a non-issue at the ceiling, and conflating them was an earlier mistake
  this design corrected. Ceiling's badge is deliberately neutral grey, not the same green as a real
  gain, so it never misreads as "improving." A fifth internal state, `mid`, shares ceiling's neutral
  badge treatment (same visual weight, different words) for a flat score that's neither near the
  floor nor the ceiling — real data doesn't sort as cleanly as a worked example, and this keeps a
  merely-unremarkable dimension from being forced into an alarming or a triumphant bucket it doesn't
  belong in. Thresholds, all against the 1–5 scale: `|avg delta| ≥ 0.3` → up/down; otherwise `avg ≤ 2`
  → floor, `avg ≥ 4` → ceiling, else `mid`. A dimension is separately flagged **skewed** whenever the
  cohort's range on that dimension is `≥ 2` — independent of its trend, so an "up" dimension can still
  carry the skewed note (see Selective Use in the worked example, and Prompting Quality in the first
  real data this ran against, both "trending up" with a split group underneath).
- **The note carries what the number used to gesture at.** Whatever nuance a raw score or range
  would have shown — a split group, a genuine floor, anything a one-word trend can't say — lives in
  the note's own sentence instead. A "trending up" dimension whose gain is really two different
  groups (some students already there, others not) says so explicitly in its note rather than
  letting "up" imply the whole class moved together.
- **Row order is fixed, not ranked.** Always the app's own canonical order — Prompting Quality,
  Selective Use, Calibrated Skepticism, Original Contribution — the same sequence used everywhere
  else this quartet is listed. An earlier draft sorted rows by urgency (worst first); reversed,
  because a teacher scanning this across many assignments benefits more from a stable position per
  dimension — learnable over repeated use — than from a ranking that reshuffles every time.
- **Every dimension keeps its full row and its note, always — considered collapsing this and
  explicitly turned down, 2026-07-31.** The pitch: dimensions with nothing to act on (ceiling,
  unskewed mid) would compact to a name-and-badge-only line, since `dimensionTrendNote()` gives even
  those a full sentence ("Already high and consistent — flat here is expected, not a concern.").
  Rejected on the same learnability logic as the row-order rule above: a table whose shape changes
  assignment to assignment — sometimes four rows, sometimes one — means a teacher has to re-learn
  what's on screen every time instead of knowing, once, that this table is always four rows in this
  order with this much to read. The fixed reading cost was judged worth more than the space saved.
  Trend badges also dropped their `▲`/`▼`/`●` glyphs the same day — the glyph only ever applied to
  two of the five trend states (`up`/`down` got an arrow; `floor`/`ceiling`/`mid` all shared the same
  dot despite meaning three different things), which read as arbitrary rather than a system. Colour
  plus the plain-language label already carried the meaning on their own; badges are colour + text
  only now, everywhere this labels a trend.

**Persisted context on the full assignment page — superseded 2026-07-31.** This subsection used to
describe `renderPersistedAggregateCard()`, which carried the condensed coaching note + highlight
rows onto the roster page a teacher clicked through to. Both the persisted card and the roster
underneath it are gone in the same-day timeline rebuild — the per-draft snapshot's own "How the class
engaged" tab and Distributions histogram now do the job this card used to do, scoped per checkpoint
instead of once for the whole assignment. See *Assignment Detail — a timeline, not a roster*, above.

**Roster filters, mirroring Browse Students — superseded 2026-07-31.** This subsection used to
describe `assignDetailFilter`/`studentMatchesAssignFilter()`, the All / Missing / Worth a chat /
Improved / pattern chips scoped to one assignment's roster. There is no roster on this page any more
to filter — see the *Consequence accepted, not overlooked* note above.

---

## Student View

> **⚠ NOT YET REBUILT** — the one surface still emitting the retired totals and raw 1–5 dimension
> numbers. **Those are not a measurement this product has**; the model is **agency (level + trend)**
> and **the four dimensions (band + trend)**, and this surface owes both, scoped to one student.
> Item 4 in *Open* at the top.
>
> **n=1 is what makes it its own build, not a re-mount.** A cohort flow degenerates here — every
> ribbon is width 1 — and its widths are counts of classmates, which is a ranking a student must
> never be handed (`designsystem.md` Hard Constraints). So the trend halves need their own mark:
> most naturally the *Distribution* organism per draft, never *Movement*.

Shows every class the student belongs to, each as its own panel of that class's assignments,
expandable into submission history. **Rebuilt 2026-07-28** — a student can now genuinely be in more
than one class (see *Data Model*'s classes note), so a single flat assignment list stopped being
accurate; grouping into one panel per class mirrors the same class-grouping convention Browse
Students and the sidebar already use.

**Student header:** name, overall signal pill (review or a pattern name — see *Student Signal
System*), every class they belong to (`classesForStudent()`), joined with " · ". No reason text in
the header itself, same as before.

**Per-class panel** — a small header naming the class, then that class's assignments only
(`ASSIGNMENTS.filter(a => classesFor(a).some(...))`), each row fixed-width for alignment:
| Column | Width | Content |
|---|---|---|
| Assignment name | flex:1 | Title, truncated |
| ~~TAU score~~ | ~~48px~~ | **Deleted 2026-08-12** — no total exists |
| Level | 150px | The level by name, leading (was a SAMR band chip derived from the total) |
| Bands | — | The four dimension bands, canonical order; width to be settled in the lab |
| Signal pill | 150px | Empty container when no signal — widened 2026-07-28 from 80px, which was sized for the short "Worth a chat" text only and visually overlapped the next column once pattern names ("Passive engagement") started rendering here too |
| Status chip | 88px, centered | Final / Draft N/Total / Not started |
| Subs count | 44px, right | `3 subs` |

**Submission history (expanded):**
- Attention banner at top (assignment-level pattern only)
- Submissions most recent first; each row uses fixed-width flex columns so layout is identical across all expanded assignments; each submission row carries its own "Report →" link

---

## Submission Row Layout (drill panels)

**The row's controls live in an action bar at the foot of the card — added 2026-08-21.** They were
plain forest text (`.sub-row-link`), justified by the salience budget's rule that enclosure is
reserved for values that are actionable *and* rare. **That test governs values a reader scans, not
controls** — misapplying it to actions left Add note, Report and Mark as followed up looking like the
prose around them. Report keeps its place at the row's right edge and takes `.btn-quiet` (the one
bordered control on the card); Add note and Mark as followed up take `.btn-tertiary` in the bar.
Not `.btn-primary` for Report: that is reserved for the one primary move per *screen*, and a drill
panel renders one of these cards per draft.

**The level moved back in beside the row's other classifications** the same day. It had been pushed
to the right margin by a `flex:1` spacer left behind when the dimension band pills were deleted
(2026-08-12) — the table below still describes that deleted column.

Fixed-width flex columns ensure alignment across all rows within a panel:

| Column | CSS | Content |
|---|---|---|
| `#N` | 20px | Submission index |
| Chip | 44px, centered | Final / Draft |
| Date | 140px | `May 10, 3:42 PM` |
| ~~TAU total~~ | ~~40px~~ | **Deleted 2026-08-12** |
| Dim bands | flex:1 | PQ / SU / CS / OC band pills, or "not enough here" |
| Level | 100px, centered | The level by name |

Submission-level flags appear as plain-text lines below the row (terra color), each with a "Learn more" link.

---

## Evidence on the teacher surface

**Added 2026-08-12.** The only part of the scale change that is a genuine addition rather than a
substitution, and the part that makes everything else on this page checkable. `tau-dimensions.md`:
*"Every claim is falsifiable against the transcript. A teacher can check a quote. Nobody can check
a 3."*

### The three-slot shape

Per dimension, in this order, always:

1. **The claim** — what the student did, stated plainly.
2. **The moments that support it** — quoted from the transcript, attributed.
3. **The moment that doesn't** — the counterexample.

**The third slot never folds.** Not at narrow width, not on a session that went well, not behind a
disclosure. It is what makes the output feedback rather than praise, and it carries the standing
requirement this instrument was built around — sensitivity at the low end. It has a fixed slot
precisely so it can't be quietly dropped, which means a layout that would collapse it is the wrong
layout. Per the standing required-vs-hidden check in `.claude/skills/product-design-review`: density
is fixed by fixing the container, never by hiding something required.

An all-high session says so once in slot 3 and stops. **Inventing a weakness to fill the slot is how
feedback stops being believed** — the honest fill is naming the nearest thing the session didn't do,
not manufacturing a failure.

### The departure sentence

One line under the level, present **only** when the level lands somewhere the four bands would not
predict, stating in one sentence what was read to get there — and pointing at something checkable in
the transcript or the assignment. When the level doesn't depart, it says nothing extra.

This is not decoration. Holistic scoring's documented failure mode is collapsing into an average of
the rubric rows, and without a stated residual the level is a mean wearing a name. The sentence is
also the better reliability target: agreement on the level is weak evidence if both coders simply
averaged; agreement on *what they read to depart* is the real test.

### The conversation prompt

The prescriptive material relocated out of the student report (see *Dimension bands*). Teacher-only,
the same treatment integrity flags already get, and the only block here in `--tau-tool-info` blue —
the tool authored it rather than measuring it, and it's the one thing on the surface a teacher
should feel free to discount against what they actually taught.

### Open — quoted student text has no treatment in the system

**A gap, flagged rather than improvised.** `designsystem.md` assigns `--tau-auditor` (violet) to
"the teacher's own words, quoted back to them" and `--tau-tool-info` (blue) to "the tool generated
this." Neither fits a **student's** words quoted from their own transcript: it isn't the teacher's
voice and it isn't generated, it's the primary evidence. The obvious move — reuse violet because
it's already the quotation colour — collapses exactly the distinction violet was introduced to
prevent, one layer down.

Per the Hard Constraints preamble (*"if a decision isn't traceable to a line here, it's a gap in the
system, not licence to improvise — say so and ask"*), this is stated and left open. The strawman
worth arguing about: **no hue at all** — a neutral quoted block with attribution and a hairline
rule, on the grounds that quoted evidence is measured material and this file's own colour table
already says a measured fact takes no voice colour. That would need a `components.css` atom, since
nothing there covers it.

---

## Global Search

**Replaces the old per-tab Student Sidebar search, 2026-07-28.** One search box, always visible at
the top of the persistent sidebar (not scoped to a "Student" tab that no longer exists), matching
students, classes, and assignments by name and showing up to a handful of each as a dropdown beneath
the box. Selecting a result **navigates away** — to that student's, class's, or assignment's detail
screen — which is the right behaviour when a teacher already knows exactly who or what they want.

This is a different job from Browse Students' own search box (see above), added the same day once
that gap was noticed: that one filters the roster **in place** rather than navigating anywhere,
which is what you want when scanning names rather than jumping to one. The two aren't merged into a
single control — "take me there" and "narrow what I'm looking at" are different intents even though
both start with typing a name.

See *Browse Students* above for the roster-level filter chips (All / Worth a chat / Missing work /
Patterns) — those replaced this section's old two-chip filter, and now include a genuine
`attention`-tier filter (the Patterns dropdown) that didn't exist before.

---

## Side Tray

Right-side panel (400px) that slides in when a teacher clicks "Learn more" on a submission flag. Contains:
1. Flag name + short description
2. **What this means** — plain explanation of the signal
3. **Why we flagged it** — the reasoning behind the detection
4. **Potential next steps** — numbered action items

Closes via `✕` or clicking the dimmed overlay.

---

## Visual Language

*Corrected 2026-07-27 — see the Flag System section above for the full reasoning; this is the
summary version. Colour system corrected again 2026-07-28 — see below.*

**Colour system — one signal colour, one alert colour, not two tiers of the same hue:**
- `--tau-caution` (amber) — every "worth a chat" signal, both tiers: pills, flagged sub-rows,
  behavioral-pattern cards. Never a glyph, never a dot (2026-07-28 — see below), never red.
- `--tau-attention` (terra/red) — reserved for exactly one thing: missing submissions on a closed
  assignment. The one real alert on this page, so it's the only thing that gets the alert colour.
- **Status chips — revised 2026-07-28.** `--tau-positive` (green) = Final, `--tau-neutral` = Draft
  in progress and on time, `--tau-attention` (red) = Draft overdue **with the chip's own label now
  saying so** (`Draft 2/3 · Late`, not just `Draft 2/3` in a different colour), `--tau-grey` =
  Not started. The in-progress state moved off amber — "on schedule" isn't a caution — and the
  overdue state stopped relying on colour alone to distinguish itself from an on-time draft chip a
  shade lighter, per the dot/colour rules below.
- **No colour-only carriers — added 2026-07-28.** `designsystem.md`'s Colour section now states
  this as a system-wide rule: alert-tier colour on a chip must match what the chip's own text
  claims, never substitute for text that doesn't say it. Beyond the checkpoint chip above, this
  moved the assignment Open/Closed chip, the reflection type badge, the pattern-card student-count
  chip, and `teacher.html`'s "Teacher" role chip off borrowed caution/attention tints onto neutral
  ones, and stopped the Change/score-delta columns from rendering an ordinary 1-point dip in
  `chip-attention` red (the number's own sign already says "down"; only genuine improvement keeps a
  semantic colour). The filter chips (`.stu-chip`/Patterns dropdown, described below) are the one
  place semantic colour on selection state stays — their own label text already names the filter,
  so colour reinforces rather than substitutes.
- **A third voice, not a new colour — the coaching note is `--tau-auditor` (violet), 2026-07-31.**
  This page had been using forest for the assignment aggregate panel's coaching note (reaching for
  forest's "system message" job), which meant "the tool describing data" (headers, the selected-row
  edge, stat tiles) and "the tool rendering a judgment" looked identical. `--tau-auditor` already
  exists in `designsystem.md`/`components.css` for exactly this second thing — the Auditor persona's
  evaluative voice, elsewhere shown to a student who invokes it (`.turn-auditor`, `.card-edge-auditor`)
  — so the coaching note reuses it rather than the palette gaining a fourth hue. Geometry copies
  `.card-edge-auditor` exactly: violet-tinted fill, squared (not rounded) on the ruled left edge, not
  just an accent stripe on white. The three-tier header/row/panel colour system above is unaffected —
  this is a fourth, orthogonal axis (*who's talking*), not a restyle of the hierarchy tiers.
- **A fifth voice needed a fifth colour — `--tau-tool-info` (blue, hue 205), 2026-07-31, same
  session.** The Assignment Detail timeline rebuild (see that section above) put two genuinely
  different speakers' words in violet at once: the teacher's own quoted `prompt`/`teacherNote` text
  (the goal card) and the tool's own generated synthesis (the per-draft "How they worked"/"How the
  class engaged" callouts). Both reaching for `--tau-auditor` conflated "this is what the teacher
  wrote" with "this is the tool talking," which is exactly the kind of single-voice collision the
  auditor colour was introduced to prevent in the first place — just one layer up. Fixed by giving
  the tool's own generated guidance a second, sibling hue: same lightness/chroma construction as
  `--tau-auditor` (`oklch(0.42 0.09 __)` in light mode), hue 205 instead of 300 — the same hue
  `--tau-band-2` already uses elsewhere, so it isn't a hue invented from nothing. Violet now means
  "the teacher's own words, quoted back to them"; blue means "the tool generated this." Caught while
  reviewing the artifact in dark mode, which surfaced a second bug at the same time: the artifact had
  copied `tokens.css`'s `@media (prefers-color-scheme: dark)` block verbatim, which auto-switches
  with the OS — wrong for an artifact, which always defaults light regardless of viewer OS setting
  and only switches on an explicit in-page toggle. Removed the media query; kept the explicit
  `:root[data-theme="dark"]` override for that toggle.

**Filter chips are muted by default, coloured only when active — added 2026-07-28.** Browse
Students' `.stu-chip` (All / Worth a chat / Missing work) and the Patterns dropdown button both
start neutral (grey border, `--tau-ink-soft` text) and only take `--tau-caution`/`--tau-attention`/
forest once selected. A real bug caught the same session: the chips originally had their semantic
colour class hardcoded on regardless of selection state, so "Worth a chat" and "Missing work" always
*looked* selected while the Patterns button (built afterward, correctly) looked neutral until
chosen — two different idioms for what should be one filter-control family. Fixed by keying colour
off an `.active` class plus `[data-filter="…"]`, not off a permanent chip-caution/chip-attention
class.

**Table header / selected row / expanded panel are three deliberate tiers, not one shared tint —
added 2026-07-31.** All three had been quietly sharing `--tau-surface-2`, so "this is the fixed
header," "this is the row you opened," and "this is what you opened" all read as the same weight —
literal content-hierarchy flatness, not just a colour nitpick. Corrected to a real three-step scale:
- **Header (anchor, heaviest, never moves)** — `--tau-surface-3` (was `-2`, shared with the panel
  below) plus a `--tau-line-strong` bottom border, so the one row that's always on top reads as
  structural chrome, not just another table row.
- **Selected/expanded row (second tier)** — `color-mix(in oklab, var(--tau-forest) 7%, var(--tau-
  surface))`, not a flat neutral wash. Reuses the exact fix `.sidebar-item.active` already needed
  for the same reason: a plain lightness-only tint is close to invisible in light theme: tinting with
  the brand hue itself gives a colour signal that survives in both themes, not a lightness difference
  some monitors won't render legibly.
- **Expanded panel (lightest tier)** — plain `--tau-surface` (white), no tint at all. It doesn't need
  its own fill to read as distinct — the two tiers above it already carry that signal, and the
  panel's own contents (stat tiles, `.dim-panel`, the coaching note) carry their own borders/shadow.
  A third tinted layer here was redundant, not informative.

Two bugs caught building this: `.drill` (`renderAssignmentAggregatePanel`'s own wrapper) had **no
CSS rule at all** — `padding: 0`, `background: transparent` — so the whole expanded panel rendered
flush against the table with no breathing room, which was the actual cause of an earlier "this looks
flat and cramped" complaint, not a spacing-scale problem. And `renderPersistedAggregateCard`'s
condensed dim-row/dim-badge were missing the `width: auto`/`150px` overrides the artifact they were
built from used, so the condensed badge rendered at full 150px width inside a narrower two-column
card and overflowed. Both fixed alongside the tier system above. `.origin-chip` was also renamed to
`.origin-pill` and its text forced to `--tau-ink` regardless of origin — it had been setting
`--tau-sage`/`--tau-ink-faint` as literal text colour, which is the exact contrast failure
`components.css`'s own origin-chip comment already warns against (colour lives in the fill and the
dot, never the label).

**Cards now carry elevation.** As of the 2026-07-27 pass, every card-shaped element on this page
(`.reflection-arc`, `.tbl-wrap`, the inline-styled Home boxes) has `box-shadow: var(--tau-shadow)`,
matching the depth/shape pass every other page in the app got on 2026-07-22. Dense list/row items
(`.sub-row`, `.arc-entry`, `.assignment-summary-row`, `.class-student-row`) deliberately stayed
flat — same tier as a table row elsewhere in the system, which also carries no shadow; as of
2026-07-28 all three compose `components.css`'s `.list-row-boxed` modifier for that chrome rather
than each defining its own border/surface/radius. (`.overview-card` — dead CSS with zero markup
consumers — was deleted the same pass.)

**Icons.** `icons.js` is now linked on this page. Both `✕` close buttons (flag modal, side tray)
and both disclosure chevrons (`.chevron` on assignment-summary rows, the reflection-details
triangle) use the shared `close`/`expandMore` SVG icons — the latter rotates 180° on open, the same
mechanism `.acard-disclosure-icon` uses elsewhere. Back-arrows, "View →"/"Report →" links, and the
sort-column `↑`/`↓`/`⇅` glyphs are still plain text — that's not a gap, it matches how every other
page treats those same elements. The coaching note's eyebrow label picked up the shared `chat` icon
2026-07-31 — the same glyph already used for "a teacher's note" elsewhere, reused rather than a new
one drawn for this — and the dimension-trend badges lost theirs (`▲`/`▼`/`●`) the same day; see the
*Assignment View* section above for why.

**"View full assignment →" is a real button, not a bare link — added 2026-07-31.** New
`.agg-link-btn` class, matching `.btn.btn-quiet.btn-sm` exactly (bordered, forest text, `--tau-
surface-2` hover fill) rather than the previous inline-styled coloured-text anchor. Applied
everywhere the link appears — `renderAssignmentAggregatePanel` and `renderClassDrillPanel` both.

**Motion.** Hover/state transitions use `--tau-dur-short` + `--tau-ease-standard`; the modal/tray
fade uses `--tau-dur-medium` — the same token pairing the rest of the app standardised on
2026-07-22. This page's transitions were still hand-picked literals (`0.1s`, `0.15s`, `0.18s`) until
the 2026-07-27 pass.

**SAMR badges:** fixed 100px width in submission rows, 110px in assignment summary rows. Plain
language leads (e.g. "Steering a little"), SAMR name rides as a subtitle only — never the primary
label, matching the report's own band-chip rule.

**Alignment:** fixed-width flex columns in all drill panels and assignment summary rows — layout is consistent regardless of content variation.

**Known debt:** `.signal-reason` (an 11px muted sub-line style, meant to sit under a student's name
in collapsed table rows) is defined in the page's CSS but has zero consumers anywhere in the current
markup — the "signal reason sub-line" behavior the original spec described for collapsed rows never
shipped, or shipped and was later removed without removing the rule. Same shape as the dead-CSS
findings logged repeatedly in `designsystem.md` — worth a `grep` before reaching for it, not
assumed live.

---

## `teacher.html`'s session view — needs a rebuild, flagged 2026-08-08

**Owner's verdict, direct: "I'm not sure where the session view for the teacher came from, but its
design is terrible."** Recording that here rather than in a commit message because it's the kind of
judgement that otherwise gets rediscovered from scratch in six months.

**Where it came from.** It predates this dashboard. `teacher.html` was the *original* teacher
surface from the Path B build — an assignment list plus a per-student detail page — and when the
sidebar-navigated triage dashboard was built alongside it (2026-07-28), the two were never
reconciled. The dashboard took over every job except two, and `teacher.html` kept running with its
original layout, unreviewed, on a page with no design doc of its own. That's why it looks like it
does: it isn't a design decision anyone made, it's the residue of one that was never revisited.

**What it does now.** As of this pass the teacher note is on the dashboard's own submission rows
(see the Session Log), so the transcript is the only thing left that this surface uniquely provides.
The link into it is relabelled `Transcript →` to say so.

> **⚠ SUPERSEDED 2026-08-21 — the transcript and its link are deleted.** `report.html` renders the
> conversations, so this view was a second, differently-designed telling of the same thing, reached
> by a link from the dashboard's drill panel that a teacher had no reason to expect would leave the
> page. Gone: the `Transcript →` link, `renderTimeline()`, the `<details class="transcript">` blocks
> and their CSS. **The dashboard no longer links to `teacher.html` at all** — this surface is now
> reachable only from its own roster, which sharpens rather than answers the question of whether it
> should exist. What it still uniquely holds is session-ready moments, the note editor and work
> episodes. The `teacher-detail` / `transcript` usage area is kept in `USAGE_SURFACES` so already-
> recorded rows keep their label; nothing writes it any more.

**Known problems, none of them fixed here:**
- No rail, no navigation, no way back into the dashboard except the browser's back button — it opens
  in a new tab specifically to paper over that.
- Its own duplicate assignment/roster list on load, which the dashboard already does better and with
  class scoping this page doesn't have.
- A "+ New assignment" affordance that is a text link reading "in the dashboard" — a control whose
  only function is to say it isn't a control here.
- The transcript itself is an undifferentiated wall of turns: no way to jump to a flagged moment, no
  filtering to student turns, no anchor from the submission you clicked in from. Everything the
  dashboard learned about surfacing the moment worth looking at is absent.
- `computeMoments()` (the "session-ready moments" strip) is a genuinely good idea stranded on a page
  nobody is meant to land on — worth salvaging into the dashboard rather than losing with the page.

**The decision to make, when this is picked up:** whether the transcript becomes a panel on the
dashboard's Student detail (and `teacher.html` is deleted), or stays a standalone reading surface
that gets a real design. The first is the direction the rest of this work has been going — one
surface, actions on the object. It was deliberately left out of the 2026-08-08 pass because it moves
real functionality between pages rather than re-siting a control, and wanted its own decision.

---

## Open / Future Work

*Updated 2026-07-27 — most of this list shipped in the `app/` port and was never checked off.*

- [x] Real data integration — `/api/teacher/dashboard` serves real `app/data/` records, mock generator retired
- [x] Submission detail view — the "Report →" link on every submission row opens `report.html?role=teacher`, full TAU + integrity flags visible
- [x] Assignment creation / management flow — lives on `teacher.html`, a separate surface this doc doesn't cover (see note below)
- [x] Sorting within assignment/class student lists — `sortTh()`/`assignmentSort`/`classSort`, by name or TAU total
- [x] Sorting within Browse Students — per-class, not cross-class (`browseSort`/`toggleBrowseSort()`), added 2026-07-28 alongside the per-class table split
- [ ] Export / print view per assignment
- [ ] Class-level SAMR trend over time
- [ ] Per-student comparison across assignments (growth view)
- [x] Teacher mode in the report — `report.html` shows the integrity flags panel when a teacher is signed in, student/assignment context in the nav
- [x] Per-draft due dates — `teacher.html`'s creation form, the server, and this dashboard are all checkpoint-aware now (see *Data Model*, 2026-07-28)
- [x] Real multiple classes — `classes` collection, `assignments.classIds`, a student can belong to more than one class (see *Data Model*, 2026-07-28)
- [x] Sidebar/IA rebuild — tab bar replaced with a persistent sidebar; Overview replaced by Home (pattern cards, not named students); Student tab's overview replaced by the standalone Browse Students screen (see *Navigation Model*, 2026-07-28)
- [ ] `teacher.html`'s "+ New assignment" form has no class picker yet — a new assignment defaults to every class the teacher has (`POST /api/assignments`'s `classIds` fallback); fine for a single-class pilot, needs a picker once a teacher actually has more than one class to choose between
- [x]/[ ] Class-level SAMR trend over time — addressed differently, not literally: Class View's new
  Trends column (2026-07-28) gives a plain-language pattern summary per assignment, deliberately not
  a time-series chart or sparkline (this page reads behavioral facts as short text+count everywhere
  else). A literal trend-over-time visualization remains unbuilt if one is ever actually wanted.
- [ ] Export / print view per assignment
- [ ] Per-student comparison across assignments (growth view)
- [x] **Assignment View aggregate redesign** — designed 2026-07-30, built 2026-07-31 (see *Assignment
  View* above). Turned out not to need new server-side aggregation as assumed at design time — the
  per-submission `pq`/`su`/`cs`/`oc` the client already had was enough for client-side trend
  classification; only `provenanceCounts` needed exposing. This is also the reference design for the
  *class*-level and *student*-level aggregate tiers described in the same section's three-tier
  framework — neither of those is designed yet, but should follow the same label-leads /
  trend-not-number / floor-ceiling / fixed-order rules once they are.
- [x] Class-level aggregate view (dimension trend across assignments, recurring cross-assignment
  patterns) — the "how do I need to teach differently" tier from the three-tier framework above.
  Built 2026-07-31, see *Class View*'s new "Class aggregate card" entry above.
- [ ] Student-level recommendation synthesis — Student View already shows longitudinal data; it has
  no "here's what to actually tell this student" recommendation yet. Related to the already-noted
  intra-draft growth reports idea (plain-sentence dimension growth, not a chart).
- [x] **Resolved 2026-07-31, not the way originally proposed — the tier-swap question above is
  moot.** This item used to propose swapping which surface got the full vs. condensed dimension
  breakdown (Browse Assignments' quick expand vs. Assignment Detail). Assignment Detail no longer has
  a condensed carry-over card at all — it's a timeline of per-draft snapshots now, each with its own
  full Overview + Distributions detail (see *Assignment Detail — a timeline, not a roster*). Browse
  Assignments' quick expand (`renderAssignmentAggregatePanel`) is unchanged and still the right place
  for a condensed, names-free glance.
- [ ] **Per-draft idea-origin mix still not carried over, post-build.** `assignmentProvenanceMix()`
  (student-born / synthesized / AI-born) renders once, assignment-wide, in the Assignment Overview
  card (via the shared `renderAssignmentAggregateContent()`) — but no per-*draft* origin mix exists in
  `renderDraftSnapshot()`'s Overview tab. Not a considered cut, both times: didn't come up during the
  timeline design session, and wasn't added during the 2026-07-31 build either. Worth deciding whether
  it belongs in "How the class engaged," its own third tab, or stays dropped at the per-draft level.
- [ ] **Draft-in-progress's "worth watching" note is still hand-written, not generalized, as shipped.**
  `renderDraftLive()` (built 2026-07-31) renders a fixed sentence — "submission timing and score
  varied together on at least one dimension" — whenever the previous draft had ≥2 completed
  submissions, rather than actually computing which pairing showed the strongest split. Matches the
  design-phase mockup's own worked example (early vs. late submitters vs. Calibrated Skepticism), but
  the real implementation never became metric-specific. Needs a decision: a repeatable check
  (submission timing vs. each of the four dimensions, surfacing whichever pairing showed the
  strongest split last checkpoint) or an accepted, permanently generic line.
- [ ] **Known debt — `.drill` vs. `.drill-panel` are two different "expanded panel" treatments for
  the same concept.** `renderAssignmentAggregatePanel`'s wrapper (`.drill`) is white/no-tint per the
  three-tier system above; `renderClassDrillPanel`/the submission-history panel (`.drill-panel`,
  older, used by Class View's expand and the student drill-through) is still `--tau-surface-2`. Both
  represent "you expanded this row" and currently disagree. Not reconciled yet.

**Scope note:** this doc covers `dashboard.html` only (the sidebar-navigated triage surface —
Home/Class/Assignment/Student/Browse Students). Assignment creation, per-student transcripts, and
teacher notes live on the separate `teacher.html` detail layer, which has no design doc of its own —
see `app/README.md`'s file map if you need to work on that surface instead.

---

## Session Log

*Added 2026-07-27. Going forward, log dashboard-affecting sessions here — same convention
`designsystem.md` uses for the rest of `app/`. Retroactive entries below reconstruct what's
already landed; write new ones going forward rather than editing history in place.*

**2026-08-23 — the dashboard and the report disagreed about the same draft, and the shim was why**

A tester reported "different report results between student and teacher." It was not a data bug and
not assignment-specific: **the two surfaces shared no inputs.** `report.html` renders
`analysis.reading` — the level and four bands `readSession()` codes off the transcript, the essay and
the assignment. `/api/teacher/dashboard` never sent `reading` at all; it sent `tau`'s retired 1–5
scores, and `dashboard.html` derived a level from `PQ+SU+CS+OC` bucketed at 17/13/9 and a band from
`round(score × 0.8)`.

**On the demo roster the two disagreed on most drafts, frequently by two rungs.** Maya's rhetorical
analysis draft 1 reads Transformative in the report and totalled 12, which the dashboard called
Reactive. Her poetry explication reads Passive with all four bands at 1; the shim showed PQ at band 4,
because `tau.PQ` reads 5 on nearly every transcript.

**The fix was plumbing, and the shim's own comment predicted it exactly** — "the callers already speak
bands, so nothing above this function changes when it goes." That held. The server sends `level` and
`bands` per submission (nulled, never defaulted, on anything the reading could not see);
`subLevel()` / `subBand()` replace the three derivation functions and compute nothing.

**What the shim's comment got wrong was the timing:** it said it would be deleted "when `scoreTAU`
lands," and every doc repeated that. `readSession()` is a *different function* — an LLM read that
never needed `scoreTAU`'s signature change — and it had been producing a real reading on every
submission for days while the dashboard drew a shim beside it. Worth remembering as a failure mode:
a stated blocker outlived the thing that was actually blocking.

**Free fix along the way:** a pending or failed draft used to render a "Passive" chip, because
`total()` of four zeroes bucketed to level 1. It now renders off-scale, which is what it is.

**Deliberately not converted:** the flag and signal detectors (score spike, "passive engagement",
the two reflection mismatches) still read the retired total via `legacyTotal()`, kept for exactly
that one reader. They are open item 3b above, their names are part of the flag system's IA, and half
the job leaves a row line contradicting its own "Learn more."

**2026-08-21 (later) — the drill panel's controls became controls, and the transcript went**

Three things, all in `renderDrillPanel`'s submission row.

**The row's actions were plain forest text, and the comment justifying that cited the salience
budget** — "enclosure is reserved for values that are both actionable and rare." **That test governs
values, not controls** (`designsystem.md`, *Signal salience budget*: "A value earns chip/badge/pill
enclosure only if…"). Applying a scan-priority rule for indicators to a row's actions is what left
four interactive things reading as the prose around them. Add note and Mark as followed up moved to a
`.sub-row-actions` bar at the foot of the card as `.btn-tertiary`; Report took `.btn-quiet` in place.
**Not `.btn-primary`** — that is the one primary move per *screen*, and this card repeats per draft.
`.btn` also gained `text-decoration: none`, which `<a class="btn">` had always needed.

**The level was orphaned by a spacer with nothing left to space.** It sat behind `<div
style="flex:1">` at the row's right edge — the remains of the dimension band pills deleted
2026-08-12. Moved back beside the row's other classifications. **A layout that survives the deletion
of its own content is not a layout decision any more**, and it read as one for nine days.

**The `Transcript →` link is deleted, along with the transcript it opened.** See the SUPERSEDED note
in *`teacher.html`'s session view*. The link was added to name what that surface uniquely provided;
the honest answer was that `report.html` already provided it.

**2026-08-21 — a teacher can retire a Worth-a-chat flag**

The triage question `patterns.md` opened with on 2026-08-10 is answered and built. Full rules in
*Flag UX rules*; what's worth keeping here is the reasoning that changed the design mid-session.

**The first design marked the STUDENT and expired the mark on a timestamp** — a mark held only while
no flagged submission was newer than `markedAt`, so a new draft's flag would raise the amber again.
It was rejected on the right grounds: a new draft's flag is *its own flag*, unrelated to the one that
was followed up, so there was nothing for a mark to expire *from*. Moving the mark down to the draft
deleted the whole expiry mechanism rather than simplifying it — the property the timestamp rule was
trying to reconstruct (the signal renews itself) falls out for free once the mark sits on the same
object the evidence does.

**The generalisation worth carrying:** when a derived signal needs a manual override, put the
override on whatever the signal's evidence is anchored to. An override at a coarser grain than its
evidence always needs a rule for when it stops applying, and that rule is always a guess.

Three copies of "does this student have a flag" were merged into `hasOpenFlagOn(sid, aid)` /
`hasOpenFlag(sid)` on the way through — the class meta line and two `flagTotal` computations each
had their own inline predicate, and only the shared one knows about marks.

**2026-08-18 — the viz layer got a lab, and then got worked on in it**

**`app/web/viz.js` and `app/web/viz-lab.html` exist now.** The four organisms came out of
`dashboard.html` (958 lines) under one rule: **nothing in `viz.js` reads app state.** Every function
takes a cohort, a flow or an array of readings and returns markup, which is what lets a lab drive
them from fixtures. The per-surface adapters that pick real students stayed behind. The host owes
`viz.js` exactly one thing back — `setFlowMetric(scope, key)`.

**`renderStudentTrace(a, studentId)` became `renderTrace(stageNames, bands, levels)`**, with a
five-line adapter keeping the old name. It was the only organism that reached for `draftSchedule()`
and `getSubs()`, which made the n=1 mark the one thing a lab could not mount.

**The lab is organised by SCREEN, not by chart** — and the first version wasn't, which was the
mistake worth recording. Four sections, one per organism, answered "how does Composition behave" and
could not answer the question actually being asked of it: "what will the assignment card look like."
Screens are how the product is read and how the work gets scoped.

**Three real defects the lab found in its first hour**, none of them reachable by clicking through
the demo app:
1. **Six classes `viz.js` emits were defined only in `dashboard.html`'s `<style>`** — `.agg-block-lbl`,
   `.agg-sample-note`, `.section-head`, `.section-summary`, `.pattern-body`, `.no-signal`. Any page
   mounting an organism with only `components.css` got unstyled markup. Moved to §17.
2. **`.card-tabs` / `.card-tab` were also dashboard-only**, so Movement's new tabs would have cloned
   a component instead of reusing it. Moved; one tab component now serves both.
3. **The lab itself asked for `--tau-font-sans`, which does not exist** (the token is
   `--tau-font-ui`), so every screenshot was rendering in the browser default serif. Found from a
   screenshot, not from a grep.

**What changed on the surfaces, in the order it was decided:**

- **Home mounts Movement twice** — agency alone, then the four dimensions behind tabs. See the new
  Hard Constraint: agency is not a peer of the four, so it does not belong in their selector.
- **The state word came off the selector and went into the finding.** `.trend-chip`, `.ts-*`,
  `.flow-state*`, `flowStateShort()` are deleted; `flowState()` survives because the finding needs
  the five states in prose. The Hard Constraint that required the chip to carry it is withdrawn.
- **The finding was rewritten three times**, and the sequence is the useful part: counts removed
  (the ribbons are the counts), then the dimension name removed (the tab says it), then the state
  label removed (the sentence already says which way it went), then rewritten as a span with both
  ends named. What is left is two sentences and a **What to try** that answers the state.
- **"Worth raising:" became "What to try:"** — the same `.pattern-try` component was carrying two
  labels, three places to two.
- **The closed assignment card in a class view is agency and nothing else.** It repeats in a list;
  it was carrying up to five charts and a paragraph.
- **The assignment detail page's summary is the movement.** Its old "summary" was
  `assignmentReadingCohort()` — the last closed draft — so the top of the page and the last block of
  the timeline were one reading printed twice, one of them mislabelled. This inverts
  "composition leads" for that surface only; the exception is written into `designsystem.md` rather
  than left to be rediscovered.
- **The dimension chart's proportions were aligned to the agency chart** — 26px bars to 18px, two
  hardcoded `11px` and one `13px` to tokens, 9px row padding to 5px. The grid columns already
  matched by construction. One deliberate mismatch left: the in-bar numeral stays `--tau-text-xs`,
  because 13px clips inside an 18px bar.
- **`.cols-2up`** — generalised out of `.home-cols-2up` for the per-draft blocks, as a **container**
  query rather than a viewport media query, because the columns care how wide their own box is.

**A hazard this session demonstrated twice.** Two large `python` range-replacements on `viz.js` cut
more than intended — one swallowed `FLOW_AXIS_TIME` and `FLOW_AXIS_ASSIGNMENT` (Home and the class
tab threw outright), the other left the entire copy layer duplicated, 147 stale lines. **Both were
caught by the same thing: a headless sweep of every screen × case in the lab, checking for throws
and for `undefined`/`NaN` in the output.** Neither was caught by `node --check`, and the second one
did parse. Run the sweep after every edit to `viz.js`, not at the end.

**2026-08-17 (fifth) — two facts about verifying this layer, worth keeping**

**There is no test suite in this repo, deliberately.** One was written this session and deleted the same
day — it was never asked for, nothing runs it, and the harness it needed (a `vm` with a stubbed DOM) is
fragile against any new global in `dashboard.html`. `designsystem.md`'s *Verifying visually* remains the
only verification convention here. Two facts came out of the exercise and are the reason for this entry:

**1. The demo seed cannot cover the case space, and this is measurable.** It contains **no band drop on
any student, on any assignment** — the highest-priority branch in `traceFinding()`. So driving every
screen against the seed exercises the app's wiring and says nothing about whether a finding is right.
The seed is a fixture for laying out screens; it is good at that and it is not evidence. To check a
case, construct the cohort that sits on it.

**2. `drawFlow` — the flow's actual geometry — is exercised by nothing.** `flowSVG` emits only a mount
div and pushes to `FLOW_PENDING`; the SVG is built after measure. So every "the flow renders" claim in
this log covers the mount and not one line of the node heights, the 2.5px floor, the off-lane, the
canvas sizing or a single ribbon path. Its failure mode is silent — a NaN coordinate makes a ribbon
vanish without throwing. **Anyone touching those constants should draw it at a narrow and a wide width
and look**, since nothing else will catch it.

Both were confirmed by running it before the suite came out: no NaN at 420/720/1200px, height driven by
the cohort rather than the width, and the 2.5px floor growing the canvas rather than clipping the last
lane. That held on the day. It is not guarded.

**2026-08-17 (fourth) — Trace: the n=1 mark, and the finding leads it**

The last piece of the display rebuild. Neither cohort mark works for one student, and the reason is the
same for both: **they encode a count.** A flow encodes it as ribbon width, so one student is four
ribbons of width 1; a distribution encodes it as segment length, so one student is one full-width
segment per row. What is left at n=1 is **position across a sequence** — a fourth mark, not a third
instance. It is still built from Distribution's atom (`.steps` at four pips, the discrete band reading),
which is what the constraint asks for.

**Rows are the four dimensions, columns are closed draft slots.** That axis is the one a single
assignment licenses. **Agency rides above as level chips, not a fifth row** — the same argument that
keeps Composition off the band panel: a level is a reading of the whole session, not a peer of the four.

**The finding leads; the grid is subordinate.** Asked for, and it is the right correction: a cohort chart
shows a *shape* a teacher reads a finding off, and a 4×N grid of one student has no shape — it asks them
to hunt through twelve cells. So `traceFinding()` writes one lead sentence and returns the index of the
row it is about, which the grid emphasises with the same weight-only `.is-focus` device `.dist-row.is-floor`
already uses. **Which finding leads is case-dependent, and every rung of the ranking is a rule settled
elsewhere:**

| Rank | Case | Why it outranks what is below it |
|---|---|---|
| 1 | A **drop** | The one per-student trend input the triage respec keeps ("dropped a band across drafts — an ordinal move, not a delta"). Largest drop wins; ties break on PQ/SU/CS/OC order so the same trace always leads with the same dimension |
| 2 | **Band 1 on the latest reading** | Absolute — "the behaviour is absent, not weak" |
| 3 | A **rise** | Only when nothing fell and nothing is at the floor; leading with good news over a floor buries the actionable half |
| 4 | **Cannot be compared** | A finding about the data, not the student |
| 5 | **Flat at the floor** / **flat at the ceiling** | Distinct, per `flowState`'s recorded correction — the same "held" is a Monday lesson at the floor and a non-issue at the ceiling |

**Two bugs found by testing the branches the seed cannot reach.** The demo seed contains **no drop at
all**, so the highest-priority lead would have shipped unexercised.

1. **A band label got case-folded** — `.toLowerCase()` on it printed *"the ai set the agenda
   throughout"*. This is the identical mistake `dimNote()` already carries a warning about, made again
   two hundred lines away from the warning. Every sentence is now built so the label sits verbatim, set
   off by an em dash rather than spliced mid-clause where its capital would need flattening.
2. **The flat branch claimed "the readings held across every draft" off one readable reading.** "Nothing
   moved" is a finding about the student; "nothing is comparable" is a finding about the data. A single
   dimension can be unreadable on a session the other three were read on (a zero on one dimension of a
   complete analysis), so the whole-trace readability guard upstream does not cover it — there is now a
   `none` branch ahead of both flat cases.

**Verified:** 15 synthetic cases covering every branch, plus 14 asserted ranking rules (a drop outranks
a rise *and* focuses the dropped dimension; band 1 outranks a rise; floor and ceiling stay distinct; an
unreadable middle stage is skipped rather than read as a fall and a recovery; no lead leaks
`undefined`/`NaN`/`null`; no label is case-folded). Plus the full 129-view sweep still clean, 219 classes
all resolving.

**2026-08-17 (third) — the retired totals came off the display; mounting Composition found a live bug**

The display vocabulary, not the measurement: every level and band is still the
`bandFromLegacyScore`/`samr(total())` shim until `scoreTAU`'s signature changes. What changed is that
no surface prints the shim's raw arithmetic any more.

**`bandChip(t)` took a 4–20 total right up to today**, which is what kept totals being computed on
surfaces that only ever wanted to name a level. It is now `levelChip(n)` — level ordinal or null — and
`latestLevel(subs)` gets one in a hop. Three call sites, all converted.

**The level's LABEL is now the SAMR name everywhere.** Roster rows printed "Steering a little" while
the Composition organism inches away printed "Augmentation" for the same reading. The 2026-08-12
reversal (*"SAMR leads … named, never numbered"*) had never reached `bandChip`, whose comment still
cited the pre-reversal rule. `BAND_PLAIN` is the gloss now, which is what `LEVEL_GLOSS` already was.

**Browse Students lost its Average column**, and it was wrong three ways at once: a total, a *mean* of
totals, and a level chip computed as `samr(that mean)` — a named level off an average of ordinals. The
sort comparator recomputed the same mean independently, so the two had to be kept in step by hand. Both
now read the latest readable session's level; unreadable sorts *below* level 1, never as a zero. The
header was `How they're using AI` — a question, not the content — and is now `Agency`.

**A draft slot now gets a Composition**, since a slot is one shared task. `flow: null`, because a slot
has no interior sequence — its movement is the assignment's flow one tier up, where the stages *are*
the slots. That is the optional-sibling seam doing its job: bars alone, no empty drawer.

**Mounting it there exposed a bug that was already live one tier up.** On a thin cohort the organism
printed `Most read at Modification` beside `1 read of 5` — a distribution claim off one student, which
Hard Constraints forbid explicitly. It reproduced on the shipped assignment card for any task most of a
class had not finished. The fix reuses `isSplit()`'s **two-per-group floor** and its recorded reasoning
rather than inventing a threshold, and splits what had been one message into two findings that route
differently: *we cannot see enough* ("1 of 5 have a readable session") versus *we looked and there is no
group* ("no two students read at the same level"). Also made the no-plurality copy scope-neutral — it
said "nobody who sat this assignment" while now rendering at a draft slot.

**Also gone:** the reflection arc's per-entry score (the strip's subject is what the student *said*; a
level beside each excerpt invited reading the reflection as the cause of the reading); the drill row's
raw `PQ 3 SU 2 CS 4 OC 3`; and the `score-delta` chip's bare total delta in a **`chip-positive` pill** —
semantic colour on a student's own score, which Hard Constraints prohibit outright. It reads
`Up a level` / `Back a level` / `Same level`, neutral in all three directions.

**`classAvgTotal()` deleted — zero callers.** Third time this file has turned up a retired chart's
helper still in place after the chart went (`sparklineSVG`, two duplicate render paths). The pattern is
the finding, not the function.

**Verified against the real seed, not fixtures.** Logged into the running dev server, pulled
`/api/teacher/dashboard`, and drove **129 views** through a `vm` with a stubbed DOM and the page's three
sibling scripts loaded for real: every screen, every class tab, every assignment, every student, every
drill panel expanded, every draft snapshot, all five Movement readings on both scopes, and all three
roster sort columns in both directions. 0 failures. Asserted absent: `/20`, `band-0`, the raw dimension
strip, `.sub-total`/`.arc-score`/`.dim-scores`, `undefined`, `NaN`, semantic colour on a level delta.
All 201 emitted classes resolve in a stylesheet. Level chips render only the four SAMR names.

**Still on retired vocabulary — one pocket, deliberately left whole:** the flag and signal COPY.
`FLAG_META`'s `score-spike` ("TAU score increased sharply"), `reflection-score-mismatch`,
`reflection-delta-mismatch` (named *Delta–Score Mismatch*), the flag tray's paragraphs, the signal
`reason` strings, and the drill row's `Score jumped +N points in M minutes`. Their detectors are gated
on `scoreTAU` and their names are part of the flag system's own IA, so rewriting half of it would leave
a line and its own "Learn more" disagreeing. One job, not a residue. **Note it is currently unreachable
in the demo seed** — no submission pair trips the spike threshold — so it rendered in none of the 129
views and is untested either way.

**2026-08-17 (second) — the organisms got their entry points; Home stopped carrying a second copy**

The split settled that morning was a naming of three organisms, not three components: in code only
**Distribution** actually had the shape. **Composition** took an assignment, and **Movement** existed
three times.

**What made Movement uncopyable was one line.** `renderFlowSelector` wrote its state through
`setClassTrendMetric(cid, …)`, so a surface with no class id could not call it — and Home, which is the
other room-scoped surface in the product, had grown its own pair (`renderLevelFlowSection` +
`renderDimMovementSection`) rather than being unable to render. **The scope is now a string**,
`'home'` or `'class:<id>'`, keyed into one `flowMetric` map. That is the entire coupling that stood
between one component and two, and every difference that remains between the two mounts is carried by
the axis object.

- `movementEntries(levelFlow, dimFlows)` builds the five readings once. The agency lede was previously
  **byte-identical in two renderers**; so were `DIM_WHAT` and the movement counts.
- **Home lost four disclosures and gained nothing hidden.** It is a trend-only surface that was
  collapsing four of its five primary readings — the standing required-vs-hidden check, failed on the
  one page where those readings *are* the page. The state word already rides on each chip, so the
  comparison across all five survives the condensation (`designsystem.md` Hard Constraints).
- **`try` was promoted into the entries.** Home's collapsed rows carried "Worth raising" and the chip
  strip would have dropped it, so it now renders under the chart on both mounts. The class Trends tab
  gains it; that is the consistency, not scope creep.
- `renderComposition(cohort, opts)` now matches `renderBandSection(cohort, opts)`, with
  `renderAgencyDistribution` reduced to a six-line adapter. **The disclosure only exists if the caller
  hands in a flow or the note explaining its absence** — the organism does not assume Movement.
- `gotoClass()` now deletes **one** key instead of clearing the map, since Home shares it.

**Net −140 lines.** Verified by running the extracted script in a `vm` with a stubbed DOM: both mounts
render, the empty-flow and null-dimension paths render, selection persists per scope and Home's
selection survives a class visit, all three Composition shapes render with the disclosure present only
when asked for, and all 24 emitted classes resolve in a stylesheet.

**2026-08-17 — the flow graduated to `components.css`; the organism split settled**

`.flow-*`, `.trend-chip*`, `.trend-block` and `.trend-cue` moved out of `dashboard.html`'s inline
sheet into `components.css`. They were written when the flow was single-surface (Home only); it now
renders on Home, the class Trends tab and the assignment card, and a second copy had already appeared
in `class-lab.html` — which is the placement rule's own trigger.

**Verified rather than assumed:** every class the dashboard's JS emits was checked against both
sheets — no viz class is unresolved, and both stylesheets are brace-balanced. Full render sweep clean,
flows still queue and draw.

**The atomic split, and why it is three organisms and not one.** Asked whether "current state + trend"
should be a single reusable organism. It should not, and the shipped app settles it: **both halves
already occur alone.** Home and the class Trends tab render Movement with no distribution beneath it;
an assignment with one closed draft renders the distributions with no flow. Binding them means
instantiating a component with half of itself suppressed — two components wearing one name.

So: **Composition** (levels), **Distribution** (four dimension bands), **Movement** (selector + flow).
Cards compose them; no organism assumes its sibling is present. Below them the inventory is already
right — molecules `.dbar`, `.comp-row`, `.dbar-key`, `.trend-chip` and the shared `.viz-row-head` /
`.viz-plot` grid; atoms `.dbar-seg`, `.comp-fill`, `.flow-state`.

**Still split across two files.** The flow's CSS is now a component; its RENDERER is not —
`drawFlow`/`flowSVG`/`mountFlows` and the geometry constants (`FLOW_NODE`, `FLOW_PLOT`,
`FLOW_TENSION`, `FLOW_OFF_GAP`) stay in `dashboard.html`. Colour, type and chrome are now a one-file
change; geometry is not. A `viz-flow.js` would close it, and would also be what lets `report.html`
use the same chart.

**2026-08-16 (sixth) — the composition and the flow were reading different cohorts**

**The bug.** `renderAgencyDistribution` and `renderAssignmentDimensions` read each student's **latest
completed submission**; `draftFlow`'s final column reads the **last closed draft**. Those are the same
set only when every student submitted every draft. Anyone who stopped earlier appeared in the bar at
their draft-2 reading and in the flow with no reading at all — **two charts disagreeing about the same
students, inches apart on one card**.

Reproduced by dropping two students' final-draft submissions from the seed:

```
composition (latest completed sub)  : … Not enough evidence = 0
flow last column (last closed draft): … not-enough        = 2
```

**The fix is structural, not a reconciliation.** `assignmentReadingCohort()` reads the last closed
draft, so **the bar IS the flow's final column by construction** — they cannot drift apart again,
rather than being two computations that happen to agree today. `assignmentBandNote` reads the same
cohort, so the coaching note cannot claim a number the bars don't show. Verified both directions:
agency composition against the level flow, and each of the four band bars against its own dimension
flow's last column.

**The section now names the draft it reads** — *"Agency, final"*, *"Dimension bands, final"*, with
`N read of M`. Without it, the excluded students are excluded for a reason the teacher cannot see.

**A consequence that needed its own fix: the off-lane copy became untrue.** That lane now holds
students who submitted nothing on that draft *as well as* students whose session was too thin to
code, and it said only the second (*"N sessions too thin to read this one"*). Grouping the two is
deliberate and already argued on Home's triage tiles — an overdue draft and an unreadable session are
the same finding, *you cannot see this student*, routing to the same conversation. The copy names both
causes now. **The lane keeps the name "Not enough evidence"** rather than being renamed, because that
vocabulary is fixed in `designsystem.md`'s Hard Constraints and is used product-wide; whether it is
the right name for a lane with two causes is a separate question worth asking.

**Where this leaves the component layer.** The bar family (`.comp-*`, `.dbar-*`, `.dist-*`, `.viz-*`)
is in `components.css` and is a real shared component. **The flow family is not** — `.flow-*` lives in
`dashboard.html`'s inline sheet and is already duplicated into `class-lab.html`. It now renders on
three surfaces (Home, class Trends, the assignment card), so by the placement rule it has earned
graduation to `components.css`. Same for `.trend-chip*` / `.trend-block` / `.trend-cue`, added today.
Until that happens, a change to the flow's look is a change in two files.

**2026-08-16 (fifth) — the class Trends tab condensed to one selector, one chart**

The tab was a full-height agency chart stacked on four collapsed dimension rows — roughly 520px for a
question that is singular. Now a five-chip selector (Agency, then PQ/SU/CS/OC in canonical order) over
one chart, defaulting to Agency. About 360px.

**Home's own rule already said this.** *"Four flows always visible would be four charts to compare,
and only one is ever the question"* — the selector is that rule applied to the whole tab rather than
to four rows inside half of it.

**This reverses the chip deletion made earlier the same day, and the reversal is not drift.** The
chips were deleted because of what they selected *between*: five line charts of means, where the chip
existed to ration a form that should not have been on the page at all. Selecting between five flow
diagrams is a different act — each is a legitimate chart, only one is ever being asked about, and each
needs the full card width to be readable.

**The state word rides on the chip, and that is what makes this a condensation rather than a loss.**
The four collapsed rows carried one genuinely comparable reading — *which* dimensions moved. Hiding
four charts behind an unlabelled selector would have thrown it away. On the chip, all five states are
legible at once and the chart answers whichever the teacher picks.

**A bug caught in review, and it was a repeat.** The first version keyed the chip's short state text
on `flowState`'s `key`, which returns `flat` for **both** plain flat and flat-at-the-ceiling — so
ceiling collapsed into flat. Floor and ceiling staying distinct is a correction this file has already
recorded once: the same "flat" is a Monday lesson at the floor and a non-issue at the ceiling. Keyed
on the label now. Ceiling stays neutral in colour, because it is not a gain.

**Home is unchanged** — it still runs `renderLevelFlowSection` + `renderDimMovementSection`. Whether
it should follow is a separate call: Home's four collapsed rows are its own reading, not a stack under
a chart.

**2026-08-16 (fourth) — open and closed assignment cards split on the denominator rule**

Design proposal: https://claude.ai/code/artifact/2f87980a-5b87-417c-9b90-e3380c71749a

**THE RULE, and it is the general one this page should have been using all along.** On an incomplete
cohort, show what has a **per-student denominator**; withhold what has a **per-class** one.

- *"Four students ran an extraction loop"* stays true whatever the other twenty do later. Adding
  submissions adds patterns; it never restates the ones already there.
- *"Calibrated Skepticism is the floor"* partitions all 24. With 15 in, the bar's shape is dominated
  by **who has not submitted yet** — it answers "how far through the window are we" while labelled
  "how did this class think".

**This replaces the caveat sentence shipped earlier the same day.** The open card used to render the
band bars under *"these bands describe them, not the class. Nothing about the room is settled until
the assignment closes."* Wrong on three counts: redundant with the denominator sentence beside it;
overstated, since the bars *are* real readings a teacher with 15 of 24 can act on; and not
actionable, on a screen opened precisely because the assignment is live. **A caveat under a
misleading chart is a weaker fix than not drawing the chart.**

**The open card** is now stat tiles, a two-count pace line, and behavioural patterns. The two counts
are deliberately separate facts — *submitted* is pace, *readable* is the denominator the patterns are
drawn from — and **both are scoped to the whole assignment, never to the live draft**: scoping
"submitted" to draft 2 while "readable" reads each student's latest session anywhere would print a
readable count *higher* than the submitted one. True, and unreadable as a pair.

**Patterns come from Layer 1, not the naming layer.** `assignmentPatternGroups()` aggregates
`sub.patterns` — the real turn-sequence detectors — exactly as `detectPatternGroups` does for Home,
scoped to one assignment. Building this on `detectTrends` instead would have replaced a distribution
of the dimension scores with a *relabelling of the same scores* (`patterns.md`, *The finding*:
`low-skepticism` **is** `avgCS < 2.5`) — a regression, since the bands at least show their
denominator. Five detectors fire today; six are dead pending AI-turn labelling; none is validated.

**The closed card at class scope is now a summary**: final agency distribution, final dimension
distributions, how they worked. **Each distribution opens onto its own trend.** The coaching note,
idea-origin mix and pattern list moved to the assignment's own page.

**`renderAssignmentAggregateContent` takes a `variant`** — `'summary'` for the class card and Browse
Assignments' drill row, `'full'` for Assignment Detail. One computation, two presentations. The
one-function-three-wrappers shape held while every caller wanted the same thing; it stopped holding
the moment the class card became a summary, and a `variant` is the cheap way to keep the computation
single rather than letting two functions drift into different readings of one assignment.

**Agency uses the composition form, not a fifth diverging bar**, and that is a claim about the
measurement model. The four dimensions are facets of one construct; the level is a reading of the
whole session. Making it a fifth row of the dimension panel would assert it is their peer. Different
claim, different instrument — while both still partition the same students on the same track grid
(`components.css`, *THE SHARED CHART GRID*), so a length means the same count in both.

**The trend disclosure sits on the block for agency and on each row for dimensions.** There are four
dimension flows because there are four dimensions, and exactly one agency flow. The cue is a labelled
row — *"How the class got here — 3 moved up, 0 moved back"* — not a bare chevron, which leaves a
teacher to discover what is behind it.

**Three empty states, because two of them are not the same nothing.** No readable session is a gap in
what we can *see*; readable sessions with no repeated behaviour is a real finding *about them*.
Neither earns the two-group scaffold, which was otherwise a section head, a caveat and two headings
wrapped around no content.

**Still open.** Assignment Detail renders `'full'` unchanged — what that page should actually carry
is the next conversation.

**2026-08-16 (later still) — the class overview's Trends tab moved onto the flow charts**

The last tier still running the retired arithmetic. `renderClassAggregateCard`'s **Trends** tab held
an arc line chart (one metric at a time behind a chip row, y-axis 0–20 or 1–5) and, below three
closed assignments, fell back to a three-column table of trend badges off a **mean delta**. Its
**Overview** tab's coaching note read off the same means.

**Home's two sections are now one pair of functions, used at both tiers.** The class tier asks
Home's question — *is this room moving* — of a narrower cohort, so it is the same two sections with
the stage axis swapped: `renderLevelFlowSection()` and `renderDimMovementSection()`, parameterised
by a `FLOW_AXIS_*` object that carries the decoder copy, because what a column *means* is exactly
what changes. Writing a second copy is how the two would drift into different readings of the same
thing.

**Movement leads here, unlike the assignment tier, and that is consistent rather than contradictory.**
A class is a *room*, and a room has no single task to land on — the same reason Home leads on
movement. An assignment is *one task*, which is why composition leads there. The rule is about the
scope, not the tier depth.

**The class tier gets the assignment axis Home is refused.** One room, everyone did the same
assignments, so a column holds comparable readings. `classFlow()` takes only **closed** assignments
in due order — an open one is a reading of whoever submitted early. A class stays a **filter** on
which submissions are in scope, never a rollup of per-assignment rollups: chaining the tiers that
way weights a student by how much they submitted.

**Column headers are due dates; the assignment names go in a caption.** Assignment names run to a
full sentence, and three as adjacent headers overlap into an unreadable band. The first fix was
truncation, which produced *"Rhetorical ana… / Historical con… / Bicycle mainte…"* — worse than the
collision, since it tells a teacher nothing. A date is short, unambiguous, and already the thing
that orders the axis; the names are stated once beneath the chart, in order, and every ribbon's
`<title>` still carries the pair it connects.

**Capped at the last four closed assignments** (`CLASS_FLOW_STAGES`). Past four stages the ribbons
stop being separable at card width. The cap is **stated in the section summary** — *"last 4 of 7
closed assignments"* — rather than silently truncating the term.

**Two empty-state strings asserted a count they never checked** — *"Students have one so far"*,
*"This class has one so far"* — both wrong when the count is zero. Reworded to state the
requirement, not the tally.

**Deleted:** `svgLineChart`, `showLineTip`, `hideLineTip`, `chartAttrStr`, `FINAL_METRICS`,
`finalMetricSeriesPoints`, `classAssignmentSeries`, `classSeriesOutlierNote`, `classDimensionTrend`,
`classTrendCohort`, `dimensionRowsFromCohort`, `dimensionTrendNote`, `TAU_DIMENSIONS`, the
`classMetric` state and `setClassMetric`, and the `.metric-chip` CSS. Also the entire
`renderTeachingSection` chain (`fleetDimensionTrend`, `fleetAssignmentSeries`, `seriesOutlierIndex`,
`dimensionStateLabel`, `teachingRowSignature`/`Changed`/`saveTeachingSnapshot`) — **defined but
never called**, Home's old fleet-wide "Dimension trends" section, which printed *"Averaging 2.1 of
5"*. There is no line chart left anywhere in `dashboard.html`.

**Still open — the student tier.** `renderStudentDetail` and Browse Students still print `13/20` per
submission via `bandChip`/`total()`. That is the one surface left on the retired scale, and it is the
next conversion.

**2026-08-16 (later) — the assignment tier moved onto bands and the draft flow**

Home's rebuild earlier the same day stopped at Home. Everything below it still spoke the retired
language, so the five places dimension data appeared on an assignment surface are rebuilt. Design
proposal: https://claude.ai/code/artifact/62a56595-c877-4451-9ba0-fbcbfb44c782

**What was there, and what each one broke.** (1) The dimension trend table — four rows of
name/badge/note off a draft-over-draft delta of the **mean** 1–5 score, rendering in three wrappers.
(2) The final Overview tab — `11.3 / 20` plus four mean dimension chips. (3) The final Trend tab —
one line chart per metric behind a chip row. (4) The per-draft histogram, whose own caption read
*"the number of students who scored that value (1–5)"*. (5) Four note generators phrased off
averages. A total, a mean of ordinals, a line through unmeasured gaps, and a band numeral on an axis
— one of each prohibition.

**THE STAGE AXIS HERE IS DRAFTS, and this is the one tier allowed it.** Home spans classes running
different work, so an assignment column would hold non-comparable readings. Here every student did
the same Draft 1, Draft 2 and Final, which makes a column a fair comparison by construction.
`draftFlow()` buckets on **closed** draft slots — a live or future draft is not a reading, and
padding the axis with one would put an empty column between two real ones. It returns null below two
closed drafts, which is most assignments, and that is the honest state rather than an error.

**COMPOSITION LEADS HERE, WHERE MOVEMENT LEADS ON HOME — and this is the decision most worth
arguing with.** An assignment is one task, so *where did the room land on it* is the first question
and a distribution answers it. Movement across drafts is the second question, and on a single-draft
assignment it does not exist at all. So the closed row carries the distribution and **opening it
reveals that dimension's draft flow** — one section, not two. A room has no single task to land on,
which is exactly why Home is the reverse.

**Open and closed stopped being different components.** They had been two functions selecting
between an Overview/Trend tab pair and a trend table. The difference was never a component: it is a
caveat on the composition claim. An **open** assignment gets no finding sentence at all — with
students still to submit, a headline would be a reading of whoever happened to be early, which is
self-selected and the most quietly wrong number the card could print. The bars still render, with
non-submitters reading off-scale on them. A **closed** one gets the finding, plus the two "how they
worked" notes (timing and conversation habits) that only a finished assignment can carry — both
counts, so both survived the scale change untouched.

**Four defects in the shared band helpers, found only by rendering them against the real roster.**
They were written for Home on 2026-08-15 and left dead; this change is their first caller, so none
had ever been exercised:

- `tipText`, `dbarRowLabel`, `dimNote` and `keyItem` all printed **"Band 1"**, which the same day's
  constraint forbids. The generic descriptor is now the whole label.
- `dimNote` lower-cased the per-dimension band label to fit it mid-sentence, turning *"The AI set
  the agenda throughout"* into *"the ai set the agenda throughout"*. Labels are quoted verbatim now
  and the sentences were reshaped around them.
- `bandsFinding` said **"No single floor this week"** — Home's word, from when Home was the only
  caller. An assignment is a task, not a period.
- **A "the room is split" claim fired on 1 student versus 0.** The test was "the two sides are
  within 6% of each other", which a near-empty row satisfies trivially. A split is a claim about two
  groups and now requires two on each side (`isSplit()`), shared by both callers.

**The post-render hook is no longer guarded on a screen name.** It was `screen === 'home'`, and
before that `.dbar` — which the flow diagrams removed, so it silently stopped matching and took
`initTips()` with it. Both failures were the same failure: a guard naming *where* the components
were rather than *whether* they are present. It now tests the DOM, and redraws on any `<details>`
toggle, since a chart in a closed row measures zero wide.

**Deleted:** `renderFinalOverviewTab`, `renderFinalTrendTab`, `renderFinalAssignmentSummaryContent`,
`assignmentDraftSeries`, `seriesArcNote`, `assignmentDimensionTrend`, `assignmentTrendCohort`,
`assignmentCoachingNote`, `assignmentEngagementNote`, `renderDraftHistogram`, `draftHistogramBins`,
`draftMetricValues`, `SAMR_RANGE`, the `finalTab`/`finalMetric`/`assignDraftMetric` state and its
setters, and the `.bar-chart-*` / `.dim-avg-*` CSS. The per-draft card keeps its two tabs —
Distributions is renamed **Dimension bands** — because a repeated card in a timeline is the one
place the length still costs something.

**Still open.** `svgLineChart`, `FINAL_METRICS`, `finalMetricSeriesPoints`, `classAssignmentSeries`
and `classSeriesOutlierNote` all survive because **the class tier still runs the arc line chart and
still prints `/20` on it** — `renderClassAggregateCard`'s Trends tab. That tier is the next
conversion, not this one. Bands here still read `bandFromLegacyScore`, the same shim Home ships
with, so every band on this page remains a band derived from the old ratio until `scoreTAU`'s
signature changes.

**2026-08-16 — Home rebuilt on movement; the flow diagram replaces both aggregate sections**

Home's two aggregate sections — *Students by level* (a composition strip) and *Dimension bands*
(four distribution bars) — are **replaced by flow diagrams**. Built in `dashboard.html` directly;
`class-lab.html` carries the same form on an assignment axis. Artifact for the design:
https://claude.ai/code/artifact/9d3b7bfe-bac5-4f98-b41b-e673bda396b1

**This reverses *"Home is a descriptive snapshot"* (2026-08-13), deliberately.** That entry sent
movement to the assignment tier because a snapshot was all the composition strip could carry. The
reversal came from asking what a teacher wants rather than what the section could show: *"is any of
this getting better"* was named as the thing most wanted and least supplied. A snapshot answers
"where does this room sit" and cannot answer "is it moving", which is the question acted on first.

**The four questions this page now serves**, in a teacher's own words and their own order — the
test for anything on Home is which one it helps answer:

1. Is the AI doing my students' thinking for them?
2. Which students have handed the thinking over?
3. Where does the class give up control?
4. Are they holding onto more of it than they were?

**Home's stages are calendar buckets, never assignments.** Home spans every class and they run
different work, so an assignment axis puts non-comparable readings in one column — the level reads
the assignment as an input (`tau-dimensions.md`, *How the overall is decided*). Time buckets ask
each student only about themselves, which survives the mixed scope. The assignment axis is correct
one tier down, where the task is shared; `class-lab.html` uses it.

**Why a flow diagram is allowed where a line is not.** A line asserts a rate of change through the
gap between two readings and nothing was measured in that gap. A ribbon asserts only membership:
these N students held this reading, then that one. Every mark is a real count on a real day. That
is how it clears the no-sparkline constraint rather than bending it.

**What the form buys that two compositions cannot: churn.** "12 up, 5 back" is true of a class that
moved together and of a class that split in half. Only the ribbons separate them. The old trend
table had to disclaim this in its own caption — *"not how many individuals moved"* — which is the
signal that the form was wrong, not the copy.

**Vertical position is the scale.** Strongest reading at the top, so a rising ribbon means more of
the student's own thinking on every diagram in the product. Identity is carried by a legend, never
by labels down both sides: the band labels are full sentences and printing them twice squeezes out
the ribbons. An explicit y-axis was built and then removed — the legend already states the order.

**Dimension rows now carry a state word, not a distribution.** Five states — improving, declining,
flat, flat (floor), flat (ceiling) — derived from movement counts, never from a mean. Floor and
ceiling stay distinct for the reason they always did. Opening a row reveals that dimension's own
flow, which is where the per-dimension chart belongs: four flows always visible would be four
charts to compare, and only one is ever the question.

**Band labels are per dimension — sixteen of them, and a teacher never sees a numeral.** The
generic descriptors (*didn't happen*, *not where it counted*, *there with gaps*, *held up*) are the
**scale**, not the label. Band 2 means the wrong claims for Calibrated Skepticism and the wrong
edits for Selective Use. Full set in `designsystem.md`, *Dimension band labels*.

**Movement counts first reading to last, per student — never a sum of per-transition moves.** A
student who drops and recovers is not two events. Students at "not enough evidence" on either end
are counted separately as *can't be compared*: there is no prior reading, and folding them into
"held" is the same error as scoring a thin session band 1.

**Layout: each chart gets its own full-width row.** The 2-up pairing went with the snapshot. It
existed because both sections were a single stacked bar and the pair read as one object; a flow
needs horizontal room per stage, and the two stopped being halves of one reading — one is where the
room is, the other is what moved.

**"Missing checkpoints" is deleted as a card.** It rendered under an eyebrow reading *Behavioral
patterns* while its own comment said it was not one, and the separation it relied on — *"its
attention-tier count and its wording rather than different chrome"* — cannot work, because a
section heading outranks the copy inside a card. Its count moves to the tiles, grouped with the
other gap in the read under **"No read on them yet"**: an overdue draft and a session too thin to
score are the same finding — *you cannot see this student* — and route to the same conversation.
Relabelled to describe the student rather than the system: *Sessions too thin to read*, *No draft
submitted*.

**Two bugs found and fixed in the renderer, both worth keeping as notes:**

- **A scaled `viewBox` magnifies type along with geometry.** `width:100%` on a 640-wide viewBox in
  a full-width card is a ~1.4× zoom, so 12px counts rendered at 17px and the whole chart read as an
  oversized infographic. Charts here are drawn at 1:1 from the measured width and redrawn on resize
  — and on `<details>` toggle, since a chart in a closed row measures 0 wide.
- **A Sankey node needs two cursors, not one.** A middle column's node is a ribbon *target* in the
  transition arriving at it and a *source* in the transition leaving it; one shared cursor means
  outgoing ribbons start from the bottom of the node and cascade off the canvas. Presented as a
  clipping bug; it was a correctness bug.

Also: the post-render hook was guarded on `el.querySelector('.dbar')`, which the flow diagrams
removed — so it silently stopped matching and took `initTips()` with it. Guard is on the screen now.

**Still open.** The four dimensions read `bandFromLegacyScore` off the 1–5 ratios, so every band on
this page is a shim until `scoreTAU`'s signature changes. `flowState`'s floor/ceiling thresholds
(>0.5 of the readable cohort) are guesses. `FLOW_BUCKETS = 3` is a guess. `renderCompHTML`,
`levelComposition`, `bandDistributions`, `bandsFinding`, `dimNote`, `dbarMarkup` and `keyItem` are
now dead code, left in place for the class and assignment tiers.

**2026-08-13 — the band distribution built and settled; Home defined as a snapshot**

Built `app/web/dashboard-lab.html` (Home only; `dashboard.html` untouched, excluded from the image
by `.dockerignore`'s `app/web/*-lab.html`). Three findings worth keeping:

1. **The band chip palette is not a chart palette**, and it is measurable: all four `--tau-band-N`
   backgrounds sit within 0.005 of each other in lightness, and bands 2↔3 are ΔE 1.4 apart. A chip
   shows one band at a time; a distribution shows four at once. Replaced with an ordinal ramp on
   hue 242 — see *Dimension bands* for why a diverging pair is unavailable in this system.
2. **Home is a descriptive snapshot.** Asked directly what a teacher needs from this section, the
   answer drew the line: Home says what the room looks like *now*; movement needs a fixed baseline
   and belongs to the assignment tier, where draft 1 → draft 2 is a real comparison. Recorded under
   *Band distributions at the class and assignment tiers*.
3. **The finding leads.** Three of the four rows usually look alike, so the section states which
   dimension is the floor and how big it is, with the distributions underneath as the evidence.

Two defects the rendered screenshot caught that no amount of reading would have: band 1 rendering as
an unlabelled sliver (the band the instrument is most required to detect), and the off-scale label
sitting in a far right-aligned column where a shorter bar read as "fewer students" rather than "more
we couldn't read." Both fixed. Deliberately *not* added, to keep Home descriptive: per-row links to
the students, and any movement figure.

**2026-08-12 — respec'd for the band/level scoring model (documentation only, no code)**

Prompted by asking what the settled scale in `tau-dimensions.md` does to this page. The answer was
larger than a scale swap: roughly a third of `dashboard.html` is arithmetic with no inputs under a
model that has no total and no mean — `total()`/`/20` everywhere, all five Tier-2 signal conditions,
the fleet cards' "Averaging 2.1 of 5", the mean-based outlier notes, the per-draft line charts.

**The reframe, in the user's own framing:** counts per level and per band say more than an average
did — *"most of your students are X"* rather than *"scoring 2.6."* The dashboard stops reporting a
position on a scale and reports the composition of a room plus the evidence under each student.

Sections added: *The unit of every aggregate*, *Triage queue inputs*, *Students by level*,
*Dimension bands*, *Band distributions at the class and assignment tiers*, *Evidence on the teacher
surface*. *Purpose* rewritten with three prohibited operations and the modal-claim headline rule.
Superseding notes left on the arithmetic sections rather than deleting them — the reasoning in the
floor/ceiling distinction and the trend-not-a-number rule is what the band version inherits.

**Three decisions worth finding again.** (1) **Triage stays first on Home** — leading with
composition was the stronger argument on paper and was turned down deliberately; the paragraph
recording why is under *Home*. (2) **The cohort-relative bottom-decile rule is retired** — on a
four-value ordinal, percentile is mostly ties and the absolute floor does all the work, so band 1 is
the flag. (3) **Triage volume is uncapped**, with the wording turning over past a proportion so a
class-wide problem gets louder, not quieter — the direct answer to `patterns.md`'s objection.

**Two things this un-blocked and one it blocked.** `detectPatterns` moved onto the critical path
(three of four Home pattern cards lose their detectors entirely). The *What to try* gap open since
2026-08-08 is now fillable, from the other end — `tau-dimensions.md` moves the instruction register
off the student report and onto this surface. And `draftHistogramBins()` turned out to be the one
place the change *reduces* work: it already bins on bands, buried in one tab of one screen.

Left open on purpose: the proportion at which the triage copy turns over, and a treatment for quoted
student transcript text (neither violet nor blue fits — stated as a system gap, not invented).

**2026-08-10 — Home rebuilt onto toned section bands, two columns, and no page header**

Prompted directly: the condensed Home "is very flat with the content hierarchy — every section is
white and we have no visual way to highlight key information." Designed as two Claude artifacts (a
proposal doc, then a full composed screen with live toggles) before any code, same precedent as
Assignment Detail and the add-flow modals.

**The diagnosis, which was not what it looked like.** Three sections shared `.pattern-card`'s exact
chrome, and *Classes at a glance* re-implemented that chrome inline — but the root fault was that
`.content` is `--tau-surface`, i.e. **white cards on a white pane**, with a 1px hairline and a soft
shadow carrying the entire card boundary. Proximity was barely encoded either (10px between cards,
24px between sections). And `tokens.css` already ships a four-rung ladder — `bg` / `surface` /
`surface-2` / `surface-3` — of which Home was using two.

**An industry scan settled the method and reversed two decisions made before it.** IBM Carbon's
layering model (base → layer-01 → 02 → 03, light themes alternating white ↔ grey), Material 3's
switch from shadow-based to tonal elevation, and Polaris' rule that dividers belong to data and
index tables all converge on the same answer: **separate with ground, not with lines or more
shadow.** That killed a first proposal to rule each section head. Linear's unread state vs.
Datadog's Change Overlays killed a second — see the change-marking note below.

What shipped in `dashboard.html`:

- **`.home-band` — one band per section**, not per group of related sections. A shared band is a
  Gestalt common region, and a region claims its contents belong together; that's true of neither
  {tiles, patterns} nor {dimensions, classes}. Four bands. Page-sheet rather than `components.css`
  because it is layout on a single surface today — **promote it the moment a second surface wants
  one**, per the placement rule.
- **`.home-cols` — Dimension trends and Classes at a glance side by side**, 1.45fr / 1fr with
  `align-items: start`, stacking below 1200px. Asymmetric deliberately: equal widths, or bands
  stretched to equal height, would assert that a *metric readout* and an *entity index* are a matched
  pair inviting row-to-row comparison. They aren't, and there is no correspondence to find.
- **No `.content-header` on Home.** ~70px of pane to say "Home" — which the rail's active row already
  says — and the date, which the OS clock says. Other screens keep theirs; `renderFirstRun()` keeps
  its "Welcome".
- **Classes at a glance is rows, not cards** (`.class-row`). Every other card on Home expands in
  place; these navigate, and identical chrome for two behaviours was the affordance failure. The
  chrome now carries the rule — cards expand, rows go — plus the two channels the app already owns:
  forest (interactive text, one of its six jobs) and a trailing `→` (14 existing uses, all
  navigational). **The roster count came off the row**: a number belongs where its size changes the
  finding — a pattern touching 12 students outranks one touching 2 — and a class's headcount never
  does.
- **The disclosure chevron is gone**, all four call sites. It rendered at 10px, below
  `--tau-text-xs` (11.5px) and so off the type scale entirely, which is why it read as debris. Cost,
  stated plainly: a collapsed card no longer announces that it expands until hover, and `→` is now
  the only affordance marker on the page. If that needs reversing the fix is `icons.js`'s
  `expandMore` at a real size, not the 10px glyph.
- **Card hover moved to `--tau-surface-3`, scoped to `.home-band`.** On surface-2 the old surface-2
  hover made a white card *dissolve into its own band* — a defect the band change would have shipped.
  Same direction `.rail-item:hover` already takes on that identical ground.

**One real bug, caught in a browser rather than by reading the code.** The Behavioral patterns
denominator read **"1 of 8 students"** regardless of the data: `detectTrends()` pushes
`{ student, classes }`, so `t.students.map(s => s.id)` was `undefined` for every entry and the Set
always collapsed to size 1. Now `s.student.id` — reads "6 of 8" against the demo seed. Pre-existing,
unrelated to the layout, and invisible until the header it sits in was being looked at directly.

**Deliberately not done, all still open:**

- **Change marking is untouched.** `.f-updated` still renders "Updated" in `--tau-tool-info` — blue
  for a *computed fact*, which inverts what Hard Constraints says that hue means, and this page's own
  colour table already routes a second computed fact to white/hairline/tabular. The proposed
  replacement is a **fixed comparison window** (`▼ 0.3 vs. …`) rather than an unread marker: unread
  state is an inbox pattern needing an event stream and a read receipt, and `TEACHING_SNAPSHOT_KEY`
  is a localStorage signature that disagrees across devices. Open question is the window — calendar
  ("last week") vs. the cohort's own unit (the previous draft), which is what
  `dimensionRowsFromCohort()` actually pairs. Retiring the snapshot is a data change, not a CSS one.
- **Exception-first Dimension trends** (one card for the dimension with a finding, the steady ones
  collapsed into a panel of expandable rows) was designed and not built. It reopens the 2026-08-08
  tier removal; the distinction argued is that what got rejected was *a measured average on
  tool-info blue ground*, not tiering as such. Note the collapsed rows must stay `<details>` — every
  dimension carries a `note` from `dimensionTrendNote()`, and a first pass that flattened them into
  plain lines silently lost three explainers.
- **The stat tiles navigate and carry no cue either**, same open question as the class rows did.
- **The signals band has no `.eyebrow`** and can't accurately get one — every tile names itself, and
  "Alerts" / "Needs attention" would name a priority tier, which the label rule forbids. Note also
  that "alert" is reserved vocabulary here: terra/missing-work is the alert, "worth a chat" is not.
- **This document's own *Home* section still lists five stat tiles.** `renderHome()` emits one or two
  (Worth a chat always, Missing work only above zero). Stale text, not a missing feature.

Verified in a real browser (Playwright, installed to the session scratchpad — none was available in
most earlier passes, hence their "worth a live check" caveats): logged in as `teacher@school.dev`
against the running dev server and seeded data, confirmed four bands, the 639/441 column split at
1440px and the stack at 1150px, three class rows each with an arrow and no count, zero chevrons, zero
`.content-header`, no horizontal page scroll, card hover distinct from its band, a class row actually
navigating to Class detail, and no console or page errors.

**2026-08-08 — Home condensed: collapsed finding cards, and the colour rule that fell out of it**

Feedback that Home is "a lot of data." The volume was never the number of findings — it was that
every finding's prose rendered permanently open: 343 words across four pattern cards, plus up to
four teaching cards under them. Both sections are now one collapsed `.pattern-card` per finding,
detailed under *Patterns worth noticing* and *Dimension trends* above.

Four rounds of correction shaped it, each worth keeping because each was a rule the first attempt
broke:

1. **Not a table.** The first draft put the findings in a shared list with a column header over the
   numerals. Wrong object: these are distinct findings scanned as a set, not one record type in a
   grid. Cards, with their existing chrome, and the body folds — that's the whole change.
2. **A number needs context.** A bare "3" in a column is a number the reader has to decode. Once it
   went back to a card the fix came free: the count sits in the phrase that names its unit, weighted
   inside that sentence, with the denominator in the section head.
3. **The explainer is not the tool talking.** The draft folded "What this looks like" and "What to
   try" into one blue region. But the explainer *describes the measurement* — tinting a definition
   makes it read as an opinion. Blue marks the recommendation and nothing else. Now written down in
   *Colour: measured vs the tool talking*, because getting it wrong is easy and the existing Hard
   Constraint doesn't say where the voice starts.
4. **Meaning → action → evidence → exit.** The draft led an open card with the outlier measurement,
   making a teacher read evidence for a claim they hadn't been given yet. The link also moved inside
   the evidence box: the sentence names the assignment, the link goes there, nothing in between.

Two things this surfaced rather than caused. The shipped teaching cards had a **measured average on
a tool-info-blue ground** — backwards under the rule above, in live code, not just in the draft. And
`renderTeachingSection()` has no authored *What to try* copy at all, which is why dimension cards
ship with no blue: four recommendation strings are a content task, flagged above, not something to
invent in a layout pass. Class View's own patterns panel was converted to the same card in the same
pass — it shares `.pattern-card`, and it was a second, always-expanded rendering of an object Home
already had a shape for.

**2026-08-08 — demo relics: "Worth a chat, explained" into the account menu; Browse Students roster
formatting**

Four changes, all prompted by looking at the running roster rather than this doc.

*"Worth a chat, explained" left the header.* It was built to show a demo audience how signals get
labelled and had been sitting as a standing header button beside `+ Add` ever since — reference
material a teacher reads once, holding a slot next to the page's primary action. It's now an item
in the shared account menu. That menu is built once in `api.js`, so rather than dashboard.html
rebuilding it, `mountAccountChip(el, { extras })` takes `{icon, label, desc, onClick}` items and
renders them with the navigation destinations. The now-orphaned `.hdr-div` separator went with it.

*Roster columns line up across classes* — see *Browse Students* above for the colgroup.

*The band stopped being the smallest text in its row.* `bandChip(avg, true)` was inlining
`font-size:10px`, so "How they're using AI" — the row's most important sentence — rendered smaller
than the 11.5px uppercase column header above it. `.band-plain` now inherits its container's
font-size at weight 500, which is what it should have been since it lost its chip chrome and its
pip: it is plain text, so it is sized as text. Call sites that want it small still say so.

*Every signal shows.* See the reversal note under *Signal levels*. Left open, flagged in passing:
with fill and pip both gone, `.band-plain`'s only remaining channel is text colour, and band-2 vs
band-3 are near-identical dark teals that also read as links. Not addressed here.

**2026-08-08 — object action menus: one system with "+ Add", and the creation flows held to the
same standard**

Prompted by a review of every function a teacher has and how many turns it takes to reach each one
(traced through the running code, not this doc). The finding: creation was centralised in a clean
three-door `+ Add` menu, and *every other verb* was scattered — roster edit behind a button on Class
detail, assignment edit five turns deep and only on Assignment detail, the student note and
transcript on a different HTML page reached by an 11px link, and rename/archive/delete/move not
built at all. The `+ Add` menu had a greyed-out "Rename or archive a class — not built yet" row and
a footnote explaining where roster removal lived: both were the menu apologising for an IA gap.

The follow-up prompt was the more important one — *"it feels like we have two different systems of
functionality and I want to make sure it's cohesive."* Right, and the answer is that they aren't two
systems, they're **one axis**: is there a subject on screen for this action to hang on? No — the
thing doesn't exist yet, so it's `+ Add` in the global header, labelled and primary. Yes — it lives
on the object, same corner of every `.content-header`. What makes them read as one family rather
than two menus is the pairing: **a create action that needs a subject appears globally with a
picker and on the subject without one.** "Add students" in the header asks which class; "Add
students" on a class's own menu doesn't. Same item, same wording, same submit path.

- **`objActionRow()`** builds the row; `mountObjActions()` re-binds `tauMenu` after every
  `renderContent()` (which replaces `#content` wholesale, taking the previous panel's listeners with
  it). Class detail keeps "Manage roster" inline and gains a scoped *Add to <class>* group (Add
  students / New assignment) plus *Manage* (Rename / Archive). Assignment keeps "Goal &
  requirements" inline, menu holds Edit / Duplicate / Delete. Student had no actions at all before;
  it now has Move to another class / Grant extra replies — the latter surfacing a server route
  (`grant-replies`) that had existed with no UI anywhere.
- **The group label only renders when a panel holds more than one kind of action** — so the class
  menu shows *ADD TO AMERICAN LITERATURE* / *MANAGE* and the other two show no labels. The menus
  differ where the objects differ and nowhere else.
- **Archive, not delete, for a class** — `POST /api/classes/:id/edit` takes `{ name, archived }`,
  `teacherScope()` filters archived classes out of every roster/rollup in one place, and assignments
  scoped only to archived classes go with them. **Archiving without an un-archive path would have
  been a one-way door**, so the rail's Classes group grows an `Archived · N` row (only when N > 0)
  opening a restore list. `archivedClasses` is sent as its own key, never merged into `classes`,
  because everything on this page derives counts from that list.
- **Delete for an assignment refuses rather than cascades** — `POST /api/assignments/:id/delete`
  works only while no session or submission exists, and names what's in the way ("1 draft has already
  been submitted to this assignment"). The append-only integrity record is the point of the tool;
  retiring work that's been used is what archiving a class is for.
- **Move a student is composed client-side** from the two calls the roster route already has, add
  before remove — a failure halfway leaves them on two rosters (visible, fixable) rather than none.
- **`+ Add` lost its greyed-out row and its footnote.** Both existed to explain absences that now
  have real homes. Its three emoji (📄 👤 🗂) also became `icons.js` SVGs — `icons.js` had existed
  unused beside them, which meant two icon systems across the two menus that are meant to read as
  one thing.

Creation flows, same pass, same standard:
- **First run was reporting the opposite of the truth.** A teacher with no classes saw "✓ All
  students on track" above an empty class list — a false status report at the exact moment they most
  need to find the create menu. `renderFirstRun()` replaces Home in that state and names the first
  door. This also settles, without re-arguing it, why the picker's order (ranked by content weight,
  2026-08-03) doesn't need reversing for day one.
- **One error system, not two.** The blocking `alert()` chain is gone — including the one still
  telling teachers to open "Customize schedule & coaching," a disclosure deleted months earlier. The
  form also gained `novalidate`: the `required` attributes stay for assistive tech, but the browser's
  native bubble is off, so every failure reports the same way.
- **One success shape.** New class already confirmed in-modal with scoped next actions; New
  assignment fired a header toast and Add students wrote an inline line. All three now use
  `modalSuccess()`. The `.assign-toast`/`.btn-flash` CSS and `flashAssignToast()` were deleted rather
  than left dead. The per-class roster modal deliberately keeps showing its updated roster instead —
  there the evidence *is* the confirmation, and a success view would hide it.
- **Escape and the scrim.** No modal on this page closed on Escape; a stray scrim click discarded
  everything typed in the longest form in the app. One `MODALS` registry now handles both, and a
  `dirty()` check means an untouched form still closes instantly while one with content in it asks
  first.

**Four bugs caught by a headless browser (Playwright), not by reading the code:**
1. **Escape didn't close the action menu.** `tauMenu` listens on the *panel*, so it only hears
   Escape when focus is inside it — true when the menu was opened by keyboard, never when opened by
   mouse. Every mouse user's Escape was landing on nothing, and had been since `tauMenu` shipped.
   The page-level handler now falls through to `closeAllMenus()` (and the side tray) after modals.
2. **Native `required` bubbles were still firing**, so the form had two error systems again — the
   exact thing the inline errors were meant to end. Fixed with `novalidate` plus explicit checks.
3. **The inline error scrolled out of view.** Parked at the submit button, focusing the offending
   field left a highlighted box with no explanation of what was wrong with it. The single message is
   now *moved* to sit under the field it names.
4. **The success view appeared minutes late.** Confirming after `loadDashboardData()` meant the
   teacher watched an unchanged form for as long as `/api/teacher/dashboard` takes to walk every
   student × assignment × submission. Confirmation now happens on the POST response, refetch after,
   and the submit button says "Creating…" while in flight.

Verified against the live server: rename, empty-name rejection, archive (class drops out of
`classes`, appears in `archivedClasses`), restore, assignment delete, and the delete guard firing on
an assignment with a submission. Test class and four test assignments were deleted from Firestore
afterwards, same as the 2026-07-31 and 2026-08 passes did.

**The teacher note moved onto the submission row, same session.** It had been the least findable
function a teacher had — six turns, ending in a second surface in a new tab. It now sits on the row
it's about: an `Add note` / `Edit note` action beside `Report →`, opening the shared small modal, and
an existing note renders inline on the row in the same `.card-edge-auditor` treatment the
assignment-wide note already uses. `teacherNote` is sent on each submission in the dashboard payload
so the row can both show it and prefill the editor without a second round trip; the save posts to the
same `/api/submissions/:id/note` route `teacher.html` uses, so both surfaces stay in sync through the
one record. Saving an empty note clears it, which the modal's subtitle says.

**Still open, deliberately not done here:** the transcript remains on `teacher.html` — now the only
thing that surface uniquely provides, and its link is relabelled `Transcript →` to say so. That page
is separately flagged for a rebuild; see the *`teacher.html`'s session view* section above.

**2026-07-28 (evening) — colour-tier violations, decorative dots, component-library alignment**
Prompted by a specific bug: the overdue-checkpoint chip (`Draft 2/3`) and a real "missing work"
alert rendered in the identical `chip-attention` red, with nothing in the checkpoint chip's own
text saying "missing" — colour alone was carrying the alert on what read as a purely positional
label. Fixing it properly meant writing the rule down first (`designsystem.md`'s Colour section,
see that doc's own session log for the two new rules), then auditing this page and `teacher.html`
against it, which surfaced a wider gap: both pages had drifted out of sync with `components.css`
since the 2026-07-21 Atomic Design pass explicitly deferred auditing them. Full pass:
- `checkpointStatus()` — overdue label now reads `Draft 2/3 · Late` (colour reinforces text
  instead of substituting for it); on-time drafts moved off `chip-caution` onto `chip-neutral`.
  Same fix pattern applied to the assignment Open/Closed chip, reflection type badges, the
  pattern-card count chip, and the Change/score-delta columns (a routine 1-point dip no longer
  renders in alert red — the sign already says "down").
- Every decorative dot removed: the tray header, both `.flagdot` wrappers, `.signal-pill-review`'s
  `::before` circle, and the sidebar's per-row trailing dots (see *Navigation Model* above) — none
  of them had a legitimate case once checked against "no adjacent text already carries this."
- A real bug: this page's own `.stat-tile`/`.stat-tile-val`/`.stat-tile-label` CSS was silently
  overriding `components.css`'s canonical version by reusing the same class names — deleted, Home
  now renders from the one definition.
- Known-debt chrome deduped: `.list-row-boxed` (new `components.css` modifier) absorbed three
  independently-built bordered rows (`.class-student-row`, `.assignment-summary-row`, `.sub-row`);
  the flag-explainer modal's interior now composes the same `.tray-*` classes the side tray two
  elements below it already used, instead of a byte-for-byte local copy; `.stu-chip`/`.chip-dd-btn`
  and `.arc-badge`/`.reflect-type-badge` merged; nine local uppercase-label reinventions adopted
  `.eyebrow`; `.back-link` replaced with `.btn .btn-quiet .btn-sm`; dead `.overview-card` deleted.
See `designsystem.md`'s matching session-log entry for the full file-by-file detail (it also covers
`teacher.html`/`teacher.js`, out of this doc's scope). Verified live, Playwright, both themes,
console clean throughout.

**2026-07-28 (same day, follow-up) — Browse Students split into one table per class**
Prompted directly: the roster's IA wasn't clear enough about which students belonged to which
class, and a teacher couldn't sort one class's students without the whole cross-class list
reordering under it. `browseRosterRows()` (one `<table>`, `.group-row` divider rows between
classes) replaced with `browseRosterTables()` — a genuinely separate `table.roster` per class,
each with its own `<thead>` and independent sort state (`browseSort[classId]`,
`browseSortState()`, `toggleBrowseSort()`, `sortBrowseStudents()`), reusing `sortTh()` with a new
optional `groupId` param rather than forking it. Search/filter/pattern-selection logic
(`browseRosterMatches()`) untouched — those still scope across all classes at once; only sort
became per-class. Verified live (`node app/server/index.js`, Playwright): 3 separate
`table.roster` elements render for the 3 seeded classes, sorting one class's header only sets
`.sort-active` on that table, the other tables' sort state is untouched, console clean.

**2026-07-28 (same day, follow-up) — Browse Students in-roster search**
The IA rebuild's Browse Students screen shipped with filter chips and a Patterns dropdown but no way
to just type a name and narrow the roster in place — the sidebar's global search existed, but it
navigates away to a single student rather than filtering the screen you're already on, which isn't
the same job. Added `#browseSearchInput` → `setBrowseSearch()`, composing with the existing filter
chips/pattern rather than replacing them, updating only the table body so the input doesn't lose
focus mid-keystroke, resetting on fresh navigation into the screen. See *Browse Students* and
*Global Search* above for the two searches' distinct jobs.

**2026-07-28 — Full IA rebuild: sidebar navigation, pattern-first Home, shared roster rows, real
classes**
Prompted by the same failure mode surfacing again despite the 2026-07-28 dimension-column pass
earlier the same day (see below): the four-tab structure meant "who needs attention" logic was
independently recomputed in four places (`getStudentSignal`/`hasMissingCheckpoint` had 13+ and 10+
call sites respectively, no caching), so a fix in one tab kept not reaching the others. Rather than
patch that again, worked through the actual navigation and screen design directly with the product
owner across a live interactive mockup, landing on a different shape than a pure code refactor would
have produced. Shipped, in order:

1. **Real class modeling** (`app/server/store.js`, `seed-data.js`, `seed.js`, `index.js`) — a
   `classes` collection and `assignments.classIds` replaced the single class the API used to
   synthesize for every teacher. Seed data now has two real classes (a 5-student main class, a
   2-student elective sharing two of the same students) plus a third one-student class so the
   one-off "bicycle maintenance guide" demo assignment has a real scope instead of defaulting to
   "every class" and planting a false "missing" row on rosters it was never actually assigned to —
   caught and fixed by looking at the live Class detail screen, not by reasoning about the seed data
   in the abstract.
2. **Signal computation centralized** — `getStudentSignal()`/`hasMissingCheckpoint()` wrapped in
   memo caches, invalidated at the one place the four global data arrays get reassigned
   (`loadDashboardData()`).
3. **One shared student-row data function** (`studentAssignmentRowData()`) feeding two renderers —
   a `<table>` row (Assignment view) and a compact flex row (Class view's inline expand) — so the
   same student's row is guaranteed identical content in both places, confirmed by literally diffing
   the two on screen rather than assuming the refactor was equivalent.
4. **Navigation shell rebuilt** — tab bar replaced with one persistent sidebar (search, Home,
   Classes, Assignments, three bounded Students shortcuts); see *Navigation Model* above for the
   full reasoning, especially why Students isn't enumerated the way Classes/Assignments are.
5. **Home rebuilt** around behavioral-pattern cards instead of named students, with Missing
   checkpoints kept as a visually separate card (logistics, not a pattern).
6. **Browse Students** introduced as the new full-roster screen, with a muted/active filter-chip
   system and a Patterns dropdown at a looser (≥1) threshold than Home's (≥2) card threshold.
7. **Class View, Assignment View, Student View** columns reworked per the sections above (Next
   draft due, Trends-not-a-bar, Draft split into its own column, multi-class panels).
8. Two real bugs caught only once live in a browser (not from reading the code): the orphaned guide
   assignment issue in (1), and the Student-detail signal-pill column (80px, sized for "Worth a
   chat") overlapping the status chip once longer pattern names ("Passive engagement") started
   rendering there too — widened to 150px.

Verified against live data (`node app/server/index.js`, Playwright screenshots, both themes, console
clean) rather than by inspection alone — see the two bugs in (8), neither of which would have been
caught by reading the diff.

**2026-07-28 — IA/complexity pass: dimension columns cut, "Overview" naming collision fixed**
A lead-UX pass over this page (IA, content design, usability, run against the live `dashboard.html`
and this doc) flagged two issues, both fixed: (1) the Assignment-view roster's collapsed row rendered
raw PQ/SU/CS/OC columns, violating this doc's own "detail on demand" principle — cut, table now goes
Student / How they're using AI / Total / Change / Worth a chat, dimension scores still live in the
drill panel; `colspan` on the group-row and drill-row updated 9→5 to match. (2) The three per-tab
sidebar landing items were all labelled "Overview," colliding with the dashboard's own Overview tab —
relabelled "All classes" / "All assignments" / "All students." State variable values (`'overview'`)
untouched, copy-only change. Two other findings from the same pass were deferred pending a product
decision, not implemented: the `attention` signal tier has no discoverable surface outside a single
student's drill panel or a ≥2-student rollup card (no filter chip, no pill anywhere else); and flagged-
student lists inside Class/Assignment overview cards have no cap, so a class with many flagged
students renders unbounded nested rows in one card.

**2026-07-28 (same day, follow-up) — Missing submissions made actionable, then re-scoped as an IA fix**
First pass: made the Overview tab's "Missing submissions" stat tile clickable (previously display-
only) and gave it a real destination — a new "Missing submissions" section on the Assignment tab's
overview page. Corrected the tile's underlying count in the process: it had been summing non-
submitters on **open** assignments, which is "Not started" per the *Language rule*, not "Missing."
Second pass, prompted by explicitly thinking through the three-way Open/Closed/Missing IA before
shipping it: the new section duplicated every affected assignment's card a second time (once under
"Missing," again under "Closed"), and the sidebar had no equivalent at all — two navigation surfaces
on one tab disagreeing about the taxonomy. Reverted the standalone section; Missing is now a sort
priority + `.dot-attention` red dot within the existing Closed group, in both the sidebar and the
Overview page, with a "· N need follow-up" count on the Closed header. One taxonomy (Open/Closed,
matching the actual status field) instead of three parallel ones. See *Assignment Overview* and the
new sidebar-dot note above for the specifics.

**(retroactive) 2026-07-20 — real data + visual rebuild (`designsystem.md` session 6)**
Mock generator replaced by `/api/teacher/dashboard`. Inline `<style>` block retokenised onto
`--tau-*` (0 legacy names, 0 hex). The `.samr-badge` four-colour blue ramp and a bespoke avatar/
sparkline were retired; the Class- and Assignment-detail tables were rebuilt onto a new
`table.roster` component. Caught and fixed the first half of the terra→caution voice-rule
violation (see 2026-07-22 below for the second half) and renamed "Flag detection" → "Worth a chat,
explained." Full write-up: `designsystem.md`, session 6 entry.

**(retroactive) 2026-07-22 — chip/dot/tray dedup, teacher.js voice fix**
`components.css` gained a shared `.chip`/`.dot`/`.stat-tile`/`.tray`/`.list-row` layer; this page's
independently-built equivalents were rewired onto it. Found and removed a leftover `⚑` glyph in
`teacher.js`'s cycle chip — the same mistake session 6 had already fixed on this page but hadn't
been carried to the other teacher surface. Full write-up: `designsystem.md`, 2026-07-22 entry.

**2026-07-27 — depth/shape/motion/icons parity pass**
This page was the one surface the 2026-07-22 depth/shape pass explicitly skipped ("never touched at
all... stayed completely flat while the student surfaces moved"). Closed that gap: `box-shadow`
added to every card-shaped element, literal transition durations replaced with `--tau-dur-short`/
`--tau-ease-standard` tokens, `icons.js` linked and wired to the close buttons and disclosure
chevrons. No colour or IA changes. Verified live across all four tabs, the flag modal, the side
tray, and a reflection disclosure, both themes, console clean. Full write-up: `designsystem.md`,
2026-07-27 entry.

While verifying this pass against the live page, corrected a large amount of drift in this document
itself that had nothing to do with the pass's own changes — the flag-colour model, the signal-pill
behavior, the Assignment view's columns, and an entire undocumented Overview tab (with its
Behavioral Patterns cross-student rollup) had all drifted from what originally shipped. See the
inline `*Corrected 2026-07-27*` notes throughout this doc for the specifics.

**2026-07-28 — per-draft due dates, full pipeline**
Prompted by the prior "Missing" IA work exposing a gap: an assignment isn't one deadline, it's a
sequence of draft checkpoints each with its own due date. Research first (`store.js`, `seed.js`,
`app.js`) found the schema already modeled this (`draftDueDates[]`, `draftBudget`, sequential-gated
`cycleIndex`) but nothing used it — the teacher creation form collected only one due date, and
`/api/teacher/dashboard` sent neither `draftDueDates` nor `cycleIndex`. Shipped the full pipeline
(scope decision made explicitly, not assumed): (1) `teacher.html`'s "+ New assignment" form now
collects one due date per draft slot instead of a single overall date, validated ascending
client-side; the last slot's date doubles as the assignment's due date, matching the schema's own
invariant. (2) `POST /api/assignments` validates and stores `draftDueDates`, deriving `dueDate` from
the last entry rather than accepting it separately. (3) `/api/teacher/dashboard` now sends
`draftDueDates` per assignment and `cycleIndex` per submission. (4) `dashboard.html`: replaced
`submissionStatus()` (open/closed × has-any-submission) with `checkpointStatus()` and
`hasMissingCheckpoint()` — checkpoint-aware, checking the *next unreached* draft slot's own due date
rather than the assignment's. This surfaced and fixed three latent mislabeling bugs that pre-dated
this session, all the same species (calling "hasn't submitted yet" "missing" when it was just
early): the Overview tab's "Missing submissions" tile (was summing non-submitters on **open**
assignments), the Overview tab's per-open-assignment card in the right rail (same bug, separate code
path), and the Class Overview card's per-assignment submission line (used `--tau-attention` red for
"not everyone's submitted" on an open assignment, a non-alert state). All three, plus the Assignment
roster's collapsed-row status chip, the Class-view drill panel's row ordering/red-tint, and the
Assignment/Class sidebars' dot + sort-to-top, now run through the single `hasMissingCheckpoint()`
check — and consequently, all of them can now correctly show "missing" on an **Open** assignment, not
just Closed. Verified against live data: the seeded "Persuasive essay" assignment is Open (final due
2026-08-01) with Drafts 1–2 already overdue for several students — exactly the scenario driving this
work. Full-file syntax-checked (`node --check`) after each stage; server restarted to pick up the API
changes.

**2026-07-30 — sidebar IA: one primary destination per section**
Prompted by a live-usage complaint: Closed assignments enumerated in the sidebar right alongside
Open, on track to dominate the rail as a term goes on; separately, the Students group showed three
count-shortcuts (Worth a chat / Missing assignments / Browse all students) as visually-equal
siblings even though two of them are filters of the third. Recognized both as the same underlying
gap — no single section had a declared "this is the destination, these are filters of it" hierarchy
— and fixed both with one shared pattern rather than two bespoke ones (see *Navigation Model*
above for the full writeup). Built new: a **Browse Assignments** screen (`screen: 'assignments'`,
`renderBrowseAssignments()`), reached via a demoted sidebar link, listing every assignment
(name/classes/due/status/students/missing/worth-a-chat) with All/Open/Closed chip filters and a
name search — same shape as Browse Students, including reusing `.stu-chip`'s `data-filter`-keyed
active-colour idiom (added two rules for `open`/`closed`, neutral-tinted since status isn't a
severity). Restyled `.sb-shortcut` with an indent and smaller `.sidebar-item-name` so demoted rows
read as nested under their primary row without a new component. This reverses the 2026-07-28 call
that there'd be no "All assignments" landing page — reversed for the same reason Browse Students
exists at all: an enumerated list stops scaling once it grows, and Closed just reached that point.
Verified: full inline `<script>` block parses clean (`new Function(source)`), server serves
`dashboard.html` with a 200. No headless browser available in this environment, so the visual
result itself (row spacing, chip colours in both themes) has not been screenshotted — worth a live
check before calling this settled.

**2026-07-30 (same day, follow-up) — Assignments corrected to match Students exactly**
The pass above still enumerated `Open` assignments directly in the sidebar, reasoning it was
"bounded and actionable like Classes." Flagged as inconsistent with Students, which enumerates zero
individual names — corrected to the identical shape: **All assignments** is now the primary sidebar
row (opens Browse Assignments unfiltered), **Open** is demoted sub-nav beneath it (same screen,
`open` preselected via `gotoAssignments('open')`). Removed the sidebar-local `assignmentItem()`,
`assignmentIsMissing()`, and `byMissingThenOrder()` helpers entirely now that nothing enumerates
per-assignment rows in the rail — individual assignments are reached by clicking a row inside Browse
Assignments (or from a Class detail page), never from the sidebar directly, matching how individual
students were already reached. `gotoAssignments()` now takes a `filter` argument the same way
`gotoStudents(filter, patternId)` does. Verified the same way as above (script parses, server 200);
still no browser screenshot taken.

**2026-07-30 — Browse Assignments chips get the brand fill; Class View's flat hierarchy fixed**
Two fixes from a live screenshot. First: the assignments-page filter chips' active state used the
same neutral tint as everywhere else and was nearly invisible — `all`/`open`/`closed` aren't
severities (no amber/red to reuse), so they now get the app's one solid brand fill instead
(`background: var(--tau-forest); color: var(--tau-on-forest)`, the same idiom as `.btn-primary`).
`review`/`missing` keep their caution/attention colours unchanged. Since `.stu-chip[data-filter=
"all"]` is shared with Browse Students, that screen's "All" chip picked up the same fix as a side
effect — it had the identical washed-out problem.

Second, from the same screenshot: Class View's assignment table read as flat because its Open/Closed
group header (a plain `.eyebrow`) and every row's own status caption beneath it said the exact same
thing in the exact same muted grey — a duplicate the page had that Assignment Detail and Browse
Assignments didn't, both of which already color-code Open/Closed with a `chip-neutral`/`chip-grey`
badge. Removed the per-row caption; the group header now carries the status once, as that same chip
— consistent encoding instead of a third, weaker treatment invented for this one table (see *Class
View* above for the full writeup, including the added group-to-group rule and the bolded Final due
column). Deliberately did **not** use forest green for the Open/Closed chip even though the ask was
"make the color pop" — forest is locked to four jobs (interactive text, primary fills, meter fills,
the system-message rule) and a passive status label isn't one of them; reused the existing
taxonomic chip pair instead, which is a consistency fix, not a new colour decision. Verified: script
parses, server 200; no browser screenshot available in this environment.

**2026-07-30 (same day, follow-up) — Class View row optimization, and the seed data's real bug**
Follow-up feedback on the pass above: drop the group header's "N assignments" caption entirely
(replaced with the group's own due date, see *Class View*), drop the standalone Final Due column,
and split the combined "Next draft due" cell into two — a plain `x/n` Draft column and its own Due
column. `classNextDraftDue()` now returns `{ stage, budget, due }` instead of a pre-formatted
"Draft n/N"/"Final" string, so the row can render `${stage}/${budget}` directly. Net column count
unchanged (6 → 6: −1 for Final Due, +1 for splitting Next draft due), so no drill-row/group-row
`colspan` changes needed.

The fourth ask — "4/5 submissions, 2 missing doesn't reconcile" — turned out to be two separate bugs,
not one. **Bug one, data staleness:** `upsertAssignment()` computed `draftDueDates` from signed day
offsets (`tsOffset`, e.g. draft 1 due `-1` day) relative to whenever the assignment was first seeded,
then returned the existing row untouched on every later server start — so the intended "one overdue,
one due soon, one comfortable" narrative decayed into "everything overdue" as real calendar days
passed without a full reseed (confirmed against the actual data: seeded ~Jul 24, so by Jul 30 both
the draft-1 *and* draft-2 due dates the demo needed to read as "past" and "due soon" respectively had
both already lapsed, right down to the earlier screenshot's Open-assignment row misleadingly reading
"5 missing" for a 5-student class). Fixed by having `upsertAssignment()` refresh `draftDueDates`/
`dueDate` from the same relative offsets on every server start instead of freezing them at first
creation — self-healing from now on, no manual reseed needed. Left submission/session timestamps
untouched (they don't feed the overdue calculation, so refreshing them risked new inconsistencies for
no benefit). **Bug two, a metric definition:** the "Submissions" column counted anyone with *at
least one* submission, which is a different axis than "Missing" (still owes a checkpoint) — a
student on 1 of 3 drafts counted as both, which is exactly what produced "4/5 submitted, 2 missing"
on the Rhetorical analysis assignment even with correct dates (Luis: 1 submission, so counted
"submitted"; still owes 2 more overdue drafts, so also counted "missing"). Redefined "Completed" (renamed
from "Submissions") to require every checkpoint done (`subs.length >= draftBudget`), so Completed +
Missing now always sums to the roster once an assignment is closed. Verified against live seed data
after a server restart: Persuasive essay (open) now reads 3 submitted-something/2 missing with none
double-counted as complete yet (correct — it's still open); Rhetorical analysis (closed) now reads
3/5 Completed, 2 missing, and 3 + 2 = 5. Full inline `<script>` parses clean, `seed.js` passes
`node --check`, server restarted and serving 200.

**2026-07-30 (same day, follow-up) — Browse Assignments now expands, doesn't navigate**
Raised directly: clicking a Browse Assignments row jumped straight to Assignment Detail, a real
page change, while Class View's visually identical assignment table expands in place for the same
click. Two tables with the same chrome behaving differently on click is the kind of inconsistency
this pass keeps finding and fixing one surface at a time. Fixed by reusing `renderClassDrillPanel()`
— the same drill panel Class View already uses — passing `studentsFor(a)` (every student across all
the assignment's classes) instead of one class's roster, since Browse Assignments spans classes.
Added `expandedInBrowseAssignments` state and `toggleBrowseAssignmentDrill()`, following the same
container-patch pattern as the screen's existing sort/search toggles. The "View full assignment →"
link inside the panel (unchanged, part of `renderClassDrillPanel()`) is now the only path from this
screen to the full Assignment Detail page. See *Browse Assignments* above for the full writeup.
Verified: script parses, server 200.

**2026-07-30 (same day, design session — no code) — Assignment View redesigned as a teaching tool,
prototyped as an artifact, not yet built**
Started from a live question: "is student-level detail even valid inside the assignment view, or
should there be a mid-level summary first?" That led to a three-tier framework applied for the first
time in this doc — class / assignment / student, each answering a different teaching question, each
with its own kind of flag (see *Assignment View — planned redesign*, above, for the full table). The
assignment tier is the one designed all the way through this session.

Iterated entirely in a published artifact (three states: All assignments / expanded / clicked open),
not `dashboard.html` — nothing here is shipped. Went through several real corrections, not just
polish passes: (1) the first expanded-row design still listed individual students, which turned out
to just be a shrunk copy of the roster table, not a real second tier — revised to zero names below
the full roster; (2) the replacement content (draft-over-draft TAU dimension movement, idea-origin
mix, a coaching note) initially led each row with a change badge instead of the dimension name —
wrong per the dataviz skill's own stat-tile contract (`label → value → delta`), corrected to
Dimension → Change → Movement → Note; (3) that same pass exposed that "+0.0" was being treated as
one fact when it's actually two — flat at the floor (a real problem) vs. flat at the ceiling (already
mastered) — now two different badge treatments, deliberately not sharing the "improving" green; (4)
raised directly that an average can hide a split group, so every row now shows a range alongside its
mean, and the worked example's Selective Use dimension was rebuilt specifically to demonstrate it
(a "+0.4 average" sitting on a 1.0–4.2 range, called out in the row's own note rather than left for
the reader to notice). Also added: the full assignment roster now persists a condensed version of
this same aggregate context (so clicking through to names doesn't erase the reason you clicked), and
gained Browse-Students-style filter chips (All / Missing / Worth a chat / Improved / a pattern chip)
scoped to one assignment — "Improved" is a new filter dimension with no Browse Students equivalent,
flagged as needing explicit confirmation before it's built for real.

No server-side aggregation for any of this exists yet (TAU scores per submission, never rolled up
across drafts or across a class) — see the Future Work checklist above for what building it for real
requires.

**2026-07-30 (same day, second follow-up) — dimension-movement design confirmed: trend replaces the
number, order goes fixed**
Two more corrections, both landed as the final shape rather than further iteration. First: raw
scores and ranges (e.g. "2.3 → 2.8," "range 1.0–4.2") were dropped entirely — on a 1–5 scale
averaged across 2–3 students, a decimal average implies more precision than the sample supports, and
it's the trend direction that actually informs a decision, not the digit. Replaced with a plain
four-state badge (Trending up / Trending down / Flat (floor) / Flat (ceiling)) — floor and ceiling
stay two distinct states rather than collapsing into one "flat," for the same reason established
earlier the same day (identical "no movement" means opposite things at the two ends of the scale).
Whatever the numbers used to convey — a split group, a genuine floor — now has to be said in the
note's own words instead; the worked example's Selective Use row still flags its split group, just
in a sentence instead of a range. Second: row order changed from "sorted by what needs attention" to
fixed — always Prompting Quality, Selective Use, Calibrated Skepticism, Original Contribution, the
app's own canonical order for this quartet everywhere else it's listed. Reasoning: a teacher checking
this across many assignments over a term benefits more from a stable, learnable position per
dimension than from a ranking that reshuffles based on that one assignment's results. Design is now
considered **settled** for this tier — the *Assignment View — planned redesign* section above and
its Future Work entry were rewritten to state the confirmed shape directly rather than narrate the
iteration that produced it. Still nothing built in `dashboard.html` or server-side; build from that
section's spec when this tier is implemented.

**2026-07-31 — Assignment View aggregate tier built**
Implemented the settled design from the two sessions above. Server: one field added to
`/api/teacher/dashboard`'s submission payload, `provenance: analysis.tau.provenanceCounts` — already
computed for OC scoring, never previously sent to the client. Client, all new in `dashboard.html`:
`assignmentDimensionTrend()` (cohort = students with ≥2 `analysisStatus: 'complete'` submissions;
pending/error submissions carry a `0` placeholder score and were excluded rather than counted as a
real zero), `assignmentProvenanceMix()` (each student's latest complete submission only),
`assignmentCoachingNote()` (templated from the same trend/skewed flags the rows show, never a claim
the rows don't back up), `renderAssignmentAggregatePanel()` (Browse Assignments' expand — replaces
what had been a call to `renderClassDrillPanel()`, deliberately **not** touching Class View's own use
of that same function, which stays a per-student list since it's already scoped to one class),
`renderPersistedAggregateCard()` (Assignment Detail's condensed carry-over), and roster filter chips
on Assignment Detail (`assignDetailFilter`, `studentMatchesAssignFilter()`, one chip per behavioral
pattern actually present via `REASON_TO_TREND`/`TREND_META`).

The one real surprise: the design phase assumed this would need new server-side aggregation
(draft-over-draft rollups, a provenance rollup) — turned out the client already had every
submission's raw `pq`/`su`/`cs`/`oc` for the trend math; `provenanceCounts` was the only thing
missing. Verified against live seeded data (Rhetorical analysis, Period 4 — 3 students with ≥2
complete drafts): all four dimensions came back correctly computed and, notably, all four also came
back **skewed** — Maya/Devon/Priya's deliberately different tiers (strong/flat/flagged) produce a
spread ≥ 2 on every dimension in a 3-student cohort, which is the honest result for a small, tier-
diverse sample, not a bug. Confirmed via a standalone harness replicating the exact function logic
against the real API response before trusting it in the browser. Full inline `<script>` parses clean,
`index.js` passes `node --check`, server restarted and serving 200. No headless browser in this
environment — worth a live click-through to confirm the panel's layout before calling this done.

**2026-07-31 (later same day) — content-hierarchy pass on the just-shipped aggregate panel, prompted
by product-designer critique + iteration in Claude artifacts (not designed cold in code)**
The previous entry's own closing note ("worth a live click-through before calling this done") turned
out to matter — a headless browser became available this session (Playwright, installed on demand)
and the first real look surfaced problems the code read fine but the render didn't: `.drill` had
**zero CSS** (padding 0, transparent background), so the panel sat flush against the table it
expanded from; header/selected-row/expanded-panel were all sharing `--tau-surface-2`, reading as one
flat tier instead of three; and `renderPersistedAggregateCard`'s condensed badges overflowed their
own card. Full session, in order:
1. **Three-tier colour system** for every `table.roster` (header = anchor, row = selection, panel =
   detail) — see *Visual Language* above for the token-level detail. Fixed the `.drill` zero-CSS bug
   and the persisted-card overflow in the same pass.
2. **`.origin-chip` → `.origin-pill`**, text forced to `--tau-ink` — the provenance-mix pills had
   been setting sage/faint-grey as literal text colour, the exact contrast failure `components.css`'s
   own origin-chip comment already warns against.
3. **Content hierarchy inside the panel itself**, via three rounds of critique-then-fix against a
   Claude-artifact mockup of the real component (not a cold design pass) — conclusion-first ordering
   (coaching note moved from last to second, right after the admin counts), trend badges losing their
   `▲`/`▼`/`●` glyphs (colour + text only), and the coaching note recoloured from forest to
   `--tau-auditor` (violet) with the shared `chat` icon — see *Assignment View* and *Visual Language*
   above for each. One idea was proposed, tried as a live toggle demo, and explicitly rejected:
   collapsing "nothing to report" dimensions to a compact line, turned down in favour of a table that
   never changes shape (see the *Row format* bullets above).
4. **`.teach-note` needed a `.stacked` modifier**, not a base-class margin change — moving the note
   ahead of the trend table exposed that it never had a `margin-bottom` (it didn't need one while it
   rendered last), but adding the margin to the base class would have stretched the persisted card's
   side-by-side layout (where the note sits next to the highlight rows in a flex row, not stacked
   above anything) taller than its content for no reason. Margin belongs to the usage, not the
   component.
5. **"View full assignment →" became a real button** (`.agg-link-btn`, matching `.btn.btn-quiet.btn-
   sm`) in both places it appears.

Not landed, tracked in *Open/Future Work* instead: swapping which tier (quick-expand vs. detail page)
gets the condensed vs. full breakdown, and reconciling `.drill` against the older `.drill-panel`.
Verified live throughout (Playwright against the running dev server, both themes, console clean) —
this was the first session on this page where that was actually possible in-environment rather than
inferred from reading the code.

**2026-07-31 (later same day) — Assignment Detail redesigned as a timeline, prototyped as an
artifact, not yet built**
Started from a direct product question: what should "the full assignment" page actually show a
teacher, given the goal is helping them see whether the assignment is building critical thinking —
not another student list. Went through several real corrections in the artifact, not a straight
build from a single spec:

1. **Roster removed, in two steps.** First pass kept the student roster below a new rubric/goals
   section and a per-draft-breakdown table — three parallel sections. Raised directly that this
   could be simpler: reframed as one chronological timeline (goal → per-draft snapshot → live
   in-progress read → future checkpoints) instead of three stacked blocks. Second correction, once
   the timeline existed: drop the roster entirely, accepted as a real trade-off (see *Consequence
   accepted, not overlooked* in the new section) rather than solved in the same session.
2. **The distribution chart went through three shapes before landing.** First, a strip plot (one dot
   per student along a 0–20 line) behind a small icon-toggle on the TAU-average stat tile — reasoned
   from the dataviz skill's small-N guidance (a binned histogram invents buckets a 4–5-student cohort
   can't fill). Told directly this should instead be two tabs (Overview / Distributions) with a
   *vertical bar chart*, metric-selectable across TAU score and the four dimensions — rebuilt as bars
   per student, sorted low→high. Shown a reference histogram (score on x, count of students on y);
   rebuilt a second time into a true histogram, binning TAU score on the four SAMR bands (reusing an
   existing app concept instead of inventing numeric buckets) and each dimension on its own raw 1–5
   integer. Deliberately dropped the reference image's fitted density curve — fitting a curve to 4–5
   discrete points would be decoration, not a real statistical fit, at this sample size.
3. **The redundant outlier line.** Once the histogram existed, the "N students well below the group"
   text line under the Overview tabs was cut — a lone low bar already shows the same fact.
4. **Sessions-per-draft**, a small utility stat (not a severity flag) noting when students reopened a
   draft 3+ times — framed as a coaching tip about long-context-window error compounding, matching
   this project's existing "helpful, not powerful" bar for this kind of signal.
5. **Two colour bugs, caught reviewing the artifact itself, not the design.** The artifact had copied
   `tokens.css`'s `@media (prefers-color-scheme: dark)` block verbatim — wrong for an artifact, which
   should default light regardless of OS and only switch on an explicit toggle; removed. Separately,
   the teacher's own quoted note (goal card) and the tool's own generated synthesis (per-draft
   callouts) were both rendering in `--tau-auditor` violet — conflating two different speakers in one
   voice. Fixed with a new sibling token, `--tau-tool-info` (blue, hue 205) — see *Visual Language*
   above for the full reasoning.

Net effect on the doc: the plain roster-based *Assignment View* section is replaced by *Assignment
Detail — a timeline, not a roster*; the aggregate-first section's persisted-card and roster-filter
subsections are marked superseded rather than deleted outright, since `renderAssignmentAggregatePanel`
(Browse Assignments' own quick expand) is untouched and still described accurately by the rest of that
section. The 2026-07-30/31 "swap which tier gets the full breakdown" open item is resolved as moot —
see *Open/Future Work*. Not built in `dashboard.html` yet; two new open items track what the artifact
didn't resolve (idea-origin mix dropped from the per-draft view; the in-progress card's correlation
note is hand-written, not yet a repeatable check).

**2026-07-31 (later still, same day) — Assignment Detail timeline shipped in `dashboard.html`**
Implemented the design from the two entries above. Server (`index.js`): `/api/teacher/dashboard`'s
assignment mapping gained `prompt`/`teacherNote` (both already existed on the assignment record, never
sent to this endpoint); each submission gained `conversationCount` — a new per-session lookup, since
the endpoint previously exposed submissions only, not the sessions/conversations underneath them.
Client, all new in `dashboard.html`: `draftSchedule()` (date-driven closed/live/future state per draft
slot, guaranteeing at most one live slot off the schema's own ascending-`draftDueDates` invariant),
`draftCompleteSubs()`/`draftAnySubs()`, `draftHistogramBins()` (reuses `samr()` for the TAU-score SAMR
bins rather than re-deriving the 4/9/13/17 thresholds a second time), `draftTimingNote()`/
`draftSessionNote()`/`draftEngagementNote()` (templated sentences, not free-generated),
`renderAssignmentGoal()`, `renderAssignmentOverviewCard()`, `renderAssignmentTimeline()` and its three
per-slot renderers. `renderAssignmentAggregatePanel()` was refactored to extract
`renderAssignmentAggregateContent()` — the stat-row/note/trend/origin content shared between Browse
Assignments' quick expand and the new Overview card — so the two can never drift into two independent
versions of the same summary. Dead code from the old roster removed in the same pass: `af-chip`/
`.persist-card`/`.persist-grid` CSS, `renderPersistedAggregateCard()`, `studentMatchesAssignFilter()`,
`setAssignDetailFilter()`, `assignmentRowTr()`, `toggleAssignmentDrill()`, `sortStudents()`, the
`assignDetailFilter`/`assignmentSort`/`expandedInAssignment` state vars, and the `isAssignment` branch
of `toggleSort()`.

One real correction made *during* implementation, not just design: the session-count idea from the
design phase ("students who reopened a draft 3+ times") turned out backwards once the actual session
model was checked against `store.js` — a draft's active session is *reused*, never duplicated, so
"session count" is always 1 under the real schema. The real "did they avoid one long compounding
context window" signal is **conversation count** (a student can open more than one conversation inside
the same session, e.g. a fresh "new chat" without submitting) — and more conversations is the *safer*
habit, not a warning sign, the opposite of what the design-phase copy implied. `draftSessionNote()`
was written to target students who stayed in a single continuous conversation, not students who
restarted.

Two more corrections, both prompted by live review rather than assumed correct from the code:
1. **The Assignment Overview card's stat tiles weren't clickable at first.** Added
   `.stat-tile-clickable` (an existing shared class, already used by Home's own stat tiles) on the
   Missing/Worth-a-chat tiles, routing to Browse Students pre-filtered
   (`gotoStudents('missing')`/`gotoStudents('review')`) — same global filter keys used everywhere else
   this pattern appears. Named limitation, not silent: this filters the *global* roster, since there's
   no per-assignment student list left on this page at all.
2. **The goal card's prompt was a plain paragraph, restyled to a field preview.** Prompted directly:
   this section will eventually mirror a not-yet-built assignment-creation requirements/rubric form,
   so the prompt now renders as a labelled, bordered field value (`.goal-field`) rather than prose —
   deliberately shaped so a future structured-requirements form reads as "the same content, previewed,"
   not needing a restyle once built. The field's label text is lifted verbatim from `teacher.html`'s
   own create-assignment placeholder ("Assignment prompt — shown to the coach at the start of every
   session") for the same reason. `teacherNote` was left alone — it's the teacher's own quoted words,
   not a requirement field, so it keeps the violet `.card-edge-auditor` treatment.

**2026-07-31 (later still, same day) — Class View gained its own aggregate tier**
Prompted directly: Class View showed the class's assignments, but no progression *across* them — the
"how do I need to teach differently" question the three-tier framework assigned to this tier back on
2026-07-30, left unbuilt on the *Open/Future Work* checklist even after the assignment tier shipped.
Built `renderClassAggregateCard()` in `dashboard.html`, reusing the assignment tier's own machinery
rather than a parallel implementation: `dimensionRowsFromCohort()` extracted out of
`assignmentDimensionTrend()` so the classification math (trend/floor/ceiling/skewed) is shared, not
duplicated, between "two drafts within one assignment" and "two assignments within one class";
`classTrendCohort()`/`classDimensionTrend()`/`classProvenanceMix()`/`classCoachingNote()` new,
mirroring their assignment-tier counterparts one level up; `detectTrends()` gained an optional
`scopeIds` param so the class-scoped "recurring patterns" block reuses Home's own pattern detector
instead of recomputing the rollup a second way. Card inserted between the class header and the
existing assignment table in `renderClassDetail()` (the table itself was replaced by a card timeline
in the same-day follow-up below — see that entry). No server changes needed — same as the assignment tier's own build, the
client already had every submission's raw dimension scores and provenance counts; the only new
computation is which unit ("draft" vs "assignment") the cohort walks. Verified: inline `<script>`
parses clean (`new Function()` on the extracted block), server serves the page with a 200. No
headless browser available in this environment to confirm the rendered layout — worth a live
click-through before calling this fully settled, same caveat several other sessions in this log
have flagged.

**2026-07-31 (later still, same day, follow-up) — Class View's table replaced with an assignment
timeline, matching Assignment Detail's own shape one level up**
Prompted directly, right after the aggregate card above shipped: since a teacher jumps straight into
a class, every assignment in it — Open first, then Closed — should get its own full overview card
(the same aggregate-after-a-final-submission summary the assignment tier already renders), not a
row in a table. This is the same move Assignment Detail made when it dropped its per-draft roster for
a timeline of snapshots (see that section above) — applied one level up, where the unit is a whole
assignment instead of one draft.

Replaced the sortable `table.roster` + click-to-expand-a-student-list pattern with
`renderClassAssignmentCard()` (one persistent card per assignment, reusing
`renderAssignmentAggregateContent()` verbatim — the identical no-names content Browse Assignments'
own quick-expand and Assignment Detail's overview card already show) and
`renderClassAssignmentGroup()` (Open-group-then-Closed-group, most-recently-due first within each,
unchanged sort direction). Deleted as genuinely dead once the table was gone: `renderClassDrillPanel()`,
`studentAssignmentRowData()`, `assignmentDrillRow()`, `changeCell()`, `classAssignmentTrend()`,
`sortAssignments()`, the `classSort`/`expandedInClass` state vars, `toggleClassDrill()`, and the
`.class-student-row`/`.col-draft`/`.col-ai`/`.col-score`/`.col-change`/`.col-signal` CSS — all had
exactly one remaining caller, the table row this pass removed. `sortTh()` lost its no-`groupId`
branch (`toggleSort()`, also deleted) since every remaining caller already passes a class id — Browse
Students' per-class tables were the only surface still using it.

Net effect: Class View is now names-free, matching Assignment Detail and Browse Assignments — the
three surfaces converged on the same rule (aggregate-only above the roster tier) from three different
starting points. A student is still reachable from this class via Browse Students, this class's own
roster search, or global search — same accepted trade-off Assignment Detail logged when it made the
same cut. Verified: inline `<script>` parses clean (`new Function()`), server serves the page with a
200, grepped the full file to confirm zero remaining references to every deleted identifier before
removing it. No headless browser available in this environment — the rendered card stack (spacing
between the class-level card and the first per-assignment card, header wrapping at narrow widths)
has not been screenshotted; worth a live check before calling this fully settled.

Verified against real seed data, not just the happy path: the "Persuasive essay" assignment's actual
Draft 1 submissions are `pending`/`error`, not `complete` (a pre-existing seed quirk, not caused by
this work), which exercised the honest "not enough data yet" fallback text throughout the Overview
card and Draft 1's own tabs — confirmed correct rather than assumed. Verified against "Rhetorical
analysis" instead for the populated-data screenshots (2 students with two complete drafts, real
dimension trend/skew/origin-mix numbers). Full Playwright pass: login, both themes (light default
confirmed, explicit dark toggle confirmed), Browse Assignments' quick-expand re-verified with no
regression from the shared-content refactor, tab/metric-chip clicks confirmed interactive, stat-tile
click-through to Browse Students confirmed filtered correctly, zero console errors throughout.
`node --check` clean on `index.js`; inline `<script>` parses clean via `new Function()` after every
edit.

**2026-07-31 (later still, same day) — Final assignment summary: the app's first line chart**
Prompted directly: once an assignment is fully closed, show the teacher TAU score, each dimension,
and an analysis of how the assignment went across its drafts — explicitly asking for line graphs to
show the change visually. This is a real, deliberate exception to this page's own long-standing "trend
badge, not a raw line/number" rule (see the *Assignment View* section's dimension-movement writeup),
which was about comparing exactly two points on a small sample, not about ordered sequences generally
— an explicit ask plus the dataviz skill's own form table ("trend over time → line") both pointed the
same direction here, and every plotted point is a real per-draft average, not fitted/interpolated, so
it doesn't reintroduce the false precision that rule was actually guarding against.

Built (all new, `dashboard.html`): `assignmentDraftSeries()` (one averaged point per closed draft,
reusing `draftSchedule()`/`draftCompleteSubs()`), `seriesArcNote()` (first-vs-last templated analysis
per dimension), `svgLineChart()` (straight-segment SVG line + gridlines + direct end-label + hover/
focus tooltip, no curve fitting), `showLineTip()`/`hideLineTip()` (one shared tooltip element for
every chart on the page), `renderFinalAssignmentSummary()` (wires it all into a card — TAU-total
chart, four dimension mini-charts in fixed order, an analysis line), rendered in `renderAssignmentDetail()`
only when the assignment is closed. Two design calls made explicitly, not defaulted into: single hue
(`--tau-tool-info`) for every chart rather than a new 4-colour categorical palette for the dimensions
(this app already treats the four TAU dimensions as parallel, label-distinguished rows everywhere
else, never colour-coded per dimension, and its existing hue budget has no clean room left for a 5th
categorical family); small multiples for the four dimensions rather than one combined 4-line chart
(the dataviz skill's own series-count guidance — direct labels become mandatory at 4 converging
series, small multiples is "usually right" past that).

Verified: the full inline `<script>` parses clean (`new Function()`); `svgLineChart()` was additionally
extracted and executed standalone against sample data (3 points → 6 circles, 9 text nodes, zero `NaN`
in the output) before trusting it inside the page. No headless browser available in this environment —
the rendered layout (mini-chart grid at narrow widths, tooltip position near a page edge) has not been
screenshotted; worth a live check before calling this fully settled, same caveat several sessions in
this log have already flagged for other pieces of this rebuild.

**2026-07-31 (later still, same day, follow-up) — corrected into a two-tab card, and made it a
replacement for the Overview card, not an addition**
Two corrections to the entry above, both from a direct follow-up rule statement rather than
discovered independently: (1) the Final Summary had shipped rendering *underneath* the existing
Assignment Overview card on every closed assignment — corrected to a strict replacement:
`renderAssignmentDetail()` now renders exactly one of the two, `closed ? renderFinalAssignmentSummary
: renderAssignmentOverviewCard`, never both. (2) the four dimension mini-charts plus the TAU chart had
shipped rendering permanently, all five at once — corrected into the two-tab shape described in
*Assignment Detail*'s own section above: an **Overview** tab (final-draft stat row + dimension-average
values, no chart) and a **Trend** tab (one metric-chip row, exactly one line chart at a time, mirroring
the existing Distributions tab's own chip idiom rather than inventing a second one).

Removed as dead in the same pass: the always-on `.mini-line-grid`/`.mini-line-card`/`.mini-line-title`
CSS (zero remaining markup consumers once the permanent four-chart grid was replaced by the chip-driven
single chart) — replaced with `.dim-avg-row`/`.dim-avg-chip` for the Overview tab's plain dimension
values. New state: `finalTab`/`finalMetric` (keyed by assignment id, mirroring `assignDraftTab`/
`assignDraftMetric`'s per-draft keying one level up), `setFinalTab()`/`setFinalMetric()`, both reset in
`gotoAssignment()` alongside the existing per-draft state reset. `seriesArcNote()` gained an `opts`
parameter (delta threshold, floor/ceiling, value formatter) so the same function serves the TAU total's
0–20 scale and a dimension's 1–5 scale rather than needing a second copy — the Trend tab's analysis
line is now scoped to whichever one metric is selected, not all four dimensions concatenated regardless
of what the chart above it shows. Verified: inline `<script>` parses clean, server serves the page with
a 200; same no-headless-browser caveat as the entry above still applies to the actual tab/chip
interaction.

**2026-07-31 (later still, same day, follow-up) — "How they worked" / "How the class engaged" added
to the Overview tab; SAMR band chip added to the Avg. TAU stat**
Prompted directly: the Final Summary's Overview tab had numbers (stat row, dimension averages) but
none of the plain-language "how they worked"/"how the class engaged" context the per-draft snapshot
already gives — asked for explicitly, plus "how the assignment did… if it makes sense."

Built `allClosedCompleteSubs()` (pools every completed submission across every closed draft, each
tagged with its own draft's due date) and three reworded siblings of the per-draft note functions —
`assignmentTimingNote()`, `assignmentSessionNote()`, `assignmentEngagementNote()` — same computation
as `draftTimingNote()`/`draftSessionNote()`/`draftEngagementNote()`, copy changed from "this draft"/
"this round" to "across the assignment." Kept as separate functions rather than parameterizing one
shared implementation, matching this doc's own `classCoachingNote()`/`assignmentCoachingNote()`
precedent for a small, deliberate duplication when the wording genuinely differs by tier. Wired into
`renderFinalOverviewTab()` in the same `.teach-note` order as the per-draft version. For "how the
assignment did," added `bandChip(last.totalAvg, true)` beside the Avg. TAU stat instead of a third
paragraph — decided a plain-language band riding the number already answers that, and a prose sentence
saying the same thing again would be a duplicate signal, not new information (see *designsystem.md*'s
signal-salience rule, already cited elsewhere in this doc for the same reason).

Verified: extracted and ran `assignmentTimingNote()`/`assignmentSessionNote()`/
`assignmentEngagementNote()` standalone against mock two-draft data (sensible, error-free sentences,
no `NaN`/`undefined`) before trusting them on the page; full inline `<script>` parses clean, server
serves the page with a 200. No headless browser available in this environment — the rendered card
(note ordering/spacing under the dimension-average row) has not been screenshotted.

**2026-07-31 (later still, same day, follow-up) — Goal & requirements moved into a modal**
Prompted directly: assuming Description/Purpose/Requirements each run a couple of sentences, the
three stacked field-preview boxes `renderAssignmentGoal()` used to render inline still pushed the
Overview/Final Summary card down the page on every visit, for text a teacher already wrote and rarely
re-reads. An inline collapsible disclosure was proposed first (reusing the reflection-details
chevron pattern already in the app) and agreed to in principle, then revised once a more concrete
mechanism was suggested: a button in the assignment title header opening a modal, rather than an
inline toggle that still reserves header space and an affordance on the page even collapsed.

Split `renderAssignmentGoal()` in two: `renderDraftScheduleCard()` (new — just the schedule row,
unchanged visually) stays inline right after the content header; `goalModalBody()` (new) renders the
same `.goal-field` boxes plus `teacherNote` inside a new static modal
(`#goal-modal-overlay`/`#goal-modal-body`/`#goal-modal-close-btn`), reusing the exact `.scrim.modal-
overlay`/`.confirm.modal`/`.tray-header`/`.tray-body` chrome the Flag modal and New Assignment modal
already use — a third instance of an existing pattern, not a new one. `openGoalModal(aid)` looks up
the assignment fresh and populates the body per-open (same idiom as `openFlagModal()`); a "Goal &
requirements" button in `renderAssignmentDetail()`'s content header, next to the Open/Closed chip,
is the only entry point. `renderAssignmentGoal()` itself is deleted — fully replaced, no remaining
callers. Verified: inline `<script>` parses clean, grepped to confirm zero remaining references to
the deleted function name, server serves the page with a 200. No headless browser available in this
environment — the modal's open/close animation and field layout inside it have not been visually
confirmed; worth a live check before calling this fully settled.

**2026-07-31 (later still, same day, follow-up) — header cleanup + a real Edit flow, first new
server endpoint since the Assignment Detail rebuild**
Prompted directly: drop the due date (redundant with the draft schedule card right below it) and the
rest of `content-meta` from the header, and put Goal & requirements plus a new Edit button on their
own row under the title. Asked directly how far Edit should go before building anything (UI-only vs.
placeholder vs. a real save) — chose the full flow.

Reused the New Assignment modal's own form for Edit rather than building a second one:
`editingAssignmentId` (new module state) switches the modal's copy and routes submit between
`POST /api/assignments` (create) and the new `POST /api/assignments/:id/edit` (update).
`naLevelSelectsHtml()` factored out of `naSyncLevelSelects()` so the per-draft due-date/coaching-level
rows have one row-building function feeding both the create-and-resize path and the edit-prefill path.
Added a `teacherNote` textarea to the shared form — genuinely new, since creation never had a field for
it before (only the pre-existing, never-called `/api/assignments/:id/note` endpoint could set it).

Server: `POST /api/assignments/:id/edit` (`index.js`), same validation as creation, plus one new
guard creation doesn't need — `draftBudget` can't shrink below a student's already-reached checkpoint,
computed from existing submissions' `cycleIndex`. Added to the teacher-only route guard alongside
`/note`.

Two real things caught in testing, not from reading the code: (1) seeded `draftDueDates` are full ISO
datetimes, not the bare `YYYY-MM-DD` an `<input type="date">` needs — pre-filling with the raw value
would have silently rendered every date field blank; fixed with a slice before building the rows. (2)
`api()` throws on a non-2xx response rather than returning an error body, so the submit handler needed
a `try`/`catch` it didn't have before — the create-only version got away without one since its
client-side checks caught everything the server could reject; the edit endpoint's budget-shrink guard
is server-only, so a raw `await api(...)` would have left it an unhandled rejection instead of an
alert. Verified live against the running server and real seeded data (not just `node --check`): a
valid edit round-tripped correctly, an out-of-order-dates edit was rejected with the expected 400, and
a same-or-larger-budget edit was accepted — the two test edits sent against the real "Persuasive essay"
assignment were reverted back to its original field values afterward so the seed data wasn't left
altered. `node --check` clean on `index.js`; inline `<script>` parses clean via `new Function()`. No
headless browser available in this environment — the header's new two-row layout and the modal's
pre-filled state have not been screenshotted.

**2026-07-31 (later still, same day, follow-up) — Class View's timeline cards gained the Final
Assignment Summary for closed assignments**
Prompted directly: apply the Assignment Detail Final Summary to Class View's own per-assignment
timeline cards. Extracted `renderFinalAssignmentSummaryContent()` out of `renderFinalAssignmentSummary()`
— tabs + tab panel only, no outer `.overview-card` or eyebrow — the same one-computation-two-wrappers
move `renderAssignmentAggregateContent()` already went through for the open-state content.
`renderFinalAssignmentSummary()` (Assignment Detail's own card) now just wraps that content with its
eyebrow; `renderClassAssignmentCard()` embeds the same content directly under its own name/status
header, no second title needed.

`renderClassAssignmentCard()` now branches exactly like Assignment Detail's own top card: open →
`renderAssignmentAggregateContent()` (unchanged), closed → `renderFinalAssignmentSummaryContent()`
(new). Also reset `finalTab`/`finalMetric` in `gotoClass()` (previously only reset in
`gotoAssignment()`) — a class timeline can show several closed assignments' Final Summary cards
simultaneously, each keyed by its own assignment id, so a fresh visit should start all of them on
Overview rather than carrying over whatever tab was last open from a different screen. Verified: full
inline `<script>` parses clean, grepped to confirm every call site uses the right function
(`renderFinalAssignmentSummaryContent` inside `renderClassAssignmentCard`, `renderFinalAssignmentSummary`
still the only thing Assignment Detail calls), server serves the page with a 200. No headless browser
available in this environment — the embedded tabs/charts inside a Class View card (spacing, whether
the mini-chart legibility holds up at the card's narrower width than Assignment Detail's own) have not
been screenshotted; worth a live check before calling this fully settled.

**2026-07-31 (later still, same day, follow-up) — Class & Student Management: the first teacher-driven
class/roster creation, and the first new user-account-creating route in the app**
Prompted directly: update the global header and build basic class/student management — "a teacher
creates a class, adds students." Real classes and users only ever came from `seed.js` before this;
nothing in the running app could create either. Asked directly, before writing any code, how "add a
student" should actually work given there's no student self-signup today — inline account creation by
email, picking from existing accounts, or both — and confirmed manual-add-by-email now, Google SSO
later (matching the plan already stated in `auth.js`'s own header comment), rather than guessing and
building the wrong one.

Server (`index.js`): `POST /api/classes` (create), `POST /api/classes/:id/students` (add-or-remove,
branching on the request body rather than a fourth URL segment the minimal router here doesn't
destructure). New accounts get the same shared `DEV_PASSWORD` every seeded account uses. Both added to
the existing teacher-only route guard. Client (`dashboard.html`): `+ New class` in the global header
next to `+ New assignment`; a `New class` modal; a `Manage roster` button on Class View (same header
placement as Assignment Detail's Goal/Edit buttons); one shared roster modal (list + remove, add-by-
email form) reused across every class via `activeRosterClassId` rather than one modal per class.

One real bug caught only by reading the actual HTTP response during testing, not from reading the
code: the add-student route's success payload returned the raw user doc (`col('users').get(...)`),
leaking `passwordHash`/`passwordSalt` to the client — every other user-returning route in this
codebase (`/api/me`, etc.) explicitly strips those first. Fixed to return `{ id, email, displayName }`
only. Verified live against the running server: created a class; added a brand-new student by email
and confirmed the new account could actually log in with the shared dev password; added an existing
seeded student (Maya) by email and confirmed the account was reused, not duplicated; re-added her and
confirmed no duplicate/no error; confirmed a teacher's own email is rejected with a 400. Every test
class/account created during this pass was deleted from `app/data/*.json` afterward (server stopped,
edited the JSON directly — the store has no delete API) so the seed data wasn't left altered. `node
--check` clean on `index.js`; inline `<script>` parses clean via `new Function()`. No headless browser
available in this environment — none of the new UI (header button placement, roster modal layout, the
remove-button interaction) has been visually confirmed.

**2026-07-31 (later still, same day, follow-up) — collapsed the New Class modal and the Manage
Roster modal into one "Classes & students" hub**
Direct feedback on the pass above: a teacher still had to hunt for this — creating a class lived only
in the header, but managing an existing class's roster only lived on that specific class's own Class
View page, so there was no single place to go for "classes and students" as a general task.

Removed the standalone New Class modal (`openNewClassModal()`/`closeNewClassModal()`, its own overlay)
entirely. Repurposed the roster modal into two swappable views sharing one overlay: a class-list view
(add-a-class form + every class with a student count, new) and the existing roster view (unchanged
content, now reached by clicking a class in the list, or still directly via Class View's own "Manage
roster" button for the already-on-this-class shortcut). Header's old `+ New class` button replaced
with a single `Classes & students` button opening the list view. `activeRosterClassId` — previously
always "the one class this modal is scoped to" — now doubles as the state that decides which view is
showing (`null` = list, set = roster), rather than adding a second state variable for that. Creating a
class from the list view now switches straight to its roster view inside the same modal instead of
closing the modal and navigating to the class's own page, so adding students to a just-created class
never requires leaving the hub.

Verified: inline `<script>` parses clean, grepped to confirm zero remaining references to the deleted
`openNewClassModal`/`closeNewClassModal`/`new-class-modal-overlay`/`new-class-close-btn` identifiers,
server restarted cleanly and serves the page and the dashboard API with a 200, `app/data/*.json`
unchanged (this pass touched only `dashboard.html`, no server-side changes). No headless browser
available in this environment — the class-list view's layout and the list→roster→list navigation
inside the modal have not been visually confirmed; worth a live click-through before calling this
fully settled.

**2026-08-03 — student signals: stop discarding every signal but the first**
Prompted directly, after validating a design artifact for the admin-flow rebuild below: "when adding
a class, its just put the class name... what if there are multiple signals, shouldn't we show them
as well." Reading `_computeStudentSignal()` confirmed it: an integrity flag returned immediately,
short-circuiting before the five behavioral checks below it ever ran, and those five were themselves
an if/elif chain that stopped at the first hit. A student who was genuinely both a review case and
showing a behavioral pattern only ever surfaced the review flag — and critically, this wasn't just a
roster-row simplification: the drill panel (`renderDrillPanel()`), the one surface whose whole job is
"detail on demand," rendered the exact same single `sig.reason` the roster pill did. Confirmed via an
interactive artifact before writing any code — a Current/Proposed toggle showing a student with a real
score-spike flag plus two behavioral patterns, with the "Current" state explicitly listing the two
facts computed nowhere and shown nowhere.

Rebuilt `_computeStudentSignal()` to collect every true signal into `signals[]` (priority-ordered:
review first, then the original behavioral priority) instead of returning at the first match;
`status`/`reason`/`learnMoreKey` on the return value mirror `signals[0]`, so every existing caller
that only read the top signal kept working with zero changes at the call site. Four call sites did
need updating to actually use the new array: `signalPill()` (a quiet `+N` count, `.signal-pill-count`,
new CSS), `renderDrillPanel()` (an "Also noticed" list of every attention-tier signal beneath the
flagged-submission rows, replacing the old single-line `engagementNote`), `detectTrends()`, and the
Browse Students Patterns filter (both now scan every attention-tier signal a student has, not just
their primary one, so a review-flagged student's secondary behavioral pattern correctly counts toward
that pattern's Home card again). See *Student Signal System* above for the full before/after.

Verified: inline `<script>` extracted and parsed with `new Function()` after each edit, dev server
restarted and served `dashboard.html` with a 200 throughout. No headless browser available in this
environment — the drill panel's new "Also noticed" list and the pill's `+N` badge have not been
visually confirmed against real seeded data with a multi-signal student; worth a live check.

**2026-08-03 (later same day) — admin flow: one "+ Add" entry point, then given room to breathe**
Three prompts in sequence, each correcting the previous pass once seen against the running app rather
than described in the abstract:

1. *"how can we redesign... the teachers administrative jobs to be done"* — validated first as an
   interactive artifact (Current vs. Proposed toggle, real copy from `teacher.js`/`dashboard.html`)
   before any code, per this project's own established practice of designing in an artifact first.
   Implementing it surfaced that the header had already moved past what this doc's *Class & Student
   Management* section described — a "⚙ Manage" dropdown already existed with class-scoping already
   fixed in the assignment modal — so the first implementation pass was narrower than the artifact:
   retired `teacher.js`'s own stale duplicate assignment-creation form (no class targeting, no
   `teacherNote`, disconnected from the dashboard's real one — `showOverview()` now just links to the
   dashboard instead), and added a single **Due date** field plus a "Customize schedule & coaching"
   disclosure (collapsed by default, open on Edit) wrapping the draft-budget/per-draft-rows/teacherNote
   fields, auto-spacing the per-draft dates weekly back from the due date until a teacher edits one
   directly (`naDraftDatesDirty`). **One real bug caught before shipping:** the first version of the
   date-spacing helper parsed the date as local time and round-tripped it through `toISOString()`
   (UTC), silently shifting every generated date back a day for any teacher in a positive UTC-offset
   timezone — caught by testing in this sandbox (Europe/Paris), fixed to do local calendar-date
   arithmetic only, no UTC conversion.
2. *"the teacher admin functionality has not changed, still multiple buttons etc"* — correct pushback:
   the "+ New assignment" primary button and the "⚙ Manage" dropdown were still two separate header
   entry points, which is not what the artifact showed or what got signed off on. Merged into one
   **"+ Add"** trigger (`#trig-manage`/`#panel-manage`, ids kept to avoid touching `HEADER_MENUS`)
   whose picker lists all three actions — New class, Add students, New assignment — each closing the
   picker and opening its own modal. `.menu-trigger-primary` added as a dedicated CSS modifier rather
   than stacking `.btn-primary` onto `.menu-trigger`, since the two rules are equal specificity and
   would otherwise silently fight over `background`/`color` depending on cascade order.
3. *"we should be a bit more transparent on what a teacher can do... when adding a class, its just
   put the class name"* — the New class modal, even after becoming a real full-size modal, still only
   showed a bare name field until after submission. Added a "What happens next" roadmap inside the
   same initial view: three numbered steps (name the class → add students, whenever → assign work,
   automatic), current step distinguished by badge fill + text weight + opacity together — never
   colour alone, per designsystem.md's own Hard Constraint. Numbering here states a real fact (you
   cannot add students or assign work to a class that doesn't exist yet), not decoration. Add students
   gained a matching one-line footer note rather than a second full roadmap, since it's already an
   unambiguous step 2 of 3. New assignment's own subtitle already stated the automatic-assignment fact,
   so it was left alone rather than given a redundant note.

Net effect on *Class & Student Management*, corrected in place above: the "Classes & students" hub
this section used to describe never actually reflected the code by the time of this pass — the header
had already moved to a "⚙ Manage" dropdown at some earlier, undocumented point, which this pass then
replaced again with the "+ Add" picker + three full modals described there now. `openNewClassModal`/
`closeNewClassModal`/`new-class-modal-overlay`/`new-class-close-btn` — named "deleted" in the entry
above this one — are real identifiers in the code again, now naming a different (larger, roadmap-
carrying) modal than the one that name pointed at in 2026-07-31.

Verified throughout: inline `<script>` re-parsed after every edit, `grep` swept for dangling references
to every removed id/function (`newassign-wrap`, `trig-newassign`, `manage-confirm`, `menu-panel-wide`,
`showManageView`, `MANAGE_VIEWS`, `flashManageConfirm`), dev server restarted and `dashboard.html`
served a 200 after each pass. No headless browser available in this environment — the "+ Add" picker,
both new modals, and the roadmap panel have not been visually confirmed against the running app in an
actual browser; worth a live click-through before calling this fully settled.

**2026-08 (implementation session) — add-flow rebuilt around door order, no hidden fields, and a
resizing modal; two real bugs caught live**

A live browser became available in this session (Playwright, installed to the scratchpad), which
closes the gap the 2026-07-28/08-03 entries above both flagged as unverified. The admin add-flow was
redesigned as a review artifact first, corrected several times against direct feedback — a rail
implying a forced Class→Students→Assignment sequence was wrong ("this is not a 100% linear process");
a "Customize schedule" disclosure hiding required fields was wrong twice, once in the artifact and once
again mid-fix in this same pass ("why is the assignment creation from class now hidden? i explicitly
stated not to hide"); Assignment needed to lead (it carries the most real content) with class-picking
embedded inside it rather than gating the form — then implemented for real against `dashboard.html`.
Full change set is written in place above, in *Class & Student Management*'s 2026-08 correction block,
rather than duplicated here.

Verified against the actual running server end to end, not just `node --check`: logged in as
`teacher@school.dev`, drove all three "+ Add" doors, submitted a class with both attach panels filled
(roster + full assignment) in one request and confirmed all three records existed afterward (sidebar
counts updated live, success view correctly summarized "1 student added, ... assigned"), confirmed the
resize animation completed within one frame under forced `reducedMotion: 'reduce'` before it was
reverted, and confirmed zero console errors across every path tested. Test data deleted from
`app/data/*.json` afterward, server stopped and restarted clean. Two bugs the two paragraphs above
already name were caught this way, not by reading the code — worth remembering that "looks right in
the markup" and "actually renders/hides correctly" are different claims on this page specifically,
given both bugs this session were exactly that gap.

**Same session, follow-up correction — a reported broken render that turned out to be the wrong thing
to chase.** A screenshot showed the per-draft schedule rows (inside New Class's Assignment panel) with
large uneven gaps between rows and a coaching-level dropdown cut off at the right edge. Installed
WebKit (Playwright) alongside Chromium specifically to chase this — the screenshot's "jj/mm/aaaa" date
placeholder meant a French-locale, Safari-style native date input, neither of which had been tested
yet — and re-ran the exact same interaction in both engines, both locales, at the modal's actual
rendered width. Every one of those runs produced tight, correctly-spaced rows (confirmed by
`getBoundingClientRect()` on each `.draft-slot-row`, not just a screenshot), meaning the specific
broken render shown couldn't be reproduced against this session's code — most likely a stale/cached
tab from before this session's edits landed, not a live bug. What *did* come out of the same exchange
was real, though: *"why don't we just use the same modal size... this would be way simpler and more
consistent"* — the width-inconsistency question behind the bug report was legitimate even though the
specific screenshot wasn't reproducible, and is the fix recorded in the correction above.

**2026-08-04 — Home section reorder + "Updated" marker for the teaching-landing section.** Patterns
worth noticing moved above How your teaching is landing (see the *Home* section entry above for the
reasoning). Separately, that section's rows almost never change week to week, which was making it easy
to skim past even on the rare week something did move — so each row's `trend`/`skewed`/`avgCurr` is now
snapshotted to `localStorage` (`tau-teaching-snapshot`) at render time; a row whose signature differs
from the snapshot taken at the *start* of the current page session (not re-diffed on every in-session
re-render, so the marker doesn't clear itself the instant the teacher clicks elsewhere and back) gets a
plain-text "· **Updated**" appended after its existing note/eyebrow — no new chip, no new colour,
deliberately not enclosed in a pill per the Hard Constraint that a chip needs to be both actionable and
rare in context; this is neither, it's a freshness marker on an already-actionable card. First-ever
visit (no stored snapshot yet) marks nothing, since there's no prior state to have changed from.
`teachingRowSignature`/`teachingRowChanged`/`saveTeachingSnapshot` in `dashboard.html`.
