// Session view — the two turn-level surfaces of a draft report.
//
//   renderTurnPlot(el, classified, patterns)
//     The conversation on the time axis. One square per student turn at one of
//     four heights; runs of turns the detector named are shaded behind them.
//     Position carries the level and NOTHING is drawn between two turns — the
//     two charts this replaced both ran a moving average over ordinal codes,
//     which is arithmetic on labels. The gap rule that forbids lines elsewhere
//     does not reach here: consecutive turns are contiguous measured events and
//     the job is locating a moment, not asserting a rate.
//
//   renderIdeaStrip(el, provenance, classified, essayText)
//     The draft on the authorship axis. AUTHORSHIP OF IDEAS, NOT OF SENTENCES —
//     for each idea traced back to a moment in the chat, who raised it first.
//     Every string here says "raised", never "wrote". See convolabel.md.
//
// Both are used by the student report and by the teacher's read of the same
// draft, so neither may reach for anything on the page around it.
(function (root) {
  'use strict';

  // ── shared ────────────────────────────────────────────────────────────────

  var NS = 'http://www.w3.org/2000/svg';

  function svgNode(tag, attrs) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  }

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  function studentTurns(classified) {
    return (classified || []).filter(function (t) { return t.role === 'student'; });
  }

  // The AI turn immediately before each student turn, and the one immediately
  // after it. Both matter and they are different questions: what the student
  // was responding to, versus what the AI said back.
  function aiAround(classified) {
    var before = [], after = [], prior = null, pending = [];
    (classified || []).forEach(function (t) {
      if (t.role === 'student') {
        // `prior` is deliberately NOT cleared here: two student turns in a row
        // were both preceded by the same AI turn, and blanking it would leave
        // the second one looking like it opened the conversation.
        before.push(prior);
        pending.push(after.length);
        after.push(null);
      } else {
        prior = t.text;
        while (pending.length) after[pending.shift()] = t.text;
      }
    });
    return { before: before, after: after };
  }

  // ── the exchange ──────────────────────────────────────────────────────────
  // Two voices, told apart by side and by fill: the student left in a filled
  // bubble because this is their report, the AI right and outlined so the two
  // never compete for weight. Three channels — side, fill, and the label above
  // — so it survives greyscale and a reader who never notices colour.

  function aiBubble(text, isOrigin) {
    var side = el('div', 'div-ai-side' + (isOrigin ? ' is-origin' : ''));
    var row = el('div', 'div-ai-row');
    row.appendChild(el('span', 'div-role-tag', isOrigin ? 'AI · where it appears' : 'AI'));
    side.appendChild(row);
    side.appendChild(el('div', 'div-ai-text', text));
    return side;
  }

  function studentBubble(turn, n, isOrigin) {
    var side = el('div', 'div-student-side' + (isOrigin ? ' is-origin' : ''));
    var meta = el('div', 'div-student-meta');
    meta.appendChild(el('span', 'div-turn-num', isOrigin ? 'Turn ' + n + ' · where it appears' : 'Turn ' + n));
    if (turn.label) meta.appendChild(el('span', 'div-student-chip', turn.label));
    side.appendChild(meta);
    var body = el('div', 'div-student-text');
    var q = document.createElement('q');
    q.textContent = turn.text || '';
    body.appendChild(q);
    side.appendChild(body);
    return side;
  }

  // A stretch of conversation, in order. Used for a detected run, where the AI
  // turn BEFORE each student turn is the right one — it is what the student was
  // responding to. Non-contiguous turn numbers get a named gap rather than a
  // hairline that would imply one continuous thread.
  function renderExchange(container, turnNumbers, ctx) {
    turnNumbers.forEach(function (n, k) {
      var turn = ctx.student[n - 1];
      if (!turn) return;

      if (k > 0) {
        var skipped = n - turnNumbers[k - 1] - 1;
        if (skipped > 0) {
          container.appendChild(el('div', 'div-exchange-gap',
            skipped + (skipped === 1 ? ' turn later' : ' turns later')));
        } else {
          container.appendChild(el('hr', 'div-exchange-divider'));
        }
      }

      var block = el('div');
      var before = ctx.ai.before[n - 1];
      if (before) block.appendChild(aiBubble(before, false));
      block.appendChild(studentBubble(turn, n, false));
      container.appendChild(block);
    });
  }

  // One traced idea's origin. Deliberately not renderExchange: for an idea what
  // matters is the turn the idea APPEARED IN, and for an AI-raised idea that is
  // the AI's REPLY to turn n — the turn renderExchange never shows. Both halves
  // of the pair are drawn and the one carrying the idea is marked.
  function renderOrigin(container, n, src, ctx) {
    var turn = ctx.student[n - 1];
    if (!turn) return;
    var pair = el('div', 'div-origin-pair');
    pair.appendChild(studentBubble(turn, n, src === 'you' || src === 'both'));
    var reply = ctx.ai.after[n - 1];
    if (reply) pair.appendChild(aiBubble(reply, src === 'ai' || src === 'both'));
    container.appendChild(pair);
  }

  // ── the turn plot ─────────────────────────────────────────────────────────

  // Four steps, from the classifier's eleven labels. The seam that matters is
  // whether the student was acting on the AI's material or taking it.
  var TIER = {
    challenge: 4, rejection: 4,
    claim: 3, conceptual: 3, pivot: 3,
    refinement: 2, feedback: 2, narrative: 2,
    extraction: 1, validation: 1, stuck: 1
  };
  var TIER_NAME = { 4: 'High agency', 3: 'Student-led', 2: 'Shared', 1: 'Low agency' };

  function renderTurnPlot(host, classified, patterns) {
    if (!host) return;
    host.innerHTML = '';

    var student = studentTurns(classified);
    if (student.length < 2) {
      host.appendChild(el('p', 'tab-intro',
        'This draft has too little conversation to map.'));
      return;
    }

    var ctx = { student: student, ai: aiAround(classified) };
    var turns = student.map(function (t, i) {
      return { n: i + 1, label: t.label || 'narrative', text: t.text || '', tier: TIER[t.label] || 2 };
    });

    // detectPatterns indexes student turns from 0; the plot counts from 1.
    var runs = (patterns || []).map(function (p) {
      return {
        from: p.start + 1, to: p.end + 1,
        name: p.label || p.id,
        tier: (p.tier === 'high' || p.tier === 'medium') ? 'high' : 'low'
      };
    }).filter(function (r) { return r.from >= 1 && r.to <= turns.length; });

    var finding = el('p', 'claim');
    var low = turns.filter(function (t) { return t.tier <= 2; }).length;
    var top = turns.filter(function (t) { return t.tier === 4; }).length;
    finding.innerHTML = '<strong>' + (low > turns.length / 2
      ? 'Most of your turns asked for something or edited what came back.'
      : 'You spent most of this conversation acting on what the AI gave you.') + '</strong> ' +
      low + ' of your ' + turns.length + ' turns sit in the lower two rows' +
      (top ? ', and ' + top + ' push back on what you were told.' : '.');
    host.appendChild(finding);

    var row = el('div', 'turnplot-row');
    var wrap = el('div', 'turnplot-wrap');
    var svg = svgNode('svg', { class: 'turnplot' });
    wrap.appendChild(svg);
    row.appendChild(wrap);

    var detail = el('div', 'turnplot-detail');
    detail.setAttribute('aria-live', 'polite');
    row.appendChild(detail);
    host.appendChild(row);

    var tray = ensureTray();

    function showEmpty() {
      clearOpen();
      closeTray(false);
      detail.innerHTML = '';
      detail.appendChild(el('p', 'turnplot-detail-empty',
        'Pick any turn to read what you said there, and how it was read.'));
    }

    function clearOpen() {
      var open = svg.querySelectorAll('.is-open');
      for (var i = 0; i < open.length; i++) open[i].classList.remove('is-open');
      svg.classList.remove('is-selecting');
    }

    function showTurn(t, node) {
      clearOpen();
      closeTray(false);
      node.classList.add('is-open');
      svg.classList.add('is-selecting');
      detail.innerHTML = '';
      detail.appendChild(el('span', 'turnplot-detail-which', 'Turn ' + t.n + ' of ' + turns.length));

      var words = el('div', 'turnplot-detail-words');
      var q = document.createElement('q');
      q.textContent = t.text;
      words.appendChild(q);
      detail.appendChild(words);

      var inRun = null;
      runs.forEach(function (r) { if (t.n >= r.from && t.n <= r.to) inRun = r; });

      var reading = el('div', 'turnplot-detail-reading');
      var band = el('span', 'turnplot-detail-band');
      var sw = el('span', 'turnplot-swatch');
      sw.style.background = 'var(--tau-agency-' + t.tier + ')';
      band.appendChild(sw);
      band.appendChild(document.createTextNode(TIER_NAME[t.tier]));
      reading.appendChild(band);
      reading.appendChild(el('p', 'turnplot-detail-note',
        inRun ? 'Read as ' + t.label + '. Part of the ' + inRun.name + '.'
              : 'Read as ' + t.label + '.'));
      detail.appendChild(reading);
    }

    var trayOpener = null;
    function closeTray(restoreFocus) {
      tray.el.classList.remove('open');
      var open = svg.querySelectorAll('.tp-run.is-open');
      for (var i = 0; i < open.length; i++) open[i].classList.remove('is-open');
      if (restoreFocus && trayOpener) trayOpener.focus();
      trayOpener = null;
    }

    function showRun(r, node) {
      clearOpen();
      node.classList.add('is-open');
      trayOpener = node;
      tray.title.textContent = r.name;
      tray.body.innerHTML = '';
      tray.body.appendChild(el('p', 'div-pat-insight',
        (r.to - r.from + 1) + ' turns in a row, read as ' +
        (r.tier === 'high' ? 'high agency' : 'low agency') + '.'));
      tray.body.appendChild(el('div', 'div-exchange-label', 'The exchange'));
      var nums = [];
      for (var n = r.from; n <= r.to; n++) nums.push(n);
      renderExchange(tray.body, nums, ctx);
      tray.el.classList.add('open');
    }

    tray.close.onclick = function () { closeTray(true); };

    // PAD_T carries two rows of run labels above the plot.
    var PAD_L = 96, PAD_R = 20, PAD_T = 44, PAD_B = 46;
    var COL = 19, DOT = 14, ROW = 46, ROWS = 4;
    var xOf = function (n) { return PAD_L + (n - 1) * COL; };
    var yOf = function (tier) { return PAD_T + (ROWS - tier) * ROW + ROW / 2; };

    var width = xOf(turns.length) + COL + PAD_R;
    var height = PAD_T + ROWS * ROW + PAD_B;
    svg.setAttribute('width', width);
    svg.setAttribute('height', height);
    svg.setAttribute('viewBox', '0 0 ' + width + ' ' + height);
    svg.setAttribute('role', 'group');
    svg.setAttribute('aria-label', 'Agency level of each of your ' + turns.length + ' turns, in order');

    // Real sessions produce runs that overlap and sit adjacent — the lab's
    // three well-spaced ones hid this. Labels are placed on two rows, and one
    // that fits on neither is DROPPED rather than overprinted: a band with no
    // name still reads as a run, and clicking it says which. Overlapping text
    // reads as neither.
    var CHAR_W = 5.6;                    // ~10.5px in the UI face
    var labelRows = [-Infinity, -Infinity];
    runs.sort(function (a, b) { return a.from - b.from; }).forEach(function (r) {
      var x1 = xOf(r.from) - 4, x2 = xOf(r.to) + DOT + 4;
      var g = svgNode('g', { class: 'tp-run', tabindex: '0', role: 'button' });
      g.setAttribute('aria-label', r.name + ', turns ' + r.from + ' to ' + r.to);
      g.appendChild(svgNode('rect', {
        x: x1, y: PAD_T - 8, width: x2 - x1, height: ROWS * ROW + 8, rx: 5,
        fill: r.tier === 'high' ? 'var(--tau-band-4-bg)' : 'var(--tau-band-2-bg)'
      }));

      var textW = r.name.length * CHAR_W;
      var row = labelRows[0] <= x1 ? 0 : (labelRows[1] <= x1 ? 1 : -1);
      if (row >= 0) {
        // A label near the end would run off the canvas, so anchor it to the
        // right edge instead of letting it clip mid-word.
        var overruns = x1 + 4 + textW > width - PAD_R;
        labelRows[row] = x1 + 4 + textW + 10;
        var name = svgNode('text', {
          class: 'tp-run-name',
          x: overruns ? width - PAD_R : x1 + 4,
          y: PAD_T - 12 - row * 13,
          'text-anchor': overruns ? 'end' : 'start',
          fill: r.tier === 'high' ? 'var(--tau-band-4-fg)' : 'var(--tau-band-2-fg)'
        });
        name.textContent = r.name;
        g.appendChild(name);
      }

      g.addEventListener('click', function () { showRun(r, g); });
      g.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); showRun(r, g); }
      });
      svg.appendChild(g);
    });

    [4, 3, 2, 1].forEach(function (tier) {
      svg.appendChild(svgNode('line', {
        class: 'tp-grid', x1: PAD_L - 10, x2: width - PAD_R, y1: yOf(tier), y2: yOf(tier)
      }));
      var lab = svgNode('text', { class: 'tp-row', x: PAD_L - 20, y: yOf(tier) + 4 });
      lab.textContent = TIER_NAME[tier];
      svg.appendChild(lab);
    });

    svg.appendChild(svgNode('line', {
      class: 'tp-axis', x1: PAD_L - 10, x2: width - PAD_R,
      y1: PAD_T + ROWS * ROW, y2: PAD_T + ROWS * ROW
    }));

    turns.forEach(function (t) {
      var g = svgNode('g', { class: 'tp-turn', tabindex: '0', role: 'button' });
      g.setAttribute('aria-label', 'Turn ' + t.n + ', ' + t.label + ', ' + TIER_NAME[t.tier]);
      g.appendChild(svgNode('rect', {
        class: 'turnplot-ag-' + t.tier,
        x: xOf(t.n), y: yOf(t.tier) - 7, width: DOT, height: 14, rx: 3
      }));
      g.addEventListener('click', function () { showTurn(t, g); });
      g.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); showTurn(t, g); }
      });
      svg.appendChild(g);

      if (t.n === 1 || t.n % 5 === 0) {
        var tick = svgNode('text', { class: 'tp-tick', x: xOf(t.n) + DOT / 2, y: PAD_T + ROWS * ROW + 16 });
        tick.textContent = t.n;
        svg.appendChild(tick);
      }
    });

    var cap = svgNode('text', { class: 'tp-caption', x: PAD_L, y: PAD_T + ROWS * ROW + 36 });
    cap.textContent = 'Your turns, in order';
    svg.appendChild(cap);

    var legend = el('div', 'turnplot-legend');
    legend.appendChild(legendGroup('Agency level', [4, 3, 2, 1].map(function (t) {
      return { fill: 'var(--tau-agency-' + t + ')', label: TIER_NAME[t] };
    })));
    if (runs.length) {
      legend.appendChild(legendGroup('Runs', [
        { fill: 'var(--tau-band-4-bg)', label: 'High-agency run' },
        { fill: 'var(--tau-band-2-bg)', label: 'Low-agency run' }
      ]));
    }
    host.appendChild(legend);

    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      if (tray.el.classList.contains('open')) closeTray(true);
      else if (svg.querySelector('.is-open')) showEmpty();
    });

    showEmpty();
  }

  function legendGroup(name, items) {
    var g = el('div', 'turnplot-legend-group');
    g.appendChild(el('b', null, name));
    var list = el('div', 'turnplot-legend-items');
    items.forEach(function (it) {
      var rowEl = el('span', 'turnplot-legend-item');
      var sw = el('span', 'turnplot-swatch');
      sw.style.background = it.fill;
      rowEl.appendChild(sw);
      rowEl.appendChild(document.createTextNode(it.label));
      list.appendChild(rowEl);
    });
    g.appendChild(list);
    return g;
  }

  // The run tray. Reuses the shipped .div-pat-sidebar, created on demand so a
  // host page does not have to carry the markup.
  function ensureTray() {
    var existing = document.getElementById('sessionTray');
    if (existing) {
      return {
        el: existing,
        title: existing.querySelector('.div-pat-sidebar-title'),
        body: existing.querySelector('.div-pat-sidebar-body'),
        close: existing.querySelector('.div-pat-sidebar-close')
      };
    }
    var wrap = el('div', 'div-pat-sidebar');
    wrap.id = 'sessionTray';
    wrap.setAttribute('role', 'dialog');
    wrap.setAttribute('aria-modal', 'false');
    var hdr = el('div', 'div-pat-sidebar-hdr');
    var title = el('div', 'div-pat-sidebar-title');
    var close = el('button', 'div-pat-sidebar-close', '✕');
    close.type = 'button';
    close.setAttribute('aria-label', 'Close');
    hdr.appendChild(title);
    hdr.appendChild(close);
    var body = el('div', 'div-pat-sidebar-body');
    wrap.appendChild(hdr);
    wrap.appendChild(body);
    document.body.appendChild(wrap);
    return { el: wrap, title: title, body: body, close: close };
  }

  // ── the idea strip ────────────────────────────────────────────────────────

  var ORIGIN_OF = { 'student-born': 'you', 'prior': 'you', 'synthesized': 'together', 'ai-born': 'coach' };
  var ORIGIN_NAME = {
    you: 'you raised it first',
    together: 'it came out of an exchange',
    coach: 'the AI raised it first'
  };
  var TALLY_NAME = { you: 'You raised it', together: 'From an exchange', coach: 'The AI raised it' };
  var ORIGIN_LABEL = {
    'student-born': 'You raised it first',
    'prior': 'You brought this in yourself',
    'synthesized': 'It came out of an exchange',
    'ai-born': 'The AI raised it first'
  };
  var FILL_BY = {
    you: 'var(--tau-origin-you)',
    together: 'var(--tau-origin-together)',
    coach: 'var(--tau-origin-coach)'
  };
  var SRC_OF = { 'student-born': 'you', 'prior': 'you', 'synthesized': 'both', 'ai-born': 'ai' };

  function words(s) { return (s || '').trim().split(/\s+/).filter(Boolean).length; }

  // Passages are the draft's own paragraphs. A name is the leading label if the
  // paragraph has one ("System 3: Wheels & Tires: …"), otherwise its first few
  // words — never a truncation with an ellipsis, which identifies nothing.
  function splitPassages(essayText) {
    var paras = (essayText || '').split(/\n\s*\n/).map(function (p) { return p.trim(); })
      .filter(function (p) { return p.length > 0; });
    if (paras.length < 2) {
      paras = (essayText || '').split(/(?<=\.)\s+(?=[A-Z])/);
      var chunk = Math.max(1, Math.ceil(paras.length / 6)), merged = [];
      for (var i = 0; i < paras.length; i += chunk) merged.push(paras.slice(i, i + chunk).join(' '));
      paras = merged.filter(function (p) { return p.trim(); });
    }
    var at = 0;
    return paras.map(function (text) {
      var start = (essayText || '').indexOf(text, at);
      if (start < 0) start = at;
      at = start + text.length;
      var head = text.split(/[:.]/)[0].trim();
      var name = head.length > 2 && head.length <= 28
        ? head
        : text.split(/\s+/).slice(0, 3).join(' ');
      return { name: name, text: text, words: words(text), start: start, end: start + text.length };
    });
  }

  // Which turn an idea first appeared in. traceProvenance names it directly —
  // the model has the numbered chat log — and that is authoritative. The word
  // overlap below is only a fallback for analyses stored before the trace
  // carried a turn, and it is weak by nature: an AI that writes the draft into
  // a document puts the essay's wording in no turn at all.
  function locateTurn(concept, src, ctx) {
    if (Number.isInteger(concept.turn) && concept.turn >= 1 && concept.turn <= ctx.student.length) {
      return concept.turn;
    }
    var toks = (concept.phrase || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/).filter(function (w) { return w.length > 3; });
    if (!toks.length) return null;
    var need = Math.max(1, Math.ceil(toks.length * 0.4));

    var best = null, bestHits = 0;
    ctx.student.forEach(function (t, i) {
      var pool = src === 'ai' ? (ctx.ai.after[i] || '') : (t.text || '');
      var hay = pool.toLowerCase();
      var hits = toks.filter(function (w) { return hay.indexOf(w) >= 0; }).length;
      if (hits > bestHits) { bestHits = hits; best = i + 1; }
    });
    return bestHits >= need ? best : null;
  }

  function renderIdeaStrip(host, provenance, classified, essayText) {
    if (!host) return;
    host.innerHTML = '';

    var passages = splitPassages(essayText);
    var concepts = (provenance || []).filter(function (c) { return c.phrase && ORIGIN_OF[c.origin]; });

    if (!passages.length || !concepts.length) {
      host.appendChild(el('p', 'tab-intro',
        'No draft text was traced back to this conversation, so there is nothing to attribute yet.'));
      return;
    }

    var ctx = { student: studentTurns(classified), ai: aiAround(classified) };

    // Place each idea in the passage its phrase falls in — exact, from the
    // draft text, not a guess.
    concepts.forEach(function (c) {
      var at = (essayText || '').indexOf(c.phrase);
      c._pi = -1;
      c._at = 0;
      if (at >= 0) {
        for (var i = 0; i < passages.length; i++) {
          if (at >= passages[i].start && at < passages[i].end) {
            c._pi = i;
            c._at = (at - passages[i].start) / Math.max(1, passages[i].text.length);
            break;
          }
        }
      }
      c._src = SRC_OF[c.origin];
      c._n = locateTurn(c, c._src, ctx);
    });

    // THE ATTRIBUTION RULE, stated because nothing in tau-dimensions.md covers
    // it: a passage takes the origin holding the PLURALITY of its traced words,
    // and reads "together" when the top two are within 10 points of each other
    // — a passage both sides built in near-equal measure is what synthesized
    // means. A passage with no traced ideas takes no origin at all.
    passages.forEach(function (p, i) {
      p.concepts = concepts.filter(function (c) { return c._pi === i; });
      p.origin = null;
      p.traced = 0;
      if (!p.concepts.length) return;
      var by = { you: 0, together: 0, coach: 0 };
      p.concepts.forEach(function (c) {
        var w = words(c.phrase);
        by[ORIGIN_OF[c.origin]] += w;
        p.traced += w;
      });
      var ranked = Object.keys(by).sort(function (a, b) { return by[b] - by[a]; });
      var spread = (by[ranked[0]] - by[ranked[1]]) / p.traced * 100;
      p.origin = spread < 10 ? 'together' : ranked[0];
    });

    var total = passages.reduce(function (s, p) { return s + p.words; }, 0);
    var by = { you: 0, together: 0, coach: 0 }, traced = 0;
    concepts.forEach(function (c) {
      var w = words(c.phrase);
      by[ORIGIN_OF[c.origin]] += w;
      traced += w;
    });

    var pct = function (n) { return Math.round(n / Math.max(1, traced) * 100); };
    var finding = el('p', 'claim');
    var lead = by.coach >= by.you + by.together
      ? 'The AI raised most of the ideas in this draft.'
      : 'Most of the ideas in this draft started with you.';
    finding.innerHTML = '<strong>' + lead + '</strong> Of the ideas that trace back to a moment in ' +
      'your chat — about ' + Math.round(traced / Math.max(1, total) * 100) + '% of the draft — ' +
      pct(by.you) + '% you put on the table first and ' + pct(by.together) + '% came out of an exchange.';
    host.appendChild(finding);

    var fig = el('figure', 'provstrip-figure');
    var bar = el('div', 'provstrip');
    bar.setAttribute('role', 'group');
    bar.setAttribute('aria-label', 'Your draft by passage — pick one to see whose ideas are in it');
    var trace = el('div', 'provstrip-trace');
    trace.setAttribute('aria-hidden', 'true');
    var names = el('div', 'provstrip-names');
    names.setAttribute('aria-hidden', 'true');
    var tally = el('figcaption', 'provstrip-tally');
    var evidence = el('div');
    evidence.setAttribute('aria-live', 'polite');
    fig.appendChild(bar); fig.appendChild(trace); fig.appendChild(names);
    fig.appendChild(tally); fig.appendChild(evidence);
    host.appendChild(fig);

    var segEls = [], nameEls = [];

    function clearSelection() {
      bar.classList.remove('is-selecting');
      segEls.forEach(function (e) { e.classList.remove('is-open'); });
      nameEls.forEach(function (e) { e.classList.remove('is-open'); });
      evidence.innerHTML = '';
    }

    function showEvidence(p, i) {
      clearSelection();
      bar.classList.add('is-selecting');
      segEls[i].classList.add('is-open');
      nameEls[i].classList.add('is-open');

      var panel = el('div', 'provstrip-evidence');
      var head = el('div', 'provstrip-evidence-head');
      head.appendChild(el('span', 'provstrip-evidence-title', p.name));
      if (p.origin) {
        var origin = el('span', 'provstrip-evidence-origin');
        var d = el('span', 'provstrip-dot');
        d.style.background = FILL_BY[p.origin];
        origin.appendChild(d);
        origin.appendChild(document.createTextNode(
          ORIGIN_NAME[p.origin].charAt(0).toUpperCase() + ORIGIN_NAME[p.origin].slice(1)));
        head.appendChild(origin);
      }
      panel.appendChild(head);

      var list = el('div', 'provstrip-evidence-turns');
      if (!p.concepts.length) {
        list.appendChild(el('p', 'turnplot-detail-empty',
          'Nothing in this passage traced back to a single moment in your chat.'));
      }
      p.concepts.forEach(function (c) {
        var idea = el('div', 'provstrip-idea');
        var ih = el('div', 'provstrip-idea-head');
        var dot = el('span', 'provstrip-dot');
        dot.style.background = FILL_BY[ORIGIN_OF[c.origin]];
        ih.appendChild(dot);
        ih.appendChild(el('span', 'provstrip-idea-origin', ORIGIN_LABEL[c.origin]));
        idea.appendChild(ih);
        idea.appendChild(el('blockquote', 'provstrip-idea-phrase', c.phrase));
        if (c._n) {
          idea.appendChild(el('div', 'div-exchange-label', 'Where this idea first appeared'));
          renderOrigin(idea, c._n, c._src, ctx);
        }
        list.appendChild(idea);
      });
      panel.appendChild(list);

      var close = el('button', 'provstrip-evidence-close', 'Close');
      close.type = 'button';
      close.addEventListener('click', function () { clearSelection(); segEls[i].focus(); });
      panel.appendChild(close);

      evidence.innerHTML = '';
      evidence.appendChild(panel);
    }

    passages.forEach(function (p, i) {
      var seg = el('button', 'provstrip-seg' + (p.origin ? ' origin-' + p.origin : ' origin-none'));
      seg.type = 'button';
      seg.style.flex = p.words + ' 1 0';
      seg.title = p.name + (p.origin ? ' — ' + ORIGIN_NAME[p.origin] : ' — nothing traced');
      seg.setAttribute('aria-label', p.name + (p.origin ? ', ' + ORIGIN_NAME[p.origin] : ', nothing traced') +
        '. Show the ' + p.concepts.length + ' traced ideas behind it.');
      seg.addEventListener('click', function () {
        if (seg.classList.contains('is-open')) clearSelection(); else showEvidence(p, i);
      });
      bar.appendChild(seg);
      segEls.push(seg);

      var lane = el('div', 'provstrip-trace-lane');
      lane.style.flex = p.words + ' 1 0';
      p.concepts.forEach(function (c) {
        var mark = el('div', 'provstrip-mark origin-' + ORIGIN_OF[c.origin]);
        mark.style.left = (c._at * 100) + '%';
        mark.style.width = Math.min(20, words(c.phrase) / Math.max(1, p.words) * 100) + '%';
        lane.appendChild(mark);
      });
      trace.appendChild(lane);

      var nm = el('span', 'provstrip-name', p.name);
      nm.style.flex = p.words + ' 1 0';
      names.appendChild(nm);
      nameEls.push(nm);
    });

    ['you', 'together', 'coach'].forEach(function (k) {
      var item = el('span', 'provstrip-tally-item');
      var dot = el('span', 'provstrip-dot');
      dot.style.background = FILL_BY[k];
      item.appendChild(dot);
      item.appendChild(el('b', null, pct(by[k]) + '%'));
      item.appendChild(document.createTextNode(' ' + TALLY_NAME[k]));
      tally.appendChild(item);
    });
    var rest = el('span', 'provstrip-tally-item');
    var rdot = el('span', 'provstrip-dot');
    rdot.style.background = 'var(--tau-surface-3)';
    rest.appendChild(rdot);
    rest.appendChild(document.createTextNode('The rest of the draft traced to no single moment'));
    tally.appendChild(rest);

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && bar.classList.contains('is-selecting')) clearSelection();
    });
  }

  root.SessionView = { renderTurnPlot: renderTurnPlot, renderIdeaStrip: renderIdeaStrip };
})(typeof window !== 'undefined' ? window : this);
