// ── THE VIZ ORGANISMS ────────────────────────────────────────────────────────
//
// Lifted out of dashboard.html 2026-08-17 so the four marks can be mounted
// somewhere other than the teacher dashboard — a lab page, and whatever tier
// comes next. Nothing was rewritten in the move except renderTrace's signature
// (see below); a diff against the previous dashboard.html shows moves only.
//
// THE BOUNDARY IS ONE RULE: nothing in this file reads app state. No
// SUBMISSIONS, no STUDENTS, no ASSIGNMENTS, no fetch. Every function here takes
// a cohort, a flow, or an array of readings and returns markup. Selecting WHICH
// students and WHICH submissions is the host's job, and the per-surface
// adapters that do it — renderAgencyDistribution, renderDraftAgency,
// renderAssignmentDimensions, renderDraftBands, renderStudentTrace — stay in
// dashboard.html on purpose. That is what keeps this file mountable against
// fixtures, which is the whole point of moving it.
//
// TWO THINGS THE HOST MUST PROVIDE, and they are the only two:
//   setFlowMetric(scope, key)  — Movement's chips call it; it writes flowMetric
//                                (declared here) and re-renders the surface.
//   a stylesheet               — components.css carries every class used here.
//
// Colour, type and chrome live in components.css; geometry and copy live here.
// That split predates this file and is why the flow's RENDERER moved but its
// CSS did not (teacher-dashboard-design.md, "Component layer").
//
// Four organisms, deliberately not three: Composition, Distribution, Movement,
// Trace. Each occurs alone somewhere in the shipped app, so none may assume a
// sibling is on the page with it.



// ═══ SCALE VOCABULARY — the words the four marks share ═══════════════════════

// The plain-language gloss on a level. NOT the label — that reversed 2026-08-12
// when the level became a reading in its own right rather than arithmetic off a
// total: "SAMR leads. The level is the primary label ... named, never numbered"
// (designsystem.md Hard Constraints). These are what a level MEANS, which is why
// they read as sentence fragments; LEVEL_GLOSS is the long form of the same idea
// and the Composition organism already pairs the two that way.
const BAND_PLAIN = {
  1: 'Taking what it gives',
  2: 'Steering a little',
  3: 'Reshaping the answer',
  4: 'Going past the answer',
};
const SAMR_NAMES = ['Substitution', 'Augmentation', 'Modification', 'Redefinition'];

// A STUDENT'S LEVEL, WHEREVER ONE IS SHOWN. Takes the level ordinal 1–4, or null
// for a student with no readable session — never a total, which is what its
// predecessor bandChip(t) took right up until 2026-08-17. That signature was the
// last thing forcing a total to be computed on surfaces that only ever wanted to
// name a level, and every caller already had a level or could get one in one hop.
//
// THE NAME IS THE LABEL, the plain phrase is the gloss. Reversed 2026-08-12 —
// see BAND_PLAIN above. Roster rows previously printed "Steering a little" where
// the Composition organism inches away printed "Augmentation" for the same
// reading, which is two vocabularies for one scale.
//
// Renders quiet (.band-plain) — added 2026-07-29. A level is classification, not
// something to act on, and full chip chrome beside a real chip-attention signal in
// the same row buried the actual alert under a second, equally loud pill. See
// designsystem.md's chip-reservation rule. No pip: the label states the
// classification in full, so a colour-coded dot repeats a fact already on the page.
function levelChip(n, small) {
  if (!n) return `<span class="no-signal">—</span>`;
  return `<span class="band band-plain band-${n}"${small ? ' style="font-size:10px"' : ''}>${SAMR_NAMES[n - 1]}</span>`;
}

// The gloss on a level, SPOKEN TO THE TEACHER — rewritten 2026-08-17 to the
// voice the Movement findings settled on. These were third-person and abstract
// ("the student set the task and took what came back"), which reads as a
// definition of a category. A teacher is looking at their own room, so the
// sentence is about their students.
//
// Only renderComposition reads these, so this changes one surface's voice and
// nothing about the scale. The NAMES are untouched — named, never numbered.
const LEVEL_GLOSS = [
  'The AI did the thinking. Your students set the task and took back whatever came.',
  'The AI set the direction and your students improved what it handed them — the agency is in the reaction, not in the asking.',
  'Your students led. The AI worked to their brief, and the conversation went where they took it.',
  'Your students led and pushed back. They resisted where it mattered, and the thinking that survived is theirs.',
];

const DIM_KEYS  = ['pq', 'su', 'cs', 'oc'];
const DIM_NAMES = ['Prompting Quality', 'Selective Use', 'Calibrated Skepticism', 'Original Contribution'];
const BAND_MEANING = ["didn't happen", 'not where it counted', 'there, with gaps', 'held at the hard moments'];
const DIM_WHAT = [
  'Whether the student set the task or asked the AI what the task should be — who is directing the work.',
  'What the student did with what came back: worked on it as a draft, or took it as finished.',
  'Whether they checked what they were told, and whether they checked the claims that actually mattered.',
  'Whether the ideas in the essay are ones the transcript shows them building, rather than ones handed to them.',
];
const DIM_TRY = [
  'Have them write the brief before opening the chat. Stating the shape they want is a different act from asking what the shape should be.',
  'What comes back is a draft, not a delivery. Name the move out loud: take it, then say what is wrong with it before any of it gets used.',
  'The moment right after a source fails is when to check hardest — that is the habit to name out loud.',
  'Have them mark, in their own draft, the two sentences they would still have written if the chat had never happened.',
];

// ═══ BAR ATOMS — counts, the diverging bar, the tooltip, the findings ════════

// Level composition: counts across the four rungs, plus off-scale.
// levels + off === n, always — the invariant both charts rest on.
function levelComposition(cohort) {
  const levels = [0, 0, 0, 0];
  let off = 0;
  cohort.forEach(c => { if (c.level) levels[c.level - 1]++; else off++; });
  return { levels, off };
}

// Four partitions of the same cohort. Every student contributes exactly one
// band to every dimension, so bands + off === n on every row. Never add across.
function bandDistributions(cohort) {
  return DIM_KEYS.map((_, i) => {
    const bands = [0, 0, 0, 0];
    let off = 0;
    cohort.forEach(c => { const b = c.bands[i]; if (b) bands[b - 1]++; else off++; });
    return { bands, off };
  });
}

function sumArr(a) { return a.reduce((x, y) => x + y, 0); }

function renderCompHTML(counts, off) {
  const total = sumArr(counts) + off;
  const max = Math.max(...counts);
  const modal = counts.indexOf(max);
  const tie = counts.filter(c => c === max).length > 1;
  let html = '';
  counts.forEach((c, i) => {
    html += `<div class="comp-row comp-${i + 1}${i === modal && !tie ? ' is-modal' : ''}">
      <div class="viz-row-head"><span class="comp-name">${SAMR_NAMES[i]}</span><span class="comp-count">${c}</span></div>
      <div class="viz-plot"><span></span><span class="comp-track"><span class="comp-fill" style="width:${total ? (c / total * 100).toFixed(1) : 0}%"></span></span></div>
    </div>`;
  });
  html += `<div class="comp-off">
    <div class="viz-row-head"><span class="comp-name">Not enough evidence</span><span class="comp-count">${off}</span></div>
    <div class="viz-plot"><span></span><span class="comp-off-track"></span></div></div>`;
  return { html, modal, tie, max, total };
}

// No numeral reaches the teacher (Hard Constraints, 2026-08-16) — the generic
// descriptor IS the scale here, and the per-dimension sentence is carried by
// the flow legend inside the open row. The count in these strings is people.
function tipText(band, count, dim) {
  const m = BAND_MEANING[band - 1];
  return `<b>${m.charAt(0).toUpperCase()}${m.slice(1)}</b><br>${count} student${count === 1 ? '' : 's'} · ${dim}`;
}

function dbarRowLabel(dim, bands, off) {
  return `${dim}: ${bands.map((c, i) => `${c} ${BAND_MEANING[i]}`).join('; ')}. ${off} not enough evidence.`;
}

