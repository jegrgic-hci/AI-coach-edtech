// Finding the places a student has identified themselves in their own writing.
//
// The problem this deliberately does NOT try to solve is "is this string a
// person's name". That is unanswerable without knowing the referent — "Jane
// Austen" in an essay about Austen is the subject, and in a themed anonymous
// roster half the class is *labelled* austen or orwell. A name detector would
// fire on the roster itself.
//
// What is answerable is whether the writer is naming THEMSELVES, because the
// signal is carried by the frame, not by the name inside it. Nobody writes
// "Name: Sam Lee" about a character, and "my name is —" is a first-person
// claim of identity whatever follows it. So every pattern here matches a frame
// and captures whatever it contains.
//
// The consequence, stated plainly rather than buried: a child who writes their
// own name in running prose ("Sam walked home") is not detectable here and is
// not meant to be. That case is what a redaction path is for.

// A "Name:"-style header line. The overwhelming case in practice: a .docx
// whose first lines are the header a teacher asked for on paper, pasted
// through the upload extractor. Anchored per line and to the start of it, so
// "the name: of the rose" mid-paragraph does not match.
const HEADER_LABELS = 'name|student|student name|pupil|by|author|written by|full name|class|form|teacher';

const PATTERNS = [
  {
    kind: 'email',
    // Deliberately looser than a validating regex — this is looking for
    // something address-shaped to remove, not deciding whether mail would
    // deliver to it.
    re: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g,
  },
  {
    kind: 'phone',
    // Two narrow shapes, not "a long run of digits". The loose version of this
    // matched "0.000002" and "0.000008" in a real essay — a decimal is digits
    // with a separator in it — and a 12-digit reference number. A false
    // positive here silently rewrites a student's sentence in the corpus the
    // measurement is calibrated on, so this trades recall for precision:
    //   - grouped: a +, or spacing/parens/hyphens between the digits. No dot,
    //     which is what let decimals through.
    //   - bare: 9 to 11 digits exactly, the length a phone number actually is,
    //     so years, page counts and long ids do not qualify.
    // A bare 12-digit string is therefore missed on purpose.
    re: /(?:\+\d[\d\s()-]{6,14}\d|\d[\d]*[\s()-][\d\s()-]{5,13}\d|\b\d{9,11}\b)/g,
  },
  {
    kind: 'header',
    re: new RegExp(String.raw`^[ \t]*(?:${HEADER_LABELS})[ \t]*[:–-][ \t]*\S.*$`, 'gim'),
  },
  {
    kind: 'self-naming',
    // First-person identity claims only. "I'm X" is deliberately absent: it
    // takes an adjective far more often than a name ("I'm stuck"), and a
    // detector that cries wolf on ordinary writing gets ignored or switched
    // off, which costs more than the case it catches.
    re: /\b(?:my name(?:'s| is)|i am called|you can call me|call me)\b[ \t]*[^.\n!?]{0,60}/gi,
  },
];

// Returns [{ kind, match, index }], one per hit, in document order.
function findSelfIdentification(text) {
  const value = String(text || '');
  const hits = [];
  for (const { kind, re } of PATTERNS) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(value)) !== null) {
      hits.push({ kind, match: m[0], index: m.index });
      if (m[0] === '') re.lastIndex++;
    }
  }
  return hits.sort((a, b) => a.index - b.index);
}

// The same text with every hit replaced by a marker naming what was taken out.
// A marker rather than deletion: an analysis reads the shape of a passage, and
// silently closing the gap would change the sentence rather than mask a span.
function redactSelfIdentification(text) {
  const hits = findSelfIdentification(text);
  if (!hits.length) return { text: String(text || ''), hits: [] };

  // Applied back-to-front so earlier indices stay valid, and overlapping hits
  // (an address inside a "Name:" line) collapse into the outer one.
  let out = String(text);
  let lastStart = Infinity;
  for (let i = hits.length - 1; i >= 0; i--) {
    const h = hits[i];
    const end = h.index + h.match.length;
    if (end > lastStart) continue;
    out = out.slice(0, h.index) + `[${h.kind} redacted]` + out.slice(end);
    lastStart = h.index;
  }
  return { text: out, hits };
}

module.exports = { findSelfIdentification, redactSelfIdentification };
