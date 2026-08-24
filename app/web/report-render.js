function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Ported verbatim from the single-file CTA (index.html) — the mature
// student results presentation. Do not edit the CTA; edit this copy.



// ─── Turn Sequence Chart ──────────────────────────────────────────────────────

// getAILabelBefore and detectPatterns moved to patterns-core.js (2026-08-14)
// and arrive as globals from the <script> tag ahead of this one. They left
// because the server needs them too — the teacher dashboard was never able to
// see a pattern while detection ran only in this file, at render time.
// Everything below still calls them exactly as before.

// One row per dimension: full name + its own five-pip .steps bar, the same
// component the summary panel below uses — this is a preview of that panel,
// not a different way of drawing the same fact, so it has to be the same
// component or the two would visually disagree with each other. No PQ/SU/CS/OC
// badge — that's a code a reader has to learn, and the full name already
// fits on one line.
// Two halves, even at 50/50: the charts (score — a quiet recessed panel,
// .card-quiet, the system's existing "block sitting inside another card"
// treatment, so it reads as its own instrument rather than text floating
// next to a rule — plus the breakdown that adds up to it, same four rows
// the summary panel below spells out) on the left, and the verdict (band +
// plain-language sentence) on the right, given real width instead of being
// demoted to a caption row underneath or crowded out by however much the
// charts side happened to need. The verdict's left rule borrows its colour from
// the band pill it sits beside — same idiom the auditor voice already uses
// for its own edge — so the sentence visually cites the pill that names it
// instead of a generic grey divider. No SAMR sub-label: the pill already
// says the same thing in plain language, and naming the framework alongside
// it was the one spot in this card still speaking PD jargon instead of
// human language. The eyebrow above is what the nav crumbs already say
// (assignment, draft) — repeated here because a student scrolling back up
// to the hero shouldn't have to look up at the nav bar to remember which
// draft this is.
// ── The reading ─────────────────────────────────────────────────────────────
// Everything below renders analysis.reading: agency as a NAMED LEVEL, and four
// dimensions each as a band 1-4 (or "not enough here") with the evidence behind
// it — the claim, the moments that support it, and the moment that doesn't.
// tau-dimensions.md, "The scoring foundation".
//
// The level is never numbered, and as of 2026-08-24 it is no longer SHOWN as a
// position among four either: numbering makes the second rung read as a failing
// grade, and a four-rung scale with a mark on it reads as a number whether or
// not one is printed — the documented failure mode of the SAMR vocabulary this
// replaced on 2026-08-21. LEVEL_ORDER survives because the order is real and
// the trend needs it; the student sees the level in words. Nothing is borrowed
// now, so no departure-from-Puentedura line — that requirement retired with the
// names. What holds throughout: the level names the SESSION, never the student.

const LEVEL_ORDER = ["Passive", "Reactive", "Directive", "Transformative"];

