// Phase E analysis pipeline. Runs after each submission over ALL of the
// cycle's conversations. Prompts and scoring ported from the CTA
// (index.html scoreTAU/mapTo5/classify/provenance) — the built-in chat skips
// the CTA's parser entirely because turn roles are already known.
//
// Divergence chart embeddings (CTA Call 3) not yet ported — next iteration.

const { col } = require('./store');
const { complete } = require('./llm');
// Lives under web/ because the student report loads it as a plain <script>
// and a browser cannot require a server module. Pure, no I/O — see the header
// there for why there is exactly one copy of it.
const { detectPatterns } = require('../web/patterns-core');

const CLASSIFY_CHUNK_SIZE = 20;
const AI_TURN_MAX_CHARS = 400;

// ---------- gather the cycle bundle ----------

// One flat, chronological turn list across all cycle conversations.
// Meta-turns (auditor) and superseded turns are excluded — same rule the
// chat context uses. Conversation boundaries kept for enrichment.
async function gatherCycle(session) {
  const conversations = (await col('conversations').list({ sessionId: session.id }))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  const bundle = [];
  for (const conv of conversations) {
    const turns = (await col('turns').list({ conversationId: conv.id }))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const dead = new Set(turns.flatMap((t) => t.meta?.supersedes || []));
    const live = turns.filter((t) => !dead.has(t.id) && !t.meta?.metaTurn && t.role !== 'auditor');
    bundle.push({ conversation: conv, turns: live });
  }
  return bundle;
}

// ---------- turn classification (CTA Call 1) ----------

const CLASSIFY_PROMPT = (listed) => `Classify each student turn from an AI-assisted writing session.

Each item shows what the AI said immediately before, then the student turn to classify.

Labels and what they mean:
- claim: student asserts their own position, thesis, or argument
- conceptual: student asks why/how/what to genuinely understand something
- extraction: student asks AI to write, draft, or do work for them
- validation: student seeks approval or passively confirms AI output
- stuck: student expresses confusion or asks for help understanding
- feedback: student asks AI to review or evaluate their work
- narrative: student provides context or background with no strong behavioral signal
- rejection: student explicitly disagrees with or pushes back on AI output
- refinement: student accepts output but adds constraints, narrows scope, or redirects
- challenge: student probes AI reasoning, asks for evidence or justification
- pivot: student explicitly shifts to a new topic

Also judge "responsive" for each turn: does the student engage with the substance of what the AI just said — answering it, building on it, disagreeing with it, or deliberately redirecting it?

- Judge meaning, not wording. A student who restates the AI's point in their own words IS responsive. A student who reuses the AI's vocabulary while ignoring what it was for is NOT.
- A turn that ignores the AI's turn and starts somewhere unrelated is not responsive.
- If the item shows no preceding AI turn, responsive is false.

Turns to classify:
${listed}

Return ONLY a JSON array: [{"turnIndex": 0, "label": "challenge", "responsive": true, "confidence": 0.9}, ...]`;

// Calls run with responseMimeType: application/json, so the whole body should
// parse. The scan below is the fallback, and it stops at the *matching* close
// rather than the last one in the string: Gemini occasionally emits a complete
// object followed by a second one, and a greedy match turns that into a syntax
// error at the join. Seen intermittently on the snapshot call, 2026-08-05.
function extractJSON(raw, kind) {
  const text = raw.trim();
  try {
    return JSON.parse(text);
  } catch {
    // fall through to the scan
  }

  const [open, close] = kind === 'array' ? ['[', ']'] : ['{', '}'];
  const start = text.indexOf(open);
  if (start === -1) throw new Error(`No JSON ${kind} in LLM response`);

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (escaped) { escaped = false; continue; }
    if (ch === '\\') { escaped = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === open) depth++;
    else if (ch === close && --depth === 0) return JSON.parse(text.slice(start, i + 1));
  }
  throw new Error(`Truncated JSON ${kind} in LLM response`);
}