// One diverging bar, split at the 2|3 seam. EVERY ROW FILLS THE WHOLE TRACK —
// only the ratio between the segments changes from row to row. That is what
// makes the four dimensions comparable: the bar is a fixed measure of the same
// cohort, so a segment's share is read against the same total on every row and
// the seam's POSITION is the failure share directly.
//
// Sized by flex-grow, not by percentage width (changed 2026-08-14). Percentages
// were arithmetic that could fall short of the track: min-width floors on tiny
// segments, the 2px separators and the off-cell's break all came out of a total
// that had already been spent, so a row with several small bands ended before
// the track did. flex-grow distributes whatever the track actually is, so the
// ends align by construction rather than by the numbers happening to sum.
function dbarMarkup(bands, off, n, dim) {
  const lastBand  = bands[3] ? 4 : bands[2] ? 3 : bands[1] ? 2 : 1;
  const firstBand = bands[0] ? 1 : bands[1] ? 2 : bands[2] ? 3 : 4;
  const seg = (count, band) => {
    if (!count) return '';
    const cap = (band === firstBand ? ' cap-l' : '') + (band === lastBand && !off ? ' cap-r' : '');
    return `<span class="dbar-seg s${band}${cap}" style="flex:${count} 1 0"
      data-band="${band}" data-tip="${tipText(band, count, dim)}"><span class="dbar-num">${count}</span></span>`;
  };
  return `<div class="dbar" role="img" aria-label="${dbarRowLabel(dim, bands, off)}">
    <span class="dbar-gutter"><span class="dbar-out" data-band="1">${bands[0]}</span></span>
    <span class="dbar-track">
      ${seg(bands[0], 1)}${seg(bands[1], 2)}${seg(bands[2], 3)}${seg(bands[3], 4)}
      <span class="dbar-off-cell${off ? ' has-any' : ''}" style="flex:${off} 1 0"
        data-tip="<b>Not enough evidence</b><br>${off} student${off === 1 ? '' : 's'} with no reading here — nothing submitted on this draft, or a session too thin to code · ${dim}"></span>
      <span class="dbar-seam" style="left:${((bands[0] + bands[1]) / n * 100).toFixed(3)}%"></span>
    </span>
  </div>`;
}

// Measured after layout, never predicted from a px scale. Band 1's numeral
// moves to the outside gutter when its segment is too narrow — it is the one
// mark this instrument is required never to render least legibly.
function fitLabels(scope) {
  scope.querySelectorAll('.dbar').forEach(bar => {
    bar.querySelectorAll('.dbar-seg').forEach(s => {
      const tight = s.offsetWidth < 20;
      s.classList.toggle('is-tight', tight);
      const o = bar.querySelector(`.dbar-out[data-band="${s.dataset.band}"]`);
      if (o) o.classList.toggle('is-shown', tight);
    });
  });
}

// One tooltip node for the page, delegated. Hover, focus AND click — a
// hover-only decoder does not exist for touch or keyboard.
let tipEl = null, tipPinned = null;
function showTip(m) {
  tipEl.innerHTML = m.dataset.tip;
  tipEl.classList.add('is-on');
  const r = m.getBoundingClientRect(), w = tipEl.offsetWidth;
  tipEl.style.left = Math.min(window.innerWidth - w - 8, Math.max(8, r.left + r.width / 2 - w / 2)) + 'px';
  const above = r.top - tipEl.offsetHeight - 8;
  tipEl.style.top = (above < 8 ? r.bottom + 8 : above) + 'px';
}
function hideTip() { if (!tipPinned) tipEl.classList.remove('is-on'); }
function initTips() {
  if (tipEl) return;
  tipEl = document.createElement('div');
  tipEl.className = 'dbar-tip';
  document.body.appendChild(tipEl);
  document.addEventListener('mouseover', e => {
    const m = e.target.closest && e.target.closest('[data-tip]');
    if (m && !tipPinned) showTip(m);
  });
  document.addEventListener('mouseout', e => {
    if (e.target.closest && e.target.closest('[data-tip]')) hideTip();
  });
  document.addEventListener('focusin', e => {
    const m = e.target.closest && e.target.closest('[data-tip]');
    if (m) showTip(m);
  });
  document.addEventListener('focusout', () => { if (!tipPinned) hideTip(); });
  document.addEventListener('click', e => {
    const dot = e.target.closest && e.target.closest('.tip-trigger');
    if (tipPinned) {
      tipPinned.setAttribute('aria-expanded', 'false');
      const was = tipPinned; tipPinned = null;
      tipEl.classList.remove('is-on');
      if (was === dot) return;
    }
    if (!dot) return;
    tipPinned = dot;
    dot.setAttribute('aria-expanded', 'true');
    showTip(dot);
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && tipPinned) {
      tipPinned.setAttribute('aria-expanded', 'false');
      tipPinned = null;
      tipEl.classList.remove('is-on');
    }
  });
}

// Templated, never free-generated — a deterministic sentence built from the
// counts the bars already show, so the finding cannot claim what the evidence
// doesn't back. Returns the floor index too, so the headline and the row flag
// can never disagree.
function bandsFinding(rows, n) {
  const ranked = rows.map((r, i) => ({ i, lo: r.bands[0] + r.bands[1], off: r.off }))
    .sort((a, b) => b.lo - a.lo);
  const worst = ranked[0], next = ranked[1], best = ranked[ranked.length - 1];
  const gap = worst.lo - next.lo;
  const near = Math.max(2, Math.round(n * 0.08));

  if (best.lo > n * 0.6) {
    return { floorIdx: null, html: `<b>All four dimensions are at the floor.</b> Between ${best.lo} and ${worst.lo} of ${n} students sit in the two weakest bands on every one of them. There is no stronger dimension to lean on here — this is a finding about the room, not a dimension to teach into.` };
  }
  if (gap < near) {
    // "this week" was Home's word from when Home was the only caller. The
    // assignment tier is a task, not a period, so the scope word is gone
    // rather than made wrong on one of the two surfaces.
    return { floorIdx: null, html: `<b>No single floor here.</b> ${DIM_NAMES[worst.i]} and ${DIM_NAMES[next.i]} are the two lowest and ${gap === 0 ? 'are tied' : `are within ${gap} student${gap === 1 ? '' : 's'} of each other`}, so there is no one dimension to teach into ahead of the others.` };
  }
  const others = ranked.slice(1);
  const spread = others[0].lo - others[others.length - 1].lo;
  const majority = worst.lo > (n - worst.off) / 2;
  return { floorIdx: worst.i, html: `<b>${DIM_NAMES[worst.i]} is the floor.</b> ${worst.lo} of ${n} students sit in the two weakest bands — the behaviour either didn't happen, or didn't happen where it counted${majority ? ', and this is the only dimension where that is most of the room' : ''}. `
    + (spread <= near
        ? `The other three sit together, within ${spread} student${spread === 1 ? '' : 's'} of each other.`
        : `The other three are spread from ${others[others.length - 1].lo} to ${others[0].lo} students.`)
    + (worst.off >= Math.max(3, n * 0.1) ? ` It is also the hardest to read: ${worst.off} sessions gave it nothing to code.` : '') };
}

// The reading. Templated off the row's own counts, but its job is what the
// distribution CANNOT show, not a recount of it.
// `dimIdx` names the weakest band in that dimension's own words — "took it at
// face value" rather than "band 1" — because a band means something different
// in each of the four, and a numeral means nothing to a teacher at all.
// A split is a claim about two groups, so it needs two groups. Without this
// floor, 1 student on one side and 0 on the other satisfies "within 6%" and
// the tool announces a divided room to a teacher looking at one session.
function isSplit(bands) {
  const lo = bands[0] + bands[1], hi = bands[2] + bands[3], read = lo + hi;
  if (lo < 2 || hi < 2) return false;
  return Math.abs(lo - hi) <= Math.max(1, read * 0.06);
}

