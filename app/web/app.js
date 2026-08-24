const $ = (id) => document.getElementById(id);

const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

// The right-sliding drawer (.tray/.tray-overlay etc., components.css) — built
// for the teacher dashboard's flag detail, reused here for anything that's
// verbose enough to want its own scrollable surface rather than fighting for
// space inline on a card. Built lazily, once, and reused across opens rather
// than rebuilt per card.
let trayOverlayEl = null;
let trayEl = null;
function ensureTray() {
  if (trayEl) return;
  trayOverlayEl = el('div', 'tray-overlay');
  trayOverlayEl.onclick = closeTray;
  document.body.append(trayOverlayEl);

  trayEl = el('div', 'tray');
  const header = el('div', 'tray-header');
  const headings = el('div', null);
  headings.style.flex = '1';
  headings.append(el('div', 'tray-title'));
  headings.append(el('div', 'tray-subtitle'));
  header.append(headings);
  const close = el('button', 'tray-close');
  close.innerHTML = iconSVG('close');
  close.type = 'button';
  close.setAttribute('aria-label', 'Close');
  close.onclick = closeTray;
  header.append(close);
  trayEl.append(header);
  trayEl.append(el('div', 'tray-body'));
  document.body.append(trayEl);

  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeTray(); });
}
function openTray({ title, subtitle, body }) {
  ensureTray();
  trayEl.querySelector('.tray-title').textContent = title;
  trayEl.querySelector('.tray-subtitle').textContent = subtitle || '';
  const bodyEl = trayEl.querySelector('.tray-body');
  bodyEl.innerHTML = '';
  bodyEl.append(body);
  trayOverlayEl.classList.add('open');
  trayEl.classList.add('open');
}
function closeTray() {
  if (!trayEl) return;
  trayOverlayEl.classList.remove('open');
  trayEl.classList.remove('open');
}

const state = {
  assignment: null,
  session: null,
  conversations: [],
  submissions: [],
  hasActivity: false,
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
// onNotice carries out-of-band state about the session itself (budget), which
// is why it is not a turn: it did not come from the AI and must not enter the
// transcript the measurement reads.
async function readSSE(res, { onToken, onNotice }) {
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
      if (event === 'notice') onNotice?.(payload);
      if (event === 'done') result = payload;
      if (event === 'error') throw new Error(payload);
    }
  }
  return result;
}

// ---------- student home ----------

// Fixed dimension names — designsystem.md Hard Constraints: "No synonyms, no
// rewording per surface." Same names the report page uses (report-render.js),
// so a student's own vocabulary doesn't change between the rail and their report.
const DIMENSION_NAMES = {
  PQ: 'Prompting Quality',
  SU: 'Selective Use',
  CS: 'Calibrated Skepticism',
  OC: 'Original Contribution',
};

// What each dimension actually tracks — shown before there's any history to
// compare a draft against. One-time orientation, not a definition a student
// needs repeated once they know the system.
const DIMENSION_EXPLAIN = {
  PQ: "Whether you ask questions that push back or go deeper, not just ones that ask for more.",
  SU: 'What you do after getting an answer — build on it, or take it and move on.',
  CS: "Whether you push back when something doesn't sit right, rather than accepting it.",
  OC: "How much of the essay's thinking started with you, not the session.",
};

// A forward-looking nudge for a dimension that isn't trending up yet.
// Coach-voice: what to try, never what went wrong.
const DIMENSION_TIPS = {
  PQ: "Try asking a question that challenges what you're told, not just one that asks for more.",
  SU: 'When you get an answer, try pushing it further yourself before you move on.',
  CS: "It's fine to disagree — say so, and ask for something different.",
  OC: "Make sure some of the essay's ideas start with you, not just the session.",
};

// Named growth for a dimension that's genuinely climbing. Only used when
// that dimension's own trend actually supports it — see dimensionTier below.
const DIMENSION_WINS = {
  PQ: 'asking sharper questions than a few drafts ago',
  SU: 'doing more with what you get back, instead of stopping there',
  CS: 'pushing back more than you used to',
  OC: 'bringing more of your own thinking into the draft',
};

// The floor tier: a dimension that's stayed low for a stretch of drafts
// needs more than a one-line nudge (DIMENSION_TIPS assumes the student
// already gets the idea and just needs a reminder). This teaches the move
// itself, with a concrete next step — not what went wrong on any one draft.
const DIMENSION_EDUCATION = {
  PQ: "A challenge question pushes back on something specific — \"Why does this argument assume X?\" — instead of just asking for more. Next session, pick one thing the AI says and ask why it's true, not what else you can add.",
  SU: "Getting an answer isn't the finish line, it's the start of the next move. When the AI hands you something, restate it in your own words, test it against your own argument, or ask a follow-up before you use it — carrying it forward as-is is the pattern this dimension is catching.",
  CS: "Disagreeing with the AI isn't a risk, it's the point. If something doesn't sit right, say so directly: \"I don't think that's right because...\" or \"Can you give me something different?\" The AI can only revise what you push back on.",
  OC: "This dimension checks where the essay's ideas actually came from. Before you write a paragraph, work out what you think first — then use the AI to test or sharpen it, not to generate it. An idea you had before the session started counts as yours even if the AI agreed with it.",
};

// Below this, on average, a dimension counts as "consistently low" rather
// than just a rough draft — see dimensionTier.
const LOW_TIER_THRESHOLD = 2.5;
// Averaged over the most recent drafts, not the whole history — an early
// bad draft shouldn't keep weighing on the average once a student improves.
const LOW_TIER_WINDOW = 3;