// Student turns paired with the AI turn they follow, in the same order
// enrich() walks them so turnIndex lines up. Responsiveness cannot be judged
// without this pairing — the classifier used to see student turns alone, which
// is why the signal fell back to a lexical guess.
function studentTurnsWithContext(bundle) {
  const paired = [];
  for (const { turns } of bundle) {
    let priorCoach = null;
    for (const turn of turns) {
      if (turn.role === 'student') paired.push({ turn, priorCoach });
      else priorCoach = turn.text;
    }
  }
  return paired;
}

async function classifyStudentTurns(paired, meta) {
  const map = {};
  const chunks = [];
  for (let i = 0; i < paired.length; i += CLASSIFY_CHUNK_SIZE) {
    chunks.push({ items: paired.slice(i, i + CLASSIFY_CHUNK_SIZE), offset: i });
  }
  const results = await Promise.all(
    chunks.map(async ({ items, offset }) => {
      const listed = items
        .map(({ turn, priorCoach }, i) => {
          const context = priorCoach
            ? `AI: ${priorCoach.slice(0, AI_TURN_MAX_CHARS)}${priorCoach.length > AI_TURN_MAX_CHARS ? '…' : ''}`
            : 'AI: (nothing — this turn opens the conversation)';
          return `[${offset + i}]\n${context}\nSTUDENT: ${turn.text}`;
        })
        .join('\n\n');
      const raw = await complete({
        messages: [{ role: 'user', content: CLASSIFY_PROMPT(listed) }],
        temperature: 0.1,
        json: true,
        meta: { ...meta, purpose: 'classify' },
        maxTokens: 100 + items.length * 40,
      });
      return extractJSON(raw, 'array');
    })
  );
  for (const items of results) for (const item of items) map[item.turnIndex] = item;
  return map;
}

// ---------- context enrichment (ported from CTA classifyAllTurns pass 2) ----------

// Responsiveness is the classifier's judgement (see CLASSIFY_PROMPT). It used
// to be a lexical test — turn-initial discourse markers, or ≥2 shared words
// longer than 5 characters with the prior AI turn — which measured whether a
// student echoed the AI's vocabulary, the opposite of what PQ is specified
// to measure. Paraphrasing scored lower than parroting. Measured on the seed
// transcripts 2026-08-05, it fired on 0 of 12 turns for two of the four tiers.
//
// These four labels are *definitionally* about the AI's previous turn — you
// cannot reject, refine, validate or challenge nothing. They stand in when no
// classifier judgement is available, which is the dev seed's path: it builds
// demo analyses from hand-labeled transcripts without an LLM call. The fallback
// deliberately claims no more than the labels already assert.
const RESPONSIVE_BY_LABEL = new Set(['rejection', 'refinement', 'validation', 'challenge']);

// Enrichment stays within conversation boundaries — a "followup" in a
// different conversation is not a followup.
function enrich(bundle, labelMap) {
  let studentIdx = 0;
  const classified = [];
  for (const { conversation, turns } of bundle) {
    const convTurns = turns.map((t) => {
      const isStudent = t.role === 'student';
      const entry = {
        turnId: t.id,
        conversationId: conversation.id,
        conversationTitle: conversation.title,
        role: isStudent ? 'student' : 'ai',
        text: t.text,
        label: null,
        responsive: false,
        followedBy: null,
      };
      if (isStudent) {
        const judged = labelMap[studentIdx];
        entry.label = judged?.label || 'narrative';
        entry.judgedResponsive = typeof judged?.responsive === 'boolean' ? judged.responsive : null;
        studentIdx++;
      }
      return entry;
    });

    for (let i = 0; i < convTurns.length; i++) {
      const t = convTurns[i];
      if (t.role !== 'student') continue;
      let priorAI = null;
      for (let j = i - 1; j >= 0; j--) {
        if (convTurns[j].role === 'ai') { priorAI = convTurns[j].text; break; }
      }
      // Structural, and it outranks the classifier: a turn that opens a
      // conversation has nothing to be responsive to, whatever the model said.
      t.responsive = priorAI
        ? (t.judgedResponsive ?? RESPONSIVE_BY_LABEL.has(t.label))
        : false;
      delete t.judgedResponsive;
      for (let j = i + 1; j < convTurns.length; j++) {
        if (convTurns[j].role === 'student') { t.followedBy = convTurns[j].label; break; }
      }
    }
    classified.push(...convTurns);
  }
  return classified;
}

