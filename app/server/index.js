// Path B dev server. node:http, SSE for streaming; one dependency
// (firebase-admin, via store.js).
// Prod shape: this becomes the Cloud Run proxy. The llm and store seams are
// already on Vertex and Firestore; auth is the last one still a dev stand-in.

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { col } = require('./store');
const { authenticate, isSuspended, login, logout, sessionCookie, clearedCookie, tokenFrom, inspectCredentialToken, redeemCredentialToken, DEMO_MODE, DEV_PASSWORD } = require('./auth');
const { sendInvite, sendReset } = require('./invites');
const { volume: mailVolume, settings: mailSettings } = require('./mail');
const { streamChat, modelFor, MAX_EVAL_TOKENS } = require('./llm');
const { chatMessages, auditorMessages } = require('./coach');
const { runAnalysis } = require('./analysis');
const { checkChatBudget, grantExtraReplies, usageToday, grantedToday, SOFT_REPLIES_PER_DAY, HARD_INPUT_TOKENS_PER_DAY } = require('./budget');
const { config } = require('./school');
const { seed } = require('./seed');
const { costOf, isPriced } = require('./prices');

const PORT = process.env.PORT || 8787;
const WEB_DIR = path.join(__dirname, '..', 'web');

// ---------- helpers ----------

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => { data += c; });
    req.on('end', () => {
      try { resolve(data ? JSON.parse(data) : {}); } catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

function json(res, status, obj) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(obj));
}

function now() {
  return new Date().toISOString();
}

// Behind Cloud Run the socket address is the load balancer, so the client is
// the first hop in X-Forwarded-For. Only ever used to throttle failed logins —
// a spoofed value costs the spoofer their own throttle bucket, nothing more.
function clientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (fwd) return String(fwd).split(',')[0].trim();
  return req.socket?.remoteAddress || null;
}

// Turns are append-only: an edit or regeneration appends a new turn whose
// meta.supersedes lists the turn ids it replaces. "Live" = not superseded.
function liveTurns(turns) {
  const dead = new Set(turns.flatMap((t) => t.meta?.supersedes || []));
  return turns.filter((t) => !dead.has(t.id));
}

async function conversationTurns(conversationId) {
  return (await col('turns')
    .list((t) => t.conversationId === conversationId))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

async function logEvent(user, { type, sessionId, conversationId, meta }) {
  await col('events').add({
    studentId: user.id,
    sessionId: sessionId || null,
    conversationId: conversationId || null,
    type,
    ts: now(),
    meta: meta || {},
  });
}

// What one teacher is allowed to see: their own classes, the students enrolled
// in them, and their own assignments — nothing else.
//
// Both teacher read routes used to skip this entirely (`col('users').list(u =>
// u.role === 'student')`, `col('classes').list()`), which was invisible while
// the seed created exactly one teacher. It stops being invisible the moment an
// admin can create a second one: teacher B would have read teacher A's whole
// roster, including per-student integrity flags that the design guarantees are
// scoped to the student's own teacher.
async function teacherScope(user) {
  // Three equality queries, not three collection scans, and issued together:
  // teacherId is indexed, and `students` only needs the enrolment filter
  // applied in memory once the role query has come back. The predicate form
  // read every class, user and assignment in the install on every call to
  // build one teacher's rail (see store.js on why that form is a cost
  // decision), serially.
  const [allClasses, allStudents, allAssignments] = await Promise.all([
    col('classes').list({ teacherId: user.id }),
    col('users').list({ role: 'student' }),
    col('assignments').list({ teacherId: user.id }),
  ]);
  // An archived class is a finished term: its records stay readable, it just
  // stops occupying the rail and every rollup. Filtering here rather than at
  // each call site is what stops a student who only ever belonged to that
  // class from lingering in Browse Students after it's put away.
  const classes = allClasses.filter((c) => !c.archived);
  const classIds = classes.map((c) => c.id);
  const active = new Set(classIds);
  const enrolled = new Set(classes.flatMap((c) => c.studentIds || []));
  const students = allStudents.filter((u) => enrolled.has(u.id));
  // An assignment given only to archived classes goes away with them. One with
  // no classIds at all predates classes entirely and stays visible — same
  // fallback the dashboard payload applies below.
  const assignments = allAssignments
    .filter((a) => !a.classIds || !a.classIds.length || a.classIds.some((id) => active.has(id)));
  return { classes, allClasses, classIds, students, assignments };
}

// Being a teacher is not a key to every student — only to your own.
//
// The roster routes have always gone through teacherScope(). The three
// /api/submissions/:id/* routes read the same student data by a different
// door and checked only `role === 'teacher'`, so any teacher account could
// read any student's essay, transcript and integrity flags given an id.
// Invisible while the seed made exactly one teacher; reachable from the day
// an admin could create a second one (2026-08-04). Found by testing it
// 2026-08-05, not by reading the code.
// Two tiers reach the administration surface, and the split is deliberate.
//
// `platform-admin` is us: it runs accounts and reads what the tool costs. It
// is NOT a super-teacher — like the admin tier it replaces, it has no route
// into a named student, a transcript, a report, or an integrity flag, which is
// what keeps the teacher-only guarantee on flags true.
//
// A school administrator is a *grant on a teacher*, not a separate role,
// because in a pilot the same person does both jobs. Teaching is a data
// relationship (classes, assignments, submissions all key off teacherId);
// administering is one additive permission. Modelling it the other way round
// would drop the person out of every `role: 'teacher'` query that builds the
// roster and counts their classes.
function isPlatformAdmin(user) {
  return user.role === 'platform-admin';
}

function canAdminPeople(user) {
  return isPlatformAdmin(user) || (user.role === 'teacher' && user.schoolAdmin === true);
}

// Every account action, written down. "Who granted this person access, and
// when" is the first question asked in an access review or an incident, and
// before this it was unanswerable — the accounts simply existed.
//
// Names are copied in rather than joined at read time on purpose: the point of
// an audit record is to survive the thing it describes, and a suspended or
// renamed account must not rewrite its own history.
async function recordAdminEvent(actor, action, target, detail = null) {
  try {
    await col('adminEvents').add({
      ts: now(),
      actorId: actor.id,
      actorName: actor.displayName,
      action,
      targetId: target?.id || null,
      targetName: target?.displayName || null,
      targetRole: target?.role || null,
      detail,
    });
  } catch (err) {
    // An audit write must never be the reason an administrator cannot suspend
    // an account — that trades a record for an outage.
    console.error('[admin] could not record adminEvent:', err.message);
  }
}

async function canReadSubmission(user, submission) {
  if (submission.studentId === user.id) return true;
  if (user.role !== 'teacher') return false;
  return (await teacherScope(user)).students.some((s) => s.id === submission.studentId);
}

// ---------- product telemetry ----------

// The allowlist for POST /api/usage, and the label map the admin surface
// renders — kept together so a new content area is named once, on the server,
// rather than in an allowlist here and a label table in admin.html that drift.
//
// An "area" is a chunk of content a person deliberately opens, not a page:
// what this data has to answer is "which parts of the tool earn attention and
// which are ignored", which is a question about content, not about traffic.
const USAGE_SURFACES = {
  dashboard: {
    label: 'Teacher dashboard',
    audience: 'teacher',
    areas: {
      home: 'Home',
      'class-tab': 'Class view',
      'assignment-tab': 'Assignment view',
      'student-tab': 'Student view',
      'browse-assignments': 'Browse assignments',
      'browse-students': 'Browse students',
      'drill-panel': 'Drill-down panel',
      'flag-modal': 'Flag explainer',
      'patterns-worth-noticing': 'Patterns worth noticing',
      'teaching-landing': 'How your teaching is landing',
      'add-class': 'New class',
      'add-students': 'Add students',
      'add-assignment': 'New assignment',
    },
  },
  'teacher-detail': {
    label: 'Student detail',
    audience: 'teacher',
    areas: {
      'student-detail': 'Student overview',
      transcript: 'Full transcript',
      'full-report': 'Full report',
    },
  },
  // Named for the five jump-nav buttons a reader actually clicks, using their
  // on-screen labels verbatim. The trajectory strip, ready moments, snapshots
  // and integrity-signals blocks are deliberately absent: they render inline
  // with no open of their own, so any count attached to them would be a count
  // of page loads wearing a section's name.
  report: {
    label: 'Draft report',
    audience: 'both',
    areas: {
      overview: 'Overview',
      'my-session': 'My Session',
      'agency-chart': 'Agency Chart',
      'whos-driving': "Who's Driving",
      'next-time': 'Next Time',
    },
  },
  'student-home': {
    label: 'Student home',
    audience: 'student',
    areas: {
      'open-assignment': 'Open an assignment',
      'past-report': 'Past draft report',
    },
  },
  workspace: {
    label: 'Chat workspace',
    audience: 'student',
    areas: {
      'new-conversation': 'New conversation',
      evaluate: 'Evaluate',
      submit: 'Submit draft',
    },
  },
};

// Ranked by distinct people first, opens second. For a "what should we build
// next" decision, reach beats volume: one teacher opening a tab forty times
// should not outrank a panel eleven people each opened once.
//
// Every allowlisted area is emitted, including the ones with zero opens — an
// area nobody has ever opened is the most actionable row on the page, and
// dropping empty rows would hide exactly that finding.
function rankContentAreas(usage) {
  const seen = {};
  for (const u of usage) {
    if (!USAGE_SURFACES[u.surface]?.areas[u.area]) continue; // allowlist changed since the row was written
    const key = `${u.surface}/${u.area}`;
    (seen[key] = seen[key] || { people: new Set(), opens: 0 }).people.add(u.userId);
    seen[key].opens++;
  }

  const out = { teacher: [], student: [] };
  for (const [surface, spec] of Object.entries(USAGE_SURFACES)) {
    for (const [area, areaLabel] of Object.entries(spec.areas)) {
      const hit = seen[`${surface}/${area}`];
      const row = {
        surface,
        surfaceLabel: spec.label,
        area,
        areaLabel,
        people: hit ? hit.people.size : 0,
        opens: hit ? hit.opens : 0,
      };
      if (spec.audience !== 'student') out.teacher.push({ ...row });
      if (spec.audience !== 'teacher') out.student.push({ ...row });
    }
  }
  const rank = (a, b) => b.people - a.people || b.opens - a.opens || a.areaLabel.localeCompare(b.areaLabel);
  out.teacher.sort(rank);
  out.student.sort(rank);
  return out;
}

function median(nums) {
  if (!nums.length) return null;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round(((s[mid - 1] + s[mid]) / 2) * 10) / 10;
}

// How students actually work the tool. Every figure here comes from records
// the pipeline already persists — no instrumentation needed and none used, so
// this block is fully populated from day one while the ranking above is still
// filling up.
async function studentPatterns() {
  // Independent collections, so fetched together. Awaited one at a time these
  // are ~8s of pure round-trip latency on a seeded install; none of them
  // depends on another's result.
  const [sessions, events, submissions, allConvs, allTurns, allClasses, allAssignments, allAnalyses] =
    await Promise.all([
      col('sessions').list(),
      col('events').list(),
      col('submissions').list(),
      col('conversations').list(),
      col('turns').list(),
      col('classes').list(),
      col('assignments').list(),
      col('analyses').list(),
    ]);

  // Read each collection once and group in memory rather than querying per
  // session, per conversation and per submission. Those loops were ~170
  // sequential Firestore round trips on a seeded install, which put this
  // endpoint at 85 seconds — long enough that the page never left "Loading…".
  // Everything here is install-wide and already bounded by what one school
  // generates in a semester, so one pass per collection is the cheaper read.
  const convsBySession = new Map();
  for (const c of allConvs) {
    if (!convsBySession.has(c.sessionId)) convsBySession.set(c.sessionId, []);
    convsBySession.get(c.sessionId).push(c);
  }
  const turnsByConv = new Map();
  for (const t of allTurns) {
    if (!turnsByConv.has(t.conversationId)) turnsByConv.set(t.conversationId, []);
    turnsByConv.get(t.conversationId).push(t);
  }
  const episodesBySession = new Map();
  for (const e of events) {
    if (e.type !== 'episode-resume') continue;
    episodesBySession.set(e.sessionId, (episodesBySession.get(e.sessionId) || 0) + 1);
  }

  const convsPerSession = [];
  const turnsPerConv = [];
  let sessionsWithEvaluate = 0;
  const evaluateSessions = new Set(events.filter((e) => e.type === 'evaluate').map((e) => e.sessionId));
  const episodesPerSession = [];

  for (const s of sessions) {
    const convs = convsBySession.get(s.id) || [];
    convsPerSession.push(convs.length);
    for (const c of convs) {
      turnsPerConv.push(liveTurns(turnsByConv.get(c.id) || []).filter((t) => t.role === 'student').length);
    }
    if (evaluateSessions.has(s.id)) sessionsWithEvaluate++;
    episodesPerSession.push(episodesBySession.get(s.id) || 0);
  }

  // Expected drafts = every enrolled student × their assignment's draft budget.
  // A student in two classes that both got the same assignment is counted once
  // for it, which is why this walks a Set of ids rather than summing sizes.
  let expectedDrafts = 0;
  for (const a of allAssignments) {
    const enrolled = new Set(
      allClasses
        .filter((c) => (a.classIds || []).includes(c.id))
        .flatMap((c) => c.studentIds || [])
    );
    expectedDrafts += enrolled.size * (a.draftBudget || 1);
  }

  const eventCounts = {};
  for (const e of events) eventCounts[e.type] = (eventCounts[e.type] || 0) + 1;

  // `await col('analyses').get(id)?.status` read as `await (promise?.status)`,
  // which is always undefined — so every submission counted as pending and the
  // tile reported "50 analyses not complete" on an install where they had all
  // finished. The optional chain has to come after the await, and the lookup
  // is a map rather than a get-per-submission for the same reason as above.
  const analysisById = new Map(allAnalyses.map((a) => [a.id, a]));
  const analysisCounts = { complete: 0, error: 0, pending: 0 };
  for (const sub of submissions) {
    const status = sub.analysisId ? analysisById.get(sub.analysisId)?.status : null;
    if (status === 'complete') analysisCounts.complete++;
    else if (status === 'error') analysisCounts.error++;
    else analysisCounts.pending++;
  }

  return {
    sessions: sessions.length,
    conversationsPerDraft: median(convsPerSession),
    studentTurnsPerConversation: median(turnsPerConv),
    evaluateShare: sessions.length ? Math.round((sessionsWithEvaluate / sessions.length) * 100) : null,
    resumesPerDraft: median(episodesPerSession),
    draftsSubmitted: submissions.length,
    draftsExpected: expectedDrafts,
    eventCounts,
    analysisCounts,
  };
}

async function sessionFor(conversation) {
  return await col('sessions').get(conversation.sessionId);
}

async function assignmentFor(session) {
  return await col('assignments').get(session.assignmentId);
}

// Composes the three teacher-authored fields into the one string the auditor
// sees as "the assignment" — labeled so the model gets the what/why/must-haves
// distinction, not a single run-on paragraph. The chat itself never receives
// this: it runs with no system prompt at all (see coach.js).
function assignmentBrief(a) {
  return [
    a.description ? `What the task is:\n${a.description}` : '',
    a.purpose ? `Why this matters:\n${a.purpose}` : '',
    a.requirements ? `Requirements:\n${a.requirements}` : '',
  ].filter(Boolean).join('\n\n');
}

// ---------- SSE chat/auditor streaming ----------

function sseHead(res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });
}

