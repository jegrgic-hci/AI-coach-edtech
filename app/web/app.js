const $ = (id) => document.getElementById(id);

const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

const state = {
  assignment: null,
  session: null,
  conversations: [],
  submissions: [],
  hasActivity: false,
  expandedCycles: new Set(),
  conv: null,
  turns: [],
  streaming: false,
  abort: null,
  editingTurnId: null,
};

// ---------- api ----------
// api() comes from api.js — shared so a 401 lands on the login page everywhere.

function logEvent(type, meta) {
  fetch('/api/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type,
      sessionId: state.session?.id,
      conversationId: state.conv?.id,
      meta: meta || {},
    }),
  }).catch(() => {});
}

// Reads an SSE response from fetch. Calls onToken per token; resolves on done.
async function readSSE(res, { onToken }) {
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let result = null;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const frames = buffer.split('\n\n');
    buffer = frames.pop();
    for (const frame of frames) {
      const event = frame.match(/^event: (.+)$/m)?.[1];
      const data = frame.match(/^data: (.+)$/m)?.[1];
      if (!event || data === undefined) continue;
      const payload = JSON.parse(data);
      if (event === 'token') onToken(payload);
      if (event === 'done') result = payload;
      if (event === 'error') throw new Error(payload);
    }
  }
  return result;
}

// ---------- student home ----------

// Student-facing names. The acronyms are for the teacher surfaces; a student
// reading their own work should see what the dimension actually means.
const DIMENSION_NAMES = {
  PQ: 'How you questioned',
  SU: 'What you did with answers',
  CS: 'How you pushed back',
  OC: 'How much was yours',
};

const SAMR_BLURB = {
  Substitution: 'The coach did most of the thinking on this one.',
  Augmentation: 'You used the coach well, mostly to get answers.',
  Modification: 'You pushed on what the coach gave you and reshaped it.',
  Redefinition: 'You drove the thinking; the coach worked for you.',
};

function fmtDate(iso) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// Deadlines drive the ordering and the urgency tone of the hero. Day-granular:
// "due today" and "due in 4 hours" call for the same student behavior.
function dueInfo(iso) {
  if (!iso) return { text: null, tone: 'calm', days: Infinity };
  const days = Math.ceil((new Date(iso) - new Date()) / 86400000);
  if (days < 0)  return { text: `Overdue — was due ${fmtDate(iso)}`, tone: 'late',  days };
  if (days === 0) return { text: 'Due today', tone: 'soon', days };
  if (days === 1) return { text: 'Due tomorrow', tone: 'soon', days };
  if (days <= 3)  return { text: `Due in ${days} days`, tone: 'soon', days };
  return { text: `Due ${fmtDate(iso)}`, tone: 'calm', days };
}

// The eyebrow is about the deadline only — never progress. "In progress" /
// "not started" describe a specific draft (see draftRowStatus below); saying
// them here too, about the assignment as a whole, is exactly the collision
// that made it unclear which draft was actually being talked about.
function statusEyebrow(a) {
  const due = dueInfo(a.dueDate);
  return due.text ? due : { text: 'No due date', tone: 'calm' };
}

// Single vocabulary for what a draft's state means, shared by the home card's
// draft list and the workspace sidebar's draft sections, so the two surfaces
// never describe the same draft two different ways.
//   submitted    — locked, sent to the teacher (scored, analyzing, or failed)
//   in-progress  — this is the open draft and the student has sent a message
//   not-started  — this is the open draft but nothing has been sent yet
//   locked       — a future draft; can't open until the one before it submits
function draftRowStatus(cycleIndex, { currentCycle, hasActivity, submission }) {
  if (submission) {
    if (!submission.tau) {
      return {
        key: 'submitted', label: 'Submitted',
        detail: submission.analysisStatus === 'error' ? 'Report unavailable' : 'Analyzing your draft…',
      };
    }
    return {
      key: 'submitted', label: 'Submitted',
      detail: `${submission.tau.totalScore}/20 · ${submission.tau.SAMR}`,
      samr: submission.tau.SAMR,
    };
  }
  if (currentCycle !== null && cycleIndex === currentCycle) {
    return hasActivity
      ? { key: 'in-progress', label: 'In progress' }
      : { key: 'not-started', label: 'Not started' };
  }
  return {
    key: 'locked', label: 'Not available yet',
    detail: `Opens after Draft ${cycleIndex} is submitted`,
  };
}

