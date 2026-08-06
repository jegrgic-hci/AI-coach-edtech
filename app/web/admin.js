// Administration surface. Two jobs, in this order: run the teacher roster,
// then read what the tool is actually being used for so build effort can
// follow attention.
//
// Everything here is aggregate by construction — /api/admin/overview never
// sends a student name, a transcript, an essay, or an integrity flag, so
// there is nothing on this page to accidentally disclose.

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let data = null;
let areaAudience = 'teacher';
let editingId = null;

function plural(n, one, many) {
  return `${n} ${n === 1 ? one : many}`;
}

function relativeDate(iso) {
  if (!iso) return 'no activity recorded';
  const days = Math.floor((Date.now() - new Date(iso)) / 86400000);
  if (days <= 0) return 'active today';
  if (days === 1) return 'active yesterday';
  if (days < 30) return `active ${days} days ago`;
  return `active ${new Date(iso).toLocaleDateString()}`;
}

// ---------- render ----------

function renderLead() {
  const { scale, studentPatterns } = data;
  return `<section class="admin-lead">
    <span class="admin-lead-figure">${studentPatterns.draftsSubmitted}</span>
    <span class="admin-lead-text">drafts submitted so far, by ${plural(scale.students, 'student', 'students')}
      across ${plural(scale.classes, 'class', 'classes')} and ${plural(scale.assignments, 'assignment', 'assignments')}.</span>
  </section>`;
}

function renderTeachers() {
  const rows = data.teachers.map((t) => {
    const suspended = t.status === 'suspended';
    return `<div class="list-row teacher-row${suspended ? ' row-suspended' : ''}">
      <div class="teacher-id">
        <div class="teacher-name">${esc(t.displayName)}
          ${suspended ? '<span class="chip chip-grey">Suspended</span>' : ''}</div>
        <div class="teacher-email">${esc(t.email)} · ${esc(relativeDate(t.lastActiveAt))}</div>
      </div>
      <div class="teacher-counts">
        ${plural(t.classCount, 'class', 'classes')} · ${plural(t.studentCount, 'student', 'students')}<br>
        ${plural(t.assignmentCount, 'assignment', 'assignments')}
      </div>
      <div class="teacher-actions">
        <button class="btn btn-quiet btn-sm" data-edit="${t.id}">Edit</button>
        <button class="btn btn-quiet btn-sm" data-reset="${t.id}">Reset password</button>
        <button class="btn btn-quiet btn-sm" data-status="${t.id}" data-to="${suspended ? 'active' : 'suspended'}">${suspended ? 'Reactivate' : 'Suspend'}</button>
      </div>
    </div>`;
  }).join('');

  return `<section>
    <div class="section-head">
      <span class="section-title">Teachers</span>
      <button class="btn btn-primary" type="button" id="addTeacher">+ Add teacher</button>
    </div>
    <p class="section-note">Each teacher builds their own workspace — their classes, their students, their assignments.
      A teacher only ever sees the students on their own rosters.</p>
    <div class="card card-lg">
      ${rows || '<p class="section-note" style="margin:0">No teachers yet. Add the first one to get started.</p>'}
    </div>
  </section>`;
}

