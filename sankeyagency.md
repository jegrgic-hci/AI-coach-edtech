# CTA Sankey & Agency Planning

## Sankey Visualization

### Core Design
- Single origin point on the left; time flows right (x-axis = conversation turns)
- Each thread is a horizontal lane
- Thickness = active engagement; dormant threads persist as thin connectors
- Merged threads are thicker than either parent — visual signal of synthesis
- SAMR level encoded as vertical position + color shift
- Essay outcome resolves each thread at the right edge (absorbed / evolved / dropped)

### Thread Events
| Event | Description |
|-------|-------------|
| Open | New thread starts — from origin point or branching from existing thread |
| Activate | Thread becomes the active focus (thickens) |
| Dormant | Student pivots away; thread persists as thin connector |
| Split | One thread produces two independent directions (from explanation of sub-concepts) |
| Merge | Two threads converge into a new, thicker synthesized thread |
| Terminate | Thread ends — resolved as absorbed, evolved, or dropped (checked against essay) |

### Thread Origin (encoded visually)
- Student-initiated — student introduces a genuinely new idea unprompted
- AI-initiated — AI introduces a concept the student hadn't raised, student picks it up
- Split from explanation — AI or student explains a thread, sub-concepts branch off

### Merge Definition
A merge is not just semantic overlap — it is causal or argumentative linking:
- Student references two prior concepts in the same turn
- Causal connectors: "led to", "because of", "which means that", "together they explain"
- Student is building a larger concept *from* both threads, not just mentioning them

### Thread Outcome (essay resolution)
- Absorbed — thread ended in conversation but the idea appears in the essay
- Evolved — thread continued, escalated in SAMR level, appears in essay
- Dropped — thread ended, idea absent from essay

### Design Principles
- Chart is agnostic about shape — reveals the pattern that actually happened
- Ideas can start broad and fragment, start atomic and build up, or oscillate
- Visual weight (thickness) communicates significance without labels or scores

---

## SAMR & TAU Integration

### Role of Each System
- **TAU Score** — granular, per-turn measurement of how well the student engaged (prompt quality, selective use, calibrated skepticism, original contribution)
- **SAMR** — high-level arc label applied per thread, derived from TAU signals, describes the overall pattern of AI use

### SAMR Applied Per Thread
SAMR is not a per-turn classifier — it describes the arc of each thread over time:
- Thread can start at Substitution and climb to Modification → growth arc
- Thread can stay flat at Substitution → passive thread
- Thread can open at Redefinition (student-initiated original idea) → high agency thread

SAMR level per thread is derived from TAU dimensions:
- High extraction, low skepticism, low OC → Substitution
- Good prompt quality, some selective use → Augmentation
- High skepticism, responsive turns, thread splits → Modification
- High OC, merges, essay synthesis → Redefinition

### Thread Data Model
```
Thread {
  origin: student | ai | split
  samr_arc: [level at each activation]
  tau_signals: { promptQuality, selectiveUse, skepticism, originalContribution }
  outcome: absorbed | evolved | dropped
}
```

### Sankey Encoding of SAMR
- Vertical position + color shift within each thread shows its SAMR arc
- A climbing thread = growing student agency
- A flat thread = passive engagement

---

## Agency Metrics

### Role
Agency metrics are the improved measurement layer that feeds both TAU dimensions and the Sankey.
They replace weak proxy signals (word counts, phrase detection) with behaviorally grounded measurement.

### TAU Measurement Gaps
| Dimension | What We Want | What We Have | Problem |
|---|---|---|---|
| PQ | Questions that drove conversation deeper | Question mark + why/how counts | "Can you write me an essay?" scores high |
| SU | Strategic direction of AI | Synthesis vs extraction phrases | Phrases don't prove strategic intent |
| CS | Critical evaluation of AI output | Pushback phrase count | One phrase scores same as sustained challenge |
| OC | Student's own thinking in essay | Student word share | Word count ≠ originality |

### Calibrated Skepticism (CS) — Measurement Design

