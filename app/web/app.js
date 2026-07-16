const $ = (id) => document.getElementById(id);

const state = {
  assignment: null,
  session: null,
  conversations: [],
  conv: null,
  turns: [],
  streaming: false,
  abort: null,
  editingTurnId: null,
};

// ---------- api ----------

async function api(path, opts = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  if (!res.ok) throw new Error((await res.json()).error || res.statusText);
  return res.json();
}

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

// ---------- assignment list ----------

async function showAssignments() {
  $('viewWorkspace').classList.add('hidden');
  $('viewAssignments').classList.remove('hidden');
  const assignments = await api('/api/assignments');
  const list = $('assignmentList');
  list.innerHTML = '';
  for (const a of assignments) {
    const card = document.createElement('div');
    card.className = 'assignment-card';
    card.innerHTML = `
      <h3></h3>
      <div class="meta">
        <span class="status-badge status-${a.status}">${a.status.replace('-', ' ')}</span>
        <span>Drafts: ${a.draftsUsed} / ${a.draftBudget}</span>
        ${a.dueDate ? `<span>Due ${a.dueDate}</span>` : ''}
      </div>`;
    card.querySelector('h3').textContent = a.title;
    card.onclick = () => openAssignment(a.id);
    list.appendChild(card);
  }
}

// ---------- workspace ----------

async function openAssignment(id) {
  const data = await api(`/api/assignments/${id}/open`, { method: 'POST' });
  state.assignment = data.assignment;
  state.session = data.session;
  state.conversations = data.conversations;
  state.conv = null;
  state.turns = [];

  $('viewAssignments').classList.add('hidden');
  $('viewWorkspace').classList.remove('hidden');
  $('wsTitle').textContent = data.assignment.title;
  $('wsPrompt').textContent = data.assignment.prompt;
  $('draftsMeter').textContent = `Drafts used: ${data.draftsUsed} / ${data.assignment.draftBudget}`;

  const mode = $('coachMode');
  if (data.session) {
    mode.textContent = data.modeNote || `Coach level: ${data.coachLabel}`;
    mode.classList.remove('hidden');
  } else {
    mode.textContent = 'All drafts submitted — conversations are read-only.';
  }
  $('btnSubmit').disabled = !data.session;
  $('btnNewConv').disabled = !data.session;

  logEvent('episode-resume');
  renderConvList();
  renderConversation();
  loadDraftsList().catch(() => {});
}

function renderConvList() {
  const list = $('convList');
  list.innerHTML = '';
  let lastCycle = null;
  for (const c of state.conversations) {
    if (c.cycleIndex !== lastCycle) {
      lastCycle = c.cycleIndex;
      const label = document.createElement('div');
      label.className = 'conv-cycle-label';
      label.textContent = `Draft ${c.cycleIndex + 1}`;
      list.appendChild(label);
    }
    const item = document.createElement('div');
    item.className = 'conv-item' + (c.locked ? ' locked' : '') + (state.conv?.id === c.id ? ' active' : '');
    item.textContent = c.title;
    item.onclick = () => openConversation(c.id);
    list.appendChild(item);
  }
}

async function openConversation(id) {
  if (state.streaming) return;
  const data = await api(`/api/conversations/${id}`);
  state.conv = data.conversation;
  state.turns = data.turns;
  renderConvList();
  renderConversation();
}

function renderConversation() {
  const hasConv = !!state.conv;
  $('convTitle').textContent = hasConv ? state.conv.title : '';
  $('btnRename').classList.toggle('hidden', !hasConv);

  const locked = hasConv && state.conv.locked;
  $('composer').classList.toggle('hidden', !hasConv || locked);
  $('lockedNote').classList.toggle('hidden', !locked);

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

function makeEmptyState() {
  const div = document.createElement('div');
  div.className = 'empty-state';
  div.id = 'emptyState';
  div.innerHTML = `<p>Start a conversation with your writing coach.</p>
    <p class="empty-sub">The coach knows your assignment prompt — but not your other conversations. Catch it up on anything it needs to know.</p>`;
  return div;
}

function renderTurn(t) {
  const div = document.createElement('div');
  div.className = `msg msg-${t.role}`;
  div.dataset.turnId = t.id;
  div.dataset.role = t.role;
  div.textContent = t.text;
  if (t.meta?.stopped) {
    const note = document.createElement('span');
    note.className = 'stopped-note';
    note.textContent = 'generation stopped';
    div.appendChild(note);
  }
  return div;
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
  const el = document.querySelector(`[data-turn-id="${lastStudent.id}"]`);
  if (!el) return;
  const btn = document.createElement('button');
  btn.className = 'msg-edit-btn';
  btn.textContent = '✎';
  btn.title = 'Edit message';
  btn.onclick = () => startEdit(lastStudent);
  el.appendChild(btn);
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

  const liveMsg = document.createElement('div');
  liveMsg.className = `msg msg-${role}`;
  $('messages').appendChild(liveMsg);

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
        liveMsg.textContent += token;
        $('messages').scrollTop = $('messages').scrollHeight;
      },
    });
  } catch (err) {
    if (err.name !== 'AbortError') {
      liveMsg.textContent = `⚠ ${err.message}`;
      liveMsg.style.color = 'var(--danger)';
    }
  }

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

  const studentMsg = document.createElement('div');
  studentMsg.className = 'msg msg-student';
  studentMsg.textContent = text;
  $('emptyState')?.classList.add('hidden');
  $('messages').appendChild(studentMsg);
  $('messages').scrollTop = $('messages').scrollHeight;

  await streamAction(`/api/conversations/${state.conv.id}/message`, { text, editOfTurnId }, 'coach');

  if (isFirst) {
    const title = text.length > 42 ? text.slice(0, 42) + '…' : text;
    await api(`/api/conversations/${state.conv.id}/rename`, { method: 'POST', body: { title } });
    state.conv.title = title;
    const item = state.conversations.find((c) => c.id === state.conv.id);
    if (item) item.title = title;
    $('convTitle').textContent = title;
    renderConvList();
  }
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

$('btnNewConv').onclick = async () => {
  if (!state.session) return;
  const conv = await api('/api/conversations', { method: 'POST', body: { sessionId: state.session.id } });
  state.conversations.unshift({ ...conv, cycleIndex: state.session.cycleIndex });
  await openConversation(conv.id);
};

$('btnRename').onclick = async () => {
  const title = prompt('Rename conversation:', state.conv.title);
  if (!title) return;
  await api(`/api/conversations/${state.conv.id}/rename`, { method: 'POST', body: { title } });
  state.conv.title = title;
  const item = state.conversations.find((c) => c.id === state.conv.id);
  if (item) item.title = title;
  $('convTitle').textContent = title;
  renderConvList();
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

async function loadDraftsList() {
  const drafts = await api(`/api/submissions?assignmentId=${state.assignment.id}`);
  const list = $('draftsList');
  list.innerHTML = '';
  for (const d of drafts) {
    const link = document.createElement('div');
    link.className = 'draft-link';
    link.innerHTML = `Draft ${d.cycleIndex + 1} report ${d.analysisStatus !== 'complete' ? '<span class="pending-dot">(analyzing…)</span>' : ''}`;
    link.onclick = () => showReport(d.id);
    list.appendChild(link);
  }
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
