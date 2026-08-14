// The report's static session view: a read-only record of every session on
// this draft, not the live AI chat. Left pane lists sessions, right pane
// shows whichever one is selected. No composer, no streaming, no mode
// chrome — the draft is locked, so none of that applies.
//
// Vocabulary note: the server's data model calls one chat thread a
// "conversation" and calls a draft/cycle a "session" — but nothing here is
// user-facing copy for the data model. To a student, "session" already means
// one sitting with the AI (the workspace's own rail calls it that:
// "+ New session", "No sessions yet"), so this view follows that precedent —
// every string a student reads says "session," never "conversation."

const SPEAKER_STATIC = { student: 'You', coach: 'AI', auditor: 'Auditor · on request' };

let convViewState = { conversations: null, activeId: null };

function renderConvViewList(conversations) {
  const list = document.getElementById('convViewList');
  list.innerHTML = '';
  if (!conversations.length) {
    list.innerHTML = '<p class="conv-view-list-empty">No sessions on this draft.</p>';
    return;
  }
  conversations.forEach((c, i) => {
    const item = document.createElement('div');
    item.className = 'conv-view-item' + (c.id === convViewState.activeId ? ' active' : '');
    const turnCount = c.turns.filter((t) => t.role !== 'auditor').length;
    item.innerHTML = `${esc(c.title || `Session ${i + 1}`)}
      <span class="conv-view-item-meta">${turnCount} turn${turnCount === 1 ? '' : 's'}</span>`;
    item.onclick = () => selectConvViewItem(c.id);
    list.append(item);
  });
}

function renderConvViewTranscript(conv) {
  const box = document.getElementById('convViewTranscript');
  box.innerHTML = '';
  if (!conv) {
    box.innerHTML = '<p class="conv-view-empty">Select a session to read it.</p>';
    return;
  }
  if (!conv.turns.length) {
    box.innerHTML = '<p class="conv-view-empty">This session has no turns.</p>';
    return;
  }
  for (const t of conv.turns) {
    const wrap = document.createElement('div');
    wrap.className = `turn turn-${t.role}`;
    const speaker = document.createElement('span');
    speaker.className = 'turn-speaker';
    speaker.textContent = SPEAKER_STATIC[t.role] || t.role;
    const bubble = document.createElement('div');
    bubble.className = 'msg';
    bubble.textContent = t.text;
    wrap.append(speaker, bubble);
    box.append(wrap);
  }
}

function selectConvViewItem(id) {
  convViewState.activeId = id;
  renderConvViewList(convViewState.conversations);
  renderConvViewTranscript(convViewState.conversations.find((c) => c.id === id));
}

// Largest two non-zero units only ("2 days, 4 hours", "6 hours, 20 minutes",
// "12 minutes") — showing days/hours/minutes all at once every time reads as
// noise once the coarser unit already dominates.
function formatConvDuration(conversations) {
  const starts = conversations.map((c) => new Date(c.createdAt).getTime());
  const ends = conversations.map((c) => new Date(c.lastActiveAt || c.createdAt).getTime());
  const totalMinutes = Math.max(0, Math.round((Math.max(...ends) - Math.min(...starts)) / 60000));
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  const unit = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
  if (days > 0) return unit(days, 'day') + (hours ? `, ${unit(hours, 'hour')}` : '');
  if (hours > 0) return unit(hours, 'hour') + (minutes ? `, ${unit(minutes, 'minute')}` : '');
  if (minutes > 0) return unit(minutes, 'minute');
  return 'under a minute';
}

// The title carries the hierarchy a student needs to orient on this specific
// view — which assignment, which draft — since "session" here means one chat
// thread, not the draft itself (that's what "sessions" means everywhere else
// in the data model). Never say "conversation" in this view's copy: sessions
// are grouped under a draft, drafts under an assignment, and that's the only
// vocabulary a student should see.
function renderConvViewTitle(submission) {
  const el = document.getElementById('convViewTitle');
  const title = submission.assignmentTitle || 'Assignment';
  el.textContent = `${title} : Draft ${submission.cycleIndex + 1}`;
}

function renderConvViewIntro(conversations) {
  const el = document.getElementById('convViewIntro');
  if (!conversations.length) {
    el.textContent = 'No sessions with the AI on this draft.';
    return;
  }
  const n = conversations.length;
  el.textContent = `${n} session${n === 1 ? '' : 's'} over ${formatConvDuration(conversations)}. `
    + 'A record, not a live chat — pick a session on the left to read it.';
}

// Lazy-loaded and cached — most students never open this view in a given
// visit, so there's no reason to fetch it up front alongside the report.
async function loadConversationView(submission) {
  if (!convViewState.conversations) {
    const { conversations } = await api(`/api/submissions/${submission.id}/conversations`);
    convViewState.conversations = conversations;
    // Most recent session first to read, not the oldest — same default the
    // workspace itself lands on.
    convViewState.activeId = conversations.length ? conversations[conversations.length - 1].id : null;
  }
  renderConvViewTitle(submission);
  renderConvViewIntro(convViewState.conversations);
  renderConvViewList(convViewState.conversations);
  renderConvViewTranscript(convViewState.conversations.find((c) => c.id === convViewState.activeId) || null);
}
