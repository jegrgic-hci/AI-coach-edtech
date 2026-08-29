# CTA — Critical Thinking Auditor

## Start here — which codebase are you in?

This repo holds **two things**. Most current work is in the second.

| | What | Status |
|---|---|---|
| **`index.html`** (+ `teacher-dashboard.html`) | The original single-file paste-in CTA. Everything below in this file describes *this*. | Mature. **Do not modify** — it must stay revertible (pre-Path-B state: commit `1b1c36c`). Code is copied *out* of it into `app/`, never edited. |
| **`app/`** | Path B — the built-in chat app students actually use: login, coach chat, submission pipeline, reports, teacher dashboard. | Where active work happens. |

**For any work on `app/`, read `built-in-chat-plan.md` first — it is the source of truth** for design decisions, phase status, the backlog, and a session log of what each build session did. `app/README.md` is the implementation companion (seams, test accounts, what's built, what isn't).

**For any design, CSS, or UI work in `app/`, also read `designsystem.md`** — locked decisions, colour and voice rules, component inventory, and the implementation plan. Start with its **Hard Constraints** section (top of the file, right after the status paragraph) and treat it as blocking: before implementing a visual decision, cite which line in Hard Constraints or *Locked decisions* justifies it. If nothing there covers the case, that's a gap in the system, not licence to improvise — say so and ask instead of inventing a decision and running with it. The system itself lives in `app/web/tokens.css`. The v7 standalone design-system HTML at the repo root is **superseded**; do not build from it.

