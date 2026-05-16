# Critical Thinking Auditor — Educator Guide

## What This Tool Does

The Critical Thinking Auditor (CTA) analyzes how a student used AI during a writing or research task. It does not measure the quality of the final essay. It measures the quality of the student's thinking *during* the AI collaboration.

The tool takes two inputs:
- The student's AI chat log
- The student's final essay or draft

From these, it produces a TAU Score — a four-dimension profile of how the student engaged — and a Sankey visualization that shows how their ideas developed across the conversation.

---

## The Four Dimensions (TAU Score)

Each dimension is scored 1–5. Together they tell a story about how the student thought, not just what they produced.

### 1. Prompting Quality (PQ)
**What it measures:** Did the student ask questions that drove the conversation deeper?

A student who asks "write me an introduction" and accepts the result is using AI as a typewriter. A student who asks "why did the financial crisis accelerate the revolution rather than just contribute to it?" is using AI as a thinking partner. PQ distinguishes between these.

**How we measure it:**
- Did the student's questions build on what the AI just said, or were they independent of it? *(Responsiveness)*
- Did the student probe the AI's reasoning, ask for justification, or make comparisons? *(Challenge)*

Questions are not counted — they are evaluated for whether they pushed the conversation forward.

---

### 2. Selective Use (SU)
**What it measures:** Did the student direct the AI strategically, or simply consume its output?

Extraction — asking the AI for content — is not inherently negative. A student who reads a long AI response, selects the most relevant part, and asks a more focused follow-up question is showing high agency. A student who asks for more content without processing what they received is not.

**How we measure it:**
- What did the student do immediately after receiving AI output?
- High agency responses: making a claim, asking a more specific question, pushing back
- Low agency responses: asking for more content, passive acknowledgment ("ok great")

The pattern that follows extraction is the signal, not the extraction itself.

---

### 3. Calibrated Skepticism (CS)
**What it measures:** Did the student critically evaluate AI output, or accept it at face value?

A student who challenges, questions, or refines what the AI gives them is demonstrating one of the most important academic skills — the ability to evaluate a source rather than trust it automatically.

**How we measure it:**
- **Rejection** — student explicitly disagrees with or challenges an AI claim
- **Refinement** — student accepts the output but adds constraints, redirects, or narrows the focus

Note: one instance of pushback is not the same as sustained critical engagement. The tool weights frequency and depth, not just presence.

---

### 4. Original Contribution (OC)
**What it measures:** Did the student bring their own thinking to the work, or did ideas flow primarily from the AI?

This is the most important dimension for academic integrity. A high OC score means the student introduced ideas, arguments, or framings that were not present in the AI's responses — and that those ideas made it into the final essay.

**How we measure it:**
- Key concepts and claims in the essay are traced back through the chat log
- If a concept appears in the student's turns *before* the AI mentioned it → student-born
- If a concept appears in the AI's turns before the student used it → AI-born
- If both developed it together → synthesized
- OC score is weighted toward student-born and synthesized ideas in the essay

---

## The SAMR Level

The TAU Score maps to a SAMR level — a framework many educators already know from technology integration. In this context, SAMR describes how the student used AI as a thinking tool, not just a technology.

SAMR is applied at two levels:
- **Conversation level** — an overall label for the entire session based on the combined TAU score
- **Per-thread level** — each idea thread in the Sankey has its own SAMR arc, showing how the student's engagement evolved within that specific topic

### The Four Levels

**Substitution — TAU 4–8**
The student used AI to complete the task on their behalf. Questions were broad and open-ended, output was accepted without challenge, and ideas in the essay trace primarily back to the AI.

*Example: "Write me an introduction about the French Revolution." Student copies the result into their essay.*

---

**Augmentation — TAU 9–12**
The student used AI to deepen their understanding of a topic. Questions showed curiosity and some follow-up, but the student largely accepted AI output without redirecting or challenging it.

*Example: "Explain why the financial crisis contributed to the revolution." Student reads the response and asks for another topic.*

---

**Modification — TAU 13–16**
The student actively directed and challenged the AI. Questions probed reasoning, pushed back on claims, and refined the direction of the conversation. The student showed clear editorial judgment about what to use and what to ignore.

*Example: "But wouldn't the Enlightenment ideas have been less influential without the financial crisis making people desperate for change? Can you explain the relationship between the two?"*

---

**Redefinition — TAU 17–20**
The student used AI as a genuine thinking partner to develop ideas that could not have emerged without the exchange — but where the student's original thinking is clearly present and traceable. Essay ideas are synthesized from both AI input and student-born concepts.

