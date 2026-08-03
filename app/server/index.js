// Path B dev server. Zero dependencies — node:http, SSE for streaming.
// Prod shape: this becomes the Cloud Run proxy; auth/llm/store seams swap to
// Firebase Auth / Vertex / Firestore without touching route logic.

const http = require('http');
const fs = require('fs');
const path = require('path');
const { col } = require('./store');
const { authenticate, login, logout, sessionCookie, clearedCookie, tokenFrom, setPassword } = require('./auth');
const { streamChat, MAX_EVAL_TOKENS } = require('./llm');
const { LEVELS, coachMessages, auditorMessages } = require('./coach');
const { runAnalysis } = require('./analysis');
const { seed } = require('./seed');
const { DEV_PASSWORD } = require('./seed-data');

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

// Turns are append-only: an edit or regeneration appends a new turn whose
// meta.supersedes lists the turn ids it replaces. "Live" = not superseded.
function liveTurns(turns) {
  const dead = new Set(turns.flatMap((t) => t.meta?.supersedes || []));
  return turns.filter((t) => !dead.has(t.id));
}

function conversationTurns(conversationId) {
  return col('turns')
    .list((t) => t.conversationId === conversationId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

function logEvent(user, { type, sessionId, conversationId, meta }) {
  col('events').add({
    studentId: user.id,
    sessionId: sessionId || null,
    conversationId: conversationId || null,
    type,
    ts: now(),
    meta: meta || {},
  });
}

function sessionFor(conversation) {
  return col('sessions').get(conversation.sessionId);
}

function assignmentFor(session) {
  return col('assignments').get(session.assignmentId);
}

// Composes the three teacher-authored fields into the one string the
// blank-context coach/auditor see as "the assignment" — labeled so the model
// gets the what/why/must-haves distinction, not a single run-on paragraph.
function assignmentBrief(a) {
  return [
    a.description ? `What the task is:\n${a.description}` : '',
    a.purpose ? `Why this matters:\n${a.purpose}` : '',
    a.requirements ? `Requirements:\n${a.requirements}` : '',
  ].filter(Boolean).join('\n\n');
}

// ---------- SSE coach/auditor streaming ----------

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

async function streamReply({ res, user, conversation, messages, role, maxTokens, replyMeta }) {
  sseHead(res);
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
    turn = col('turns').add({
      conversationId: conversation.id,
      role,
      text,
      createdAt: now(),
      meta: { ...replyMeta, ...(stopped ? { stopped: true } : {}) },
    });
    col('conversations').update(conversation.id, { lastActiveAt: now() });
  }
  if (stopped) {
    logEvent(user, { type: 'stop', sessionId: conversation.sessionId, conversationId: conversation.id, meta: { turnId: turn?.id } });
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
    const result = login(body.email, body.password);
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

  if (req.method === 'POST' && route === '/api/auth/logout') {
    const token = tokenFrom(req);
    if (token) logout(token);
    res.writeHead(200, { 'Content-Type': 'application/json', 'Set-Cookie': clearedCookie() });
    res.end(JSON.stringify({ ok: true }));
    return true;
  }

  return false;
}

// ---------- routes ----------

async function handleApi(req, res, user, route) {
  const [, , seg1, seg2, seg3] = route.split('/'); // /api/<seg1>/<seg2>/<seg3>

  // GET /api/me — never spread the raw user doc; it carries the password hash
  if (req.method === 'GET' && seg1 === 'me' && !seg2) {
    return json(res, 200, {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
    });
  }

  // GET /api/student/home — everything the student home view needs in one call
  if (req.method === 'GET' && seg1 === 'student' && seg2 === 'home') {
    const current = [];
    const past = [];
    const trend = [];

    for (const a of col('assignments').list()) {
      const submissions = col('submissions')
        .list((s) => s.assignmentId === a.id && s.studentId === user.id)
        .sort((x, y) => x.cycleIndex - y.cycleIndex);

      const drafts = submissions.map((sub) => {
        const analysis = sub.analysisId ? col('analyses').get(sub.analysisId) : null;
        const complete = analysis?.status === 'complete';
        if (complete) trend.push({ submittedAt: sub.submittedAt, totalScore: analysis.tau.totalScore });
        return {
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
        };
      });

      const done = submissions.length >= a.draftBudget;
      const active = col('sessions').list(
        (s) => s.assignmentId === a.id && s.studentId === user.id && s.status === 'active'
      )[0];

      if (done) {
        past.push({
          id: a.id, title: a.title, dueDate: a.dueDate, draftDueDates: a.draftDueDates,
          draftBudget: a.draftBudget, drafts,
        });
      } else {
        // Live conversations in the open session — "where you left off" is part
        // of the card's hierarchy, not something to rediscover by opening it.
        const openConvs = active
          ? col('conversations').list((c) => c.sessionId === active.id)
          : [];
        const lastActiveAt = openConvs.length
          ? openConvs.map((c) => c.lastActiveAt || c.createdAt).sort().pop()
          : null;
        // The current draft's own state — distinct from the assignment's overall
        // state. A submission on draft 1 does not make draft 2 "in progress": it
        // is only in progress once the student has actually sent a message.
        const hasActivity = openConvs.some(
          (c) => col('turns').list((t) => t.conversationId === c.id).length > 0
        );
        current.push({
          id: a.id,
          title: a.title,
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
    return json(res, 200, {
      student: { displayName: user.displayName, email: user.email },
      current,
      past,
      trend,
    });
  }

  // GET /api/assignments — list with per-student status
  if (req.method === 'GET' && seg1 === 'assignments' && !seg2) {
    // An assignment with no classIds (seeded/created before classes existed)
    // is visible to everyone; otherwise the student must be in one of the
    // assignment's classes — without this, every student saw every class's
    // assignments once a second/third class existed.
    const myClassIds = new Set(col('classes').list((c) => c.studentIds.includes(user.id)).map((c) => c.id));
    const assignments = col('assignments')
      .list((a) => !a.classIds || !a.classIds.length || a.classIds.some((id) => myClassIds.has(id)))
      .map((a) => {
        const submissions = col('submissions').list((s) => s.assignmentId === a.id && s.studentId === user.id);
        const active = col('sessions').list((s) => s.assignmentId === a.id && s.studentId === user.id && s.status === 'active')[0];
        return {
          id: a.id,
          title: a.title,
          description: a.description,
          purpose: a.purpose,
          requirements: a.requirements,
          dueDate: a.dueDate,
          draftBudget: a.draftBudget,
          draftsUsed: submissions.length,
          status: submissions.length >= a.draftBudget ? 'complete' : active ? 'in-progress' : 'not-started',
        };
      });
    return json(res, 200, assignments);
  }

  // POST /api/assignments/:id/open — get-or-create the active session (cycle)
  if (req.method === 'POST' && seg1 === 'assignments' && seg3 === 'open') {
    const assignment = col('assignments').get(seg2);
    if (!assignment) return json(res, 404, { error: 'assignment not found' });

    const submissions = col('submissions').list((s) => s.assignmentId === assignment.id && s.studentId === user.id);
    let session = col('sessions').list((s) => s.assignmentId === assignment.id && s.studentId === user.id && s.status === 'active')[0];

    if (!session && submissions.length < assignment.draftBudget) {
      const cycleIndex = submissions.length;
      const levels = assignment.coachingLevels;
      session = col('sessions').add({
        assignmentId: assignment.id,
        studentId: user.id,
        cycleIndex,
        coachingLevel: levels[Math.min(cycleIndex, levels.length - 1)],
        status: 'active',
        startedAt: now(),
        submittedAt: null,
      });
    }

    // Submitted conversations stay readable (input-locked), so send every
    // cycle's conversations, newest session first.
    const sessions = col('sessions')
      .list((s) => s.assignmentId === assignment.id && s.studentId === user.id)
      .sort((a, b) => b.cycleIndex - a.cycleIndex);
    const conversations = sessions.flatMap((s) =>
      col('conversations')
        .list((c) => c.sessionId === s.id)
        .sort((a, b) => b.lastActiveAt.localeCompare(a.lastActiveAt))
        .map((c) => ({ ...c, cycleIndex: s.cycleIndex }))
    );

    // Same "has the student actually done anything on this draft yet" signal
    // as the home view — a session existing (or an empty first conversation)
    // isn't activity; a sent message is.
    const hasActivity = session
      ? conversations
          .filter((c) => c.cycleIndex === session.cycleIndex)
          .some((c) => col('turns').list((t) => t.conversationId === c.id).length > 0)
      : false;

    return json(res, 200, {
      assignment,
      session: session || null,
      conversations,
      draftsUsed: submissions.length,
      hasActivity,
      coachLabel: session ? LEVELS[session.coachingLevel].label : null,
      modeLead: session ? LEVELS[session.coachingLevel].modeLead : null,
      modeNote: session ? LEVELS[session.coachingLevel].modeNote : null,
    });
  }

  // POST /api/conversations { sessionId, title? }
  if (req.method === 'POST' && seg1 === 'conversations' && !seg2) {
    const body = await readBody(req);
    const session = col('sessions').get(body.sessionId);
    if (!session || session.studentId !== user.id) return json(res, 404, { error: 'session not found' });
    if (session.status !== 'active') return json(res, 409, { error: 'session is submitted' });
    const conversation = col('conversations').add({
      sessionId: session.id,
      title: body.title || 'New conversation',
      createdAt: now(),
      lastActiveAt: now(),
      locked: false,
    });
    return json(res, 200, conversation);
  }

  if (seg1 === 'conversations' && seg2) {
    const conversation = col('conversations').get(seg2);
    if (!conversation) return json(res, 404, { error: 'conversation not found' });
    const session = sessionFor(conversation);
    if (session.studentId !== user.id) return json(res, 403, { error: 'forbidden' });
    const assignment = assignmentFor(session);

    // GET /api/conversations/:id
    if (req.method === 'GET' && !seg3) {
      return json(res, 200, {
        conversation,
        turns: liveTurns(conversationTurns(conversation.id)),
        coachingLevel: session.coachingLevel,
        locked: conversation.locked,
      });
    }

    // POST /api/conversations/:id/rename — rename ok, delete deliberately absent
    if (req.method === 'POST' && seg3 === 'rename') {
      const body = await readBody(req);
      col('conversations').update(conversation.id, { title: String(body.title || '').slice(0, 80) || conversation.title });
      return json(res, 200, { ok: true });
    }

    if (conversation.locked) return json(res, 409, { error: 'conversation is locked' });

    // POST /api/conversations/:id/message { text, editOfTurnId? }
    if (req.method === 'POST' && seg3 === 'message') {
      const body = await readBody(req);
      const text = String(body.text || '').trim();
      if (!text) return json(res, 400, { error: 'empty message' });

      const prior = liveTurns(conversationTurns(conversation.id));
      const supersedes = [];
      if (body.editOfTurnId) {
        // Editing replaces the old student turn AND the coach reply that
        // followed it — both stay in the record, superseded.
        const idx = prior.findIndex((t) => t.id === body.editOfTurnId);
        if (idx === -1 || prior[idx].role !== 'student') return json(res, 400, { error: 'bad editOfTurnId' });
        supersedes.push(...prior.slice(idx).map((t) => t.id));
        logEvent(user, { type: 'edit', sessionId: session.id, conversationId: conversation.id, meta: { editOf: body.editOfTurnId } });
      }

      const studentTurn = col('turns').add({
        conversationId: conversation.id,
        role: 'student',
        text,
        createdAt: now(),
        meta: supersedes.length ? { supersedes, editOf: body.editOfTurnId } : {},
      });

      const turns = liveTurns(conversationTurns(conversation.id));
      const messages = coachMessages({ level: session.coachingLevel, assignmentPrompt: assignmentBrief(assignment), turns });
      return streamReply({
        res, user, conversation, messages,
        role: 'coach',
        replyMeta: { inReplyTo: studentTurn.id },
      });
    }

    // POST /api/conversations/:id/regenerate — implicit rejection signal
    if (req.method === 'POST' && seg3 === 'regenerate') {
      // Auditor meta-turns don't block regeneration — the target is the last
      // coach turn in the real conversation.
      const turns = liveTurns(conversationTurns(conversation.id)).filter((t) => !t.meta?.metaTurn);
      const last = turns[turns.length - 1];
      if (!last || last.role !== 'coach') return json(res, 400, { error: 'nothing to regenerate' });
      logEvent(user, { type: 'regenerate', sessionId: session.id, conversationId: conversation.id, meta: { turnId: last.id } });

      const context = turns.slice(0, -1);
      const messages = coachMessages({ level: session.coachingLevel, assignmentPrompt: assignmentBrief(assignment), turns: context });
      return streamReply({
        res, user, conversation, messages,
        role: 'coach',
        replyMeta: { supersedes: [last.id], regenerated: true },
      });
    }

    // POST /api/conversations/:id/evaluate — summon the auditor.
    // Exchange is a meta-turn (excluded from TAU); the invocation itself is
    // the metacognitive signal.
    if (req.method === 'POST' && seg3 === 'evaluate') {
      logEvent(user, { type: 'evaluate', sessionId: session.id, conversationId: conversation.id });
      const turns = liveTurns(conversationTurns(conversation.id));
      const messages = auditorMessages({ assignmentPrompt: assignmentBrief(assignment), turns });
      return streamReply({
        res, user, conversation, messages,
        role: 'auditor',
        maxTokens: MAX_EVAL_TOKENS,
        replyMeta: { metaTurn: true },
      });
    }
  }

  // POST /api/sessions/:id/submit { essayText } — the hard marker: locks every
  // conversation in the cycle and bundles ALL of them (no selective evidence).
  if (req.method === 'POST' && seg1 === 'sessions' && seg3 === 'submit') {
    const session = col('sessions').get(seg2);
    if (!session || session.studentId !== user.id) return json(res, 404, { error: 'session not found' });
    if (session.status !== 'active') return json(res, 409, { error: 'already submitted' });
    const body = await readBody(req);
    const essayText = String(body.essayText || '').trim();
    if (!essayText) return json(res, 400, { error: 'essay draft required' });

    for (const c of col('conversations').list((c) => c.sessionId === session.id)) {
      col('conversations').update(c.id, { locked: true });
    }
    col('sessions').update(session.id, { status: 'submitted', submittedAt: now() });
    const submission = col('submissions').add({
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
    return json(res, 200, { submission: col('submissions').get(submission.id) });
  }

  // POST /api/submissions/:id/reanalyze — retry path for failed analyses
  if (req.method === 'POST' && seg1 === 'submissions' && seg3 === 'reanalyze') {
    const submission = col('submissions').get(seg2);
    if (!submission) return json(res, 404, { error: 'submission not found' });
    if (submission.studentId !== user.id && user.role !== 'teacher') return json(res, 403, { error: 'forbidden' });
    const existing = submission.analysisId && col('analyses').get(submission.analysisId);
    if (existing && existing.status === 'pending') return json(res, 409, { error: 'analysis already running' });
    runAnalysis(submission.id).catch((err) => console.error(err));
    return json(res, 200, { ok: true });
  }

  // GET /api/submissions?assignmentId=…
  if (req.method === 'GET' && seg1 === 'submissions' && !seg2) {
    const assignmentId = new URL(req.url, 'http://x').searchParams.get('assignmentId');
    const submissions = col('submissions')
      .list((s) => s.studentId === user.id && (!assignmentId || s.assignmentId === assignmentId))
      .sort((a, b) => a.cycleIndex - b.cycleIndex)
      .map((s) => {
        const analysis = s.analysisId ? col('analyses').get(s.analysisId) : null;
        const complete = analysis?.status === 'complete';
        return {
          id: s.id,
          cycleIndex: s.cycleIndex,
          submittedAt: s.submittedAt,
          analysisStatus: analysis?.status || null,
          // Score summary only — flags stay teacher-only, enforced by never selecting them.
          tau: complete ? { totalScore: analysis.tau.totalScore, SAMR: analysis.tau.SAMR } : null,
        };
      });
    return json(res, 200, submissions);
  }

  // GET /api/submissions/:id/report — full TAU disclosure at the draft
  // marker (revised 2026-07-16). Integrity flags remain teacher-only.
  if (req.method === 'GET' && seg1 === 'submissions' && seg3 === 'report') {
    const submission = col('submissions').get(seg2);
    if (!submission) return json(res, 404, { error: 'submission not found' });
    const isTeacher = user.role === 'teacher';
    if (!isTeacher && submission.studentId !== user.id) return json(res, 403, { error: 'forbidden' });

    const analysis = submission.analysisId ? col('analyses').get(submission.analysisId) : null;
    const report = analysis && {
      ...analysis,
      ...(isTeacher ? {} : { flags: undefined }),
    };

    // The nav's breadcrumb and its "Conversation" toggle both need to name
    // and link back to the assignment this draft belongs to — neither was
    // on the wire before the shared nav existed.
    const assignment = col('assignments').get(submission.assignmentId);

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
    const submission = col('submissions').get(seg2);
    if (!submission) return json(res, 404, { error: 'submission not found' });
    const isTeacher = user.role === 'teacher';
    if (!isTeacher && submission.studentId !== user.id) return json(res, 403, { error: 'forbidden' });

    const conversations = col('conversations')
      .list((c) => c.sessionId === submission.sessionId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map((c) => ({ ...c, turns: liveTurns(conversationTurns(c.id)) }));

    return json(res, 200, { conversations });
  }

  // ---------- teacher routes ----------

  if (seg1 === 'teacher' || (req.method === 'POST' && seg1 === 'assignments' && (!seg2 || seg3 === 'note' || seg3 === 'edit')) || (req.method === 'POST' && seg1 === 'submissions' && seg3 === 'note') || (req.method === 'POST' && seg1 === 'classes')) {
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
    const valid = new Set(Object.keys(LEVELS));
    const coachingLevels = (Array.isArray(body.coachingLevels) ? body.coachingLevels : [])
      .filter((l) => valid.has(l))
      .slice(0, draftBudget);
    if (!title || !description || !purpose || !requirements) {
      return json(res, 400, { error: 'title, description, purpose, and requirements are required' });
    }
    if (coachingLevels.length !== draftBudget) return json(res, 400, { error: 'one coaching level per draft slot required' });
    // No class picker in the creation form yet — an assignment with no
    // classIds sent defaults to every class this teacher has, so existing
    // creation flow behaves the same as before classes existed.
    const allClassIds = col('classes').list((c) => c.teacherId === user.id).map((c) => c.id);
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
    const assignment = col('assignments').add({
      teacherId: user.id,
      classIds,
      title,
      description,
      purpose,
      requirements,
      dueDate: draftDueDates[draftDueDates.length - 1],
      draftBudget,
      draftDueDates,
      coachingLevels,
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
    const assignment = col('assignments').get(seg2);
    if (!assignment) return json(res, 404, { error: 'assignment not found' });
    const body = await readBody(req);
    const title = String(body.title || '').trim();
    const description = String(body.description || '').trim();
    const purpose = String(body.purpose || '').trim();
    const requirements = String(body.requirements || '').trim();
    const draftBudget = Math.max(1, Math.min(10, parseInt(body.draftBudget, 10) || 3));
    const valid = new Set(Object.keys(LEVELS));
    const coachingLevels = (Array.isArray(body.coachingLevels) ? body.coachingLevels : [])
      .filter((l) => valid.has(l))
      .slice(0, draftBudget);
    if (!title || !description || !purpose || !requirements) {
      return json(res, 400, { error: 'title, description, purpose, and requirements are required' });
    }
    if (coachingLevels.length !== draftBudget) return json(res, 400, { error: 'one coaching level per draft slot required' });
    const draftDueDates = (Array.isArray(body.draftDueDates) ? body.draftDueDates : []).slice(0, draftBudget);
    if (draftDueDates.length !== draftBudget || draftDueDates.some((d) => !d || Number.isNaN(new Date(d).getTime()))) {
      return json(res, 400, { error: 'one due date per draft slot required' });
    }
    for (let i = 1; i < draftDueDates.length; i++) {
      if (new Date(draftDueDates[i]) < new Date(draftDueDates[i - 1])) {
        return json(res, 400, { error: 'draft due dates must be in ascending order' });
      }
    }
    const maxCycle = col('submissions')
      .list((s) => s.assignmentId === assignment.id)
      .reduce((max, s) => Math.max(max, s.cycleIndex), -1);
    if (draftBudget <= maxCycle) {
      return json(res, 400, { error: `can't reduce draft budget below ${maxCycle + 1} — a student has already submitted that many drafts` });
    }
    const classIds = Array.isArray(body.classIds) && body.classIds.length ? body.classIds : assignment.classIds;
    const noteChanged = typeof body.teacherNote === 'string' && body.teacherNote.trim() !== (assignment.teacherNote || '');
    col('assignments').update(assignment.id, {
      title, description, purpose, requirements, classIds,
      dueDate: draftDueDates[draftDueDates.length - 1],
      draftBudget, draftDueDates, coachingLevels,
      teacherNote: typeof body.teacherNote === 'string' ? body.teacherNote.trim().slice(0, 2000) : (assignment.teacherNote || ''),
      teacherNoteAt: noteChanged ? now() : assignment.teacherNoteAt,
    });
    return json(res, 200, col('assignments').get(assignment.id));
  }

  // POST /api/classes — create a class (teacher). First half of "teacher
  // creates a class, adds students" — manual roster management for now,
  // ahead of the documented Google SSO plan (see auth.js's own header
  // comment for why this POC still has a password path at all).
  if (req.method === 'POST' && seg1 === 'classes' && !seg2) {
    const body = await readBody(req);
    const name = String(body.name || '').trim();
    if (!name) return json(res, 400, { error: 'class name is required' });
    const classDoc = col('classes').add({
      teacherId: user.id,
      name,
      studentIds: [],
      createdAt: now(),
    });
    return json(res, 200, classDoc);
  }

  // POST /api/classes/:id/students — add or remove a student on this
  // class's roster. Two shapes on one route rather than a second URL: the
  // minimal router here only destructures three path segments
  // (`seg1/seg2/seg3`, see that declaration above), so a fourth segment for
  // a student id on a DELETE-style route isn't reachable without extending
  // that — branching on the body is simpler than widening the router for
  // one route.
  //   { email, displayName } → add. Finds an existing student account by
  //     email, or provisions a new one. New accounts get the same shared
  //     dev password every seeded account already uses (`DEV_PASSWORD`) —
  //     there's no email delivery in this POC to hand a generated one to,
  //     and no self-serve signup yet; real per-student passwords go away
  //     entirely once Google SSO lands, per auth.js's own plan.
  //   { studentId, remove: true } → remove from this class's roster only —
  //     the account itself isn't deleted, since the student may belong to
  //     another class.
  if (req.method === 'POST' && seg1 === 'classes' && seg3 === 'students') {
    const classDoc = col('classes').get(seg2);
    if (!classDoc) return json(res, 404, { error: 'class not found' });
    if (classDoc.teacherId !== user.id) return json(res, 403, { error: 'not your class' });
    const body = await readBody(req);

    if (body.remove) {
      const studentIds = (classDoc.studentIds || []).filter((id) => id !== body.studentId);
      col('classes').update(classDoc.id, { studentIds });
      return json(res, 200, col('classes').get(classDoc.id));
    }

    const email = String(body.email || '').trim().toLowerCase();
    const displayName = String(body.displayName || '').trim();
    if (!email || !email.includes('@')) return json(res, 400, { error: 'a valid email is required' });

    let student = col('users').list((u) => u.email.toLowerCase() === email)[0];
    if (student && student.role !== 'student') {
      return json(res, 400, { error: 'that email belongs to a non-student account' });
    }
    if (!student) {
      if (!displayName) return json(res, 400, { error: 'name is required for a new student' });
      student = col('users').add({ email, displayName, role: 'student', createdAt: now() });
      setPassword(student, DEV_PASSWORD);
    }

    const studentIds = classDoc.studentIds || [];
    if (!studentIds.includes(student.id)) {
      col('classes').update(classDoc.id, { studentIds: [...studentIds, student.id] });
    }
    // Never the raw user doc past this point — passwordHash/passwordSalt
    // have no business leaving the server, same sanitization /api/me and
    // every other user-returning route already applies.
    const savedStudent = col('users').get(student.id);
    return json(res, 200, {
      class: col('classes').get(classDoc.id),
      student: { id: savedStudent.id, email: savedStudent.email, displayName: savedStudent.displayName },
    });
  }

  // POST /api/assignments/:id/note — set or clear the assignment-wide
  // teacher note (distinct from a per-submission note: this one isn't tied
  // to any single draft's report, so it lives on the assignment record).
  if (req.method === 'POST' && seg1 === 'assignments' && seg3 === 'note') {
    const assignment = col('assignments').get(seg2);
    if (!assignment) return json(res, 404, { error: 'assignment not found' });
    const body = await readBody(req);
    col('assignments').update(assignment.id, {
      teacherNote: String(body.text || '').trim().slice(0, 2000),
      teacherNoteAt: now(),
    });
    return json(res, 200, { ok: true });
  }

  // GET /api/teacher/dashboard — feeds the ported triage dashboard
  // (dashboard.html) in the exact shape its mock generator produced:
  // { assignments, students, classes, submissions }
  if (req.method === 'GET' && seg1 === 'teacher' && seg2 === 'dashboard') {
    const students = col('users').list((u) => u.role === 'student');
    const classes = col('classes').list();
    // An assignment seeded/created before classes existed (or omitted at
    // creation) has no classIds — treat it as visible to every class rather
    // than to none, so it doesn't silently vanish from the dashboard.
    const allClassIds = classes.map((c) => c.id);
    const assignments = col('assignments').list().map((a) => ({
      id: a.id,
      name: a.title,
      due: a.dueDate || new Date(new Date(a.createdAt).getTime() + 14 * 86400000).toISOString(),
      status: a.dueDate && new Date(a.dueDate) < new Date() ? 'closed' : 'open',
      draftBudget: a.draftBudget,
      draftDueDates: a.draftDueDates || null,
      classIds: a.classIds && a.classIds.length ? a.classIds : allClassIds,
      // The assignment's own goal — shown to the coach every session
      // (description/purpose/requirements) and a whole-class rubric-style
      // reminder (teacherNote, distinct from a per-submission teacherNote).
      // Neither was ever sent to the teacher dashboard before the Assignment
      // Detail timeline redesign; both already existed on the assignment record.
      description: a.description || null,
      purpose: a.purpose || null,
      requirements: a.requirements || null,
      teacherNote: a.teacherNote || null,
    }));

    const submissions = {};
    for (const s of students) {
      for (const a of assignments) {
        submissions[`${s.id}_${a.id}`] = col('submissions')
          .list((sub) => sub.studentId === s.id && sub.assignmentId === a.id)
          .sort((x, y) => x.cycleIndex - y.cycleIndex)
          .map((sub) => {
            const analysis = sub.analysisId ? col('analyses').get(sub.analysisId) : null;
            const done = analysis?.status === 'complete';
            // One session per (student, assignment, cycleIndex) under the
            // current model (a draft's active session is reused, never
            // duplicated — see store.js), but a student can open more than
            // one *conversation* inside that same session (a "new chat"
            // without submitting). Conversation count is the real proxy for
            // "did they restart with a fresh context instead of extending
            // one long thread" — feeds the Assignment Detail timeline's
            // per-draft usage note.
            const session = col('sessions').list(
              (se) => se.assignmentId === a.id && se.studentId === s.id && se.cycleIndex === sub.cycleIndex
            )[0];
            const conversationCount = session
              ? col('conversations').list((c) => c.sessionId === session.id).length
              : 0;
            return {
              id: sub.id,
              ts: sub.submittedAt,
              cycleIndex: sub.cycleIndex,
              pq: done ? analysis.tau.PQ : 0,
              su: done ? analysis.tau.SU : 0,
              cs: done ? analysis.tau.CS : 0,
              oc: done ? analysis.tau.OC : 0,
              analysisStatus: analysis?.status || 'missing',
              coachingLevel: analysis?.coachingLevel || null,
              conversationCount,
              // Per-submission origin mix (student-born/synthesized/ai-born
              // counts) — already computed for OC scoring, never surfaced
              // before now. Feeds the assignment-level provenance aggregate
              // in dashboard.html; null when provenance tracing didn't run
              // (regex-fallback path has no provenance data).
              provenance: done ? (analysis.tau.provenanceCounts || null) : null,
              ...(done && analysis.flags?.length ? { integrityFlags: analysis.flags.map((f) => f.flag) } : {}),
            };
          });
      }
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
      submissions,
    });
  }

  // GET /api/teacher/assignments — all assignments with roster summary
  if (req.method === 'GET' && seg1 === 'teacher' && seg2 === 'assignments' && !seg3) {
    const students = col('users').list((u) => u.role === 'student');
    const assignments = col('assignments').list().map((a) => ({
      ...a,
      roster: students.map((s) => {
        const submissions = col('submissions')
          .list((sub) => sub.assignmentId === a.id && sub.studentId === s.id)
          .sort((x, y) => x.cycleIndex - y.cycleIndex);
        const active = col('sessions').list((se) => se.assignmentId === a.id && se.studentId === s.id && se.status === 'active')[0];
        return {
          studentId: s.id,
          displayName: s.displayName,
          email: s.email,
          activeSession: !!active,
          cycles: submissions.map((sub) => {
            const analysis = sub.analysisId ? col('analyses').get(sub.analysisId) : null;
            return {
              submissionId: sub.id,
              cycleIndex: sub.cycleIndex,
              submittedAt: sub.submittedAt,
              analysisStatus: analysis?.status || null,
              tau: analysis?.status === 'complete' ? { PQ: analysis.tau.PQ, SU: analysis.tau.SU, CS: analysis.tau.CS, OC: analysis.tau.OC, totalScore: analysis.tau.totalScore, SAMR: analysis.tau.SAMR } : null,
              coachingLevel: analysis?.coachingLevel || null,
              flagCount: analysis?.flags?.length || 0,
              hasNote: !!sub.teacherNote,
            };
          }),
        };
      }),
    }));
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
    const assignment = col('assignments').get(aid);
    const student = col('users').get(sid);
    if (!assignment || !student) return json(res, 404, { error: 'not found' });

    const sessions = col('sessions')
      .list((s) => s.assignmentId === aid && s.studentId === sid)
      .sort((a, b) => a.cycleIndex - b.cycleIndex)
      .map((session) => {
        const conversations = col('conversations')
          .list((c) => c.sessionId === session.id)
          .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
          .map((conv) => {
            const turns = conversationTurns(conv.id);
            const dead = new Set(turns.flatMap((t) => t.meta?.supersedes || []));
            return {
              ...conv,
              turns: turns.map((t) => ({
                ...t,
                superseded: dead.has(t.id),
                metaTurn: !!t.meta?.metaTurn,
              })),
            };
          });
        const events = col('events')
          .list((e) => e.sessionId === session.id)
          .sort((a, b) => a.ts.localeCompare(b.ts));
        const submission = col('submissions').list((s) => s.sessionId === session.id)[0] || null;
        const analysis = submission?.analysisId ? col('analyses').get(submission.analysisId) : null;
        return { session, conversations, events, submission, analysis };
      });

    return json(res, 200, { assignment, student, sessions });
  }

  // POST /api/submissions/:id/note — teacher note, shown to the student
  // beside their snapshot (auditor's read + human read side by side)
  if (req.method === 'POST' && seg1 === 'submissions' && seg3 === 'note') {
    const submission = col('submissions').get(seg2);
    if (!submission) return json(res, 404, { error: 'submission not found' });
    const body = await readBody(req);
    col('submissions').update(submission.id, {
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
    logEvent(user, body);
    return json(res, 200, { ok: true });
  }

  return json(res, 404, { error: 'not found' });
}

// ---------- static ----------

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };

function serveStatic(req, res, route) {
  const file = route === '/' ? 'index.html' : route.slice(1);
  const full = path.join(WEB_DIR, path.normalize(file));
  if (!full.startsWith(WEB_DIR) || !fs.existsSync(full)) {
    res.writeHead(404);
    return res.end('not found');
  }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(full)] || 'application/octet-stream' });
  fs.createReadStream(full).pipe(res);
}

// ---------- boot ----------

seed();

http.createServer(async (req, res) => {
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
      const user = authenticate(req);
      if (!user) return json(res, 401, { error: 'not signed in' });
      await handleApi(req, res, user, route);
    } else {
      serveStatic(req, res, route);
    }
  } catch (err) {
    console.error(err);
    if (!res.headersSent) json(res, 500, { error: err.message });
    else res.end();
  }
}).listen(PORT, () => {
  console.log(`CTA dev server: http://localhost:${PORT}`);
});
