# CTA Path B — Built-In Chat App

Dev implementation of the built-in chat (see `../built-in-chat-plan.md`, the source of truth). The single-file paste-in CTA (`../index.html`) is untouched by anything here.

## Run

```
npm install          # first time only
npm run start:demo   # → SEED_DEMO=1 node app/server/index.js
```

Then open http://localhost:8787.

**Use `start:demo` for everyday work** — it's the one that seeds the demo class below. Plain `npm start` starts the same server against the same store but seeds nothing, which is what production runs. The seed is opt-in as of 2026-08-08 (see *Two projects* below); if the login page shows no test accounts, that's the flag missing, not a broken store.

**Setup required** (once): a GCP project with Vertex + Firestore enabled and ADC on your machine — `../app/gcp-setup.md` walks through it. There is no API key: credentials come from `gcloud auth application-default login`.

**One npm dependency**, `firebase-admin`, added 2026-08-05 with the Firestore swap. It is the only one, and the browser side is still dependency-free. Hand-rolling a Firestore REST client would have meant writing the typed-value encoder, queries, pagination and retries ourselves, under the collection holding student records — the wrong place to spend the zero-dependency property.

Boot takes ~20s: the seed is idempotent per record, and every one of those checks is now a network round-trip rather than a hash lookup.

### Test accounts

Everything is behind a login. `npm run start:demo` creates a demo class — **password `coach1234`** for all of them (the login page lists them and fills the form on click, on demo instances only):

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
| `teacher@school.dev` | teacher — dashboard, roster, notes across all 3 classes. **No admin grant** — see below |
| `newteacher@school.dev` | teacher — **nothing set up**: the new-teacher Home (set-up cards + Learn the tool). Named rosters |
| `pilotteacher@school.dev` | teacher — the same empty Home, but a **Pilot user** (`codeRoster`), so Add students describes and opens the anonymous count-and-theme form |

**The two empty teachers are empty on purpose.** They are the only way to reach the new-teacher Home
— every other seeded account has already passed through it — so the seed deliberately gives them no
class, and a "helpful" one would delete the state they exist to show. Give either one a class and the
cards mark themselves done in order; to get the first screen back, delete the class.

**No seeded account holds an admin grant, and this is a security boundary — do not restore one to
make a surface easier to demo.** Until 2026-08-23 `admin@school.dev` was seeded as a platform-admin
and `teacher@school.dev` as a school administrator. Both passed `canAdminPeople`, which opens every
`/api/admin/*` route, and two of those compose into an **account takeover**: `teachers/:id/edit` sets
any teacher's email address and `teachers/:id/send-reset` then mails a recovery link to it. With the
password above published here and staging serving a public login page, that was a route into every
real teacher account sharing the project — and a real teacher's class was in `cta-pilot-dev` at the
time. `admin@school.dev` is deleted; `teacher@school.dev` keeps everything except the Administration
link in the account chip.

**To reach `admin.html`, use a real platform-admin account** — `bootstrap-admin.js` creates the first
one on an empty store. A store seeded before this change still carries the old grants:
`node app/server/revoke-seeded-admin.js --write` removes them (dry run without `--write`).

*Still open, and not fixed by the above:* any legitimate admin can still change a teacher's email and
then send a reset, and an email change is audited as a bare `edit` with no old→new detail.

Three classes, each with its own open assignment staged at a different point (English 10 on draft 1, Journalism Elective on draft 2, American Literature on the final draft) — plus two closed assignments shared by every class: a 3-draft rhetorical-analysis cycle and a real 44-turn bicycle-maintenance-guide transcript (Claude.ai document co-creation, not a Socratic coach session), cloned onto every student so every roster row is fully scored.

The demo analyses are pre-baked from hand-labeled transcripts in `server/seed-data.js`, run through the real `enrich()`/`scoreTAU()` — so scores stay consistent with the formulas and **no LLM call is needed to browse reports**. Credentials are only needed to actually chat or submit a new draft (see `gcp-setup.md`).

