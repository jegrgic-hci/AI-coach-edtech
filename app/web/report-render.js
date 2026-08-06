// Ported verbatim from the single-file CTA (index.html) — the mature
// student results presentation. Do not edit the CTA; edit this copy.

const AI_PATTERNS = {
  correction: [
    /\bactually,?\s+(that|this|it)\b/gi,
    /\bthat.?s (not quite|incorrect|not right|not accurate)\b/gi,
    /\bto clarify\b/gi,
    /\bmore (accurately|precisely|specifically)\b/gi,
  ],
  instruction: [
    /\byou (should|could|might|need to|want to)\b/gi,
    /\bhere.?s how (to|you)\b/gi,
    /\bstep \d/gi,
    /\btry (doing|adding|removing|changing|rephrasing)\b/gi,
    /\bI (recommend|suggest|would suggest|would recommend)\b/gi,
  ],
  example: [
    /\bfor (example|instance)\b/gi,
    /\bsuch as\b/gi,
    /\bto illustrate\b/gi,
    /\bimagine\b/gi,
  ],
  argument: [
    /\bthis (suggests|indicates|means|shows|implies)\b/gi,
    /\btherefore\b/gi,
    /\bas a result\b/gi,
    /\bone could argue\b/gi,
  ],
  definition: [
    /\b(is defined as|refers to|can be described as)\b/gi,
    /\bthe term\b/gi,
    /\bin (other words|simpler terms|essence)\b/gi,
    /\bmeans (that)?\b/gi,
  ],
};

const RESPONSIVE_MARKERS = /^(but|so|actually|wait|however|that.?s|i see|ok so|right so|i (think|feel|believe|disagree|agree)|what about|that (makes|doesn.?t)|hmm|hm\b)/i;

function assessQuality(text) {
  const words = text.trim().split(/\s+/).length;
  const CONNECTORS = /\b(because|since|therefore|however|although|whereas|but|nevertheless|despite|given that|in contrast|on the other hand|this means|which suggests|which implies)\b/gi;
  const connectors = (text.match(CONNECTORS) || []).length;
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 4).length;
  if (words >= 20 && (connectors >= 1 || sentences >= 2)) return "deep";
  if (words >= 10 && connectors >= 1) return "deep";
  return "surface";
}

function classifyStudentTurnFallback(text) {
  // Priority: extraction > rejection > challenge > refinement > pivot > stuck > feedback > validation > conceptual > claim
  const order = ["extraction","rejection","challenge","refinement","pivot","stuck","feedback","validation","conceptual","claim"];
  for (const label of order) {
    const patterns = STUDENT_PATTERNS[label];
    for (const p of patterns) p.lastIndex = 0;
    if (patterns.some(p => p.test(text))) return label;
  }
  const wordCount = text.trim().split(/\s+/).length;
  return wordCount >= 8 ? "narrative" : "validation";
}

function classifyAITurnFallback(text) {
  for (const [label, patterns] of Object.entries(AI_PATTERNS)) {
    for (const p of patterns) p.lastIndex = 0;
    if (patterns.some(p => p.test(text))) return label;
  }
  return "content";
}
// ─── Turn Sequence Chart ──────────────────────────────────────────────────────

const PAT_DESCRIPTIONS = {
  "challenge-arc":      "Multiple consecutive challenge turns — the student is actively questioning AI responses rather than accepting them. Strong independent thinking signal.",
  "rejection-redirect": "The student rejected an AI response and immediately refined their query. Shows evaluative thinking: the student knows what they want and what doesn't work.",
  "claim-support":      "A full claim-building cycle: the student stated a position, sought conceptual grounding, extracted evidence, then returned to the claim. High-structure thinking.",
  "extraction-landing": "An extraction followed by a high-agency turn (claim, challenge, or refinement). The student used AI content as a springboard rather than copying it.",
  "extraction-loop":    "Three or more consecutive extractions. The student may be mining AI for content without engaging critically — watch for whether extracted ideas appear in the essay unchanged.",
  "validation-spiral":  "Alternating extraction and validation turns. The student is asking AI to confirm its own outputs without independent evaluation.",
  "helplessness-loop":  "A stuck turn followed by continued passivity. The student is relying on AI to resolve difficulty rather than working through it independently.",
  "flitting":           "Multiple topic pivots without substantive turns between them. Suggests the student is exploring without depth — no thread is being developed.",
  "argument-engaged":   "The AI made an argument and you pushed back with a challenge, rejection, or refinement. This is exactly the kind of critical engagement that develops independent thinking.",
  "missed-argument":    "The AI was making arguments but your responses stayed passive. These are missed opportunities to evaluate, challenge, or build on what the AI was presenting.",
  "correction-held":    "The AI pushed back on something you said, and you engaged with it — challenging, refining, or holding your position with a reason — instead of immediately accepting the correction. Calibrated skepticism: not every AI correction is right.",
  "capitulation":       "The AI corrected or disagreed with you and you accepted it right away, without asking why or pushing back. Sometimes the AI is right — but folding every time it disagrees lets its confidence, not the evidence, decide. Worth asking: was the correction actually justified?",
  "assertion-questioned":"The AI stated something as established fact and you questioned it — asking for evidence or pushing back — rather than taking it at face value. This is the habit that keeps AI honest.",
  "assertion-unquestioned":"The AI asserted a definition or fact and you accepted it or built on it without checking. Confident phrasing isn't evidence — a quick “how do you know that?” would have been worth it here.",
};

// s = student chip, a = ai chip; strings are rendered as separators/annotations
const PATTERN_SEQUENCES = {
  "challenge-arc": [
    {t:"a",l:"argument / claim"}, "→", {t:"s",l:"challenge"},
    "→", {t:"a",l:"responds"}, "→", {t:"s",l:"challenge"}, "→", "···",
  ],
  "argument-engaged": [
    {t:"a",l:"argument"}, "→", {t:"s",l:"challenge / rejection / refinement"},
  ],
  "rejection-redirect": [
    {t:"a",l:"content / instruction"}, "→", {t:"s",l:"rejection"},
    "→", {t:"a",l:"responds"}, "→", {t:"s",l:"refinement"},
  ],
  "claim-support": [
    {t:"s",l:"claim"}, "→", {t:"a",l:"responds"}, "→", {t:"s",l:"conceptual"},
    "→", {t:"a",l:"explains"}, "→", {t:"s",l:"extraction"}, "→", {t:"s",l:"claim"},
  ],
  "extraction-landing": [
    {t:"a",l:"content"}, "→", {t:"s",l:"extraction"},
    "→", {t:"a",l:"responds"}, "→", {t:"s",l:"claim / challenge / refinement"},
  ],
  "extraction-loop": [
    {t:"a",l:"content"}, "→", {t:"s",l:"extraction"},
    "→", {t:"a",l:"content"}, "→", {t:"s",l:"extraction"}, "→", "···",
  ],
  "validation-spiral": [
    {t:"a",l:"content"}, "→", {t:"s",l:"extraction"},
    "→", {t:"a",l:"content"}, "→", {t:"s",l:"validation"}, "→", "···", "×4+",
  ],
  "helplessness-loop": [
    {t:"a",l:"content / instruction"}, "→", {t:"s",l:"stuck"},
    "→", {t:"a",l:"rescues"}, "→", {t:"s",l:"extraction"}, "→", "···",
  ],
  "missed-argument": [
    {t:"a",l:"argument"}, "→", {t:"s",l:"extraction / validation"},
    "→", {t:"a",l:"argument"}, "→", {t:"s",l:"extraction / validation"}, "→", "···", "×3+",
  ],
  "flitting": [
    {t:"a",l:"content"}, "→", {t:"s",l:"pivot"},
    "→", {t:"a",l:"follows topic"}, "→", {t:"s",l:"pivot"}, "→", "···", "×3+",
  ],
  "correction-held": [
    {t:"a",l:"correction"}, "→", {t:"s",l:"challenge / rejection / refinement"},
  ],
  "assertion-questioned": [
    {t:"a",l:"definition"}, "→", {t:"s",l:"challenge / rejection"},
  ],
  "capitulation": [
    {t:"a",l:"correction"}, "→", {t:"s",l:"validation / extraction"},
  ],
  "assertion-unquestioned": [
    {t:"a",l:"definition"}, "→", {t:"s",l:"validation / extraction"},
  ],
};

// ── Divergence value scale ──────────────────────────────────────────────────
const TURN_VALUE = {
  challenge:  4, rejection:  4,
  claim:      3, conceptual: 3, pivot: 3,
  refinement: 2,
  narrative:  1, feedback:   1,
  extraction: 0,
  validation: -1,
  stuck:      -2,
};

function getAILabelBefore(studentIdx, classified) {
  const studentTurns = classified.filter(t => t.role === "student");
  if (studentIdx >= studentTurns.length) return null;
  const target = studentTurns[studentIdx];
  const pos    = classified.indexOf(target);
  for (let i = pos - 1; i >= 0; i--) {
    if (classified[i].role === "ai") return classified[i].label || "content";
  }
  return null;
}

// Same walk-back as getAILabelBefore, returning the turn itself — used to
// check whether the specific AI content a student pushed back on ever shows
// up as a landed concept in the essay (My Session's "kept it out" group).
function getAITurnBefore(studentIdx, classified) {
  const studentTurns = classified.filter(t => t.role === "student");
  if (studentIdx >= studentTurns.length) return null;
  const target = studentTurns[studentIdx];
  const pos    = classified.indexOf(target);
  for (let i = pos - 1; i >= 0; i--) {
    if (classified[i].role === "ai") return classified[i];
  }
  return null;
}

