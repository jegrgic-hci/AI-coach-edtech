// Dev seed: a demo class with history, so the student home view and the
// teacher dashboard are both meaningful on a fresh checkout.
//
// Idempotent per email rather than "bail if any user exists" — so it can extend
// an already-populated app/data (and backfill passwords onto users seeded by an
// earlier version) without needing a wipe.
//
// Analyses are built from the hand-labeled transcripts in seed-data.js and run
// through the real enrich()/scoreTAU(), so no LLM call and no GROQ_API_KEY is
// needed to see a report.

const { col } = require('./store');
const { setPassword, DEV_PASSWORD } = require('./auth');
const { enrich, scoreTAU, detectPatterns, ANALYSIS_VERSION } = require('./analysis');
const {
  STUDENTS, CLASSES, ASSIGNMENTS, ELECTIVE_ASSIGNMENT,
  ENGLISH_EXTRA_ASSIGNMENT, LIT_EXTRA_ASSIGNMENT, GUIDE_ASSIGNMENT,
  OPEN_ASSIGNMENTS, OPEN_ASSIGNMENT_STATE, TRANSCRIPTS,
  ESSAYS, PROVENANCE, FLAGS, SNAPSHOTS, TEACHER_NOTES, OPEN_TEACHER_NOTES,
  READINGS,
} = require('./seed-data');

const TEACHER_EMAIL = 'teacher@school.dev';
const ADMIN_EMAIL = 'admin@school.dev';

// Backdated so the growth strip has a real time axis instead of everything
// landing in the same second.
const DAY = 86400000;
const ts = (daysAgo) => new Date(Date.now() - daysAgo * DAY).toISOString();
// Signed version of ts() for due dates, which — unlike everything else seeded
// here — need to land in the future as often as the past: tsOffset(-3) is 3
// days ago, tsOffset(3) is 3 days from now.
const tsOffset = (days) => new Date(Date.now() + days * DAY).toISOString();

async function upsertUser({ email, displayName, role, schoolAdmin = false }) {
  let user = (await col('users').list({ email }))[0];
  if (!user) {
    user = await col('users').add({ email, displayName, role, schoolAdmin, createdAt: ts(60) });
  }
  if (user.displayName !== displayName) user = await col('users').update(user.id, { displayName });
  // Role and grant are re-applied on every seed rather than only at creation:
  // dev databases predate the platform-admin split, and an account left on the
  // old `admin` role would simply stop being able to sign in anywhere useful.
  if (user.role !== role || user.schoolAdmin !== schoolAdmin) {
    user = await col('users').update(user.id, { role, schoolAdmin });
  }
  if (!user.passwordHash) user = await setPassword(user, DEV_PASSWORD);
  return user;
}

async function upsertAssignment(teacherId, spec, daysAgo, classIds) {
  const existing = (await col('assignments').list({ title: spec.title }))[0];
  // draftDueDates[i] is when draft i+1 is due; the last entry doubles as the
  // assignment's own final due date — the rule is the final draft's due date
  // *is* the assignment's due date, not a separate value to keep in sync.
  const draftDueDates = spec.draftDueInDays.map(tsOffset);
  const dueDate = draftDueDates[draftDueDates.length - 1];
  if (existing) {
    // draftDueDates are relative to "now" by design (tsOffset, unlike
    // everything else seeded here) so the demo always shows one overdue
    // draft, one due soon, one comfortable — but returning `existing`
    // untouched froze them at whatever day the store was first seeded,
    // so the narrative silently decayed into "everything overdue" as real
    // calendar days passed without a full reseed. Refreshed on every
    // server start instead — 2026-07-30, prompted by exactly that decay
    // making the class roster's submission/missing counts read as
    // contradictory. classIds still only backfills, same as before, since
    // that's real assignment state, not a relative offset that goes stale.
    const patch = { draftDueDates, dueDate };
    if (!existing.classIds) patch.classIds = classIds;
    return col('assignments').update(existing.id, patch);
  }
  return await col('assignments').add({
    teacherId,
    classIds,
    title: spec.title,
    description: spec.description,
    purpose: spec.purpose,
    requirements: spec.requirements,
    dueDate,
    draftDueDates,
    draftBudget: spec.draftBudget,
    createdAt: ts(daysAgo),
    ...(spec.teacherNote ? { teacherNote: spec.teacherNote, teacherNoteAt: ts(daysAgo - 1) } : {}),
  });
}