// One row per draft slot 1..budget — every draft is shown, whether or not it
// exists yet, so a locked future draft reads as "not yours yet" rather than
// silently missing.
function draftRow(cycleIndex, status, reportId) {
  const row = el('div', `draft-row draft-row-${status.key}` + (status.samr ? ` samr-${status.samr.toLowerCase()}` : ''));
  row.append(el('span', 'draft-row-num', `Draft ${cycleIndex + 1}`));
  row.append(el('span', `draft-row-status status-${status.key}`, status.label));
  if (status.detail) row.append(el('span', 'draft-row-detail', status.detail));
  if (status.key === 'submitted' && reportId) {
    const link = el('button', 'draft-row-action', 'View report →');
    link.onclick = () => showReport(reportId);
    row.append(link);
  }
  return row;
}

function relTime(iso) {
  if (!iso) return null;
  const days = Math.floor((new Date() - new Date(iso)) / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  return fmtDate(iso);
}

function allDrafts(home) {
  return [...home.current, ...home.past].flatMap((a) => a.drafts);
}

function scoredDrafts(home) {
  return allDrafts(home)
    .filter((d) => d.tau)
    .sort((a, b) => String(a.submittedAt).localeCompare(String(b.submittedAt)));
}

function draftChip(draft) {
  if (draft.analysisStatus !== 'complete' || !draft.tau) {
    const pending = el('span', 'draft-chip draft-chip-pending');
    pending.append(el('span', 'chip-cycle', `Draft ${draft.cycleIndex + 1}`));
    pending.append(el('span', 'chip-score', draft.analysisStatus === 'error' ? 'unavailable' : 'analyzing…'));
    return pending;
  }
  const chip = el('button', `draft-chip samr-${draft.tau.SAMR.toLowerCase()}`);
  chip.append(el('span', 'chip-cycle', `Draft ${draft.cycleIndex + 1}`));
  // The denominator and the band are on the face, not in a tooltip — a bare
  // "12" is unreadable without knowing the scale.
  const score = el('span', 'chip-score', String(draft.tau.totalScore));
  score.append(el('span', 'chip-denom', '/20'));
  chip.append(score);
  chip.append(el('span', 'chip-samr', draft.tau.SAMR));
  if (draft.hasTeacherNote) chip.append(el('span', 'chip-note', '✉'));
  chip.onclick = () => showReport(draft.submissionId);
  return chip;
}

function draftChipRow(drafts) {
  const row = el('div', 'chip-row');
  for (const d of drafts) row.append(draftChip(d));
  return row;
}


const svgNS = 'http://www.w3.org/2000/svg';
const ns = (tag, attrs) => {
  const n = document.createElementNS(svgNS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  return n;
};

// Trend of every submitted draft, drawn as one polyline PER ASSIGNMENT rather
// than one continuous line. The scores are not a single trajectory — a student
// who grew 12→20 and then opened a new essay at 12 has not regressed, and a
// connected line would assert exactly that.
function totalTrendSVG(drafts, w = 248, h = 46) {
  const PAD = 7;
  const MIN = 4, MAX = 20;
  const x = (i) => PAD + (i * (w - PAD * 2)) / Math.max(drafts.length - 1, 1);
  const y = (v) => h - PAD - ((v - MIN) / (MAX - MIN)) * (h - PAD * 2);

  const svg = ns('svg', {
    viewBox: `0 0 ${w} ${h}`, class: 'trend-svg', role: 'img',
    'aria-label': `Total score across ${drafts.length} submitted drafts, ${drafts.map((d) => d.tau.totalScore).join(', ')} out of 20.`,
  });

  const groups = [];
  drafts.forEach((d, i) => {
    const prev = groups[groups.length - 1];
    if (prev && prev.title === d.assignmentTitle) prev.pts.push(i);
    else groups.push({ title: d.assignmentTitle, pts: [i] });
  });

  // A break between assignments needs to look deliberate. Without the rule, a
  // gap in the line reads as a rendering fault rather than as "new assignment".
  groups.forEach((g, gi) => {
    if (gi > 0) {
      const boundary = (x(groups[gi - 1].pts[groups[gi - 1].pts.length - 1]) + x(g.pts[0])) / 2;
      svg.append(ns('line', { class: 'trend-split', x1: boundary, x2: boundary, y1: 0, y2: h }));
    }
    if (g.pts.length > 1) {
      svg.append(ns('polyline', {
        class: 'trend-line',
        points: g.pts.map((i) => `${x(i)},${y(drafts[i].tau.totalScore)}`).join(' '),
      }));
    }
  });

  drafts.forEach((d, i) => {
    const isLast = i === drafts.length - 1;
    const dot = ns('circle', {
      class: 'trend-dot' + (isLast ? ' trend-dot-current' : ''),
      cx: x(i), cy: y(d.tau.totalScore), r: isLast ? 5 : 4,
    });
    const t = document.createElementNS(svgNS, 'title');
    t.textContent = `${d.assignmentTitle} — draft ${d.cycleIndex + 1}: ${d.tau.totalScore} of 20`;
    dot.append(t);
    svg.append(dot);
  });
  return svg;
}

// Meter per dimension: fill on a lighter step of the same ramp, so the unfilled
// track still reads as part of the scale rather than as empty space.
function dimensionMeters(tau, prev) {
  const grid = el('div', 'meters');
  for (const [key, name] of Object.entries(DIMENSION_NAMES)) {
    const row = el('div', 'meter-row');
    const head = el('div', 'meter-head');
    head.append(el('span', 'meter-name', name));
    const val = el('span', 'meter-val', `${tau[key]}`);
    val.append(el('span', 'meter-denom', '/5'));
    head.append(val);
    row.append(head);

    const track = el('span', 'meter-track');
    const fill = el('span', 'meter-fill');
    fill.style.width = `${(tau[key] / 5) * 100}%`;
    track.append(fill);
    row.append(track);

    if (prev) {
      const delta = tau[key] - prev[key];
      if (delta !== 0) {
        row.append(el('span', `meter-delta ${delta > 0 ? 'up' : 'down'}`,
          `${delta > 0 ? '▲' : '▼'} ${Math.abs(delta)} since last draft`));
      }
    }
    grid.append(row);
  }
  return grid;
}

function renderRail(home) {
  const first = home.student.displayName.split(' ')[0];
  $('railAvatar').textContent = home.student.displayName
    .split(' ').slice(0, 2).map((p) => p[0]).join('').toUpperCase();
  $('railName').textContent = home.student.displayName;

  const scored = scoredDrafts(home);
  const host = $('railProgress');
  host.innerHTML = '';

  if (!scored.length) {
    $('railSub').textContent = 'No drafts submitted yet';
    host.append(el('p', 'rail-empty',
      `Submit your first draft, ${first}, and this is where you'll see how you worked with the coach.`));
    return;
  }

  $('railSub').textContent = `${scored.length} draft${scored.length === 1 ? '' : 's'} submitted`;
  const last = scored[scored.length - 1];

  // Three blocks so the module can stack in the rail and run as a horizontal
  // band when the rail collapses — otherwise the meters stretch page-wide.
  const summary = el('div', 'rail-block');
  const trendBlock = el('div', 'rail-block');
  const dimBlock = el('div', 'rail-block');
  host.append(summary, trendBlock, dimBlock);

  summary.append(el('h3', 'rail-label', 'Your progress'));

  // Hero figure — the one number the dashboard leads with.
  const hero = el('div', 'rail-hero');
  const num = el('span', 'rail-hero-num', String(last.tau.totalScore));
  num.append(el('span', 'rail-hero-denom', '/20'));
  hero.append(num);
  hero.append(el('span', `rail-band samr-${last.tau.SAMR.toLowerCase()}`, last.tau.SAMR));
  summary.append(hero);
  summary.append(el('p', 'rail-blurb', SAMR_BLURB[last.tau.SAMR] || ''));

  // A delta only means something within one assignment. Across assignments the
  // comparison is between different tasks, so it is withheld rather than framed.
  const sameAssignment = scored.filter((d) => d.assignmentTitle === last.assignmentTitle);
  const prev = sameAssignment.length > 1 ? sameAssignment[sameAssignment.length - 2] : null;
  if (prev) {
    const change = last.tau.totalScore - prev.tau.totalScore;
    const cls = change > 0 ? 'up' : change < 0 ? 'down' : 'flat';
    const arrow = change > 0 ? '▲' : change < 0 ? '▼' : '—';
    summary.append(el('p', `rail-delta ${cls}`,
      `${arrow} ${change === 0 ? 'No change' : Math.abs(change)} from draft ${prev.cycleIndex + 1}`));
  }

  summary.append(el('p', 'rail-caption',
    `Draft ${last.cycleIndex + 1} of "${last.assignmentTitle}"${prev ? '' : ' — your first on this one'}`));

  if (scored.length >= 2) {
    trendBlock.append(el('h3', 'rail-label rail-label-sub', 'Every draft so far'));
    const trend = el('div', 'rail-trend');
    trend.append(totalTrendSVG(scored));
    trend.append(el('p', 'rail-trend-note', 'Lines join drafts of the same assignment.'));
    trendBlock.append(trend);
  }

  dimBlock.append(el('h3', 'rail-label rail-label-sub', 'Your last draft, by dimension'));
  dimBlock.append(dimensionMeters(last.tau, prev ? prev.tau : null));
}

// Current assignment. Reading order is the order a student needs it in:
// when is it due → what is it → where every draft stands → what changes →
// what to do.
function currentCard(a) {
  const card = el('article', 'acard');
  const eyebrow = statusEyebrow(a);
  if (eyebrow.tone !== 'calm') card.classList.add(`acard-${eyebrow.tone}`);

  const top = el('div', 'acard-top');
  top.append(el('span', `acard-due acard-due-${eyebrow.tone}`, eyebrow.text));
  top.append(el('h3', 'acard-title', a.title));
  card.append(top);

  // Mapped directly to the title it belongs to, not stranded at the bottom
  // of the card past the draft list and actions.
  const details = el('details', 'acard-prompt');
  details.append(el('summary', null, 'Read the assignment prompt'));
  details.append(el('p', null, a.prompt));
  card.append(details);

  // Every draft slot gets its own row and its own status — an assignment
  // being "underway" says nothing about whether draft 2 specifically has
  // been started, so that has to be read off its own row, not inferred.
  const rows = el('div', 'draft-rows');
  const currentCycle = a.draftsUsed;
  for (let i = 0; i < a.draftBudget; i++) {
    const submission = a.drafts.find((d) => d.cycleIndex === i);
    const status = draftRowStatus(i, { currentCycle, hasActivity: a.hasActivity, submission });
    if (status.key === 'in-progress') {
      status.detail = `${a.conversationCount} conversation${a.conversationCount === 1 ? '' : 's'} · last worked ${relTime(a.lastActiveAt)}`;
    }
    rows.append(draftRow(i, status, submission?.submissionId));
  }
  card.append(rows);

  // Advice from this assignment's own last draft, where it applies.
  const lastScored = [...a.drafts].reverse().find((d) => d.growthMove);
  if (lastScored) {
    const move = el('div', 'acard-move');
    move.append(el('span', 'acard-move-label', `From draft ${lastScored.cycleIndex + 1} — try this now`));
    move.append(el('p', null, lastScored.growthMove));
    card.append(move);
  }

  const note = [...a.drafts].reverse().find((d) => d.teacherNote);
  if (note) card.append(teacherNoteBlock(note));

  const foot = el('div', 'acard-foot');
  const go = el('button', 'acard-btn',
    `${a.hasActivity ? 'Continue' : 'Start'} Draft ${currentCycle + 1} →`);
  go.onclick = () => openAssignment(a.id);
  foot.append(go);
  card.append(foot);
  return card;
}

function teacherNoteBlock(draft) {
  const box = el('div', 'acard-note');
  box.append(el('span', 'acard-note-label', `✉ Note from your teacher on draft ${draft.cycleIndex + 1}`));
  box.append(el('p', null, draft.teacherNote));
  return box;
}

// Past assignments are review-only: no action, no coaching state — just the
// outcome and a way back into the reports.
function pastCard(a) {
  const card = el('article', 'pcard');
  const head = el('div', 'pcard-head');
  head.append(el('h3', null, a.title));
  const final = [...a.drafts].reverse().find((d) => d.tau);
  if (final) {
    const outcome = el('span', 'pcard-outcome');
    outcome.append(el('span', 'pcard-score', String(final.tau.totalScore)));
    outcome.append(el('span', 'pcard-denom', '/20'));
    outcome.append(el('span', `pcard-band samr-${final.tau.SAMR.toLowerCase()}`, final.tau.SAMR));
    head.append(outcome);
  }
  card.append(head);
  card.append(el('p', 'pcard-meta',
    `${a.drafts.length} draft${a.drafts.length === 1 ? '' : 's'} submitted`));

  const note = [...a.drafts].reverse().find((d) => d.teacherNote);
  if (note) card.append(teacherNoteBlock(note));

  card.append(draftChipRow(a.drafts));
  return card;
}

async function showAssignments() {
  $('viewWorkspace').classList.add('hidden');
  $('viewAssignments').classList.remove('hidden');

  const [home] = await Promise.all([
    api('/api/student/home'),
    mountAccountChip($('accountChip')),
  ]);

  renderRail(home);

  // Soonest deadline first — the only ordering a student can predict.
  const current = [...home.current].sort(
    (a, b) => dueInfo(a.dueDate).days - dueInfo(b.dueDate).days
  );
  const list = $('currentList');
  list.innerHTML = '';
  for (const a of current) list.append(currentCard(a));
  $('secCurrent').classList.toggle('hidden', current.length === 0);
  $('currentCount').textContent = current.length ? `${current.length} open` : '';

  const past = $('pastList');
  past.innerHTML = '';
  for (const a of home.past) past.append(pastCard(a));
  $('secPast').classList.toggle('hidden', home.past.length === 0);
  $('pastCount').textContent = home.past.length ? `${home.past.length} closed` : '';

  $('homeEmpty').classList.toggle('hidden', home.current.length + home.past.length > 0);
}

// ---------- workspace ----------

async function openAssignment(id) {
  const data = await api(`/api/assignments/${id}/open`, { method: 'POST' });
  state.assignment = data.assignment;
  state.session = data.session;
  state.conversations = data.conversations;
  state.hasActivity = data.hasActivity;
  state.conv = null;
  state.turns = [];
  state.submissions = [];
  // The current draft is always open; a past draft, once expanded to review
  // it, should stay expanded across a re-render (e.g. after sending a message).
  state.expandedCycles = new Set();

  $('viewAssignments').classList.add('hidden');
  $('viewWorkspace').classList.remove('hidden');
  $('wsTitle').textContent = data.assignment.title;
  $('wsPrompt').textContent = data.assignment.prompt;

  const mode = $('coachMode');
  mode.innerHTML = '';
  if (data.session) {
    mode.append(el('strong', null, data.modeLead || 'The coach is helping with this draft.'));
    mode.append(document.createTextNode(' ' + (data.modeNote || '')));
  } else {
    mode.append(el('strong', null, 'All drafts submitted.'));
    mode.append(document.createTextNode(' These conversations stay readable, but you can\'t add to them.'));
  }
  mode.classList.remove('hidden');
  $('btnSubmit').disabled = !data.session;

  logEvent('episode-resume');
  renderDraftSections();
  renderConversation();
  loadSubmissions().catch(() => {});
}

async function loadSubmissions() {
  state.submissions = await api(`/api/submissions?assignmentId=${state.assignment.id}`);
  renderDraftSections();
}

// One row per draft slot, 1..budget, always in that order — the same list
// the home card shows, and the same draftRowStatus vocabulary, so a student
// never sees "Draft 2" described one way on the home page and another way
// once they open it. Submitted drafts collapse to a summary line; the
// current draft is always expanded to its conversations; future drafts
// beyond the current one render as an inert locked row.
function renderDraftSections() {
  const nav = $('draftSections');
  nav.innerHTML = '';
  const budget = state.assignment.draftBudget;
  const currentCycle = state.session ? state.session.cycleIndex : null;

  const byCycle = new Map();
  for (const c of state.conversations) {
    if (!byCycle.has(c.cycleIndex)) byCycle.set(c.cycleIndex, []);
    byCycle.get(c.cycleIndex).push(c);
  }

  for (let cycle = 0; cycle < budget; cycle++) {
    const isCurrent = cycle === currentCycle;
    const convs = byCycle.get(cycle) || [];
    const submission = state.submissions.find((s) => s.cycleIndex === cycle);
    const status = draftRowStatus(cycle, { currentCycle, hasActivity: state.hasActivity, submission });
    if (isCurrent && status.key === 'in-progress') {
      status.detail = `${convs.length} conversation${convs.length === 1 ? '' : 's'}`;
    }
    nav.append(draftSection({ cycle, status, isCurrent, convs, submission }));
  }
}

function draftSection({ cycle, status, isCurrent, convs, submission }) {
  const cls = `draft-section draft-section-${status.key}`
    + (isCurrent ? ' draft-section-current' : '')
    + (status.samr ? ` samr-${status.samr.toLowerCase()}` : '');
  const section = el('div', cls);
  const header = el('div', 'draft-section-header');
  const collapsible = status.key === 'submitted';

  if (collapsible) {
    header.append(el('span', 'draft-section-caret', state.expandedCycles.has(cycle) ? '▾' : '▸'));
  }
  header.append(el('span', 'draft-section-label', `Draft ${cycle + 1}`));
  header.append(el('span', `draft-section-status status-${status.key}`, status.label));
  if (status.detail) header.append(el('span', 'draft-section-detail', status.detail));
  section.append(header);

  if (collapsible) {
    header.onclick = () => {
      if (state.expandedCycles.has(cycle)) state.expandedCycles.delete(cycle);
      else state.expandedCycles.add(cycle);
      renderDraftSections();
    };
  }

  const expanded = isCurrent || (collapsible && state.expandedCycles.has(cycle));
  if (expanded) {
    const body = el('div', 'draft-section-body');
    if (isCurrent) {
      const newBtn = el('button', 'new-conv-btn', '+ New conversation');
      newBtn.disabled = !state.session;
      newBtn.onclick = createConversation;
      body.append(newBtn);
    }
    for (const c of convs) {
      const item = el('div', 'conv-item' + (c.locked ? ' locked' : '') + (state.conv?.id === c.id ? ' active' : ''), c.title);
      item.onclick = () => openConversation(c.id);
      body.append(item);
    }
    if (status.key === 'submitted' && submission) {
      const link = el('div', 'draft-section-report-link', 'View report →');
      link.onclick = () => showReport(submission.id);
      body.append(link);
    }
    section.append(body);
  }

  return section;
}

async function createConversation() {
  if (!state.session) return;
  const conv = await api('/api/conversations', { method: 'POST', body: { sessionId: state.session.id } });
  state.conversations.unshift({ ...conv, cycleIndex: state.session.cycleIndex });
  await openConversation(conv.id);
}

async function openConversation(id) {
  if (state.streaming) return;
  const data = await api(`/api/conversations/${id}`);
  // The conversation fetch doesn't carry cycleIndex — it's a workspace-only
  // grouping concept, cached from the /open response and new-conversation calls.
  const cached = state.conversations.find((c) => c.id === id);
  state.conv = { ...data.conversation, cycleIndex: cached?.cycleIndex };
  state.turns = data.turns;
  renderDraftSections();
  renderConversation();
}

// Jumps back to the current draft's most recently active conversation when a
// student is reading a past, locked draft and wants to return to live work.
function returnToCurrentDraft() {
  if (!state.session) return;
  const convs = state.conversations.filter((c) => c.cycleIndex === state.session.cycleIndex);
  if (convs.length) {
    const mostRecent = [...convs].sort((a, b) => (b.lastActiveAt || '').localeCompare(a.lastActiveAt || ''))[0];
    openConversation(mostRecent.id);
  } else {
    state.conv = null;
    state.turns = [];
    renderDraftSections();
    renderConversation();
  }
}

function renderConversation() {
  const hasConv = !!state.conv;
  $('convTitle').textContent = hasConv ? state.conv.title : '';
  $('btnRename').classList.toggle('hidden', !hasConv);

  const locked = hasConv && state.conv.locked;
  $('composer').classList.toggle('hidden', !hasConv || locked);
  renderReadingBanner(locked);
  // The mode banner describes the current draft's coaching level — showing it
  // while reading an archived draft would misattribute it to that draft.
  $('coachMode').classList.toggle('hidden', locked);

  const box = $('messages');
  box.innerHTML = '';
  if (!hasConv) {
    box.appendChild($('emptyState') || makeEmptyState());
    $('emptyState')?.classList.remove('hidden');
    return;
  }
  for (const t of state.turns) box.appendChild(renderTurn(t));
  updateActionButtons();
  box.scrollTop = box.scrollHeight;
}

// Replaces the old passive bottom-of-page note: a persistent header that
// stays visible while scrolled, and always offers one click back to live work
// — reorienting a student who followed a locked conversation into the past.
function renderReadingBanner(locked) {
  const banner = $('readingBanner');
  banner.innerHTML = '';
  banner.classList.toggle('hidden', !locked);
  if (!locked) return;
  banner.append(el('span', 'reading-banner-text',
    `Reading Draft ${state.conv.cycleIndex + 1} · submitted — read-only`));
  if (state.session && state.conv.cycleIndex !== state.session.cycleIndex) {
    const btn = el('button', 'reading-banner-return', `Return to Draft ${state.session.cycleIndex + 1} →`);
    btn.onclick = returnToCurrentDraft;
    banner.append(btn);
  }
}

function makeEmptyState() {
  const div = document.createElement('div');
  div.className = 'empty-state';
  div.id = 'emptyState';
  div.innerHTML = `<p>Start a conversation with your writing coach.</p>
    <p class="empty-sub">The coach knows your assignment prompt — but not your other conversations. Catch it up on anything it needs to know.</p>`;
  return div;
}

const SPEAKER = { student: 'You', coach: 'Coach', auditor: 'Auditor · on request' };

// Wrapper + label + bubble. The label is what lets the auditor be a read-out
// rather than a third chat partner, so it is structural, not decoration.
function turnShell(role) {
  const wrap = el('div', `turn turn-${role}`);
  wrap.append(el('span', 'turn-speaker', SPEAKER[role] || role));
  const bubble = el('div', 'msg');
  wrap.append(bubble);
  return { wrap, bubble };
}

function renderTurn(t) {
  const { wrap, bubble } = turnShell(t.role);
  wrap.dataset.turnId = t.id;
  wrap.dataset.role = t.role;
  bubble.textContent = t.text;
  if (t.role === 'auditor') {
    bubble.append(el('em', 'auditor-disclaimer',
      'Not a score. Nothing here is recorded as part of your report — this exchange is excluded from the analysis.'));
  }
  if (t.meta?.stopped) bubble.append(el('span', 'stopped-note', 'generation stopped'));
  return wrap;
}

// Peer of the turns, not an overlay: the thread must not jump when the first
// token lands and the placeholder is swapped for the real bubble.
function thinkingIndicator(role) {
  const wrap = el('div', 'thinking');
  const pulse = el('span', 'thinking-pulse');
  for (let i = 0; i < 3; i++) pulse.append(el('i'));
  wrap.append(pulse);
  wrap.append(el('span', null, role === 'auditor' ? 'Auditor is reading…' : 'Coach is thinking…'));
  return wrap;
}

function updateActionButtons() {
  const real = state.turns.filter((t) => t.role !== 'auditor');
  const last = real[real.length - 1];
  const canAct = state.conv && !state.conv.locked && !state.streaming;
  $('btnRegenerate').classList.toggle('hidden', !(canAct && last?.role === 'coach'));
  $('btnStop').classList.toggle('hidden', !state.streaming);
  $('btnEvaluate').classList.toggle('hidden', !canAct || state.turns.length === 0);
  attachEditButton();
}

// Edit affordance on the last student turn only (v1 simplification of
// ChatGPT's branch-on-edit).
function attachEditButton() {
  document.querySelectorAll('.msg-edit-btn').forEach((b) => b.remove());
  if (!state.conv || state.conv.locked || state.streaming) return;
  const lastStudent = [...state.turns].reverse().find((t) => t.role === 'student');
  if (!lastStudent) return;
  // Anchored to the bubble, not the wrapper — the wrapper includes the speaker
  // label, which would hang the control above the text it edits.
  const bubble = document.querySelector(`[data-turn-id="${lastStudent.id}"] .msg`);
  if (!bubble) return;
  const btn = document.createElement('button');
  btn.className = 'msg-edit-btn';
  btn.textContent = '✎';
  btn.title = 'Edit message';
  btn.setAttribute('aria-label', 'Edit your message');
  btn.onclick = () => startEdit(lastStudent);
  bubble.appendChild(btn);
}

function startEdit(turn) {
  state.editingTurnId = turn.id;
  $('input').value = turn.text;
  $('editBanner').classList.remove('hidden');
  $('input').focus();
}

function cancelEdit() {
  state.editingTurnId = null;
  $('input').value = '';
  $('editBanner').classList.add('hidden');
}

// ---------- streaming actions ----------

async function streamAction(path, body, role) {
  state.streaming = true;
  state.abort = new AbortController();
  updateActionButtons();

  const { wrap: liveWrap, bubble: liveMsg } = turnShell(role);
  const thinking = thinkingIndicator(role);
  $('messages').append(thinking);
  $('messages').scrollTop = $('messages').scrollHeight;

  // Swapped on the first token rather than up front, so the pulse is visible for
  // the whole wait instead of sitting under an empty bubble.
  const showBubble = () => {
    if (thinking.isConnected) thinking.replaceWith(liveWrap);
  };

  try {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
      signal: state.abort.signal,
    });
    if (!res.ok) throw new Error((await res.json()).error || res.statusText);
    await readSSE(res, {
      onToken: (token) => {
        showBubble();
        liveMsg.textContent += token;
        $('messages').scrollTop = $('messages').scrollHeight;
      },
    });
  } catch (err) {
    if (err.name !== 'AbortError') {
      showBubble();
      liveMsg.textContent = `⚠ ${err.message}`;
      liveMsg.style.color = 'var(--tau-attention)';
    }
  }
  thinking.remove();

  state.streaming = false;
  state.abort = null;
  // Refetch: server is the source of truth for what got persisted (partial
  // text on stop, superseded turns on edit/regenerate).
  if (state.conv) {
    const data = await api(`/api/conversations/${state.conv.id}`);
    state.conv = data.conversation;
    state.turns = data.turns;
    renderConversation();
  }
}

