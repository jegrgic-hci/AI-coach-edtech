// One-off: give already-seeded demo analyses the `reading` field the report
// now renders. The seed is idempotent by student — it skips anyone who already
// has submissions — so re-running it will not add the field to rows created
// before readSession() existed, and wiping a shared dev store to get it is a
// worse trade than a patch.
//
// Demo store only. It refuses to touch an analysis that already has a reading,
// and it will not run against a project that isn't the dev sandbox.
//
//   node app/server/backfill-readings.js            (dry run)
//   node app/server/backfill-readings.js --write
const { col } = require('./store');
const { READINGS, TRANSCRIPTS, PROVENANCE } = require('./seed-data');

// Phrase → origin turn, taken from the seed's own provenance so the two can
// never disagree.
const TURN_BY_PHRASE = {};
for (const tier of Object.keys(PROVENANCE))
  for (const cycle of PROVENANCE[tier])
    for (const item of cycle) if (item.turn) TURN_BY_PHRASE[item.phrase] = item.turn;

// Which tier an analysis belongs to, recovered from its own stored transcript
// rather than from a student→tier table that would drift out of step with the
// seed. The first student turn is unique per tier.
function tierOf(classified) {
  const first = (classified || []).find((t) => t.role === 'student');
  if (!first) return null;
  const text = (first.text || '').slice(0, 60);
  for (const tier of Object.keys(TRANSCRIPTS)) {
    for (const session of TRANSCRIPTS[tier]) {
      const seedFirst = session.turns.find((t) => t.role === 'student');
      if (seedFirst && seedFirst.text.slice(0, 60) === text) return tier;
    }
  }
  return null;
}

async function main() {
  const write = process.argv.includes('--write');
  const analyses = await col('analyses').list({});

  let patched = 0, already = 0, unmatched = 0, incomplete = 0;

  for (const a of analyses) {
    if (a.status !== 'complete') { incomplete++; continue; }
    const needsTurns = (a.provenance || []).some((c) => !c.turn && TURN_BY_PHRASE[c.phrase]);
    if (a.reading && !needsTurns) { already++; continue; }

    const tier = tierOf(a.classified);
    if (!tier || !READINGS[tier]) { unmatched++; continue; }

    patched++;
    const provenance = (a.provenance || []).map((c) =>
      c.turn || !TURN_BY_PHRASE[c.phrase] ? c : { ...c, turn: TURN_BY_PHRASE[c.phrase] });
    if (write) await col('analyses').update(a.id, { reading: READINGS[tier], provenance });
  }

  console.log(`analyses: ${analyses.length} total`);
  console.log(`  ${already} already had a reading`);
  console.log(`  ${incomplete} not complete (left alone)`);
  console.log(`  ${unmatched} no tier match (left alone)`);
  console.log(write ? `  ${patched} patched` : `  ${patched} would be patched — dry run, pass --write`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
