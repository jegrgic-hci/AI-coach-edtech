# Teacher Dashboard — Design Documentation

## Purpose

A teacher-facing view of the Critical Thinking Auditor. Gives educators a structured way to monitor AI engagement across their classes, assignments, and individual students. Surfaces integrity flags without exposing them to students.

The guiding principle: **guide first, detail on demand.** Teachers have many students and limited time. The dashboard surfaces who needs attention and why in plain language — TAU scores and dimension breakdowns are available but never the primary display.

---

## Navigation Model

Three top-level tabs. Each tab opens to an **Overview** landing screen before any specific item is selected. Selecting an item from the sidebar switches to its detail view.

| Tab | Sidebar | Default content | Detail content |
|---|---|---|---|
| Class | Overview item + list of classes | All classes at a glance | Selected class: assignment list grouped by Open / Closed |
| Assignment | Overview item + list of assignments grouped by Open / Closed | All assignments at a glance | Selected assignment: student roster grouped by class |
| Student | Overview item + search + filter + student list | All students by priority | Selected student: submission history per assignment |

Clicking across views navigates contextually — e.g. clicking an assignment in the Class view expands it inline rather than switching tabs.

---

## Overview Screens

Each tab defaults to an overview. Teachers land here on first visit and can always return by clicking "Overview" in the sidebar.

### Class Overview
One card per class showing:
- Student count + assignment count
- Open assignment submission rates (submitted / total per assignment, terra if any missing)
- Flagged students with signal pills

### Assignment Overview
Cards grouped Open → Closed (open sorted by due date ascending, closed by recency descending). Each card shows:
- Assignment name, open/closed chip, due date
- Submission count (terra if missing submissions on closed assignments)
- SAMR distribution bar
- Flag count badge
- Flagged students with per-assignment signal pills

### Student Overview
Students grouped by signal priority: **⚑ Needs review** → **● Attention** → **On track**. Each card shows:
- Name, class, signal pill
- Latest TAU score + SAMR badge
- For review: which assignment(s) are flagged
- For attention: the behavioral reason

All overview cards are clickable — navigates directly to that item's detail view.

---

## Data Model

- **Assignment** — has a status (`open` / `closed`) and a due date. Not class-specific; any student can have submissions against any assignment.
- **Submission** — one TAU session result per student per assignment. Students can submit multiple times. Each submission has `pq`, `su`, `cs`, `oc` dimension scores (1–5 each, total 4–20) and optional `integrityFlags`.
- **Submission status** — derived from submissions + assignment status:
  - `Final` — assignment closed, student has submissions
  - `Draft` — assignment open, student has submissions
  - `Missing` — assignment closed, no submissions
  - `Not started` — assignment open, no submissions
- **Language rule** — assignments are `Open` / `Closed`; student submissions are `Draft` / `Final`. Never use "closed" or "final" for the wrong entity.

---

## Flag System — Two-Tier Hierarchy

Flags are split into two distinct tiers with different visual weight. The goal is to avoid alert fatigue — if everything is P0, nothing is.

### Tier 1 — Submission-level flags (terra red ⚑)
Discrete events on a specific submission. The detail lives on the submission row itself. The signal pill on the row is shorthand for "expand to see what happened" — no banner is shown because the flagged sub-row already surfaces the full context.

| Key | Signal |
|---|---|
| `stylistic-inconsistency` | Vocabulary/complexity shifts sharply between student turns |
| `unnatural-fluency` | Student turns lack hedging and false starts typical of live composition |
| `provenance-mismatch` | Concept in essay attributed to student but AI introduced it first |
| `shadow-session-pattern` | High passive acceptance, very low pushback — consistent with pre-polished inputs |
| `score-spike` | TAU score jumped significantly between two submissions in a short window (≤10 min, +5 pts total or +3 on any single dimension) |

### Tier 2 — Assignment-level signals (amber ●)
Behavioral patterns computed across all submissions for a student on an assignment. Not tied to any single submission — these have no other place to surface, so they appear as a banner when the drill panel is expanded.

| Condition | Reason shown |
|---|---|
| Latest score < first score by >2 pts (min 3 submissions) | "Engagement declining across recent submissions" |
| Average total < 9 | "Passive engagement across all submissions" |
| Average CS < 2.5 and PQ < 2.5 | "Tends to accept AI responses without questioning" |
| Average CS < 2.5 | "Rarely challenges or refines AI suggestions" |
| Average OC < 2.5 | "Most ideas appear AI-initiated" |

### Flag UX rules
- Flags are **never shown to students** — teacher view only
- **⚑ Review pill** — indicates at least one flagged submission; the specific flags are visible inside the drill panel on the submission row, not echoed as a banner
- **● Attention banner** — shown at the top of the expanded drill panel only for assignment-level behavioral patterns (amber background)
- **Signal reason sub-line** — shown below student name in collapsed rows only for attention signals; review rows rely on the drill panel to tell the story
- "Learn more" link on each submission flag opens a side tray with full context

