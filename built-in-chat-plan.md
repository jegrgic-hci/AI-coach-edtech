# Built-In Chat — Path B Plan & Tracking Doc

Living document for the shift from single-file paste-in analysis to Path B: built-in AI chat + accounts + server backend. Problem-space design settled 2026-07-16; this doc is the source of truth for build sessions.

**Preservation guarantee:** the existing single-file tool (`index.html`, `teacher-dashboard.html`, current docs) is not modified by Path B work. Path B develops in new files; the paste-in CTA remains the working fallback. Pre-Path-B state committed as `1b1c36c`.

---

## Guiding Principle

**The tool is not foolproof and the scoring is not meant to be 100% accurate. Its purpose is to help students develop agency and critical thinking while using generative AI. Cheating is not prevented — it is made more work than honesty. We accept that.**

What this buys the design:
- **Goodhart works for us** — faking critical-thinking behaviors (challenge, refinement) ≈ practicing them; gaming the metric converges on developing the skill
- **Precision pressure drops** — directionally-right + legible beats forensically exact; cheap models suffice
- **Integrity flags are conversation-starters, never verdicts** — dashboard language says so
- **Positioning:** AI literacy as curriculum, in the lineage of library-skills and computer literacy — not integrity policing. Generative AI is a medium shift like the computer (2000s) and the library before it; requiring engagement is a legitimate literacy expectation ("cite three sources," 2026 edition)

**Scope boundary:** the teacher assesses the product (essay, their rubric — untouched by the tool). The tool assesses the process (AI use). The tool never grades essays.

---

## Architecture Decisions

