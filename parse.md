# Chat Log Parsing — Design & Status

## The Problem

Students need to submit their AI chat log alongside their essay for analysis. The tool must reliably identify every turn and attribute it to the correct speaker (student or AI). Getting the raw session data from any AI platform into a parseable format is the core challenge.

---

## What Was Tried and Why It Failed

### Option 1 — Parse raw copy/paste or PDF directly

Every approach to parse unformatted chat logs was exhausted:

| Approach | Problem |
|---|---|
| Regex with colon labels (`You:`, `ChatGPT:`) | Missed standalone-label PDF exports entirely |
| Regex extended to standalone labels | Fragile — "User" appears in content, model names appear as metadata |
| Groq LLM reproducing full turn text | Output tokens doubled — 413 and 429 rate limit errors on even 5-page logs |
| Groq compact label approach (index only) | Still hit TPM limits on free tier; rate limiting even with backoff |
| Heuristic content classification | 36-page log → 7 turns detected. Gross failure at scale |
| PDF vision / OpenCV | Browser-only app — no server, no viable client-side path |
| Platform share links (Gemini, Claude.ai) | CORS blocked (`cross-origin-resource-policy: same-site`), `x-frame-options: DENY`, page is client-side rendered so fetch returns empty shell |
| Browser bookmarklet | Too fragile — platform DOM changes break it silently; too much setup for students |

**Root cause:** Copy/paste from Claude.ai, Gemini, and most AI platforms produces no speaker labels. There is no reliable structural or visual signal to distinguish student from AI turns without either owning the session or controlling the output format.

**PDF is the worst possible format** — text extraction via PDF.js reconstructs character positions by Y-coordinate, producing mangled whitespace, interleaved columns, and split words. Even clean PDFs from AI platforms produce illegible extracted text.

---

## Known Failure Modes for Option 2

### Multiple Sessions

Students working on longer assignments often span multiple AI sessions. This is not a significant problem for analysis:

- When a student starts a new session, the AI has no memory of the previous one — sessions are already independent by nature
- TAU dimensions (PQ, SU, CS, OC) count events and patterns across turns; merging sessions in any order does not change the counts
- Thread detection uses semantic embedding similarity — it groups related turns regardless of which file they came from
- Order only matters if measuring *growth over time* across sessions, which is not a current scoring dimension

**Handling:** Allow multiple file uploads and concatenate them. No ordering UI needed. A `<<<SESSION BREAK>>>` line between files keeps the parser clean, but the `<<<STUDENT>>>` / `<<<AI>>>` delimiters will handle the merge correctly regardless.

---

### Session Compaction

This is a real and serious failure mode. When a session gets very long, the AI platform automatically compacts (summarizes) earlier turns to stay within its context window. If the student runs the formatting prompt at the end of a compacted session:

- The AI outputs a summary of early turns rather than the actual text
- The student cannot tell anything is wrong
- The tool receives and scores a partial session silently — no error, no warning

**Why a session-start prompt cannot fix this:**

Compaction is infrastructure-level — the platform triggers it when the context window fills, and the model has no control over it. A prompt like `do not compact this session` will be acknowledged or ignored, then overridden by the platform when it hits its limit. The model also cannot detect from inside the session that earlier turns have been summarized.

A session-start prompt can ask the AI to flag context loss — some models will note when they cannot recall earlier content — but this is not reliable:

```
This is an AI-assisted writing session I will need to export at the end.
If you ever lose context of our earlier conversation, tell me immediately.
At the end, I will ask you to reformat the full conversation for submission.
```

**Best available mitigation:** Mid-session checkpoints. Student runs the formatting prompt every 15–20 turns and saves the output as `session_1.md`, `session_2.md`, etc. Builds a paper trail incrementally rather than recovering everything at the end. High friction — adds repeated steps throughout the session.

**Root cause:** Both the multi-session problem and the compaction problem exist because the student's AI session lives outside the tool. Path B (built-in AI session) eliminates both at the root — turns are captured in real time as they happen, so compaction is structurally impossible and multi-session becomes a non-issue.

