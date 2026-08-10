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

function layout({ heading, body, url, action }) {
  return `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;font-size:16px;line-height:1.55;color:#1e2b26;max-width:34rem">
  <p style="font-size:18px;font-weight:600;margin:0 0 1rem">${esc(heading)}</p>
  ${body.map((p) => `<p style="margin:0 0 1rem">${esc(p)}</p>`).join('\n  ')}
  <p style="margin:1.5rem 0"><a href="${esc(url)}" style="background:#2f5d50;color:#fff;padding:0.7rem 1.1rem;border-radius:6px;text-decoration:none;display:inline-block">${esc(action)}</a></p>
  <p style="margin:0 0 1rem;color:#5b6b65;font-size:14px">If the button does not work, paste this into your browser:<br>${esc(url)}</p>
</div>`;
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

  return sendMail({
    to: user.email,
    userId: user.id,
    purpose: 'invite',
    subject: 'Set up your Tau Thinking account',
    text: `Hi ${user.displayName},\n\n${lines.join('\n\n')}\n\n${url}\n`,
    html: layout({ heading: `Hi ${user.displayName},`, body: lines, url, action: 'Choose a password' }),
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

  return sendMail({
    to: user.email,
    userId: user.id,
    purpose: 'reset',
    subject: 'Reset your Tau Thinking password',
    text: `Hi ${user.displayName},\n\n${lines.join('\n\n')}\n\n${url}\n`,
    html: layout({ heading: `Hi ${user.displayName},`, body: lines, url, action: 'Choose a new password' }),
  });
}

module.exports = { sendInvite, sendReset };