The seed is idempotent per email: it extends what is already in Firestore rather than requiring a wipe, and backfills passwords onto users created before auth existed. To start clean, wipe the collections and re-run — `node app/server/migrate-to-firestore.js --wipe` restores the JSON snapshot, or delete the collections and let `npm run start:demo` re-seed from scratch. `npm run seed` reseeds without starting the server (it was a no-op until 2026-08-08).

## Seams (dev → prod)

| Module | Dev | Prod |
|---|---|---|
| `server/auth.js` | email + password, scrypt hash, opaque session token in an HttpOnly cookie (`authSessions`), suspension checked per request; accounts are created password-less and set one via an emailed single-use `credentialTokens` link | Firebase Auth ID-token verify, domain-restricted Google SSO |
| `server/mail.js` | prints the message to the console when no API key is set | SMTP2GO HTTP API (`api.smtp2go.com/v3/email/send`) — **not SMTP**, which Cloud Run blocks |
| `server/llm.js` | **Vertex Gemini (swapped 2026-08-05)** — ADC from `gcloud auth application-default login` | same code; credentials come from the Cloud Run metadata server instead |
| `server/school.js` | which GCP project a call bills to — platform default from `config.json` | per-school override for BYO-inference districts, read from the schools collection |
| `server/store.js` | **Firestore (swapped 2026-08-05)** — `cta-pilot-dev`, `us-central1` | same code, `tau-thinking-prod` (2026-08-08); per-school project later |

Route logic in `server/index.js` doesn't change when seams swap; it becomes the Cloud Run service.

### Mail configuration

`config.json` gains a `mail` block; env wins where both exist, same rule as `school.js`.

| Key | Env var | What it is |
|---|---|---|
| `mail.apiKey` | `SMTP2GO_API_KEY` | SMTP2GO API key. **Absent in dev = console fallback**; absent in production = refuses to send |
| `mail.from` | `MAIL_FROM` | `Tau Thinking <no-reply@tauthinking.com>` — must be on a verified sender domain |
| `mail.appUrl` | `APP_URL` | Public origin invite links point at. Never derived from the Host header, which a forged one could rewrite |
| `mail.webhookSecret` | `MAIL_WEBHOOK_SECRET` | Shared secret sent as the `Authorization` header on `POST /api/webhooks/smtp2go`. Without it the route 404s, so delivery status is simply never recorded |

Sending domain `tauthinking.com` is verified with SMTP2GO (return-path `em736841`, DKIM `s736841._domainkey`, tracking `link` — all CNAMEs, all **DNS-only** in Cloudflare). **Do not add `include:spf.smtp2go.com` to the root SPF record:** the CNAME'd return path means SPF is evaluated against `em736841.tauthinking.com` and inherits it there, so a root include would authorize the provider's whole shared range to send as the domain for no benefit. Inbound is Cloudflare Email Routing with a catch-all; DMARC is at `p=none`.

**Keys per environment.** Two separate SMTP2GO keys, so revoking one never touches the other: production's lives in `tau-thinking-prod`'s Secret Manager, staging's in `cta-pilot-dev`'s, and local reads `config.json`. Both deployed instances get theirs via `--set-secrets`, never from the committed env-var line. Staging sends real email on purpose — the thing being reviewed there is the onboarding itself. **But staging shares `cta-pilot-dev`'s Firestore with local dev**, so it holds `@school.dev` fixture accounts; inviting one bounces against a domain that does not exist and spends the 200/day allowance. Invite real addresses only.

**One webhook, on production.** The free plan allows exactly one, so staging sets no `MAIL_WEBHOOK_SECRET` and never records delivery status — its roster reads "invite sent" rather than "delivered". Sending is unaffected.

Free-plan ceilings are held in `mail.js` (`LIMITS`): 200/day, 1,000/month. `sendMail()` checks the daily one before calling out, so hitting it reads as "at the daily limit" on the admin surface rather than as an opaque provider error — a whole-school import is the case that reaches it.

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
| dev password | production generates a random temp password. The demo seed is opt-in (`SEED_DEMO=1`) and throws if `NODE_ENV=production` is also set; `DEV_PASSWORD` moved from `seed-data.js` to `auth.js` so a production process never loads the demo fixtures at all |

