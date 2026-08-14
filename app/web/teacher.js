const $ = (id) => document.getElementById(id);

// api() comes from api.js. Teacher access is decided by the signed-in user's
// role server-side — there is no client-asserted role header any more.

function esc(s) {
  const d = document.createElement('div');
  d.textContent = s ?? '';
  return d.innerHTML;
}


// ---------- overview ----------

async function showOverview() {
  $('viewStudent').classList.add('hidden');
  $('viewOverview').classList.remove('hidden');
  mountAccountChip($('accountChip')).catch(() => {});
  const assignments = await api('/api/teacher/assignments');
  const body = $('overviewBody');
  body.innerHTML = `
    <div class="card-lg panel-card">
      <h3 style="display:flex;justify-content:space-between;align-items:center">
        Assignments
        <a href="/dashboard.html" class="btn btn-quiet btn-sm">+ New assignment — in the dashboard</a>
      </h3>
    </div>
    <div id="assignmentCards"></div>`;

  const cards = $('assignmentCards');
  for (const a of assignments) {
    const card = document.createElement('div');
    card.className = 'card-lg panel-card';
    card.innerHTML = `
      <h3>${esc(a.title)}</h3>
      <div style="font-size:13px;color:var(--muted);margin-bottom:6px">
        ${a.draftBudget} draft${a.draftBudget === 1 ? '' : 's'}
      </div>
      ${a.roster.map((r) => `
        <div class="list-row roster-row" data-student="${r.studentId}" data-assignment="${a.id}">
          <span class="list-row-name">${esc(r.displayName)}</span>
          ${r.cycles.map((c) => c.analysisStatus === 'complete'
            ? (c.flagCount
                ? `<span class="chip chip-caution" title="${c.flagCount} integrity signal(s)">D${c.cycleIndex + 1}: ${c.tau.totalScore} ${c.tau.SAMR} · ${c.flagCount} flag${c.flagCount !== 1 ? 's' : ''}</span>`
                : `<span class="cycle-label">D${c.cycleIndex + 1}: ${c.tau.totalScore} ${c.tau.SAMR}</span>`)
            : `<span class="cycle-label cycle-label-pending">D${c.cycleIndex + 1}: ${c.analysisStatus || 'no analysis'}</span>`).join('')}
          ${r.activeSession ? '<span class="active-note">working on next draft</span>' : ''}
          ${r.cycles.length === 0 && !r.activeSession ? '<span style="font-size:12px;color:var(--muted)">not started</span>' : ''}
        </div>`).join('')}`;
    cards.appendChild(card);
  }

  document.querySelectorAll('.roster-row').forEach((row) => {
    row.onclick = () => showStudent(row.dataset.assignment, row.dataset.student);
  });
}

// ---------- student detail ----------

// Session-ready moments, computed from the analysis: quoted turns a
// teacher can open a conference with — "show me what you meant here," not
// a score.
function computeMoments(analysis) {
  const moments = [];
  const student = (analysis.classified || []).filter((t) => t.role === 'student');

  const byConv = {};
  for (const t of student) {
    if (!byConv[t.conversationId]) {
      byConv[t.conversationId] = true;
      moments.push({ kind: 'First turn of a session', quote: t.text, why: 'Blank-context opener — the purest snapshot of where the student starts unaided.', warn: false });
    }
  }

  const challenges = student.filter((t) => t.label === 'challenge').sort((a, b) => b.text.length - a.text.length);
  if (challenges[0]) moments.push({ kind: 'Best challenge', quote: challenges[0].text, why: 'The student probing the AI’s reasoning.', warn: false });

  const rejection = student.find((t) => t.label === 'rejection');
  if (rejection) moments.push({ kind: 'Pushback', quote: rejection.text, why: 'Explicit disagreement with AI output.', warn: false });

  const aiBorn = (analysis.provenance || []).filter((p) => p.origin === 'ai-born');
  for (const p of aiBorn.slice(0, 2)) {
    moments.push({ kind: 'AI-born concept reached the essay', quote: p.phrase, why: `Concept "${p.concept}" originated with the AI and appears in the draft — worth asking how they evaluated it.`, warn: true });
  }

  return moments.slice(0, 5);
}

function renderTimeline(conv, events) {
  const convEvents = events.filter((e) => e.conversationId === conv.id);
  const items = [
    ...conv.turns.map((t) => ({ ts: t.createdAt, turn: t })),
    ...convEvents.map((e) => ({ ts: e.ts, event: e })),
  ].sort((a, b) => a.ts.localeCompare(b.ts));

  return items.map((item) => {
    if (item.event) {
      const e = item.event;
      const desc = {
        copy: `copied ${e.meta?.length || '?'} chars from ${e.meta?.role === 'auditor' ? 'an auditor' : 'an AI'} message`,
        regenerate: 'regenerated the AI reply (implicit rejection)',
        edit: 'edited their message (refinement)',
        stop: 'stopped generation',
        evaluate: 'summoned the auditor (metacognitive check)',
      }[e.type] || e.type;
      return `<div class="t-event">⚡ ${esc(desc)}</div>`;
    }
    const t = item.turn;
    const cls = t.role === 'auditor' ? 'turn-auditor' : t.role === 'student' ? 'turn-student' : 'turn-coach';
    const labels = [t.role];
    if (t.metaTurn) labels.push('meta-turn — excluded from TAU');
    if (t.superseded) labels.push('superseded');
    if (t.meta?.regenerated) labels.push('regeneration');
    if (t.meta?.editOf) labels.push('edit');
    if (t.meta?.stopped) labels.push('stopped early');
    return `<div class="turn ${cls}">
      <div class="turn-speaker">${labels.map(esc).join(' · ')}</div>
      <div class="msg${t.superseded ? ' msg-superseded' : ''}">${esc(t.text)}</div>
    </div>`;
  }).join('');
}

