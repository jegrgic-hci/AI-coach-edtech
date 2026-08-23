// One-off: take the admin grants off the seeded demo accounts, 2026-08-23.
// The seed no longer creates either (seed.js), but a store seeded before today
// still holds them, and `upsertUser` only rewrites accounts the seed still
// names — so `admin@school.dev` would otherwise sit there indefinitely.
//
//   admin@school.dev    (platform-admin)  -> deleted
//   teacher@school.dev  (schoolAdmin)     -> schoolAdmin: false
//
// WHY THIS IS URGENT WHEREVER A REAL TEACHER SHARES THE PROJECT. The demo
// password is published in this repo. `canAdminPeople` (platform-admin OR
// schoolAdmin) opens every /api/admin/* route, and two of them compose into an
// account takeover: `teachers/:id/edit` sets any teacher's email address, and
// `teachers/:id/send-reset` then mails a recovery link to that address. Both
// seeded accounts could do it to any real teacher in the same store.
//
// Deleting rather than suspending is safe for `admin@school.dev` specifically:
// it owns no class and no assignment, and `recordAdminEvent` copies actor names
// into each event rather than joining at read time, so its audit trail survives
// the account. Do NOT reuse this script's delete on an account that owns work —
// index.js is deliberate that a teacher is suspended, never deleted.
//
//   node app/server/revoke-seeded-admin.js            (dry run)
//   node app/server/revoke-seeded-admin.js --write
const { col } = require('./store');

async function main() {
  const write = process.argv.includes('--write');
  const users = await col('users').list({});

  const admin = users.find((u) => u.email === 'admin@school.dev');
  if (!admin) {
    console.log('admin@school.dev: absent already');
  } else {
    const classes = await col('classes').list({ teacherId: admin.id });
    const assignments = await col('assignments').list({ teacherId: admin.id });
    if (classes.length || assignments.length) {
      console.log(`admin@school.dev: OWNS WORK (${classes.length} classes, ${assignments.length} assignments) — refusing to delete`);
    } else {
      console.log(`admin@school.dev: delete (role=${admin.role}, owns nothing)`);
      if (write) await col('users').delete(admin.id);
    }
  }

  const teacher = users.find((u) => u.email === 'teacher@school.dev');
  if (!teacher) console.log('teacher@school.dev: absent');
  else if (teacher.schoolAdmin !== true) console.log('teacher@school.dev: schoolAdmin already off');
  else {
    console.log('teacher@school.dev: schoolAdmin true -> false');
    if (write) await col('users').update(teacher.id, { schoolAdmin: false });
  }

  const after = (await col('users').list({}))
    .filter((u) => u.role === 'platform-admin' || u.schoolAdmin === true);
  console.log('\naccounts still passing canAdminPeople:');
  for (const u of after) console.log(`  ${u.email}  role=${u.role}  schoolAdmin=${u.schoolAdmin === true}`);
  if (!after.some((u) => u.role === 'platform-admin')) {
    console.log('  WARNING: no platform-admin left — bootstrap-admin.js creates one.');
  }

  console.log(write ? '\nwritten' : '\ndry run — pass --write to apply');
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