function sseSend(res, event, data) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

async function streamReply({ res, user, conversation, assignment, messages, role, maxTokens, replyMeta, budget }) {
  sseHead(res);
  // Rule 2: warn before the wall, on the reply that crosses 80%.
  if (budget?.warning) sseSend(res, 'notice', budget.warning);
  const controller = new AbortController();
  let finished = false;
  res.on('close', () => { if (!finished) controller.abort(); });

  let text = '';
  let errored = false;
  try {
    text = await streamChat({
      messages,
      maxTokens,
      signal: controller.signal,
      onToken: (token) => sseSend(res, 'token', token),
      // 'coach' and 'auditor' are separate purposes in llmCalls: they are
      // different products with different cost shapes, and folding them
      // together would hide which one drives spend.
      meta: {
        studentId: user.id,
        assignmentId: assignment?.id || null,
        purpose: role === 'auditor' ? 'auditor' : 'chat',
      },
    });
  } catch (err) {
    errored = true;
    sseSend(res, 'error', err.message);
  }

  const stopped = controller.signal.aborted;
  let turn = null;
  // Persist whatever the student actually saw — including partial text from a
  // stopped generation. Nothing persisted on hard error with no output.
  if (!errored && (text || !stopped)) {
    turn = await col('turns').add({
      conversationId: conversation.id,
      role,
      text,
      createdAt: now(),
      meta: { ...replyMeta, ...(stopped ? { stopped: true } : {}) },
    });
    await col('conversations').update(conversation.id, { lastActiveAt: now() });
  }
  if (stopped) {
    await logEvent(user, { type: 'stop', sessionId: conversation.sessionId, conversationId: conversation.id, meta: { turnId: turn?.id } });
  }

  finished = true;
  if (!res.writableEnded) {
    sseSend(res, 'done', { turnId: turn?.id || null, stopped });
    res.end();
  }
}

// ---------- auth routes (the only unauthenticated /api paths) ----------

// Returns true if it handled the request.
async function handleAuth(req, res, route) {
  if (req.method === 'POST' && route === '/api/auth/login') {
    const body = await readBody(req);
    const result = await login(body.email, body.password, clientIp(req));
    // Lockout is told plainly — hiding it just makes a locked-out student
    // retry faster and blame themselves. It leaks nothing: reaching it
    // already required ten failures.
    if (result?.lockedOut) {
      json(res, 429, { error: 'Too many sign-in attempts. Wait 15 minutes and try again.' });
      return true;
    }
    // One generic message for both unknown-email and wrong-password: don't
    // let the login form enumerate who has an account.
    if (!result) {
      json(res, 401, { error: 'Email or password is incorrect' });
      return true;
    }
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Set-Cookie': sessionCookie(result.token),
    });
    res.end(JSON.stringify({ id: result.user.id, displayName: result.user.displayName, role: result.user.role }));
    return true;
  }

  // Unauthenticated by necessity: the login page has to ask before anyone has
  // signed in. It reveals only whether this instance is a demo one — the
  // account list stays a client-side fixture, and there is still no endpoint
  // that enumerates real users.
  if (req.method === 'GET' && route === '/api/auth/demo') {
    json(res, 200, DEMO_MODE ? { demo: true, password: DEV_PASSWORD } : { demo: false });
    return true;
  }

  // Names the account a set-password link belongs to. Not an access check —
  // the page gate has already refused a bad token — so it exists only so
  // someone holding a forwarded or stale link can see which account they are
  // about to change before they change it.
  if (req.method === 'GET' && route === '/api/auth/invite') {
    const t = new URL(req.url, 'http://x').searchParams.get('t');
    const found = await inspectCredentialToken(t);
    if (!found.ok) {
      json(res, 400, { error: 'That link is no longer valid.' });
      return true;
    }
    json(res, 200, { email: found.user.email, displayName: found.user.displayName, purpose: found.purpose });
    return true;
  }

  if (req.method === 'POST' && route === '/api/auth/set-password') {
    const body = await readBody(req);
    const result = await redeemCredentialToken(body.token, body.password, clientIp(req));

    if (!result.ok && result.reason === 'password') {
      json(res, 400, { error: result.message });
      return true;
    }
    if (!result.ok) {
      json(res, 400, { error: 'That link has expired or has already been used. Ask for a new one from the sign-in page.' });
      return true;
    }

    await recordAdminEvent(result.user, result.purpose === 'invite' ? 'invite-accepted' : 'reset-completed', result.user);
    res.writeHead(200, { 'Content-Type': 'application/json', 'Set-Cookie': sessionCookie(result.token) });
    res.end(JSON.stringify({ id: result.user.id, displayName: result.user.displayName, role: result.user.role }));
    return true;
  }

  // Always answers 200 with the same body, whether or not the address has an
  // account. The client shows fixed wording for the same reason: this is the
  // one endpoint anyone can call about an address they do not own, so it must
  // not become a way to ask "does this student go here?".
  if (req.method === 'POST' && route === '/api/auth/request-reset') {
    const body = await readBody(req);
    const email = String(body.email || '').trim().toLowerCase();
    const user = email ? (await col('users').list((u) => u.email.toLowerCase() === email))[0] : null;

    if (user && !isSuspended(user)) {
      // Throttled on the address rather than the requester: the cost being
      // controlled is mail sent to a person who did not ask for it (and a
      // finite daily send allowance), neither of which depends on who asked.
      const recent = (await col('emailSends').list({ to: user.email }))
        .filter((s) => s.purpose === 'reset' && s.sentAt >= new Date(Date.now() - 3600000).toISOString());
      if (recent.length >= 3) {
        console.warn('[auth] reset requests throttled for', user.email);
      } else {
        await sendReset(user);
      }
    } else if (email) {
      // Logged, never written to adminEvents: an audit row naming an address
      // with no account would turn the log into an enumeration oracle for
      // whoever reads it later, and let anyone fill it with invented strings.
      console.warn('[auth] reset requested for an address with no active account');
    }

    json(res, 200, { ok: true });
    return true;
  }

  if (req.method === 'POST' && route === '/api/auth/logout') {
    const token = tokenFrom(req);
    if (token) await logout(token);
    res.writeHead(200, { 'Content-Type': 'application/json', 'Set-Cookie': clearedCookie() });
    res.end(JSON.stringify({ ok: true }));
    return true;
  }

  // Delivery callbacks from SMTP2GO. The send API answers 200 the moment it
  // *accepts* a message, which is not delivery — a hard bounce, a full
  // mailbox, or a school filter rejection arrives minutes later over SMTP.
  // That gap is the whole of "my students never got their email", so without
  // this route the question is unanswerable from inside the app.
  //
  // Authenticated by a shared secret in a header, which the provider's webhook
  // config supports — a secret in the path would otherwise be copied into
  // every access log and referrer along the way.
  //
  // Constant-time compared, and the route may only ever annotate an existing
  // send record: never create a user, never mutate one, never consume a token.
  // So even a leaked secret buys nothing but a false delivery status on a row.
  if (req.method === 'POST' && route === '/api/webhooks/smtp2go') {
    const secret = mailSettings().webhookSecret;
    const supplied = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    const a = Buffer.from(supplied);
    const b = Buffer.from(secret || '');
    if (!secret || a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      json(res, 404, { error: 'not found' });
      return true;
    }

    const body = await readBody(req).catch(() => ({}));
    const messageId = body.email_id || body.message_id || body.sendid || null;
    const event = String(body.event || body.type || '').toLowerCase();
    const record = messageId ? (await col('emailSends').list({ providerMessageId: messageId }))[0] : null;

    // 200 even when nothing matched: a provider that gets an error retries,
    // and there is nothing to retry for an event about a message this install
    // has no record of.
    if (record && event) {
      const status = event.includes('bounce') ? 'bounced'
        : event.includes('spam') || event.includes('complain') ? 'spam'
        : event.includes('deliver') ? 'delivered'
        : event.includes('defer') ? 'deferred' : null;
      if (status) {
        await col('emailSends').update(record.id, {
          deliveryStatus: status,
          deliveryDetail: String(body.reason || body.detail || '').slice(0, 300) || null,
          deliveryAt: now(),
        });
      }
    }

    json(res, 200, { ok: true });
    return true;
  }

  return false;
}

