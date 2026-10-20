// Workshops — a six-digit code that lets a room of adults try the tool with no
// account, then read their own results.
//
// Built for teacher demos (Emilie's, 2026-10-14). The point of the demo is to
// show how an ordinary AI chat leads a conversation, so nothing about the chat
// changes here: guests get the same unsteered model every student gets.
//
// What a workshop is, in records:
//   workshops    the code, seat cap, expiry, and the class/assignment it made
//   classes      one, marked `workshop` — kept OUT of teacherScope, so no guest
//                ever enters the teacher's real dashboard, rollups or Home
//   assignments  one draft, the task the facilitator picked
//   users        one per person who pressed Join: identity 'guest', the name
//                they typed, no email, no username, no password — the cookie is
//                the only way back in
//
// Everything a guest produced is deleted when the workshop expires (purge
// below). Workshop classes never carry an improvement stamp, so nothing here
// can reach the measurement-improvement export either.

const crypto = require('crypto');
const { col } = require('./store');

// Neither is the facilitator's to set. The cap is a backstop against a code
// that leaks, not a room size; the week is long enough to revisit results and
// short enough that nothing a guest typed lingers.
const SEATS = 200;
const DAYS = 7;

// The built-in task every facilitator is offered first; their own saved tasks
// (workshopTasks, below) follow it. Step 2 asks for a CLAIM to be disputed, not
// just any pushback: that is the exchange the AI-caved detector reads
// (patterns.md), and "make it shorter" would give it nothing to see.
//
// No writing step. A workshop is read for its turn plot alone (analysis.js),
// so a draft would be text nothing reads — and the session is short enough
// that every minute of it should go to the conversation the chart is drawn from.
const TASKS = [{
  id: 'phones',
  title: 'Should schools ban phones in class?',
  description: [
    'Spend about five minutes on this with the AI.',
    '1. Ask the AI whether schools should ban phones in class, then pick a side.',
    '2. Disagree with something the AI claimed — with a reason or without one — and see what it does.',
    '3. Keep going: push it, ask it to argue the other side, or change your mind.',
  ].join('\n'),
  purpose: 'To see how a conversation with an AI plays out: who leads, who follows, and what happens when you push back.',
  requirements: 'Nothing to write. When you’re done, press End session to see your results.',
}];

const now = () => new Date().toISOString();

// A facilitator's own tasks. Theirs alone, offered in every workshop they
// create. A workshop copies the task into its assignment when it is made, so
// editing or deleting one here never changes a workshop already running.
//
// Only a question and instructions are asked for: those are all a guest
// reads. Purpose and requirements are filled in, the same for every task.
const TASK_TITLE_MAX = 200;
const TASK_DESCRIPTION_MAX = 2000;
const OWN_TASK_PURPOSE = 'To see how a conversation with an AI plays out: who leads, who follows, and how it goes when you push back.';

function cleanTask({ title, description }) {
  const t = String(title || '').trim().slice(0, TASK_TITLE_MAX);
  const d = String(description || '').trim().slice(0, TASK_DESCRIPTION_MAX);
  return t && d ? { title: t, description: d } : null;
}

async function tasksFor(teacher) {
  const own = (await col('workshopTasks').list({ teacherId: teacher.id }))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return [
    ...TASKS.map((t) => ({ id: t.id, title: t.title, description: t.description, builtIn: true })),
    ...own.map((t) => ({ id: t.id, title: t.title, description: t.description, builtIn: false })),
  ];
}

async function saveTask(teacher, fields, existingId = null) {
  const clean = cleanTask(fields);
  if (!clean) return { error: 'A task needs a question and instructions.' };
  if (existingId) {
    const task = await col('workshopTasks').get(existingId);
    if (!task || task.teacherId !== teacher.id) return { error: 'task not found', status: 404 };
    await col('workshopTasks').update(existingId, { ...clean, updatedAt: now() });
    return { id: existingId };
  }
  const task = await col('workshopTasks').add({ teacherId: teacher.id, ...clean, createdAt: now() });
  return { id: task.id };
}

async function deleteTask(teacher, id) {
  const task = await col('workshopTasks').get(id);
  if (!task || task.teacherId !== teacher.id) return false;
  await col('workshopTasks').delete(id);
  return true;
}