function recentAverage(scored, key) {
  const recent = scored.slice(-LOW_TIER_WINDOW);
  return recent.reduce((sum, d) => sum + d.tau[key], 0) / recent.length;
}

// Each dimension gets its own tier, independent of how the other three are
// doing — a student can be climbing on Selective Use and still need the tip
// on Calibrated Skepticism; averaging that into one line would hide it.
// educational (orientation): nothing to compare against yet (first scored draft).
// affirmative: this dimension specifically is trending up — checked first,
//   so a student climbing out of a low patch gets the win, not a lecture.
// educational (floor): stayed low across recent drafts and isn't currently
//   climbing — needs to learn the move, not just be reminded of it.
// helpful: default — a tip on this dimension.
// Never assumes every draft involved the AI; that's its own signal in the
// numbers, not something the copy needs to presuppose.
function dimensionTier(key, tau, priorAvg, scored) {
  if (!priorAvg) return DIMENSION_EXPLAIN[key];
  const delta = tau[key] - priorAvg[key];
  if (delta >= 0.75) return `You're ${DIMENSION_WINS[key]}.`;
  if (recentAverage(scored, key) < LOW_TIER_THRESHOLD) return DIMENSION_EDUCATION[key];
  return DIMENSION_TIPS[key];
}

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

// Single vocabulary for what a draft's state means — used by the home card's
// draft list (the only place cross-draft status is shown).
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
    return { key: 'submitted', label: 'Submitted' };
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
// silently missing. Everything that belongs to a specific draft (its action
// button, its teacher note, its score) renders inside that draft's own row —
// there is no assignment-level footer duplicating what a row already owns.
//
// A submitted draft never shows its score or SAMR band here — a number
// invites reading it as a grade, and the ledger isn't where a student should
// be forming their read of a draft. That's the report's job; this row's
// only move is to point there.
//
// A slot gets vertical space in proportion to what it offers. The current
// draft is the only destination in the ledger and keeps all three lines;
// a submitted draft is one clickable row that points at its report; an
// upcoming draft is one muted line stating when it opens. Every slot is
// still listed with its own status — this is density, not concealment.
function draftRow(cycleIndex, status, opts = {}) {
  if (status.key === 'locked') return upcomingDraftLine(cycleIndex, status, opts);
  if (status.key === 'submitted') return submittedDraftTile(cycleIndex, status, opts);
  return currentDraftRow(cycleIndex, status, opts);
}

// The current draft. Line 1 identity, line 2 state, line 3 the one action.
// The activity detail ("2 sessions · last worked today") sits with the
// status rather than beside the button: the two facts describing where this
// draft stands read as one sentence, and the button gets a line to itself so
// it reads as the single thing this row is for.
function currentDraftRow(cycleIndex, status, opts) {
  const row = el('div', `draft-row draft-row-${status.key}`);

  const id = el('div', 'draft-row-id');
  id.append(el('span', 'draft-row-num', `Draft ${cycleIndex + 1}`));
  if (opts.dueDate) {
    const due = dueInfo(opts.dueDate);
    if (due.text) {
      id.append(el('span', 'draft-row-sep', '·'));
      id.append(el('span', `draft-row-due acard-due-${due.tone}`, due.text));
    }
  }
  // Marks the last draft slot as the one with nowhere further to revise to —
  // purely derived from draftBudget, not a flag a teacher sets separately.
  if (opts.isFinal) id.append(el('span', 'draft-row-final-badge', 'Final draft'));
  row.append(id);

  const state = el('div', 'draft-row-state');
  state.append(el('span', `draft-row-status status-${status.key}`, status.label));
  if (status.detail) {
    state.append(el('span', 'draft-row-sep', '·'));
    state.append(el('span', 'draft-row-detail', status.detail));
  }
  row.append(state);

  // The one action a student can take lives in the row of the draft it
  // moves forward — not in a card-level footer that repeats "Draft N".
  const body = el('div', 'draft-row-body');
  const go = el('button', 'acard-btn draft-row-btn');
  go.innerHTML = `${status.key === 'in-progress' ? 'Continue' : 'Start'} Draft ${cycleIndex + 1} ${iconSVG('arrowForward')}`;
  go.onclick = () => openAssignment(opts.assignmentId);
  body.append(go);
  row.append(body);

  return row;
}

// A submitted draft's only move is to point at its report, so the whole row
// is the control rather than a status line with a 36px button parked under
// it — one line instead of three, and a target well over --tau-target.
//
// It never shows its score or SAMR band, unlike the closed-assignment chips
// this borrows its shape from: a number invites reading it as a grade, and
// the ledger isn't where a student should be forming their read of a draft.
// That's the report's job.
//
// While a draft is still analyzing there is nothing to open, so the same
// shape renders as an inert div — a button that can't act is worse than no
// button.
function submittedDraftTile(cycleIndex, status, opts) {
  const reportId = opts.submission?.submissionId;
  const openable = reportId && !status.detail;
  const tile = el(openable ? 'button' : 'div', 'draft-tile');
  if (!openable) tile.setAttribute('aria-disabled', 'true');

  tile.append(el('span', 'draft-tile-num', `Draft ${cycleIndex + 1}`));
  tile.append(el('span', 'draft-tile-status', status.detail || status.label));

  // A teacher note is never guaranteed and never the point of the row — a
  // quiet flag, not a block. The note itself only ever reads in the report.
  if (opts.submission?.teacherNote) {
    const flag = el('span', 'draft-row-note-flag');
    flag.innerHTML = `${iconSVG('chat')} Note from your teacher`;
    tile.append(flag);
  }

  if (openable) {
    const go = el('span', 'draft-tile-go');
    go.innerHTML = `View report ${iconSVG('chevronRight')}`;
    tile.append(go);
    tile.onclick = () => { logUse('student-home', 'past-report'); showReport(reportId); };
  }
  return tile;
}

