# CTA Path B — Built-In Chat App

Dev implementation of the built-in chat (see `../built-in-chat-plan.md`, the source of truth). The single-file paste-in CTA (`../index.html`) is untouched by anything here.

## Run

```
node server/index.js
```

Then open http://localhost:8787. Requires a Groq key in `../config.json` (`groq.apiKey`) or `GROQ_API_KEY`. Zero npm dependencies.

## Seams (dev → prod)

| Module | Dev | Prod |
|---|---|---|
| `server/auth.js` | seeded fake user (`X-Dev-Role: teacher` to switch) | Firebase Auth ID-token verify, domain-restricted |
| `server/llm.js` | Groq (`llama-3.3-70b-versatile`) | Vertex Gemini Flash-Lite |
| `server/store.js` | JSON files in `app/data/` (gitignored) | Firestore |

Route logic in `server/index.js` doesn't change when seams swap; it becomes the Cloud Run service.

## Data model

Collections documented at the top of `server/store.js` — shaped as the future Firestore collections. Turns are **append-only**: edits and regenerations append a new turn with `meta.supersedes: [ids]`; live turns are derived at read time, the full record is the integrity artifact.

## What's implemented (2026-07-16)

- Assignment list → workspace with ChatGPT-style conversation sidebar (unlimited conversations, rename, no delete)
- Streaming coach chat, blank-context per conversation, coaching level fixed per session (full / questions / sounding-board)
- Evaluate button → auditor voice (meta-turns, excluded from future TAU)
- Submit flow with confirmation friction: locks all cycle conversations, records submission, next open starts the next cycle at the next coaching level
- Event logging from day one: copy, regenerate, edit, stop, evaluate, episode-save/resume
- Guardrails: maxOutputTokens capped (500 chat / 400 evaluate)
- **Phase E analysis pipeline** (`server/analysis.js`): submission → turn classification + provenance/flags + TAU scoring (ported verbatim from CTA `scoreTAU`) + narrative snapshot, run async; report polls until complete
- **Draft report page** (`web/report.html`): the CTA's full results presentation ported verbatim — SAMR hero, score summary grid, interactive Agency Chart (d3, patterns, tooltips, turn modal), My Session dashboard, Idea Origins (essay heatmap + concept inventory), Pattern Guide. `report.css`/`report-render.js` are extracted copies of the CTA's style block and render section (source ranges: index.html 8–1137, 2027–2091, 2516–3929, 4589–4602); `report-boot.js` is the API adapter. Full disclosure at the submission marker only (revised 2026-07-16) — never live during a session; integrity flags stripped from student responses, teacher role (`X-Dev-Role: teacher`) sees them
- 429 retry with backoff in `llm.js` (Groq free-tier TPM) + `POST /api/submissions/:id/reanalyze` retry path with a Retry button on the report page

## Not yet

- Divergence chart / embeddings (CTA Call 3) in the report
- Delta provenance (draft N-1 concepts counted as established for draft N)
- UI events (copy/regenerate/edit) folded into TAU scoring — logged and stored in `analysis.eventCounts`, not yet weighted (kept parity with CTA formulas)
- Teacher views (Phase F)
- Per-student daily token budget + rate limiting (needed before any real deployment)
- GCP wiring (Phases A/D)
