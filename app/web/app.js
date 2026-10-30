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
  lastReflection: null,
  hasActivity: false,
  closed: false,
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

function relTime(iso) {
  if (!iso) return null;
  const days = Math.floor((new Date() - new Date(iso)) / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  return fmtDate(iso);
}

// A closed assignment's draft, as the level chip the report and dashboard
// draw: the level's own band fill and pip, "Draft N" before it. A chip, not
// plain text, by the owner's call (2026-10-30) — it opens the draft's report.
const LEVEL_ORDER = ['Passive', 'Reactive', 'Directive', 'Transformative'];
function draftChip(draft) {
  if (draft.analysisStatus !== 'complete' || !draft.tau) {
    const pending = el('span', 'draft-chip draft-chip-pending');
    pending.append(el('span', 'chip-cycle', `Draft ${draft.cycleIndex + 1}`));
    pending.append(el('span', 'chip-status', draft.analysisStatus === 'error' ? 'unavailable' : 'analyzing…'));
    return pending;
  }
  const draftLevel = levelName(draft.tau.SAMR);
  const chip = el('button', `draft-chip band band-${LEVEL_ORDER.indexOf(draftLevel) + 1}`);
  chip.type = 'button';
  chip.append(el('span', 'band-pip'));
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

// A draft slot the assignment closed before it was handed in. Same muted
// treatment as an analyzing draft and never a button: there is no report
// behind it and nothing left to do about it, so it states the fact and
// stops. It is still listed rather than dropped, so the row accounts for
// every slot in the budget — a missing chip would read as a shorter
// assignment instead of an unfinished one.
function missingDraftChip(cycleIndex) {
  const chip = el('span', 'draft-chip draft-chip-pending');
  chip.append(el('span', 'chip-cycle', `Draft ${cycleIndex + 1}`));
  chip.append(el('span', 'chip-status', 'Not submitted'));
  return chip;
}

// budget is passed only by closedRow, where the assignment is closed and the
// unfilled slots are final. An open assignment's unfilled slots are still
// live work, stated on its own card as "Draft N of M".
function draftChipRow(drafts, budget) {
  const row = el('div', 'chip-row');
  for (const d of drafts) row.append(draftChip(d));
  for (let i = drafts.length; i < (budget || 0); i++) row.append(missingDraftChip(i));
  return row;
}


// The date a student is actually working to: the open draft's own due date,
// falling back to the assignment's. An assignment due 20 Nov with Draft 2 due
// 1 Nov is a 1 Nov job, and the list, the hero and the card all read this one.
function nextDraftDue(a) {
  return a.draftDueDates?.[a.draftsUsed] || a.dueDate;
}

// Soonest next-draft due date first, whatever the draft's state: a draft not
// started and due in a week comes before one under way and due in two.
function sortedCurrent(home) {
  return [...home.current].sort((a, b) => dueInfo(nextDraftDue(a)).days - dueInfo(nextDraftDue(b)).days);
}

// ---------- home routes ----------

// Home is one page in two scopes: every class (#) and one class
// (#class-<id>). The hash keeps Back working and a reload in place. A class
// page exists only for a student with two or more classes — with one, Home
// already is that class, and a group of one offers no choice.
let lastHome = null;
let homeFilter = 'all';

function homeRoute(home) {
  const h = location.hash.slice(1);
  if (h.startsWith('class-') && home.classes.length > 1) {
    const cls = home.classes.find((c) => c.id === h.slice(6));
    if (cls) return { page: 'class', cls };
  }
  return { page: 'home' };
}

// pushState, not location.hash: it fires no popstate of its own, so the page
// renders once, and Home leaves no bare '#' in the bar.
function goHome(hash) {
  if (location.hash.slice(1) === hash) return;
  history.pushState(null, '', location.pathname + location.search + (hash ? `#${hash}` : ''));
  if (lastHome) renderHome(lastHome);
}

window.addEventListener('popstate', () => {
  if (lastHome && !$('viewAssignments').classList.contains('hidden')) renderHome(lastHome);
});

// ---------- rail ----------

const openCount = (n) => (n ? `${n} open` : 'Nothing open');

function railItem({ name, sub, icon, active, onClick }) {
  const row = el('button', `rail-item${active ? ' active' : ''}`);
  row.type = 'button';
  if (active) row.setAttribute('aria-current', 'page');
  if (icon) row.insertAdjacentHTML('afterbegin', iconSVG(icon));
  const text = el('span', 'rail-item-text');
  text.append(el('span', 'rail-item-name', name));
  if (sub) text.append(el('span', 'rail-item-sub', sub));
  row.append(text);
  row.addEventListener('click', onClick);
  return row;
}

// Destinations only. Under each class, how many of its assignments are open —
// never the assignments themselves, so the rail is the same length however
// much work a student has.
function renderRailNav(home, route) {
  const host = $('railNav');
  host.innerHTML = '';

  const top = el('div', 'rail-group');
  top.append(railItem({ name: 'Home', sub: openCount(home.current.length), icon: 'home',
    active: route.page === 'home', onClick: () => goHome('') }));
  host.append(top);

  if (home.classes.length > 1) {
    const group = el('div', 'rail-group');
    group.append(el('span', 'eyebrow', 'Classes'));
    for (const c of home.classes) {
      group.append(railItem({
        name: c.name,
        sub: openCount(home.current.filter((a) => a.classId === c.id).length),
        active: route.page === 'class' && route.cls.id === c.id,
        onClick: () => goHome(`class-${c.id}`),
      }));
    }
    host.append(group);
  }
}

// No navigation rail at medium: Home and Classes are two destinations, under
// the three M3's navigation rail starts at, so the drawer runs the whole way
// below expanded (as admin.html's does). Mounted once, on the first payload.
// The account chip stays in the masthead: the workspace shares this bar and
// has no drawer of its own to hold it.
let railMounted = false;
function mountHomeRail() {
  if (railMounted) return;
  railMounted = true;
  mountRailDrawer({ rail: $('homeRail'), slot: $('tauNav') });
}

// The masthead's menu button opens the home rail, which only exists on the
// home view.
function setRailToggle(visible) {
  const toggle = document.querySelector('#tauNav .rail-toggle');
  if (toggle) toggle.classList.toggle('hidden', !visible);
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

// The hero names the page. On Home it states who you are and what's true
// right now: every segment is a count of something live and renders only when
// it's non-zero, so a quiet week is one segment and no dangling separators.
// Bare text, never chips: a count is the common case, which is the half of the
// enclosure test a chip has to clear.
function renderHero(home, route) {
  const state = $('heroState');
  state.innerHTML = '';
  const news = $('heroNews');
  news.innerHTML = '';
  const segs = [];

  // The leaf greets; a class name is a page title, so it goes without.
  if (route.page === 'class') {
    $('heroGreeting').textContent = route.cls.name;
    const open = home.current.filter((a) => a.classId === route.cls.id).length;
    const closed = home.past.filter((a) => a.classId === route.cls.id).length;
    segs.push({ text: openCount(open) });
    segs.push({ text: `${closed} closed` });
  } else {
    const first = home.student.displayName.split(' ')[0];
    const open = home.current.length;
    $('heroGreeting').textContent = open ? `Welcome back, ${first}` : `Welcome, ${first}`;
    if (open) {
      segs.push({ text: `${open} assignment${open === 1 ? '' : 's'} open` });
      // Counts the draft a student would actually sit down to — the open slot
      // on each assignment — not every dated slot in every budget.
      const due = home.current.map((a) => dueInfo(nextDraftDue(a)));
      const today = due.filter((d) => d.days === 0).length;
      const late = due.filter((d) => d.days < 0).length;
      if (today) segs.push({ text: `${today} draft${today === 1 ? '' : 's'} due today` });
      // Colour AND the word — "overdue" states it on its own for anyone the
      // attention tone doesn't reach.
      if (late) segs.push({ text: `${late} overdue`, cls: 'hero-state-late' });
    } else if (home.past.length) {
      segs.push({ text: 'Nothing open right now', cls: 'hero-state-quiet' });
    } else {
      segs.push({ text: 'No assignments yet — when your teacher sets one, it lands here.', cls: 'hero-state-quiet' });
    }
    if (home.classes.length > 1) segs.push({ text: `${home.classes.length} classes` });
    else if (home.classes.length === 1) segs.push({ text: home.classes[0].name });

    // The one enclosed thing in the hero, and only while a note is unread:
    // actionable and rare, which is both halves of the enclosure test. Reading
    // it is what clears it — the note flag on the draft's own row stays either
    // way, because the note remains a property of that draft.
    const unread = unreadNotes(home);
    if (unread.length) {
      const newest = unread[unread.length - 1];
      const chip = el('button', 'hero-news-chip');
      chip.type = 'button';
      chip.innerHTML = `${iconSVG('chat')} ${unread.length === 1
        ? 'Note from your teacher'
        : `${unread.length} notes from your teacher`}`;
      chip.onclick = () => { logUse('student-home', 'hero-note'); showReport(newest.submissionId); };
      news.append(chip);
    }
  }

  segs.forEach((seg, i) => {
    if (i) state.append(el('span', 'hero-sep', '·'));
    state.append(el('span', seg.cls || null, seg.text));
  });
}

// The class-wide note is unread until the student opens Instructions, and
// unread again when the teacher edits it — the same rule as a draft's note.
function noteUnread(a) {
  return Boolean(a.teacherNote && a.teacherNoteAt && (!a.teacherNoteReadAt || a.teacherNoteReadAt < a.teacherNoteAt));
}

async function markNoteRead(a) {
  if (!noteUnread(a)) return;
  try {
    const r = await api(`/api/assignments/${a.id}/note-read`, { method: 'POST' });
    a.teacherNoteReadAt = r.teacherNoteReadAt;
  } catch {}
}

// The assignment's instructions: the teacher's class-wide note first, when
// there is one, then the three authored fields as labeled sections — matches
// how they're authored (separate fields) and read (what/why/must-haves). One
// body for the home card's tray and the workspace's disclosure.
function assignmentBriefBody(a) {
  const wrap = el('div', null);
  const section = (label, text) => {
    if (!text) return;
    wrap.append(el('div', 'tray-section-label', label));
    wrap.append(el('p', 'tray-section-body', text));
  };
  if (a.teacherNote) {
    const note = el('div', 'tray-note');
    note.append(el('div', 'tray-section-label', 'Note from your teacher'));
    note.append(el('p', 'tray-section-body', a.teacherNote));
    wrap.append(note);
  }
  section('Description', a.description);
  section('Purpose', a.purpose);
  section('Requirements', a.requirements);
  return wrap;
}

// The card's due date. Relative where it is close ("Due in 2 days") and always
// with the date itself, and urgency colour only where the words state it —
// an alert colour must match what its label says (designsystem.md).
function cardDue(a) {
  const iso = nextDraftDue(a);
  const due = dueInfo(iso);
  if (!due.text) return { text: 'No due date', tone: 'calm' };
  if (due.tone === 'late') return { text: `Overdue, was due ${fmtDate(iso)}`, tone: 'late' };
  if (due.tone === 'soon') return { text: `${due.text}, ${fmtDate(iso)}`, tone: 'soon' };
  return due;
}

// An open assignment. The two things a student scans the list for — when the
// next draft is due and where it stands — lead the card at body-small in full
// ink; the class drops under the title. In progress is the larger card with
// the filled button, not started the smaller one with the quiet button, and
// both sit in the same due-date order. Same type sizes either way.
//
// The card carries the deadline's urgency once, in the due line's colour and
// words — no edge rule on top (a surface carries a severity signal once).
function openCard(a, showClass) {
  const inProgress = a.hasActivity;
  const draft = a.draftsUsed + 1;
  const card = el('article', `card ocard ${inProgress ? 'card-lg ocard-in-progress' : 'ocard-not-started'}`);
  card.id = `card-${a.id}`;

  const text = el('div', 'ocard-text');
  const due = cardDue(a);
  const top = el('div', 'ocard-top');
  top.insertAdjacentHTML('afterbegin', iconSVG('calendar'));
  top.append(el('span', `ocard-due-${due.tone}`, due.text));
  top.append(el('span', 'ocard-sep', '·'));
  // "of N" keeps the draft budget stated now that future drafts have no row.
  top.append(el('span', null, `Draft ${draft} of ${a.draftBudget}`));
  top.append(el('span', 'ocard-sep', '·'));
  top.append(el('span', inProgress ? 'ocard-state' : 'ocard-state ocard-state-quiet', inProgress ? 'In progress' : 'Not started'));
  text.append(top);
  text.append(el('h3', 'acard-title', a.title));

  const sub = [showClass && a.className, inProgress && a.lastActiveAt && `last worked ${relTime(a.lastActiveAt)}`].filter(Boolean);
  if (sub.length) text.append(el('p', 'ocard-sub', sub.join(' · ')));

  // "Instructions", and no more: it sits under the assignment's title, which
  // says whose. Long — usually the whole grading criteria, with the class-wide
  // note at the top — so it opens in the tray rather than growing the card,
  // which would also move the button beside it. While the note is unread the
  // button takes the draft tile's note icon and hue — one kind of thing at two
  // scopes — and goes back to plain once it has been opened.
  const instructions = el('button', 'btn btn-quiet btn-sm ocard-instructions');
  instructions.type = 'button';
  const label = () => {
    const unread = noteUnread(a);
    instructions.innerHTML = `${iconSVG(unread ? 'chat' : 'checklist')} Instructions`;
    instructions.classList.toggle('ocard-instructions-note', unread);
    if (unread) instructions.setAttribute('aria-label', 'Instructions, new note from your teacher');
    else instructions.removeAttribute('aria-label');
  };
  label();
  instructions.onclick = () => {
    openTray({ title: 'Instructions', subtitle: a.title, body: assignmentBriefBody(a) });
    markNoteRead(a).then(label);
  };
  text.append(instructions);
  card.append(text);

  const go = el('button', `btn ${inProgress ? 'btn-primary' : 'btn-quiet'}`, `${inProgress ? 'Continue' : 'Start'} Draft ${draft}`);
  go.type = 'button';
  go.onclick = () => openAssignment(a.id);
  card.append(go);

  // Every draft already handed in, newest first, each opening its report —
  // the way back to Draft 1's report and note while writing Draft 2.
  if (a.drafts.length) {
    const tiles = el('div', 'ocard-tiles');
    for (let i = a.draftsUsed - 1; i >= 0; i--) {
      const submission = a.drafts.find((d) => d.cycleIndex === i);
      if (!submission) continue;
      tiles.append(submittedDraftTile(i, draftRowStatus(i, { submission }), { submission }));
    }
    card.append(tiles);
  }
  return card;
}

// A closed assignment is review-only: one row on the page, no card, so
// finished work recedes to the ground while open work stays raised. The chips
// open each draft's report.
function closedRow(a, showClass) {
  const row = el('div', 'closed-row');
  const text = el('div', 'closed-row-text');
  text.append(el('h3', 'closed-row-title', a.title));
  // An assignment that closed with drafts still outstanding states the
  // denominator: "1 of 3 drafts submitted" is the fact, and "1 draft
  // submitted" would quietly read as a finished one-draft assignment.
  const budget = a.draftBudget || a.drafts.length;
  const counted = a.drafts.length < budget
    ? `${a.drafts.length} of ${budget} drafts submitted`
    : `${a.drafts.length} draft${a.drafts.length === 1 ? '' : 's'} submitted`;
  text.append(el('p', 'closed-row-meta', showClass && a.className ? `${a.className} · ${counted}` : counted));
  row.append(text);
  row.append(draftChipRow(a.drafts, budget));
  return row;
}

// All / In progress / Not started, over the open list. Only once the list is
// long enough to need it: below four a student reads it whole.
const FILTER_FROM = 4;
function renderOpenFilter(current) {
  const host = $('openFilter');
  host.innerHTML = '';
  const show = current.length >= FILTER_FROM;
  host.classList.toggle('hidden', !show);
  if (!show) { homeFilter = 'all'; return current; }
  const inProgress = current.filter((a) => a.hasActivity).length;
  for (const [key, label, n] of [['all', 'All', current.length], ['in-progress', 'In progress', inProgress], ['not-started', 'Not started', current.length - inProgress]]) {
    const tab = el('button', `card-tab${homeFilter === key ? ' active' : ''}`, label);
    tab.type = 'button';
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-selected', String(homeFilter === key));
    tab.append(el('span', 'tab-count', String(n)));
    tab.onclick = () => { homeFilter = key; renderHome(lastHome); };
    host.append(tab);
  }
  if (homeFilter === 'all') return current;
  return current.filter((a) => (homeFilter === 'in-progress') === Boolean(a.hasActivity));
}

function renderHome(home) {
  const route = homeRoute(home);
  const multi = home.classes.length > 1;
  renderRailNav(home, route);
  renderHero(home, route);

  const crumbs = route.page === 'home'
    ? [{ label: 'Home', current: true }]
    : [{ label: 'Home', onClick: () => goHome('') }, { label: route.cls.name, current: true }];
  renderNavCrumbs($('navCrumbs'), crumbs);
  renderNavLocal($('navLocal'), []);

  const inScope = (a) => route.page !== 'class' || a.classId === route.cls.id;
  // A class page doesn't repeat its own name on every card.
  const showClass = multi && route.page !== 'class';

  const current = sortedCurrent(home).filter(inScope);
  const list = $('currentList');
  list.innerHTML = '';
  const shown = renderOpenFilter(current);
  for (const a of shown) list.append(openCard(a, showClass));
  if (route.page === 'class' && !current.length) list.append(el('p', 'home-empty', 'Nothing open in this class right now.'));
  $('secCurrent').classList.toggle('hidden', (!current.length && route.page !== 'class'));
  $('currentCount').textContent = current.length ? String(current.length) : '';

  const past = home.past.filter(inScope);
  const pastList = $('pastList');
  pastList.innerHTML = '';
  for (const a of past) pastList.append(closedRow(a, showClass));
  $('secPast').classList.toggle('hidden', !past.length);
  $('pastCount').textContent = past.length ? String(past.length) : '';

  const empty = route.page === 'home' && !home.current.length && !home.past.length;
  $('homeEmpty').textContent = 'No assignments yet. When your teacher sets one, it will show up here.';
  $('homeEmpty').classList.toggle('hidden', !empty);

  $('home').scrollTop = 0;
}

async function showAssignments() {
  $('viewWorkspace').classList.add('hidden');
  $('viewAssignments').classList.remove('hidden');
  setRailToggle(true);

  const paint = (home) => {
    lastHome = home;
    // Reload must not clear a warning the student was already shown — the stream
    // only re-raises it on the next reply, which is one reply too late.
    syncBudgetNotice(home.budget);
    mountHomeRail();
    renderHome(home);
  };

  // Back from a report is a full page load; the cached home paints now and the
  // page is released, and the fresh one replaces it only if anything changed —
  // re-rendering identical data would reset the scroll the student is reading.
  const cached = homeCache.read();
  const fresh = api('/api/student/home').then((home) => {
    homeCache.write(home);
    const stillHome = !$('viewAssignments').classList.contains('hidden');
    if (stillHome && JSON.stringify(home) !== JSON.stringify(cached)) paint(home);
    else if (!stillHome) lastHome = home;
  });
  if (!cached) return fresh;
  paint(cached);
  fresh.catch(() => {});
}

// ---------- workspace ----------

async function openAssignment(id) {
  logUse('student-home', 'open-assignment');
  const data = await api(`/api/assignments/${id}/open`, { method: 'POST' });
  state.assignment = data.assignment;
  state.session = data.session;
  state.conversations = data.conversations;
  state.hasActivity = data.hasActivity;
  state.lastReflection = data.lastReflection || null;
  state.conv = null;
  state.turns = [];
  state.submissions = [];

  $('viewAssignments').classList.add('hidden');
  $('viewWorkspace').classList.remove('hidden');
  setRailToggle(false);
  // The bar's scrolled state belongs to the home pane, which is now hidden —
  // left set, it would tint the bar over a workspace that never scrolls it.
  $('tauNav').classList.remove('scrolled');
  const wsPrompt = $('wsPrompt');
  wsPrompt.innerHTML = '';
  wsPrompt.append(assignmentBriefBody(data.assignment));
  // Reading the note here counts as reading it, so the home card's icon
  // doesn't announce a note the student has already seen.
  wsPrompt.closest('details').ontoggle = (e) => { if (e.target.open) markNoteRead(state.assignment); };
  // A workshop's prompt IS the task — three steps a guest has never seen —
  // so it starts open rather than behind the disclosure a term's students
  // have already read in class.
  if (isWorkshop()) wsPrompt.closest('details').open = true;
  document.querySelector('.composer-hint').textContent = isWorkshop()
    ? 'The facilitator can read this conversation. When you’re done, press End session to see your results.'
    : 'Your teacher can read this session';

  state.closed = Boolean(data.closed);
  applyClosedState();

  logEvent('episode-resume');
  renderSessionList();
  renderConversation();
  loadSubmissions().catch(() => {});

  // A workshop guest has a few minutes and has never seen this app: land them
  // in a message box, not on "+ New session". Client-side only — nothing is
  // stored until they send something, exactly as when a student presses it.
  if (isWorkshop() && state.session && !state.closed
      && !state.conversations.some((c) => c.cycleIndex === state.session.cycleIndex)) {
    showPane('detail');
    startNewSession();
  }
}

// ---------- the deadline ----------

// The one client-side reading of "has this closed", against the same instant
// the server compares (dates arrive normalised — see due.js). Re-read on every
// action rather than trusted from page load, because the interesting case is
// precisely the tab that was already open when the deadline passed.
function deadlinePassed() {
  const due = state.assignment && state.assignment.dueDate;
  return Boolean(due) && new Date(due) < new Date();
}

function closedNoticeText() {
  const due = state.assignment && state.assignment.dueDate;
  const when = due
    ? new Date(due).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
    : null;
  return when ? `This assignment closed on ${when}.` : 'This assignment has closed.';
}

// Everything the workspace does differently once the assignment is shut, in
// one place so the three ways in — opening it closed, the deadline passing
// under an open tab, and a write the server refused — all land in the same
// state rather than each disabling a different subset of the controls.
//
// Sessions stay readable. What goes is the ability to add to them: the
// composer, the new-session button, and Submit. A student sees what they had,
// and it is plainly over.
function applyClosedState() {
  if (deadlinePassed()) state.closed = true;

  const banner = $('draftsDoneBanner');
  banner.innerHTML = '';
  // Two different "you can't add to this" states, and the closed one wins:
  // a used-up draft budget is something the student did, a closed assignment
  // is something that happened to them, and only one of them explains why
  // the work stopped where it did.
  if (state.closed) {
    banner.append(el('strong', null, closedNoticeText()));
    banner.append(document.createTextNode(
      ' Your sessions stay readable. Any draft you didn\'t submit is recorded as not submitted.'));
  } else if (!state.session) {
    banner.append(el('strong', null, 'All drafts submitted.'));
    banner.append(document.createTextNode(' These sessions stay readable, but you can\'t add to them.'));
  }
  banner.classList.toggle('hidden', !state.closed && !!state.session);

  renderSubmitButtons();
  $('btnNewSession').disabled = state.closed || !state.session;
  if (state.closed) {
    $('composer').classList.add('hidden');
    $('submitModal').classList.add('hidden');
  }
  scheduleDeadlineFlip();
}

// ---------- workshops ----------

// A workshop guest (server/workshops.js) decides when they are done: there is
// no timer, and ending the session is what runs the analysis and opens their
// results.
function isWorkshop() {
  return Boolean(state.assignment && state.assignment.workshop);
}

// Both Submit buttons, in one place.
function renderSubmitButtons() {
  // A guest who has said nothing has no conversation to analyze; the old
  // five-minute timer used to cover this, and nothing else does now.
  const nothingSaid = isWorkshop() && !(state.turns || []).some((t) => t.role === 'student');
  const disabled = state.closed || !state.session || nothingSaid;
  // A workshop submits no draft; what the button does for a guest is end the
  // conversation, so that is what it says.
  const label = isWorkshop() ? 'End session' : 'Submit draft';
  for (const id of ['btnSubmit', 'btnSubmitCompact']) {
    $(id).disabled = disabled;
    $(id).textContent = label;
  }
}

// A student sitting in the workspace as the deadline passes should watch it
// close, not discover it by pressing Send on work they've already done. One
// timer per open assignment, and only for a deadline close enough to sit
// through — setTimeout can't hold a term-length delay anyway.
let deadlineTimer = null;
function scheduleDeadlineFlip() {
  clearTimeout(deadlineTimer);
  const due = state.assignment && state.assignment.dueDate;
  if (!due || state.closed) return;
  const ms = new Date(due) - new Date();
  if (ms <= 0 || ms > 12 * 3600 * 1000) return;
  deadlineTimer = setTimeout(() => {
    applyClosedState();
    renderConversation();
  }, ms + 1000);
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
    // Home means Home: a class page the student came from is cleared, so the
    // crumb lands where it says.
    { label: 'Home', onClick: () => { history.replaceState(null, '', location.pathname); showAssignments(); } },
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

  $('btnNewSession').disabled = state.closed || !state.session;
  $('sessionsLabel').textContent = convs.length ? `Sessions (${convs.length})` : 'Sessions';

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
  renderSubmitButtons();

  const hasConv = !!state.conv;
  $('convTitle').textContent = hasConv ? state.conv.title : '';
  // No server row yet for a not-yet-sent new session — nothing to rename.
  $('btnRename').classList.toggle('hidden', !hasConv || !state.conv.id);

  const locked = hasConv && state.conv.locked;
  $('composer').classList.toggle('hidden', !hasConv || locked || state.closed);
  // With no conversation open there is no composer, and picking or starting a
  // session is the only thing to do — so on compact the list is the pane shown.
  if (!hasConv) showPane('list');
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
  // On a phone the prompt lives in the other pane, so a workshop guest landing
  // straight in the chat would see a message box and no task. Shown until the
  // first message, which is the only stretch in which they need it here.
  if (isWorkshop() && !state.turns.length && !locked) {
    const task = el('div', 'empty-state workshop-task');
    task.append(el('p', null, state.assignment.title));
    task.append(el('p', 'empty-sub', state.assignment.description));
    box.appendChild(task);
  }
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
  // The brand leaf. Which colour variant it wears is a theme question, so the
  // file is chosen in CSS (see .thinking-leaf) rather than named here.
  wrap.append(el('span', 'thinking-leaf'));
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
    homeCache.clear();
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
    // The conversation record carries no cycleIndex — it is a workspace-only
    // grouping (see openConversation). Dropping it here read "Draft NaN".
    state.conv = { ...data.conversation, cycleIndex: state.conv.cycleIndex };
    state.turns = data.turns;
    renderConversation();
  }
}

async function sendMessage() {
  const text = $('input').value.trim();
  if (!text || state.streaming || !state.conv || state.conv.locked) return;
  // Checked here rather than left to the server's 403: refusing after the
  // message is on screen leaves the student's own words sitting under an
  // error, which reads as their message having failed rather than the
  // assignment having ended.
  if (deadlinePassed()) {
    applyClosedState();
    renderConversation();
    return;
  }

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

$('btnNewSession').onclick = () => { showPane('detail'); startNewSession(); };

// List-detail (components.css §19a). Only compact reads data-pane — above it
// both panes are on screen — so this is safe to set at any width. Choosing a
// session, or starting one, is the end of the list's job.
function showPane(which) {
  $('wsLayout').dataset.pane = which;
}
$('btnSessionsBack').onclick = () => showPane('list');
$('sessionsBackIcon').outerHTML = iconSVG('arrowBack');
$('sessionList').addEventListener('click', (e) => { if (e.target.closest('.rail-item')) showPane('detail'); });
// The same action as the list's own Submit draft; a second button, not a
// second path.
$('btnSubmitCompact').onclick = () => $('btnSubmit').click();

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

// The student's account of how they used the AI, collected at the submission
// marker because that is the moment the session is over and still fresh.
//
// It is self-report and is stored as self-report: it never feeds how a
// dimension is read. The reading is coded from the transcript; this is what
// that finished evidence gets held against.
//
// Labels name the content, not the routine behind it — a student answering
// "Connect" has to translate before they can write, and the pillar name is
// vocabulary they were never taught. The questions live underneath as hints.
const REFLECT_FULL = [
  { key: 'connect', label: 'What you already knew',
    hint: 'Your knowledge of this topic before the conversation started, and how it shaped what you asked.' },
  { key: 'extend', label: 'What the conversation opened up',
    hint: "Ideas or directions you reached with the AI that you wouldn't have reached on your own." },
  { key: 'challenge', label: 'Where you pushed back',
    hint: 'Moments where you questioned, disagreed with, or corrected something the AI said.' },
];

const REFLECT_DELTA = [
  { key: 'delta', label: 'What changed since your last draft',
    hint: 'In how you used the AI, or in your own thinking about the topic.' },
];

function reflectFields() {
  // None for a workshop — the server takes none either (index.js, submit).
  if (isWorkshop()) return [];
  return state.session && state.session.cycleIndex > 0 ? REFLECT_DELTA : REFLECT_FULL;
}

// The previous draft's answers, shown only on a later draft. Genuinely
// optional — "what changed" is answerable without it, just harder — so this is
// the one part of the block that may sit behind a disclosure.
function priorReflectionEl() {
  const prior = state.lastReflection;
  if (!prior || !prior.reflection) return null;
  const labels = prior.type === 'delta' ? REFLECT_DELTA : REFLECT_FULL;
  const body = el('div', 'reflect-prior-body');
  for (const f of labels) {
    const value = prior.reflection[f.key];
    if (!value) continue;
    const section = el('div');
    section.append(el('span', 'reflect-prior-label', f.label), document.createTextNode(value));
    body.append(section);
  }
  if (!body.children.length) return null;
  const details = el('details', 'reflect-prior');
  details.append(el('summary', null, 'What you wrote last time'), body);
  return details;
}

// Carries typed answers across a re-render, so cancelling the dialog to check
// something in the transcript doesn't cost the student what they'd written.
function renderReflectBlock() {
  const block = $('reflectBlock');
  const kept = block.children.length ? reflectionValues() : {};
  block.innerHTML = '';
  if (!state.session) return;
  for (const f of reflectFields()) {
    const field = el('div', 'reflect-field');
    const id = `reflect_${f.key}`;
    const label = el('label', null, f.label);
    label.htmlFor = id;
    const hint = el('p', 'reflect-hint', f.hint);
    hint.id = `${id}_hint`;
    const box = el('textarea');
    box.id = id;
    box.rows = 3;
    box.required = true;
    if (kept[f.key]) box.value = kept[f.key];
    box.setAttribute('aria-describedby', hint.id);
    box.oninput = updateSubmitEnabled;
    field.append(label, hint, box);
    block.append(field);
  }
  const prior = priorReflectionEl();
  if (prior) block.append(prior);
}

function reflectionValues() {
  const values = {};
  for (const f of reflectFields()) {
    values[f.key] = ($(`reflect_${f.key}`)?.value || '').trim();
  }
  return values;
}

// Mandatory with no length floor, so the only question is whether each box has
// something in it. A short answer is a real one; a character minimum would
// teach padding and would block a student at a deadline over prose.
function updateSubmitEnabled() {
  const draft = $('draftPaste').classList.contains('hidden') ? uploadedText : $('essayText').value.trim();
  const values = reflectionValues();
  const missing = reflectFields().filter((f) => !values[f.key]).length;
  const blocked = $('submitBlocked');
  // A disabled button with no reason is the thing to avoid — name what is
  // still outstanding, and say nothing once nothing is.
  const notes = [];
  if (!draft && !isWorkshop()) notes.push('your draft');
  if (missing) notes.push(`${missing} question${missing === 1 ? '' : 's'}`);
  blocked.textContent = notes.length ? `Still to add: ${notes.join(' and ')}.` : '';
  blocked.classList.toggle('hidden', !notes.length);
  $('btnConfirmSubmit').disabled = Boolean(notes.length);
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
  // The deadline may have passed since this button was last enabled.
  if (deadlinePassed()) {
    applyClosedState();
    renderConversation();
    return;
  }
  const used = state.session.cycleIndex;
  const budget = state.assignment.draftBudget;
  const convCount = state.conversations.filter((c) => c.cycleIndex === state.session.cycleIndex).length || 1;
  const warning = $('submitWarning');
  warning.innerHTML = '';
  if (isWorkshop()) {
    warning.append(el('li', null, 'You can’t add to the conversation after this.'));
    warning.append(el('li', null, 'Tau analyzes it and shows you your results, which takes about a minute.'));
  } else {
    warning.append(el('li', null,
      `All ${convCount} of this draft's session${convCount === 1 ? '' : 's'} lock and go to your teacher with your draft.`));
    warning.append(el('li', null, `This uses draft ${used + 1} of ${budget}.`));
  }
  renderReflectBlock();
  resetDraftUpload();
  // A workshop asks for no draft — it is read for its conversation alone
  // (server/analysis.js) — so the dialog is the confirmation and nothing else.
  $('submitTitle').textContent = isWorkshop() ? 'End your session?' : 'Submit draft';
  $('btnConfirmSubmit').textContent = isWorkshop() ? 'End session' : 'Submit — this ends my session';
  $('btnCancelSubmit').textContent = isWorkshop() ? 'Keep chatting' : 'Cancel';
  if (isWorkshop()) {
    $('draftUpload').classList.add('hidden');
    $('draftPaste').classList.add('hidden');
    updateSubmitEnabled();
  }
  $('submitModal').classList.remove('hidden');
};

$('btnCancelSubmit').onclick = () => $('submitModal').classList.add('hidden');

$('btnConfirmSubmit').onclick = async () => {
  const essayText = isWorkshop() ? ''
    : $('draftPaste').classList.contains('hidden') ? uploadedText : $('essayText').value.trim();
  if (!essayText && !isWorkshop()) return;
  const reflection = reflectionValues();
  if (reflectFields().some((f) => !reflection[f.key])) return;
  $('btnConfirmSubmit').disabled = true;
  try {
    logUse('workspace', 'submit');
    const { submission } = await api(`/api/sessions/${state.session.id}/submit`, { method: 'POST', body: { essayText, reflection } });
    $('submitModal').classList.add('hidden');
    // Straight to the draft report — full disclosure at the submission marker
    await showReport(submission.id);
  } catch (err) {
    // The server is the authority on the deadline — a clock a few minutes
    // fast on this machine must not be what decides it. If it refused on
    // closure, the workspace takes that as the state rather than reporting
    // it as a failed action the student could try again.
    if (/closed/i.test(err.message)) {
      state.closed = true;
      applyClosedState();
      renderConversation();
      return;
    }
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
// On a phone the whole view scrolls instead, so the hero leaves with the
// content (style.css) — whichever of the two is scrolling sets the bar.
{
  const bar = $('tauNav');
  for (const pane of [$('home'), $('viewAssignments')]) {
    pane.addEventListener('scroll', () => bar.classList.toggle('scrolled', pane.scrollTop > 2), { passive: true });
  }
}

const chipReady = mountAccountChip($('accountChip')).catch(() => {});

// A report page's "Session" toggle lands here as ?open=<assignmentId>
// &cycle=<cycleIndex> rather than a plain visit to the assignment list.
const bootParams = new URLSearchParams(location.search);
const openAssignmentId = bootParams.get('open');
const openCycle = bootParams.get('cycle');
let firstView;
if (openAssignmentId && openCycle !== null && openCycle !== '') {
  history.replaceState(null, '', '/index.html');
  firstView = openFromReportLink(openAssignmentId, Number(openCycle)).catch(() => showAssignments());
} else {
  firstView = showAssignments();
}
holdPage(Promise.all([chipReady, firstView]), { build: true });