// An upcoming draft is neither actionable nor rare, so it gets weight and
// colour, never a filled boundary (designsystem.md's enclosure test). It
// also drops "Not available yet": "Opens after Draft 2 is submitted" states
// the same fact and states the useful half. Still one line per slot, so the
// budget stays as explicit as every other row.
function upcomingDraftLine(cycleIndex, status, opts) {
  const line = el('div', 'draft-upcoming');
  line.append(el('span', 'draft-upcoming-num', `Draft ${cycleIndex + 1}`));

  // Lowercased because it runs on after a separator here rather than opening
  // its own line, the way it does everywhere else draftRowStatus is read.
  const opens = status.detail.charAt(0).toLowerCase() + status.detail.slice(1);
  const rest = [];
  const due = opts.dueDate ? dueInfo(opts.dueDate) : null;
  if (due?.text) rest.push(due.text);
  rest.push(opts.isFinal ? `Final · ${opens}` : opens);
  line.append(el('span', null, rest.join(' · ')));
  return line;
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
    pending.append(el('span', 'chip-status', draft.analysisStatus === 'error' ? 'unavailable' : 'analyzing…'));
    return pending;
  }
  const draftLevel = levelName(draft.tau.SAMR);
  const chip = el('button', `draft-chip level-${draftLevel.toLowerCase()}`);
  chip.append(el('span', 'chip-cycle', `Draft ${draft.cycleIndex + 1}`));
  chip.append(el('span', 'chip-samr', draftLevel));
  if (draft.hasTeacherNote) {
    const note = el('span', 'chip-note');
    note.innerHTML = iconSVG('chat');
    chip.append(note);
  }
  chip.onclick = () => { logUse('student-home', 'past-report'); showReport(draft.submissionId); };
  return chip;
}

function draftChipRow(drafts) {
  const row = el('div', 'chip-row');
  for (const d of drafts) row.append(draftChip(d));
  return row;
}


// One block per dimension: name, current score, and a guidance line tiered
// to that dimension's own trend (see dimensionTier) — no bar, the number and
// the sentence carry it.
//
// Compared against priorAvg — the mean of every earlier scored draft, not
// just the immediately previous one — because the dimensions are the one
// figure that's actually comparable across different assignments (they
// measure a behaviour, not an outcome graded against that assignment's own
// rubric). A same-assignment-only comparison sat empty for any student who
// submits one draft per assignment; the average has something to compare
// against from a student's second scored draft on, full stop.
function dimensionMeters(tau, priorAvg, scored) {
  const grid = el('div', 'meters');
  for (const [key, name] of Object.entries(DIMENSION_NAMES)) {
    const row = el('div', 'meter-row');
    row.append(el('span', 'meter-name', name));
    row.append(el('p', 'meter-guidance', dimensionTier(key, tau, priorAvg, scored)));
    grid.append(row);
  }
  return grid;
}

// Same order the main list renders in (soonest due date first) so a rail
// row and its card never disagree about position — one sort, read twice.
function sortedCurrent(home) {
  return [...home.current].sort((a, b) => dueInfo(a.dueDate).days - dueInfo(b.dueDate).days);
}

function renderRailNav(home) {
  const host = $('railNav');
  host.innerHTML = '';
  const current = sortedCurrent(home);
  host.classList.toggle('hidden', current.length === 0);
  if (!current.length) return;

  // "Current assignments", not the old "Jump to" — a label names the content
  // it stands over, never the action the reader is about to take on it
  // (Morville & Rosenfeld's labeling rule; see the product-design-review
  // skill's information-architecture reference). It deliberately repeats the
  // heading of the section it indexes, which is what makes it an index.
  const group = el('div', 'rail-group');
  group.append(el('span', 'eyebrow', 'Current assignments'));
  for (const a of current) {
    const eyebrow = statusEyebrow(a);
    const row = el('button', 'rail-item');
    row.type = 'button';
    const text = el('span', 'rail-item-text');
    text.append(el('span', 'rail-item-name', a.title));
    text.append(el('span', `rail-item-sub acard-due-${eyebrow.tone}`, eyebrow.text));
    row.append(text);
    row.addEventListener('click', () => {
      const card = $(`card-${a.id}`);
      if (!card) return;
      card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      card.classList.add('acard-jumped');
      setTimeout(() => card.classList.remove('acard-jumped'), 1200);
    });
    group.append(row);
  }
  host.append(group);
}

// A note is unread until the student opens that draft's report, and a note
// the teacher edits afterwards goes unread again — its teacherNoteAt moves
// past the read stamp. Scoped to open assignments: a note on work that's
// closed has no next draft to apply it to, so announcing it in the hero
// would leave a chip nothing can act on or clear.
function unreadNotes(home) {
  return home.current
    .flatMap((a) => a.drafts.map((d) => ({ ...d, assignmentTitle: a.title })))
    .filter((d) => d.teacherNoteAt && (!d.teacherNoteReadAt || d.teacherNoteReadAt < d.teacherNoteAt))
    .sort((x, y) => (x.teacherNoteAt < y.teacherNoteAt ? -1 : 1));
}