// The assignment fields for a picked task: a built-in one whole, or one of
// this facilitator's own with the shared purpose and requirements. Anything
// else — someone else's task, a deleted one — falls back to the first built-in.
async function resolveTask(teacher, taskId) {
  const builtIn = TASKS.find((t) => t.id === taskId);
  if (builtIn) return builtIn;
  const own = taskId ? await col('workshopTasks').get(taskId) : null;
  if (own && own.teacherId === teacher.id) {
    return {
      id: own.id,
      title: own.title,
      description: own.description,
      purpose: OWN_TASK_PURPOSE,
      requirements: TASKS[0].requirements,
    };
  }
  return TASKS[0];
}

// Six digits, read off a projector and typed by a room. Unique among the
// workshops that still exist, so a code is reused only once its workshop has
// been purged — a latecomer typing an old code reads "ended", never lands in
// someone else's room.
//
// Stored in the clear on purpose: it is a room's door, not a credential to
// anyone's account. Its owner has to see it again to show it, and what it
// opens is a fresh disposable account, never an existing one.
async function freshCode() {
  for (;;) {
    const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
    if (!(await col('workshops').list({ code })).length) return code;
  }
}

// Workshops made before codes existed get one the first time they are listed.
async function ensureCode(workshop) {
  if (workshop.code) return workshop;
  const code = await freshCode();
  await col('workshops').update(workshop.id, { code });
  return { ...workshop, code };
}

async function createWorkshop(teacher, { name, taskId }) {
  const label = String(name || '').trim().slice(0, 80) || 'Workshop';
  const { id: chosenTaskId, ...task } = await resolveTask(teacher, taskId);
  const expiresAt = new Date(Date.now() + DAYS * 86400000).toISOString();

  // Written first so the class and assignment can carry its id.
  const workshop = await col('workshops').add({
    teacherId: teacher.id,
    name: label,
    code: await freshCode(),
    taskId: chosenTaskId,
    seats: SEATS,
    guestCount: 0,
    expiresAt,
    closedAt: null,
    createdAt: now(),
  });

  // No `improvement` stamp, deliberately, even for a Pilot user — whose
  // ordinary classes are stamped at creation. These are adults role-playing a
  // student for five minutes; their sessions are a demonstration, not data.
  const classDoc = await col('classes').add({
    teacherId: teacher.id,
    name: label,
    studentIds: [],
    workshop: { id: workshop.id },
    createdAt: now(),
  });

  const assignment = await col('assignments').add({
    teacherId: teacher.id,
    classIds: [classDoc.id],
    ...task,
    // Closes when the workshop's data goes, so a guest who reopens their tab
    // the next week finds it read-only rather than half-deleted.
    dueDate: expiresAt,
    draftBudget: 1,
    draftDueDates: [expiresAt],
    workshop: { id: workshop.id },
    createdAt: now(),
  });

  await col('workshops').update(workshop.id, { classId: classDoc.id, assignmentId: assignment.id });
  return col('workshops').get(workshop.id);
}

// Why a link cannot be used right now, or null if it can. Ordered so the most
// permanent reason wins: an expired workshop that was also closed reads as
// expired, since closing it again would change nothing.
function unavailableReason(workshop) {
  if (!workshop) return 'invalid';
  if (new Date(workshop.expiresAt) <= new Date()) return 'expired';
  if (workshop.closedAt) return 'closed';
  if ((workshop.guestCount || 0) >= workshop.seats) return 'full';
  return null;
}

// Spaces and dashes are what people add when copying "482 193" off a screen.
function normalizeCode(code) {
  const c = String(code || '').replace(/[\s-]/g, '');
  return /^\d{6}$/.test(c) ? c : null;
}

async function workshopByCode(code) {
  const c = normalizeCode(code);
  if (!c) return null;
  return (await col('workshops').list({ code: c }))[0] || null;
}

