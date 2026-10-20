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

  var GROUPS = [
    {
      title: 'High-agency patterns',
      intro: 'The person sets the direction and uses the AI as a resource.',
      items: [
        { id: 'challenge-arc', name: 'Challenge Arc',
          what: 'Two or more questions in a row pressing the AI on the same point.',
          why: 'Asked once, an AI’s answer sounds final. Asked again, it often shifts — pressing is how you find out how solid it was.' },
        { id: 'rejection-redirect', name: 'Rejection → Redirect',
          what: 'Turning down what the AI produced, then saying what you want instead.',
          why: 'A refusal on its own leaves the AI to guess again. The redirect is where the person’s intent enters the work.' },
        { id: 'claim-support', name: 'Claim-Support Cycle',
          what: 'A claim of your own, a question to understand it, a request for material, then back to your claim.',
          why: 'The AI is being used as a source for the person’s argument, not as its author.' },
        { id: 'argument-engaged', name: 'Argument Engaged',
          what: 'The AI argued a position and you answered it — questioning, rejecting or reshaping it — instead of absorbing it.',
          why: 'AI arguments arrive fluent and confident. Answering one is the habit that stops it becoming the person’s view by default.' },
        { id: 'correction-held', name: 'Held Ground',
          what: 'The AI told you something you said was wrong, and you kept your position.',
          why: 'Being corrected by an AI is not the same as being wrong. Holding is only right when you are — which is why the useful question afterwards is how you decided.' },
        { id: 'assertion-questioned', name: 'Questioned Assertion',
          what: 'The AI stated something as an established fact, and you questioned it.',
          why: 'Definitions and facts come in the same confident tone as everything else an AI says. Questioning one is a habit, and it can be taught.' },
        { id: 'extraction-landing', name: 'Extraction → Insight',
          what: 'You asked the AI to produce something, then did something of your own with it.',
          why: 'Asking for output is neutral. The turn after it is where the thinking shows.' },
      ],
    },
    {
      title: 'Low-agency patterns',
      intro: 'The AI sets the direction and the person goes along with it.',
      items: [
        { id: 'extraction-loop', name: 'Extraction Loop',
          what: 'Three or more requests in a row for the AI to produce something, with nothing of your own in between.',
          why: 'Each answer becomes the starting point for the next request, so the conversation goes wherever the AI takes it.' },
        { id: 'validation-spiral', name: 'Validation Spiral',
          what: 'Asking and confirming, back and forth, for four turns or more.',
          why: '“Great, now…” turns approval into a rhythm — and agreeing is exactly what an AI is built to invite.' },
        { id: 'helplessness-loop', name: 'Helplessness Loop',
          what: 'Saying you’re stuck, then handing the next turns to the AI.',
          why: 'Being stuck is the moment most worth protecting, and the easiest one to give away.' },
        { id: 'flitting', name: 'Flitting',
          what: 'Three or more changes of topic with nothing developed in between.',
          why: 'An AI will follow any new direction instantly, so nothing in the conversation pushes back on abandoning a thread.' },
        { id: 'missed-argument', name: 'Missed Argument',
          what: 'The AI argued a position for three turns in a row, and you stayed passive through all of them.',
          why: 'An argument nobody answers becomes the conversation’s conclusion.' },
        { id: 'capitulation', name: 'Capitulation',
          what: 'The AI corrected you, and you accepted the correction without testing it.',
          why: 'An AI corrects with the same confidence whether or not it is right.' },
        { id: 'assertion-unquestioned', name: 'Unquestioned Assertion',
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

  function renderPatternGuide(host, patterns, aiMoments) {
    if (!host) return;
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

    GROUPS.forEach(function (g) {
      var section = el('section', 'pguide-group');
      section.appendChild(el('h3', 'pguide-title', g.title));
      section.appendChild(el('p', 'pguide-intro', g.intro));
      var list = el('div', 'pguide-list');
      g.items.forEach(function (it) {
        var spans = by[it.id];
        var item = el('div', 'pguide-item' + (spans ? ' is-found' : ''));
        var head = el('div', 'pguide-head');
        head.appendChild(el('span', 'pguide-name', it.name));
        if (spans) head.appendChild(el('span', 'pguide-found', 'In your chat · ' + turnsText(spans)));
        item.appendChild(head);
        item.appendChild(el('p', 'pguide-what', it.what));
        item.appendChild(el('p', 'pguide-why', it.why));
        list.appendChild(item);
      });
      section.appendChild(list);
      host.appendChild(section);
    });
  }

  root.PatternGuide = { render: renderPatternGuide, GROUPS: GROUPS };
})(typeof window !== 'undefined' ? window : this);
