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
//
// --refresh (added 2026-08-22) inverts the "already has a reading" guard and
// rewrites every matched analysis from the CURRENT seed READINGS. The copy in
// seed-data.js is edited far more often than the store is reseeded, and the
// seed's own guard is by student — once someone has submissions, seedCycle
// never runs again, so a store populated months ago keeps serving whatever the
// wording was on the day it was written. This is the alternative to wiping the
// demo cycles to pick up a copy change, and it leaves turns, submissions, tau,
// flags and patterns untouched.
//
//   node app/server/backfill-readings.js --refresh          (dry run)
//   node app/server/backfill-readings.js --refresh --write
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
  const refresh = process.argv.includes('--refresh');
  const analyses = await col('analyses').list({});

  let patched = 0, already = 0, unmatched = 0, incomplete = 0;

  for (const a of analyses) {
    if (a.status !== 'complete') { incomplete++; continue; }
    const needsTurns = (a.provenance || []).some((c) => !c.turn && TURN_BY_PHRASE[c.phrase]);
    if (a.reading && !needsTurns && !refresh) { already++; continue; }

    const tier = tierOf(a.classified);
    if (!tier || !READINGS[tier]) { unmatched++; continue; }

    patched++;
    const provenance = (a.provenance || []).map((c) =>
      c.turn || !TURN_BY_PHRASE[c.phrase] ? c : { ...c, turn: TURN_BY_PHRASE[c.phrase] });
    if (write) await col('analyses').update(a.id, { reading: READINGS[tier], provenance });
  }

  console.log(`analyses: ${analyses.length} total${refresh ? '  (--refresh: rewriting readings from current seed copy)' : ''}`);
  if (!refresh) console.log(`  ${already} already had a reading`);
  console.log(`  ${incomplete} not complete (left alone)`);
  console.log(`  ${unmatched} no tier match (left alone)`);
  console.log(write ? `  ${patched} ${refresh ? 'refreshed' : 'patched'}` : `  ${patched} would be ${refresh ? 'refreshed' : 'patched'} — dry run, pass --write`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