Three distinct behaviors, measured by hybrid rules + NLP:

**1. Rejection** — student explicitly disagrees with AI output
- Rules: "that's not right", "I disagree", "actually", "but that's not" (existing + expanded)
- NLP: negative sentiment shift directed at prior AI turn
- Feasibility: High

**2. Refinement** — student accepts output but adds constraints or redirects
- Rules: "but I need", "what about", "focus more on", constraint-adding language
- NLP: semantic comparison of new prompt vs prior prompt — did scope narrow or parameters increase?
- Feasibility: Medium

**3. Resubmission** — student returns to same topic with more informed/specific question
- Rules: not reliably detectable with rules alone (structural pattern, not a phrase)
- NLP: compare turn N to turn N-2 (same student), high similarity + increased specificity = resubmission
- Feasibility: Low-Medium — can approximate but cannot confirm causation
- **Decision: defer resubmission as a bonus signal; build CS on Rejection + Refinement first**

### Original Contribution (OC) — Measurement Design

**Core problem:** "did the student add content" is necessary but not sufficient — we must trace where ideas originated.

**Scoring — Term Provenance (chat log + essay):**
1. Extract key concepts/claims from the essay
2. For each concept, trace chronological appearance in the chat log:
   - Appears in student turns before AI mentioned it → **student-born**
   - Appears in AI turns before student used it → **AI-born**
   - Developed together across both → **synthesized**
3. OC score weighted toward student-born and synthesized concepts in the essay

**Anti-gaming property:** chronological order of the chat log is fixed — provenance cannot be fabricated within a single submitted session.

**Known limitation:** tool only sees the submitted log. A student using a shadow AI session to pre-polish their responses before submitting is not detectable through provenance alone.

---

### Teacher View — Integrity Flags

Flags are not scores — they are signals for the teacher to review in conversation with the student.
Student view never shows flags.

**OC Integrity Flags:**
- **Stylistic inconsistency** — student turn vocabulary/complexity jumps sharply relative to their baseline across the log
- **Unnatural fluency** — student responses lack hedging, false starts, colloquial language (AI-polished pattern)
- **Provenance mismatch** — student claims an idea as their own but concept appeared in AI output first
- **Shadow session pattern** — student responses suspiciously well-calibrated to AI's exact output

**Measurement approach for flags:**
- Embedding-based stylistic consistency across student turns
- Epistemic modality detection (absence of hedging as a red flag)
- Provenance trace comparison between chat log and essay

---

### Prompting Quality (PQ) — Measurement Design

**What we want to measure:** did the student ask questions that drove the conversation deeper?
**What we currently measure:** question count, why/how count, follow-up phrases, question density — all surface signals.
**Core problem:** question count tells us nothing about quality. Three bad questions score higher than one good one.

**Three measurable properties:**

**1. Responsiveness** — question builds on prior AI output, not independent of it
- Rules: follow-up phrases ("but then", "so does that mean", "building on that")
- NLP: semantic similarity between student question and prior AI turn
- Feasibility: High

**2. Challenge** — question probes reasoning, makes comparisons, asks for justification
- Rules: comparative markers ("rather than", "instead of", "but wouldn't"), justification requests ("why do you think", "how do you know", "what evidence")
- NLP: minimal needed — rules catch this reliably
- Feasibility: High

**3. Specificity** — question narrows focus, adds constraints, references particular details
- Rules: named entities, comparative language ("specifically", "in particular", "rather than")
- NLP: question embedding distance from broader conversation context
- Feasibility: Medium — **deferred, same as Resubmission**

**Distinction from CS:** PQ Challenge measures the *form* of the question (probing, comparative, causal). CS measures the *intent* (evaluating and pushing back on AI output). They can co-occur but don't have to.

---

### Selective Use (SU) — Measurement Design

**What we want to measure:** did the student use AI strategically, directing it rather than consuming it?
**What we currently measure:** synthesis phrases vs extraction phrases — wrong approach, penalizes extraction that may be high agency.

