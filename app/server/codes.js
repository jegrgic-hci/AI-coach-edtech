// Access codes — the credential for a student account that has no email
// address, which is how a class of minors is rostered (see the teacher's
// codeRoster grant). The teacher hands the code over in person; nothing about
// the child is entered into the product.
//
// This is the one place in the app where a credential is displayed to somebody
// other than its owner, and it is deliberate. auth.js mails a link rather than
// showing a password because the mailbox is the safer channel and it closes
// "an admin can then sign in as them". Neither holds here: there is no
// mailbox, so the teacher IS the delivery channel, and a teacher can already
// read everything this account will produce. What still holds is that the code
// is stored hashed and never readable back — a lost code is reissued, never
// looked up.
//
// The code is stored as the account's PASSWORD, through auth.js's own
// setPassword. There is no second credential path and no second hash: a code
// account differs from an email account only in what identifies it, never in
// how the secret is checked.

const crypto = require('crypto');

// Digits and consonants only. No 0/O/1/I/L to be misread off a printed slip,
// and no vowels at all so a random draw cannot spell a word a child should not
// be handed. 27 symbols × 10 characters ≈ 47.5 bits.
const ALPHABET = '23456789BCDFGHJKMNPQRSTVWXZ';

// Ten, ~47 bits. The code is a password in the ordinary sense — it goes in the
// password field, against a username the teacher may well read out loud or pin
// to a wall — so it carries the whole weight of the credential and must hold up
// without leaning on rate limiting to do it.
const LENGTH = 10;

// Rejection sampling, not `% ALPHABET.length`: 256 is not a multiple of 27, so
// the modulo would make the first four symbols measurably likelier than the
// rest and quietly spend some of the entropy counted above.
function randomSymbol() {
  const limit = 256 - (256 % ALPHABET.length);
  for (;;) {
    const byte = crypto.randomBytes(1)[0];
    if (byte < limit) return ALPHABET[byte % ALPHABET.length];
  }
}

// One unbroken run of characters ("K7RM9XPD4T"). No grouping hyphen: it was
// presentation only, and a separator a child may or may not copy is a
// difference between what is printed and what is typed for no gain.
// normalizeCode still strips hyphens on the way in, so a code written down
// with one by hand is not rejected.
function newAccessCode() {
  let raw = '';
  for (let i = 0; i < LENGTH; i++) raw += randomSymbol();
  return raw;
}

// What a child actually types is uppercased and stripped of the spaces and
// hyphens they may or may not have copied.
function normalizeCode(input) {
  const value = String(input || '').toUpperCase().replace(/[\s-]/g, '');
  if (value.length !== LENGTH) return null;
  for (const ch of value) if (!ALPHABET.includes(ch)) return null;
  return value;
}

// ---------- usernames ----------
//
// Two fields at sign-in, the ones the login form already has: the username
// goes in Email and the access code goes in Password. Nothing new to learn and
// no second credential path in the server — the code IS the password, hashed
// by auth.js's setPassword like any other.
//
//     austen@karim.tau
//     └lbl┘ └teacher┘
//
// Last word only on both sides, and no separators inside either: "Jane Austen"
// under "Ms. Karim" is austen@karim.tau. A surname is what a class already
// calls a person, and it is the shortest thing a nine-year-old can copy
// without losing their place. The roster still shows the full label —
// displayName is what a teacher reads, username is what a student types.
//
// The .tau suffix makes it a well-formed address so it passes an email field
// without complaint, while being a TLD that does not exist — mail to it cannot
// leave anywhere, so a parent who tries to write to their child's "address"
// gets an immediate bounce instead of silence.
//
// Both halves are slugs of things a person chose, so both can change. Neither
// is ever recomputed: the teacher's handle is minted once onto their account
// and the student's username is stored on theirs. A teacher who becomes
// "Mrs. Karim-Lee" in March does not invalidate thirty sign-ins.

// The last word, letters and digits only, nothing joining them.
//
// Three cases stop "take the last token" from being enough, all found by
// running real labels through it:
//   - an apostrophe is part of a name, not a break in it, or "O'Brien" ends up
//     as "brien" — so it is deleted before the split rather than split on
//   - a trailing initial or honorific is not a surname, so a one-character
//     token falls back to the token before it ("Karim J." -> karim)
//   - a trailing number is not a name at all but a counter, so it joins the
//     word before it ("Student 01" -> student01, never "01")
function slug(value) {
  const words = String(value || '')
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  if (!words.length) return '';

  const last = words[words.length - 1];
  if (/^\d+$/.test(last) && words.length > 1) {
    return (words[words.length - 2] + last).slice(0, 32);
  }
  for (let i = words.length - 1; i >= 0; i--) {
    if (words[i].length > 1) return words[i].slice(0, 32);
  }
  return last.slice(0, 32);
}

// "Ms. Karim" -> "karim"; "Mrs. Karim-Lee" -> "lee"
function teacherSlug(displayName) {
  return slug(displayName) || 'teacher';
}

// "Jane Austen" -> "austen"; "Kookaburra" -> "kookaburra"
function labelSlug(label) {
  return slug(label) || 'student';
}

const USERNAME_TLD = 'tau';

function buildUsername(label, handle) {
  return `${labelSlug(label)}@${handle}.${USERNAME_TLD}`;
}

module.exports = {
  newAccessCode, normalizeCode, ALPHABET, LENGTH,
  teacherSlug, labelSlug, buildUsername,
};
