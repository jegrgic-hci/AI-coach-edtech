# Workshops — teacher demo of Tau

**What this is.** A six-digit code that lets a room of teachers try Tau with no accounts. Each person
goes to `/join`, types their name and the code, chats with the AI on one short task, ends the
session when they're done, and sees their own conversation mapped turn by turn: the patterns we
detect, and the moments the AI backed off its answer. The facilitator watches the room's results
arrive on one page. Built 2026-10-14/15 for Emilie's teacher workshops; join flow reworked
2026-10-18 from the design canvas (https://claude.ai/artifact/GZv1dZcyPNtMfzCqVTFb7z).

**Why.** Teachers often don't see how a generative AI leads a conversation: how its framing becomes
the person's, and how it gives way when pushed even with no reason given. The chat is deliberately
unsteered (`app/server/coach.js`, no system prompt), so everything the room sees is the stock model
behaving as it does. Nothing is staged.

**Scope of this file.** The workshop feature end to end: what's built, where it lives, the
decisions behind it, how to run and test it, and what's open. **Not here:** the AI Caved detector's
design and validity, which `patterns.md` owns (*AI-side moments*); the guest identity type, which
`pilotuser.md` owns; the design-system exception for the sessions sheet, which `designsystem.md`
owns. The dated build entries are in `built-in-chat-plan.md`'s session log (2026-10-14 and the
2026-10-15 sub-entries).

---

## Status — 2026-10-20

- **Presented results built (2026-10-20):** `workshop-room.html`, the facilitator's projector view
  of the room, opened by **Present results** on a workshop card. Three tabs: Session patterns,
  Levels of agency, Dimensions. See *Presented results* below. Checked against the real demo-room
  data and for access; **not yet screenshot-checked in a browser.**
- **Undecided: the per-person results design.** Whether to restyle the individual results, for the
  workshop and for the tool, in the room view's style. See open item 0b.

## Status — 2026-10-18

- **Built and working locally**, verified end to end against `cta-pilot-dev` Firestore. The
  2026-10-18 join rework (code + name, no timer, End session) passed a 14-check API run and a
  headless browser run from create through to results.
- **Saved tasks built** (2026-10-18): a facilitator can add, edit and delete their own tasks on the
  create form. Checked in a headless browser, through to a guest seeing the custom task.
- **Designed on the canvas, not yet built:** the teacher's results page (screen 9; see *The results
  page — redesign* below). The shipped page still says "chart" and still leads with the plot plus
  the full 14-pattern guide.
- **Not yet designed:** facilitator review (the room view after the session), and section 3 of the
  results page.
- **Design canvas:** https://claude.ai/artifact/GZv1dZcyPNtMfzCqVTFb7z. Screens 1–8 (setup, join,
  chat, end session, analyzing) match what's built; screen 9 is ahead of the build.
- **Not committed. Not deployed.** Everything is in the working tree on branch `m3-adaptive-layout`,
  mixed in with the unrelated, uncommitted demo-tour changes (`app/web/demo/chapters.js`,
  `fake-api.js`, `story.js`). Keep them separate when committing.
- **To reach Emilie:** deploy to prod (`tau-thinking-prod`), then a platform admin ticks **Workshop
  links** on her teacher account in Administration. Platform admins can run workshops without the
  grant.
- **A demo room exists locally:** "Demo room — 5 teachers", owned by `jegrgic@gmail.com`, with five
  scripted guests. It expires a week after it was made (around 2026-10-22) and is then purged.

---

## How to run it

```bash
npm run start:demo          # http://localhost:8787
```

1. Sign in as `jegrgic@gmail.com` (platform admin) or `teacher@school.dev` / `coach1234` (the seed
   gives this account the grant). Open the account menu and choose **Workshops**.
2. Name a workshop, keep the task, press **Start workshop**. The join screen opens with the address
   and the code.
3. In a **private window**, go to `localhost:8787/join`. Joining in your signed-in window signs you
   out of that account; the page warns about this. Type a name and the code, press **Join**.
4. Chat. **End session** is available once you've sent a message. Press it and confirm.
5. "Analyzing your conversation", then the results. Back on the Workshops page, the room view fills
   in by name.

---

## The flow

### Facilitator: `workshop.html`
- **Create:** a name and a task, picked from a list of options (one for now: phones). **Start
  workshop** goes straight to the join screen. Seats and lifetime are not the facilitator's to set:
  200 seats as a backstop against a leaked code, deleted after 7 days.
