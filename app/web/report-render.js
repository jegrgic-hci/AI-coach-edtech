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

const STRIP_TIER = {
  challenge:  "high",    rejection:  "high",    claim:      "high",
  refinement: "medhigh", conceptual: "medhigh",
  feedback:   "medium",  pivot:      "medium",  narrative:  "medium",
  extraction: "neutral",
  validation: "low",     stuck:      "verylow",
};

const PATTERN_STYLE = {
  high:   { bg: "#f0fdf4", border: "#86efac", text: "#14532d" },
  medium: { bg: "#eff6ff", border: "#bfdbfe", text: "#1e3a8a" },
  low:    { bg: "#fefce8", border: "#fde047", text: "#713f12" },
};

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

function computeChartSummary(student) {
  const total        = student.length;
  const passiveCount = student.filter(d => (TURN_VALUE[d.label] ?? 0) < 0).length;
  const highCount    = student.filter(d => (TURN_VALUE[d.label] ?? 0) >= 3).length;
  const passivePct   = passiveCount / total;
  const highPct      = highCount / total;
  let longestRun = 0, bestStart = null, cur = 0, curStart = null;
  student.forEach((d, i) => {
    if ((TURN_VALUE[d.label] ?? 0) < 0) {
      if (cur === 0) curStart = i + 1;
      cur++;
      if (cur > longestRun) { longestRun = cur; bestStart = curStart; }
    } else { cur = 0; }
  });
  let verdict, verdictClass, verdictDesc;
  if (passivePct >= 0.35 || longestRun >= 5) {
    verdict = "Passive concern"; verdictClass = "passive";
    verdictDesc = "Over a third of turns were passive, or the student had a run of 5 or more consecutive passive turns. Look for highlighted pattern regions in the chart.";
  } else if (highPct >= 0.35 && passivePct < 0.25) {
    verdict = "High engagement"; verdictClass = "high";
    verdictDesc = "More than 35% of turns show high-agency behaviour — challenge, claim, conceptual, or pivot — with low passive activity.";
  } else {
    verdict = "Mixed session"; verdictClass = "";
    verdictDesc = "This session has a roughly even spread of high-agency and passive turns with no dominant pattern.";
  }
  return { verdict, verdictClass, verdictDesc, longestRun, bestStart, highCount, total };
}

function renderChartSummary(s) {
  const runValue = s.longestRun === 0 ? "None" : `${s.longestRun} consecutive`;
  const runSub   = s.longestRun > 0 ? `turns ${s.bestStart}–${s.bestStart + s.longestRun - 1}` : "";
  let verdictHtml;
  if (s.verdictClass === "passive") {
    verdictHtml = `<span class="div-verdict-chip div-verdict-passive">${esc(s.verdict)}</span>`;
  } else if (s.verdictClass === "high") {
    verdictHtml = `<span class="div-verdict-chip div-verdict-high">${esc(s.verdict)}</span>`;
  } else {
    verdictHtml = `<span class="div-verdict-plain">${esc(s.verdict)}</span>`;
  }
  return `<div class="div-summary-strip">
    <div class="div-verdict-block">
      <span class="div-strip-label">Overall</span>
      ${verdictHtml}
    </div>
    <div class="div-stat-block">
      <span class="div-strip-label">Longest passive stretch</span>
      <span class="div-stat-value">${runValue}</span>
      ${runSub ? `<span class="div-stat-sub">${esc(runSub)}</span>` : ""}
    </div>
    <div class="div-stat-block">
      <span class="div-strip-label">Turns where you led</span>
      <span class="div-stat-value">${s.highCount} of ${s.total}</span>
      <span class="div-stat-sub">${Math.round(s.highCount / s.total * 100)}% of session</span>
    </div>
  </div>`;
}

function renderDivLegend() {
  if (typeof d3 === "undefined") return "";
  const posS = d3.scaleSequential().domain([1, 4]).interpolator(d3.interpolateRgb("#9b9de0", "#4F52C8"));
  const negS = d3.scaleSequential().domain([-1, -2]).interpolator(d3.interpolateRgb("#e8ae94", "#b85c38"));
  const fill = v => v === 0 ? "#b0b0b0" : v > 0 ? posS(v) : negS(v);
  const items = [
    { v: -2, label: "stuck" },
    { v: -1, label: "validation" },
    null,
    { v:  0, label: "extraction" },
    null,
    { v:  1, label: "feedback / narrative" },
    { v:  2, label: "refinement" },
    { v:  3, label: "claim / conceptual / pivot" },
    { v:  4, label: "challenge / rejection" },
  ];
  const parts = items.map(item => {
    if (!item) return '<div class="div-legend-divider"></div>';
    const prefix = item.v > 0 ? `+${item.v}` : String(item.v);
    const style  = `background:${fill(item.v)};${item.v === 0 ? "border:1px solid #ccc;" : ""}`;
    return `<div class="div-legend-item">
      <div class="div-legend-swatch" style="${style}"></div>
      <span>${prefix}&nbsp;&nbsp;${esc(item.label)}</span>
    </div>`;
  });
  return `<div class="div-legend">${parts.join("")}</div>`;
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

  return patterns;
}

