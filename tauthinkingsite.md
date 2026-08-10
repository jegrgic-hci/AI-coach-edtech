# tauthinking.com — the public marketing site

**Status (2026-08-06):** planned, not built. No repo, no content, no Pages project.

**Not part of this codebase.** Own GitHub repo, own host. This file holds the
decisions so they aren't re-derived later; nothing here is built from `app/`.

---

## 1. The two-domain split

| Hostname | What | Hosted on | Repo |
|---|---|---|---|
| `tauthinking.com`, `www` | Marketing | Cloudflare Pages | `tauthinking-site` (to create) |
| `app.tauthinking.com` | The tool | Cloud Run (`cta`, us-central1) | this repo |

`app.tauthinking.com` mapped 2026-08-06 (CNAME → `ghs.googlehosted.com`). The
`cta-714032495709.us-central1.run.app` URL still reaches the same service.

**Why split rather than one site with an `/app` path:** marketing copy changes
constantly and the tool deploys through a build pipeline; marketing will
accumulate analytics and widgets that must never share an origin with student
essays; the session cookie is host-only on `app.` and a separate marketing
origin cannot see it; path routing would need a load balancer (~$18/month).

**Why a separate repo:** the `deploy-main` trigger watches `main` with no file
filter, so a marketing typo fix would redeploy student software. A separate repo
also lets someone else edit marketing without access to the code that processes
student work.

### Cloudflare proxy — the rule differs per hostname

- **Marketing: orange cloud (Proxied) is fine and wanted.** Public pages, no
  student data, free CDN.
- **`app.`: grey cloud (DNS only), always.** Proxying breaks Google's
  certificate validation *silently*, and it terminates TLS at Cloudflare —
  making them a subprocessor handling student data, which then has to be named
  in every school DPA.

### Setup, when it's built

1. Create GitHub repo `tauthinking-site`, add `index.html`, push.
2. Cloudflare → **Workers & Pages** → **Create** → **Pages** → **Connect to
   Git** → select the repo.
3. Build settings: **none**. Preset "None", empty build command, output `/`.
4. Deploy → a `*.pages.dev` URL works immediately.
5. **Custom domains** → add `tauthinking.com` and `www`. Cloudflare writes its
   own DNS records.

---

## 2. Positioning

Taken from `built-in-chat-plan.md`, not invented here. Both lines are settled
decisions in that document:

> **AI literacy as curriculum, in the lineage of library-skills and computer
> literacy — not integrity policing.**

> **A school-controlled AI chat that looks and feels like ChatGPT — which then
> makes visible how students used it.**

**What Tau is:** the generative AI chat students use to do their work
(research, essays), instrumented so teachers can see how it was used.

**What the coaching level is:** a dial the teacher sets per draft, not the
product's identity. Describe it as a control, never as a philosophy the teacher
must adopt.

**What Tau is not:** a cheating detector, and not a grader. Per the plan's scope
boundary — the teacher assesses the product against their own rubric, untouched;
the tool assesses the process.

**Who buys, who uses:** teachers and admins buy, students use. The page is
written to the teacher.

### The tagline is locked

> **Develop your thinking. — AI should redefine how you think, not substitute
> it.**

"Redefine" and "substitute" are the top and bottom SAMR rungs — the framework
the tool measures, compressed. **Don't reword casually.** SAMR itself stays
unnamed on the page (Hard Constraint: SAMR is a subtitle, never the primary
label); teachers who know it will recognise the words.

---

## 3. Keep it general

The public site is **not** a security whitepaper, an architecture doc, or a
feature list. Depth lives in `built-in-chat-plan.md` and comes out in a sales
conversation, when someone has asked for it.

Detail on a public page adds claims to get wrong and dates faster than anything
else on the site. The page's only job is to make a teacher or head of department
want a conversation.

---

## 4. Page structure

