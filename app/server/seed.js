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
  DEV_PASSWORD, STUDENTS, ASSIGNMENTS, TRANSCRIPTS,
  ESSAYS, PROVENANCE, FLAGS, SNAPSHOTS, TEACHER_NOTES,
} = require('./seed-data');

const TEACHER_EMAIL = 'teacher@school.dev';

// Backdated so the growth strip has a real time axis instead of everything
// landing in the same second.
const DAY = 86400000;
const ts = (daysAgo) => new Date(Date.now() - daysAgo * DAY).toISOString();

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
  return col('assignments').add({
    teacherId,
    title: spec.title,
    prompt: spec.prompt,
    dueDate: null,
    draftBudget: spec.draftBudget,
    coachingLevels: spec.coachingLevels,
    createdAt: ts(daysAgo),
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

    for (let cycle = 0; cycle < spec.openAssignmentDrafts; cycle++) {
      seedCycle({
        student,
        assignment: openAssignment,
        tier: spec.tier,
        cycleIndex: cycle,
        daysAgo: 6 - cycle * 3,
      });
    }
  }

  // Users left over from earlier hand-testing predate passwords. Give them the
  // dev password too rather than stranding them out of their own data.
  for (const u of col('users').list((u) => !u.passwordHash)) setPassword(u, DEV_PASSWORD);
}

module.exports = { seed };