**Lockout is per-account, never per-IP — deliberately.** A school is one NAT gateway, so an IP lockout means ten fumbled passwords anywhere in the building locks out the whole class. Confirmed by building it that way first and watching an unrelated student with the correct password get refused. Password spraying is therefore *detected and logged* (one address failing against 25+ distinct accounts), not blocked.

Known and accepted while passwords remain: an admin who resets a teacher's password can then sign in as them. It is logged, and it is one of the reasons SSO matters for a real pilot — see `built-in-chat-plan.md`.

**Firestore rules are deployed** (`../firestore.rules`, released 2026-08-05): `allow read, write: if false;`. There were no rules at all before — the database was created via `gcloud` rather than the Firebase console, so none were ever attached and access was governed purely by IAM. Nothing legitimate is denied, because no browser ever holds a Firestore handle; the point is that registering a Firebase web app later can't hand out a client key against a database whose rules were never decided. **Editing that file changes nothing on its own** — it has to be released again through the firebaserules API.

**Least-privilege runtime.** Cloud Run runs as `cta-run@tau-thinking-prod.iam.gserviceaccount.com` (and `cta-run@cta-pilot-dev` on the demo project) holding exactly `roles/aiplatform.user` and `roles/datastore.user` — nothing else. Worth pinning explicitly: the default compute service account Cloud Run would otherwise use carries `roles/editor`.

## Two projects: demo and real (2026-08-08)

Real users arrive, so the demo and the product no longer share a database.

| | `cta-pilot-dev` | `tau-thinking-prod` |
|---|---|---|
| Holds | fabricated demo records | real schools |
| Reached by | your machine (`config.json`) and staging | Cloud Run only (env vars) |
| Demo seed | `npm run start:demo` | refuses to run |
| Firestore | `(default)`, us-central1 | `(default)`, us-central1, deny-all rules released |
| Runtime identity | `cta-run@cta-pilot-dev` | `cta-run@tau-thinking-prod` |

Nothing about local work changes: `config.json` still points at `cta-pilot-dev`, the demo class is still there, and you still sign in as `teacher@school.dev`. What changed is that production is somewhere else and cannot be seeded.

### Three environments (staging added 2026-08-10)

Two projects, three places the app runs. Staging exists so a change can be put
in front of a stakeholder without that being the same act as shipping to
schools — before this, the only deployed instance anyone could be sent to was
production.

| | Local | Staging | Production |
|---|---|---|---|
| URL | `localhost:8787` | `staging.tauthinking.com` | `app.tauthinking.com` |
| GCP project | `cta-pilot-dev` | `cta-pilot-dev` | `tau-thinking-prod` |
| Deployed by | — | push to `staging` | push to `main` |
| Build config | — | `cloudbuild.staging.yaml` | `cloudbuild.yaml` |
| `NODE_ENV` | unset | `staging` | `production` |
| Demo data | reseeds every start | seeds an empty store once | never |
| Data in it | fabricated | fabricated | real students |

**Staging and local share a Firestore.** They are the same project, so demo
records you create locally show up on staging and vice versa. That is a
deliberate simplification, not an oversight — a third GCP project would need
its own Vertex quota, service accounts, billing and deny-all rules to hold
nothing but more fabricated records. The consequence to remember: wiping
collections locally wipes what a stakeholder is looking at.

**Staging is not a production rehearsal.** It runs `NODE_ENV=staging`, which is
what allows the demo seed and the shared test-account password, so it is
deliberately *not* byte-identical to prod. It catches deploy-shaped bugs (the
container, the service account, env-var config, the metadata-server credential
path) — not production-guard bugs. The one production behaviour it does keep is
`SECURE_COOKIES=1`, because that is a property of being served over HTTPS
rather than of being production.

