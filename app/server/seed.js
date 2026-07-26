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
const { setPassword } = require('./auth');
const { enrich, scoreTAU } = require('./analysis');
const {
  DEV_PASSWORD, STUDENTS, ASSIGNMENTS, GUIDE_ASSIGNMENT, TRANSCRIPTS,
  ESSAYS, PROVENANCE, FLAGS, SNAPSHOTS, TEACHER_NOTES, OPEN_TEACHER_NOTES,
} = require('./seed-data');

const TEACHER_EMAIL = 'teacher@school.dev';

// Backdated so the growth strip has a real time axis instead of everything
// landing in the same second.
const DAY = 86400000;
const ts = (daysAgo) => new Date(Date.now() - daysAgo * DAY).toISOString();
// Signed version of ts() for due dates, which — unlike everything else seeded
// here — need to land in the future as often as the past: tsOffset(-3) is 3
// days ago, tsOffset(3) is 3 days from now.
const tsOffset = (days) => new Date(Date.now() + days * DAY).toISOString();

function upsertUser({ email, displayName, role }) {
  let user = col('users').list((u) => u.email === email)[0];
  if (!user) {
    user = col('users').add({ email, displayName, role, createdAt: ts(60) });
  }
  if (user.displayName !== displayName) user = col('users').update(user.id, { displayName });
  if (!user.passwordHash) user = setPassword(user, DEV_PASSWORD);
  return user;
}

function upsertAssignment(teacherId, spec, daysAgo) {
  const existing = col('assignments').list((a) => a.title === spec.title)[0];
  if (existing) return existing;
  // draftDueDates[i] is when draft i+1 is due; the last entry doubles as the
  // assignment's own final due date — the rule is the final draft's due date
  // *is* the assignment's due date, not a separate value to keep in sync.
  const draftDueDates = spec.draftDueInDays.map(tsOffset);
  return col('assignments').add({
    teacherId,
    title: spec.title,
    prompt: spec.prompt,
    dueDate: draftDueDates[draftDueDates.length - 1],
    draftDueDates,
    draftBudget: spec.draftBudget,
    coachingLevels: spec.coachingLevels,
    createdAt: ts(daysAgo),
    ...(spec.teacherNote ? { teacherNote: spec.teacherNote, teacherNoteAt: ts(daysAgo - 1) } : {}),
  });
}

// Writes one completed revision cycle: session + conversation + turns +
// submission + a derived analysis. Returns the submission.
function seedCycle({ student, assignment, tier, cycleIndex, daysAgo }) {
  const transcript = TRANSCRIPTS[tier][cycleIndex];

  const session = col('sessions').add({
    assignmentId: assignment.id,
    studentId: student.id,
    cycleIndex,
    coachingLevel: assignment.coachingLevels[cycleIndex],
    status: 'submitted',
    startedAt: ts(daysAgo + 2),
    submittedAt: ts(daysAgo),
  });

  const conversation = col('conversations').add({
    sessionId: session.id,
    title: transcript.title,
    createdAt: ts(daysAgo + 2),
    lastActiveAt: ts(daysAgo),
    locked: true,
  });

  const labelMap = {};
  let studentIdx = 0;
  const turns = transcript.turns.map((turn, i) => {
    if (turn.role === 'student') labelMap[studentIdx++] = { label: turn.label };
    return col('turns').add({
      conversationId: conversation.id,
      role: turn.role,
      text: turn.text,
      // Spread across the two days between start and submit so the teacher
      // timeline renders in a sensible order.
      createdAt: new Date(Date.now() - (daysAgo + 2) * DAY + i * 4 * 60000).toISOString(),
      meta: {},
    });
  });

  const classified = enrich([{ conversation, turns }], labelMap);
  const provenance = PROVENANCE[tier][cycleIndex];
  const tau = scoreTAU(classified, provenance);

  const submission = col('submissions').add({
    sessionId: session.id,
    assignmentId: assignment.id,
    studentId: student.id,
    cycleIndex,
    essayText: ESSAYS[tier][cycleIndex],
    submittedAt: ts(daysAgo),
    analysisId: null,
  });

  const analysis = col('analyses').add({
    submissionId: submission.id,
    status: 'complete',
    createdAt: ts(daysAgo),
    completedAt: ts(daysAgo),
    coachingLevel: session.coachingLevel,
    tau,
    provenance,
    flags: FLAGS[tier],
    snapshot: SNAPSHOTS[tier][cycleIndex],
    classified,
    eventCounts: {},
  });
  col('submissions').update(submission.id, { analysisId: analysis.id });

  return submission;
}

// Writes a submitted draft whose analysis hasn't resolved — 'pending' (still
// analyzing) or 'error' (failed). No tau, no provenance: the draft-row ledger
// only ever shows these as a status word and a detail line, never a score, so
// there is nothing downstream that needs the real scoring pipeline here.
function seedIncompleteCycle({ student, assignment, tier, cycleIndex, daysAgo, status, error }) {
  const transcript = TRANSCRIPTS[tier][cycleIndex];

  const session = col('sessions').add({
    assignmentId: assignment.id,
    studentId: student.id,
    cycleIndex,
    coachingLevel: assignment.coachingLevels[cycleIndex],
    status: 'submitted',
    startedAt: ts(daysAgo + 2),
    submittedAt: ts(daysAgo),
  });

  const conversation = col('conversations').add({
    sessionId: session.id,
    title: transcript.title,
    createdAt: ts(daysAgo + 2),
    lastActiveAt: ts(daysAgo),
    locked: true,
  });

  transcript.turns.forEach((turn, i) => col('turns').add({
    conversationId: conversation.id,
    role: turn.role,
    text: turn.text,
    createdAt: new Date(Date.now() - (daysAgo + 2) * DAY + i * 4 * 60000).toISOString(),
    meta: {},
  }));

  const submission = col('submissions').add({
    sessionId: session.id,
    assignmentId: assignment.id,
    studentId: student.id,
    cycleIndex,
    essayText: ESSAYS[tier][cycleIndex],
    submittedAt: ts(daysAgo),
    analysisId: null,
  });

  const analysis = col('analyses').add({
    submissionId: submission.id,
    status,
    createdAt: ts(daysAgo),
    ...(status === 'error' ? { error } : {}),
  });
  col('submissions').update(submission.id, { analysisId: analysis.id });

  return submission;
}