async function showStudent(assignmentId, studentId) {
  logUse('teacher-detail', 'student-detail');
  const { assignment, student, sessions } = await api(`/api/teacher/assignments/${assignmentId}/students/${studentId}`);
  $('viewOverview').classList.add('hidden');
  $('viewStudent').classList.remove('hidden');
  $('studentTitle').textContent = `${student.displayName} — ${assignment.title}`;
  const body = $('studentBody');
  body.innerHTML = '';

  // trajectory strip: growth with the fade as the x-axis
  const submitted = sessions.filter((s) => s.submission);
  if (submitted.length) {
    const strip = document.createElement('div');
    strip.className = 'traj-strip';
    strip.innerHTML = submitted.map(({ session, submission, analysis }) => {
      const done = analysis?.status === 'complete';
      return `<div class="card traj-card">
        <div class="lvl">Draft ${session.cycleIndex + 1}</div>
        ${done ? `
          <div class="samr">${analysis.tau.SAMR} · ${analysis.tau.totalScore}/20</div>
          <div class="dim-line">PQ ${analysis.tau.PQ} · SU ${analysis.tau.SU} · CS ${analysis.tau.CS} · OC ${analysis.tau.OC}</div>
          <a href="/report.html?id=${submission.id}&role=teacher" target="_blank" onclick="logUse('teacher-detail','full-report')">Full report →</a>
        ` : `<div class="dim-line">analysis: ${analysis?.status || 'missing'}</div>`}
      </div>`;
    }).join('');
    body.appendChild(strip);
  }

  for (const { session, conversations, events, submission, analysis } of sessions) {
    const card = document.createElement('div');
    card.className = 'panel-card';
    const done = analysis?.status === 'complete';

    let html = `<h3>Draft ${session.cycleIndex + 1}
      <span style="font-weight:400;font-size:13px;color:var(--muted)"> · ${submission ? `submitted ${new Date(submission.submittedAt).toLocaleString()}` : 'in progress'}</span></h3>`;

    if (done) {
      const moments = computeMoments(analysis);
      if (moments.length) {
        html += `<div class="eyebrow">Session-ready moments</div>`;
        html += moments.map((m) => `
          <div class="moment${m.warn ? ' warn' : ''}">
            <div class="m-kind">${esc(m.kind)}</div>
            <div class="m-quote">“${esc(m.quote)}”</div>
            <div class="m-why">${esc(m.why)}</div>
          </div>`).join('');
      }

      if (analysis.snapshot) {
        html += `<div class="eyebrow">What the student was told</div>
          <div style="font-size:13px;line-height:1.6">
            ${(analysis.snapshot.strengths || []).map((s) => `<div>• “${esc(s.quote)}” — ${esc(s.note)}</div>`).join('')}
            ${(analysis.snapshot.growthMoves || []).map((g) => `<div>→ ${esc(g)}</div>`).join('')}
          </div>`;
      }

      if (analysis.flags?.length) {
        html += `<div class="eyebrow">Integrity signals (teacher-only)</div>
          ${analysis.flags.map((f) => `<div class="moment warn"><div class="m-kind">${esc(f.flag)}</div><div class="m-why">${esc(f.evidence)}</div></div>`).join('')}`;
      }
    }

    if (submission) {
      html += `<div class="eyebrow">Your note to the student <span class="note-saved" id="noteSaved-${submission.id}"></span></div>
        <div class="field"><textarea id="note-${submission.id}" rows="2" placeholder="Shown beside their snapshot — your read next to the auditor's.">${esc(submission.teacherNote || '')}</textarea></div>
        <div style="margin-top:6px"><button data-save-note="${submission.id}" class="btn btn-quiet btn-sm">Save note</button></div>`;
    }

    html += `<div class="eyebrow">Transcript${conversations.length !== 1 ? `s (${conversations.length} sessions)` : ''}</div>`;
    for (const conv of conversations) {
      html += `<details class="transcript" ontoggle="if(this.open)logUse('teacher-detail','transcript')"><summary>${esc(conv.title)} · ${conv.turns.filter((t) => !t.superseded && !t.metaTurn).length} turns</summary>
        ${renderTimeline(conv, events)}</details>`;
    }

    const sessionEvents = events.filter((e) => !e.conversationId);
    if (sessionEvents.length) {
      html += `<div style="margin-top:8px;font-size:12px;color:var(--muted)">Work episodes: ${sessionEvents.map((e) => `${e.type.replace('episode-', '')} ${new Date(e.ts).toLocaleTimeString()}`).join(' · ')}</div>`;
    }

    card.innerHTML = html;
    body.appendChild(card);
  }

  document.querySelectorAll('[data-save-note]').forEach((btn) => {
    btn.onclick = async () => {
      const id = btn.dataset.saveNote;
      await api(`/api/submissions/${id}/note`, { method: 'POST', body: { text: $(`note-${id}`).value } });
      $(`noteSaved-${id}`).textContent = 'saved ✓';
      setTimeout(() => { $(`noteSaved-${id}`).textContent = ''; }, 2000);
    };
  });
}

$('btnBackOverview').onclick = () => { location.hash = ''; showOverview(); };

// Deep link from the triage dashboard: teacher.html#student/:assignmentId/:studentId
function route() {
  const m = location.hash.match(/^#student\/([^/]+)\/([^/]+)$/);
  if (m) showStudent(m[1], m[2]);
  else showOverview();
}
window.addEventListener('hashchange', route);
route();