// What the tool cost, from the llmCalls rows llm.js has been writing since the
// Vertex migration. Three jobs and no others (built-in-chat-plan.md): catch an
// anomaly before the bill arrives, answer "what does a school cost" for
// pricing, and show whether chat or analysis is the lever worth pulling on
// model choice.
//
// Aggregate by construction, same rule as the rest of this surface: the
// per-student spread is computed from studentId and then reported as bare
// numbers. No name, no id, no way to ask "what did Maya cost" — the anomaly
// this is meant to catch is a runaway loop, which a distribution shows just as
// well as a leaderboard would.
// Everything the Status view needs: is anything failing, is anyone stuck, is
// spend abnormal, and what is this install actually configured to do.
//
// It answers the question the rest of this surface cannot — "is the tool
// working right now" — which is the one an administrator opens the console to
// ask. All of it is derived from records that already existed; none of it was
// assembled anywhere before.
//
// Still aggregate: a failed analysis is identified by its assignment and its
// submission id, never by whose work it is. Fixing a broken report does not
// require knowing whose report it is.
async function statusSummary() {
  const dayAgo = new Date(Date.now() - 86400000).toISOString();
  const todayStart = new Date().toISOString().slice(0, 10);

  const [analyses, submissions, assignments, llmRows] = await Promise.all([
    col('analyses').list(),
    col('submissions').list(),
    col('assignments').list(),
    col('llmCalls').list(),
  ]);

  const submissionById = new Map(submissions.map((s) => [s.id, s]));
  const assignmentTitle = new Map(assignments.map((a) => [a.id, a.title]));

  // A student submitted and got no report back. That is a ticket, not a
  // statistic, so it is listed one per row with the retry that fixes it —
  // rather than folded into a count nobody can act on.
  const failedAnalyses = analyses
    .filter((a) => a.status === 'error')
    .map((a) => {
      const sub = submissionById.get(a.submissionId);
      return {
        analysisId: a.id,
        submissionId: a.submissionId,
        assignment: (sub && assignmentTitle.get(sub.assignmentId)) || 'Unknown assignment',
        submittedAt: sub?.submittedAt || null,
        error: a.error || 'No error recorded',
      };
    })
    .sort((x, y) => String(y.submittedAt).localeCompare(String(x.submittedAt)));

  // Pending is normal for a minute or two and abnormal after that: analysis is
  // async post-submit, so a row still pending an hour later means the run died
  // without ever writing its own error.
  const hourAgo = new Date(Date.now() - 3600000).toISOString();
  const stuckAnalyses = analyses.filter((a) => {
    if (a.status === 'complete' || a.status === 'error') return false;
    const sub = submissionById.get(a.submissionId);
    return sub?.submittedAt && sub.submittedAt < hourAgo;
  }).length;

  const recent = llmRows.filter((r) => r.ts >= dayAgo);
  const failed = recent.filter((r) => r.ok === false);
  const lastFailure = llmRows.filter((r) => r.ok === false).sort((a, b) => a.ts.localeCompare(b.ts)).pop() || null;

  // Cap pressure, computed from the call log rather than by asking budget.js
  // per student — same answer, one pass instead of one query per head.
  const today = llmRows.filter((r) => r.ts.slice(0, 10) === todayStart && r.studentId);
  const perStudentToday = new Map();
  for (const r of today) {
    const b = perStudentToday.get(r.studentId) || { replies: 0, inputTokens: 0 };
    if (r.purpose === 'chat') b.replies += 1;
    b.inputTokens += r.inputTokens || 0;
    perStudentToday.set(r.studentId, b);
  }
  const atSoftCap = [...perStudentToday.values()].filter((b) => b.replies >= SOFT_REPLIES_PER_DAY).length;
  const nearSoftCap = [...perStudentToday.values()].filter(
    (b) => b.replies >= SOFT_REPLIES_PER_DAY * 0.8 && b.replies < SOFT_REPLIES_PER_DAY).length;
  const atHardCap = [...perStudentToday.values()].filter((b) => b.inputTokens >= HARD_INPUT_TOKENS_PER_DAY).length;

  // The runaway-loop signature. A student five times the median is not a heavy
  // user — 40 replies and 40,000 replies look nothing alike, and the second one
  // is a bug. Reported as a count and a multiple, never as a name.
  const spend = [...llmRows.reduce((m, r) => {
    if (!r.studentId) return m;
    return m.set(r.studentId, (m.get(r.studentId) || 0) + costOf(r));
  }, new Map()).values()].sort((a, b) => a - b);
  const median = spend.length ? spend[Math.floor(spend.length / 2)] : 0;
  const OUTLIER_MULTIPLE = 5;
  const outliers = median > 0 ? spend.filter((v) => v >= median * OUTLIER_MULTIPLE).length : 0;

  return {
    failedAnalyses,
    stuckAnalyses,
    llm: {
      calls24h: recent.length,
      failures24h: failed.length,
      // Null rather than 0 when nothing ran: "0% errors" and "no traffic" are
      // different facts, and only one of them is reassuring.
      errorRate24h: recent.length ? failed.length / recent.length : null,
      lastFailureAt: lastFailure?.ts || null,
      lastFailureCode: lastFailure?.errorCode || null,
    },
    caps: {
      softLimit: SOFT_REPLIES_PER_DAY,
      hardLimit: HARD_INPUT_TOKENS_PER_DAY,
      atSoftCap,
      nearSoftCap,
      atHardCap,
      activeToday: perStudentToday.size,
    },
    spend: { outliers, outlierMultiple: OUTLIER_MULTIPLE, medianUsd: median },
    // Read-only, and deliberately so: config that routes data is a security
    // boundary. Showing it is what makes "compliance is configured by us"
    // checkable rather than a claim.
    config: {
      projectId: config().gcp?.projectId || null,
      location: config().gcp?.location || 'global',
      chatModel: modelFor('chat'),
      analysisModel: modelFor('analysis'),
    },
  };
}

async function costSummary() {
  const rows = (await col('llmCalls').list()).filter((r) => r.ok !== false);
  const usd = (list) => list.reduce((sum, r) => sum + costOf(r), 0);

  const group = (keyOf) => {
    const buckets = new Map();
    for (const r of rows) {
      const k = keyOf(r);
      const b = buckets.get(k) || { key: k, usd: 0, calls: 0 };
      b.usd += costOf(r);
      b.calls += 1;
      buckets.set(k, b);
    }
    return [...buckets.values()].sort((a, b) => b.usd - a.usd);
  };

  // Chat is what a student drives; analysis is what a submission triggers.
  // Which of the two dominates decides whether a cheaper chat model or a
  // batched analysis tier is the saving worth making.
  const kind = (r) => (r.purpose === 'chat' || r.purpose === 'auditor' ? 'chat' : 'analysis');

  const perStudent = [...rows.reduce((m, r) => {
    if (!r.studentId) return m;
    return m.set(r.studentId, (m.get(r.studentId) || 0) + costOf(r));
  }, new Map()).values()].sort((a, b) => a - b);

  const dayAgo = (n) => new Date(Date.now() - n * 86400000).toISOString();
  const since = (from, to) => rows.filter((r) => r.ts >= from && (!to || r.ts < to));

  return {
    totalUsd: usd(rows),
    calls: rows.length,
    inputTokens: rows.reduce((s, r) => s + (r.inputTokens || 0), 0),
    outputTokens: rows.reduce((s, r) => s + (r.outputTokens || 0) + (r.thinkingTokens || 0), 0),
    byKind: group(kind),
    byModel: group((r) => r.model || 'unknown'),
    perStudent: perStudent.length
      ? {
          students: perStudent.length,
          median: perStudent[Math.floor(perStudent.length / 2)],
          max: perStudent[perStudent.length - 1],
        }
      : null,
    last7Usd: usd(since(dayAgo(7))),
    prior7Usd: usd(since(dayAgo(14), dayAgo(7))),
    // A model swapped in config but missing from prices.js prices at zero,
    // which would quietly under-report rather than fail. Naming it here is what
    // makes that visible instead of silent.
    unpricedModels: [...new Set(rows.map((r) => r.model).filter((m) => m && !isPriced(m)))],
    since: rows.reduce((min, r) => (!min || r.ts < min ? r.ts : min), null),
  };
}

// ---------- routes ----------