// ---------- provenance trace (CTA Call 2) + integrity flags ----------

const PROVENANCE_PROMPT = (chatLog, essayText) => `Trace the intellectual origin of ideas in this AI-assisted essay.

CHAT LOG:
${chatLog || '(the student did not use the AI chat this cycle)'}

ESSAY:
${essayText}

Part 1 — for 10–20 meaningful ideas in the essay, identify:
- "student-born": idea appeared in student turns BEFORE AI mentioned it
- "ai-born": idea appeared in AI turns before student used it
- "synthesized": developed together across both student and AI turns
- "prior": does not appear in the chat log at all (student's prior knowledge)

For each idea return:
- "phrase": exact text from the essay (6–20 words)
- "origin": one of the four values above
- "concept": 2–5 word label
- "turn": the number of the student turn where this idea entered the conversation. For "ai-born" that is the turn whose AI reply first carried it; for "student-born" the turn the student said it in; for "synthesized" the turn where it settled. Use null for "prior", which by definition is in no turn.

Part 2 — integrity signals (empty array if none apply). Only flag clear cases:
- "stylistic-inconsistency": vocabulary/complexity jumps sharply between student turns
- "unnatural-fluency": student turns lack hedging, false starts, colloquial language
- "provenance-mismatch": essay presents a concept as the student's own but AI introduced it first
- "shadow-session-pattern": student responses suspiciously well-calibrated to AI output

Each flag: {"flag": "...", "evidence": "one sentence citing the specific moment"}

Return ONLY valid JSON: {"concepts": [...], "flags": [...]}. No explanation.`;

async function traceProvenance(classified, essayText, meta) {
  // Student turns are numbered, and the numbering is what the model points at.
  let studentNo = 0;
  const chatLog = classified
    .map((t) => {
      if (t.role === 'student') {
        studentNo++;
        return `[student turn ${studentNo}] ${t.text}`;
      }
      const text = t.text.slice(0, AI_TURN_MAX_CHARS) + (t.text.length > AI_TURN_MAX_CHARS ? '…' : '');
      return `[AI, replying to student turn ${studentNo}] ${text}`;
    })
    .join('\n\n');

  const raw = await complete({
    messages: [{ role: 'user', content: PROVENANCE_PROMPT(chatLog, essayText) }],
    temperature: 0.2,
    json: true,
    meta: { ...meta, purpose: 'provenance' },
    maxTokens: 3000,
  });
  const parsed = extractJSON(raw, 'object');
  const concepts = (parsed.concepts || [])
    .filter((c) => c.phrase && c.phrase.length >= 6 && c.origin)
    .map((c) => ({
      concept: (c.concept || c.phrase.slice(0, 30)).toLowerCase().trim(),
      phrase: c.phrase.trim(),
      origin: c.origin,
      turn: Number.isInteger(c.turn) && c.turn > 0 ? c.turn : null,
    }));
  const flags = (parsed.flags || []).filter((f) => f.flag);
  return { concepts, flags };
}

// ---------- TAU scoring (ported verbatim from CTA scoreTAU) ----------

function mapTo5(raw) {
  if (raw >= 0.6) return 5;
  if (raw >= 0.4) return 4;
  if (raw >= 0.22) return 3;
  if (raw >= 0.1) return 2;
  return 1;
}

