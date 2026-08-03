# Forms

Forms-specific application of the general lenses. Read this alongside `information-architecture.md`, `interaction-ux.md`, `content-design.md`, and `visual-design.md` — this file only covers what's specific to forms.

## Field-level checks

- **Match input width to expected answer length** (Wroblewski, *Web Form Design*) — a title gets a full-width text input, a draft-budget count gets a narrow numeric input, not uniform full-width for everything regardless of what's being entered.
- **Top-aligned, persistent labels over placeholder-only** for any field where the label distinguishes it from an adjacent similar field (see `content-design.md`). Placeholder-only is acceptable only when the field is self-evident and short (e.g., a single "Title" input with nothing nearby to confuse it with).
- **Single column, vertical flow** over multi-column layouts for task-based forms — matches natural reading/fill order and avoids the eye needing to track across columns.
- **Smart, visible defaults** — pre-fill what can be reasonably inferred (e.g., due dates spaced backward from a due date), but see the required-vs-hidden check in `interaction-ux.md`: a default must stay visible and editable if the field is required, never used as a reason to hide it.

## Grouping checks

- **Group by object, not by arbitrary form order.** Identify the actual objects the form collects (e.g., for an assignment: the target audience, the content, the schedule) and section by those objects — see the IA labeling worked example in `information-architecture.md` for how this played out concretely (Classes / Assignment details / Drafts & due dates).
- **Weight sections by actual complexity**, per `visual-design.md` — a section with a dynamic, multi-row sub-structure (e.g., per-draft rows) needs a contained treatment (bordered/backgrounded panel) so its internal relationships (a control that generates rows) are visually legible, not a flat list at the same weight as a two-field section.
- **Bulk actions for multi-select groups** (e.g., "select all" on a class checklist) when the list can plausibly be long or fully-selected — see Hick's Law in `interaction-ux.md`.

## Validation checks

- Prefer inline, per-field validation surfaced as the user fills the form (or at minimum, disable submit until required state is met) over sequential blocking `alert()` calls on submit.
- Constrain rather than just validate where possible — e.g., a per-draft date picker that can't produce an out-of-order sequence is better than one that allows it and then rejects on submit.

## Worked example: this project's assignment-creation modal

Full before/after and rationale for a real review is preserved as an artifact from the session that produced this skill — see the conversation history for the published mockup (before/after toggle) if it needs to be referenced as a concrete precedent. The key moves, summarized:

1. Relabeled sections by object (see `information-architecture.md`).
2. Reordered "Classes" first — target before content, matching how the task is actually approached.
3. Added persistent micro-labels + a one-line disambiguating help note between Description and Purpose.
4. Contained the drafts/dates section in a bordered panel so the draft-budget → per-draft-rows relationship is visible.
5. Removed a disclosure/collapse that had been hiding required per-draft fields behind an "auto-filled, so it's fine to hide" assumption — reinstated as always-visible, required, with a visible marker.
6. Removed zebra striping on the 3-row draft list — it implied a distinction (Draft 2 singled out) that didn't exist.
7. Marked required fields with a consistent, low-noise marker instead of leaving required/optional undifferentiated.