function dimNote(bands, off, n, dimIdx) {
  const lo = bands[0] + bands[1], hi = bands[2] + bands[3], read = lo + hi;
  const top = bands.indexOf(Math.max(...bands));
  // The label is quoted verbatim, never case-folded — lowercasing it turned
  // "The AI set the agenda throughout" into "the ai set the agenda throughout".
  const lbl = j => (DIM_BAND_LABELS[dimIdx] || [])[3 - j] || BAND_MEANING[j];
  let s;
  if (top === 0) {
    s = `<b>${bands[0]} students at the weakest band — ${lbl(0)}.</b> That is absence, not a weak attempt — there is nothing in those sessions to sharpen, so this is teaching the move from scratch rather than improving it.`;
  } else if (top === 1) {
    s = `<b>It happened, but not where it counted.</b> ${bands[1]} students sit one step up — ${lbl(1)}. They did the thing somewhere in the session, just not at the moments that mattered. A smaller gap, and a different lesson — timing, not the behaviour.`;
  } else if (isSplit(bands)) {
    s = `<b>The room is split.</b> ${lo} students sit in the two weakest bands and ${hi} in the two strongest, with no middle that describes either group. Teaching to the average here reaches neither.`;
  } else if (top === 3) {
    s = `<b>This one held.</b> ${bands[3]} students carried it even at the hard moments. Worth naming out loud — it is the habit the weaker dimensions can borrow from.`;
  } else {
    s = `<b>Mostly there, with real gaps.</b> ${bands[2]} students — ${lbl(2)} — so the behaviour is present but not yet dependable. ` + (bands[3] ? `${bands[3]} carried it through the hard moments.` : 'Nobody reached the strongest band.');
  }
  if (off >= Math.max(3, n * 0.12)) {
    s += ` <b>${off} sessions were too thin to read this at all</b>, so the bar above describes the ${read} it could be read on.`;
  }
  return s;
}

// The generic descriptors decode the ramp; the numeral is never printed. The
// seam mark sits where band 2 ends, which is the one position on the strip a
// teacher reads a threshold off.
function keyItem(b) {
  return `<span class="dbar-key-item"><i style="background:var(--tau-scale-${b})"></i>${BAND_MEANING[b - 1]}</span>`;
}

// Names BOTH causes. Since the distributions were aligned to the last closed
// draft (2026-08-16), this lane holds students who submitted nothing on that
// draft as well as students whose session was too thin to code — and the copy
// said only the second. Grouping the two is deliberate and already argued on
// Home's triage tiles: an overdue draft and an unreadable session are the same
// finding, "you cannot see this student", and route to the same conversation.
const OFF_NOTE = 'No reading here — either nothing was submitted on this draft, or the session was too thin to code. Never the same as the behaviour being absent.';

function bandKeyStrip() {
  return `<div class="dbar-key">
    ${[1, 2].map(keyItem).join('')}
    <span class="dbar-key-seam" aria-hidden="true"></span>
    ${[3, 4].map(keyItem).join('')}
    <button type="button" class="dbar-key-item off tip-trigger" aria-expanded="false"
      data-tip="<b>Not enough evidence</b><br>${OFF_NOTE}"><i></i><span>not enough evidence</span></button>
  </div>`;
}

// ═══ FLOW — the ribbon diagram, drawn from measured width ════════════════════

// First reading to last, per student — not a sum of per-transition moves. A
// student who drops and recovers is not two events, and counting them twice
// inflates both figures.
function flowMovement(paths) {
  let up = 0, back = 0, held = 0, unread = 0;
  for (const p of paths) {
    const a = p[0], b = p[p.length - 1];
    if (a === 4 || b === 4) { unread++; continue; }
    if (b < a) up++; else if (b > a) back++; else held++;
  }
  return { up, back, held, unread };
}

// Geometry is in CSS pixels and the SVG is drawn at 1:1 — never a viewBox
// scaled up by width:100%. A scaled viewBox magnifies the type along with the
// geometry, which is what made the first version read as an oversized
// infographic rather than a chart: 12px counts landing at 17px in a
// full-width card. Extra width now goes where it earns something — into the
// ribbons — while type, node width and plot height stay put at any size.
const FLOW_NODE = 6;      // thin: the ribbons are the data, nodes are anchors
const FLOW_GAP  = 14;
const FLOW_TOP  = 26;
const FLOW_PLOT = 176;    // wide-and-short reads as flow; tall reads as bars
const FLOW_MIN_W = 420;
// The off-ladder lane is set apart rather than spaced like a fifth rung.
const FLOW_OFF_GAP = 22;
// Control points at 0.35/0.65 rather than both at the midpoint. A midpoint
// pair gives one long lazy S; pulling them in flattens the middle so parallel
// ribbons read as bands instead of tangling.
const FLOW_TENSION = 0.35;

// Vertical position IS the scale — the strongest reading at the top, so a
// rising ribbon means more of the student's own thinking on every diagram in
// the product. Identity is carried by the legend, never by labels down both
// sides: two columns of names is the same text twice, and it squeezes the
// ribbons the chart exists for.
function flowSVG(paths, stageLabels, nodes, axisLabel) {
  const id = 'flow' + (FLOW_SEQ++);
  FLOW_PENDING.push({ id, paths, stageLabels, nodes, axisLabel });
  return `<div class="flow-wrap"><div class="flow-mount" id="${id}"></div></div>
    <div class="dbar-key flow-key">${nodes.map(nd => `<span class="dbar-key-item${nd.off ? ' off' : ''}">`
      + `<i${nd.off ? '' : ` style="background:${nd.fill}"`}></i>${nd.name}</span>`).join('')}</div>`;
}

let FLOW_SEQ = 0;
let FLOW_PENDING = [];

