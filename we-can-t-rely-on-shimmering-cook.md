# Decision: How to capture an accurate AI chat log while keeping tool independence

## Context

CTA's entire analysis depends on an accurate chat log — specifically, reliable **role attribution** (who said what, turn by turn) and **completeness** (no missing/truncated turns). The current capture method (asking the student's AI to reformat the conversation into `<<<STUDENT>>>`/`<<<AI>>>` markers) is unreliable: LLMs truncate on long sessions, drift from the instruction, summarize instead of copying verbatim, and add stray markdown to markers.

Hard constraints (from the user):
- **No client modification** — bookmarklets and browser extensions are out (students can't/won't install anything; org-managed devices).
- **Legal + privacy** — the tool is currently 100% client-side; chat log + essay go only to Groq, nothing else, no backend. Any option that adds a server that *touches* the conversation is a privacy regression.
- **Tool independence is the goal** — students use whichever AI they prefer (ChatGPT, Claude, Gemini, etc.).
- **In-tool chat is the explicit last resort** — building the AI chat into CTA gives perfect data but sacrifices independence; only accept it if independence genuinely can't deliver.

Already ruled out:
- **Bookmarklet / browser extension** — violates no-install.
- **Raw copy-paste + heuristic parser** — already tried, performed poorly. Root cause: copy-paste flattens the DOM's role structure into undifferentiated text, forcing the parser to *guess* speaker boundaries from content alone (an impossible job).

## The core tension

You cannot simultaneously maximize all four: **independence · accuracy · zero-install · zero-friction**. Every capture method sacrifices at least one. The decision is which sacrifice is acceptable, and what residual gap remains that only the in-tool chat closes.

Accuracy fundamentally requires **preserved role structure**. That structure exists losslessly in exactly three places, none of which is the AI's memory:
1. The rendered DOM (needs install → ruled out)
2. The platform's structured export file
3. The platform's share-link page (structured JSON embedded in HTML)

Everything that *reconstructs* roles instead of *preserving* them (the AI reformat prompt; the heuristic parser) inherits unavoidable error.

## Relevant codebase findings