**The seed runs once, not every deploy** (`SEED_ONCE=1`). The upserts are
idempotent per record, so without that flag a redeploy would silently revert
edits a reviewer had made to a seeded assignment or note while they were
looking at it. To reset staging to a clean demo class, delete the Firestore
collections and redeploy.

**Two independent switches, both fail closed.** `SEED_DEMO=1` is required for the seed to run at all, and it throws if `NODE_ENV=production` is also set. The old guard was the inverse — *skip if production* — which failed open: Cloud Run env vars are replaced wholesale by `--set-env-vars`, so dropping one line from `cloudbuild.yaml` was enough to silently re-enable the demo seed against the live store.

`SEED_DEMO` also drives the login page's test-account list, over `GET /api/auth/demo`. A real instance serves a plain sign-in form — no fixture list, no shared password, and no divider offering an alternative that isn't there. The block is hidden in the markup and only revealed on a positive answer, so a failed request can't publish a password.

**The first admin on an empty store** is a chicken-and-egg: every route that creates an account requires an authenticated platform-admin, and the only thing that ever created one was the seed. Hence a CLI, deliberately not an HTTP route — a "create the first admin if none exists" endpoint is a public privilege-escalation route for the whole window between deploy and first use:

```
GCP_PROJECT_ID=tau-thinking-prod NODE_ENV=production \
  node app/server/bootstrap-admin.js you@example.com "Your Name"
```

Prints a generated password once. Re-running on an existing email resets that account instead of duplicating it, which makes it the lockout recovery path too.

**Loose end:** the `deploy-main` trigger still lives in `cta-pilot-dev`, because that's where its GitHub App connection is, and creating one in prod needs a browser OAuth step. So the build *executes* in the demo project while the image and the service land in prod (`cta-build@cta-pilot-dev` holds `run.developer` on prod, `artifactregistry.writer` on prod's `cta` repo, and `serviceAccountUser` on prod's `cta-run@`). It works, but shipping depends on the demo project existing — move the connection when convenient.

## Deployment (Cloud Run)

**Push to `main` and it deploys.** The `deploy-main` Cloud Build trigger
(us-central1) watches the GitHub repo and runs `../cloudbuild.yaml`: build,
push, `gcloud run deploy`. About two minutes end to end. Since 2026-08-08 it
deploys to **`tau-thinking-prod`**, not to the demo project.

Images are tagged with the commit SHA, so a running revision maps back to
exactly one commit — check with:

```
gcloud run services describe cta --region=us-central1 --project=tau-thinking-prod \
  --format="value(spec.template.spec.containers[0].image)"
```

The build runs as `cta-build@cta-pilot-dev.iam.gserviceaccount.com`, which holds
`roles/run.developer` and `roles/logging.logWriter`, `roles/artifactregistry.writer`
on the `cta` repo only, and `roles/iam.serviceAccountUser` on `cta-run@` only —
now on both projects (see *Two projects* above for why it spans them). It cannot
reach Firestore or Vertex in either — deploying and running are separate
identities on purpose.

`cloudbuild.yaml` passes no `--allow-unauthenticated` either way, so an ordinary
deploy leaves the service's IAM policy (public, see below) untouched.

Manual deploy, for when the trigger is the thing that's broken:

```
gcloud run deploy cta --source . --region us-central1 --project tau-thinking-prod \
  --service-account=cta-run@tau-thinking-prod.iam.gserviceaccount.com \
  --set-env-vars=NODE_ENV=production,GCP_PROJECT_ID=tau-thinking-prod,GCP_LOCATION=global
```

Note this uploads the **working directory**, not a commit — which is how
revision `cta-00001-qbf` came to correspond to no commit that existed anywhere.
Prefer the trigger.

**The public demo** is `https://staging.tauthinking.com` (opened 2026-08-06 on a run.app hostname; renamed and repurposed as staging 2026-08-10), the `cta` service in `cta-pilot-dev`. Anyone can reach the login page and sign in with the demo accounts above — deliberate, because every record in that project is fabricated.

### What was actually deployed vs what the docs said (2026-08-10)