async function handleApi(req, res, user, route) {
  const [, , seg1, seg2, seg3, seg4] = route.split('/'); // /api/<seg1>/<seg2>/<seg3>/<seg4>

  // GET /api/me — never spread the raw user doc; it carries the password hash
  if (req.method === 'GET' && seg1 === 'me' && !seg2) {
    return json(res, 200, {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      // Drives the Administration link in the shared account chip. Sent for
      // every role so the chip needs no second request to decide.
      canAdmin: canAdminPeople(user),
    });
  }

  // GET /api/student/home — everything the student home view needs in one call
  if (req.method === 'GET' && seg1 === 'student' && seg2 === 'home') {
    const current = [];
    const past = [];
    const trend = [];

    // Same rule as /api/assignments: an assignment with no classIds (seeded/
    // created before classes existed) is visible to everyone; otherwise the
    // student must be in one of its classes. This endpoint had drifted from
    // that rule — it listed every assignment unfiltered — so a student in one
    // class could see and even open another class's assignments.
    const myClasses = await col('classes').list((c) => c.studentIds.includes(user.id));
    const myClassIds = new Set(myClasses.map((c) => c.id));
    const classNameById = new Map(myClasses.map((c) => [c.id, c.name]));
    const classNameFor = (a) => {
      if (!a.classIds || !a.classIds.length) return null;
      return classNameById.get(a.classIds[0]) || null;
    };

    for (const a of await col('assignments')
      .list((a) => !a.classIds || !a.classIds.length || a.classIds.some((id) => myClassIds.has(id)))) {
      const submissions = (await col('submissions').list({ assignmentId: a.id, studentId: user.id }))
        .sort((x, y) => x.cycleIndex - y.cycleIndex);

      const drafts = [];
      for (const sub of submissions) {
        const analysis = sub.analysisId ? await col('analyses').get(sub.analysisId) : null;
        const complete = analysis?.status === 'complete';
        if (complete) trend.push({ submittedAt: sub.submittedAt, totalScore: analysis.tau.totalScore });
        drafts.push({
          submissionId: sub.id,
          cycleIndex: sub.cycleIndex,
          submittedAt: sub.submittedAt,
          analysisStatus: analysis?.status || 'missing',
          // Deliberately not spreading the analysis: flags are teacher-only and
          // the safest place to enforce that is by never selecting them.
          tau: complete
            ? {
                PQ: analysis.tau.PQ, SU: analysis.tau.SU, CS: analysis.tau.CS,
                OC: analysis.tau.OC, totalScore: analysis.tau.totalScore, SAMR: analysis.tau.SAMR,
              }
            : null,
          // The one behavior to try next — the home surfaces it so the advice
          // is reachable without opening the report.
          growthMove: complete ? analysis.snapshot?.growthMoves?.[0] || null : null,
          hasTeacherNote: Boolean(sub.teacherNote),
          teacherNote: sub.teacherNote || null,
          teacherNoteAt: sub.teacherNoteAt || null,
          assignmentTitle: a.title,
        });
      }

      const done = submissions.length >= a.draftBudget;
      const active = (await col('sessions')
        .list({ assignmentId: a.id, studentId: user.id, status: 'active' }))[0];

      if (done) {
        past.push({
          id: a.id, title: a.title, className: classNameFor(a), dueDate: a.dueDate,
          draftDueDates: a.draftDueDates, draftBudget: a.draftBudget, drafts,
        });
      } else {
        // Live conversations in the open session — "where you left off" is part
        // of the card's hierarchy, not something to rediscover by opening it.
        const openConvs = active
          ? await col('conversations').list({ sessionId: active.id })
          : [];
        const lastActiveAt = openConvs.length
          ? openConvs.map((c) => c.lastActiveAt || c.createdAt).sort().pop()
          : null;
        // The current draft's own state — distinct from the assignment's overall
        // state. A submission on draft 1 does not make draft 2 "in progress": it
        // is only in progress once the student has actually sent a message.
        // Was openConvs.some(...) — a predicate cannot await. Short-circuits on
        // the first hit exactly as .some() did, so the read count is unchanged.
        let hasActivity = false;
        for (const c of openConvs) {
          if ((await col('turns').list({ conversationId: c.id })).length > 0) {
            hasActivity = true;
            break;
          }
        }
        current.push({
          id: a.id,
          title: a.title,
          className: classNameFor(a),
          description: a.description,
          purpose: a.purpose,
          requirements: a.requirements,
          dueDate: a.dueDate,
          draftDueDates: a.draftDueDates,
          draftBudget: a.draftBudget,
          draftsUsed: submissions.length,
          hasActivity,
          conversationCount: openConvs.length,
          lastActiveAt,
          drafts,
          // Assignment-wide, not tied to any one draft's report — a teacher
          // note about the drafting process itself, not about a submission.
          teacherNote: a.teacherNote || null,
        });
      }
    }

    trend.sort((a, b) => a.submittedAt.localeCompare(b.submittedAt));
    // The soft cap is student-visible by design — a limit nobody can see is a
    // limit that arrives as a failure. The hard tier is deliberately absent.
    const budget = await checkChatBudget(user.id);
    return json(res, 200, {
      student: { displayName: user.displayName, email: user.email },
      current,
      past,
      trend,
      budget: { used: budget.used ?? budget.limit, limit: budget.limit, remaining: budget.remaining },
    });
  }

  // GET /api/assignments — list with per-student status
  if (req.method === 'GET' && seg1 === 'assignments' && !seg2) {
    // An assignment with no classIds (seeded/created before classes existed)
    // is visible to everyone; otherwise the student must be in one of the
    // assignment's classes — without this, every student saw every class's
    // assignments once a second/third class existed.
    const myClassIds = new Set((await col('classes').list((c) => c.studentIds.includes(user.id))).map((c) => c.id));
    const visible = await col('assignments')
      .list((a) => !a.classIds || !a.classIds.length || a.classIds.some((id) => myClassIds.has(id)));
    const assignments = [];
    for (const a of visible) {
      const submissions = await col('submissions').list({ assignmentId: a.id, studentId: user.id });
      const active = (await col('sessions')
        .list({ assignmentId: a.id, studentId: user.id, status: 'active' }))[0];
      assignments.push({
        id: a.id,
        title: a.title,
        description: a.description,
        purpose: a.purpose,
        requirements: a.requirements,
        dueDate: a.dueDate,
        draftBudget: a.draftBudget,
        draftsUsed: submissions.length,
        status: submissions.length >= a.draftBudget ? 'complete' : active ? 'in-progress' : 'not-started',
      });
    }
    return json(res, 200, assignments);
  }

  // POST /api/assignments/:id/open — get-or-create the active session (cycle)
  if (req.method === 'POST' && seg1 === 'assignments' && seg3 === 'open') {
    const assignment = await col('assignments').get(seg2);
    if (!assignment) return json(res, 404, { error: 'assignment not found' });

    // Same class-membership rule as /api/student/home — without it a student
    // could open (and chat on) an assignment from a class they aren't in.
    if (assignment.classIds && assignment.classIds.length) {
      const inClass = (await col('classes').list((c) => c.studentIds.includes(user.id)))
        .some((c) => assignment.classIds.includes(c.id));
      if (!inClass) return json(res, 403, { error: 'not your class' });
    }

    const submissions = await col('submissions').list((s) => s.assignmentId === assignment.id && s.studentId === user.id);
    let session = (await col('sessions').list((s) => s.assignmentId === assignment.id && s.studentId === user.id && s.status === 'active'))[0];

    if (!session && submissions.length < assignment.draftBudget) {
      const cycleIndex = submissions.length;
      session = await col('sessions').add({
        assignmentId: assignment.id,
        studentId: user.id,
        cycleIndex,
        status: 'active',
        startedAt: now(),
        submittedAt: null,
      });
    }

    // Submitted conversations stay readable (input-locked), so send every
    // cycle's conversations, newest session first.
    const sessions = (await col('sessions')
      .list({ assignmentId: assignment.id, studentId: user.id }))
      .sort((a, b) => b.cycleIndex - a.cycleIndex);
    const conversations = [];
    for (const s of sessions) {
      const convs = (await col('conversations').list({ sessionId: s.id }))
        .sort((a, b) => b.lastActiveAt.localeCompare(a.lastActiveAt))
        .map((c) => ({ ...c, cycleIndex: s.cycleIndex }));
      conversations.push(...convs);
    }

    // Same "has the student actually done anything on this draft yet" signal
    // as the home view — a session existing (or an empty first conversation)
    // isn't activity; a sent message is.
    let hasActivity = false;
    if (session) {
      for (const c of conversations.filter((c) => c.cycleIndex === session.cycleIndex)) {
        if ((await col('turns').list({ conversationId: c.id })).length > 0) {
          hasActivity = true;
          break;
        }
      }
    }

    return json(res, 200, {
      assignment,
      session: session || null,
      conversations,
      draftsUsed: submissions.length,
      hasActivity,
    });
  }

  // POST /api/conversations { sessionId, title? }
  if (req.method === 'POST' && seg1 === 'conversations' && !seg2) {
    const body = await readBody(req);
    const session = await col('sessions').get(body.sessionId);
    if (!session || session.studentId !== user.id) return json(res, 404, { error: 'session not found' });
    if (session.status !== 'active') return json(res, 409, { error: 'session is submitted' });
    const conversation = await col('conversations').add({
      sessionId: session.id,
      title: body.title || 'New conversation',
      createdAt: now(),
      lastActiveAt: now(),
      locked: false,
    });
    return json(res, 200, conversation);
  }

  if (seg1 === 'conversations' && seg2) {
    const conversation = await col('conversations').get(seg2);
    if (!conversation) return json(res, 404, { error: 'conversation not found' });
    const session = await sessionFor(conversation);
    if (session.studentId !== user.id) return json(res, 403, { error: 'forbidden' });
    const assignment = await assignmentFor(session);

    // GET /api/conversations/:id
    if (req.method === 'GET' && !seg3) {
      return json(res, 200, {
        conversation,
        turns: liveTurns(await conversationTurns(conversation.id)),
        locked: conversation.locked,
      });
    }

    // POST /api/conversations/:id/rename — rename ok, delete deliberately absent
    if (req.method === 'POST' && seg3 === 'rename') {
      const body = await readBody(req);
      await col('conversations').update(conversation.id, { title: String(body.title || '').slice(0, 80) || conversation.title });
      return json(res, 200, { ok: true });
    }

    if (conversation.locked) return json(res, 409, { error: 'conversation is locked' });

    // POST /api/conversations/:id/message { text, editOfTurnId? }
    if (req.method === 'POST' && seg3 === 'message') {
      const body = await readBody(req);
      const text = String(body.text || '').trim();
      if (!text) return json(res, 400, { error: 'empty message' });

      // Rule 1: refuse to *start* a reply without budget for a whole one.
      // Checked before the student's turn is persisted, so a refused message
      // does not leave a question sitting in the transcript with no answer.
      const budget = await checkChatBudget(user.id);
      if (!budget.allowed) return json(res, 429, { error: budget.message, budget: { remaining: 0, limit: budget.limit } });

      const prior = liveTurns(await conversationTurns(conversation.id));
      const supersedes = [];
      if (body.editOfTurnId) {
        // Editing replaces the old student turn AND the AI reply that
        // followed it — both stay in the record, superseded.
        const idx = prior.findIndex((t) => t.id === body.editOfTurnId);
        if (idx === -1 || prior[idx].role !== 'student') return json(res, 400, { error: 'bad editOfTurnId' });
        supersedes.push(...prior.slice(idx).map((t) => t.id));
        await logEvent(user, { type: 'edit', sessionId: session.id, conversationId: conversation.id, meta: { editOf: body.editOfTurnId } });
      }

      const studentTurn = await col('turns').add({
        conversationId: conversation.id,
        role: 'student',
        text,
        createdAt: now(),
        meta: supersedes.length ? { supersedes, editOf: body.editOfTurnId } : {},
      });

      const turns = liveTurns(await conversationTurns(conversation.id));
      const messages = chatMessages({ turns });
      return streamReply({
        res, user, conversation, assignment, messages,
        role: 'coach',
        replyMeta: { inReplyTo: studentTurn.id },
        budget,
      });
    }

    // POST /api/conversations/:id/regenerate — implicit rejection signal
    if (req.method === 'POST' && seg3 === 'regenerate') {
      // Auditor meta-turns don't block regeneration — the target is the last
      // AI turn in the real conversation.
      const turns = liveTurns(await conversationTurns(conversation.id)).filter((t) => !t.meta?.metaTurn);
      const last = turns[turns.length - 1];
      if (!last || last.role !== 'coach') return json(res, 400, { error: 'nothing to regenerate' });
      // A regeneration is an AI reply and costs the same as one.
      const budget = await checkChatBudget(user.id);
      if (!budget.allowed) return json(res, 429, { error: budget.message, budget: { remaining: 0, limit: budget.limit } });
      await logEvent(user, { type: 'regenerate', sessionId: session.id, conversationId: conversation.id, meta: { turnId: last.id } });

      const context = turns.slice(0, -1);
      const messages = chatMessages({ turns: context });
      return streamReply({
        res, user, conversation, assignment, messages,
        role: 'coach',
        replyMeta: { supersedes: [last.id], regenerated: true },
        budget,
      });
    }

    // POST /api/conversations/:id/evaluate — summon the auditor.
    // Exchange is a meta-turn (excluded from TAU); the invocation itself is
    // the metacognitive signal.
    if (req.method === 'POST' && seg3 === 'evaluate') {
      // The auditor is a Vertex call like any other, so it draws on the same
      // daily budget — makes it an easy loop to spin if it were free.
      const budget = await checkChatBudget(user.id);
      if (!budget.allowed) return json(res, 429, { error: budget.message, budget: { remaining: 0, limit: budget.limit } });
      await logEvent(user, { type: 'evaluate', sessionId: session.id, conversationId: conversation.id });
      const turns = liveTurns(await conversationTurns(conversation.id));
      const messages = auditorMessages({ assignmentPrompt: assignmentBrief(assignment), turns });
      return streamReply({
        res, user, conversation, assignment, messages,
        role: 'auditor',
        maxTokens: MAX_EVAL_TOKENS,
        replyMeta: { metaTurn: true },
        budget,
      });
    }
  }

  // POST /api/sessions/:id/submit { essayText } — the hard marker: locks every
  // conversation in the cycle and bundles ALL of them (no selective evidence).
  if (req.method === 'POST' && seg1 === 'sessions' && seg3 === 'submit') {
    const session = await col('sessions').get(seg2);
    if (!session || session.studentId !== user.id) return json(res, 404, { error: 'session not found' });
    if (session.status !== 'active') return json(res, 409, { error: 'already submitted' });
    const body = await readBody(req);
    const essayText = String(body.essayText || '').trim();
    if (!essayText) return json(res, 400, { error: 'essay draft required' });

    for (const c of await col('conversations').list((c) => c.sessionId === session.id)) {
      await col('conversations').update(c.id, { locked: true });
    }
    await col('sessions').update(session.id, { status: 'submitted', submittedAt: now() });
    const submission = await col('submissions').add({
      sessionId: session.id,
      assignmentId: session.assignmentId,
      studentId: user.id,
      cycleIndex: session.cycleIndex,
      essayText,
      submittedAt: now(),
      analysisId: null,
    });
    // Analysis runs async — the submit response returns immediately and the
    // report page polls until the analysis completes.
    runAnalysis(submission.id).catch((err) => console.error(err));
    return json(res, 200, { submission: await col('submissions').get(submission.id) });
  }

  // POST /api/submissions/:id/reanalyze — retry path for failed analyses
  if (req.method === 'POST' && seg1 === 'submissions' && seg3 === 'reanalyze') {
    const submission = await col('submissions').get(seg2);
    if (!submission) return json(res, 404, { error: 'submission not found' });
    if (!await canReadSubmission(user, submission)) return json(res, 403, { error: 'forbidden' });
    const existing = submission.analysisId && await col('analyses').get(submission.analysisId);
    if (existing && existing.status === 'pending') return json(res, 409, { error: 'analysis already running' });
    runAnalysis(submission.id).catch((err) => console.error(err));
    return json(res, 200, { ok: true });
  }

  // GET /api/submissions?assignmentId=…
  if (req.method === 'GET' && seg1 === 'submissions' && !seg2) {
    const assignmentId = new URL(req.url, 'http://x').searchParams.get('assignmentId');
    const rows = (await col('submissions')
      .list(assignmentId ? { studentId: user.id, assignmentId } : { studentId: user.id }))
      .sort((a, b) => a.cycleIndex - b.cycleIndex);
    const submissions = [];
    for (const s of rows) {
      const analysis = s.analysisId ? await col('analyses').get(s.analysisId) : null;
      const complete = analysis?.status === 'complete';
      submissions.push({
        id: s.id,
        cycleIndex: s.cycleIndex,
        submittedAt: s.submittedAt,
        analysisStatus: analysis?.status || null,
        // Score summary only — flags stay teacher-only, enforced by never selecting them.
        tau: complete ? { totalScore: analysis.tau.totalScore, SAMR: analysis.tau.SAMR } : null,
      });
    }
    return json(res, 200, submissions);
  }

  // GET /api/submissions/:id/report — full TAU disclosure at the draft
  // marker (revised 2026-07-16). Integrity flags remain teacher-only.
  if (req.method === 'GET' && seg1 === 'submissions' && seg3 === 'report') {
    const submission = await col('submissions').get(seg2);
    if (!submission) return json(res, 404, { error: 'submission not found' });
    if (!await canReadSubmission(user, submission)) return json(res, 403, { error: 'forbidden' });
    // Only after ownership is established does role decide what is disclosed —
    // the flags branch below must never be reached by a teacher who has no
    // claim on this student.
    const isTeacher = user.role === 'teacher';

    const analysis = submission.analysisId ? await col('analyses').get(submission.analysisId) : null;
    const report = analysis && {
      ...analysis,
      ...(isTeacher ? {} : { flags: undefined }),
    };

    // The nav's breadcrumb and its "Conversation" toggle both need to name
    // and link back to the assignment this draft belongs to — neither was
    // on the wire before the shared nav existed.
    const assignment = await col('assignments').get(submission.assignmentId);

    return json(res, 200, {
      submission: {
        id: submission.id,
        assignmentId: submission.assignmentId,
        assignmentTitle: assignment ? assignment.title : null,
        cycleIndex: submission.cycleIndex,
        submittedAt: submission.submittedAt,
        essayText: submission.essayText,
        teacherNote: submission.teacherNote || null,
      },
      analysis: report,
    });
  }

  // GET /api/submissions/:id/conversations — every conversation from the
  // draft's session (cycle), full turn record, for the report's static
  // Conversation view. Same auth as the report route; oldest-first, since
  // this is a history a student reads front to back, not a live sidebar
  // surfacing the most recent thread first.
  if (req.method === 'GET' && seg1 === 'submissions' && seg3 === 'conversations') {
    const submission = await col('submissions').get(seg2);
    if (!submission) return json(res, 404, { error: 'submission not found' });
    if (!await canReadSubmission(user, submission)) return json(res, 403, { error: 'forbidden' });

    const convRows = (await col('conversations').list({ sessionId: submission.sessionId }))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const conversations = [];
    for (const c of convRows) {
      conversations.push({ ...c, turns: liveTurns(await conversationTurns(c.id)) });
    }

    return json(res, 200, { conversations });
  }

  // POST /api/usage — product telemetry: which content areas actually get
  // opened. Any signed-in role writes here; only an admin ever reads it back,
  // and only as aggregates.
  //
  // The surface/area pair must be on USAGE_SURFACES. Without that allowlist a
  // client could write arbitrary strings straight into the ranking that
  // decides what gets built next — the one thing this data is for.
  if (req.method === 'POST' && seg1 === 'usage' && !seg2) {
    const body = await readBody(req);
    const surface = USAGE_SURFACES[body.surface];
    if (!surface || !surface.areas[body.area]) return json(res, 400, { error: 'unknown surface or area' });
    await col('usage').add({
      userId: user.id,
      role: user.role,
      surface: body.surface,
      area: body.area,
      ts: now(),
    });
    return json(res, 200, { ok: true });
  }

  // ---------- admin routes ----------

  if (seg1 === 'admin') {
    if (!canAdminPeople(user)) return json(res, 403, { error: 'admin only' });
  }

  // GET /api/admin/overview — everything admin.html needs in one call, same
  // one-shot pattern as /api/teacher/dashboard.
  //
  // Aggregates only, by design: no student name, no transcript, no essay, no
  // integrity flag ever appears in this payload. An admin creates and suspends
  // teacher accounts and reads what the tool is being used for — the student's
  // work stays between the student and their own teacher.
  if (req.method === 'GET' && seg1 === 'admin' && seg2 === 'overview') {
    // One parallel batch, then everything below is in-memory. The roster used
    // to do two reads *per teacher* — invisible at one seeded teacher, and the
    // same N+1 shape that had studentPatterns() taking 85 seconds, growing with
    // exactly the thing this page exists to add more of.
    const [usage, teacherDocsRaw, allClasses, allAssignments, allStudents, allSubmissions, patterns, cost] =
      await Promise.all([
        col('usage').list(),
        col('users').list({ role: 'teacher' }),
        col('classes').list(),
        col('assignments').list(),
        col('users').list({ role: 'student' }),
        col('submissions').list(),
        studentPatterns(),
        isPlatformAdmin(user) ? costSummary() : Promise.resolve(null),
      ]);

    const lastActive = {};
    for (const u of usage) {
      if (!lastActive[u.userId] || u.ts > lastActive[u.userId]) lastActive[u.userId] = u.ts;
    }

    const teacherDocs = teacherDocsRaw.sort((a, b) => a.displayName.localeCompare(b.displayName));

    // The most recent message sent to each account, so a roster row can answer
    // "they say they never got it" without anyone opening the provider's
    // dashboard — which on this plan only retains five days anyway. One read
    // for the whole page rather than one per row.
    const latestSend = {};
    for (const s of await col('emailSends').list()) {
      if (!s.userId) continue;
      if (!latestSend[s.userId] || s.sentAt > latestSend[s.userId].sentAt) latestSend[s.userId] = s;
    }
    const sendSummary = (id) => {
      const s = latestSend[id];
      if (!s) return null;
      // The address is carried from the send record, not joined from the user:
      // a mistyped address that was later corrected still has to show the one
      // the message actually went to, or the commonest cause of "no email
      // arrived" becomes the one thing the screen hides.
      return {
        to: s.to, purpose: s.purpose, sentAt: s.sentAt,
        accepted: s.accepted, failureReason: s.failureReason,
        deliveryStatus: s.deliveryStatus,
      };
    };

    const teachers = teacherDocs.map((t) => {
      const classes = allClasses.filter((c) => c.teacherId === t.id);
      return {
        id: t.id,
        displayName: t.displayName,
        email: t.email,
        status: t.status === 'suspended' ? 'suspended' : 'active',
        // Never signed in: derived from the absence of a password rather than
        // from a status value, so it stays true no matter which of the status
        // toggles has been used on the account since.
        neverSignedIn: !t.passwordSetAt,
        lastSend: sendSummary(t.id),
        schoolAdmin: t.schoolAdmin === true,
        classCount: classes.length,
        studentCount: new Set(classes.flatMap((c) => c.studentIds || [])).size,
        assignmentCount: allAssignments.filter((a) => a.teacherId === t.id).length,
        lastActiveAt: lastActive[t.id] || null,
      };
    });

    // Student *accounts*, never student work. Managing an account means
    // knowing whose it is — you cannot reset a password for an anonymous
    // person, and "I can't sign in" is the commonest ticket there is. The
    // guarantee this surface keeps is about the work: no transcript, no essay,
    // no report, no integrity flag, for any tier, ever.
    const students = allStudents
      .map((s) => ({
        id: s.id,
        displayName: s.displayName,
        email: s.email,
        status: s.status === 'suspended' ? 'suspended' : 'active',
        neverSignedIn: !s.passwordSetAt,
        lastSend: sendSummary(s.id),
        classCount: allClasses.filter((c) => (c.studentIds || []).includes(s.id)).length,
        lastActiveAt: lastActive[s.id] || null,
      }))
      .sort((a, b) => a.displayName.localeCompare(b.displayName));

    return json(res, 200, {
      teachers,
      students,
      status: isPlatformAdmin(user) ? await statusSummary() : null,
      // Volume against the plan's own ceilings, plus when mail last went out.
      // An operational fact about a running install, so it sits with Status
      // and Cost rather than with the rosters — same split the rail already
      // makes between "is it working" and "who are the people".
      mail: isPlatformAdmin(user) ? await mailVolume() : null,
      adminEvents: (await col('adminEvents').list())
        .sort((a, b) => b.ts.localeCompare(a.ts))
        .slice(0, 20),
      viewer: { role: user.role, platformAdmin: isPlatformAdmin(user) },
      // What the tool costs is ours, not the school's — a school administrator
      // manages their own people and reads their own product usage, but our
      // margin is not their business. Withheld server-side rather than hidden
      // in the page, so the answer does not depend on the client.
      cost,
      scale: {
        teachers: teachers.length,
        students: allStudents.length,
        classes: allClasses.length,
        assignments: allAssignments.length,
        submissions: allSubmissions.length,
      },
      contentAreas: rankContentAreas(usage),
      // Denominators for the reach bars: "3 of 8 students opened this" is a
      // fact worth acting on; "this bar is as long as the longest other bar"
      // is not, and at low volume it reads as "heavily used" when it only
      // means everything is tied.
      audienceSize: {
        teacher: teachers.filter((t) => t.status === 'active').length,
        student: allStudents.filter((s) => s.status !== 'suspended').length,
      },
      usageSince: usage.reduce((min, u) => (!min || u.ts < min ? u.ts : min), null),
      studentPatterns: patterns,
    });
  }

  // POST /api/admin/teachers — create a teacher account and invite them.
  // The account is created with no password at all; the emailed link sets one
  // (auth.js, credential tokens). Nothing about a credential is returned here,
  // which is the point — the administrator who creates an account can no
  // longer sign in as it.
  if (req.method === 'POST' && seg1 === 'admin' && seg2 === 'teachers' && !seg3) {
    const body = await readBody(req);
    const email = String(body.email || '').trim().toLowerCase();
    const displayName = String(body.displayName || '').trim();
    if (!displayName) return json(res, 400, { error: 'name is required' });
    if (!email || !email.includes('@')) return json(res, 400, { error: 'a valid email is required' });
    if ((await col('users').list((u) => u.email.toLowerCase() === email))[0]) {
      return json(res, 400, { error: 'an account with that email already exists' });
    }
    const teacher = await col('users').add({
      email,
      displayName,
      role: 'teacher',
      // Only a platform admin can hand out the administration grant. A school
      // administrator adds teachers; letting them mint peers would make the
      // grant self-propagating, so the tier that can create a tier is fixed.
      schoolAdmin: isPlatformAdmin(user) && body.schoolAdmin === true,
      // Stays 'active'. "Invited but not signed in yet" is derived from the
      // absence of passwordSetAt, not from a third status value — a new status
      // would have to be understood by isSuspended(), the two status toggles,
      // the audience counts and every roster filter, and any one of them
      // missing it is an account that quietly cannot sign in.
      status: 'active',
      createdAt: now(),
    });
    const sent = await sendInvite(teacher, user);
    await recordAdminEvent(user, 'create', teacher, teacher.schoolAdmin ? 'teacher + school administrator' : 'teacher');
    if (!sent.accepted) await recordAdminEvent(user, 'invite-failed', teacher, sent.failureReason);
    return json(res, 200, {
      id: teacher.id, email, displayName,
      invite: { accepted: sent.accepted, failureReason: sent.failureReason },
    });
  }

  // POST /api/admin/teachers/:id/... — three small lifecycle actions on one
  // teacher. Each re-checks role: 'teacher' so an admin can't accidentally
  // rename or suspend a student (or themselves) through this route.
  if (req.method === 'POST' && seg1 === 'admin' && seg2 === 'teachers' && seg3) {
    const parts = route.split('/'); // /api/admin/teachers/:id/<action>
    const teacher = await col('users').get(parts[4]);
    const action = parts[5];
    if (!teacher || teacher.role !== 'teacher') return json(res, 404, { error: 'teacher not found' });

    if (action === 'edit') {
      const body = await readBody(req);
      const displayName = String(body.displayName || '').trim();
      const email = String(body.email || '').trim().toLowerCase();
      if (!displayName) return json(res, 400, { error: 'name is required' });
      if (!email || !email.includes('@')) return json(res, 400, { error: 'a valid email is required' });
      const clash = (await col('users').list((u) => u.email.toLowerCase() === email && u.id !== teacher.id))[0];
      if (clash) return json(res, 400, { error: 'another account already uses that email' });
      const patch = { displayName, email };
      // Same rule as creation: the grant is only editable by the tier above it,
      // and a school administrator editing a teacher must not be able to
      // silently promote them (or themselves) by replaying this field.
      if (isPlatformAdmin(user)) patch.schoolAdmin = body.schoolAdmin === true;
      await col('users').update(teacher.id, patch);
      const grantChanged = isPlatformAdmin(user) && patch.schoolAdmin !== (teacher.schoolAdmin === true);
      await recordAdminEvent(user, 'edit', { ...teacher, displayName },
        grantChanged ? (patch.schoolAdmin ? 'granted school administrator' : 'revoked school administrator') : null);
      return json(res, 200, { ok: true });
    }

    // Suspend, never delete. A teacher owns classes, assignments, and every
    // submission made against them — deleting the account orphans all of it
    // and breaks every teacherId lookup that reads it back.
    if (action === 'status') {
      const body = await readBody(req);
      const status = body.status === 'suspended' ? 'suspended' : 'active';
      await col('users').update(teacher.id, { status });
      await recordAdminEvent(user, status === 'suspended' ? 'suspend' : 'reactivate', teacher);
      return json(res, 200, { ok: true, status });
    }

    // Mails a link to the account holder instead of setting a password the
    // administrator can read. This is what closes the hole the old version
    // logged and accepted: an admin could reset a teacher's password and then
    // sign in as them. Now an admin can start a recovery and still cannot
    // complete one — only the mailbox owner can.
    if (action === 'send-reset') {
      const sent = await sendReset(teacher);
      await recordAdminEvent(user, 'reset-link-sent', teacher, sent.accepted ? null : sent.failureReason);
      return json(res, 200, { ok: true, accepted: sent.accepted, failureReason: sent.failureReason, to: teacher.email });
    }

    // Same mechanism, different sentence on screen: "resend" is what an
    // administrator asks for when the first invite never arrived, and reusing
    // the reset wording there would be confusing at exactly the wrong moment.
    if (action === 'resend-invite') {
      const sent = await sendInvite(teacher, user);
      await recordAdminEvent(user, 'invite-resent', teacher, sent.accepted ? null : sent.failureReason);
      return json(res, 200, { ok: true, accepted: sent.accepted, failureReason: sent.failureReason, to: teacher.email });
    }

    return json(res, 404, { error: 'not found' });
  }

  // POST /api/admin/students/:id/<action> — the two support actions that
  // actually generate tickets: "I can't sign in" and "this account shouldn't
  // be active any more". Deliberately fewer actions than teachers get: a
  // student's name and email come from the teacher's roster, so editing them
  // here would let two surfaces disagree about the same person.
  if (req.method === 'POST' && seg1 === 'admin' && seg2 === 'students' && seg3) {
    const parts = route.split('/'); // /api/admin/students/:id/<action>
    const student = await col('users').get(parts[4]);
    const action = parts[5];
    if (!student || student.role !== 'student') return json(res, 404, { error: 'student not found' });

    if (action === 'status') {
      const body = await readBody(req);
      const status = body.status === 'suspended' ? 'suspended' : 'active';
      // Suspend, never delete, for the same reason as teachers: a student owns
      // sessions, conversations, an append-only turn record and submissions.
      // Deleting the account orphans the integrity record it exists to support.
      await col('users').update(student.id, { status });
      await recordAdminEvent(user, status === 'suspended' ? 'suspend' : 'reactivate', student);
      return json(res, 200, { ok: true, status });
    }

    if (action === 'send-reset') {
      const sent = await sendReset(student);
      await recordAdminEvent(user, 'reset-link-sent', student, sent.accepted ? null : sent.failureReason);
      return json(res, 200, { ok: true, accepted: sent.accepted, failureReason: sent.failureReason, to: student.email });
    }

    if (action === 'resend-invite') {
      const sent = await sendInvite(student, user);
      await recordAdminEvent(user, 'invite-resent', student, sent.accepted ? null : sent.failureReason);
      return json(res, 200, { ok: true, accepted: sent.accepted, failureReason: sent.failureReason, to: student.email });
    }

    return json(res, 404, { error: 'not found' });
  }

  // POST /api/admin/analyses/:submissionId/retry — re-run a failed analysis.
  //
  // The failure is usually transient (a 429, a truncated response), so the fix
  // is to run it again. Without this the only remedy was asking the student to
  // resubmit work they had already submitted.
  if (req.method === 'POST' && seg1 === 'admin' && seg2 === 'analyses' && seg4 === 'retry') {
    if (!isPlatformAdmin(user)) return json(res, 403, { error: 'platform admin only' });
    const submission = await col('submissions').get(seg3);
    if (!submission) return json(res, 404, { error: 'submission not found' });
    await recordAdminEvent(user, 'retry-analysis', null, `submission ${submission.id}`);
    // Fire-and-forget with the same shape as the submit path: analysis takes
    // far longer than a request should wait, and its result is read from the
    // analyses collection either way.
    runAnalysis(submission.id).catch((err) => console.error('[admin] retry failed:', err.message));
    return json(res, 200, { ok: true });
  }

  // ---------- teacher routes ----------

  if (seg1 === 'teacher' || (req.method === 'POST' && seg1 === 'assignments' && (!seg2 || seg3 === 'note' || seg3 === 'edit' || seg3 === 'delete')) || (req.method === 'POST' && seg1 === 'submissions' && seg3 === 'note') || (req.method === 'POST' && seg1 === 'classes')) {
    if (user.role !== 'teacher') return json(res, 403, { error: 'teacher only' });
  }

  // POST /api/assignments — create (teacher)
  if (req.method === 'POST' && seg1 === 'assignments' && !seg2) {
    const body = await readBody(req);
    const title = String(body.title || '').trim();
    const description = String(body.description || '').trim();
    const purpose = String(body.purpose || '').trim();
    const requirements = String(body.requirements || '').trim();
    const draftBudget = Math.max(1, Math.min(10, parseInt(body.draftBudget, 10) || 3));
    if (!title || !description || !purpose || !requirements) {
      return json(res, 400, { error: 'title, description, purpose, and requirements are required' });
    }
    // No class picker in the creation form yet — an assignment with no
    // classIds sent defaults to every class this teacher has, so existing
    // creation flow behaves the same as before classes existed.
    const allClassIds = (await col('classes').list((c) => c.teacherId === user.id)).map((c) => c.id);
    const classIds = Array.isArray(body.classIds) && body.classIds.length ? body.classIds : allClassIds;
    // One due date per draft slot, ascending — the last IS the assignment's
    // due date (see store.js's schema comment on draftDueDates).
    const draftDueDates = (Array.isArray(body.draftDueDates) ? body.draftDueDates : []).slice(0, draftBudget);
    if (draftDueDates.length !== draftBudget || draftDueDates.some((d) => !d || Number.isNaN(new Date(d).getTime()))) {
      return json(res, 400, { error: 'one due date per draft slot required' });
    }
    for (let i = 1; i < draftDueDates.length; i++) {
      if (new Date(draftDueDates[i]) < new Date(draftDueDates[i - 1])) {
        return json(res, 400, { error: 'draft due dates must be in ascending order' });
      }
    }
    const assignment = await col('assignments').add({
      teacherId: user.id,
      classIds,
      title,
      description,
      purpose,
      requirements,
      dueDate: draftDueDates[draftDueDates.length - 1],
      draftBudget,
      draftDueDates,
      createdAt: now(),
    });
    return json(res, 200, assignment);
  }

  // POST /api/assignments/:id/edit — update an existing assignment (teacher).
  // Same shape/validation as creation, since the Edit modal reuses that same
  // form pre-filled. One extra guard creation doesn't need: draftBudget
  // can't shrink below a student's already-reached checkpoint — cycleIndex
  // assumes drafts only ever grow out from under existing submissions, not
  // shrink.
  if (req.method === 'POST' && seg1 === 'assignments' && seg3 === 'edit') {
    const assignment = await col('assignments').get(seg2);
    if (!assignment) return json(res, 404, { error: 'assignment not found' });
    if (assignment.teacherId !== user.id) return json(res, 403, { error: 'not your assignment' });
    const body = await readBody(req);
    const title = String(body.title || '').trim();
    const description = String(body.description || '').trim();
    const purpose = String(body.purpose || '').trim();
    const requirements = String(body.requirements || '').trim();
    const draftBudget = Math.max(1, Math.min(10, parseInt(body.draftBudget, 10) || 3));
    if (!title || !description || !purpose || !requirements) {
      return json(res, 400, { error: 'title, description, purpose, and requirements are required' });
    }
    const draftDueDates = (Array.isArray(body.draftDueDates) ? body.draftDueDates : []).slice(0, draftBudget);
    if (draftDueDates.length !== draftBudget || draftDueDates.some((d) => !d || Number.isNaN(new Date(d).getTime()))) {
      return json(res, 400, { error: 'one due date per draft slot required' });
    }
    for (let i = 1; i < draftDueDates.length; i++) {
      if (new Date(draftDueDates[i]) < new Date(draftDueDates[i - 1])) {
        return json(res, 400, { error: 'draft due dates must be in ascending order' });
      }
    }
    const maxCycle = (await col('submissions')
      .list((s) => s.assignmentId === assignment.id))
      .reduce((max, s) => Math.max(max, s.cycleIndex), -1);
    if (draftBudget <= maxCycle) {
      return json(res, 400, { error: `can't reduce draft budget below ${maxCycle + 1} — a student has already submitted that many drafts` });
    }
    const classIds = Array.isArray(body.classIds) && body.classIds.length ? body.classIds : assignment.classIds;
    const noteChanged = typeof body.teacherNote === 'string' && body.teacherNote.trim() !== (assignment.teacherNote || '');
    await col('assignments').update(assignment.id, {
      title, description, purpose, requirements, classIds,
      dueDate: draftDueDates[draftDueDates.length - 1],
      draftBudget, draftDueDates,
      teacherNote: typeof body.teacherNote === 'string' ? body.teacherNote.trim().slice(0, 2000) : (assignment.teacherNote || ''),
      teacherNoteAt: noteChanged ? now() : assignment.teacherNoteAt,
    });
    return json(res, 200, await col('assignments').get(assignment.id));
  }

  // POST /api/classes — create a class (teacher). First half of "teacher
  // creates a class, adds students" — manual roster management for now,
  // ahead of the documented Google SSO plan (see auth.js's own header
  // comment for why this POC still has a password path at all).
  if (req.method === 'POST' && seg1 === 'classes' && !seg2) {
    const body = await readBody(req);
    const name = String(body.name || '').trim();
    if (!name) return json(res, 400, { error: 'class name is required' });
    const classDoc = await col('classes').add({
      teacherId: user.id,
      name,
      studentIds: [],
      createdAt: now(),
    });
    return json(res, 200, classDoc);
  }

  // POST /api/classes/:id/edit — rename and/or archive a class. Archive, not
  // delete: a finished term's submissions, analyses and transcripts stay
  // readable and a student's own report keeps resolving; the class just stops
  // occupying the rail (teacherScope filters it out). Reversible by sending
  // archived: false, which is why there's no confirmation gate on the way in.
  if (req.method === 'POST' && seg1 === 'classes' && seg3 === 'edit') {
    const classDoc = await col('classes').get(seg2);
    if (!classDoc) return json(res, 404, { error: 'class not found' });
    if (classDoc.teacherId !== user.id) return json(res, 403, { error: 'not your class' });
    const body = await readBody(req);
    const patch = {};
    if (typeof body.name === 'string') {
      const name = body.name.trim();
      if (!name) return json(res, 400, { error: 'class name is required' });
      patch.name = name;
    }
    if (typeof body.archived === 'boolean') patch.archived = body.archived;
    if (!Object.keys(patch).length) return json(res, 400, { error: 'nothing to change' });
    await col('classes').update(classDoc.id, patch);
    return json(res, 200, await col('classes').get(classDoc.id));
  }

  // POST /api/assignments/:id/delete — only while the assignment is still
  // untouched. Once a student has opened a session or submitted a draft there
  // are sessions, conversations, turns, submissions and analyses hanging off
  // this id, and the append-only integrity record (see store.js) is the whole
  // point of the tool — so this refuses and names what's in the way rather
  // than cascading a delete through it. Retiring work that's been used is what
  // archiving a class does instead.
  if (req.method === 'POST' && seg1 === 'assignments' && seg3 === 'delete') {
    const assignment = await col('assignments').get(seg2);
    if (!assignment) return json(res, 404, { error: 'assignment not found' });
    if (assignment.teacherId !== user.id) return json(res, 403, { error: 'not your assignment' });
    const submissions = await col('submissions').list({ assignmentId: assignment.id });
    if (submissions.length) {
      return json(res, 400, {
        error: `${submissions.length} draft${submissions.length === 1 ? ' has' : 's have'} already been submitted to this assignment, so it can't be deleted.`,
      });
    }
    const sessions = await col('sessions').list({ assignmentId: assignment.id });
    if (sessions.length) {
      return json(res, 400, {
        error: `${sessions.length} student${sessions.length === 1 ? ' has' : 's have'} already started work on this assignment, so it can't be deleted.`,
      });
    }
    await col('assignments').delete(assignment.id);
    return json(res, 200, { ok: true });
  }

  // POST /api/classes/:id/students — add or remove a student on this
  // class's roster. Two shapes on one route rather than a second URL: the
  // minimal router here only destructures three path segments
  // (`seg1/seg2/seg3`, see that declaration above), so a fourth segment for
  // a student id on a DELETE-style route isn't reachable without extending
  // that — branching on the body is simpler than widening the router for
  // one route.
  //   { email, displayName } → add. Finds an existing student account by
  //     email, or provisions a new one. A new account is created with no
  //     password and invited by email; the link sets one (auth.js, credential
  //     tokens). An address that already has an account is added to the
  //     roster and deliberately not re-invited.
  //   { studentId, remove: true } → remove from this class's roster only —
  //     the account itself isn't deleted, since the student may belong to
  //     another class.
  if (req.method === 'POST' && seg1 === 'classes' && seg3 === 'students') {
    const classDoc = await col('classes').get(seg2);
    if (!classDoc) return json(res, 404, { error: 'class not found' });
    if (classDoc.teacherId !== user.id) return json(res, 403, { error: 'not your class' });
    const body = await readBody(req);

    if (body.remove) {
      const studentIds = (classDoc.studentIds || []).filter((id) => id !== body.studentId);
      await col('classes').update(classDoc.id, { studentIds });
      return json(res, 200, await col('classes').get(classDoc.id));
    }

    const email = String(body.email || '').trim().toLowerCase();
    const displayName = String(body.displayName || '').trim();
    if (!email || !email.includes('@')) return json(res, 400, { error: 'a valid email is required' });

    let student = (await col('users').list((u) => u.email.toLowerCase() === email))[0];
    if (student && student.role !== 'student') {
      return json(res, 400, { error: 'that email belongs to a non-student account' });
    }
    let invite = null;
    if (!student) {
      if (!displayName) return json(res, 400, { error: 'name is required for a new student' });
      student = await col('users').add({ email, displayName, role: 'student', status: 'active', createdAt: now() });
      // No password is set here — the emailed link sets one. An existing
      // student added to a second class is not re-invited: they already have
      // an account, and a fresh invite would invalidate the credentials they
      // are signing in with today.
      invite = await sendInvite(student, user);
      await recordAdminEvent(user, 'create', student, 'student');
      if (!invite.accepted) await recordAdminEvent(user, 'invite-failed', student, invite.failureReason);
    }

    const studentIds = classDoc.studentIds || [];
    if (!studentIds.includes(student.id)) {
      await col('classes').update(classDoc.id, { studentIds: [...studentIds, student.id] });
    }
    // Never the raw user doc past this point — passwordHash/passwordSalt
    // have no business leaving the server, same sanitization /api/me and
    // every other user-returning route already applies.
    const savedStudent = await col('users').get(student.id);
    return json(res, 200, {
      class: await col('classes').get(classDoc.id),
      student: { id: savedStudent.id, email: savedStudent.email, displayName: savedStudent.displayName },
      // Null when the student already had an account. Non-null and unaccepted
      // is the case the teacher has to see immediately — a mistyped address
      // otherwise looks exactly like a successful add. Trimmed to the two
      // fields the client acts on; the send's own id is bookkeeping.
      invite: invite ? { accepted: invite.accepted, failureReason: invite.failureReason } : null,
    });
  }

  // POST /api/assignments/:id/note — set or clear the assignment-wide
  // teacher note (distinct from a per-submission note: this one isn't tied
  // to any single draft's report, so it lives on the assignment record).
  if (req.method === 'POST' && seg1 === 'assignments' && seg3 === 'note') {
    const assignment = await col('assignments').get(seg2);
    if (!assignment) return json(res, 404, { error: 'assignment not found' });
    if (assignment.teacherId !== user.id) return json(res, 403, { error: 'not your assignment' });
    const body = await readBody(req);
    await col('assignments').update(assignment.id, {
      teacherNote: String(body.text || '').trim().slice(0, 2000),
      teacherNoteAt: now(),
    });
    return json(res, 200, { ok: true });
  }

  // GET /api/teacher/dashboard — feeds the ported triage dashboard
  // (dashboard.html) in the exact shape its mock generator produced:
  // { assignments, students, classes, submissions }
  if (req.method === 'GET' && seg1 === 'teacher' && seg2 === 'dashboard') {
    const { students, classes, allClasses, classIds: allClassIds, assignments: ownAssignments } = await teacherScope(user);
    // An assignment seeded/created before classes existed (or omitted at
    // creation) has no classIds — treat it as visible to every class rather
    // than to none, so it doesn't silently vanish from the dashboard. "Every
    // class" now means every class *this teacher owns*, not every class in the
    // install.
    const assignments = ownAssignments.map((a) => ({
      id: a.id,
      name: a.title,
      due: a.dueDate || new Date(new Date(a.createdAt).getTime() + 14 * 86400000).toISOString(),
      status: a.dueDate && new Date(a.dueDate) < new Date() ? 'closed' : 'open',
      draftBudget: a.draftBudget,
      draftDueDates: a.draftDueDates || null,
      // Intersected with the live classes, not passed through: an assignment
      // can span an archived section and a running one, and the archived id
      // would otherwise resolve to nothing on every lookup downstream.
      classIds: a.classIds && a.classIds.length ? a.classIds.filter((id) => allClassIds.includes(id)) : allClassIds,
      // The assignment's own goal — shown to the student every session
      // (description/purpose/requirements) and a whole-class rubric-style
      // reminder (teacherNote, distinct from a per-submission teacherNote).
      // Neither was ever sent to the teacher dashboard before the Assignment
      // Detail timeline redesign; both already existed on the assignment record.
      description: a.description || null,
      purpose: a.purpose || null,
      requirements: a.requirements || null,
      teacherNote: a.teacherNote || null,
    }));

    // Three parallel batches, then everything below is in-memory. This used to
    // be a serial student × assignment × draft walk issuing four queries per
    // draft — so a 20-student, 5-assignment class paid 100 round-trips before
    // it looked at a single submission, most of them for pairs where the
    // student had submitted nothing. Queries are scoped per assignment rather
    // than collection-wide so document reads stay bounded to this teacher's
    // work, not the whole install. Same fix the admin overview got above.
    const inScope = new Set(students.map((s) => s.id));
    const [subsByAssignment, sessionsByAssignment] = await Promise.all([
      Promise.all(assignments.map((a) => col('submissions').list({ assignmentId: a.id }))),
      Promise.all(assignments.map((a) => col('sessions').list({ assignmentId: a.id }))),
    ]);

    const submissions = {};
    for (const s of students) for (const a of assignments) submissions[`${s.id}_${a.id}`] = [];

    const rows = [];
    for (let i = 0; i < assignments.length; i++) {
      // An assignment's submissions include students who have since left this
      // teacher's live rosters (an archived class); teacherScope already
      // dropped them from `students`, so they must not reappear here.
      for (const sub of subsByAssignment[i].filter((sub) => inScope.has(sub.studentId))) {
        rows.push({ sub, assignmentIndex: i });
      }
    }

    // One session per (student, assignment, cycleIndex) under the current
    // model (a draft's active session is reused, never duplicated — see
    // store.js), but a student can open more than one *conversation* inside
    // that same session (a "new chat" without submitting). Conversation count
    // is the real proxy for "did they restart with a fresh context instead of
    // extending one long thread" — feeds the Assignment Detail timeline's
    // per-draft usage note.
    const sessionFor = new Map();
    for (let i = 0; i < assignments.length; i++) {
      for (const sess of sessionsByAssignment[i]) {
        const key = `${sess.studentId}_${assignments[i].id}_${sess.cycleIndex}`;
        if (!sessionFor.has(key)) sessionFor.set(key, sess);
      }
    }

    const sessionIds = [];
    for (const { sub, assignmentIndex } of rows) {
      const sess = sessionFor.get(`${sub.studentId}_${assignments[assignmentIndex].id}_${sub.cycleIndex}`);
      if (sess && !sessionIds.includes(sess.id)) sessionIds.push(sess.id);
    }

    const analysisIds = [...new Set(rows.map((r) => r.sub.analysisId).filter(Boolean))];
    const [analysisDocs, convoLists] = await Promise.all([
      Promise.all(analysisIds.map((id) => col('analyses').get(id))),
      Promise.all(sessionIds.map((id) => col('conversations').list({ sessionId: id }))),
    ]);
    const analysisById = new Map(analysisIds.map((id, i) => [id, analysisDocs[i]]));
    const convoCountBySession = new Map(sessionIds.map((id, i) => [id, convoLists[i].length]));

    for (const { sub, assignmentIndex } of rows) {
      const a = assignments[assignmentIndex];
      const analysis = sub.analysisId ? analysisById.get(sub.analysisId) : null;
      const done = analysis?.status === 'complete';
      const session = sessionFor.get(`${sub.studentId}_${a.id}_${sub.cycleIndex}`);
      submissions[`${sub.studentId}_${a.id}`].push({
        id: sub.id,
        ts: sub.submittedAt,
        cycleIndex: sub.cycleIndex,
        pq: done ? analysis.tau.PQ : 0,
        su: done ? analysis.tau.SU : 0,
        cs: done ? analysis.tau.CS : 0,
        oc: done ? analysis.tau.OC : 0,
        analysisStatus: analysis?.status || 'missing',
        conversationCount: session ? convoCountBySession.get(session.id) || 0 : 0,
        // Per-submission origin mix (student-born/synthesized/ai-born
        // counts) — already computed for OC scoring, never surfaced
        // before now. Feeds the assignment-level provenance aggregate
        // in dashboard.html; null when provenance tracing didn't run
        // (regex-fallback path has no provenance data).
        provenance: done ? (analysis.tau.provenanceCounts || null) : null,
        // The teacher's own note on this draft, shown to the student
        // beside their snapshot. Sent in full rather than as a
        // hasNote boolean so the dashboard can both display it and
        // prefill the edit form without a second round trip.
        teacherNote: sub.teacherNote || null,
        ...(done && analysis.flags?.length ? { integrityFlags: analysis.flags.map((f) => f.flag) } : {}),
        // Behavioural patterns detected off the turn sequence — ids only.
        // The turn spans stay on the analysis doc: the dashboard aggregates
        // across students and never draws a single student's transcript, so
        // shipping spans here would be payload for a view that doesn't exist.
        // Written by runAnalysis since 2026-08-14; older analyses carry none
        // until backfill-patterns.js has run over them.
        ...(done && analysis.patterns?.length
          ? { patterns: [...new Set(analysis.patterns.map((p) => p.id))] }
          : {}),
      });
    }

    for (const key of Object.keys(submissions)) {
      submissions[key].sort((x, y) => x.cycleIndex - y.cycleIndex);
    }

    return json(res, 200, {
      assignments,
      students: students.map((s) => ({
        id: s.id,
        name: s.displayName,
        email: s.email,
        initials: s.displayName.split(' ').map((p) => p[0]).join(''),
      })),
      classes: classes.map((c) => ({ id: c.id, name: c.name, studentIds: c.studentIds })),
      // Sent separately from `classes`, never merged into it: everything on
      // this page derives rosters and rollups from that list, and an archived
      // class appearing there would put a finished term back into every count.
      // This exists so the sidebar can offer a way to un-archive.
      archivedClasses: allClasses
        .filter((c) => c.archived)
        .map((c) => ({ id: c.id, name: c.name, studentIds: c.studentIds || [] })),
      submissions,
    });
  }

  // GET /api/teacher/assignments — all assignments with roster summary
  if (req.method === 'GET' && seg1 === 'teacher' && seg2 === 'assignments' && !seg3) {
    const { students, assignments: ownAssignments } = await teacherScope(user);
    // Two parallel batches per collection instead of two queries per
    // (assignment, student) pair plus one per draft — the same N+1 that made
    // the triage dashboard slow, on a route that reads the same records.
    const [subsByAssignment, activeSessionsByAssignment] = await Promise.all([
      Promise.all(ownAssignments.map((a) => col('submissions').list({ assignmentId: a.id }))),
      Promise.all(ownAssignments.map((a) => col('sessions').list({ assignmentId: a.id, status: 'active' }))),
    ]);
    const allAnalysisIds = [...new Set(subsByAssignment.flat().map((s) => s.analysisId).filter(Boolean))];
    const analysisDocs = await Promise.all(allAnalysisIds.map((id) => col('analyses').get(id)));
    const analysisById = new Map(allAnalysisIds.map((id, i) => [id, analysisDocs[i]]));

    const assignments = [];
    for (let ai = 0; ai < ownAssignments.length; ai++) {
      const a = ownAssignments[ai];
      const subsByStudent = new Map();
      for (const sub of subsByAssignment[ai]) {
        if (!subsByStudent.has(sub.studentId)) subsByStudent.set(sub.studentId, []);
        subsByStudent.get(sub.studentId).push(sub);
      }
      const activeStudentIds = new Set(activeSessionsByAssignment[ai].map((s) => s.studentId));
      const roster = [];
      for (const s of students) {
        const submissions = (subsByStudent.get(s.id) || [])
          .sort((x, y) => x.cycleIndex - y.cycleIndex);
        const active = activeStudentIds.has(s.id);
        const cycles = [];
        for (const sub of submissions) {
          const analysis = sub.analysisId ? analysisById.get(sub.analysisId) : null;
          cycles.push({
            submissionId: sub.id,
            cycleIndex: sub.cycleIndex,
            submittedAt: sub.submittedAt,
            analysisStatus: analysis?.status || null,
            tau: analysis?.status === 'complete' ? { PQ: analysis.tau.PQ, SU: analysis.tau.SU, CS: analysis.tau.CS, OC: analysis.tau.OC, totalScore: analysis.tau.totalScore, SAMR: analysis.tau.SAMR } : null,
            flagCount: analysis?.flags?.length || 0,
            hasNote: !!sub.teacherNote,
          });
        }
        roster.push({
          studentId: s.id,
          displayName: s.displayName,
          email: s.email,
          activeSession: active,
          cycles,
        });
      }
      assignments.push({ ...a, roster });
    }
    return json(res, 200, assignments);
  }

  // GET /api/teacher/assignments/:aid/students/:sid — the detail layer:
  // every cycle's conversations with the FULL turn record (superseded and
  // meta-turns included, annotated), events, analysis with flags.
  if (req.method === 'GET' && seg1 === 'teacher' && seg2 === 'assignments' && seg3) {
    // /api/teacher/assignments/:aid/students/:sid → ['', 'api', 'teacher', 'assignments', aid, 'students', sid]
    const parts = route.split('/');
    const aid = parts[4];
    const sid = parts[6];
    const assignment = await col('assignments').get(aid);
    const student = await col('users').get(sid);
    if (!assignment || !student) return json(res, 404, { error: 'not found' });
    // This route returns full transcripts and integrity flags, so ownership is
    // checked on both axes — the assignment must be this teacher's, and the
    // student must be on one of this teacher's rosters. Without it, a teacher
    // who guessed an id could read another teacher's student.
    const scope = await teacherScope(user);
    if (assignment.teacherId !== user.id || !scope.students.some((s) => s.id === sid)) {
      return json(res, 403, { error: 'not your student' });
    }

    const sessionRows = (await col('sessions').list({ assignmentId: aid, studentId: sid }))
      .sort((a, b) => a.cycleIndex - b.cycleIndex);
    const sessions = [];
    for (const session of sessionRows) {
      const convRows = (await col('conversations').list({ sessionId: session.id }))
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      const conversations = [];
      for (const conv of convRows) {
        const turns = await conversationTurns(conv.id);
        const dead = new Set(turns.flatMap((t) => t.meta?.supersedes || []));
        conversations.push({
          ...conv,
          turns: turns.map((t) => ({
            ...t,
            superseded: dead.has(t.id),
            metaTurn: !!t.meta?.metaTurn,
          })),
        });
      }
      const events = (await col('events').list({ sessionId: session.id }))
        .sort((a, b) => a.ts.localeCompare(b.ts));
      const submission = (await col('submissions').list({ sessionId: session.id }))[0] || null;
      const analysis = submission?.analysisId ? await col('analyses').get(submission.analysisId) : null;
      sessions.push({ session, conversations, events, submission, analysis });
    }

    return json(res, 200, { assignment, student, sessions });
  }

  // POST /api/teacher/students/:id/grant-replies — rule 4, the escape valve.
  // The limit can only be set generously if a teacher can lift it in one
  // click when a student hits it mid-homework.
  if (req.method === 'POST' && seg1 === 'teacher' && seg2 === 'students' && seg4 === 'grant-replies') {
    if (user.role !== 'teacher') return json(res, 403, { error: 'forbidden' });
    if (!(await teacherScope(user)).students.some((s) => s.id === seg3)) {
      return json(res, 403, { error: 'not your student' });
    }
    const body = await readBody(req);
    const extraReplies = Math.min(Math.max(parseInt(body.extraReplies, 10) || 20, 1), 200);
    await grantExtraReplies({ studentId: seg3, teacherId: user.id, extraReplies });
    const [used, granted] = await Promise.all([usageToday(seg3), grantedToday(seg3)]);
    return json(res, 200, {
      ok: true,
      limit: SOFT_REPLIES_PER_DAY + granted,
      used: used.replies,
      remaining: Math.max(0, SOFT_REPLIES_PER_DAY + granted - used.replies),
    });
  }

  // POST /api/submissions/:id/note — teacher note, shown to the student
  // beside their snapshot (auditor's read + human read side by side)
  if (req.method === 'POST' && seg1 === 'submissions' && seg3 === 'note') {
    const submission = await col('submissions').get(seg2);
    if (!submission) return json(res, 404, { error: 'submission not found' });
    if (!(await teacherScope(user)).students.some((s) => s.id === submission.studentId)) {
      return json(res, 403, { error: 'not your student' });
    }
    const body = await readBody(req);
    await col('submissions').update(submission.id, {
      teacherNote: String(body.text || '').trim().slice(0, 2000),
      teacherNoteAt: now(),
    });
    return json(res, 200, { ok: true });
  }

  // POST /api/events — client-observed signals (copy, episode-save/resume)
  if (req.method === 'POST' && seg1 === 'events' && !seg2) {
    const body = await readBody(req);
    const allowed = ['copy', 'episode-save', 'episode-resume'];
    if (!allowed.includes(body.type)) return json(res, 400, { error: 'bad event type' });
    await logEvent(user, body);
    return json(res, 200, { ok: true });
  }

  return json(res, 404, { error: 'not found' });
}

