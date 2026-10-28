// Builds a demo workshop room against a running server, through the same HTTP
// routes a facilitator and their guests use — nothing is written to the store
// directly, so the room is exactly what a real one would be, analysis and all.
//
//   node app/server/workshop-demo.js <facilitator-email> <password> [base-url]
//
// Workshops expire after a week and are purged, so this is how one comes back.
// The guests are scripted: a visual fixture for reviewing the workshop pages,
// never data to tune a pattern threshold on (workshop.md, tau-dimensions.md).

const [email, password, base = 'http://localhost:8787'] = process.argv.slice(2);

const GUESTS = [
  { name: 'Ana', turns: [
    'Should schools ban phones in class?',
    'Ok, what are the main reasons for a ban?',
    'Can you write me a paragraph arguing for the ban?',
    'Thanks, that works.',
  ] },
  { name: 'Ben', turns: [
    'Should schools ban phones in class? I think they should not.',
    'You said phones are mostly a distraction. I disagree, half my class uses them to look things up.',
    'How do you know test scores went up because of the bans and not something else?',
    'Argue the other side as strongly as you can.',
    'That last point about emergencies is weak. Parents can call the front office.',
  ] },
  { name: 'Chloe', turns: [
    'Should schools ban phones in class?',
    'I pick the ban side.',
    'I disagree with what you said about phones being needed for safety.',
    'Ok fair, you are right.',
    'Yes, I agree with all of that.',
  ] },
  { name: 'Dev', turns: [
    'My view: a full ban is lazy. Teachers should set phone-free times instead.',
    'What would a phone-free time policy look like in a real school?',
    'Refine that so it works for a teacher who only sees the class twice a week.',
    'Switching angle: what about students who need their phone for medical apps?',
  ] },
  { name: 'Elif', turns: [
    'Should schools ban phones in class?',
    'I am not sure what to think.',
    'Just tell me which side is right.',
    'I don\'t know, can you decide for me?',
  ] },
];

function cookieFrom(res) {
  const set = res.headers.get('set-cookie');
  return set ? set.split(';')[0] : null;
}

async function call(cookie, path, body) {
  const res = await fetch(base + path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${path} → ${res.status} ${text.slice(0, 200)}`);
  return { res, text, json: () => JSON.parse(text) };
}

async function runGuest(code, guest) {
  const joined = await call(null, '/api/join', { name: guest.name, code });
  const cookie = cookieFrom(joined.res);
  const assignmentId = new URL(joined.json().next, base).searchParams.get('open');
  const { session } = (await call(cookie, `/api/assignments/${assignmentId}/open`, null)).json();
  const conv = (await call(cookie, '/api/conversations', { sessionId: session.id })).json();
  // The message route streams the reply; reading it to the end is the wait.
  for (const text of guest.turns) await call(cookie, `/api/conversations/${conv.id}/message`, { text });
  await call(cookie, `/api/sessions/${session.id}/submit`, { essayText: '' });
  console.log(`  ${guest.name}: ${guest.turns.length} turns, session ended`);
}

(async () => {
  if (!email || !password) throw new Error('usage: node app/server/workshop-demo.js <email> <password> [base-url]');
  const login = await call(null, '/api/auth/login', { email, password });
  const teacher = cookieFrom(login.res);
  const { id } = (await call(teacher, '/api/workshops', { name: 'Demo room — 5 teachers', taskId: 'phones' })).json();
  const { workshops } = (await call(teacher, '/api/workshops')).json();
  const { code } = workshops.find((w) => w.id === id);
  console.log(`Workshop ${id}, code ${code}`);
  // Sequential: five parallel chats would hit Vertex at once for no gain.
  for (const guest of GUESTS) await runGuest(code, guest);
  console.log(`\nFacilitator: ${base}/workshop.html`);
  console.log(`Join screen: ${base}/workshop.html?show=${id}`);
  console.log(`Results:     ${base}/workshop-room.html?id=${id}`);
  console.log('Analysis finishes in the server over the next minute or two.');
})().catch((err) => { console.error(err.message); process.exit(1); });