async function sendMessage() {
  const text = $('input').value.trim();
  if (!text || state.streaming || !state.conv || state.conv.locked) return;

  const editOfTurnId = state.editingTurnId;
  cancelEdit();
  $('input').value = '';

  const isFirst = state.turns.filter((t) => t.role === 'student').length === 0 && !editOfTurnId;

  const student = turnShell('student');
  student.bubble.textContent = text;
  $('emptyState')?.classList.add('hidden');
  $('messages').append(student.wrap);
  $('messages').scrollTop = $('messages').scrollHeight;

  await streamAction(`/api/conversations/${state.conv.id}/message`, { text, editOfTurnId }, 'coach');

  // Flips the draft from "not started" to "in progress" the moment a message
  // is actually sent — not when a conversation is merely created.
  const wasFirstActivity = !state.hasActivity;
  state.hasActivity = true;

  if (isFirst) {
    const title = text.length > 42 ? text.slice(0, 42) + '…' : text;
    await api(`/api/conversations/${state.conv.id}/rename`, { method: 'POST', body: { title } });
    state.conv.title = title;
    const item = state.conversations.find((c) => c.id === state.conv.id);
    if (item) item.title = title;
    $('convTitle').textContent = title;
  }
  if (isFirst || wasFirstActivity) renderDraftSections();
}