// ---------- static ----------

// .png was missing until 2026-08-10, so the logo and every favicon went out as
// application/octet-stream and the browser had to sniff the bytes before it
// would treat them as images.
const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
};

// Nothing here is content-hashed, so a long max-age on markup or code would
// mean a deploy that users keep missing. Images are the exception: they are
// stable, and the fix for a changed one is to change its filename.
function cacheControl(route) {
  return route.startsWith('/assets/') ? 'public, max-age=604800' : 'no-cache';
}

// Pages are gated here rather than in the browser. Serving the shell to a
// signed-out visitor and letting api.js correct it on the first 401 meant the
// nav, the rail and "Current assignments" all painted before the redirect —
// a stranger saw a dashboard with no data in it, which reads as an error
// rather than as a sign-in wall.
//
// Same reasoning as the blocking theme script (designsystem.md, Theme
// selection): state that changes what you see has to resolve before first
// paint, not after it. Doing it server-side also means it holds with JS off,
// and covers all five surfaces in one place instead of each page re-deriving
// it. Which page an account gets is settled in the same place and for the same
// reason — see homePageFor.
//
// Only pages are gated. tokens.css, login.js, theme.js and the favicons stay
// public — gating those would leave the login page unable to render itself.
const PUBLIC_PAGES = new Set(['/login.html', '/set-password.html']);