- **Join screen** (`workshop.html?show=<id>`), made for the projector: the address (`<host>/join`),
  the code, and a joined count refreshed every 4 seconds. One small **Back to workshops** link.
- **Each workshop card:** the code, **Show join screen**, how many joined, deletion date, **End
  workshop** (stops new joins; everyone keeps their results) and **Delete now** (a confirm dialog
  that names every consequence).
- **Room view**, refreshed every 10 seconds while the tab is visible:
  - Headline: *"The AI backed off for N of the M people who disputed one of its claims."* The
    denominator is people who disputed a claim, since nobody else could have seen it.
  - A row per guest, by the name they typed (two people with the same name get "· seat N"): the
    patterns detected, what the AI did (*backed off N times / changed its answer when given a
    reason / held its position / didn't dispute a claim*), and **Open results**.
  - **No level composition.** Workshops are never read for a level, and a room's distribution while
    people are still working would be dominated by who hasn't finished (design-system rule).

### Presented results: `workshop-room.html?id=<workshop>`

The facilitator's projector view, opened by **Present results** on a workshop card (any workshop not
yet being deleted). Built 2026-10-20 from the approved design artifact
(https://claude.ai/artifact/3cCY2iVzsZb2g4Jcc9D9tz). Three tabs, styled as a full-width pill bar so
they double as the section label (`#room`, `#levels`, `#dimensions` open each directly):

- **Session patterns — the real room.**
  - A centred statement: patterns seen out of the 15, turns typed to the AI, conversations finished,
    each counting up from 0 on first load; then what a pattern is, how it's detected and why it
    matters.
  - **Patterns Tau looks for:** one bar per pattern, all 15, heights relative to the most common.
    Coloured by the turn plot's colours: High agency for high-agency patterns, Low agency for
    low-agency ones, grey for what the AI did. **No counts, no names on the chart**, deliberately
    vague so the room asks. Hover names a bar; clicking opens its card. **The three most common are
    the exception:** a numbered black circle on each of their bars and their names in a "Most common
    in this room" list in the chart's free top-right corner (bars descend to the right, so that
    corner is open). Hovering a name lights its bar; clicking opens it.
  - **High-agency turns:** a ring of every finished turn, High agency + Student-led against Shared +
    Low agency, with the steered share as a percentage in the middle and both shares in the legend
    (the total turns are already in the statement; the percentage counts up on first load). A count
    ratio, allowed as a workshop exception
    (`designsystem.md`). Finished conversations only, so it doesn't shift with who's still typing.
  - **Pattern cards**, grouped as the guide groups them, detected first, then the ones nobody showed
    ("Not seen today", still openable for their definition). A card opens in place: why it matters,
    each conversation that showed it as a turn plot fitted to the width (never scrolls sideways),
    the pattern's turns tinted and the rest faded, and a reading pane with the exchange as text.
    Next/previous and arrow keys walk all 15.
- **Levels of agency — an explainer, not a reading of the room.** Today's chats are never read for a
  level (five minutes is too short), and the page says so.
  - The four levels as a ladder (the sidebar is the only navigation; no next/previous) with the
    selected level's definition (`tau-dimensions.md`, verbatim).
  - **Worked from the one real session**, the bike maintenance guide (`seed-data.js` `bikeguide`,
    the same session `sample.js` serves as the teacher sample report). One session can't illustrate
    four levels, so each level says where *that* session falls and why, from its authored reading:
    Not Passive, Not Reactive, **Reads Directive** (tagged "This session" on the ladder), Not
    Transformative. A note at the top says it's real, adult and not school work, that the writer's
    words are verbatim and the AI's shortened, and that it was read by hand against Tau's schemes,
    not computed by today's tool.
  - **How Tau decides a level:** three sources → four questions → one level, building in order as it
    comes into view, with the four rules (never added up, always shown, not enough here, not a grade).
    Each of the four questions opens the Dimensions tab at that dimension.
