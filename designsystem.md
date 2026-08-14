# TAU Design System — working doc

Living document for the design layer of `app/`. Companion to `built-in-chat-plan.md`
(which owns product/architecture decisions) and `app/README.md` (implementation).
**Read this before any design or CSS work in `app/`.**

**Status as of 2026-07-22.** The atomic-design debt flagged 2026-07-21 (`dashboard.html`/
`teacher.html` independently rebuilding chip/roster-row/modal/turn-shell patterns) is closed — see
that day's session log entry. `components.css` now has 11 sections; all three pages compose it for
those patterns. Tokens linked and live on all five pages. `style.css`,
`teacher.html`, `report.css`, and now **`dashboard.html`** are migrated onto `--tau-*` — zero
hardcoded hexes (outside three intentionally-literal value ramps, see *Known debt*), zero legacy
names, every `var()` resolves, on every page. Theme toggle ships on every page for both roles,
light by default. **The component layer exists** — `components.css` is 16 → 60+ classes covering
all eight duplicated concepts (Step 3c). **`report.html` is fully rebuilt on the layer (Step 3e
complete)**: top half (session 4) and the four tab internals (session 5). **`dashboard.html` is
now off the bridge (session 6)** — its inline `<style>` block is retokenised, the two main tables
are rebuilt onto a new `table.roster` component modelled on the v8 artifact's teacher roster
screen, and a real voice-rule violation (flags rendering in attention/red) is fixed. **The bridge
in `tokens.css` §4 has zero pages left depending on it for ground/ink/border** — what remains is
the `--label-*`/`--samr-*` alias group, tracked in *Known debt*.

**If you read one thing before touching this file, read the session 5 log entry.** Roughly a
third of `report.css` and `report-render.js`'s "debt" turned out to be dead code — two entire
duplicate rendering paths, a sidebar with no button that opens it, and a chart legend divider
class with zero CSS rules ever written for it. Retokenising without verifying what's actually
called would have carried all of it forward under new variable names. Session 6 found the same
shape again in `dashboard.html` (`sparklineSVG()`, zero callers) — see its log entry.

If you are picking this up cold, read *Files and load order* and *Verifying visually* before
touching anything. The second one is not optional — this migration's two real bugs were both
invisible to every check except a screenshot.

---

## Hard Constraints — check every UI decision against this list before implementing

Flat, checkable, no rationale mixed in (rationale for each lives in *Locked decisions* and *Rules
that constrain design choices* below — cite the matching rule there, don't just cite this list).
**If a decision isn't traceable to a line here or in those two sections, it's a gap in the system,
not licence to improvise — say so and ask, don't invent.**

- **MUST** default every page/artifact to light theme, unconditionally. `data-theme="light"` lives
  in the markup itself, not set by script. **NEVER** add a bare `@media (prefers-color-scheme:
  dark)` block that overrides `:root` — dark only applies under an explicit `data-theme="dark"`
  the viewer chose via the toggle, never inherited from the OS.
- **NEVER** add a sparkline, trend line, or mini line-chart as decoration. A trend value defaults
  to plain text ("+2 since draft 2") unless a chart there was explicitly requested.
- Scores display as **1–4 per dimension, or "not enough here". No total, ever. Never a percentage.**
  A class-level figure is a **distribution** (how many students in each band), **never a mean** —
  bands are ordinal. **Amended 2026-08-12** (was "1–5 per dimension, 4–20 total"); see
  `tau-dimensions.md` *The scoring scale* for the scale and `teacher-dashboard-design.md`
  *The unit of every aggregate* for the teacher surfaces.
- **"Not enough here" is not band 0** — it never shares a cell, a ramp position or a count with
  band 1, and it is never hidden or collapsed. Band 1 means the behaviour is absent; "not enough
  here" means the session was too thin to judge.
- Dimension names are fixed: **Prompting Quality, Selective Use, Calibrated Skepticism, Original
  Contribution.** No synonyms, no rewording per surface.
- **SAMR leads.** The level is the primary label on the report and on every aggregate surface, and
  it is **named, never numbered** — numbering the rungs makes Augmentation read as a failing grade.
  **A deliberate reversal, 2026-08-12, recorded so it isn't read as drift:** this constraint said
  *"SAMR is a subtitle, never the primary label"* from when SAMR was arithmetic off a total it
  didn't deserve. It is now a reading in its own right. Wherever the ladder appears it states that
  these levels describe **agency**, not task transformation as Puentedura published them.
- **Semantic colour (positive/caution/attention) never touches a student's own score.** A level is
  a position on a path, not a verdict.
- Forest has exactly **six jobs** (interactive text, primary fills, meter fills, system-message
  rule, light-theme ground wash, score numerals) **and no others** — no forest-tinted surface fill
  beyond `--tau-meter-track`. **Sage is fill-only**, never text.
- **`--tau-tool-info` (blue) is a voice, not a severity tier** — it marks the tool explaining
  itself (context, synthesis, "here's what you're looking at and why"), orthogonal to the
  attention/caution/positive/taxonomic hierarchy. **Teacher-role surfaces only** (`dashboard.html`,
  `teacher.html`) — never on a page a student sees. The moment what it's narrating collapses into
  an actual tier-worthy fact, that instance takes the matching tier colour instead — tool-info
  never sits underneath a red or amber finding pretending to be neutral.
- **Colour is never the only channel** — pair with shape, weight, dash, or text.
- **A chart's finding is never behind a tooltip.** Only the *decoder* (what a mark means in general,
  no cohort numbers) may move there, on a focusable 44px control answering to hover/focus/click — and
  a caveat may move only if the visual already prevents the misreading it guards. See *Chart
  descriptors* below.
- **Two charts on one screen that partition the same population share one track scale** — same
  lead/gutter/track/tail grid — so an equal length means an equal count. Either make it true or don't
  place them side by side; a comparison that looks available and is wrong is worse than none.
- SAMR band foregrounds step down in lightness 1→4 — **never reorder.**
- **Alert-tier colour (attention/caution) on a chip must match what the label text itself states.**
  Never carry an alert through colour alone on a descriptive/positional/taxonomic label.
- **A surface carries a severity signal exactly once.** If a chip already states "late," the row
  background doesn't also turn red for it.
- **A dot is only used when no adjacent text or icon already states the same fact.**
- **Chip/badge/pill enclosure only when BOTH actionable AND rare in that context.** Otherwise use
  colour, weight, or an icon — never a filled boundary. "Matches existing chip styling" is not
  itself a reason to enclose a new value.
- **Every card/table section meant to be scanned (not read top-to-bottom) gets an `.eyebrow`
  label**, unless a title one size up already names the group.
- **Voice is coach, not judge.** No "AI-generated content detected," no "risk" vocabulary, no
  verdicts. Integrity flags are conversation-starters, teacher-only, **never shown in student
  view**, no red, no alert iconography.
- **Origin encoding (idea provenance) is authorship, never quality** — no good-bad colour ramp.
- **A page sheet may lay a shared component out (margins, grid position); it may never redefine
  its chrome** (background/border/radius/padding/shadow). If a component doesn't fit, change the
  component in `components.css` or add a modifier there — not a local override.
- **`--tau-target: 44px` is a real minimum, not advisory.**
- **Motion:** `transform`/`opacity` only for movement, never `top`/`left`/`width`/`height`.
  `--tau-dur-short` + `-standard` easing for state changes (hover/press/toggle); `--tau-dur-medium`
  + `-decelerate`/`-accelerate` for anything that moves or resizes.
- **A signed-out visitor sees the login page and nothing else.** Never paint an app shell (nav,
  rail, section headings) and correct it afterwards — page access is resolved server-side, before
  first paint, not by the client reacting to a 401.
- **`index.html` is never touched.** All work is `app/` only — revertibility guarantee.
- Placement: a **value** → `tokens.css`. A **concept rendered on 2+ surfaces** → `components.css`
  as an atom/molecule. **Layout only, single-surface** → the page's own sheet.

---

## Source of truth

| Artifact | What it holds |
|---|---|
| `app/web/tokens.css` | **The system.** 83 `--tau-*` tokens, light + dark, plus 43 surviving bridge aliases. |
| [v8 reference doc](https://claude.ai/code/artifact/92bac9f9-16b9-4bc6-853c-cbfb7841be37) | Seven annotated screens + rationale + changelog vs v7. Stakeholder-facing. |
| This file | Decisions, rules, inventory, plan. |

The v7 design system HTML (`TAU Design System (standalone).html`) is **superseded**. Do not
build from it — three of its four dimension names are wrong and its score scale doesn't
match the engine. Kept only as history.

---

## Files and load order

```
tokens.css       values only — no selectors except :root and the baseline block
components.css   controls used on more than one page
style.css        student app + teacher triage      (index, login, teacher)
report.css       report surface                    (report)
<style> block    dashboard-only rules              (dashboard)
theme.js         blocking <head> script, sets data-theme before first paint
```

**`report.html`'s inline `<style>` block is gone** — deleted in the 3e session, its rules moved
into `report.css` under *Report chrome*. It is where the dark-mode `.snapshot-growth` bug lived,
precisely because nobody looks in a second stylesheet hidden in the markup. **`dashboard.html`
keeps its inline block by design** — see the table above — but it is retokenised as of session 6:
zero legacy names, zero hex, every `var()` resolving. Any audit that greps `*.css` still misses
it; that is expected for this one page, not a hazard to close.

**The order in `<head>` is load-bearing, not cosmetic:**

```html
<link rel="stylesheet" href="tokens.css">      <!-- must be first: everything below reads it -->
<link rel="stylesheet" href="components.css">  <!-- shared controls -->
<link rel="stylesheet" href="style.css">       <!-- or report.css; page-specific wins last -->
<script src="theme.js"></script>               <!-- blocking, before <body> -->
```

Where a new rule belongs: a **value** goes in `tokens.css`; a **concept the app renders on more
than one surface** goes in `components.css`; **layout only** goes in the page's own sheet.
`components.css` started as a home for the theme toggle — three of the five pages don't link
`style.css`, and copying it into each `<style>` block is precisely how `style.css` and
`report.css` diverged into two vocabularies. Step 3c made it the real layer.

**A page sheet may lay a component out. It may not redefine one.** That is the rule the whole
rebuild turns on: the moment `report.css` styles its own turn or its own card again, the split
is back. If a component doesn't fit a surface, change the component or add a modifier — in
`components.css`, where both surfaces get it.

---

## Atomic Design taxonomy (2026-07-21)

The file split above already draws the same line Atomic Design draws — this section gives it that
vocabulary and, more usefully, a trigger for when to act on it. An inventory pass this session
found the same handful of patterns reinvented independently 3-4 times across files that never
reference each other: `.card` (components.css) vs `.acard`/`.pcard` (style.css, different radius
and padding each time); the SAMR colour ramp defined once as `.band-1..4` and a second time as a
private `.samr-*` border mapping; and three independent scrim+box implementations (`.scrim`/
`.confirm` in components.css — built, never consumed — plus `.modal-backdrop`/`.modal` in
style.css and `#turnModal`/`.turn-modal-box` in report.css, both live). None of these files import
from each other, so nothing forced a second implementation to notice the first existed.

| Tier | Definition | Lives in |
|---|---|---|
| **Atoms** | Smallest single-purpose UI primitive — button, badge, avatar, input, meter track. Not decomposable further. | `components.css` |
| **Molecules** | A small, fixed group of atoms doing one reusable job — a card, a turn/message bubble, a confirm dialog, a legend, a sparkline. | `components.css` |
| **Organisms** | A full, page-context section built from molecules/atoms — the workspace sidebar, the report hero, the teacher roster table, the dashboard rail. Usually page-specific by nature. | page sheets (`style.css`, `report.css`, inline blocks) |
| **Templates** | The page's layout skeleton (grid/flex regions organisms drop into), no real content. | the `<body>` structure in each page's own sheet |
| **Pages** | Real screens with real content. | the five `.html` files |

**No class-name prefixes** (`.a-btn`, `.m-card` etc.) — tier is tracked in the inventory table
below, not encoded in the name. Renaming ~300 classes across 5 pages and 2 JS renderers that build
class strings dynamically (`report-render.js`, `teacher.js`) is where real breakage risk lives in a
no-build vanilla setup, for a purely cosmetic gain.

**The promotion trigger, sharpened from the rule two paragraphs up**: *when the same visual pattern
appears identically on 2+ surfaces, it gets promoted into `components.css` as an atom or molecule;
a page sheet may lay a promoted component out (margins, grid position) but may not redefine its
chrome (background/border/radius/padding/shadow).* "2+ surfaces, identical" is the trigger — not a
judgment call each time a page sheet is edited.

**components.css's 11 sections, tagged by tier** (comments only, no reordering):
Atoms — micro-label, theme toggle, buttons, band chip + meters, avatar, field, chip, dot.
Molecules — four dimensions grid, card, turn shell, origin/provenance, legend, trajectory
sparkline, confirm + scrim, offline bar, stat-tile, tray, list-row.

**Section 11, added 2026-07-22**: `.chip`/`.chip-neutral/-grey/-positive/-caution/-attention` (a
generic status pill, distinct from `.band` which always carries a pip and is reserved for the SAMR
level), `.dot`/`.dot-sm`/`.dot-caution` (a filled-circle indicator on `currentColor`), `.stat-tile`
(a label/value pair in a tinted box), `.tray`/`.tray-overlay` (the right-sliding drawer, mechanically
distinct from `.scrim`/`.confirm`), and `.list-row`/`.list-row-name/-meta/-action` (a non-tabular
avatar+name+action row, lighter than `table.roster`). Also added `.msg-superseded` to the existing
turn shell (section 6).

**Deduped this session** (see *Component inventory* below for the updated consumed-by column):
- `.acard`/`.pcard` now compose `.card`/`.card-lg` for chrome, keeping only their own layout
  (margin, internal grids). `.acard`'s own radius/padding was an exact match for `.card-lg`
  already — pure duplication, zero value drift. `.pcard`'s was ~1-2px off `.card`'s base values,
  resolved onto the canonical one rather than kept as an unintentional third size. Urgency edges
  (`.acard-soon`/`.acard-late`) were themselves duplicates of `.card-edge-caution`/
  `.card-edge-attention` — same rule, deleted the copy.
- The SAMR-as-border-accent mapping (`.samr-substitution/augmentation/modification/redefinition`)
  moved from `style.css` into `components.css`, next to `.band-1..4` — same `--tau-band-N-fg`
  tokens, one documented mapping with two treatments (filled pill vs. border accent) instead of
  one documented and one shadow copy.
- The submit-draft dialog (`index.html`) now uses `.scrim`/`.confirm` — the component
  `designsystem.md` already documented as built but unconsumed — instead of its own
  `.modal-backdrop`/`.modal`. Picked up `.confirm`'s actual design contract in the process: the
  warning is a `<ul>` naming each consequence, not a single caution-tinted sentence (`.confirm`'s
  own comment: *"the list is the component's whole point... a paragraph hides the fourth item"*).
  Added `.confirm-lg` as a widened variant for dialogs with real content (this one holds an essay
  textarea) rather than force every consumer into the 460px default.
- `report.css`'s turn-detail modal (`#turnModal`/`.turn-modal-box`) now composes `.confirm` for
  its chrome, keeping only its own size override. Its `#turnModal`/`.open` open-close mechanism
  (JS-driven, `display:none` default) was left alone — different convention from the `.hidden`
  utility everywhere else, not worth the risk in the same pass as the chrome dedup.

**Explicitly not touched this session** (tracked in *Known debt* below): `dashboard.html` and
`teacher.html`'s independent chip/roster-row/modal/turn-shell implementations, and `report.css`'s
second modal (`#dt-modal-overlay`/`#dt-modal`, the drill-through turn-detail popup, distinct from
`#turnModal`). `dashboard.html` was already deferred in the session-6 log for being out of scope;
this doesn't relitigate that.

**Closed 2026-07-28 (see Session log)** — `dashboard.html`'s and `teacher.html`'s chip/roster-row/
modal duplication audited and largely deduped: a `.list-row-boxed` modifier absorbed the three
bordered-row reinventions, the flag-explainer modal now composes `.tray-*` instead of a byte-for-
byte copy, `.stu-chip`/`.chip-dd-btn` and `.arc-badge`/`.reflect-type-badge` merged, `.eyebrow`
adopted in place of nine local micro-label reinventions, and the button/field vocabularies
unified onto `.btn`/`.field`. `report.css`'s second modal remains untouched — out of scope for
that session, not relitigated here either.

---

## Locked decisions

Settled. Don't relitigate without a reason that's changed.

| Decision | Why |
|---|---|
| **Scores display as 1–5 per dimension, 4–20 total. Never a percentage.** | `scoreTAU()` in `app/server/analysis.js` already emits exactly this. Percentages were invented by the v7 doc, imply precision the plan explicitly disclaims, and read as letter grades — `62%` looks like a D. |
| **Dimension names: Prompting Quality, Selective Use, Calibrated Skepticism, Original Contribution.** | These are the engine's own names. v7 drifted to generic ed-speak; "Calibrated Skepticism" teaches something, "Critical Synthesis" doesn't. |
| **The "friction line at 51%" does not exist.** | Undefined anywhere, re-imports pass/fail into a coach tool, and drove an untokenised blue into the score ring. |
| **Students see the total and all four dimension scores.** | Confirmed 2026-07-20. Obliges two rules — see *Score display rules* below. |
| **The divergence chart is student-facing.** | It's the visual map of their interaction. Inherits the coach-voice rule: describes, never judges. |
| **Dropped connections get real states, not a toast.** | Every turn is persisted server-side as sent, so the copy is allowed to promise the work is safe. |
| **Forest-washed ground in light theme, card surfaces stay white.** *(Revised 2026-07-21 — was "white ground, forest as accent only.")* | The all-neutral ground was itself the "white-washed tool with a green accent" problem the product owner flagged — forest is the brand colour, not just an accent. The wash is whisper-quiet (`oklch` chroma 0.006–0.010, same hue as forest) so it doesn't repeat v7's mistake of a saturated brand-demo tint; `--tau-surface` (cards, panels) is untouched pure white so content still separates from the ground. Dark theme is unchanged — see the next row. |
| **SAMR is a subtitle, never the primary label.** | PD jargon. Students don't know it; teachers who missed that inservice don't either. |
| **Both light and dark themes ship.** | Students write at night, on phones. Dark is charcoal, not forest — a brand-tinted dark theme becomes a green room. |
| **Light is the default for everyone; the OS preference is ignored.** | Confirmed 2026-07-20. A teacher projecting the tool shouldn't get a different screen from the class because their laptop is in dark mode. Dark is a choice a reader makes, not one the device makes for them. |
| **`index.html` is never touched.** | Revertibility guarantee. All work is `app/` only. |

---

## Rules that constrain design choices

### Chart descriptors: the decoder goes in the tooltip, the finding stays on the page — added 2026-08-14

**Why this rule exists.** Explanatory prose around a visualisation accumulates: the dashboard's
dimension section reached a templated finding, a three-line explainer, a legend and a per-row note
before anyone asked whether all of it had to be visible at once. The obvious fix — "put the
descriptions in tooltips" — is also the obvious way to hide a finding behind a hover, which is why
the rule is a boundary rather than a permission.

**Sort every sentence attached to a chart into one of three tiers. The tier decides where it lives.**

| Tier | What it is | Where it goes |
|---|---|---|
| **The finding** | What this chart says about *this* cohort, *right now*. Contains numbers that change per render. | **On the page. Never behind an affordance.** It is the reason the section exists. |
| **The decoder** | What a mark means *in general* — what band 1 is, what the hatch is, what the tick divides. Identical on every render; contains no cohort numbers. | **Eligible for the tooltip.** |
| **The caveat** | A guard against a specific misreading — an invariant, or why two numbers on screen legitimately disagree. | **The test below.** |

**The test for a caveat.** A caveat may move into the tooltip **only if the visual itself already
prevents the misreading it guards against.** If the chart shows it, the sentence is confirming
something visible and can move. If the chart doesn't, the sentence is the only thing standing between
the reader and a wrong conclusion, and it stays.

**The finding/decoder line is fuzzier than this table makes it look — added 2026-08-14, after the
rule was applied too literally on its first use.** A *templated synthesis* sentence — "Calibrated
Skepticism is the floor. 64 of 90 students are at band 1 or 2" — is simultaneously a computed fact
and the tool addressing the reader in its own words, and reasonable people will place it on either
side. What the table is actually protecting is narrower than "no synthesis in blue": it is that
**`--tau-tool-info` marks content a teacher may discount**, so anything a teacher must *not* discount
cannot wear it. Where a block is genuinely both, the resolution used on the dashboard is to take the
recommendation's *structure* (the 3px left rule, same offset and measure) without its hue — the shape
says the tool is addressing you, the absence of hue says this part is measured. Treat the tiers as a
default with a stated reason, not a boundary to enforce against a designer's judgement.

Worked both ways, from the dimension bands:

- *"Every row counts all n students, which is why every bar is the same length."* → **moves.** Once
  the bars are literally equal length, the reader can see it.
- *"Not enough here is per dimension, so these differ from the count on the tile above."* → **stays.**
  Two numbers on screen disagree, the chart does not explain why, and a reader who doesn't know
  concludes one of them is broken.
- *"These levels describe agency, not task transformation as SAMR published it."* → **stays**, and is
  not eligible under any reading: `tau-dimensions.md` requires the departure stated wherever the
  ladder appears, "one line of copy, not a footnote to hunt for."

**A legend is a decoder but is normally NOT eligible**, because moving it makes colour the only
channel on the page for what a mark means. It may move only where a non-colour channel already
carries mark identity on its own — e.g. a key laid out in the same left-to-right order as the marks,
where position is doing the work.

**Mechanism — the tooltip must be all of these, or the content stays on the page:**

- Hung on a **persistent, focusable control** (`.info-dot` in the section head), never on the marks
  themselves and never on hover alone. A hover-only decoder does not exist for touch or keyboard.
- Answers to **hover, focus and click**, dismissible with `Escape`, and pinned once clicked so it can
  be read rather than chased.
- Meets `--tau-target` (44px). The dot may be small; its hit area may not.
- **Never the only place a number appears.** Numbers live in the finding, the evidence block, or the
  mark's own accessible description.
- **Placed on the thing it explains, not collected in one place.** One general "how to read this"
  belongs on the section head; a definition of a *specific term* belongs on that term — a legend item
  can be its own trigger (dotted underline, same hover/focus/click contract), so a reader clicks the
  words they don't recognise rather than hunting for a dot. *(Amended 2026-08-14: this line
  originally read "one per visualisation, if a chart needs two the chart needs simplifying." That was
  wrong — it counted affordances instead of asking whether each one sits where the question is asked.
  Two well-placed triggers beat one that everything is dumped into.)*