Worth recording, because the gap held for two days and the docs read as if it hadn't:

`app.tauthinking.com` was a domain mapping onto the `cta` service in **`cta-pilot-dev`**, and `tau-thinking-prod` had **no Cloud Run service at all**. The public domain served the demo seed and accepted `coach1234`. The 2026-08-08 split — the prod-targeting `cloudbuild.yaml`, the *Two projects* section above, the CLAUDE.md rewrite — was written but never committed, so `deploy-main` had only ever run the pre-split config, three times, all on 2026-08-06.

The lesson is narrow and worth keeping: **a section of this file describing infrastructure is a statement of intent until `gcloud` agrees with it.** Check the live state before trusting a deployment doc, this one included.

Fixed by commit `00c4d18`: prod service created (revision `cta-00001-lr6`), `app.tauthinking.com` remapped to it, `staging.tauthinking.com` mapped to the dev service. Verified by confirming `app.tauthinking.com` returns 401 for the demo password — the store behind it is a different project's, and empty.

Between the project split (2026-08-08) and 2026-08-10 that service received no deploys at all: the trigger had moved to prod, and it sat on whatever revision it last got. **It is now the staging instance** — the second trigger that section called the tidier answer. Same service, same URL, same fabricated data; what changed is that `staging` branch pushes now keep it current.

**Push to `staging` and it deploys there.** The `deploy-staging` trigger runs `../cloudbuild.staging.yaml` into `cta-pilot-dev`. Typical loop: work on `main` or a feature branch, then

```
git push origin HEAD:staging
```

and send the URL. Nothing about that touches prod, which only ever moves on a push to `main`.

Two things make that safe, and one rule keeps it that way:

- **Spend is capped by construction.** The soft cap is 40 AI replies/day/account across 10 demo accounts, so a stranger maxing every one of them costs roughly a dollar a day; the hard tier bounds it absolutely. The $25 budget alert would fire long before anything ran away. This is the usage-cap work paying for itself — a public demo would have been an open tab on the Vertex bill without it.
- **App auth is still enforced.** Removing Cloud Run's IAM gate didn't remove the session layer: `/api/*` returns 401 without a sign-in, and every role and ownership check is unchanged.
- **`cta-pilot-dev` must never hold real student data while these credentials are public.** The demo password is published in this repo. This is the rule that was most likely to be forgotten under deadline, which is why it stopped depending on memory: real users live in `tau-thinking-prod`, and the demo seed cannot reach it (*Two projects*, above).

- **No config.json in the image** (`.dockerignore`), so deployed instances are configured by environment. `school.js` reads the file in dev and env vars otherwise, with env winning where both exist.
- **No credentials anywhere.** `llm.js` falls through to the Cloud Run metadata server when no ADC file is present — a code path that had never run until this deploy, and now has.
- `NODE_ENV=production` turns on every guard at once: the demo seed refuses to run, temp passwords are random, the session cookie gets `Secure`.
- Verified on the deployed instance: login, student home, conversation create, streaming coach reply through Vertex, and an `llmCalls` row written with real token counts.

## Data model

Collections documented at the top of `server/store.js` — these *are* the Firestore collections now, not a shape standing in for them. Turns are **append-only**: edits and regenerations append a new turn with `meta.supersedes: [ids]`; live turns are derived at read time, the full record is the integrity artifact.

## What's implemented (last updated 2026-08-14)

