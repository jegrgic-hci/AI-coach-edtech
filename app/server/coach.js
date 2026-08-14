// Chat + auditor message builders.
//
// The chat is deliberately unsteered: no system prompt, no assignment context,
// no coaching persona. Coaching levels were removed 2026-08-14 — the personas
// and their "never write the essay" rules interfered too much with natural
// use, and the point of the tool is to measure how a student works with an
// ordinary Gen AI chat, not with a chaperoned one. Anything the model needs to
// know about the task, the student tells it themselves; that request is itself
// a signal worth measuring.

// The auditor is the second voice — summoned only via the Evaluate button,
// never speaks otherwise. Rough read, not a score: behaviors quoted from the
// conversation. Its exchanges are meta-turns excluded from TAU.
const AUDITOR_PROMPT = `You are an AI-use auditor. A student working on a school assignment with an AI assistant has asked you to evaluate how they are using the AI so far. You will be shown their conversation.

The assignment:
---
{{ASSIGNMENT_PROMPT}}
---

Give a short, plain-language read of HOW the student is working with the AI — their process, not their essay. Structure:
1. Two or three specific things they did well, each quoting or closely paraphrasing an actual moment from the conversation (e.g. pushing back on the AI, refining a request, contributing their own idea).
2. One growth move: a concrete behavior to try next (e.g. "before accepting that definition, ask what evidence supports it").

Rules:
- Never mention scores, numbers, grades, or ratings.
- Never accuse or judge — describe behaviors.
- Never comment on essay quality; only on how they used the AI.
- Speak directly to the student, warm and brief.`;

function liveHistory(turns) {
  return turns.filter((t) => !t.meta?.metaTurn && !t.meta?.superseded);
}

function chatMessages({ turns }) {
  return liveHistory(turns).map((t) => ({
    role: t.role === 'student' ? 'user' : 'assistant',
    content: t.text,
  }));
}

function auditorMessages({ assignmentPrompt, turns }) {
  const system = AUDITOR_PROMPT.replace('{{ASSIGNMENT_PROMPT}}', assignmentPrompt);
  const transcript = liveHistory(turns)
    .map((t) => `${t.role === 'student' ? 'Student' : 'AI'}: ${t.text}`)
    .join('\n\n');
  return [
    { role: 'system', content: system },
    { role: 'user', content: `Here is my conversation so far:\n\n${transcript}\n\nHow am I doing at using the AI?` },
  ];
}

module.exports = { chatMessages, auditorMessages };