*Example: "Based on what we discussed about the financial crisis and Enlightenment ideas, I think the real catalyst was people's ability to imagine alternatives — can you help me test this argument?"*

---

### What SAMR Tells You as an Educator

A Substitution score is not a reason to penalize — it is an opportunity to teach. Many students have never been shown how to use AI as a thinking partner rather than a ghostwriter. The SAMR level gives you a concrete, jargon-free starting point for that conversation.

A Redefinition score on one thread and a Substitution score on another tells a more nuanced story — the student engaged deeply with one idea and passively consumed another. The Sankey makes this visible at a glance.

---

## The Sankey Visualization

The Sankey chart shows how the student's ideas developed across the conversation. It is not a score — it is a map of their thinking process.

**What you see:**
- A single starting point on the left (the beginning of the conversation)
- Threads that branch out as the student explores different topics
- Thread thickness shows active engagement — thick = currently developing this idea, thin = holding it in the background
- Thread height and color show SAMR level — ideas that climb are ones where the student's thinking deepened over time
- Thread merges show synthesis — two ideas coming together into a larger concept
- Thread outcomes on the right show whether each idea made it into the essay (absorbed, evolved) or was dropped

**What a strong conversation looks like:** threads that start thin and climb, merges that produce thicker threads, most threads resolved in the essay.

**What a passive conversation looks like:** flat threads that stay low, few merges, threads that terminate without appearing in the essay.

---

## What the Tool Cannot Measure

Honesty about limitations builds trust. The CTA cannot:

- **Verify the chat log is complete** — a student could submit a partial log. The tool measures what it sees.
- **Detect a shadow AI session** — a student who uses a separate AI session to polish their prompts before submitting them to the primary session will appear more capable than they are. This is flagged where detectable (see Teacher View below) but cannot be confirmed.
- **Assess the correctness of ideas** — the tool does not know if the student's claims are accurate, only whether they originated with the student.
- **Confirm whether a student gamed the tool** — a determined student could construct a chat log that appears agentic without genuine engagement. However, doing so requires understanding what the tool measures, constructing plausible sequences of questions and pushback, and ensuring the essay reflects those ideas coherently. The effort required to successfully game the tool is, in most cases, greater than the effort required to simply engage authentically with the AI. The tool functions as a deterrent not because it catches every case of dishonesty, but because genuine engagement becomes the path of least resistance.

- **Replace teacher judgment** — scores and flags are starting points for a conversation, not verdicts.

---

## Teacher View — Integrity Flags

The teacher view shows everything the student sees, plus a set of integrity flags that are not visible to the student. These are not accusations — they are signals that warrant a closer look or a conversation.

**Flags you may see:**

| Flag | What It Means |
|---|---|
| Stylistic inconsistency | Student turn vocabulary or complexity jumps sharply relative to their baseline across the log — may indicate externally polished prompts |
| Unnatural fluency | Student responses lack hedging, false starts, or colloquial language — pattern consistent with AI-generated text |
| Provenance mismatch | Student's essay uses a concept as if it were their own, but the chat log shows the AI introduced it first |
| Shadow session pattern | Student responses are suspiciously well-calibrated to the AI's exact output — may indicate a separate AI session was used to pre-process responses |

None of these flags are proof of academic dishonesty. Some students simply write well, think clearly, and engage confidently. The flags are an invitation to ask the student to explain their thinking — a conversation that is itself a valuable learning moment.

---

## Why This Approach Is Reliable

The TAU Score is grounded in two measurement principles:

**1. Behavioral signals over surface proxies**
We do not count question marks or word totals. We look at what the student *did* — did they build on AI output or ignore it, did they push back or accept, did they introduce ideas or adopt them. Behavior is harder to fake than surface patterns.

**2. Sequential patterns over isolated events**
A single pushback phrase means little. A pattern of refinement across multiple turns means a great deal. The tool weights sequences — what happens before and after each student action — not just the action itself.

**What this means for you as an educator:** a student who scores high on the TAU dimensions genuinely engaged with the AI as a thinking tool. A student who scores low either did not engage deeply or used AI as a replacement for their own thinking. The Sankey makes this visible in a way that is easy to discuss directly with the student.

---

## How to Use This Tool in Your Classroom

**As a reflection tool for students:** share the Sankey with the student and ask them to narrate their thinking. "Walk me through this thread — what were you trying to figure out here?" The visualization makes the conversation concrete.

**As a formative assessment signal:** low CS or OC scores early in a course are an opportunity to teach AI collaboration skills, not a reason to penalize. The tool is most valuable when used to improve practice, not just evaluate it.

**As an integrity checkpoint:** integrity flags are not evidence — they are prompts. Use them to open a conversation, not close one.