function scoreTAU(classified, provenanceData) {
  const student = classified.filter((t) => t.role === 'student');
  const total = student.length || 1;

  const counts = {};
  const LABELS = ['claim', 'conceptual', 'extraction', 'validation', 'stuck', 'feedback', 'narrative', 'rejection', 'refinement', 'challenge', 'pivot'];
  for (const l of LABELS) counts[l] = 0;

  let responsiveCount = 0;
  let challengeCount = 0;

  for (const t of student) {
    if (counts[t.label] !== undefined) counts[t.label]++;
    else counts.narrative++;
    if (t.responsive) responsiveCount++;
    if (t.label === 'challenge') challengeCount++;
  }

  const PQ_raw = (responsiveCount + challengeCount) / total;
  const PQ = mapTo5(PQ_raw);

  const HIGH_AGENCY = new Set(['claim', 'conceptual', 'challenge', 'rejection', 'refinement']);
  const LOW_AGENCY = new Set(['extraction', 'validation', 'stuck']);
  let extractionEvents = 0;
  let highFollowups = 0;
  let lowFollowups = 0;

  for (const t of student) {
    if (t.label === 'extraction') {
      extractionEvents++;
      if (t.followedBy && HIGH_AGENCY.has(t.followedBy)) highFollowups++;
      if (t.followedBy && LOW_AGENCY.has(t.followedBy)) lowFollowups++;
    }
  }

  let SU_raw;
  if (extractionEvents > 0) {
    SU_raw = highFollowups / extractionEvents;
  } else {
    const highTotal = ['claim', 'conceptual', 'challenge', 'rejection', 'refinement'].reduce((s, l) => s + counts[l], 0);
    const lowTotal = ['extraction', 'validation', 'stuck'].reduce((s, l) => s + counts[l], 0);
    SU_raw = highTotal / Math.max(highTotal + lowTotal, 1);
  }
  const SU = mapTo5(SU_raw);

  const CS_raw = (counts.rejection * 1.5 + counts.refinement) / total;
  const CS = mapTo5(CS_raw);

  let OC;
  if (provenanceData && provenanceData.length > 0) {
    const studentBorn = provenanceData.filter((p) => p.origin === 'student-born' || p.origin === 'prior').length;
    const synthesized = provenanceData.filter((p) => p.origin === 'synthesized').length;
    const totalProv = provenanceData.length;
    const OC_raw = (studentBorn * 1.0 + synthesized * 0.6) / Math.max(totalProv, 1);
    OC = mapTo5(OC_raw);
  } else {
    const passiveRate = (counts.validation + counts.extraction) / total;
    const OC_raw = ((counts.claim + counts.narrative * 0.5) / total) * (1 - passiveRate * 0.6);
    OC = mapTo5(OC_raw);
  }

  const totalScore = PQ + SU + CS + OC;
  let SAMR;
  if (totalScore >= 17) SAMR = 'Redefinition';
  else if (totalScore >= 13) SAMR = 'Modification';
  else if (totalScore >= 9) SAMR = 'Augmentation';
  else SAMR = 'Substitution';

  let provenanceCounts = null;
  if (provenanceData && provenanceData.length > 0) {
    provenanceCounts = {
      studentBorn: provenanceData.filter((p) => p.origin === 'student-born' || p.origin === 'prior').length,
      synthesized: provenanceData.filter((p) => p.origin === 'synthesized').length,
      aiBorn: provenanceData.filter((p) => p.origin === 'ai-born').length,
      total: provenanceData.length,
    };
  }

  return { PQ, SU, CS, OC, totalScore, SAMR, counts, total, responsiveCount, challengeCount, extractionEvents, highFollowups, lowFollowups, provenanceCounts };
}

// ---------- narrative snapshot ----------

const SNAPSHOT_PROMPT = ({ transcript, tau }) => `A student just submitted an essay draft after working with an AI assistant. Write their process feedback — about HOW they worked with the AI, never about essay quality.

THEIR CONVERSATIONS THIS CYCLE:
${transcript || '(the student did not use the AI chat this cycle)'}

MEASURED DIMENSIONS (1-5): Prompting Quality ${tau.PQ}, Selective Use ${tau.SU}, Calibrated Skepticism ${tau.CS}, Original Contribution ${tau.OC}.

Return ONLY valid JSON:
{
  "strengths": [{"quote": "short verbatim quote from a student turn", "note": "one sentence on why this was a strong move"}],
  "growthMoves": ["one concrete behavior to try next draft"],
  "bridge": "one or two sentences preparing them for the next cycle"
}

Rules: 2-3 strengths (fewer if the conversation was very short), 1-2 growth moves. Quotes must be real student turns, not AI turns. Warm, direct, specific. Never mention grades or essay quality.`;

