# Curriculum page and two-level nav — tauthinking.com

**Status (2026-10-16):** built locally in `~/Documents/GitHub/tauthinking-site`, **not committed,
not deployed.** Checked by screenshot at 1280px and 390px. Read `tauthinkingsite.md` first for the
site's general rules (separate repo, Cloudflare Pages, copy rules); this file covers only the
curriculum work.

## Source

The design came from a shared Design canvas: https://claude.ai/artifact/74qww5ZTEEkyKEdfNV7SnS
It has two artboards. **V2 · Curriculum hub** (`project/Curriculum-V2.dc.html`) is the one the link
pointed at and the one built from. V1 (`Main.dc.html`) is a single-course landing page; one line
was taken from it (the Sessions lede, "Students start as the expert…"). The canvas is a design
reference only — its hex colours, Helvetica, tabs and sticky bar were not carried over.

## What changed

| File | Change |
|---|---|
| `curriculum.html` | **New.** Served at `/curriculum` (Cloudflare Pages strips `.html`). |
| `index.html` | Header only: new two-row nav. Nothing else on the homepage touched. |
| `site.css` | Nav rules rewritten; `scroll-padding-top` 88 → 128px; a `curriculum page` block appended at the end; one broken comment fixed (see below). `.start-aside` and a short `workshops page` block added 2026-10-16. |
| `workshops.html` | **New 2026-10-16.** Served at `/workshops`. See *Workshops page* below. |

## Three offers, three places (2026-10-16)

The user set out three separate things the site sells:

1. **The curriculum.** A ready-made course that teachers teach to their students: the Crash
   Course, plus the semester/year-long unit (available on request, not in development). Lives on
   `/curriculum`.
2. **The workshop.** Professional development for teachers on AI in the classroom, its effect on
   critical thinking, and where TAU helps. Led by Emilie. Lives on its own page, `/workshops`,
   because a school can buy it without the curriculum, and putting it beside the course would
   give the curriculum page two jobs.
3. **TAU on its own.** A teacher or school using TAU in class with no course attached. Unchanged.

An earlier edit that day renamed the Crash Course to "AI Literacy Workshops". That came from
mixing up offers 1 and 2, and was reverted. The curriculum's old "onboarding workshop" became
**"Setup session"** so it isn't confused with offer 2. Row 1 of the nav on both pages is now The
tool · Curriculum · Workshops.

## Workshops page

Sections: overview (page head + Book a workshop), What teachers learn (four `.card`s, 2×2),
The session (`.workflow`, three steps), Common questions, Booking. **Reframed 2026-10-16** from
how the tool works to what teachers learn, on the user's four themes: question types and levels,
conversation patterns, agency levels, and building critical thinking and voice. The question
levels are the turn plot's four tiers (`TIER` in `session-view.js`), the patterns come from
`pattern-guide.js`, and the agency level names from `LEVEL_DEF`. Same components and rules as the curriculum
page, with no `.band-forest`.

- **Facts come from `workshop.md`** (the in-app workshop links): five minutes on one task with
  no accounts, the phones-in-class task, the turn-by-turn chart, "the AI backed off", the
  facilitator's room view, deletion afterwards. **If the workshop task or flow changes, update
  this page by hand.**
- **Emilie is not named**, per the privacy rule above. The page says "Led by a classroom teacher
  who uses TAU with their own students."
- **Deliberately left off because nobody has said:** length, online or in person, group size,
  price. Booking is a mailto (subject "Teacher workshop"), asking for headcount and timing.
- The "Critical thinking and voice" card's classroom moves and step 3 ("Plan for your students")
  are written from the user's description of the workshop, not from a session plan. Confirm with
  Emilie.

## Open: limiting TAU access in the curriculum

The user is concerned that the curriculum's TAU access shouldn't run forever. Strawman on the
table, **not decided**: a course licence with a seat count, a window (e.g. one term), and only
the course's three assignments. When the window closes, the account goes read-only rather than
being deleted. The deciding question is still open: is the curriculum a taste of TAU or real
ongoing use? None of it is built. The app has no seat caps or licence windows, and only workshop
guest links expire.