// The hero states who you are and what's true right now. Every segment is a
// count of something live and renders only when it's non-zero, so a quiet
// week is one segment and no dangling separators. Bare text, never chips: a
// count is the common case, which is the half of the enclosure test a chip
// has to clear.
function renderHero(home) {
  const first = home.student.displayName.split(' ')[0];
  const open = home.current.length;
  $('heroGreeting').textContent = open ? `Welcome back, ${first}` : `Welcome, ${first}`;

  const state = $('heroState');
  state.innerHTML = '';
  const segs = [];
  if (open) {
    segs.push({ text: `${open} assignment${open === 1 ? '' : 's'} open` });
    // Counts the draft a student would actually sit down to — the open slot
    // on each assignment — not every dated slot in every budget.
    const due = home.current.map((a) => dueInfo(a.draftDueDates?.[a.draftsUsed] || a.dueDate));
    const today = due.filter((d) => d.days === 0).length;
    const late = due.filter((d) => d.days < 0).length;
    if (today) segs.push({ text: `${today} draft${today === 1 ? '' : 's'} due today` });
    // Colour AND the word — "overdue" states it on its own for anyone the
    // attention tone doesn't reach.
    if (late) segs.push({ text: `${late} overdue`, cls: 'hero-state-late' });
  }

  if (!segs.length) {
    state.append(el('span', 'hero-state-quiet',
      'No assignments yet — when your teacher sets one, it lands here.'));
  } else {
    segs.forEach((seg, i) => {
      if (i) state.append(el('span', 'hero-sep', '·'));
      state.append(el('span', seg.cls || null, seg.text));
    });
  }

  // The one enclosed thing in the hero, and only while a note is unread:
  // actionable and rare, which is both halves of the enclosure test. Reading
  // it is what clears it — the ✉ on the draft's own tile stays either way,
  // because the note remains a property of that draft.
  const news = $('heroNews');
  news.innerHTML = '';
  const unread = unreadNotes(home);
  if (!unread.length) return;
  const newest = unread[unread.length - 1];
  const chip = el('button', 'hero-news-chip');
  chip.type = 'button';
  chip.innerHTML = `${iconSVG('chat')} ${unread.length === 1
    ? 'Note from your teacher'
    : `${unread.length} notes from your teacher`}`;
  chip.onclick = () => { logUse('student-home', 'hero-note'); showReport(newest.submissionId); };
  news.append(chip);
}

function renderRail(home) {
  const first = home.student.displayName.split(' ')[0];

  renderRailNav(home);

  const scored = scoredDrafts(home);
  const host = $('railProgress');
  host.innerHTML = '';

  if (!scored.length) {
    host.append(el('p', 'rail-empty',
      `Submit your first draft, ${first}, and this is where you'll see how you're working with the AI.`));
    return;
  }

  const last = scored[scored.length - 1];
  const earlier = scored.slice(0, -1);

  // The dimensions are the one figure on this dashboard that's actually
  // comparable across different assignments — they measure a behaviour
  // (do you push back, do you follow up), not an outcome graded against
  // that assignment's own rubric. Compared against the mean of every
  // earlier scored draft, not gated to same-assignment pairs.
  let priorAvg = null;
  if (earlier.length) {
    priorAvg = {};
    for (const key of Object.keys(DIMENSION_NAMES)) {
      priorAvg[key] = earlier.reduce((sum, d) => sum + d.tau[key], 0) / earlier.length;
    }
  }

  const block = el('div', 'rail-block');
  block.append(el('h3', 'eyebrow', 'AI use guidance'));
  block.append(dimensionMeters(last.tau, priorAvg, scored));
  host.append(block);
}

// Current assignment. Reading order is the order a student needs it in:
// when is it due → what is it → where every draft stands → what changes →
// what to do.
// Chrome is the shared .card molecule (+.card-lg, the size this card's own
// radius/padding independently matched); urgency reuses .card-edge-caution/
// .card-edge-attention from the same layer rather than a private edge rule.
const CARD_EDGE_CLASS = { soon: 'card-edge-caution', late: 'card-edge-attention' };
// A plain chevron, not a text-content ::after trick — "we need an icon to
// denote the interaction" was explicit feedback, not a nice-to-have. Shared
// by both disclosures below (the prompt and the assignment-wide note).
const CHEVRON_SVG = '<svg class="acard-disclosure-icon" viewBox="0 0 12 12" fill="none" aria-hidden="true">'
  + '<path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';

// Three teacher-authored fields, shown as labeled sections rather than one
// wall of text — matches how they're authored (separate fields) and read
// (what/why/must-haves), not the single "prompt" blob this used to be.
function assignmentBriefBody(a) {
  const wrap = el('div', null);
  const section = (label, text) => {
    if (!text) return;
    wrap.append(el('div', 'tray-section-label', label));
    wrap.append(el('p', 'tray-section-body', text));
  };
  section('Description', a.description);
  section('Purpose', a.purpose);
  section('Requirements', a.requirements);
  return wrap;
}