### Colour hierarchy — added 2026-07-29
Four tiers, never mixed. Everything below is a name for a hierarchy the token
set already implied; this session made it explicit and fixed the one place
implementation had drifted from it.

| Tier | Token | Carries | Never carries |
|---|---|---|---|
| **Attention (red)** | `--tau-attention` | Administrative fact only: overdue/missing checkpoint. A binary "past due" state, same register as any app's overdue-invoice red. | Integrity signals, behavioural patterns, or any student score — see *Score display* and the origin-encoding rule below. |
| **Caution (amber)** | `--tau-caution` | "Worth a chat": integrity flags *and* behavioural patterns, deliberately one shared tier so neither escalates past the other. | Never promoted to red — that would turn a conversation-starter into a verdict, the exact thing the voice rules forbid. |
| **Positive (green)** | `--tau-positive` | On-track state, final/complete status, positive score change. | — |
| **Taxonomic (band hues 280/205/242/162)** | `--tau-band-N-fg/bg` | SAMR level, origin chips. Non-evaluative by construction — see *SAMR band foregrounds* and *Origin encoding* below. | Anything ranked good-to-bad; this ramp is a position, not a score. |

**`--tau-tool-info` (blue) sits outside this table — added 2026-07-31, formalised 2026-08-03.**
It isn't a fifth tier on the same axis as the four above; it answers a different question. The
table above is *how urgent* — tool-info is *who's talking*: the tool's own generated explanation
of what a teacher is looking at and why, versus `--tau-auditor` (violet), which marks the
teacher's own words quoted back to them (see `teacher-dashboard-design.md`, 2026-07-31 session).
Teacher-role surfaces only (`dashboard.html`, `teacher.html`) — never on a page a student sees,
and it never carries severity — a tool-info card explaining a pattern doesn't get to skip the red
or amber that pattern would otherwise earn.