// The level in a sentence, said to the student. THE SUBJECT IS THE CONVERSATION
// — "this conversation was reactive", never "you were reactive". The names are
// ordinary English now, which is what makes them readable and also what makes
// them easy to hear as a description of a person; this line is where the report
// settles which one it means.
//
// THIS IS THE CLASS, NOT THE INSTANCE. Definition to `body`'s deeper dive, the
// way "a bike is a two-wheeled human-powered vehicle" is to "yours is carbon
// fibre with road tyres". Generic by design — the same words for everyone at
// this level — and the ONLY generic line in the hero, which is why it can be
// the biggest one. `body` is where this particular session gets described.
//
// It also carries the hero's display slot as of 2026-08-22, when `shape` was
// deleted. Shape had become a longer paraphrase of this line: two generic
// sentences saying one thing, the second of them set at 24px. One statement of
// the level, at the size the level deserves.
//
// Rewritten 2026-08-22 around what the student ASKED FOR, which is the one
// thing about their own thinking that is visible in the transcript. The drafts
// before this described what the student thought ("your thinking mostly stayed
// outside this chat") — unknowable, and contradicted by levels.html, which says
// passive "tells you the thinking isn't in the work; it does not tell you
// whether it exists". Each line now names an act and its result, both of which
// a student can go and check by scrolling up.
//
// The rungs are: asked for answers / was given the ideas / led with their own /
// led and challenged them. NOT built to a shared template — an earlier pass
// forced all four onto one sentence frame and every line came out worse for it.
// Each is written to be clear on its own; the escalation is legible without the
// wording rhyming.
//
// Then run through Strunk: coordination replaced by subordination (rule 18),
// and the qualifiers cut EXCEPT the two doing measurement work — "almost
// unchanged" and, in Transformative, "developing new ones that changed your
// work", which is what stops the level being awarded for pushback that moved
// nothing.
//
// No absolutes: "with little change" is the only hedge, on the only line that
// would otherwise overclaim. The rest name acts, and an act is not a quantity.
const LEVEL_DEF = {
  Passive: "You asked the AI for the answers and used them almost unchanged.",
  Reactive: "The AI gave you the ideas; you made them into your own work.",
  Directive: "You led with your own ideas and used the AI to develop them.",
  Transformative: "You led the AI to investigate and challenge your ideas, developing new ones that changed your work.",
};

function renderReportHero(reading, submission) {
  // The assignment is the page's identity, so it is the page's heading — the
  // only h1 on the report, and the thing a student checks first to know which
  // report they opened. The draft rides beside it as the eyebrow: identity and
  // position are different objects, and running them together in one faint
  // uppercase crumb made the assignment the least legible text on the page.
  const heroHead = `
    <div class="report-hero-head">
      <h1 class="report-hero-title">${esc(submission.assignmentTitle || 'Assignment')}</h1>
      <span class="eyebrow report-hero-eyebrow">Draft ${submission.cycleIndex + 1}</span>
    </div>`;

  if (!reading || !reading.level) {
    return `
      <div class="card card-lg card-hero report-hero">
        ${heroHead}
        <p class="readings-intro">There wasn't enough in this chat to tell yet.</p>
      </div>`;
  }

  // Through levelName() like every other printed level: readings taken before
  // the 2026-08-21 rename are stored under the retired name and are never
  // rewritten. Without this the hero threw on `level` and rendered nothing.
  const level = levelName(reading.level);
  // Still the band index — it colours the panel. The four-rung scale it also
  // drove came out 2026-08-24; the level is now stated in words and in the
  // panel's band fill, and nowhere as a position among four.
  const idx = LEVEL_ORDER.indexOf(level) + 1;

  // The departure sentence only appears when the level lands somewhere the four
  // bands would not predict — when it doesn't depart, it says nothing extra.
  const departure = reading.departure
    ? `<p class="level-body">${esc(reading.departure)}</p>`
    : '';

  return `
    <div class="card card-lg card-hero report-hero">
      ${heroHead}
      <!-- Was "How much you led", which framed the level as a quantity — the
           axis-switch defect the 2026-08-21 rename removed. The reading does
           not measure how much of the leading was yours; it says where your
           thinking came into the work. -->
      <span class="eyebrow">Where your thinking came in</span>
      <div class="level-summary" style="--level-bg: var(--tau-band-${idx}-bg); --level-fg: var(--tau-band-${idx}-fg)">
        ${LEVEL_DEF[level] ? `<p class="hero-level-def"><b>${esc(level)}.</b> ${esc(LEVEL_DEF[level])}</p>` : ''}
        <div class="level-summary-body">
          <div>
            <p class="level-body">${esc(reading.body)}</p>
            ${departure}
          </div>
          ${reading.exception ? `
            <div class="aside">
              <span class="eyebrow">The exception</span>
              <p>${esc(reading.exception)}</p>
            </div>` : ''}
        </div>
      </div>
      <!-- Teachers are told this twice (viz.js's flow foot, levels.html); until
           2026-08-22 the student was told it nowhere. It hung under the agency
           ladder while there was one; with the ladder gone it attaches to the
           whole reading, and sits OUTSIDE the band panel rather than inside it —
           it is a standing condition on how to read the card, not part of this
           session's statement, and --tau-ink-faint is only cleared for contrast
           on the surfaces, not on a band fill. Permanent and undismissable, per
           the voice rule that a reading is never a verdict. No link:
           levels.html is teacher-only. -->
      <p class="hero-level-foot">This is about how the work got made, not how good it is. Your teacher marks the essay.</p>
    </div>`;
}