function renderContentAreas() {
  const rows = data.contentAreas[areaAudience];
  const who = areaAudience === 'teacher' ? 'teacher' : 'student';
  // The bar is reach against the real population, not against the busiest row.
  // Scaling to the list maximum made every bar full-width whenever the counts
  // tied, which reads as "heavily used" rather than "one person, once".
  const total = Math.max(1, data.audienceSize[areaAudience] || 0);

  const list = rows.map((r) => {
    const pct = Math.min(100, Math.round((r.people / total) * 100));
    const value = r.people
      // "of 8" without repeating the noun on every row — the section note
      // directly above already says what the 8 are.
      ? `${r.people} of ${total} · ${plural(r.opens, 'open', 'opens')}`
      : 'Not opened yet';
    return `<div class="area-row">
      <div>
        <div class="area-label">${esc(r.areaLabel)}</div>
        <div class="area-surface">${esc(r.surfaceLabel)}</div>
      </div>
      <div class="meter-track"><span class="meter-fill" style="width:${pct}%"></span></div>
      <div class="area-value${r.people ? '' : ' area-value-none'}">${esc(value)}</div>
    </div>`;
  }).join('');

  const since = data.usageSince
    ? `Counting opens since ${new Date(data.usageSince).toLocaleDateString()}.`
    : 'Nothing recorded yet — this fills in as people use the tool.';

  return `<section>
    <div class="section-head">
      <span class="section-title">Content areas</span>
      <!-- The shared segmented control, not two .btn-primary buttons: this is
           wayfinding state, and forest stays reserved for the one action that
           actually moves the page forward (+ Add teacher). See the rule
           written on .tau-nav-local-opt.active in components.css. -->
      <div class="tau-nav-local">
        <button class="tau-nav-local-opt${areaAudience === 'teacher' ? ' active' : ''}" type="button" data-audience="teacher">Teacher areas</button>
        <button class="tau-nav-local-opt${areaAudience === 'student' ? ' active' : ''}" type="button" data-audience="student">Student areas</button>
      </div>
    </div>
    <p class="section-note">Bars show reach — how many of the ${plural(total, who, who + 's')} on this install have opened each area,
      not raw clicks. One person opening something forty times says less than eleven people opening it once.
      Areas nobody has opened are listed too; that is the finding, not a gap in the data. ${esc(since)}</p>
    <div class="card card-lg">${list}</div>
  </section>`;
}

function renderPatterns() {
  const p = data.studentPatterns;
  const pct = p.draftsExpected ? Math.round((p.draftsSubmitted / p.draftsExpected) * 100) : null;
  const ev = p.eventCounts || {};

  const tiles = [
    {
      figure: p.conversationsPerDraft ?? '—',
      label: 'Conversations per draft',
      note: 'Median. One long thread rather than several focused ones is the pattern the coach was designed to break.',
    },
    {
      figure: p.studentTurnsPerConversation ?? '—',
      label: 'Student turns per conversation',
      note: 'Median. Short conversations mean the scoring has little to read.',
    },
    {
      figure: p.evaluateShare === null ? '—' : `${p.evaluateShare}%`,
      label: 'Drafts that used Evaluate',
      note: 'The on-demand agency check. Low use means students are not finding it.',
    },
    {
      figure: pct === null ? '—' : `${pct}%`,
      label: 'Drafts submitted of those expected',
      note: `${p.draftsSubmitted} of ${p.draftsExpected} across every assigned student and draft slot.`,
    },
    {
      figure: p.resumesPerDraft ?? '—',
      label: 'Returns to a draft',
      note: 'Median times a student came back to a session after leaving it.',
    },
    {
      figure: p.analysisCounts.error + p.analysisCounts.pending,
      label: 'Analyses not complete',
      note: `${p.analysisCounts.complete} complete, ${p.analysisCounts.error} errored, ${p.analysisCounts.pending} still pending.`,
    },
  ];

  const editing = ['copy', 'regenerate', 'edit', 'stop'].map((t) => `${t} ${ev[t] || 0}`).join(' · ');

  return `<section>
    <div class="section-head"><span class="section-title">Student work patterns</span></div>
    <p class="section-note">Derived from the work records themselves, so these are complete from day one
      rather than filling in as the counts above do.</p>
    <div class="card card-lg">
      <div class="pattern-grid">
        ${tiles.map((t) => `<div>
          <div class="pattern-figure">${esc(t.figure)}</div>
          <div class="pattern-label">${esc(t.label)}</div>
          <div class="pattern-note">${esc(t.note)}</div>
        </div>`).join('')}
      </div>
      <div class="eyebrow">In-chat actions</div>
      <div class="pattern-note">${esc(editing)} — logged for every session, not yet folded into scoring.</div>
    </div>
  </section>`;
}