// One guest per press of Join. Called only from the POST behind the button,
// never from loading the page: link unfurlers in Slack, Teams and mail fetch
// every URL they are shown, and a GET that created an account would hand a
// seat to each of them.
//
// Returns null when the last seat went to someone else between the caller's
// check and this claim. The seat is claimed and the cap re-checked inside one
// transaction because a room presses Join together: as a plain read-then-write
// two people got the same seat number and one fell off the class roster, which
// then refused them their own assignment. Found running five guests at once.
//
// The name is what the facilitator calls on in the room view. Adults in a
// workshop, unlike students, are asked for one (pilotuser.md, guests); it is
// purged with everything else.
async function admitGuest(workshop, name) {
  let n = null;
  await col('workshops').transact(workshop.id, (w) => {
    // Reset on every attempt: Firestore re-runs this on contention, and a seat
    // number left over from an attempt that lost must not survive into one
    // that finds the room full.
    n = null;
    if (unavailableReason(w)) return null;
    n = (w.guestCount || 0) + 1;
    return { guestCount: n };
  });
  if (n === null) return null;
  const guest = await col('users').add({
    // Both identifiers are explicitly null. The sign-in scan guards on each
    // (auth.js login), so an account with neither can never be matched there —
    // which is the point: no credential exists to present.
    email: null,
    username: null,
    displayName: String(name || '').trim().slice(0, 40) || `Guest ${n}`,
    seat: n,
    role: 'student',
    identity: 'guest',
    workshopId: workshop.id,
    // Same mechanism as a code-roster student: the agreement chain ends at the
    // teacher who ran the workshop, so the guest is never sent to the student
    // Terms. The workshop's entry page states what happens to their session.
    termsCoveredBy: workshop.teacherId,
    termsVersion: null,
    status: 'active',
    expiresAt: workshop.expiresAt,
    createdAt: now(),
  });
  await col('classes').transact(workshop.classId, (c) => ({ studentIds: [...(c.studentIds || []), guest.id] }));
  return guest;
}

// Deletes everything one workshop produced. Children before parents, so a
// failure part-way leaves orphans that a re-run still finds by their parent
// rather than parents whose children can no longer be reached.
async function purgeWorkshop(workshop) {
  const guests = await col('users').list({ workshopId: workshop.id });
  for (const g of guests) {
    for (const sub of await col('submissions').list({ studentId: g.id })) {
      // Every analysis of the submission, not just the current one: a re-read
      // writes a new analysis and leaves the old one, which still holds the
      // guest's full transcript.
      for (const a of await col('analyses').list({ submissionId: sub.id })) await col('analyses').delete(a.id);
      await col('submissions').delete(sub.id);
    }
    for (const sess of await col('sessions').list({ studentId: g.id })) {
      for (const conv of await col('conversations').list({ sessionId: sess.id })) {
        for (const t of await col('turns').list({ conversationId: conv.id })) await col('turns').delete(t.id);
        await col('conversations').delete(conv.id);
      }
      for (const e of await col('events').list({ sessionId: sess.id })) await col('events').delete(e.id);
      await col('sessions').delete(sess.id);
    }
    for (const s of await col('authSessions').list({ userId: g.id })) await col('authSessions').delete(s.id);
    await col('users').delete(g.id);
  }
  if (workshop.assignmentId) await col('assignments').delete(workshop.assignmentId).catch(() => {});
  if (workshop.classId) await col('classes').delete(workshop.classId).catch(() => {});
  await col('workshops').delete(workshop.id);
  return guests.length;
}

async function purgeExpiredWorkshops() {
  const expired = (await col('workshops').list()).filter((w) => new Date(w.expiresAt) <= new Date());
  let guests = 0;
  for (const w of expired) guests += await purgeWorkshop(w);
  if (expired.length) console.log(`workshops: purged ${expired.length} expired (${guests} guests)`);
}

const TIER_ORDER = { high: 0, medium: 1, low: 2 };
function uniquePatterns(patterns) {
  const seen = new Map();
  for (const p of patterns) if (!seen.has(p.id)) seen.set(p.id, { label: p.label, tier: p.tier });
  return [...seen.values()].sort((a, b) => (TIER_ORDER[a.tier] ?? 3) - (TIER_ORDER[b.tier] ?? 3));
}

