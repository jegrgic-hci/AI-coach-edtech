// Backfill `patterns` onto analyses that completed before detection moved
// server-side (2026-08-14). Pure recomputation from the stored `classified`
// turns — no LLM call, no cost, and safe to re-run.
//
// It also does a second job, and that one is arguably the point. patterns.md
// lists a "label volume check" as backlog #1, blocking every threshold in the
// file, and describes it as gated on real transcripts. The check is a count of
// which labels actually occur — so running the detectors over every analysis
// already in the database IS that check, at whatever corpus size exists today.
// The summary below is what it prints.
//
//   node app/server/backfill-patterns.js            # report only, writes nothing
//   node app/server/backfill-patterns.js --write    # write patterns onto docs
//
// Read the summary against tau-dimensions.md's "Do not validate against seed
// data": counts from cta-pilot-dev are counts over authored transcripts and
// set no threshold. Only a run against real submissions means anything.

const { col } = require('./store');
const { detectPatterns } = require('./analysis');

const LABELS = ['claim', 'conceptual', 'extraction', 'validation', 'stuck',
  'feedback', 'narrative', 'rejection', 'refinement', 'challenge', 'pivot'];

async function main() {
  const write = process.argv.includes('--write');
  const analyses = await col('analyses').list({});

  const labelCounts = {};
  const patternCounts = {};
  let considered = 0, written = 0, skipped = 0, noTurns = 0;

  for (const a of analyses) {
    if (a.status !== 'complete' || !Array.isArray(a.classified)) { skipped++; continue; }
    considered++;

    const student = a.classified.filter((t) => t.role === 'student');
    if (!student.length) noTurns++;
    for (const t of student) {
      const l = t.label || '(none)';
      labelCounts[l] = (labelCounts[l] || 0) + 1;
    }

    const patterns = detectPatterns(a.classified);
    for (const p of patterns) patternCounts[p.id] = (patternCounts[p.id] || 0) + 1;

    if (write) {
      await col('analyses').update(a.id, { patterns });
      written++;
    }
  }

  console.log(`\nanalyses: ${analyses.length} total, ${considered} with turns, ${skipped} skipped (incomplete or no classified)`);
  if (noTurns) console.log(`${noTurns} complete analyses have zero student turns`);
  console.log(write ? `${written} updated` : 'dry run — nothing written (pass --write)');

  console.log('\nlabel volume (patterns.md backlog #1):');
  // Zero-volume labels are printed explicitly. A label that never occurs is
  // the finding — a detector keyed to it cannot fire whatever its threshold,
  // and an absent row would read as an oversight rather than a result.
  for (const l of LABELS) console.log(`  ${l.padEnd(12)} ${labelCounts[l] || 0}`);
  for (const l of Object.keys(labelCounts)) {
    if (!LABELS.includes(l)) console.log(`  ${l.padEnd(12)} ${labelCounts[l]}  (not in the label set)`);
  }

  console.log('\npattern volume (occurrences across all analyses):');
  const ids = Object.keys(patternCounts).sort((x, y) => patternCounts[y] - patternCounts[x]);
  if (!ids.length) console.log('  none detected');
  for (const id of ids) console.log(`  ${id.padEnd(24)} ${patternCounts[id]}`);
  console.log('');
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
