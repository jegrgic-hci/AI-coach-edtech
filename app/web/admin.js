// Administration surface, serving two tiers off one page.
//
// A school administrator (a teacher carrying the grant) runs their teacher
// roster and reads what the tool is being used for. A platform administrator
// sees the same, plus what the tool costs — `data.cost` is null for anyone
// else, withheld by the server rather than hidden here, so the page cannot be
// the thing that leaks it.
//
// Everything here is aggregate by construction — /api/admin/overview never
// sends a student name, a transcript, an essay, or an integrity flag, so
// there is nothing on this page to accidentally disclose. The cost view holds
// that line too: the per-student spread is reported as bare numbers, never as
// a ranked list of who cost what.

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let data = null;
let areaAudience = 'teacher';
let editingId = null;
let view = null;
let filter = '';

// The rail. Three groups, because the surface serves three different questions
// and the first version conflated two of them: "Activity" held Cost next to
// Content areas, but one is an operational fact about a running install and
// the other is a product-roadmap question. Nobody opens this console to learn
// that Evaluate is under-used.
//
//   Operations — is it working, and what is it costing (the daily question)
//   Accounts   — the people (where the support tickets come from)
//   Product    — what people do with it (the roadmap question)
//
// Labels name their contents, not the act of looking at them: "Operations",
// not "Tracking" or "Monitoring", which describe what the system does rather
// than what is on the page.
const NAV = [
  {
    heading: 'Operations',
    items: [
      { id: 'status', label: 'Status', platformOnly: true, count: () => openIssues() || null },
      { id: 'cost', label: 'Cost', platformOnly: true },
      // Operations, not Accounts: this is volume against a plan ceiling and
      // whether sending still works — an operational fact about a running
      // install. "Who has an account" stays next door.
      { id: 'email', label: 'Email delivery', platformOnly: true },
    ],
  },
  {
    heading: 'Accounts',
    items: [
      { id: 'teachers', label: 'Teachers', count: () => data.teachers.length },
      { id: 'students', label: 'Students', count: () => data.students.length },
    ],
  },
  {
    heading: 'Product',
    items: [
      { id: 'areas', label: 'Content areas' },
      { id: 'patterns', label: 'Work patterns' },
    ],
  },
];

// The count on Status is the number of things actually needing a decision, so
// the rail can say "2" without anyone opening it. Zero renders as no badge at
// all rather than a "0" — an all-clear should look like silence.
function openIssues() {
  const s = data.status;
  if (!s) return 0;
  return s.failedAnalyses.length + s.stuckAnalyses + s.caps.atHardCap + s.spend.outliers;
}

function navItems() {
  return NAV.flatMap((g) => g.items).filter((i) => !i.platformOnly || data.viewer?.platformAdmin);
}

// Status for a platform admin, Teachers for a school administrator. Cost was
// the wrong landing: what it costs is a monthly question, whether it is working
// is a daily one, and the console should open on the daily one.
function defaultView() {
  return data.viewer?.platformAdmin ? 'status' : 'teachers';
}

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

// The sign-in state of an account, in one line under their address.
//
// This is the whole answer to "my students say they never got the email", so
// it names the address the message actually went to — a typo is the commonest
// cause and the only one visible without asking anyone anything.
//
// Plain text, not a chip, for everything except a delivery failure: per
// designsystem.md a chip needs to be BOTH actionable AND rare, and "invited,
// hasn't signed in yet" is neither. A refused or bounced message is both, and
// its label states the alert itself rather than carrying it in colour alone.
function accountState(person) {
  if (!person.neverSignedIn) return '';
  const s = person.lastSend;
  if (!s) return '<span class="account-state">No invite sent yet</span>';

  const when = new Date(s.sentAt).toLocaleDateString();
  const failed = !s.accepted || s.deliveryStatus === 'bounced' || s.deliveryStatus === 'spam';
  if (failed) {
    const why = s.failureReason || (s.deliveryStatus === 'spam' ? 'marked as spam' : 'bounced');
    return `<span class="chip chip-attention">Invite not delivered</span>
      <span class="account-state">to ${esc(s.to)} on ${esc(when)} — ${esc(why)}</span>`;
  }
  const landed = s.deliveryStatus === 'delivered' ? 'delivered' : 'sent';
  return `<span class="account-state">Invite ${landed} to ${esc(s.to)} on ${esc(when)} · not signed in yet</span>`;
}