function detectPatterns(classified) {
  const student  = classified.filter(t => t.role === "student");
  const labels   = student.map(t => t.label || "extraction");
  const aiLabels = student.map((_, i) => getAILabelBefore(i, classified));
  const n = labels.length;
  const patterns = [];

  const HIGH_LABELS    = new Set(["claim", "refinement", "challenge", "rejection"]);
  const PASSIVE_LABELS = new Set(["extraction", "validation", "stuck"]);

  // High agency: challenge arc (2+ consecutive challenges)
  for (let i = 0; i < n - 1; i++) {
    if (labels[i] === "challenge" && labels[i + 1] === "challenge") {
      let end = i + 1;
      while (end + 1 < n && labels[end + 1] === "challenge") end++;
      patterns.push({ start: i, end, id: "challenge-arc", label: "Challenge Arc", tier: "high" });
      i = end;
    }
  }

  // High agency: rejection → redirect
  for (let i = 0; i < n - 1; i++) {
    if (labels[i] === "rejection" && labels[i + 1] === "refinement") {
      patterns.push({ start: i, end: i + 1, id: "rejection-redirect", label: "Rejection → Redirect", tier: "high" });
    }
  }

  // High agency: claim-support cycle (claim → conceptual → extraction → claim)
  for (let i = 0; i < n - 3; i++) {
    if (labels[i] === "claim" && labels[i+1] === "conceptual" && labels[i+2] === "extraction" && labels[i+3] === "claim") {
      patterns.push({ start: i, end: i + 3, id: "claim-support", label: "Claim-Support Cycle", tier: "high" });
    }
  }

  // High agency (AI-enhanced): student challenged/rejected/refined directly after an AI argument
  for (let i = 0; i < n; i++) {
    if (HIGH_LABELS.has(labels[i]) && aiLabels[i] === "argument") {
      let end = i;
      while (end + 1 < n && HIGH_LABELS.has(labels[end + 1]) && aiLabels[end + 1] === "argument") end++;
      if (end > i || aiLabels[i] === "argument") {
        patterns.push({ start: i, end, id: "argument-engaged", label: "Argument Engaged", tier: "high" });
        i = end;
      }
    }
  }

  // Medium → High (AI-enhanced): extraction with landing — elevate to high if AI was arguing
  for (let i = 0; i < n - 1; i++) {
    if (labels[i] === "extraction" && HIGH_LABELS.has(labels[i + 1])) {
      const tier = aiLabels[i] === "argument" ? "high" : "medium";
      patterns.push({ start: i, end: i + 1, id: "extraction-landing", label: "Extraction → Insight", tier });
    }
  }

  // Low: extraction loop (3+ consecutive extractions)
  for (let i = 0; i < n - 2; i++) {
    if (labels[i] === "extraction" && labels[i+1] === "extraction" && labels[i+2] === "extraction") {
      let end = i + 2;
      while (end + 1 < n && labels[end + 1] === "extraction") end++;
      patterns.push({ start: i, end, id: "extraction-loop", label: "Extraction Loop", tier: "low" });
      i = end;
    }
  }

  // Low: validation spiral (extraction/validation alternating 4+ turns)
  for (let i = 0; i < n - 3; i++) {
    const EV = new Set(["extraction", "validation"]);
    if (EV.has(labels[i]) && EV.has(labels[i+1]) && labels[i] !== labels[i+1]) {
      let end = i + 1;
      while (end + 1 < n && EV.has(labels[end + 1])) end++;
      if (end - i >= 3) {
        patterns.push({ start: i, end, id: "validation-spiral", label: "Validation Spiral", tier: "low" });
        i = end;
      }
    }
  }

  // Low: helplessness loop (stuck followed by extraction/stuck sequence)
  for (let i = 0; i < n - 1; i++) {
    if (labels[i] === "stuck") {
      let end = i;
      while (end + 1 < n && (labels[end + 1] === "stuck" || labels[end + 1] === "extraction")) end++;
      if (end > i) {
        patterns.push({ start: i, end, id: "helplessness-loop", label: "Helplessness Loop", tier: "low" });
        i = end;
      }
    }
  }

  // Low: flitting (3+ pivots with no substantive turns between)
  for (let i = 0; i < n; i++) {
    if (labels[i] === "pivot") {
      let pivotCount = 1, end = i;
      while (end + 1 < n && !HIGH_LABELS.has(labels[end + 1]) && labels[end + 1] !== "conceptual") {
        end++;
        if (labels[end] === "pivot") pivotCount++;
      }
      if (pivotCount >= 3) {
        patterns.push({ start: i, end, id: "flitting", label: "Flitting", tier: "low" });
        i = end;
      }
    }
  }

  // Low (AI-enhanced): student was passive while AI was arguing (3+ consecutive missed arguments)
  for (let i = 0; i < n - 2; i++) {
    if (PASSIVE_LABELS.has(labels[i]) && aiLabels[i] === "argument") {
      let end = i;
      while (end + 1 < n && PASSIVE_LABELS.has(labels[end + 1]) && aiLabels[end + 1] === "argument") end++;
      if (end - i >= 2) {
        patterns.push({ start: i, end, id: "missed-argument", label: "Missed Argument", tier: "low" });
        i = end;
      }
    }
  }

  // Interaction moments (single-turn, keyed on the AI turn that set up the choice).
  // The AI turn and the student's response carry opposite meanings depending on
  // each other, so these can only be read from the two-sided record.
  const ENGAGED_RESP = new Set(["challenge", "rejection", "refinement"]);
  const FOLD_RESP    = new Set(["validation", "extraction"]);
  for (let i = 0; i < n; i++) {
    // Pushback moment: the AI corrected or disagreed with the student
    if (aiLabels[i] === "correction") {
      if (ENGAGED_RESP.has(labels[i])) {
        patterns.push({ start: i, end: i, id: "correction-held", label: "Held Ground", tier: "high" });
      } else if (FOLD_RESP.has(labels[i])) {
        patterns.push({ start: i, end: i, id: "capitulation", label: "Capitulation", tier: "low" });
      }
    }
    // Assertion moment: the AI stated a definition/fact as established
    if (aiLabels[i] === "definition") {
      if (labels[i] === "challenge" || labels[i] === "rejection") {
        patterns.push({ start: i, end: i, id: "assertion-questioned", label: "Questioned Assertion", tier: "high" });
      } else if (FOLD_RESP.has(labels[i])) {
        patterns.push({ start: i, end: i, id: "assertion-unquestioned", label: "Unquestioned Assertion", tier: "low" });
      }
    }
  }

  return patterns;
}

function renderPatternGuide() {
  const HIGH = [
    { id: "challenge-arc",        label: "Challenge Arc" },
    { id: "argument-engaged",     label: "Argument Engaged" },
    { id: "rejection-redirect",   label: "Rejection → Redirect" },
    { id: "claim-support",        label: "Claim-Support Cycle" },
    { id: "extraction-landing",   label: "Extraction → Insight" },
    { id: "correction-held",      label: "Held Ground" },
    { id: "assertion-questioned", label: "Questioned Assertion" },
  ];
  const PASSIVE = [
    { id: "extraction-loop",        label: "Extraction Loop" },
    { id: "validation-spiral",      label: "Validation Spiral" },
    { id: "helplessness-loop",      label: "Helplessness Loop" },
    { id: "missed-argument",        label: "Missed Argument" },
    { id: "capitulation",           label: "Capitulation" },
    { id: "assertion-unquestioned", label: "Unquestioned Assertion" },
    { id: "flitting",               label: "Flitting" },
  ];
  function renderSeq(id) {
    const seq = PATTERN_SEQUENCES[id];
    if (!seq) return "";
    const chips = seq.map(item => {
      if (typeof item === "string") {
        const cls = (item === "→" || item === "↓") ? "dt-cat-seq-arrow" : "dt-cat-seq-cont";
        return `<span class="${cls}">${esc(item)}</span>`;
      }
      return `<span class="dt-cat-seq-chip--${item.t}">${esc(item.l)}</span>`;
    }).join("");
    return `<details class="dt-cat-seq-details">
      <summary class="dt-cat-seq-toggle">See pattern</summary>
      <div class="dt-cat-seq">${chips}</div>
      <div class="dt-cat-seq-legend"><span class="dt-cat-seq-chip--a">AI</span> <span class="dt-cat-seq-chip--s">student</span></div>
    </details>`;
  }
  function cardGroup(patterns, cls) {
    return patterns.map((p, i) =>
      `<div class="dt-cat-card">
        <span class="dt-cat-card-name ${cls}">${esc(p.label)}</span>
        <p class="dt-cat-card-desc">${esc(PAT_DESCRIPTIONS[p.id] || "")}</p>
        ${renderSeq(p.id)}
      </div>${i < patterns.length - 1 ? '<hr class="dt-cat-divider">' : ""}`
    ).join("");
  }
  document.getElementById("patternGuideContent").innerHTML = `
    <div class="dt-cat-section-label" style="color:var(--tau-band-4-fg);">High-agency patterns</div>
    ${cardGroup(HIGH, "dt-cat-card-name--high")}
    <div class="dt-cat-section-label" style="color:var(--tau-band-2-fg);margin-top:28px;">Passive patterns</div>
    ${cardGroup(PASSIVE, "dt-cat-card-name--low")}`;
}

function positionTooltip(event) {
  const tooltip = document.getElementById("dt-tooltip");
  const pad = 12, tw = tooltip.offsetWidth, th = tooltip.offsetHeight;
  tooltip.style.left = (event.clientX + pad + tw > window.innerWidth  ? event.clientX - tw - pad : event.clientX + pad) + "px";
  tooltip.style.top  = (event.clientY + pad + th > window.innerHeight ? event.clientY - th - pad : event.clientY + pad) + "px";
}

function showTurnTooltip(event, d) {
  const tooltip = document.getElementById("dt-tooltip");
  const preview = (d.text || "").length > 130 ? d.text.slice(0, 130) + "…" : (d.text || "");
  tooltip.querySelector(".dt-tooltip-title").textContent = `Turn ${d.id}`;
  tooltip.querySelector(".dt-tooltip-body").innerHTML =
    `<span style="display:inline-block;padding:1px 7px;border-radius:var(--tau-r-pill);background:var(--tau-origin-you-bg);color:var(--tau-ink);font-size:10px;font-weight:600;letter-spacing:0.05em;text-transform:uppercase;margin-bottom:6px;">${esc(d.classifier)}</span><br>${esc(preview)}`;
  document.getElementById("dt-tooltip-learn-more").style.display = "none";
  tooltip.classList.add("dt-tooltip--turn");
  tooltip.style.display = "block";
  positionTooltip(event);
}

