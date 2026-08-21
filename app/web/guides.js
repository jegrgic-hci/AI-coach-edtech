// Signal reference data, shared by the dashboard (which renders the signal
// pills from it) and by signals.html (which renders the whole guide). Lived
// inline in dashboard.html until 2026-08-22, when 'Worth a chat, explained'
// became a page of its own and a second surface needed the same source.
//
// FLAG_META is the copy a teacher reads; FLAG_TYPES groups a flag by what kind
// of thing it is, which is what the guide's chips print. A flag with no entry
// in FLAG_TYPES reads as 'integrity'.

const FLAG_META = {
  'stylistic-inconsistency': {
    short: 'Stylistic inconsistency',
    desc: 'Vocabulary and complexity shifts sharply between student turns',
    what: 'The student\'s writing shows significant jumps in vocabulary, sentence complexity, or tone between turns — beyond what normal drafting usually produces.',
    why: 'These shifts can indicate that text from an external source was introduced mid-session rather than composed in place. Natural revision tends to evolve gradually; abrupt changes are harder to explain by the conversation alone.',
    steps: [
      'Compare the flagged turn directly against surrounding turns and look for abrupt tone or vocabulary shifts.',
      'Ask the student to explain their reasoning in the flagged section in their own words.',
      'Consider whether the shift aligns with a new topic or a genuine change in approach — those are expected and fine.',
    ],
  },
  'unnatural-fluency': {
    short: 'Unnatural fluency',
    desc: 'Student turns lack the hedging and false starts typical of live composition',
    what: 'The student\'s turns read as polished and certain throughout — no hedging phrases ("I think", "maybe", "not sure if"), no self-corrections, no colloquial language. This pattern is unusual for in-session writing.',
    why: 'Live composition typically includes uncertainty markers and self-correction. Uniformly high fluency may suggest the student was submitting pre-composed or AI-generated text as their own prompts rather than thinking out loud in real time.',
    steps: [
      'Look at whether the student turns read more like essay prose than conversational thinking-out-loud.',
      'Ask the student to walk you through how they arrived at a specific turn in their own words.',
      'A low-stakes verbal check-in is often enough to clarify whether the student genuinely engaged with the material.',
    ],
  },
  'provenance-mismatch': {
    short: 'Provenance mismatch',
    desc: 'A concept appears in the essay as student-originated but the AI introduced it first',
    what: 'The provenance analysis found that an idea credited in the essay to the student\'s own thinking was actually introduced by the AI earlier in the conversation.',
    why: 'This doesn\'t automatically mean the student acted in bad faith — they may have genuinely absorbed and reframed the idea. But it warrants a closer look when the essay presents the concept as independently derived.',
    steps: [
      'Identify the specific concept in the chat log and in the essay.',
      'Ask the student when and how they first encountered that idea.',
      'This can be a teaching moment: discuss the difference between internalising a concept and independently originating one.',
    ],
  },
  'shadow-session-pattern': {
    short: 'Shadow session pattern',
    desc: 'Student responses are well-calibrated to AI output with very little pushback',
    what: 'The student\'s turns show very high passive acceptance of AI suggestions and almost no challenge, rejection, or refinement. The interaction pattern resembles a student who arrived with polished inputs rather than composing in real time.',
    why: 'Genuine AI-assisted writing involves friction — students push back, redirect, and question. An unusually smooth acceptance pattern may indicate the AI session was staged after the actual writing was done elsewhere.',
    steps: [
      'Review the ratio of extraction and validation turns against challenge and refinement turns in the TAU breakdown.',
      'Ask the student to describe a moment where they disagreed with or changed something the AI suggested.',
      'This flag is more significant when paired with Unnatural Fluency — both together strengthen the concern.',
    ],
  },
  'score-spike': {
    short: 'Score spike',
    desc: 'TAU score increased sharply between two submissions in a short window',
    what: 'Two submissions were made within a short time window, but the TAU score jumped significantly — more than would be expected from a normal revision cycle.',
    why: 'Rapid score improvement can indicate that the student submitted an initial draft, then quickly replaced it with a substantially different session — possibly one prepared in advance or generated with different inputs.',
    steps: [
      'Compare the two submissions side by side using the scores and timestamps above.',
      'Ask the student what changed between the two versions and why they resubmitted so quickly.',
      'A spike on a single dimension is less concerning than a broad jump across all four.',
    ],
  },
  'reflection-score-mismatch': {
    short: 'Reflection–Score Gap',
    desc: "Student described pushback or prior knowledge the scores don't show",
    what: "The student's reflection described challenging or disagreeing with the AI, or claimed strong prior knowledge — but their scores tell a different story. Their Calibrated Skepticism or Original Contribution score was low, suggesting little actual pushback or independent contribution occurred in the session.",
    why: "The reflection contained language associated with critical engagement (\"pushed back\", \"challenged\", \"disagreed\", \"already knew\") while the corresponding score was below 2.5. This mismatch may mean the student overestimated their own engagement, or they understand what good process looks like without yet having the habit of acting on it.",
    steps: [
      "Read the student's reflection challenge response alongside their actual session log.",
      "Ask the student to point to a specific moment in the chat where they disagreed with the AI — if they can\'t, that\'s informative.",
      "This is often a teaching opportunity: the student may have the right instincts but not yet the habit of acting on them in real time.",
    ],
  },
  'reflection-delta-mismatch': {
    short: 'Delta–Score Mismatch',
    desc: "Student described improvement in their follow-up reflection but scores didn't change",
    what: "The student's \"What shifted?\" reflection described becoming more critical, skeptical, or independent in how they used the AI — but their TAU scores did not increase between submissions.",
    why: "The delta reflection contained improvement language (\"more skeptical\", \"pushed back more\", \"more critical\") while the total score stayed the same or decreased. This suggests the student may be describing the behavior they intended rather than the behavior they demonstrated.",
    steps: [
      "Look at the specific dimension scores the student implicitly claimed to improve — CS if they mentioned skepticism, OC if they mentioned more independent thinking.",
      "Ask the student what specific change they made to their process, and whether they can point to it in the chat log.",
      "Consider whether the student is reflecting on intent rather than action — this is common and addressable with a brief one-on-one conversation.",
    ],
  },
};

