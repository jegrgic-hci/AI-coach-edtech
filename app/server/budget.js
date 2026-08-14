// Per-student daily usage caps. Two tiers, from built-in-chat-plan.md.
//
// The cap is NOT a cost control. The most extravagant plausible student day
// costs about eleven cents; this exists to catch a bug, a loop, or scripted
// abuse — which look nothing like 40 replies, they look like 40,000. So the
// numbers are deliberately generous: the cost of generosity is cents, the cost
// of stinginess is a student locked out of their homework at 9pm.
//
//   Soft — AI replies/day, ~40, visible to student and teacher.
//   Hard — input tokens/day, ~1M, invisible, should page us if ever reached.
//
// Replies (not tokens) for the student-facing limit, because a token cap gives
// two identically-behaved students wildly different allowances: input grows
// quadratically with conversation length, so one long thread buys ~12 replies
// where four short ones buy 40+. That is unfair, unexplainable, and it
// penalises exactly the student most immersed in one line of thinking.
//
// Four behavioural rules, which matter more than the numbers:
//   1. Check at the turn boundary, never mid-stream. A conversation that ends
//      cleanly reads completely differently from one that dies mid-sentence.
//   2. Warn at ~80%. Nobody should meet a limit they could not see coming.
//   3. Submitting a draft is never blocked — analysis budget is separate from
//      chat budget. A student who chatted a lot and then cannot submit, or
//      submits and gets no report, is the one failure that damages trust.
//   4. Teachers can grant more. The escape valve is what lets the limit be set
//      sensibly rather than defensively.

const { col } = require('./store');

const SOFT_REPLIES_PER_DAY = 40;
const HARD_INPUT_TOKENS_PER_DAY = 1000000;
const WARN_AT = 0.8;

// Chat only. Analysis purposes are excluded so a long conversation can never
// consume the budget that a submission's report depends on (rule 3).
const CHAT_PURPOSES = new Set(['chat', 'auditor']);

function startOfTodayISO() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

// Grants are additive and per-day: a teacher pressing the button twice gives
// twice the headroom, and nothing carries into tomorrow.
async function grantedToday(studentId) {
  const since = startOfTodayISO();
  const grants = await col('budgetGrants').list({ studentId });
  return grants
    .filter((g) => g.ts >= since)
    .reduce((sum, g) => sum + (g.extraReplies || 0), 0);
}

async function usageToday(studentId) {
  const since = startOfTodayISO();
  // Scans this student's rows, not the whole collection — llmCalls grows
  // without bound, so the studentId equality query is doing real work here.
  const rows = (await col('llmCalls').list({ studentId })).filter((r) => r.ts >= since);
  let replies = 0;
  let inputTokens = 0;
  for (const r of rows) {
    inputTokens += (r.inputTokens || 0) + (r.cachedInputTokens || 0);
    if (CHAT_PURPOSES.has(r.purpose)) replies++;
  }
  return { replies, inputTokens };
}

// Call at the turn boundary, before starting a reply. Returns what the caller
// needs to decide and to explain — never throws.
async function checkChatBudget(studentId) {
  const [{ replies, inputTokens }, granted] = await Promise.all([
    usageToday(studentId),
    grantedToday(studentId),
  ]);

  const limit = SOFT_REPLIES_PER_DAY + granted;
  const remaining = Math.max(0, limit - replies);

  if (inputTokens >= HARD_INPUT_TOKENS_PER_DAY) {
    // Nothing a real student does reaches this. Reaching it means a bug, a
    // loop, or abuse — so it is logged loudly and phrased as our problem.
    console.error(`[budget] HARD CAP hit — student ${studentId}, ${inputTokens} input tokens today`);
    return {
      allowed: false,
      reason: 'hard',
      message: 'Something has gone wrong on our side and the AI chat is paused for today. Your work is saved — please tell your teacher.',
      remaining: 0,
      limit,
    };
  }

  if (replies >= limit) {
    return {
      allowed: false,
      reason: 'soft',
      message: `You've used all ${limit} AI replies for today. Your work is saved, and it resets tomorrow — your teacher can also give you more.`,
      remaining: 0,
      limit,
    };
  }

  return {
    allowed: true,
    remaining,
    limit,
    used: replies,
    // Rule 2: the warning rides along with the allowed reply, so the student
    // sees it before the last one rather than at the wall.
    warning: remaining <= Math.ceil(limit * (1 - WARN_AT))
      ? `About ${remaining} AI ${remaining === 1 ? 'reply' : 'replies'} left today.`
      : null,
  };
}

async function grantExtraReplies({ studentId, teacherId, extraReplies = 20 }) {
  return col('budgetGrants').add({
    studentId,
    teacherId,
    extraReplies,
    ts: new Date().toISOString(),
  });
}

module.exports = {
  checkChatBudget,
  grantExtraReplies,
  usageToday,
  grantedToday,
  SOFT_REPLIES_PER_DAY,
  HARD_INPUT_TOKENS_PER_DAY,
};
