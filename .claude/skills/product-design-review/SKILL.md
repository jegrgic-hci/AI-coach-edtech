---
name: product-design-review
description: Use whenever creating, evaluating, or revising any UI, screen, form, modal, flow, dashboard, or interaction design in this repo — including proposing layout, labels, copy, or visual structure. Triggers on words like form, modal, layout, screen, dashboard, flow, UI, field, label, component. Provides an objective, citable process (information architecture, interaction/UX, content design, visual design) instead of taste-based suggestions.
---

# Product design review

This skill exists because unstructured design suggestions produced repeated, avoidable mistakes — mislabeled sections (a question-word like "Who" instead of the object "Classes"), and required fields hidden behind a disclosure to solve a density problem instead of fixing the container. Both were caught by the user, not by this process. The process below exists so those categories of mistake get caught before a proposal is made, not after.

## Before anything else

1. **Check the project's own system first.** Read `designsystem.md`'s Hard Constraints section and any relevant locked decisions. Read `CLAUDE.md` for which surface you're in (`teacher-dashboard-design.md` for `app/web/dashboard.html`, etc.). A locked project decision always outranks general design theory below. If nothing in the project's system covers the case, say so explicitly — that's a gap to flag, not license to improvise.
2. **Identify what's being designed** and pull the matching reference file(s) for depth:
   - A form or modal with input fields → `references/forms.md` + `references/information-architecture.md`
   - Any labeling, navigation, or section/category naming → `references/information-architecture.md`
   - Interaction behavior (validation, feedback, error handling, disclosure/collapse, defaults) → `references/interaction-ux.md`
   - Copy — button text, labels, error messages, help text → `references/content-design.md`
   - Spacing, grouping, color, type → `references/visual-design.md`
   - Anything with more than one competing element — what's most important, what should stand out, what should the eye hit first → `references/content-hierarchy.md`, in addition to whichever other files apply
   Load more than one when the work spans categories — most real UI work does.

## The lens sequence

Work in this order. Each lens can invalidate a decision made in an earlier one, so don't skip ahead to visual polish before structure is settled.

1. **Information architecture** — what are the actual objects/categories of information here, and does every label name the object itself rather than asking a question about it or describing a system behavior? (See `references/information-architecture.md`.)
2. **Structure / content design** — given the IA, what does each field/section actually say, in the user's language, matching their mental model? (See `references/content-design.md`.)
3. **Interaction / UX** — how does the user move through it: what's required vs. optional, what's shown by default vs. hidden, what feedback confirms an action, what prevents an error before submit? (See `references/interaction-ux.md`.)
4. **Visual design** — spacing, grouping, hierarchy, and color, applied through the project's own tokens (`app/web/tokens.css`), never inventing new palette/type. (See `references/visual-design.md`.)

## Standing checks — apply to every proposal

These two are called out separately because they are the two mistakes that motivated this skill. Run them explicitly, every time, don't rely on the general lenses to catch them implicitly.

- **Label check:** for every section/field label, ask "does this name the content itself, or does it pose a question / describe what the system does with it?" A label that requires translation before the reader recognizes it (a pronoun, a process phrase, a system-behavior statement) is wrong. See `references/information-architecture.md` for the full rule (Morville & Rosenfeld labeling systems).
- **Required-vs-hidden check:** before collapsing, deferring, or backgrounding anything, ask "is this actually optional, or is it a required decision I'm just making less visible?" Progressive disclosure is only valid for genuinely optional or rarely-needed content — never for a required field, even if it has a computed default. A default is a starting point for review, not a substitute for the user confirming it.

## Citation discipline

Every concrete suggestion in a design review or proposal must name which principle or source justifies it (e.g., "per Hick's Law," "per Morville's labeling-system rule," "per the project's `--tau-*` spacing scale"). If a suggestion can't be tied to a source or a locked project decision, say so and flag it as a judgment call rather than presenting it as settled.

## Process for a review

1. Read the actual current markup/CSS/JS — never review from memory or assumption. Cite real file:line references.
2. Walk the lens sequence, citing sources at each step.
3. Run the standing checks explicitly.
4. Produce prioritized, concrete recommendations — not just a list of problems.
5. Do not implement changes as part of a review. Per this project's standing preference, explain the issue and propose the fix, then wait for approval before touching any file (see the user's `feedback_explain_before_executing` memory — this applies to design issues exactly as it applies to bugs).