// Drawn after mount, from the measured width. Called again on resize — the
// layout is a fact about the rendered box, never a prediction from a constant,
// the same rule fitLabels() already follows for the band bars.
function drawFlow(el, { paths, stageLabels, nodes, axisLabel }) {
  const W = Math.max(FLOW_MIN_W, Math.round(el.clientWidth || FLOW_MIN_W));
  const nStage = stageLabels.length, total = paths.length;
  if (!total) return;

  const counts = stageLabels.map((_, s) => {
    const c = [0, 0, 0, 0, 0];
    paths.forEach(p => c[p[s]]++);
    return c;
  });

  const offIdx = nodes.findIndex(nd => nd.off);
  const gaps = FLOW_GAP * (nodes.length - 2) + FLOW_OFF_GAP;
  const avail = FLOW_PLOT - gaps, k = avail / total;
  const padL = 26, padR = 26, span = W - padL - padR - FLOW_NODE;
  const xs = counts.map((_, s) => padL + span * s / (nStage - 1));

  // Node heights carry a 2.5px floor so a single student is still visible, and
  // a floor adds height the `avail` budget did not allow for. So the canvas is
  // sized from where content actually landed, never from the budget — with
  // several small nodes the formula under-measures and the last lane is clipped.
  let maxY = 0;
  const cols = counts.map(cs => {
    let y = FLOW_TOP;
    const col = cs.map((c, i) => {
      const h = c > 0 ? Math.max(2.5, c * k) : 0;
      // Two cursors, not one. A middle column's node is a ribbon TARGET in the
      // transition arriving at it and a ribbon SOURCE in the transition leaving
      // it; sharing one cursor means the outgoing ribbons start from wherever
      // the incoming ones finished — the bottom of the node — and cascade off
      // the canvas. Fixed 2026-08-16 after it showed up as a clipped bottom lane.
      const o = { y, h, cin: y, cout: y };
      y += h + (i === offIdx - 1 ? FLOW_OFF_GAP : FLOW_GAP);
      return o;
    });
    const last = col[col.length - 1];
    maxY = Math.max(maxY, last.y + last.h);
    return col;
  });
  const bottom = Math.ceil(maxY + 8);

  let ribbons = '';
  for (let s = 0; s < nStage - 1; s++) {
    const tally = new Map();
    paths.forEach(p => {
      const key = p[s] + ':' + p[s + 1];
      tally.set(key, (tally.get(key) || 0) + 1);
    });
    [...tally.keys()].sort().forEach(key => {
      const [fr, to] = key.split(':').map(Number), cnt = tally.get(key);
      const src = nodes[fr], dst = nodes[to];
      const h = cnt * k, x1 = xs[s] + FLOW_NODE, x2 = xs[s + 1];
      const c1 = x1 + (x2 - x1) * FLOW_TENSION, c2 = x2 - (x2 - x1) * FLOW_TENSION;
      const a = cols[s][fr].cout, b = cols[s + 1][to].cin;
      cols[s][fr].cout += h; cols[s + 1][to].cin += h;
      // Off-scale in or out is neither up nor back: there is no prior reading
      // to compare against, and folding it into "held" is the same error as
      // scoring a thin session band 1.
      const dir = (fr === offIdx || to === offIdx) ? 'not comparable'
        : to < fr ? 'moved up' : to > fr ? 'moved back' : 'stayed';
      ribbons += `<path class="flow-rib" d="M${x1},${a} C${c1},${a} ${c2},${b} ${x2},${b}`
        + ` L${x2},${b + h} C${c2},${b + h} ${c1},${a + h} ${x1},${a + h} Z"`
        + ` fill="${src.off ? 'var(--tau-line-strong)' : src.fill}">`
        + `<title>${cnt} student${cnt !== 1 ? 's' : ''} — ${src.name} → ${dst.name} (${dir}),`
        + ` ${stageLabels[s]} to ${stageLabels[s + 1]}</title></path>`;
    });
  }

  // Counts at the two ends only. A number on every mark is what makes a flow
  // read as busy, and the middle columns are the least-read figures on it —
  // selective direct labels, per the dataviz mark spec.
  let bars = '', nums = '';
  counts.forEach((cs, s) => cs.forEach((c, i) => {
    if (!c) return;
    const g = cols[s][i], nd = nodes[i];
    bars += `<rect x="${xs[s]}" y="${g.y}" width="${FLOW_NODE}" height="${g.h}" rx="1.5"`
      + ` fill="${nd.off ? 'var(--tau-surface-2)' : nd.fill}"`
      + (nd.off ? ' stroke="var(--tau-line-strong)" stroke-width="1"' : '') + '/>';
    const mid = g.y + g.h / 2 + 3.5;
    if (s === 0) nums += `<text class="flow-n" x="${xs[s] - 7}" y="${mid}" text-anchor="end">${c}</text>`;
    else if (s === nStage - 1) nums += `<text class="flow-n" x="${xs[s] + FLOW_NODE + 7}" y="${mid}">${c}</text>`;
  }));

  const heads = stageLabels.map((t, s) => {
    const anchor = s === 0 ? 'start' : s === nStage - 1 ? 'end' : 'middle';
    const x = s === 0 ? xs[s] : s === nStage - 1 ? xs[s] + FLOW_NODE : xs[s] + FLOW_NODE / 2;
    return `<text class="flow-when" x="${x}" y="12" text-anchor="${anchor}">${t}</text>`;
  }).join('');

  el.innerHTML = `<svg class="flow-svg" width="${W}" height="${bottom}" viewBox="0 0 ${W} ${bottom}" role="img"
      aria-label="Students moving between ${nodes.map(nd => nd.name).join(', ')} from ${stageLabels[0]} to ${stageLabels[nStage - 1]}. Higher is more student agency.">
      ${heads}<g>${ribbons}</g><g>${bars}</g><g>${nums}</g></svg>`;
}

function mountFlows(root) {
  const pending = FLOW_PENDING;
  FLOW_PENDING = [];
  pending.forEach(cfg => {
    const el = (root || document).querySelector('#' + cfg.id);
    if (!el) return;
    el.__flow = cfg;
    drawFlow(el, cfg);
  });
}

function redrawFlows(root) {
  (root || document).querySelectorAll('.flow-mount').forEach(el => {
    if (el.__flow) drawFlow(el, el.__flow);
  });
}

const FLOW_LEVEL_NODES = [
  { name: 'Redefinition', fill: 'var(--tau-scale-4)' },
  { name: 'Modification', fill: 'var(--tau-scale-3)' },
  { name: 'Augmentation', fill: 'var(--tau-scale-2)' },
  { name: 'Substitution', fill: 'var(--tau-scale-1)' },
  { name: 'Not enough evidence', off: true },
];

// Band labels are per dimension, because a band means something different in
// each: "not where it counted" is the wrong claims for Calibrated Skepticism
// and the wrong edits for Selective Use. The generic descriptors are the
// scale, not the label, and a teacher never sees the numeral.
const DIM_BAND_LABELS = [
  ['Set the direction and held it', 'Led most of it, handed over at the hard parts',
   'Steered on details, never on direction', 'The AI set the agenda throughout'],
  ['Reshaped the work, not just the sentences', 'Changed what it said, not how it was built',
   'Changed the wording, not the substance', "Kept the AI's draft as it came"],
  ['Questioned what the work rested on', 'Questioned often, let key claims through',
   'Questioned small things only', 'Took it at face value'],
  ['The frame and the argument are theirs', "Their own argument, the AI's structure",
   "Their own examples on the AI's frame", "The ideas are the AI's"],
];

function dimFlowNodes(i) {
  return DIM_BAND_LABELS[i].map((name, j) => ({ name, fill: `var(--tau-scale-${4 - j})` }))
    .concat([{ name: 'Not enough evidence', off: true }]);
}

// ═══ COMPOSITION — a cohort's levels ═════════════════════════════════════════

