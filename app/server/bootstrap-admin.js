// Creates the first platform-admin on an empty store, so a real instance has
// someone who can sign in and add the first school's teachers.
//
// This exists because the demo seed is the only thing that ever created an
// admin account, and it is now opt-in and refuses to run in production (see
// seed.js). A fresh production store therefore has no users at all, and every
// route that could create one requires an authenticated platform-admin — a
// closed loop that only a CLI outside the request path can open.
//
// Deliberately not an HTTP route: a "create the first admin if none exists"
// endpoint is a public privilege-escalation route for the entire window between
// deploy and first use.
//
// Run against prod:
//   GCP_PROJECT_ID=tau-thinking-prod node app/server/bootstrap-admin.js you@example.com "Your Name"
//
// The password is generated, printed once, and never stored in plaintext —
// change it after first sign-in. Idempotent per email: re-running on an
// existing account resets that account's password rather than duplicating it,
// which also makes this the lockout recovery path.

const crypto = require('crypto');
const { col } = require('./store');
const { setPassword } = require('./auth');

// chosenPassword is optional and exists for first-run setup, where the operator
// wants a credential they can hand over immediately rather than one they have
// to copy out of terminal output. Anything passed here lands in shell history,
// so the generated path stays the default and is what the lockout-recovery use
// should keep using.
async function bootstrapAdmin(email, displayName, chosenPassword) {
  const password = chosenPassword || crypto.randomBytes(12).toString('base64url');

  // Not an equality query on purpose: the store holds emails as entered, and a
  // case variant of an existing admin must collide rather than create a second
  // account that can never be told apart in the accounts list.
  const existing = (await col('users').list((u) => String(u.email).toLowerCase() === email))[0];

  if (existing) {
    const user = await col('users').update(existing.id, {
      role: 'platform-admin',
      status: 'active',
    });
    await setPassword(user, password);
    return { password, created: false, chosen: Boolean(chosenPassword) };
  }

  const user = await col('users').add({
    email,
    displayName,
    role: 'platform-admin',
    schoolAdmin: false,
    status: 'active',
    createdAt: new Date().toISOString(),
  });
  await setPassword(user, password);
  return { password, created: true, chosen: Boolean(chosenPassword) };
}

module.exports = { bootstrapAdmin };

if (require.main === module) {
  const email = String(process.argv[2] || '').trim().toLowerCase();
  const displayName = String(process.argv[3] || '').trim();
  const chosenPassword = String(process.argv[4] || '') || undefined;

  if (!email.includes('@') || !displayName) {
    console.error('usage: node app/server/bootstrap-admin.js <email> "<display name>" [password]');
    process.exit(1);
  }

  bootstrapAdmin(email, displayName, chosenPassword)
    .then(({ password, created, chosen }) => {
      console.log(`${created ? 'Created' : 'Reset'} platform-admin ${email}`);
      console.log(chosen ? 'Password: the one supplied on the command line' : `Password (shown once): ${password}`);
      process.exit(0);
    })
    .catch((err) => {
      console.error('bootstrap failed:', err);
      process.exit(1);
    });
}
