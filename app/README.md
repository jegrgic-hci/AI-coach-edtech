# CTA Path B — Built-In Chat App

Dev implementation of the built-in chat (see `../built-in-chat-plan.md`, the source of truth). The single-file paste-in CTA (`../index.html`) is untouched by anything here.

## Run

```
node server/index.js
```

Then open http://localhost:8787. Requires a Groq key in `../config.json` (`groq.apiKey`) or `GROQ_API_KEY`. Zero npm dependencies.

### Test accounts

Everything is behind a login. The seed creates a demo class — **password `coach1234`** for all of them (the login page lists them and fills the form on click):

| Email | Who |
|---|---|
| `maya@school.dev` | student — strong arc (12 → 18 → 20), teacher note, mid-way through a second assignment |
| `devon@school.dev` | student — flat arc (5 → 6 → 8), teacher note, one genuinely original idea in the last draft |
| `priya@school.dev` | student — high-fluency drafts carrying three integrity flags (teacher-only) |
| `luis@school.dev` | student — mid-assignment |
| `sam@school.dev` | student — no history yet (empty-state check) |
| `teacher@school.dev` | teacher — dashboard, roster, notes |

The demo analyses are pre-baked from hand-labeled transcripts in `server/seed-data.js`, run through the real `enrich()`/`scoreTAU()` — so scores stay consistent with the formulas and **no LLM call or Groq key is needed to browse reports**. A key is only needed to actually chat or submit a new draft.

The seed is idempotent per email: it extends an existing `app/data/` rather than requiring a wipe, and backfills passwords onto users created before auth existed. To start clean, delete `app/data/*.json`.

## Seams (dev → prod)

| Module | Dev | Prod |
|---|---|---|
| `server/auth.js` | email + password, scrypt hash, opaque session token in an HttpOnly cookie (`authSessions`) | Firebase Auth ID-token verify, domain-restricted Google SSO |
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
- **Draft report page** (`web/report.html`): the CTA's full results presentation ported verbatim — SAMR hero, score summary grid, interactive Agency Chart (d3, patterns, tooltips, turn modal), My Session dashboard, Idea Origins (essay heatmap + concept inventory), Pattern Guide. `report.css`/`report-render.js` are extracted copies of the CTA's style block and render section (source ranges: index.html 8–1137, 2027–2091, 2516–3929, 4589–4602); `report-boot.js` is the API adapter. Full disclosure at the submission marker only (revised 2026-07-16) — never live during a session; integrity flags stripped from student responses, teachers see them (decided server-side from the signed-in user's role)
- 429 retry with backoff in `llm.js` (Groq free-tier TPM) + `POST /api/submissions/:id/reanalyze` retry path with a Retry button on the report page

- **Teacher triage dashboard** (`web/dashboard.html`): the existing `teacher-dashboard.html` ported whole (guide first, detail on demand — overview/class/assignment/student tabs, two-tier flag system, side tray, flag detection modal); its mock generator replaced by `/api/teacher/dashboard`, which serves the exact mock shape from real data. Drill panels link into the detail layer: per-submission "Report →" (teacher-mode report) and "Conversation view →" (`teacher.html#student/:aid/:sid`). Classes synthesized as one "My Class" until the data model grows them
- **Teacher detail layer** (`web/teacher.html`): assignment creation (prompt, due date, draft budget, coaching level per slot with default-fade prefill), roster with per-cycle TAU/SAMR chips + flag markers, student detail view — trajectory strip (growth across the fade), conversation-ready moments (first turns, best challenge, pushback, unchallenged AI-born concepts), snapshots verbatim, integrity signals, full transcripts with turn labels/meta-turns/superseded turns/events interleaved, teacher note per submission (shown to the student on their report). Report page shows the integrity flags panel with misfire disclosure when a teacher is signed in

- **Login + student account view** (`web/login.html`, `web/api.js`): every `/api/*` route requires a session; a 401 lands on the login page from any surface. The student home (`web/index.html`) shows current work with the coaching level for the next draft, past assignments with per-draft score chips linking to their reports, a teacher-note badge, and a sparkline of TAU total across submitted drafts (hidden below two points). Dimensions are named in student language on this surface, not by acronym. The Google SSO button is present but disabled — Phase A fills it in

## Not yet

- Divergence chart / embeddings (CTA Call 3) in the report
- Delta provenance (draft N-1 concepts counted as established for draft N)
- UI events (copy/regenerate/edit) folded into TAU scoring — logged and stored in `analysis.eventCounts`, not yet weighted (kept parity with CTA formulas)
- Per-student daily token budget + rate limiting (needed before any real deployment)
- GCP wiring (Phases A/D). The dev login is a **stand-in**: passwords are not the plan for minors — Phase A replaces `auth.js` with domain-restricted Google SSO
- Real classes/enrolment. Every assignment is still visible to every student; the dashboard synthesizes one "My Class"