function currentCard(a) {
  // card-hero (the same lift/radius step as the report's score panel) is
  // reserved for the one surface per screen that's the actual takeaway — a
  // student can have several open assignment cards at once, and giving all
  // of them hero elevation would mean none of them reads as more important
  // than the others. Plain card-lg keeps them at content-unit elevation.
  const card = el('article', 'card card-lg acard');
  card.id = `card-${a.id}`;
  const eyebrow = statusEyebrow(a);
  if (CARD_EDGE_CLASS[eyebrow.tone]) card.classList.add(CARD_EDGE_CLASS[eyebrow.tone]);

  const top = el('div', 'acard-top');
  // Null for an assignment predating the classes model (visible to everyone) —
  // nothing to name in that case.
  if (a.className) {
    top.append(el('span', 'acard-class', a.className));
    top.append(el('span', 'acard-sep', '·'));
  }
  top.append(el('span', `acard-due acard-due-${eyebrow.tone}`, eyebrow.text));
  const titleRow = el('div', 'acard-title-row');
  titleRow.append(el('h3', 'acard-title', a.title));
  // The prompt + rubric is genuinely long — usually the whole grading
  // criteria, not a sentence — so it earns its own scrollable surface
  // instead of an inline block that pushes every other card element down
  // every time a student has it open. A button, not a disclosure: there's
  // nothing to preview, it's either open in the tray or it isn't.
  const rubricBtn = el('button', 'btn btn-quiet btn-sm acard-rubric-btn');
  rubricBtn.innerHTML = `${iconSVG('checklist')} Prompt & rubric`;
  rubricBtn.type = 'button';
  rubricBtn.onclick = () => openTray({
    title: 'Assignment prompt & rubric',
    subtitle: a.title,
    body: assignmentBriefBody(a),
  });
  titleRow.append(rubricBtn);
  top.append(titleRow);
  card.append(top);

  // An assignment-wide teacher note (not tied to any one draft) is never
  // guaranteed — most assignments won't have one — so it stays a small,
  // click-to-expand disclosure rather than a block that would read as a
  // permanent part of the card. It's the one thing left inline (unlike the
  // rubric, above, now in the tray): short enough that its own vertical
  // space is worth spending. The chip itself carries the auditor tint even
  // closed, not just the text — colour is the "carries weight" signal here.
  if (a.teacherNote) {
    const noteDetails = el('details', 'acard-disclosure acard-disclosure-note');
    const noteSummary = el('summary', 'acard-disclosure-toggle');
    noteSummary.innerHTML = `${CHEVRON_SVG}${iconSVG('chat')} Teacher's note`;
    noteDetails.append(noteSummary);
    noteDetails.append(el('p', null, a.teacherNote));
    card.append(noteDetails);
  }

  // Every draft slot gets its own row and its own status — an assignment
  // being "underway" says nothing about whether draft 2 specifically has
  // been started, so that has to be read off its own row, not inferred.
  // Locked rows stay one-per-draft (a collapsed "N more drafts" line was
  // tried and read as vague — the budget itself, draft 3 of 4 etc., should
  // be as explicit as every other row) but are visually inert: no bold, no
  // status color, the row reads as unavailable at a glance. The current
  // draft's action button and any teacher note live inside that same row —
  // content maps to the specific draft it belongs to, not to the card as a
  // whole.
  // Newest slot first — final, then back down to draft 1 — so the current
  // draft and what's still ahead sit above the drafts already handed in,
  // rather than under a growing stack of finished work.
  const currentCycle = a.draftsUsed;
  const rows = el('div', 'draft-rows');
  for (let i = a.draftBudget - 1; i >= 0; i--) {
    const submission = a.drafts.find((d) => d.cycleIndex === i);
    const status = draftRowStatus(i, { currentCycle, hasActivity: a.hasActivity, submission });
    if (status.key === 'in-progress') {
      status.detail = `${a.conversationCount} session${a.conversationCount === 1 ? '' : 's'} · last worked ${relTime(a.lastActiveAt)}`;
    }
    rows.append(draftRow(i, status, {
      submission, assignmentId: a.id,
      dueDate: a.draftDueDates?.[i], isFinal: i === a.draftBudget - 1,
    }));
  }
  card.append(rows);

  return card;
}

// Past assignments are review-only: no action, no coaching state — just the
// outcome and a way back into the reports.
function pastCard(a) {
  const card = el('article', 'card pcard');
  const head = el('div', 'pcard-head');
  head.append(el('h3', null, a.title));
  const final = [...a.drafts].reverse().find((d) => d.tau);
  if (final) {
    const outcome = el('span', 'pcard-outcome');
    outcome.append(el('span', `pcard-band level-${levelName(final.tau.SAMR).toLowerCase()}`, levelName(final.tau.SAMR)));
    head.append(outcome);
  }
  card.append(head);
  const meta = a.className
    ? `${a.className} · ${a.drafts.length} draft${a.drafts.length === 1 ? '' : 's'} submitted`
    : `${a.drafts.length} draft${a.drafts.length === 1 ? '' : 's'} submitted`;
  card.append(el('p', 'pcard-meta', meta));

  // A note's presence is the chip's own ✉ marker (draftChip) — the chip
  // already opens the report on click, which is where the note itself reads.
  card.append(draftChipRow(a.drafts));
  return card;
}

async function showAssignments() {
  $('viewWorkspace').classList.add('hidden');
  $('viewAssignments').classList.remove('hidden');

  const home = await api('/api/student/home');
  // Reload must not clear a warning the student was already shown — the stream
  // only re-raises it on the next reply, which is one reply too late.
  syncBudgetNotice(home.budget);

  renderHero(home);
  renderRail(home);
  renderNavCrumbs($('navCrumbs'), [{ label: 'All assignments', current: true }]);
  renderNavLocal($('navLocal'), []);

  // Soonest deadline first — the only ordering a student can predict.
  const current = sortedCurrent(home);
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
  logUse('student-home', 'open-assignment');
  const data = await api(`/api/assignments/${id}/open`, { method: 'POST' });
  state.assignment = data.assignment;
  state.session = data.session;
  state.conversations = data.conversations;
  state.hasActivity = data.hasActivity;
  state.conv = null;
  state.turns = [];
  state.submissions = [];

  $('viewAssignments').classList.add('hidden');
  $('viewWorkspace').classList.remove('hidden');
  // The bar's scrolled state belongs to the home pane, which is now hidden —
  // left set, it would tint the bar over a workspace that never scrolls it.
  $('tauNav').classList.remove('scrolled');
  const wsPrompt = $('wsPrompt');
  wsPrompt.innerHTML = '';
  wsPrompt.append(assignmentBriefBody(data.assignment));

  // Only state left worth a banner now that coaching levels are gone: an
  // active draft needs no announcement, a used-up budget does.
  const banner = $('draftsDoneBanner');
  banner.innerHTML = '';
  if (!data.session) {
    banner.append(el('strong', null, 'All drafts submitted.'));
    banner.append(document.createTextNode(' These sessions stay readable, but you can\'t add to them.'));
  }
  banner.classList.toggle('hidden', !!data.session);
  $('btnSubmit').disabled = !data.session;

  logEvent('episode-resume');
  renderSessionList();
  renderConversation();
  loadSubmissions().catch(() => {});
}