// ── COMPOSITION — the organism ───────────────────────────────────────────────
//
// A cohort's levels, with its trend behind a disclosure. ONE chart under the
// block, not one per row: there are four dimension flows because there are four
// dimensions, but only one agency flow, so the disclosure sits on the block
// rather than on each level.
//
// The composition form (four named bars) is deliberately NOT the diverging
// stacked bar the dimensions use. Making the level a fifth row of that panel
// would assert it is a peer of the four, and it is not — the four are facets of
// one construct, the level is a reading of the whole session. Different claim,
// different instrument. Both still partition the same 24 students on the same
// track grid (components.css, "THE SHARED CHART GRID"), so a length means the
// same count in both.
//
// TAKES A COHORT, NOT AN ASSIGNMENT — 2026-08-17, so it matches renderBandSection's
// shape and any surface that can name a cohort can mount it. The assignment
// adapter below is the only caller today; the student tier is the one that needs
// this seam, since a cohort flow degenerates at n=1 and its own movement has to
// be drawn some other way.
//
// IT NEVER ASSUMES MOVEMENT. `flow` is optional and there is no disclosure at all
// unless the caller hands in either a flow or the note explaining its absence —
// a scope with no sequence renders the bars alone rather than an empty drawer.
function renderComposition(cohort, opts) {
  const { label, flow = null, noFlowNote = null } = opts;
  const n = cohort.length;
  const { levels, off } = levelComposition(cohort);
  const read = n - off;
  if (!read) {
    return `<div class="agg-block-lbl">${label}</div>
      <p class="agg-sample-note">No completed sessions to read yet.</p>`;
  }
  const comp = renderCompHTML(levels, off);
  const mv = flow ? flowMovement(flow.paths) : null;

  // "Most read at X" IS A DISTRIBUTION CLAIM and needs a cohort that can support
  // one. The floor is the same two-per-group floor isSplit() already applies, for
  // the same reason recorded there: one student on one side satisfies every
  // proportional test and the tool announces a finding about a room to a teacher
  // looking at a single session. Below it, state the denominator instead — the
  // bars still render, because a count of one is honest as a bar and dishonest as
  // a headline. Caught 2026-08-17 mounting this on a draft slot, where "1 read of
  // 5" printed "Most read at Modification."
  //
  // The no-plurality copy is scope-neutral: this organism now renders at a draft
  // slot as well as an assignment, and it said "nobody who sat this assignment."
  // FOUR STATES, and the first two are different findings that must not share a
  // sentence — "we cannot see enough" and "we looked and there is no group" route
  // a teacher to different actions (chase the submissions, or teach the spread).
  // designsystem.md: "An empty state distinguishes 'we cannot see it' from 'we
  // looked and there is nothing.'"
  //
  // The floor is the same two-per-group floor isSplit() applies, for the reason
  // recorded there: one student on one side satisfies every proportional test and
  // the tool announces a finding about a room to a teacher looking at a single
  // session. Caught 2026-08-17 mounting this on a draft slot — "1 read of 5"
  // printed "Most read at Modification" — and it was live on the assignment card
  // too, on any task most of a class had not finished.
  // THE SAME SHAPE AS THE MOVEMENT FINDING — .trend-lede, a bold lead and a
  // conversational continuation, carried over 2026-08-17. It was .viz-lede: a
  // 13px block behind a grey left rule, which is a container device, and this
  // sentence introduces the bars directly underneath it rather than standing
  // apart from them.
  const bars = `<div class="trend-lede">${
    read < 2
      ? `<b>Not enough to go on.</b> ${read} of ${n} student${n === 1 ? '' : 's'} ${read === 1 ? 'has' : 'have'} a readable session here, so the bars below are ${read === 1 ? 'that one student' : 'those students'} — not the room.`
      : comp.max < 2
        ? `<b>No two students worked the same way.</b> All ${read} readable sessions sit at a different level, so there is no group here to teach to — take them one at a time.`
        : comp.tie
          ? `<b>The room is split.</b> No level held a plurality, and an average of the two groups would describe nobody in either.`
          : `<b>Most of your students landed at ${SAMR_NAMES[comp.modal]}.</b> ${LEVEL_GLOSS[comp.modal]}`}</div>`;

  // The summary NAMES the draft it reads. Without it "20 read of 22" is a
  // count with no stated scope, and the two students it excludes are excluded
  // for a reason a teacher cannot see.
  const head = `<div class="section-head">
      <div class="agg-block-lbl" style="margin:0">${label}</div>
      <div class="section-summary">${read} read of ${n}</div>
    </div>`;

  if (!flow && !noFlowNote) return `${head}${bars}${comp.html}`;

  return `${head}${bars}
    <details class="dist-row trend-block">
      <summary class="dist-summary">
        ${comp.html}
        <div class="trend-cue"><span class="dist-row-go">▾</span>${flow
          ? `How the class got here — ${mv.up} moved up, ${mv.back} moved back`
          : 'How the class got here'}</div>
      </summary>
      <div class="dist-row-detail">
        ${flow
          ? `${flowSVG(flow.paths, flow.labels, FLOW_LEVEL_NODES, 'more agency')}
             <p class="viz-card-foot">These levels describe <b>agency</b> — how much of the thinking
               stayed the student's — not task transformation as SAMR was published.</p>`
          : `<p class="dist-what" style="margin:0">${noFlowNote}</p>`}
      </div>
    </details>`;
}

// ═══ DISTRIBUTION — a cohort's four dimension bands ══════════════════════════

// The dimension section. ONE function behind every assignment surface —
// Assignment Detail's own card, Browse Assignments' drill row, and Class View's
// per-assignment card — for the same reason renderAssignmentAggregateContent()
// has always been one function: two independently-maintained versions of "how
// did this assignment go" is the failure this shape exists to prevent.
//
// `flowFor` is what separates the two callers. The assignment scope passes the
// draft flow; a single draft passes nothing, because a slot has no interior
// axis to move along.
function renderBandSection(cohort, opts) {
  const { label, summary, lede, flowFor = () => null } = opts;
  const n = cohort.length;
  const readable = cohort.filter(c => c.bands.some(b => b)).length;

  if (!readable) {
    return `<div class="agg-block-lbl">${label}</div>
      <p class="agg-sample-note">No completed sessions to read yet.</p>`;
  }

  const rows = bandDistributions(cohort);
  const finding = bandsFinding(rows, n);

  const dimRows = rows.map((r, i) => {
    const flow = flowFor(i);
    const mv = flow ? flowMovement(flow.paths) : null;
    return `<details class="dist-row${i === finding.floorIdx ? ' is-floor' : ''}">
      <summary class="dist-summary">
        <div class="viz-row-head">
          <span class="dist-row-name">${DIM_NAMES[i]}</span>
          <span class="dist-row-go">▾</span>
        </div>
        ${dbarMarkup(r.bands, r.off, n, DIM_NAMES[i])}
      </summary>
      <div class="dist-row-detail">
        <p class="dist-what">${DIM_WHAT[i]}</p>
        <p class="pattern-body">${dimNote(r.bands, r.off, n, i)}</p>
        ${flow ? `<div class="agg-block-lbl">Across the ${flow.labels.length} closed drafts</div>
        <p class="pattern-body"><b>${mv.up}</b> moved up, <b>${mv.back}</b> moved back,
          ${mv.held} held${mv.unread ? `, ${mv.unread} can't be compared` : ''}.</p>
        ${flowSVG(flow.paths, flow.labels, dimFlowNodes(i), 'stronger')}` : ''}
        <div class="pattern-try"><b>What to try:</b> ${DIM_TRY[i]}</div>
      </div>
    </details>`;
  }).join('');

  return `<div class="section-head">
      <div class="head-with-info">
        <div class="agg-block-lbl" style="margin:0">${label}</div>
        <button class="info-dot tip-trigger" type="button" aria-expanded="false"
          aria-label="How to read the dimension bands"
          data-tip="<b>How to read these</b><br>Every student sits in exactly one band per dimension on this task, so each row counts the same students — which is why every bar is the same length. The tick marks where the weaker two bands end.<br><br>The four are measured in different units, so they are read side by side and never added together.">i</button>
      </div>
      <div class="section-summary">${summary}</div>
    </div>
    ${lede}
    <div class="dist-panel">${dimRows}</div>
    ${bandKeyStrip()}`;
}

// ═══ MOVEMENT — one room across a sequence ═══════════════════════════════════

// Which reading each mounted Movement organism is showing — agency, or one of
// the four dimensions. Keyed by SCOPE STRING ('home', 'class:<id>'), not by class
// id: that is what lets Home and a class tab hold independent selections in one
// map without the organism knowing which surface it is on. Undefined falls back
// to the first entry, which is agency — the question every one of these mounts
// exists to answer first.
let flowMetric = {};

// Five states, derived from movement counts rather than from a mean. Floor and
// ceiling stay distinct: the same "flat" is a Monday lesson at the floor and a
// non-issue at the ceiling, and conflating them was a corrected mistake once
// already.
//
// IT IS PROSE NOW, NEVER A PILL — restored 2026-08-17, hours after the coloured
// state chip was deleted, and the two are not the same thing coming back. On the
// tab it was a colour-coded word competing with the ribbons for the same fact.
// In the lede it is the subject of the sentence the counts then evidence: state
// first, then who moved. That is the order every other finding in this file
// follows (bandsFinding, dimNote, traceFinding all lead with the claim).
function flowState(paths, mv) {
  const last = paths.map(p => p[p.length - 1]).filter(v => v !== 4);
  if (!last.length) return { key: 'none', label: 'Not enough evidence' };
  const lowMass = last.filter(v => v >= 2).length / last.length;   // index 2,3 = bands 2,1
  const topMass = last.filter(v => v === 0).length / last.length;
  if (mv.up > mv.back) return { key: 'up', label: 'Improving' };
  if (mv.back > mv.up) return { key: 'down', label: 'Declining' };
  if (lowMass > 0.5) return { key: 'floor', label: 'Flat — at the floor' };
  if (topMass > 0.5) return { key: 'flat', label: 'Flat — at the ceiling' };
  return { key: 'flat', label: 'Flat' };
}

// ── THE TREND FINDING ────────────────────────────────────────────────────────
//
// Settled in the lab 2026-08-17, against two candidates rendered side by side.
//
// WHAT IT SAYS, in order: a state word, then what that means for the people in
// the room, then — in the tool's own blue block — what to do about it.
//
//   Declining. More of your students are asking the AI what the task should be
//   instead of setting it themselves than were.
//   What to try: Have them write the brief before opening the chat…
//
// FOUR RULES IT FOLLOWS, each one a correction:
//
// 1. NO COUNTS. "6 moved up, 7 moved back" is the diagram read aloud — the
//    ribbons are those numbers at their real widths. The sentence states the one
//    thing a shape cannot state about itself.
// 2. NO DIMENSION NAME. The tab directly above says it. Repeating it turns a
//    sentence addressed to a teacher into a label on a row; "this one" is the
//    right reference because they just clicked the thing.
// 3. NO COLOUR ON THE STATE. The system would permit it (designsystem.md:125,
//    a word plus a colour), but green-up/red-down grades a room on whether it
//    improved, which is the judgement designsystem.md:54 already forbids on the
//    ribbons. A sentence directly above them cannot make a claim the chart is
//    barred from making. "Rising", not "improving", for the same reason.
// 4. THE ACTION ANSWERS THE STATE. It used to be DIM_TRY regardless — the same
//    sentence whether a dimension was climbing or collapsing, which is what made
//    the finding and the advice read as two unrelated blocks. A rise wants the
//    habit NAMED, not taught; a floor wants it taught FROM SCRATCH; a ceiling
//    wants nothing, so it gets no block rather than one that refuses its label.