// One reading, one card. The counterexample has a fixed slot precisely so it
// cannot be quietly dropped when a session goes well — it is what makes this
// feedback rather than praise.
function renderReadings(reading) {
  const dims = (reading && reading.dimensions) || [];
  if (!dims.length) return '';

  return dims.map((d) => {
    const pips = d.band
      ? [1, 2, 3, 4].map((i) => `<i class="${i <= d.band ? 'on' : ''}"></i>`).join('')
      : '';
    const score = d.band
      ? `<div class="dim-quad-score">
           <span class="dim-quad-score-n"><span class="n">${d.band}</span><span class="of">/4</span></span>
           <span class="steps dim-quad-steps">${pips}</span>
         </div>`
      : `<div class="dim-quad-score"><span class="dim-quad-score-n">Not enough here</span></div>`;

    const moments = (d.moments || []).map((m) =>
      `<q>${esc(m.quote)}</q>${m.note ? ' — ' + esc(m.note) + ' ' : ' '}`).join('');

    const body = (d.band && (moments || d.counterexample))
      ? `<div class="dim-card-body">
           ${moments ? `<p class="dim-card-moments">${moments}</p>` : ''}
           ${d.counterexample ? `
             <div class="aside">
               <span class="eyebrow">Where it didn't hold</span>
               <p>${esc(d.counterexample)}</p>
             </div>` : ''}
         </div>`
      : '';

    return `
      <div class="card dim-card"${body ? ' role="button" tabindex="0"' : ''}>
        <div class="dim-card-head">
          <span class="eyebrow">${esc(d.name)}</span>
          <span class="dim-card-q">${esc(d.question)}</span>
          ${score}
          <p class="dim-quad-callout">${d.count ? `<span class="dim-evidence">${esc(d.count)}</span> ` : ''}${esc(d.claim)}</p>
          ${body ? '<span class="dim-card-more">The moments behind this<i class="dim-card-chev" aria-hidden="true"></i></span>' : ''}
        </div>
        ${body}
      </div>`;
  }).join('');
}

// Bottom-of-report card — the one piece of Snapshot that's genuinely
// forward-looking rather than a recap of turns My Session already shows.
function renderGrowthMoves(growthMoves) {
  if (!growthMoves || !growthMoves.length) return "";
  return growthMoves.map((g) => `
    <div class="snap-move">
      ${iconSVG('checklist', 'snap-move-icon')}
      <p class="snap-move-text">${esc(g)}</p>
    </div>`).join('');
}


// My Session groups every student turn by what it actually did to the essay,
// not by label or chronology — staying out of the draft after a pushback is
// as meaningful an outcome as landing in it, so it gets its own group instead
// of reading as "nothing happened."
function renderFlags(flags) {
  if (!flags.length) return `<div class="no-flags">No integrity flags detected.</div>`;
  const TYPE_LABEL = {
    "stylistic-inconsistency": "Stylistic Inconsistency",
    "unnatural-fluency":       "Unnatural Fluency",
    "provenance-mismatch":     "Provenance Mismatch",
    "shadow-session-pattern":  "Shadow Session Pattern",
    "reflection-duplicate":    "Reflection Resubmitted",
  };
  // "Learn more →" was dropped: nothing has ever handled data-learn, so it was
  // a link to nowhere sitting next to the most consequential copy on the page.
  return flags.map(f => `
    <div class="flag-row">
      <span class="flag-type">${TYPE_LABEL[f.type] || f.type}</span>
      <div class="flag-detail">${esc(f.detail)}</div>
    </div>`).join("");
}