- **Dimensions — its own tab since 2026-10-20**, because each dimension carries as much as a level.
  Same layout as the levels card: the four questions down the left, grouped by whose ideas, each
  told on the right as a story, most important first:
  1. the question and what it means;
  2. why it matters;
  3. how Tau reads it (the scheme's three codes);
  4. **in the real session**: the bike guide's count, a moment that counted and the one that didn't
     (its authored counterexample);
  5. what a reading says, the band labels strongest first with the session's marked (no numerals);
  6. background, set quieter but visible: the research and citation, what it counts, where it sits.

  **This describes the settled model, which is specified but not built** (`tau-dimensions.md`); a
  facilitator should present it as how Tau reads work, not as what today's reports compute.
- **Data:** `GET /api/workshops/:id/room` (`workshops.roomFor`), owner-only. Finished conversations
  with **no names**, reshuffled on every read so a row's position can't identify anyone; patterns and
  AI moments exactly as the analysis stored them, never re-detected. AI text capped at 700 characters.
  The page re-reads every 15 seconds while Session patterns is showing, rebuilding quietly (no
  replayed animation, an open pattern stays open). Pattern copy comes from `pattern-guide.js`.
- **Styling:** the workshop tonal palette, page-local in `workshop-room.css` (`designsystem.md`,
  *Workshop surfaces are tonal*). The named room view in `workshop.html` is unchanged and stays the
  facilitator's private view.

### Guest: `/join` → workspace → results
- **`join.html`**, the only public page besides sign-in, in the login page's shell. Fields: **Your
  name** ("First name is fine.") and **Workshop code**. Once six digits are typed, the room's name
  appears under the code, so the person sees it's the right one. Wrong, ended and full codes are
  said next to the code field. A line under **Join** says the facilitator can read the
  conversation, not to type anything personal apart from their name, and the deletion date.
  A guest coming back with a live cookie skips the form and goes straight to their chat. There
  is no pre-filled link: one way in, the address plus the code.
- **The workspace** is the normal student app with a workshop branch (`app.js`, `isWorkshop()`):
  - It lands straight in an open chat with the task shown in it, so a phone shows the task too.
  - The prompt panel starts expanded.
  - **End session**, no timer. Disabled until the person has sent a message, since an empty
    conversation has nothing to analyze.
  - The confirm dialog: *"End your session?"*, two lines (can't add after this; analysis takes about
    a minute), **Keep chatting** / **End session**. No draft, no reflection.
  - While the analysis runs: *"Analyzing your conversation…"*.
- **The results, as built today** (`report.html`, plot-only mode):
  - Only "Your conversation, turn by turn", with a one-line key.
  - A plot fitted to the conversation's size, and a headline stated as counts.
  - **"What the chart looks for"**: the pattern guide, with this chat's patterns marked.
  - Sessions sit behind a **Sessions** button as a sheet, not a side panel.

### The results page — redesign (canvas screen 9, not built)

The product is the chat, its agency levels and its patterns, so the page leads with those and adds
nothing until they're settled. Decided 2026-10-18.

1. **Title:** "Your results", with the task and turn count under it. "Chart" is retired everywhere
   on the page.
2. **Your conversation** (leads):
   - Headline: *"You steered N of your M turns."* Steered = Student-led or High agency, the same
     count as today's "You led in…", in plainer words. No AI clause in the headline.
   - The turn plot: one square per turn by agency level, patterns as shaded bands over their turns.
     Picking a turn shows the AI's line, the person's line, and how it was read.
   - **No separate AI row.** *AI backed off* is one thing we detect, not the core of the product, so
     it becomes an ordinary pattern band and card.
   - A key giving each level a one-line meaning, replacing the intro paragraph about squares, bands
     and diamonds. Level names unchanged. Draft meanings, to confirm:
     - **High agency:** You challenged or turned down what the AI said.
     - **Student-led:** You brought your own claim, idea or direction.
     - **Shared:** You shaped what the AI made: refined it, or added your own.
     - **Low agency:** You took what the AI gave: asked for it, agreed, or got stuck.
3. **Patterns in your conversation:**
   - Only the detected patterns, one card each: name, the turns it covers, what it is, why it
     matters (pattern-guide copy). Picking a card highlights its turns in the plot.
   - None detected: *"No patterns this time. Most patterns need several similar turns in a row, so a
     short conversation often shows none."*
   - The full list moves behind an **All patterns Tau looks for** link: reference, not the result.
4. **Section 3, to decide:** what else informs a teacher. Candidates: what each level looks like in
   students' sessions; one thing to try differently; how Tau shows this across a class over a term.

### The task (`TASKS` in `workshops.js`)
> Should schools ban phones in class? Spend about five minutes on this with the AI.
> 1. Ask the AI whether schools should ban phones in class, then pick a side.
> 2. Disagree with something the AI claimed — with a reason or without one — and see what it does.
> 3. Keep going: push it, ask it to argue the other side, or change your mind.

Step 2 asks for a **claim** to be disputed on purpose, because that's the exchange the AI Caved
detector reads. "Make it shorter" would give it nothing to see. Each assignment stores its own copy
of the task when created, so editing `TASKS` affects only new workshops.

### A facilitator's own tasks (`workshopTasks`)
- **Add a task** on the create form opens an editor in place: **Question** (the task's title, shown
  at the top of the chat) and **Instructions** (empty, with a placeholder example). **Save task**
  adds it to the list and selects it.
- Saved to the facilitator's account and offered in every workshop they create. Not shared with
  other facilitators. The built-in phones task always comes first.
- Their own tasks carry **Edit** and **Delete**. Purpose and requirements are filled in, the same
  for every task: a guest never reads them.
- **Editing or deleting never touches a running workshop**: the assignment holds its own copy.
- No guidance about disputing claims on the form, deliberately (2026-10-18): the AI-backed-off
  moment is one thing the results show, not what a task has to be built around.
- Routes: `POST /api/workshops/tasks`, `/tasks/:id/edit`, `/tasks/:id/delete`, owner-checked.

---

## Where it lives

| File | What it does |
|---|---|
| `app/server/workshops.js` | **New.** Create, token lookup, guest admission (transactional), purge, room-view data. `TASK` and defaults. |
| `app/server/index.js` | Public `GET /api/join`, `GET /api/join/:code`, `POST /api/join` with the wrong-code throttle; teacher `/api/workshops` (list, create, close, delete); `/join` page route; `canRunWorkshops()`; `workshopLinks` grant on admin create/edit; workshop-aware submit (no draft, no reflection); `submission.workshop` on the report payload; hourly purge at boot. |
| `app/server/analysis.js` | Plot-only branch in `runAnalysis` (`mode: 'plot'`); `tracePushback` (two calls); `detectAIMoments` export. |
| `app/server/auth.js` | `startSession(user, expiresAt)` for an account with no credential; `sessionCookie(token, maxAge)`. |
| `app/server/store.js` | `col().transact(id, fn)`: a Firestore read-modify-write transaction. |
| `app/server/seed.js` | Gives `teacher@school.dev` the `workshopLinks` grant. |
| `app/server/export-improvement.js` | Refuses workshop classes. |
| `app/web/workshop.html` | **New.** Facilitator page: create, workshop cards, room view, and the projector join screen (`?show=<id>`). **Present results** links to the presented view. |
| `app/web/workshop-room.html`, `.js`, `.css` | **New 2026-10-20.** Presented results: Session patterns and Levels of agency tabs, tonal palette. |
| `app/server/workshops.js` `roomFor()` | **New 2026-10-20.** The presented view's data: finished conversations, no names, shuffled. Route `GET /api/workshops/:id/room`; page gated like `workshop.html` (`canRunWorkshops`). |
| `app/web/join.html` | **New.** Name + code entry page (replaced `try.html` 2026-10-18). |
| `app/web/pattern-guide.js` | **New.** The guide's copy (all 14 patterns plus "AI backed off") and its renderer. |
| `app/web/patterns-core.js` | `detectAIMoments()`, the AI Caved detector. |
| `app/web/session-view.js` | `renderTurnPlot(…, aiMoments, { workshop })`: AI lane, teaching note, fitted width, count headline. |
| `app/web/report-boot.js` | `renderPlotOnly()`; `sessions-as-sheet` body class. |
| `app/web/app.js`, `index.html`, `style.css` | Workspace workshop branch: End session (no timer), auto-opened chat, task in chat, no-draft submit. |
| `app/web/api.js` | Workshops menu item; `mountSheet({ alwaysSheet })`. |
| `app/web/components.css`, `report.css` | `.sessions-as-sheet`, `.pguide-*`, AI lane styles. |
| `app/web/admin.html`, `admin.js` | **Workshop links** checkbox and roster label. |

---

## Decisions and why

**Isolation from real data.**
- Workshop classes are dropped inside `teacherScope()`, the one function every roster, rollup and
  access check derives from. So guests never reach a dashboard, Home, Browse Students, flows or
  patterns, and no surface needs to know workshops exist.
- `canReadSubmission` lets only the workshop's owner open a guest's chart.
- Three back doors that would otherwise pull workshop data in are closed:
  - `POST /api/assignments` defaulting to all of a teacher's classes.
  - Granting Pilot user, which stamps all of a teacher's classes.
  - The improvement export.
- The admin overview filters guests and workshop classes out of its counts.

**Guests are a third identity, `'guest'`.**
- No email, no username, no password. The session cookie is the only way back in, capped at the
  workshop's expiry.
- **A name, typed by the guest.** The one exception to the no-collection rule, decided 2026-10-18:
  adults, and the facilitator needs it to talk to someone about their results. Purged with the rest
  (`pilotuser.md`).
- `termsCoveredBy` points at the teacher who ran the workshop (the code-roster mechanism), so guests
  never see the student Terms. `join.html` states what happens to their session instead.

**A six-digit code, not a link.** People type it off a projector, so it's digits only and read in
two groups ("482 193"). It's unique among workshops that still exist, so an old code reads "ended"
rather than opening someone else's room. Wrong codes are throttled per address (30 per 10 minutes,
in memory, per instance): loose because a school is one address and a room mistyping must never lock
itself out, and enough because a guessed code opens a demo seat and nobody's data. Workshops made
before codes existed get one the first time they're listed.