// Bare verb phrases: the sentence supplies the subject ("More of your students
// are ___"). Baking "students are" into these printed it twice.
const DIM_DRIFT = [
  'asking the AI what the task should be instead of setting it themselves',
  "taking the AI's draft as it comes",
  'letting the claims that matter go unchecked',
  'handing the thinking in their essays over to the AI',
];
const DIM_GAIN = [
  'setting the brief before they open the chat',
  'treating what comes back as a draft to work on',
  'checking the claims that carry the argument',
  'building the argument in their essays themselves',
];

const STATE_WORD = {
  up:    'Rising.',
  down:  'Declining.',
  floor: 'Staying flat, at the bottom.',
  flat:  'Staying flat.',
  none:  'Not enough to read yet.',
};
function stateWord(st) {
  return st.label === 'Flat — at the ceiling' ? 'Staying flat, at the top.' : STATE_WORD[st.key];
}

// A SPAN, SPOKEN TO THE TEACHER. Two sentences: what happened, then the detail
// that carries it, both naming the ends of the sequence — "at Draft 1 … by
// Final", "back in Jul … now".
//
// NO STATE LABEL IN FRONT. "Declining." / "Staying flat." was a word the reader
// then had to translate into a fact about their room, and it made the sentence
// after it read as a footnote to a label. The direction is in the sentence
// already — "handed more of the thinking over" cannot be misread as a rise — so
// the label was a heading on a paragraph of one idea. This block is the only
// place the tool gets to say what happened in its own words; a label spends
// that on a category name.
//
// The endpoint names come from the flow's own stage labels, so ONE template
// serves every axis: Home says "back in Jul", a class says "at Rhetoric", an
// assignment says "at Draft 1". Forking copy per axis is two vocabularies for
// one claim.
function ends(labels) {
  const a = labels && labels.length > 1 ? labels[0] : null;
  const b = labels && labels.length > 1 ? labels[labels.length - 1] : null;
  return { first: a ? `at ${a}` : 'at the start', last: b ? `by ${b}` : 'by the end' };
}

function dimensionCopy(i, st, unit, labels) {
  const { first, last } = ends(labels);
  switch (st.key) {
    case 'up': return {
      state: 'This one moved your way.',
      means: `More of your students were ${DIM_GAIN[i]} ${last} than ${first}.`,
      act: 'Tell them what changed, in as many words. A habit they can name is one they can keep — one they fell into is one they can fall back out of.' };
    case 'down': return {
      state: 'This one went the wrong way.',
      means: `More of your students were ${DIM_DRIFT[i]} ${last} than ${first}.`,
      act: DIM_TRY[i] };
    case 'floor': return {
      state: 'This one never got going.',
      means: `Your students were ${DIM_DRIFT[i]} ${first}, and they still were ${last}.`,
      act: `${DIM_TRY[i]} You are teaching this from scratch, not sharpening something they already do.` };
    case 'none': return {
      state: 'There is not enough here to compare yet.',
      means: 'You need two readings of the same student before this can say anything.', act: null };
    default: return st.label === 'Flat — at the ceiling' ? {
      state: 'This one was never the problem.',
      means: `It was already the strongest of the four ${first}, and your students held it there ${last} — it is the habit the weaker three can borrow from.`,
      act: null } : {
      state: 'Nothing shifted here.',
      means: `Your students ended ${last} where they were ${first} — whatever changed between them did not change how the work was done.`,
      act: DIM_TRY[i] };
  }
}

// AGENCY NEVER CARRIES AN ACTION, on any state. There is no single move that
// raises a level — that is what a level is — so a "what to try" under this chart
// would have to invent one. The four dimensions are where the moves live.
function agencyCopy(st, unit, labels) {
  const { first, last } = ends(labels);
  switch (st.key) {
    case 'up': return {
      state: 'Your students took more of the thinking back.',
      means: `More of them were holding onto it ${last} than ${first}.`, act: null };
    case 'down': return {
      state: 'Your students handed more of the thinking over.',
      means: `More of them were taking what the AI gave them ${last} than ${first}.`, act: null };
    case 'floor': return {
      state: 'The thinking stayed with the AI throughout.',
      means: `Most of your students were taking what it gave them ${first}, and they still were ${last}.`, act: null };
    case 'none': return {
      state: 'There is not enough here to compare yet.',
      means: 'You need two readings of the same student before this can say anything.', act: null };
    default: return st.label === 'Flat — at the ceiling' ? {
      state: 'Your students led this from the start.',
      means: `Most were already directing the work ${first}, and they held there ${last}.`, act: null } : {
      state: 'Nothing shifted here.',
      means: `Your students ended ${last} where they were ${first} — whatever changed between them did not change how the work was done.`, act: null };
  }
}

// The axis is the ONLY thing that differs between the rooms Movement mounts in,
// which is why it is a parameter and not a second component. `note` says why
// this axis is legitimate on this surface.
const FLOW_AXIS_TIME = {
  unit: 'period',
  note: 'The periods are dates, not assignments — your classes are working on different things, so only a student against themselves is a fair comparison.',
  empty: 'Movement needs two readings of the same student. There are not two yet.',
};

const FLOW_AXIS_ASSIGNMENT = {
  unit: 'assignment',
  note: 'The columns are assignments, which only works because everyone in this class did the same ones — a comparison the whole-fleet view on Home cannot make.',
  empty: 'Movement needs two closed assignments to compare. This class does not have two yet.',
};

// The draft axis, and the strongest of the three: every student did the same
// Draft 1 and the same Final, so a column is a fair comparison by construction
// rather than by argument.
const FLOW_AXIS_DRAFT = {
  unit: 'draft',
  note: "The columns are this assignment's closed drafts — the same work for every student, which is why the columns can be compared at all.",
  empty: 'Movement needs two closed drafts to compare. This assignment does not have two.',
};

// ── MOVEMENT — the organism ──────────────────────────────────────────────────
//
// One selector, one chart, one state key, mounted anywhere the scope is a ROOM.
//
// GENERALISED 2026-08-17, and the coupling it removes is the whole reason Home
// had a second Movement UI. This wrote its state through setClassTrendMetric(cid,
// …), so a surface with no class id could not call it; Home grew its own pair of
// renderers instead — an always-open agency chart stacked on four collapsed
// dimension rows — and the two carried verbatim copies of the same sentences.
// The scope is now a STRING ('home', 'class:<id>'), which is the only thing that
// stood between one component and two.
//
// IT NEVER ASSUMES ITS SIBLING. It is handed flows and renders them; it knows
// nothing about a composition or a band panel above it, because on both surfaces
// it currently mounts on, there isn't one.
//
// Added 2026-08-16 for the class Trends tab, which was a full-height agency
// chart stacked on four collapsed dimension rows — roughly 520px for a tab
// whose question is singular. Home's own rule already said so: "four flows
// always visible would be four charts to compare, and only one is ever the
// question." A selector is that rule applied to the whole tab rather than to
// four rows inside half of it.
//
// THIS REVERSES THE CHIP DELETION EARLIER THE SAME DAY, and the reversal is not
// drift. The chips were deleted because of what they selected BETWEEN — five
// line charts of means, where the chip existed to ration a form that shouldn't
// have been on the page. Selecting between five flow diagrams is a different
// act: each is a legitimate chart, only one is ever being asked about, and each
// needs the full card width to be readable.
//
// THE STATE WORD RIDES ON THE CHIP, which is what makes this a condensation
// rather than a loss. The four collapsed rows carried one genuinely comparable
// reading — which dimensions moved — and hiding four charts behind an unlabelled
// selector would throw it away. On the chip, all five states are legible at once
// and the chart answers the one the teacher picks.
// The five readings, built once. Agency first, then PQ/SU/CS/OC in the canonical
// order so a reading's position on the strip is learnable rather than reshuffling
// by whichever moved most. Home and the class tab now differ only in the flows
// they hand in — calendar buckets against closed assignments — where before they
// each carried their own copy of these sentences.
//
// `try` rides along because Home's collapsed rows had it and the chip strip that
// replaces them must not lose it: the state word says whether the room moved, the
// chart says who, and this says what to do about it. Agency has none — there is
// no single move that raises a level, which is the point of the level.
// The two halves are separately callable, because Home mounts them as two
// charts and the class tab still mounts them as one strip. Splitting the
// BUILDER rather than slicing its output by index means neither caller has to
// know that agency happens to be first.
function agencyEntries(levelFlow) {
  return [{
    key: 'agency', label: 'Agency', flow: levelFlow, nodes: FLOW_LEVEL_NODES,
    foot: `These levels describe <b>agency</b> — how much of the thinking stayed the student's —
           not task transformation as SAMR was published.`,
    copy: (st, unit, labels) => agencyCopy(st, unit, labels),
  }];
}

