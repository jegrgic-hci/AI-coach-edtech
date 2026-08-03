# Content hierarchy

Content hierarchy is not one discipline's concern — it's the point where content strategy, information architecture, visual design, and interaction/scanning behavior all make claims about the same thing: what matters most, and does the page make that legible at a glance? Treat it as a required cross-check within each of the other lenses, not a separate pass done once at the end.

## The four layers, in the order they must be decided

Each layer answers a different question. Deciding them out of order is the usual failure mode — e.g., picking type sizes (layer 3) before deciding what's actually most important to say (layer 1) just makes an arbitrary priority look confident.

### 1. Priority — what actually matters most?

**Sources:** journalism's inverted-pyramid principle (lead with the single most important fact; everything after is progressively less critical, so a reader who stops at any point still got the important part first); Kristina Halvorson, *Content Strategy for the Web*.

This is a content decision, made before any layout or styling: if the user could only read one line of this screen/section, which line, and does the current draft put it first? Content strategy answers *which* thing is most important — visual and structural hierarchy exist only to *execute* that decision, not to make it.

### 2. Structure — how does the priority nest?

**Source:** Morville & Rosenfeld's organization schemes (see `information-architecture.md`) — hierarchical structures, parent/child relationships, what's a peer of what.

Once priority is set, the structural question is what contains what: is the most important fact a top-level heading, or is it buried as a child of something less important? A flat list of equally-nested items can't express "this matters more than that" structurally — if the content has a real priority order, the markup/structure should reflect it (heading levels, section nesting), not just visual styling layered on top of a flat structure.

### 3. Visual expression — how is the priority made legible at a glance?

**Sources:**
- Lidwell, Holden & Butler, *Universal Principles of Design* — the named "hierarchy" principle: size, weight, color, and contrast are the tools that signal rank order to the eye without the reader needing to read every word first.
- Robert Bringhurst, *The Elements of Typographic Style* — type-specific hierarchy: a considered scale (not arbitrary size jumps) and weight variation communicate order on their own, before layout or color get involved.
- Also see `visual-design.md` for Gestalt/Refactoring UI — those cover *grouping* (what belongs together) and *de-emphasis* (secondary controls), which is related but distinct from *rank-ordering* (what's more important than what). Hierarchy is the rank-ordering half.

Check: does the visual weight of each element actually match the priority decided in layer 1? A common failure is a visually loud secondary element (e.g., a large decorative icon or a bold optional field) outranking the actual most-important content purely because it's more visually interesting, not because it's more important.

### 4. Placement — where does the eye actually go?

**Sources:** Steve Krug, *Don't Make Me Think*; Nielsen Norman Group's F-pattern/Z-pattern eye-tracking research.

People scan in predictable partial patterns (roughly: top-left first, along the top, down the left edge, with decreasing attention as they go) rather than reading every element in document order. The highest-priority content (per layer 1) should sit where scanning behavior actually lands first — not just be styled boldest wherever it happens to be positioned in the markup.

## Standing check

For any screen/section with more than one piece of content competing for attention: name the single most important thing per layer 1, then verify layers 2–4 all agree with that answer — same thing wins structurally, wins visually, and sits where scanning lands first. If any layer disagrees (e.g., visual weight makes something else louder, or structure nests the important thing under something else), that's the defect to fix, and the fix should bring the disagreeing layer into line with the priority decision, not relitigate what the priority is.

## Cross-references

This file is a required check within all four review lenses, not an optional fifth one:
- `information-architecture.md` — layer 2 (structural nesting) is decided here.
- `content-design.md` — layer 1 (what to say first) is decided here.
- `visual-design.md` — layer 3 (weight/scale/contrast) is executed here.
- `interaction-ux.md` — layer 4 (placement/scanning) interacts with control layout and default focus order here.
