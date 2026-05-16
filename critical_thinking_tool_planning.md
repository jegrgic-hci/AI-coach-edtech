# Project Specification: Critical Thinking Auditor (CTA)

## 1. Project Overview
A platform-agnostic measurement tool designed to audit the intellectual labor involved in AI-assisted writing. The tool analyzes the "Cognitive Provenance" of a final output (essay) by tracing its conceptual lineage back through the AI chat log.

### Core Objectives
* **Measure Agency:** Distinguish between "Passive Adoption" and "Active Collaboration."
* **Visualize Thought:** Map the evolution of ideas from user intent to final text.
* **Extrinsic Motivation:** Use scoring and mapping to encourage deeper student engagement with AI.

### Isolation Strategy
Built as a **standalone `cta.html`** — completely separate from the existing `index.html` TAU Score analyzer. No shared state, no modifications to existing code. If this path is a dead end, delete `cta.html` and nothing else changes.

---

## 2. Technical Architecture & Data Model

### Data Schema (Drafts & Logs)
To enable resubmission tracking and delta analysis, the system must store snapshots of every analysis request.

* **`Session`**: Links a specific assignment to a user.
* **`Log_Turn`**: Individual entries from the pasted chat log.
    * `turn_id`, `role` (User/Assistant), `content`, `nlp_label` (Claim, Conceptual, etc.).
* **`Draft`**: The state of the essay at a specific point in time.
    * `draft_id`, `content_hash`, `timestamp`.
* **`Analysis_Snapshot`**: The generated scores and maps for a specific `Draft` + `Log_State` pair.

> **Note:** The data schema above is Phase 3+ (persistence layer). Current implementation is stateless/client-side only.

### The Provenance Engine
Uses **Named Entity Recognition (NER)** and **Semantic Similarity** to track term origins.
* **K_User**: Concepts first appearing in user prompts.
* **K_AI**: Concepts first appearing in AI responses.
* **K_Essay**: Concepts present in the final submission.

---

## 3. Core Feature Implementation Logic

### A. Term-Provenance (Lineage Mapping)
For every significant noun-phrase/concept in the essay:
1.  Search `Log_Turn` history for the earliest occurrence.
2.  Categorize:
    * **User-Born**: Earliest occurrence is `role: User`.
    * **AI-Born**: Earliest occurrence is `role: Assistant`.
    * **Synthesized**: User provided a concept, AI provided technical expansion/vocabulary, both are linked to the essay node.

### B. Resubmission & Delta Tracking
When a new draft is submitted:
1.  Calculate `Semantic_Delta` (Difference in Essay content).
2.  Calculate `Inquiry_Delta` (Number of new `Conceptual` or `Feedback` turns in the log).
3.  **The Trigger**: If `Semantic_Delta` > 20% AND `Inquiry_Delta` == 0, flag as "Unearned Jump."

### C. Adjustable Weighted Scoring
Final Score is calculated via a normalized weighted average:
`Score = (w1 * Prompt_Quality) + (w2 * Selective_Use) + (w3 * Calibrated_Skepticism) + (w4 * Original_Contribution)`
* Default: 0.25 for all.
* Teacher can adjust sliders (0.0 to 1.0) to prioritize specific behaviors for different assignments.

---

## 4. NLP Analysis Pipeline

### Student Turn Labels
Every student turn is classified and contributes to scoring:

| Label | Definition | Score Impact |
| :--- | :--- | :--- |
| **Claim** | Original thought, opinion, or argument. | ++ Original Contribution |
| **Conceptual** | Why/How question or interrogation of logic. | ++ Skepticism |
| **Feedback** | Corrects AI or directs a specific change. | ++ Selective Use |
| **Extraction** | Delegates writing to AI ("write me", "draft this"). | -- all dimensions |
| **Validation** | Short passive filler ("ok", "thanks", "next"). | -- Agency |
| **Stuck** | Expresses confusion or hits a logic wall. | Teacher review signal |
| **Narrative** | Substantive turn without a strong behavioral pattern (≥8 words). Tracked for provenance. | Neutral |

### Context Enrichment (per student turn)
Each classified turn also carries:
- `quality: "deep" | "surface"` — based on word count + logical connectors
- `responsive: true/false` — student is reacting to something specific in the prior AI turn
- `followedBy` — label of the next student turn (catches Stuck→Conceptual = productive struggle, Stuck→Extraction = dependency)

### AI Turn Labels
AI turns are classified but **not scored** — reserved for the provenance map only:

| Label | Definition |
| :--- | :--- |
| **Definition** | AI explains or defines a term. |
| **Argument** | AI makes a logical claim or inference. |
| **Example** | AI provides an illustration or case. |
| **Instruction** | AI tells the student what to do. |
| **Correction** | AI corrects a prior statement. |
| **Content** | AI delivers information not fitting a specific rhetorical type. |

---

## 5. UI/UX: The Pedagogical Firewall