Six sections. Labels name the object rather than posing a question or describing
a system behaviour (Morville's labeling rule), and are consistent in
grammatical form — all nouns.

| # | Label | Contains |
|---|---|---|
| 1 | *(hero)* | Tagline + the claim |
| 2 | **Substitution** | The problem, in the teacher's terms |
| 3 | **The chat** | What students use — screenshot |
| 4 | **The assignment** | What the teacher sets, including the coaching dial |
| 5 | **The report** | What comes back — screenshots |
| 6 | **Class patterns** | The aggregate view and what changes because of it |
| 7 | **Privacy** | Short. See §5 |
| 8 | **Common questions** | Four or five, short answers |
| 9 | **Request a pilot** | One CTA |

**Hero:**

> # Develop your thinking.
> ## AI should redefine how you think, not substitute it.
>
> Students already use AI invisibly, on personal accounts. Tau gives them a
> school-controlled AI chat — and shows you how they used it.
>
> [Request a pilot] [See a sample report]

"See a sample report" is the highest-value link on the page. A real report
persuades faster than any copy, and the seed data already produces one.

**Substitution** — the pain is invisibility, not dishonesty:

> You read a finished essay. You can't see the twenty minutes that produced it —
> whether the student argued with the AI or accepted the first thing it said.
> The work looks the same either way.

**The assignment** — the coaching dial, described as a control:

> Set how much help the AI gives, per draft. Full support on draft one,
> questions only on draft two, a sounding board on draft three — or the same
> level throughout.

**Class patterns** — end on the teaching action, which is the section that sells
to a head of department:

> Half the class accepted the AI's framing without challenge on draft one.
> That's not twelve conversations — it's one lesson, on Tuesday.

### Copy rules that bind this page

Wherever marketing names a product concept, `designsystem.md`'s Hard Constraints
apply — otherwise the site teaches a vocabulary the product contradicts:

- Scores are **1–5 per dimension, 4–20 total. Never a percentage.**
- Dimension names are fixed: **Prompting Quality, Selective Use, Calibrated
  Skepticism, Original Contribution.** No marketing synonyms.
- **Voice is coach, not judge** — no "AI-generated content detected", no "risk"
  vocabulary, no verdicts. This one is easy to break, because the obvious way to
  sell this tool is as a cheating detector.
- **No sparklines or trend lines as decoration.**
- Light theme default, `data-theme="light"` in the markup.

---

## 5. Privacy — short, and never overclaimed

Four or five sentences on the page. Enough to pass a first scan; the rest comes
out when asked.

> Student work is processed by Google's Vertex AI and stored in Google Cloud, in
> US data centres. Google does not use student work to train models. We sign a
> data processing agreement with your district before any student data is
> entered.

### Never write "FERPA compliant"

Compliance is a property of a signed agreement and actual practice, not of
software. A district that discovers the claim ran ahead of the paperwork has a
real grievance, and edtech is a small world. Precision reads better than
adjectives to the people who actually evaluate this.

### Claims discipline — check before publishing

| Claim | True today (2026-08-06) |
|---|---|
| Runs on Google Vertex AI + Firestore, US region | ✅ |
| Google does not train on student work | ✅ |
| Least-privilege service accounts, deny-all Firestore rules | ✅ |
| Integrity flags teacher-only, enforced server-side | ✅ |
| Signed DPA covering FERPA | ❌ not yet |
| Students sign in with school Google accounts | ❌ SSO unbuilt (Phase A) |
| Each school in its own isolated database | ❌ Phase G unstarted |

The last two appear in the plan's stakeholder summary, which was written for a
pilot conversation where "here's the design" is understood. **On a public page
the same sentences become claims** — cut them or write them in future tense
until those phases land.

---

## 6. Common questions

Four or five, short. The first one reframes the whole conversation and should
lead:

**Is this an AI detector?**
> No. Tau doesn't judge whether AI was used — it assumes it was, and shows how.

**Does the AI train on our students' work?**
> No. Tau runs on Google Vertex AI, which doesn't use customer data to train
> models.

**Who can see a student's integrity signals?**
> Only teachers, and schools can switch them off entirely. They never appear in
> a student's own view.

**Does this replace my grading?**
> No. Tau never sees your rubric and never grades an essay. It reports on
> process; the mark stays yours.

**What does it cost?**
> Cost model says under $50 per classroom per semester. **Price is not set** —
> decide before this question goes on the page.

---

## 7. Screenshots

Five, taken by hand from **localhost with seeded demo data** — not the public
demo, whose state drifts. Don't build a Playwright pipeline for five images;
automate only if the design system starts forcing regular reshoots.

1. The chat mid-conversation — the product itself
2. Report: score summary — the differentiator
3. Report: idea origins / essay heatmap — the most visually distinctive thing
4. Teacher dashboard — for the buyer, who isn't the student
5. Assignment creation — proves it's a real product

Crop tight to one idea per image; full-page screenshots read as noise at
landing-page scale. **Demo data only, ever** — no real student name or essay
reaches a marketing page, including after a pilot starts.

---

## 8. Reusing the design system

**Copy `tokens.css`. Don't copy `components.css`.**

Tokens (brand colour, ground, type scale, spacing) are what make the page look
like the product. `components.css` is 40KB of score chips, transcript turns and
meters — a landing page needs a hero, a feature grid and a nav, none of which
are in there. Copying it yields unused CSS and a false sense the two are synced.

Also worth taking: `theme.js` (light/dark toggle, standalone), `icons.js`, and
`designsystem.md` as the voice reference.

Keep it in sync with one line, run when the design system changes:

```bash
cp ../AI-coach-edtech/app/web/tokens.css ./tokens.css
```

Submodules, npm packages and sync Actions all cost more than the drift they
prevent at one person and one design system. Note the source in a comment at the
top of the copy. `tokens.css` §4 is legacy aliases — harmless to carry unused,
but don't write new marketing CSS against those names.

---

## 9. Integration with the app — two links

- Marketing → app: a **Log in** button, top-right of the nav, to
  `https://app.tauthinking.com`
- App → marketing: the wordmark links back to `https://tauthinking.com`

That is the whole coupling. No shared code, no shared build, no shared auth.

Nobody discovers the tool by browsing to it, and that's deliberate — there is no
self-serve signup. Access is a chain: admin creates a teacher, the teacher
creates a class and adds students. Marketing's job is to start a conversation
with a school, not to get a user into the product.

---

## 10. Open

- **Price.** Cost is known (<$50/classroom/semester); price is not set.
- **Content.** Nothing written.
- **Cloudflare Pages vs a visual builder.** Pages is free and git-based and
  assumes you write the HTML. Framer/Webflow (~$15–20/month with a custom
  domain) let the pitch be redesigned without code, which matters while you're
  still learning what lands with schools. Pages is the current decision; revisit
  if editing friction is what stops the page improving.
- **Analytics.** Whatever gets added goes on marketing only, never on `app.`
