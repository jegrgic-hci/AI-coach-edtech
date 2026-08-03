# Interaction / UX

## Primary sources

- **Jakob Nielsen's 10 Usability Heuristics** — general interaction design (visibility of system status, match between system and real world, user control/freedom, consistency & standards, error prevention, recognition over recall, flexibility/efficiency, aesthetic-minimalist design, help users recognize/diagnose/recover from errors).
- **Jon Yablonski, *Laws of UX*** — compiled psychology-based principles: Fitts's Law (target size/distance), Hick's Law (more choices = slower decisions), Jakob's Law (users expect consistency with UIs they already know, including your own other screens), Miller's Law (chunking, ~4-7 items in working memory), the Aesthetic-Usability Effect.
- **Don Norman, *The Design of Everyday Things*** — affordances and signifiers: does a control visually signal what it does and what it's connected to?

## Standing checks (see also SKILL.md — these are the two that matter most)

### Required vs. hidden
Progressive disclosure (deferring secondary controls until needed) is valid **only** for genuinely optional or rarely-needed content. A required field with a computed default is still required — the user must be able to see and confirm it, not have it hidden behind a collapsed disclosure. A default is a starting point for review, not a substitute for confirmation.

*Caught instance:* per-draft due date and coaching level were collapsed behind a "Customize per-draft schedule" toggle, reasoning that auto-fill covers the common case. But both fields are required per draft — auto-fill can be wrong (a date could land on a holiday; a default coaching level may not match the teacher's actual plan), and hiding them let a teacher submit without ever reviewing the guessed values. Fix: remove the collapse, keep rows always visible, mark them required.

### Status visibility for causal relationships
If one control's value determines another's (e.g., a "draft budget" number regenerating a list of per-draft rows below it), Nielsen's visibility-of-system-status heuristic requires that relationship be visually legible — not just logically implemented in the handler. A bare number input with no visual connection to the rows it generates is invisible causality. Fix with a contained panel/rail/border that visually groups the driver and its output, not just spacing.

## Other checks to run

- **Hick's Law on choice sets:** a checklist of many items with no bulk action (select all, select none) forces N individual decisions where 1 would do for the common case. Add the bulk action when the list can plausibly be long or fully-selected.
- **Error prevention over error messaging:** prefer disabling/constraining invalid states (e.g., a submit button disabled until required fields are valid, a date picker that can't produce an out-of-order sequence) over catching the error after submit with a blocking alert. Sequential blocking `alert()`s for validation are the anti-pattern to avoid — they interrupt, must be dismissed one at a time, and re-trigger on each resubmit attempt.
- **Recognition over recall:** if a control needs an explanatory sentence next to it to be understood (e.g., a label that has become a full sentence describing what a section does), that's a signal the visual design isn't making the relationship recognizable on its own — fix the design, don't just add more words.
- **Consistency with the rest of the app (Jakob's Law, self-referential):** before introducing a new interaction pattern (e.g., an inline "add new" affordance that swaps a row into an input), check whether a similar pattern already exists elsewhere in the app for the same underlying action, and reuse it rather than inventing a parallel one.

## See also

`content-hierarchy.md` layer 4 — scanning/placement (F-pattern/Z-pattern behavior) should determine where the highest-priority control or content sits, not just how it's styled. A correctly-weighted element in the wrong position still loses to scanning behavior.

## How to apply

Run through this file's checks explicitly against the actual current behavior (read the JS, not just the markup) before proposing changes. Every friction point should map to a named principle above — if it doesn't, it may be a judgment call rather than an established rule; say so.