// Writes an open, unsubmitted session — the current draft has real activity
// but nothing sent to the teacher yet, so the row reads "In progress" with a
// Continue button rather than "Submitted." No submission record at all: that
// is what distinguishes this from every other seeded state.
function seedActiveDraft({ student, assignment, tier, cycleIndex, daysAgo }) {
  const transcript = TRANSCRIPTS[tier][cycleIndex];

  const session = col('sessions').add({
    assignmentId: assignment.id,
    studentId: student.id,
    cycleIndex,
    coachingLevel: assignment.coachingLevels[cycleIndex],
    status: 'active',
    startedAt: ts(daysAgo),
  });

  const conversation = col('conversations').add({
    sessionId: session.id,
    title: transcript.title,
    createdAt: ts(daysAgo),
    lastActiveAt: ts(daysAgo),
    locked: false,
  });

  transcript.turns.forEach((turn, i) => col('turns').add({
    conversationId: conversation.id,
    role: turn.role,
    text: turn.text,
    createdAt: new Date(Date.now() - daysAgo * DAY + i * 4 * 60000).toISOString(),
    meta: {},
  }));

  return session;
}

function seed() {
  const teacher = upsertUser({ email: TEACHER_EMAIL, displayName: 'Ms. Karim', role: 'teacher' });

  const openAssignment = upsertAssignment(teacher.id, ASSIGNMENTS.open, 10);
  const pastAssignment = upsertAssignment(teacher.id, ASSIGNMENTS.past, 45);

  for (const spec of STUDENTS) {
    const student = upsertUser({ email: spec.email, displayName: spec.displayName, role: 'student' });

    // Only seed history for a student who has none — re-running must not
    // duplicate a student's drafts.
    const already = col('submissions').list((s) => s.studentId === student.id).length > 0;
    const hasSession = col('sessions').list((s) => s.studentId === student.id).length > 0;
    if (already || hasSession) continue;

    const pastDrafts = spec.pastDrafts === undefined ? ASSIGNMENTS.past.draftBudget : spec.pastDrafts;
    let lastSubmission = null;
    for (let cycle = 0; cycle < pastDrafts; cycle++) {
      lastSubmission = seedCycle({
        student,
        assignment: pastAssignment,
        tier: spec.tier,
        cycleIndex: cycle,
        // 34, 26, 18 days ago for a three-draft arc.
        daysAgo: 34 - cycle * 8,
      });
    }

    if (lastSubmission && TEACHER_NOTES[spec.email]) {
      col('submissions').update(lastSubmission.id, {
        teacherNote: TEACHER_NOTES[spec.email],
        teacherNoteAt: ts(16),
      });
    }

    let lastOpenSubmission = null;
    for (let cycle = 0; cycle < spec.openAssignmentDrafts; cycle++) {
      lastOpenSubmission = seedCycle({
        student,
        assignment: openAssignment,
        tier: spec.tier,
        cycleIndex: cycle,
        daysAgo: 6 - cycle * 3,
      });
    }

    if (lastOpenSubmission && OPEN_TEACHER_NOTES[spec.email]) {
      col('submissions').update(lastOpenSubmission.id, {
        teacherNote: OPEN_TEACHER_NOTES[spec.email],
        teacherNoteAt: ts(2),
      });
    }

    // The demo class otherwise only ever shows "submitted, scored" and "not
    // started" — every other draft-row state needs at least one student who
    // actually lands in it.
    if (spec.email === 'maya@school.dev') {
      // Draft 2 (her current cycle) has real activity but nothing sent in
      // yet — the row reads "In progress" with a Continue button, not a
      // status inherited from draft 1.
      seedActiveDraft({
        student, assignment: openAssignment, tier: spec.tier, cycleIndex: 1, daysAgo: 1,
      });
    }
    if (spec.email === 'priya@school.dev') {
      seedIncompleteCycle({
        student, assignment: openAssignment, tier: spec.tier, cycleIndex: 0, daysAgo: 0.1, status: 'pending',
      });
    }
    if (spec.email === 'luis@school.dev') {
      seedIncompleteCycle({
        student, assignment: openAssignment, tier: spec.tier, cycleIndex: 0, daysAgo: 1, status: 'error',
        error: 'Groq 500: internal_server_error',
      });
    }
  }

  // One-off real transcript (bicycle maintenance guide, document co-creation
  // rather than a Socratic coach cycle) — kept outside the tier loop above
  // since it doesn't fit the open/past assignment shape.
  const guideAssignment = upsertAssignment(teacher.id, GUIDE_ASSIGNMENT, 5);
  const guideStudent = upsertUser({ email: 'jamie@school.dev', displayName: 'Jamie Okafor', role: 'student' });
  if (col('submissions').list((s) => s.studentId === guideStudent.id).length === 0) {
    seedCycle({ student: guideStudent, assignment: guideAssignment, tier: 'bikeguide', cycleIndex: 0, daysAgo: 3 });
  }

  // Users left over from earlier hand-testing predate passwords. Give them the
  // dev password too rather than stranding them out of their own data.
  for (const u of col('users').list((u) => !u.passwordHash)) setPassword(u, DEV_PASSWORD);
}

module.exports = { seed };