// Report jump nav — content for the mini score chip that docks into the
// sticky bar once the hero scrolls out of view. Same number and band label
// as renderReportHero, just re-said at 1/4 the height; band colour keyed the
// same way the hero's verdict rule is (var(--tau-band-N-fg)) so the two
// never disagree if the ramp itself ever changes.
// The mini reading that fades into the jump bar once the hero scrolls away.
// The level, never a number — there is no total to shrink down to.
function renderJumpScore(reading) {
  if (!reading || !reading.level) return '';
  const level = levelName(reading.level);
  const idx = LEVEL_ORDER.indexOf(level) + 1;
  return `<span class="report-jump-score-band" style="color: var(--tau-band-${idx}-fg)">${esc(level)}</span>`;
}

// ---- Container transform, the shipping version -------------------------
// Fixes the two faults the demo had: the destination height is measured
// rather than guessed, and the surface behaves like a dialog (focus moves
// into it, Escape closes, focus returns to the card you came from).
(function () {
  // Delegated, not bound per card: renderReadings() fills .dim-cards after
  // this file parses, so a NodeList captured here would always be empty.
  var readings = document.querySelector('.readings');
  if (!readings) return;

  var GAP = 24;          // minimum breathing room against the viewport
  var MAX_W = 860;
  var open = null;

  function measuredHeight(surface, width) {
    // Lay the surface out at its destination width, off-screen, to find
    // the height its content actually wants. Guessing this is what left
    // the demo with dead space under short readings.
    var probe = surface.cloneNode(true);
    probe.style.cssText = 'position:fixed;left:-9999px;top:0;visibility:hidden;'
      + 'width:' + width + 'px;height:auto;transition:none';
    probe.querySelector('.dim-card-body').style.opacity = 1;
    probe.querySelector('.dim-card-body').style.transform = 'none';
    document.body.appendChild(probe);
    var h = probe.getBoundingClientRect().height;
    probe.remove();
    return h;
  }

  function openCard(card) {
    if (open) return;
    if (!card.querySelector('.dim-card-body')) return;   // "not enough here"
    var from = card.getBoundingClientRect();
    var returnFocus = document.activeElement;

    var scrim = document.createElement('div');
    scrim.className = 'xform-scrim';

    var surface = document.createElement('div');
    surface.className = 'xform';
    surface.setAttribute('role', 'dialog');
    surface.setAttribute('aria-modal', 'true');
    surface.setAttribute('aria-label', card.querySelector('.dim-card-q').textContent);
    surface.innerHTML = card.innerHTML
      + '<button type="button" class="btn btn-quiet btn-sm xform-close">Close</button>';

    document.body.appendChild(scrim);
    document.body.appendChild(surface);

    var w = Math.min(MAX_W, window.innerWidth - GAP * 2);
    var h = Math.min(measuredHeight(surface, w), window.innerHeight - GAP * 2);
    var left = Math.round((window.innerWidth - w) / 2);
    var top = Math.round(Math.max(GAP, (window.innerHeight - h) / 2));

    // Start life as the card: same box, same radius, same shadow.
    surface.style.left = from.left + 'px';
    surface.style.top = from.top + 'px';
    surface.style.width = from.width + 'px';
    surface.style.height = from.height + 'px';
    surface.style.borderRadius = getComputedStyle(card).borderRadius;

    document.body.style.overflow = 'hidden';
    card.classList.add('is-source');

    surface.getBoundingClientRect();          // commit the start state
    requestAnimationFrame(function () {
      scrim.classList.add('is-open');
      surface.classList.add('is-open');
      surface.style.left = left + 'px';
      surface.style.top = top + 'px';
      surface.style.width = w + 'px';
      surface.style.height = h + 'px';
      surface.style.borderRadius = 'var(--tau-r-lg)';
    });

    surface.querySelector('.xform-close').focus({ preventScroll: true });

    function onKey(e) {
      if (e.key === 'Escape') { e.preventDefault(); close(); return; }
      if (e.key !== 'Tab') return;
      // Keep tabbing inside the surface while it is modal.
      var f = surface.querySelectorAll('button, [href], [tabindex]:not([tabindex="-1"])');
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }

    function close() {
      if (!open) return;
      open = null;
      document.removeEventListener('keydown', onKey);
      var now = card.getBoundingClientRect();   // the page may have scrolled
      surface.classList.add('is-closing');
      surface.classList.remove('is-open');
      scrim.classList.remove('is-open');
      surface.style.left = now.left + 'px';
      surface.style.top = now.top + 'px';
      surface.style.width = now.width + 'px';
      surface.style.height = now.height + 'px';
      surface.style.borderRadius = getComputedStyle(card).borderRadius;
      setTimeout(function () {
        surface.remove();
        scrim.remove();
        card.classList.remove('is-source');
        document.body.style.overflow = '';
        if (returnFocus && returnFocus.focus) returnFocus.focus({ preventScroll: true });
      }, 300);
    }

    document.addEventListener('keydown', onKey);
    scrim.addEventListener('click', close);
    surface.querySelector('.xform-close').addEventListener('click', close);
    open = close;
  }

  readings.addEventListener('click', function (e) {
    var card = e.target.closest('.dim-card');
    if (card) openCard(card);
  });
  readings.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    var card = e.target.closest('.dim-card');
    if (!card) return;
    e.preventDefault();
    openCard(card);
  });
})();

