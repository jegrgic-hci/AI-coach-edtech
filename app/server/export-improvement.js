// Export the work a school has agreed may improve the measurement.
//
//   node app/server/export-improvement.js                 # report only, writes nothing
//   node app/server/export-improvement.js --write out.json
//   node app/server/export-improvement.js --allow-demo    # override the fixture guard
//
// What consents: a CLASS, via the `improvement` stamp a teacher sets (see
// POST /api/classes/:id/edit). The stamp carries a date because the date is
// the whole point — work made before anyone agreed is not covered by the
// agreement, so this exports from `grantedAt` forward and never the back
// catalogue. Revoking clears the stamp and the class stops appearing here;
// nothing already exported is recalled, which is why the consent copy says so.
//
// Two rules make the output safe to hold, and they are independent:
//
//   1. NO IDENTITY LEAVES. Not a name, not an email, not a username, not a
//      user id — every actor becomes a per-export pseudonym. Pseudonyms are
//      regenerated each run, so two exports cannot be joined to each other,
//      and nothing in the file maps back to a person without the store.
//      Code-roster students are already anonymous in the product; this is what
//      makes a NAMED student's work equally safe to export, and it is the
//      reason there is no rule excluding one kind of roster from this file.
//
//   2. WHAT THE STUDENT TYPED IS SCANNED. After rule 1 the only channel a
//      person can arrive through is the prose itself — a pasted .docx header,
//      an address in a chat turn. Every free-text field goes through pii.js on
//      the way out. That scanner finds self-identification, not names; read
//      its header for what it deliberately cannot catch.
//
// The store is never modified. Turns are an append-only integrity record and
// redaction happens on the copy — the artifact an analysis was computed from
// has to stay exactly what it was.

const fs = require('fs');
const { col } = require('./store');
const { config } = require('./school');
const { redactSelfIdentification } = require('./pii');

// Demo classes carry authored transcripts. Exporting them would put fabricated
// sessions into the corpus the measurement is calibrated on — the one thing
// tau-dimensions.md says never to do — and they would be indistinguishable
// from real work once the names are gone.
const DEMO_PROJECT = 'cta-pilot-dev';

function pseudonymiser(prefix) {
  const map = new Map();
  return (id) => {
    if (!id) return null;
    if (!map.has(id)) map.set(id, `${prefix}_${map.size + 1}`);
    return map.get(id);
  };
}

// Every free-text field leaves through here, and every redaction is counted so
// the run can report how much it caught rather than silently cleaning up.
function makeScrubber(tally) {
  return (text) => {
    const { text: clean, hits } = redactSelfIdentification(text);
    for (const h of hits) tally[h.kind] = (tally[h.kind] || 0) + 1;
    return clean;
  };
}

