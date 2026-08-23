// One-off: rename the stored consent fields from `research` to `improvement`,
// 2026-08-23. The word was a red herring — nothing this flag enables is
// research. `legal.md`'s own heading says it: *service refinement is not
// research*, the line is drawn by intended output, and the output here is
// changes to the tool rather than findings about anyone. Every explanatory
// sentence in the feature already said "improve the measurement"; only the
// field names and a few titles said otherwise.
//
//   users.researchEligible  (bool)   -> users.improvementEligible
//   classes.research        (stamp)  -> classes.improvement
//
// The value is carried across untouched — this is a rename, not a re-consent.
// The class stamp's { grantedAt, grantedBy, grantedByName } is the record of a
// decision a real person made, and rewriting any part of it would forge that.
//
// THIS MUST RUN WHEREVER THE CODE SHIPS. The rename is not backward compatible
// by design (a `?? research` fallback keeps the word alive forever, which is
// the thing being removed), so until it runs, an eligible teacher reads as
// ineligible and a contributing class reads as not contributing. That fails
// closed — nothing is released that wasn't before — but it silently drops a
// grant someone signed an agreement for, so it is not a state to leave sitting.
//
//   node app/server/rename-research-to-improvement.js            (dry run)
//   node app/server/rename-research-to-improvement.js --write
const { col } = require('./store');

async function main() {
  const write = process.argv.includes('--write');

  const users = await col('users').list({});
  const classes = await col('classes').list({});

  const staleUsers = users.filter((u) => u.researchEligible !== undefined);
  const staleClasses = classes.filter((c) => c.research !== undefined);

  console.log(`users:   ${staleUsers.length} carrying researchEligible`);
  for (const u of staleUsers) {
    console.log(`  ${u.email} -> improvementEligible: ${u.researchEligible === true}`);
    if (write) {
      await col('users').update(u.id, {
        improvementEligible: u.researchEligible === true,
        researchEligible: null,
      });
    }
  }

  console.log(`classes: ${staleClasses.length} carrying research`);
  for (const c of staleClasses) {
    console.log(`  "${c.name}" -> improvement: ${c.research ? `stamped ${c.research.grantedAt}` : 'null'}`);
    if (write) {
      await col('classes').update(c.id, {
        improvement: c.research || null,
        research: null,
      });
    }
  }

  console.log(write ? '\nwritten' : '\ndry run — pass --write to apply');
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