---

## Student Signal System

Converts raw TAU scores and flags into a plain-language status. Used everywhere a student name appears. `getStudentSignal(studentId, assignmentId?)` — if `assignmentId` is provided, scoped to that assignment only.

### Signal levels

| Status | Display | Tier |
|---|---|---|
| `review` | `⚑ Review` (terra red) | Submission-level — integrity flag or score spike detected |
| `attention` | `● Attention` (amber) | Assignment-level — passive or declining behavioral pattern |
| `on-track` | _(no indicator)_ | No signals |

Review takes priority over attention. Signal logic evaluates in that order.

### Where signals appear

| Surface | Review | Attention |
|---|---|---|
| Sidebar / overview cards | Pill only | Pill only |
| Student name in table rows (collapsed) | Pill only | Pill + reason sub-line |
| Student name in table rows (expanded) | Pill only (reason sub-line hidden) | Pill only (banner takes over) |
| Drill panel banner | Not shown (submission rows have the detail) | Amber banner with reason |
| Student detail header | Pill + reason in meta line | Pill + reason in meta line |

---

## Class View

Shows all assignments for the selected class.

**Assignment list:**
- Grouped into Open (top) and Closed sections
- Within each group: sorted by most recent due date first
- Columns: Assignment name + due date, Submitted count, Class spread bar, Flags

**Submission count:** shown in red when the assignment is closed and not all students have submitted.

**Class spread bar:** stacked SVG bar showing the proportion of students at each SAMR level (Redefinition → Modification → Augmentation → Substitution → not submitted).

**Inline expand (clicking an assignment row):**
- Expands a student list panel below the row
- Closed assignments: unsubmitted (missing) students pinned at top with red tint
- Each student row shows: name + signal pill + attention reason (if any), submission status chip, TAU score, SAMR badge
- Clicking a student navigates to their Student detail view
- "View full assignment →" link goes to the Assignment tab

---

## Assignment View

Shows all students for the selected assignment, grouped by class.

**Columns:** Student (name + signal pill), Submissions, Latest TAU, SAMR, Status

Signal reasons are not shown inline in collapsed rows for review students — they expand to the drill panel to see the specific submission flags.

**Inline expand (clicking a student row):**
- Attention banner shown at top of drill panel (assignment-level behavioral pattern)
- No banner for review — submission rows show the flags directly
- Submissions in reverse chronological order; each row has fixed-width columns for consistent alignment across expanded students

---

## Student View

Shows all assignments for the selected student, each expandable into submission history.

**Student header:** name, overall signal pill, class, signal reason.

**Assignment rows** (fixed-width columns for consistent alignment across all assignments):
| Column | Width | Content |
|---|---|---|
| Assignment name | flex:1 | Title, truncated |
| TAU score | 48px, right | `15/20` format |
| SAMR badge | 110px, centered | Level label |
| Signal pill | 80px, centered | Empty container when no signal |
| Status chip | 88px, centered | Final / Draft / Missing / Not started |
| Subs count | 44px, right | `3 subs` |

**Submission history (expanded):**
- Attention banner at top (assignment-level pattern only)
- Submissions most recent first; each row uses fixed-width flex columns so layout is identical across all expanded assignments

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

## Student Sidebar — Search and Filter

**Structure:** Overview item → divider → search box → filter chips → student list.

**Search:** free-text input filters by name.

**Filter chips:**
- **All** — full student list grouped by class
- **⚑ Review** — only students with a review-level signal
- **● Attention** — only students with an attention-level signal

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

**Two-tier color system:**
- Terra red (`--terra`) — submission-level integrity concerns: ⚑ pills, flagged sub-rows, missing submission counts
- Amber (`--amber`) — assignment-level behavioral patterns: ● pills, attention banners, attention reason sub-lines

**Signal reason:** 11px muted text below student name. Only shown for attention signals in collapsed rows. Never a raw metric or flag key — always plain language.

**Status chips:** Green = Final, Amber = Draft, Terra = Missing, Grey = Not started.

**SAMR badges:** fixed 100px width in submission rows, 110px in assignment summary rows.

**Alignment:** fixed-width flex columns in all drill panels and assignment summary rows — layout is consistent regardless of content variation.

---

## Open / Future Work

- [ ] Real data integration (currently uses hardcoded mock data)
- [ ] Submission detail view — teacher opens a specific submission in CTA teacher mode (full TAU analysis + flags visible)
- [ ] Assignment creation / management flow
- [ ] Export / print view per assignment
- [ ] Sorting within assignment student list (by signal, by TAU, by status)
- [ ] Class-level SAMR trend over time
- [ ] Per-student comparison across assignments (growth view)
- [ ] Teacher mode in CTA — same view as student with integrity flags panel visible, student/assignment context in header
