// Auth seam. Dev: every request is the seeded dev student (or dev teacher via
// X-Dev-Role: teacher). Prod: swap for Firebase Auth — verify the Bearer ID
// token, check the school domain, look up/create the user doc.

const { col } = require('./store');

function authenticate(req) {
  const role = req.headers['x-dev-role'] === 'teacher' ? 'teacher' : 'student';
  const user = col('users').list((u) => u.role === role)[0];
  if (!user) throw new Error('store not seeded — run seed.js');
  return user;
}

module.exports = { authenticate };