**Joining is a POST behind the Join button.** Nothing is created on a page load or a code lookup.

**Admission is a transaction.** With 20 simultaneous Starts against 15 seats, the plain
read-then-write gave duplicate seat numbers, guests missing from the class roster (who were then
refused their own assignment), and 20 people admitted. A first attempt at a transaction still
over-admitted, because a seat number set on a losing attempt survived Firestore's retry. It's now
reset on every attempt. Re-tested twice: exactly 15 admitted, unique seats, all on the roster.

**Deletion is real.**
- `purgeExpiredWorkshops()` runs at boot and hourly, because Cloud Run scales to zero.
- The code refuses entry from the moment of expiry. **Delete now** purges immediately.
- The purge deletes users, auth sessions, sessions, conversations, turns, events, submissions, and
  **every** analysis of each submission. A re-read leaves an old analysis behind, which still holds
  the transcript.

**Plot only: no readings, no level, no provenance, no writing step.**
- Five minutes is too short for the four readings or a level to stand on. They'd be read off a
  handful of turns and shown with the authority of a term's work.
- With no draft there's nothing for provenance to trace, and a writing step nothing reads takes
  minutes from the room for nothing.
- About 60% fewer model calls per guest.

**The chart adapts, for workshops only.** `renderTurnPlot(…, { workshop: true })`:
- Fits turn columns to the card (19–64px per turn) and grows the squares with them.
- Numbers every turn when there are 12 or fewer.
- States the headline as counts: *"You led in 2 of your 3 turns, and 1 pushed back on what you were
  told."* The live tool's fixed sentence told a teacher who opened with their own position that they
  had "spent most of this conversation acting on what the AI gave you."
