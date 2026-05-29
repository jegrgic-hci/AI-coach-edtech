# Teacher Dashboard — Design Documentation

## Purpose

A teacher-facing view of the Critical Thinking Auditor. Gives educators a structured way to monitor AI engagement across their classes, assignments, and individual students. Surfaces integrity flags without exposing them to students.

---

## Navigation Model

Three top-level tabs. The sidebar content and main content area both respond to the active tab.

| Tab | Sidebar | Main content |
|---|---|---|
| Class | List of classes | Selected class: assignment list grouped by Open / Closed |
| Assignment | List of assignments grouped by Open / Closed | Selected assignment: student roster grouped by class period |
| Student | List of students grouped by class, with search | Selected student: submission history per assignment |

Clicking across views navigates contextually — e.g. clicking an assignment in the Class view expands it inline rather than switching tabs.

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

## Class View

Shows all assignments for the selected class.

**Assignment list:**
- Grouped into Open (top) and Closed sections
- Within each group: sorted by most recent due date first
- Columns: Assignment name + due date, Submitted count, Class spread bar (SAMR distribution), Flags

**Submission count:** shown in red when the assignment is closed and not all students have submitted.

**Class spread bar:** stacked SVG bar showing the proportion of students at each SAMR level (Redefinition → Modification → Augmentation → Substitution → not submitted).

**Inline expand (clicking an assignment row):**
- Expands a student list panel below the row
- Closed assignments: unsubmitted (missing) students pinned at top with red tint
- Open assignments: not-started students at top
- Each student row shows: name, submission status chip, TAU score, SAMR badge, flag indicator
- Clicking a student navigates to their Student detail view
- "View full assignment →" link goes to the Assignment tab

---

## Assignment View

Shows all students for the selected assignment, grouped by class period.

**Group headers** divide the student list by class (e.g. "Period 3 — Digital Literacy"). At scale (5 classes, 30–40 students) this is essential for scanning.

**Columns:** Student, Submissions, Latest TAU, SAMR, Status, Flags

**Flags column:** shows only `⚑ Flagged` or `—`. Details are not shown in the table — the teacher must expand the row.

**Inline expand (clicking a student row):**
- Shows full submission history for that student on this assignment
- Submissions shown in reverse chronological order (most recent first)
- Each row: `#N` → Draft/Final chip → date → TAU score → PQ/SU/CS/OC breakdown → SAMR badge
- Flags appear as plain-text descriptions below the submission row, each with a "Learn more" link
- "Learn more" opens a side tray with: flag name, what it means, why we flagged it, potential next steps

---

## Student View

Shows all assignments for the selected student, each with their full submission history.

**Submission order:** most recent first (Final at top).

**Each submission row:** `#N` → Draft/Final chip → date → TAU score → PQ/SU/CS/OC breakdown → SAMR badge (fixed 100px width for alignment)

**Flags:** same plain-text + "Learn more" pattern as the assignment view drill panel.

**Student header:** shows name, class, and a `⚑ Flagged` badge if any flag exists across any assignment.

---

## Flag System

### Integrity flags (from TAU analysis)
| Key | Short name | Signal |
|---|---|---|
| `stylistic-inconsistency` | Stylistic inconsistency | Vocabulary/complexity shifts sharply between student turns |
| `unnatural-fluency` | Unnatural fluency | Student turns lack hedging and false starts typical of live composition |
| `provenance-mismatch` | Provenance mismatch | Concept in essay attributed to student but AI introduced it first |
| `shadow-session-pattern` | Shadow session pattern | High passive acceptance, very low pushback — consistent with pre-polished inputs |

### Algorithmic flag
| Key | Signal |
|---|---|
| `score-spike` | TAU score jumped significantly between two submissions within a short time window (≤10 min, +5 pts total or +3 on any single dimension) |

### Flag UX rules
- Flags are **never shown to students** — teacher view only
- In table views: only a `⚑ Flagged` indicator — no details
- In drill panels: plain-text description per flag + "Learn more" link
- Side tray (opened by "Learn more"): full explanation — what it means, why we flagged it, potential next steps
- Sidebar indicator: `⚑` icon in terra red next to student/assignment name

---

## Side Tray

Right-side panel (400px) that slides in when a teacher clicks "Learn more" on a flag. Contains:
1. Flag name + short description in the header
2. **What this means** — plain explanation of the signal
3. **Why we flagged it** — the reasoning behind the detection
4. **Potential next steps** — numbered action items

Closes via the `✕` button or clicking the dimmed overlay.

---

## Visual Language

**Iconography:** `⚑` is the universal flag indicator across all contexts — sidebar dots, table badges, drill panel notes, and side tray header.

**Status chips:** consistent pill shape. Green = Final, Amber = Draft, Terra/red = Missing, Grey = Not started.

**SAMR badges:** fixed 100px min-width in submission rows so labels align across rows.

**Alignment:** all table cells left-aligned. Horizontal cell padding 12px.

---

## Open / Future Work

- [ ] Real data integration (currently uses hardcoded mock data)
- [ ] Assignment creation / management flow
- [ ] Export / print view per assignment
- [ ] Sorting and filtering within assignment student list
- [ ] Class-level SAMR trend over time
- [ ] Per-student comparison across assignments (growth view)
