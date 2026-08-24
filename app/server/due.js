// One reading of when an assignment is due, and one answer to whether it has
// closed — 2026-08-24.
//
// A deadline used to be a bare `YYYY-MM-DD` written straight out of the
// teacher form's <input type="date">. `new Date('2026-08-24')` is *midnight
// UTC*, so "due Aug 24" expired before the 24th had started in most of the
// world. That was harmless while the date only tinted a chip; it stops being
// harmless the moment closing an assignment blocks a student from submitting.
//
// The fix has two halves:
//   · Going forward the teacher form sends a full instant, built from the date
//     picker plus one time-of-day control that defaults to 11:59 PM in the
//     teacher's own timezone. Nothing here has to guess a timezone, because
//     the browser that knows it does the conversion before the value is
//     stored.
//   · Records written before that still hold a bare date. dueInstant() reads
//     one as the END of the day it names, not the start — the reading a
//     teacher meant when they typed it.
//
// Deliberately no migration script. Rewriting old bare dates means picking a
// timezone for a teacher who never told us theirs, and getting it wrong moves
// a real deadline. The fallback below is the same decision made lazily, where
// it can't damage anything, and it is the only place the rule is written.
//
// Every payload that sends a due date to a browser runs it through
// dueInstant() first (see index.js), so no client ever has to know this rule
// existed — they receive instants and compare them plainly.

// The time-of-day a bare date means, and the default the teacher form offers.
const DEFAULT_DUE_TIME = '23:59';

const BARE_DATE = /^\d{4}-\d{2}-\d{2}$/;

function dueInstant(value) {
  if (!value) return null;
  const raw = typeof value === 'string' ? value : new Date(value).toISOString();
  const d = new Date(BARE_DATE.test(raw) ? `${raw}T23:59:59.999Z` : raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

// The ISO form of the same, for sending to a browser.
function dueISO(value) {
  const d = dueInstant(value);
  return d ? d.toISOString() : null;
}

// An assignment with no due date never closes — there is no window to be
// outside of. Closure is derived, never stored: extending a deadline past
// today reopens the assignment with no second piece of state to keep in step,
// which is what makes "extend after it has passed" work at all.
function isClosed(assignment, at = new Date()) {
  const due = dueInstant(assignment && assignment.dueDate);
  return Boolean(due) && due < at;
}

module.exports = { DEFAULT_DUE_TIME, dueInstant, dueISO, isClosed };
