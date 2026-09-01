// Sets (or clears) `canGrantPilot` on a school administrator's account.
//
// The grant that lets a school administrator mark the teachers they add as
// Pilot users — the one grant of the three that is delegable, because a Pilot
// user accepts the Pilot Agreement themselves and nobody is consenting on their
// behalf (see canGrantPilot in index.js).
//
// A CLI rather than a checkbox in the admin UI. There is exactly one person who
// needs it, and a control for handing out the ability to hand out a grant earns
// its place in a product only once the second person asks — until then it is a
// permission surface with no users. If a third administrator needs it, this is
// the moment to build the checkbox instead of running this again.
//
// Refuses an account that is not a school administrator: the grant does nothing
// on a plain teacher (they never reach /api/admin/*), so setting it there is
// always a typo in the email rather than an intention.
//
//   node app/server/grant-pilot-granter.js a@school.dev b@school.dev
//   node app/server/grant-pilot-granter.js --write a@school.dev b@school.dev
//   node app/server/grant-pilot-granter.js --revoke --write a@school.dev
//
// Against production:
//   GCP_PROJECT_ID=tau-thinking-prod node app/server/grant-pilot-granter.js --write a@school.dev
const { col } = require('./store');

async function main() {
  const write = process.argv.includes('--write');
  const revoke = process.argv.includes('--revoke');
  const value = !revoke;
  const emails = process.argv.slice(2)
    .filter((a) => !a.startsWith('--'))
    .map((a) => a.trim().toLowerCase());

  if (!emails.length) {
    console.log('usage: node app/server/grant-pilot-granter.js [--revoke] [--write] <email> [email...]');
    process.exit(1);
  }

  const users = await col('users').list({});

  for (const email of emails) {
    // Guarded on `u.email` and compared lowercased: a code-roster account has
    // no address at all, and an unguarded read throws on the first one reached.
    const found = users.filter((u) => u.email && u.email.toLowerCase() === email);
    if (!found.length) {
      console.log(`${email}: NO SUCH ACCOUNT — skipped`);
      continue;
    }
    for (const u of found) {
      const isAdmin = u.role === 'platform-admin' || u.schoolAdmin === true;
      if (!isAdmin) {
        console.log(`${email}: not an administrator (role=${u.role}, schoolAdmin=false) — refusing`);
        continue;
      }
      if (u.role === 'platform-admin') {
        console.log(`${email}: platform-admin already sets this grant — nothing to do`);
        continue;
      }
      if ((u.canGrantPilot === true) === value) {
        console.log(`${email}: canGrantPilot already ${value}`);
        continue;
      }
      console.log(`${email}: canGrantPilot ${u.canGrantPilot === true} -> ${value}`);
      if (write) await col('users').update(u.id, { canGrantPilot: value });
    }
  }

  const after = (await col('users').list({})).filter((u) => u.canGrantPilot === true);
  console.log('\naccounts that may mark a teacher as a Pilot user (besides platform admins):');
  if (!after.length) console.log('  (none)');
  for (const u of after) console.log(`  ${u.email}  schoolAdmin=${u.schoolAdmin === true}`);

  console.log(write ? '\nwritten' : '\ndry run — pass --write to apply');
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