Untracked files already in that repo — `index_Update8_18_26.html`, `test/` — are not ours. Leave
them.

## Decisions, and why

**Curriculum is its own page, not a homepage section.** V2 marks it `aria-current="page"`, and it
carries its own questions and calls to action; folded into the one-pager it would give that page
two jobs.

**Two nav levels, two rows.** Row 1 = pages ("The tool", "Curriculum") + Contact us + Log in.
Row 2 = jump links within the current page. V2 mixed a page link into a row of `#` anchors, which
breaks the moment there is a second page (`#report` from `/curriculum` points at nothing) and
violates Morville's consistency-of-kind rule. "The tool" is a judgement call for the homepage's
label, chosen to match the noun form of "The report" — no rule settles it.

**Phone width:** jump-link row hides below 860px (as before); the page links drop to their own
row instead of hiding, since they are the only route to `/curriculum`. The proposal had jump
links scrolling sideways on phones — dropped, because three header rows was too tall. Both widths
come to two rows, so one `scroll-padding-top` (128px) holds everywhere.

**Tabs flattened into sections.** V2 hid Sessions and What's included behind tabs — the content a
buyer is actually evaluating (the skill's required-vs-hidden check). Sections also make browser
find and deep links work. The jump-link row replaces the tab row.

**Design-system alignment.** Only existing tokens and components: `.card`, `.card-quiet`,
`.chip-grey`, `.workflow`, `.defs`/`.def`, `.qa`, `.mbtn`. The new CSS lays them out and sets no
fill, border, radius or shadow of its own. Grounds alternate plain/tint like the homepage. **No
`.band-forest`** — that is capped at the homepage's two bookends.

- Both course cards are elevated white `.card`s. Replaces V2's dashed borders, which nothing
  else on the site uses. The "Suggest a course" card (chip "Your input") was removed 2026-10-16
  at the user's request.
- The semester/year-long unit is **not in development** — it is available on request (chip "On
  request", "Contact us" button), so it is no longer a `.card-quiet`.
- **Agency levels: strongest first, no bars, no colour.** V2 ordered them weakest → strongest
  with widening bars, which reads as a mark out of four — the same reason the site README forbids
  the rail in the report hero. Definitions are the app's `LEVEL_DEF`
  (`app/web/report-render.js`) verbatim, so students meet one wording. **If `LEVEL_DEF` changes,
  update this page by hand.**
- Dimension names and questions match the homepage's dimension cards.

**Removed from V2:** the sticky bottom CTA bar (duplicated Ways to start and the nav's Contact us);
the "Notify me" email form (static site, nowhere to post) — now a mailto; the "Who made this
course?" question.

**Partner names removed for privacy (2026-10-16).** No individual or partner organisation is
named anywhere on the page. The intro says "Written by classroom teachers." Do not reintroduce
names without the user's say-so.

**All actions are mailto links** to `hello@tauthinking.com`, distinguished by subject: AI literacy
unit · Demo call · Pilot pricing · Setup session (was Onboarding workshop). The user
accepted mailto "for now" — a booking link or form service is the likely replacement.

## Pre-existing bugs found

- **Fixed:** a comment above `.defs` in `site.css` read `/* NOT .dim*/.*/ …`. The `*/` inside it
  closed the comment early, and the leftover text swallowed the `.defs` rule, so the grid never
  applied. The homepage doesn't use `.defs`, so it was invisible until this page did.
- **Not fixed:** on the homepage at 390px a chart SVG in the patterns section overflows by 51px.
  Not caused by the nav.

## Open

- Commit and deploy (pushing `main` on `tauthinking-site` deploys via Cloudflare Pages).
- Replace mailto links with real destinations when they exist (booking link, form).
- Course copy has had no `content-writing` pass — it is V2's wording, lightly edited.
- No pricing appears on the page; price is still unset (see `tauthinkingsite.md` §10).
- Consider adding `curriculum.html` and `workshops.html` to the site README's file table.

## Running it

```bash
cd ~/Documents/GitHub/tauthinking-site
npx serve@14.2.4 -l 5055 .   # clean URLs, so /curriculum resolves like Pages
```