**Worked example: `.teaching-card` / `.teaching-card.positive`** (`dashboard.html`, "How your
teaching is landing"). Same card shape either way — left-edge rule + tinted background, only the
colour changes. Default state renders in `--tau-tool-info` blue: the tool narrating a pattern with
no particular verdict attached. The moment the underlying finding genuinely *is* good news, the
same card instance switches to forest (`.teaching-card.positive`) instead — because at that point
it's no longer neutral narration, it's a real "this is going well" signal, which is forest's job
(score/state), not blue's. Blue never sits underneath a positive, caution, or attention finding
pretending to be neutral commentary; the card's colour always tracks what it's actually saying.

**A surface must carry a severity signal exactly once — added 2026-07-29.**
Found in `dashboard.html`'s per-assignment student list: `.class-student-row.missing`
painted the *entire row* `--tau-attention-bg` whenever a checkpoint was overdue,
while the "Draft 2/3 · Late" chip inside that same row already stated it in
`chip-attention` red. At real class size this reads as "everyone is a
problem" rather than flagging the rows that need a look — a dozen chips
correctly said "late" in a sea of rows all already red. Removed the row
background; the chip alone carries the signal, same as any other row. This
generalizes the existing dot rule (below) from *adjacent indicator repeating
a label* to *container background repeating a chip it holds* — same failure,
larger surface. Sort order (missing-first) still does the job of surfacing
these rows without a colour wash doing it a second time.

### Every card/table section gets an eyebrow — added 2026-07-30
`.eyebrow` (locked decision, *Micro-label* above) exists but was applied
inconsistently: `dashboard.html`'s home screen labelled "Classes at a glance"
but left the behavioral-pattern cards above it headerless, so a teacher
scanning the page hits an unlabelled stack of cards before reaching the one
section that does say what it is. Rule going forward: **any card or table
grouping content the reader is meant to scan, not read top-to-bottom, gets an
`.eyebrow` naming the group** — the same reasoning as a table's column
header, applied one level up. Skip it only when the section already has an
equivalent title one size up (`.report-section-title`, `.pattern-title` on an
individual card) — the rule is "name the group once," not "stack two labels."

### Light/dark asymmetry: a token can need a per-theme override, not just a per-theme value — added 2026-07-30
Dark theme's sidebar reads with clear hierarchy; the same markup in light
theme flattens. Two causes, both instances of the same problem — a single
colour choice doing a job that reads differently depending which ground it
sits on:

1. **`.eyebrow` used `--tau-ink-faint`.** On dark theme's near-black ground,
   even the faintest ink tone still separates cleanly from the background,
   so it works as a section divider. On white, the same relative tier washes
   out — a light grey on white has far less headroom than a light grey on
   charcoal. Fix: added `--tau-ink-label`, a token that exists only to feed
   `.eyebrow`, resolving to `--tau-ink-soft` in light and `--tau-ink-faint`
   (unchanged) in dark. One shared class, per-theme value — not a fork of
   the atom.
2. **`.sidebar-item.active` signalled selection with `--tau-surface-2`, a
   neutral grey wash.** In dark theme this looks fine only because
   `--tau-forest`'s dark-mode value is a bright mint that carries the real
   signal on its own via the left border and active text colour; the
   background tint was never doing the work. In light theme `--tau-forest`
   is a dark, desaturated green much closer in value to body ink, so with
   the neutral wash removed there was nothing left to mark "this is the
   active row" beyond a thin border. Fix: the active background is now
   `color-mix(in oklab, var(--tau-forest) 10%, var(--tau-surface))` — a
   brand-hue tint rather than a grey one, so the signal is colour-carried
   and shows up in both themes instead of depending on how far `--tau-forest`
   happens to sit from `--tau-ink` in a given theme.

**Takeaway:** when a component's hierarchy depends on the *relative* contrast
between two tokens, check that relationship in both themes independently —
matching absolute values per theme isn't enough if the gap between them
compresses in one direction.

### Signal salience budget
*Restated 2026-07-29 as a principle with a test, not a log of what one
screenshot needed. The version of this section written earlier the same day
described a dashboard fix directly — "chip vs label" decided row by row from
what looked wrong in an image. That's a symptom of not having this section at
all: without a rule derived from something other than the screen in front of
you, every new surface re-litigates the same question from scratch. What
follows is the rule, argued from established interface-design theory, with
the dashboard and teacher roster as two independent, separately-discovered
applications of it — not the two places the rule was invented for.*

**Two things are true about enclosure (a chip: a bounded, filled shape)
regardless of which app renders it:**

1. **Enclosure is processed pre-attentively.** A bounded, filled region is
   picked out by the visual system before it's read — the same low-level
   channel that notices motion or a flash of colour (Gestalt figure-ground;
   Ware, *Information Visualization*, on pre-attentive attributes). Plain
   text requires reading to register at all. This means enclosing a value is
   never a neutral styling choice — it is an assignment of scan priority.
   Every chip on a screen is a standing claim: *look at this one first.*
2. **A signal is only a signal if it's the exception.** The isolation effect
   (Von Restorff, 1933) is the empirical version of an intuition every
   designer already has: a highlighted item draws the eye in proportion to
   how much it differs from its surroundings. Enclose every value in a row
   and the effect cancels itself — nothing is exceptional if everything gets
   the same treatment, and the reader is back to reading every cell in
   sequence, which is the exact failure a scan-friendly dashboard exists to
   prevent.

**The test these two facts imply, applicable to any indicator on any
surface, present or future:**

> A value earns chip/badge/pill enclosure only if **both**:
> **(a) Actionable** — a viewer might reasonably need to do something in
> response to it, and
> **(b) Rare** — most instances of this value's slot will *not* carry this
> treatment, so its presence stays the exception rather than the norm.
>
> If either is false, style with colour, weight, or an icon — never a filled
> boundary.

A third, harder constraint rides alongside the two above rather than
replacing them: **colour is never the sole differentiator** (WCAG 1.4.1,
already a locked rule in this doc — "colour is never the only channel").
Enclosure is a second channel on top of colour, not a substitute for text
that states the same fact; a value that fails the test above still needs its
label to say what it is, same as before.

**Why a small, fixed vocabulary of severities, not a granular scale.** A
six-rung P0–P5 ladder is the reflex from incident-response tooling, and it
doesn't transfer here for a reason grounded in two more standard
heuristics — *consistency & standards* and *recognition rather than recall*
(Nielsen). A teacher scanning thirty rows needs to recognise what a colour
means on sight, every time, without holding a lookup table in memory; a
severity scale only stays recognisable if it's small enough to memorise
completely. This app holds two alert-worthy rungs — Attention (red) and
Caution (amber) — and the coach-voice rule (*never a verdict*) already caps
Caution from escalating into Attention for a behavioural signal. That's not
a dashboard-specific choice, it's the ceiling this severity vocabulary can
carry anywhere in the product before a reader has to stop and think instead
of recognising at a glance.

**Applying the test — two independent instances found this session, not one:**

| Surface | Value | Actionable? | Rare? | Enclosed? |
|---|---|---|---|---|
| `dashboard.html` roster | Overdue checkpoint | Yes | Yes (most rows are on time) | **Yes** — `.chip-attention` |
| `dashboard.html` roster | Integrity flag / behavioural pattern | Yes | Yes (most students are on-track) | **Yes** — `.chip-caution` |
| `dashboard.html` roster | Draft stage on time, "Final," SAMR band | No | No (the common case in every row) | **No** — plain text; SAMR band keeps its colour pip via `.band-plain`, drops the fill |
| `teacher.js` student roster | A flagged draft cycle | Yes | Yes (most cycles aren't flagged) | **Yes** — `.chip-caution` |
| `teacher.js` student roster | An ordinary completed draft cycle | No | No (the common case) | **No** — plain text (`.cycle-label`), was previously enclosed as `.cycle-chip`/`.chip-grey` regardless of flag status |
| `report.html` hero band | SAMR level on a student's own report | — (informational, not an alert) | **Yes** — it's the one classification shown on the whole view, nothing else in that glance is enclosed | **Yes** — full `.band` chrome is still correct here; rarity holds even though actionability doesn't, because nothing competes with it |

The `report.html` row matters as much as the two fixes: the test doesn't say
"informational values are never enclosed," it says enclosure has to stay
rare *in context*. A single hero band with nothing else competing for the
glance passes the rarity half of the test on its own; the same band repeated
once per row in a dense roster does not. Same component, same token, two
different correct answers — because the surrounding context is part of the
test, not a detail to standardise away.

**Two supporting rules that follow from the same reasoning, not restated
per-surface:**
- **An absence of a value is not a value.** `—` (`.no-signal`) or a muted
  phrase ("Too early to tell") stays bare, muted text regardless of the test
  above — there is no fact yet to assert, so the actionable/rare question
  doesn't apply.
- **A breadcrumb sentence (`content-meta`) never encloses, even for a
  genuinely actionable value.** `"Due Oct 4 · 3 classes · 45 students · 12
  missing · Worth a chat"` is read as a sentence, not scanned as a table — a
  chip between `·` separators fights the sentence structure itself, a
  failure mode the two-part test doesn't cover because it's about reading
  mode, not scan priority. Multiple rollups on one line match each other's
  bare-text treatment for the same reason two adjacent table cells would.
- **A delta or count nested inside a cell that already has its own chip
  stays bare text** — the `+3`/`−1` beside a total, or the `${submitted} /
  ${n}` beside a missing tally. It's secondary to the value it annotates and
  doesn't need independent scan priority.

**Standing instruction, not a one-time cleanup:** before adding any new chip,
badge, or filled pill anywhere in this app — `teacher.html`, `report.html`, a
future screen — run the two-part test above first. "Match the existing chip
styling for consistency" is not, by itself, a reason to enclose a new value;
consistency is a property of applying one *test* everywhere, not of making
every status look like every other status. The reverse audit — walking
every existing chip in `components.css`'s `.chip-*` family against this test
surface by surface — has not been done exhaustively; `.stu-chip`/filter
chips are out of scope by category (they're button-shaped controls a user
selects, not data values the app is asserting), but every data-bearing chip
in `report.html` and `teacher.html` beyond the two checked above should be
assumed unaudited, not assumed correct because it predates this rule.

### Colour
- **Forest gets six jobs and no others:** interactive text, primary fills, meter fills, the rule marking a system message, the light-theme ground wash (2026-07-21), and — new the same day — a student's own score numerals (`.report-total-n`, `.dim-val .n`).
- **Sage is fill-only.** It fails contrast as text.
- **Neutrals stay neutral past the ground wash.** The page background (`--tau-bg`/`--tau-surface-2`/`--tau-surface-3`) carries a whisper of forest; card surfaces (`--tau-surface`), shadows, and panel fills do not. The wash is one deliberate, quiet exception — it is not licence to tint greys generally.
- **Forest on a score numeral is brand identity, not a verdict, because it never varies with the value.** A 5/20 and a 20/20 render in the exact same colour and weight — this is the one place a value-keyed rule could look like it's being broken, so it's worth stating why it isn't: *semantic* colour (positive/caution/attention) still never touches a score. This is a fixed brand treatment applied uniformly regardless of the number, same category as the SAMR band pip.
- **Semantic colour (positive/caution/attention) never touches a student's own score.** A level is a position on a path, not a verdict. Semantic is for direction-of-travel and teacher-side signals only.
- **SAMR band foregrounds step down in lightness 1→4.** Do not reorder — the ramp carries meaning in greyscale and for colour-blind readers on its own.
- **Colour is never the only channel.** Anything encoded by hue is also encoded by shape, weight, dash, or text.
- **Alert-tier colour on a chip must match what the chip's own text claims — added 2026-07-28.**
  `.chip-attention` (and `.chip-caution` used as a "look at me" tint) may only be applied when the
  label states the actionable fact itself. Never use it to carry an alert through colour alone on
  an otherwise descriptive/positional/taxonomic label — a checkpoint slot number, a role name, a
  content type, a lifecycle state, a filter's selected-state. The canonical violation this forbids:
  `dashboard.html`'s checkpoint chip used to render the plain label `Draft 2/3` in
  `--tau-attention` red whenever the checkpoint was overdue — the same red a genuine "missing work"
  flag uses elsewhere, on text that never said "missing" or "overdue." A reader scanning by colour
  alone couldn't tell a merely-in-progress checkpoint from an alert one; the fix was to put the
  word back in the label (`Draft 2/3 · Overdue`) so colour reinforces text instead of substituting
  for it. This generalizes the existing score rule above ("semantic colour never touches a
  student's own score") from scores to chips generally.
- **A dot is only used when no adjacent text or icon already states the same fact — added
  2026-07-28.** `.dot`/`.dot-caution`/`.dot-attention` exist for the rare case where nothing else
  in the row carries the signal (e.g. a sidebar row with no room for a status word). Where a chip,
  pill, or line of text already says "Worth a chat" / "Missing" / the pattern name, an adjacent
  colour-only dot repeating that fact is decoration, not information, and gets removed. This
  generalizes `dashboard.html`'s own `.sb-shortcut` precedent comment ("the label already states
  the condition, a colored dot would just repeat it") from a one-off local decision into a
  system-wide rule.

### Score display
Both follow from students seeing the total:
- The total **never appears without its band label** beside it.
- The total **never appears without the change since last draft.** A number quoted to a friend must be a position on a path, not a mark.

### Voice
Coach, not judge. The v7 do/don't table still holds and is the one part of v7 worth keeping verbatim:
- Say: "Push further next time." / "Some original thinking is present." / "Build the habit of going deeper."
- Never: "AI-generated content detected." / "Plagiarism risk: high." / "You failed to verify."

**Integrity flags are conversation-starters, never verdicts.** This is a visual constraint, not
just a copy one: no red, no alert iconography, no "risk" vocabulary, and permanent framing copy
that can't be dismissed. The teacher column is called *"Worth a chat."*

### Origin encoding
Added 2026-07-20 while migrating `style.css`. The provenance bar and concept chips were
encoding idea origin as green → amber → **red**, which made "the coach said it first" render
as an error. That is the exact verdict the voice rules forbid, shipping in a student-facing
component.

Origin is an axis of **authorship, not quality**, and reuses the conversation map's vocabulary
so the two visuals teach one encoding instead of two:

| Origin | Token | Reads as |
|---|---|---|
| Student-born / prior | `--tau-origin-you` (forest) | you |
| Synthesized | `--tau-origin-together` (sage) | together |
| AI-born | `--tau-origin-coach` (faint grey) | the coach |

Chips carry the hue in the **fill** with ink text — sage and faint grey both fail as text, and
the chip's own words are the channel a colour-blind reader gets. Nothing in this ramp is
ordered good-to-bad, so no arrangement of it can accuse a student.

### Conversation map encoding
| Channel | Encodes |
|---|---|
| Lane (y) | One idea thread |
| x | Turn order, shared across lanes |
| Stroke weight | Live (`5px`) vs. set aside (`1.5px`) |
| Colour **and** dash | Who opened it — student solid forest, coach dashed grey |
| End marker | Filled square = reached the essay; hollow circle = dropped |

Nothing encodes quality. A coach-started thread is not worse and the chart must not imply it is.
Ceiling of ~6 lanes on a student view; bundle the tail. Scrolls horizontally on a phone rather
than compressing turns into illegibility.

### Theme selection
Three parts, and all three are load-bearing:

1. **`data-theme="light"` is in the markup** of every page, not applied by script. With JS off or
   `localStorage` blocked (Safari private mode throws on access), the app is still light rather
   than falling through to the OS.
2. **`theme.js` is a blocking `<head>` script.** Applying the stored theme after first paint gives
   a dark-mode reader a white flash on every navigation — worse than shipping no toggle. This is
   the one place a render-blocking script is the correct call; don't "optimise" it to `defer`.
3. **`:root[data-theme]` outranks the media query** on specificity (0,2,0 vs 0,1,0), so an explicit
   choice always wins regardless of source order.

The `@media (prefers-color-scheme: dark)` block in `tokens.css` is now only a fallback for a page
that forgets its `data-theme` attribute. It is no longer the default signal — see the locked
decision above.

### Signed-out page access

The same rule as the theme script, applied to content instead of colour: **what a visitor sees is
resolved before first paint, not corrected after it.**

Until 2026-08-10 the auth gate was purely client-side — the server handed every `.html` file to
anyone, and `api.js` redirected to login once its first API call came back 401. The shell painted
in the meantime, so a signed-out visitor to `app.tauthinking.com` got the nav, the rail and
"Current assignments" for a beat before the login page replaced them. It read as a broken
dashboard rather than as a sign-in wall, and "Current assignments" over nothing actively asserts
something false (Nielsen, *visibility of system status*).

Now `redirectedToLogin()` in `server/index.js` answers a page request from a signed-out visitor
with a `302` to `/login.html?next=…`, so no markup is sent. Three things this depends on:

1. **Only pages are gated** — `route === '/'` or `.endsWith('.html')`. `tokens.css`, `login.js`,
   `theme.js` and the favicons must stay public or the login page cannot render itself.
2. **`login.html` is the one public page**, in `PUBLIC_PAGES`. Adding a second (a marketing page,
   a password reset) means adding it there, not loosening the test.
3. **`next` carries `req.url`, not the pathname**, so `/report.html?id=…` survives. `login.js`
   already validates it against open redirects and against landing on another role's home.

Cost is one session lookup per page load — the same read every API call already does, and only on
`.html`. That is the right trade for the same reason the theme script is allowed to block: a
correct first paint is worth more than the round trip.

Preference is stored per browser, not per account. Correct for a display setting, but worth
knowing on shared Chromebooks: one student's dark choice greets the next student on that machine.
Move it to the user record if that turns up in a pilot.

### Motion
Added 2026-07-22, revised same day onto Material 3's motion system rather than invented values —
M3 publishes a tested duration scale and easing set for exactly this problem, and there's no
reason to guess our own numbers. The first pass (`--tau-dur-fast: 120ms`) read as too fast in
review; M3's own scale explains why — 120ms sits below M3's *shortest* named rung (`short1`,
50ms) short of their smallest useful step, when what we wanted was their **short** category, not
something faster than it.

We take two rungs of M3's four-tier ladder (`short`, `medium`, `long`, `extra-long`) — `short` and
`medium` — because this system has no large-surface or expressive transitions (page transforms,
shared-element hero motion) for `long`/`extra-long` to serve. An unused rung is just a third value
someone reaches for out of habit later.

| Token | Value | M3 source | Use for |
|---|---|---|---|
| `--tau-dur-short` | 150ms | `short3` | Colour/background/border state changes — hover, focus, a toggle flipping. No distance travelled. |
| `--tau-dur-medium` | 300ms | `medium2` | Anything that moves or resizes on screen — a disclosure opening, a panel sliding, a card lifting. |
| `--tau-ease-standard` | `cubic-bezier(0.2,0,0,1)` | `standard` | Default for anything symmetric — the same motion plays in reverse (hover, press, most toggles). |
| `--tau-ease-decelerate` | `cubic-bezier(0.05,0.7,0.1,1)` | `emphasized-decelerate` | Something entering/appearing — arrives fast, settles slow. |
| `--tau-ease-accelerate` | `cubic-bezier(0.3,0,0.8,0.15)` | `emphasized-accelerate` | Something leaving — starts slow, exits fast. |

M3's full "emphasized" curve is a two-segment path (accelerate into decelerate) that isn't
expressible as one CSS `cubic-bezier`. We use the accelerate/decelerate halves directly on
whichever edge of a transition needs them instead of approximating the whole path — the same
single-property use M3's own CSS token guidance recommends.

**Rules:**
- Never animate `top`/`left`/`width`/`height` for movement — `transform`/`opacity` only, so motion
  doesn't trigger layout on every frame.
- A hover/focus/press state uses `--tau-dur-short` + `--tau-ease-standard`; anything that changes
  an element's size or position on screen uses `--tau-dur-medium` with `-decelerate` (appearing)
  or `-accelerate` (leaving). Don't reach for a third duration because something "feels" in
  between — pick the nearer rung.
- Loading spinners (`@keyframes spin`/`rspin`) are a different category — continuous indicators,
  not interaction feedback — and stay outside this token set.
- `prefers-reduced-motion` is already enforced globally (baseline block, `tokens.css`) — collapses
  every `transition`/`animation` to near-zero. New motion never needs its own reduced-motion
  override; the blanket rule already covers it.

### Accessibility floor
Shipped in the baseline block of `tokens.css`: global `:focus-visible`, `prefers-reduced-motion`,
`100dvh`. Plus `--tau-target: 44px` as a real minimum — v7 claimed 44px while shipping 20px chips,
which is the failure that token prevents.

**The token is currently declared but almost entirely unenforced.** As of 2026-07-20 the theme
toggle is the only control that honours it. Known violations, all in `style.css`:

| Control | Current | Notes |
|---|---|---|
| `.msg-edit-btn` | `padding: 2px` | hover-only, and a touch target on a phone |
| `#btnRename` | `padding: 2px 6px` | |
| `.back-btn` | `padding: 4px 0` | |
| ~~`.composer-actions button`~~ | ~~`padding: 5px 12px`~~ | Now `.btn-sm` — 36px. Still under the floor; see note below |
| `.account-signout` | `padding: 5px 10px` | |
| `.draft-chip` | `padding: 6px 11px` | interactive when it's a `button` |

This is a real finding, not a style nit: the stated market is Chromebooks and phones, and v7's
exact failure was claiming this floor while shipping under it. Worth its own pass rather than
folding into a colour migration — several of these need layout changes, not just padding.

**`.btn-sm` is a deliberate 36px exception and needs watching.** The artifact specifies it and
the composer row uses it, so the two composer controls are 36px rather than 44px. That is
defensible on a pointer-dense toolbar and indefensible on a phone. Either the composer row
promotes to full `.btn` under a mobile breakpoint, or `.btn-sm` is retired — decide it in the
accessibility pass, not by letting the exception spread.

`.msg-edit-btn` is fixed: it is now a full `--tau-target` box and appears on `:focus-visible`
as well as hover, which it did not before. Hover-only put it out of reach of a keyboard entirely
and off a touch screen altogether.

---

## Component inventory

**Read "State" as two separate questions: is it defined, and is it consumed?** After Step 3c
most of this table is *defined in `components.css` and consumed by nothing* — that is the
expected shape between 3c and 3e, not a stall.

| Component | Defined | Consumed |
|---|---|---|
| Tokens, light + dark | **Live** | all five pages |
| Theme toggle | `components.css` | all five pages, both roles |
| Button system (`.btn`) | `components.css` | index, login |
| Band chip (`.band`) + segmented meter (`.steps`) | `components.css` | report hero + dimensions |
| SAMR border accent (`.samr-substitution/augmentation/modification/redefinition`) | `components.css` (moved from `style.css`, 2026-07-21) | index (`.draft-chip`, `.draft-row`, `.draft-section`) · same `--tau-band-N-fg` ramp as `.band-1..4` above, one mapping documented once |
| Turn shell (`.turn` / `.msg` / auditor form) | `components.css` (moved out of `style.css`, 3c) | index chat |
| Origin chips + provenance bar | `components.css` (moved, 3c) | report Idea Origins · `.concept-origin-badge` deleted |
| Card (`.card` + edge modifiers, `.card-lg`) | `components.css` (3c) | report (all panels), **index (`.acard`/`.pcard` compose it, 2026-07-21)** · `.panel` `.summary-card` deleted |
| Four dimensions (`.dims` / `.dim`) | `components.css` (3c) | report · `.summary-card` deleted |
| Legend (`.legend`) | `components.css` (3c) | report provenance · `.prov-legend-*` deleted; `.div-legend-*` `.dt-legend-*` remain |
| Trajectory sparkline (`.traj`) | `components.css` (3c) | report hero · rail still uses `.trend-svg` |
| Continuous meter (`.meter-track`) | `components.css` (moved, 3c) | dashboard rail |
| Confirm dialog (`.confirm`/`.scrim`, `.confirm-lg`) | `components.css` (3c) | **index submit-draft dialog, report turn-detail modal (both 2026-07-21)** · `dashboard.html`/`teacher.html` still ship independent modals, see *Known debt* |
| Offline bar + queued turn | `components.css` (3c) | — · **needs logic, not just CSS** |
| Micro-label (`.eyebrow`), avatar, field | `components.css` (3c) | `.eyebrow` on report (replaced `.section-header`) |
| Quote (`.quote`) | `components.css` (3c) | report snapshot |
| Coaching-mode banner | `style.css` | index chat |
| Draft-budget meter | `style.css` | index chat |
| "Coach is thinking" state | `style.css` | index chat |
| Divergence chart | `renderHorizChart()`, `report-render.js` | report · chrome tokenised; value ramps still literal, see *Known debt* |
| Report layout | `report.css` | report · fully on the layer, top half and all four tabs |
| Teacher roster | `style.css` | teacher · needs density + band labels + flag framing |
| Plain-language band labels | **Written** — `BAND_META` in `report-render.js` | report hero |
| Global nav (`.tau-nav` + crumbs + local toggle) | `components.css` (2026-07-22) | index (home + workspace), report — see session log. Not on `dashboard.html`/`teacher.html`, which keep their own `.tab-nav`. |
| Icon system (`.tau-icon`, M3-style) | `icons.js` (new file) + `.tau-icon` base in `components.css` | index home card (chat, close, description, arrowForward, checklist, expandMore) — replaces the ✉/✕/→ text glyphs that were standing in for icons. `chat` (not `mail`) for the teacher-note vocabulary specifically — a note reads as "someone said something," not correspondence. Self-hosted inline SVG, not the Material Symbols webfont/CDN: the app loads zero external resources today (system fonts only) and a font dependency would break that. Not yet on `teacher.js`/`dashboard.html` or the workspace's `reading-banner-return`. |
| Rail (`.rail` + `-head`/`-body`/`-foot`, `.rail-group`, `.rail-item` + `-text`/`-name`/`-sub`/`-meta`, `.rail-item-nested`, `.rail-inset`) | `components.css` §13 (2026-08-07) | **all four vertical rails** — student home, workspace sessions, teacher dashboard, admin. Replaces `.dash-rail`, `.sidebar` (two different objects, same name), `.admin-nav*`, `.conv-item`, `.sb-shortcut`, `.rail-label`, `.rail-avatar`. Width is `--tau-rail-w`. See session log. |
| Assignment setup flow | **Missing** | |

---

## Component inventory — student surfaces
*Derived 2026-07-20. Supersedes the loose table above for planning purposes; that table
tracks individual components, this one tracks the rebuild.*

### Why this exists

The table above says what's built. It does not say what *should* exist, and that turned out to
be the missing piece. Counting the live component classes per surface:

| Surface | Live component classes | Sheet |
|---|---|---|
| `index` (home + chat) | 125 | `style.css` |
| `report` | 143 | `report.css` |
| `login` | 16 | `style.css` |
| `teacher` (triage) | 10 | `style.css` |
| **`components.css` — the shared layer** | **16** → ~60 after 3c | — |

**Sixteen shared classes against roughly 290 page-owned ones.** That ratio is the whole
problem. (The count above is the pre-3c measurement, kept because it is what the argument
rests on. The layer now covers all eight concepts; the page-owned counts don't fall until 3e
rewires the markup.) There is no component layer; each page sheet owns its own components, so the same
concept gets built once per surface by whoever needed it first. Every fix is a patch because
there is nowhere else to put it.

### The duplications this exposes

Not stylistic drift — these are the *same concept* built twice or three times, in two
vocabularies that can't share code:

| Concept | Built as | Target |
|---|---|---|
| A conversation turn | `.msg` + `.turn-*` (index) · `.turn-row` / `.turn-text` (report) | one turn shell |
| Four dimensions at 1–5 | `.meters` / `.meter-*` (rail) · `.summary-card` / `.dim-*` (report) | `.dims` / `.dim` + `.steps` |
| A band + score | `.rail-hero` + `.rail-band` · `.samr-hero-*` · `.draft-chip[samr-*]` · `.pcard-outcome` | `.band` + `.band-sub` |
| A legend | `.div-legend-*` · `.prov-legend-*` · `.dt-legend-*` | one legend |
| A score trend line | `.trend-svg` (rail) · artifact `.traj` (report) | one sparkline |
| A card / panel | `.acard` · `.pcard` · `.panel` · `.patterns-card` · `.session-desc-panel` · `.summary-card` | one `.card` + modifiers |
| A confirmation | `.modal-*` (index) · artifact `.confirm` | one `.confirm` |
| A meter track | `.meter-track` / `.meter-fill` · `.tau-bar` · `.budget-track` · `.steps` | `.steps` (discrete) + one continuous |

Eight concepts, ~24 implementations. Collapsing these is where the rebuild pays for itself —
it is subtraction, not new design work.

### Disposition

**Artifact** — adopt the v8 spec verbatim. **Derive** — the artifact never drew it; build from
the locked rules and tokens. **Merge** — collapse duplicates per the table above. **Dead** —
delete.

| Family | Surface | Disposition |
|---|---|---|
| `.btn*`, `.band*`, `.steps` | shared | **Artifact** — done |
| turn shell, `.mode-banner`, `.thinking`, `.composer*`, budget track | index | **Artifact** — done |
| `.quote`, `.dims`/`.dim` | report | **Artifact** — built 3c |
| `.report-lede`, `.report-band`, `.report-next` | report | **Artifact** — not started. Single-surface *layout*, so these belong to `report.css`, not the layer |
| `.traj` sparkline, `.confirm`, `.offline-bar`, `.queued` | index + report | **Artifact** — built 3c |
| `.map-*` (divergence chart) | report | **Artifact** — exists as `.div-*` (pattern exchange sidebar) and `dt-*` (the chart itself); both retokenised session 5 |
| `.dash*`, `.rail-*` (identity, progress, hero, trend) | index | **Derive** |
| `.acard*` (16), `.pcard*` (7) | index | **Derive** → merge onto `.card` |
| `.draft-chip*` (7), `.chip-row` | index | **Derive** → merge onto `.band` where it shows a band |
| `.sidebar`, `.conv-*`, `.drafts-list`, `.locked-note` | index | **Derive** → artifact's `.ws-rail` covers part |
| `.chunk*`, `.app-header`, `.account-chip`, `.visibility-cue` | index | **Derive** |
| `.login-*`, `.google-btn`, `.test-accounts` (16) | login | **Derive** — artifact drew no login |
| `.concept-*`, `.prov-*`, `.essay-heatmap`, `.flag-*`, `.label-badge` | report | **Derive** — provenance UI is undrawn |
| `.session-*`, `.tab-*`, `.patterns-*`, `.turn-modal-*` | report | **Derive** |
| `.api-key-bar`, `.groq-status`, `.upload-*`, `.demo-btn`, `.instruction-*` | report | **Dead** — single-file CTA leftovers, confirmed gone by session 5 |
| `.dt-*` (~30) | report | **Corrected, session 4–5**: this row was wrong. `dt-*` is the live agency chart's own id/class vocabulary (summary strip, legend, tooltip, modal, Pattern Guide cards) — not a CTA leftover. Retokenised in session 5; see the session log for what *was* dead inside it. |

**Dead code removed 2026-07-20:** 110 classes / 166 rules cut from `report.css`, **1092 → 662
lines (39%)**. Screenshots before and after are byte-identical in both themes, so the cut is
provably inert.

**How to redo this safely — it took two attempts.** The first pass cut 430 lines and silently
broke the dimension nudge blocks, because classes are built by interpolation and a naive
reference check can't see them:

```js
class="dim-nudge nudge-${nudgeType}"      // nudge-coach / nudge-reinforce
```

Two rules follow, both learned the hard way:

1. **Collect every dynamic prefix first.** `grep -ohE '[a-zA-Z][a-zA-Z0-9_-]*-\$\{'` over the
   consumers. `report.css` has seven: `nudge-`, `score-`, `tier-`, `dt-verdict-`,
   `dt-cat-seq-chip--`, `session-turn-`, `student-turn-`. Anchoring the prefix pattern to a
   preceding quote finds only four — the other three sit mid-attribute after a space.
2. **Delete by byte range, don't re-serialise.** Rewriting the CSS from a parse mangled the
   formatting of every surviving rule (`}` and the next selector collapsed onto one line),
   which turns a reviewable diff into a whole-file rewrite. Cut the spans out of the original
   string instead and every surviving byte stays put.

A class that only ever appears as a modifier on a dead base (`.reflect-pillar.challenge`) goes
with it — correct, but check the list rather than assuming: seven classes here were removed as
collateral and each needed confirming as modifier-only.

**~~Also confirmed while verifying:~~ the Agency Chart renders blank in headless with *both* old
and new CSS. That's the d3 CDN failing, not the cut — the known debt below, reproducing exactly
as predicted.**

> **This was wrong, and the way it was wrong is the lesson.** Corrected in the 3e session: d3
> loads fine in headless (verified directly). The chart was blank because `render()` threw a
> `ReferenceError` several lines *before* reaching it. The known debt was a plausible culprit
> sitting right next to the symptom, so it got assigned the blame without a test that could
> distinguish the two — and being written down turned a guess into a fact the next session
> inherited. **A cause you did not verify does not go in the doc; a symptom with a guess beside
> it does.** One `typeof d3` check would have cost nothing and saved a session.

### What the report surface actually looks like — findings, 2026-07-20

Rendered it in both themes while verifying the dead-code cut. It is the surface furthest from
the system, and it breaks **four locked rules** at once. Recording them here because they are
the specification for the report rebuild, not a bug list to fix one at a time.

**All four are fixed as of the 3e session — the table is kept as the record of what the rebuild
was for, not as an open bug list.**

| What shipped | Rule it broke | Now |
|---|---|---|
| Dimension scores coloured red / amber / green by value (`.score-1`…`.score-5`, hardcoded `#E24B4A`, `#F59E0B`, `#10B981`) | *"Semantic colour never touches a student's own score. A level is a position on a path, not a verdict."* A 2 renders in the same red as an error. | `.dims` / `.dim` + `.steps`. No value-keyed colour anywhere; verified against a real 1-of-5 (Priya's PQ), which renders identically to a 5. |
| "Augmentation" as a 30px blue headline, the largest text on the page | *"SAMR is a subtitle, never the primary label."* | `.band` chip carries plain language; SAMR rides in `.band-sub` as "Augmentation on the SAMR scale". |
| A blue progress ring around the total | The v7 score circle the artifact retired — makes the report a verdict at the moment it claims to coach. | Deleted. |
| Total shown with no band label and no change since last draft | Both *Score display* rules. | One `.report-total` row carries number, denominator, band and delta together — see the note on the server change below. |

Plus a third set of dimension names — `report.css` said "How you asked / What you did with it /
Did you push back? / Your own ideas", `app.js` says "How you questioned / What you did with
answers / How you pushed back / How much was yours", and the engine says Prompting Quality /
Selective Use / Calibrated Skepticism / Original Contribution. **Three vocabularies for four
dimensions.** The report now uses the engine's names. **`app.js` still has its own set — that is
the remaining half of this finding**, and it is a one-line fix whenever the dashboard is next open.

**Token state:**

| | after the dead-code cut | after the 3e top-half rebuild |
|---|---|---|
| `--tau-*` token references | **0** | **114** |
| Legacy bridge names used | 7 (`--bg --surface --surface2 --border --text --muted --accent`) | same 7, 39 references |
| Hardcoded hexes | **162** | **96** |

`report.css` was not partially migrated — it was entirely unmigrated, and rendered in dark mode
only because the bridge maps those seven names. Every remaining hex and legacy reference now
sits in the four tab internals (`dt-*`, `div-pat-*`, `session-*`, `pattern-group`), which is
exactly the next session's scope.

**One live bug found and fixed on the spot:** `.snapshot-growth` (`report.html:28`) had
`background: #eff6ff` with no `color`, so the "Next draft" advice inherited `--text` and
rendered near-white on near-white in dark theme — invisible. Now `--tau-surface-2`. This is the
overloaded-token failure from Step 1 reappearing in a fourth stylesheet: `report.html` has its
own `<style>` block, which the *Files and load order* section above does not mention.

### What the artifact does and doesn't settle

The artifact draws ~35 product components across seven screens. The app renders considerably
more. It has **no spec** for: the student dashboard rail, assignment cards, past-assignment
cards, draft chips, login, or the report's provenance bar, essay heatmap and concept list.

Rebuilding only what the artifact drew would leave those in the old vocabulary — which is
exactly the `style.css`-vs-`report.css` split that caused this. **The artifact is the style
authority, not the complete inventory.** Undrawn components get derived from the locked rules;
those rules plus the tokens are specific enough to do it consistently.

---

## Implementation plan

### ~~Step 1 — link and delete~~ — DONE 2026-07-20
Done as written. One correction for the record: **the bridge is not a safe resting place.**
It made the app *look* rethemed while silently breaking three components, because legacy
`--bg` did two different jobs — page ground *and* recessed fill — and the bridge could only
map it to one. With `--tau-bg` and `--tau-surface` both white, every recessed fill went
white-on-white: the meter track, the "try next" block, and the not-started badge all
vanished in light theme. Invisible in a diff, obvious in a screenshot.

The lesson generalises: a one-to-one alias can't split a legacy name that was overloaded.
Assume the same trap in `report.css` and `dashboard.html`, and check their `--bg` /
`--surface` / `--grey-tint` usages by role before trusting the bridge there.

### ~~Step 2 — close the bypasses~~ — DONE for `style.css` + `teacher.html`
Both are now at zero hardcoded hexes and zero legacy names. Fixed along the way:
- `.submit-btn` had `color: white` on forest — **1.9:1 in dark theme**. Now `--tau-on-forest`.
- `.submit-btn:hover` was still the old blue `#1d4ed8`; the button went forest → blue on hover.
- SAMR borders were the old four-hue blue ramp, contradicting the ordered-band rule while the
  bridged `--samr-*` tokens sat unused beside them. Now `--tau-band-N-fg`.
- `filter: brightness()` replaced with `--tau-forest-lift` — brightness lightens in light mode
  and blows out the already-light dark-mode forest, so one rule needed two opposite behaviours.

Remaining: `report.css` (~1130 lines) and `dashboard.html` (~2273 lines, 9 inline hex styles
plus ~20 in its `<style>` block — more than the original estimate).

### Step 3 — the rebuild — CURRENT, started 2026-07-20

Steps 1 and 2 fixed *colour*. They did not fix the thing that made colour hard to fix: there is
no component layer (16 shared classes to ~290 page-owned — see *Component inventory* above).
Continuing component-by-component keeps paying that tax. So the unit of work changes from
"a component" to "the layer".

**Scope decision, 2026-07-20:** student surfaces first — `index`, `report`, `login`, then
`teacher.html` triage. **`dashboard.html` is deferred**, left working on the bridge. It is 2,256
lines and ~half the total cost on its own, and it is the teacher deep-dive rather than a surface
students sit inside. Revisit after the student side is on one vocabulary; retiring it in favour
of a view built from the artifact's roster screen is a live option.

**Revisited, session 6:** rebuilt in place rather than retired — the product owner's call was
that the existing IA (Overview/Class/Assignment/Student tabs, drill panels, side tray) is worth
keeping, but the two main tables should adopt the visual cleanliness of the artifact's roster
screen. See the session 6 log entry.

| | Step | Nature |
|---|---|---|
| 3a | Derive the inventory — every component, tagged artifact / derive / merge / dead | analysis — **done** |
| 3b | Delete the dead. Strict re-verification first (see the warning in the inventory) | subtraction — **done** (`report.css` 1092 → 662) |
| 3c | Build `components.css` as the real layer, tokens only, both themes | the rebuild — **done** |
| 3d | Reduce page sheets to layout only; retire bridge aliases as consumers drop | subtraction |
| 3e | Rebuild markup page by page onto the layer, screenshot-verified per page | one page per session — **`report.html` done (sessions 4–5), `dashboard.html` done (session 6) — all pages complete** |

**3d and 3e are one job per page, not two passes.** They were written as separate steps, but a
page sheet can only shrink to layout once its markup consumes the layer — the deletion is the
back half of the rewrite, and doing them apart means reading the same file twice. Take a page:
rewire markup, delete what the page sheet no longer needs, screenshot both themes, commit.
`report.html` first — it is the surface furthest from the system and the one still holding 43
bridge aliases hostage.

Steps 3b and 3d are deletions, and 3d finishes the bridge removal that was already on the books
— which is most of why this is cheaper than it sounds.

### Effort — revised against actuals
The original estimate was ~1–1.5 days wall-clock, bottlenecked on visual regression because
there was "no screenshot harness." **That is no longer true — see *Verifying visually* below.**

Actuals so far: Steps 1 and 2 for `style.css` + `teacher.html`, plus the theme toggle, took a
single session. Session 2 added the chat workspace — six components, one session.

**Revised for the rebuild:** 4–6 focused sessions for the student surfaces, against ~2 for the
token migration alone. The estimate is honest about being larger; what makes it worth paying is
that ~24 implementations collapse to 8 components, and the alternative is patching each of
those 24 forever.

**Out of scope, and worth stating so the word "rebuild" doesn't spread:** the server, the
analysis pipeline, `app.js` logic, and the store are sound. This is the presentation layer only.

The advice that survives unchanged: **don't batch large changes.** That's how you end up
bisecting 200 edits to find one grey panel.

---

## Verifying visually

Neither of the two real bugs this migration found — the white-on-white collapse and the 1.9:1
dark-mode button — was visible in a diff, in a linter, or in a passing page load. Both were
obvious in a screenshot. **Rendering is not optional here; it is the only thing that works.**

There is no npm dependency to install. Chrome is already on the machine:

```bash
node app/server/index.js &                       # http://localhost:8787

"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless --disable-gpu --no-sandbox --hide-scrollbars \
  --window-size=1000,700 --virtual-time-budget=3000 \
  --screenshot=out.png "http://localhost:8787/login.html"
```

Notes that cost time to rediscover:

- **Probe pages beat logging in.** Most surfaces sit behind auth. Drop a temporary
  `app/web/__probe.html` that links `tokens.css` + `components.css` + the page sheet and hand-rolls
  the markup for the components under test. Delete it after. This is how both themes and all
  three header variants were checked without a session.
- **To force a theme,** put `data-theme="light"` or `"dark"` on the probe's `<html>`. Headless
  Chrome otherwise inherits the OS setting, which will quietly mislead you.
- **To test persistence,** seed `localStorage` in a parent page and load the real page in an
  `<iframe>` — same origin, one browser session. `--user-data-dir` profiles hang headless Chrome.
- **`timeout` does not exist on macOS.** Don't wrap the Chrome call in it; the command fails and
  looks like a Chrome problem.
- **Check both themes every time.** The dark-mode contrast bug was invisible in light.
- **Read the console on the same run.** Add `--enable-logging=stderr --v=0` and `--dump-dom`,
  then grep stderr for `CONSOLE`. A screenshot cannot distinguish "not styled yet" from "the
  renderer threw" — three blank tabs looked like unfinished work for two sessions when in fact
  a `ReferenceError` was killing half the page:

  ```bash
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
    --headless --disable-gpu --no-sandbox --enable-logging=stderr --v=0 \
    --virtual-time-budget=9000 --dump-dom "http://localhost:8787/…" \
    2>&1 >/dev/null | grep -i CONSOLE
  ```
- **A blank region is a bug report, not a styling gap.** Before styling anything that renders
  empty, confirm its renderer ran at all.

A cheap non-visual check that has caught real breakage — every `var()` resolving to a defined
token:

```bash
cd app/web
grep -ohE 'var\(--[a-zA-Z0-9_-]+' *.css *.html *.js | sed 's/var(//' | sort -u > /tmp/used
grep -ohE '(^|[;{[:space:]])--[a-zA-Z0-9_-]+\s*:' tokens.css \
  | grep -oE '\--[a-zA-Z0-9_-]+' | sort -u > /tmp/defined
comm -23 /tmp/used /tmp/defined      # must print nothing
```

Anchor the `defined` pattern to more than line-start — `tokens.css` puts a second declaration on
the same line in the band and origin blocks, and a naive `^\s*--` reports 21 false missing tokens.

---

## Open questions

1. **How many lanes before the map stops being readable?** Six is the working ceiling. Longer
   cycles produce more, so something must bundle the tail into "other ideas" — and that rule is
   making an editorial claim about what mattered.
2. **Does the teacher see the same map, or a denser one?** Reviewing thirty maps is a different
   task from reading your own. A small-multiple view — thirty shape-only thumbnails, no labels —
   would let a teacher spot the flat ones instantly. Distinct component, not a resize.
3. **What does the map look like when it's honestly empty?** A student who asked three questions
   and pasted the answers gets one short lane. That image is more eloquent than any score and
   will land harder than a 6/20. Needs copy written *before* anyone meets it in a pilot.
4. **Interrupted submissions.** A draft slot must never be spent on a request that didn't land.
   Server-side idempotency as much as design.
5. **Did collapsing the 17 `--label-*` pairs to 3 families lose anything?** `report.css` already
   grouped them positive/neutral/negative in a comment; tokens.css made that literal. Check the
   report UI before treating it as settled.
6. **`--terra` / `--blue` / `--green` named themselves after colours, not roles.** Bridged as
   attention / neutral-structural / positive. Confirm that matches actual usage.

---

## Known debt

- **d3 loads from a CDN** (`report.html:8`). Under the DPA posture in the plan, that's an
  external request on every report view, and it breaks behind a district firewall. Self-host.
- **The agency chart's value colour is still literal, by deliberate choice, not oversight.**
  Session 5 tokenised every fixed colour in `report.css`/`report-render.js` except three spots
  in `renderHorizChart()`: the per-turn green/terra intensity ramps (`hPosScl`/`hNegScl`), the
  matching legend swatches, and the four-way PASSIVE/NEUTRAL/BUILDING/QUESTIONING axis-zone
  labels. Swapping these onto tokens means first deciding whether a continuous fill keyed to a
  turn's value is compatible with *"semantic colour never touches a student's own score"* — that
  is a design call, not a mechanical retokenisation, and belongs in a session that can also
  answer *Open question 3* below (what the map looks like when it's honestly empty). Everything
  else in that function — grid lines, the zero line, column bands, borders, all text, the
  high/low pattern brackets — is tokenised and reuses the band-2/band-4 "level, not verdict"
  pairing already established for the session verdict chip.
- **`report.css` is fully on `--tau-*`** as of session 5 — 0 legacy `var()` names, every
  remaining hex is inside the three spots above. `components.css` is the third file but not a
  third vocabulary — it is `--tau-*` only, by rule. **`dashboard.html` joined it in session 6** —
  0 legacy names, 0 hex, every `var()` resolving. No page is left depending on the bridge for
  ground/ink/border/accent; a handful of `--muted`/`--text` references survive in `teacher.js`
  and `report-render.js` (script files the doc's per-file audit doesn't cover), plus the
  `--label-*`/`--samr-*` group below.
- **`tokens.css` §4 is scaffolding.** Aliases remain, now held up only by the `--label-*` (17
  pairs) and `--samr-*` (4) groups plus the stray script references above. Six retired earlier
  (`--panel`, `--accent-soft`, `--accent-green`, `--auditor`, `--auditor-soft`, `--danger`).
  Delete each when its legacy name hits zero:

  ```bash
  cd app/web && for n in bg surface border text muted accent terra blue green amber; do
    printf '%-12s %s\n' "--$n" "$(grep -o "var(--$n)" *.css *.html *.js | grep -vc '^tokens.css')"
  done
  ```

  The section is finished when it is empty. The `--label-*` block (17 pairs) and the four
  `--samr-*` aliases are the largest remaining group, and both live entirely in `report.css`.
- **Type scale and spacing are still literals.** The colour migration deliberately stopped at
  colour. `style.css` uses ~12 font sizes against a 7-step scale and hardcoded radii throughout.
  Snapping them will move layout, so it needs its own pass and its own screenshots.
- **No self-hosted UI font.** System stack for now; leading with Helvetica Neue (as v7 did)
  degrades to Liberation Sans on Chromebooks, the dominant device in this market.
- ~~`dashboard.html` and `teacher.html` still ship independent chip/roster-row/modal/turn-shell
  implementations~~ — **resolved 2026-07-22**, see the session log entry. `components.css` gained
  a new section 11 (`.chip`, `.dot`/`.dot-caution`, `.stat-tile`, `.tray`, `.list-row`, and a
  `.msg-superseded` modifier on the existing turn shell); both pages and `report.css`'s `#dt-modal`
  now compose it. Two things this pass found are genuinely *not* duplicates and were left alone:
  `dashboard.html`'s `.talkabout`/teacher's `.moment` (a ruled-edge callout, shaped closer to
  `.quote` than a full `.card`, but not a clean fit for either without restructuring its markup),
  and `report.css`'s `.dt-stat-block`/`.dt-verdict-block` (a segmented row sharing a parent's
  border, shaped like `.dims`/`.dim` rather than the freestanding tinted box `.stat-tile` is for).
  **Correction, 2026-07-28**: that "resolved" was only half true — the *atoms* (`.chip`, `.dot`,
  `.stat-tile`, `.tray`) landed in `components.css` as claimed, but neither page was actually
  audited against them; the very next day's Atomic Design taxonomy pass (2026-07-21, above) found
  and flagged the same duplication again as "Known debt," which sat untouched for another week. See
  the 2026-07-28 session log entry for the pass that actually rewired both pages onto the shared
  atoms rather than leaving them defined-but-locally-duplicated.

---

## Tokens added while migrating (2026-07-20)

Each one exists because a real component needed a value the system couldn't express. None were
added speculatively.

| Token | Why it was needed |
|---|---|
| `--tau-origin-*` (+ `-bg`) | See *Origin encoding*. Replaced a good-bad ramp in a student-facing component. |
| `--tau-meter-track` | The unfilled part of a meter must be a lighter step of the same ramp or the fill floats on nothing. Stays inside forest's sanctioned "meter fills" job rather than opening a fifth one. |
| `--tau-hover-surface` | Row hover had no token and was reaching for the page ground. |
| `--tau-scrim` | Modal backdrop was a raw `rgba(0,0,0,0.4)` — too weak over the dark theme. |
| `--tau-disabled` | Disabled opacity was drifting: `0.55` in one rule, `0.6` in another, `0.5` in a third. |
| `--tau-text-display` | The dashboard hero number is 50px, off the top of the scale, so it was typed as a literal. |
| `--tau-leading-snug` (1.45) | Third leading value already in use in a dozen places with no token. |
| `--tau-track-label` (0.06em) | Ditto for the uppercase micro-label tracking. |

**Deliberately not added:** a forest-tinted surface. Several components wanted one, but the
locked rule gives forest exactly four jobs and a tint fill isn't among them. Those uses became
neutral `--tau-surface-2` with forest *text*, which complies and looks better. `--tau-meter-track`
is the one exception and only because meter fills are already on forest's list.

## Tokens added 2026-07-22 (motion)

| Token | Why it was needed |
|---|---|
| `--tau-dur-short` (150ms), `--tau-dur-medium` (300ms) | Every `transition` in the codebase was a hand-picked literal — six different values in four files, none shared. Values are M3's `short3`/`medium2` rungs, not invented — an initial 120ms/200ms pass read as too fast in review and turned out to sit under M3's own `short` category. See *Motion*. |
| `--tau-ease-standard`, `--tau-ease-decelerate`, `--tau-ease-accelerate` | No easing was ever declared explicitly (bare `ease` or nothing); these are M3's `standard` and `emphasized-decelerate`/`-accelerate` curves, giving symmetric and directional motion one deliberate curve each instead of the browser default. |

## Session log

**2026-08-12 — two Hard Constraints amended for the band/level scale**

No components, no CSS. Both amendments were named as blockers in `tau-dimensions.md`'s
*What this requires of designsystem.md* and are recorded here so neither reads as drift later.

- **The score constraint** — was *"1–5 per dimension, 4–20 total. Never a percentage."* Wrong in
  both halves: the scale is 1–4 or "not enough here", and there is no total, because the four
  dimensions are measured in four different units and are never summed. Added the ordinal
  consequence in the same line, since it is the mistake most likely to be made downstream: **a
  class-level figure is a distribution, never a mean.** A second bullet keeps "not enough here" off
  the ramp — it is not band 0, and it is never hidden.
- **The SAMR constraint** — was *"SAMR is a subtitle, never the primary label."* **Reversed.** It
  was written when SAMR was arithmetic off a total it didn't deserve; the level is now read directly
  and leads. Named, never numbered. The amended line also carries the requirement that the ladder
  states its departure from Puentedura wherever it appears — these levels describe agency, not task
  transformation — because that caveat is easy to drop and the reversal makes it load-bearing.

The `--tau-band-1..4` ramp gains a third consumer (cohort distributions on the teacher dashboard)
without changing: `.band-*`, `.samr-*`, and now the distribution strips are three treatments of one
scale, not three scales. Teacher-surface specifics are in `teacher-dashboard-design.md`'s entry for
the same day. **One open gap raised there and not solved:** quoted *student* transcript text has no
voice treatment — violet is the teacher's words, blue is the tool's, and neither fits primary
evidence. Flagged rather than improvised, per this file's own preamble.

**2026-08-08 — object action menus, danger tier, inline form errors**

Components added while building the teacher dashboard's object action row (full reasoning in
`teacher-dashboard-design.md`'s session log — this entry covers only what landed in the system).

- **`components.css` §14 gains the object-menu half of the menu component**: `.menu-trigger-icon`
  (square, icon-only trigger), `.menu-group-label`, `.menu-item-danger`, and `.obj-actions` (the row
  itself). Deliberately *not* a new component family — same `.menu-panel`/`.menu-item` chrome and the
  same `tauMenu` behaviour as the header's "+ Add", because the two menus are one system split on
  one question (does the action have a subject on screen?), and looking like two would have been the
  bug.
- **`.menu-trigger-icon` renders at 36px to match the `.btn-sm` row it sits in, with a `::after`
  taking the hit region out to the full `--tau-target` 44px.** The token's own comment calls it "a
  real minimum, not advisory," and this is how a visually small control can honour it — expand the
  target, not the box. Worth reusing rather than re-litigating next time a dense toolbar needs a
  compact control.
- **`.btn-danger`** — the first filled control in the app that isn't forest. **Attention, not
  caution**: the caution/attention split (conversation-starter vs. real alert) had only ever been
  applied to *student* signals, and it holds just as well for the teacher's own irreversible
  actions. A destructive confirm is an alert; it does not get amber.
- **`.form-error` + `.field-invalid`** — inline validation, replacing a chain of blocking `alert()`s.
  Also attention-tiered, for the same reason. Pairs colour with an icon and the field outline, never
  colour alone.
- **`.modal.modal-sm` (440px)** — one small modal behind every single-ask action (rename, archive,
  delete, move, grant, restore). The 2026-08 decision that all three *creation* modals share one
  width still holds; this is a different object (one field and one confirm, not a form), not a
  fourth bespoke width for the same thing.
- **`icons.js` gains a menu vocabulary** — `moreHoriz`, `personAdd`, `folder`, `edit`, `archive`,
  `trash`, `copy`, `swap`, `plusCircle`. The "+ Add" menu's three emoji (📄 👤 🗂) were replaced by
  these: `icons.js` existed unused right beside them, and the whole point of that file is that this
  app ships no external icon font. Static chrome declares `data-icon="name"` and gets filled once at
  startup, since markup outside a template literal can't call `iconSVG()`.

**A real accessibility bug this surfaced, in `tauMenu` itself (api.js), pre-existing since it
shipped:** its Escape handler is bound to the *panel*, so it only fires when focus is inside — which
happens on a keyboard-opened menu and never on a mouse-opened one. Every mouse user's Escape did
nothing. Fixed at the page level for now (dashboard.html falls through to `closeAllMenus()`); the
proper fix is in `tauMenu` and would benefit every surface that uses it.

**2026-07-20 — review, v8, tokens**
Reviewed the v7 standalone design system. Found three blockers (wrong dimension names,
percentage scale, undefined friction line), all presentation-layer only — the engine already
emits the right shape. Built the v8 reference doc: seven annotated screens, corrected
foundations, changelog. Resolved three open questions with the product owner (students see all
scores; divergence chart is student-facing; offline needs real states). Wrote `app/web/tokens.css`
with a legacy bridge covering all 61 properties the app consumes. Verified: brace-balanced, no
dangling references, full coverage.

**2026-07-20 (build session) — migration Steps 1–2, theme toggle**

Linked tokens on all five pages and deleted the three legacy `:root` blocks. Then migrated
`style.css` and `teacher.html` off the bridge entirely rather than resting on it — which turned
out to matter, because the bridge was hiding damage rather than deferring it (see Step 1 above).

Added 8 tokens for gaps the system genuinely could not express, retired 6 bridge aliases, and
removed the good-bad ramp from the student-facing origin chips. Built `theme.js` +
`components.css`, put a toggle on all five pages for both roles, and made light the default
regardless of OS.

Three things worth carrying forward:

1. **Screenshots found what nothing else did.** The white-on-white collapse and the 1.9:1
   dark-mode button both passed every non-visual check. The method is now written up under
   *Verifying visually* — the doc's old claim that no harness existed is retired.
2. **A one-to-one alias cannot split an overloaded legacy name.** `--bg` meant two different
   things and the bridge could only pick one. Expect the same in the two remaining files.
3. **Fixing colour surfaced an accessibility debt** the migration didn't cause and didn't fix:
   `--tau-target` is declared but only the new toggle honours it. Logged under *Accessibility
   floor* with the specific offenders.

Also fixed a pre-existing server crash found while testing: `app/server/index.js` parsed the
request URL outside its try/catch, so any request for `//` took the whole process down. Now
returns 400. Unrelated to design, but it was killing the dev server mid-verification.

Next: `report.css`, then `dashboard.html` — the two files still on the bridge, and the two most
likely to be hiding the same overloaded-`--bg` trap.

**2026-07-20 (build session 2) — student chat workspace, v8 screen 1**

Built the workspace components the artifact specifies and the app had nothing for. Verified by
driving the real app in both themes, not a probe — see the note on `state` below.

Shipped: `.btn` system, `.band` chip and `.steps` segmented meter (`components.css`); turn shell
with speaker labels, auditor form treatment, coaching-mode banner, draft-budget track, and the
"Coach is thinking" pulse (`style.css` + `app.js`).

Four things worth carrying forward:

1. **The banner's copy had to change on the server, not the client.** `modeNote` was a single
   sentence ("Coach is in questions mode — it will probe your thinking…") that could not be
   split into the artifact's bold-claim-then-why form without repeating the word "coach" twice
   in eight words. Now `modeLead` + `modeNote` in `coach.js`. This also removed a regex in
   `app.js` that was stripping the `^Coach is in … — ` prefix back off for the dashboard card —
   a client-side workaround for copy that was shaped wrong at source.
2. **`full` coach had `modeNote: null`,** so the banner had nothing to say on draft 1 and the
   dashboard fell back to a hardcoded string. It has copy now, and the banner shows in every
   mode: seeing "later drafts get less of this" on draft 1 is what makes the fade legible
   rather than surprising.
3. **A probe page can't verify JS-rendered components.** The doc's probe recipe covers CSS, but
   the turn shell and thinking state only exist inside `app.js`. The method that worked: a
   temporary same-origin `__drive.html` that logs in with `fetch`, loads the real page in an
   iframe, and calls the app's own functions. **`const state` at the top level of a classic
   script is script-scoped, not on `window`** — reach for `openAssignment()` / `renderTurn()`
   (function declarations, which are) and get data from the API instead. Delete the driver after.
4. **Driving the real app writes to `app/data/`.** Each run created an empty conversation on
   Maya's account. Clean them up or the seeded demo grows litter that looks like student work.

Not done, and deliberately: `.band` and `.steps` are built but nothing consumes them yet. They
belong to the report restructure (screen 3), which is a `report.css` job and wants its own
session — that file is still on the legacy bridge.

**2026-07-20 (build session 3) — Step 3c, the component layer**

`components.css` went from 16 classes to ~60: all eight duplicated concepts now have one
definition. Built from the artifact where it drew them (`.dims`/`.dim`, `.card`, `.confirm`,
`.offline-bar`/`.queued`, `.quote`), derived from the locked rules where it didn't (`.legend`,
`.traj`, `.eyebrow`, `.avatar`, `.field`, the continuous `.meter-track`). Zero hardcoded hexes,
zero legacy names, every `var()` resolving.

Three components **moved** rather than being written new — the turn shell, the origin chips and
provenance bar, and the meter bar. Moving is not the same as building: it is what makes the
definition single. Leaving a copy in `style.css` would have meant `report.css` inheriting
whichever one loaded last.

Four things worth carrying forward:

1. **The origin/provenance block in `style.css` had no consumers at all.** `.prov-bar`,
   `.concept-origin` and the `.origin-*` chips were retokenised in session 1 and logged as
   "Done" — nothing renders them. The report builds its own `.concept-origin-badge` instead.
   So session 1 fixed a component that was already dead while the live one kept its good-bad
   ramp. **"Retokenised" is not "shipped"** — the inventory now tracks *defined* and *consumed*
   as separate columns, because conflating them hid this for two sessions.
2. **Two name collisions, both silent, both found by grepping before writing.** `report.css`
   defined a `.legend` (dead — deleted) and `teacher.js` renders `.dims` as a one-line text
   summary, which the new four-column grid would have wrecked because the page sheet loads last
   and only overrode `font-size`. Renamed to `.dim-line`. **Grep every class name you are about
   to define against `*.html` `*.js` first** — a page sheet loading after `components.css` makes
   a collision partial, and a partial collision looks like a layout bug rather than a name clash.
3. **One deliberate visual change:** the dashboard rail meters. `style.css` filled their track
   with `--tau-surface-2` while `.tau-bar` used `--tau-meter-track`; the merged component keeps
   the latter, so the unfilled track is now a faint step of the same green ramp rather than
   neutral grey. Verified in the real app, both themes.
4. **The `.dim` block is where the report's four broken rules get fixed,** so it is written to
   make them un-reintroducible: no value-keyed colour anywhere in it, and `.dim-val .of` carries
   the denominator as part of the component. A bare "2" is a mark; "2 of 5" is a position.

Verified with a `__probe.html` in both themes (all 60 classes on one page) plus a `__drive.html`
login into the real dashboard, also both themes — the latter needed `localStorage.setItem` on
the parent, since `data-theme` on a driver page does **not** reach an iframe. Both deleted after.

Next: Step 3e on `report.html` — rewire its markup onto the layer and delete what `report.css`
then no longer needs. That is where the layer stops being potential and starts paying.

**2026-07-20 (build session 4) — Step 3e, `report.html` top half**

Rebuilt the report's hero, dimensions, snapshot, provenance and panel shell onto the layer. All
four locked rules the surface broke are fixed (see the corrected findings table above), and the
three-vocabularies-for-four-dimensions problem is half closed — the report uses the engine's
names now; `app.js` still has its own set.

Shipped: `.report-hero` (lede → band chip → total + delta), `.dims`/`.dim` + `.steps` for the
four scores with the reasoning split into a 2×2 detail grid below, `.card` for every panel,
`.eyebrow` for every section header, `.quote` for snapshot strengths, and the origin encoding
across the whole Idea Origins tab. `report.css` went 0 → 114 `--tau-*` references and 162 → 96
hexes; every hex left is in the four tab internals, which is the next session.

**The session's real finding was not a design one.** Five things worth carrying forward:

1. **`render()` had been throwing `ReferenceError: teacherMode is not defined` on every single
   load, for as long as the page has existed.** `teacherMode` was a global in the single-file
   CTA; the port copied the *reference* across but never the definition. It sat two lines after
   the teacher note, so the hero and the panels rendered and everything below — the agency
   chart, My Session, Idea Origins, the pattern guide — silently did not. **Half the report has
   never worked, and it looked fine.** Fixed by deleting the concept: the API already strips
   flags for students server-side, so `analysis.flags` being present *is* the teacher signal and
   the client has nothing to decide.
2. **It was invisible because `load()` is `async` and was called bare.** Every throw became an
   unhandled rejection with no handler, so nothing reached the console and nothing reached the
   user. `load().catch()` now reports it and shows a real message. **An async entry point called
   without `.catch` is a silent-failure generator** — worth grepping the other pages for.
3. **This doc had already recorded the wrong cause.** Session 3 saw the blank chart, blamed the
   d3 CDN debt sitting right next to it, and wrote that down as confirmed. `typeof d3` in
   headless is `true` — d3 was never the problem. Corrected in place above, with the general
   rule: an unverified cause does not go in the doc.
4. **Screenshots find layout bugs; they do not find missing content.** Three empty tabs looked
   like three tabs I had not styled yet. What actually found it was `--enable-logging=stderr`
   on the headless run — now part of *Verifying visually*. Render the page **and** read its
   console; the screenshot alone cannot tell "not built" from "threw".
5. **Two more dead things surfaced once looked at.** `.dim-info-btn` had no handler and
   `.dim-tooltip` had no rule ever setting opacity above 0 — a button that could not show its
   own tooltip, now working on hover *and* `:focus-within`. And `traceProvenance()` was defined,
   never called, and is the only thing that computes the `positions` the heatmap reads — so even
   without the ReferenceError the tab would have thrown. **"Ported" is not "wired".**

The server changed too, which was not expected from a CSS session: the locked rule that a total
never appears without its change since last draft needs prior drafts, and the report endpoint
returned none. It now sends a `history` array of prior totals for the same student and
assignment, dropping drafts still analysing rather than sending nulls — a gap in a sparkline
reads as a dip.

Verified by driving the real app in both themes across three accounts: Maya (band 4, rising
trajectory), Priya as teacher (band 2, a **1 of 5** rendering in the same neutral treatment as a
5, plus the "Worth a chat" panel now neutral rather than pink-on-red), and Priya as student
(flags correctly absent from the API). Console clean on every run.

Next: the four tab internals — the agency chart's own vocabulary (`dt-*`, `div-*`, hardcoded
Helvetica Neue, its blue/terra verdict hues and the white SVG bar grounds), My Session, and the
pattern guide. That is where the last 96 hexes and all 39 remaining bridge references live.

**2026-07-20 (build session 5) — Step 3e, `report.html`'s four tab internals**

Retokenised the last unmigrated surface: My Session, Idea Origins' remaining pieces, Pattern
Guide, the pattern exchange sidebar, and the agency chart's own `dt-*` chrome. `report.css` is
now fully on `--tau-*` — 0 legacy `var()` names, every `var()` resolves, and the only hardcoded
hex left is the three-spot value-ramp debt written up above. `report.css` 657 → 582 lines;
`report-render.js` 1547 → 1371 lines. `dashboard.html` is now the only file left on the bridge.

**About a third of that shrinkage was dead code, not retokenisation** — and finding it mattered
more than the colour swap itself:

1. **Two entire rendering paths were duplicates that never ran.** `renderChartSummary()` /
   `renderDivLegend()` built a `div-summary-strip`/`div-legend` nobody consumed — the live
   summary strip and legend are built inline in `renderAgencyChart()` using `dt-*` classes.
   `computeChartSummary()` duplicated that same inline logic a second time, also uncalled.
   Deleting all three cost nothing and removed ~90 lines that would otherwise have been
   retokenised for an audience of zero.
2. **A sidebar existed with no button that opens it.** `openPatternCatalogue()` populated
   `#dt-sidebar` — a second, near-identical copy of the Pattern Guide tab's card list — but no
   element in `report.html` or `report-boot.js` ever called it or the `#dt-all-patterns-btn` its
   CSS was written for. `showPatternTooltip()`/`#patternTooltip` and `renderTurns()`/`.turn-row`
   were the same shape: fully styled, wired to nothing. All four went with their CSS and the
   dead `<div>`s in `report.html`. **A CSS rule existing is not evidence its markup does** — the
   method that catches this is `grep` the function name for callers before touching its colours,
   not after.
3. **`.grid-line` and `.zero-line` had zero rules anywhere and had been invisible since the
   port.** SVG `<line>` defaults to no stroke; nothing had ever set one. Same failure shape as
   the session 4 `ReferenceError` — a renderer that runs cleanly and draws nothing — found the
   same way: render it and look, not read the JS and assume the CSS matches.
4. **The inventory's `.dt-*` row was still wrong.** It called the whole family "single-file CTA
   leftovers, dead" — corrected in session 4 for the chart itself, but the row text was never
   updated, so this session re-derived the same conclusion from scratch before checking the doc
   already half-knew it. Fixed the row and pointed it at this entry, so a future session doesn't
   do the same rediscovery a third time.
5. **One design decision surfaced repeatedly enough to name once:** every binary or tiered
   agency signal on this page — the session verdict chip, the pattern-group tiers in My Session,
   the pattern sidebar title, the Pattern Guide's high/low card names, the chart's own pattern
   brackets — had independently invented its own blue/terra or green/blue/yellow pair. All of
   them now reuse `--tau-band-2-fg`/`--tau-band-4-fg` (or the three-step ramp for tiers), the
   same ordered, non-good-bad ramp SAMR already uses. One `session-essay-badge` had gone the
   other way — a red dot on "this idea reached your essay," a positive fact rendered as a
   warning — caught on screenshot and moved to a plain sage highlight.

Verified with a same-origin `__driveN.html` pattern (iframe + fetch login, per session 3/4's
method) across Maya (band 4) and Priya (band 2, first draft) — all four tabs, both themes, plus
the pattern exchange sidebar and turn modal opened programmatically. Console clean on every run;
all driver files deleted after.

Not done, and deliberately: the value-ramp colours in `renderHorizChart()` (see *Known debt*)
and `dashboard.html`, which remains the last file on the legacy bridge.

**2026-07-20 (build session 6) — `dashboard.html`, Steps 3d/3e**

Rebuilt the last file on the bridge in place, per the product owner's call: keep the existing IA
(Overview/Class/Assignment/Student tabs, sidebar, drill panels, side tray, flag modal, sortable
columns, behavioral-trend detection) rather than replace it, but adopt the visual cleanliness of
the v8 artifact's teacher roster screen (Screen 6) for the two tables that list students against
scores. Inline `<style>` block retokenised entirely — 0 legacy names, 0 hex, every `var()`
resolving, matching `report.css`'s session-5 state. `.samr-badge` (the four-colour blue SAMR ramp)
and the bespoke `.avatar`/sparkline are gone; the assignment-detail and class-detail tables are
rebuilt onto a new `table.roster` component (`.tbl-wrap`, `.who`, `td.n`) modelled directly on the
artifact's markup, with a `bandChip()` helper producing the same plain-language-first, SAMR-
subtitle-only band chip the report already uses.

**The real finding was a voice-rule violation, not a colour gap.** Every "flag" signal on this
page — the header button, sidebar dots, table badges, the side tray icon — rendered in
`var(--terra)` (attention/red) with a `⚑` glyph and the word "review". That is the exact mistake
*Origin encoding* and the report's flag panel already fixed once: a conversation-starter dressed
as a verdict. `teacher.html`'s `.cycle-chip.flagged` already uses `--tau-caution`, so the pattern
existed in the codebase — `dashboard.html` alone hadn't been brought over. Fixed throughout:
every "flag" surface is now `--tau-caution` (amber, matching how the report treats a low score),
the `⚑` glyph is gone in favour of a quiet dot (`.flagdot`, `.signal-pill-review`), and the copy
changed from "review"/"Flag detection" to "Worth a chat" — the exact phrase the locked design
rules specify for this column and the artifact's own roster mock uses.

Four things worth carrying forward:

1. **A distinction the fix had to preserve:** "missing submission" is a real deadline problem —
   it stayed `--tau-attention` (red) throughout. Only the behavioral/integrity "worth a chat"
   signal moved to caution. Conflating the two would have either downgraded a real overdue-work
   problem or re-escalated a conversation-starter into a verdict.
2. **`sparklineSVG()` had zero callers** — same shape as session 5's dead `renderChartSummary()`
   in `report.css`. Found by grepping for its name before touching its colours, not after; deleted
   rather than retokenised. The `.sparkline` CSS class went with it.
3. **Three dead sort branches surfaced once the roster table replaced the old five-column
   layout:** `sortStudents()` still branched on `'submissions'`, `'samr'`, and `'status'` — columns
   that no longer exist in the new table. Trimmed to the two that do (`name`, `tau`), and deleted
   the now-unreferenced `STATUS_ORDER` map with them.
4. **`theme.js` stomps a hand-set `data-theme` attribute unconditionally** — `apply(stored() ||
   'light')` runs on every load regardless of what markup shipped with. The *Verifying visually*
   probe trick ("put `data-theme` on the `<html>` tag") only works for a page that doesn't link
   `theme.js`; for a real page, force the theme by seeding `localStorage.tau-theme` before the
   page's own script runs instead — the persistence-testing method the doc already documents,
   just not yet connected to this specific failure mode. Cost one dead-end round of screenshots
   before the fix was obvious.

Verified with a same-origin driver (`fetch` login, then `document.write` the fetched page into
the same window — the iframe-cookie trick from sessions 3–5 silently 401'd here because
`dashboard.html` declares its data with `let` at top level, which never lands on `window` for a
polling check to read; confirmed the API directly instead) across all four tabs, the drill panel,
and both themes. Console clean on every run; driver file deleted after.

Not done, and deliberately: the `--label-*`/`--samr-*` alias group in `tokens.css` §4 (now the
only thing keeping the bridge section non-empty, along with a few stray `--muted`/`--text`
references in `teacher.js` and `report-render.js`), and the value-ramp colours in
`renderHorizChart()` (see *Known debt*) — both pre-existing, neither touched by this session.

**2026-07-21 — brand-as-ground, then report score hierarchy**

Two changes in one session, both colour-hierarchy work, no markup restructuring beyond the
report hero.

**Forest reclassified from accent to brand colour.** The product owner's original ask ("green as
an accent") should have been "green is the brand colour" — the previous locked decision ("white
ground, forest as accent only") was quietly the thing making the app read as "white-washed with
a green accent" rather than a branded tool. Added a whisper-quiet forest wash (oklch chroma
0.006–0.010, same hue as forest) to `--tau-bg`/`--tau-surface-2`/`--tau-surface-3`/`--tau-line`
in light theme only — `--tau-surface` (cards, panels) stays pure white so content still separates
from the ground, and dark theme is untouched (the existing "charcoal, not forest" rule still
holds — a tinted dark theme becomes a green room, which this change does not want either).
Verified: every `var()` still resolves, login screen screenshot in both themes, contrast
unaffected because only chroma moved, not lightness.

**Report score hierarchy rebuilt** after the wash made the existing report read flatter than
before — every card, number, and label was close enough in size and weight that nothing told a
reader where to look first. Two changes, both about visual weight rather than new layout:

1. **Hero reordered.** The total score used to render *after* the narrative lede and the band
   chip, so a glance landed on a sentence before the number. Now the total leads (`--tau-text-
   display`, 50px, forest, weight 700), the band chip and trend sit beside it, and the lede
   becomes a caption below a hairline rule — supporting text, not the opening line.
2. **The four-dimension strip's number now dominates its own card.** `.dim-val .n` went from
   19px to 24px/weight 700/forest; `.dim-name` dropped from 14.5px/600 to 13px/500/`--tau-ink-
   soft`. The two were close enough in size before that the label competed with the number for
   attention inside a four-column strip that's supposed to be scannable at a glance.

**Forest on a score numeral needed its own justification**, because "semantic colour never
touches a student's score" is a locked rule and colouring the score forest could look like the
same mistake with extra steps. The distinction: semantic colour (positive/caution/attention)
varies *by value* — a verdict. Forest here is fixed regardless of value — confirmed by screenshotting
Devon's 5/20 next to Maya's 20/20: both numerals render in identical forest, at identical weight,
same as the SAMR band pip already does. Written into *Rules that constrain design choices* so a
future session doesn't have to re-derive this the same way.

Verified across three accounts via a same-origin driver (fetch login, then `location.replace` to
the real report URL — `document.write`ing the fetched HTML does not carry the query string, since
the document's own location doesn't change; discovered this before it cost a session): Maya
draft 3 (20/20, rising trend, light and dark), Devon draft 1 (5/20, Substitution band, light) —
low score renders with the same visual confidence as the high one, nothing about the new
hierarchy reads as harsher at the bottom of the scale. Driver file deleted after; no submissions
or sessions written to `app/data/` (both accounts only hit login + report GET).

- **2026-07-21 (Atomic Design taxonomy + card/chip/modal dedup)** — Adopted Atomic Design's
  vocabulary for the file split that already existed (tokens → atoms/molecules in `components.css`
  → organisms/templates in page sheets → pages), with a sharpened promotion rule: *same pattern on
  2+ surfaces, identical → promote; a page sheet may lay a promoted component out but not redefine
  its chrome.* An inventory pass found the same three patterns reinvented independently: `.card`
  vs `.acard`/`.pcard` (different radius/padding each time — `.acard`'s values turned out to be an
  exact match for `.card-lg`, pure duplication; `.pcard`'s were ~1-2px organic drift, resolved onto
  `.card`'s own values rather than kept as a third size); the SAMR colour ramp defined twice
  (`.band-1..4` as a filled pill, a private `.samr-*` border mapping using the identical
  `--tau-band-N-fg` tokens); and three scrim+box implementations, one of them (`.scrim`/`.confirm`)
  built in Step 3c and never wired up. Deduped all three: `.acard`/`.pcard` now compose `.card`/
  `.card-lg` (plus their urgency edges turned out to duplicate `.card-edge-caution`/
  `.card-edge-attention` too — same fix); the `.samr-*` mapping moved into `components.css` next to
  `.band-1..4`; the index.html submit-draft dialog and report.html's turn-detail modal
  (`#turnModal`/`.turn-modal-box`) both now compose `.confirm` for chrome, each keeping only their
  own size override (`.confirm-lg`, and a local `max-width` respectively). Picked up `.confirm`'s
  actual design intent in the process — the submit warning became a `<ul>` naming both real
  consequences instead of one run-on sentence, since `.confirm`'s own comment says a paragraph
  hides the list's fourth item (only two exist here; no new content invented to fill a third).
  `#turnModal`'s `.open`/`display:none` toggle convention (JS-driven, different from the `.hidden`
  utility everywhere else) was left alone — chrome dedup only, not the interaction plumbing.
  **Not touched, tracked as debt**: `dashboard.html`/`teacher.html`'s independent chip/roster-row/
  modal/turn-shell implementations, and `report.css`'s second modal (`#dt-modal-overlay`). Verified
  headless in both themes: student home (card/chip rendering unchanged), the submit modal open
  (new bullet-list warning, correct sizing), and the report turn-detail modal — the last of which
  turned out to have **no live caller anywhere in the current UI** (`showTurnModal` is dead code,
  the same shape of finding as session 5's other dead rendering paths), so it was verified by
  invoking the function directly rather than through a click path. Console clean on every run.

**2026-07-22 — closing the debt: `dashboard.html`, `teacher.html`, `report.css`'s second modal**

Picked up the 2026-07-21 inventory's punch list and finished it: an audit of the actual files (not
just the doc's prior notes) found the debt was larger than logged — a status-chip shape
independently built 6+ times (`dashboard.html`'s `.chip*`/`.status-*`/`.flag-type-*`/`.arc-badge`/
`.reflect-type-badge`/`.score-delta`, `teacher.html`'s `.cycle-chip`/`.teacher-badge`), a stat-tile
built inline three times (`statTile()`) plus once more in `report.css`, four independent "quiet
caution dot" implementations, and two unrelated modal mechanisms in `dashboard.html` (a centred
dialog and a sliding tray) neither composing `.scrim`/`.confirm`.

Added five atoms/molecules to `components.css` (section 11 above) and rewired all three files onto
them, in the order the risk profile suggested: the mechanical one first (`report.css`'s
`#dt-modal-overlay`/`#dt-modal` → composes `.scrim`/`.confirm`, same pattern `#turnModal` already
set), then `dashboard.html` (the larger, more JS-heavy file), then `teacher.html` (the one with
the most structural change — see below).

Five things worth carrying forward:

1. **Two literal duplicates turned out to be identical values, not just similar shapes** —
   `dashboard.html`'s `.status-final/-draft/-not-started/-missing` were an exact bg/fg match for
   `.chip-positive/-caution/-grey/-attention`, and `.arc-delta`/`.arc-delta-inline` were the same
   caution pair defined twice in the same file. Both collapsed onto the shared names rather than
   being kept as page-owned aliases.
2. **A `::before` pseudo-element can't carry a second class**, so `.signal-pill-review::before`'s
   circle stayed a literal value-match to `.dot-sm`/`.dot-caution` with a comment pointing at the
   recipe it copies, rather than actually composing it — the one dedup in this pass that's
   traceable but not mechanical.
3. **`teacher.html`'s transcript view now visually matches the live chat** — `.t-turn`'s flat
   background rows were replaced with `.turn`/`.msg`/`.turn-student`/`.turn-coach`/`.turn-auditor`,
   so an archived session in the teacher's view uses the same self-aligned bubble encoding a
   student sees while chatting. This is a real visual change (row → bubble), not just a class
   rename, and was screenshotted in both themes before trusting it. The one feature `.t-turn` had
   that the shared shell didn't — a superseded-turn state — became `.msg-superseded` on the shell
   itself (section 6) rather than a one-off page rule.
4. **A leftover voice-rule violation surfaced while touching `.cycle-chip`**: `teacher.js` was
   still appending a `⚑` glyph to a flagged cycle chip's text, the exact "alert iconography on a
   conversation-starter" mistake session 6 fixed on `dashboard.html` but never carried to
   `teacher.js`. Removed — the caution colour and the chip's own words already carry the signal.
5. **Two things this pass considered promoting turned out not to fit and were left alone,
   deliberately**: `teacher.html`'s `.moment`/`.moment.warn` (a ruled-edge callout with no
   background or full border — closer in shape to `.quote` than `.card`, but its `.m-kind`/
   `.m-quote`/`.m-why` internal structure doesn't map onto `.quote`'s quote/quote-src pair without
   a markup rewrite this pass didn't want to risk) and `report.css`'s `.dt-stat-block`/
   `.dt-verdict-block` (a segmented row sharing one parent border, the same shape as `.dims`/`.dim`
   rather than `.stat-tile`'s freestanding tinted box). Forcing either would have been the
   "judgment call every time" the promotion rule was written to avoid.

Verified with same-origin drivers (fetch-login, then either an iframe with `contentWindow` calls
for interactive states — the flag modal, the side tray, the report's drill-through modal — or
`location.replace` for static views) across the teacher account, both themes, on `dashboard.html`
(Overview/Class/Assignment/Student tabs, the flag modal, the side tray, a drilled-in student
detail), `teacher.html` (roster overview, a student detail page with its transcript expanded), and
`report.html` (hero plus the `#dt-modal` opened directly). A temporary `__probe.html` covered the
one state no seeded data exercises (`.msg-superseded`). Console clean on every run; all driver and
probe files deleted after. The `var()`-resolves audit from *Verifying visually* also re-run clean.

**2026-07-22 (later same day) — one global nav, replacing three independent headers**

Reviewed the three student screens (dashboard/home, chat workspace, report) for cohesion and
found no shared wayfinding at all: `.app-header` on the home view, a bare sidebar back-arrow in
the workspace, `.report-topbar` on the report — three unrelated headers with no reference to one
another. First pass proposed a `Home / Chat / Report` tab bar; corrected before building, because
the actual IA is strictly hierarchical, not three peer destinations. A conversation belongs to
exactly one draft (`sessions` collection, `cycleIndex`); a report belongs to exactly one submitted
draft (`submissions`); a submitted draft carries *both* a locked conversation and a report, an
in-progress draft carries only a conversation. Confirmed against the actual data model
(`app/server/store.js`, `app/server/index.js`) rather than assumed.

Built one `.tau-nav` (`components.css` section 12): a fixed mark, a breadcrumb (`All assignments
› Assignment › Draft N`), and a **local** Report/Conversation toggle that only renders when both
genuinely exist for the draft on screen — Report leads and is active by default there, since it's
what a student came to see after submitting. No class segment in the crumb: `app/server/index.js`
still synthesizes one class per student (no real class entity), so a class-switcher would be
designing for data that doesn't exist yet. The crumb-building helpers (`renderNavCrumbs`,
`renderNavLocal`) live in `api.js`, shared between `app.js` and `report-boot.js`, so the two never
drift onto their own markup for the same component the way `style.css`/`report.css` did before.

`index.html` restructured so the nav is a true single persistent element (a sibling of both views,
not duplicated inside each) — the account chip and theme toggle now mount once, not once per
view. `report.html`'s `.report-topbar` is retired; the report endpoint
(`GET /api/submissions/:id/report`) now returns `assignmentId`/`assignmentTitle` on the submission,
which the nav needs and nothing asked for before. `app.js` gained `?open=<assignmentId>&cycle=`
handling so the local toggle's "Conversation" link can land a student in that exact draft's most
recent conversation rather than the assignment list.

**One real bug found by screenshotting, not by reading the diff**: `.account-chip`/
`.account-signout` lived only in `style.css`, which `report.html` never linked — so the sign-out
button rendered as a bare unstyled native `<button>` there the moment it moved into the shared
nav. Moved the rule to `components.css`, self-contained (border/radius/colour all declared, not
leaning on a page's own generic `button` reset) rather than assuming every consumer has one — the
same lesson section 12's other rules already follow. Verified via the same-origin
fetch-login-then-redirect probe (`__probe.html`-style, deleted after) across all three nav states —
root, an open draft, a submitted draft with the toggle — in both themes.

Not touched: `dashboard.html`/`teacher.html` keep their own `.tab-nav` — a separate audit, since
that surface already has its own working wayfinding.

**2026-07-22 (evening) — depth, shape, and a second colour doing real work**

Product owner review: the rebuilt surfaces were tokenised and consistent but read as clinical —
flat bordered cards, one hairline shadow value applied everywhere, sage present in the token file
but consumed in about six places, and a static three-dot "thinking" row indistinguishable from any
web loading spinner. Prototyped three passes as artifacts before touching code — a forest/sage
rebalance, a mark/type/motion pass (parked; brand identity turned out to mean look-and-feel, not
the logo), and a depth/shape/motion pass — then applied the accepted parts of the third to the
chat workspace, report, and student dashboard.

**Landed in code:**
- `.card` (`components.css`) now carries `box-shadow: var(--tau-shadow)` in addition to its
  existing hairline border — additive, not a replacement, so nothing that already looked fine
  broke. Because `.acard` and the report's `summaryPanel`/`snapshotPanel`/`tabsPanel` already
  compose `.card`/`.card-lg`, this one change lifted the assignment cards and every report panel
  without touching `app.js`, `style.css`, or `report-render.js` markup.
- New `.card-hero` modifier: `--tau-r-xl` radius, `--tau-shadow-lift`, transparent border. Applied
  only to the report's score hero (`report-render.js`'s `card card-lg card-hero report-hero`) —
  the one panel per screen that's the actual takeaway gets one more step of both radius and
  elevation, so shape carries hierarchy instead of leaving it to border and font-size alone.
- `.tau-nav-local-opt.active` (the Report/Conversation toggle) and the report's `.tab-btn.active`
  both move from forest to sage. Reasoning carried over from the palette prototype: these are
  wayfinding state ("which of two views am I on"), not the primary action, so forest stays
  reserved for the one thing that actually moves a student forward on a given screen. The report
  tab bar itself changed shape to match — a `--tau-surface-2` tray with a filled sage pill
  (`--tau-origin-together-bg`, reusing the existing origin token rather than inventing a new sage
  fill) for the active tab, replacing the underline. Reads as a control being operated, not a
  paper form's section dividers.
- `.btn-primary`, `.submit-btn`, `.acard-btn` all pick up a soft forest-tinted shadow
  (`color-mix(in oklab, var(--tau-forest) 45%, transparent)`, same pattern the band pip already
  used) — the one primary action per screen now reads as raised, not just forest-on-a-rect.
- The "coach is thinking" dots (`style.css`) gained a soft sage glow via `box-shadow` alongside
  their existing `bob` animation. Smallest change in the pass, but this is the one moment the
  product is visibly an AI reasoning in real time rather than a static form, so it earned a touch
  more presence than a plain loading dot.

**Not landed, deliberately deferred:** the mark/logomark redesign (thread-motif glyph) and the
Geist type pairing — product owner clarified "brand identity" meant look-and-feel, not the logo,
so those two prototypes are parked rather than adopted. The "coach is thinking" breathing-orb
treatment and streaming-text reveal from the prototype were also not built into the real chat —
today's pass kept the existing dot indicator and only added the glow; a full orb/streaming rebuild
of `thinkingIndicator()` in `app.js` is a larger, separate piece of work.

**Verified:** logged in as `maya@school.dev` via Playwright (installed on the dev machine, not an
app dependency), screenshotted home/workspace/report in both themes. No white-on-white, no
invisible text, no console errors. The token-resolution check (`comm -23` against `tokens.css`)
still prints nothing.

**Correction, same evening:** the first pass above was too conservative against what the artifact
actually showed and got approved — a shadow was added, but the shape-language changes (bigger
radius, pill-shaped primary actions, a tightened/tinted sidebar) were quietly dropped without
flagging it, so the live app barely looked different from before at normal zoom. Separately,
`dashboard.html` (teacher) was never touched at all — it hand-rolls its own inline-styled boxes
rather than composing `.card`, so it stayed completely flat while the student surfaces moved,
which is its own real inconsistency (tracked, not fixed this session — out of the originally
agreed scope of chat/report/assignment).

Second pass actually closed the gap:
- `.acard` (`app.js`'s `currentCard()`) now also carries `card-hero` — assignment cards get the
  same bumped radius + lift as the report hero, not just the base `.card` shadow.
- `.btn-primary`, `.acard-btn`, `.submit-btn` are now pill-shaped (`--tau-r-pill`), not just
  shadowed rectangles — this was the single most visible thing missing from the first pass.
- `.sidebar` (workspace) and `.dash-rail` (student home) both moved to `--tau-surface-2`, so the
  structural rail reads as a deliberately quieter register next to the content it frames, per the
  artifact's "considered, not competing" pitch. `.rail-avatar` moved to `--tau-surface-3` so it
  doesn't blend into its own now-tinted parent.
- `.draft-section-current` (the active draft in the workspace sidebar) moved off `--tau-surface-2`
  — once the sidebar itself uses that token, the old active-state fill stopped reading as active.
  Now `--tau-origin-together-bg` (the existing sage-tint token, reused rather than inventing a new
  one) plus a 2px sage left border.

Re-verified the same way (Playwright, both themes, home/workspace/report) after this pass —
screenshots now visibly match the artifact's shape language rather than technically containing the
tokens but reading the same as before.

**2026-07-24 — student assignment dashboard: ground colour, attention hue, draft-row rebuild, teacher notes, icons**

A run of smaller passes on `index.html`'s assignment dashboard, each checked against a mockup
artifact before landing:

- **Ground.** `.dash-main` (the assignments-view content pane) moved off `--tau-bg`'s forest wash
  to flat white — the wash is right for the page shell but was reading as dinginess once the
  student's actual content (assignment cards) sat inside it. Dark theme untouched.
- **Attention colour.** `--tau-attention` moved from hue 32 (terra/red-orange, ~126° from the
  sage/ground hue) to hue 18 ("clay") in all four theme blocks. Reasoning, in order: terra sat too
  far from sage for analogous harmony and short of true complementary contrast — the zone that
  reads as noise rather than signal. First candidate was a plum/violet (hue 352, nearer sage's true
  complement) but that collides with the auditor voice's own hue (300), which already owns "second
  voice, not the coach" as a locked distinction — reusing an adjacent hue for an unrelated meaning
  undoes that. Clay stays in the true-red family (institutional software's established "problem/
  overdue" signal) while rotating enough off pure orange to break the red-green vibration. Verified
  contrast (all combinations clear WCAG AA, several with more margin than the original terra).
- **Draft-row ledger rebuilt three ways:**
  1. *Radius.* The ledger was a flat, hairline-divided list — zero radius anywhere except the
     current-draft row — against a system where radius is a deliberate, load-bearing signal
     elsewhere (`.card`/`.card-lg`/`.card-hero`, every chip, every button). Rows now sit in
     `gap`-separated boxes at `--tau-r-md`, the current draft steps up to `--tau-r-lg` (same
     "important thing gets the next radius step" move as `.card`→`.card-lg`), and the SAMR band
     accent moved from a hard `border-left` (which fights a rounded corner) to an inset
     `box-shadow` stripe — the same fix `.card-edge-caution/-attention` already used.
  2. *Score removed from the ledger.* A submitted draft no longer shows its score/SAMR band inline
     — a number invites reading as a grade, and the ledger isn't where a student should be forming
     their read of a draft; that's the report's job. `BAND_META` and the score/denom/band markup
     came out of `draftRow()` entirely (dead code, not hidden via CSS).
  3. *Content hierarchy standardized to three fixed lines* regardless of state — identity
     (`Draft N · due date · final badge`), status (one word, its own line), functionality (button,
     report link, or the reason there's nothing to do) — so a locked row and an in-progress row
     visually rhyme instead of each showing whatever fields happen to apply.
  Demo seed data (`seed-data.js`/`seed.js`) rebuilt alongside to actually exercise every state
  across the 5-student class rather than only ever showing submitted-and-scored or not-started:
  Maya (submitted+note, in-progress, locked+final), Devon (not-started+overdue, locked+due-soon),
  Priya (submitted+still-analyzing), Luis (submitted+errored analysis) — plus draft due dates
  changed to `[-1, 2, 8]` days so overdue/soon/calm tones all have a real example, not three
  shades of "later."
- **Teacher notes — two distinct surfaces, several iterations.** Draft-level notes (tied to one
  submission) went from a full `.acard-note` block — which was visually burying the row's one real
  action ("View report") — to a small flag next to the link; the note text itself only ever reads
  on the report page (already built). Found and fixed a real pre-existing bug while in that code:
  the "View report" link's condition never checked `status.detail`, so it silently overrode
  "Analyzing your draft…"/"Report unavailable" on incomplete analyses. Assignment-level notes (not
  tied to any draft) are new: `teacherNote`/`teacherNoteAt` on the assignment record, a
  `POST /api/assignments/:id/note` endpoint mirroring the existing per-submission one, no
  authoring UI yet (same deferral as draft-level notes on in-progress work — teacher-dashboard
  territory). Display went through three shapes before landing: (1) a second `<details>` disclosure
  stacked under the rubric's, (2) reordered above the rubric with a truncated preview of the note's
  own text in the closed summary, (3) final — the rubric moved out entirely into a slide-in tray
  (below) since two stacked full-width disclosures cost vertical space the actual ask didn't need,
  leaving the note as the one thing still inline: closed label reads plain `Teacher's note`, and
  the chip itself carries the auditor/violet tint as background even closed, not just as text
  colour — colour is what signals "this carries weight," not a preview string.
- **Rubric moved to a tray, not a disclosure.** The prompt/rubric text is often genuinely long
  (full grading criteria) and was pushing every other card element down whenever a student had it
  open. `.tray`/`.tray-overlay` already existed in `components.css` for the teacher dashboard's
  flag detail but had never been used on the student side — reused wholesale rather than building
  a second drawer pattern. New `openTray()`/`closeTray()` in `app.js`, lazily constructed once. A
  quiet `.btn-quiet.btn-sm` button next to the assignment title opens it now.
- **"View report" button aligned to the component system.** Was a one-off `.draft-row-link` (naked
  text + arrow) — the only place in the app doing that. First pass moved it to `.btn-tertiary`,
  which turned out to have `border-color: transparent` by design (reads as plain text until
  hover — no visible change at rest, caught on screenshot). Landed on `.btn-quiet` instead, same
  component the tray trigger uses, with a real border at rest.
- **Icon system introduced.** The app had no icon library — one hand-drawn chevron plus Unicode
  glyphs (✉ ✕ →) standing in everywhere else, most visibly a missing icon for teacher notes at
  all. New `icons.js`: self-hosted inline SVG (`ICONS` map + `iconSVG(name, class)`), hand-drawn to
  Material Symbols Outlined's silhouette (24dp grid, stroke, round caps/joins) rather than the
  Material Symbols webfont/CDN — the app loads zero external resources today (system fonts only,
  `tokens.css`) and a font dependency would break that. `.tau-icon` base rule added to
  `components.css` (section 3b). Six icons landed: `chat` (teacher notes — a note reads as
  "someone said something," not correspondence, so `chat_bubble`'s shape over an envelope),
  `expandMore` (the pre-existing chevron, now named/shared), `close`, `description` (View report),
  `arrowForward` (Continue/Start), `checklist` (Prompt & rubric). Not yet on `teacher.js`/
  `dashboard.html` or the workspace's `reading-banner-return` — left alone as out of this session's
  surface, not forgotten.

**Worth carrying forward:**
1. **A shared component can go unused on half the app without anyone noticing.** The tray existed,
   fully built, for two build sessions before this one and had exactly one caller (the teacher
   dashboard). Worth a periodic sweep of `components.css` for definitions with a single consumer —
   that's either dead weight or, like the tray, a missed reuse.
2. **`reportId` being unconditionally truthy silently masked a whole status branch.** The bug (View
   report always winning over "Analyzing…"/"Report unavailable") existed before this session and
   would have kept existing indefinitely — it only surfaced because the row's branching logic was
   being read closely for an unrelated reason (the hierarchy rebuild). Branch conditions that look
   right in isolation are worth re-deriving from the data, not just trusting the existing `if`/`else if` order.
3. **Self-hosting the icon set was a direct consequence of an existing constraint (system fonts
   only), not a default choice.** Worth restating for whoever adds the next icon: reach for
   `icons.js`'s hand-drawn-SVG pattern, not a font/CDN, even though the latter is the more common
   default elsewhere.

**2026-07-26 (WIP, uncommitted) — `report.html` IA: tabs → sections + sticky jump nav**

Diagnosis: the report had grown dense enough (hero, four-dimension overview, three tab panes,
growth moves) that a student had no map of what the page contained and no way back to a section
without re-clicking through the tab bar. Reworked the middle of the page rather than adding a
table-of-contents on the side: the three tab panes (My Session / Agency Chart / Who's Driving)
are now permanently-visible top-level `.card` sections instead of hidden panes, and a new sticky
`.report-jump` nav sits between the hero and the sections — five buttons (Overview, My Session,
Agency Chart, Who's Driving, Next Time), click-to-scroll plus an `IntersectionObserver`
scrollspy that marks the current section with the same sage "current location" tint
`.tau-nav-local-opt.active` and My Session's own `.group-nav` already use. Deliberately reused
that existing idiom rather than inventing a new active-state treatment.

**Persistent score, without new vertical space.** The ask was to keep the TAU score visible while
scrolling without pinning the full hero. Solve landed inside the same sticky bar rather than a
second one: a `.report-jump-score` chip (`renderJumpScore()` in `report-render.js`) sits collapsed
to zero width at the jump nav's left edge and expands in (`max-width`/`opacity` transition) only
once a second observer confirms `#samrHero` has scrolled out of view — so the score is one glance
away at any depth, but never doubles up with the real hero while it's on screen.

**Follow-up pass, same session:** the five section labels were still using `.eyebrow` — the
system's one sanctioned uppercase micro-label (assignment name in the hero, "Worth a chat" on the
teacher panel) — which read as quiet and, worse, sat at a different vertical offset per section
because Overview and Next Time were on plain `.card` (16px top padding) while the other three were
on `.card-lg` (20px). Fixed both at once: new `.report-section-title` (19px/700/ink, sized one
step above `.dim-quad-name`'s existing "name a thing inside a card" treatment, not a louder
`.eyebrow`) and all five sections standardised onto `.card-lg` so the title lands at the same
offset everywhere. Agency Chart's title shares a row with the Bars/Trend toggle; that row's
`align-items` moved from `baseline` to `center` since the toggle's 13px buttons no longer
baseline-matched a 19px title.

Verified server-side only so far (`/api/auth/login`, `/api/submissions`, and the report endpoint
all return clean 200s with real TAU data for Maya's drafts) — no headless-browser tool was
available in this environment to screenshot the actual render, so the visual result has not been
confirmed in a browser yet. **Not committed** — still being iterated on; do that before starting
a fresh session on other report work, per the doc's own advice against carrying WIP across
sessions in your head instead of in git.

Touches: `app/web/report.html`, `app/web/report.css`, `app/web/report-render.js`,
`app/web/report-boot.js`. Superseded in this same pass: the `.tab-bar`/`.tab-btn`/`.tab-pane`
rules session 5 wrote for this exact page — worth noting since it's the second time this file's
tab treatment has been rebuilt from scratch.

**2026-07-27 — `dashboard.html` catches up to the depth/shape pass and the icon system**

Closed the two gaps the 2026-07-22 depth/shape session explicitly logged as "never touched" for
this file: it was still flat (no `.card`-style elevation anywhere) and still hand-rolling motion
and glyphs the rest of the app had already standardised. Tokens themselves were already clean from
session 6 — this pass didn't touch colour.

- **Depth.** Added `box-shadow: var(--tau-shadow)` to `.overview-card`, `.reflection-arc`, and
  `.tbl-wrap` (the roster table's own container, previously border-only), plus the six inline-
  styled "card" boxes in `renderOverviewContent()` (the review list, each trend card, the all-clear
  state, each assignment card, the "no open assignments" empty state, each class-health row) —
  these had no shared class to promote onto, so the shadow was added as a literal alongside their
  existing literal background/border/radius rather than forcing a `.card` composition that would
  have changed their padding and introduced `.card`'s `flex-direction:column;gap` onto content that
  currently spaces itself with manual margins. Deliberately **not** shadowed: `.sub-row`,
  `.arc-entry`, `.assignment-summary-row`, `.class-student-row` — these are dense list/row items,
  the same tier as a table row or `.list-row`, neither of which carries elevation elsewhere in the
  system either.
- **Motion.** All eight literal `transition` durations in the page's inline `<style>` block
  (`0.1s`, `0.15s`, `0.18s`, one bare `all 0.1s`) replaced with `--tau-dur-short` +
  `--tau-ease-standard`, matching the token pairing every other page already uses for hover/state
  changes. The modal-overlay fade (`opacity 0.18s ease`) became `--tau-dur-medium` +
  `--tau-ease-standard` — a scrim toggle is symmetric, not a directional enter/exit, so `-standard`
  over `-decelerate`/`-accelerate`, but the fade itself reads better at the medium rung than short.
- **Icons.** Linked `icons.js` (previously not on this page at all, per the icon system's own
  session-4 note). Replaced both `✕` close buttons (flag modal, side tray) with `iconSVG('close')`
  — set via a two-line init script since these are static buttons, not JS-templated, mirroring the
  one place `app.js` already does this for a close control rather than the more common
  template-string pattern the other four icons use. Replaced both hand-rolled disclosure chevrons
  (`▸`/`▾` text swapped by JS, and a `::before content` triangle on a native `<details>`) with
  `iconSVG('expandMore', ...)` plus a `transform: rotate(180deg)` on the open state — the exact
  mechanism `components.css`'s `.acard-disclosure-icon` already established, just not composed
  directly since these two triggers aren't `<details>`-based in one case and needed a same-shaped
  sibling rule in the other. **Left alone, deliberately:** the `←` back-link, `→` in
  `.list-row-action`/"Report →"/the reflection-arc separator, and the sort-column `↑`/`↓`/`⇅`
  glyphs — none of these have an icons.js equivalent, and every other page's matching pattern
  (`.list-row-action`'s "View →", `.back-btn`'s `&larr;` on `teacher.html`) is also still plain
  text, so leaving them was matching the rest of the app, not skipping work.

Verified with a same-origin iframe driver (fetch-login, then a step list of selector clicks with
waits between each) across all four tabs, the flag modal, the side tray opened from a real flagged
submission, and a reflection disclosure opened on real data (Priya Nair, who carries three
integrity flags) — plus dark theme on the Overview tab. Console clean on every run except the
driver's own "selector not found" logs when a click target happened to be data-dependent (e.g. the
first `tr.row-clickable` in sort order having no submissions) — not a page bug. Driver file deleted
after.

**2026-07-28 (evening) — dashboard.html/teacher.html closed out of "Known debt," two new colour
rules, alert-colour-on-descriptive-chip fixed**

Prompted by a concrete bug report: `dashboard.html`'s overdue-checkpoint chip rendered the plain
label `Draft 2/3` in `--tau-attention` red — the identical red a genuine "missing work" chip uses
elsewhere — with nothing in the text itself saying "missing" or "overdue." A reader scanning by
colour alone couldn't tell a merely-in-progress checkpoint from an alert one. That's a specific
case of a rule the system never actually wrote down (it had the analogous rule for scores, not
chips), and pulling that thread led to the *Atomic Design taxonomy* section's own admission that
`dashboard.html`/`teacher.html` were explicitly skipped in the 2026-07-21 pass ("Known debt," never
revisited). A full read-only audit against `components.css` confirmed the gap: page-local
reinventions of shared chrome, several genuine colour-tier violations beyond the one reported, and
a colored-dot pattern used as decoration in several places with no adjacent text.

1. **Two new Colour rules** (see *Rules that constrain design choices → Colour* above): alert-tier
   chip colour must match what the label itself claims, never carry an alert through colour alone
   on a descriptive/positional/taxonomic label; and a dot is only used when no adjacent text/icon
   already states the same fact — generalizing `dashboard.html`'s own pre-existing `.sb-shortcut`
   comment into a system-wide rule.
2. **Colour-tier violations fixed**, `dashboard.html` + `teacher.html` + `teacher.js`:
   `checkpointStatus()`'s overdue label now reads `Draft 2/3 · Late` instead of relying on colour
   alone (fixed-width columns widened to fit); on-time drafts moved off `chip-caution` onto
   `chip-neutral` (a normal in-progress state isn't a caution); assignment open/closed, reflection
   type badges, the pattern-card student-count chip, and `teacher.html`'s "Teacher" role chip all
   moved off borrowed alert/caution tints onto `chip-neutral`; the Change/score-delta columns no
   longer render a small decline in `chip-attention`/`--tau-attention` (the sign already states the
   direction; only genuine improvement keeps a semantic colour, per the existing "teacher-side
   direction-of-travel signals" allowance); `teacher.js`'s cycle chip puts its flag count in visible
   text instead of a title-only tooltip. **Deliberately left alone**: the roster filter chips
   (`.stu-chip[data-filter=…].active`, the Patterns dropdown's `.set` state) — their own label text
   already states the filter's meaning ("Worth a chat," "Missing work," a pattern's own name), so
   colour there reinforces text rather than substituting for it, the same "redundant, not
   colour-alone" case the missing-submission-count text already was.
3. **Decorative dots removed**: the tray header's dot, both `.flagdot` wrappers (an orphaned class,
   defined nowhere), `.signal-pill-review`'s `::before` circle, `teacher.js`'s `●` glyph, and the
   sidebar's per-class/per-assignment trailing dots (no replacement — the missing-first sort and
   the bounded Students shortcut counts already carry that fact elsewhere on the same screen).
4. **A real bug, not a redesign**: `dashboard.html` silently redefined `components.css`'s
   `.stat-tile`/`.stat-tile-val`/`.stat-tile-label` by reusing the exact class names (different
   padding/min-width/font-size/weight) — any future edit to the shared component would have been
   invisible on Home. Local override deleted; Home now renders from the one definition.
5. **Known-debt chrome duplication closed**: a `.list-row-boxed` modifier added to
   `components.css`'s `.list-row` and applied to the three near-identical bordered rows
   `dashboard.html` had built independently (`.class-student-row`, `.assignment-summary-row`,
   `.sub-row`); the flag-explainer modal's interior (`.modal-header/-title/-intro/-close/-body`,
   `.flag-card-section/-body`) rewired onto the exact `.tray-*` classes the side tray two elements
   below it already used, rather than the byte-for-byte local copy it was; `.stu-chip`/`.chip-dd-btn`
   and `.arc-badge`/`.reflect-type-badge` (each pair an identical declaration block a few lines
   apart) merged into one class each; nine local reinventions of the uppercase micro-label
   (`.sidebar-section`, `.group-label`, `.browse-class-label`, `.drill-panel-header`, `.arc-label`,
   `.reflect-label`, two inline copies) adopted the existing `.eyebrow` atom, keeping only their own
   margins local; the sidebar search input and Browse Students' search input gained
   `min-height: var(--tau-target)` (both were missing the accessibility floor `.field input` already
   enforces); `.back-link` (a pill duplicating `.btn .btn-quiet` chrome) replaced with `.btn
   .btn-quiet .btn-sm` at all four header call sites, and the one site applying it to a
   non-interactive `<span>` (the signed-in teacher's name) got its own minimal `.whoami` class
   instead of a button class with the interactivity stripped back out; `teacher.html`'s undefined
   `.back-btn`/`.app-header` classes (rendering unstyled, a real gap, not a style choice) given real
   rules, and `teacher.js`'s bare buttons plus `.submit-btn` wired onto `.btn`/`.btn-primary`; dead
   `.overview-card` (zero markup consumers) deleted; a bespoke `8px` card radius on two inline Home
   blocks and `.reflection-arc`'s outlier `--tau-r-sm` both corrected to the `--tau-r-md` every
   other instance of this exact chrome already used.

Verified live (`node app/server/index.js`, Playwright, both themes): Home, Browse Students (all
three class tables), Class detail, Assignment detail + drill panel, the flag-explainer modal, and
`teacher.html`'s overview/new-assignment-form/student-detail screens. Console clean on every
screen in both themes.

---

**2026-08-07 — one rail, replacing four independently-built sidebars**

Prompted by a one-line question: "we don't have a sidebar component?" We did not. Four surfaces
had each grown a vertical rail from scratch and agreed on nothing.

| Surface | Was | Width | Ground | Active state |
|---|---|---|---|---|
| Student home | `.dash-rail` (`style.css`) | 292 | surface-2, no border | none — hover only |
| Workspace sessions | `.sidebar` (`style.css`) | 290 | surface-2 + border-right | surface-2 fill + forest text |
| Teacher dashboard | `.sidebar` (`dashboard.html` inline) | 240 | surface + border-right | **forest 10% tint** + 3px marker |
| Admin | `.admin-nav` (`admin.html` inline) | 224 | none — bare column | surface-2 fill + forest text |

Three of the four active states argued their case in a code comment and **the cases contradicted
each other**: admin's said a neutral `--tau-surface-2` wash plus forest text was right and reserved
fills for the one forward action; dashboard's said that exact wash was too weak in light theme and
tinted with the brand hue instead. Both were careful. Neither knew the other existed. That is the
actual cost of a missing component — not the duplicated declarations, the duplicated *reasoning*.

Two of them were live constraint violations, not just drift:

1. **`.sidebar-item.active`'s forest tint** (`color-mix(--tau-forest 10%, --tau-surface)`) — a
   forest-tinted surface fill, which Hard Constraints allows only for `--tau-meter-track`. Its
   argument was real (a neutral wash on a *white* rail is a near-invisible 3% lightness shift) but
   the system's answer to "colour alone is too weak" is a second channel, not a seventh forest job
   — and that row already had a 3px marker doing exactly that.
2. **Two rails shipped sub-44px rows** — `.conv-item` ~36px, `.admin-nav-item` ~34px, against a
   token whose own comment calls it "not advisory."

Built `.rail` (`components.css` §13) on the toned-rail/lifted-pill option, chosen from three
mocked in light theme. Three regions, because a rail's contents fall into three groups and only
one scrolls: `.rail-head` (identity, search, the make-a-new-thing action), `.rail-body` (the list),
`.rail-foot` (pinned via `margin-top: auto`). Plus `.rail-group` + `.eyebrow`, and `.rail-item`
with `-text` / `-name` / `-sub` / `-meta` slots, `.rail-item-nested` for a row that filters the row
above it, and `.rail-inset` for admin's — the one rail that doesn't run full height and would
otherwise read as a stray grey rectangle on the page ground.

**The active state, and why the tint stopped being needed.** Hover darkens to `--tau-surface-3`;
selection *lightens* to `--tau-surface` plus `--tau-shadow`. Two directions off one ground, so the
two states can't be confused. On a toned rail white is a step *up* in lightness — which is exactly
the contrast the dashboard's tint was invented to manufacture, now available without opening a
forest job. Same construction as `.tau-nav-local-opt.active`, the one place in the system that had
already solved this. Colour is the third channel, never the first.

One new token: **`--tau-rail-w: 272px`**. The four old widths (292/290/240/224) were not derivable
from anything in `tokens.css`. 272 is the narrowest that holds the student rail's two-line rows
without wrapping and gives the teacher rail ~30 characters of class name. Flagged in the token's
own comment as a judgement call — **the system has no rule that produces a rail width, and that is
a real gap**, not something this session closed.

Also folded in: `.rail-label` (an 11px/700/0.07em near-duplicate of `.eyebrow`) deleted in favour
of `.eyebrow`; `.rail-avatar` deleted in favour of `.avatar .avatar-lg` plus one scoped
`.rail .avatar { background: --tau-surface-3 }` (the atom's own surface-2 ground is the rail's
ground — an invisible circle); the dashboard's search input moved off `--tau-bg`, which is
*lighter* than `--tau-surface-2` and so inverted the well it was meant to be.

**One IA fix.** The student rail's `"Jump to"` heading became `"Current assignments"` — a label
names the content it stands over, never the action the reader is about to take on it (Morville &
Rosenfeld's labeling rule; the standing label check in the `product-design-review` skill). It
deliberately repeats the heading of the section it indexes, which is what makes it an index.

**Three bugs the screenshot caught that nothing else did**, which is the third time this file has
had to say so. (a) `.rail-foot` was a bare block, so the workspace's Submit draft collapsed to
text width — the old `.sidebar-footer` had been a flex column and that was load-bearing. (b) The
student rail's progress panel is the tall region and its body is the short one, so pinning the
foot clipped the meters; that rail scrolls as one column instead (layout-only override in
`style.css`). (c) `.rail-progress > .eyebrow` never matched — `renderRail()` builds the heading
*inside* `.rail-block`, not as its sibling. All three passed the token-resolution check, the
JS parse, and the 200-response check.

**Left in place, flagged not fixed:** `table.roster tr.expanded-row` carries the same forest tint,
propagated from the sidebar rule that no longer exists. Its comment now says so. A table row can't
lift onto a different plane the way a rail row can, so it needs its own second channel (an edge
marker, most likely) before the tint comes off — a separate decision, not part of the rail work.
Separately, `.tau-nav-local-opt.active` sets `color: var(--tau-sage)`, against the "sage is
fill-only, never text" constraint. Pre-existing, untouched.

Verified: `.rail` rendered in all four configurations against the real `tokens.css`/`components.css`
(headless Chrome, light theme), plus the dashboard rail with its own inline sheet loaded; every
`var(--tau-*)` in every sheet and inline block resolves; `app.js`/`admin.js` parse; all five pages
return 200. **Not verified: the live authenticated pages in a browser** — the harness renders the
component, not the running app, and dark theme was not screenshotted.
