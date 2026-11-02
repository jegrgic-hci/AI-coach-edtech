// The pattern guide — every pattern the turn plot can name, explained for a
// teacher workshop. Rendered under the chart on a workshop report only
// (report-boot.js renderPlotOnly); the live report never calls it.
//
// Its own copy rather than the dashboard's PATTERN_META, deliberately. That
// copy is written for a teacher triaging a class ("A real sequence detector —
// it reads turn order, which no dimension does") and editing it would change
// the live dashboard. This is written for a room learning how an AI steers a
// conversation, so each entry says what the pattern is, in plain terms, and
// what it shows about the exchange between a person and an AI.
//
// NAMES MUST MATCH patterns-core.js EXACTLY — the chart prints those, and a
// guide that names "Extraction loop" beside a band reading "Extraction Loop"
// is two vocabularies for one thing. Ids are the join; `name` is checked
// against the detector's label in the workshop's test script.
(function (root) {
  'use strict';

  // `shape` is the pattern's typical run, drawn on its card in the turn plot's
  // own marks so the room learns to spot it on the chart above: t is each
  // student turn's row (4 High agency … 1 Low agency, session-view.js TIER),
  // run the [first, last] turns of the shaded band, ai the turns the AI's act
  // follows, caved the turn the AI backed off after. An illustration, never
  // data — so it is drawn small and unlabelled.
  var GROUPS = [
    {
      title: 'High-agency patterns', tier: 'high',
      intro: 'The person sets the direction and uses the AI as a resource.',
      items: [
        { id: 'challenge-arc', name: 'Challenge Arc',
          shape: { t: [2, 3, 4, 4, 2], run: [2, 3] },
          what: 'Two or more questions in a row pressing the AI on the same point.',
          why: 'Asked once, an AI’s answer sounds final. Asked again, it often shifts — pressing is how you find out how solid it was.' },
        { id: 'rejection-redirect', name: 'Rejection → Redirect',
          shape: { t: [2, 4, 3, 2], run: [1, 2] },
          what: 'Turning down what the AI produced, then saying what you want instead.',
          why: 'A refusal on its own leaves the AI to guess again. The redirect is where the person’s intent enters the work.' },
        { id: 'claim-support', name: 'Claim-Support Cycle',
          shape: { t: [3, 3, 1, 3, 2], run: [0, 3] },
          what: 'A claim of your own, a question to understand it, a request for material, then back to your claim.',
          why: 'The AI is being used as a source for the person’s argument, not as its author.' },
        { id: 'argument-engaged', name: 'Argument Engaged',
          shape: { t: [2, 1, 4, 2], run: [2, 2], ai: [1] },
          what: 'The AI argued a position and you answered it — questioning, rejecting or reshaping it — instead of absorbing it.',
          why: 'AI arguments arrive fluent and confident. Answering one is the habit that stops it becoming the person’s view by default.' },
        { id: 'correction-held', name: 'Held Ground',
          shape: { t: [2, 3, 4, 2], run: [2, 2], ai: [1] },
          what: 'The AI told you something you said was wrong, and you kept your position.',
          why: 'Being corrected by an AI is not the same as being wrong. Holding is only right when you are — which is why the useful question afterwards is how you decided.' },
        { id: 'assertion-questioned', name: 'Questioned Assertion',
          shape: { t: [2, 2, 4, 3], run: [2, 2], ai: [1] },
          what: 'The AI stated something as an established fact, and you questioned it.',
          why: 'Definitions and facts come in the same confident tone as everything else an AI says. Questioning one is a habit, and it can be taught.' },
        { id: 'extraction-landing', name: 'Extraction → Insight',
          shape: { t: [2, 1, 3, 2], run: [1, 2] },
          what: 'You asked the AI to produce something, then did something of your own with it.',
          why: 'Asking for output is neutral. The turn after it is where the thinking shows.' },
      ],
    },
    {
      title: 'Low-agency patterns', tier: 'low',
      intro: 'The AI sets the direction and the person goes along with it.',
      items: [
        { id: 'extraction-loop', name: 'Extraction Loop',
          shape: { t: [1, 1, 1, 3], run: [0, 2] },
          what: 'Three or more requests in a row for the AI to produce something, with nothing of your own in between.',
          why: 'Each answer becomes the starting point for the next request, so the conversation goes wherever the AI takes it.' },
        { id: 'validation-spiral', name: 'Validation Spiral',
          shape: { t: [1, 1, 1, 1, 2], run: [0, 3] },
          what: 'Asking and confirming, back and forth, for four turns or more.',
          why: '“Great, now…” turns approval into a rhythm — and agreeing is exactly what an AI is built to invite.' },
        { id: 'helplessness-loop', name: 'Helplessness Loop',
          shape: { t: [2, 1, 1, 2], run: [1, 2] },
          what: 'Saying you’re stuck, then handing the next turns to the AI.',
          why: 'Being stuck is the moment most worth protecting, and the easiest one to give away.' },
        { id: 'flitting', name: 'Flitting',
          shape: { t: [3, 3, 3, 2], run: [0, 2] },
          what: 'Three or more changes of topic with nothing developed in between.',
          why: 'An AI will follow any new direction instantly, so nothing in the conversation pushes back on abandoning a thread.' },
        { id: 'missed-argument', name: 'Missed Argument',
          shape: { t: [2, 1, 1, 1], run: [1, 3], ai: [0, 1, 2] },
          what: 'The AI argued a position for three turns in a row, and you stayed passive through all of them.',
          why: 'An argument nobody answers becomes the conversation’s conclusion.' },
        { id: 'capitulation', name: 'Capitulation',
          shape: { t: [3, 1, 2], run: [1, 1], ai: [0] },
          what: 'The AI corrected you, and you accepted the correction without testing it.',
          why: 'An AI corrects with the same confidence whether or not it is right.' },
        { id: 'assertion-unquestioned', name: 'Unquestioned Assertion',
          shape: { t: [2, 1, 2], run: [1, 1], ai: [0] },
          what: 'The AI stated something as an established fact, and you built on it.',
          why: 'This is how an AI’s framing quietly becomes the person’s own.' },
      ],
    },
    {
      title: 'What the AI did',
      intro: 'Read from the AI’s side of the same exchanges. These never count for or against the person.',
      ai: true,
      items: [
        { id: 'ai-caved', name: 'AI backed off',
          shape: { t: [3, 4, 2], caved: 1 },
          what: 'You disputed a claim without giving a reason, and the AI softened or dropped its answer anyway.',
          why: 'AI models are trained to be agreeable, so disagreement alone often moves them. That says nothing about which answer was right — only that the change wasn’t earned by evidence. When you dispute with a reason and the AI updates, that isn’t counted here: changing its answer for a reason is what it should do.' },
      ],
    },
  ];

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  function turnsText(spans) {
    var nums = spans.map(function (s) { return s.start === s.end ? String(s.start + 1) : (s.start + 1) + '–' + (s.end + 1); });
    return (spans.length === 1 && spans[0].start === spans[0].end ? 'turn ' : 'turns ') + nums.join(', ');
  }

  // Where each pattern showed up in this chat, keyed by id, from the same
  // patterns and AI moments the chart above was drawn from.
  function spansById(patterns, aiMoments) {
    var by = {};
    (patterns || []).concat(aiMoments || []).forEach(function (p) {
      (by[p.id] = by[p.id] || []).push(p);
    });
    return by;
  }

  var SVG_NS = 'http://www.w3.org/2000/svg';
  function svgNode(tag, attrs) {
    var n = document.createElementNS(SVG_NS, tag);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    return n;
  }
  var ROW_NAMES = ['High agency', 'Student-led', 'Shared', 'Low agency'];

  // A turn plot in miniature, in session-view.js renderTurnPlot's own marks:
  // four rows with High agency on top, a square per turn filled from the
  // agency ramp, a run band behind, and the AI's acts in a lane below the
  // rows — never on them, since a mark's height is the person's agency.
  // o.labels adds the row names and turn numbers (from o.first), for the
  // found card, which is a crop of the reader's own chart.
  function shapePlot(shape, tier, o) {
    var COL = o.col, DOT = o.dot, ROW = o.row;
    var PAD_L = o.labels ? 88 : 0, PAD_T = 6, PAD_B = o.labels ? 20 : 2;
    var lane = (shape.ai && shape.ai.length) || shape.caved !== undefined ? ROW : 0;
    var W = PAD_L + shape.t.length * COL + 2;
    var H = PAD_T + 4 * ROW + lane + PAD_B;
    var svg = svgNode('svg', { class: 'pguide-plot', width: W, height: H, viewBox: '0 0 ' + W + ' ' + H });
    svg.setAttribute('aria-hidden', 'true');
    var midY = function (r) { return PAD_T + r * ROW + ROW / 2; };

    for (var r = 0; r < 4; r++) {
      svg.appendChild(svgNode('line', { class: 'pg-rule', x1: PAD_L, x2: W - 2, y1: midY(r), y2: midY(r) }));
      if (o.labels) {
        var name = svgNode('text', { class: 'pg-row', x: PAD_L - 10, y: midY(r) + 4 });
        name.textContent = ROW_NAMES[r];
        svg.appendChild(name);
      }
    }
    (shape.runs || (shape.run ? [shape.run] : [])).forEach(function (run) {
      svg.appendChild(svgNode('rect', {
        class: 'pg-run', x: PAD_L + run[0] * COL + 1, y: PAD_T - 4,
        width: (run[1] - run[0] + 1) * COL - 2, height: 4 * ROW + 6, rx: 5,
        fill: tier === 'high' ? 'var(--tau-band-4-bg)' : 'var(--tau-band-2-bg)'
      }));
    });
    shape.t.forEach(function (t, i) {
      svg.appendChild(svgNode('rect', {
        class: 'pg-mark', x: PAD_L + i * COL + (COL - DOT) / 2, y: midY(4 - t) - DOT / 2,
        width: DOT, height: DOT, rx: 3, fill: 'var(--tau-agency-' + t + ')'
      }));
      if (o.labels) {
        var n = svgNode('text', { class: 'pg-tick', x: PAD_L + i * COL + COL / 2, y: H - 4 });
        n.textContent = o.first + i;
        svg.appendChild(n);
      }
    });
    var laneY = PAD_T + 4 * ROW + ROW / 2;
    // The AI's act sits between the turn it answered and the next one.
    (shape.ai || []).forEach(function (i) {
      var d = Math.round(DOT * 0.7);
      svg.appendChild(svgNode('rect', {
        class: 'pg-ai', x: PAD_L + (i + 1) * COL - d / 2, y: laneY - d / 2,
        width: d, height: d, rx: d / 2
      }));
    });
    // The chart's diamond, under the turn the AI backed off after.
    if (shape.caved !== undefined) {
      var cx = PAD_L + shape.caved * COL + COL / 2, d = Math.round(DOT * 0.7);
      svg.appendChild(svgNode('rect', {
        class: 'pg-ai', x: cx - d / 2, y: laneY - d / 2, width: d, height: d,
        transform: 'rotate(45 ' + cx + ' ' + laneY + ')'
      }));
    }
    return svg;
  }

  // The reader's own turns around where the pattern showed, one either side,
  // so the card is a crop of the chart above rather than an illustration.
  function foundShape(it, spans, tiers) {
    var lo = Math.max(0, Math.min.apply(null, spans.map(function (s) { return s.start; })) - 1);
    var hi = Math.min(tiers.length - 1, Math.max.apply(null, spans.map(function (s) { return s.end; })) + 1);
    var shape = { t: tiers.slice(lo, hi + 1), first: lo + 1 };
    if (it.id === 'ai-caved') shape.caved = spans[0].start - lo;
    else shape.runs = spans.map(function (s) { return [s.start - lo, s.end - lo]; });
    return shape;
  }

  // opts.tiers: each student turn's row, in order (the chart's own reading).
  // opts.onShow(item, span): opens the pattern on the chart above.
  function renderPatternGuide(host, patterns, aiMoments, opts) {
    if (!host) return;
    opts = opts || {};
    host.innerHTML = '';
    var by = spansById(patterns, aiMoments);
    var found = [];
    GROUPS.forEach(function (g) {
      g.items.forEach(function (it) { if (by[it.id]) found.push(it.name); });
    });

    var lead = el('p', 'claim');
    var strong = el('strong', null, found.length
      ? 'Your chat showed ' + found.length + ' of these: ' + found.join(', ') + '.'
      : 'None of these showed in your chat.');
    lead.appendChild(strong);
    // Stated, because the room will compare charts and an empty one reads as a
    // verdict. Most of these need several similar turns in a row, which five
    // minutes rarely produces — that is a fact about the length, not the person.
    lead.appendChild(document.createTextNode(' Most patterns need several turns in a row, so a five-minute ' +
      'conversation usually shows only a few. The rest are what to watch for in longer ones.'));
    host.appendChild(lead);

    // Found first, on its own, so the reader sees their chat's patterns without
    // scanning fourteen cards for the marked ones. Each part keeps the groups,
    // because high or low agency is half of what a pattern means.
    if (found.length) renderPart(host, 'In your chat', by, true, opts);
    renderPart(host, found.length ? 'Not in your chat' : 'All the patterns', by, false, opts);
  }

  function renderPart(host, title, by, wantFound, opts) {
    var part = el('section', 'pguide-part');
    part.appendChild(el('h3', 'pguide-part-title', title));
    GROUPS.forEach(function (g) {
      var items = g.items.filter(function (it) { return !!by[it.id] === wantFound; });
      if (!items.length) return;
      var section = el('section', 'pguide-group');
      section.appendChild(el('h4', 'pguide-title', g.title));
      section.appendChild(el('p', 'pguide-intro', g.intro));
      var list = el('div', 'pguide-list');
      items.forEach(function (it) {
        var spans = by[it.id];
        var item = el('div', 'pguide-item' + (spans ? ' is-found' : ''));
        var plot = el('div', 'pguide-shape');
        if (spans && opts.tiers && opts.tiers.length) {
          var own = foundShape(it, spans, opts.tiers);
          plot.appendChild(shapePlot(own, g.tier, { col: 34, dot: 18, row: 30, labels: true, first: own.first }));
        } else {
          plot.appendChild(shapePlot(it.shape, g.tier, { col: 20, dot: 12, row: 16 }));
        }
        item.appendChild(plot);

        var text = el('div', 'pguide-text');
        var head = el('div', 'pguide-head');
        head.appendChild(el('span', 'pguide-name', it.name));
        if (spans) head.appendChild(el('span', 'pguide-found pguide-found-' + (g.tier || 'ai'),
          turnsText(spans).replace(/^t/, 'T')));
        text.appendChild(head);
        text.appendChild(el('p', 'pguide-what', it.what));
        text.appendChild(el('p', 'pguide-why', it.why));
        if (spans && opts.onShow) {
          var show = el('button', 'btn btn-sm pguide-show', 'Show on my chart');
          show.type = 'button';
          show.addEventListener('click', function () { opts.onShow(it, spans[0]); });
          text.appendChild(show);
        }
        item.appendChild(text);
        list.appendChild(item);
      });
      section.appendChild(list);
      part.appendChild(section);
    });
    host.appendChild(part);
  }

  // shapePlot is shared with the workshop room's pattern cards, so the two draw a shape the same way.
  root.PatternGuide = { render: renderPatternGuide, GROUPS: GROUPS, shapePlot: shapePlot };
})(typeof window !== 'undefined' ? window : this);