// The header's breadcrumb and local toggle both come from workspace state,
// not from which HTML view is showing — called after anything that changes
// which assignment/draft/session is on screen. The toggle only renders
// while reading a locked, submitted draft: that's the one case where a
// report genuinely exists for the same draft as the session in view.
function renderWorkspaceNav() {
  const draftNum = state.conv ? state.conv.cycleIndex + 1
    : state.session ? state.session.cycleIndex + 1
    : null;
  const crumbs = [
    { label: 'All assignments', onClick: showAssignments },
    { label: state.assignment.title },
  ];
  if (draftNum != null) crumbs.push({ label: `Draft ${draftNum}`, current: true });
  renderNavCrumbs($('navCrumbs'), crumbs);

  if (state.conv && state.conv.locked) {
    const submission = state.submissions.find((s) => s.cycleIndex === state.conv.cycleIndex);
    // Same fixed left-to-right order as report-boot.js's toggle (Report,
    // then Session) — only which one is active differs. Reordering by
    // active state instead would make the pair swap sides across the page
    // navigation between the two views, which reads as broken, not sliding.
    renderNavLocal($('navLocal'), [
      { label: 'Report', active: false, onClick: () => submission && showReport(submission.id) },
      { label: 'Session', active: true },
    ]);
  } else {
    renderNavLocal($('navLocal'), []);
  }
}

async function loadSubmissions() {
  state.submissions = await api(`/api/submissions?assignmentId=${state.assignment.id}`);
  renderSessionList();
  renderWorkspaceNav();
}

// Claude-Code-style session panel: a flat, newest-first list of this draft's
// sessions. Other drafts already have full status, score and report
// links on the home assignment card — repeating that hierarchy here would
// just be a second, competing place to look for it, so the workspace only
// ever shows the one draft you're actually working in.
function renderSessionList() {
  const list = $('sessionList');
  list.innerHTML = '';
  const currentCycle = state.session ? state.session.cycleIndex : null;
  const convs = state.conversations.filter((c) => c.cycleIndex === currentCycle);

  $('btnNewSession').disabled = !state.session;

  if (!convs.length) {
    list.append(el('p', 'rail-empty', 'No sessions yet.'));
    return;
  }
  const group = el('div', 'rail-group');
  for (const c of convs) {
    const item = el('div', 'rail-item conv-item' + (c.locked ? ' locked' : '') + (state.conv?.id === c.id ? ' active' : ''));
    const text = el('span', 'rail-item-text');
    text.append(el('span', 'rail-item-name', c.title));
    item.append(text);
    item.onclick = () => openConversation(c.id);
    group.append(item);
  }
  list.append(group);
}

// "+ New session" doesn't create anything server-side yet — a session only
// earns a spot in the list (and a server row) once the student actually sends
// a first message, in sendMessage() below. Until then this is just a blank
// composer the student can also abandon by clicking another session.
function startNewSession() {
  if (!state.session || state.streaming) return;
  state.conv = { id: null, title: 'New session', cycleIndex: state.session.cycleIndex, locked: false };
  state.turns = [];
  renderSessionList();
  renderConversation();
}

async function openConversation(id) {
  if (state.streaming) return;
  const data = await api(`/api/conversations/${id}`);
  // The session fetch doesn't carry cycleIndex — it's a workspace-only
  // grouping concept, cached from the /open response and new-session calls.
  const cached = state.conversations.find((c) => c.id === id);
  state.conv = { ...data.conversation, cycleIndex: cached?.cycleIndex };
  state.turns = data.turns;
  renderSessionList();
  renderConversation();
}

// Jumps back to the current draft's most recently active session when a
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
    renderSessionList();
    renderConversation();
  }
}

// Sits above the composer, where the student is about to spend the next reply
// — not in the transcript. Neither of these came from the AI, and a non-turn in
// the transcript would be read back by the analysis as one.
//
// Two tones, because they are different kinds of thing: 'caution' is a
// condition of the session that can stop it, 'quiet' is a suggestion the
// student is free to ignore. A suggestion in warning colours reads as a
// telling-off for working hard, which is the opposite of what it is for.
// What a notice's action button does. Kept here rather than sent from the
// server: the server says what is true, the client owns what a student can do
// about it — and a server-supplied handler name would be a route to running
// arbitrary UI from a payload.
const NOTICE_ACTIONS = {
  'new-session': () => $('btnNewSession').click(),
};