- The live report passes no options and is unchanged (screenshot-checked).

**The pattern guide has its own copy.**
- The dashboard's `PATTERN_META` is written for class triage, and editing it would change the live
  dashboard.
- The guide is written for a room learning how an AI steers a conversation: what each pattern is,
  and what it shows about the exchange.
- Names must match `patterns-core.js` labels exactly (checked: 14 of 14).
- The AI moment is shown as **"AI backed off"**, matching the chart legend and room view, rather
  than the internal id `ai-caved`.

**Sessions as a sheet.** The standing transcript beside the chart competed with the chart and the
guide. It's recorded as a workshop-only exception to the supporting-pane rule in `designsystem.md`.

---

## AI Caved: the short version

Full design, rules and status are in `patterns.md`, *AI-side moments*.

- **What it flags:** a person disputes a **claim**, gives **no reason**, and the AI **softens or
  drops** its position. Pushback on a choice ("make it shorter") never counts, and neither does an
  AI that changes its answer when given a reason.
- **Stored as `aiMoments`, never in `patterns`.** It must never count for or against the person.
- **Two LLM calls** in `tracePushback`:
  - The exchange: target and AI response, with 3,000 characters of each AI turn.
  - The person's words alone: a verbatim reason quote, accepted only if it really appears in their
    turn.
  - The split exists because inside the exchange the model missed *"But the office phone covers
    that"* three times out of three.
- **The person's side** is a teaching note on the turn (*"You disputed a claim here without saying
  why…"*), never a low-agency card.
- **Status: provisional.**
  - Smoke-tested on 8 authored cases, all claim cases correct.
  - Stable over three runs of each real demo-room exchange, with no false caves.
  - **Not validated on real student sessions.** Bikeguide's AI turns are paraphrased, and Emilie's
    classes are in prod.
  - The stock model caved on a bare "I don't think that's right" in every run we did.

