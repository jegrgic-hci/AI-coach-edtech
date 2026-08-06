# Teacher Dashboard — Design Documentation

## Purpose

A teacher-facing view of the Critical Thinking Auditor. Gives educators a structured way to monitor AI engagement across their classes, assignments, and individual students. Surfaces integrity flags without exposing them to students.

The guiding principle: **guide first, detail on demand.** Teachers have many students and limited time. The dashboard surfaces who needs attention and why in plain language — TAU scores and dimension breakdowns are available but never the primary display.

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

Demoted sub-nav reuses `.sb-shortcut` (already the class for count-style filter rows) with added
indent and a smaller `.sidebar-item-name` — one shared modifier, not a new component per section.

| Screen | Reached via | Content |
|---|---|---|
| Home | Sidebar "Home" link, default on load | Stat tiles, behavioral-pattern cards, a missing-checkpoints card, classes-at-a-glance rollup |
| Class detail | Sidebar Classes list | Assignment list for that class (Draft / Due / Completed / Trends / Worth a chat), expandable per assignment |
| Browse Assignments | Sidebar's "All assignments" row + its demoted "Open" sub-nav filter | Full assignment list (name, classes, due date, Open/Closed, students, missing, worth-a-chat), filterable by status (All/Open/Closed), searchable by name, expandable per assignment |
| Assignment detail | "View full assignment →" inside an expanded row (Browse Assignments or Class detail) | A timeline: the assignment's goal, then one snapshot per closed draft (Overview/Distributions tabs), a live in-progress card, and ghosted future checkpoints — no student roster (rebuilt 2026-07-31, see *Assignment Detail — a timeline, not a roster*) |
| Browse Students | Sidebar's "All students" row + its two demoted sub-nav filters | Full student roster, grouped by class, filterable |
| Student detail | Any student row/link anywhere | One student's assignments, grouped into a panel per class they belong to |

Browse Assignments reverses the earlier "no All-assignments landing page" call (2026-07-28, below)
for the same reason Browse Students was ever built: an enumerated list that grows without bound
needs a real screen behind it, not more rail space — Closed assignments only ever accumulate over a
term, so leaving them enumerated in the rail alongside Open was on the same collision course a flat
student-name list already hit.

**Students in the sidebar — the scale fix.** A flat list of every student name doesn't fit a 240px
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

**Section order (2026-08-04): tiles → Patterns worth noticing → How your teaching is landing →
Classes at a glance.** Patterns moved above the teaching-landing section because it's the one most
likely to need action today (per-student, time-sensitive); the teaching-landing section is a fleet-
wide dimension rollup that rarely moves week to week, so it reads better as context underneath the
thing worth acting on first, not competing with it for the top of the page.

### Patterns worth noticing

A cross-student rollup of the four behavioral pattern types (`TREND_META`/`REASON_TO_TREND`:
Passive AI engagement, Low critical evaluation, AI-originated ideas, Declining engagement), shown as
a card only once **≥2 students** share it — a single student's pattern belongs in their own drill
panel, not a class-wide card. Zero to four cards render depending on the day's data, never a fixed
set. Each card shows:
- Pattern label + student count
- Which classes those students are spread across
- **What this looks like** — plain-language description of the pattern
- **What to try** — one concrete classroom intervention, in a tinted callout
- **"View the N students →"** — opens Browse Students filtered to exactly this pattern (see
  `gotoStudents('pattern', trendId)`), never a generic "view all" link

**Missing checkpoints is not a behavioral pattern** — a Tier-1 logistics fact (an overdue draft), so
it gets its own card, visually and structurally separate from the four above. Conflating "overdue"
with "disengaged" was a real mistake this dashboard already made once (see the 2026-07-28
"Missing submissions" IA entry further down); keeping them as two different kinds of card is
deliberate, not an oversight.

**All-clear state** — no pattern cards and no missing-checkpoints card: a single centred card, a
check mark, "All students on track."

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

