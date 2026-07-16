// Path B dev server. Zero dependencies — node:http, SSE for streaming.
// Prod shape: this becomes the Cloud Run proxy; auth/llm/store seams swap to
// Firebase Auth / Vertex / Firestore without touching route logic.

const http = require('http');
const fs = require('fs');
const path = require('path');
const { col } = require('./store');
const { authenticate } = require('./auth');
const { streamChat, MAX_EVAL_TOKENS } = require('./llm');
const { LEVELS, coachMessages, auditorMessages } = require('./coach');
const { runAnalysis } = require('./analysis');
const { seed } = require('./seed');

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

// ---------- routes ----------

async function handleApi(req, res, user, route) {
  const [, , seg1, seg2, seg3] = route.split('/'); // /api/<seg1>/<seg2>/<seg3>

  // GET /api/me
  if (req.method === 'GET' && seg1 === 'me' && !seg2) {
    return json(res, 200, user);
  }

  // GET /api/assignments — list with per-student status
  if (req.method === 'GET' && seg1 === 'assignments' && !seg2) {
    const assignments = col('assignments').list().map((a) => {
      const submissions = col('submissions').list((s) => s.assignmentId === a.id && s.studentId === user.id);
      const active = col('sessions').list((s) => s.assignmentId === a.id && s.studentId === user.id && s.status === 'active')[0];
      return {
        id: a.id,
        title: a.title,
        prompt: a.prompt,
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

    return json(res, 200, {
      assignment,
      session: session || null,
      conversations,
      draftsUsed: submissions.length,
      coachLabel: session ? LEVELS[session.coachingLevel].label : null,
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
      const messages = coachMessages({ level: session.coachingLevel, assignmentPrompt: assignment.prompt, turns });
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
      const messages = coachMessages({ level: session.coachingLevel, assignmentPrompt: assignment.prompt, turns: context });
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
      const messages = auditorMessages({ assignmentPrompt: assignment.prompt, turns });
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
      .map((s) => ({
        id: s.id,
        cycleIndex: s.cycleIndex,
        submittedAt: s.submittedAt,
        analysisStatus: s.analysisId ? col('analyses').get(s.analysisId)?.status : null,
      }));
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
    return json(res, 200, {
      submission: {
        id: submission.id,
        cycleIndex: submission.cycleIndex,
        submittedAt: submission.submittedAt,
        essayText: submission.essayText,
        teacherNote: submission.teacherNote || null,
      },
      analysis: report,
    });
  }

  // ---------- teacher routes ----------

  if (seg1 === 'teacher' || (req.method === 'POST' && seg1 === 'assignments' && !seg2) || (req.method === 'POST' && seg1 === 'submissions' && seg3 === 'note')) {
    if (user.role !== 'teacher') return json(res, 403, { error: 'teacher only' });
  }

  // POST /api/assignments — create (teacher)
  if (req.method === 'POST' && seg1 === 'assignments' && !seg2) {
    const body = await readBody(req);
    const title = String(body.title || '').trim();
    const prompt = String(body.prompt || '').trim();
    const draftBudget = Math.max(1, Math.min(10, parseInt(body.draftBudget, 10) || 3));
    const valid = new Set(Object.keys(LEVELS));
    const coachingLevels = (Array.isArray(body.coachingLevels) ? body.coachingLevels : [])
      .filter((l) => valid.has(l))
      .slice(0, draftBudget);
    if (!title || !prompt) return json(res, 400, { error: 'title and prompt required' });
    if (coachingLevels.length !== draftBudget) return json(res, 400, { error: 'one coaching level per draft slot required' });
    const assignment = col('assignments').add({
      teacherId: user.id,
      title,
      prompt,
      dueDate: body.dueDate || null,
      draftBudget,
      coachingLevels,
      createdAt: now(),
    });
    return json(res, 200, assignment);
  }

  // GET /api/teacher/dashboard — feeds the ported triage dashboard
  // (dashboard.html) in the exact shape its mock generator produced:
  // { assignments, students, classes, submissions }
  if (req.method === 'GET' && seg1 === 'teacher' && seg2 === 'dashboard') {
    const students = col('users').list((u) => u.role === 'student');
    const assignments = col('assignments').list().map((a) => ({
      id: a.id,
      name: a.title,
      due: a.dueDate || new Date(new Date(a.createdAt).getTime() + 14 * 86400000).toISOString(),
      status: a.dueDate && new Date(a.dueDate) < new Date() ? 'closed' : 'open',
      draftBudget: a.draftBudget,
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
            return {
              id: sub.id,
              ts: sub.submittedAt,
              pq: done ? analysis.tau.PQ : 0,
              su: done ? analysis.tau.SU : 0,
              cs: done ? analysis.tau.CS : 0,
              oc: done ? analysis.tau.OC : 0,
              analysisStatus: analysis?.status || 'missing',
              coachingLevel: analysis?.coachingLevel || null,
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
        initials: s.displayName.split(' ').map((p) => p[0]).join(''),
      })),
      // Classes aren't in the data model yet (pilot = one class); synthesize
      // a single class so the dashboard's class layer works unchanged.
      classes: [{ id: 'class-1', name: 'My Class', studentIds: students.map((s) => s.id) }],
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
  const route = new URL(req.url, 'http://x').pathname;
  try {
    if (route.startsWith('/api/')) {
      const user = authenticate(req);
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
