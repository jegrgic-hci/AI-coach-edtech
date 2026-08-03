# Information architecture

## Primary source

Peter Morville & Louis Rosenfeld, *Information Architecture for the World Wide Web* ("the polar bear book") — the canonical reference for labeling systems, taxonomy, and findability. The rules below are drawn from its labeling-systems chapter.

## The labeling rule

A label must name **the content/object it represents**, not:
- **A question about it** — "Who" instead of "Classes." The reader has to mentally resolve the question into the object before recognizing what belongs there. This costs a step every single time the form is used, not just the first time.
- **A system behavior about it** — "What students see" instead of "Assignment details." This describes a fact about visibility/permissions, not what category of information the user is entering. The user filling out the form is thinking about the object ("I am describing the assignment"), not the system's rendering behavior ("this data later gets shown to students"). Nielsen's heuristic #2 (match between system and the real world) backs this too: speak the user's task language, not the system's internal framing.
- **A process phrase that over-promises** — "When & how" when there is no "how" decision, only scheduling. A label sets an expectation for its contents (information scent); if the label promises something the section doesn't deliver, the reader either hunts for the missing part or stops trusting the labels generally.

## Internal consistency

A labeling system should be consistent in **form**, not just individually correct. If some section labels are nouns ("Classes"), others shouldn't be questions ("Who") or two-part process phrases ("When & how"). Pick one grammatical form — nouns naming the content-object — and hold every label in the same system to it.

## Worked example (from this project's assignment-creation modal)

| Before | Problem | After | Why |
|---|---|---|---|
| "Who" | Pronoun standing in for a category; forces translation | "Classes" | Names the literal object — the checkboxes ARE a list of classes |
| "What students see" | System-behavior statement, not content identity | "Assignment details" | Names what the fields collectively are, from the user's task frame |
| "When & how" | Promises a "how" the section doesn't contain | "Drafts & due dates" | Names exactly what's inside — scheduling, no more |

## See also

`content-hierarchy.md` layer 2 — once labels/objects are identified, check whether their structural nesting (what's a parent, what's a peer) actually matches which content is most important, not just what's topically related.

## How to apply

Before finalizing any label (section heading, field label, button text, tab name), ask: could someone unfamiliar with this specific UI infer the label purely from what's inside it, without needing to interpret a question or a behavior clause? If not, rename it to the object itself.