function relativeTime(iso) {
  if (!iso) return 'never';
  const mins = Math.floor((Date.now() - new Date(iso)) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  if (mins < 1440) return `${Math.floor(mins / 60)} h ago`;
  return `${Math.floor(mins / 1440)} d ago`;
}

// Status. The one view that answers "is anything broken right now", which is
// what an administrator opens the console to ask and what nothing here could
// answer before.
//
// Structured as decisions first, reassurance second: anything needing action
// is listed individually with the control that resolves it, and everything
// that is merely fine collapses into one line. An all-clear should be short.
function renderStatus() {
  const s = data.status;
  if (!s) return '';
  const issues = openIssues();

  const lead = issues === 0
    ? `<section class="admin-lead">
        <span class="admin-lead-figure">All clear</span>
        <span class="admin-lead-text">Nothing needs attention. Reports are completing, no student has hit a
          hard limit, and spend looks normal.</span>
      </section>`
    : `<section class="admin-lead">
        <span class="admin-lead-figure">${issues}</span>
        <span class="admin-lead-text">${issues === 1 ? 'thing needs' : 'things need'} attention.
          Everything below is listed with what resolves it.</span>
      </section>`;

  // Each failed analysis is one student who submitted work and got no report.
  // Listed individually with its retry, identified by assignment and id —
  // fixing a broken report never requires knowing whose report it is.
  const failures = s.failedAnalyses.length
    ? `<section>
        <div class="section-head"><span class="section-title">Reports that failed</span></div>
        <p class="section-note">A draft was submitted and its report never arrived. Usually a transient model
          error, so retrying is normally the whole fix. The student keeps their submission either way.</p>
        <div class="card card-lg">
          ${s.failedAnalyses.map((f) => `<div class="list-row status-row">
            <div class="status-row-id">
              <div class="teacher-name">${esc(f.assignment)}</div>
              <div class="teacher-email">${esc(f.submittedAt ? `submitted ${relativeTime(f.submittedAt)}` : 'submission date unknown')}
                · ${esc(f.error)}</div>
            </div>
            <button class="btn btn-quiet btn-sm" data-retry="${esc(f.submissionId)}">Retry</button>
          </div>`).join('')}
        </div>
      </section>`
    : '';

  const stuck = s.stuckAnalyses
    ? `<section>
        <div class="section-head"><span class="section-title">Reports still pending</span></div>
        <p class="section-note">${plural(s.stuckAnalyses, 'report has', 'reports have')} been pending for over an hour.
          Analysis normally finishes in seconds, so these runs most likely died without recording an error.
          They will not retry themselves.</p>
      </section>`
    : '';

  const rate = s.llm.errorRate24h;
  const modelLine = s.llm.calls24h === 0
    ? 'No model calls in the last 24 hours — nobody has used the chat today.'
    : `${plural(s.llm.calls24h, 'model call', 'model calls')} in the last 24 hours, ${
        s.llm.failures24h === 0 ? 'none failed' : `${s.llm.failures24h} failed (${Math.round(rate * 100)}%)`}.${
        s.llm.lastFailureAt ? ` Last failure ${relativeTime(s.llm.lastFailureAt)}${s.llm.lastFailureCode ? ` (HTTP ${s.llm.lastFailureCode})` : ''}.` : ''}`;

  // Median and busiest, not a cap count: with the reply cap retired there is no
  // threshold to report against, and what this page is now collecting is what a
  // normal day actually looks like — which a median and a tail answer and a
  // count of nobody does not.
  const capLine = s.caps.activeToday === 0
    ? 'No students have used the chat today.'
    : `${plural(s.caps.activeToday, 'student has', 'students have')} used the chat today — median ${
        s.caps.medianReplies} ${s.caps.medianReplies === 1 ? 'reply' : 'replies'}, busiest ${s.caps.maxReplies}. ${
        s.caps.atHardCap ? `${plural(s.caps.atHardCap, 'student has', 'students have')} hit the daily token limit — that should not happen in normal use and usually means a loop.`
          : s.caps.nearHardCap ? `${plural(s.caps.nearHardCap, 'student is', 'students are')} close to the daily token limit.`
          : 'Nobody is near the daily token limit.'}`;

  // The evidence for setting the cap. Stated as a sentence rather than a chart:
  // it is four numbers, and designsystem.md's Hard Constraints put a trend in
  // plain text unless a chart was asked for.
  const d = s.caps.dailyTokens;
  // Below this many observations a percentile is the same data point as the max
  // wearing a different label, so it is withheld rather than caveated — median,
  // average and busiest are all a thin sample can honestly support.
  const PERCENTILE_MIN_DAYS = 20;
  const capLoad = d.studentDays === 0
    // States the requirement, never a tally it hasn't checked.
    ? `No chat days recorded in the last ${d.windowDays} days — the cap has nothing to be set against yet.`
    : d.studentDays < PERCENTILE_MIN_DAYS
      ? `Across ${plural(d.studentDays, 'student-day', 'student-days')} in the last ${d.windowDays} days: median ${
          compactTokens(d.median)} tokens, average ${compactTokens(d.mean)}, busiest ${compactTokens(d.max)}. Today's ${
          compactTokens(s.caps.hardLimit)} cap would have allowed ${
          d.capPercentile === 100 ? 'all of them' : `${d.capPercentile}% of them`}. Setting the cap off this needs ${
          PERCENTILE_MIN_DAYS} student-days; there are ${d.studentDays}.`
      : `Across ${plural(d.studentDays, 'student-day', 'student-days')} in the last ${d.windowDays} days: median ${
          compactTokens(d.median)} tokens, average ${compactTokens(d.mean)}, 95th percentile ${
          compactTokens(d.p95)}, busiest ${compactTokens(d.max)}. Today's ${compactTokens(s.caps.hardLimit)} cap would have allowed ${
          d.capPercentile}% of them.${
          d.capPercentile < 95 ? ' It is cutting into normal use — worth raising.'
            : d.mean > d.median * 2 ? ' The average sits well above the median, so a few heavy days are carrying it — set the cap off the 95th percentile, not the average.'
            : ''}`;

  const spendLine = s.spend.outliers
    ? `${plural(s.spend.outliers, 'student is', 'students are')} spending at least ${s.spend.outlierMultiple}× the median (${money(s.spend.medianUsd)}). Worth a look — heavy use and a runaway loop are different shapes.`
    : `No student is spending more than ${s.spend.outlierMultiple}× the median${s.spend.medianUsd ? ` (${money(s.spend.medianUsd)})` : ''}.`;

  return lead + failures + stuck + `<section>
    <div class="section-head"><span class="section-title">Running state</span></div>
    <div class="card card-lg">
      <div class="eyebrow">Model calls</div>
      <p class="pattern-note">${esc(modelLine)}</p>
      <div class="eyebrow">Daily limits</div>
      <p class="pattern-note">${esc(capLine)}</p>
      <div class="eyebrow">Daily token use</div>
      <p class="pattern-note">${esc(capLoad)}</p>
      <div class="eyebrow">Spend distribution</div>
      <p class="pattern-note">${esc(spendLine)}</p>
    </div>
  </section>
  <section>
    <div class="section-head"><span class="section-title">Configuration</span></div>
    <p class="section-note">Set at deploy time, not from this page. Config that routes data is a security
      boundary — a console that can change where student work goes is an exfiltration channel. It is shown
      so it can be checked, not changed.</p>
    <div class="card card-lg">
      <div class="cost-split">
        <span class="cost-split-item">Project <span class="cost-split-value">${esc(s.config.projectId || 'not set')}</span></span>
        <span class="cost-split-item">Region <span class="cost-split-value">${esc(s.config.location)}</span></span>
        <span class="cost-split-item">Chat model <span class="cost-split-value">${esc(s.config.chatModel)}</span></span>
        <span class="cost-split-item">Analysis model <span class="cost-split-value">${esc(s.config.analysisModel)}</span></span>
        <span class="cost-split-item">Daily token limit <span class="cost-split-value">${compactTokens(s.caps.hardLimit)}</span></span>
      </div>
    </div>
  </section>`;
}

function matchesFilter(person) {
  if (!filter) return true;
  const q = filter.toLowerCase();
  return person.displayName.toLowerCase().includes(q) || (person.email || '').toLowerCase().includes(q);
}

// One search box, shared by both rosters. Not a component in components.css,
// so it is composed from .field — which is the right shape here, unlike the
// checkbox case.
function renderSearch(placeholder, shown, total) {
  return `<div class="roster-search">
    <input id="rosterFilter" type="search" placeholder="${esc(placeholder)}" value="${esc(filter)}" autocomplete="off">
    ${filter ? `<span class="roster-search-count">${shown} of ${total}</span>` : ''}
  </div>`;
}

function renderStudents() {
  const shown = data.students.filter(matchesFilter);
  const rows = shown.map((s) => {
    const suspended = s.status === 'suspended';
    return `<div class="list-row teacher-row${suspended ? ' row-suspended' : ''}">
      <div class="teacher-id">
        <div class="teacher-name">${esc(s.displayName)}
          ${suspended ? '<span class="chip chip-grey">Suspended</span>' : ''}</div>
        <div class="teacher-email">${s.identity === 'code' ? esc(s.username || 'Signs in by access code') : esc(s.email)} · ${esc(relativeDate(s.lastActiveAt))}</div>
        ${accountState(s)}
      </div>
      <div class="teacher-counts">${plural(s.classCount, 'class', 'classes')}</div>
      <div class="teacher-actions">
        ${s.identity === 'code'
          // No mail action: there is no address to send to, and the recovery
          // is a teacher reissuing the code in person. Saying so beats a
          // button that can only fail — the server refuses it either way.
          ? '<span class="section-note" style="margin:0">Their teacher reissues the code</span>'
          : `<button class="btn btn-quiet btn-sm" data-smail="${s.id}">${s.neverSignedIn ? 'Resend invite' : 'Send reset link'}</button>`}
        <button class="btn btn-quiet btn-sm" data-sstatus="${s.id}" data-to="${suspended ? 'active' : 'suspended'}">${suspended ? 'Reactivate' : 'Suspend'}</button>
      </div>
    </div>`;
  }).join('');

  return `<section>
    <div class="section-head">
      <span class="section-title">Students</span>
      ${renderSearch('Search students by name or email', shown.length, data.students.length)}
    </div>
    <p class="section-note">Accounts only. Students are added by their teacher, on a class roster — there is no
      "add student" here, because two places to create the same person is two places for them to differ.
      Their work, reports, and flags stay between them and their own teacher.</p>
    <div class="card card-lg">
      ${rows || `<p class="section-note" style="margin:0">${filter ? 'No student matches that search.' : 'No students yet. Teachers add them to a class by email.'}</p>`}
    </div>
  </section>` + renderAdminEvents();
}

// Who did what, on the account surfaces. Rendered on both rosters because the
// question ("who suspended this account?") arrives from whichever one you are
// standing on.
function renderAdminEvents() {
  const events = data.adminEvents || [];
  const verb = {
    create: 'added', edit: 'edited', suspend: 'suspended',
    reactivate: 'reactivated', 'reset-password': 'reset the password for',
    'retry-analysis': 'retried a report for',
  };
  if (!events.length) {
    return `<section>
      <div class="eyebrow">Recent account changes</div>
      <p class="pattern-note">Nothing recorded yet. Every account action taken from this page is logged here from now on.</p>
    </section>`;
  }
  return `<section>
    <div class="eyebrow">Recent account changes</div>
    <div class="card card-lg">
      ${events.map((e) => `<div class="audit-row">
        <span class="audit-when">${esc(relativeTime(e.ts))}</span>
        <span class="audit-what"><strong>${esc(e.actorName)}</strong> ${esc(verb[e.action] || e.action)}
          ${esc(e.targetName || e.detail || '')}${e.targetName && e.detail ? ` — ${esc(e.detail)}` : ''}</span>
      </div>`).join('')}
    </div>
  </section>`;
}

// Plain text in the counts column rather than a chip beside the name: the
// value is rare here but not actionable, and the system reserves enclosure for
// values that are both (designsystem.md, Hard Constraints). It reads as a
// count because the grant on its own contributes nothing — only a class the
// teacher has marked does, and the gap between the two is what an admin
// checking on a pilot actually needs to see.
// Either grant reaches contribution, so either one earns the line — a Pilot
// user with no separate improvementEligible flag is contributing all the same,
// and a blank here would read as "nothing is being collected".
//
// Deliberately NOT read off a derived field sent by the server: the form's
// "Measurement improvement contributor" checkbox is populated from the raw
// `improvementEligible`, and merging the two upstream would tick that box for
// every Pilot user and persist the second grant on the next save.
function improvementLine(t) {
  if (!t.improvementEligible && !t.codeRoster) return '';
  if (!t.improvementClassCount) return '<br>No class contributing work';
  return `<br>${t.improvementClassCount} of ${plural(t.classCount, 'class', 'classes')} contributing`;
}

function renderTeachers() {
  const shown = data.teachers.filter(matchesFilter);
  const rows = shown.map((t) => {
    const suspended = t.status === 'suspended';
    return `<div class="list-row teacher-row${suspended ? ' row-suspended' : ''}">
      <div class="teacher-id">
        <div class="teacher-name">${esc(t.displayName)}
          ${t.schoolAdmin ? '<span class="chip chip-neutral">School administrator</span>' : ''}
          ${suspended ? '<span class="chip chip-grey">Suspended</span>' : ''}</div>
        <div class="teacher-email">${esc(t.email)} · ${esc(relativeDate(t.lastActiveAt))}</div>
        ${accountState(t)}
      </div>
      <div class="teacher-counts">
        ${plural(t.classCount, 'class', 'classes')} · ${plural(t.studentCount, 'student', 'students')}<br>
        ${plural(t.assignmentCount, 'assignment', 'assignments')}
        ${t.codeRoster ? '<br>Pilot user' : ''}
        ${t.namedStudentCount
          // A chip, and it earns one on both halves of the salience test
          // (designsystem.md): actionable — a pilot account holding identified
          // students is a mismatch with their agreement that somebody has to
          // resolve — and rare, since it should be zero on every row.
          ? `<br><span class="chip chip-attention">${t.namedStudentCount} named student${t.namedStudentCount === 1 ? '' : 's'}</span>`
          : ''}
        ${improvementLine(t)}
      </div>
      <div class="teacher-actions">
        <button class="btn btn-quiet btn-sm" data-edit="${t.id}">Edit</button>
        <button class="btn btn-quiet btn-sm" data-tmail="${t.id}">${t.neverSignedIn ? 'Resend invite' : 'Send reset link'}</button>
        <button class="btn btn-quiet btn-sm" data-status="${t.id}" data-to="${suspended ? 'active' : 'suspended'}">${suspended ? 'Reactivate' : 'Suspend'}</button>
      </div>
    </div>`;
  }).join('');

  return `<section>
    <div class="section-head">
      <span class="section-title">Teachers</span>
      <div class="section-head-tools">
        ${renderSearch('Search teachers by name or email', shown.length, data.teachers.length)}
        <button class="btn btn-primary" type="button" id="addTeacher">+ Add teacher</button>
      </div>
    </div>
    <p class="section-note">Each teacher builds their own workspace — their classes, their students, their assignments.
      A teacher only ever sees the students on their own rosters.</p>
    <div class="card card-lg">
      ${rows || `<p class="section-note" style="margin:0">${filter ? 'No teacher matches that search.' : 'No teachers yet. Add the first one to get started.'}</p>`}
    </div>
  </section>` + renderAdminEvents();
}

// Dollars at this scale are cents, so two decimals everywhere would render a
// whole page of "$0.00". Below a dollar the meaningful digits are the cents.
function money(n) {
  if (!n) return '$0';
  // "under 1¢" rather than "<1¢": this string is interpolated straight into
  // markup in the split rows, where a bare < opens a phantom tag.
  if (n < 0.01) return 'under 1¢';
  if (n < 1) return `${Math.round(n * 100)}¢`;
  return `$${n.toFixed(2)}`;
}

function compactTokens(n) {
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${Math.round(n / 1e3)}K`;
  return String(n);
}

function renderCost() {
  const c = data.cost;
  if (!c) return '';

  // Trend as a sentence, not a chart. designsystem.md: a trend value defaults
  // to plain text unless a chart was explicitly asked for — and two weekly
  // totals is not a series worth drawing.
  const delta = c.last7Usd - c.prior7Usd;
  const trend = !c.prior7Usd && !c.last7Usd
    ? 'Nothing spent in the last two weeks.'
    : `${money(c.last7Usd)} in the last 7 days, against ${money(c.prior7Usd)} the 7 before — ${
        Math.abs(delta) < 0.01 ? 'flat' : delta > 0 ? `up ${money(delta)}` : `down ${money(-delta)}`}.`;

  const kindLabel = { chat: 'AI chat', analysis: 'Draft analysis' };
  const split = c.byKind.map((k) => `<span class="cost-split-item">${esc(kindLabel[k.key] || k.key)}
    <span class="cost-split-value">${money(k.usd)}</span> · ${plural(k.calls, 'call', 'calls')}</span>`).join('');

  const models = c.byModel.map((m) => `<span class="cost-split-item">${esc(m.key)}
    <span class="cost-split-value">${money(m.usd)}</span> · ${plural(m.calls, 'call', 'calls')}</span>`).join('');

  const tiles = [
    {
      figure: c.perStudent ? money(c.perStudent.median) : '—',
      label: 'Median per student',
      note: c.perStudent
        ? `Across ${plural(c.perStudent.students, 'student', 'students')} who have used the chat. Costliest is ${money(c.perStudent.max)}.`
        : 'Fills in once students start using the chat.',
    },
    { figure: compactTokens(c.inputTokens), label: 'Input tokens', note: 'Chat resends the whole conversation each turn, so this grows faster than reply count does.' },
    { figure: compactTokens(c.outputTokens), label: 'Output tokens', note: 'Includes thinking tokens, which bill as output.' },
  ];

  const unpriced = c.unpricedModels.length
    ? `<p class="cost-note">No price on record for ${esc(c.unpricedModels.join(', '))}, so those calls count as $0 here.
       Add the rate to <code>app/server/prices.js</code> to bring them in.</p>`
    : '';

  return `<section class="admin-lead">
      <span class="admin-lead-figure">${esc(money(c.totalUsd))}</span>
      <span class="admin-lead-text">spent so far, across ${plural(c.calls, 'model call', 'model calls')}${
        c.since ? `, since ${new Date(c.since).toLocaleDateString()}` : ''}.</span>
    </section>
    <section>
    <div class="section-head">
      <span class="section-title">Where it goes</span>
      <button class="btn btn-quiet btn-sm" type="button" id="exportCost">Export CSV</button>
    </div>
    <p class="section-note">${esc(trend)} Derived from stored token counts at current published rates,
      so these figures re-price rather than go stale when Google moves prices.
      Treat them as close, not exact — Google's own billing console is the authority.</p>
    <div class="card card-lg">
      <div class="pattern-grid">
        ${tiles.map((t) => `<div>
          <div class="pattern-figure">${esc(t.figure)}</div>
          <div class="pattern-label">${esc(t.label)}</div>
          <div class="pattern-note">${esc(t.note)}</div>
        </div>`).join('')}
      </div>
      <div class="eyebrow">By purpose</div>
      <div class="cost-split">${split || '<span class="cost-split-item">No calls recorded yet.</span>'}</div>
      <div class="eyebrow">By model</div>
      <div class="cost-split">${models || '<span class="cost-split-item">No calls recorded yet.</span>'}</div>
      ${unpriced}
    </div>
  </section>`;
}

// CSV, because the person who asks for these numbers works in a spreadsheet
// and will not accept a screenshot. Built client-side from the payload already
// on the page — no endpoint, no second source of truth to drift.
function exportCost() {
  const c = data.cost;
  const rows = [
    ['metric', 'value'],
    ['total_usd', c.totalUsd.toFixed(4)],
    ['calls', c.calls],
    ['input_tokens', c.inputTokens],
    ['output_tokens', c.outputTokens],
    ['last_7_days_usd', c.last7Usd.toFixed(4)],
    ['prior_7_days_usd', c.prior7Usd.toFixed(4)],
    ['students_with_usage', c.perStudent ? c.perStudent.students : 0],
    ['median_per_student_usd', c.perStudent ? c.perStudent.median.toFixed(4) : ''],
    ['max_per_student_usd', c.perStudent ? c.perStudent.max.toFixed(4) : ''],
    ...c.byKind.map((k) => [`usd_${k.key}`, k.usd.toFixed(4)]),
    ...c.byModel.map((m) => [`usd_model_${m.key}`, m.usd.toFixed(4)]),
  ];
  // Quote every field: model names carry hyphens today and could carry commas
  // tomorrow, and a CSV that breaks on one row breaks silently.
  const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `tau-cost-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
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
      note: 'Median. One long thread rather than several focused ones means less separation between lines of thinking.',
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

  return renderLead() + `<section>
    <p class="section-note">Derived from the work records themselves, so these are complete from day one
      rather than filling in as the content-area counts do.</p>
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

// Volume against the plan's ceilings, and whether sending still works.
//
// Counts carry their denominator for the same reason the reach bars do: "34"
// alone is not a fact anyone can act on, and "34 of 200" is. No trend line —
// the question here is "how close to the limit, and is it alive", not "what
// shape has the week been".
function renderEmail() {
  const m = data.mail;
  if (!m) return '';

  const dayPct = Math.min(100, Math.round((m.today / m.limits.perDay) * 100));
  const monthPct = Math.min(100, Math.round((m.month / m.limits.perMonth) * 100));

  // A count of zero reads identically whether nothing needed sending or
  // sending is broken. The last-send time is what separates those, so it is
  // stated as a peer of the counts rather than as a footnote.
  const lead = !m.configured
    ? `<section class="admin-lead">
        <span class="admin-lead-figure">Not configured</span>
        <span class="admin-lead-text">No mail provider key is set on this instance, so invites and reset
          links are written to the server log instead of being sent. Expected on a local or demo instance.</span>
      </section>`
    : !m.lastSentAt
      ? `<section class="admin-lead">
          <span class="admin-lead-figure">Nothing sent yet</span>
          <span class="admin-lead-text">No invite or reset link has gone out from this instance this month.</span>
        </section>`
      : `<section class="admin-lead">
          <span class="admin-lead-figure">${esc(relativeTime(m.lastSentAt))}</span>
          <span class="admin-lead-text">was the last message out. On a school day this reading in
            days rather than minutes is the sign that sending has stopped working.</span>
        </section>`;

  const undelivered = m.undelivered
    ? `<section>
        <div class="eyebrow">Not delivered</div>
        <p class="section-note">${plural(m.undelivered, 'message', 'messages')} this month
          ${m.undelivered === 1 ? 'was' : 'were'} refused, bounced, or marked as spam. Open the person's
          row under Teachers or Students to see the address it went to, and resend from there.</p>
      </section>`
    : '';

  return `<section>
    <div class="section-head"><span class="section-title">Email delivery</span></div>
    <p class="section-note">Account invites and password reset links. The plan allows
      ${m.limits.perDay} a day and ${m.limits.perMonth} a month — a whole-school import is the thing
      that reaches either.</p>
    ${lead}
    <div class="card card-lg">
      <div class="audit-row">
        <span class="audit-when">Today</span>
        <span class="audit-what"><strong>${m.today}</strong> of ${m.limits.perDay} sent${dayPct >= 80 ? ` — ${dayPct}% of the daily limit` : ''}</span>
      </div>
      <div class="audit-row">
        <span class="audit-when">This month</span>
        <span class="audit-what"><strong>${m.month}</strong> of ${m.limits.perMonth} sent${monthPct >= 80 ? ` — ${monthPct}% of the monthly limit` : ''}</span>
      </div>
    </div>
    ${undelivered}
  </section>`;
}

const VIEWS = {
  status: renderStatus,
  cost: renderCost,
  email: renderEmail,
  students: renderStudents,
  areas: renderContentAreas,
  patterns: renderPatterns,
  teachers: renderTeachers,
};

function renderNav() {
  const allowed = new Set(navItems().map((i) => i.id));
  $('adminNav').innerHTML = NAV.map((group) => {
    const items = group.items.filter((i) => allowed.has(i.id));
    if (!items.length) return '';
    return `<div class="rail-group">
      <span class="eyebrow">${esc(group.heading)}</span>
      ${items.map((i) => `<button class="rail-item${i.id === view ? ' active' : ''}" type="button"
        data-view="${i.id}"${i.id === view ? ' aria-current="page"' : ''}>
        <span class="rail-item-text"><span class="rail-item-name">${esc(i.label)}</span></span>
        ${i.count ? `<span class="rail-item-meta">${esc(i.count())}</span>` : ''}
      </button>`).join('')}
    </div>`;
  }).join('');
}

function render() {
  $('roleChip').textContent = data.viewer?.platformAdmin ? 'Platform administrator' : 'School administrator';
  // A view the current tier cannot see (a school admin on #cost, or a stale
  // bookmark) falls back rather than rendering an empty main region.
  if (!navItems().some((i) => i.id === view)) view = defaultView();
  renderNav();
  $('adminMain').innerHTML = VIEWS[view]();
  $('adminMain').scrollTop = 0;
}

// ---------- actions ----------

function openTeacherModal(teacher) {
  editingId = teacher ? teacher.id : null;
  $('teacherModalTitle').textContent = teacher ? 'Edit teacher' : 'Add a teacher';
  $('teacherModalSub').textContent = teacher
    ? 'Their classes, students, and assignments are untouched by this.'
    : 'They sign in and build their own workspace from there — their classes, their students, their assignments.';
  $('teacherSave').textContent = teacher ? 'Save changes' : 'Add teacher';
  // An account created before this form split the name has only displayName.
  // Splitting it on the last space is a guess, but it is a guess shown in an
  // editable field rather than one written silently into a handle — the
  // administrator sees it and can correct it.
  const parts = (teacher?.displayName || '').trim().split(/\s+/);
  $('teacherFirstName').value = teacher ? (teacher.firstName ?? parts.slice(0, -1).join(' ')) : '';
  $('teacherLastName').value = teacher ? (teacher.lastName ?? parts[parts.length - 1] ?? '') : '';
  $('teacherEmail').value = teacher ? teacher.email : '';
  $('teacherSchoolAdmin').checked = teacher ? teacher.schoolAdmin === true : false;
  // Only the tier above can hand out the grant, so a school administrator does
  // not see a control they cannot use. The server refuses the field regardless
  // — this just stops the form from implying otherwise.
  $('schoolAdminField').classList.toggle('hidden', !data.viewer?.platformAdmin);
  $('teacherImprovementEligible').checked = teacher ? teacher.improvementEligible === true : false;
  $('improvementEligibleField').classList.toggle('hidden', !data.viewer?.platformAdmin);
  $('teacherCodeRoster').checked = teacher ? teacher.codeRoster === true : false;
  $('codeRosterField').classList.toggle('hidden', !data.viewer?.platformAdmin);
  $('teacherError').classList.add('hidden');
  $('teacherModal').classList.remove('hidden');
  $('teacherFirstName').focus();
}

// One control for both messages, because which one is correct is a property
// of the account rather than a choice the administrator should have to make:
// an account that has never been signed into needs its invite again, and one
// that has needs a reset. Guessing wrong sends the wrong words to a person who
// is already confused about why they cannot get in.
async function sendAccountEmail(collection, person) {
  const resend = person.neverSignedIn;
  const what = resend ? 'invite' : 'password reset link';
  if (!confirm(`Send a new ${what} to ${person.email}?${resend ? '' : ' Their current password keeps working until they use it.'}`)) return;

  const action = resend ? 'resend-invite' : 'send-reset';
  const result = await api(`/api/admin/${collection}/${person.id}/${action}`, { method: 'POST' });
  showSendResult(resend ? 'Invite sent' : 'Reset link sent', person.displayName, person.email, result);
  await reload();
}

// Reports what happened to the message. Never a credential — an account is set
// up by whoever holds the mailbox, so there is nothing here to pass on by hand.
function showSendResult(title, name, address, result) {
  const accepted = !result || result.accepted !== false;
  $('sendTitle').textContent = accepted ? title : 'Not sent';
  $('sendSub').textContent = accepted
    ? `Sent to ${address} for ${name}. They set their own password from the link.`
    : `Nothing was delivered to ${address}.`;
  // The failure reason is shown rather than summarised: "mailbox does not
  // exist" and "daily send limit reached" call for completely different
  // actions, and collapsing them into "sending failed" hides which.
  $('sendDetail').textContent = accepted
    ? 'If it has not arrived in a few minutes, check their spam folder before resending.'
    : (result.failureReason || 'The mail provider refused the message.');
  $('sendModal').classList.remove('hidden');
}

async function reload() {
  data = await api('/api/admin/overview');
  render();
}

// Hash routing, the same shape teacher.html already uses. It costs nothing and
// it means a reload, the back button, and a pasted link all land where the
// person expects rather than resetting to the default view.
function viewFromHash() {
  return (location.hash || '').replace(/^#/, '') || null;
}

window.addEventListener('hashchange', () => {
  const next = viewFromHash();
  if (!data || !next || next === view) return;
  view = next;
  render();
});

$('adminNav').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-view]');
  if (!btn || btn.dataset.view === view) return;
  view = btn.dataset.view;
  // Assigning the hash re-enters through hashchange, so render once here and
  // let the guard above swallow the echo.
  location.hash = view;
  render();
});

$('teacherCancel').onclick = () => $('teacherModal').classList.add('hidden');
$('sendClose').onclick = () => $('sendModal').classList.add('hidden');

$('teacherSave').onclick = async () => {
  const firstName = $('teacherFirstName').value.trim();
  const lastName = $('teacherLastName').value.trim();
  const email = $('teacherEmail').value.trim();
  const schoolAdmin = $('teacherSchoolAdmin').checked;
  const improvementEligible = $('teacherImprovementEligible').checked;
  const codeRoster = $('teacherCodeRoster').checked;
  const err = $('teacherError');
  err.classList.add('hidden');
  $('teacherSave').disabled = true;
  try {
    if (editingId) {
      await api(`/api/admin/teachers/${editingId}/edit`, { method: 'POST', body: { firstName, lastName, email, schoolAdmin, improvementEligible, codeRoster } });
      $('teacherModal').classList.add('hidden');
      await reload();
    } else {
      const created = await api('/api/admin/teachers', { method: 'POST', body: { firstName, lastName, email, schoolAdmin, improvementEligible, codeRoster } });
      $('teacherModal').classList.add('hidden');
      await reload();
      showSendResult('Invite sent', created.displayName, email, created.invite);
    }
  } catch (ex) {
    err.textContent = ex.message;
    err.classList.remove('hidden');
  } finally {
    $('teacherSave').disabled = false;
  }
};

// Search runs on input. The whole main region re-renders, so focus and caret
// are restored explicitly — without that the box loses focus on the first
// keystroke and the person types one character at a time into nothing.
$('adminMain').addEventListener('input', (e) => {
  if (e.target.id !== 'rosterFilter') return;
  const caret = e.target.selectionStart;
  filter = e.target.value;
  render();
  const box = $('rosterFilter');
  if (box) {
    box.focus();
    box.setSelectionRange(caret, caret);
  }
});

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

  if (btn.dataset.tmail) {
    const teacher = data.teachers.find((t) => t.id === btn.dataset.tmail);
    return sendAccountEmail('teachers', teacher);
  }

  if (btn.dataset.retry) {
    btn.disabled = true;
    btn.textContent = 'Retrying…';
    await api(`/api/admin/analyses/${btn.dataset.retry}/retry`, { method: 'POST' });
    // Analysis is async, so the row cannot disappear on the response — say what
    // actually happened rather than implying it is already fixed.
    btn.textContent = 'Retry started';
    return;
  }

  if (btn.dataset.smail) {
    const student = data.students.find((s) => s.id === btn.dataset.smail);
    return sendAccountEmail('students', student);
  }

  if (btn.dataset.sstatus) {
    const student = data.students.find((s) => s.id === btn.dataset.sstatus);
    const to = btn.dataset.to;
    if (to === 'suspended' && !confirm(`Suspend ${student.displayName}? They are signed out immediately. Their work and reports are kept.`)) return;
    await api(`/api/admin/students/${student.id}/status`, { method: 'POST', body: { status: to } });
    return reload();
  }

  if (btn.id === 'exportCost') return exportCost();

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
  try {
    await mountAccountChip($('accountChip'));
    view = viewFromHash();
    await reload();
  } catch (ex) {
    // Without this the page sits on "Loading…" forever on any failure, which
    // is indistinguishable from a slow load and reports nothing. Whatever went
    // wrong, say so on the page rather than only in the console.
    $('adminMain').innerHTML = `<p class="section-note">This page could not load: ${esc(ex.message)}</p>`;
  }
})();
