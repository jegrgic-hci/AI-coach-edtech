// Data seam. Dev: each collection is one JSON file in app/data.
// Prod: swap this module for Firestore — the API below mirrors Firestore's
// collection/doc shape so the swap is mechanical.
//
// Collections (the Phase B data model):
//   users         { id, email, displayName, role: 'student'|'teacher', createdAt,
//                   passwordHash, passwordSalt }   (dev-only; prod is SSO)
//   authSessions  dev login sessions — replaced by Firebase ID tokens in prod:
//                 { id, userId, token, createdAt, expiresAt }
//   assignments   { id, teacherId, title, prompt, dueDate, draftBudget,
//                   coachingLevels: ['full','full','questions','sounding-board'], createdAt }
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