async function generateSnapshot({ classified, tau, meta }) {
  const transcript = classified
    .map((t) => `${t.role === 'student' ? 'Student' : 'AI'}: ${t.text.slice(0, 300)}`)
    .join('\n');
  const raw = await complete({
    messages: [{ role: 'user', content: SNAPSHOT_PROMPT({ transcript, tau }) }],
    temperature: 0.4,
    json: true,
    meta: { ...meta, purpose: 'snapshot' },
    maxTokens: 700,
  });
  return extractJSON(raw, 'object');
}

// ---------- the reading (tau-dimensions.md, "The scoring foundation") -------

// Four questions asked of the transcript, the essay and the assignment
// together. Each is an established coding scheme applied as published — the
// construct validity is inherited from the scheme, which is the whole basis of
// the defence, so the prompt names the scheme and its categories rather than
// describing a behaviour in our own words.
const DIMENSIONS = [
  {
    key: 'PQ', name: 'Prompting Quality', question: 'Did you drive the chat?',
    scheme: 'task initiative (Chu-Carroll & Brown 1997)',
    unit: 'discourse segment — a stretch of the conversation on one sub-task, NOT a turn',
    asks: 'In each segment, who set the agenda: the student, or the AI? Initiative means introducing something the AI had not raised — a brief, a constraint, a redirection, a new sub-task.',
  },
  {
    key: 'CS', name: 'Calibrated Skepticism', question: 'Did you check what you were told?',
    scheme: "Wineburg's source-evaluation heuristics — sourcing, corroboration, contextualization",
    unit: 'an AI claim the student took a position on',
    asks: 'For each claim the student engaged, did they source it (ask where it came from), corroborate it (check it against something outside the conversation), or contextualize it? Editorial direction — "make that a table", "add a section" — is NOT skepticism and must not be counted as it.',
  },
  {
    key: 'SU', name: 'Selective Use', question: 'What survived?',
    scheme: 'Faigley & Witte 1981 revision analysis — surface changes vs meaning changes',
    unit: 'a change the student directed',
    asks: 'For each change the student asked for, was it a surface change (formatting, wording, length) or a meaning change (what the text asserts)? Discrimination over what the AI offered is the construct — taking everything is not selection.',
  },
  {
    key: 'OC', name: 'Original Contribution', question: 'Is the thinking yours?',
    scheme: 'Bereiter & Scardamalia 1987 — knowledge transforming vs knowledge telling',
    unit: 'an idea in the finished essay',
    asks: 'For each substantive idea in the essay, did the student transform knowledge (reorganise, argue, connect, adapt to their own situation) or tell it (pass it through)? Personal context the student supplied counts; fluent AI prose the student did not shape does not.',
  },
];