---

## Viable Paths Forward

### Path A — Option 2: Formatting Prompt (current production strategy)

Student runs a single formatting prompt in their AI session at the end of their work. The AI reformats the entire conversation using deterministic delimiters. Student copies the output and pastes it into the tool, or downloads the file and uploads it.

**Why this works:**
- The AI knows exactly which messages it wrote and which the student wrote
- Output format is controlled — our delimiter is unique and unambiguous
- Works on every platform (Claude, Gemini, ChatGPT, Mistral, Grok, etc.)
- No third parties, no CORS, no rate limits — parser runs entirely locally
- A 36-page session parses in milliseconds with 100% accuracy

**The formatting prompt (locked):**
```
Reformat our entire conversation from the very beginning using these exact markers:

<<<STUDENT>>>
[student message]

<<<AI>>>
[AI response]

Rules:
- Start immediately with the first marker — no introduction or explanation
- Every message must have a marker on its own line above it
- Copy every message in full — do not summarize or shorten anything
- Use only <<<STUDENT>>> and <<<AI>>> — no other labels or formatting

When done, save the result as a markdown file named chat_log.md so I can
download it. If your platform does not support file downloads, output the
full formatted text so I can copy and save it manually.
```

**Parser implementation:**
- `<<<STUDENT>>>` and `<<<AI>>>` checked first, before all other label patterns
- Regex: `/^<<<\s*STUDENT\s*>>>/i` and `/^<<<\s*AI\s*>>>/i`
- Separator lines (`---`, `===`, `___`) stripped before parsing
- Everything before the first delimiter is ignored (handles AI preamble)
- Paste into textarea OR upload `.md` / `.txt` — both work identically

**Student friction:** One prompt to run at the end of their session. Not zero friction, but minimal and framed as a submission requirement.

---

### Path B — Built-in AI Session (planned, post-Gemini migration)

Student does their AI-assisted writing work directly inside the tool. Turns are captured natively as they happen — no parsing needed at all.

**Why this is the right long-term direction:**
- Eliminates the parsing problem entirely
- Real-time TAU scoring as the session progresses
- Teacher sees the full unmodified session natively
- No copy/paste, no formatting prompt, no file management
- Student uses the same interface for work and submission

**What it requires:**
- Gemini API confirmed and integrated (replacing Groq)
- Chat interface UI built into index.html
- Session storage during the conversation

**Path A remains useful even after Path B is built** — some students will always need to import from an external session (assignments started before using the tool, school-mandated platform requirements, etc.).

---

## API Migration

Groq was the POC API. The production platform is **Gemini for Google Workspace** (FERPA compliant, school-approved).

| Current (Groq) | Target (Gemini) |
|---|---|
| `llama-3.3-70b-versatile` | `gemini-1.5-flash` or `gemini-1.5-pro` |
| `nomic-embed-text-v1.5` | `text-embedding-004` |
| API key in localStorage | AI Studio API key (confirm with IT) |

Migration is API-layer only — scoring logic, parsing, and UI do not change.

**Prerequisite:** Confirm school has Gemini API access (Vertex AI or AI Studio key) — not just the Gemini chat UI in Google Workspace.

---

## Implementation Status

| Component | Status |
|---|---|
| `<<<STUDENT>>>` / `<<<AI>>>` parser | Done — in parse.html, needs porting to index.html |
| Separator line stripping | Done — in parse.html, needs porting to index.html |
| Instruction card UI with copyable prompt | Done — in parse.html, needs porting to index.html |
| File upload (PDF, TXT, MD) | Done — in parse.html |
| Groq → Gemini migration | Pending API access confirmation |
| Built-in chat interface | Not started |

---

## Files

- `index.html` — main tool (parsing logic needs updating from parse.html)
- `parse.html` — parsing test harness with latest parser + instruction card
- `parse.md` — this document
