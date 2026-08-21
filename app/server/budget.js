// Per-student daily usage cap. One tier: input tokens per day.
//
// The cap is NOT a cost control. At Flash-Lite's $0.25/M input the ceiling is
// about a quarter per student per day; this exists to catch a bug, a loop, or
// scripted abuse. So the number is deliberately generous: the cost of
// generosity is cents, the cost of stinginess is a student locked out of their
// homework at 9pm.
//
// **A reply-count tier used to sit in front of this** — 40 AI replies/day,
// student-visible, with a teacher grant to lift it. Removed 2026-08-21: the
// pilot's job is to find out what normal usage looks like, and a cap set before
// any measurement shapes the very behaviour it is trying to observe. The
// argument that retired it is worth keeping, because it is the argument for
// bringing a reply tier BACK once there is data: a token budget gives two
// identically-behaved students wildly different allowances, since input grows
// quadratically with conversation length — one long thread buys far fewer
// replies than four short ones. That is unfair and unexplainable, and it
// penalises exactly the student most immersed in one line of thinking. It is
// tolerable now only because the ceiling is high enough that nobody should meet
// it; it would not be tolerable as a working allowance.
//
// Three behavioural rules, which matter more than the number:
//   1. Check at the turn boundary, never mid-stream. A conversation that ends
//      cleanly reads completely differently from one that dies mid-sentence.
//   2. Warn at ~80%. Nobody should meet a limit they could not see coming.
//   3. Submitting a draft is never blocked — analysis budget is separate from
//      chat budget. A student who chatted a lot and then cannot submit, or
//      submits and gets no report, is the one failure that damages trust.

const { col } = require('./store');

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

async function usageToday(studentId) {
  const since = startOfTodayISO();
  // Scans this student's rows, not the whole collection — llmCalls grows
  // without bound, so the studentId equality query is doing real work here.
  const rows = (await col('llmCalls').list({ studentId })).filter((r) => r.ts >= since);
  let replies = 0;
  let inputTokens = 0;
  for (const r of rows) {
    inputTokens += (r.inputTokens || 0) + (r.cachedInputTokens || 0);
    // Still counted, though nothing caps it: this is the measurement the
    // pilot exists to collect, and it is what a future reply tier gets set on.
    if (CHAT_PURPOSES.has(r.purpose)) replies++;
  }
  return { replies, inputTokens };
}

// Call at the turn boundary, before starting a reply. Returns what the caller
// needs to decide and to explain — never throws.
async function checkChatBudget(studentId) {
  const { replies, inputTokens } = await usageToday(studentId);
  const remaining = Math.max(0, HARD_INPUT_TOKENS_PER_DAY - inputTokens);

  if (inputTokens >= HARD_INPUT_TOKENS_PER_DAY) {
    // Logged loudly: with no reply tier in front of it, reaching this is either
    // a very heavy day or the loop this cap exists to catch, and the two are
    // only distinguishable from the rows.
    console.error(`[budget] daily cap hit — student ${studentId}, ${inputTokens} input tokens today`);
    return {
      allowed: false,
      // Phrased as a limit, not as our bug. It used to say "something has gone
      // wrong on our side" — true when a reply cap made this unreachable, and
      // misleading now that this is the only limit a student can actually meet.
      message: "You've reached today's limit for AI chat. Your work is saved, and it resets tomorrow — tell your teacher if you need it sooner.",
      remaining: 0,
      limit: HARD_INPUT_TOKENS_PER_DAY,
      used: inputTokens,
      replies,
    };
  }

  return {
    allowed: true,
    remaining,
    limit: HARD_INPUT_TOKENS_PER_DAY,
    used: inputTokens,
    replies,
    // Rule 2: the warning rides along with the allowed reply, so the student
    // sees it before the last one rather than at the wall. Deliberately states
    // no number — a token count means nothing to a student, and the honest
    // content of this warning is "soon", not "8".
    warning: inputTokens >= HARD_INPUT_TOKENS_PER_DAY * WARN_AT
      ? "You're close to today's limit for AI chat. It resets tomorrow."
      : null,
  };
}

module.exports = {
  checkChatBudget,
  usageToday,
  HARD_INPUT_TOKENS_PER_DAY,
};