// ---------- wiring ----------

$('btnSend').onclick = sendMessage;
$('input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

$('btnStop').onclick = () => state.abort?.abort();

$('btnRegenerate').onclick = () => {
  if (!state.streaming && state.conv) {
    // Remove the superseded coach bubble optimistically; refetch corrects.
    const last = [...$('messages').children].pop();
    if (last?.dataset.role === 'coach') last.remove();
    streamAction(`/api/conversations/${state.conv.id}/regenerate`, null, 'coach');
  }
};

$('btnEvaluate').onclick = () => {
  if (!state.streaming && state.conv) {
    streamAction(`/api/conversations/${state.conv.id}/evaluate`, null, 'auditor');
  }
};

$('btnCancelEdit').onclick = cancelEdit;

$('btnRename').onclick = async () => {
  const title = prompt('Rename conversation:', state.conv.title);
  if (!title) return;
  await api(`/api/conversations/${state.conv.id}/rename`, { method: 'POST', body: { title } });
  state.conv.title = title;
  const item = state.conversations.find((c) => c.id === state.conv.id);
  if (item) item.title = title;
  $('convTitle').textContent = title;
  renderDraftSections();
};

$('btnBack').onclick = () => showAssignments();

$('btnSaveClose').onclick = () => {
  logEvent('episode-save');
  showAssignments();
};

// Copy from a coach/auditor message = observed extraction.
document.addEventListener('copy', () => {
  const sel = document.getSelection();
  if (!sel || sel.isCollapsed) return;
  const node = sel.anchorNode?.parentElement?.closest('.msg');
  if (!node || node.dataset.role === 'student') return;
  logEvent('copy', {
    turnId: node.dataset.turnId,
    role: node.dataset.role,
    length: sel.toString().length,
  });
});

// ---------- draft reports ----------
// Reports render on report.html — the CTA results presentation ported whole.

function showReport(submissionId) {
  location.href = `/report.html?id=${submissionId}`;
}

// ---------- submit flow ----------

$('btnSubmit').onclick = () => {
  if (!state.session) return;
  const used = state.session.cycleIndex;
  const budget = state.assignment.draftBudget;
  $('submitWarning').textContent =
    `Submitting ends this session: all ${state.conversations.filter((c) => c.cycleIndex === state.session.cycleIndex).length || 'its'} conversation(s) lock and go to your teacher with your draft. This uses draft ${used + 1} of ${budget}.`;
  $('essayText').value = '';
  $('submitModal').classList.remove('hidden');
};

$('btnCancelSubmit').onclick = () => $('submitModal').classList.add('hidden');

$('btnConfirmSubmit').onclick = async () => {
  const essayText = $('essayText').value.trim();
  if (!essayText) {
    alert('Paste your draft first — the submission bundles your conversations with the essay.');
    return;
  }
  $('btnConfirmSubmit').disabled = true;
  try {
    const { submission } = await api(`/api/sessions/${state.session.id}/submit`, { method: 'POST', body: { essayText } });
    $('submitModal').classList.add('hidden');
    // Straight to the draft report — full disclosure at the submission marker
    await showReport(submission.id);
  } catch (err) {
    alert(err.message);
  } finally {
    $('btnConfirmSubmit').disabled = false;
  }
};

// ---------- boot ----------

showAssignments();
