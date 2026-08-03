# Content design

## Primary sources

- **Plain-language / task-based copywriting practice** (general content design discipline, e.g. the GOV.UK content style guide's approach, Nielsen's "match between system and the real world" applied to copy specifically).
- The IA labeling rule in `information-architecture.md` extends directly into content design — a field label is content, not just structure.

## Checks to run

- **User's language, not system's language:** name things by what the person recognizes doing, not by how the system implements it. A teacher "assigns work to a class," not "targets a scope." A control should describe the user's action or the object's identity, never an internal mechanism.
- **Distinguish near-identical fields with a one-line help note, not just placeholder text.** If two adjacent fields could plausibly be confused (e.g., "Description" vs. "Purpose" — both could be read as "what this is about"), a placeholder alone doesn't resolve the ambiguity because placeholders disappear on focus. A short persistent help line under the label ("Purpose — the why, distinct from what the task is") resolves it permanently.
- **Active voice, specific outcomes:** a control says exactly what happens ("Create assignment," not "Submit"), and any confirmation states what occurred ("Assignment created," not "Success").
- **Errors explain what's wrong and how to fix it:** no vague ("Something went wrong") or blaming ("Invalid input") messages — state the specific field and the specific fix ("Draft due dates must be in order — Draft 2 is before Draft 1").
- **Don't let structural devices (numbering, badges, eyebrows) imply information that isn't true.** Only number things that are actually sequential/ordered where order carries meaning the reader needs (e.g., draft 1 → 2 → final genuinely is ordered). Don't add numbering or sequence markers to a list just because it's a common pattern.

## See also

`content-hierarchy.md` layer 1 — before writing or reviewing copy, decide which single piece of content matters most (inverted-pyramid/content-strategy question); that decision should drive what's written first and most prominently, not be inferred after the fact from what ended up looking biggest.

## How to apply

When reviewing or writing copy for a form/UI, read every label, placeholder, help line, button, and error message as if seeing the tool for the first time — would the wording alone (without relying on visual position) tell you what to do and why? If not, it needs rewriting, not just restyling.