// Named only on hover — the chart itself carries no label or icon for a
// pattern band, so this tooltip (and the sidebar a click opens) is the only
// place its name and description live. Mirrors the prototype's showPatternTip.
function showPatternTooltip(event, p) {
  const tooltip = document.getElementById("dt-tooltip");
  const orig = p._orig;
  const isHigh = p.side === "right";
  tooltip.querySelector(".dt-tooltip-title").textContent = `${p.title} — turns ${orig.start + 1}–${orig.end + 1}`;
  tooltip.querySelector(".dt-tooltip-body").innerHTML =
    `<span style="display:inline-block;padding:1px 7px;border-radius:var(--tau-r-pill);background:${isHigh ? "var(--tau-band-4-bg)" : "var(--tau-band-2-bg)"};color:${isHigh ? "var(--tau-band-4-fg)" : "var(--tau-band-2-fg)"};font-size:10px;font-weight:600;letter-spacing:0.05em;text-transform:uppercase;margin-bottom:6px;">${isHigh ? "high" : "low"}-agency pattern</span><br>${esc(PAT_DESCRIPTIONS[orig.id] || "")}`;
  document.getElementById("dt-tooltip-learn-more").style.display = "none";
  tooltip.classList.add("dt-tooltip--turn");
  tooltip.style.display = "block";
  positionTooltip(event);
}

// Legend as labelled clusters rather than one long inline strip — matches
// how the chart itself already reads (low/neutral/high agency, patterns,
// trend) instead of leaving the grouping implicit in swatch order.
//
// Two-tier IA, not one flat row: groups marked `annotation` (Patterns, Trend)
// describe chart *markings*, not the value encoding itself — mixing them in
// with the actual colour key (Low/High agency, Who's driving) at equal
// weight made every group read as equally load-bearing, when only the key
// groups are what a reader needs to decode a single bar's colour. A divider
// plus a quieter, smaller row demotes them to "reference, if you need it."
function renderGroupedLegend(containerEl, groups) {
  containerEl.className = "legend-groups";
  containerEl.innerHTML = "";

  function buildGroup(group) {
    const g = document.createElement("div"); g.className = "legend-group";
    if (group.label) {
      const label = document.createElement("span"); label.className = "legend-group-label"; label.textContent = group.label;
      g.appendChild(label);
    }
    const row = document.createElement("div"); row.className = "legend-group-row";
    group.items.forEach(item => {
      const wrap = document.createElement("div");
      wrap.className = item.sub ? "legend-item legend-item-stacked" : "legend-item";
      const sw = document.createElement("div");
      sw.className = item.line ? "legend-swatch-line" : "legend-swatch";
      if (!item.line) sw.style.background = item.color;
      if (item.outline) sw.style.border = "1px solid var(--tau-line-strong)";
      if (item.sub) {
        const txt = document.createElement("span"); txt.className = "legend-item-text";
        const main = document.createElement("span"); main.className = "legend-item-label"; main.textContent = item.label;
        const sub = document.createElement("span"); sub.className = "legend-item-sub"; sub.textContent = item.sub;
        txt.append(main, sub);
        wrap.appendChild(sw); wrap.appendChild(txt);
      } else {
        const txt = document.createElement("span"); txt.textContent = item.label;
        wrap.appendChild(sw); wrap.appendChild(txt);
      }
      row.appendChild(wrap);
    });
    g.appendChild(row);
    return g;
  }

  const keyGroups = groups.filter(g => !g.annotation);
  const metaGroups = groups.filter(g => g.annotation);

  const keyRow = document.createElement("div"); keyRow.className = "legend-row legend-row-key";
  keyGroups.forEach(group => keyRow.appendChild(buildGroup(group)));
  containerEl.appendChild(keyRow);

  if (metaGroups.length) {
    containerEl.appendChild(Object.assign(document.createElement("div"), { className: "legend-divider" }));
    const metaRow = document.createElement("div"); metaRow.className = "legend-row legend-row-meta";
    metaGroups.forEach(group => metaRow.appendChild(buildGroup(group)));
    containerEl.appendChild(metaRow);
  }
}

function hideTurnTooltip() {
  const tooltip = document.getElementById("dt-tooltip");
  tooltip.style.display = "none";
  tooltip.classList.remove("dt-tooltip--turn");
}

// A window-turn moving average — used both for the agency chart's trend
// line and the driving chart's rolling student/AI share.
function movingAverage(values, window) {
  const half = Math.floor(window / 2);
  return values.map((_, i) => {
    const lo = Math.max(0, i - half), hi = Math.min(values.length - 1, i + half);
    const slice = values.slice(lo, hi + 1);
    return slice.reduce((a, b) => a + b, 0) / slice.length;
  });
}

// Same band-scale math as renderHorizChart, factored out so the driving
// chart's turn columns line up exactly with the agency chart's — same 44
// turns, same x position, so the two tabs read as one instrument.
function computeChartScale(data, innerW, maxBarW) {
  const n = data.length;
  const probe   = d3.scaleBand().domain(data.map(d=>d.label)).range([0,innerW]).paddingInner(0.18).paddingOuter(0.1);
  const barArea = probe.bandwidth() > maxBarW ? (maxBarW/(1-0.18))*n : innerW;
  const xScale  = d3.scaleBand().domain(data.map(d=>d.label)).range([0,barArea]).paddingInner(0.18).paddingOuter(0.1);
  return { xScale, barArea };
}

const PAT_LABEL_MAP = {
  "challenge-arc":"Challenge Arc", "rejection-redirect":"Rejection → Redirect",
  "claim-support":"Claim-Support Cycle", "extraction-landing":"Extraction → Insight",
  "extraction-loop":"Extraction Loop", "validation-spiral":"Validation Spiral",
  "helplessness-loop":"Helplessness Loop", "flitting":"Flitting", "missed-argument":"Missed Argument",
  "correction-held":"Held Ground", "capitulation":"Capitulation",
  "assertion-questioned":"Questioned Assertion", "assertion-unquestioned":"Unquestioned Assertion",
};

// Shared by the agency chart and the driving chart — both read the same 44
// student turns and the same detected patterns, just projected differently.
function buildAgencyTurnsAndPatterns(classified) {
  const student = classified.filter(t => t.role === "student");
  const turns = student.map((t, i) => ({
    id: i + 1,
    value: TURN_VALUE[t.label] ?? 0,
    classifier: t.label || "extraction",
    text: t.text || "",
  }));
  const rawPatterns = detectPatterns(classified);
  const patterns = rawPatterns.map(p => ({
    rows: Array.from({ length: p.end - p.start + 1 }, (_, k) => String(p.start + k + 1)),
    side: (p.tier === "high" || p.tier === "medium") ? "right" : "left",
    title: PAT_LABEL_MAP[p.id] || p.label,
    aiLabels: Array.from({ length: p.end - p.start + 1 }, (_, k) => getAILabelBefore(p.start + k, classified) || ""),
    _orig: p,
  }));
  return { student, turns, patterns };
}

