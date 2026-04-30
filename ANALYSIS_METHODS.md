# Analysis Methods Reference Guide

Complete documentation of the three analysis dimensions in the TAUS AI-Use Analyzer. This guide maps each analysis method to its implementation, test data, and current status.

---

## Table of Contents

1. [TAUS Score System](#taus-score-system)
2. [NLP Analysis (Overlap Detection)](#nlp-analysis-overlap-detection)
3. [Graph Analysis (Critical Thinking)](#graph-analysis-critical-thinking)
4. [Integration Status & Gaps](#integration-status--gaps)

---

## TAUS Score System

### What It Does

Measures student AI engagement across 4 dimensions (1-5 scale each), producing a total score (4-20) mapped to SAMR level (Substitution/Augmentation/Modification/Redefinition).

**Dimensions:**
- **T (Thinking Initiative)** — Counts questions, pushback, own-voice markers
- **A (Active Engagement)** — Conversation participation, follow-ups
- **U (Understanding Synthesis)** — Synthesis signals, evidence integration
- **S (Self-Authorship)** — Penalized by AI overlap; rewards original work

### Signal Extraction

**File:** `index.html`  
**Function:** `extractSignals(turns, essay)`  
**Location:** ~line 700-850

**Input:**
- `turns` — Array of parsed conversation turns (speaker, text)
- `essay` — Student's final essay text

**Output:** Signal object with counts across 4 categories:
```javascript
{
  structure: { totalTurns, studentTurns, wordCount, essayLength },
  thinking: { totalQuestions, whyQuestions, followUps, ownVoice, pushback },
  dependency: { extractionPhrases, synthesisPhrases },
  overlap: { pct, matches, risk, semanticScore }
}
```

**Signal Patterns Detected:**
- Own-voice: "I think", "I believe", "I argue", "in my opinion"
- Questions: Anything ending with `?`
- Why questions: "why", "why is", "why would", "how come"
- Pushback: "disagree", "not necessarily", "however", "but", "objection"
- Extraction: "according to", "the AI said", "the model suggested"
- Synthesis: "so that means", "in other words", "this implies", "this suggests"

### TAUS Scoring Logic

**File:** `index.html`  
**Function:** `scoreSession(signals)`  
**Location:** ~line 1200-1300

**Scoring Rules (summary):**

```javascript
T (Thinking) — increases if:
  - totalQuestions >= 2          → +1
  - whyQuestions >= 1 or followUps >= 2  → +1
  - ownVoice >= 1                → +1
  - pushback >= 1                → +1
  (Base: 1, Max: 5)

A (Active Engagement) — increases if:
  - studentTurns >= 5            → +1
  - studentTurns >= 8            → +1
  - wordCount >= 500             → +1
  - followUps >= 3               → +1
  (Base: 1, Max: 5)

U (Understanding Synthesis) — increases if:
  - synthesisPhrases >= 2        → +1
  - extractionPhrases >= 1       → +1
  - synthesisPhrases / essayLength ratio  → +1
  (Base: 1, Max: 5)

S (Self-Authorship) — starts at 5, decreases if:
  - overlap > 40%                → -4 (score = 1)
  - extractionPhrases >= 3       → -2 (score = 3)
  - overlap > 20%                → -1 (score = 4)
  - ownVoice == 0                → -1 (score = 4)
```

### SAMR Level Mapping

**File:** `index.html`  
**Function:** `scoreSession()` [bottom section]  
**Location:** ~line 1280-1295

```javascript
Total Score (4-20) → SAMR Level:
4-7   → "Substitution" (using AI as direct replacement)
8-11  → "Augmentation" (AI enhances work but not deeply integrated)
12-15 → "Modification" (Student significantly transforms AI output)
16-20 → "Redefinition" (Student creates new understanding with AI)
```

### Feedback Generation

**File:** `index.html`  
**Function:** `generateFeedback(scores, signals)`  
**Location:** ~line 1360-1450

Takes TAUS scores and signals, produces human-readable feedback bullets focused on:
- Which dimensions are strong/weak
- Specific behaviors to increase/decrease
- Next steps aligned with SAMR level

### Test Data

**File:** `test-examples.json`  
**Examples:** Low/Medium/High samples with labeled AI and student responses

Run in app:
1. Open `index.html` in browser
2. Paste conversation from test-examples.json
3. Verify parsing succeeds
4. Check TAUS scores match expectations

---

## NLP Analysis (Overlap Detection)

### What It Does

Detects whether student copied or paraphrased AI content using two complementary approaches:
1. **Algorithmic** — 5-gram regex-based verbatim matching
2. **Semantic** — Groq embeddings for sentence-level similarity

### Algorithmic Overlap (5-gram Regex)

**File:** `index.html`  
**Function:** `computeOverlap(essay, aiText)`  
**Location:** ~line 849-920

**Input:**
- `essay` — Student's essay text
- `aiText` — AI response text

**Output:**
```javascript
{
  pct: number,           // Overlap percentage (0-100)
  matches: [],           // Array of matched 5-gram sequences
  risk: "LOW" | "MEDIUM" | "HIGH",  // Risk level
}
```

**How It Works:**
1. Extract all 5-gram sequences from AI text
2. Search for those exact sequences in essay (case-insensitive)
3. Calculate: `(matched_words / total_words) * 100`

**Risk Thresholds:**
- `pct > 40%` → HIGH risk
- `pct > 20%` → MEDIUM risk
- `pct <= 20%` → LOW risk

**Known Issues:**
- ⚠️ False positives on boilerplate: "the most important thing", "in conclusion", "research shows"
- ⚠️ Doesn't distinguish between one-off paraphrase vs. repeated copying
- ⚠️ No context for why matches occurred (intentional vs. coincidence)

### Semantic Overlap (Groq Embeddings)

**File:** `index.html`  
**Function:** `computeSemanticOverlap(essay, aiText, apiKey)`  
**Location:** ~line 1086-1178

**Input:**
- `essay` — Student essay text
- `aiText` — AI response text
- `apiKey` — Groq API key (optional)

**Output:**
```javascript
{
  semanticScore: number,      // 0-1 (similarity confidence)
  avgSimilarity: number,      // Average cosine similarity
  risks: [                    // Per-sentence risks
    { sentence: string, similarity: number, flag: boolean }
  ]
}
```

**How It Works:**
1. Split both texts into sentences (first 10 from each to manage costs)
2. Get embeddings from Groq `nomic-embed-text-v1.5`
3. Compute cosine similarity between all sentence pairs
4. Flag sentences with similarity > 0.85 as "at-risk"
5. Average scores across all comparisons

**Risk Thresholds:**
- Sentence similarity > 0.85 → flagged as HIGH risk
- Avg similarity > 0.7 → MEDIUM risk overall
- Avg similarity <= 0.7 → LOW risk

**Known Issues:**
- ⚠️ Limited to 10 sentences per document (cost management); doesn't scale to long essays
- ⚠️ No context for *why* similarity is high (paraphrase vs. shared domain knowledge vs. boilerplate)
- ⚠️ Groq embedding model may vary consistency across requests

### Groq LLM Insights

**File:** `index.html`  
**Function:** `callGroq(parsed, essay, apiKey)`  
**Location:** ~line 1179-1300

**Input:**
- `parsed` — Parsed conversation object
- `essay` — Student essay
- `apiKey` — Groq API key

**Output:**
```javascript
{
  engagement_level: "LOW" | "MEDIUM" | "HIGH",
  strongest_moment: string,
  weakest_moment: string,
  flags: [],
  essay_reflects_own_thinking: boolean,
  conversation_feels_authentic: boolean
}
```

**Model Used:** `mixtral-8x7b-32768`  
**Temperature:** 0.3 (deterministic, consistent)

**Assessment Criteria:**
- How engaged is the student in the conversation?
- Are there moments of genuine curiosity or just extraction?
- Does the essay reflect student's own thinking or echo AI?
- Does the conversation feel authentic or like copy-paste queries?

**⚠️ Not Yet Integrated:**
- `engagement_level` is calculated but not used in TAUS S score
- Could weight into Self-Authorship assessment (high engagement = higher S)

### Results Display

**File:** `index.html`  
**Function:** `renderResults(signals, scores, ...)`  
**Location:** ~line 1010-1080

Currently displays overlap signals as **separate cards**:
1. Verbatim % (5-gram)
2. Semantic % (Groq embeddings)
3. Risk level
4. Matched sequences
5. Per-sentence risks

**Current Gap:** No unified verdict when algorithmic and semantic **diverge**:
- If algorithmic is low but semantic is high → likely paraphrasing (missed!)
- If algorithmic is high but semantic is low → likely boilerplate (false positive!)

---

## Graph Analysis (Critical Thinking)

### What It Does

Measures whether students reorganize AI concepts or copy structure. Uses knowledge graph extraction to detect **concept reuse vs. relationship reuse**.

**Key Insight:** Relationship Type Match Ratio is the discriminator:
- Same concepts + same relationships = COPYING (LOW critical thinking)
- Same concepts + different relationships = REORGANIZATION (HIGH critical thinking)
- Different concepts = independent thinking (STRONG)

### Knowledge Graph Extraction

**File:** `index.html`  
**Function:** `extractKnowledgeGraphFromText(text, apiKey)`  
**Location:** ~line 1075-1114

**Also in:** `knowledge-graph-poc.js` lines 15-88 (original implementation)

**Input:**
- `text` — Essay or AI response text (min 100 chars)
- `apiKey` — Groq API key

**Output:**
```javascript
{
  entities: ["concept1", "concept2", "concept3"],
  relationships: [
    { from: "concept1", to: "concept2", type: "causes" },
    { from: "concept2", to: "concept3", type: "enables" }
  ]
}
```

**Model Used:** `llama-3.1-8b-instant`  
**Temperature:** 0.3 (deterministic extraction)

**Relationship Types:**
- `causes` — one thing causes another
- `enables` — one thing makes another possible
- `opposes` — one thing contradicts another
- `defines` — one thing defines another
- `affects` — one thing influences another

**Error Handling:** Returns `null` if:
- No API key provided
- Text < 100 characters
- API call fails
- JSON parsing fails

### Graph Comparison

**File:** `knowledge-graph-poc.js`  
**Function:** `compareGraphs(aiGraph, essayGraph)`  
**Location:** ~line 109-190

**Output:** Comparison object with:
```javascript
{
  conceptOverlap: number,       // % of concepts shared (0-100)
  relationshipOverlap: number,  // % of AI relationships that appear in essay
  typeMatchRatio: number,       // KEY: % of shared edges with same type (0-100)
  sharedConcepts: number,
  totalConcepts: number,
  newConcepts: [],              // Concepts only in essay
  newRelationships: [],         // Relationships only in essay
  aiEntityCount: number,
  essayEntityCount: number,
  aiEdgeCount: number,
  essayEdgeCount: number,
  sharedEdgeCount: number,      // Edges with same type
  changedTypeEdges: number,     // Edges with different type
  existingEdgesInBoth: number   // Total shared edges (same or different type)
}
```

**Algorithm:**
1. Extract concepts from both graphs
2. Calculate concept overlap: `shared / max(ai_concepts, essay_concepts)`
3. Normalize all relationship types (e.g., "produces" → "causes")
4. Find matching (from, to) pairs
5. For each match, check if type is same
6. Calculate `typeMatchRatio = same_type_matches / total_matches`

### Transformation Analysis

**File:** `knowledge-graph-poc.js`  
**Function:** `analyzeTransformation(aiGraph, essayGraph, comparison)`  
**Location:** ~line 191-312 (POC version, AUTHORITATIVE)

**Also in:** `index.html` lines ~1115-1180 (NEEDS REPLACEMENT)

**Current Problem in index.html:**
Old version still references obsolete metrics:
- `synthesisRatio` ❌
- `contradictions` ❌
- `newSynthesisEdges` ❌

**Output from POC (correct version):**
```javascript
{
  typeMatchRatio: number,           // % of edges with same type
  criticalEngagement: "LOW" | "MODERATE" | "STRONG",
  engagementSignals: []             // Explanation of assessment
}
```

**Scoring Logic (from POC):**

```javascript
IF conceptOverlap >= 60% (student used AI's main ideas):
  IF typeMatchRatio >= 70%  → COPIED (LOW)
  IF 40% <= typeMatchRatio < 70%  → MIXED (MODERATE)
  IF typeMatchRatio < 40%  → REORGANIZED (STRONG)

ELSE IF conceptOverlap 30-60% (selective usage):
  IF typeMatchRatio >= 70%  → LOW
  ELSE  → MODERATE

ELSE (conceptOverlap < 30%, independent thinking):
  IF many new concepts (>40% of total)  → STRONG
  ELSE  → MODERATE
```

**Visual Indicators (desired):**
- 🔴 LOW (red) — HIGH risk, copied structure
- 🟡 MODERATE (amber) — Mixed signals
- 🟢 STRONG (green) — Good reorganization/independence

### Test Data

**File:** `test-examples-synthetic.json`  
**Structure:** 3 controlled cases (Low/Medium/High critical thinking)

**Run POC:**
```bash
cd /Users/josephgrgic/Documents/GitHub/"AI coach edtech"
node knowledge-graph-poc.js
```

Should output comparison object with:
- Case 1 (Heavy extraction): HIGH conceptOverlap, HIGH typeMatchRatio → LOW critical thinking ✅
- Case 2 (Reorganized): HIGH conceptOverlap, LOW typeMatchRatio → HIGH critical thinking ✅
- Case 3 (Independent): LOW conceptOverlap → STRONG critical thinking ✅

**Run on original data:**
Edit `knowledge-graph-poc.js` line 8:
```javascript
// Change from:
const testData = JSON.parse(fs.readFileSync('./test-examples-synthetic.json', 'utf8'));

// To:
const testData = JSON.parse(fs.readFileSync('./test-examples.json', 'utf8'));
```

Then: `node knowledge-graph-poc.js`

### Relationship Type Normalization

**File:** `knowledge-graph-poc.js`  
**Function:** `normalizeRelationType(type)`  
**Location:** ~line 91-107

Ensures consistency across LLM variations:
```javascript
produces, creates, causes, leads to, results in  → "causes"
enables, supports, facilitates                   → "enables"
reduces, decreases, opposes, contradicts         → "opposes"
defines, is, describes                           → "defines"
influences, affects, impacts                     → "affects"
```

### Current Integration Status

**In index.html:**
- ✅ `extractKnowledgeGraphFromText()` — working (line 1075)
- ❌ `analyzeTransformation()` — broken, old metrics (line 1115)
- 🟡 Results display — placeholder, needs UI polish

**In knowledge-graph-poc.js:**
- ✅ Complete, production-ready implementation
- ✅ Tested on synthetic and real data
- ⚠️ Uses exponential backoff for Groq rate limiting

**Next Steps:**
1. Replace `analyzeTransformation()` in index.html with POC version
2. Update results display to show typeMatchRatio with color coding
3. Test on test-examples.json (Low/Medium/High samples)
4. Verify alignment with TAUS scores

---

## Integration Status & Gaps

### Signal Flow

```
Input (Conversation + Essay)
  ↓
STEP 1: Parse Format
  ├─ detectFormat() — labeled vs. alternating
  └─ parseConversation() — extract turns
  ↓
STEP 2: Extract Signals (extractSignals)
  ├─ Structure signals (turn counts, word counts)
  ├─ Thinking signals (questions, pushback, own-voice)
  ├─ Dependency signals (extraction/synthesis phrases)
  └─ Overlap signals (5-gram + semantic) — computeOverlap()
  ↓
STEP 3: Score TAUS (scoreSession)
  ├─ T, A, U, S (each 1-5)
  └─ Total (4-20) → SAMR level
  ↓
STEP 4: Parallel NLP Analysis (if Groq key available)
  ├─ Semantic Overlap (computeSemanticOverlap) — Groq embeddings
  ├─ LLM Insights (callGroq) — engagement, authenticity
  └─ Graph Analysis (extractKnowledgeGraphFromText + analyzeTransformation)
  ↓
STEP 5: Render Results
  └─ TAUS scores, signal cards, feedback, insights
```

### Known Gaps

| Gap | Impact | Analysis Method | Status |
|-----|--------|-----------------|--------|
| **Divergence flagging** | When algorithmic & semantic disagree, no context | NLP | Explored but deferred |
| **Unified verdict** | 3 separate overlap metrics hard to interpret | NLP | Needs validation data |
| **Engagement weighting** | Groq engagement level not in TAUS S score | NLP | Not integrated |
| **Graph integration** | Old function references in index.html | Graph | 70% done, blockers documented |
| **Threshold validation** | Risk cutoffs (40%/20%/5%) are rules-of-thumb | TAUS + NLP | Needs real student data |
| **Semantic scaling** | Limited to 10 sentences; doesn't handle long essays | NLP | Needs pagination or sampling |
| **False positive handling** | Boilerplate phrases trigger 5-gram matches | NLP | Needs filtering or weighting |

### Recommended Priority Improvements

**This Week:**
1. ✅ Complete graph analysis integration (copy POC logic to index.html)
2. ✅ Validate TAUS alignment on test data
3. Implement divergence flagging (paraphrase detection)

**Next 2 Weeks:**
1. Collect real student data, validate thresholds
2. Weight Groq engagement into TAUS S score
3. Add boilerplate filter to 5-gram matching

**Nice-to-have:**
1. Semantic similarity pagination for long essays
2. Graph visualization (side-by-side AI vs. essay)
3. UI toggle for critical thinking analysis

---

## Quick Reference: Function Locations

| Function | File | Lines | Purpose |
|----------|------|-------|---------|
| `extractSignals()` | index.html | 700-850 | Count all signal types |
| `scoreSession()` | index.html | 1200-1300 | Convert signals → TAUS scores |
| `generateFeedback()` | index.html | 1360-1450 | Human-readable feedback |
| `computeOverlap()` | index.html | 849-920 | 5-gram verbatim matching |
| `computeSemanticOverlap()` | index.html | 1086-1178 | Groq embeddings similarity |
| `callGroq()` | index.html | 1179-1300 | LLM qualitative assessment |
| `extractKnowledgeGraphFromText()` | index.html | 1075-1114 | Knowledge graph extraction |
| `analyzeTransformation()` | index.html | 1115-1180 | ❌ NEEDS REPLACEMENT |
| `compareGraphs()` | knowledge-graph-poc.js | 109-190 | Graph comparison logic |
| `analyzeTransformation()` | knowledge-graph-poc.js | 191-312 | ✅ CORRECT version (copy this) |
| `normalizeRelationType()` | knowledge-graph-poc.js | 91-107 | Type consistency |

---

## File Structure

```
index.html                              # Main app (80KB)
  ├─ HTML structure
  ├─ CSS (variables, layout, results display)
  └─ JavaScript: TAUS + NLP + Graph analysis

knowledge-graph-poc.js                  # Graph analysis (18KB)
  ├─ Groq API calls + error handling
  ├─ Graph extraction & comparison
  ├─ Transformation analysis
  └─ Test runner (uses test-examples-synthetic.json)

test-examples.json                      # TAUS + NLP validation data
  ├─ Low sample (heavy extraction)
  ├─ Medium sample (mixed synthesis)
  └─ High sample (independent thinking)

test-examples-synthetic.json            # Graph analysis validation
  ├─ Case 1: Heavy extraction → LOW critical thinking
  ├─ Case 2: Reorganized → MODERATE
  └─ Case 3: Independent → STRONG

CRITICAL_THINKING_NEXT_STEPS.md         # Integration checklist
SESSION_SUMMARY.md                      # Most recent work summary
README.md                               # Architecture overview
SETUP.md                                # Setup & deployment
```

---

## Testing Checklist

### TAUS System
- [ ] Parse labeled format (You: / AI:)
- [ ] Parse alternating format
- [ ] Extract signals correctly (counts match manual verification)
- [ ] Score TAUS (4-20 range, alignment with expectations)
- [ ] Generate feedback (specific to low/high dimensions)

### NLP Analysis
- [ ] 5-gram matching finds actual copied sequences
- [ ] Semantic similarity computes (within 0.7-0.95 range typically)
- [ ] Groq insights return engagement level + authenticity flags
- [ ] Handle missing API key gracefully

### Graph Analysis
- [ ] Extract graphs from text (entities and relationships)
- [ ] Compare graphs (conceptOverlap, typeMatchRatio computed)
- [ ] Transform analysis returns correct critical engagement level
- [ ] POC produces expected results on synthetic data
- [ ] Results display shows type match ratio with color coding

---

## Debugging Tips

**Console Logs to Add:**
```javascript
// In extractSignals():
console.log('Extracted signals:', signals);

// In scoreSession():
console.log('TAUS scores:', { T, A, U, S, total, samr });

// In computeOverlap():
console.log('Overlap %:', pct, 'Risk:', risk);

// In analyzeTransformation():
console.log('Type match ratio:', typeMatchRatio, 'Engagement:', criticalEngagement);
```

**API Issues:**
- Check Groq key is valid: `curl -H "Authorization: Bearer YOUR_KEY" https://api.groq.com/openai/v1/models`
- Rate limiting? Check exponential backoff in POC (~line 60)
- Silent failures? Check browser F12 console for errors

**Graph Extraction Failing:**
- Verify text is > 100 chars
- Check Groq API key is enabled
- Try simpler text first (shorter, fewer concepts)
- See knowledge-graph-poc.js error handling for patterns

---

**Last Updated:** April 30, 2026  
**Ready for:** Integration completion, threshold validation, deployment