async function upsertClass(teacherId, spec, studentIds) {
  const existing = (await col('classes').list({ name: spec.name }))[0];
  if (existing) {
    // Membership can grow as students are seeded — keep it current rather
    // than freezing whatever the first run happened to create.
    if (JSON.stringify(existing.studentIds) !== JSON.stringify(studentIds)) {
      return col('classes').update(existing.id, { studentIds });
    }
    return existing;
  }
  return col('classes').add({ teacherId, name: spec.name, studentIds, createdAt: ts(60) });
}

// Writes one completed revision cycle: session + conversation + turns +
// submission + a derived analysis. Returns the submission.
async function seedCycle({ student, assignment, tier, cycleIndex, daysAgo }) {
  const transcript = TRANSCRIPTS[tier][cycleIndex];

  const session = await col('sessions').add({
    assignmentId: assignment.id,
    studentId: student.id,
    cycleIndex,
    status: 'submitted',
    startedAt: ts(daysAgo + 2),
    submittedAt: ts(daysAgo),
  });

  const conversation = await col('conversations').add({
    sessionId: session.id,
    title: transcript.title,
    createdAt: ts(daysAgo + 2),
    lastActiveAt: ts(daysAgo),
    locked: true,
  });

  const labelMap = {};
  let studentIdx = 0;
  const turns = [];
  for (const [i, turn] of transcript.turns.entries()) {
    if (turn.role === 'student') labelMap[studentIdx++] = { label: turn.label };
    turns.push(await col('turns').add({
      conversationId: conversation.id,
      role: turn.role,
      text: turn.text,
      // Spread across the two days between start and submit so the teacher
      // timeline renders in a sensible order.
      createdAt: new Date(Date.now() - (daysAgo + 2) * DAY + i * 4 * 60000).toISOString(),
      meta: {},
    }));
  }

  const classified = enrich([{ conversation, turns }], labelMap);
  const provenance = PROVENANCE[tier][cycleIndex];
  const tau = scoreTAU(classified, provenance);

  const submission = await col('submissions').add({
    sessionId: session.id,
    assignmentId: assignment.id,
    studentId: student.id,
    cycleIndex,
    essayText: ESSAYS[tier][cycleIndex],
    submittedAt: ts(daysAgo),
    analysisId: null,
  });

  const analysis = await col('analyses').add({
    submissionId: submission.id,
    status: 'complete',
    // Stamped like a real run's — an unstamped analysis reads as stale, and a
    // demo roster of "re-run this" notices would be a seed that fails the
    // check it exists to demonstrate.
    version: ANALYSIS_VERSION,
    createdAt: ts(daysAgo),
    completedAt: ts(daysAgo),
    // The reading is authored per tier in seed-data.js — the seed makes no
    // LLM call, and readSession() is an LLM read. Fixture only.
    reading: READINGS[tier],
    tau,
    provenance,
    flags: FLAGS[tier],
    snapshot: SNAPSHOTS[tier][cycleIndex],
    classified,
    // Derived, never authored — same rule as tau above. A hand-written
    // pattern list would make the demo agree with the detector by
    // construction, which is the one thing seed data must not do.
    patterns: detectPatterns(classified),
    eventCounts: {},
  });
  await col('submissions').update(submission.id, { analysisId: analysis.id });

  return submission;
}