### Student View (The Mirror)
* **Dimension Summary** ✅ — 4 scores (0–100) for Prompt Quality, Selective Use, Calibrated Skepticism, Original Contribution.
* **Student Turn List** ✅ — Classified turns with labels, quality depth, and behavioral flags (Responsive, Productive Struggle, Passive, Low Agency).
* **Provenance Heatmap** ✅ — Essay text color-coded by concept origin (User-Born, AI-Born, Synthesized).
* **Concept Inventory** ✅ — Per-concept origin badge and first-occurrence trace snippet.
* **Cognitive Rhythm Map** — A sparkline showing the sequence of engagement labels over time. *(not yet built)*
* **Interactive Graph** — D3 node/edge flow diagram from turn origin to essay concept. *(deferred)*

### Teacher View (The X-Ray) *(not yet built)*
* **Suspicion Index**: A "Confidence" flag (Low/Med/High) based on logic gaps and ghost claims.
* **Provenance Heatmap**: The essay text color-coded by origin (User vs. AI).
* **Audit Questions**: Automatically generated prompts for the teacher to ask the student.

---

## 6. Development Roadmap

### Phase 1: Foundation ✅ Complete
- [x] Standalone `cta.html` isolated from existing TAU Score tool
- [x] Log parser — handles labeled (`You:` / `ChatGPT:`) and alternating formats
- [x] Student turn classifier — 7 labels with pattern-based NLP
- [x] AI turn classifier — 6 labels, classified but hidden from scored view
- [x] Context enrichment — quality depth, responsive flag, followedBy, productive struggle detection
- [x] 4-dimension scoring (0–100): Prompt Quality, Selective Use, Calibrated Skepticism, Original Contribution
- [x] Sample loader — Low / Medium / High test cases wired in for validation
- [x] Scores validated as consistent across test cases (Low < Medium < High)

### Phase 2: Provenance Map ✅ Complete (iterated)
- [x] Concept extraction from essay via Groq (`llama-3.1-8b-instant`) — returns key intellectual concepts as a JSON array
- [x] Origin tracing — for each essay concept, scan classified turns in order to find first student and first AI occurrence
- [x] 4-way origin classification: User-Born / AI-Born / Synthesized / Prior Knowledge
- [x] Essay heatmap — inline colored `<mark>` spans on the essay text by origin (blue=User, red=AI, purple=Synthesized)
- [x] Concept inventory list — each concept with origin badge and the exact turn snippet it first appeared in
- [x] Provenance summary stats — counts and % breakdown across 4 origin categories
- [x] Groq API key bar — auto-loads from `config.json`, falls back to localStorage (`cta_groqKey`)
- [x] Provenance panel hidden until essay is provided; graceful fallback if no API key
- [x] Fixed heatmap position drift — replaced `normText()` offset mapping with `conceptRegex()` that searches original text directly using word-boundary-anchored regex
- [x] Refactored to phrase-level highlighting — Groq now returns `{concept, phrase}` pairs; `phrase` is a verbatim essay clause (6–20 words), not an abstract label; heatmap highlights the meaningful clause rather than individual word occurrences
- [x] Unified provenance call — `extractProvenanceMap()` sends both essay and chat log to Groq in a single call; Groq handles semantic attribution (paraphrase, restatement) that string matching cannot

**⚠ Strategic concern: heatmap is drifting toward a coaching tool**

The heatmap as currently built feels like feedback for the student — "here is where your ideas came from." That was not the original intent. The original goal was to give the *teacher* an audit surface: evidence of intellectual labor (or lack of it), not a reflective mirror for the student.

The heatmap in its current form has two problems for the teacher use case:
1. It relies on LLM classification of origin, which is a black box — a teacher can't verify why a phrase was labelled "AI-Born"
2. It shows the essay with coloured regions but doesn't show *what in the AI log* those regions correspond to — the teacher cannot see the actual similarity

**What a teacher-useful provenance map would actually need:**
- Direct side-by-side or linked mapping between an essay passage and the specific AI turn it came from (or was influenced by)
- Similarity score or diff-style view showing how much the student changed the AI's phrasing (copy vs. paraphrase vs. synthesis)
- This requires a more rigorous approach: embed sentences from both the AI log and essay, compute pairwise similarity, then surface the closest AI-turn match for each essay sentence

This is a meaningful research/design problem. Defer until the core student-facing scoring (Phase 1) is validated with real users.

### Phase 3: Teacher Dashboard
- [ ] Suspicion Index logic (ghost claims, logic gaps)
- [ ] Auto-generated audit questions per ghost claim
- [ ] Student vs. Teacher view toggle (Pedagogical Firewall)

### Phase 4: Resubmission Tracking
- [ ] Semantic delta between draft versions
- [ ] Inquiry delta (new Conceptual/Feedback turns between submissions)
- [ ] "Unearned Jump" flag trigger

### Phase 5: Scoring Calibration & Persistence
- [ ] Adjustable weighting sliders per assignment
- [ ] Blind audits with teachers to calibrate Suspicion Index
- [ ] Session/draft persistence (data schema above)
