// Data seam — Firestore (swapped from JSON files 2026-08-05).
//
// Every method is async. The JSON-file version was synchronous, which is why
// this swap touched 153 call sites: the shape was already Firestore's, but the
// timing was not.
//
// Two ways to read a collection, and the difference is a cost decision:
//
//   .list({ conversationId: id })   → a Firestore where() query. Reads only
//                                     matching documents. Use this.
//   .list((t) => t.someTest(...))   → reads the WHOLE collection, filters in
//                                     memory. Firestore bills per document
//                                     read, and `turns` grows without bound —
//                                     every message ever sent. Only acceptable
//                                     on collections that stay small.
//
// The predicate form is kept because a handful of filters are genuinely not
// expressible as equality (date-range comparisons, cross-collection tests).
// Each surviving one is commented at its call site with why.
//
// Collections (the Phase B data model):
//   users         { id, email, displayName,
//                   role: 'student'|'teacher'|'platform-admin',
//                   schoolAdmin: boolean, status: 'active'|'suspended',
//                   createdAt, passwordHash, passwordSalt } (dev-only; prod SSO)
//                 An absent status means active — accounts created before the
//                 admin role existed need no migration.
//                 'platform-admin' is us: it creates and suspends accounts and
//                 reads aggregate product metrics plus what the tool costs. It
//                 is deliberately NOT a super-teacher — it has no route into a
//                 named student, a transcript, a report, or an integrity flag,
//                 which is what keeps the teacher-only guarantee on flags true.
//                 (It replaced the plain 'admin' role, 2026-08-07.)
//                 schoolAdmin is a *grant on a teacher*, not a role: in a pilot
//                 one person teaches and also runs their school's teacher
//                 accounts. Teaching is a data relationship — classes,
//                 assignments and submissions all key off teacherId — so it
//                 stays the role, and administering is the additive permission.
//                 The reverse modelling would drop that person out of every
//                 `role: 'teacher'` query that builds a roster. Only a
//                 platform-admin may set the grant; see index.js.
//                 researchEligible is a second grant on a teacher (2026-08-15),
//                 settable only by a platform-admin for the same reason: it
//                 records that we hold a signed agreement with that person. It
//                 authorises nothing by itself — it makes the per-class consent
//                 control appear, and the class stamp below is what actually
//                 releases anything. Two keys, because permission to consent
//                 and the act of consenting are decisions by different people.
//   authSessions  dev login sessions — replaced by Firebase ID tokens in prod:
//                 { id, userId, token, createdAt, expiresAt }
//   classes       { id, teacherId, name, studentIds: [], createdAt }
//                 A student's studentIds membership can span multiple classes
//                 (e.g. two different course sections) — that's the normal
//                 case, not an edge case, once a school has more than one
//                 pilot class running.
//                 research: { grantedAt, grantedBy, grantedByName } | null —
//                 this class's work may be used to improve the measurement.
//                 Absent/null means no. A stamp rather than a boolean because
//                 the date is what separates work the agreement covered from
//                 work that came later; a bare true loses it. Set only by the
//                 owning teacher and only while they hold researchEligible;
//                 withdrawal is always allowed. Nothing in the product reads
//                 it yet — the exporter that will is not built.
//   assignments   { id, teacherId, classIds: [], title,
//                   description, purpose, requirements, dueDate,
//                   draftDueDates, draftBudget, createdAt }
//                 description/purpose/requirements are three separate teacher-
//                 authored fields (what the task is / why it matters / what
//                 must be included) rather than one prompt blob — shown to the
//                 student as labeled sections and composed into one string
//                 (assignmentBrief() in index.js) for the auditor. The chat
//                 itself is never told the assignment — coaching was removed
//                 2026-08-14. The tool never grades against these — that stays
//                 the teacher's own rubric, untouched (see CLAUDE.md scope
//                 boundary).
//                 draftDueDates[i] is when draft i+1 is due, ascending, length
//                 draftBudget; draftDueDates[draftBudget-1] === dueDate (the
//                 final draft's due date is the assignment's due date).
//                 classIds is which class(es) this assignment was given to —
//                 usually one, but a teacher can give the same assignment to
//                 more than one section of the same course.
//   sessions      one per revision cycle:
//                 { id, assignmentId, studentId, cycleIndex,
//                   status: 'active'|'submitted', startedAt, submittedAt }
//   conversations { id, sessionId, title, createdAt, lastActiveAt, locked,
//                   inputTokensTotal, contextNoticeAt }
//                 inputTokensTotal is what this thread has cost in input across
//                 all its chat replies, from the model's own count — the same
//                 number the daily cap reads, so the two cannot disagree about
//                 how big a conversation is. Auditor calls are excluded: they
//                 read the transcript but are not part of it.
//                 contextNoticeAt is when the student was told the thread was
//                 getting long, so they are told once rather than every turn.
//   turns         append-only integrity record — never updated, never deleted:
//                 { id, conversationId, role: 'student'|'coach'|'auditor',
//                   text, createdAt, meta }
//   submissions   { id, sessionId, assignmentId, studentId, cycleIndex,
//                   essayText, submittedAt, analysisId }
//   analyses      { id, submissionId, ... }  (Phase E fills this in)
//   events        { id, studentId, sessionId, conversationId, type, ts, meta }
//                 types: copy | regenerate | edit | stop | evaluate |
//                        episode-save | episode-resume
//   llmCalls      one row per Vertex call — what the tool cost, as opposed to
//                 what got opened (`usage`) or what a student did (`events`):
//                 { id, ts, schoolId, studentId, assignmentId, submissionId,
//                   purpose: 'chat'|'auditor'|'classify'|'provenance'|'snapshot',
//                   ok, errorCode,
//                   model, billsTo: 'platform'|'school', inputTokens,
//                   cachedInputTokens, outputTokens, thinkingTokens, latencyMs }
//                 Tokens, never dollars — prices move, and stored dollars make
//                 history incomparable. Also the substrate for the daily cap,
//                 which is denominated in input tokens.
//   budgetGrants  RETIRED 2026-08-21 with the reply cap it lifted. Nothing
//                 reads or writes it. Existing rows are left in place rather
//                 than migrated away — they are the record of which teacher
//                 granted what, and deleting history to tidy a schema trades
//                 something irreplaceable for nothing.
//   signalMarks   { id, teacherId, studentId, submissionId, markedAt }
//                 A teacher marking one flagged draft as followed up. Id is
//                 `${teacherId}_${submissionId}` so a second mark overwrites
//                 rather than duplicates, and unmarking is a delete. Scoped
//                 to the teacher on purpose — "I've had this conversation"
//                 is a fact about a person, not about the draft, so a
//                 co-teacher still sees the flag as open.
//                 Presentation only: it never touches the analysis, and the
//                 flags stay rendered under the draft either way.
//   adminEvents   { id, ts, actorId, actorName, action, targetId, targetName,
//                   targetRole, detail }
//                 Every account action taken from the administration surface:
//                 create, edit, suspend, reactivate, reset-password,
//                 retry-analysis. Names are denormalised on purpose — an audit
//                 record has to survive a rename or a suspension of the very
//                 account it describes, so it must not be a join at read time.
//                 Grant changes are named in `detail` rather than folded into
//                 a bare 'edit' — for researchEligible that line is the record
//                 that a consent agreement was held on a given date.
//   loginFailures { id, email, ip, ts }
//                 Failed sign-ins, for the per-account throttle. `ip` is
//                 recorded but never used to block — a school is one NAT
//                 gateway, so an IP lockout locks out the class; it exists to
//                 spot a spray (one address, many distinct accounts). See
//                 auth.js.
//   usage         { id, userId, role, surface, area, ts }
//                 Product telemetry: which content areas of the tool actually
//                 get opened, so build effort can follow attention. Kept a
//                 separate collection from `events` on purpose — `events` is
//                 the append-only integrity record that feeds TAU scoring, and
//                 mixing "someone clicked a tab" into it would pollute the
//                 artifact an analysis is computed from.
//                 Written only for explicit opens (tab click, panel open,
//                 modal open), never on render, and only for surface/area
//                 pairs on the server-side allowlist in index.js. Read back
//                 exclusively as aggregates by the admin surface.

