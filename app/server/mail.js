// Mail seam. Dev: prints the message to the console. Prod: SMTP2GO's HTTP API.
//
// HTTP, not SMTP, and that is not a preference — Cloud Run blocks outbound
// port 25 unconditionally and 465/587 without a VPC connector, so the SMTP half
// of SMTP2GO is unreachable from the deployed app. One fetch(), no dependency.
//
// The console fallback is what keeps localhost working with no credentials and
// no cost: an unconfigured instance prints the link it would have mailed, so
// the whole invite flow is testable before anyone has an API key. It is chosen
// by the *absence of a key*, not by NODE_ENV — a production instance somebody
// forgot to configure must fail loudly rather than silently print invite links
// into a log, which is why sendMail() refuses that combination outright.

const { col } = require('./store');
const { config } = require('./school');
const { PRODUCTION } = require('./auth');

const ENDPOINT = 'https://api.smtp2go.com/v3/email/send';

// SMTP2GO free plan. Held here rather than read from their API because there
// is no endpoint for it — they are plan facts, and the admin surface needs a
// denominator to make "34 sent today" mean anything. Update on a plan change.
const LIMITS = { perDay: 200, perMonth: 1000 };

function settings() {
  const fromFile = config().mail || {};
  return {
    apiKey: process.env.SMTP2GO_API_KEY || fromFile.apiKey || null,
    from: process.env.MAIL_FROM || fromFile.from || 'Tau Thinking <no-reply@tauthinking.com>',
    // Every link in an invite is absolute, so the server has to know its own
    // public origin — there is no request to derive it from when a send is
    // triggered by a background path, and trusting the Host header would let
    // a forged one rewrite where invite links point.
    appUrl: (process.env.APP_URL || fromFile.appUrl || 'http://localhost:8787').replace(/\/$/, ''),
    webhookSecret: process.env.MAIL_WEBHOOK_SECRET || fromFile.webhookSecret || null,
  };
}

// Firestore equality queries only, so the day/month buckets are stored rather
// than derived at read time: counting today's sends must not read every row
// this install has ever written.
function buckets(iso) {
  return { day: iso.slice(0, 10), month: iso.slice(0, 7) };
}

async function callProvider({ apiKey, from, to, subject, text, html }) {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Smtp2go-Api-Key': apiKey },
    body: JSON.stringify({ sender: from, to: [to], subject, text_body: text, html_body: html }),
  });

  const payload = await res.json().catch(() => ({}));
  const data = payload?.data || {};

  // A 200 with succeeded: 0 is a real outcome, not an edge case — a suppressed
  // address answers exactly that way. Treating any 200 as success is how a
  // bounced student silently looks invited.
  if (!res.ok || !data.succeeded) {
    const reason = data.error || data.failures?.[0]?.error
      || data.failures?.[0] || `provider returned ${res.status}`;
    return { accepted: false, failureReason: String(reason).slice(0, 300), providerMessageId: null };
  }
  return { accepted: true, failureReason: null, providerMessageId: data.email_id || null };
}

// Sends, and records the send. Never throws: an invite that cannot be mailed
// must still leave a usable account and a visible record behind it, so the
// caller's job is to report the returned outcome, not to catch an exception.
//
// The record is written whatever happens — a send that failed is precisely the
// one an administrator needs to find later, and it is the only answer to "my
// students never got their email" that does not depend on the provider's own
// dashboard, which retains five days on this plan.
async function sendMail({ to, subject, text, html, purpose, userId = null }) {
  const { apiKey, from } = settings();
  const sentAt = new Date().toISOString();
  let outcome;

  // Checked before the call rather than left to the provider, so hitting the
  // plan ceiling reads as "at the daily limit" on the admin surface instead of
  // a provider error string nobody can act on. A bulk class import is the case
  // that reaches it, and it is the case where knowing why matters most.
  // One equality constraint, not {day, month} — two of them would need a
  // composite index Firestore does not create on its own.
  const sentToday = apiKey ? (await col('emailSends').list({ day: buckets(sentAt).day }).catch(() => [])).length : 0;
  const atCap = apiKey && sentToday >= LIMITS.perDay;

  if (atCap) {
    outcome = {
      accepted: false,
      failureReason: `daily send limit reached (${LIMITS.perDay}) — not attempted`,
      providerMessageId: null,
    };
  } else if (!apiKey) {
    if (PRODUCTION) {
      outcome = { accepted: false, failureReason: 'no SMTP2GO API key configured', providerMessageId: null };
      console.error('[mail] refusing to send in production with no API key configured');
    } else {
      outcome = { accepted: true, failureReason: null, providerMessageId: null };
      console.log(`\n─── mail (console fallback — no API key) ───\nTo: ${to}\nSubject: ${subject}\n\n${text}\n───\n`);
    }
  } else {
    try {
      outcome = await callProvider({ apiKey, from, to, subject, text, html });
    } catch (err) {
      outcome = { accepted: false, failureReason: `send failed: ${err.message}`.slice(0, 300), providerMessageId: null };
    }
  }

  if (!outcome.accepted) console.error(`[mail] ${purpose} to ${to} not accepted: ${outcome.failureReason}`);

  let record = null;
  try {
    record = await col('emailSends').add({
      to,
      userId,
      purpose,
      subject,
      sentAt,
      ...buckets(sentAt),
      provider: apiKey ? 'smtp2go' : 'console',
      accepted: outcome.accepted,
      failureReason: outcome.failureReason,
      providerMessageId: outcome.providerMessageId,
      // Written by the provider webhook, minutes later. Acceptance is not
      // delivery: a hard bounce or a school filter rejection lands here long
      // after the API has already answered 200.
      deliveryStatus: null,
      deliveryDetail: null,
      deliveryAt: null,
    });
  } catch (err) {
    // Same rule as the admin audit log: a bookkeeping write must never be the
    // reason a teacher cannot invite a student.
    console.error('[mail] could not record emailSend:', err.message);
  }

  return { ...outcome, sendId: record?.id || null };
}

// Today's and this month's volume against the plan's own ceilings, plus the
// most recent send. The timestamp is the liveness signal the counts are not:
// "0 sent today" reads the same whether nothing was invited or sending broke,
// and "last send: 3 days ago" tells those apart on a school day.
async function volume() {
  const nowIso = new Date().toISOString();
  const { day, month } = buckets(nowIso);
  const [today, thisMonth] = await Promise.all([
    col('emailSends').list({ day }),
    col('emailSends').list({ month }),
  ]);

  const undelivered = thisMonth.filter((s) => !s.accepted || s.deliveryStatus === 'bounced' || s.deliveryStatus === 'spam');
  const lastSentAt = thisMonth.reduce((max, s) => (!max || s.sentAt > max ? s.sentAt : max), null);

  return {
    today: today.length,
    month: thisMonth.length,
    limits: LIMITS,
    undelivered: undelivered.length,
    lastSentAt,
    configured: Boolean(settings().apiKey),
  };
}

module.exports = { sendMail, volume, settings, LIMITS };
