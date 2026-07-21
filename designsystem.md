# TAU Design System — working doc

Living document for the design layer of `app/`. Companion to `built-in-chat-plan.md`
(which owns product/architecture decisions) and `app/README.md` (implementation).
**Read this before any design or CSS work in `app/`.**

**Status as of 2026-07-20.** Tokens linked and live on all five pages. `style.css`,
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

### Colour
- **Forest gets six jobs and no others:** interactive text, primary fills, meter fills, the rule marking a system message, the light-theme ground wash (2026-07-21), and — new the same day — a student's own score numerals (`.report-total-n`, `.dim-val .n`).
- **Sage is fill-only.** It fails contrast as text.
- **Neutrals stay neutral past the ground wash.** The page background (`--tau-bg`/`--tau-surface-2`/`--tau-surface-3`) carries a whisper of forest; card surfaces (`--tau-surface`), shadows, and panel fills do not. The wash is one deliberate, quiet exception — it is not licence to tint greys generally.
- **Forest on a score numeral is brand identity, not a verdict, because it never varies with the value.** A 5/20 and a 20/20 render in the exact same colour and weight — this is the one place a value-keyed rule could look like it's being broken, so it's worth stating why it isn't: *semantic* colour (positive/caution/attention) still never touches a score. This is a fixed brand treatment applied uniformly regardless of the number, same category as the SAMR band pip.
- **Semantic colour (positive/caution/attention) never touches a student's own score.** A level is a position on a path, not a verdict. Semantic is for direction-of-travel and teacher-side signals only.
- **SAMR band foregrounds step down in lightness 1→4.** Do not reorder — the ramp carries meaning in greyscale and for colour-blind readers on its own.
- **Colour is never the only channel.** Anything encoded by hue is also encoded by shape, weight, dash, or text.

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

Preference is stored per browser, not per account. Correct for a display setting, but worth
knowing on shared Chromebooks: one student's dark choice greets the next student on that machine.
Move it to the user record if that turns up in a pilot.

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
| Turn shell (`.turn` / `.msg` / auditor form) | `components.css` (moved out of `style.css`, 3c) | index chat |
| Origin chips + provenance bar | `components.css` (moved, 3c) | report Idea Origins · `.concept-origin-badge` deleted |
| Card (`.card` + edge modifiers) | `components.css` (3c) | report (all panels) · `.panel` `.summary-card` deleted |
| Four dimensions (`.dims` / `.dim`) | `components.css` (3c) | report · `.summary-card` deleted |
| Legend (`.legend`) | `components.css` (3c) | report provenance · `.prov-legend-*` deleted; `.div-legend-*` `.dt-legend-*` remain |
| Trajectory sparkline (`.traj`) | `components.css` (3c) | report hero · rail still uses `.trend-svg` |
| Continuous meter (`.meter-track`) | `components.css` (moved, 3c) | dashboard rail |
| Submit confirmation (`.confirm`) | `components.css` (3c) | — · `.modal-*` still ships, names one consequence not four |
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

## Session log

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