// The set-password page is public, but only with a live token — so the token
// is resolved here, before the page is served, for the same reason sign-in is:
// state that changes what you see must settle before first paint, not after.
// A spent or expired link therefore lands on the sign-in page with the reason
// and the way to get a new one, rather than rendering a form that fails only
// once it has been filled in.
async function redirectedForBadToken(req, res, route) {
  if (route !== '/set-password.html') return false;
  const t = new URL(req.url, 'http://x').searchParams.get('t');
  const found = await inspectCredentialToken(t);
  if (found.ok) return false;
  const reason = found.reason === 'expired' ? 'expired' : 'invalid';
  res.writeHead(302, { Location: `/login.html?link=${reason}` });
  res.end();
  return true;
}

// Where an account starts. The login form used to be the only thing that knew
// this (login.js's ROLE_HOMES), so it only held for people who arrived by
// submitting that form — typing the bare domain, a bookmark, or a `next=` from
// an earlier bounce dropped a platform admin on the student app or the teacher
// dashboard instead.
//
// A school administrator homes to the dashboard rather than to admin.html: the
// grant sits on a teacher account (see canAdminPeople), and teaching is the job
// they do daily. Administration is one click away in the account menu.
function homePageFor(user) {
  if (isPlatformAdmin(user)) return '/admin.html';
  if (user.role === 'teacher') return '/dashboard.html';
  return '/index.html';
}