function openPatternCatalogue() {
  document.getElementById("dt-sidebar-title").textContent = "Detectable patterns";
  const HIGH = [
    { id: "challenge-arc",      label: "Challenge Arc" },
    { id: "argument-engaged",   label: "Argument Engaged" },
    { id: "rejection-redirect", label: "Rejection → Redirect" },
    { id: "claim-support",      label: "Claim-Support Cycle" },
    { id: "extraction-landing", label: "Extraction → Insight" },
  ];
  const PASSIVE = [
    { id: "extraction-loop",   label: "Extraction Loop" },
    { id: "validation-spiral", label: "Validation Spiral" },
    { id: "helplessness-loop", label: "Helplessness Loop" },
    { id: "missed-argument",   label: "Missed Argument" },
    { id: "flitting",          label: "Flitting" },
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
  document.getElementById("dt-sidebar-body").innerHTML = `
    <div class="dt-cat-section-label" style="color:#3B3EA8;">High-agency patterns</div>
    ${cardGroup(HIGH, "dt-cat-card-name--high")}
    <div class="dt-cat-section-label" style="color:#b85c38;margin-top:28px;">Passive patterns</div>
    ${cardGroup(PASSIVE, "dt-cat-card-name--low")}`;
  document.getElementById("dt-sidebar").classList.add("open");
}

function renderPatternGuide() {
  const HIGH = [
    { id: "challenge-arc",      label: "Challenge Arc" },
    { id: "argument-engaged",   label: "Argument Engaged" },
    { id: "rejection-redirect", label: "Rejection → Redirect" },
    { id: "claim-support",      label: "Claim-Support Cycle" },
    { id: "extraction-landing", label: "Extraction → Insight" },
  ];
  const PASSIVE = [
    { id: "extraction-loop",   label: "Extraction Loop" },
    { id: "validation-spiral", label: "Validation Spiral" },
    { id: "helplessness-loop", label: "Helplessness Loop" },
    { id: "missed-argument",   label: "Missed Argument" },
    { id: "flitting",          label: "Flitting" },
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
    <div class="dt-cat-section-label" style="color:#3B3EA8;">High-agency patterns</div>
    ${cardGroup(HIGH, "dt-cat-card-name--high")}
    <div class="dt-cat-section-label" style="color:#b85c38;margin-top:28px;">Passive patterns</div>
    ${cardGroup(PASSIVE, "dt-cat-card-name--low")}`;
}

function showTurnTooltip(event, d) {
  const tooltip = document.getElementById("dt-tooltip");
  const preview = (d.text || "").length > 130 ? d.text.slice(0, 130) + "…" : (d.text || "");
  tooltip.querySelector(".dt-tooltip-title").textContent = `Turn ${d.id}`;
  tooltip.querySelector(".dt-tooltip-body").innerHTML =
    `<span style="display:inline-block;padding:1px 7px;border-radius:99px;background:#f0f1f8;color:#3B3EA8;font-size:10px;font-weight:600;letter-spacing:0.05em;text-transform:uppercase;margin-bottom:6px;">${esc(d.classifier)}</span><br>${esc(preview)}`;
  document.getElementById("dt-tooltip-learn-more").style.display = "none";
  tooltip.classList.add("dt-tooltip--turn");
  tooltip.style.display = "block";
  const pad = 12, tw = tooltip.offsetWidth, th = tooltip.offsetHeight;
  tooltip.style.left = (event.clientX + pad + tw > window.innerWidth  ? event.clientX - tw - pad : event.clientX + pad) + "px";
  tooltip.style.top  = (event.clientY + pad + th > window.innerHeight ? event.clientY - th - pad : event.clientY + pad) + "px";
}

function hideTurnTooltip() {
  const tooltip = document.getElementById("dt-tooltip");
  tooltip.style.display = "none";
  tooltip.classList.remove("dt-tooltip--turn");
}

// ── Shared horizontal chart renderer ─────────────────────────────────────────
function renderHorizChart(svgSel, data, patterns, onBarClick, onPatternClick) {
  const hMarg    = { top: 44, right: 24, bottom: 60, left: 24 };
  const hSvgW    = 796;
  const hInnerW  = hSvgW - hMarg.left - hMarg.right;
  const hMaxBarW = 24;
  const hPosU    = 5, hNegU = 3;
  const hInnerH  = 320;
  const hZeroY   = Math.round(hInnerH * hPosU / (hPosU + hNegU));
  const hYTicks  = [-3,-2,-1,0,1,2,3,4,5];
  const hYScale  = d3.scaleLinear().domain([-hNegU, hPosU]).range([hInnerH, 0]);
  const hPosScl  = d3.scaleSequential().domain([1,4]).interpolator(d3.interpolateRgb("#86efac","#14532d"));
  const hNegScl  = d3.scaleSequential().domain([-1,-2]).interpolator(d3.interpolateRgb("#e8ae94","#b85c38"));
  const hFill    = v => v===0 ? "#b0b0b0" : v>0 ? hPosScl(v) : hNegScl(v);

  const n = data.length;
  const probe   = d3.scaleBand().domain(data.map(d=>d.label)).range([0,hInnerW]).paddingInner(0.18).paddingOuter(0.1);
  const barArea = probe.bandwidth() > hMaxBarW ? (hMaxBarW/(1-0.18))*n : hInnerW;
  const xScale  = d3.scaleBand().domain(data.map(d=>d.label)).range([0,barArea]).paddingInner(0.18).paddingOuter(0.1);

  svgSel.attr("width",hSvgW).attr("height",hMarg.top+hInnerH+hMarg.bottom).style("overflow","visible").selectAll("*").remove();

  const defs = svgSel.append("defs");
  defs.append("marker").attr("id","hArrowUp").attr("viewBox","0 -5 10 10").attr("refX",8).attr("refY",0).attr("markerWidth",4).attr("markerHeight",4).attr("orient","auto")
    .append("path").attr("d","M0,-5L10,0L0,5").attr("fill","#059669");
  defs.append("marker").attr("id","hArrowDown").attr("viewBox","0 -5 10 10").attr("refX",8).attr("refY",0).attr("markerWidth",4).attr("markerHeight",4).attr("orient","auto")
    .append("path").attr("d","M0,-5L10,0L0,5").attr("fill","#b85c38");

  const g = svgSel.append("g").attr("transform",`translate(${hMarg.left},${hMarg.top})`);

  const step=xScale.step(), halfGap=step*xScale.paddingInner()/2;
  const bandData=d3.groups(data,d=>Math.floor((d.id-1)/5)).filter(([i])=>i%2===1);
  g.selectAll(".col-band").data(bandData).join("rect").attr("class","col-band")
    .attr("x",([,rows])=>xScale(rows[0].label)-halfGap).attr("y",0)
    .attr("width",([,rows])=>step*rows.length).attr("height",hInnerH).attr("fill","#f2f2f0");

  g.selectAll(".grid-line").data(hYTicks).join("line").attr("class","grid-line")
    .attr("x1",0).attr("x2",barArea).attr("y1",d=>hYScale(d)).attr("y2",d=>hYScale(d));
  g.append("line").attr("class","zero-line").attr("x1",0).attr("x2",barArea).attr("y1",hZeroY).attr("y2",hZeroY);
  g.append("line").attr("x1",0).attr("x2",barArea).attr("y1",0).attr("y2",0).attr("stroke","#ccc").attr("stroke-width",1);
  g.append("line").attr("x1",0).attr("x2",barArea).attr("y1",hInnerH).attr("y2",hInnerH).attr("stroke","#ccc").attr("stroke-width",1);

  patterns.forEach(p => {
    const xs=p.rows.map(r=>xScale(r)).filter(x=>x!==undefined);
    if (!xs.length) return;
    const x1=Math.min(...xs), x2=Math.max(...xs)+xScale.bandwidth(), pw=x2-x1;
    const isPos=p.side==="right", color=isPos?"#3B3EA8":"#b85c38", pad=3;
    const pg=g.append("g").style("cursor","pointer").on("click",e=>onPatternClick(e,p));
    pg.append("rect").attr("x",x1-pad).attr("y",isPos?0:hZeroY).attr("width",pw+pad*2)
      .attr("height",isPos?hZeroY:hInnerH-hZeroY).attr("rx",3).attr("fill",isPos?"#dde3f5":"#fde8de").attr("stroke","none");
    const lb=pg.append("g").attr("transform",`translate(${x1-pad+10},${isPos?12:hInnerH-12})`);
    lb.append("circle").attr("cx",0).attr("cy",-3).attr("r",4.5).attr("fill","none").attr("stroke",color).attr("stroke-width",1.5);
    lb.append("line").attr("x1",-3).attr("y1",1).attr("x2",-3).attr("y2",3).attr("stroke",color).attr("stroke-width",1.5).attr("stroke-linecap","round");
    lb.append("line").attr("x1", 3).attr("y1",1).attr("x2", 3).attr("y2",3).attr("stroke",color).attr("stroke-width",1.5).attr("stroke-linecap","round");
    lb.append("line").attr("x1",-3).attr("y1",3).attr("x2", 3).attr("y2",3).attr("stroke",color).attr("stroke-width",1.5).attr("stroke-linecap","round");
    lb.append("line").attr("x1",-2).attr("y1",5).attr("x2", 2).attr("y2",5).attr("stroke",color).attr("stroke-width",1.5).attr("stroke-linecap","round");
  });

  g.selectAll(".bar").data(data).join("rect").attr("class","bar")
    .attr("x",d=>xScale(d.label))
    .attr("y",d=>{ if(d.value===0) return hZeroY-4; if(d.value>0) return hYScale(d.value); return hZeroY; })
    .attr("width",xScale.bandwidth())
    .attr("height",d=>{ if(d.value===0) return 8; return Math.abs(hYScale(d.value)-hZeroY); })
    .attr("fill",d=>hFill(d.value)).style("cursor","pointer")
    .on("click",(event,d)=>onBarClick(event,d));

  g.selectAll(".turn-label").data(data).join("text")
    .attr("x",d=>xScale(d.label)+xScale.bandwidth()/2).attr("y",hInnerH+16)
    .attr("dy","0.35em").attr("text-anchor","middle")
    .attr("font-family","Helvetica Neue, sans-serif").attr("font-size","13px").attr("fill","#555")
    .text(d=>d.id%5===0?d.label:"");

  [{label:"PASSIVE",cy:hYScale(-1.5),fill:"#c07050"},{label:"NEUTRAL",cy:hYScale(0),fill:"#aaa"},
   {label:"BUILDING",cy:hYScale(1.5),fill:"#1d4ed8"},{label:"QUESTIONING",cy:hYScale(3.5),fill:"#059669"}
  ].forEach(z=>{
    g.append("text").attr("transform",`translate(-8,${z.cy}) rotate(-90)`)
      .attr("text-anchor","middle")
      .attr("font-family","Helvetica Neue, sans-serif").attr("font-size","10px").attr("font-weight","700")
      .attr("letter-spacing","0.07em").attr("fill",z.fill).text(z.label);
  });

  g.append("line").attr("x1",-3).attr("y1",hZeroY-6).attr("x2",-3).attr("y2",6)
    .attr("stroke","#059669").attr("stroke-width",1.5).attr("marker-end","url(#hArrowUp)");
  g.append("line").attr("x1",-3).attr("y1",hZeroY+6).attr("x2",-3).attr("y2",hInnerH-6)
    .attr("stroke","#b85c38").attr("stroke-width",1.5).attr("marker-end","url(#hArrowDown)");

  g.append("text").attr("font-family","Helvetica Neue, sans-serif").attr("font-size","11px").attr("fill","#999")
    .attr("x",barArea/2).attr("y",hInnerH+42).attr("text-anchor","middle").text("Student turns (chronological →)");
}

function renderAgencyChart(classified) {
  if (typeof d3 === "undefined") return;
  const student = classified.filter(t => t.role === "student");
  if (student.length < 2) return;

  // ── Convert to dt sample format ──────────────────────────────────────────
  const turns = student.map((t, i) => ({
    id: i + 1,
    value: TURN_VALUE[t.label] ?? 0,
    classifier: t.label || "extraction",
    text: t.text || "",
  }));
  const PAT_LABEL_MAP = {
    "challenge-arc":"Challenge Arc", "rejection-redirect":"Rejection → Redirect",
    "claim-support":"Claim-Support Cycle", "extraction-landing":"Extraction → Insight",
    "extraction-loop":"Extraction Loop", "validation-spiral":"Validation Spiral",
    "helplessness-loop":"Helplessness Loop", "flitting":"Flitting", "missed-argument":"Missed Argument",
  };
  const rawPatterns = detectPatterns(classified);
  const patterns = rawPatterns.map(p => ({
    rows: Array.from({ length: p.end - p.start + 1 }, (_, k) => String(p.start + k + 1)),
    side: (p.tier === "high" || p.tier === "medium") ? "right" : "left",
    title: PAT_LABEL_MAP[p.id] || p.label,
    aiLabels: Array.from({ length: p.end - p.start + 1 }, (_, k) => getAILabelBefore(p.start + k, classified) || ""),
    _orig: p,
  }));

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
  const legendItems = [
    { value: -2, label: "stuck" }, { value: -1, label: "validation" }, null,
    { value:  0, label: "extraction" }, null,
    { value:  1, label: "feedback / narrative" }, { value:  2, label: "refinement" }, null,
    { value:  3, label: "claim / conceptual / pivot" }, { value:  4, label: "challenge / rejection" },
  ];
  const legendEl = document.getElementById("chartLegendEl");
  legendEl.innerHTML = "";
  legendItems.forEach(item => {
    if (item === null) { const d = document.createElement("div"); d.className = "dt-legend-divider"; legendEl.appendChild(d); return; }
    const wrap = document.createElement("div"); wrap.className = "dt-legend-item";
    const sw   = document.createElement("div"); sw.className = "dt-legend-swatch"; sw.style.background = fillL(item.value);
    if (item.value === 0) sw.style.border = "1px solid #ccc";
    const txt = document.createElement("span");
    txt.textContent = item.label;
    wrap.appendChild(sw); wrap.appendChild(txt); legendEl.appendChild(wrap);
  });

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
  const isRight = p.tier === "high" || p.tier === "medium";
  const color   = isRight ? "#3B3EA8" : "#b85c38";
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

function showTurnModal(d) {
  const modal = document.getElementById("turnModal");
  const box   = document.getElementById("turnModalBox");
  if (!modal || !box) return;
  box.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:14px">
      <div style="display:flex;align-items:center;gap:10px">
        ${labelBadge(d.label)}
        <span style="font-size:11px;color:var(--muted);font-weight:600">Turn ${d.studentIdx + 1}</span>
      </div>
      <button onclick="closeTurnModal()"
        style="background:none;border:none;cursor:pointer;color:var(--muted);font-size:20px;line-height:1;padding:0;flex-shrink:0">&times;</button>
    </div>
    <div style="font-size:13px;color:var(--text);line-height:1.75;white-space:pre-wrap">${esc(d.text)}</div>
  `;
  modal.classList.add("open");
  document.body.style.overflow = "hidden";
}

function closeTurnModal() {
  document.getElementById("turnModal")?.classList.remove("open");
  document.body.style.overflow = "";
}

function showPatternTooltip(event, p, label, color) {
  const tip = document.getElementById("patternTooltip");
  if (!tip) return;
  const desc  = PAT_DESCRIPTIONS[p.id] || "";
  const turns = p.start === p.end ? `Turn ${p.start + 1}` : `Turns ${p.start + 1}–${p.end + 1}`;
  const tier  = p.tier === "high" ? "High agency" : p.tier === "medium" ? "Moderate agency" : "Low agency";
  tip.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;margin-bottom:9px">
      <div style="display:flex;align-items:center;gap:7px;flex-wrap:wrap">
        <span style="padding:2px 8px;border-radius:4px;background:${color}40;color:${color};font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em">${tier}</span>
        <span style="font-size:10px;color:#94a3b8">${turns}</span>
      </div>
      <button onclick="closePatternTooltip()"
        style="background:none;border:none;cursor:pointer;color:#64748b;font-size:16px;line-height:1;padding:0;flex-shrink:0">&times;</button>
    </div>
    <div style="font-weight:700;font-size:13px;color:#fff;margin-bottom:6px">${label}</div>
    <div style="font-size:11px;color:#cbd5e1;line-height:1.6">${desc}</div>
  `;
  // Position near click, clamped to viewport
  const W = 264, H = 160;
  let x = event.clientX + 14;
  let y = event.clientY - 16;
  if (x + W > window.innerWidth  - 8) x = event.clientX - W - 14;
  if (y + H > window.innerHeight - 8) y = window.innerHeight - H - 8;
  if (y < 8) y = 8;
  tip.style.left = x + "px";
  tip.style.top  = y + "px";
  tip.classList.add("open");
}

function closePatternTooltip() {
  document.getElementById("patternTooltip")?.classList.remove("open");
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

function conceptInText(concept, text) {
  const re = conceptRegex(concept);
  return re ? re.test(text) : false;
}

function traceProvenance(provenanceItems, classified, essayText) {
  return provenanceItems.map(({ concept, phrase, origin }) => {
    const positions = findConceptPositions(phrase, essayText);
    const traceTurn = classified.find(t => conceptInText(concept, t.text)) || null;
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
    return { concept, phrase, origin, positions, traceSnippet };
  }).filter(p => p.positions.length > 0);
}

function renderEssayHeatmap(essayText, provenanceData) {
  const spans = [];
  for (const p of provenanceData) {
    if (p.origin === "prior") continue;
    for (const pos of p.positions) spans.push({ ...pos, origin: p.origin, concept: p.concept });
  }
  spans.sort((a, b) => a.start - b.start);
  const PRIORITY = { synthesized: 3, "student-born": 2, "ai-born": 1 };
  const merged = [];
  for (const span of spans) {
    if (merged.length && span.start < merged[merged.length - 1].end) {
      const prev = merged[merged.length - 1];
      if ((PRIORITY[span.origin] || 0) > (PRIORITY[prev.origin] || 0)) prev.origin = span.origin;
      prev.end = Math.max(prev.end, span.end);
    } else {
      merged.push({ ...span });
    }
  }
  let html = "";
  let cursor = 0;
  for (const span of merged) {
    if (span.start > cursor) html += esc(essayText.slice(cursor, span.start));
    html += `<mark class="${span.origin}" title="${esc(span.concept)}">${esc(essayText.slice(span.start, span.end))}</mark>`;
    cursor = span.end;
  }
  html += esc(essayText.slice(cursor));
  return html;
}

// Authorship, not quality. "Student-Born / AI-Born" is filing-cabinet language
// for a thing the student did; this is the same you → together → coach
// vocabulary the conversation map uses, so the two visuals teach one encoding.
const ORIGIN_LABEL = {
  "student-born": "You",
  "prior":        "You, before this",
  "synthesized":  "Together",
  "ai-born":      "The coach",
};

function renderConceptList(provenanceData) {
  return provenanceData.map(p => `
    <div class="concept-row">
      <span class="origin-chip origin-${p.origin}">${ORIGIN_LABEL[p.origin] || p.origin}</span>
      <div>
        <div class="concept-term">${esc(p.concept)}</div>
        <div class="concept-phrase">“${esc(p.phrase)}”</div>
        <div class="concept-trace">${esc(p.traceSnippet)}</div>
      </div>
    </div>`).join("");
}

// One proportional bar plus a legend, rather than four chips each carrying its
// own count and percentage. The bar is the thing that shows a mix at a glance;
// nothing in it is ordered good-to-bad, so no arrangement of it can accuse.
function renderProvStats(provenanceData) {
  const counts = { "student-born": 0, "ai-born": 0, "synthesized": 0, "prior": 0 };
  for (const p of provenanceData) { if (counts[p.origin] !== undefined) counts[p.origin]++; }
  const total = provenanceData.length || 1;

  // "Prior" is knowledge the student brought in and the chat never touched, so
  // it belongs on the same side of the bar as student-born.
  const segments = [
    { cls: "prov-you",      n: counts["student-born"] + counts["prior"], label: "Yours" },
    { cls: "prov-together", n: counts["synthesized"],                    label: "Developed together" },
    { cls: "prov-coach",    n: counts["ai-born"],                        label: "Came from the coach" },
  ];

  const bar = segments.filter(s => s.n > 0).map(s =>
    `<span class="${s.cls}" style="flex:${s.n}"></span>`).join("");
  const legend = segments.map(s =>
    `<span class="legend-item">
       <span class="legend-swatch ${s.cls}"></span>${s.label} — ${s.n} of ${total}
     </span>`).join("");

  return `<div class="prov-bar">${bar}</div><div class="legend">${legend}</div>`;
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

// Direction of travel, not standing — which is the one thing semantic colour is
// allowed to describe here. On a first draft there is no direction yet, and the
// copy has to say so rather than draw a flat line implying no progress.
function renderTrajectory(history, totalScore) {
  const pts = history.map((h) => h.totalScore);
  if (pts.length < 2) {
    return '<span class="traj-cap">First draft — a starting point, not a mark.</span>';
  }

  const prevCycle = history[history.length - 2].cycleIndex + 1;
  const delta = totalScore - pts[pts.length - 2];
  const dir = delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat';
  const word = delta > 0 ? `+${delta}` : delta < 0 ? `${delta}` : 'no change';

  const w = 132, h = 34, pad = 4;
  const x = (i) => pad + (i * (w - pad * 2)) / (pts.length - 1);
  const y = (v) => h - pad - ((v - 4) / 16) * (h - pad * 2);
  const path = pts.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
  const dots = pts.map((v, i) =>
    `<circle class="traj-dot${i === pts.length - 1 ? ' traj-dot-now' : ''}" cx="${x(i).toFixed(1)}" cy="${y(v).toFixed(1)}" r="3"/>`).join('');

  return `
    <svg class="traj-svg" viewBox="0 0 ${w} ${h}" aria-hidden="true">
      <path class="traj-line" d="${path}"/>${dots}
    </svg>
    <span class="traj-cap"><span class="traj-delta traj-${dir}">${word}</span> since draft ${prevCycle}</span>`;
}

// Narrative first, number after. The total carries its band label and its change
// since last draft in the same block, because both are locked requirements and
// splitting them is how a number ends up quoted on its own as a grade.
function renderReportHero(scores, history) {
  const { totalScore, SAMR } = scores;
  const band = BAND_META[SAMR];

  return `
    <div class="card card-lg report-hero">
      <p class="report-lede">${esc(SAMR_DESCRIPTIONS[SAMR])}</p>
      <div class="report-band">
        <span class="band band-${band.n}"><i class="band-pip"></i>${esc(band.label)}</span>
        <span class="band-sub">${esc(SAMR)} on the SAMR scale</span>
      </div>
      <div class="report-total">
        <span class="report-total-n">${totalScore}</span>
        <span class="report-total-of">of 20</span>
        <span class="traj report-traj">${renderTrajectory(history, totalScore)}</span>
      </div>
    </div>`;
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

// No value-keyed colour anywhere in here. A 2 used to render in the same red as
// an error, which makes the report a verdict at the moment it claims to coach.
function renderSummary(scores) {
  return DIM_ORDER.map((k) => {
    const n = scores[k];
    const pips = [1, 2, 3, 4, 5]
      .map((i) => `<i class="${i <= n ? "on" : ""}"></i>`).join("");
    return `
      <div class="dim">
        <span class="dim-abbr">${k}</span>
        <span class="dim-name">${DIM_NAMES[k]}</span>
        <span class="dim-val"><span class="n">${n}</span><span class="of">of 5</span></span>
        <span class="steps" role="img" aria-label="${n} out of 5">${pips}</span>
      </div>`;
  }).join("");
}

// The strip answers "what are my four numbers"; this answers "why". Splitting
// them is what lets .dims stay a four-column strip instead of four columns of
// paragraph, and it puts the reasoning next to the advice that follows from it.
function renderDimDetails(scores) {
  return DIM_ORDER.map((k) => {
    const { explain, nudge } = dimExplanation(k, scores);
    return `
      <div class="dim-detail">
        <div class="dim-detail-head">
          <span class="dim-abbr">${k}</span>
          <h4>${DIM_NAMES[k]}</h4>
          <span class="dim-info">
            <button class="dim-info-btn" type="button"
              aria-label="What ${DIM_NAMES[k]} measures">i</button>
            <span class="dim-tooltip" role="tooltip">${esc(DIM_TOOLTIPS[k])}</span>
          </span>
        </div>
        <p class="dim-say">${esc(explain)}</p>
        ${nudge ? `<p class="dim-nudge">${esc(nudge)}</p>` : ""}
      </div>`;
  }).join("");
}

function renderTurns(classified) {
  return classified.filter(t => t.role === "student").map((t, i) => {
    const preview = t.text.length > 220 ? t.text.slice(0, 220) + "…" : t.text;
    return `
      <div class="turn-row" id="student-turn-${i}">
        ${labelBadge(t.label)}
        <div class="turn-text">${esc(preview)}</div>
      </div>`;
  }).join("");
}

function matchConceptsToTurns(classified, provenanceData) {
  const result = {}; // globalTurnIndex -> [concept, ...]
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
        result[turn.globalIndex].push(prov.concept);
        break;
      }
    }
  }
  return result;
}

const DRIVING_LABELS  = new Set(["claim","conceptual","challenge","rejection","refinement","pivot"]);
const FOLLOWING_LABELS = new Set(["extraction","validation","stuck","feedback","narrative"]);

const LABEL_DESCRIPTIONS = {
  claim:      { title: "Claim", body: "You put forward your own point of view — something you believe or are arguing, not something the AI gave you. These are the moments where your own thinking shows up." },
  conceptual: { title: "Conceptual", body: "You asked a 'how' or 'why' question to actually understand something, not just get content. These turns show you're thinking, not just collecting." },
  challenge:  { title: "Challenge", body: "You questioned or pushed back on what the AI said — asking for evidence, pointing out a problem, or disagreeing with a claim. This is what critical thinking with AI looks like." },
  rejection:  { title: "Rejection", body: "You disagreed with or dismissed what the AI gave you. A clear sign you're deciding what's good and what isn't, rather than just accepting everything." },
  refinement: { title: "Refinement", body: "You told the AI what to change, cut, or do differently. You were steering it — not just reading what it produced." },
  narrative:  { title: "Narrative", body: "You gave the AI context about your situation, task, or background. These turns help the AI understand what you need, but don't directly develop your argument." },
  pivot:      { title: "Pivot", body: "You changed topic or direction, starting a new thread in the conversation. Whether that was a good move depends on what came after." },
  feedback:   { title: "Feedback", body: "You reacted to the AI's output — something like 'good' or 'that works' — without changing direction. Not very significant on its own, but useful if it leads to a challenge or refinement." },
  extraction: { title: "Extraction", body: "You asked the AI to give you content, facts, or information. Getting content from AI isn't a bad thing — what matters is what you do with it next." },
  validation: { title: "Validation", body: "You asked the AI to confirm or check something — often its own previous answer. If this happens a lot, it might mean you're relying on the AI to judge things instead of forming your own opinion." },
  stuck:      { title: "Stuck", body: "You told the AI you were unsure or struggling, and asked it to help you move forward. Getting stuck is normal — but if it happens a lot in a row, it may mean the AI is doing the thinking instead of you." },
};

const PATTERNS_DESCRIPTION = {
  title: "Patterns",
  body: "Patterns are sequences of turns that the tool recognised — like a run of content requests, or a challenge followed by a refinement. They're detected automatically based on the order and types of your turns. The groups below show which turns belong together and what pattern they form.",
};

function sessionBucket(label) {
  if (DRIVING_LABELS.has(label))  return "driving";
  if (FOLLOWING_LABELS.has(label)) return "following";
  return "following";
}

function renderReflect(classified, provenanceData, essayRaw) {
  const studentTurns = classified
    .map((t, i) => ({ ...t, globalIndex: i }))
    .filter(t => t.role === "student");

  const essayMatches = matchConceptsToTurns(classified, provenanceData);
  const hasEssay = !!(essayRaw && essayRaw.trim());

  // Build index: student turn position → pattern
  const patterns = detectPatterns(classified);
  const turnPattern = {};
  for (const p of patterns) {
    for (let i = p.start; i <= p.end; i++) turnPattern[i] = p;
  }

  // Count per label in the order they appear in the legend
  const LABEL_ORDER = ["claim","conceptual","challenge","rejection","refinement","narrative","pivot","feedback","extraction","validation","stuck"];
  const counts = {};
  for (const t of studentTurns) counts[t.label] = (counts[t.label] || 0) + 1;

  const patternTurnIndices = new Set();
  for (const p of patterns) {
    for (let j = p.start; j <= p.end; j++) patternTurnIndices.add(j);
  }

  const dashCards = LABEL_ORDER
    .filter(l => counts[l])
    .map(l => `
      <div class="session-dash-card" data-filter="label" data-label="${l}">
        <div class="session-dash-count">${counts[l]}</div>
        ${labelBadge(l)}
      </div>`)
    .join("");

  const patternCard = patterns.length > 0 ? `
    <div class="session-dash-card patterns-card" data-filter="patterns">
      <div class="session-dash-count">${patterns.length}</div>
      <div class="session-dash-label">Patterns</div>
    </div>` : "";

  const dashboard = `<div class="session-dashboard">${dashCards}${patternCard}</div>
    <div class="session-desc-panel" id="session-desc-panel" style="display:none">
      <h4 id="session-desc-title"></h4>
      <p id="session-desc-body"></p>
    </div>`;

  function renderTurn(t, i) {
    const bucket = sessionBucket(t.label);
    const concepts = essayMatches[t.globalIndex] || [];
    const essayBadge = concepts.length
      ? `<span class="session-essay-badge">in your essay — ${esc(concepts[0])}</span>`
      : "";
    const inPattern = patternTurnIndices.has(i) ? " data-in-pattern=\"true\"" : "";
    const pat = turnPattern[i];
    const patternFootnote = pat
      ? `<div class="session-turn-pattern-note">Part of a <strong>${esc(pat.label)}</strong> pattern</div>`
      : "";
    return `
      <div class="session-turn ${bucket}" id="session-turn-${i}" data-label="${t.label}"${inPattern}>
        <div class="session-turn-num">${i + 1}</div>
        <div class="session-turn-body">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:6px">
            ${labelBadge(t.label)}
            ${essayBadge}
          </div>
          <div class="session-turn-text">${esc(t.text)}</div>
          ${patternFootnote}
        </div>
      </div>`;
  }

  // Flat view: all turns with footnotes
  let flatHtml = "";
  for (let i = 0; i < studentTurns.length; i++) {
    flatHtml += renderTurn(studentTurns[i], i);
  }

  // Grouped view: pattern turns wrapped in group blocks, non-pattern turns hidden
  let groupedHtml = "";
  let gi = 0;
  while (gi < studentTurns.length) {
    const p = turnPattern[gi];
    if (p && p.start === gi) {
      const desc = PAT_DESCRIPTIONS[p.id] || "";
      groupedHtml += `<div class="pattern-group tier-${p.tier}">
        <div class="pattern-group-header">
          <span class="pattern-group-label">${esc(p.label)}</span>
          <span class="pattern-group-desc">${esc(desc)}</span>
        </div>`;
      for (let j = p.start; j <= p.end; j++) {
        groupedHtml += renderTurn(studentTurns[j], j);
      }
      groupedHtml += `</div>`;
      gi = p.end + 1;
    } else {
      gi++;
    }
  }

  const essayNote = !hasEssay
    ? `<div class="no-essay-note">Paste your essay above to see which of your turns made it into your final draft.</div>`
    : "";

  return `
    ${dashboard}
    ${essayNote}
    <div class="session-turn-list" data-flat="${encodeURIComponent(flatHtml)}" data-grouped="${encodeURIComponent(groupedHtml)}">${flatHtml}</div>`;
}

function initReflectDashboard() {
  const container = document.getElementById("reflectContent");
  if (!container) return;

  const descPanel = document.getElementById("session-desc-panel");
  const descTitle = document.getElementById("session-desc-title");
  const descBody  = document.getElementById("session-desc-body");

  let activeFilter = null;

  function applyFilter(filter) {
    const list = container.querySelector(".session-turn-list");

    if (!filter) {
      if (list) list.innerHTML = decodeURIComponent(list.dataset.flat || "");
      descPanel.style.display = "none";
      return;
    }

    if (filter === "patterns") {
      if (list) list.innerHTML = decodeURIComponent(list.dataset.grouped || "");
      descTitle.textContent = PATTERNS_DESCRIPTION.title;
      descBody.textContent  = PATTERNS_DESCRIPTION.body;
      descPanel.style.display = "block";
    } else {
      if (list) list.innerHTML = decodeURIComponent(list.dataset.flat || "");
      const turns = list ? list.querySelectorAll(".session-turn") : [];
      turns.forEach(el => {
        el.classList.toggle("filtered-out", el.dataset.label !== filter);
      });
      const def = LABEL_DESCRIPTIONS[filter];
      if (def) {
        descTitle.textContent = def.title;
        descBody.textContent  = def.body;
        descPanel.style.display = "block";
      }
    }
  }

  container.addEventListener("click", e => {
    const card = e.target.closest(".session-dash-card");
    if (!card) return;

    const filter = card.dataset.filter === "patterns" ? "patterns" : card.dataset.label;

    if (activeFilter === filter) {
      // deselect — show all
      activeFilter = null;
      container.querySelectorAll(".session-dash-card").forEach(c => c.classList.remove("active"));
      applyFilter(null);
    } else {
      activeFilter = filter;
      container.querySelectorAll(".session-dash-card").forEach(c => c.classList.remove("active"));
      card.classList.add("active");
      applyFilter(filter);
    }
  });
}

function renderLegend() {
  const labels = ["challenge","rejection","refinement","claim","conceptual","narrative","pivot","feedback","extraction","validation","stuck"];
  return labels.map(l => `<div class="legend-item">${labelBadge(l)}</div>`).join("");
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

const TAB_MAP = { chart: "tabChart", provenance: "tabProvenance", divergence: "tabDivergence", reflect: "tabReflect", patternguide: "tabPatternGuide" };

function activateTab(key) {
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.tab === key);
  });
  document.querySelectorAll(".tab-pane").forEach(pane => pane.classList.remove("active"));
  const target = document.getElementById(TAB_MAP[key]);
  if (target) target.classList.add("active");
}

document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.addEventListener("click", () => activateTab(btn.dataset.tab));
});
