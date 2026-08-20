// One-time stamp for analyses written before ANALYSIS_VERSION existed.
//
// WHY THIS IS NOT JUST "RE-RUN EVERYTHING": the stamp records which reading
// produced a stored analysis, and almost every analysis in the dev store was
// already produced by the current one — it simply predates the field that says
// so. Without this, every seeded demo report would offer to re-read a draft
// that is perfectly current, which is a worse failure than the silent blank it
// replaces: 47 records in cta-pilot-dev on 2026-08-21, against 6 genuinely old.
//
// THE FIELD CHECK IS LEGITIMATE HERE AND NOWHERE ELSE. `reading` present means
// the record holds version-1 content, so the migration can infer what the
// stamp would have said. The live check in analysis.js must stay a stamp
// comparison — inferring at read time is what makes the next rebuild invisible
// all over again.
//
// Records with no `reading` are left alone deliberately. They are the ones the
// report should offer to re-read, and stamping them would hide exactly the
// case this whole change exists to surface.
//
// Idempotent: a stamped record is skipped, so re-running is a no-op. Writes
// nothing without --apply.
//
//   node app/server/backfill-analysis-version.js           # dry run
//   node app/server/backfill-analysis-version.js --apply

const { col } = require('./store');
const { ANALYSIS_VERSION } = require('./analysis');

const APPLY = process.argv.includes('--apply');

(async () => {
  const all = await col('analyses').list({});
  const stamped = [];
  const leftStale = [];
  const skipped = [];

  for (const a of all) {
    if (a.status !== 'complete') { skipped.push(a); continue; }
    if ((a.version || 0) >= ANALYSIS_VERSION) { skipped.push(a); continue; }
    if (a.reading) stamped.push(a);
    else leftStale.push(a);
  }

  console.log(`analyses: ${all.length}`);
  console.log(`  to stamp version=${ANALYSIS_VERSION}: ${stamped.length} (complete, has a reading)`);
  console.log(`  left unstamped:                      ${leftStale.length} (complete, no reading — these should offer a re-read)`);
  console.log(`  skipped:                             ${skipped.length} (pending, error, or already stamped)`);

  for (const a of leftStale) console.log(`    stale: ${a.id}  submission=${a.submissionId}  created=${a.createdAt}`);

  if (!APPLY) {
    console.log('\nDry run — nothing written. Re-run with --apply.');
    return;
  }

  for (const a of stamped) await col('analyses').update(a.id, { version: ANALYSIS_VERSION });
  console.log(`\nStamped ${stamped.length} analyses.`);
})().catch((err) => { console.error(err); process.exit(1); });
