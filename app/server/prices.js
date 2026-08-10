// Turns stored token counts into dollars, at read time.
//
// llmCalls stores tokens and never dollars (see llm.js) because Gemini's
// prices have moved 2.5–4× in the life of this project. Keeping the price
// table here means history stays re-priceable: "what would last semester have
// cost at today's prices" is a re-read, not a lost answer.
//
// Rates are USD per million tokens, verified against Vertex pricing 2026-08-05
// (built-in-chat-plan.md, Cost Model). When Google moves a price, add a new
// entry with a new `from` date rather than editing an old one — otherwise past
// months silently re-price and month-over-month comparisons become fiction.

const RATES = [
  { from: '2026-08-05', model: 'gemini-3.1-flash-lite', input: 0.25, output: 1.50 },
  { from: '2026-08-05', model: 'gemini-3.5-flash', input: 1.50, output: 9.00 },
];

// An unknown model costs zero rather than throwing: a model swap in config
// must never take down the cost view, and a visibly missing line is easier to
// notice and fix than a 500. Callers surface the name via unpricedModels().
const UNKNOWN = { input: 0, output: 0 };

// A call older than every rate on record still gets priced, at the oldest rate
// we have. The alternative — no rate in effect yet, so charge zero — silently
// values all history at $0, which looks like a working cost view reporting
// good news. Caught by fixtures dated before the table's first entry.
function rateFor(model, ts) {
  const forModel = RATES.filter((r) => r.model === model);
  if (!forModel.length) return UNKNOWN;
  const inEffect = forModel.filter((r) => r.from <= ts);
  if (!inEffect.length) return forModel.reduce((a, b) => (a.from < b.from ? a : b));
  return inEffect.reduce((a, b) => (a.from > b.from ? a : b));
}

// Thinking tokens bill as output, not as a separate line — the 8× surprise
// called out in the plan's guardrails. Counting them anywhere else would
// under-report the exact cost we most need to see.
//
// Cached input is billed at a lower rate than fresh input, and this charges it
// at the full rate. The result is therefore a slight over-estimate, which is
// the safe direction for a number used to catch a bill before it arrives.
function costOf(row) {
  const rate = rateFor(row.model, row.ts || '');
  const input = (row.inputTokens || 0) / 1e6 * rate.input;
  const output = ((row.outputTokens || 0) + (row.thinkingTokens || 0)) / 1e6 * rate.output;
  return input + output;
}

function isPriced(model) {
  return RATES.some((r) => r.model === model);
}

module.exports = { costOf, isPriced };