async function main() {
  const argv = process.argv.slice(2);
  const outPath = argv.includes('--write') ? argv[argv.indexOf('--write') + 1] : null;
  const allowDemo = argv.includes('--allow-demo');

  if (argv.includes('--write') && !outPath) {
    console.error('--write needs a path: --write improvement-export.json');
    process.exit(1);
  }

  const projectId = config().gcp?.projectId || '(unset)';
  if (projectId === DEMO_PROJECT && !allowDemo) {
    console.error(`refusing to export from ${projectId} — that project holds the demo seed, whose`);
    console.error('transcripts are authored fixtures. Pass --allow-demo only to exercise this script.');
    process.exit(1);
  }
  console.log(`project: ${projectId}${allowDemo ? '  (--allow-demo)' : ''}`);

  const classes = (await col('classes').list()).filter((c) => c.improvement?.grantedAt);
  if (!classes.length) {
    console.log('\nno class has been marked as contributing to measurement improvement — nothing to export.');
    return;
  }

  const [allAssignments, allSessions, allConversations, allTurns, allSubmissions, allAnalyses] =
    await Promise.all([
      col('assignments').list(), col('sessions').list(), col('conversations').list(),
      col('turns').list(), col('submissions').list(), col('analyses').list(),
    ]);

  const asRef = pseudonymiser('cls');
  const stuRef = pseudonymiser('stu');
  const asgRef = pseudonymiser('asg');
  const tally = {};
  const scrub = makeScrubber(tally);

  const turnsByConversation = new Map();
  for (const t of allTurns) {
    if (!turnsByConversation.has(t.conversationId)) turnsByConversation.set(t.conversationId, []);
    turnsByConversation.get(t.conversationId).push(t);
  }
  const analysisById = new Map(allAnalyses.map((a) => [a.id, a]));

  const out = { contract: 'improvement-v1', exportedAt: new Date().toISOString(), classes: [] };
  let submissionCount = 0, turnCount = 0, beforeGrant = 0;

  for (const cls of classes) {
    const grantedAt = cls.improvement.grantedAt;
    const studentIds = new Set(cls.studentIds || []);
    // Assignments this class was actually given. The task text is exported in
    // full and unpseudonymised — it is the teacher's own writing about the
    // work, not about a person, and tau-dimensions.md requires reading a
    // transcript against the assignment it was set from.
    const assignments = allAssignments.filter((a) => (a.classIds || []).includes(cls.id));

    const record = {
      ref: asRef(cls.id),
      grantedAt,
      assignments: assignments.map((a) => ({
        ref: asgRef(a.id),
        title: scrub(a.title),
        description: scrub(a.description),
        purpose: scrub(a.purpose),
        requirements: scrub(a.requirements),
        draftBudget: a.draftBudget || 1,
      })),
      students: [],
    };

    for (const studentId of studentIds) {
      const submissions = allSubmissions
        .filter((s) => s.studentId === studentId && assignments.some((a) => a.id === s.assignmentId))
        .sort((a, b) => String(a.submittedAt).localeCompare(String(b.submittedAt)));

      const drafts = [];
      for (const sub of submissions) {
        // The consent has a date and this is where it is enforced. Work made
        // before the teacher agreed is outside what they agreed to.
        if (String(sub.submittedAt) < grantedAt) { beforeGrant++; continue; }

        const conversations = allConversations.filter((c) => c.sessionId === sub.sessionId);
        const transcript = [];
        for (const conv of conversations) {
          for (const t of (turnsByConversation.get(conv.id) || []).sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)))) {
            transcript.push({ role: t.role, text: scrub(t.text), at: t.createdAt });
            turnCount++;
          }
        }

        const analysis = analysisById.get(sub.analysisId);
        drafts.push({
          assignmentRef: asgRef(sub.assignmentId),
          cycleIndex: sub.cycleIndex,
          submittedAt: sub.submittedAt,
          essay: scrub(sub.essayText),
          transcript,
          // The reading the tool produced, so an export can be checked against
          // what the shipped code said at the time rather than only re-coded
          // from scratch. `classified` is the per-turn labelling the dimensions
          // are computed from.
          analysis: analysis && analysis.status === 'complete'
            ? { classified: analysis.classified || null, patterns: analysis.patterns || [], version: analysis.analysisVersion || null }
            : null,
        });
        submissionCount++;
      }

      if (drafts.length) record.students.push({ ref: stuRef(studentId), drafts });
    }

    out.classes.push(record);
  }

  console.log(`\nclasses consenting: ${classes.length}`);
  console.log(`students with covered work: ${out.classes.reduce((n, c) => n + c.students.length, 0)}`);
  console.log(`drafts: ${submissionCount}   turns: ${turnCount}`);
  if (beforeGrant) console.log(`${beforeGrant} draft(s) skipped — submitted before their class's grant date`);

  const redactions = Object.entries(tally);
  console.log(redactions.length
    ? `\nredactions: ${redactions.map(([k, n]) => `${k} ${n}`).join(', ')}`
    : '\nredactions: none — no self-identification found in any exported text');

  // Named without a count attached to it: this is a limitation of the scanner,
  // not a measurement of what it missed, and printing it every run keeps it
  // from being forgotten between exports.
  console.log('a name written in running prose ("Sam walked home") is not detectable and is not caught here.');

  if (!outPath) {
    console.log('\ndry run — nothing written (pass --write <path>)');
    return;
  }
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
  console.log(`\nwrote ${outPath}`);
}

main().then(() => process.exit(0)).catch((err) => {
  console.error(err);
  process.exit(1);
});