const crypto = require('crypto');
const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { config } = require('./school');

// Firestore always lives in the platform project, even for BYO-inference
// schools — deployment model 2 moves a school's *inference* to their project,
// not their data. See school.js.
let db = null;
function firestore() {
  if (db) return db;
  const projectId = config().gcp?.projectId;
  if (!projectId) throw new Error('config.json has no gcp.projectId — see app/gcp-setup.md step 9');
  initializeApp({ credential: applicationDefault(), projectId });
  db = getFirestore();
  // Firestore rejects undefined; the JSON store silently dropped it, and seed
  // data has optional fields that arrive undefined rather than absent.
  db.settings({ ignoreUndefinedProperties: true });
  return db;
}

function col(name) {
  const ref = () => firestore().collection(name);
  return {
    async get(id) {
      if (!id) return null;
      const snap = await ref().doc(id).get();
      return snap.exists ? snap.data() : null;
    },

    async add(doc) {
      const id = crypto.randomUUID();
      const withId = { id, ...doc };
      await ref().doc(id).set(withId);
      return withId;
    },

    async set(id, doc) {
      const withId = { id, ...doc };
      await ref().doc(id).set(withId);
      return withId;
    },

    async update(id, patch) {
      const docRef = ref().doc(id);
      const snap = await docRef.get();
      if (!snap.exists) throw new Error(`${name}/${id} not found`);
      await docRef.update(patch);
      return { ...snap.data(), ...patch };
    },

    // filter: an object of equality constraints (a real query), a predicate
    // function (full collection scan — see the header), or omitted (all docs).
    async list(filter) {
      if (filter && typeof filter === 'object') {
        let query = ref();
        for (const [field, value] of Object.entries(filter)) query = query.where(field, '==', value);
        return (await query.get()).docs.map((d) => d.data());
      }
      const all = (await ref().get()).docs.map((d) => d.data());
      return typeof filter === 'function' ? all.filter(filter) : all;
    },

    // Turns and submissions are append-only by design; this exists for
    // records that are meant to stop existing, like a revoked session.
    async delete(id) {
      await ref().doc(id).delete();
    },

    // Firestore has no "delete the whole collection" — it is a client-side
    // loop by design. Only the dev reset path uses this.
    async deleteAll() {
      const snap = await ref().get();
      const batches = [];
      for (let i = 0; i < snap.docs.length; i += 400) {
        const batch = firestore().batch();
        for (const d of snap.docs.slice(i, i + 400)) batch.delete(d.ref);
        batches.push(batch.commit());
      }
      await Promise.all(batches);
      return snap.size;
    },
  };
}

module.exports = { col };
