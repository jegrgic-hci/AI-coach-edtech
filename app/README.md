# CTA Path B — Built-In Chat App

Dev implementation of the built-in chat (see `../built-in-chat-plan.md`, the source of truth). The single-file paste-in CTA (`../index.html`) is untouched by anything here.

## Run

```
npm install          # first time only
npm start            # → node app/server/index.js
```

Then open http://localhost:8787.

**Setup required** (once): a GCP project with Vertex + Firestore enabled and ADC on your machine — `../app/gcp-setup.md` walks through it. There is no API key: credentials come from `gcloud auth application-default login`.

**One npm dependency**, `firebase-admin`, added 2026-08-05 with the Firestore swap. It is the only one, and the browser side is still dependency-free. Hand-rolling a Firestore REST client would have meant writing the typed-value encoder, queries, pagination and retries ourselves, under the collection holding student records — the wrong place to spend the zero-dependency property.

Boot takes ~20s: the seed is idempotent per record, and every one of those checks is now a network round-trip rather than a hash lookup.

### Test accounts

Everything is behind a login. The seed creates a demo class — **password `coach1234`** for all of them (the login page lists them and fills the form on click):

| Email | Who |
|---|---|
| `maya@school.dev` | student — English 10 + Journalism Elective, strong arc, teacher notes, on the open assignment's draft 1 |
| `devon@school.dev` | student — English 10 + Journalism Elective, flat arc, teacher note, open draft 1 in progress |
| `priya@school.dev` | student — English 10, high-fluency drafts carrying integrity flags (teacher-only), open draft 1 pending analysis |
| `luis@school.dev` | student — English 10, open draft 1 analysis errored |
| `sam@school.dev` | student — English 10, no history on the open assignment yet (empty-state check) |
| `jamie@school.dev` | student — American Literature, open assignment complete (all 3 drafts scored) |
| `elena@school.dev` | student — American Literature, on the open assignment's final draft (in progress) |
| `marcus@school.dev` | student — American Literature, integrity flags, open assignment complete |
| `teacher@school.dev` | teacher — dashboard, roster, notes across all 3 classes |
| `admin@school.dev` | administrator — teacher accounts + aggregate product metrics (`admin.html`) |

Three classes, each with its own open assignment staged at a different point (English 10 on draft 1, Journalism Elective on draft 2, American Literature on the final draft) — plus two closed assignments shared by every class: a 3-draft rhetorical-analysis cycle and a real 44-turn bicycle-maintenance-guide transcript (Claude.ai document co-creation, not a Socratic coach session), cloned onto every student so every roster row is fully scored.

The demo analyses are pre-baked from hand-labeled transcripts in `server/seed-data.js`, run through the real `enrich()`/`scoreTAU()` — so scores stay consistent with the formulas and **no LLM call is needed to browse reports**. Credentials are only needed to actually chat or submit a new draft (see `gcp-setup.md`).

The seed is idempotent per email: it extends what is already in Firestore rather than requiring a wipe, and backfills passwords onto users created before auth existed. To start clean, wipe the collections and re-run — `node app/server/migrate-to-firestore.js --wipe` restores the JSON snapshot, or delete the collections and let `npm start` re-seed from scratch.

## Seams (dev → prod)

| Module | Dev | Prod |
|---|---|---|
| `server/auth.js` | email + password, scrypt hash, opaque session token in an HttpOnly cookie (`authSessions`), suspension checked per request | Firebase Auth ID-token verify, domain-restricted Google SSO |
| `server/llm.js` | **Vertex Gemini (swapped 2026-08-05)** — ADC from `gcloud auth application-default login` | same code; credentials come from the Cloud Run metadata server instead |
| `server/school.js` | which GCP project a call bills to — platform default from `config.json` | per-school override for BYO-inference districts, read from the schools collection |
| `server/store.js` | **Firestore (swapped 2026-08-05)** — `cta-pilot-dev`, `us-central1` | same, per-school project |

Route logic in `server/index.js` doesn't change when seams swap; it becomes the Cloud Run service.

### The Firestore swap (2026-08-05)

`col()` mirrored Firestore's *shape* but was synchronous, so the swap was 153 call sites, not a module replacement. What's worth knowing:

- **Two read forms, and the difference is a bill.** `list({ conversationId: id })` is a real `where()` query. `list((t) => …)` reads the whole collection and filters in memory — fine for `users`/`classes`, wrong for `turns`, which holds every message ever sent. Hot paths were converted to the query form; the surviving predicates are ones equality can't express (date ranges, cross-collection tests) and are commented at the call site.
- **The dangerous edit was not the missing `await`.** `await col('x').list(...)` parses fine, but `await col('x').list(...).sort(...)` calls `.sort()` on a Promise — a runtime failure no syntax check catches. 36 chains needed parenthesising. Same trap on the helpers that became async: `await teacherScope(user).students` reads `.students` off the Promise.
- **Predicates can't await.** `.some()`, `.map()` and `.filter()` bodies that read the store became `for` loops. The `.some()` cases keep their early `break`, so read counts are unchanged.
- **Migration**: `server/migrate-to-firestore.js` moved 1,373 documents with ids preserved, so every cross-collection reference survived. Kept in the repo as the record of what the JSON store held at swap time. `app/data/*.json` is now stale and read by nothing.

## Security posture (audited 2026-08-05)

**One real vulnerability was found and fixed.** Any teacher account could read *any* student's report, essay, full transcript and integrity flags by submission id — the three `/api/submissions/:id/*` routes checked `role === 'teacher'` but not *whose* student it was. The roster routes had always gone through `teacherScope()`; these reached the same data by a different door. Invisible while the seed made one teacher; live from the day an admin could create a second. Found by testing it, not by reading the code. All three now go through `canReadSubmission()`.

Hardening applied to the password path (which is a POC stand-in — see the SSO note below):

| | |
|---|---|
| scrypt cost | N raised 2^14 → 2^16, params stored per user, **upgrade-on-login** so raising it again never locks anyone out |
| session tokens | stored as SHA-256, never plaintext — the row is a bearer credential and a backup or export would otherwise hand over every live session |
| logout | deletes the row rather than expiring it in place |
| session lifetime | 30 days → 7 |
| cookie | `Secure` added when `NODE_ENV=production` (conditional, because localhost is plain HTTP) |
| account enumeration | unknown emails burn the same scrypt work, so "no such account" no longer answers ~100× faster |
| brute force | 10 failures per account per 15 min |
| dev password | production generates a random temp password; the demo seed refuses to run at all under `NODE_ENV=production` |

**Lockout is per-account, never per-IP — deliberately.** A school is one NAT gateway, so an IP lockout means ten fumbled passwords anywhere in the building locks out the whole class. Confirmed by building it that way first and watching an unrelated student with the correct password get refused. Password spraying is therefore *detected and logged* (one address failing against 25+ distinct accounts), not blocked.

Known and accepted while passwords remain: an admin who resets a teacher's password can then sign in as them. It is logged, and it is one of the reasons SSO matters for a real pilot — see `built-in-chat-plan.md`.

**Firestore rules are deployed** (`../firestore.rules`, released 2026-08-05): `allow read, write: if false;`. There were no rules at all before — the database was created via `gcloud` rather than the Firebase console, so none were ever attached and access was governed purely by IAM. Nothing legitimate is denied, because no browser ever holds a Firestore handle; the point is that registering a Firebase web app later can't hand out a client key against a database whose rules were never decided. **Editing that file changes nothing on its own** — it has to be released again through the firebaserules API.

**Least-privilege runtime.** Cloud Run runs as `cta-run@cta-pilot-dev.iam.gserviceaccount.com` holding exactly `roles/aiplatform.user` and `roles/datastore.user` — nothing else. Worth pinning explicitly: the default compute service account Cloud Run would otherwise use carries `roles/editor`.

## Deployment (Cloud Run)

```
gcloud run deploy cta --source . --region us-central1 \
  --service-account=cta-run@cta-pilot-dev.iam.gserviceaccount.com \
  --set-env-vars=NODE_ENV=production,GCP_PROJECT_ID=cta-pilot-dev,GCP_LOCATION=global \
  --no-allow-unauthenticated
```

Live and **public** at `https://cta-714032495709.us-central1.run.app` (opened 2026-08-06). Anyone can reach the login page and sign in with the demo accounts above — deliberate, because every record in that project is fabricated.

Two things make that safe, and one rule keeps it that way:

- **Spend is capped by construction.** The soft cap is 40 coach replies/day/account across 10 demo accounts, so a stranger maxing every one of them costs roughly a dollar a day; the hard tier bounds it absolutely. The $25 budget alert would fire long before anything ran away. This is the usage-cap work paying for itself — a public demo would have been an open tab on the Vertex bill without it.
- **App auth is still enforced.** Removing Cloud Run's IAM gate didn't remove the session layer: `/api/*` returns 401 without a sign-in, and every role and ownership check is unchanged.
- **`cta-pilot-dev` must never hold real student data while these credentials are public.** The demo password is published in this repo, so the moment a real pilot exists it gets its own project — which is already the plan (`gcp-setup.md` step 3). This is the rule most likely to be forgotten under deadline.

- **No config.json in the image** (`.dockerignore`), so deployed instances are configured by environment. `school.js` reads the file in dev and env vars otherwise, with env winning where both exist.
- **No credentials anywhere.** `llm.js` falls through to the Cloud Run metadata server when no ADC file is present — a code path that had never run until this deploy, and now has.
- `NODE_ENV=production` turns on every guard at once: the demo seed refuses to run, temp passwords are random, the session cookie gets `Secure`.
- Verified on the deployed instance: login, student home, conversation create, streaming coach reply through Vertex, and an `llmCalls` row written with real token counts.

## Data model

Collections documented at the top of `server/store.js` — these *are* the Firestore collections now, not a shape standing in for them. Turns are **append-only**: edits and regenerations append a new turn with `meta.supersedes: [ids]`; live turns are derived at read time, the full record is the integrity artifact.

## What's implemented (last updated 2026-08-06)

- Assignment list → workspace with ChatGPT-style conversation sidebar (unlimited conversations, rename, no delete)
- Streaming coach chat, blank-context per conversation, coaching level fixed per session (full / questions / sounding-board)
- Evaluate button → auditor voice (meta-turns, excluded from future TAU)
- Submit flow with confirmation friction: locks all cycle conversations, records submission, next open starts the next cycle at the next coaching level
- Event logging from day one: copy, regenerate, edit, stop, evaluate, episode-save/resume
- Guardrails: maxOutputTokens capped (500 chat / 400 evaluate); `thinkingBudget: 0` on every call
- **Cost accounting** (`server/llm.js` → `llmCalls`): one row per Vertex call with purpose, model, token counts, latency and attribution. Tokens never dollars — a price table lands with the admin cost view, so history stays comparable when prices move
- **Two-tier usage caps** (`server/budget.js`): soft 40 coach replies/day (student-visible, warns at 80%, teacher can grant more via `POST /api/teacher/students/:id/grant-replies`); hard 1M input tokens/day (invisible, logs loudly — reaching it means a bug, not homework). Checked at the turn boundary before the student's turn is persisted. **Submitting is never blocked by chat budget**: analysis is excluded from the count, so a student who chatted a lot still gets their report

### Model choice (measured 2026-08-05, not assumed)

Both chat and analysis run **`gemini-3.1-flash-lite`**, thinking off. Override per kind in `config.json` under `gcp.models` (`chat` / `analysis`) — comparing models is a config edit, not a code change.

The plan specified 3.5 Flash for analysis with a *capped* thinking budget. Two measurements changed that:

1. **`thinkingBudget` is advisory, not a cap.** 3.5 Flash asked for 512 spent **777**. Only `0` holds, so the real choice is thinking-off or thinking-uncapped — and uncapped is the ~$120-semester scenario the cost model warns about.
2. **Thinking is drawn from `maxOutputTokens`.** A 300-token budget with 512 of thinking left *one* token of answer and a `MAX_TOKENS` truncation. `llm.js` therefore adds the thinking allowance on top of the caller's `maxTokens`, so a caller's number always means answer length.