// ── Shared horizontal chart renderer ─────────────────────────────────────────
// Deliberately minimal, matching the agency-viz prototype: bars, a trend
// line, and unlabelled tinted bands behind the bars. No axis ticks, no
// per-pattern icon — a pattern's name and description live in the hover
// tooltip and the sidebar a click opens, not printed on the chart itself.
function renderHorizChart(svgSel, data, patterns, onBarClick, onPatternClick) {
  const hMarg    = { top: 24, right: 24, bottom: 44, left: 92 };
  const hSvgW    = 796;
  const hInnerW  = hSvgW - hMarg.left - hMarg.right;
  const hMaxBarW = 24;
  const hPosU    = 5, hNegU = 3;
  const hInnerH  = 320;
  const hZeroY   = Math.round(hInnerH * hPosU / (hPosU + hNegU));
  const hYTicks  = [-2,-1,0,1,2,3,4];
  const hYScale  = d3.scaleLinear().domain([-hNegU, hPosU]).range([hInnerH, 0]);
  // The per-turn value ramp (green intensity for agentic turns, terra for
  // passive ones) is literal colour, not tokens — carrying this onto the
  // token system means deciding whether a continuous fill on a per-turn
  // value is consistent with "semantic colour never touches a student's own
  // score", which is a design call this session didn't make. Tracked as
  // known debt below; everything else in this chart (chrome, borders, the
  // high/low pattern brackets) is tokenised.
  const hPosScl  = d3.scaleSequential().domain([1,4]).interpolator(d3.interpolateRgb("#86efac","#14532d"));
  const hNegScl  = d3.scaleSequential().domain([-1,-2]).interpolator(d3.interpolateRgb("#e8ae94","#b85c38"));
  const hFill    = v => v===0 ? "#b0b0b0" : v>0 ? hPosScl(v) : hNegScl(v);

  const { xScale, barArea } = computeChartScale(data, hInnerW, hMaxBarW);

  svgSel.attr("width",hSvgW).attr("height",hMarg.top+hInnerH+hMarg.bottom).style("overflow","visible").selectAll("*").remove();

  // A capped bar width means short sessions produce a plot narrower than the
  // fixed 796px canvas — centre it in the available space rather than
  // leaving it stuck to the left margin.
  const hOffsetX = (hInnerW - barArea) / 2;
  const g = svgSel.append("g").attr("transform",`translate(${hMarg.left+hOffsetX},${hMarg.top})`);

  g.selectAll(".grid-line").data(hYTicks).join("line").attr("class","grid-line")
    .attr("x1",0).attr("x2",barArea).attr("y1",d=>hYScale(d)).attr("y2",d=>hYScale(d));
  g.append("line").attr("class","zero-line").attr("x1",0).attr("x2",barArea).attr("y1",hZeroY).attr("y2",hZeroY);

  // Values are ordinal labels (challenge, extraction, validation...), not a
  // measured quantity — numeric ticks would claim a precision that isn't
  // there. Name the two real extremes and the neutral middle instead.
  g.append("text").attr("x",-10).attr("y",hYScale(4)+4).attr("text-anchor","end")
    .attr("font-size","11px").attr("fill","var(--tau-ink-faint)").text("High agency");
  g.append("text").attr("x",-10).attr("y",hZeroY+4).attr("text-anchor","end")
    .attr("font-size","11px").attr("fill","var(--tau-ink-faint)").text("Neutral");
  g.append("text").attr("x",-10).attr("y",hYScale(-2)+4).attr("text-anchor","end")
    .attr("font-size","11px").attr("fill","var(--tau-ink-faint)").text("Low agency");

  patterns.forEach(p => {
    const xs=p.rows.map(r=>xScale(r)).filter(x=>x!==undefined);
    if (!xs.length) return;
    const x1=Math.min(...xs), x2=Math.max(...xs)+xScale.bandwidth(), pw=x2-x1;
    // Same "level, not verdict" band ramp as the pattern sidebar title, not
    // a fourth blue/terra pair.
    const isPos=p.side==="right", pad=3;
    const pg=g.append("g").style("cursor","pointer")
      .on("mousemove",e=>showPatternTooltip(e,p))
      .on("mouseleave",hideTurnTooltip)
      .on("click",e=>onPatternClick(e,p));
    pg.append("rect").attr("x",x1-pad).attr("y",isPos?0:hZeroY).attr("width",pw+pad*2)
      .attr("height",isPos?hZeroY:hInnerH-hZeroY).attr("rx",3).attr("fill",isPos?"var(--tau-band-4-bg)":"var(--tau-band-2-bg)").attr("stroke","none");
  });

  // Each layer in its own group so the Bars/Trend line toggle can hide one
  // independently of the other — not exclusive, both default on.
  const barsGroup  = g.append("g").attr("class","layer-bars");
  const trendGroup = g.append("g").attr("class","layer-trend");

  barsGroup.selectAll(".bar").data(data).join("rect").attr("class","bar")
    .attr("x",d=>xScale(d.label))
    .attr("y",d=>{ if(d.value===0) return hZeroY-4; if(d.value>0) return hYScale(d.value); return hZeroY; })
    .attr("width",xScale.bandwidth())
    .attr("height",d=>{ if(d.value===0) return 8; return Math.abs(hYScale(d.value)-hZeroY); })
    .attr("fill",d=>hFill(d.value)).style("cursor","pointer")
    .on("click",(event,d)=>onBarClick(event,d));

  // Trend line — 3-turn moving average over the same values as the bars.
  // Plain ink, not a score colour: it's a read aid over the bars, not a
  // fifth agency signal competing with the green/terra ramp.
  const trendSmoothed = movingAverage(data.map(d=>d.value), 3);
  const trendLine = d3.line()
    .x(d=>xScale(d.label)+xScale.bandwidth()/2)
    .y((d,i)=>hYScale(trendSmoothed[i]))
    .curve(d3.curveCatmullRom.alpha(0.5));
  trendGroup.append("path").attr("class","trend-line").attr("d",trendLine(data));

  g.selectAll(".turn-label").data(data).join("text")
    .attr("x",d=>xScale(d.label)+xScale.bandwidth()/2).attr("y",hInnerH+16)
    .attr("dy","0.35em").attr("text-anchor","middle")
    .attr("font-size","13px").attr("fill","var(--tau-ink-soft)")
    .text(d=>d.id%5===0?d.label:"");
}

function renderAgencyChart(classified) {
  if (typeof d3 === "undefined") return;
  const { student, turns, patterns } = buildAgencyTurnsAndPatterns(classified);
  if (student.length < 2) return;

  // ── Summary strip ─────────────────────────────────────────────────────────
  const total = turns.length;
  const passiveCount = turns.filter(d => d.value < 0).length;
  const highCount    = turns.filter(d => d.value >= 3).length;
  const passivePct = passiveCount / total, highPct = highCount / total;
  let longestRun = 0, bestStart = null, cur = 0, curStart = null;
  turns.forEach(d => {
    if (d.value < 0) { if (cur === 0) curStart = d.id; cur++; if (cur > longestRun) { longestRun = cur; bestStart = curStart; } } else { cur = 0; }
  });
  let verdict, verdictClass, verdictDesc;
  if (passivePct >= 0.35 || longestRun >= 5) {
    verdict = "Passive concern"; verdictClass = "passive";
    verdictDesc = "Over a third of turns were passive, or the student had a run of 5 or more consecutive passive turns.";
  } else if (highPct >= 0.35 && passivePct < 0.25) {
    verdict = "High engagement"; verdictClass = "high";
    verdictDesc = "More than 35% of turns show high-agency behaviour — challenge, claim, conceptual, or pivot — with low passive activity.";
  } else {
    verdict = "Mixed session"; verdictClass = "mixed";
    verdictDesc = "This session has a roughly even spread of high-agency and passive turns with no dominant pattern.";
  }
  const runValue = longestRun === 0 ? "None" : `${longestRun} consecutive`;
  const runSub   = longestRun === 0 ? "" : `turns ${bestStart}–${bestStart + longestRun - 1}`;
  const chip = verdictClass === "mixed"
    ? `<span class="dt-verdict-plain">${verdict}</span>`
    : `<span class="dt-verdict-chip dt-verdict-${verdictClass}">${verdict}</span>`;
  document.getElementById("chartSummaryEl").innerHTML = `
    <div class="dt-verdict-block">
      <span class="dt-verdict-label">Session verdict</span>
      <div style="display:flex;align-items:center;">
        ${chip}
        <button class="dt-verdict-info-btn" id="agency-verdict-info-btn">?</button>
      </div>
    </div>
    <div class="dt-stat-block">
      <span class="dt-stat-label">Longest passive run</span>
      <span class="dt-stat-value">${runValue}</span>
      ${runSub ? `<span class="dt-stat-sub">${runSub}</span>` : ""}
    </div>
    <div class="dt-stat-block">
      <span class="dt-stat-label">High-agency turns</span>
      <span class="dt-stat-value">${highCount} of ${total}</span>
      <span class="dt-stat-sub">${Math.round(highCount / total * 100)}% of session</span>
    </div>
    `;
  document.getElementById("agency-verdict-info-btn").addEventListener("click", e => {
    e.stopPropagation();
    const tooltip = document.getElementById("dt-tooltip");
    tooltip.querySelector(".dt-tooltip-title").textContent = verdict;
    tooltip.querySelector(".dt-tooltip-body").textContent  = verdictDesc;
    document.getElementById("dt-tooltip-learn-more").style.display = "none";
    tooltip.style.display = "block";
    const pad = 12, tw = tooltip.offsetWidth, th = tooltip.offsetHeight;
    tooltip.style.left = (e.clientX + pad + tw > window.innerWidth ? e.clientX - tw - pad : e.clientX + pad) + "px";
    tooltip.style.top  = (e.clientY + pad + th > window.innerHeight ? e.clientY - th - pad : e.clientY + pad) + "px";
  });

  // ── Legend ────────────────────────────────────────────────────────────────
  const posScaleL = d3.scaleSequential().domain([1,4]).interpolator(d3.interpolateRgb("#86efac","#14532d"));
  const negScaleL = d3.scaleSequential().domain([-1,-2]).interpolator(d3.interpolateRgb("#e8ae94","#b85c38"));
  const fillL = v => v===0 ? "#b0b0b0" : v>0 ? posScaleL(v) : negScaleL(v);
  renderGroupedLegend(document.getElementById("chartLegendEl"), [
    { label: "Low agency", items: [
        { color: fillL(-2), label: "stuck" },
        { color: fillL(-1), label: "validation" },
      ] },
    { label: "Neutral", items: [
        { color: fillL(0), label: "extraction", outline: true },
      ] },
    { label: "High agency", items: [
        { color: fillL(1), label: "feedback / narrative" },
        { color: fillL(2), label: "refinement" },
        { color: fillL(3), label: "claim / conceptual / pivot" },
        { color: fillL(4), label: "challenge / rejection" },
      ] },
    { label: "Patterns", annotation: true, items: [
        { color: "var(--tau-band-4-bg)", label: "high-agency pattern", outline: true },
        { color: "var(--tau-band-2-bg)", label: "low-agency pattern", outline: true },
      ] },
    { label: "Trend", annotation: true, items: [
        { line: true, label: "3-turn average" },
      ] },
  ]);

  // ── Chart ─────────────────────────────────────────────────────────────────
  const data   = turns.map(d => ({ ...d, label: String(d.id) }));
  const agSvg  = d3.select("#agencyChart");
  renderHorizChart(
    agSvg, data, patterns,
    (event, d) => {
      event.stopPropagation();
      hideTurnTooltip();
      document.getElementById("dt-modal-turn").textContent = `Student Turn ${d.id}`;
      document.getElementById("dt-modal-classifier").textContent = d.classifier;
      document.getElementById("dt-modal-text").textContent = d.text;
      document.getElementById("dt-modal-overlay").classList.add("open");
    },
    (e, p) => { e.stopPropagation(); openPatternSidebar(p._orig, student, classified); }
  );
  agSvg.selectAll(".bar")
    .on("mouseover", (event, d) => showTurnTooltip(event, d))
    .on("mouseout",  ()          => hideTurnTooltip());
}

// ── Who's driving — same 44 turns, reclassified as a 3-state control fact
// rather than a magnitude. Reuses the report's existing you/together/coach
// origin vocabulary (--tau-origin-you/-together/-coach) so this teaches the
// same encoding as My Session's essay panels instead of inventing a fourth
// colour set.
const DRIVING_MAP = {
  claim: "student", challenge: "student", rejection: "student", pivot: "student", conceptual: "student",
  refinement: "shared", narrative: "shared", feedback: "shared",
  extraction: "ai", validation: "ai", stuck: "ai",
};
const DRV_COLOR = { student: "var(--tau-origin-you)", shared: "var(--tau-origin-together)", ai: "var(--tau-origin-coach)" };
const DRV_LABEL = { student: "student-driven", shared: "shared", ai: "AI-driven" };
const DRV_NUM   = { student: 1, shared: 0, ai: -1 };