const READING_PROMPT = (assignment, chatLog, essayText) => `You are coding one student's AI-assisted writing session against four published schemes, then reading one overall level. Work like a rater applying a rubric: read everything, find the band that fits, and cite what you read.

THE ASSIGNMENT
${assignment}

THE CONVERSATION
${chatLog || '(the student did not use the AI chat this cycle)'}

THE FINISHED DRAFT
${essayText || '(no draft submitted)'}

=== PART 1 — the four readings ===

${DIMENSIONS.map((d, i) => `${i + 1}. ${d.name} (${d.key}) — "${d.question}"
   Scheme: ${d.scheme}
   Unit of analysis: ${d.unit}
   What to code: ${d.asks}`).join('\n\n')}

Band descriptors. Choose the band that FITS the evidence — do NOT compute it from a ratio, and do not let a count decide it. Which instances, and whether the misses mattered, is the judgement:
- 4: Consistent, and it held at the hard moments.
- 3: There most of the time, with real gaps.
- 2: It happened, but not where it counted.
- 1: It didn't happen. The behaviour is absent, not weak.

If the session is too thin to support a reading for a dimension, set "band": null. That reports "we could not see it", which is not the same as "you did not do it" and must not be scored 1.

For each dimension return:
- "band": 1-4, or null
- "count": one short sentence giving the tally in that dimension's OWN unit, with its denominator — e.g. "Direction set in 10 of 11 parts." Never a turn count.
- "claim": one sentence, addressed to the student as "you", saying plainly what they did.
- "moments": 2-3 items, each {"quote": exact student words from the transcript, "note": a short phrase saying what made it count}. Quotes must be verbatim.
- "counterexample": {"text": one or two sentences naming the moment that does NOT support the claim}. This is REQUIRED whenever band is not null — it is what makes this feedback rather than praise. Never omit it, never soften it, and never invent one that isn't in the transcript.

=== PART 2 — the overall level ===

One level, named, describing THE AI'S IMPACT ON THE STUDENT'S AGENCY. It is read from the shape the four readings make, the assignment, and the session as a whole — never from a sum or an average of the bands.
- "Substitution": The AI did the thinking. The student set the task and took what came back.
- "Augmentation": The AI set the direction; the student improved what it handed them. Agency shows up in reaction, not initiation.
- "Modification": The student led. The AI worked to their brief, and the conversation went where they took it.
- "Redefinition": The student led and resisted. They pushed back where it mattered, and the thinking that survived is theirs.

Return:
- "level": one of the four names
- "shape": one sentence naming what kind of session this was, addressed as "you". A description, never a rating, and never a profile nickname.
- "body": two sentences on the tension between the strongest and weakest reading, and what separates this level from the one above it.
- "departure": if the level lands somewhere the four bands would not predict, one sentence naming what you read in the assignment or the arc of the session to get there, pointing at something checkable. Otherwise null.
- "exception": one or two sentences naming the single moment that most cuts against this level. Required.

Return ONLY valid JSON:
{"dimensions":[{"key":"PQ","band":4,"count":"...","claim":"...","moments":[{"quote":"...","note":"..."}],"counterexample":{"text":"..."}}, ...],"overall":{"level":"...","shape":"...","body":"...","departure":null,"exception":"..."}}`;

const LEVELS = ['Substitution', 'Augmentation', 'Modification', 'Redefinition'];

async function readSession({ classified, essayText, assignment }, meta) {
  const chatLog = classified
    .map((t) => {
      const who = t.role === 'student' ? 'STUDENT' : 'AI';
      const text = t.role === 'student'
        ? t.text
        : t.text.slice(0, AI_TURN_MAX_CHARS) + (t.text.length > AI_TURN_MAX_CHARS ? '…' : '');
      return `${who}: ${text}`;
    })
    .join('\n\n');

  const brief = assignment
    ? [
        `Title: ${assignment.title || '(untitled)'}`,
        assignment.description ? `What was asked: ${assignment.description}` : '',
        assignment.purpose ? `Purpose: ${assignment.purpose}` : '',
        assignment.requirements ? `Requirements: ${assignment.requirements}` : '',
      ].filter(Boolean).join('\n')
    : '(no assignment brief available)';

  const raw = await complete({
    messages: [{ role: 'user', content: READING_PROMPT(brief, chatLog, essayText) }],
    temperature: 0.2,
    json: true,
    meta: { ...meta, purpose: 'reading' },
    maxTokens: 4000,
  });
  const parsed = extractJSON(raw, 'object');

  const byKey = {};
  for (const d of parsed.dimensions || []) if (d && d.key) byKey[d.key] = d;

  // Shaped here rather than in the renderer so every surface reads one
  // structure, and so a model that drops a field degrades to "not enough
  // here" instead of rendering a half-empty card.
  const dimensions = DIMENSIONS.map((spec) => {
    const got = byKey[spec.key] || {};
    const band = Number.isInteger(got.band) && got.band >= 1 && got.band <= 4 ? got.band : null;
    return {
      key: spec.key,
      name: spec.name,
      question: spec.question,
      band,
      count: band ? (got.count || '') : '',
      claim: band ? (got.claim || '') : 'This session was too short to read this one.',
      moments: band && Array.isArray(got.moments)
        ? got.moments.filter((m) => m && m.quote).slice(0, 3)
        : [],
      counterexample: band && got.counterexample && got.counterexample.text
        ? got.counterexample.text
        : '',
    };
  });

  const o = parsed.overall || {};
  const level = LEVELS.includes(o.level) ? o.level : null;

  return {
    level,
    levelIndex: level ? LEVELS.indexOf(level) + 1 : null,
    shape: o.shape || '',
    body: o.body || '',
    departure: o.departure || null,
    exception: o.exception || '',
    dimensions,
  };
}

