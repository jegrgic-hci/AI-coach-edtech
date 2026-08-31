// The one real session we have, served to any signed-in teacher as a worked
// example of a reading.
//
// IN MEMORY, NEVER IN A DATABASE. It is built here the same way seed.js builds
// a cycle — the hand-labelled transcript through the real enrich()/scoreTAU(),
// plus the authored reading — but nothing is written: no fabricated student
// lands on anyone's roster, no fixture record appears in a school's Firestore,
// and prod behaves identically to dev without being seeded. The routes that
// serve it are read-only by construction: there is nothing here to write back
// to.
//
// A source, not a fixture: 44 student turns from a rider co-writing a bicycle
// maintenance guide with Claude.ai. Student turns are verbatim or near-verbatim
// from the source PDF; the AI's are paraphrased for length, which is why the
// report says so above the transcript rather than presenting it as a log.
//
// It is not school work — no coach persona, one draft, no revision — so it
// teaches how to read a reading and nothing about the draft-to-draft flow. The
// card that opens it says that too.

const { enrich, scoreTAU, detectPatterns, ANALYSIS_VERSION } = require('./analysis');
const { TRANSCRIPTS, ESSAYS, PROVENANCE, FLAGS, SNAPSHOTS, READINGS, GUIDE_ASSIGNMENT } = require('./seed-data');

const TIER = 'bikeguide';
// Fixed, and deliberately not a uuid: it goes in a link a teacher can be given
// and it must mean the same thing in every environment.
const SAMPLE_ID = 'sample-bikeguide';

let cached = null;

function build() {
  const transcript = TRANSCRIPTS[TIER][0];

  const labelMap = {};
  const aiLabelMap = {};
  let studentIdx = 0;
  const base = Date.parse('2026-05-04T09:00:00.000Z');
  const turns = transcript.turns.map((turn, i) => {
    if (turn.role === 'student') labelMap[studentIdx++] = { label: turn.label };
    return {
      id: `${SAMPLE_ID}-turn-${i}`,
      conversationId: `${SAMPLE_ID}-conv`,
      role: turn.role,
      text: turn.text,
      // A fixed date, not one relative to now(): a sample that says "submitted
      // 3 days ago" on every visit is claiming a recency it does not have.
      createdAt: new Date(base + i * 4 * 60000).toISOString(),
      meta: {},
    };
  });
  for (const [i, turn] of transcript.turns.entries()) {
    if (turn.role !== 'student' && turn.label) aiLabelMap[turns[i].id] = turn.label;
  }

  const conversation = {
    id: `${SAMPLE_ID}-conv`,
    sessionId: `${SAMPLE_ID}-session`,
    title: transcript.title,
    createdAt: turns[0].createdAt,
    lastActiveAt: turns[turns.length - 1].createdAt,
    locked: true,
  };

  const classified = enrich([{ conversation, turns }], labelMap, aiLabelMap);
  const provenance = PROVENANCE[TIER][0];

  const analysis = {
    id: `${SAMPLE_ID}-analysis`,
    submissionId: SAMPLE_ID,
    status: 'complete',
    version: ANALYSIS_VERSION,
    createdAt: conversation.lastActiveAt,
    completedAt: conversation.lastActiveAt,
    reading: READINGS[TIER],
    tau: scoreTAU(classified, provenance),
    provenance,
    flags: FLAGS[TIER],
    snapshot: SNAPSHOTS[TIER][0],
    classified,
    patterns: detectPatterns(classified),
    eventCounts: {},
  };

  const submission = {
    id: SAMPLE_ID,
    sessionId: conversation.sessionId,
    assignmentId: `${SAMPLE_ID}-assignment`,
    assignmentTitle: GUIDE_ASSIGNMENT.title,
    cycleIndex: 0,
    submittedAt: conversation.lastActiveAt,
    essayText: ESSAYS[TIER][0],
    teacherNote: null,
    analysisId: analysis.id,
  };

  return { submission, analysis, conversations: [{ ...conversation, turns }] };
}

// Memoized: the build is pure and deterministic, so it is done once per
// process rather than on every teacher who opens it.
function sample() {
  if (!cached) cached = build();
  return cached;
}

module.exports = { SAMPLE_ID, sample };