| Decision | Rationale |
|---|---|
| **Vertex AI** (not free AI Studio key) | School DPA compliance; no training on student data (minors' PII) |
| **Vertex key server-side only** (Cloud Run) | Shared school key cannot live client-side |
| **Firestore for all data** | Single compliance boundary (one Google DPA covers Vertex + Cloud Run + Firestore); auth-integrated security rules make permissions nearly free to build; scale-to-zero billing; document shape fits (append-only turns, blobs). Postgres revisit point: district-scale reporting |
| **Google SSO, domain-restricted** (Firebase Auth) | No passwords for minors (COPPA/FERPA); free tier |
| **Cloud Run scale-to-zero** | $0 idle; no `min-instances` (cold starts acceptable at pilot scale) |
| **Every turn persisted server-side as sent** | Eliminates loss/truncation/copy-paste failures at the root; integrity record |

**Two external gates (district IT, pursue in parallel with build):**
1. Is Vertex AI enabled in a GCP project (not just the Gemini Workspace app)?
2. Will they sign a DPA covering the Cloud Run + Firestore + Vertex flow?

---

## Cost Model (pilot: 14 students, 1 semester, 5 assignments, ~5 submissions each)

| Line item | Cost |
|---|---|
| Chat (Gemini Flash-Lite, ~$0.03/assignment-instance) | ~$2 |
| Analysis (Gemini Flash, ~$0.02/submission × 350) | ~$6 |
| Embeddings | ~$0.10 |
| Cloud Run / Firestore / Firebase Auth / Hosting | $0 (free tiers) |
| **Semester total** | **~$10–30** |

**Budget ceiling to quote: $30–50** (2× headroom over worst case). Per student: ~$1–3/semester at next-gen model prices.

**Guardrails (build these into v1, not later):**
- `thinkingBudget: 0` for chat; capped for analysis (thinking tokens bill as output — the classic 8× surprise)
- `maxOutputTokens` ~500 on chat
- Per-student daily token budget enforced in Cloud Run — the real spending cap
- Every request requires a valid domain-restricted Firebase Auth token *before* touching Vertex
- Budget alerts at $10/$25/$50 (GCP has no hard cap)
- Rate limiting per user (catches bugs, loops, scripted abuse)
- Teacher dashboard uses one-shot reads, not realtime listeners

Cost note: unlimited conversations *reduce* cost — context is resent per turn, so input tokens grow ~quadratically with conversation length; several focused chats < one monolith. Gemini implicit caching cuts real input costs further (not counted above).

---

## Student Flow

**No free-floating chat — sessions exist only inside assignments** (primary off-task mitigation).

1. Teacher creates assignment: prompt, due date, **draft budget** (e.g. 3 before final), **coaching level per submission slot**. Prompt seeds coach context + off-task baseline embedding
2. Student signs in (school Google SSO) → assignment list with status
3. Student opens assignment → chats with the coach
4. **Submission is a hard marker that ends the session.** Assignment = discrete revision cycles: Session 1 → draft 1 (locks) → offline feedback/reflection → Session 2 → draft 2 → … → final. Confirmation friction on submit ("ends your session, uses 1 of 3 drafts")
5. Essay lives in Google Docs; student pastes current draft at each submission. Submission = (all of the cycle's conversations, essay draft N) → analysis → teacher dashboard + student agency snapshot

**Conversations (mimic real generative AI):**
- ChatGPT-style sidebar; **unlimited conversations per cycle**; submission locks and bundles ALL of them (no selective evidence)
- Submitted conversations stay readable (revisit, copy quotes) but input-locked
- **Blank-context coach** — new conversation knows only the assignment prompt. Student has full recall, coach has none → continuity is a student act (re-read, curate, re-articulate). Protects turn-order provenance
- Save & close button for the student's sense of control; auto-persist underneath; save/resume boundaries recorded as **work episodes** (temporal signal)
- Three deliberate departures from real gen AI, all absences: no cross-chat memory, no delete (rename ok), no free-floating chat
- Deferred (cost/scope, not measurability): web search, file upload, voice, canvas/in-tool editor

**Three feedback routes for a draft:**
1. *Writing feedback* — paste draft into a coach conversation (free; coach responds at current coaching level; **feedback, never rewriting**)
2. *Agency feedback* — **Evaluate button**: on-demand rough auditor read of the current conversation. Two voices: coach converses; auditor speaks only when summoned, visually distinct. Evaluate exchanges = meta-turns excluded from TAU; Evaluate *events* logged as metacognitive signal. Available at every coaching level
3. *Formal review* — draft submission (spends a slot, ends session, full analysis)

**Post-submission report (REVISED 2026-07-16 — full disclosure at the draft marker):**
- Full TAU: all four dimension scores + total + SAMR level, with the divergence chart — the score is part of the learning, not a hidden teacher metric
- Plus the narrative snapshot: 2–3 observed strengths quoted from their conversation; 1–2 growth moves; bridge to next cycle's coaching level (primes the blank-session first turn)
- Still never shown to students: integrity flags (teacher-only conversation-starters)
- Timing: at the draft marker only, **never live during a session** (live meters induce performative behavior and break mimicry) — this boundary is what the original "no numbers" decision was actually protecting
- One Flash-Lite call (~1¢) for the narrative; teacher sees the same report → shared artifact

---

## Coach: Scaffolding Fade

Teacher configures a coaching level per submission slot (gradual release of responsibility). One session = one persona; no mid-conversation shifts.

| Level | Does | Won't |
|---|---|---|
| **Full coach** | Brainstorms, explains, examples, challenges reasoning | Write the essay |
| **Questions only** | Probing questions + feedback on student's claims | Introduce new content |
| **Sounding board** | Clarifying questions only | Everything else |

Default fade: full → full → questions → sounding board; teacher overrides per slot (flat profiles allowed). UI labels the mode ("Coach is in review mode") so the fade reads as pedagogy, not malfunction.

Measurement consequences:
- **Coaching level stored with every session** — every analysis is "TAU at level X"
- Trajectory = "does thinking quality hold as the scaffold withdraws" — the real measure of agency
- **We measure the ask, not just the answer** — extraction attempts against a refusing coach stay classified and visible

---

## Measurement

**Mimicry = ecological validity:** the closer the chat feels to real gen AI, the more the measured behavior generalizes to real AI use.

**Log from day one, even before scoring uses them (retrofitting is impossible):**
- UI events: copy (= observed extraction), regenerate (= implicit rejection), edit-my-message (= refinement), stop-generating
- Evaluate invocations (metacognitive self-checks — timing/frequency)
- Work episode boundaries (save/resume)
- First turn of each blank session (purest agency snapshot per cycle)
- Conversation topology (task decomposition: focused thread-per-idea vs drifting monolith; turn-efficiency vs conversation length)

**Per-cycle analysis:** each submission's TAU covers only that cycle's conversations — trajectory is a clean sequence of independent measurements. **Delta provenance:** concepts in draft N-1 count as established for draft N; trace only new material ("3 new concepts: 2 student-born, 1 AI-born unchallenged").

**Off-task mitigation layers:** structural (assignment scoping) → detection (embedding drift from assignment prompt, reuses Phase 5 embeddings, ~zero cost → dashboard flag; teachers review flagged sessions only) → framing (the log is the assessed artifact; misuse is self-documenting) → UI cue ("visible to your teacher") → backstop (daily token cap). Jailbreak attempts are logged, classified, TAU-visible low-agency turns.

**Accepted imperfections (per guiding principle):** copying AI text between conversations reads as student-introduced; cross-session provenance loses threads (session-1 idea surfacing in draft 3 reads as "prior"); external essay means provenance can't distinguish prior knowledge from shadow AI elsewhere — shadow-session flag characterizes, never proves. Voluntary draft pastes partially erode this blind spot (free timestamped essay snapshots). Standing argument for an eventual in-tool essay view — door open, not building.

---

## Teacher Side

Existing dashboard (see `teacher-dashboard-design.md`) = the triage layer ("guide first, detail on demand"). Path B adds the detail layer:

**Student conversation view** (absorbs the old doc's unbuilt "Submission detail view" + "Per-student growth view" + "Teacher mode in CTA"):
1. **Trajectory strip** — per-cycle divergence charts side by side, labeled with coaching level (growth with the fade as x-axis)
2. **Conversation-ready moments** — 2–4 quoted turns per cycle (best challenge, unchallenged AI-born concept reaching the essay, first turns), deep-linking into the transcript. "Show me what you meant here," not a score
3. **What the student was told** — their agency snapshots verbatim
4. **Delta provenance in plain language**
5. **Full transcript, teacher mode** — turn labels, episode gaps, meta-turns, flag context inline

Lean: teacher note attached to a submission, visible to the student beside their snapshot (auditor's read + human read side by side).

---

## Backlog (accepted gaps from teacher-lens review, 2026-07-16)

1. **Semester-scale measurement** — cross-assignment growth is confounded by topic/difficulty; candidate: hold draft-1 coaching level constant as a repeated comparable probe. *Needs its own design session — the claim schools most want supported*
2. **Student self-set goal + calibration gap** — "what will you try next draft?" at snapshot time; next snapshot opens against it; self-read vs auditor-read gap = prime conference material. One text box
3. **Class-level instructional view** — pattern roll-up ("9 of 14 in Validation Spiral") answering "what should I teach next week?"
4. **Intervention playbook** — side-tray next-steps for developmental patterns, not just integrity flags
5. **Practice assignment** — ungraded, unmeasured first exposure; burns off tool-novelty, protects the baseline
6. **Teacher enablement curriculum** — reading the instrument, pattern literacy, annotated exemplars, conference craft, flag literacy (incl. ELL/IEP misfire profiles), dial pedagogy, student framing. `teacher-guide.md` is the seed; pilot teacher co-authors
7. **Flag misfire disclosure** — unnatural-fluency / stylistic-inconsistency have false-positive profiles for ELL (translators) and IEP accommodations; side tray discloses per flag
8. **Build-time check** — scoring must reward sparse-but-excellent usage profiles (TAU formulas are ratio-based so quality-density should win; verify with a gifted-student sample log)

---

## Build Phases (unstarted)

**Build strategy (2026-07-16): local-first.** Phases B+C built now against dev seams in `app/` (fake auth / Groq / JSON store shaped as Firestore); Phases A+D become seam swaps once the GCP project + DPA exist. See `app/README.md`.

- [ ] **Phase A — Backend skeleton:** Cloud Run proxy (auth-gated, rate-limited, token budgets) + Firebase Auth (Google SSO, domain-restricted). *Dev stand-in running: node server + fake-auth seam*
- [x] **Phase B — Data model:** collections (users/roles, assignments, sessions, conversations, turns, submissions, analyses, events) implemented Firestore-shaped in `app/server/store.js`; append-only turns with `meta.supersedes`. *Remaining: Firestore security rules at swap time*
- [x] **Phase C — Chat UI:** conversation sidebar, streaming, episode handling, Evaluate button (auditor voice), submit flow with confirmation friction; event logging (copy/regenerate/edit/stop/evaluate/episode) from day one. *Remaining: polish passes as real use reveals gaps*
- [ ] **Phase D — Vertex migration:** the 3 analysis calls (turn classification, provenance, embeddings) from Groq to Vertex Gemini; coach + auditor system prompts per coaching level
- [x] **Phase E — Submission pipeline:** bundle cycle conversations + essay → analysis (classification, provenance+flags, TAU ported from CTA) → snapshot narrative → storage; student draft report with full TAU disclosure, flags teacher-only. *Remaining: divergence chart embeddings, delta provenance, event-derived scoring signals*
- [x] **Phase F — Teacher dashboard integration:** assignment creation (prompt, budget, dial with default-fade prefill), roster with per-cycle TAU chips + flag markers, student conversation view (trajectory strip, conversation-ready moments, snapshots verbatim, transcripts in teacher mode with events inline), teacher note per submission surfaced on the student's report. Triage dashboard ported from `teacher-dashboard.html` (real data via `/api/teacher/dashboard`, mock shape preserved) with drill-down links into the detail layer. *Remaining: real classes in the data model (one synthesized class for pilot), class-level instructional view (backlog #3)*
- [ ] **Parallel:** district IT gates (Vertex project? DPA?)

---

## Stakeholder Summary (ready to share)

> **Critical Thinking Auditor — Built-In AI Chat: a classroom tool that makes student AI use visible, safe, and teachable.**
>
> Students already use generative AI invisibly, on personal accounts. This tool gives them a school-controlled AI chat that looks and feels like ChatGPT — then measures *how* they used it and turns that into feedback for the student and insight for the teacher. It does not grade essays; the essay stays the teacher's domain. It assesses the process: agency, skepticism, and original thinking while working with AI.
>
> Students sign in with school Google accounts, work on assignments through the built-in chat, submit drafts as deliberate milestones, and receive plain-language feedback on how they worked. AI coaching deliberately fades across drafts — full support early, minimal by the final — so independence is built, not hoped for. Teachers set the coaching levels, see the class at a glance, and get quoted moments from real conversations to anchor feedback — never accusations. Integrity signals are teacher-only conversation-starters; the tool is not a cheating detector and doesn't claim to be.
>
> All data stays in the school's Google Cloud environment under a single data-processing agreement; student data is never used to train AI. Cost is negligible: under $50 per classroom per semester. Pilot: one class, one semester, five assignments.

---

## Session Log

- **2026-07-17 (build session 5)** — Existing teacher dashboard adopted as the Phase F starting point (per design intent: triage layer + detail on demand). `teacher-dashboard.html` ported verbatim to `app/web/dashboard.html`; mock generator (240 lines) replaced by an API loader hitting `/api/teacher/dashboard`, which reproduces the mock data shape exactly — all dashboard render code unchanged. Drill panels now deep-link: "Report →" per submission (teacher-mode report), "Conversation view →" (`teacher.html` hash route). Yesterday's `teacher.html` repositioned as the detail layer behind the dashboard. Original `teacher-dashboard.html` untouched.
- **2026-07-17 (build session 4)** — Phase F: teacher side built on real data. `teacher.html`: assignment creation with per-slot coaching dial (default fade prefilled), roster with TAU/SAMR chips + flag markers, student detail = trajectory strip → conversation-ready moments → snapshot verbatim → integrity signals → full transcripts (labels, meta-turns, superseded turns, UI events interleaved chronologically) → teacher note (student sees it beside their snapshot). Report page gains `?role=teacher`: flags panel with ELL/IEP misfire disclosure. Role gate verified: student requests to teacher routes 403.
- **2026-07-17 (build session 3)** — CTA results presentation ported whole into the app: new `report.html` page reuses the CTA's CSS + render functions verbatim (agency chart with pattern detection, My Session dashboard, essay heatmap/concept inventory, pattern guide) fed from the report API instead of local parsing; simple hand-rolled report view replaced. AI-turn labels + turn quality computed client-side the CTA way. Added Groq 429 retry/backoff + reanalyze endpoint after free-tier TPM limit broke an analysis run. CTA `index.html` still untouched — code copied out, never modified.
- **2026-07-16 (build session 2)** — Design revision: **full TAU disclosure to the student at the submission marker** (score is part of the learning); the live-tracker prohibition stands — nothing shown mid-session. Phase E built and verified: `app/server/analysis.js` (classification + provenance/flags + `scoreTAU` ported verbatim from CTA + snapshot narrative), async after submit, report endpoint gates flags to teacher role. Student report view: SAMR hero, TAU dimension cards, provenance breakdown, quoted strengths + growth moves + coaching-level bridge. Test run: 5-turn session scored PQ 4 / SU 5 / CS 2 / OC 4 → Modification; flag gate verified both roles.
- **2026-07-16 (build session 1)** — Local-first build: `app/` created with zero-dep node server + three prod seams (auth/llm/store). Phases B & C functional end-to-end: streaming coach chat at all three coaching levels, blank-context conversations, auditor Evaluate, submit→lock→next-cycle flow verified (cycle 2 opened at `questions` level), all seven event types logging. Turns append-only (`meta.supersedes` for edit/regenerate). CTA `index.html` untouched.
- **2026-07-16** — Problem space developed and settled: cost model, architecture, guiding principle, session-per-cycle flow, gen-AI mimicry boundaries, scaffolding fade, three-timescale feedback (Evaluate / snapshot / trajectory), teacher conversation view, unlimited conversations, teacher-lens gap review (2 points rejected and revised: gifted-writer blind spot → library-lineage positioning; rubric integration → teacher enablement). Preservation commit `1b1c36c`.
