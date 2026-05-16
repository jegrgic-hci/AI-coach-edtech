# CTA — Critical Thinking Auditor

## Overview

A single-file, client-side web app (`cta2.html`) that analyzes how a student used AI during a writing or research task. It produces a TAU Score (four dimensions, each 1–5) and a Sankey visualization of idea thread development.

**Input:** AI chat log + final essay
**Output:** TAU Score, SAMR level, Sankey chart, Teacher integrity flags

Reference documents:
- `sankeyagency.md` — full measurement design and planning decisions
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
- SVG rendered inline for the Sankey chart

---

## Build Order

### Execution graph

```
Phase 1: Parse
  → fire Call 1, Call 2, Call 3 in parallel (all inputs available after parse)
    → Call 1 + Call 2 resolve → Phase 3: TAU Scoring
    → Call 1 + Call 3 resolve → Phase 5: Thread Detection
      → Phase 6: Sankey
```

---

### Phase 1 — Parser (copy from cta.html, no changes)
`parseLog(raw)` — detects labeled vs alternating format, splits turns by role (student/ai), returns `{ turns, method }`.

No changes needed. Copy as-is.

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

Reuse the Groq API call structure from cta.html. Rewrite the prompt entirely.

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

### Phase 6 — Sankey Renderer (rebuild entirely)

SVG rendered inline. No charting library.

**Layout:**
- X axis = time (conversation turns), left to right
- Each thread is a horizontal lane
- Thickness = active engagement (active: full width, dormant: 4px connector line)
- Vertical position = SAMR level (higher = Redefinition, lower = Substitution)
- Color = thread origin (student-born: blue, AI-initiated: grey, split: lighter variant)
- Color shifts along thread as SAMR level changes

**Thread events in SVG:**
- `open` — thread lane starts, splits from origin point or parent thread
- `activate` → `dormant` — smooth taper from full width to thin connector
- `dormant` → `activate` — smooth expand from thin connector to full width
- `merge` — two lanes converge into a single thicker lane
- `split` — one lane diverges into two thinner lanes
- `terminate` — lane ends with outcome marker: filled circle (absorbed/evolved) or fade (dropped)

**Outcome markers at right edge:**
- Absorbed — small filled circle, thread color
- Evolved — filled circle with ring, thread color
- Dropped — faded terminus, no circle

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
  sankey-panel       // Sankey SVG + engagement arc summary
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
