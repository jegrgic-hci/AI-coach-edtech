# Reflection Feature — Design & Implementation Notes

## Why this exists

The Critical Thinking Auditor measures *how* a student used AI — the pattern of their turns, the quality of their prompting, the evidence of original thought. But the TAU score alone doesn't ask the student to account for themselves. A student can submit, see a low score, tweak nothing about their process, and resubmit hoping for a better number.

The reflection step is a check on that. It asks the student to surface their own metacognitive awareness — to name what they knew, what shifted, and where they pushed back. This is harder to game than the score itself, because it requires language that is specific and situated.

---

## Pedagogical grounding

The prompts are adapted from Harvard Project Zero's **Making Thinking Visible** framework (Ritchhart, Church & Morrison, 2011), specifically the **Connect-Extend-Challenge** thinking routine.

The original routine is designed for moments of new learning:

| Prompt | Original intent | Adapted for AI use |
|--------|----------------|--------------------|
| **Connect** | How does this connect to something you already knew? | What did you bring to this conversation before it started? |
| **Extend** | What new ideas does this extend or push your thinking toward? | What did the AI open up that you wouldn't have reached alone? |
| **Challenge** | What is still challenging, confusing, or unclear? | Where did you push back, question, or disagree with the AI? |

The adaptation shifts the lens from *content* to *process* — the student isn't reflecting on the topic, they're reflecting on their relationship to the tool.

---

## Multi-draft model

### The problem with repeating the same questions

Students are expected to submit multiple drafts. The tool is designed to be used across a writing process, not just at the end.

Asking "what did you already know before the conversation?" on a third or fourth submission is pedagogically odd — the student already answered it, and repeating it invites copy-paste or formulaic responses. The educational value drops significantly.

### What we want from repeat submissions

On draft 2 and beyond, the educationally interesting question is: **what changed?**

- Did the student's relationship to the AI shift across drafts?
- Did they become more skeptical, more selective, more confident?
- Did the topic itself evolve in their understanding?

This is **delta thinking** — a lighter, more focused form of reflection that tracks cognitive evolution rather than restating a baseline.

### The implementation

**Draft 1:** Full Connect-Extend-Challenge (3 prompts, baseline reflection)

**Draft 2+:** Single "What shifted?" prompt (delta reflection)

The prior submission's reflection is shown as a collapsible preview, so the student has context for what they wrote before without being forced to remember.

Detection is localStorage-based: `cta_submissions` stores a record of every submission on this device. Zero entries = first draft. Any entries = delta mode. Draft number is auto-incremented.

---

## Why reflection is required, not optional

An optional reflection step becomes a skip-by-default step for most students. If skipping costs nothing, almost everyone skips.

Making it required — and gating the Analyze button on ≥20 characters — forces the student to pause before seeing their score. The reflection isn't a post-hoc justification; it's part of the submission act itself.

The 20-character minimum is intentionally low. "I already knew a lot" clears it. The bar is engagement, not depth. Depth is something teachers read for; the tool doesn't grade it.

---

## Anti-gaming: same reflections across submissions

The most obvious way to game a required reflection is to copy-paste the same text on every resubmission. This is detected at two levels:

1. **Exact match** — a djb2 fingerprint of the normalized reflection text is compared against all stored submissions. An identical response, whitespace-trimmed and lowercased, triggers the flag.

2. **Semantic similarity** — Jaccard word overlap (≥85%) against the last 8 submissions. This catches minor edits (changing a word or two) that are functionally the same response.

When triggered, a `reflection-duplicate` integrity flag appears in the teacher's report. The flag detail text names the mode (Connect-Extend-Challenge or "What shifted?") so the teacher understands what was repeated.

This flag does not appear in the student view — they don't know it was triggered.

---

## What the teacher sees

### Integrity flags (submission-level, terra red ⚑)

- **Reflection Resubmitted** — near-identical reflection to a prior submission, consistent with rapid resubmission to improve the score

### Attention signals (assignment-level, amber ●)

Two signals emerge only when reflection text is read against the scores — they are not derivable from scores alone:

- **Reflection–Score Gap** (`reflection-score-mismatch`) — the student's Challenge response contains pushback language ("pushed back", "challenged", "disagreed", "questioned") but their CS score is below 2.5. The student described critical behavior they didn't demonstrate. This is often a metacognitive gap rather than bad faith: they understand what good engagement looks like but haven't yet built the habit. Teacher action: ask the student to point to a specific moment in the chat where they disagreed.

- **Delta–Score Mismatch** (`reflection-delta-mismatch`) — a follow-up "What shifted?" reflection contains improvement language ("more skeptical", "pushed back more", "more critical") but the TAU score didn't increase from the prior submission. The student described change they didn't enact. Teacher action: identify which dimension the student implicitly claimed to improve and ask them to locate it in the session log.

Both signals are surfaced as amber attention banners in the drill panel with a "Learn more" link into the side tray. They are never shown to students.

### Reflection arc

At the top of the submission history drill panel, a horizontal strip shows each draft's reflection type (CEC badge for full, Δ badge for delta), a 5-word excerpt, and the TAU score. This gives the teacher a narrative trajectory before reading individual submissions — the arc across drafts is often more informative than any single submission.

### Per-submission reflection

Each submission row in the drill panel has a collapsible reflection section. Draft 1 shows Connect / Extend / Challenge sections. Draft 2+ shows the "What shifted?" response with a score delta badge (`+2`, `−1`, `=`) indicating how the TAU total changed from the prior submission.

### Data model

Each stored submission in `cta_submissions` (and the dashboard's mock data) includes:

```javascript
{
  reflectionType: 'full' | 'delta',
  reflection: {
    // if full:
    connect:   string,
    extend:    string,
    challenge: string,
    // if delta:
    delta:     string,
  }
}
```

The teacher dashboard does not yet read live student data — it uses deterministic mock data. The `cta_submissions` localStorage key is the data model that will power that connection.

---

## What we deliberately didn't build

**A "final submission" button.** Every Analyze click is a draft record. This is intentional — making every analysis feel like a submission moment raises the stakes on the reflection without requiring a separate workflow. A final submit concept can be layered on later if teachers need it.

**Grading the reflection.** The tool stores reflection text and surfaces it to the teacher, but never scores it. Scoring would immediately change how students write — they'd optimize for the rubric rather than reflect honestly. The teacher reads it; the algorithm doesn't.

**Reflection visible in student results.** The reflection is submitted alongside the analysis but is not echoed back to the student in the results view. It's not a writing exercise; it's an accountability mechanism. Showing it back to them would encourage editing it for appearance rather than writing it honestly the first time.
