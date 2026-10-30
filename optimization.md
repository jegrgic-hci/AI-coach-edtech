# Loading speed and efficiency

Open work on how fast the student home loads and how many Firestore reads it costs. Written
2026-10-30. **Neither option below is built.**

## What's already done

Coming back to the home from a report is now instant. The last `/api/student/home` payload is kept
in `sessionStorage` (`homeCache` in `app/web/api.js`). The home paints it immediately, then fetches a
fresh copy and redraws only if the copy changed. The cache is dropped in these cases:

- any write through `api()`
- the chat stream
- a report re-run
- sign-out
- any page outside `/`, `/index.html` and `/report.html`

`report-boot.js` updates the cached copy when opening a report marks a teacher note as read.

That is a client-side fix. It does nothing for the first load after sign-in, or for a return after
any write. The two options below fix the server, and they speed up every load.

## Why the home is slow

`GET /api/student/home` (`app/server/index.js`, around line 1517) does the following:

1. **Two full-collection scans.** `classes` and `assignments` are both read with a predicate. Per
   `store.js`'s header, a predicate list reads **every document in the collection** and filters in
   memory. Both collections grow with every school on the instance, not with this student's work.
2. **A sequential loop of reads for each assignment.** Each assignment gets:
   - a `submissions` query
   - one `analyses` get per submission
   - a `sessions` query
   - for open assignments, a `conversations` query and then a `turns` query per conversation

   Every one of these is awaited before the next starts.
3. **A full read of the student's usage history.** `checkChatBudget` → `usageToday` reads every
   `llmCalls` row the student has ever produced, then filters to today in memory.

A student with 5 assignments of 2 drafts each makes 30+ back-to-back Firestore round trips. The time
is the **sum** of their latencies.

## Option 1 — Stop reading whole collections

Change what is read, so cost tracks this student's data and not the whole instance.

**Classes.** Query by membership instead of scanning:
`where('studentIds', 'array-contains', user.id)`.

`col().list()` only builds `==` constraints, so `store.js` needs a way to express this. Either add
`array-contains` support to `list`, or add a narrow `col().where(field, op, value)` method. Keep the
store's rule that the predicate form is the exception, commented at each call site.

**Assignments.** Query by class:
`where('classIds', 'array-contains-any', [...myClassIds])`. Two open points:

- **The 30-value limit.** `array-contains-any` takes at most 30 values. Chunk the class ids if a
  student could ever be in more than 30 classes.
- **Legacy unclassed assignments.** The current rule shows assignments with no `classIds` to every
  student. Firestore cannot query for a missing field. Decide whether any such assignments still
  exist in `tau-thinking-prod`:
  - **If none exist,** drop the rule.
  - **If some exist,** backfill a value the query can match, then drop the rule.

  Don't carry a second full scan just to keep the rule.

**Submissions and sessions.** Fetch once per student, not once per assignment:

- `submissions` where `studentId == user.id`
- `sessions` where `studentId == user.id` and `status == 'active'`

Then group both by `assignmentId` in memory. That replaces 2 × N queries with 2.

**Analyses.** Read all of them in one batched `getAll` instead of one `get` per submission. `store.js`
needs a `getMany(ids)` for this.

**Turns.** The turns query only checks whether *any* turn exists. Use `limit(1)` so it reads one
document, not the whole conversation. `store.js` needs a limit option for this. Alternatively, stamp
`hasTurns` (or reuse `lastActiveAt`) on the conversation when the first turn is written, and drop the
turns read entirely.

**Usage.** In `usageToday`, add the date to the query (`ts >= since`) instead of filtering in memory.
This needs a range operator in the store and a composite index on `llmCalls (studentId, ts)`.

**Same pattern elsewhere.** `GET /api/assignments` scans `classes` the same way, and so do the
class-membership checks around lines 1704 and 1723. In total there are 5 predicate scans of `classes`
or `assignments` in `index.js`. Fix them together once the store supports the queries.

**Index work.** Any composite query needs its index created in **both** `cta-pilot-dev` and
`tau-thinking-prod` before deploy. A missing index fails the query at runtime, not at startup.

## Option 2 — Run independent reads in parallel

Change when the reads happen, so the wait is the slowest read and not the sum of all of them.

Inside the per-assignment loop, nothing depends on another assignment's results. Run the loop body
under `Promise.all` over the assignments, and within each assignment run these concurrently:

- the analyses gets
- the sessions query
- the conversations query

The class and assignment reads can also run alongside `checkChatBudget`.

Points to hold:

- **Keep the output order.** `current` and `past` must stay in assignment order. Have each
  assignment return its own entry, then split the results after `Promise.all`.
- **Collect `trend` the same way, then sort it.** It is already sorted at the end.
- **The `turns` short-circuit.** It currently stops at the first conversation with turns. In
  parallel, either keep that check sequential within one assignment, or switch to Option 1's
  `limit(1)` / `hasTurns`, which makes the question moot.
- **Concurrency.** Firestore handles this fine at the size of one student's home. No limiter is
  needed.

## Order of work

**Option 2 first.** It is contained to one handler, needs no store changes, no indexes and no data
decisions, and it removes most of the wait.

**Option 1 next.** It is the one that matters as the instance grows: the full scans get slower and
cost more with every school added, whatever this student has. Take it on before a second school's
data lands in `tau-thinking-prod`, and decide the legacy unclassed-assignment rule first.

After Option 1, most of Option 2's per-assignment parallelism is no longer needed, because the reads
are no longer per assignment.
