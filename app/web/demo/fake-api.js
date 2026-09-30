// The walkthrough's stand-in for the server. Injected ahead of every other
// script on a page served under /demo/ (see serveDemo in server/index.js), so
// the real page runs unchanged and every /api/ call it makes is answered here.
//
// State lives on the player (parent.DEMO_STATE), so it survives the frame
// navigating between pages, and the player resets it by setting it to null.
// Which world a chapter starts in is parent.DEMO_SCENARIO; the words in that
// world come from parent.DEMO_STORY (story.js).

(function () {
  const DAY = 86400000;
  const P = window.parent !== window ? window.parent : window;
  const story = P.DEMO_STORY;
  const iso = (ms) => new Date(ms).toISOString();
  // The tour runs with no network pause and no streaming delay: every stop is
  // reached behind a fade, and the wait would only lengthen the fade.
  const LATENCY = P.DEMO_LATENCY ?? 220;
  const endOfDay = (days) => { const d = new Date(Date.now() + days * DAY); d.setHours(23, 59, 0, 0); return d.toISOString(); };

  const TEACHER = {
    id: 't-demo', email: 'ms.rivera@school.edu', username: null,
    displayName: 'Ms. Rivera', role: 'teacher', canAdmin: false, termsVersion: null,
  };

  // ── Worlds ─────────────────────────────────────────────────────────────────
  // 'teacher-new': an empty account, the first screen a teacher ever sees.
  // 'student-assigned': what the teacher chapter leaves behind, signed in as
  // the first student on the roster.
  function freshState(scenario) {
    const s = {
      seq: 0, me: TEACHER, classes: [], students: [], assignments: [],
      templates: [{ ...story.template, createdAt: iso(Date.now() - 30 * DAY) }],
      sessions: [], conversations: [], turns: [], submissions: [], replyAt: 0,
    };
    if (scenario === 'student-assigned' || scenario === 'teacher-reviewing') {
      s.students = story.roster.map(([name, email], i) => ({ id: `s-${i + 1}`, name, email }));
      s.classes = [{ id: 'c-1', name: 'English 10 — Period 3', studentIds: s.students.map((x) => x.id) }];
      const { id, name, createdAt, ...wording } = story.template;
      const due = scenario === 'student-assigned' ? [endOfDay(7), endOfDay(14)] : [endOfDay(-8), endOfDay(-1)];
      s.assignments = [{ id: 'a-1', ...wording, classIds: ['c-1'], draftDueDates: due, createdAt: iso(Date.now() - 15 * DAY) }];
    }
    if (scenario === 'student-assigned') {
      const maya = s.students[0];
      s.me = {
        id: maya.id, email: maya.email, username: null,
        displayName: maya.name, role: 'student', canAdmin: false, termsVersion: null,
      };
    }
    if (scenario === 'teacher-reviewing') {
      s.drafts = cohortDrafts(s);
      // Maya's draft 1 is the session chapter 2 shows, so the teacher's view
      // of her report reads the same chat, essay and reflection.
      seedStorySession(s, 'sess-s-1-0', Date.parse(s.drafts['s-1_a-1'][0].ts) - 40 * 60000);
      Object.assign(s.drafts['s-1_a-1'][0], { reflectionType: 'full', reflection: story.reflection });
    }
    return s;
  }

  // The whole story chat, as one conversation in `sessionId`. Returns its id.
  function seedStorySession(s, sessionId, start) {
    const conv = {
      id: `conv-${++s.seq}`, sessionId, title: story.chat[0].student.slice(0, 42) + '…',
      createdAt: iso(start), lastActiveAt: iso(start + 20 * 60000), locked: false,
    };
    s.conversations.push(conv);
    story.chat.forEach((x, i) => {
      s.turns.push({ id: `turn-${++s.seq}`, conversationId: conv.id, role: 'student', text: x.student, createdAt: iso(start + i * 240000), meta: {} });
      s.turns.push({ id: `turn-${++s.seq}`, conversationId: conv.id, role: 'coach', text: x.ai, createdAt: iso(start + i * 240000 + 20000), meta: {} });
    });
    return conv.id;
  }

  // Both drafts, for every student in the story's cohort, in the shape the
  // dashboard payload carries them. Submitted in the two days before each due
  // date, a few at the last minute.
  function cohortDrafts(s) {
    const a = s.assignments[0];
    // The retired 1-5 scores still feed the dashboard's attention detectors
    // (see legacyTotal in dashboard.html); derived from the bands so the two
    // can never tell different stories about the same draft.
    const retired = (band) => [1, 3, 4, 5][band - 1];
    const out = {};
    story.cohort.forEach((c, i) => {
      const sid = s.students[i].id;
      out[`${sid}_${a.id}`] = [c.d1, c.fin].map(([level, ...bands], cycle) => {
        const due = Date.parse(a.draftDueDates[cycle]);
        const ts = due - ((i * 7) % 11) * 4 * 3600000 - 1800000;
        const pat = cycle ? c.p2 : c.p1;
        const mine = bands[3] >= 3 ? 3 : 1;
        return {
          id: `sub-${sid}-${cycle}`, ts: iso(ts), cycleIndex: cycle,
          level, bands,
          pq: retired(bands[0]), su: retired(bands[1]), cs: retired(bands[2]), oc: retired(bands[3]),
          analysisStatus: 'complete',
          conversationCount: 1 + ((i + cycle) % 3),
          provenance: { studentBorn: mine, synthesized: 2, aiBorn: 4 - mine, total: 6 },
          teacherNote: null, flagDecisions: null, agencyMark: null, followedUpAt: null,
          patterns: pat,
          ...(cycle && c.flags ? { integrityFlags: c.flags } : {}),
        };
      });
    });
    return out;
  }

  const inPlayer = P !== window && 'DEMO_STATE' in P;
  if (inPlayer && !P.DEMO_STATE) P.DEMO_STATE = freshState(P.DEMO_SCENARIO);
  const state = () => (inPlayer ? P.DEMO_STATE : (window.__demoState ||= freshState()));
  const nextId = (prefix) => `${prefix}-${++state().seq}`;

  // ── Teacher ────────────────────────────────────────────────────────────────
  function dashboard() {
    const s = state();
    const submissions = {};
    for (const st of s.students) for (const a of s.assignments) {
      submissions[`${st.id}_${a.id}`] = (s.drafts && s.drafts[`${st.id}_${a.id}`]) || [];
    }
    return {
      assignments: s.assignments.map((a) => ({
        id: a.id, name: a.title,
        due: a.draftDueDates[a.draftDueDates.length - 1],
        status: Date.parse(a.draftDueDates[a.draftDueDates.length - 1]) < Date.now() ? 'closed' : 'open',
        draftBudget: a.draftBudget, draftDueDates: a.draftDueDates, classIds: a.classIds,
        description: a.description, purpose: a.purpose,
        requirements: a.requirements, teacherNote: a.teacherNote || null,
      })),
      students: s.students.map((st) => ({
        id: st.id, name: st.name, email: st.email, identity: 'email', username: null,
        initials: st.name.split(' ').map((p) => p[0]).join(''),
      })),
      classes: s.classes.map((c) => ({ id: c.id, name: c.name, studentIds: c.studentIds, improvement: null })),
      viewer: { improvementEligible: false, codeRoster: false, handle: null },
      archivedClasses: [], archivedAssignments: [],
      templates: s.templates,
      submissions,
    };
  }

  function addStudent(classId, body) {
    const s = state();
    const cls = s.classes.find((c) => c.id === classId);
    if (!cls) return [404, { error: 'class not found' }];
    const email = String(body.email || '').toLowerCase();
    let st = s.students.find((x) => x.email === email);
    if (!st) {
      st = { id: nextId('s'), name: body.displayName || email.split('@')[0], email };
      s.students.push(st);
    }
    if (!cls.studentIds.includes(st.id)) cls.studentIds.push(st.id);
    return [200, { ok: true, student: st, invite: { accepted: true } }];
  }

  // ── Student ────────────────────────────────────────────────────────────────
  const dueOf = (a) => a.draftDueDates[a.draftDueDates.length - 1];
  const className = (a) => state().classes.find((c) => c.id === a.classIds[0])?.name || null;
  const convTurns = (cid) => state().turns.filter((t) => t.conversationId === cid);
  const mySubs = (aid) => state().submissions.filter((x) => x.assignmentId === aid && x.studentId === state().me.id);

  function draftSummary(sub, a) {
    return {
      submissionId: sub.id, cycleIndex: sub.cycleIndex, submittedAt: sub.submittedAt,
      analysisStatus: analysisStatus(sub),
      tau: null, reading: analysisStatus(sub) === 'complete' ? { level: story.reading.level, bands: {} } : null,
      growthMove: story.growthMoves[0], hasTeacherNote: false, teacherNote: null,
      teacherNoteAt: null, teacherNoteReadAt: null, assignmentTitle: a.title,
    };
  }

  function studentHome() {
    const s = state();
    const current = s.assignments.map((a) => {
      const session = s.sessions.find((x) => x.assignmentId === a.id && x.status === 'active');
      const convs = session ? s.conversations.filter((c) => c.sessionId === session.id) : [];
      return {
        id: a.id, title: a.title, className: className(a),
        description: a.description, purpose: a.purpose, requirements: a.requirements,
        dueDate: dueOf(a), draftDueDates: a.draftDueDates, draftBudget: a.draftBudget,
        draftsUsed: mySubs(a.id).length,
        hasActivity: convs.some((c) => convTurns(c.id).length),
        conversationCount: convs.length,
        lastActiveAt: convs.map((c) => c.lastActiveAt).sort().pop() || null,
        drafts: mySubs(a.id).map((sub) => draftSummary(sub, a)),
        teacherNote: null,
      };
    });
    return { student: { displayName: s.me.displayName, email: s.me.email }, current, past: [], trend: [], budget: { warning: null } };
  }

  function openAssignment(aid) {
    const s = state();
    const a = s.assignments.find((x) => x.id === aid);
    if (!a) return [404, { error: 'assignment not found' }];
    let session = s.sessions.find((x) => x.assignmentId === aid && x.status === 'active');
    if (!session && mySubs(aid).length < a.draftBudget) {
      session = { id: nextId('sess'), assignmentId: aid, studentId: s.me.id, cycleIndex: mySubs(aid).length, status: 'active', startedAt: iso(Date.now()), submittedAt: null };
      s.sessions.push(session);
    }
    const conversations = s.sessions
      .filter((x) => x.assignmentId === aid)
      .flatMap((x) => s.conversations.filter((c) => c.sessionId === x.id).map((c) => ({ ...c, cycleIndex: x.cycleIndex })));
    return [200, {
      assignment: { ...a, dueDate: dueOf(a) },
      session: session || null, conversations,
      draftsUsed: mySubs(aid).length, lastReflection: null,
      hasActivity: conversations.some((c) => convTurns(c.id).length),
      closed: false, closedAt: null,
    }];
  }

  // Streams `answer` the way the server does (SSE tokens), and stores it as a
  // turn once it has finished — the page refetches the conversation after.
  function stream(cid, role, answer, meta = {}) {
    const s = state();
    const words = answer.match(/\S+\s*/g) || [];
    const enc = new TextEncoder();
    const body = new ReadableStream({
      async start(ctrl) {
        if (LATENCY) await new Promise((r) => setTimeout(r, 900));
        for (const w of words) {
          ctrl.enqueue(enc.encode(`event: token\ndata: ${JSON.stringify(w)}\n\n`));
          if (LATENCY) await new Promise((r) => setTimeout(r, 24));
        }
        s.turns.push({ id: nextId('turn'), conversationId: cid, role, text: answer, createdAt: iso(Date.now()), meta });
        ctrl.enqueue(enc.encode('event: done\ndata: {}\n\n'));
        ctrl.close();
      },
    });
    return new Response(body, { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
  }

  // The AI's replies are the story's, in order — the student's own words are
  // whatever the page sent, so the transcript holds exactly what was typed.
  function reply(cid, text) {
    const s = state();
    s.turns.push({ id: nextId('turn'), conversationId: cid, role: 'student', text, createdAt: iso(Date.now()), meta: {} });
    const conv = s.conversations.find((c) => c.id === cid);
    if (conv) conv.lastActiveAt = iso(Date.now());
    return stream(cid, 'coach', story.chat[s.replyAt++]?.ai || 'Say more about what you mean?');
  }

  // The player's cut to "a session in progress": the whole story chat, as if
  // it had been had, in the draft's open session. Returns the conversation id
  // for the page to open.
  window.demoFastForward = function (assignmentId) {
    const s = state();
    const session = s.sessions.find((x) => x.assignmentId === assignmentId && x.status === 'active');
    s.replyAt = story.chat.length;
    return seedStorySession(s, session.id, Date.now() - 20 * 60000);
  };

  // The upload box reads a .docx with mammoth. The demo's file holds plain
  // text, so the reader just decodes it — everything around it is the page's.
  window.addEventListener('DOMContentLoaded', () => {
    if (window.mammoth) {
      window.mammoth.extractRawText = async ({ arrayBuffer }) => ({ value: new TextDecoder().decode(arrayBuffer) });
    }
  });

  function submit(sessionId, body) {
    const s = state();
    const session = s.sessions.find((x) => x.id === sessionId);
    if (!session) return [404, { error: 'session not found' }];
    session.status = 'submitted';
    s.conversations.filter((c) => c.sessionId === session.id).forEach((c) => { c.locked = true; });
    const sub = {
      id: nextId('sub'), sessionId, assignmentId: session.assignmentId, studentId: s.me.id,
      cycleIndex: session.cycleIndex, essayText: body.essayText, reflection: body.reflection,
      submittedAt: iso(Date.now()),
    };
    s.submissions.push(sub);
    return [200, { submission: sub }];
  }

  // A few seconds of "analysing", so the report's own waiting state is seen.
  function analysisStatus(sub) {
    if (!LATENCY) return 'complete';
    return Date.now() - Date.parse(sub.submittedAt) < 3500 ? 'pending' : 'complete';
  }

  function analysisFor(sub) {
    const convs = state().conversations.filter((c) => c.sessionId === sub.sessionId);
    let n = 0;
    // The auditor exchange is excluded from the analysis, as in the product.
    const classified = convs.flatMap((c) => convTurns(c.id).filter((t) => t.role !== 'auditor').map((t) => {
      const mine = t.role === 'student' ? story.labels[n++] || { label: 'claim' } : null;
      return {
        turnId: t.id, conversationId: c.id, conversationTitle: c.title,
        role: t.role === 'student' ? 'student' : 'ai', text: t.text,
        label: mine ? mine.label : null, responsive: mine ? mine.responsive : false,
        followedBy: mine ? mine.followedBy : null,
      };
    }));
    return {
      id: `an-${sub.id}`, submissionId: sub.id, status: 'complete',
      createdAt: sub.submittedAt, completedAt: iso(Date.now()), version: 1,
      classified, provenance: story.provenance, patterns: [], eventCounts: {},
      snapshot: { strengths: [], growthMoves: story.growthMoves, bridge: null },
      reading: story.reading,
    };
  }

  // A draft from the seeded cohort, in the shape a student's own submission
  // has — so one report route serves both. Only Maya's draft 1 has a session
  // and an essay behind it; the tour never opens anyone else's report.
  function cohortSubmission(subId) {
    const s = state();
    for (const [key, list] of Object.entries(s.drafts || {})) {
      const d = list.find((x) => x.id === subId);
      if (!d) continue;
      const [studentId, assignmentId] = key.split('_');
      return {
        id: d.id, sessionId: `sess-${studentId}-${d.cycleIndex}`, assignmentId, studentId,
        cycleIndex: d.cycleIndex, essayText: studentId === 's-1' && d.cycleIndex === 0 ? story.essay : '',
        submittedAt: d.ts, draft: d,
      };
    }
    return null;
  }

  function findSubmission(subId) {
    return state().submissions.find((x) => x.id === subId) || cohortSubmission(subId);
  }

  function report(subId) {
    const s = state();
    const sub = findSubmission(subId);
    if (!sub) return [404, { error: 'submission not found' }];
    const a = s.assignments.find((x) => x.id === sub.assignmentId);
    const done = analysisStatus(sub) === 'complete';
    const teacher = s.me.role === 'teacher';
    return [200, {
      submission: {
        id: sub.id, assignmentId: sub.assignmentId, assignmentTitle: a?.title || null,
        cycleIndex: sub.cycleIndex, submittedAt: sub.submittedAt, essayText: sub.essayText, teacherNote: null,
      },
      analysis: done ? {
        ...analysisFor(sub),
        ...(teacher && sub.draft?.integrityFlags ? { flags: sub.draft.integrityFlags.map((flag) => ({ flag, evidence: null })) } : {}),
      } : { status: 'pending' },
      stale: false,
      // Present for a teacher only, as on the server: it is what puts the
      // ruling controls on the report.
      ...(teacher ? { rulings: {
        flagDecisions: sub.draft?.flagDecisions || {},
        followedUpAt: null,
        agencyMark: sub.draft?.agencyMark || null,
      } } : {}),
    }];
  }

  function submissionConversations(subId) {
    const s = state();
    const sub = findSubmission(subId);
    if (!sub) return [404, { error: 'submission not found' }];
    const conversations = s.conversations
      .filter((c) => c.sessionId === sub.sessionId)
      .map((c) => ({ ...c, turns: convTurns(c.id) }));
    return [200, { conversations }];
  }

  // ── Routing ────────────────────────────────────────────────────────────────
  function route(method, url, body) {
    const s = state();
    const [, , seg1, seg2, seg3] = url.pathname.split('/');

    if (method === 'GET' && seg1 === 'me') return [200, s.me];

    if (method === 'GET' && seg1 === 'teacher' && seg2 === 'dashboard') return [200, dashboard()];
    if (method === 'POST' && seg1 === 'classes' && !seg2) {
      const cls = { id: nextId('c'), name: body.name, studentIds: [] };
      s.classes.push(cls);
      return [200, cls];
    }
    if (method === 'POST' && seg1 === 'classes' && seg3 === 'students') return addStudent(seg2, body);
    if (method === 'POST' && seg1 === 'assignments' && !seg2) {
      const a = { id: nextId('a'), ...body, createdAt: iso(Date.now()) };
      s.assignments.push(a);
      return [200, a];
    }
    if (method === 'POST' && seg1 === 'templates' && !seg2) {
      const t = { id: nextId('tpl'), ...body, createdAt: iso(Date.now()) };
      s.templates.unshift(t);
      return [200, t];
    }

    if (method === 'GET' && seg1 === 'student' && seg2 === 'home') return [200, studentHome()];
    if (method === 'POST' && seg1 === 'assignments' && seg3 === 'open') return openAssignment(seg2);
    if (method === 'POST' && seg1 === 'conversations' && !seg2) {
      const conv = { id: nextId('conv'), sessionId: body.sessionId, title: 'New conversation', createdAt: iso(Date.now()), lastActiveAt: iso(Date.now()), locked: false };
      s.conversations.push(conv);
      return [200, conv];
    }
    if (seg1 === 'conversations' && seg2) {
      const conv = s.conversations.find((c) => c.id === seg2);
      if (!conv) return [404, { error: 'conversation not found' }];
      if (method === 'GET' && !seg3) return [200, { conversation: conv, turns: convTurns(conv.id), locked: conv.locked }];
      if (method === 'POST' && seg3 === 'rename') { conv.title = String(body.title || conv.title); return [200, { ok: true }]; }
      if (method === 'POST' && seg3 === 'message') return reply(conv.id, String(body.text || ''));
      if (method === 'POST' && seg3 === 'evaluate') return stream(conv.id, 'auditor', story.auditor, { metaTurn: true });
    }
    if (method === 'POST' && seg1 === 'sessions' && seg3 === 'submit') return submit(seg2, body);
    if (method === 'GET' && seg1 === 'submissions' && !seg2) {
      const aid = url.searchParams.get('assignmentId');
      return [200, mySubs(aid).map((sub) => ({ id: sub.id, cycleIndex: sub.cycleIndex, submittedAt: sub.submittedAt, analysisStatus: analysisStatus(sub), tau: null, reading: null }))];
    }
    if (method === 'GET' && seg1 === 'submissions' && seg3 === 'report') return report(seg2);
    if (method === 'POST' && seg1 === 'submissions' && seg3 === 'flag-decision') {
      const d = cohortSubmission(seg2)?.draft;
      if (!d) return [404, { error: 'submission not found' }];
      d.flagDecisions = d.flagDecisions || {};
      if (body.outcome) d.flagDecisions[body.flagKey] = { outcome: body.outcome, reason: body.reason || null, markedAt: iso(Date.now()) };
      else delete d.flagDecisions[body.flagKey];
      return [200, { ok: true }];
    }
    if (method === 'POST' && seg1 === 'submissions' && seg3 === 'agency-mark') {
      const d = cohortSubmission(seg2)?.draft;
      if (!d) return [404, { error: 'submission not found' }];
      d.agencyMark = body.outcome ? { outcome: body.outcome, direction: body.direction || null, reason: body.reason || null, markedAt: iso(Date.now()) } : null;
      return [200, { ok: true }];
    }
    if (method === 'GET' && seg1 === 'submissions' && seg3 === 'conversations') return submissionConversations(seg2);

    // Anything not modelled yet answers as a no-op success, and says so, so a
    // new chapter shows exactly which calls it still needs faked.
    if (method !== 'GET') return [200, { ok: true }];
    console.warn('[demo] no fake for', method, url.pathname);
    return [404, { error: 'not in the demo' }];
  }

  const realFetch = window.fetch.bind(window);
  window.fetch = async (input, init = {}) => {
    const url = new URL(typeof input === 'string' ? input : input.url, location.href);
    if (!url.pathname.startsWith('/api/')) return realFetch(input, init);
    const method = (init.method || 'GET').toUpperCase();
    let body = {};
    try { body = init.body ? JSON.parse(init.body) : {}; } catch { /* not JSON */ }
    // A beat of latency, so a button's own "Creating…" state is visible.
    if (LATENCY && url.pathname !== '/api/usage') await new Promise((r) => setTimeout(r, LATENCY));
    const out = route(method, url, body);
    if (out instanceof Response) return out;
    const [status, payload] = out;
    return new Response(JSON.stringify(payload), { status, headers: { 'Content-Type': 'application/json' } });
  };

  // The app navigates by absolute path (/report.html?id=…), which would leave
  // the demo for the real, signed-in app. Keep every same-origin page
  // navigation inside /demo/.
  if (window.navigation) {
    window.navigation.addEventListener('navigate', (e) => {
      const to = new URL(e.destination.url);
      if (to.origin !== location.origin || to.pathname.startsWith('/demo/') || to.pathname.startsWith('/api/')) return;
      if (!e.cancelable) return;
      e.preventDefault();
      location.href = `/demo${to.pathname === '/' ? '/index.html' : to.pathname}${to.search}`;
    });
  }
})();
