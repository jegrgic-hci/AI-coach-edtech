// What an invite and a reset actually say. Kept out of mail.js (which is the
// transport seam) and out of index.js (which is routing), because this is
// product copy and it is the part most likely to be edited by someone who is
// not editing anything else.
//
// Both messages carry a link and no credential. Both are plain text first —
// school mail filters treat a bare HTML message with a single button more
// harshly than a text one, and the text part is what a filtered preview shows.

const { mintCredentialToken } = require('./auth');
const { sendMail, settings } = require('./mail');

function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

// Hosted, not attached and not a data URI: Gmail and Outlook both strip
// base64 image sources, and /assets is already served unauthenticated, so a
// plain absolute URL is the only route that needs no new transport work.
// Its own file rather than logo-mark.png so the mail asset can be sized for
// mail without a change to the app's own art, and the alt text carries the
// wordmark because school clients block remote images by default.
function logoTag() {
  return `<img src="${esc(settings().appUrl)}/assets/logo-email.png" width="110" height="54" alt="Tau Thinking"
       style="display:block;border:0;outline:none;text-decoration:none;margin:0 0 1.5rem">`;
}

function layout({ heading, body, url, action, footer }) {
  return `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;font-size:16px;line-height:1.55;color:#1e2b26;max-width:34rem">
  ${logoTag()}
  <p style="font-size:18px;font-weight:600;margin:0 0 1rem">${esc(heading)}</p>
  ${body.map((p) => `<p style="margin:0 0 1rem">${esc(p)}</p>`).join('\n  ')}
  <p style="margin:1.5rem 0"><a href="${esc(url)}" style="background:#2f5d50;color:#fff;padding:0.7rem 1.1rem;border-radius:6px;text-decoration:none;display:inline-block">${esc(action)}</a></p>
  <p style="margin:0 0 1rem;color:#5b6b65;font-size:14px">If the button does not work, paste this into your browser:<br>${esc(url)}</p>
  <hr style="border:0;border-top:1px solid #dfe4e1;margin:2rem 0 1rem">
  ${footer.map((p) => `<p style="margin:0 0 0.5rem;color:#5b6b65;font-size:13px;line-height:1.5">${esc(p)}</p>`).join('\n  ')}
</div>`;
}

// A transactional message is exempt from CAN-SPAM's unsubscribe and postal
// address rules, and an unsubscribe link would be actively wrong here — nobody
// can opt out of the account they are being asked to set up. What a footer on
// this kind of mail is actually for is the two questions a filtered message
// has to answer: why did this reach me, and who do I ask. The copyright line
// is a brand sign-off, not a legal device ("all rights reserved" has had no
// legal effect anywhere since 2000), so it stays short and last.
const YEAR = new Date().getFullYear();

function footerLines(reason) {
  return [reason, `© ${YEAR} Tau Thinking · tauthinking.com`];
}

const ROLE_WORD = {
  student: 'a student',
  teacher: 'a teacher',
  'platform-admin': 'an administrator',
};

// The invitee's own name is in the greeting and the inviter's name is in the
// body, because "who is this from and why am I getting it" is the question a
// filtered or half-read message has to answer in its first line.
async function sendInvite(user, actor) {
  const raw = await mintCredentialToken(user, 'invite', actor?.id || null);
  const url = `${settings().appUrl}/set-password.html?t=${encodeURIComponent(raw)}`;
  const who = actor?.displayName ? `${actor.displayName} has` : 'Your school has';
  const role = ROLE_WORD[user.role] || 'a member';

  const lines = [
    `${who} set up an account for you on Tau Thinking as ${role}.`,
    'Choose a password to finish setting up your account and sign in.',
    'This link works once and expires in 7 days. If you were not expecting this, you can ignore this email.',
  ];

  // Named inviter or not, "who do I ask" resolves to a person the recipient
  // can actually reach — never to this address, which nobody reads.
  const footer = footerLines(actor?.displayName
    ? `You are receiving this because ${actor.displayName} created a Tau Thinking account for you. Replies to this address are not monitored — contact them with any questions.`
    : 'You are receiving this because your school created a Tau Thinking account for you. Replies to this address are not monitored — contact your school with any questions.');

  return sendMail({
    to: user.email,
    userId: user.id,
    purpose: 'invite',
    subject: 'Set up your Tau Thinking account',
    text: `Hi ${user.displayName},\n\n${lines.join('\n\n')}\n\n${url}\n\n—\n${footer.join('\n')}\n`,
    html: layout({ heading: `Hi ${user.displayName},`, body: lines, url, action: 'Choose a password', footer }),
  });
}

async function sendReset(user) {
  const raw = await mintCredentialToken(user, 'reset', null);
  const url = `${settings().appUrl}/set-password.html?t=${encodeURIComponent(raw)}`;

  const lines = [
    'Someone asked to reset the password for your Tau Thinking account.',
    'This link works once and expires in 1 hour.',
    'If you did not ask for this, you can ignore this email — your password has not changed.',
  ];

  const footer = footerLines('You are receiving this because a password reset was requested for this address on Tau Thinking. Replies to this address are not monitored.');

  return sendMail({
    to: user.email,
    userId: user.id,
    purpose: 'reset',
    subject: 'Reset your Tau Thinking password',
    text: `Hi ${user.displayName},\n\n${lines.join('\n\n')}\n\n${url}\n\n—\n${footer.join('\n')}\n`,
    html: layout({ heading: `Hi ${user.displayName},`, body: lines, url, action: 'Choose a new password', footer }),
  });
}

module.exports = { sendInvite, sendReset };