function renderDrivingChart(classified) {
  if (typeof d3 === "undefined") return;
  const { student, turns, patterns } = buildAgencyTurnsAndPatterns(classified);
  if (student.length < 2) return;

  const data = turns.map(d => ({ ...d, label: String(d.id), drv: DRIVING_MAP[d.classifier] || "shared" }));

  // ── Legend ────────────────────────────────────────────────────────────────
  renderGroupedLegend(document.getElementById("drivingLegendEl"), [
    { label: "Who's driving", items: [
        { color: DRV_COLOR.student, label: "Student-driven", sub: "claim · challenge · rejection · pivot · conceptual" },
        { color: DRV_COLOR.shared,  label: "Shared",         sub: "refinement · narrative · feedback" },
        { color: DRV_COLOR.ai,      label: "AI-driven",      sub: "extraction · validation · stuck" },
      ] },
    { label: "Patterns", annotation: true, items: [
        { color: "var(--tau-band-4-bg)", label: "high-agency pattern", outline: true },
        { color: "var(--tau-band-2-bg)", label: "low-agency pattern", outline: true },
      ] },
    { label: "Trend", annotation: true, items: [
        { line: true, label: "rolling share (5-turn window)" },
      ] },
  ]);

  // ── Chart ─────────────────────────────────────────────────────────────────
  const dMarg    = { top: 20, right: 24, bottom: 44, left: 40 };
  const dSvgW    = 796;
  const dInnerW  = dSvgW - dMarg.left - dMarg.right;
  const dMaxBarW = 24;
  const laneH = 28, laneGap = 16, lineH = 140;
  const lineTop = laneH + laneGap;

  const { xScale, barArea } = computeChartScale(data, dInnerW, dMaxBarW);
  const yScale = d3.scaleLinear().domain([-1,1]).range([lineTop+lineH, lineTop]);

  const svgSel = d3.select("#drivingChart");
  svgSel.attr("width", dSvgW).attr("height", dMarg.top + lineTop + lineH + dMarg.bottom)
    .style("overflow","visible").selectAll("*").remove();
  const dOffsetX = (dInnerW - barArea) / 2;
  const g = svgSel.append("g").attr("transform", `translate(${dMarg.left+dOffsetX},${dMarg.top})`);

  // Same bracket patterns as the agency chart, spanning the full lane+line
  // height here rather than sitting above/below a zero line — there's no
  // zero-centred bar to frame, just the two rows of the same story.
  patterns.forEach(p => {
    const xs = p.rows.map(r => xScale(r)).filter(x => x !== undefined);
    if (!xs.length) return;
    const x1 = Math.min(...xs), x2 = Math.max(...xs) + xScale.bandwidth(), pw = x2 - x1;
    const isHigh = p.side === "right";
    const pg = g.append("g").style("cursor","pointer")
      .on("mousemove", e => showPatternTooltip(e, p))
      .on("mouseleave", hideTurnTooltip)
      .on("click", e => { e.stopPropagation(); openPatternSidebar(p._orig, student, classified); });
    pg.append("rect").attr("x", x1-3).attr("y", 0).attr("width", pw+6)
      .attr("height", lineTop+lineH).attr("rx", 3)
      .attr("fill", isHigh ? "var(--tau-band-4-bg)" : "var(--tau-band-2-bg)");
  });

  [-1,-0.5,0,0.5,1].forEach(v => {
    g.append("line").attr("class", v===0 ? "zero-line" : "grid-line")
      .attr("x1",0).attr("x2",barArea).attr("y1",yScale(v)).attr("y2",yScale(v));
  });

  g.selectAll(".drv-tick").data(data).join("rect").attr("class","drv-tick")
    .attr("x", d=>xScale(d.label)).attr("y", 0)
    .attr("width", xScale.bandwidth()).attr("height", laneH).attr("rx", 2)
    .attr("fill", d=>DRV_COLOR[d.drv]).style("cursor","pointer")
    .on("mouseover", (event, d) => showTurnTooltip(event, { ...d, classifier: `${d.classifier} · ${DRV_LABEL[d.drv]}` }))
    .on("mouseout", hideTurnTooltip)
    .on("click", (event, d) => {
      hideTurnTooltip();
      document.getElementById("dt-modal-turn").textContent = `Student Turn ${d.id}`;
      document.getElementById("dt-modal-classifier").textContent = d.classifier;
      document.getElementById("dt-modal-text").textContent = d.text;
      document.getElementById("dt-modal-overlay").classList.add("open");
    });

  const drvSmoothed = movingAverage(data.map(d=>DRV_NUM[d.drv]), 5);
  const shareLine = d3.line()
    .x(d=>xScale(d.label)+xScale.bandwidth()/2)
    .y((d,i)=>yScale(drvSmoothed[i]))
    .curve(d3.curveCatmullRom.alpha(0.5));
  g.append("path").attr("class","trend-line").attr("stroke","var(--tau-origin-you)").attr("d",shareLine(data));

  g.append("text").attr("x",-8).attr("y",lineTop+4).attr("text-anchor","end")
    .attr("font-size","10px").attr("fill","var(--tau-ink-faint)").text("+1 student");
  g.append("text").attr("x",-8).attr("y",lineTop+lineH).attr("text-anchor","end")
    .attr("font-size","10px").attr("fill","var(--tau-ink-faint)").text("−1 AI");

  g.selectAll(".turn-label").data(data).join("text").attr("class","turn-label")
    .attr("x", d=>xScale(d.label)+xScale.bandwidth()/2).attr("y", lineTop+lineH+22)
    .attr("text-anchor","middle").attr("font-size","13px").attr("fill","var(--tau-ink-soft)")
    .text(d => d.id%5===0 ? d.label : "");
}

function openPatternSidebar(p, student, classified) {
  const sidebar = document.getElementById("patternSidebar");
  if (!sidebar) return;
  const PAT_LABEL = {
    "challenge-arc":      "Challenge Arc",
    "rejection-redirect": "Rejection → Redirect",
    "claim-support":      "Claim-Support Cycle",
    "extraction-landing": "Extraction → Insight",
    "extraction-loop":    "Extraction Loop",
    "validation-spiral":  "Validation Spiral",
    "helplessness-loop":  "Helplessness Loop",
    "flitting":           "Flitting",
  };
  // Same "level, not verdict" band ramp used elsewhere in the report — not
  // a new blue/terra good-bad pair.
  const isRight = p.tier === "high" || p.tier === "medium";
  const color   = isRight ? "var(--tau-band-4-fg)" : "var(--tau-band-2-fg)";
  const title   = PAT_LABEL[p.id] || p.label;
  const desc    = PAT_DESCRIPTIONS[p.id] || "";
  document.getElementById("patternSidebarTitle").innerHTML =
    `<span style="color:${color}">${esc(title)}</span>`;
  let exchangeHtml = "";
  for (let i = p.start; i <= p.end; i++) {
    const turn    = student[i];
    if (!turn) continue;
    const aiLabel = getAILabelBefore(i, classified);
    const divider = i < p.end ? '<hr class="div-exchange-divider">' : "";
    const preview = (turn.text || "").length > 300 ? turn.text.slice(0, 300) + "…" : (turn.text || "");
    exchangeHtml += `
      <div>
        ${aiLabel ? `
          <div class="div-ai-row">
            <span class="div-role-tag">AI</span>
            <span class="div-ai-chip">${esc(aiLabel)}</span>
          </div>
          <span class="div-arrow">↓</span>
        ` : ""}
        <div class="div-student-row">
          <div class="div-student-meta">
            <span class="div-turn-num">Turn ${i + 1}</span>
            <span class="div-student-chip">${esc(turn.label || "")}</span>
          </div>
          <div class="div-student-text">"${esc(preview)}"</div>
        </div>
      </div>
      ${divider}
    `;
  }
  document.getElementById("patternSidebarBody").innerHTML = `
    <p class="div-pat-insight">${esc(desc)}</p>
    <div class="div-exchange-label">The exchange</div>
    ${exchangeHtml}
  `;
  sidebar.classList.add("open");
}

function closePatternSidebar() {
  document.getElementById("patternSidebar")?.classList.remove("open");
}

// Pattern Guide moved out of the tab bar into a header button — it's demo/
// explainer material, not something most students need to visit, so it lives
// behind a lightweight modal rather than taking a permanent tab slot.
function openPatternGuideModal() {
  const modal = document.getElementById("patternGuideModal");
  if (!modal) return;
  renderPatternGuide();
  modal.classList.add("open");
  document.body.style.overflow = "hidden";
}

function closePatternGuideModal() {
  document.getElementById("patternGuideModal")?.classList.remove("open");
  document.body.style.overflow = "";
}

// ─── Provenance helpers ───────────────────────────────────────────────────────

function conceptRegex(phrase) {
  const words = phrase.toLowerCase().replace(/[^a-z0-9\s]/g," ").trim().split(/\s+/).filter(w => w.length > 0);
  if (!words.length) return null;
  const esc = words.map(w => w.replace(/[.*+?^${}()|[\]\\]/g,"\\$&"));
  return new RegExp(`\\b${esc.join("\\s+")}\\b`, "gi");
}

function findConceptPositions(phrase, text) {
  const re = conceptRegex(phrase);
  if (!re) return [];
  const positions = [];
  let m;
  while ((m = re.exec(text)) !== null) positions.push({ start: m.index, end: m.index + m[0].length });
  return positions;
}

// concept is the analyser's own paraphrase of the idea, not verbatim chat
// text, so a strict ordered-phrase match against it almost never hits — word
// overlap (same threshold matchConceptsToTurns uses) actually finds the turn.
function findTraceTurn(concept, classified) {
  const words = concept.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(w => w.length > 3);
  if (!words.length) return null;
  for (const t of classified) {
    const text = (t.text || "").toLowerCase();
    const hits = words.filter(w => text.includes(w)).length;
    if (hits >= Math.max(1, Math.ceil(words.length * 0.5))) return t;
  }
  return null;
}