// ---------- orchestrator ----------

async function runAnalysis(submissionId) {
  const submission = await col('submissions').get(submissionId);
  const session = await col('sessions').get(submission.sessionId);

  const analysis = await col('analyses').add({
    submissionId,
    status: 'pending',
    createdAt: new Date().toISOString(),
  });
  await col('submissions').update(submissionId, { analysisId: analysis.id });

  // Attribution for every LLM call this run makes — which student, which
  // assignment, which submission. Recorded in llmCalls; see llm.js.
  const meta = {
    studentId: session.studentId,
    assignmentId: submission.assignmentId,
    submissionId,
  };

  try {
    const bundle = await gatherCycle(session);
    const paired = studentTurnsWithContext(bundle);

    const labelMap = paired.length ? await classifyStudentTurns(paired, meta) : {};
    const classified = enrich(bundle, labelMap);

    const assignment = submission.assignmentId
      ? await col('assignments').get(submission.assignmentId).catch(() => null)
      : null;

    // The reading and the provenance trace are independent of each other and
    // both take the whole transcript — run them together rather than paying
    // for two round trips in sequence.
    const [{ concepts, flags }, reading] = await Promise.all([
      traceProvenance(classified, submission.essayText, meta),
      readSession({ classified, essayText: submission.essayText, assignment }, meta),
    ]);
    const tau = scoreTAU(classified, concepts);

    // Pure and free — no LLM call, no extra latency. Stored rather than
    // recomputed per render so the teacher surfaces can aggregate across
    // students without shipping every transcript to the browser, which is
    // what kept these patterns student-only until now.
    const patterns = detectPatterns(classified);

    const snapshot = await generateSnapshot({ classified, tau, meta });

    // Cycle activity from the event log — stored for display/teacher view;
    // not folded into scoring yet (parity with the CTA formulas).
    const eventCounts = {};
    for (const e of await col('events').list({ sessionId: session.id })) {
      eventCounts[e.type] = (eventCounts[e.type] || 0) + 1;
    }

    await col('analyses').update(analysis.id, {
      status: 'complete',
      // The reading: agency as a named level, four dimensions as a band plus
      // the evidence behind it. This is what the report renders.
      reading,
      tau,
      provenance: concepts,
      flags,
      snapshot,
      // Full text kept — the report renderers (turn list, chart tooltips,
      // turn modal) display it.
      classified,
      patterns,
      eventCounts,
      completedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('analysis failed:', err);
    await col('analyses').update(analysis.id, { status: 'error', error: err.message });
  }
  return analysis.id;
}

// enrich + scoreTAU are exported for the dev seed, which builds demo analyses
// from hand-labeled transcripts without LLM calls. Deriving the scores rather
// than hardcoding them keeps seeded data honest if the formulas change.
// detectPatterns is re-exported so the seed and any backfill get it from the
// same place runAnalysis does, rather than reaching into web/ themselves.
module.exports = { runAnalysis, enrich, scoreTAU, detectPatterns };