function showNotice(notice) {
  const { kind = 'budget', tone = 'caution', title, detail, action } =
    typeof notice === 'string' ? { title: notice } : notice;

  const stack = $('noticeStack');
  // Keyed by kind so a re-send replaces its own bar rather than stacking a
  // second copy — the budget warning arrives on every reply past 80%.
  stack.querySelector(`[data-notice="${kind}"]`)?.remove();

  const bar = el('div', `composer-notice${tone === 'quiet' ? ' composer-notice-quiet' : ''}`);
  bar.dataset.notice = kind;

  const text = el('div', 'composer-notice-text');
  text.append(el('strong', null, title));
  if (detail) text.append(el('span', 'composer-notice-detail', ` · ${detail}`));
  bar.append(text);

  if (action && NOTICE_ACTIONS[action.id]) {
    const act = el('button', 'composer-notice-act', action.label);
    act.type = 'button';
    act.onclick = () => { bar.remove(); NOTICE_ACTIONS[action.id](); };
    bar.append(act);
  }

  const close = el('button', 'composer-notice-close', '×');
  close.type = 'button';
  close.setAttribute('aria-label', 'Dismiss');
  // Dismissible even when it is the budget: the server re-raises that one on
  // every reply past 80%, so waving it away costs the student nothing they
  // won't be told again before the wall.
  close.onclick = () => bar.remove();
  bar.append(close);

  stack.append(bar);
}

// The blocked case sends no warning, so `null` here means either "plenty left"
// or "already out" — and the second is delivered as a 429 the student cannot
// miss. Clearing on null is therefore right: it is what un-raises the bar when
// the day rolls over.
function syncBudgetNotice(budget) {
  if (budget?.warning) showNotice(budget.warning);
  else $('noticeStack').querySelector('[data-notice="budget"]')?.remove();
}

function renderConversation() {
  renderWorkspaceNav();

  const hasConv = !!state.conv;
  $('convTitle').textContent = hasConv ? state.conv.title : '';
  // No server row yet for a not-yet-sent new session — nothing to rename.
  $('btnRename').classList.toggle('hidden', !hasConv || !state.conv.id);

  const locked = hasConv && state.conv.locked;
  $('composer').classList.toggle('hidden', !hasConv || locked);
  renderReadingBanner(locked);
  // Hidden while reading an archived draft: "all drafts submitted" is about
  // the assignment as a whole, not the draft being read.
  if (locked) $('draftsDoneBanner').classList.add('hidden');

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
// — reorienting a student who followed a locked session into the past.
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
  div.innerHTML = `<p>Start a new chat.</p>
    <p class="empty-sub">The AI starts with nothing — not your assignment, not your other chats. Tell it whatever it needs to know.</p>`;
  return div;
}

// 'coach' is the stored turn role and stays as-is in the data; the label the
// student reads is just "AI" now that there is no coaching persona.
const SPEAKER = { student: 'You', coach: 'AI', auditor: 'Auditor · on request' };

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
  if (t.role === 'student') bubble.textContent = t.text;
  else setMarkdown(bubble, t.text);
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
  wrap.append(el('span', 'thinking-orb'));
  // "Thinking" is vague; naming what's actually happening makes the wait
  // legible instead of just decorative.
  wrap.append(el('span', null, role === 'auditor' ? 'Auditor is reading…' : 'Reading your last message…'));
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
  let raw = '';
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
    // Re-rendered from the raw buffer on every token rather than appended to.
    // Markdown is only decidable per block, and appending would leave a bubble
    // showing asterisks until the reply finished — the reader would watch the
    // formatting arrive, which is the thing this change exists to remove.
    await readSSE(res, {
      onToken: (token) => {
        showBubble();
        raw += token;
        setMarkdown(liveMsg, raw);
        $('messages').scrollTop = $('messages').scrollHeight;
      },
      onNotice: showNotice,
    });
  } catch (err) {
    if (err.name !== 'AbortError') {
      showBubble();
      liveMsg.classList.remove('msg-prose');
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

  // The server row (and the sidebar entry) doesn't exist until this first
  // send — see startNewSession().
  if (!state.conv.id) {
    logUse('workspace', 'new-conversation');
    const conv = await api('/api/conversations', { method: 'POST', body: { sessionId: state.session.id } });
    state.conv = { ...conv, cycleIndex: state.session.cycleIndex };
    state.conversations.unshift(state.conv);
  }

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
  if (isFirst || wasFirstActivity) renderSessionList();
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
    logUse('workspace', 'evaluate');
    streamAction(`/api/conversations/${state.conv.id}/evaluate`, null, 'auditor');
  }
};

$('btnCancelEdit').onclick = cancelEdit;

$('btnRename').onclick = async () => {
  const title = prompt('Rename session:', state.conv.title);
  if (!title) return;
  await api(`/api/conversations/${state.conv.id}/rename`, { method: 'POST', body: { title } });
  state.conv.title = title;
  const item = state.conversations.find((c) => c.id === state.conv.id);
  if (item) item.title = title;
  $('convTitle').textContent = title;
  renderSessionList();
};

$('btnNewSession').onclick = startNewSession;

// Copy from an AI/auditor message = observed extraction.
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

// Entry point from a report page's "Session" toggle — jumps straight
// into that draft's own session rather than the assignment list, since
// the report already told the student exactly which draft they came from.
async function openFromReportLink(assignmentId, cycleIndex) {
  await openAssignment(assignmentId);
  const convs = state.conversations.filter((c) => c.cycleIndex === cycleIndex);
  if (convs.length) {
    const mostRecent = [...convs].sort((a, b) => (b.lastActiveAt || '').localeCompare(a.lastActiveAt || ''))[0];
    await openConversation(mostRecent.id);
  }
}

// ---------- submit flow ----------

let uploadedText = '';

const UPLOAD_DROP_DEFAULT = 'Drop your file here, or <span class="link-btn">browse</span>';