// Writes a submitted draft whose analysis hasn't resolved — 'pending' (still
// analyzing) or 'error' (failed). No tau, no provenance: the draft-row ledger
// only ever shows these as a status word and a detail line, never a score, so
// there is nothing downstream that needs the real scoring pipeline here.
async function seedIncompleteCycle({ student, assignment, tier, cycleIndex, daysAgo, status, error }) {
  const transcript = TRANSCRIPTS[tier][cycleIndex];

  const session = await col('sessions').add({
    assignmentId: assignment.id,
    studentId: student.id,
    cycleIndex,
    status: 'submitted',
    startedAt: ts(daysAgo + 2),
    submittedAt: ts(daysAgo),
  });

  const conversation = await col('conversations').add({
    sessionId: session.id,
    title: transcript.title,
    createdAt: ts(daysAgo + 2),
    lastActiveAt: ts(daysAgo),
    locked: true,
  });

  for (const [i, turn] of transcript.turns.entries()) {
    await col('turns').add({
      conversationId: conversation.id,
      role: turn.role,
      text: turn.text,
      createdAt: new Date(Date.now() - (daysAgo + 2) * DAY + i * 4 * 60000).toISOString(),
      meta: {},
    });
  }

  const submission = await col('submissions').add({
    sessionId: session.id,
    assignmentId: assignment.id,
    studentId: student.id,
    cycleIndex,
    essayText: ESSAYS[tier][cycleIndex],
    submittedAt: ts(daysAgo),
    analysisId: null,
  });

  const analysis = await col('analyses').add({
    submissionId: submission.id,
    status,
    createdAt: ts(daysAgo),
    ...(status === 'error' ? { error } : {}),
  });
  await col('submissions').update(submission.id, { analysisId: analysis.id });

  return submission;
}

// Writes an open, unsubmitted session — the current draft has real activity
// but nothing sent to the teacher yet, so the row reads "In progress" with a
// Continue button rather than "Submitted." No submission record at all: that
// is what distinguishes this from every other seeded state.
async function seedActiveDraft({ student, assignment, tier, cycleIndex, daysAgo }) {
  const transcript = TRANSCRIPTS[tier][cycleIndex];

  const session = await col('sessions').add({
    assignmentId: assignment.id,
    studentId: student.id,
    cycleIndex,
    status: 'active',
    startedAt: ts(daysAgo),
  });

  const conversation = await col('conversations').add({
    sessionId: session.id,
    title: transcript.title,
    createdAt: ts(daysAgo),
    lastActiveAt: ts(daysAgo),
    locked: false,
  });

  for (const [i, turn] of transcript.turns.entries()) {
    await col('turns').add({
      conversationId: conversation.id,
      role: turn.role,
      text: turn.text,
      createdAt: new Date(Date.now() - daysAgo * DAY + i * 4 * 60000).toISOString(),
      meta: {},
    });
  }

  return session;
}