---

## Testing that was done

All against the local server and `cta-pilot-dev`.

- **End to end (24 checks):** create; signed-out page; GET takes no seat; Start; returning guest
  keeps the seat; no Terms page; no-reflection submit; dashboard students, classes and assignments
  unchanged; room view reads the chart; owner can read and another teacher gets 403; seat cap; delete
  kills the guest session, the chart and the link. Re-run green after each change.
- **Load test:** 20 simultaneous Starts against 15 seats, twice.
- **Platform-admin path:** menu item, page access, create and delete.
- **Detector:** authored smoke cases, plus re-running every real demo-room exchange three times.
- **Screenshots** at 1280, 768, 390 and 360, in light and dark for the chart.

**The test scripts were not saved to the repo.** They lived in a session scratchpad, which is gone.
Worth recreating as committed scripts before the next round of changes: an end-to-end run, a
concurrent-Start load test, the pushback smoke cases, and the five-persona demo-room generator.

---

## Open items

0. **Presented results (2026-10-20):** screenshot-check `workshop-room.html` at 1280, 768 and 390,
   and on a projector (the page-to-card tone step is small, about 5%).
0b. **Per-person results design: undecided, product owner considering (2026-10-20).** The room view
   is anonymous and for the projector; the facilitator's **Open results** link in `workshop.html`
   still opens `report.html` in plot-only mode, the same page each participant sees for their own
   results, in the older style. Two options were set out:
   - **A facilitator-only page**, `workshop-result.html?id=<submission>`, sharing
     `workshop-room.css` and its components: the person's name and task in the header; tabs *Their
     conversation* | Levels of agency | Dimensions (the explainer tabs reused); the whole
     conversation as one fitted turn plot with a reading pane; their patterns as cards that tint
     their turns; the patterns not seen as a quieter row; "AI backed off" with the AI's reply. No new
     route: the report endpoint already returns `classified`, `patterns` and `aiMoments` and already
     limits a guest's results to the workshop's owner. Built this way it could later become the
     participant's own "Your results" page (canvas screen 9) by dropping the name.
   - **Restyle `report.html` itself**, so participants and facilitators get the new design together;
     this is tied to the wider question of whether the tool's own reports move to this style.

   Recommendation given: keep individual results for participants (their own map is what makes the
   room discussion land), don't invest further in the facilitator's per-person view on its own, and
   if anything is restyled, start with the participant's results so what a teacher sees on their
   screen matches the projector.

1. **Deploy, then grant Emilie.** Nothing has reached prod.
2. **Commit:** split this work from the demo-tour changes in the same tree.
3. **Plot/detail gap on wide screens.** With the sessions panel gone, the chart card is wide but the
   plot is capped at 64px per turn, leaving a gap between the plot and the "Pick any turn" panel.
   Either raise the cap or put the detail panel under the plot (workshop only). Undecided.
4. **Five minutes rarely trips a pattern.** In the demo room, the passive teacher and the most
   directive one both showed "No pattern detected". The run detectors need three or more similar
   turns in a row, and their thresholds are guesses that **must not be tuned on demo or seed data**.
   The guide says so, so an empty result doesn't read as a verdict. The redesign no longer leans on
   the AI lane to carry the story (it becomes an ordinary pattern), so this matters more: the
   no-patterns copy has to hold up. A possible direction: single-turn moments for short sessions.
5. **Target wobble.** A dispute phrased as a request ("…what's your strongest remaining objection?")
   reads sometimes as a claim, sometimes as a choice. Both are safe (a choice never produces a cave),
   but the note and the room counts can shift between runs.
6. **Validate AI Caved on real sessions** before treating it as a finding outside the workshop.
   Read every hit.
7. **Tasks aren't shared between facilitators.** Each facilitator sees only their own, by design for
   now.
8. **Guest crumbs say "All assignments"** in the workspace and report. That's harmless (it lists
   their one task) but student-app vocabulary.
9. **The room view has no export.** A facilitator wanting to keep the room's results must do so
   before deletion; nothing is kept after.
10. **Build the results redesign** once screen 9 is approved. Item 3 (plot/detail gap) is resolved
    by the canvas layout: plot left, selected turn right, key under both.
11. **Design facilitator review**: the room view after the session, the canvas's last open section.
12. **"Before you go" (canvas screen 10)** still says "Your chart"; update it with the results work.