// Click-to-scroll + scrollspy for the five report sections, plus the
// hero-visibility watch that toggles the mini score into the same bar. All
// three elements referenced here exist in the initial HTML (unlike the
// content they observe/scroll to, which render() fills in later), so this
// can wire up once at parse time rather than waiting on render().
(function initReportJump() {
  const jump = document.getElementById("reportJump");
  const hero = document.getElementById("samrHero");
  if (!jump || !hero) return;

  // The jump-nav click is the one honest "opened this section" signal on this
  // page. The scrollspy below deliberately doesn't log: it fires continuously
  // while scrolling, so counting it would report scroll depth as intent.
  const USAGE_AREA_BY_TARGET = {
    summaryPanel: "four-readings",
    tabTurns: "turn-by-turn",
    tabIdeas: "whose-ideas",
    growthMovesPanel: "next-time",
  };

  const buttons = Array.from(jump.querySelectorAll(".report-jump-btn"));
  buttons.forEach(btn => {
    btn.addEventListener("click", () => {
      const area = USAGE_AREA_BY_TARGET[btn.dataset.target];
      if (area) logUse("report", area);
      document.getElementById(btn.dataset.target)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });

  const sections = buttons.map(btn => document.getElementById(btn.dataset.target)).filter(Boolean);
  const spy = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const idx = sections.indexOf(entry.target);
      if (idx === -1) return;
      buttons.forEach(b => b.classList.remove("is-current"));
      buttons[idx].classList.add("is-current");
    });
  }, { rootMargin: "-96px 0px -70% 0px", threshold: 0 });
  sections.forEach(s => spy.observe(s));

  const heroWatch = new IntersectionObserver(([entry]) => {
    jump.classList.toggle("is-scrolled", !entry.isIntersecting && entry.boundingClientRect.top < 0);
  }, { threshold: 0 });
  heroWatch.observe(hero);
})();

// Bars / Trend line toggle — independent show/hide, not exclusive.
document.querySelectorAll("#chartToggle [data-layer]").forEach(btn => {
  btn.addEventListener("click", () => {
    const on = !btn.classList.contains("is-active");
    btn.classList.toggle("is-active", on);
    document.querySelectorAll(`#agencyChart .layer-${btn.dataset.layer}`).forEach(el => el.classList.toggle("mode-hidden", !on));
  });
});