- Assignment list → workspace with ChatGPT-style conversation sidebar (unlimited conversations, rename, no delete)
- Streaming AI chat, blank-context per conversation. **No coaching as of 2026-08-14** — no system prompt, no persona, no assignment context; it behaves like any Gen AI chat (see `built-in-chat-plan.md`, *Coach: Scaffolding Fade — REMOVED*)
- Evaluate button → auditor voice (meta-turns, excluded from future TAU)
- Submit flow with confirmation friction: locks all cycle conversations, records submission, next open starts the next cycle
- Event logging from day one: copy, regenerate, edit, stop, evaluate, episode-save/resume
- Guardrails: maxOutputTokens capped on evaluate (400) but **uncapped on chat** as of 2026-08-21 — a 500-token cap truncated replies mid-sentence; `thinkingBudget: 0` on every call, and the daily reply/token budget is what actually holds cost
- **Cost accounting** (`server/llm.js` → `llmCalls`): one row per Vertex call with purpose, model, token counts, latency and attribution. Tokens never dollars — a price table lands with the admin cost view, so history stays comparable when prices move
- **Daily usage cap** (`server/budget.js`): 1M input tokens/day per student, warning bar above the composer at 80%, hard stop at 100%. Checked at the turn boundary before the student's turn is persisted. **Submitting is never blocked by chat budget**: analysis is excluded from the count, so a student who chatted a lot still gets their report. **The 40-replies/day soft tier and the teacher grant that lifted it were removed 2026-08-21** — a cap set before any measurement shapes the behaviour the pilot exists to observe. Replies are still counted (`usageToday().replies`, and median/busiest on the admin Status view), just not capped. The reasoning for a reply-denominated tier is preserved at the top of `budget.js`: it is the argument for bringing one back once there is data, because a token budget gives two identically-behaved students very different allowances

### Model choice (measured 2026-08-05, not assumed)

Both chat and analysis run **`gemini-3.1-flash-lite`**, thinking off. Override per kind in `config.json` under `gcp.models` (`chat` / `analysis`) — comparing models is a config edit, not a code change.

The plan specified 3.5 Flash for analysis with a *capped* thinking budget. Two measurements changed that:

1. **`thinkingBudget` is advisory, not a cap.** 3.5 Flash asked for 512 spent **777**. Only `0` holds, so the real choice is thinking-off or thinking-uncapped — and uncapped is the ~$120-semester scenario the cost model warns about.
2. **Thinking is drawn from `maxOutputTokens`.** A 300-token budget with 512 of thinking left *one* token of answer and a `MAX_TOKENS` truncation. `llm.js` therefore adds the thinking allowance on top of the caller's `maxTokens`, so a caller's number always means answer length.