- **100% client-side, no backend.** Only network calls: Groq API (`api.groq.com`), CDN libs (pdf.js, d3), and `./config.json`. `index.html:2280, 2342, 2417`.
- **`detectPlatform()` already recognizes structured formats but does NOT parse them:**
  - `chatgpt-json` — detects `{ "mapping" | "conversations" }` (ChatGPT's `conversations.json` export). `index.html:1838`
  - `claude-api` — detects `human:` / `assistant:` prefixes. `index.html:1838`
  - Both fall through to the text fallback and fail. **A structured-export parser is half-built and stubbed.**
- **There is already an LLM "repair" stage** for unstructured input: Call 3 (`index.html:2417`) sends flat text blocks to Groq to classify student-vs-AI in chunks of 30. So the "raw parser" already has LLM assistance — and still underperformed, confirming role-from-content is the wrong layer to solve this at.
- **Multi-file merge already exists:** uploaded files are concatenated with `\n\n<<<SESSION BREAK>>>\n\n` and the marker is skipped by `parseLog`. `index.html:1450, 1884`. Checkpoint/segment workflows are already supported by the ingestion layer.
- Chat upload currently accepts only `.md`/`.txt` (`index.html:1489`); essay upload already does PDF via pdf.js. Adding `.json` is trivial.

## User decisions (resolved)

1. **Independence model: best-per-tool (tiered).** Willing to build/maintain per-platform handling for better accuracy.
2. **Whole-history exports: NOT acceptable.** Students must never upload unrelated conversations, even client-side. → **Eliminates native exports (ChatGPT `conversations.json`, Claude export, Gemini Takeout)**, all of which are whole-history dumps. (The stubbed `chatgpt-json` detection at `index.html:1838` is therefore *not* the path forward.)

## Exhaustive option map (independence-preserving only)

| # | Option | Role accuracy | Complete? | Install? | History scope | Backend? | Per-tool? | Status |
|---|--------|--------------|-----------|----------|---------------|----------|-----------|--------|
| 1 | **AI reformat prompt** (+ checkpoints) | Reconstructed — lossy | Risk (mitigated by segments) | None | Single | No | Tunable | **Survives** — universal fallback |
| 2 | **Native structured export** | Perfect | Yes | None | **Whole history** | No | Yes | ❌ Ruled out (privacy) |
| 3 | **Share-link fetch** | Perfect | Yes | None | Single | **Yes (proxy)** | Yes | ❌ Ruled out (backend/privacy) |
| 4 | **Save-page-as-HTML + client DOM parse** | Perfect (DOM roles) | Risk (virtualized DOM) | None (native Save) | **Single** | No | Yes | **Survives** — lossless per-tool path |
| 5 | **In-tool chat** (last resort) | Perfect | Yes | None | Single | (own it) | n/a | Not independent — gap-closer |

### Reconciliation of the two decisions

"Best-per-tool" + "no whole-history" + "no install" + "no backend" squeezes out every *export*- and *share-link*-based path. What survives as an independent, role-preserving, single-conversation method is **Save-page-as-HTML (Option 4)** — and it happens to be inherently per-platform, satisfying the tiering preference. The AI prompt (Option 1) remains the only *universal* method but is permanently lossy on roles. Neither fully closes the gap that the in-tool chat (Option 5) closes.

### Verdicts

- **Option 4 (Save-as-HTML) — the lossless Tier-1 candidate.** Native Ctrl/Cmd+S → `.html`; parse the DOM client-side with native `DOMParser`; extract role-labeled turns. Single conversation (privacy-clean), no install, no backend, per-platform (fits tiering). Risks: (a) **virtualized DOM** truncation on long chats — mitigate with "scroll to top first" instruction + a turn-count sanity check; (b) **selector fragility** per platform — but fails *loud* (parse returns nothing → we tell the student), not silent. Unproven in practice → must prototype against one platform before committing.
- **Option 1 (AI prompt) — universal Tier-2 fallback.** Harden it: repair marker/formatting damage in `parseLog` (we control it), keep the checkpoint/segment workflow (already supported via `<<<SESSION BREAK>>>` merge at `index.html:1450`) to beat truncation, and add loud **truncation detection** (too-few-turns, first-turn-reads-mid-conversation, role-imbalance) so a degraded log is flagged, never silently scored.
- **Option 5 (in-tool chat) — residual-gap closer.** The honest conclusion of "exhausting independence": independence can reach *hardened, per-platform, lossless-where-DOM-cooperates* — but cannot guarantee lossless+complete for every tool/length without it. Reserve for high-stakes/graded contexts where a flagged-incomplete log is unacceptable.

## Decisive use-case input (resolved)

Primary use is **coaching** (low-stakes — an imperfect log is acceptable), but the tool **will be used for grading** by some teachers. This reframes the goal: the risk is not inaccuracy, it is *silent* inaccuracy — an incomplete log producing a clean-looking TAU score that a teacher grades against. The fix is not a better capture method; it is **making the tool honest about how much it trusts the log it received**, so a degraded log never wears a confident score.

This makes the elaborate per-tool capture work (Save-as-HTML prototype, etc.) unnecessary for now. Capture stays universal and good-enough; the new investment goes into **completeness/confidence signalling**.

## Recommendation — build now

Three pieces, all in `index.html`, reusing existing infrastructure:

1. **Keep the universal AI reformat prompt** (already rewritten with the checkpoint/segment workflow). No new capture mechanism.

2. **Harden `parseLog` against formatting damage.** Make the marker regexes tolerant of surrounding markdown so ChatGPT's bold-wrapped markers parse. Currently `STUDENT_DELIM = /^<<<\s*STUDENT\s*>>>$/i` (`index.html:1882`) fails on `**<<<STUDENT>>>**`. Strip leading/trailing markdown emphasis (`*`, `_`, backticks) before matching. Small, contained change.

3. **Completeness detection + visible confidence banner** — the load-bearing addition:
   - Add a `assessLogCompleteness(turns, essayText)` check after parsing that flags: too-few-turns relative to essay length, a first student turn that reads mid-conversation (references prior context: "also", "another", "going back to", pronouns with no antecedent), strong student/AI role imbalance, and summarization signatures (turns that read like recaps, e.g. "earlier we discussed").
   - Surface the result as a **confidence/completeness banner on the results view**, with an explicit "this log looks incomplete — not suitable for grading" state when flags fire. Reuse the existing results-panel rendering and the integrity-flag pattern (`computeIntegrityFlags`, teacher-only flags already exist).

**Documented, NOT built now:** in-tool chat as the upgrade path for any teacher wanting grade-grade rigor. Note it in the teacher guide so the boundary is explicit: CTA's independent capture is built for coaching; high-stakes grading should use the owned-chat mode.

Reuses: file-upload + `.md/.txt` pipeline (`index.html:1468`), multi-file `<<<SESSION BREAK>>>` merge (`index.html:1450`), platform preprocessing pattern (`preprocessClaudeWeb`, `index.html:1846`), Groq block-classifier repair (`index.html:2417`), and the integrity-flag rendering pattern.

## Critical files

- `index.html` — `parseLog` marker regexes (~`1882`), new `assessLogCompleteness` near parsing, results-view banner near the summary panel and `computeIntegrityFlags`.
- `teacher-guide.md` — document the coaching-vs-grading boundary and the in-tool-chat upgrade path.
- `chat_log_instructions.md` — already updated for the checkpoint workflow.

## Verification

- **Parser hardening:** feed a log with `**<<<STUDENT>>>**` / `*<<<AI>>>*` markers; confirm turns parse with correct roles.
- **Completeness detection:** feed (a) a deliberately truncated log (first turn mid-conversation), (b) a too-short log against a long essay, (c) a role-imbalanced log — confirm the banner fires "incomplete / not for grading" in each. Feed a clean complete log — confirm it shows full confidence with no false positive.
- **End-to-end:** run a full analysis on a complete sample (existing Low/Med/High samples) and confirm the confidence banner reads "complete" and scores render as before.
