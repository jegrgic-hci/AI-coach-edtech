# TAUS AI-Use Analyzer

A single-page application that analyzes how students use AI during the writing process. It scores their AI engagement using the **TAUS framework** (Thinking, Active engagement, Understanding synthesis, Self-authorship) and flags overlap between the student's essay and AI outputs.

## What It Does

1. **Parses AI conversations** — accepts labeled (`You:` / `AI:`) or alternating-turn format
2. **Extracts signals** — counts thinking indicators (questions, pushback), engagement patterns, synthesis signals
3. **Scores TAUS (1-5 per dimension)** → SAMR level (substitution/augmentation/modification/redefinition)
4. **Detects overlap** — both algorithmic (5-gram verbatim match) and semantic (Groq embeddings)
5. **Provides Groq LLM insights** — qualitative assessment of engagement level and authentic moments

## Architecture

### Core Analysis Pipeline

```
Input (conversation + essay)
  ↓
Parse & Extract Signals (extractSignals)
  ├─ Structure: turn counts, word counts, speaker detection
  ├─ Thinking: question counts, "why" questions, own-voice markers
  ├─ Dependency: extraction/synthesis phrase detection
  └─ Overlap: 5-gram regex-based match (computeOverlap)
  ↓
Score TAUS (scoreSession) → T, A, U, S (each 1-5)
  ↓
Parallel (if Groq API key available):
  ├─ Semantic Similarity (computeSemanticOverlap)
  │   └─ Uses Groq embeddings, sentence-level cosine similarity
  └─ LLM Insights (callGroq)
      └─ Qualitative analysis of engagement, authenticity, flags
  ↓
Render Results
```

### Key Files & Functions

| File | Purpose |
|------|---------|
| `index.html` | Single-file app with all HTML, CSS, JS |
| `config.json.example` | Template for Groq API key (user copies to `config.json`) |
| `test-examples.json` | Sample conversations for testing & documentation |
| `SETUP.md` | Local development & deployment instructions |

### Analysis Functions (in index.html)

| Function | Input | Output | Purpose |
|----------|-------|--------|---------|
| `extractSignals(turns, essay)` | Parsed conversation, essay text | Object: `{structure, thinking, dependency, overlap}` | Count all signals |
| `computeOverlap(essay, aiText)` | Two text blocks | `{pct, matches, risk, semanticScore, avgSimilarity}` | 5-gram verbatim overlap |
| `computeSemanticOverlap(essay, aiText, apiKey)` | Two text blocks, Groq key | `{semanticScore, avgSimilarity, risks[]}` | Sentence-level similarity via embeddings |
| `scoreSession(signals)` | Signal object | `{T, A, U, S, total, samr}` | Convert signals → TAUS scores |
| `callGroq(parsed, essay)` | Parsed conversation, essay | `{engagement_level, strongest_moment, weakest_moment, flags, essay_reflects_own_thinking, conversation_feels_authentic}` | LLM-driven qualitative analysis |
| `generateFeedback(scores, signals)` | Scores & signals | Array of strings | Human-readable feedback based on scores |

### Results Display

Currently displays results in **separate sections**:

1. **Score Hero** — Circular progress, SAMR badge, total/20
2. **Dimension Cards** — T/A/U/S scores with descriptions
3. **Feedback** — Bulleted list from `generateFeedback()`
4. **Signal Details** — Four cards showing raw counts:
   - Conversation Structure
   - Thinking Initiative
   - AI Dependency
   - Essay ↔ AI Overlap (shows verbatim %, semantic %, risk)
5. **Groq Insights** (if available) — Strengths, feedback, overall analysis blocks

## Configuration

See `SETUP.md` for how to set up Groq API key. TL;DR:

- **Option A (dev):** Create `config.json` from `config.json.example`, add your key
- **Option B (always works):** Click ⚙ NLP Settings, paste key in browser

## Future Work & Design Notes

### Unified Verdict System (Explored, Not Implemented)

We explored but deferred implementing a **unified overlap verdict** that would:

1. **Combine signals cohesively** — instead of showing regex % and semantic % separately, synthesize them into a single risk verdict
2. **Detect divergence** — flag when algorithmic and semantic signals disagree (e.g., 10% regex but 85% semantic similarity suggests paraphrasing)
3. **Sequential chaining** — use semantic clustering first to group content, then run algorithmic analysis within semantic groups
4. **Unified UI** — show one verdict at top ("High Risk", "Medium Risk", etc.) with expandable evidence sections below

**Why deferred:** The current separate display works, but lacks cohesion. Revisit this when:
- You want a clearer single verdict for students
- You've collected enough test data to validate signal weighting
- You're confident in the semantic similarity thresholds

**Implementation sketch** (if you rebuild it):
```javascript
// New function: combine all three signals into one verdict
function computeUnifiedOverlapScore(regexPct, semanticScore, groqEngagementLevel) {
  // Weigh: 40% algorithmic, 40% semantic, 20% Groq engagement confidence
  // Return: { verdict, confidence, evidence_summary, divergences[] }
}

// New function: detect when signals contradict
function detectDivergence(regexPct, semanticScore) {
  // If regex < 20% but semantic > 70%, flag paraphrasing risk
  // If regex > 40% but semantic < 40%, flag false positive (boilerplate matching)
}
```

### Known Gaps

1. **Semantic similarity at scale** — currently limits to 10 sentences to avoid API costs; consider pagination or sampling strategy
2. **False positives in 5-gram overlap** — matches common phrases (e.g., "the most important", "in conclusion") as false positives
3. **Engagement level weighting in S score** — Groq's `engagement_level` is used only for display, not yet in the TAUS scoring
4. **No context for divergence** — when algorithmic and semantic disagree, there's no explanation of why (paraphrase vs. shared context vs. boilerplate)

### Potential Improvements

- **Calibrate thresholds** — current risk cutoffs (40%/20%/5%) are rules-of-thumb, not validated
- **Clustering integration** — use semantic similarity clusters to identify distinct essay ideas vs. repeated AI boilerplate
- **Authentic question detection** — currently counts `?` patterns; could use Groq to assess if questions show real curiosity
- **Self-authorship feedback** — when S score is low, provide specific paraphrasing or synthesis suggestions
- **Historical tracking** — if deployed with user accounts, track improvement over time

## Development Notes

### Adding New Signals

1. Identify the pattern (phrase list, question marker, etc.)
2. Add a pattern list in `extractSignals()` or create a new `countMatches()` call
3. Store result in the appropriate signal object (thinking, dependency, etc.)
4. Use it in `scoreSession()` to influence one or more TAUS dimensions
5. Add to feedback text in `generateFeedback()` if it affects user-facing messaging

### Testing

Use `test-examples.json` — paste examples into the app, verify:
- Parsing succeeds (labeled/alternating detection works)
- Signal counts are reasonable
- TAUS scores match expectation
- Overlap percentages make sense

### Debugging

- **Console logs** — check browser F12 console for parsing errors, API call logs
- **Signal object** — add `console.log(signals)` in `renderResults()` to inspect raw data
- **Groq responses** — check network tab (F12) for API requests/responses

## Security

- API keys are **never committed** — `config.json` is in `.gitignore`
- Only `config.json.example` (safe template) is in git
- Keys stored in browser localStorage (user-specific, not shared)
- No backend needed — direct client-to-Groq API calls

See `SETUP.md` for deployment guidance.

## License & Attribution

TAUS framework: Educational context, feedback-driven rubric for assessing AI use.
Built by Joseph Grgic with Claude.