**Key reframe:** extraction is a neutral event — what matters is what comes after it. SU is a sequential pattern measure, not a phrase count.

**Extraction-to-response patterns:**
| Pattern | Agency Level |
|---|---|
| Extract → more extraction | Low |
| Extract → validation ("ok great") | Low |
| Extract → directed follow-up | Medium |
| Extract → student claim or argument | High |
| Extract → challenge or pushback | High |

**How we measure it:**
- Classify all student turns (already done — claim, conceptual, extraction, validation etc.)
- For each extraction turn, look at the next student turn label
- High agency labels following extraction → SU increases
- Low agency labels following extraction → SU stays flat or decreases

**Technically:** bigram pattern over turn labels — feasibility High, no NLP needed beyond existing classification.

**Connects to Sankey directly:** these sequences are exactly what thread activation/dormancy captures visually — SU and the Sankey are measuring the same underlying behavior from different angles.

---

### Build Order

1. **Rules first** — Rejection, Refinement, Responsiveness, Challenge, Directedness, Iteration via regex
2. **NLP layer** — embeddings for Responsiveness, Rejection sentiment, Iteration coherence
3. **Validate against real logs** — does combined signal match human judgment?
4. **Refine** — Specificity, Resubmission added once baseline is trusted

---

## Thread Detection

### What is a Thread?
A topic or idea the student engages with across one or more turns. Spans the full student↔AI exchange, not just student turns. Can be active or dormant. Has a chronological position in the conversation.

### Detection: Hybrid Rules + Embeddings

**Semantic Drift** — primary signal
- Low drift between student turn and prior AI turn → same thread, student engaged with current topic
- High drift → topic has shifted, potential new thread opening

**Lexical Divergence** — supporting signal
- Student introduces vocabulary not present in recent turns → new thread opening
- Student reuses vocabulary from several turns back → thread return

**Explicit Pivot Markers** — rules layer
- "what about", "switching to", "on another note", "going back to", "actually" etc.
- Catch explicit topic switches that embeddings might miss

### Thread Event Detection

| Event | Primary Signal | Supporting Signal |
|---|---|---|
| New thread opens | High semantic drift | New lexical field introduced |
| Thread return | Low drift to prior thread context | Vocabulary matches earlier thread |
| Thread merge | Student references two semantic fields simultaneously | Causal connectors present |
| Thread fork/split | AI explanation introduces distinct sub-concepts | Student follows one sub-concept |
| Thread closes | Drift away + no return in subsequent turns | Topic absent from essay |

### Thread Origin
- **Student-initiated** — student introduces new topic unprompted
- **AI-initiated** — AI introduces concept student hadn't raised, student picks it up
- **Split from explanation** — AI or student explanation produces semantically distinct sub-concepts

### Thread Tracking Structure
Threads are tracked across full student↔AI exchange pairs:

```
Thread {
  origin: student | ai | split
  turns: [(student_turn, ai_response), ...]   // full exchange pairs
  active_spans: [turn index ranges]            // when thread was thick vs thin
  drift_scores: [per student turn]             // semantic distance from prior AI turn
  agency: {
    pq_arc:  [responsiveness, challenge scores per activation]
    su_arc:  [extraction-to-response patterns per activation]
    cs_arc:  [rejection, refinement events per activation]
    oc_arc:  [student-born concepts introduced per activation]
  }
  samr_arc: [SAMR level at each activation]
  outcome: absorbed | evolved | dropped        // resolved against essay
}
```

### Key Insight
Agency is not a single conversation-level score — it is a per-thread story. A student can be highly agentic on one thread and completely passive on another. This nuance is invisible in the TAU score but fully visible in the Sankey. The Sankey visualizes the agency arc of each thread — climbing = growing agency, flat = passive engagement, merging = synthesis.

---

## To Plan Next
- Remaining agency metrics as enhancement layer (Semantic Drift, Lexical Divergence, Epistemic Modality)
- How these feed thread detection and TAU refinement
- Resubmission + Specificity — revisit after baseline validated
- Build plan and implementation order
