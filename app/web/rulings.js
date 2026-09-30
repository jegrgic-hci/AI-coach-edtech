// A teacher's rulings on one draft — on each of its flags, and on its agency
// level. Shared by the student view in dashboard.html and the teacher's report,
// so the two draw one control and each shows what was decided on the other.
//
// The page owns the data and the re-render. It hands over:
//   get(subId)          -> the object holding { flagDecisions, followedUpAt,
//                          agencyMark } for that draft, mutated in place here
//   changed(subId, kind) -> re-render; kind is 'flag' | 'agency' | 'editor',
//                          because only a flag ruling moves the triage counts
//
// Reasons are written inline, on both surfaces. The ruling has already saved by
// the time the box opens, so nothing stands between the teacher and moving on
// — which is what the modal this replaced was for — and the report has no
// modal to open one in.
(function () {
  let host = null;
  // Which reason box is open. One at a time: a second opening while the first
  // holds unsaved text would drop it on the re-render.
  let editing = null;

  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const q = (v) => `'${String(v).replace(/[^\w-]/g, '')}'`;
  const editorKey = (kind, subId, key) => `${kind}:${subId}:${key || ''}`;
  const editorId = (kind, subId, key) => `ruling-reason-${kind}-${subId}-${key || 'level'}`;
  const stop = 'event.stopPropagation();';

  function configure(h) { host = h; }

  function choice(on, onclick, inner, label) {
    return `<button type="button" class="btn btn-choice btn-sm${label ? ' btn-icon-only' : ''}"
      aria-pressed="${on}"${label ? ` aria-label="${label}" title="${label}"` : ''}
      onclick="${stop}${onclick}">${inner}</button>`;
  }

  // The private reason, shown or being written. `placeholder` is the question
  // the reason answers, asked in the box rather than as its label — the label
  // names what the text is and who sees it.
  function reasonBlock(kind, subId, key, reason, placeholder) {
    const lbl = `<span class="ruling-reason-lbl">${iconSVG('lock')}Private — only you see this</span>`;
    if (editing === editorKey(kind, subId, key)) {
      const id = editorId(kind, subId, key);
      return `<div class="ruling-reason ruling-reason-edit" onclick="event.stopPropagation()">
        <label for="${id}">${lbl}</label>
        <textarea id="${id}" rows="3" maxlength="2000" placeholder="${esc(placeholder)}">${esc(reason || '')}</textarea>
        <div class="ruling-reason-btns">
          <button type="button" class="btn btn-quiet btn-sm" onclick="${stop}Rulings.saveReason(${q(kind)},${q(subId)},${q(key || '')})">Save reason</button>
          <button type="button" class="btn btn-tertiary btn-sm" onclick="${stop}Rulings.closeReason()">Cancel</button>
        </div>
      </div>`;
    }
    return reason ? `<div class="ruling-reason">${lbl}${esc(reason)}</div>` : '';
  }

  function reasonButton(kind, subId, key, reason) {
    if (editing === editorKey(kind, subId, key)) return '';
    return `<button type="button" class="btn btn-tertiary btn-sm"
      onclick="${stop}Rulings.openReason(${q(kind)},${q(subId)},${q(key || '')})">${reason ? 'Edit reason' : 'Add a reason'}</button>`;
  }

  // ── Flags ──────────────────────────────────────────────────────────────────

  function flagActions(subId, key) {
    const d = host.get(subId)?.flagDecisions?.[key] || null;
    const btn = (value, icon, label) => {
      const on = d?.outcome === value;
      return choice(on, `Rulings.setFlag(${q(subId)},${q(key)},${on ? 'null' : q(value)})`, `${iconSVG(icon)}${label}`);
    };
    return `${btn('acted', 'check', 'Had the chat')}${btn('nothing', 'close', 'Not worth raising')}
      ${d?.outcome === 'nothing' ? reasonButton('flag', subId, key, d.reason) : ''}`;
  }

  function flagReason(subId, key) {
    const d = host.get(subId)?.flagDecisions?.[key] || null;
    if (d?.outcome !== 'nothing') return '';
    return reasonBlock('flag', subId, key, d.reason, "What made this a false alarm on this student's work?");
  }

  // Every write shows at once and is sent in order. A Firestore write takes
  // most of a second, and a teacher taps faster than that — thumbs-down then
  // "Too high" straight after. Sent concurrently, the two could land in either
  // order, and each response redrew the control, so an earlier tap's answer
  // arriving last undid the later one on screen. One queue for the whole page:
  // writes are rare, and a strict order is simpler to trust than a per-draft one.
  let queue = Promise.resolve();
  let pending = 0;
  function send(path, body) {
    pending++;
    const next = queue.then(() => api(path, { method: 'POST', body })).finally(() => { pending--; });
    queue = next.catch(() => {});
    return next;
  }

  // A reason survives a switch to 'acted' on the server (it stores null) and
  // has to be cleared here too, or the copy patched in place would keep
  // showing text the store no longer holds.
  async function setFlag(subId, key, outcome, reason = null) {
    const holder = host.get(subId);
    if (holder) {
      if (!outcome) {
        if (holder.flagDecisions) delete holder.flagDecisions[key];
      } else {
        holder.flagDecisions = holder.flagDecisions || {};
        holder.flagDecisions[key] = {
          outcome, reason: outcome === 'nothing' ? reason : null,
          markedAt: new Date().toISOString(),
        };
      }
    }
    if (editing === editorKey('flag', subId, key)) editing = null;
    host.changed(subId, 'editor');
    await send(`/api/submissions/${subId}/flag-decision`, { flagKey: key, outcome, reason });
    // 'flag' only once every queued write has landed: on the dashboard it
    // refetches, and a refetch sent ahead of a write brings back the old answer.
    if (!pending) await host.changed(subId, 'flag');
  }

  // ── Agency level ───────────────────────────────────────────────────────────

  // The two thumbs, which sit beside the level they judge. Icon-only, so each
  // carries its label for a screen reader and on hover — and the label names
  // the reading, not the student, since a bare thumb beside a child's level
  // reads as approving the child.
  function agencyThumbs(subId) {
    const m = host.get(subId)?.agencyMark || null;
    const btn = (value, icon, label) => {
      const on = m?.outcome === value;
      return choice(on, `Rulings.setAgency(${q(subId)},${on ? 'null' : q(value)})`, iconSVG(icon), label);
    };
    return `<span class="ruling-thumbs" role="group" aria-label="Your read of this level">
      ${btn('up', 'thumbUp', 'Level reads right')}${btn('down', 'thumbDown', 'Level reads wrong')}
    </span>`;
  }

  // What a thumbs-down opens: which way it's off, and why. Both optional — the
  // thumbs-down on its own is a complete ruling.
  function agencyFollowup(subId) {
    const m = host.get(subId)?.agencyMark || null;
    if (m?.outcome !== 'down') return '';
    const dir = (value, label) => {
      const on = m.direction === value;
      return choice(on, `Rulings.setAgencyDirection(${q(subId)},${on ? 'null' : q(value)})`, label);
    };
    return `<div class="ruling-followup">
      <div class="ruling-followup-row">
        ${dir('high', 'Too high')}${dir('low', 'Too low')}
        ${reasonButton('agency', subId, null, m.reason)}
      </div>
      ${reasonBlock('agency', subId, null, m.reason, 'What in the session places it somewhere else?')}
    </div>`;
  }

  // A full replace on the server, so every write carries the whole ruling —
  // changing the direction must not drop a reason already written.
  // Shown before it is sent, and never redrawn from the response: the queue
  // keeps the server in tap order, so what is on screen is already what the
  // store will hold once the queue drains.
  async function postAgency(subId, next) {
    const holder = host.get(subId);
    if (holder) {
      holder.agencyMark = next && next.outcome ? {
        outcome: next.outcome,
        direction: next.outcome === 'down' ? next.direction || null : null,
        reason: next.outcome === 'down' ? next.reason || null : null,
        markedAt: new Date().toISOString(),
      } : null;
    }
    if (!next || next.outcome !== 'down') editing = null;
    host.changed(subId, 'agency');
    await send(`/api/submissions/${subId}/agency-mark`, next || {});
  }

  function setAgency(subId, outcome) {
    return postAgency(subId, outcome ? { outcome } : null);
  }

  function setAgencyDirection(subId, direction) {
    const m = host.get(subId)?.agencyMark || {};
    return postAgency(subId, { outcome: 'down', direction, reason: m.reason || null });
  }

  // ── The reason box ─────────────────────────────────────────────────────────

  async function openReason(kind, subId, key) {
    editing = editorKey(kind, subId, key || null);
    await host.changed(subId, 'editor');
    const box = document.getElementById(editorId(kind, subId, key || null));
    if (box) { box.focus(); box.setSelectionRange(box.value.length, box.value.length); }
  }

  async function closeReason() {
    const was = editing;
    editing = null;
    if (was) await host.changed(was.split(':')[1], 'editor');
  }

  async function saveReason(kind, subId, key) {
    const box = document.getElementById(editorId(kind, subId, key || null));
    const text = box ? box.value.trim() || null : null;
    editing = null;
    if (kind === 'flag') return setFlag(subId, key, 'nothing', text);
    const m = host.get(subId)?.agencyMark || {};
    return postAgency(subId, { outcome: 'down', direction: m.direction || null, reason: text });
  }

  window.Rulings = {
    configure, flagActions, flagReason, agencyThumbs, agencyFollowup,
    setFlag, setAgency, setAgencyDirection, openReason, closeReason, saveReason,
  };
})();
