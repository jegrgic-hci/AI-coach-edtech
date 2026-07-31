// Data seam. Dev: each collection is one JSON file in app/data.
// Prod: swap this module for Firestore — the API below mirrors Firestore's
// collection/doc shape so the swap is mechanical.
//
// Collections (the Phase B data model):
//   users         { id, email, displayName, role: 'student'|'teacher', createdAt,
//                   passwordHash, passwordSalt }   (dev-only; prod is SSO)
//   authSessions  dev login sessions — replaced by Firebase ID tokens in prod:
//                 { id, userId, token, createdAt, expiresAt }
//   classes       { id, teacherId, name, studentIds: [], createdAt }
//                 A student's studentIds membership can span multiple classes
//                 (e.g. two different course sections) — that's the normal
//                 case, not an edge case, once a school has more than one
//                 pilot class running.
//   assignments   { id, teacherId, classIds: [], title,
//                   description, purpose, requirements, dueDate,
//                   draftDueDates, draftBudget,
//                   coachingLevels: ['full','full','questions','sounding-board'],
//                   createdAt }
//                 description/purpose/requirements are three separate teacher-
//                 authored fields (what the task is / why it matters / what
//                 must be included) rather than one prompt blob — shown to the
//                 student as labeled sections and composed into one string
//                 (assignmentBrief() in index.js) to seed the coach's blank
//                 context. The tool never grades against these — that stays
//                 the teacher's own rubric, untouched (see CLAUDE.md scope
//                 boundary).
//                 draftDueDates[i] is when draft i+1 is due, ascending, length
//                 draftBudget; draftDueDates[draftBudget-1] === dueDate (the
//                 final draft's due date is the assignment's due date).
//                 classIds is which class(es) this assignment was given to —
//                 usually one, but a teacher can give the same assignment to
//                 more than one section of the same course.
//   sessions      one per revision cycle:
//                 { id, assignmentId, studentId, cycleIndex, coachingLevel,
//                   status: 'active'|'submitted', startedAt, submittedAt }
//   conversations { id, sessionId, title, createdAt, lastActiveAt, locked }
//   turns         append-only integrity record — never updated, never deleted:
//                 { id, conversationId, role: 'student'|'coach'|'auditor',
//                   text, createdAt, meta }
//   submissions   { id, sessionId, assignmentId, studentId, cycleIndex,
//                   essayText, submittedAt, analysisId }
//   analyses      { id, submissionId, ... }  (Phase E fills this in)
//   events        { id, studentId, sessionId, conversationId, type, ts, meta }
//                 types: copy | regenerate | edit | stop | evaluate |
//                        episode-save | episode-resume

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, '..', 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });

const cache = {};

function load(name) {
  if (cache[name]) return cache[name];
  const file = path.join(DATA_DIR, `${name}.json`);
  cache[name] = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
  return cache[name];
}

function persist(name) {
  const file = path.join(DATA_DIR, `${name}.json`);
  fs.writeFileSync(file, JSON.stringify(cache[name], null, 2));
}

function col(name) {
  return {
    get(id) {
      return load(name)[id] || null;
    },
    add(doc) {
      const id = crypto.randomUUID();
      load(name)[id] = { id, ...doc };
      persist(name);
      return load(name)[id];
    },
    set(id, doc) {
      load(name)[id] = { id, ...doc };
      persist(name);
      return load(name)[id];
    },
    update(id, patch) {
      const docs = load(name);
      if (!docs[id]) throw new Error(`${name}/${id} not found`);
      Object.assign(docs[id], patch);
      persist(name);
      return docs[id];
    },
    list(filterFn) {
      const all = Object.values(load(name));
      return filterFn ? all.filter(filterFn) : all;
    },
  };
}

module.exports = { col };