// Exposes traceTurn (not just a text snippet of it) so My Session's grouping
// logic can compare turns by identity — e.g. "did anything from the exact AI
// turn this challenge responded to ever land in the essay?"
function traceProvenance(provenanceItems, classified, essayText) {
  return provenanceItems.map(({ concept, phrase, origin }) => {
    const positions = findConceptPositions(phrase, essayText);
    const traceTurn = findTraceTurn(concept, classified);
    // The old fallback asserted "prior knowledge" whenever the concept name
    // didn't appear verbatim in a turn — which it usually doesn't, since the
    // name is the analyser's paraphrase. That put "prior knowledge" under
    // concepts whose own chip said "Together", the chip contradicting the line
    // beneath it. Only `prior` gets to claim prior knowledge now.
    const traceSnippet = traceTurn
      ? `First in ${traceTurn.role === "student" ? "your" : "AI"} turn (${traceTurn.label}): "${traceTurn.text.slice(0, 80)}${traceTurn.text.length > 80 ? "…" : ""}"`
      : origin === "prior"
        ? "You brought this in — it isn’t in the chat at all."
        : "Traced to your draft; no single turn matched it.";
    return { concept, phrase, origin, positions, traceSnippet, traceTurn };
  }).filter(p => p.positions.length > 0);
}

// ─── Integrity flags ──────────────────────────────────────────────────────────

