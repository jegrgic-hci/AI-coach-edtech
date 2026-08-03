# Visual design

## Primary sources

- **Gestalt principles** (proximity, similarity, common region) — the formal basis for why grouping does or doesn't read correctly. Proximity in particular: elements spaced equally read as one group regardless of their conceptual distinctness.
- **Refactoring UI** (Adam Wathan & Steve Schoger) — practical rules: signal grouping with spacing/background rather than borders alone; establish a clear type-weight hierarchy between structural text (labels, eyebrows) and content text; de-emphasize secondary controls via size/color/weight rather than hiding them outright.
- **This project's own token system** — `app/web/tokens.css`, governed by `designsystem.md`. Never invent new colors, spacing values, radii, or type scale outside the `--tau-*` tokens already defined. This overrides general theory — the point of a locked design system is that these decisions are already made.

## Checks to run

- **Proximity audit:** do fields/sections that are conceptually distinct get more visual separation (spacing, grouping container) than fields that are actually part of the same object? If title/description/purpose/requirements all sit at identical `gap` values, Gestalt proximity reads them as one undifferentiated group even if they're conceptually four different things.
- **Weight-matches-complexity:** does a visually dense section (many fields, dynamic rows) get a heavier/contained treatment (bordered panel, background) commensurate with its complexity, or is it given the same flat list treatment as a simple two-field section? Under-treating a dense section is a common miss.
- **Decorative vs. meaningful structure:** any visual device — striping, color, borders, badges — must encode something true about the content, not just exist because it's a common pattern for that component type. Zebra striping exists to help track a row across a *wide* table with *many* rows; applying it reflexively to a short 3-row list makes one row look arbitrarily emphasized/selected when nothing distinguishes it. Before adding any structural/decorative device, ask what it's supposed to communicate — if the answer is "nothing, it's just what tables/lists usually look like," remove it.
- **Required-vs-optional signaling:** is there a consistent, low-noise visual marker (not just an inconsistent "— optional" text suffix) distinguishing required from optional fields across the whole form? Pick one convention and apply it uniformly.
- **Component reuse:** do two UI patterns doing conceptually the same job (e.g., two different "choose one/many from a list" patterns in the same form) share visual treatment, or have they drifted into looking like different component families? Check against the project's actual component inventory before introducing a new visual treatment for something that already has one.

## See also

`content-hierarchy.md` layer 3 — grouping (this file's proximity/Gestalt checks) answers "what belongs together"; hierarchy answers the separate question "what outranks what." Check both — a well-grouped section can still fail hierarchy if its visual weight doesn't match its actual priority.

## How to apply

Only ever style through the existing `--tau-*` custom properties. If a needed value doesn't exist in the token set, that's a gap to flag to the user, not a license to pick an arbitrary hex/px value.