function resetDraftUpload() {
  uploadedText = '';
  $('draftFile').value = '';
  $('uploadError').classList.add('hidden');
  $('uploadRemoveRow').classList.add('hidden');
  $('uploadDrop').classList.remove('has-file');
  $('uploadDropLabel').innerHTML = UPLOAD_DROP_DEFAULT;
  $('essayText').value = '';
  $('draftUpload').classList.remove('hidden');
  $('draftPaste').classList.add('hidden');
  updateSubmitEnabled();
}

function updateSubmitEnabled() {
  const active = $('draftPaste').classList.contains('hidden') ? uploadedText : $('essayText').value.trim();
  $('btnConfirmSubmit').disabled = !active;
}

function showUploadError(msg) {
  uploadedText = '';
  $('draftFile').value = '';
  $('uploadDrop').classList.remove('has-file');
  $('uploadRemoveRow').classList.add('hidden');
  $('uploadDropLabel').innerHTML = UPLOAD_DROP_DEFAULT;
  $('uploadError').textContent = msg;
  $('uploadError').classList.remove('hidden');
  updateSubmitEnabled();
}

async function handleDraftFile(file) {
  $('uploadError').classList.add('hidden');
  const name = file.name || '';
  const ext = name.toLowerCase().slice(name.lastIndexOf('.'));
  if (ext !== '.docx' && ext !== '.txt') {
    showUploadError(`Can't read a ${ext || 'this'} file — try .docx or .txt, or paste your draft instead.`);
    return;
  }
  try {
    if (ext === '.txt') {
      uploadedText = (await file.text()).trim();
    } else {
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer });
      uploadedText = result.value.trim();
    }
    if (!uploadedText) {
      showUploadError("That file looks empty — try pasting your draft instead.");
      return;
    }
    $('uploadDrop').classList.add('has-file');
    $('uploadDropLabel').textContent = name;
    $('uploadRemoveRow').classList.remove('hidden');
  } catch (err) {
    showUploadError("Couldn't read that file — try pasting your draft instead.");
  }
  updateSubmitEnabled();
}

$('btnRemoveFile').onclick = () => resetDraftUpload();

$('draftFile').onchange = (e) => {
  const file = e.target.files[0];
  if (file) handleDraftFile(file);
};

$('uploadDrop').ondragover = (e) => { e.preventDefault(); $('uploadDrop').classList.add('drag-over'); };
$('uploadDrop').ondragleave = () => $('uploadDrop').classList.remove('drag-over');
$('uploadDrop').ondrop = (e) => {
  e.preventDefault();
  $('uploadDrop').classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file) handleDraftFile(file);
};

$('btnSwitchToPaste').onclick = () => {
  $('draftUpload').classList.add('hidden');
  $('draftPaste').classList.remove('hidden');
  $('essayText').focus();
  updateSubmitEnabled();
};

$('btnSwitchToUpload').onclick = () => {
  $('draftPaste').classList.add('hidden');
  $('draftUpload').classList.remove('hidden');
  updateSubmitEnabled();
};

$('essayText').oninput = updateSubmitEnabled;

$('btnSubmit').onclick = () => {
  if (!state.session) return;
  const used = state.session.cycleIndex;
  const budget = state.assignment.draftBudget;
  const convCount = state.conversations.filter((c) => c.cycleIndex === state.session.cycleIndex).length || 1;
  const warning = $('submitWarning');
  warning.innerHTML = '';
  warning.append(el('li', null,
    `All ${convCount} of this draft's session${convCount === 1 ? '' : 's'} lock and go to your teacher with your draft.`));
  warning.append(el('li', null, `This uses draft ${used + 1} of ${budget}.`));
  resetDraftUpload();
  $('submitModal').classList.remove('hidden');
};

$('btnCancelSubmit').onclick = () => $('submitModal').classList.add('hidden');

$('btnConfirmSubmit').onclick = async () => {
  const essayText = $('draftPaste').classList.contains('hidden') ? uploadedText : $('essayText').value.trim();
  if (!essayText) return;
  $('btnConfirmSubmit').disabled = true;
  try {
    logUse('workspace', 'submit');
    const { submission } = await api(`/api/sessions/${state.session.id}/submit`, { method: 'POST', body: { essayText } });
    $('submitModal').classList.add('hidden');
    // Straight to the draft report — full disclosure at the submission marker
    await showReport(submission.id);
  } catch (err) {
    alert(err.message);
    updateSubmitEnabled();
  }
};

// ---------- boot ----------

// The top app bar takes a tonal step once content passes under it, instead of
// asserting a permanent hairline (m3-lab §7). Bound to .dash-main because the
// body does not scroll on this page — the home content pane does. The
// workspace view is deliberately not bound: its bar sits directly above
// .chat-header, which is already the seam.
{
  const pane = $('home');
  const bar = $('tauNav');
  pane.addEventListener('scroll', () => bar.classList.toggle('scrolled', pane.scrollTop > 2), { passive: true });
}

mountAccountChip($('accountChip')).catch(() => {});

// A report page's "Session" toggle lands here as ?open=<assignmentId>
// &cycle=<cycleIndex> rather than a plain visit to the assignment list.
const bootParams = new URLSearchParams(location.search);
const openAssignmentId = bootParams.get('open');
const openCycle = bootParams.get('cycle');
if (openAssignmentId && openCycle !== null && openCycle !== '') {
  history.replaceState(null, '', '/index.html');
  openFromReportLink(openAssignmentId, Number(openCycle)).catch(() => showAssignments());
} else {
  showAssignments();
}