**For any work on the TAU dimensions — scoring formulas, `scoreTAU`, the classification labels, or whether a dimension measures what it claims — read `tau-dimensions.md`.** It owns dimension definitions, rubrics, and validity evidence; `built-in-chat-plan.md` owns everything else. Both edit `app/server/analysis.js`, which is the one place they overlap. **Start with its *The scoring foundation* section and treat it as blocking — settled 2026-08-11.** The dimensions are not scored 1–5 and there is no 4–20 total. Each is a question read from the transcript, the essay and the assignment together, coded against a published scheme (task initiative; Wineburg's source-evaluation heuristics; Faigley & Witte revision analysis; knowledge transforming vs telling), and the output is *evidence* — a claim, the quoted moments supporting it, and the moment that doesn't. **Anything in that file describing `mapTo5`, ratio formulas or a total is historical.** **None of it is built**: the shipped code still runs the old formulas, PQ still reads 5 on nearly every transcript, and `scoreTAU(classified, provenanceData)` cannot see the transcript, essay or assignment — that signature change gates all four dimensions. **Then read *The measurement model* and treat it as blocking too:** the four dimensions are facets of one construct on a 2×2 grid (whose material × where observed), each owning exactly one cell, and no dimension may be changed in a way that moves it out of its cell or lets two dimensions increment off the same observed event. **Never validate a measure against the demo seed** (`app/data/`, `seed-data.js`) — measured 2026-08-10, authored transcripts carry structure real sessions don't, so anything calibrated on them is calibrated on an artifact. The seed is a design fixture for building UI, nothing more.

**For any work on behavioural patterns, `detectTrends`/`TREND_META`, the per-student "Worth a chat" signals, or the thresholds behind either — read `patterns.md`.** It owns what counts as a pattern (versus a score or a flag), the six detectors, and the level-signal/pattern split that decides which of them is cohort-relative. **The current pattern layer is a naming layer, not a detection layer** — three of its four cards are dimension thresholds with prose names, so do not treat a pattern card as evidence of the behaviour it describes without reading that file first.

**For any work touching student identity, sign-in, rosters, or personal information in student work
— read `pilotuser.md`.** It owns the `codeRoster` grant, the two `identity` types (`'email'` and
`'code'`), the `username`/`handle` scheme, access codes as passwords, and the masking contract of the
measurement-improvement export. **Two rules there are load-bearing and easy to break by accident:** a
student's `username` and a teacher's `handle` are minted once and **never recomputed**, so changing
the slug rules after accounts exist is a migration and not an edit; and any scan of `users` on email
must guard `u.email &&`, because a code-roster account has no address and an unguarded
`u.email.toLowerCase()` throws on the first one it reaches — breaking sign-in for *every* account in
the store. It also owns the position on personal information: the tool never **collects** any, cannot
prevent a child **typing** some, and detects **self-identification rather than names** (`pii.js`) —
name detection is the wrong question, not a harder version of the right one.

**The whole teacher dashboard was rebuilt on bands and flows across 2026-08-16/17 — start at
`teacher-dashboard-design.md`'s *Where the surfaces stand*, which is authoritative and lists what is
still open.** Large parts of that file describe deleted surfaces and are marked **⚠ SUPERSEDED**.
There is **no line chart anywhere in `dashboard.html`**; change over time is a **flow, never a line**
(a line asserts a rate through a gap nothing was measured in). Two rules generate the rest: **a bar
is a reading of ONE TASK, a flow is a reading of A SEQUENCE** — so Home has no composition, since
pooling levels across classes running different work compares non-comparable readings; and **on an
incomplete cohort show what has a per-student denominator (patterns) and withhold what has a
per-class one (distributions)** — never patched with a caveat. Read `designsystem.md`'s *Dimension
band labels* before writing any band copy: **a teacher never sees a band numeral.** Every reading on
every tier is one of exactly two things: **agency (level + trend)** or **a dimension (band + trend)**
— there is no total, no mean and nothing out of 20 in the measurement. The **student view is the one
surface not yet rebuilt**, so the retired totals it still emits are stale code, never the model.

**For any work on `app/web/dashboard.html` (the teacher triage surface), also read `teacher-dashboard-design.md`** — IA, the flag/signal system, and a session log scoped to that page. Covers `dashboard.html` only, not `teacher.html` (assignment creation, transcripts, notes — see `app/README.md`'s file map for that surface instead).

Run it: `npm install` once, then `npm run start:demo` → http://localhost:8787. **Use `start:demo`, not `start`** — the demo seed is opt-in (`SEED_DEMO=1`) as of 2026-08-08, and plain `npm start` seeds nothing because that is what production runs. Everything is behind a login; test accounts are in `app/README.md`. **Requires GCP credentials** (`gcloud auth application-default login`) — the app runs on Vertex and Firestore, not on local files. `app/gcp-setup.md` is the setup walkthrough.

**Two GCP projects since 2026-08-08** — real users are arriving, so demo and product no longer share a database. `cta-pilot-dev` is the demo/dev sandbox your machine points at (via `config.json`); `tau-thinking-prod` holds real schools and is reachable only from Cloud Run. The demo seed refuses to run there. Read `app/README.md`'s *Two projects* section before touching seeding, auth, deploy config, or anything that writes users.

Also deployed: **https://cta-714032495709.us-central1.run.app** — the *demo* instance in `cta-pilot-dev` (public, fabricated data, no longer receiving deploys). `app/data/*.json` is a dead snapshot.

---

## The retired scoring model — read this before citing any formula

You **will** encounter a scoring model of four dimensions rated 1–5, summed to a 4–20 total, with the
SAMR level derived from that total. It is retired. Expect to find it in three places, and treat each
differently:

| Where | Status | What to do |
|---|---|---|
| **`index.html`** and this file's *Phase 3* below | **Correct and current** for the single-file CTA, which still runs it and must stay revertible | Leave it. It is the right spec for that codebase and the wrong spec for `app/`. |
| **`app/server/analysis.js`** (`mapTo5`, `totalScore`), and its output in `index.js`, `report-render.js`, `teacher.js`, `app.js` | **Retired but still running.** Cannot be removed until `scoreTAU`'s signature changes and the student view is rebuilt | Do not read it as the model. Finding it in the code is expected, not a discovery. |
| **Any design doc** — `tau-dimensions.md`, `designsystem.md`, `teacher-dashboard-design.md` | **History.** Kept for the reasoning that produced the change | Never cite as spec. |

**`tau-dimensions.md`'s *The scoring foundation* is the only authority on what a dimension is.** Every
reading is one of exactly two things: **agency (level + trend)** or **a dimension (band + trend)**.
There is no total, no mean, no percentage, and nothing out of 20. Bands are never computed from a
ratio, and a teacher never sees a band numeral.

Surfacing a retired formula as if current derails a session and costs more than the answer was worth —
so if a formula and this table disagree, this table wins, and if you are unsure whether something is
spec or build state, say so rather than picking one.

---

## Overview (the single-file CTA — `index.html`)

A single-file, client-side web app (`index.html`) that analyzes how a student used AI during a writing or research task. It produces a TAU Score (four dimensions, each 1–5) and a divergence chart visualization of idea thread development.

**Input:** AI chat log + final essay
**Output:** TAU Score, SAMR level, divergence chart, Teacher integrity flags

Reference documents:
- `sankeyagency.md` — full measurement design and planning decisions (historical; divergence chart has replaced the Sankey)
- `teacher-guide.md` — educator-facing explanation of what and how the tool measures

---

## Technical Stack

- Single HTML file — no build step, no frameworks, no dependencies except Groq API
- Groq API: 3 calls total, all fired in parallel after parsing
  - Call 1 (LLM): turn classification — `llama-3.1-8b-instant`, all student turns batched in one prompt
  - Call 2 (LLM): provenance tracing — `llama-3.1-8b-instant`, full chat log + essay
  - Call 3 (embeddings): thread detection — `nomic-embed-text-v1.5`, all student turns batched
- API key stored in `localStorage` or `config.json` (never committed)
- Regex/pattern classification is fallback-only (used when Groq unavailable)
- SVG rendered inline for the divergence chart

---

## Build Order

### Execution graph

```
Phase 1: Parse
  → fire Call 1, Call 2, Call 3 in parallel (all inputs available after parse)
    → Call 1 + Call 2 resolve → Phase 3: TAU Scoring
    → Call 1 + Call 3 resolve → Phase 5: Thread Detection
      → Phase 6: Divergence Chart
```

---

### Phase 1 — Parser
`parseLog(raw)` — detects labeled vs alternating format, splits turns by role (student/ai), returns `{ turns, method }`.

Implemented in `index.html`. No changes needed.

---

### Phase 2 — Turn Classifier (Groq primary, regex fallback)

**Primary path (Groq available):**

Send all student turns in one LLM call (Call 1). Prompt returns:
```json
[{ "turnIndex": 0, "label": "challenge", "confidence": 0.9 }, ...]
```

**Labels to classify:**
- Student: `claim`, `conceptual`, `extraction`, `validation`, `stuck`, `feedback`, `narrative`, `rejection`, `refinement`, `challenge`, `pivot`
- AI: `correction`, `instruction`, `example`, `argument`, `definition`, `content`

**Fallback path (no Groq):**

Regex/keyword patterns for each label. Used only when Groq unavailable — scores degrade and a warning is shown.

```
rejection:   "that's not right", "I disagree", "actually that's wrong"
refinement:  "but I need", "focus more on", "can you change", "instead of"
challenge:   "why do you think", "how do you know", "what evidence", "but wouldn't"
pivot:       "what about", "switching to", "on another note", "going back to"
```

**Keep:** `classifyAllTurns()` for fallback path — first pass classification + second pass context enrichment (followedBy, responsive)

---

### Phase 3 — TAU Scoring Engine (rebuild entirely)

> **⚠ `index.html` ONLY — this is the retired model.** Everything in this Phase 3 block is the
> correct, current spec for the single-file CTA, which still runs it and must stay revertible.
> **`app/` does not work this way and must never be built to this section.** See *The retired
> scoring model* above; `tau-dimensions.md` is the authority for `app/`.

Four dimensions, each scored 0–100 then mapped to 1–5.

#### PQ — Prompting Quality
Measures question responsiveness and challenge. Does NOT count question marks.

```
signals:
  - responsiveCount     // student turns marked responsive=true
  - challengeCount      // turns classified as "challenge"
  - conceptualCount     // turns classified as "conceptual"
  - totalStudentTurns

scoring:
  PQ_raw = (responsiveCount + challengeCount) / totalStudentTurns
  PQ = map PQ_raw to 1–5 scale
```

#### SU — Selective Use
Measures what follows an extraction event. Extraction is neutral — the pattern after it is the signal.

```
signals:
  - for each extraction turn, look at next student turn label
  - HIGH agency following extraction: claim, conceptual, challenge, rejection, refinement
  - LOW agency following extraction: extraction, validation, stuck

scoring:
  extractionEvents = count of extraction turns
  highAgencyFollowups = count of high agency labels following extraction
  SU_raw = highAgencyFollowups / max(extractionEvents, 1)
  SU = map SU_raw to 1–5 scale
  (if no extraction events: score based on overall mix of high vs low agency turns)
```

#### CS — Calibrated Skepticism
Measures rejection and refinement events. Resubmission deferred to future iteration.

```
signals:
  - rejectionCount      // turns classified as "rejection"
  - refinementCount     // turns classified as "refinement"
  - totalStudentTurns

scoring:
  CS_raw = (rejectionCount * 1.5 + refinementCount) / totalStudentTurns
  CS = map CS_raw to 1–5 scale
  (rejection weighted higher than refinement — stronger signal)
```

#### OC — Original Contribution
Scored by Groq provenance tracing (see Phase 4). Falls back to claim turn ratio if Groq unavailable.

```
fallback (no Groq):
  OC_raw = (claimCount + narrativeCount * 0.5) / totalStudentTurns
  penalise by passive rate: (validationCount + extractionCount) / totalStudentTurns
  OC = map to 1–5 scale

with Groq:
  OC = derived from provenance map (see Phase 4)
  student-born concepts weighted highest
  synthesized concepts weighted medium
  ai-born concepts in essay = negative signal
```

#### SAMR Level (from total TAU)
```
total = PQ + SU + CS + OC  (range 4–20)
17–20 → Redefinition
13–16 → Modification
9–12  → Augmentation
4–8   → Substitution
```

---

### Phase 4 — Groq Provenance Engine (new prompts, reuse API call pattern)

Reuse the Groq API call structure from `index.html`. Rewrite the prompt entirely.

**Purpose:** trace the origin of ideas in the essay back to the chat log.

**Prompt contract:**
- Input: full chat log (labeled Student/AI) + essay text
- Output: JSON array of `{ concept, phrase, origin }` where origin is one of:
  - `student-born` — idea appeared in student turns before AI mentioned it
  - `ai-born` — idea appeared in AI turns before student used it
  - `synthesized` — developed together across both
  - `prior` — does not appear in chat log (student's own prior knowledge)

**OC scoring from provenance:**
```
studentBorn  = count of student-born + prior concepts in essay
synthesized  = count of synthesized concepts in essay
aiBorn       = count of ai-born concepts in essay
total        = studentBorn + synthesized + aiBorn

OC_raw = (studentBorn * 1.0 + synthesized * 0.6) / max(total, 1)
OC = map OC_raw to 1–5 scale
```

**Teacher integrity flags** (computed from provenance + stylistic analysis, not shown to student):
- `stylistic-inconsistency` — vocabulary/complexity jumps sharply between student turns
- `unnatural-fluency` — student turns lack hedging, false starts, colloquial language
- `provenance-mismatch` — essay uses concept as student-born but AI introduced it first
- `shadow-session-pattern` — student responses suspiciously well-calibrated to AI output

---

### Phase 5 — Thread Detection

Hybrid: explicit pivot markers + semantic drift via Groq embeddings.

**Algorithm:**
1. Embed each student turn using Groq embeddings
2. For each student turn N, compute cosine similarity to turn N-2 (prior student turn)
3. High similarity → same thread continues
4. Low similarity OR pivot marker detected → new thread opens or prior thread returns

**Thread return vs new thread:**
- Compare turn N embedding to ALL open thread embeddings
- If similarity to a prior thread > threshold → thread return
- If no prior thread matches → new thread opens

**Thread data structure:**
```javascript
Thread {
  id: string,
  origin: 'student' | 'ai' | 'split',
  turnIndices: [],          // all turn indices belonging to this thread
  activeSpans: [],          // turn ranges where thread was active (thick)
  driftScores: [],          // semantic drift per student turn in thread
  agency: {
    pq: [],                 // responsiveness + challenge scores per activation
    su: [],                 // extraction pattern scores per activation
    cs: [],                 // rejection + refinement events per activation
    oc: [],                 // student-born concepts per activation
  },
  samrArc: [],              // SAMR level at each activation
  outcome: null,            // 'absorbed' | 'evolved' | 'dropped' (set after essay analysis)
}
```

**Thread events:**
- `open` — new thread starts (student or AI initiated)
- `activate` — thread becomes active focus
- `dormant` — student pivots away, thread persists as thin connector
- `split` — one thread produces two independent directions
- `merge` — two threads converge; merged thread is thicker than either parent
- `terminate` — thread ends; resolved against essay for outcome

---

### Phase 6 — Divergence Chart Renderer

SVG rendered inline. No charting library. Replaced the Sankey design.

See the `tabDivergence` tab in `index.html` for the current implementation.

---

## UI Structure

```
header
  title: "Critical Thinking Auditor"
  subtitle: "Trace the cognitive provenance of AI-assisted writing"

layout (2-col grid)
  api-key-bar        // Groq key input, persisted to localStorage
  sample-bar         // Load: Low / Medium / High sample
  panel: AI Chat Log textarea
  panel: Final Essay textarea
  button: Analyze

results (full width, shown after analysis)
  summary-panel      // TAU dimension cards (PQ / SU / CS / OC) + SAMR level badge
  divergence-panel   // Divergence chart SVG + engagement arc summary
  turns-panel        // Student turns list with labels, quality, flags
  provenance-panel   // Essay heatmap (concept origins) + concept inventory list
  flags-panel        // Teacher view only — integrity flags (hidden from student view)
```

---

## Key Design Constraints

- No scoring of individual turns — only patterns and sequences
- Extraction is neutral — never penalise it in isolation
- Integrity flags are never shown in student view
- Groq is required for full measurement — regex fallback runs the tool but degrades accuracy; show a warning when Groq is absent
- No comments explaining what code does — only comment non-obvious WHY
- No frameworks, no build step, single file