With thinking off, 3.5 Flash loses the advantage that justified its 6× price — on the real classification prompt it mislabeled a turn that Flash-Lite got right. **This is a small sample and provenance quality was not compared systematically**; that comparison is worth running against the seed transcripts before the pilot.
- **Phase E analysis pipeline** (`server/analysis.js`): submission → turn classification + provenance/flags + TAU scoring (ported verbatim from CTA `scoreTAU`) + narrative snapshot, run async; report polls until complete
- **Draft report page** (`web/report.html`): the CTA's full results presentation ported verbatim — SAMR hero, score summary grid, interactive Agency Chart (d3, patterns, tooltips, turn modal), My Session dashboard, Idea Origins (essay heatmap + concept inventory). The Pattern Guide — a static catalogue of all 14 patterns, ported from the CTA's tab — was removed 2026-08-24: it listed the twelve patterns a student's session did *not* contain alongside the ones it did, with no link to their own evidence. `report.css`/`report-render.js` are extracted copies of the CTA's style block and render section (source ranges: index.html 8–1137, 2027–2091, 2516–3929, 4589–4602); `report-boot.js` is the API adapter. Full disclosure at the submission marker only (revised 2026-07-16) — never live during a session; integrity flags stripped from student responses, teachers see them (decided server-side from the signed-in user's role)
- `POST /api/submissions/:id/reanalyze` retry path with a Retry button on the report page. The Groq 429 retry loop is gone with the Vertex swap — it existed for a free-tier TPM limit that no longer applies
- **The worked example** (`server/sample.js`, added 2026-08-31): the bikeguide transcript — the one real session in the repo — built into a submission + analysis **in memory at first request** and served under the fixed id `sample-bikeguide` to any signed-in **teacher** (students 403). It is never written to any database, so it exists identically in prod without the demo seed and there is no fixture student on anyone's roster. Two routes carry an exemption for that id ahead of their ownership check: `GET /api/submissions/:id/report` and `.../conversations`. The payload sets `sample: true`, which is what puts the provenance notice at the top of the report — the session is real, the student's turns are theirs, the AI's are shortened, and it is adult work rather than school work. Opened from the new-teacher Home's **Learn the tool** row

- **Teacher triage dashboard** (`web/dashboard.html`): the existing `teacher-dashboard.html` ported whole (guide first, detail on demand — overview/class/assignment/student tabs, two-tier flag system, side tray, flag detection modal); its mock generator replaced by `/api/teacher/dashboard`, which serves the exact mock shape from real data. Drill panels link into the detail layer: per-submission "Report →" (teacher-mode report) and "Conversation view →" (`teacher.html#student/:aid/:sid`). Reflects the real `classes` collection now — a class tab per class, not a synthesized "My Class"
- **The viz organisms** (`web/viz.js`, extracted from `dashboard.html` 2026-08-17): Composition, Distribution, Movement and Trace, plus the flow renderer and the scale vocabulary they share. **It reads no app state** — every function takes a cohort, a flow or an array of readings and returns markup, so it can be mounted against fixtures. Selecting which students and which submissions stays in `dashboard.html`, in the per-surface adapters. The one thing a host must supply back is `setFlowMetric(scope, key)`. See `teacher-dashboard-design.md`'s *Component layer* for the entry points and the CSS/JS split
- **Teacher detail layer** (`web/teacher.html`) — ⚠️ **flagged for a rebuild 2026-08-08; do not extend it, and read `teacher-dashboard-design.md`'s "`teacher.html`'s session view — needs a rebuild" section before touching it.** It predates the triage dashboard and was never reconciled with it: no rail, no way back, a duplicate assignment list, and a transcript with no way to reach the moment you came for. The per-submission teacher note moved onto the dashboard's own submission rows on that date, so the transcript is now the only thing this page uniquely provides. Original description follows: assignment creation (prompt, due date, draft budget, per-draft due dates), roster with per-cycle TAU/SAMR chips + flag markers, student detail view — trajectory strip (growth across drafts), conversation-ready moments (first turns, best challenge, pushback, unchallenged AI-born concepts), snapshots verbatim, integrity signals, full transcripts with turn labels/meta-turns/superseded turns/events interleaved, teacher note per submission (shown to the student on their report). Report page shows the integrity flags panel with misfire disclosure when a teacher is signed in

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
- **Agreements** (`server/terms.js`, `web/agreement.html`): two versioned documents, keyed by role — a student's Terms of Use and a teacher's **Pilot Agreement**. Accepted on the set-up form when redeeming an invite, or on `agreement.html` for an account that already exists; `needsToAccept()` gates every page until it is done, so an account can never reach a surface without a stored `termsVersion`. Prose lives in `legal/` and the rendering in `terms.js` — change both. Why the teacher document is not the DPA: `pilotuser.md` *Consent* and `legal.md`
- **Login + student account view** (`web/login.html`, `web/api.js`): every `/api/*` route requires a session; a 401 lands on the login page from any surface. The student home (`web/index.html`) shows current work, past assignments with per-draft score chips linking to their reports, and a teacher-note badge. The rail's dimension guidance uses the same fixed names (Prompting Quality, Selective Use, Calibrated Skepticism, Original Contribution) as the report page, per designsystem.md's Hard Constraints. The Google SSO button is present but disabled — Phase A fills it in

## Not yet

- Divergence chart / embeddings (CTA Call 3) in the report
- Delta provenance (draft N-1 concepts counted as established for draft N)
- UI events (copy/regenerate/edit) folded into TAU scoring — logged and stored in `analysis.eventCounts`, not yet weighted (kept parity with CTA formulas)
- Per-student daily token budget + rate limiting (needed before any real deployment)
- GCP wiring (Phases A/D). The dev login is a **stand-in**: passwords are not the plan for minors — Phase A replaces `auth.js` with domain-restricted Google SSO
- Real class enrolment now exists (`classes` collection, assignments scoped by `classIds`) — see the seed for the current 3-class demo shape