**Row shape** — Student → **Currently on** → **How they're using AI** → Signal:
- *Currently on*: the assignment name plus its checkpoint status chip (`Draft 2/3`, `Final`), for
  whichever assignment the student most recently submitted something to, or (if nothing yet) the
  soonest-due open assignment (`currentlyOn()`). Replaces the old ambiguous "latest score" column by
  stating what the row's data actually represents.
- *How they're using AI*: plain-language band, score demoted to a small secondary numeral beside it
  — never a bare score leading, per the existing design-system rule.
- No separate Class column — redundant under a class group header.

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
| `reflection-score-mismatch` | Reflection claims pushback/prior knowledge the scores don't show |
| `reflection-delta-mismatch` | Reflection claims improvement between drafts the scores don't show |

The last two weren't in the original spec — added once the reflection feature shipped and gave the
tool a second source (the student's own words) to check scores against.

### Tier 2 — Assignment-level signals
Behavioral patterns computed across all submissions for a student on an assignment. Not tied to any
single submission. **These no longer render as a per-student banner** — the original spec's "amber
banner at the top of the drill panel" shipped, then was quietly simplified to a single muted-grey
text line at the bottom of the drill panel (`engagementNote` in `renderDrillPanel()`) with no
background fill, no icon, no `●` glyph. There is also a cross-student rollup — see *Patterns worth
noticing* under *Home* — which is where this tier gets most of its visual weight, plus (as of
2026-07-28) a pill of its own everywhere a signal renders — see *Student Signal System* below.

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

---

## Student Signal System

Converts raw TAU scores and flags into a plain-language status. Used everywhere a student name appears. `getStudentSignal(studentId, assignmentId?)` — if `assignmentId` is provided, scoped to that assignment only.

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

### Where signals appear

| Surface | Review | Attention |
|---|---|---|
| Browse Students / Class / Assignment rows | Pill, `+N` count if more signals are true | Pill (pattern name), `+N` count if more signals are true |
| Class detail's inline expand | Pill | Pill (pattern name) |
| Drill panel | Flagged submissions show their own flags inline (unchanged); an "Also noticed" list beneath the history shows every other attention-tier signal, not just one | Every attention-tier signal listed, each its own line, `learnMoreKey` links preserved per line |
| Student detail header | Pill (no reason text) | Pill (no reason text) |
| Home | Listed via the "Worth a chat" stat tile → Browse Students | Rolled up into a pattern card if ≥2 students share the reason (scanning each student's full signal list, not just their primary one), filterable individually in Browse Students at ≥1 |

---

## Class View

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
- **Dimension trend across assignments** (`classDimensionTrend()`) — draft-over-draft's own
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
  rejects a mismatched `draftDueDates`/`coachingLevels` count) — hiding required fields behind a click
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

**Known limitation, not solved here:** no class-rename or class-delete yet (only create); no way to
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
per draft slot, ascending order, one coaching level per slot) since the client reuses the exact same
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
| TAU score | 48px, right | `15/20` format |
| SAMR badge | 150px | Band chip |
| Signal pill | 150px | Empty container when no signal — widened 2026-07-28 from 80px, which was sized for the short "Worth a chat" text only and visually overlapped the next column once pattern names ("Passive engagement") started rendering here too |
| Status chip | 88px, centered | Final / Draft N/Total / Not started |
| Subs count | 44px, right | `3 subs` |

**Submission history (expanded):**
- Attention banner at top (assignment-level pattern only)
- Submissions most recent first; each row uses fixed-width flex columns so layout is identical across all expanded assignments; each submission row carries its own "Report →" link

---

## Submission Row Layout (drill panels)

Fixed-width flex columns ensure alignment across all rows within a panel:

| Column | CSS | Content |
|---|---|---|
| `#N` | 20px | Submission index |
| Chip | 44px, centered | Final / Draft |
| Date | 140px | `May 10, 3:42 PM` |
| TAU total | 40px, right | `15/20` |
| Dim scores | flex:1 | PQ / SU / CS / OC chips |
| SAMR badge | 100px, centered | Level label |

Submission-level flags appear as plain-text lines below the row (terra color), each with a "Learn more" link.

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