// The teacher's view of their workshops: the code, how far the room got, and
// the one room-level fact the demo exists to show — how many people the AI
// backed off for. Per-person rows carry only what the room view draws.
async function workshopsFor(teacher) {
  const mine = (await col('workshops').list({ teacherId: teacher.id }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const out = [];
  for (const raw of mine) {
    const w = await ensureCode(raw);
    // In the order they joined, which is the order the facilitator watched
    // names arrive on the join screen.
    const guests = (await col('users').list({ workshopId: w.id }))
      .sort((a, b) => (a.seat || 0) - (b.seat || 0) || a.createdAt.localeCompare(b.createdAt));
    // Two Priyas in one room are told apart by seat; one Priya is just Priya.
    const nameCount = new Map();
    for (const g of guests) {
      const key = g.displayName.toLowerCase();
      nameCount.set(key, (nameCount.get(key) || 0) + 1);
    }
    const people = [];
    for (const g of guests) {
      const sub = (await col('submissions').list({ studentId: g.id }))[0] || null;
      const analysis = sub && sub.analysisId ? await col('analyses').get(sub.analysisId) : null;
      const done = analysis && analysis.status === 'complete';
      people.push({
        id: g.id,
        name: nameCount.get(g.displayName.toLowerCase()) > 1 && g.seat
          ? `${g.displayName} · seat ${g.seat}` : g.displayName,
        submissionId: sub ? sub.id : null,
        status: !sub ? 'working' : done ? 'complete' : (analysis && analysis.status === 'error' ? 'error' : 'reading'),
        // The patterns the plot names, once each, high-agency first. No level:
        // a workshop is never read for one (analysis.js).
        patterns: done ? uniquePatterns(analysis.patterns || []) : [],
        aiCaved: done ? (analysis.aiMoments || []).filter((m) => m.id === 'ai-caved').length : 0,
        // Read whether the pushback trace ran at all, so "no caves" can be told
        // apart from "never pushed back on a claim".
        claimPushbacks: done
          ? (analysis.classified || []).filter((t) => t.pushback && t.pushback.target === 'claim').length
          : 0,
        // The AI changing its answer after a REASONED dispute — not caving, and
        // not holding either. Without it the row read "held its position" for
        // an AI that had in fact conceded to evidence.
        aiUpdated: done
          ? (analysis.classified || []).filter((t) => t.pushback && t.pushback.target === 'claim'
              && t.pushback.reason === true && t.pushback.aiResponse !== 'kept').length
          : 0,
      });
    }
    out.push({
      id: w.id,
      name: w.name,
      code: w.code,
      seats: w.seats,
      expiresAt: w.expiresAt,
      closedAt: w.closedAt,
      createdAt: w.createdAt,
      status: unavailableReason(w) || 'open',
      people,
    });
  }
  return out;
}

// The presented room view (workshop-room.html): every finished conversation's
// turns and the patterns the analysis stored, for the facilitator to put on a
// projector. NO NAMES, and a fresh shuffle on every read, so a room watching
// the screen can't tell whose conversation is whose — not by a label, and not
// by a row that stays in the same place. Owner-only, like every workshop route.
// Patterns are sent as stored, never re-detected, so this view can't disagree
// with what a guest sees in their own results.
const AI_TEXT_MAX = 700;
async function roomFor(w) {
  const guests = await col('users').list({ workshopId: w.id });
  const conversations = [];
  let working = 0;
  for (const g of guests) {
    const sub = (await col('submissions').list({ studentId: g.id }))[0] || null;
    const analysis = sub && sub.analysisId ? await col('analyses').get(sub.analysisId) : null;
    if (!analysis || analysis.status !== 'complete') {
      if (!analysis || analysis.status !== 'error') working++;
      continue;
    }
    const turns = (analysis.classified || []).map((t) => {
      const text = String(t.text || t.excerpt || '');
      return {
        role: t.role === 'ai' ? 'ai' : 'student',
        label: t.label || null,
        text: t.role === 'ai' && text.length > AI_TEXT_MAX ? text.slice(0, AI_TEXT_MAX).trimEnd() + '…' : text,
        pushback: t.pushback
          ? { target: t.pushback.target || null, reason: t.pushback.reason, aiResponse: t.pushback.aiResponse || null }
          : null,
      };
    });
    if (!turns.some((t) => t.role === 'student')) continue;
    const span = (p) => ({ id: p.id, start: p.start, end: p.end });
    conversations.push({
      key: sub.id,
      turns,
      patterns: (analysis.patterns || []).map(span),
      aiMoments: (analysis.aiMoments || []).map(span),
    });
  }
  for (let i = conversations.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [conversations[i], conversations[j]] = [conversations[j], conversations[i]];
  }
  return {
    name: w.name,
    code: (await ensureCode(w)).code,
    status: unavailableReason(w) || 'open',
    joined: guests.length,
    working,
    conversations,
  };
}

module.exports = {
  TASKS, tasksFor, saveTask, deleteTask,
  createWorkshop, workshopByCode, normalizeCode, unavailableReason, admitGuest,
  purgeWorkshop, purgeExpiredWorkshops, workshopsFor, roomFor,
};