// Pages that only one kind of account can use. Everything behind them is
// already role-gated at the API, so without this a platform admin opening
// /dashboard.html got a dashboard that 403s its own data — a broken page rather
// than a redirect to the working one.
//
// index.html and report.html are deliberately absent: the student app doubles
// as the teacher's preview of it, and a report is gated by ownership rather
// than by role.
const PAGE_ACCESS = {
  '/admin.html': canAdminPeople,
  '/dashboard.html': (u) => u.role === 'teacher',
  '/teacher.html': (u) => u.role === 'teacher',
};

async function redirectedToOwnPage(req, res, route) {
  const isPage = route === '/' || route.endsWith('.html');
  if (!isPage || PUBLIC_PAGES.has(route)) return false;

  const user = await authenticate(req);
  if (!user) {
    // req.url, not route: a deep link like /report.html?id=… has to survive the
    // round trip. login.js already validates `next` against open redirects.
    res.writeHead(302, { Location: `/login.html?next=${encodeURIComponent(req.url)}` });
    res.end();
    return true;
  }

  // '/' is not a page of its own — it means "wherever this account starts".
  if (route !== '/') {
    const allowed = PAGE_ACCESS[route];
    if (!allowed || allowed(user)) return false;
  }

  res.writeHead(302, { Location: homePageFor(user) });
  res.end();
  return true;
}

