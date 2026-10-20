// Workshop room view: the facilitator's presented results (workshop-room.html).
// Reads GET /api/workshops/:id/room: finished conversations, no names, in shuffled order.
(function () {
  'use strict';

  // ── What the page reads ───────────────────────────────────────────────────
  // Pattern names and copy are pattern-guide.js's, the same guide a guest's own
  // results use. Patterns are the ones the analysis stored (GET .../room), never
  // re-detected here, so this view can't disagree with anyone's results.
  var GROUPS = window.PatternGuide.GROUPS;
  var META = {}; GROUPS.forEach(function (g) { g.items.forEach(function (it) { META[it.id] = Object.assign({ group: g.title }, it); }); });
  var order = [];
  GROUPS.forEach(function (g) { g.items.forEach(function (it) { order.push(it.id); }); });

  // session-view.js's per-turn tiers and names, so a square here reads the same as on a guest's plot.
  var TIER = { challenge: 4, rejection: 4, claim: 3, conceptual: 3, pivot: 3, refinement: 2, feedback: 2, narrative: 2, extraction: 1, validation: 1, stuck: 1 };
  var TIER_NAME = { 4: 'High agency', 3: 'Student-led', 2: 'Shared', 1: 'Low agency' };
  var TIER_MEANING = { 4: 'Challenged or turned down what the AI said.', 3: 'Brought their own claim, idea or direction.', 2: 'Shaped what the AI made: refined it, or added to it.', 1: 'Took what the AI gave: asked for it, agreed, or got stuck.' };

  var WORKSHOP_ID = new URLSearchParams(location.search).get('id');
  var roomData = null, done = [], byPattern = {}, ranked = [], seen = [], all = [], turnsAll = [];

  // One conversation as the page draws it: the person's turns, each with the AI's line before it,
  // and the AI's reply after it where the AI backed off. Pattern spans index the person's turns.
  // The AI writes Markdown. On a projector the markers are noise, so they come off: bold and italic marks,
  // heading hashes, and list bullets (shown as •). Line breaks stay, so a list still reads as a list.
  function plain(s) {
    return String(s || '')
      .replace(/\*\*([^*]+)\*\*/g, '$1').replace(/__([^_]+)__/g, '$1')
      .replace(/^\s{0,3}#{1,6}\s+/gm, '')
      .replace(/^\s*[*-]\s+/gm, '• ')
      .replace(/(^|\s)\*([^*\n]+)\*(?=\s|$|[.,;:!?])/g, '$1$2')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  function adapt(c) {
    var out = [], lastAI = null;
    c.turns.forEach(function (t) {
      t = Object.assign({}, t, { text: plain(t.text) });
      if (t.role === 'ai') {
        if (out.length && out[out.length - 1].after == null) out[out.length - 1].after = t.text;
        lastAI = t;
        return;
      }
      var label = t.label || 'narrative';
      out.push({ n: out.length + 1, aiLabel: lastAI ? lastAI.label : null, ai: lastAI ? lastAI.text : null,
        label: label, text: t.text, tier: TIER[label] || 2, push: t.pushback ? Object.assign({}, t.pushback) : null, after: null });
      lastAI = null;
    });
    var found = c.patterns.concat(c.aiMoments).filter(function (f) { return META[f.id] && f.start >= 0 && f.end < out.length; });
    found.filter(function (f) { return f.id === 'ai-caved'; }).forEach(function (f) {
      var t = out[f.start];
      if (t.push && t.after) t.push.reply = t.after;
    });
    return { name: c.key, turns: out, turnsOut: out, found: found };
  }

  // Everything the cards, chart and ring count, recomputed from one read of the room.
  // Keeps the order conversations already had, so a refresh never reshuffles rows under a facilitator.
  function ingest(data) {
    var prior = done.map(function (p) { return p.name; });
    var next = data.conversations.map(adapt);
    next.sort(function (a, b) {
      var ia = prior.indexOf(a.name), ib = prior.indexOf(b.name);
      return (ia < 0 ? 1e9 : ia) - (ib < 0 ? 1e9 : ib);
    });
    roomData = data;
    done = next;
    byPattern = {};
    done.forEach(function (p) {
      p.found.forEach(function (f) {
        var b = byPattern[f.id] = byPattern[f.id] || { people: [], spans: {} };
        if (b.people.indexOf(p.name) < 0) b.people.push(p.name);
        (b.spans[p.name] = b.spans[p.name] || []).push(f);
      });
    });
    ranked = order.filter(function (id) { return byPattern[id]; })
      .sort(function (a, b) { return byPattern[b].people.length - byPattern[a].people.length || order.indexOf(a) - order.indexOf(b); });
    // Walkthrough order, as the cards show them: every pattern, each group's detected ones first by count,
    // then the ones nobody showed. A live room will miss many patterns, and the facilitator still explains them.
    seen = []; all = [];
    GROUPS.forEach(function (g) { ranked.forEach(function (id) { if (META[id].group === g.title) seen.push(id); }); });
    GROUPS.forEach(function (g) {
      seen.forEach(function (id) { if (META[id].group === g.title) all.push(id); });
      g.items.forEach(function (it) { if (!byPattern[it.id]) all.push(it.id); });
    });
    turnsAll = [];
    done.forEach(function (p) { p.turnsOut.forEach(function (t) { turnsAll.push(t); }); });
  }
  function signature(data) {
    return data.joined + '|' + data.working + '|' + data.status + '|' + data.conversations.map(function (c) { return c.key; }).sort().join(',');
  }


  function countOf(id) { return byPattern[id] ? byPattern[id].people.length : 0; }
  var TONE = { 'High-agency patterns': 't-high', 'Low-agency patterns': 't-low', 'What the AI did': 't-ai' };

  var state = { pattern: null, turn: null, readRow: 0 }, quiet = false;
  var REDUCED = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var page = document.getElementById('page'), view = document.getElementById('view');

  function el(tag, attrs, text) {
    var e = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) { if (k === 'class') e.className = attrs[k]; else e.setAttribute(k, attrs[k]); });
    if (text != null) e.textContent = text;
    return e;
  }
  var SVGNS = 'http://www.w3.org/2000/svg';
  function s(tag, attrs) { var e = document.createElementNS(SVGNS, tag); Object.keys(attrs || {}).forEach(function (k) { e.setAttribute(k, attrs[k]); }); return e; }
  function turnsText(spans) {
    var parts = spans.map(function (x) { return x.start === x.end ? String(x.start + 1) : (x.start + 1) + '–' + (x.end + 1); });
    return (spans.length === 1 && spans[0].start === spans[0].end ? 'turn ' : 'turns ') + parts.join(', ');
  }
  function people(n) { return n + (n === 1 ? ' person' : ' people'); }
  function listNames(a) { return a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1]; }

  function spaced(code) { return code ? code.slice(0, 3) + ' ' + code.slice(3) : ''; }
  function renderStatus() {
    var d = roomData;
    document.getElementById('roomName').textContent = d.name;
    document.title = d.name + ' — results';
    var bits = ['Code <b class="num">' + spaced(d.code) + '</b>', d.joined + ' joined', done.length + ' ended their session'];
    if (d.working) bits.push(d.working + ' still chatting');
    if (d.status === 'closed' || d.status === 'expired') bits.push('workshop ended');
    document.getElementById('status').innerHTML = bits.join(' · ');
  }

  // The opening build-in counts each figure up from 0, in step with its landing. Only on the first
  // draw: a refresh shows the new number as it is, and reduced motion skips the count entirely.
  // The final value is in the markup from the start, so the figure is right even if this never runs.
  function countUp(node, to, suffix, delay) {
    if (built || REDUCED || !to) return node;
    node.textContent = '0' + suffix;
    var DUR = 900;
    setTimeout(function () {
      var t0 = null;
      function frame(now) {
        if (t0 == null) t0 = now;
        var k = Math.min(1, (now - t0) / DUR), eased = 1 - Math.pow(1 - k, 3);
        node.textContent = Math.round(to * eased) + suffix;
        if (k < 1) requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
    }, delay);
    return node;
  }

  // ── The opening statement ─────────────────────────────────────────────────
  function buildStatement() {
    var box = el('section', { class: 'statement', 'aria-label': 'The room at a glance' });
    var dl = el('dl', { class: 'stats' });
    [[seen.length, seen.length === order.length ? 'patterns, every one Tau looks for' : 'of the ' + order.length + ' patterns Tau looks for'],
     [turnsAll.length, 'turns typed to the AI'], [done.length, 'conversations']].forEach(function (x, i) {
      var st = el('div', { class: 'stat land', style: '--d0:' + (i * 160) + 'ms' });
      st.appendChild(el('dt', null, x[1]));
      st.appendChild(countUp(el('dd', { class: 'num' }, String(x[0])), x[0], '', i * 160));
      dl.appendChild(st);
    });
    box.appendChild(dl);
    var none = done.filter(function (p) { return !p.found.length; });
    box.appendChild(el('p', { class: 'statement-text fade-up', style: '--d0:520ms' },
      'A pattern is a recognisable shape in how a person and an AI work together. Tau reads each turn the person takes alongside what the AI said around it, ' +
      'and looks across several exchanges for shapes it knows, like pressing the AI on the same point or taking its answers one after another. ' +
      'Patterns matter because they show who is steering the conversation, which no single reply can.'));
    if (!done.length) box.appendChild(el('p', { class: 'room-empty' }, 'Results appear here as people end their sessions.'));
    return box;
  }

  // ── Pattern spread ────────────────────────────────────────────────────────
  var bars = {}, distEl;
  var tip = el('div', { class: 'tip', role: 'tooltip', id: 'tip' }); tip.hidden = true;
  document.body.appendChild(tip);
  window.addEventListener('scroll', function () { tip.hidden = true; }, { passive: true });
  function showTip(id, track) {
    tip.innerHTML = '';
    tip.appendChild(el('b', null, META[id].name));
    tip.appendChild(document.createTextNode(META[id].what));
    tip.hidden = false;
    var fill = track.firstChild.getBoundingClientRect(), area = track.getBoundingClientRect();
    var w = tip.offsetWidth, h = tip.offsetHeight, M = 8;
    var x = Math.min(Math.max(fill.left + fill.width / 2 - w / 2, M), window.innerWidth - w - M);
    var y = fill.top - h - 10;
    if (y < M) y = area.bottom + 10;
    tip.style.transform = 'translate(' + Math.round(x) + 'px,' + Math.round(y) + 'px)';
  }
  function buildDist() {
    var card = el('section', { class: 'card dist-card fade-up', style: '--d0:300ms', 'aria-label': 'Patterns Tau looks for' });
    var head = el('div', { class: 'dist-head' });
    head.appendChild(el('p', { class: 'card-eyebrow' }, 'Patterns Tau looks for'));
    var legend = el('ul', { class: 'legend' });
    [['t-high', 'High agency'], ['t-low', 'Low agency'], ['t-ai', 'What the AI did']].forEach(function (x) {
      var li = el('li'); li.appendChild(el('span', { class: 'sw ' + x[0] })); li.appendChild(document.createTextNode(x[1])); legend.appendChild(li);
    });
    head.appendChild(legend);
    card.appendChild(head);

    var dist = distEl = el('div', { class: 'dist' });
    var grid = el('div', { class: 'dist-grid', 'aria-hidden': 'true' });
    [0, 33.33, 66.67].forEach(function (p) { var l = el('i'); l.style.top = p + '%'; grid.appendChild(l); });
    var base = el('i', { class: 'base' }); base.style.top = '100%'; grid.appendChild(base);
    dist.appendChild(grid);
    var most = Math.max.apply(null, all.map(countOf));
    var flat = order.slice().sort(function (a, b) { return countOf(b) - countOf(a) || order.indexOf(a) - order.indexOf(b); });
    // The three most common patterns are named on the chart; the rest stay unlabelled, so the room asks.
    var top3 = flat.filter(function (id) { return countOf(id) > 0; }).slice(0, 3);
    var cols = el('div', { class: 'dist-cols' });
    flat.forEach(function (id, i) {
      var n = countOf(id);
      var col = el('div', { class: 'dist-col' });
      var track = el('button', { class: 'dist-track', type: 'button', 'aria-pressed': 'false', 'aria-describedby': 'tip',
        'aria-label': META[id].name + ', ' + META[id].group.replace(/s$/, '').toLowerCase() + ', ' + n + ' of ' + done.length + ' conversations' });
      var fill = el('span', { class: 'dist-fill ' + TONE[META[id].group], style: '--i:' + i });
      // A pattern nobody hit keeps a stub in its level colour, so the breadth of what Tau reads stays visible.
      fill.style.height = n ? (n / most * 100) + '%' : '3px';
      track.appendChild(fill);
      var rank = top3.indexOf(id);
      if (rank >= 0) track.appendChild(el('span', { class: 'dist-rank', 'aria-hidden': 'true', style: 'bottom:calc(' + (n / most * 100) + '% + 8px);--r:' + rank }, String(rank + 1)));
      track.addEventListener('click', function () { select(state.pattern === id ? null : id); });
      if (!n) track.classList.add('is-zero');
      track.addEventListener('mouseenter', function () { showTip(id, track); });
      track.addEventListener('focus', function () { showTip(id, track); });
      track.addEventListener('mouseleave', function () { tip.hidden = true; });
      track.addEventListener('blur', function () { tip.hidden = true; });
      col.appendChild(track);
      cols.appendChild(col);
      bars[id] = { bar: track, col: col };
    });
    dist.appendChild(cols);
    if (top3.length) {
      var callout = el('div', { class: 'dist-callout' });
      callout.appendChild(el('p', { class: 'dist-callout-title' }, 'Most common in this room'));
      var list = el('ol', { class: 'dist-callout-list' });
      top3.forEach(function (id, r) {
        var li = el('li', { style: '--r:' + r });
        var b = el('button', { class: 'dist-callout-item', type: 'button' });
        b.appendChild(el('span', { class: 'dist-rank-dot', 'aria-hidden': 'true' }, String(r + 1)));
        b.appendChild(el('span', null, META[id].name));
        b.addEventListener('click', function () { select(state.pattern === id ? null : id); });
        // Naming a pattern lights its bar, the same as hovering the bar itself.
        b.addEventListener('mouseenter', function () { dist.classList.add('has-hot'); bars[id].col.classList.add('is-hot'); });
        b.addEventListener('mouseleave', function () { dist.classList.remove('has-hot'); bars[id].col.classList.remove('is-hot'); });
        li.appendChild(b);
        list.appendChild(li);
      });
      callout.appendChild(list);
      dist.appendChild(callout);
    }
    card.appendChild(dist);
    return card;
  }

  // ── Turns ring: every turn in the finished conversations, split by who steered it ──
  // Finished conversations only, so the split doesn't shift with who is still typing. No split numbers: the room reads the shape.
  // The share of the room's turns the person steered (High agency + Student-led), as a percentage.
  // A count ratio of turns, never a reading or a score: a stated workshop exception to the
  // no-percentage rule (designsystem.md, Workshop surfaces). The two shares always add to 100.
  function buildRing() {
    var total = turnsAll.length, high = turnsAll.filter(function (t) { return t.tier >= 3; }).length;
    var highPct = total ? Math.round(high / total * 100) : 0, lowPct = total ? 100 - highPct : 0;
    var card = el('section', { class: 'card ring-card fade-up', style: '--d0:380ms', 'aria-label': 'High-agency turns' });
    card.appendChild(el('p', { class: 'card-eyebrow' }, 'High-agency turns'));
    if (!total) { card.appendChild(el('p', { class: 'room-empty' }, 'Turns appear here as people end their sessions.')); return card; }
    // The radius is set by the widest stroke, the low arc's 17px edge, plus a pixel, so no arc is clipped.
    var SIZE = 188, SW = 14, EDGE = SW + 3, R = (SIZE - EDGE) / 2 - 1, C = 2 * Math.PI * R, GAP = 6;
    var ring = el('div', { class: 'ring', role: 'img', 'aria-label': highPct + '% of the room’s turns were High agency or Student-led, and ' + lowPct + '% were Shared or Low agency.' });
    var svg = s('svg', { width: SIZE, height: SIZE, viewBox: '0 0 ' + SIZE + ' ' + SIZE, 'aria-hidden': 'true' });
    // Each arc gives up half a cap and half the gap at both ends, so the round caps never touch.
    function arc(cls, from, to) {
      var trim = SW + GAP, len = Math.max(0, (to - from) * C - trim);
      svg.appendChild(s('circle', { class: cls, cx: SIZE / 2, cy: SIZE / 2, r: R, 'stroke-width': SW,
        'stroke-dasharray': len + ' ' + C, 'stroke-dashoffset': -(from * C + trim / 2), style: '--C:' + C }));
    }
    // The pale Low agency colour nearly vanishes on a tinted card, so its arc gets the same thin edge the bars have.
    function arcEdge(from, to) {
      var trim = SW + GAP, len = Math.max(0, (to - from) * C - trim);
      svg.appendChild(s('circle', { class: 'arc-low-edge', cx: SIZE / 2, cy: SIZE / 2, r: R, 'stroke-width': EDGE,
        'stroke-dasharray': len + ' ' + C, 'stroke-dashoffset': -(from * C + trim / 2), style: '--C:' + C }));
    }
    var fh = total ? high / total : 0;
    if (fh >= 1) arc('arc-high', 0, 1);
    else if (fh <= 0) { arcEdge(0, 1); arc('arc-low', 0, 1); }
    else { arc('arc-high', 0, fh); arcEdge(fh, 1); arc('arc-low', fh, 1); }
    ring.appendChild(svg);
    var center = el('div', { class: 'ring-center', 'aria-hidden': 'true' });
    center.appendChild(countUp(el('span', { class: 'ring-total num land', style: '--d0:420ms' }, highPct + '%'), highPct, '%', 420));
    center.appendChild(el('span', { class: 'ring-unit' }, 'of the room’s turns'));
    ring.appendChild(center);
    card.appendChild(ring);
    var lg = el('ul', { class: 'ring-legend' });
    [['t-high', highPct, 'High agency and Student-led', 'The person steered.'], ['t-low', lowPct, 'Shared and Low agency', 'The AI’s lead, taken or shaped.']].forEach(function (x) {
      var li = el('li'); li.appendChild(el('span', { class: 'sw ' + x[0] }));
      li.appendChild(el('span', { class: 'ring-pct num' }, x[1] + '%'));
      var tx = el('span'); tx.appendChild(el('b', null, x[2])); tx.appendChild(document.createTextNode(' ' + x[3])); li.appendChild(tx);
      lg.appendChild(li);
    });
    card.appendChild(lg);
    return card;
  }

  // ── Pattern cards ─────────────────────────────────────────────────────────
  var grid, unseenEl, panel = null, cards = {};
  function buildCards() {
    var sec = el('section', { style: 'display:grid;gap:14px', 'aria-label': 'Patterns in the room' });
    sec.appendChild(el('h2', { class: 'section-title reveal' }, 'Patterns in the room'));
    grid = el('ul', { class: 'pgrid' });
    GROUPS.forEach(function (g) {
      var ids = all.filter(function (id) { return META[id].group === g.title; });
      if (!ids.length) return;
      var gli = el('li', { class: 'group-li reveal' });
      gli.appendChild(el('h3', { class: 'group-title' }, g.title));
      gli.appendChild(el('p', { class: 'group-intro' }, g.intro));
      grid.appendChild(gli);
      ids.forEach(function (id) {
        var li = el('li', { class: 'pcard-li reveal', 'data-id': id });
        var card = el('button', { class: 'pcard' + (byPattern[id] ? '' : ' is-unseen'), type: 'button', 'aria-expanded': 'false' });
        var top = el('span', { class: 'pcard-top' });
        top.appendChild(el('span', { class: 'pcard-name' }, META[id].name));
        top.appendChild(el('span', { class: 'sw ' + TONE[g.title], 'aria-hidden': 'true' }));
        card.appendChild(top);
        card.appendChild(el('p', { class: 'pcard-what' }, META[id].what));
        if (!byPattern[id]) card.appendChild(el('span', { class: 'pcard-flag' }, 'Not seen today'));
        card.addEventListener('click', function () { select(state.pattern === id ? null : id); });
        li.appendChild(card);
        cards[id] = li;
        grid.appendChild(li);
      });
    });
    sec.appendChild(grid);
    return sec;
  }

  // Reveal on scroll, staggered within each batch. Anything already on screen at load shows at once,
  // so the first frame is complete without waiting on an observer.
  function reveal() {
    var items = Array.prototype.slice.call(document.querySelectorAll('.reveal'));
    if (REDUCED || !('IntersectionObserver' in window)) { items.forEach(function (n) { n.classList.add('visible'); }); return; }
    var io = new IntersectionObserver(function (entries) {
      var k = 0;
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        var n = e.target;
        setTimeout(function () { n.classList.add('visible'); }, (k++) * 70);
        io.unobserve(n);
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });
    items.forEach(function (n) {
      if (n.getBoundingClientRect().top < window.innerHeight) n.classList.add('visible');
      else io.observe(n);
    });
  }

  // FLIP: measure, change the layout, then slide everything from where it was to where it is now.
  function flip(mutate) {
    var items = Array.prototype.slice.call(grid.children).filter(function (n) { return n !== panel; });
    if (unseenEl) items.push(unseenEl);
    var first = items.map(function (n) { return n.getBoundingClientRect(); });
    mutate();
    if (REDUCED || quiet) return;
    items.forEach(function (n, k) {
      var last = n.getBoundingClientRect();
      var dx = first[k].left - last.left, dy = first[k].top - last.top;
      if (!dx && !dy) return;
      n.classList.add('visible');
      n.style.transition = 'none';
      n.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
    });
    requestAnimationFrame(function () { requestAnimationFrame(function () {
      items.forEach(function (n) {
        if (!n.style.transform) return;
        n.style.transition = 'transform 420ms var(--ease-soft)';
        n.style.transform = '';
      });
    }); });
  }

  // The panel goes after the last card on the picked card's row, so the row stays whole above it.
  function placePanel() {
    var li = cards[state.pattern], top = li.offsetTop, last = li, sib = li.nextElementSibling;
    while (sib && sib.classList.contains('pcard-li') && sib.offsetTop === top) { last = sib; sib = sib.nextElementSibling; }
    last.after(panel);
    panel.style.setProperty('--caret', (li.offsetLeft + li.offsetWidth / 2) + 'px');
  }

  function select(id) {
    flip(function () {
      if (panel) { panel.remove(); panel = null; }
      Object.keys(cards).forEach(function (k) { cards[k].firstChild.setAttribute('aria-expanded', String(k === id)); });
      Object.keys(bars).forEach(function (k) { bars[k].bar.setAttribute('aria-pressed', String(k === id)); bars[k].col.classList.toggle('is-picked', k === id); });
      if (distEl) distEl.classList.toggle('has-pick', !!id);
      state.pattern = id; state.turn = null;
      if (id) { cards[id].classList.add('visible'); state.readRow = 0; panel = buildPanel(id); placePanel(); fillPanel(panel, !quiet); }
    });
    if (!id || quiet) return;
    var cardTop = cards[id].getBoundingClientRect().top, panelTop = panel.getBoundingClientRect().top;
    if (cardTop < 0 || panelTop > window.innerHeight * 0.55) {
      window.scrollTo({ top: window.scrollY + cardTop - 16, behavior: REDUCED ? 'auto' : 'smooth' });
    }
  }

  // ── The panel: why it matters, the conversations that showed it, and a reader ──
  // buildPanel makes the frame; fillPanel draws plots and reader once the panel is in the page,
  // because the plots are fitted to the width they actually get.
  function buildPanel(id) {
    var m = META[id], b = byPattern[id], idx = all.indexOf(id);
    var box = el('li', { class: 'ppanel', 'aria-label': m.name + ' in this room' });

    var why = el('div');
    why.appendChild(el('p', { class: 'why-label' }, 'Why it matters'));
    why.appendChild(el('p', { class: 'why' }, m.why));
    box.appendChild(why);
    if (!b) {
      box._empty = true;
      box.appendChild(el('p', { class: 'room-line' }, 'Nobody’s conversation showed this today. Most patterns need several similar turns in a row, so a short session often misses them. It’s one to watch for in longer work.'));
    } else {
    if (id === 'ai-caved') {
      var disputed = done.filter(function (p) { return p.turnsOut.some(function (t) { return t.push && t.push.target === 'claim'; }); }).length;
      box.appendChild(el('p', { class: 'room-line' }, 'The AI backed off for ' + b.people.length + ' of the ' + people(disputed) + ' who disputed one of its claims.'));
    }

    var ph = el('div', { class: 'plots-head' });
    var phl = el('p');
    phl.appendChild(el('strong', null, 'In ' + b.people.length + ' of ' + done.length + ' conversations,'));
    phl.appendChild(document.createTextNode(' each in its own turn order.'));
    ph.appendChild(phl);
    var replay = el('button', { class: 'link', type: 'button' }, 'Replay');
    replay.addEventListener('click', function () { state.turn = null; fillPanel(panel, true); });
    ph.appendChild(replay);
    box.appendChild(ph);

    var body = el('div', { class: 'p-body' });
    box._plots = el('div', { class: 'p-plots' });
    box._reader = el('aside', { class: 'p-reader', 'aria-live': 'polite', 'aria-label': 'The exchange' });
    body.appendChild(box._plots);
    body.appendChild(box._reader);
    box.appendChild(body);
    box._id = id;

    var key = el('ul', { class: 'key' });
    [4, 3, 2, 1].forEach(function (tier) {
      var li = el('li');
      li.appendChild(el('span', { class: 'sq-sw', style: 'background:var(--ag-' + tier + ')' }));
      var tx = el('span'); tx.appendChild(el('b', null, TIER_NAME[tier])); tx.appendChild(document.createTextNode(' ' + TIER_MEANING[tier]));
      li.appendChild(tx); key.appendChild(li);
    });
    var bl = el('li'); bl.appendChild(el('span', { class: 'band-sw' }));
    var btx = el('span'); btx.appendChild(el('b', null, 'Tinted column')); btx.appendChild(document.createTextNode(' The turns that made the pattern. The rest of the conversation is faded.'));
    bl.appendChild(btx); key.appendChild(bl);
    box.appendChild(key);
    }

    var foot = el('div', { class: 'panel-foot' });
    var close = el('button', { class: 'link', type: 'button' }, 'Close');
    close.addEventListener('click', function () { var id0 = state.pattern; select(null); cards[id0].firstChild.focus({ preventScroll: true }); });
    foot.appendChild(close);
    var steps = el('div', { class: 'nav-steps' });
    var prev = el('button', { class: 'btn', type: 'button', 'aria-label': 'Previous pattern' }, '←');
    var next = el('button', { class: 'btn btn-primary', type: 'button' }, idx < all.length - 1 ? 'Next pattern →' : 'Finish');
    if (idx === 0) prev.setAttribute('disabled', '');
    prev.addEventListener('click', function () { step(-1); });
    next.addEventListener('click', function () { step(1); });
    steps.appendChild(prev);
    steps.appendChild(el('span', { class: 'step-count num' }, (idx + 1) + ' / ' + all.length));
    steps.appendChild(next);
    foot.appendChild(steps);
    box.appendChild(foot);
    var hint = el('p', { class: 'hint' });
    hint.innerHTML = '<kbd>←</kbd> <kbd>→</kbd> move between patterns · <kbd>Esc</kbd> close';
    box.appendChild(hint);
    return box;
  }

  function rowsFor(id) {
    var b = byPattern[id];
    return b.people.map(function (key) {
      var p = done.filter(function (r) { return r.name === key; })[0];
      return { p: p, key: key, spans: b.spans[key] };
    });
  }

  function fillPanel(box, animate) { if (box._empty) return; drawPlots(box, animate); drawReader(box); }

  // Plots always fit their row, never scroll: turn width = the room left after the lane labels, over the longest conversation.
  var PADT = 8, AXIS = 18, COL_MAX = 64;
  var LANE_NAME = { 4: 'High agency', 3: 'Student-led', 2: 'Shared', 1: 'Low agency' };
  function drawPlots(box, animate) {
    var host = box._plots, id = box._id;
    host.innerHTML = '';
    host.classList.toggle('animate', !!animate);
    var rows = rowsFor(id);
    var width = Math.max.apply(null, rows.map(function (r) { return r.p.turns.length; }));
    var avail = Math.max(160, host.clientWidth - 20);
    // On a narrow row the lane names give their room to the turns; the key below still names the levels.
    var LANE_W = avail < 520 ? 6 : 92;
    var col = Math.min(COL_MAX, (avail - LANE_W - 6) / width);
    var SQ = Math.round(Math.min(20, Math.max(7, col * 0.42)));
    var ROWH = SQ + 5, PLOT_H = PADT * 2 + ROWH * 3 + SQ, H = PLOT_H + AXIS;
    var W = Math.round(LANE_W + col * width + 6);
    function xOf(c) { return LANE_W + c * col + (col - SQ) / 2; }
    function yOf(tier) { return PADT + (4 - tier) * ROWH; }
    var readRow = state.turn ? rows.map(function (r) { return r.key; }).indexOf(state.turn.key) : state.readRow;

    rows.forEach(function (r, ri) {
      var off = 0, p = r.p;
      var well = el('div', { class: 'well' + (ri === readRow ? ' is-open' : '') });
      var svg = s('svg', { width: W, height: H, role: 'group',
        'aria-label': 'Conversation ' + (ri + 1) + ', ' + p.turns.length + ' turns, ' + META[id].name + ' at ' + turnsText(r.spans),
        style: '--row:' + ri + ';--n:' + p.turns.length });
      [4, 3, 2, 1].forEach(function (tier) {
        var gy = yOf(tier) + SQ / 2;
        svg.appendChild(s('line', { class: 'grid-line', x1: LANE_W - 6, x2: W - 4, y1: gy, y2: gy }));
        // Lane names once, on the first conversation; the rows below share its columns.
        if (ri === 0 && LANE_W > 6) { var lt = s('text', { class: 'lane-label', x: LANE_W - 12, y: gy + 4, 'text-anchor': 'end' }); lt.textContent = LANE_NAME[tier]; svg.appendChild(lt); }
      });
      // The read-back: a soft column sweeps the conversation turn by turn, then the pattern's column lands.
      svg.appendChild(s('rect', { class: 'scan', x: LANE_W + off * col + 2, y: 2, width: col - 4, height: PLOT_H - 4, rx: 8,
        style: '--d:' + ((p.turns.length - 1) * col) + 'px' }));
      r.spans.forEach(function (f) {
        svg.appendChild(s('rect', { class: 'band', x: LANE_W + (off + f.start) * col + 2, y: 2, width: (f.end - f.start + 1) * col - 4, height: PLOT_H - 4, rx: 9 }));
      });
      p.turnsOut.forEach(function (t, ti) {
        var inSpan = r.spans.some(function (f) { return ti >= f.start && ti <= f.end; });
        var picked = state.turn && state.turn.key === r.key && state.turn.idx === ti;
        var g = s('g', { class: 'turn' + (picked ? ' is-picked' : ''), tabindex: 0, role: 'button',
          'aria-label': 'Conversation ' + (ri + 1) + ', turn ' + t.n + ': read as ' + t.label + ', ' + TIER_NAME[t.tier] });
        var x = xOf(off + ti);
        g.appendChild(s('rect', { class: 'sq ag-' + t.tier + (inSpan ? '' : ' out'), x: x, y: yOf(t.tier), width: SQ, height: SQ, rx: Math.round(SQ / 4), style: '--t:' + ti }));
        // Turn numbers only where there's room for them; the tinted column still marks the pattern.
        if (col >= 22 || inSpan) { var num = s('text', { class: 'turn-num' + (inSpan ? ' in' : ''), x: x + SQ / 2, y: H - 4, 'text-anchor': 'middle' }); num.textContent = t.n; g.appendChild(num); }
        // Hit area the full column, for a projector pointer or a phone.
        g.appendChild(s('rect', { x: LANE_W + (off + ti) * col, y: 0, width: col, height: H, fill: 'transparent' }));
        function pick() { state.turn = picked ? null : { key: r.key, idx: ti }; if (!state.turn) state.readRow = ri; fillPanel(panel, false); }
        g.addEventListener('click', pick);
        g.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } });
        svg.appendChild(g);
      });
      well.appendChild(svg);
      host.appendChild(well);
    });
  }

  // The reader: by default the pattern's own turns in one conversation, as text; a picked square shows just that turn.
  function drawReader(box) {
    var reader = box._reader, rows = rowsFor(box._id);
    reader.innerHTML = '';
    var ri = state.turn ? rows.map(function (r) { return r.key; }).indexOf(state.turn.key) : state.readRow;
    if (ri < 0 || ri >= rows.length) ri = 0;
    var r = rows[ri];

    var head = el('div', { class: 'reader-head' });
    head.appendChild(el('p', { class: 'reader-title' }, 'Conversation ' + (ri + 1) + ' of ' + rows.length));
    if (rows.length > 1) {
      var nav = el('div', { class: 'reader-nav' });
      var pv = el('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Previous conversation' }, '‹');
      var nx = el('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Next conversation' }, '›');
      if (ri === 0) pv.setAttribute('disabled', '');
      if (ri === rows.length - 1) nx.setAttribute('disabled', '');
      pv.addEventListener('click', function () { state.turn = null; state.readRow = ri - 1; fillPanel(panel, false); });
      nx.addEventListener('click', function () { state.turn = null; state.readRow = ri + 1; fillPanel(panel, false); });
      nav.appendChild(pv); nav.appendChild(nx);
      head.appendChild(nav);
    }
    reader.appendChild(head);

    var list = el('div', { class: 'exchange' });
    if (state.turn) {
      reader.appendChild(el('p', { class: 'reader-sub' }, 'Turn ' + (state.turn.idx + 1)));
      appendTurn(list, r.p, state.turn.idx, true);
      reader.appendChild(list);
      var back = el('button', { class: 'link', type: 'button' }, '← The pattern in this conversation');
      back.addEventListener('click', function () { state.readRow = ri; state.turn = null; fillPanel(panel, false); });
      reader.appendChild(back);
    } else {
      reader.appendChild(el('p', { class: 'reader-sub' }, META[box._id].name + ' · ' + turnsText(r.spans)));
      r.spans.forEach(function (f) { for (var ti = f.start; ti <= f.end; ti++) appendTurn(list, r.p, ti, false); });
      reader.appendChild(list);
      reader.appendChild(el('p', { class: 'hint' }, 'Pick any square to read that turn.'));
    }
  }

  function appendTurn(list, p, ti, withPatterns) {
    var t = p.turnsOut[ti];
    if (t.ai) { var a = el('div', { class: 'line ai' }); a.appendChild(el('span', { class: 'who' }, 'The AI')); a.appendChild(document.createTextNode(t.ai)); list.appendChild(a); }
    var me = el('div', { class: 'line person' });
    var who = el('span', { class: 'who' });
    who.appendChild(document.createTextNode('The teacher · turn ' + t.n));
    var tag = el('span', { class: 'tag' });
    tag.appendChild(el('span', { class: 'sw', style: 'background:var(--ag-' + t.tier + ')' }));
    tag.appendChild(document.createTextNode(TIER_NAME[t.tier] + ' · ' + t.label));
    who.appendChild(tag);
    me.appendChild(who);
    me.appendChild(document.createTextNode(t.text));
    list.appendChild(me);
    if (t.push && t.push.reply) { var r = el('div', { class: 'line ai' }); r.appendChild(el('span', { class: 'who' }, 'The AI replied')); r.appendChild(document.createTextNode(t.push.reply)); list.appendChild(r); }
    if (t.push && t.push.target === 'claim' && t.push.reason === false) {
      list.appendChild(el('p', { class: 'teach' }, 'They disputed a claim here without saying why, and the AI changed its answer anyway.'));
    }
    if (withPatterns) {
      var inP = p.found.filter(function (f) { return ti >= f.start && ti <= f.end; }).map(function (f) { return META[f.id].name; });
      if (inP.length) list.appendChild(el('p', { class: 'reader-sub' }, 'Part of ' + listNames(inP) + '.'));
    }
  }

  // ── Levels of agency: an explainer, not a reading of this room ────────────
  // Definitions are tau-dimensions.md's agency ladder, verbatim. The levels are told apart by the ask
  // (answers taken → ideas developed → own ideas led with → own ideas challenged and changed).
  // Illustrations are scripted and say so. Strongest reading at the top of the ladder.
  var LEVELS = [
    { id: 'passive', name: 'Passive', n: 1, real: { verdict: 'Not Passive', text: 'Most of what the writer asked for changed what the guide says: 11 of the 14 changes they directed. They also wrote their own introduction and had the AI put it in.', quote: 'Change the introduction to the following after checking the spelling…' }, ask: 'Answers taken',
      def: 'The student asked the AI for the answers and used them almost unchanged.',
      look: 'The ask is for the finished thing, and the finished thing is what reaches the work.',
      illo: [['you', 'Write me a paragraph on whether schools should ban phones.'],
             ['ai', 'Schools should ban phones in class. They divide attention, fuel bullying and take time from learning…'],
             ['you', 'Great, thanks.']],
      work: 'The paragraph went into the essay almost word for word.' },
    { id: 'reactive', name: 'Reactive', n: 2, real: { verdict: 'Not Reactive', text: 'The writer led with their own frame, the format, the reader and the reason the guide exists, before the AI had suggested anything.', quote: 'I need to write a 1000 word essay in the format I want about bicycle maintenance… usable for female riders who rely on partners…' }, ask: 'Ideas developed',
      def: 'The AI gave the student the ideas; they made them into work of their own.',
      look: 'The AI got there first, and the student did real work on what it offered.',
      illo: [['ai', 'Three arguments for a ban: attention, cyberbullying, and more face-to-face time at break.'],
             ['you', 'I’ll use the attention one. Can you explain it more?'],
             ['you', 'Ok. I’ll put it in my own words, with an example from my class.']],
      work: 'The AI’s argument, rewritten around the student’s own example.' },
    { id: 'directive', name: 'Directive', n: 3, real: { verdict: 'Reads Directive', text: 'They set the format, the audience and the five systems in their first message, then took the AI through them one at a time. The guide at the end is the one they specified at the start.', quote: 'Let’s break it down by system.' }, ask: 'Own ideas led with',
      def: 'The student led with their own ideas and used the AI to develop them.',
      look: 'The student arrives with a position, and the AI is sent to fetch, sort and sharpen.',
      illo: [['you', 'A ban is too blunt. I want to argue for teaching phone habits instead. Find me schools that tried that.'],
             ['ai', 'Several schools in Victoria piloted structured use before the state ban…'],
             ['you', 'Just the secondary schools. They fit my point.']],
      work: 'The student’s argument, supported by material they asked for.' },
    { id: 'transformative', name: 'Transformative', n: 4, real: { verdict: 'Not Transformative', text: 'Their thinking didn’t change across the session: the five-system structure came from the AI in its first reply and never changed. The level was also held at Directive because the one claim taken unchecked was the replacement reference, moments after that same source had been caught inventing one.', quote: null }, ask: 'Own ideas challenged and changed',
      def: 'The student led the AI to investigate and challenge their ideas, developing new ones that changed the work.',
      look: 'Directive, plus a change: the student goes looking for the case against their own idea, and the idea moves.',
      illo: [['you', 'My view: teach habits, don’t ban. What’s the strongest case against me?'],
             ['ai', 'Impulse control is still developing in younger teens, so a habits-based rule may fail where it matters most.'],
             ['you', 'That’s real for my Year 7s. So age matters more than the policy.']],
      work: 'The essay’s claim changed, from “don’t ban” to “it depends on age”.' }
  ];

  // The four dimensions: tau-dimensions.md's settled schemes, in plain words. Grid order, read row by row:
  // the student's own ideas (conversation, then work), then the AI's (conversation, then work).
  // Readings are designsystem.md's band labels, strongest first; a teacher never sees a band numeral.
  var DIMS = [
    { id: 'pq', ex: { band: 4, count: 'set the agenda in 10 of 11 parts', quote: 'Let’s break it down by system.', note: 'Format, audience and structure, before the AI had proposed anything.', counter: 'Brakes. The AI decided what mattered there, and the writer’s four questions stayed inside its list.' }, why: 'Typing the most isn’t the same as steering. This asks who decided what the work was about.', matters: 'A student can ask question after question and still hand the AI every decision that matters. What counts is who decides what the work is about and how it gets done. That is the difference between using the AI and following it.', cite: 'Chu-Carroll & Brown, 1997', source: 'Studied how control moves between two parties in a conversation, and separated who leads the talk (asking and answering) from who leads the task (deciding the goal). Tau reads the second.', boundary: 'Raising your own direction counts here even if it never reaches the finished work. Challenging something the AI said belongs to Calibrated Skepticism instead.', short: 'Who decides how the task gets done.', name: 'Prompting Quality', q: 'Did they drive the chat?', row: 0, col: 0,
      scheme: 'Read as task initiative (Chu-Carroll & Brown, 1997): who decides how the task gets done. Taking turns in a conversation isn’t the same as steering it.',
      unit: 'a stretch of the session working towards one goal',
      looks: [['Set the goal', 'Named what to work on, or opened a direction nobody had raised.'],
              ['Brought the deciding detail', 'Gave their own context, reader or constraint without being asked.'],
              ['Overrode on a reason', 'Turned down the AI’s answer and said what it failed against.']],
      yes: ['I’m writing for Year 7 parents, so keep it to the safety argument.', 'They set the constraint the rest of the work had to meet.'],
      no: ['What should I write about?', 'The AI will decide the direction.'],
      bands: ['Set the direction and held it', 'Led most of it, handed over at the hard parts', 'Steered on details, never on direction', 'The AI set the agenda throughout'] },
    { id: 'oc', ex: { band: 2, count: '3 of 12 ideas theirs or reorganised', quote: 'The closing is very specific to me, lets make it more general.', note: 'They reframed who the closing was for, on their own.', counter: 'The five-system structure the whole guide hangs on came from the AI in its first reply, and it never changed.' }, why: 'An AI’s idea in the student’s own words is still the AI’s idea. This asks whose thinking the work carries.', matters: 'Rewording is easy to mistake for thinking. This looks past the sentences at the ideas: did they change because of what the student was trying to argue, or arrive in the form they already had?', cite: 'Bereiter & Scardamalia, 1987', source: 'Their research on how writers work found two different processes: telling what you know as it comes, and transforming it to serve a goal. The second is where the thinking shows.', boundary: 'It reads whose idea, not whose words. Word-for-word copying is a separate question.', short: 'Whether ideas changed in the making, or arrived as they already were.', name: 'Original Contribution', q: 'Is the thinking theirs?', row: 0, col: 1,
      scheme: 'Read as knowledge transforming versus knowledge telling (Bereiter & Scardamalia, 1987): did an idea change because of what the writer was trying to do, or arrive as it already was?',
      unit: 'an idea in the finished work',
      looks: [['Transforming', 'The idea was reworked to serve the writer’s own argument.'],
              ['Telling', 'The idea arrived in the form it already had.'],
              ['Whose idea, not whose words', 'An AI idea in the student’s own voice is still the AI’s idea.']],
      yes: ['The essay argues age matters more than the policy, built from a point the student pushed on.', 'The idea changed in the making.'],
      no: ['The essay lists the AI’s three reasons, in the AI’s order.', 'The content arrived as it already was.'],
      bands: ['The frame and the argument are theirs', 'Their own argument, the AI’s structure', 'Their own examples on the AI’s frame', 'The ideas are the AI’s'] },
    { id: 'cs', ex: { band: 3, count: 'took a position on 8 of 18 claims', quote: 'British Cycling (2022). Women’s bike fit guide. This doesn’t exist.', note: 'Sourcing: they knew the reference was invented.', counter: 'When the AI admitted inventing that reference it replaced it with Kotler et al. (2023), and the writer took the replacement without checking it.' }, why: 'An AI states everything in the same confident tone. This asks whether the student checked before building on it.', matters: 'Checking is the habit that keeps a weak or ill-fitting claim out of the work. Tau doesn’t decide whether the AI was right, which it can’t know. It reads whether the student applied a check at all.', cite: 'Wineburg, 1991', source: 'Studied how historians read documents and found three habits novices skip: asking who wrote it, checking it against other sources, and placing it in its context. A chat with an AI is close to the reading those habits were built for.', boundary: 'Only claims the student engaged with are read. Asking for a different format isn’t a check, so it isn’t counted either way.', short: 'Whether the AI’s claims were questioned, checked or tested against the student’s own situation.', name: 'Calibrated Skepticism', q: 'Did they check what they were told?', row: 1, col: 0,
      scheme: 'Read with Wineburg’s source-evaluation heuristics, built for studying how people judge what they read. It doesn’t judge whether the AI was right.',
      unit: 'an AI claim the student took a position on',
      looks: [['Sourcing', 'Asked where it comes from, who says it, or whether it can be checked.'],
              ['Corroboration', 'Checked it against something else: another source, or what they know.'],
              ['Contextualization', 'Tested whether it holds for their own situation.']],
      yes: ['Who says teachers overwhelmingly support bans? Is that a survey?', 'Sourcing: they asked where the claim came from.'],
      no: ['Make that a bullet list.', 'A format request checks nothing, so it isn’t counted at all.'],
      bands: ['Questioned what the work rested on', 'Questioned often, let key claims through', 'Questioned small things only', 'Took it at face value'] },
    { id: 'su', ex: { band: 3, count: '11 of 14 directed changes altered meaning', quote: 'I wont be carrying a plug kit, I just carry extra tubes.', note: 'Changed what the guide advises, to fit their own riding.', counter: 'Three of the fourteen were formatting, the table, the m-dashes and the heading order, and those were the ones they asked for most often.' }, why: 'Questioning the AI only matters if it changes what survives. This reads the consequence.', matters: 'A student can push back on everything and still keep the AI’s draft as it came. This reads the changes the student made: whether they touched the form of the work or its meaning.', cite: 'Faigley & Witte, 1981', source: 'A widely used way of classifying revisions, separating changes to the surface of a text from changes to what it says and how it’s built. It codes whether a change was substantive, never whether it was good.', boundary: 'It reads only the AI’s material. When the student’s own idea is refined with the AI’s help, that belongs to Original Contribution.', short: 'Whether the changes the student directed touched the meaning, or only the form.', name: 'Selective Use', q: 'What survived, and why?', row: 1, col: 1,
      scheme: 'Read as revision analysis (Faigley & Witte, 1981): whether a change touched the form of the work or its meaning. Not whether the change was good.',
      unit: 'a change the student directed',
      looks: [['Surface', 'Changed the form: wording, punctuation, layout.'],
              ['What it says', 'Changed a claim or a fact.'],
              ['How it’s built', 'Changed how the work is organised, or who it’s for.']],
      yes: ['Cut the cyberbullying point and lead with attention.', 'Changed how the argument is built.'],
      no: ['Fix the commas.', 'A surface change: the form moved, the meaning didn’t.'],
      bands: ['Reshaped the work, not just the sentences', 'Changed what it said, not how it was built', 'Changed the wording, not the substance', 'Kept the AI’s draft as it came'] }
  ];
  var ROWS = ['The student’s own ideas', 'The AI’s ideas'], COLS = ['In the conversation', 'In the finished work'];

  var levelsRefresh = function () {};
  var lvStep = 0, howReplay = function () {}, ladderMove = function () {};

  // Three sections on the Levels of agency tab: the levels, how a level is decided, the four dimensions.
  function buildLevels() {
    var wrap = el('div', { class: 'lv-wrap' });
    wrap.appendChild(buildLadder());
    wrap.appendChild(buildHow());
    levelsRefresh = function () { ladderMove(); howReplay(); };
    return wrap;
  }

  // ── 1. The levels: a ladder (strongest at the top) and the picked level's detail ──
  function buildLadder() {
    var sec = el('section', { class: 'lv-sec', 'aria-label': 'The four levels of agency' });
    var head = el('div', { class: 'lv-sec-head' });
    head.appendChild(el('h2', { class: 'section-title' }, 'The four levels of agency'));
    head.appendChild(el('p', { class: 'levels-intro' },
      'A pattern is a moment in a conversation. A level is a reading of a whole piece of work: where the student’s thinking entered it. ' +
      'Today’s chats aren’t read for a level, because five minutes is too short for one to stand on.'));
    head.appendChild(provenanceNote());
    sec.appendChild(head);

    var card = el('div', { class: 'levels-card' });
    var ladder = el('nav', { class: 'ladder', 'aria-label': 'Levels' });
    var ind = el('span', { class: 'ladder-ind', 'aria-hidden': 'true' });
    ladder.appendChild(ind);
    var rungs = el('ol', { class: 'rungs' }), btns = [];
    LEVELS.slice().reverse().forEach(function (lv) {
      var li = el('li');
      var b = el('button', { class: 'rung', type: 'button', style: '--lv:var(--lv-' + lv.n + ')' });
      b.appendChild(el('span', { class: 'rung-dot', 'aria-hidden': 'true' }));
      var tx = el('span', { class: 'rung-text' });
      tx.appendChild(el('span', { class: 'rung-name' }, lv.name));
      tx.appendChild(el('span', { class: 'rung-ask' }, lv.ask));
      b.appendChild(tx);
      if (lv.real.verdict.indexOf('Reads') === 0) b.appendChild(el('span', { class: 'mine-tag' }, 'This session'));
      b.addEventListener('click', function () { go(lv.n - 1); });
      btns[lv.n - 1] = b;
      li.appendChild(b); rungs.appendChild(li);
    });
    ladder.appendChild(rungs);
    card.appendChild(ladder);
    var detail = el('div', { class: 'lv-detail', 'aria-live': 'polite' });
    card.appendChild(detail);
    sec.appendChild(card);

    function go(i) { lvStep = i; render(true); }
    function moveInd() {
      var b = btns[lvStep];
      if (!b.offsetHeight) return;
      ind.style.transform = 'translateY(' + b.offsetTop + 'px)';
      ind.style.height = b.offsetHeight + 'px';
      ind.style.background = 'var(--lv-' + (lvStep + 1) + '-wash)';
    }
    function render(animate) {
      btns.forEach(function (b, k) { b.setAttribute('aria-current', k === lvStep ? 'step' : 'false'); });
      moveInd();
      detail.innerHTML = '';
      var body = el('div', { class: 'lv-body' + (animate ? ' lv-anim' : '') });
      levelBody(body, LEVELS[lvStep]);
      detail.appendChild(body);
    }
    ladderMove = moveInd;
    window.addEventListener('resize', moveInd);
    render(false);
    return sec;
  }

  function levelBody(body, lv) {
    var top = el('div', { class: 'lv-top', style: '--i:0' });
    top.appendChild(el('span', { class: 'lv-chip', style: 'background:var(--lv-' + lv.n + '-chip);color:var(--lv-' + lv.n + '-chip-ink)' }, lv.name));
    top.appendChild(el('span', { class: 'lv-ask' }, 'The ask: ' + lv.ask.toLowerCase()));
    body.appendChild(top);
    body.appendChild(el('p', { class: 'lv-def', style: '--i:1' }, lv.def));
    body.appendChild(el('p', { class: 'lv-look', style: '--i:2' }, lv.look));
    var real = el('div', { class: 'lv-real', style: '--i:3;--lv:var(--lv-' + lv.n + ');--lv-wash:var(--lv-' + lv.n + '-wash)' });
    var rh = el('div', { class: 'lv-real-head' });
    rh.appendChild(el('p', { class: 'why-label' }, 'In the real session'));
    rh.appendChild(el('span', { class: 'lv-verdict' + (lv.real.verdict.indexOf('Reads') === 0 ? ' is-mine' : '') }, lv.real.verdict));
    real.appendChild(rh);
    real.appendChild(el('p', { class: 'lv-real-text' }, lv.real.text));
    if (lv.real.quote) {
      var q = el('div', { class: 'line person', style: '--i:4' });
      q.appendChild(el('span', { class: 'who' }, 'The writer'));
      q.appendChild(document.createTextNode(lv.real.quote));
      real.appendChild(q);
    }
    body.appendChild(real);
  }

  // ── 2. How a level is decided: builds left to right, sources → questions → level → rules ──
  function buildHow() {
    var sec = el('section', { class: 'lv-sec', 'aria-label': 'How Tau decides a level' });
    var head = el('div', { class: 'lv-sec-head' });
    head.appendChild(el('h2', { class: 'section-title' }, 'How Tau decides a level'));
    head.appendChild(el('p', { class: 'levels-intro' }, 'A level is never read from one chat on its own, and never from a single number.'));
    sec.appendChild(head);

    var card = el('div', { class: 'how-card' });
    var flow = el('div', { class: 'how-flow' });
    var seq = 0; // build order: each element takes the next beat
    function beat(node, gap) { seq += gap || 1; node.style.setProperty('--b', seq); return node; }

    var srcCol = el('div', { class: 'how-col' });
    srcCol.appendChild(beat(el('p', { class: 'why-label hb' }, 'Three things, read together'), 0));
    [['The conversation', 'What the student asked for, and what they did with each answer.'],
     ['The finished work', 'What reached it, and whose thinking it carries.'],
     ['The assignment', 'What was asked for, and whether the way they worked suited it.']].forEach(function (x) {
      var d = el('div', { class: 'how-tile hb' }); d.appendChild(el('b', null, x[0])); d.appendChild(el('span', null, x[1])); srcCol.appendChild(beat(d));
    });
    flow.appendChild(srcCol);
    flow.appendChild(beat(arrow(), 1.5));

    var qCol = el('div', { class: 'how-col' });
    qCol.appendChild(beat(el('p', { class: 'why-label hb' }, 'Four questions, each asked of all three'), 1));
    var q = el('div', { class: 'how-q' });
    DIMS.forEach(function (d, k) {
      var c = el('button', { class: 'how-tile how-qcell hb', type: 'button' });
      c.appendChild(el('b', null, d.q));
      c.appendChild(el('span', null, d.name + ' →'));
      c.addEventListener('click', function () { showTab(2); dimGo(k); window.scrollTo({ top: 0, behavior: REDUCED ? 'auto' : 'smooth' }); });
      q.appendChild(beat(c, 0.7));
    });
    qCol.appendChild(q);
    flow.appendChild(qCol);
    flow.appendChild(beat(arrow(), 1.5));

    var lCol = el('div', { class: 'how-col' });
    lCol.appendChild(beat(el('p', { class: 'why-label hb' }, 'One level'), 1));
    var lv = el('div', { class: 'how-tile how-level hb' });
    beat(lv);
    var dots = el('span', { class: 'how-dots', 'aria-hidden': 'true' });
    [4, 3, 2, 1].forEach(function (n, k) { dots.appendChild(el('i', { style: 'background:var(--lv-' + n + ');width:' + (40 + n * 14) + '%;--k:' + k })); });
    lv.appendChild(dots);
    lv.appendChild(el('span', null, 'Read from the shape of the four answers, what the assignment asked for, and whether the student’s control grew or slipped across the session.'));
    lCol.appendChild(lv);
    flow.appendChild(lCol);
    card.appendChild(flow);

    var rules = el('ul', { class: 'how-rules' });
    seq += 1;
    [['Never added up', 'The four answers are never summed or averaged. A strong reading and a weak one don’t make a middling one.'],
     ['Always shown', 'Every reading comes with the moments that support it, quoted, and the one moment that doesn’t.'],
     ['Not enough here', 'When there’s nothing to read, Tau says so, instead of reading it as low.'],
     ['Not a grade', 'Quality isn’t on the ladder. Whether the work is any good is the teacher’s call.']].forEach(function (x) {
      var li = el('li', { class: 'hb' }); li.appendChild(el('b', null, x[0])); li.appendChild(el('span', null, x[1])); rules.appendChild(beat(li, 0.6));
    });
    card.appendChild(rules);
    sec.appendChild(card);

    // Build when the card comes into view; opening the tab again rebuilds it for the room.
    function play() { card.classList.remove('build'); void card.offsetWidth; card.classList.add('build'); }
    var armed = true;
    if (!REDUCED && 'IntersectionObserver' in window) {
      card.classList.add('pre');
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) { if (e.isIntersecting && armed) { armed = false; card.classList.remove('pre'); play(); } });
      }, { threshold: 0.35 });
      io.observe(card);
      howReplay = function () { armed = true; card.classList.add('pre'); card.classList.remove('build'); io.unobserve(card); io.observe(card); };
    }
    return sec;
  }
  function arrow() {
    var a = el('span', { class: 'how-arrow hb', 'aria-hidden': 'true' });
    a.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path pathLength="1" d="M5 12h14M13 6l6 6-6 6"/></svg>';
    return a;
  }

  // ── Dimensions tab: the four questions a level is read from, one at a time ──
  // Each dimension is told as a story, most important first: the question, why it matters, how Tau
  // reads it, a real example, what a reading says. The research and boundaries sit underneath as
  // background, quieter but still on the page.
  var dimStep = 0, dimMove = function () {}, dimGo = function () {};
  function buildDimTab() {
    var sec = el('section', { class: 'lv-sec', 'aria-label': 'The four dimensions' });
    var head = el('div', { class: 'lv-sec-head' });
    head.appendChild(el('h2', { class: 'section-title' }, 'The four dimensions'));
    head.appendChild(el('p', { class: 'levels-intro' },
      'A level is read from four questions. Each owns one corner of the same grid: whose ideas, and where they show up. Each is read with a published coding scheme, so what it means was settled by research, not invented for Tau.'));
    head.appendChild(provenanceNote());
    sec.appendChild(head);

    var card = el('div', { class: 'levels-card dims-card' });
    var nav = el('nav', { class: 'ladder dim-nav', 'aria-label': 'Dimensions' });
    var ind = el('span', { class: 'ladder-ind', 'aria-hidden': 'true' });
    nav.appendChild(ind);
    var btns = [];
    ROWS.forEach(function (rname, r) {
      nav.appendChild(el('p', { class: 'dim-nav-group' }, rname));
      DIMS.forEach(function (d, k) {
        if (d.row !== r) return;
        var b = el('button', { class: 'rung dim-rung', type: 'button' });
        b.appendChild(miniGrid(d));
        var tx = el('span', { class: 'rung-text' });
        tx.appendChild(el('span', { class: 'rung-name' }, d.q));
        tx.appendChild(el('span', { class: 'rung-ask' }, d.name + ' · ' + COLS[d.col].toLowerCase()));
        b.appendChild(tx);
        b.addEventListener('click', function () { go(k); });
        btns[k] = b;
        nav.appendChild(b);
      });
    });
    card.appendChild(nav);
    var detail = el('div', { class: 'lv-detail', 'aria-live': 'polite' });
    card.appendChild(detail);
    sec.appendChild(card);

    function go(k) { dimStep = k; render(true); }
    function moveInd() {
      var b = btns[dimStep];
      if (!b || !b.offsetHeight) return;
      ind.style.transform = 'translateY(' + b.offsetTop + 'px)';
      ind.style.height = b.offsetHeight + 'px';
    }
    function render(animate) {
      btns.forEach(function (b, k) { b.setAttribute('aria-current', k === dimStep ? 'step' : 'false'); });
      moveInd();
      detail.innerHTML = '';
      var body = el('div', { class: 'lv-body dim-story' + (animate ? ' lv-anim' : '') });
      dimDetail(body, DIMS[dimStep]);
      detail.appendChild(body);
    }
    dimMove = moveInd;
    dimGo = go;
    window.addEventListener('resize', moveInd);
    render(false);
    return sec;
  }

  function provenanceNote() {
    return el('p', { class: 'real-note' },
      'The examples come from a real session: an adult co-writing a bicycle maintenance guide with Claude.ai, not school work. ' +
      'Their words are as written; the AI’s are shortened. It was read by hand against Tau’s schemes, not computed by today’s tool.');
  }

  function dimDetail(body, d) {
    // 1. The question, and what it means.
    var top = el('div', { class: 'lv-top', style: '--i:0' });
    top.appendChild(miniGrid(d));
    top.appendChild(el('span', { class: 'lv-chip dim-chip' }, d.name));
    top.appendChild(el('span', { class: 'lv-ask' }, ROWS[d.row] + ' · ' + COLS[d.col].toLowerCase()));
    body.appendChild(top);
    body.appendChild(el('h3', { class: 'lv-def', style: '--i:1' }, d.q));
    body.appendChild(el('p', { class: 'lv-look', style: '--i:2' }, d.short));

    // 2. Why it matters.
    var why = el('div', { class: 'story-step', style: '--i:3' });
    why.appendChild(el('p', { class: 'why-label' }, 'Why it matters'));
    why.appendChild(el('p', { class: 'why' }, d.matters));
    body.appendChild(why);

    // 3. How Tau reads it.
    var how = el('div', { class: 'story-step', style: '--i:4' });
    how.appendChild(el('p', { class: 'why-label' }, 'How Tau reads it'));
    var looks = el('ul', { class: 'lv-sources' });
    d.looks.forEach(function (x) { var li = el('li'); li.appendChild(el('b', null, x[0])); li.appendChild(el('span', null, x[1])); looks.appendChild(li); });
    how.appendChild(looks);
    body.appendChild(how);

    // 4. A real example: the moment that counted, and the one that didn't.
    var ex = el('div', { class: 'story-step', style: '--i:5' });
    ex.appendChild(el('p', { class: 'why-label' }, 'In the real session · ' + d.ex.count));
    var pair = el('div', { class: 'dim-pair' });
    var yes = el('div', { class: 'dim-ex yes' });
    yes.appendChild(el('span', { class: 'who' }, 'A moment that counted'));
    yes.appendChild(el('p', { class: 'dim-quote' }, d.ex.quote));
    yes.appendChild(el('p', { class: 'dim-why' }, d.ex.note));
    pair.appendChild(yes);
    var no = el('div', { class: 'dim-ex no' });
    no.appendChild(el('span', { class: 'who' }, 'The one that didn’t'));
    no.appendChild(el('p', { class: 'dim-plain' }, d.ex.counter));
    pair.appendChild(no);
    ex.appendChild(pair);
    body.appendChild(ex);

    // 5. What a reading says, with this session's marked.
    var rd = el('div', { class: 'story-step', style: '--i:6' });
    rd.appendChild(el('p', { class: 'why-label' }, 'What a reading says, strongest first'));
    var scale = el('ol', { class: 'dim-scale' });
    var mine = 4 - d.ex.band;
    d.bands.forEach(function (b, j) {
      var li = el('li', { class: j === mine ? 'is-mine' : '', style: '--k:' + (4 - j) });
      li.appendChild(el('span', null, b));
      if (j === mine) li.appendChild(el('span', { class: 'mine-tag' }, 'This session'));
      scale.appendChild(li);
    });
    rd.appendChild(scale);
    rd.appendChild(el('p', { class: 'dim-unit' }, 'Or “Not enough here”, when there’s nothing to read. That’s never the same as the lowest reading.'));
    body.appendChild(rd);

    // 6. Background: reference, set quieter.
    var bg = el('div', { class: 'dim-background', style: '--i:7' });
    var c1 = el('div');
    c1.appendChild(el('p', { class: 'bg-label' }, 'The research'));
    c1.appendChild(el('p', { class: 'bg-strong' }, d.cite));
    c1.appendChild(el('p', null, d.source));
    var c2 = el('div');
    c2.appendChild(el('p', { class: 'bg-label' }, 'What it counts'));
    c2.appendChild(el('p', { class: 'bg-strong' }, d.unit.charAt(0).toUpperCase() + d.unit.slice(1)));
    c2.appendChild(el('p', null, 'Never a single turn: how someone splits their typing isn’t how they think.'));
    var c3 = el('div');
    c3.appendChild(el('p', { class: 'bg-label' }, 'Where it sits'));
    var nbList = el('ul', { class: 'dim-nb-list' });
    DIMS.forEach(function (o) {
      if (o === d || (o.row !== d.row && o.col !== d.col)) return;
      var li = el('li');
      li.appendChild(el('b', null, o.name));
      li.appendChild(document.createTextNode(o.row === d.row
        ? ' also reads ' + ROWS[d.row].toLowerCase() + ', ' + COLS[o.col].toLowerCase() + '.'
        : ' also looks ' + COLS[d.col].toLowerCase() + ', at ' + ROWS[o.row].toLowerCase() + '.'));
      nbList.appendChild(li);
    });
    c3.appendChild(nbList);
    c3.appendChild(el('p', null, d.boundary));
    bg.appendChild(c1); bg.appendChild(c2); bg.appendChild(c3);
    body.appendChild(bg);
  }

  function miniGrid(d) {
    var mini = el('span', { class: 'mini-grid', 'aria-hidden': 'true' });
    for (var r = 0; r < 2; r++) for (var c = 0; c < 2; c++) mini.appendChild(el('i', r === d.row && c === d.col ? { class: 'on' } : null));
    return mini;
  }

  function step(d) {
    var i = all.indexOf(state.pattern) + d;
    if (i < 0) return;
    select(i >= all.length ? null : all[i]);
  }
  document.addEventListener('keydown', function (e) {
    if (!state.pattern || (typeof currentTab !== 'undefined' && currentTab !== 0) || (e.target && e.target.getAttribute && e.target.getAttribute('role') === 'tab')) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
    else if (e.key === 'Escape') { select(null); }
  });
  var rt;
  window.addEventListener('resize', function () {
    clearTimeout(rt);
    rt = setTimeout(function () { if (panel) { panel.remove(); placePanel(); fillPanel(panel, false); } }, 120);
  });

  // Session patterns, built from the current read. A refresh rebuilds it without the opening
  // animations and reopens whatever pattern was open, so a facilitator mid-explanation keeps their place.
  var built = false;
  function buildRoom() {
    var openId = state.pattern, keepTurn = state.turn, keepRow = state.readRow;
    view.innerHTML = '';
    bars = {}; cards = {}; panel = null; distEl = null; state.pattern = null;
    view.appendChild(buildStatement());
    var row = el('div', { class: 'viz-row' });
    row.appendChild(buildDist());
    row.appendChild(buildRing());
    view.appendChild(row);
    view.appendChild(buildCards());
    if (built) {
      Array.prototype.forEach.call(view.querySelectorAll('.reveal'), function (n) { n.classList.add('visible'); });
      if (openId && cards[openId]) {
        quiet = true; select(openId); quiet = false;
        state.turn = keepTurn; state.readRow = keepRow;
        if (panel) fillPanel(panel, false);
      }
    } else {
      reveal();
    }
    built = true;
  }
  var levelsPanel = document.getElementById('levels-panel');
  levelsPanel.appendChild(buildLevels());
  var dimsPanel = document.getElementById('dims-panel');
  dimsPanel.appendChild(buildDimTab());

  // ── Tabs: Session patterns (what these teachers did), then Levels of agency and Dimensions (the model, not this room) ──
  var HASHES = ['#room', '#levels', '#dimensions'];
  var tabs = [document.getElementById('tab-room'), document.getElementById('tab-levels'), document.getElementById('tab-dims')], panels = [view, levelsPanel, dimsPanel];
  var tabInd = document.querySelector('.tab-ind'), currentTab = 0;
  function moveTabInd() {
    var t = tabs[currentTab];
    tabInd.style.transform = 'translateX(' + t.offsetLeft + 'px)';
    tabInd.style.width = t.offsetWidth + 'px';
  }
  function showTab(i, focus) {
    if (i !== currentTab && state.pattern && i !== 0) select(null);
    currentTab = i;
    tabs.forEach(function (t, k) { t.setAttribute('aria-selected', String(k === i)); t.tabIndex = k === i ? 0 : -1; });
    panels.forEach(function (p, k) { p.hidden = k !== i; p.classList.toggle('tab-in', k === i); });
    moveTabInd();
    if (i === 1) levelsRefresh();
    if (i === 2) dimMove();
    if (focus) tabs[i].focus();
    try { history.replaceState(null, '', HASHES[i]); } catch (e) {}
  }
  tabs.forEach(function (t, k) {
    t.addEventListener('click', function () { showTab(k); });
    t.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault(); e.stopPropagation();
        showTab((currentTab + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length, true);
      }
    });
  });
  window.addEventListener('resize', moveTabInd);
  showTab(Math.max(0, HASHES.indexOf(location.hash)));

  function showError(msg) {
    view.innerHTML = '';
    view.appendChild(el('p', { class: 'room-error' }, msg));
  }
  var lastSig = null;
  async function load(first) {
    var data = await api('/api/workshops/' + encodeURIComponent(WORKSHOP_ID) + '/room');
    var sig = signature(data);
    if (!first && sig === lastSig) return;
    lastSig = sig;
    ingest(data);
    renderStatus();
    buildRoom();
    // The opening sequence plays once; later reads change the numbers without replaying it.
    if (first) setTimeout(function () { page.classList.remove('play'); }, 2600);
  }
  if (!WORKSHOP_ID) { location.replace('workshop.html'); return; }
  load(true).catch(function (err) {
    showError(err && err.message === 'workshop not found'
      ? 'This workshop doesn’t exist any more, or it isn’t one of yours.'
      : 'Couldn’t load the results. Check your connection and reload the page.');
  });
  // Live while the room is finishing: new results arrive without a reload. Paused while the tab
  // is hidden or the facilitator is on Levels of agency, where nothing depends on the room.
  setInterval(function () {
    if (document.hidden || currentTab !== 0 || !lastSig) return;
    load(false).catch(function () {});
  }, 15000);
})();