const FLAG_TYPES = {
  'stylistic-inconsistency':   'integrity',
  'unnatural-fluency':         'integrity',
  'provenance-mismatch':       'integrity',
  'shadow-session-pattern':    'integrity',
  'score-spike':               'score',
  'reflection-score-mismatch': 'reflection',
  'reflection-delta-mismatch': 'reflection',
};


// One card per signal, in FLAG_META order. Same markup the modal used, so the
// .flag-card / .tray-section-* rules in components.css carry over unchanged.
function flagGuideCardsHTML() {
  return Object.entries(FLAG_META).map(([key, f]) => {
    const type = FLAG_TYPES[key] || 'integrity';
    const typeLabel = type === 'integrity'
      ? '<span class="flag-type-label chip-neutral">Integrity</span>'
      : type === 'reflection'
        ? '<span class="flag-type-label chip-neutral">Reflection</span>'
        : '<span class="flag-type-label chip-neutral">Score analysis</span>';
    const steps = f.steps?.length
      ? `<div class="tray-section-label">What to do</div>
         <ol class="flag-card-steps">${f.steps.map(s => `<li>${s}</li>`).join('')}</ol>`
      : '';
    return `<div class="flag-card">
      <div class="flag-card-header">
        <span class="flag-card-title">${f.short}</span>
        ${typeLabel}
      </div>
      <div class="flag-card-desc">${f.desc}</div>
      <div class="tray-section-label">What the tool detects</div>
      <div class="tray-section-body">${f.what}</div>
      <div class="tray-section-label">Why it matters</div>
      <div class="tray-section-body">${f.why}</div>
      ${steps}
    </div>`;
  }).join('');
}