function computeIntegrityFlags(classified, provenanceData, reflectionState = {}) {
  const flags = [];
  const student = classified.filter(t => t.role === "student");

  // Stylistic inconsistency: large variance in word count / complexity across student turns
  const wordCounts = student.map(t => t.text.trim().split(/\s+/).length);
  const avg = wordCounts.reduce((s, v) => s + v, 0) / (wordCounts.length || 1);
  const variance = wordCounts.reduce((s, v) => s + (v - avg) ** 2, 0) / (wordCounts.length || 1);
  if (variance > 800 && student.length >= 4) {
    flags.push({
      type: "stylistic-inconsistency",
      detail: `Student turn lengths vary significantly (avg ${Math.round(avg)} words, std dev ${Math.round(Math.sqrt(variance))}). Large jumps may indicate external input.`,
    });
  }

  // Unnatural fluency: most student turns lack hedging language
  const HEDGING = /\b(I think|I believe|maybe|perhaps|probably|might|could be|I'm not sure|sort of|kind of|I guess)\b/i;
  const hedgeCount = student.filter(t => HEDGING.test(t.text)).length;
  if (student.length >= 5 && hedgeCount / student.length < 0.1) {
    flags.push({
      type: "unnatural-fluency",
      detail: `Only ${hedgeCount} of ${student.length} student turns contain hedging language. Natural student writing typically includes uncertainty markers.`,
    });
  }

  // Provenance mismatch: essay uses concept as student-born but AI introduced it first
  if (provenanceData) {
    const mismatches = provenanceData.filter(p => p.origin === "ai-born" && p.traceSnippet.includes("your turn"));
    if (mismatches.length > 0) {
      flags.push({
        type: "provenance-mismatch",
        detail: `${mismatches.length} concept(s) appear as student-originated in the essay but were first introduced by the AI: ${mismatches.map(p => `"${p.concept}"`).join(", ")}.`,
      });
    }
  }

  // Shadow session: student turns suspiciously well-calibrated (high validation, very low rejection)
  const valRate = (classified.filter(t => t.role === "student" && t.label === "validation").length) / (student.length || 1);
  const rejRate = (classified.filter(t => t.role === "student" && t.label === "rejection").length) / (student.length || 1);
  if (valRate > 0.5 && rejRate < 0.05 && student.length >= 5) {
    flags.push({
      type: "shadow-session-pattern",
      detail: `${Math.round(valRate * 100)}% of student turns are passive validation with no pushback. This pattern is consistent with pre-polished inputs.`,
    });
  }

  // Reflection duplicate (Harvard Project Zero Connect-Extend-Challenge routine)
  if (reflectionState.isDuplicate) {
    const mode = reflectionState.reflectionType === 'delta' ? 'delta (What shifted?)' : 'Connect-Extend-Challenge';
    flags.push({
      type: "reflection-duplicate",
      detail: `This submission's ${mode} reflection is identical or near-identical to a previous submission from this device. This pattern is consistent with rapid resubmission to improve the score.`,
    });
  }

  return flags;
}

// ─── Render helpers ───────────────────────────────────────────────────────────

function esc(s) {
  return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}

const LABEL_META = {
  // green — positive / high agency
  challenge:   { bg: "var(--label-challenge)",   color: "var(--label-challenge-text)",   display: "Challenge" },
  rejection:   { bg: "var(--label-rejection)",   color: "var(--label-rejection-text)",   display: "Rejection" },
  refinement:  { bg: "var(--label-refinement)",  color: "var(--label-refinement-text)",  display: "Refinement" },
  claim:       { bg: "var(--label-claim)",       color: "var(--label-claim-text)",       display: "Claim" },
  // blue — neutral
  conceptual:  { bg: "var(--label-conceptual)",  color: "var(--label-conceptual-text)",  display: "Conceptual" },
  narrative:   { bg: "var(--label-narrative)",   color: "var(--label-narrative-text)",   display: "Narrative" },
  pivot:       { bg: "var(--label-pivot)",       color: "var(--label-pivot-text)",       display: "Pivot" },
  feedback:    { bg: "var(--label-feedback)",    color: "var(--label-feedback-text)",    display: "Feedback" },
  // amber/red — passive / negative
  validation:  { bg: "var(--label-validation)",  color: "var(--label-validation-text)",  display: "Validation" },
  extraction:  { bg: "var(--label-extraction)",  color: "var(--label-extraction-text)",  display: "Extraction" },
  stuck:       { bg: "var(--label-stuck)",       color: "var(--label-stuck-text)",       display: "Stuck" },
  content:     { bg: "var(--label-ai-content)",  color: "var(--label-ai-content-text)",  display: "Content" },
  definition:  { bg: "var(--label-ai-definition)",color: "var(--label-ai-definition-text)", display: "Definition" },
  argument:    { bg: "var(--label-ai-argument)", color: "var(--label-ai-argument-text)", display: "Argument" },
  example:     { bg: "var(--label-ai-example)",  color: "var(--label-ai-example-text)",  display: "Example" },
  instruction: { bg: "var(--label-ai-instruction)",color: "var(--label-ai-instruction-text)", display: "Instruction" },
  correction:  { bg: "var(--label-ai-correction)",color: "var(--label-ai-correction-text)", display: "Correction" },
};

function labelBadge(label) {
  const m = LABEL_META[label] || LABEL_META.narrative;
  return `<span class="label-badge" style="background:${m.bg};color:${m.color}">${m.display}</span>`;
}

const DIM_TOOLTIPS = {
  PQ: "Did you lead the conversation? This looks at whether you asked follow-up questions, challenged the AI, and explored ideas — or mostly just asked it to generate things for you.",
  SU: "After the AI gave you content, what did you do next? This looks at whether you thought critically about it and built on it, or just collected more.",
  CS: "Did you ever disagree with the AI or push it to do better? This tracks how often you questioned or challenged what it gave you.",
  OC: "How many of the ideas in your essay actually came from you? This traces which concepts you brought in versus which ones the AI introduced first.",
};

// SAMR is a subtitle, never the primary label — it is PD jargon students don't
// know and teachers who missed that inservice don't either. These are what the
// band chip actually says. Ordered, but describing the working relationship
// rather than grading it: none of the four is a pass or a fail.
const BAND_META = {
  Substitution: { n: 1, label: 'Mostly the AI’s thinking' },
  Augmentation: { n: 2, label: 'The AI led, you steered' },
  Modification: { n: 3, label: 'You led, the AI helped' },
  Redefinition: { n: 4, label: 'Your thinking throughout' },
};

const SAMR_DESCRIPTIONS = {
  Substitution: 'Most of the ideas in this session came from the AI, not from you. You used it as a shortcut — getting answers rather than building your own thinking.',
  Augmentation: 'You used AI to get things done, but your own thinking didn\'t really develop through the process. Some original ideas are there, but AI-generated content did most of the work.',
  Modification: 'You used AI to push your thinking further. You challenged it, added your own take, and made ideas your own. Real thinking happened in this session.',
  Redefinition: 'You were in the driver\'s seat throughout — questioning, connecting ideas, and bringing your own perspective. The AI was your tool, not your author.',
};

// One row per dimension: full name + its own five-pip .steps bar, the same
// component the summary panel below uses — this is a preview of that panel,
// not a different way of drawing the same fact, so it has to be the same
// component or the two would visually disagree with each other. No PQ/SU/CS/OC
// badge — that's a code a reader has to learn, and the full name already
// fits on one line.
function renderHeroDimRow(key, n) {
  const pips = [1, 2, 3, 4, 5].map((i) => `<i class="${i <= n ? "on" : ""}"></i>`).join("");
  return `
    <div class="report-hero-dim">
      <span class="report-hero-dim-label">
        ${DIM_NAMES[key]}
        <span class="report-hero-dim-n">${n}<span class="report-hero-dim-of">/5</span></span>
      </span>
      <span class="steps report-hero-dim-steps" role="img" aria-label="${n} out of 5">${pips}</span>
    </div>`;
}

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
function renderReportHero(scores, submission) {
  const { totalScore, SAMR } = scores;
  const band = BAND_META[SAMR];

  return `
    <div class="card card-lg card-hero report-hero">
      <span class="eyebrow report-hero-eyebrow">${esc(submission.assignmentTitle || 'Assignment')} · Draft ${submission.cycleIndex + 1}</span>
      <div class="report-hero-row">
        <div class="report-hero-charts">
          <div class="report-hero-score card-quiet">
            <span class="report-hero-score-label">TAU score</span>
            <div class="report-total">
              <span class="report-total-n">${totalScore}</span>
              <span class="report-total-of">of 20</span>
            </div>
          </div>
          <div class="report-hero-dims">
            ${DIM_ORDER.map((k) => renderHeroDimRow(k, scores[k])).join('')}
          </div>
        </div>
        <div class="report-hero-verdict" style="border-left-color: var(--tau-band-${band.n}-fg)">
          <span class="band band-${band.n}"><i class="band-pip"></i>${esc(band.label)}</span>
          <p class="report-hero-description">${esc(SAMR_DESCRIPTIONS[SAMR])}</p>
        </div>
      </div>
    </div>`;
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

function dimExplanation(key, scores) {
  const { PQ, SU, CS, OC, counts, total, responsiveCount, challengeCount, extractionEvents, highFollowups, lowFollowups, provenanceCounts } = scores;
  const t = n => `${n} turn${n !== 1 ? "s" : ""}`;

  if (key === "PQ") {
    if (total < 3) {
      return {
        explain: `Only ${t(total)} detected — not enough to get a reliable picture.`,
        nudge: "A longer back-and-forth helps you actually process ideas. Aim for 5+ turns.",
        nudgeType: "coach",
      };
    }
    const parts = [];
    if (responsiveCount > 0) parts.push(`${t(responsiveCount)} responded to what the AI said`);
    if (challengeCount > 0)  parts.push(`${t(challengeCount)} directly challenged a claim`);
    if (parts.length === 0)  parts.push(`none of your ${t(total)} followed up on the AI's response`);
    let nudge = null, nudgeType = null;
    if (PQ >= 4 && challengeCount > 0) {
      nudge = "Questioning the AI's answers means you're thinking for yourself, not just absorbing what it tells you. Keep that up.";
      nudgeType = "reinforce";
    } else if (PQ >= 4) {
      nudge = "Responding to what the AI actually says — rather than just giving it instructions — means you're having a real back-and-forth. That's how AI helps you develop your own ideas.";
      nudgeType = "reinforce";
    } else if (challengeCount === 0) {
      nudge = "Try challenging the AI next time — ask 'how do you know that?' or 'what's the counter-argument?' It's a simple way to think more critically.";
      nudgeType = "coach";
    } else {
      nudge = "Keep asking follow-up questions. 'Why is that true?' or 'How does this connect to my argument?' will push you further.";
      nudgeType = "coach";
    }
    return { explain: `${parts.join("; ")} (out of ${total} total).`, nudge, nudgeType };
  }

  if (key === "SU") {
    if (extractionEvents === 0) {
      const highTotal = counts.claim + counts.conceptual + counts.challenge + counts.rejection + counts.refinement;
      let nudge = null, nudgeType = null;
      if (SU >= 4) {
        nudge = "You were coming up with and testing your own ideas throughout — the AI was a thinking partner, not just a source to copy from.";
        nudgeType = "reinforce";
      } else {
        nudge = "Try asking the AI to generate something, then take a step back and rewrite it in your own words with your own take.";
        nudgeType = "coach";
      }
      return {
        explain: `No content extraction detected. ${t(highTotal)} were high-agency (claims, challenges, refinements) out of ${total} total.`,
        nudge, nudgeType,
      };
    }
    const untracked = extractionEvents - highFollowups - (lowFollowups || 0);
    const parts = [];
    if (highFollowups > 0)       parts.push(`${highFollowups} followed by your own idea or challenge`);
    if ((lowFollowups || 0) > 0) parts.push(`${lowFollowups} followed by more extraction or passive acceptance`);
    if (untracked > 0)           parts.push(`${untracked} at the end of the conversation`);
    let nudge = null, nudgeType = null;
    if (SU >= 4) {
      nudge = "You treated what the AI gave you as a starting point, not a final answer. That's exactly the right approach.";
      nudgeType = "reinforce";
    } else {
      nudge = "After you get content from the AI, pause and ask yourself: 'What do I actually think about this?' Then write that.";
      nudgeType = "coach";
    }
    return { explain: `You extracted content ${t(extractionEvents)}: ${parts.join("; ")}.`, nudge, nudgeType };
  }

  if (key === "CS") {
    const skepticEvents = counts.rejection + counts.refinement;
    if (skepticEvents === 0) {
      return {
        explain: `No pushback or refinement detected across ${t(total)}.`,
        nudge: "Try disagreeing with one thing the AI says, or steering it toward your own angle rather than accepting its framing.",
        nudgeType: "coach",
      };
    }
    const parts = [];
    if (counts.rejection > 0)  parts.push(`${t(counts.rejection)} rejected a claim outright`);
    if (counts.refinement > 0) parts.push(`${t(counts.refinement)} steered or refined the AI's output`);
    let nudge = null, nudgeType = null;
    if (CS >= 4) {
      nudge = "Pushing back on the AI is how you catch mistakes and make ideas your own. It also builds the habit of forming and defending your own views.";
      nudgeType = "reinforce";
    } else {
      nudge = "Keep building that habit. When the AI says something, ask yourself whether you actually agree before moving on.";
      nudgeType = "coach";
    }
    return { explain: `You pushed back ${t(skepticEvents)}: ${parts.join("; ")}.`, nudge, nudgeType };
  }

  if (key === "OC") {
    if (provenanceCounts) {
      const { studentBorn, synthesized, aiBorn, total: pt } = provenanceCounts;
      const parts = [];
      if (studentBorn > 0) parts.push(`${studentBorn} were yours`);
      if (synthesized > 0) parts.push(`${synthesized} developed together`);
      if (aiBorn > 0)      parts.push(`${aiBorn} originated from the AI`);
      let nudge = null, nudgeType = null;
      if (OC >= 4) {
        nudge = "When the ideas are yours, the AI becomes a tool for testing and sharpening your thinking — not a replacement for it. That's the goal.";
        nudgeType = "reinforce";
      } else if (aiBorn > 0) {
        nudge = "Find the parts the AI wrote and rewrite them in your own words before your final draft.";
        nudgeType = "coach";
      } else {
        nudge = "Try adding more of your own analysis — your judgements, your conclusions, things the AI didn't say.";
        nudgeType = "coach";
      }
      return { explain: `Of ${pt} essay concept${pt !== 1 ? "s" : ""} traced: ${parts.join("; ")}.`, nudge, nudgeType };
    }
    // Fallback path
    const claimLike = counts.claim + counts.narrative;
    let nudge = null, nudgeType = null;
    if (OC >= 4) {
      nudge = "When the ideas are yours, the AI becomes a tool for testing and sharpening your thinking — not a replacement for it.";
      nudgeType = "reinforce";
    } else {
      nudge = "Try rewriting AI-generated sections in your own words and adding your own analysis.";
      nudgeType = "coach";
    }
    return {
      explain: `${t(claimLike)} contained your own points or context out of ${total} total (estimated — add a Groq key for a more accurate result).`,
      nudge, nudgeType,
    };
  }

  return { explain: "", nudge: null, nudgeType: null };
}

// The engine's own names. The app had drifted to two other sets — "How You
// Asked" here, "How you questioned" in app.js — so three vocabularies described
// four dimensions and none of them matched scoreTAU().
const DIM_ORDER = ["PQ", "SU", "CS", "OC"];
const DIM_NAMES = {
  PQ: "Prompting Quality",
  SU: "Selective Use",
  CS: "Calibrated Skepticism",
  OC: "Original Contribution",
};

// One quadrant per dimension, three zones: the name (once — no PQ/SU/CS/OC
// code, which was a second label the strip below used to repeat next to it),
// the score as a single instrument (number + its own five-pip .steps bar on
// one row, not stacked as two separate facts), and one callout line — a quiet
// evidence clause plus the coaching sentence, joined instead of stacked as
// two paragraphs a reader had to read twice to connect. No value-keyed colour
// anywhere: a 2 must not render in the same red as an error, which makes the
// report a verdict at the moment it claims to coach.
function renderDimGrid(scores) {
  return DIM_ORDER.map((k) => {
    const n = scores[k];
    const pips = [1, 2, 3, 4, 5]
      .map((i) => `<i class="${i <= n ? "on" : ""}"></i>`).join("");
    const { explain, nudge } = dimExplanation(k, scores);
    return `
      <div class="dim-quad">
        <div class="dim-quad-name">
          ${DIM_NAMES[k]}
          <span class="dim-info">
            <button class="dim-info-btn" type="button"
              aria-label="What ${DIM_NAMES[k]} measures">i</button>
            <span class="dim-tooltip" role="tooltip">${esc(DIM_TOOLTIPS[k])}</span>
          </span>
        </div>
        <div class="dim-quad-score">
          <span class="dim-quad-score-n"><span class="n">${n}</span><span class="of">/5</span></span>
          <span class="steps dim-quad-steps" role="img" aria-label="${n} out of 5">${pips}</span>
        </div>
        <p class="dim-quad-callout"><span class="dim-evidence">${esc(explain)}</span>${nudge ? ` ${esc(nudge)}` : ""}</p>
      </div>`;
  }).join("");
}

// globalTurnIndex -> [provenance item, ...] — student-born/synthesized concepts
// only, i.e. essay content that traces back to the student, not the AI.
function matchConceptsToTurns(classified, provenanceData) {
  const result = {};
  if (!provenanceData || !provenanceData.length) return result;

  const relevant = provenanceData.filter(p => p.origin === "student-born" || p.origin === "synthesized");
  const studentTurns = classified
    .map((t, i) => ({ ...t, globalIndex: i }))
    .filter(t => t.role === "student");

  for (const prov of relevant) {
    const words = prov.concept.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(w => w.length > 3);
    if (!words.length) continue;
    for (const turn of studentTurns) {
      const text = turn.text.toLowerCase();
      const hits = words.filter(w => text.includes(w)).length;
      if (hits >= Math.max(1, Math.ceil(words.length * 0.5))) {
        if (!result[turn.globalIndex]) result[turn.globalIndex] = [];
        result[turn.globalIndex].push(prov);
        break;
      }
    }
  }
  return result;
}

// Long sessions (40+ turns) can put a dozen-plus cards in a single My Session
// group — always full detail, never a count-only summary, so the first 5
// stay open and the rest fold behind a click instead of forcing a scroll.
const FOLD_THRESHOLD = 5;
function foldCards(cardsHtml) {
  if (cardsHtml.length <= FOLD_THRESHOLD) return cardsHtml.join("");
  const visible = cardsHtml.slice(0, FOLD_THRESHOLD).join("");
  const hidden = cardsHtml.slice(FOLD_THRESHOLD).join("");
  return `${visible}<details class="acard-disclosure acard-disclosure-prompt">
    <summary class="acard-disclosure-toggle">${iconSVG("expandMore", "acard-disclosure-icon")}Show all ${cardsHtml.length} turns</summary>
    <div class="turn-list" style="margin-top:var(--tau-s3)">${hidden}</div>
  </details>`;
}

// My Session groups every student turn by what it actually did to the essay,
// not by label or chronology — staying out of the draft after a pushback is
// as meaningful an outcome as landing in it, so it gets its own group instead
// of reading as "nothing happened."
function renderReflect(classified, provenanceData, essayRaw) {
  const studentTurns = classified
    .map((t, i) => ({ ...t, globalIndex: i }))
    .filter(t => t.role === "student");

  const hasEssay = !!(essayRaw && essayRaw.trim());
  const hasProvenance = !!(provenanceData && provenanceData.length);
  const essayMatches = matchConceptsToTurns(classified, provenanceData);

  const patterns = detectPatterns(classified);
  const turnPattern = {};
  for (const p of patterns) {
    for (let i = p.start; i <= p.end; i++) turnPattern[i] = p;
  }

  function patternNote(i) {
    const pat = turnPattern[i];
    return pat ? `<div class="turn-pattern-note">Part of a <strong>${esc(pat.label)}</strong> pattern.</div>` : "";
  }

  function compactRow(t, i) {
    const preview = t.text.length > 90 ? t.text.slice(0, 90) + "…" : t.text;
    return `
      <div class="turn-row" id="session-turn-${i}">
        <div class="turn-num">${i + 1}</div>
        ${labelBadge(t.label)}
        <div class="turn-row-text">${esc(preview)}</div>
      </div>`;
  }

  if (!hasEssay) {
    const list = studentTurns.map((t, i) => compactRow(t, i)).join("");
    return `<div class="no-essay-note">Paste your essay above to see which of your turns made it into your final draft.</div>
      <div class="turn-list">${list}</div>`;
  }

  // Group 1 — became the essay: your own idea, traceable in the draft.
  // Group 2 — you kept it out: a rejection/refinement/challenge whose target
  //   AI turn never produced anything that made it into the draft.
  // Group 3 — made it in from the AI: essay content that traces to an AI
  //   turn with no pushback in between.
  // Group 4 — everything else: didn't feed the draft either way.
  const PUSHBACK_LABELS = new Set(["rejection", "refinement", "challenge"]);
  const landedIdx = new Set();
  const keptOut = [];
  const keptOutIdx = new Set();

  studentTurns.forEach((t, i) => {
    if (essayMatches[t.globalIndex]) { landedIdx.add(i); return; }
    if (!hasProvenance || !PUSHBACK_LABELS.has(t.label)) return;
    const aiTurn = getAITurnBefore(i, classified);
    if (!aiTurn) return;
    const landedFromThatTurn = provenanceData.some(p => p.origin === "ai-born" && p.traceTurn === aiTurn);
    if (!landedFromThatTurn) { keptOutIdx.add(i); keptOut.push({ i, turn: t, aiTurn }); }
  });

  const madeItFromAI = provenanceData.filter(p => p.origin === "ai-born" && p.traceTurn && p.traceTurn.role === "ai");

  const restIdx = studentTurns
    .map((_, i) => i)
    .filter(i => !landedIdx.has(i) && !keptOutIdx.has(i));

  function landedCard(i) {
    const t = studentTurns[i];
    const item = essayMatches[t.globalIndex][0];
    return `
      <div class="turn landed" id="session-turn-${i}">
        <div class="turn-num">${i + 1}</div>
        <div class="turn-body">
          <div class="turn-top-row">${labelBadge(t.label)}</div>
          <div class="turn-text">${esc(t.text)}</div>
          ${patternNote(i)}
          <div class="side-panel landed">
            <span class="glyph">&#10003;</span>
            <div class="side-panel-text">
              <span class="tag">In your essay</span>
              <q>${esc(item.phrase)}</q>
            </div>
          </div>
        </div>
      </div>`;
  }

  function keptOutCard({ i, turn, aiTurn }) {
    const preview = aiTurn.text.length > 140 ? aiTurn.text.slice(0, 140) + "…" : aiTurn.text;
    return `
      <div class="turn excluded" id="session-turn-${i}">
        <div class="turn-num">${i + 1}</div>
        <div class="turn-body">
          <div class="turn-top-row">${labelBadge(turn.label)}</div>
          <div class="turn-text">${esc(turn.text)}</div>
          ${patternNote(i)}
          <div class="side-panel excluded">
            <span class="glyph">&#8856;</span>
            <div class="side-panel-text">
              <span class="tag">Stayed out of your essay</span>
              The AI suggested "${esc(preview)}" — it doesn't appear anywhere in your draft.
            </div>
          </div>
        </div>
      </div>`;
  }

  function fromAICard(item) {
    const aiTurn = item.traceTurn;
    const preview = aiTurn.text.length > 140 ? aiTurn.text.slice(0, 140) + "…" : aiTurn.text;
    return `
      <div class="turn flagged">
        <div class="turn-body">
          <div class="turn-top-row"><span class="turn-role">AI &middot; ${esc(aiTurn.label || "content")}</span></div>
          <div class="turn-text">${esc(preview)}</div>
          <div class="side-panel flagged">
            <span class="glyph">i</span>
            <div class="side-panel-text">
              <span class="tag">In your essay, unchallenged</span>
              <q>${esc(item.phrase)}</q>
            </div>
          </div>
          <p class="turn-caption">This is close to what the AI said, with nothing in between pushing back on it. Worth a second read before you submit.</p>
        </div>
      </div>`;
  }

  const navHtml = hasProvenance ? `
    <div class="group-nav">
      <button type="button" data-target="rg-1"><span class="n">${landedIdx.size}</span><span class="lbl">Became<br>your essay</span></button>
      <button type="button" data-target="rg-2"><span class="n">${keptOut.length}</span><span class="lbl">You kept<br>it out</span></button>
      <button type="button" data-target="rg-3"><span class="n">${madeItFromAI.length}</span><span class="lbl">Made it in<br>from the AI</span></button>
      <button type="button" data-target="rg-4"><span class="n">${restIdx.length}</span><span class="lbl">Didn't go<br>anywhere</span></button>
    </div>` : "";

  const g1 = landedIdx.size ? `
    <div class="group" id="rg-1">
      <div class="group-head">
        <p class="group-title">Became your essay</p>
        <p class="group-desc">These turns' ideas are in your draft, and they trace back to you.</p>
      </div>
      <div class="turn-list">${foldCards([...landedIdx].sort((a, b) => a - b).map(landedCard))}</div>
    </div>` : "";

  const g2 = keptOut.length ? `
    <div class="group" id="rg-2">
      <div class="group-head">
        <p class="group-title">You kept it out</p>
        <p class="group-desc">You pushed back on something the AI offered, and it never made it into your draft. Not every disagreement needs to end up on the page to count.</p>
      </div>
      <div class="turn-list">${foldCards(keptOut.map(keptOutCard))}</div>
    </div>` : "";

  const g3 = madeItFromAI.length ? `
    <div class="group" id="rg-3">
      <div class="group-head">
        <p class="group-title">Made it in from the AI</p>
        <p class="group-desc">This is in your draft, but it started with the AI — no challenge in between. Worth a second read before you submit.</p>
      </div>
      <div class="turn-list">${foldCards(madeItFromAI.map(fromAICard))}</div>
    </div>` : "";

  const g4Title = hasProvenance ? "Didn't go anywhere" : "Your session";
  const g4Desc  = hasProvenance
    ? "Turns that didn't feed the draft either way — content requested but not used, check-ins, side notes."
    : "Essay tracing wasn't available for this draft, so these turns aren't grouped by outcome.";
  const g4 = restIdx.length ? `
    <div class="group" id="rg-4">
      <div class="group-head">
        <p class="group-title">${g4Title}</p>
        <p class="group-desc">${g4Desc}</p>
      </div>
      <details class="acard-disclosure acard-disclosure-prompt"${hasProvenance ? "" : " open"}>
        <summary class="acard-disclosure-toggle">${iconSVG("expandMore", "acard-disclosure-icon")}Show these ${restIdx.length} turns</summary>
        <div class="turn-list" style="margin-top:var(--tau-s3)">${restIdx.map(i => compactRow(studentTurns[i], i)).join("")}</div>
      </details>
    </div>` : "";

  return `${navHtml}${g1}${g2}${g3}${g4}`;
}

function initReflectInteractions() {
  const container = document.getElementById("reflectContent");
  if (!container) return;
  container.addEventListener("click", e => {
    const btn = e.target.closest(".group-nav button[data-target]");
    if (!btn) return;
    const target = document.getElementById(btn.dataset.target);
    if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

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
function renderJumpScore(scores) {
  const { totalScore, SAMR } = scores;
  const band = BAND_META[SAMR];
  return `
    <span class="report-jump-score-n">${totalScore}<span class="report-jump-score-of">/20</span></span>
    <span class="report-jump-score-band" style="color: var(--tau-band-${band.n}-fg)">${esc(band.label)}</span>`;
}

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
    summaryPanel: "overview",
    tabReflect: "my-session",
    tabChart: "agency-chart",
    tabDriving: "whos-driving",
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

document.getElementById("patternGuideBtn")?.addEventListener("click", () => openPatternGuideModal());
document.getElementById("patternGuideModalClose")?.addEventListener("click", () => closePatternGuideModal());
document.getElementById("patternGuideModal")?.addEventListener("click", (e) => {
  if (e.target.id === "patternGuideModal") closePatternGuideModal();
});

// Bars / Trend line toggle — independent show/hide, not exclusive.
document.querySelectorAll("#chartToggle [data-layer]").forEach(btn => {
  btn.addEventListener("click", () => {
    const on = !btn.classList.contains("is-active");
    btn.classList.toggle("is-active", on);
    document.querySelectorAll(`#agencyChart .layer-${btn.dataset.layer}`).forEach(el => el.classList.toggle("mode-hidden", !on));
  });
});