function serveStatic(req, res, route) {
  const file = route === '/' ? 'index.html' : route.slice(1);
  const full = path.join(WEB_DIR, path.normalize(file));
  if (!full.startsWith(WEB_DIR) || !fs.existsSync(full)) {
    res.writeHead(404);
    return res.end('not found');
  }
  res.writeHead(200, {
    'Content-Type': MIME[path.extname(full)] || 'application/octet-stream',
    'Cache-Control': cacheControl(route),
  });
  fs.createReadStream(full).pipe(res);
}

// ---------- boot ----------

// Seeding is a write to Firestore now, so it has to finish before the first
// request rather than racing it — the JSON store made this look synchronous.
const server = http.createServer(async (req, res) => {
  // Outside the try this takes the process down: a request for '//' parses as
  // protocol-relative with an empty host and throws. Crawlers and browsers do
  // send it, so an unguarded parse here is a one-request denial of service.
  let route;
  try {
    route = new URL(req.url, 'http://x').pathname;
  } catch {
    return json(res, 400, { error: 'bad request path' });
  }

  try {
    if (route.startsWith('/api/')) {
      if (await handleAuth(req, res, route)) return;
      const user = await authenticate(req);
      if (!user) return json(res, 401, { error: 'not signed in' });
      await handleApi(req, res, user, route);
    } else {
      if (await redirectedForBadToken(req, res, route)) return;
      if (await redirectedToOwnPage(req, res, route)) return;
      serveStatic(req, res, route);
    }
  } catch (err) {
    console.error(err);
    if (!res.headersSent) json(res, 500, { error: err.message });
    else res.end();
  }
});

seed()
  .then(() => {
    server.listen(PORT, () => console.log(`CTA dev server: http://localhost:${PORT}`));
  })
  .catch((err) => {
    console.error('seed failed — not starting the server:', err);
    process.exit(1);
  });