With thinking off, 3.5 Flash loses the advantage that justified its 6× price — on the real classification prompt it mislabeled a turn that Flash-Lite got right. **This is a small sample and provenance quality was not compared systematically**; that comparison is worth running against the seed transcripts before the pilot.
- **Phase E analysis pipeline** (`server/analysis.js`): submission → turn classification + provenance/flags + TAU scoring (ported verbatim from CTA `scoreTAU`) + narrative snapshot, run async; report polls until complete
- **Draft report page** (`web/report.html`): the CTA's full results presentation ported verbatim — SAMR hero, score summary grid, interactive Agency Chart (d3, patterns, tooltips, turn modal), My Session dashboard, Idea Origins (essay heatmap + concept inventory), Pattern Guide. `report.css`/`report-render.js` are extracted copies of the CTA's style block and render section (source ranges: index.html 8–1137, 2027–2091, 2516–3929, 4589–4602); `report-boot.js` is the API adapter. Full disclosure at the submission marker only (revised 2026-07-16) — never live during a session; integrity flags stripped from student responses, teachers see them (decided server-side from the signed-in user's role)
- `POST /api/submissions/:id/reanalyze` retry path with a Retry button on the report page. The Groq 429 retry loop is gone with the Vertex swap — it existed for a free-tier TPM limit that no longer applies

- **Teacher triage dashboard** (`web/dashboard.html`): the existing `teacher-dashboard.html` ported whole (guide first, detail on demand — overview/class/assignment/student tabs, two-tier flag system, side tray, flag detection modal); its mock generator replaced by `/api/teacher/dashboard`, which serves the exact mock shape from real data. Drill panels link into the detail layer: per-submission "Report →" (teacher-mode report) and "Conversation view →" (`teacher.html#student/:aid/:sid`). Reflects the real `classes` collection now — a class tab per class, not a synthesized "My Class"
- **Teacher detail layer** (`web/teacher.html`): assignment creation (prompt, due date, draft budget, coaching level per slot with default-fade prefill), roster with per-cycle TAU/SAMR chips + flag markers, student detail view — trajectory strip (growth across the fade), conversation-ready moments (first turns, best challenge, pushback, unchallenged AI-born concepts), snapshots verbatim, integrity signals, full transcripts with turn labels/meta-turns/superseded turns/events interleaved, teacher note per submission (shown to the student on their report). Report page shows the integrity flags panel with misfire disclosure when a teacher is signed in

- **Administration surface** (`web/admin.html`, `web/admin.js`): the third role. An admin creates
  teacher accounts (name + email; the teacher then builds their own classes/students/assignments),
  edits them, resets a password, and suspends/reactivates — never deletes, since a teacher owns
  classes, assignments, and submission history. Suspension is checked per-request in `auth.js`, so
  it ends a session already open, not just the next login.
  **An admin is not a super-teacher:** every teacher route 403s for them, and `/api/admin/overview`
  carries no student name, transcript, essay, or integrity flag — only aggregates.
  Three sections: *Teachers*, *Content areas* (which parts of the tool people actually open, ranked
  by reach against the real population — a product-prioritisation view, not traffic analytics), and
  *Student work patterns* (conversations per draft, Evaluate uptake, completion rate — derived from
  existing records, so complete from day one).
- **Product telemetry** (`usage` collection, `POST /api/usage`, `logUse()` in `web/api.js`): kept
  deliberately separate from `events`, which is the append-only integrity record feeding TAU.
  Written only for explicit opens (tab click, panel/modal open, report jump-nav click) against a
  server-side allowlist (`USAGE_SURFACES` in `server/index.js`) — never on render, never from the
  report's scrollspy. Areas that render inline with no open of their own are deliberately absent
  rather than logged as page loads wearing a section's name.
- **Per-teacher data scoping** (`teacherScope()` in `server/index.js`): `/api/teacher/dashboard` and
  `/api/teacher/assignments` used to list *every* student and class in the install, and the student-
  detail, assignment-edit, assignment-note and submission-note routes had no ownership check at all.
  Invisible with one seeded teacher; a cross-teacher leak of rosters, scores, and integrity flags the
  moment an admin can create a second one. All now scoped to the teacher's own classes/assignments.
- **Login + student account view** (`web/login.html`, `web/api.js`): every `/api/*` route requires a session; a 401 lands on the login page from any surface. The student home (`web/index.html`) shows current work with the coaching level for the next draft, past assignments with per-draft score chips linking to their reports, and a teacher-note badge. The rail's dimension guidance uses the same fixed names (Prompting Quality, Selective Use, Calibrated Skepticism, Original Contribution) as the report page, per designsystem.md's Hard Constraints. The Google SSO button is present but disabled — Phase A fills it in

## Not yet

- Divergence chart / embeddings (CTA Call 3) in the report
- Delta provenance (draft N-1 concepts counted as established for draft N)
- UI events (copy/regenerate/edit) folded into TAU scoring — logged and stored in `analysis.eventCounts`, not yet weighted (kept parity with CTA formulas)
- Per-student daily token budget + rate limiting (needed before any real deployment)
- GCP wiring (Phases A/D). The dev login is a **stand-in**: passwords are not the plan for minors — Phase A replaces `auth.js` with domain-restricted Google SSO
- Real class enrolment now exists (`classes` collection, assignments scoped by `classIds`) — see the seed for the current 3-class demo shape