function dimensionEntries(dimFlows) {
  return dimFlows.map((flow, i) => ({
    key: DIM_KEYS[i],
    label: DIM_NAMES[i],
    flow,
    nodes: dimFlowNodes(i),
    copy: (st, unit, labels) => dimensionCopy(i, st, unit, labels),
  }));
}

// One strip of all five. Still what the class tab mounts.
function movementEntries(levelFlow, dimFlows) {
  return agencyEntries(levelFlow).concat(dimensionEntries(dimFlows));
}

// SPLIT INTO TWO MOUNTS ON HOME — 2026-08-17, and it is not a return to the
// shape the 2026-08-17 merge deleted. That one was an always-open agency chart
// stacked on FOUR COLLAPSED ROWS, which hid four of five readings behind
// disclosures. This is two charts, each with its own selector or none: agency
// alone, and the four dimensions behind tabs.
//
// The argument for it is the one already load-bearing elsewhere in this file —
// a level is a reading of the WHOLE session and the four dimensions are facets
// of one construct, so a level is not their peer. It is the same reason
// Composition is not a fifth row of the band panel, and putting agency in a
// selector with PQ/SU/CS/OC asserted a peerage the measurement model denies.
//
// `title` names the group; with ONE entry there is no chip strip, because a
// selector offering one choice is not a selector. The tooltip's sentence about
// the state words then has nothing to describe, so it goes with them.
function renderMovement(scope, entries, summary, axis, opts = {}) {
  const { title = 'Movement' } = opts;
  const showTabs = entries.length > 1;
  const active = entries.find(e => e.key === flowMetric[scope]) || entries[0];

  // TABS, AND NO STATE WORD ON THEM — 2026-08-17, replacing four boxed
  // .trend-chips that each carried "Improving" / "At the floor" underneath the
  // name.
  //
  // THE STATE WORD IS GONE RATHER THAN MOVED. It was a third telling of one
  // fact: the ribbons show the direction, the lede counts it, and a coloured
  // word asserted it a third time. It survived this long on an argument that
  // has since expired — the chip carried it because ONE strip stood in for five
  // readings and the word was what made hiding four of them a condensation
  // rather than a loss. Agency now has its own always-visible chart, so the
  // four that remain are facets of one construct, read one at a time by choice.
  //
  // .card-tab, not a selector of its own. A chart's selector must not compete
  // with the chart, and tabs are the quietest control this system has; the
  // boxed chips read as four objects stacked above the one that matters.
  const tabs = !showTabs ? '' : entries.map(e => `<button type="button" role="tab"
      class="card-tab${e.key === active.key ? ' active' : ''}"
      aria-selected="${e.key === active.key}"
      onclick="event.stopPropagation();setFlowMetric('${scope}','${e.key}')">${e.label}</button>`).join('');

  const flow = active.flow;
  const mv = flow ? flowMovement(flow.paths) : null;

  return `<div class="section-head">
      <div class="head-with-info">
        <div class="eyebrow">${title}</div>
        <button class="info-dot tip-trigger" type="button" aria-expanded="false"
          aria-label="How to read ${title.toLowerCase()}"
          data-tip="<b>How to read this</b><br>Each column counts every student once, at their latest reading in that ${axis.unit}. A ribbon is a group of students carried from one ${axis.unit} to the next, so a rising ribbon is students holding onto more of their own thinking.<br><br>${axis.note}${showTabs ? '<br><br>One at a time: the four are measured in different units, so they are read side by side and never added together.' : ''}">i</button>
      </div>
      <div class="section-summary">${summary}</div>
    </div>
    ${showTabs ? `<div class="card-tabs" role="tablist" aria-label="Choose a reading">${tabs}</div>` : ''}
    ${flow ? (() => {
      const c = active.copy(flowState(flow.paths, mv), axis.unit, flow.labels);
      return `<div class="trend-lede"><b>${c.state}</b> ${c.means}</div>
    ${c.act ? `<div class="pattern-try"><b>What to try:</b> ${c.act}</div>` : ''}`;
    })() + `
    <div class="viz-card">
      ${flowSVG(flow.paths, flow.labels, active.nodes, 'stronger')}
      ${flow.caption ? `<p class="viz-card-foot">${flow.caption}</p>` : ''}
      ${active.foot ? `<p class="viz-card-foot">${active.foot}</p>` : ''}
    </div>`
    : `<div class="viz-card"><p class="dist-what" style="margin:0">${axis.empty}</p></div>`}`;
}

// ═══ TRACE — one student across a sequence ═══════════════════════════════════

// ── TRACE — one student across a sequence ────────────────────────────────────
//
// The fourth mark, added 2026-08-17, and it exists because BOTH cohort marks lose
// their only variable channel at n=1. A flow encodes a count as ribbon width, so
// one student is four ribbons of width 1. A distribution encodes a count as segment
// length, so one student is one full-width segment per row. Neither is a chart of
// anything at that size. What survives is POSITION ACROSS A SEQUENCE, which is
// neither of them — hence a fourth mark rather than a third instance.
//
// It is still built from Distribution's atom, which is what designsystem.md's
// constraint asks for ("band bars per draft, never Movement"): each cell is the
// discrete 4-step band reading, on a draft axis.
//
// THE FINDING LEADS AND THE MARK SUPPORTS IT. A bare 4×N grid asks the teacher to
// find the story in twelve cells; what they need first is which of the four is
// worth the conversation, and that is case-dependent — a drop is a different
// conversation from a floor, and a floor is a different one from a ceiling. So this
// is `bandsFinding()`'s shape at n=1: one lead sentence, plus the index of the row
// it is about, which the grid then emphasises with the same `.is-floor` device the
// band panel uses.
//
// WHY NOT A LINE, since this is one subject over time and a line is the obvious
// reach: a line asserts a rate through the gap between two drafts and nothing was
// measured in that gap. Every cell here is a reading that happened.

// Ordinal, never a delta — the unit teacher-dashboard-design.md already specifies
// for a student ("dropped a band across drafts: an ordinal move, not a delta").
// Reads first-to-last across the READABLE stages only, so an unreadable draft in
// the middle doesn't register as a fall and a recovery.
function traceMove(cells) {
  const read = cells.map((b, i) => ({ b, i })).filter(c => c.b);
  if (read.length < 2) return { dir: 0, from: null, to: null, fromIdx: null, toIdx: null, read: read.length };
  const first = read[0], last = read[read.length - 1];
  return { dir: last.b - first.b, from: first.b, to: last.b,
           fromIdx: first.i, toIdx: last.i, read: read.length };
}

// QUOTED VERBATIM, NEVER CASE-FOLDED. dimNote() carries the same warning because
// the same mistake was made there first: lowercasing turned "The AI set the agenda
// throughout" into "the ai set the agenda throughout". Every sentence below is
// built so the label can sit unmodified — set off by an em dash, not spliced into
// the middle of a clause where its capital would need flattening.
function bandLabel(dimIdx, band) {
  return (DIM_BAND_LABELS[dimIdx] || [])[4 - band] || BAND_MEANING[band - 1];
}