async function seed() {
  // The demo seed writes ten accounts that all share one published password
  // and fabricated student transcripts. Reaching a store with real students in
  // it would be severe, so it is opt-in: absent or misspelled SEED_DEMO means
  // no seed. The previous guard was the inverse — skip if NODE_ENV=production —
  // which failed open, and Cloud Run env vars are set wholesale by
  // --set-env-vars, so dropping one line from cloudbuild.yaml was enough to
  // silently re-enable it. (2026-08-08, real-users split.)
  if (process.env.SEED_DEMO !== '1') {
    console.log('seed: skipped (set SEED_DEMO=1 to seed demo data — see npm run start:demo)');
    return;
  }

  // Both switches have to agree. SEED_DEMO=1 reaching a production instance
  // means something is wrong with that deploy, not that someone wants demo
  // students in it.
  if (process.env.NODE_ENV === 'production') {
    throw new Error('SEED_DEMO=1 with NODE_ENV=production — refusing to write demo accounts to a production store');
  }

  // Staging (SEED_ONCE=1) seeds an empty store and then leaves it alone. The
  // upserts below are idempotent per *record*, which means a redeploy would
  // overwrite anything a stakeholder changed on a seeded assignment or note
  // while they were reviewing — the demo class would silently revert under
  // them. Their own new records survive either way; this is about not undoing
  // edits to seeded ones. Local `start:demo` doesn't set it, so a checkout
  // still picks up changes to seed-data.js on every restart.
  if (process.env.SEED_ONCE === '1' && (await col('users').list()).length > 0) {
    console.log('seed: skipped (SEED_ONCE=1 and the store already has users)');
    return;
  }

  // Flagged as a school administrator so the pilot shape is what dev exercises:
  // one person who teaches and also runs the school's teacher accounts. She
  // still owns classes and assignments below, which is the whole reason the
  // grant hangs off a teacher rather than replacing the role.
  const teacher = await upsertUser({ email: TEACHER_EMAIL, displayName: 'Ms. Karim', role: 'teacher', schoolAdmin: true });
  // The platform tier: adds accounts, reads aggregate product metrics and what
  // the tool costs. Owns no class and no assignment, so it needs no wiring
  // into anything below — and deliberately has no route into student work.
  await upsertUser({ email: ADMIN_EMAIL, displayName: 'Dana Okoye', role: 'platform-admin' });

  // Users first, so class membership (which is by studentId) can be built
  // before any assignment or class record needs it.
  const studentByEmail = {};
  for (const spec of STUDENTS) {
    studentByEmail[spec.email] = await upsertUser({ email: spec.email, displayName: spec.displayName, role: 'student' });
  }
  const classByName = {};
  for (const spec of CLASSES) {
    const studentIds = spec.studentEmails.map((e) => studentByEmail[e].id);
    classByName[spec.name] = await upsertClass(teacher.id, spec, studentIds);
  }
  const mainClassId = classByName['English 10'].id;
  const electiveClassId = classByName['Journalism Elective'].id;
  const litClassId = classByName['American Literature'].id;
  const allClassIds = [mainClassId, electiveClassId, litClassId];

  // Past and bike-guide are both closed assignments shared by every class —
  // scoped to all three, unlike the open assignments below which are
  // deliberately one-per-class (see OPEN_ASSIGNMENTS/OPEN_ASSIGNMENT_STATE).
  const pastAssignment = await upsertAssignment(teacher.id, ASSIGNMENTS.past, 45, allClassIds);
  const guideAssignment = await upsertAssignment(teacher.id, GUIDE_ASSIGNMENT, 50, allClassIds);
  const electiveAssignment = await upsertAssignment(teacher.id, ELECTIVE_ASSIGNMENT, 5, [electiveClassId]);
  // English 10 and American Literature's own third closed assignment — same
  // "one class, one student, one cycle" shape as electiveAssignment above, so
  // both classes clear the class-tier dimension arc's 3-closed-assignment
  // floor instead of only Journalism Elective ever showing that chart.
  const englishExtraAssignment = await upsertAssignment(teacher.id, ENGLISH_EXTRA_ASSIGNMENT, 9, [mainClassId]);
  const litExtraAssignment = await upsertAssignment(teacher.id, LIT_EXTRA_ASSIGNMENT, 9, [litClassId]);
  const openAssignmentByClassKey = {
    class1: await upsertAssignment(teacher.id, OPEN_ASSIGNMENTS.class1, 10, [mainClassId]),
    class2: await upsertAssignment(teacher.id, OPEN_ASSIGNMENTS.class2, 10, [electiveClassId]),
    class3: await upsertAssignment(teacher.id, OPEN_ASSIGNMENTS.class3, 10, [litClassId]),
  };

  const hasSubmission = async (studentId, assignmentId) =>
    (await col('submissions').list({ studentId, assignmentId })).length > 0;
  const hasSession = async (studentId, assignmentId) =>
    (await col('sessions').list({ studentId, assignmentId })).length > 0;

  // Gives the elective assignment (and the multi-class Maya belongs to) real
  // submitted data, rather than an assignment that only ever shows empty rows.
  if (!await hasSubmission(studentByEmail['maya@school.dev'].id, electiveAssignment.id)) {
    await seedCycle({
      student: studentByEmail['maya@school.dev'], assignment: electiveAssignment, tier: 'strong', cycleIndex: 0, daysAgo: 1,
    });
  }

  // English 10 and American Literature's own extra closed assignment, each
  // seeded from a 'flat' student's second-draft transcript rather than
  // reusing 'strong'/cycle 0 like the elective one above — gives the new
  // three-point arc a real dip to show instead of three flat, similar
  // scores, so the outlier callout has something genuine to name.
  if (!await hasSubmission(studentByEmail['sam@school.dev'].id, englishExtraAssignment.id)) {
    await seedCycle({
      student: studentByEmail['sam@school.dev'], assignment: englishExtraAssignment, tier: 'flat', cycleIndex: 1, daysAgo: 8,
    });
  }
  if (!await hasSubmission(studentByEmail['elena@school.dev'].id, litExtraAssignment.id)) {
    await seedCycle({
      student: studentByEmail['elena@school.dev'], assignment: litExtraAssignment, tier: 'flat', cycleIndex: 1, daysAgo: 8,
    });
  }

  for (const spec of STUDENTS) {
    const student = studentByEmail[spec.email];

    // Closed multi-draft assignment: every student gets the full three-draft
    // arc for their tier. This one is done and graded everywhere — the
    // demo's state variety (in-progress, pending, error, not-started) lives
    // in the open assignments below instead.
    if (!await hasSubmission(student.id, pastAssignment.id) && !await hasSession(student.id, pastAssignment.id)) {
      let lastSubmission = null;
      for (let cycle = 0; cycle < ASSIGNMENTS.past.draftBudget; cycle++) {
        lastSubmission = await seedCycle({
          student,
          assignment: pastAssignment,
          tier: spec.tier,
          cycleIndex: cycle,
          // 34, 26, 18 days ago for a three-draft arc.
          daysAgo: 34 - cycle * 8,
        });
      }
      if (lastSubmission && TEACHER_NOTES[spec.email]) {
        await col('submissions').update(lastSubmission.id, {
          teacherNote: TEACHER_NOTES[spec.email],
          teacherNoteAt: ts(16),
        });
      }
    }

    // Closed bike-guide assignment: the same real transcript/essay cloned
    // onto every student regardless of tier, so every roster row is fully
    // scored instead of leaving most of them blank.
    if (!await hasSubmission(student.id, guideAssignment.id)) {
      await seedCycle({ student, assignment: guideAssignment, tier: 'bikeguide', cycleIndex: 0, daysAgo: 3 });
    }
  }

  // Open assignments: one per class, each seeded to a different draft stage
  // (see OPEN_ASSIGNMENT_STATE) so the demo shows a class early in an
  // assignment, a class midway, and a class on its final draft side by side —
  // plus deliberate per-student variety (in-progress, pending, error,
  // not-started) rather than every row reading "submitted, scored."
  for (const classKey of Object.keys(OPEN_ASSIGNMENT_STATE)) {
    const assignment = openAssignmentByClassKey[classKey];
    const spec = OPEN_ASSIGNMENTS[classKey];
    for (const row of OPEN_ASSIGNMENT_STATE[classKey]) {
      const student = studentByEmail[row.email];
      const studentSpec = STUDENTS.find((s) => s.email === row.email);
      if (await hasSubmission(student.id, assignment.id) || await hasSession(student.id, assignment.id)) continue;

      let lastSubmission = null;
      for (let cycle = 0; cycle < row.drafts; cycle++) {
        lastSubmission = await seedCycle({
          student, assignment, tier: studentSpec.tier, cycleIndex: cycle, daysAgo: spec.draftSubmittedDaysAgo[cycle],
        });
      }
      if (lastSubmission && OPEN_TEACHER_NOTES[row.email]) {
        await col('submissions').update(lastSubmission.id, {
          teacherNote: OPEN_TEACHER_NOTES[row.email],
          teacherNoteAt: ts(2),
        });
      }

      // Draft in progress but not yet submitted — the row reads "In
      // progress" with a Continue button rather than a status inherited
      // from the last completed draft.
      if (row.active !== undefined) {
        await seedActiveDraft({ student, assignment, tier: studentSpec.tier, cycleIndex: row.active, daysAgo: 1 });
      }
      // Submitted but the analysis hasn't resolved yet ('pending') or failed
      // ('error') — the draft-row ledger's other two states besides scored
      // and not-started.
      if (row.incomplete) {
        await seedIncompleteCycle({
          student, assignment, tier: studentSpec.tier, cycleIndex: row.incomplete.cycleIndex,
          daysAgo: 0.1, status: row.incomplete.status, error: row.incomplete.error,
        });
      }
    }
  }

  // Users left over from earlier hand-testing predate passwords. Give them the
  // dev password too rather than stranding them out of their own data.
  // Not an equality query — `users` is small and bounded, so a scan is fine.
  for (const u of await col('users').list((u) => !u.passwordHash)) await setPassword(u, DEV_PASSWORD);
}

module.exports = { seed };

// `npm run seed` reseeds without starting the server. Until 2026-08-08 this
// file only exported, so running it directly did nothing at all.
if (require.main === module) {
  seed()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('seed failed:', err);
      process.exit(1);
    });
}