function render() {
  $('adminMain').innerHTML = renderLead() + renderTeachers() + renderContentAreas() + renderPatterns();
}

// ---------- actions ----------

function openTeacherModal(teacher) {
  editingId = teacher ? teacher.id : null;
  $('teacherModalTitle').textContent = teacher ? 'Edit teacher' : 'Add a teacher';
  $('teacherModalSub').textContent = teacher
    ? 'Their classes, students, and assignments are untouched by this.'
    : 'They sign in and build their own workspace from there — their classes, their students, their assignments.';
  $('teacherSave').textContent = teacher ? 'Save changes' : 'Add teacher';
  $('teacherName').value = teacher ? teacher.displayName : '';
  $('teacherEmail').value = teacher ? teacher.email : '';
  $('teacherError').classList.add('hidden');
  $('teacherModal').classList.remove('hidden');
  $('teacherName').focus();
}

function showPassword(name, password) {
  $('passwordSub').textContent = `${name} signs in with their email and this password.`;
  $('passwordValue').textContent = password;
  $('passwordModal').classList.remove('hidden');
}

async function reload() {
  data = await api('/api/admin/overview');
  render();
}

$('teacherCancel').onclick = () => $('teacherModal').classList.add('hidden');
$('passwordClose').onclick = () => $('passwordModal').classList.add('hidden');

$('teacherSave').onclick = async () => {
  const displayName = $('teacherName').value.trim();
  const email = $('teacherEmail').value.trim();
  const err = $('teacherError');
  err.classList.add('hidden');
  $('teacherSave').disabled = true;
  try {
    if (editingId) {
      await api(`/api/admin/teachers/${editingId}/edit`, { method: 'POST', body: { displayName, email } });
      $('teacherModal').classList.add('hidden');
      await reload();
    } else {
      const created = await api('/api/admin/teachers', { method: 'POST', body: { displayName, email } });
      $('teacherModal').classList.add('hidden');
      await reload();
      showPassword(created.displayName, created.tempPassword);
    }
  } catch (ex) {
    err.textContent = ex.message;
    err.classList.remove('hidden');
  } finally {
    $('teacherSave').disabled = false;
  }
};

// One delegated handler for the whole main region — every control inside it is
// re-rendered wholesale on each reload, so per-element listeners would have to
// be rebound every time.
$('adminMain').addEventListener('click', async (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;

  if (btn.id === 'addTeacher') return openTeacherModal(null);

  if (btn.dataset.audience) {
    areaAudience = btn.dataset.audience;
    return render();
  }

  if (btn.dataset.edit) {
    return openTeacherModal(data.teachers.find((t) => t.id === btn.dataset.edit));
  }

  if (btn.dataset.reset) {
    const teacher = data.teachers.find((t) => t.id === btn.dataset.reset);
    if (!confirm(`Reset the password for ${teacher.displayName}? Their current one stops working.`)) return;
    const { tempPassword } = await api(`/api/admin/teachers/${teacher.id}/reset-password`, { method: 'POST' });
    return showPassword(teacher.displayName, tempPassword);
  }

  if (btn.dataset.status) {
    const teacher = data.teachers.find((t) => t.id === btn.dataset.status);
    const to = btn.dataset.to;
    // Named consequence rather than "are you sure": suspending signs them out
    // of a tab they may have open right now, which is not obvious from the
    // button label alone.
    if (to === 'suspended' && !confirm(`Suspend ${teacher.displayName}? They are signed out immediately. Their classes, students, and assignments are kept.`)) return;
    await api(`/api/admin/teachers/${teacher.id}/status`, { method: 'POST', body: { status: to } });
    return reload();
  }
});

(async function init() {
  await mountAccountChip($('accountChip'));
  await reload();
})();