// Which of the four leads, and what it says. The ranking is not a preference —
// each rung is a rule already settled elsewhere:
//   1. A DROP outranks everything. It is the one per-student trend input the triage
//      spec keeps ("dropped a band across drafts"), and a fall from band 3 is a
//      conversation even though band 2 alone might not be.
//   2. BAND 1 ON THE LATEST READING is absolute — "the behaviour is absent, not
//      weak" — and outranks any rise elsewhere.
//   3. A RISE leads only when nothing dropped and nothing is at the floor, because
//      leading with good news over a floor buries the actionable half.
//   4. FLAT AT THE FLOOR and FLAT AT THE CEILING stay distinct. Conflating them is
//      a mistake this file made once already (see flowState) — the same "held" is a
//      Monday lesson at the floor and a non-issue at the ceiling.
// Ties break on the canonical PQ/SU/CS/OC order, so the same trace always leads
// with the same dimension rather than reshuffling between renders.
function traceFinding(moves, stageNames) {
  const at = i => stageNames[i] || 'the last draft';

  const drops = moves.map((m, i) => ({ m, i })).filter(x => x.m.dir < 0)
    .sort((a, b) => a.m.dir - b.m.dir);
  if (drops.length) {
    const { m, i } = drops[0];
    const n = Math.abs(m.dir);
    return { focusIdx: i, key: 'down', lead: `<b>${DIM_NAMES[i]} dropped ${n === 1 ? 'a band' : `${n} bands`}
      between ${at(m.fromIdx)} and ${at(m.toIdx)}.</b> It now reads —
      ${bandLabel(i, m.to)}${drops.length > 1
        ? `. It is not the only one: ${drops.length - 1} other dimension${drops.length > 2 ? 's' : ''} fell too` : ''}.` };
  }

  const floors = moves.map((m, i) => ({ m, i })).filter(x => x.m.to === 1);
  if (floors.length) {
    const { m, i } = floors[0];
    return { focusIdx: i, key: 'floor', lead: `<b>${DIM_NAMES[i]} is at the floor —
      ${bandLabel(i, 1)}.</b>
      ${m.read > 1 && m.from === 1 ? `It has read that way since ${at(m.fromIdx)}.` : `It landed there by ${at(m.toIdx)}.`}
      ${floors.length > 1
        ? `${floors.length} of the four dimensions are at the floor.`
        : 'The behaviour is absent here, not weak — this is teaching the move from scratch rather than sharpening it.'}` };
  }

  const rises = moves.map((m, i) => ({ m, i })).filter(x => x.m.dir > 0)
    .sort((a, b) => b.m.dir - a.m.dir);
  if (rises.length) {
    const { m, i } = rises[0];
    const n = m.dir;
    return { focusIdx: i, key: 'up', lead: `<b>${DIM_NAMES[i]} moved up ${n === 1 ? 'a band' : `${n} bands`}
      by ${at(m.toIdx)}.</b> It now reads — ${bandLabel(i, m.to)}.
      ${rises.length > 1 ? `${rises.length - 1} other dimension${rises.length > 2 ? 's' : ''} rose with it, and nothing fell.` : 'Nothing fell.'}` };
  }

  // NOT THE SAME AS FLAT, and this branch is why. "Nothing moved" is a finding
  // about the student; "nothing is comparable" is a finding about the data, and
  // reaching the flat copy with one readable stage per dimension printed "the
  // readings held across every draft" off a single reading. A dimension can be
  // unreadable on a session the OTHER three were read on — a zero on one dimension
  // of a complete analysis — so the whole-trace guard upstream does not cover it.
  if (!moves.some(m => m.read >= 2)) {
    return { focusIdx: null, key: 'none', lead: `<b>These drafts cannot be compared.</b>
      No dimension has a readable reading on two of them, so there is no movement to report either way.` };
  }

  const low = moves.filter(m => m.to && m.to <= 2).length;
  if (low > moves.filter(m => m.to).length / 2) {
    return { focusIdx: null, key: 'floor', lead: `<b>Nothing moved, and most of it sits in the weaker two bands.</b>
      Same readings on every draft — whatever changed between them did not change how the work was done.` };
  }
  return { focusIdx: null, key: 'flat', lead: `<b>Nothing moved, and it did not need to.</b>
    The readings held in the stronger bands across every draft.` };
}

// Rows are the four dimensions in canonical order; columns are CLOSED draft slots,
// which is the axis a single assignment licenses. Agency rides above as level chips
// rather than a fifth row — a level is a reading of the whole session, not a peer of
// the four, the same argument that keeps Composition off the band panel.
//
// TAKES THE READINGS, NOT A STUDENT — 2026-08-17, the same seam renderComposition
// took the day before. `bands` is four rows of one band per stage, `levels` is one
// level per stage, both null where a stage has no readable session. The assignment
// adapter in dashboard.html is the only caller today.
function renderTrace(stageNames, bands, levels) {
  const readable = levels.filter(v => v != null).length;

  // Two different empty states, never one. "Only one draft has closed" is a fact
  // about the calendar and resolves itself; "nothing readable" is a fact about the
  // student and does not.
  if (stageNames.length < 2) {
    return `<div class="trace"><p class="dist-what" style="margin:0">Movement needs two closed drafts to compare.
      This assignment has ${stageNames.length === 1 ? 'one so far' : 'none yet'}.</p></div>`;
  }
  if (readable < 2) {
    return `<div class="trace"><p class="dist-what" style="margin:0">${readable === 1
      ? 'Only one of these drafts has a readable session, so there is nothing to compare it against yet.'
      : 'None of these drafts has a readable session.'} ${OFF_NOTE}</p></div>`;
  }

  const moves = bands.map(traceMove);
  const { lead, focusIdx } = traceFinding(moves, stageNames);

  const lvMove = traceMove(levels);
  const agency = `<div class="trace-agency">
    <span class="trace-row-name">Agency</span>
    <span class="trace-cells">${levels.map((n, i) => `<span class="trace-cell">
      ${n ? levelChip(n, true) : '<span class="trace-off" title="No readable session">—</span>'}
    </span>`).join('')}</span>
    <span class="trace-move">${lvMove.dir > 0 ? `Up ${lvMove.dir === 1 ? 'a level' : `${lvMove.dir} levels`}`
      : lvMove.dir < 0 ? `Back ${lvMove.dir === -1 ? 'a level' : `${-lvMove.dir} levels`}`
      : 'Held'}</span></div>`;

  const rows = bands.map((cells, i) => {
    const m = moves[i];
    const move = m.dir > 0 ? `Up ${m.dir === 1 ? 'a band' : `${m.dir} bands`}`
      : m.dir < 0 ? `Down ${m.dir === -1 ? 'a band' : `${-m.dir} bands`}`
      : m.read < 2 ? 'Not comparable' : 'Held';
    return `<div class="trace-row${i === focusIdx ? ' is-focus' : ''}">
      <span class="trace-row-name">${DIM_NAMES[i]}</span>
      <span class="trace-cells">${cells.map((b, j) => `<span class="trace-cell">${b
        ? `<span class="steps steps-sm band-step-${b}" role="img"
             aria-label="${stageNames[j]}: ${bandLabel(i, b)}">${
             [1, 2, 3, 4].map(k => `<i class="${k <= b ? 'on' : ''}"></i>`).join('')}</span>`
        : `<span class="trace-off" title="No readable session on ${stageNames[j]}">—</span>`
      }</span>`).join('')}</span>
      <span class="trace-move">${move}</span>
    </div>`;
  }).join('');

  return `<div class="trace">
    <div class="viz-lede">${lead}</div>
    ${agency}
    <div class="trace-head">
      <span class="trace-row-name"></span>
      <span class="trace-cells">${stageNames.map(n => `<span class="trace-cell trace-col">${n}</span>`).join('')}</span>
      <span class="trace-move"></span>
    </div>
    ${rows}
    <p class="viz-card-foot">Each mark is one reading of one draft — four steps, strongest at the right.
      Nothing is drawn between them, because nothing was measured between them.</p>
  </div>`;
}
