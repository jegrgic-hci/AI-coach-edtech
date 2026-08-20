// ── Behavioural pattern detection — the one copy ────────────────────────────
//
// Moved here from report-render.js on 2026-08-14, unchanged. It lived in the
// browser and ran at render time, so its output reached the student's report
// and nothing else: the teacher dashboard never saw a single one of these,
// and nothing was ever stored. patterns.md was written as though no detector
// existed and specified six replacements from scratch — four of which
// duplicate detectors below under different definitions. This file exists so
// that cannot happen twice.
//
// It sits in app/web/ rather than app/server/ because both sides need it and
// only this direction works without a build step: the server can require a
// browser script, the browser cannot require a server module. WEB_DIR is
// served statically (index.js:2256), so report.html loads it with a plain
// <script> tag ahead of report-render.js.
//
// Pure — no I/O, no LLM calls, no DOM. It reads `classified`, which every
// analysis doc already stores in full (analysis.js), so it backfills over
// historical submissions for free.
//
// DISPLAY COPY DOES NOT BELONG HERE. Pattern labels, explanations and
// teacher-facing prose stay with their surface (report-render.js has the
// student's; the dashboard will have the teacher's). This file owns ids,
// tiers and turn spans — what was detected, and where.

(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.getAILabelBefore = api.getAILabelBefore; root.detectPatterns = api.detectPatterns; }
})(typeof self !== 'undefined' ? self : this, function () {

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

// Thresholds carried over verbatim, and every one of them is a guess — no
// transcript was counted to produce "3 consecutive extractions" or "4
// alternating turns". They are marked rather than changed: correcting them
// needs real distributions (patterns.md, Validation plan), and changing them
// during a file move would silently alter what students have already been
// told about their own sessions.
//
// The single-turn interaction moments at the bottom carry no threshold at
// all. They are the detectors that can be trusted today.
function detectPatterns(classified) {
  const student  = classified.filter(t => t.role === "student");
  const labels   = student.map(t => t.label || "extraction");
  const aiLabels = student.map((_, i) => getAILabelBefore(i, classified));
  const n = labels.length;
  const patterns = [];

  const HIGH_LABELS    = new Set(["claim", "refinement", "challenge", "rejection"]);
  const PASSIVE_LABELS = new Set(["extraction", "validation", "stuck"]);

  // High agency: challenge arc (2+ consecutive challenges)   [threshold: 2]
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

  // Medium: extraction with landing. Pure sequence — the student's own two
  // turns, and nothing from the AI's side.
  //
  // It used to carry `tier = aiLabels[i] === "argument" ? "high" : "medium"`,
  // which made it the one detector in this file mixing two sources. Removed
  // 2026-08-18, once AI turns were labelled and the clause could finally be
  // read against real data. Three reasons, in order of weight:
  //
  //   1. It read the AI turn before the *extraction*, not before the landing —
  //      "was the AI arguing when you asked it to write?", when the elevation
  //      plainly means "was the AI arguing when you pushed back?".
  //   2. Repairing that by reading aiLabels[i + 1] would make it read the exact
  //      turn pair `argument-engaged` reads, so one event would increment two
  //      patterns — what patterns.md's shared-evidence rule forbids. The AI-side
  //      reading belongs to `argument-engaged`, which can now do it.
  //   3. It never fired. Across all four seeded tiers the AI turn before a
  //      landing extraction is `definition` or `content`, never `argument`, so
  //      no stored analysis loses an elevation it had.
  for (let i = 0; i < n - 1; i++) {
    if (labels[i] === "extraction" && HIGH_LABELS.has(labels[i + 1])) {
      patterns.push({ start: i, end: i + 1, id: "extraction-landing", label: "Extraction → Insight", tier: "medium" });
    }
  }

  // Low: extraction loop (3+ consecutive extractions)   [threshold: 3, guessed]
  for (let i = 0; i < n - 2; i++) {
    if (labels[i] === "extraction" && labels[i+1] === "extraction" && labels[i+2] === "extraction") {
      let end = i + 2;
      while (end + 1 < n && labels[end + 1] === "extraction") end++;
      patterns.push({ start: i, end, id: "extraction-loop", label: "Extraction Loop", tier: "low" });
      i = end;
    }
  }

  // Low: validation spiral (extraction/validation alternating 4+ turns)
  // [threshold: span >= 4, guessed — and NOT what patterns.md #1 specifies,
  //  which is a run of 3 from the same set with no alternation requirement.
  //  Two different detectors under one name; this is the one that shipped.]
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
  // [threshold: 3 pivots, guessed. This is patterns.md's "pivot churn",
  //  which that file records as "completely unmeasured" — it ships here.]
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
  //
  // No threshold anywhere below — the AI either corrected the student or it
  // didn't, and they either held or folded. That makes these four the only
  // detectors in this file that need nothing calibrated before a teacher can
  // be shown them.
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

return { getAILabelBefore: getAILabelBefore, detectPatterns: detectPatterns };
});
