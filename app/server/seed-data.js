// Demo content for the dev seed. Transcripts are hand-labeled with the same
// label vocabulary the classifier produces, so seed.js can run them through the
// real enrich()/scoreTAU() instead of hardcoding score vectors.
//
// Three tiers, each with three drafts, so the demo shows different shapes of
// AI use rather than one shape at three volumes:
//   strong  — challenges and rejects the coach; ideas stay the student's
//   flat    — asks the coach for answers and accepts them; little movement
//   flagged — high scores on the surface, provenance says otherwise

// tier drives every general-purpose assignment (the closed multi-draft one
// and each class's open one) via TRANSCRIPTS/ESSAYS/PROVENANCE/SNAPSHOTS
// below. It's independent of the bike-guide assignment, which is the same
// fixed real transcript for every student regardless of tier.
const STUDENTS = [
  { email: 'maya@school.dev', displayName: 'Maya Rodriguez', tier: 'strong' },
  { email: 'devon@school.dev', displayName: 'Devon Clarke', tier: 'flat' },
  { email: 'priya@school.dev', displayName: 'Priya Nair', tier: 'flagged' },
  { email: 'luis@school.dev', displayName: 'Luis Ferreira', tier: 'strong' },
  { email: 'sam@school.dev', displayName: 'Sam Whitfield', tier: 'flat' },
  { email: 'jamie@school.dev', displayName: 'Jamie Okafor', tier: 'strong' },
  { email: 'elena@school.dev', displayName: 'Elena Vasquez', tier: 'flat' },
  { email: 'marcus@school.dev', displayName: 'Marcus Webb', tier: 'flagged' },
];

// Classes aren't assignment-scoped by accident — a teacher can teach the same
// course to more than one section, and a student can be in more than one of a
// teacher's classes at once (e.g. a core class plus an elective). The pilot
// cohort above is the main class; the elective reuses two of the same
// students so the dashboard's multi-class Student view has a real case to
// show, not a hypothetical one. The third class exists so the open-assignment
// demo can show three classes at three different draft stages side by side
// (see OPEN_ASSIGNMENT_STATE below) — that needs at least three separate
// rosters, not just a third assignment on an existing one.
const CLASSES = [
  { name: 'English 10', studentEmails: ['maya@school.dev', 'devon@school.dev', 'priya@school.dev', 'luis@school.dev', 'sam@school.dev'] },
  { name: 'Journalism Elective', studentEmails: ['maya@school.dev', 'devon@school.dev'] },
  { name: 'American Literature', studentEmails: ['jamie@school.dev', 'elena@school.dev', 'marcus@school.dev'] },
];

const ELECTIVE_ASSIGNMENT = {
  title: 'Op-Ed Draft',
  description: 'Write an op-ed taking a clear position on a current school or community issue, written for publication in the school paper.',
  purpose: 'Practice persuasive writing for a real audience — a school paper reader who can just as easily stop reading as agree with you.',
  requirements: '500–700 words. Take a clear position. Anticipate and address the strongest objection to your position.',
  draftBudget: 1,
  draftDueInDays: [-3],
};

// A third closed, single-draft assignment for English 10 and American
// Literature — same minimal shape as ELECTIVE_ASSIGNMENT above (one class,
// one student, one cycle), added so both classes clear the class-tier
// dimension arc's own 3-closed-assignment floor (teacher-dashboard-design.md,
// "Class overview card rebuilt into three tabs, plus a full-term arc") the
// same way Journalism Elective already does via ELECTIVE_ASSIGNMENT. Without
// this, those two classes only ever have two closed assignments and never
// exercise the chart.
const ENGLISH_EXTRA_ASSIGNMENT = {
  title: 'Poetry explication: sound and meaning',
  description: 'Explicate a short poem, connecting a specific sound or structural choice to its effect on meaning.',
  purpose: 'Practice close reading — building an argument from textual evidence rather than paraphrase.',
  requirements: '400–600 words. Quote directly from the poem at least three times. Connect at least one formal choice (meter, rhyme, line break) to meaning.',
  draftBudget: 1,
  draftDueInDays: [-7],
};

const LIT_EXTRA_ASSIGNMENT = {
  title: 'Historical context essay',
  description: 'Explain how a specific historical event or movement shaped the themes of a novel studied this term.',
  purpose: 'Practice connecting a literary text to its historical moment rather than reading it in isolation.',
  requirements: '500–700 words. Name the specific historical event or movement. Tie at least two textual details to it directly.',
  draftBudget: 1,
  draftDueInDays: [-7],
};

// A real Claude.ai transcript (document co-creation, not the Socratic-coach
// shape the other tiers assume) — kept separate from STUDENTS/TRANSCRIPTS'
// tier loop. Seeded once as a single cycle, then cloned onto every student in
// every class, so this closed assignment reads as fully scored everywhere
// instead of leaving most roster rows blank.
const GUIDE_ASSIGNMENT = {
  title: 'Bicycle maintenance guide',
  description: 'Write a conversational guide to road bike maintenance covering every system.',
  purpose: 'Translate technical knowledge into a form someone else could actually follow and present.',
  requirements: '1000 words. Usable as an oral presentation. Include references.',
  draftBudget: 1,
  // Signed day offsets from "now" (negative = past, positive = future) — one
  // entry per draft, ascending, last one is the assignment's own final due date.
  draftDueInDays: [-1],
};

// Three separate open-assignment specs, one per class, each staged at a
// different point in its draft cycle — the demo's whole point is to show a
// teacher what "early in an assignment," "midway," and "wrapping up" each
// look like on the dashboard, side by side. See OPEN_ASSIGNMENT_STATE for the
// per-student draft counts that realize each stage.
const OPEN_ASSIGNMENTS = {
  // English 10: on draft 1.
  class1: {
    title: 'Persuasive essay: school start times',
    description: 'Write a persuasive essay arguing whether your school should move to a later start time.',
    purpose: 'Build the skill of taking a position and defending it with evidence rather than just asserting it.',
    requirements: '600–900 words. Take a clear position. Support it with at least three distinct reasons. Address one counterargument. Cite evidence for your claims.',
    draftBudget: 3,
    // Draft 1 due yesterday — the class is squarely inside draft 1 right now.
    draftDueInDays: [-1, 6, 13],
    // Days-ago each already-submitted draft went in, paired with draftDueInDays
    // above so submissions land before their due date rather than at an
    // arbitrary offset.
    draftSubmittedDaysAgo: [2],
    // Assignment-wide, not about any one draft — demonstrates the rubric-
    // style disclosure on the assignment card, distinct from a per-draft note.
    teacherNote: "A reminder for the whole class on this one: your counterargument has to be a real position someone could hold, not a strawman you set up to knock down. I'll be checking for that specifically.",
  },
  // Journalism Elective: on draft 2.
  class2: {
    title: 'Feature article: an issue affecting your school',
    description: 'Report and write a feature article on an issue affecting students at your school, for publication in the school paper.',
    purpose: 'Practice grounding an argument in reporting — sourced claims a reader can check, not just an asserted position.',
    requirements: '500–800 words. Attribute every factual claim to a source. Include at least one direct quote.',
    draftBudget: 3,
    // Draft 1 well past, draft 2 due yesterday — the class is squarely inside draft 2.
    draftDueInDays: [-10, -1, 6],
    draftSubmittedDaysAgo: [9, 2],
  },
  // American Literature: on the final draft.
  class3: {
    title: 'Personal essay: a moment that changed your thinking',
    description: 'Write a personal essay about a specific moment that changed how you thought about something.',
    purpose: 'Practice showing a change in thinking through a concrete scene rather than asserting that it happened.',
    requirements: '600–900 words. Ground the change in one specific, concrete moment. Show what you thought before and after.',
    draftBudget: 3,
    // Drafts 1 and 2 well past, draft 3 due in 2 days — the class is on the
    // final draft, and it has to still be due in the future or the
    // assignment reads as closed (status is derived from dueDate vs. now).
    draftDueInDays: [-20, -10, 2],
    draftSubmittedDaysAgo: [19, 9, 2],
  },
};

// Per-student state on each class's open assignment — deliberate variety
// (submitted-and-scored, in-progress, pending analysis, errored, not
// started) rather than one shape repeated, so the demo shows a teacher the
// full range of states a draft-row can be in, not just "done" everywhere.
const OPEN_ASSIGNMENT_STATE = {
  class1: [
    { email: 'maya@school.dev', drafts: 1 },
    { email: 'devon@school.dev', drafts: 0, active: 0 },
    { email: 'priya@school.dev', drafts: 0, incomplete: { cycleIndex: 0, status: 'pending' } },
    { email: 'luis@school.dev', drafts: 0, incomplete: { cycleIndex: 0, status: 'error', error: 'Groq 500: internal_server_error' } },
    { email: 'sam@school.dev', drafts: 0 },
  ],
  class2: [
    { email: 'maya@school.dev', drafts: 2 },
    { email: 'devon@school.dev', drafts: 1, active: 1 },
  ],
  class3: [
    { email: 'jamie@school.dev', drafts: 3 },
    { email: 'elena@school.dev', drafts: 2, active: 2 },
    { email: 'marcus@school.dev', drafts: 3 },
  ],
};

const ASSIGNMENTS = {
  past: {
    title: 'Rhetorical analysis: a speech that changed something',
    description: 'Choose a speech that produced a measurable change and analyse how it worked rhetorically.',
    purpose: 'Practice close reading — arguing from the actual language of a text rather than a general impression of it.',
    requirements: '700–1000 words. Identify the audience and the rhetorical strategies used. Argue which strategy did the most work. Ground every claim in specific language from the speech.',
    draftBudget: 3,
    draftDueInDays: [-32, -24, -15],
  },
};

// t(role, text, label) — student labels are authored; coach labels were
// generated on 2026-08-18 by running the shipped CLASSIFY_PROMPT over these
// transcripts once, offline, and committing what came back. They are literals
// so the seed stays LLM-free at run time, which is the property it exists for.
const t = (role, text, label = null) => ({ role, text, label });

const TRANSCRIPTS = {
  strong: [
    {
      title: 'Picking a speech',
      turns: [
        t('student', "I want to analyse the Chimamanda Adichie 'Danger of a Single Story' talk. I think the thing that makes it work is that she keeps making herself the person who was wrong, not the audience.", 'claim'),
        t('coach', "That's a specific and promising angle. What does positioning herself as the one who was wrong let her do that a more direct critique wouldn't?", 'argument'),
        t('student', 'What are the standard rhetorical strategies people usually name in an analysis like this?', 'extraction'),
        t('coach', "I'd rather start from what you noticed. You already have an observation about who she blames — what does that do to a listener?", 'argument'),
        t('student', "It means the audience never has to defend themselves, so they can actually hear it. But I'm not sure that's rhetoric or just niceness — how would I show it's a strategy?", 'conceptual'),
        t('coach', 'You could look at where in the talk she does it. If it clusters right before her hardest claims, that pattern is evidence of design rather than temperament.', 'instruction'),
        t('student', 'So the placement is the evidence — is that the kind of thing that counts as analysis?', 'validation'),
        t('coach', 'It is, if you show the pattern rather than assert it. What does the talk actually do?', 'instruction'),
        t('student', 'Where should I look for the pattern first?', 'extraction'),
        t('coach', 'Start with the passages you found hardest to hear as a listener.', 'instruction'),
        t('student', 'Checked it — she does it before the Mexico section and before the publisher section, both of which are her sharpest points. So the confession is load-bearing, not decorative.', 'claim'),
        t('coach', 'That gives you an argument. How will you handle a reader who says any speaker telling personal stories does this?', 'argument'),
        t('student', "I'd say the difference is that her stories always cost her something. I'll build the counterargument section around that distinction.", 'refinement'),
      ],
    },
    {
      title: 'Testing the counterargument',
      turns: [
        t('student', "My draft feedback said my counterargument was weak. I think the objection is that self-deprecation is just a common TED move and not specific to her.", 'claim'),
        t('coach', 'What would you need to find in the talk to make that objection collapse?', 'instruction'),
        t('student', "So I'd need a moment where the self-criticism does work that a generic TED move couldn't. I think the Mexico story is it — she indicts herself for exactly the thing she's asking the audience to stop doing.", 'claim'),
        t('coach', 'And if a reader said that is still just a vivid anecdote?', 'argument'),
        t('student', "I disagree that it's just an anecdote. An anecdote illustrates a point that's already made; hers makes the point. Nothing before it establishes that she's capable of the same bias.", 'rejection'),
        t('coach', 'Then that distinction is worth stating explicitly in the essay rather than leaving implicit.', 'instruction'),
        t('student', "Agreed. I'll move it up so it's the hinge of the section rather than the last line.", 'refinement'),
      ],
    },
    {
      title: 'Final structure pass',
      turns: [
        t('student', "Last draft. I restructured so the Mexico story comes before the strategy claim rather than after. Reading it back I think it now argues rather than describes.", 'claim'),
        t('coach', 'What changed in how the reader experiences the claim?', 'instruction'),
        t('student', 'So the reader feels the move working before I name it, and naming it lands as recognition instead of assertion.', 'claim'),
        t('coach', 'Is there anywhere left where you name a strategy before showing it?', 'instruction'),
        t('student', "But I'm going to leave the ethos paragraph as it is — that one is genuinely a summary paragraph and it needs to signpost. Not every paragraph should do the same thing.", 'rejection'),
        t('coach', "Reasonable. What's your own read on the weakest part now?", 'argument'),
        t('student', 'The conclusion still restates rather than extends. I want it to say something about what this costs a speaker, which the essay has evidence for but never says.', 'refinement'),
        t('coach', 'What evidence in the essay points at that cost?', 'instruction'),
        t('student', "Every admission she makes is one she can't take back — but how would I know that's a cost to her rather than something I'm projecting onto the talk?", 'challenge'),
        t('coach', 'That is the right thing to be uncertain about. What would settle it?', 'argument'),
        t('student', "So nothing would settle it from the text alone. I'll frame it as a reading rather than a finding — overclaiming would be the same mistake I'm accusing other readings of.", 'rejection'),
      ],
    },
  ],

  flat: [
    {
      title: 'Speech ideas',
      turns: [
        t('student', 'What speech should I do for this assignment?', 'extraction'),
        t('coach', "I'd rather not pick for you — what speeches have you actually heard or read that stuck with you?", 'instruction'),
        t('student', "I don't really know any. Can you list some famous ones?", 'extraction'),
        t('coach', 'What subjects do you find yourself arguing about outside school? That is usually a better route in.', 'instruction'),
        t('student', "I guess sports. Is that ok to write about?", 'validation'),
        t('coach', 'It can absolutely work. What would you want to find out about a sports speech?', 'argument'),
        t('student', "Not sure. I'll just do a famous one I guess.", 'stuck'),
      ],
    },
    {
      title: 'Draft 2 questions',
      turns: [
        t('student', 'I picked the Kennedy moon speech. What are the rhetorical strategies in it?', 'extraction'),
        t('coach', 'What do you notice yourself when you read the opening two paragraphs?', 'instruction'),
        t('student', 'He talks about history a lot. Is that ethos?', 'validation'),
        t('coach', 'What makes you say ethos rather than something else?', 'argument'),
        t('student', "Because it's about credibility? I think that's right.", 'validation'),
        t('coach', 'Try testing it: what would the passage be doing if it were not about his credibility?', 'instruction'),
        t('student', "I'm not sure. Can you just explain the difference between ethos and pathos?", 'extraction'),
      ],
    },
    {
      title: 'Finishing up',
      turns: [
        t('student', 'I need one more paragraph. What else can I say about the moon speech?', 'extraction'),
        t('coach', 'What has your essay argued so far, in one sentence?', 'instruction'),
        t('student', 'That he used ethos and pathos to get support for the space program.', 'narrative'),
        t('coach', 'Which of those two does more work in the speech, and how would you know?', 'argument'),
        t('student', "Probably pathos because it's emotional. That seems right.", 'validation'),
        t('coach', 'What in the text would a reader point to if they disagreed with you?', 'argument'),
        t('student', "I actually think the 'we choose to go to the moon' part is doing something different — it makes difficulty the reason rather than the obstacle. I could build the paragraph on that.", 'claim'),
      ],
    },
  ],

  flagged: [
    {
      title: 'Analysis planning',
      turns: [
        t('student', "I'm analysing the Greta Thunberg UN speech. What makes it rhetorically effective?", 'extraction'),
        t('coach', 'What is your own read on why it landed the way it did?', 'instruction'),
        t('student', "The core move is that she refuses the register the occasion expects — the setting demands diplomatic gratitude and she delivers accusation, and that violation is itself the argument.", 'claim'),
        t('coach', 'That is a sophisticated framing. Where in the speech is the violation sharpest?', 'instruction'),
        t('student', "The 'how dare you' repetition functions as anaphora inverted: instead of building aspiration it accumulates indictment, so the form of hope carries the content of blame.", 'claim'),
        t('coach', 'How would you show that to a reader who hears it as simply angry?', 'instruction'),
        t('student', "By contrast with the surrounding syntax, which is procedural and data-laden. The register collision is measurable at sentence level.", 'claim'),
      ],
    },
    {
      title: 'Second draft',
      turns: [
        t('student', 'Does my argument about register collision hold up across the whole speech?', 'validation'),
        t('coach', 'Test it — where does the speech not do that?', 'instruction'),
        t('student', "The emissions-budget passage sustains the procedural register without collision, which arguably strengthens the reading: the collision is reserved for moments of direct address, making it a deliberate instrument rather than a temperament.", 'claim'),
        t('coach', 'That is a good save. What would falsify the reading entirely?', 'argument'),
        t('student', "If the accusatory register appeared in passages with no direct address to the assembly. It does not, on my reading.", 'claim'),
        t('coach', 'Then state that test in the essay — showing what would disprove you makes the claim stronger.', 'instruction'),
        t('student', 'I have added it to the methodology paragraph.', 'refinement'),
      ],
    },
    {
      title: 'Polish',
      turns: [
        t('student', 'Final pass. Is the through-line clear from introduction to conclusion?', 'validation'),
        t('coach', 'Read me your thesis and your last sentence as a pair — do they meet?', 'instruction'),
        t('student', "They do now. The thesis claims register violation is the primary instrument; the conclusion argues that this is why the speech could not be answered on its own terms without conceding its premise.", 'claim'),
        t('coach', 'What is the weakest link between them?', 'instruction'),
        t('student', "The third body paragraph, which describes rather than argues. I have rewritten it to foreground the analytic claim.", 'refinement'),
        t('coach', 'Good. Anything you are still uncertain about?', 'instruction'),
        t('student', 'No, I think it is complete.', 'narrative'),
      ],
    },
  ],

  // Real transcript: a student and Claude.ai co-writing a bike maintenance
  // guide (document generation + iterative editing), not a coach withholding
  // answers. Kept as its own tier so it doesn't distort the other arcs' shape.
  // AI turns are paraphrased for length; student turns are verbatim or
  // near-verbatim from the source PDF.
  bikeguide: [
    {
      title: 'Bicycle maintenance guide',
      turns: [
        t('student', "I need to write a 1000 word essay in the format I want about bicycle maintenance, covering every system. Act as a cycling coach and help me create something usable for female riders who rely on partners to know how to care for their bikes. I need to be able to explain this in an oral presentation and include references. Let's break it down by system.", 'narrative'),
        t('coach', "Let me ask a few quick questions so I can tailor this: what format do you want, what's your current experience level, and what type of bike do you ride?", 'instruction'),
        t('student', "Conversational guide with sections. I know the theory of changing a tire, I've cleaned and lubed my chain, I have tubeless tires and recently added more sealant. That's the extent of my knowledge. Road bike.", 'narrative'),
        t('coach', "Great, I have everything I need. Here's your guide covering all five systems: Drivetrain, Brakes, Wheels & Tyres, Cockpit, and Frame & Bearings, with four references including a British Cycling women's bike fit guide.", 'content'),
        t('student', "British Cycling (2022). Women's bike fit guide. This doesn't exist.", 'rejection'),
        t('coach', "You're right, I fabricated that reference. I apologize. Let me find a real, verifiable source instead — replaced with Kotler et al. (2023), a real peer-reviewed paper on female cyclists and bike fit.", 'content'),
        t('student', "Zinn, L. (2016). Zinn & the art of road bike maintenance. This seems like a good book but I don't have it so it's hard to check the sources.", 'challenge'),
        t('coach', "Let me verify it. The 5th edition is real, ISBN confirmed. There's also a newer 6th edition from 2024 — would you like to keep the 5th or upgrade the citation to the 6th?", 'instruction'),
        t('student', 'Remove the citation because specific pages should be referenced.', 'rejection'),
        t('coach', "Good call — citing a book without a page number isn't proper practice. Removed. You now have three solid, verifiable references remaining.", 'content'),
        t('student', "Change the introduction to the following after checking the spelling and remove m-dashes throughout: \"Let's be honest: a lot of us learned to love cycling through someone else's passion...\"", 'refinement'),
        t('coach', 'Spelling is clean throughout. Intro replaced, and I\'ll remove all m-dashes across the whole document with appropriate substitutions.', 'content'),
        t('student', 'Let\'s edit each section one at a time before editing the artifact. In System 1: remove "you\'re already doing this. Well done." How should I clean and lube the chain? How do I check the chain for wear? Should I be cleaning the cassette and the derailleurs?', 'extraction'),
        t('coach', "Here's what I'd add to each point: degreaser and a chain cleaning device for the chain, a chain checker tool for wear (0.5–0.75 mark), and a stiff brush or rag for the cassette and jockey wheels.", 'content'),
        t('student', 'For each section lets create a tool list. Do I need to have different types of lube for different weather? Lets add a time recommendation for each aspect of maintenance like we have for clean and lube your chain.', 'extraction'),
        t('coach', "Here's the tool list, a dry/wet/wax lube guide matched to conditions, and a maintenance table with frequency and time for all four tasks.", 'content'),
        t('student', 'What about the chainrings and the crank? What is the crank?', 'conceptual'),
        t('coach', "The crank connects your pedals to the chainrings. Cleaning is simple — a stiff brush on the teeth. Worn chainring teeth look 'shark-finned,' a sign they need replacing.", 'definition'),
        t('student', 'Can you add an image of the drive chain with all the parts labeled?', 'extraction'),
        t('coach', "Here's a labeled drivetrain diagram: chain, cassette, derailleurs, crank arm, pedal, chainrings, all marked.", 'content'),
        t('student', 'That looks good, lets add it to the doc along with the additional information. Let\'s sort the maintenance in a table.', 'refinement'),
        t('coach', 'System 1 is fully updated with the crankset explanation, diagram placeholder, tool list, lube guide, and maintenance table.', 'content'),
        t('student', 'System 2 - how do I know if I have a hydraulic system? Do all disc brakes have them?', 'conceptual'),
        t('coach', "No — disc brakes can be mechanical (cable) or hydraulic (fluid-filled hose). Check your lever body, the line to the caliper, and your groupset name to tell which you have.", 'definition'),
        t('student', 'I have shimano tiagra group set, I have cables coming out of the handle bars and they into the body of the bike', 'narrative'),
        t('coach', "That points to mechanical rim brakes on the Tiagra 4700 groupset. Can you confirm by looking at the wheel — U-shaped caliper on the rim, or a rotor?", 'argument'),
        t('student', 'No i have disk breaks... i must have used the wrong language to describe the black wires maybe. they are not metal.', 'rejection'),
        t('coach', "That clears it up — those are hydraulic hoses, not cables. You have Shimano Tiagra ST-4720 hydraulic disc brakes. Here's what that means for maintenance: pad thickness, rotor condition, and contamination are your main checks.", 'content'),
        t('student', 'How can i tell brake pad thickeness? How do I clean them after a muddy ride?', 'extraction'),
        t('coach', "Look through the caliper gap for the friction material — replace under 1.5mm. After a muddy ride, rinse gently then wipe the rotor with isopropyl alcohol only, never degreaser.", 'instruction'),
        t('student', 'How would I know when to top off the mineral oil?', 'extraction'),
        t('coach', "You shouldn't need to — a sealed system only drops from pad wear or a leak. Watch lever feel, not fluid level; a spongy lever means book a service.", 'definition'),
        t('student', 'how often do break pads need to be changed and can I do that myself?', 'extraction'),
        t('coach', "Roughly 500–2,000km depending on conditions, and yes — Shimano hydraulic pad changes don't touch the fluid system, so it's a beginner-friendly home job. Here's the step-by-step.", 'content'),
        t('student', 'My breaks were a little squeaky, like a small fog horn but inconsistently. Do i need to change my pads or just clean them?', 'extraction'),
        t('coach', "That inconsistent squeal is almost always contamination, not wear — likely chain lube drifting onto the rotor. Clean with IPA and bed in first; only replace pads if it persists after that.", 'argument'),
        t('student', 'yes', 'validation'),
        t('coach', 'System 2 is updated with the tool list, maintenance table, pad-thickness and cleaning how-tos, the mineral oil note, and the fog-horn-squeal troubleshooting section.', 'content'),
        t('student', 'In System 3, remove m-dashes and remove specific examples and feedback for me. Lets add a section about changing tires if there is a puncture and the tools needed and some helpful tips particularly to avoid pinching the inner tube when installing it.', 'refinement'),
        t('coach', 'System 3 now includes a tool list, sealant-checking method, a three-stage puncture repair process, and a full how-to for installing a tube without pinching it.', 'content'),
        t('student', 'Why tyres instead of tires?', 'challenge'),
        t('coach', "Both are correct — tyres is British English, tires is American. Which are you writing for? I can find-and-replace across the whole document.", 'instruction'),
        t('student', "I'm in Canada.", 'narrative'),
        t('coach', "Canadian English follows American spelling, so tires it is — I'll also fix practise→practice, centre→center, and a few others that snuck in.", 'content'),
        t('student', "I wont be carrying a plug kit, I just carry extra tubes.", 'refinement'),
        t('coach', "Good practical point — the plug kit is out of the tool list, and the puncture section is now sealant-then-tube, carry two tubes.", 'content'),
        t('student', "Can you add details about changing tires. I am planning on putting on tires with slightly more thread for gravel riding instead of my smooth ones right noe", 'extraction'),
        t('coach', "Great real-world case. What size are your current tires, so I can check frame clearance before recommending a width?", 'instruction'),
        t('student', 'I have size 30', 'narrative'),
        t('coach', "700x30c is a great base. For gravel, 32c or 35c should fit with a 3–4mm clearance check. Here's the full tubeless tire-change how-to, including rim tape, bead seating, and sealant volumes.", 'content'),
        t('student', 'The bottle says 30-40ml for a top up and up to 120 for a refill.', 'challenge'),
        t('coach', "Good catch — that 120ml figure is a general max for larger mountain bike tires. For your 700x30c, a full fresh refill is closer to 40–55ml, not 120ml.", 'content'),
        t('student', 'Double check the seallant volumes', 'challenge'),
        t('coach', "Re-verified: 30–40ml top up holds, and 40–55ml for a full setup on a 700x30c is the better figure — I'll present both alongside your bottle's number and note it's a general max, not size-specific.", 'content'),
        t('student', 'Lets go with the information you found online and add a line to check with the brand.', 'refinement'),
        t('coach', 'Added the full tire-change section to System 3: frame clearance, rim tape, bead seating, and the sealant volume table with a check-your-brand note.', 'content'),
        t('student', 'For section 4, torque wrench what newton meter level?', 'extraction'),
        t('coach', "It depends on component and material — here are verified alloy vs. carbon ranges from Shimano and Park Tool specs. Do you know if your own bars, stem, and seatpost are alloy or carbon?", 'argument'),
        t('student', 'Lets add the hint to look for the small Nm on the bolt head after the current sentence about strict torque limits.', 'refinement'),
        t('coach', 'Done — the torque hint now sits right after the carbon warning.', 'content'),
        t('student', 'In section 4 we need materials list and some recommended timelines for maintenance? How often should things be checked.', 'extraction'),
        t('coach', "Here's each cockpit component with an inspection interval and time estimate — bar tape, stem/bar bolts, saddle position, cleats — plus a proposed tool list. Does this look right before I write it in?", 'content'),
        t('student', 'Make the maintenance at a glance table with the info you added.', 'refinement'),
        t('coach', 'System 4 updated with the tool list, a 7-row maintenance table, bar tape section, saddle/bike-fit section, and a new cleats section.', 'content'),
        t('student', 'What about the pedals you clip your shoes in, what system do they belong to?', 'challenge'),
        t('coach', "Good question — pedals sit at the intersection of two systems: mechanically Drivetrain (threading, bearings), but cleat alignment and fit belong in Cockpit. Want me to split the content that way?", 'argument'),
        t('student', 'Yes make the additions.', 'validation'),
        t('coach', 'Added pedal mechanics — including the left-pedal reverse thread — to System 1, and a cleat-to-pedal cross-reference in System 4.', 'content'),
        t('student', 'I have a specialized roublaix and apparently I have some kid of shock in my handle bar head... also not sure about how to name that. Where would that fit in? System 5?', 'conceptual'),
        t('coach', "That's the Future Shock, Specialized's proprietary front suspension cartridge. Their manual says it's shop-only, serviced every 500 hours — roughly 1–1.5 years for a regular rider. It belongs in System 5.", 'definition'),
        t('student', 'yes', 'validation'),
        t('coach', 'System 5 updated with the headset/bottom bracket basics, a home headset check, and the full Future Shock section.', 'content'),
        t('student', 'Now add the Future Shock user manual as a reference.', 'refinement'),
        t('coach', "Added Specialized's Future Shock manual to the references.", 'content'),
        t('student', 'The closing is very specific to me, lets make it more general. An encouragement to start with some small maintenance tasks (lets name those that should be done every ride or almost).', 'claim'),
        t('coach', "Here's a proposed every-ride list (tire pressure, visual check, brake feel, wheel spin) and an every-few-rides list (chain lube), with a 'start small, build the habit' framing. Does that look right?", 'content'),
        t('student', "That looks great. For the document, in system 5, it says you have a Specialized Roublaix... lets make it more generalize, what other bikes have a future shock? Maybe mention that some bikes have front chocks and then name some brands, Keep the info about future shock because this is for me primarily.", 'refinement'),
        t('coach', "Trek's IsoSpeed and Cannondale's SAVE Plus are the other common examples. I'll generalize the opening of System 5 to name all three brands while keeping your detailed Future Shock section in full.", 'content'),
        t('student', "Lets tackle the closing. I like this you proposed: [quotes the coach's own draft language back] every-ride and post-ride checklist.", 'validation'),
        t('coach', "Closing rewritten with that structure. While I'm in the document, I found 30 m-dashes total — replacing all of them now with appropriate punctuation.", 'content'),
        t('student', 'How to I add you as the source of the image?', 'conceptual'),
        t('coach', "For a presentation, a simple caption works; for academic use, an APA-style AI-generated-illustration citation. Institutions handle AI image citation differently — worth checking yours if this is for a formal submission.", 'definition'),
        t('student', 'Can you turn this into a one page infographic about the most regular checks one should do, like an illustrated checklist. 8.5X11.', 'extraction'),
        t('coach', "Here's a three-color-coded checklist: before-every-ride, after-wet-rides, and every-few-rides, with checkboxes, sized for a letter page.", 'content'),
        t('student', 'Give me the Anthropic reference to the references section of the document', 'refinement'),
        t('coach', 'Added, alphabetized among the other four references.', 'content'),
        t('student', 'should we also add that the document was created with the help of claude. Should that be in the references?', 'conceptual'),
        t('coach', "A citation is for a specific source used in the text — this is closer to an acknowledgment or, for academic use, a disclosure statement. I'd suggest a labeled line above the references rather than folding it into them. Which version fits your purpose?"),
      ],
    },
  ],
};

// Readings for the demo seed. Authored, because the seed builds analyses with
// no LLM call and readSession() is an LLM read — the same reason SNAPSHOTS and
// PROVENANCE are authored. Every quote below is verbatim from the transcript
// above it, so a reader clicking through the demo lands on real text.
//
// NOT EVIDENCE ABOUT ANYTHING. These are fixtures for building UI. Never
// calibrate a band, a threshold or a rubric against them — see
// tau-dimensions.md, "Do not validate against seed data".
const READINGS = {
  strong: {
    level: 'Transformative',
    levelIndex: 4,
    body: 'You came in saying she makes herself the one who was wrong, and were pushed to show it rather than assert it. You went back to the talk, found the admissions clustered before the Mexico section and the publisher section, and rebuilt the essay around placement.',
    departure: null,
    exception: 'The ethos paragraph stayed a summary. You said so yourself and left it — a defensible call, but the one place the analysis stops arguing.',
    dimensions: [
      { key: 'PQ', name: 'Prompting Quality', question: 'Did you drive the chat?', band: 4,
        count: 'You set the agenda in 6 of 7 segments.',
        claim: 'You opened with your own claim and kept redirecting the conversation back to it.',
        moments: [
          { quote: "I want to analyse the Chimamanda Adichie 'Danger of a Single Story' talk.", note: 'before anything was suggested' },
          { quote: "I'd say the difference is that her stories always cost her something.", note: 'you supplied the distinction' },
        ],
        counterexample: 'The one segment you did not lead was the opening list of standard strategies, where you took the frame you were handed.' },
      { key: 'CS', name: 'Calibrated Skepticism', question: 'Did you check what you were told?', band: 4,
        count: 'You took a position on 5 of 6 claims.',
        claim: 'You checked the pattern against the talk itself rather than accepting that it was there.',
        moments: [
          { quote: 'Checked it — she does it before the Mexico section and before the publisher section', note: 'verified against the source' },
          { quote: 'I disagree that it\u2019s just an anecdote.', note: 'refused a reading' },
        ],
        counterexample: 'You accepted the framing of self-deprecation as a TED convention without asking where that came from.' },
      { key: 'SU', name: 'Selective Use', question: 'What survived?', band: 4,
        count: '5 of 6 changes you directed altered what the essay argues.',
        claim: 'Nearly every change you asked for moved the argument rather than the wording.',
        moments: [
          { quote: 'I restructured so the Mexico story comes before the strategy claim rather than after.', note: 'the order became the argument' },
          { quote: 'The conclusion still restates rather than extends.', note: 'you named what was missing' },
        ],
        counterexample: 'Moving the Mexico story up was structural, and you kept the surrounding paragraph exactly as it was.' },
      { key: 'OC', name: 'Original Contribution', question: 'Is the thinking yours?', band: 4,
        count: '7 of 9 ideas in the essay are yours or reorganised by you.',
        claim: 'The reading is yours, including the decision about how far it can be pushed.',
        moments: [
          { quote: 'So the reader feels the move working before I name it', note: 'your own formulation' },
          { quote: "I'll frame it as a reading rather than a finding — overclaiming would be worse.", note: 'you set the limit yourself' },
        ],
        counterexample: 'The vocabulary for naming the strategies came from the AI, and it shows in the paragraph where you use them.' },
    ],
  },

  flat: {
    level: 'Passive',
    levelIndex: 1,
    body: 'Your questions were which speech to pick, what the rhetorical strategies in it are, and the difference between ethos and pathos. The essay’s argument — that he used ethos and pathos to win support for the space program — is the answer to the third one.',
    departure: 'The last draft has one idea that is unmistakably yours, which is why this does not read as a session with nothing in it.',
    exception: "Right at the end you wrote that the difficulty line \u201cmakes difficulty the reason\u201d — the only moment you tell it something instead of asking.",
    dimensions: [
      { key: 'PQ', name: 'Prompting Quality', question: 'Did you drive the chat?', band: 1,
        count: 'You set the agenda in 1 of 5 segments.',
        claim: 'You asked the AI what to write about before you had a subject of your own.',
        moments: [
          { quote: 'What speech should I do for this assignment?', note: 'the task itself was delegated' },
          { quote: "I don't really know any. Can you list some famous ones?", note: 'and so was the shortlist' },
        ],
        counterexample: 'In the last session you brought your own reading of the difficulty line without being prompted.' },
      { key: 'CS', name: 'Calibrated Skepticism', question: 'Did you check what you were told?', band: 1,
        count: 'You took a position on 0 of 4 claims.',
        claim: 'Nothing the AI said was questioned, and two of your turns simply agreed with it.',
        moments: [
          { quote: 'He talks about history a lot. Is that ethos?', note: 'asking for approval, not checking' },
          { quote: "Probably pathos because it's emotional. That seems right.", note: 'agreeing with a guess' },
        ],
        counterexample: 'There is no counterexample here. This is the case the tool exists to catch.' },
      { key: 'SU', name: 'Selective Use', question: 'What survived?', band: 2,
        count: '1 of 4 changes altered meaning.',
        claim: 'You asked for more material rather than for different material.',
        moments: [
          { quote: 'I need one more paragraph. What else can I say about the moon speech?', note: 'length, not argument' },
        ],
        counterexample: 'The final claim about difficulty is a real change of meaning, and it is the only one.' },
      { key: 'OC', name: 'Original Contribution', question: 'Is the thinking yours?', band: 2,
        count: '1 of 6 ideas in the essay is yours.',
        claim: 'The essay repeats what the AI told you, with one exception at the very end.',
        moments: [
          { quote: "I actually think the 'we choose to go to the moon' part is doing something different", note: 'your own reading, unprompted' },
        ],
        counterexample: 'Everything before that final paragraph traces to an AI turn with nothing in between.' },
    ],
  },

  flagged: {
    level: 'Reactive',
    levelIndex: 2,
    body: 'You make claims, you refine them, and you sustain one thesis across the whole essay. Nothing in the chat asks whether that starting idea was the right one.',
    departure: 'The bands would predict directive. Read the arc instead: the register-collision thesis arrives complete in your second turn, immediately after the AI was asked what makes the speech effective, and nothing after that tests it.',
    exception: 'You asked whether the argument holds across the whole speech, then answered your own question in the AI\u2019s terms rather than the text\u2019s.',
    dimensions: [
      { key: 'PQ', name: 'Prompting Quality', question: 'Did you drive the chat?', band: 2,
        count: 'You set the agenda in 2 of 6 segments.',
        claim: 'You elaborated a frame the AI supplied rather than setting one.',
        moments: [
          { quote: "I'm analysing the Greta Thunberg UN speech. What makes it rhetorically effective?", note: 'the frame was requested' },
        ],
        counterexample: 'Choosing the speech was yours, and so was the decision to rewrite the third body paragraph.' },
      { key: 'CS', name: 'Calibrated Skepticism', question: 'Did you check what you were told?', band: 1,
        count: 'You took a position on 0 of 5 claims.',
        claim: 'Nothing in the conversation was checked against the speech itself.',
        moments: [
          { quote: 'Does my argument about register collision hold up across the whole speech?', note: 'asked, then answered in the same terms' },
        ],
        counterexample: 'There is no counterexample. Every claim that entered the essay entered unchallenged.' },
      { key: 'SU', name: 'Selective Use', question: 'What survived?', band: 3,
        count: '2 of 3 changes altered meaning.',
        claim: 'The changes you directed were real ones, aimed at what the paragraphs argue.',
        moments: [
          { quote: 'The third body paragraph, which describes rather than argues.', note: 'a meaning change, correctly diagnosed' },
        ],
        counterexample: 'You added the methodology point without changing anything it was meant to qualify.' },
      { key: 'OC', name: 'Original Contribution', question: 'Is the thinking yours?', band: 1,
        count: '1 of 8 ideas in the essay is yours.',
        claim: 'The vocabulary, the thesis and the supporting structure all appear first on the AI side.',
        moments: [
          { quote: 'The register collision is measurable in the syntax.', note: 'stated as yours, first raised by the AI' },
        ],
        counterexample: 'The choice of speech is genuinely yours, and it is the only thing in the essay that is.' },
    ],
  },

  bikeguide: {
    level: 'Directive',
    levelIndex: 3,
    body: 'You set the format, the audience and the five systems in your first message, then took the AI through them one at a time, adding a tool list, a lube guide and a maintenance table. The guide at the end is the one you specified at the start.',
    departure: null,
    exception: 'The one thing you took without checking was the replacement reference — moments after that same source had been caught inventing one.',
    dimensions: [
      { key: 'PQ', name: 'Prompting Quality', question: 'Did you drive the chat?', band: 4,
        count: 'You set the agenda in 10 of 11 parts.',
        claim: 'You opened with a brief rather than a question, and twice refused the frame you were handed.',
        moments: [
          { quote: "Let's break it down by system.", note: 'before the AI proposed anything' },
          { quote: 'Remove the citation because specific pages should be referenced.', note: 'it offered two editions, you took neither' },
          { quote: 'What about the pedals you clip your shoes in, what system do they belong to?', note: "the one thing its five-system structure couldn't place" },
        ],
        counterexample: 'Brakes. The AI decided what mattered there and your four questions stayed inside its list — unlike tyres, where you wrote the brief.' },
      { key: 'CS', name: 'Calibrated Skepticism', question: 'Did you check what you were told?', band: 3,
        count: 'You took a position on 8 of 18 claims.',
        claim: 'Twice you checked against something outside the conversation, which is the move that matters most.',
        moments: [
          { quote: "British Cycling (2022). Women's bike fit guide. This doesn't exist.", note: 'you knew the source was invented' },
          { quote: 'The bottle says 30-40ml for a top up and up to 120 for a refill.', note: 'checked against the thing in your hand' },
          { quote: 'Double check the seallant volumes', note: 'you asked it to verify itself' },
        ],
        counterexample: 'When the AI admitted inventing the British Cycling reference it replaced it with Kotler et al. (2023), and you took the replacement without checking it.' },
      { key: 'SU', name: 'Selective Use', question: 'What survived?', band: 3,
        count: '11 of 14 changes you directed altered meaning.',
        claim: 'Most of what you asked for changed what the guide says, not how it looks.',
        moments: [
          { quote: 'No i have disk breaks... i must have used the wrong language to describe the black wires maybe.', note: 'corrected a fact the section rested on' },
          { quote: 'I wont be carrying a plug kit, I just carry extra tubes.', note: 'changed the advice to fit your riding' },
        ],
        counterexample: 'Three of the fourteen were formatting — the table, the m-dashes, the heading order — and those are the ones you asked for most often.' },
      { key: 'OC', name: 'Original Contribution', question: 'Is the thinking yours?', band: 2,
        count: '3 of 12 ideas in the guide are yours or reorganised by you.',
        claim: 'The AI wrote all five systems; what is yours is the framing and the personal detail you brought to it.',
        moments: [
          { quote: 'The closing is very specific to me, lets make it more general.', note: 'you generalised it away from yourself' },
          { quote: 'should we also add that the document was created with the help of claude', note: 'nobody asked you to think about this' },
        ],
        counterexample: 'The five-system structure the whole guide hangs on came from the AI in its first reply, and it never changed.' },
    ],
  },
};

const ESSAYS = {
  strong: [
    "Chimamanda Ngozi Adichie's \"The Danger of a Single Story\" persuades an audience of its own bias without ever accusing it. The talk's central instrument is confession: Adichie repeatedly casts herself as the person who held the reductive view, and she does so immediately before the passages that ask the most of her listeners. Her account of arriving in Mexico expecting the caricature she had absorbed from American media is not a decorative anecdote. It is the mechanism by which the audience is permitted to recognise the same reflex in themselves without having to defend it first.",
    "Chimamanda Ngozi Adichie's \"The Danger of a Single Story\" makes its audience complicit before it makes them uncomfortable. The talk's operative strategy is self-indictment placed immediately before its sharpest claims. A reader might object that self-deprecation is common to the form — that every TED speaker performs modesty. The distinction is that Adichie's admissions cost her something. When she describes arriving in Mexico carrying the caricature she had absorbed, she is indicting herself for precisely the failure she will ask her audience to abandon.",
    "Chimamanda Ngozi Adichie's \"The Danger of a Single Story\" argues by sequence as much as by statement. The talk's operative strategy is self-indictment, and its power depends on position: the confession arrives before the claim it licenses, so the audience feels the move working before it is named. Her Mexico passage does not illustrate a point already made — it makes the point. Nothing before it establishes that Adichie is capable of the same reduction she critiques, which is exactly why the admission functions as argument rather than ornament. What this costs a speaker is the subject the talk never quite states.",
  ],
  flat: [
    "The moon speech by John F. Kennedy is a famous speech about the space program. He uses ethos and pathos to convince people. Ethos is about credibility and he talks about history a lot which makes him seem credible. Pathos is about emotion and the speech is emotional. These strategies helped him get support for going to the moon.",
    "John F. Kennedy's moon speech uses several rhetorical strategies to persuade the American public to support the space program. He uses ethos by referencing history and American achievement, which builds his credibility. He also uses pathos, because the speech is emotional and inspiring. Both of these work together to make the audience want to support the mission.",
    "John F. Kennedy's moon speech persuades its audience by reframing difficulty. The most-quoted line — that we choose to go to the moon not because it is easy but because it is hard — does something the speech's other appeals do not. It converts the strongest objection to the program, its cost and difficulty, into the reason for undertaking it. Ethos and pathos are both present, but this reframing is the move that makes the objection unusable.",
  ],
  flagged: [
    "Greta Thunberg's 2019 address to the United Nations Climate Action Summit derives its force from a deliberate violation of register. The occasion demands diplomatic gratitude; the speech delivers accusation. This collision is not incidental to the argument but constitutes it. The repetition of \"how dare you\" functions as inverted anaphora: where the device conventionally accumulates aspiration, here it accumulates indictment, so that the form of hope carries the content of blame.",
    "Greta Thunberg's 2019 address to the United Nations derives its force from a deliberate violation of register, and the violation is instrumental rather than temperamental. The emissions-budget passage sustains a procedural, data-laden register without collision. That restraint strengthens rather than undermines the reading: the accusatory register is reserved for moments of direct address to the assembly. The reading would be falsified if accusation appeared in passages without direct address. It does not.",
    "Greta Thunberg's 2019 address to the United Nations derives its force from a deliberate violation of register that cannot be answered on its own terms. The occasion demands diplomatic gratitude; the speech delivers accusation, and the collision constitutes the argument rather than decorating it. Because the accusatory register is reserved for direct address, any reply that adopts the assembly's procedural language concedes the speech's premise: that procedure is what the moment cannot afford.",
  ],
  bikeguide: [
    "Know Your Ride: A Road Bike Maintenance Guide for Women Who Are Done Waiting on Someone Else. Let's be honest: a lot of us learned to love cycling through someone else's passion. Maybe a partner, a friend, a club. And somewhere along the way, the unspoken agreement formed: they handle the bike, you handle the riding. Sound familiar? Here's the thing: understanding how your road bike works isn't just about independence (though that's a beautiful bonus). It's about safety, performance, and having a real conversation with the machine you trust with your body at 40 km/h. You don't need to become a mechanic. You need to become informed. There's a difference, and this guide is your starting point. There are five core systems, let's name them, understand them, and demystify the rest.\n\n" +
    "System 1: The Drivetrain: Your Engine Room. The drivetrain is everything that converts your leg power into forward motion: your chain, cassette, chainrings, derailleurs, and the crankset. Think of the drivetrain as the engine room of your bike. When it's running smoothly, you barely notice it. When it's not, you'll hear it. Skipping, grinding, or hesitant shifting are all signs something needs attention. The crankset is the arm that connects your pedals to the chainrings. At the center of the crankset sits the bottom bracket, the bearing that allows the cranks to spin smoothly inside the frame. Pedals thread directly into the crank arms and are part of the drivetrain mechanically, though their fit relationship with your shoes and cleats is covered in System 4. There is one critical thing to know about pedals: the left pedal has reverse thread. It tightens counterclockwise and loosens clockwise, which is the opposite of every other bolt on the bike. A clean drivetrain is the single biggest thing you can do to extend the life of your components (Park Tool, 2023).\n\n" +
    "System 2: The Brakes: Your Most Important System. Your bike is fitted with Shimano Tiagra hydraulic disc brakes. Instead of cables, sealed hoses carry mineral oil from a reservoir inside your brake lever down to calipers at each wheel, which squeeze a metal rotor to slow you down. Never ride with compromised brakes. Your system uses Shimano mineral oil, not DOT fluid; using the wrong fluid will damage the system. The practical signal to watch for is lever feel, not fluid level. An inconsistent squealing sound, particularly one that comes and goes rather than being constant, is almost always contamination rather than worn pads — the fog horn squeal.\n\n" +
    "System 3: Wheels & Tires: Your Connection to the Road. Tubeless tires have become the standard on modern road bikes. Rather than a separate inner tube, the tire forms a sealed system with the rim, filled with liquid sealant that automatically plugs small punctures. For road tubeless, a pressure between 60–80 PSI is a good starting range. Sealant in a tubeless setup should be refreshed every 3–6 months. For your 700x30c tires, a full fresh refill sits around 40–55ml, though this varies between sealant brands — always check the recommendation on your specific product. A pinch flat happens when the tube gets caught between the tire bead and the rim during installation. Use plastic tire levers only, and use your thumbs to roll the final section of bead over the rim rather than levering it.\n\n" +
    "System 4: The Cockpit: Your Contact Points. The cockpit is your handlebars, stem, saddle, and bar tape. A proper bike fit from a qualified fitter is one of the best investments a female rider can make; women's biomechanics are distinct from men's, and a generic setup can lead to chronic issues (Kotler et al., 2023). Cleats are the fittings on the bottom of your cycling shoes that clip into your pedals. Most clipless road pedals offer a degree of float, meaning the amount of rotational movement your foot has before unclipping. Many components have the torque value stamped directly onto the bolt head itself; that number always overrides any general guide.\n\n" +
    "System 5: The Frame & Bearings: The Skeleton. The frame is the heart of your bike, and built into it are several bearings: the headset, the bottom bracket, and the wheel hubs. Some bikes also include a proprietary front suspension system integrated into the head tube. Common examples include the Future Shock on the Specialized Roubaix and Diverge, IsoSpeed on the Trek Domane, and SAVE Plus Micro-Suspension on the Cannondale Synapse. Specialized's own manual states that all Future Shock maintenance must be performed by an Authorized Specialized Retailer using specialty tools; it is not a home maintenance item. The recommended service interval is every 500 hours of riding.\n\n" +
    "Closing: Start Small, Build the Habit. Maintenance isn't about doing everything at once. The key is to start with the smallest tasks and build them into your routine. Before every ride: check tire pressure, do a quick visual check of both tires, squeeze both brake levers, give each wheel a quick spin. After a wet or dirty ride: wipe down the chain, wipe down the frame and components. Every few rides: lube the chain once it looks or sounds dry. You do not need to become a mechanic. You need to become observant. Your bike is yours. Know it.\n\n" +
    "References: Kotler, D. H., et al. (2023). Training and injury considerations in female-identifying cyclists. Global Cycling Network. (2023). Road bike maintenance for beginners. Park Tool. (2023). Chain wear and replacement. Specialized. (2024). Future Shock user manual. Anthropic. (2025). Road bike drivetrain diagram [AI-generated illustration]. AI use disclosure: This document was drafted and developed with the assistance of Claude (Anthropic, 2025). All content was reviewed and approved by the author.",
  ],
};

// origin: student-born | ai-born | synthesized | prior
// One set per draft — provenance drives OC, so a shared set per tier would
// flatten every growth arc in the demo.
const PROVENANCE = {
  strong: [
    [
      { concept: 'confession as strategy', phrase: "The talk's central instrument is confession", origin: 'student-born' },
      { concept: 'placement before hard claims', phrase: 'immediately before the passages that ask the most', origin: 'synthesized' },
      { concept: 'pattern as evidence of design', phrase: 'It is the mechanism by which', origin: 'ai-born' },
      { concept: 'rhetorical strategy taxonomy', phrase: 'is not a decorative anecdote', origin: 'ai-born' },
      { concept: 'audience permission', phrase: 'without having to defend it first', origin: 'ai-born' },
    ],
    [
      { concept: 'confession as strategy', phrase: 'The talk\'s operative strategy is self-indictment', origin: 'student-born' },
      { concept: 'cost to the speaker', phrase: "Adichie's admissions cost her something", origin: 'student-born' },
      { concept: 'placement before hard claims', phrase: 'immediately before its sharpest claims', origin: 'synthesized' },
      { concept: 'ted-form objection', phrase: 'common to the form', origin: 'synthesized' },
      { concept: 'mexico passage', phrase: 'she describes arriving in Mexico', origin: 'synthesized' },
      { concept: 'audience complicity', phrase: 'complicit before it makes them uncomfortable', origin: 'ai-born' },
      { concept: 'genre convention', phrase: 'every TED speaker performs modesty', origin: 'ai-born' },
    ],
    [
      { concept: 'argument by sequence', phrase: 'argues by sequence as much as by statement', origin: 'student-born' },
      { concept: 'confession as strategy', phrase: 'operative strategy is self-indictment', origin: 'student-born' },
      { concept: 'anecdote vs argument', phrase: 'does not illustrate a point already made', origin: 'student-born' },
      { concept: 'cost to the speaker', phrase: 'What this costs a speaker', origin: 'student-born' },
      { concept: 'felt before named', phrase: 'feels the move working before it is named', origin: 'student-born' },
      { concept: 'mexico passage', phrase: 'Her Mexico passage', origin: 'prior' },
      { concept: 'placement before hard claims', phrase: 'its power depends on position', origin: 'synthesized' },
    ],
  ],
  flat: [
    [
      { concept: 'ethos', phrase: 'Ethos is about credibility', origin: 'ai-born' },
      { concept: 'pathos', phrase: 'Pathos is about emotion', origin: 'ai-born' },
      { concept: 'famous speech', phrase: 'is a famous speech about the space program', origin: 'ai-born' },
      { concept: 'historical reference', phrase: 'he talks about history a lot', origin: 'synthesized' },
      { concept: 'persuasion goal', phrase: 'convince people', origin: 'ai-born' },
    ],
    [
      { concept: 'ethos', phrase: 'He uses ethos by referencing history', origin: 'ai-born' },
      { concept: 'pathos', phrase: 'He also uses pathos', origin: 'ai-born' },
      { concept: 'american achievement', phrase: 'history and American achievement', origin: 'synthesized' },
      { concept: 'credibility building', phrase: 'which builds his credibility', origin: 'ai-born' },
      { concept: 'space program support', phrase: 'support the space program', origin: 'prior' },
      { concept: 'strategies working together', phrase: 'work together to make the audience', origin: 'ai-born' },
    ],
    [
      { concept: 'difficulty reframed', phrase: 'persuades its audience by reframing difficulty', origin: 'student-born' },
      { concept: 'objection made unusable', phrase: 'converts the strongest objection', origin: 'student-born' },
      { concept: 'not because it is easy', phrase: 'not because it is easy but because it is hard', origin: 'prior' },
      { concept: 'ethos', phrase: 'Ethos and pathos are both present', origin: 'ai-born' },
      { concept: 'pathos', phrase: 'Ethos and pathos are both present', origin: 'ai-born' },
      { concept: 'cost and difficulty', phrase: 'its cost and difficulty', origin: 'synthesized' },
    ],
  ],
  flagged: [
    [
      { concept: 'register violation', phrase: 'a deliberate violation of register', origin: 'ai-born' },
      { concept: 'inverted anaphora', phrase: 'functions as inverted anaphora', origin: 'ai-born' },
      { concept: 'form vs content', phrase: 'the form of hope carries the content of blame', origin: 'ai-born' },
      { concept: 'occasion demands gratitude', phrase: 'The occasion demands diplomatic gratitude', origin: 'ai-born' },
      { concept: 'collision constitutes argument', phrase: 'constitutes it', origin: 'ai-born' },
      { concept: 'climate summit occasion', phrase: 'address to the United Nations', origin: 'prior' },
    ],
    [
      { concept: 'register violation', phrase: 'a deliberate violation of register', origin: 'ai-born' },
      { concept: 'instrumental not temperamental', phrase: 'instrumental rather than temperamental', origin: 'ai-born' },
      { concept: 'procedural register', phrase: 'sustains a procedural, data-laden register', origin: 'ai-born' },
      { concept: 'falsification test', phrase: 'would be falsified if accusation appeared', origin: 'synthesized' },
      { concept: 'direct address', phrase: 'moments of direct address to the assembly', origin: 'ai-born' },
      { concept: 'emissions budget passage', phrase: 'The emissions-budget passage', origin: 'student-born' },
    ],
    [
      { concept: 'register violation', phrase: 'a deliberate violation of register', origin: 'ai-born' },
      { concept: 'cannot be answered', phrase: 'cannot be answered on its own terms', origin: 'ai-born' },
      { concept: 'conceding the premise', phrase: 'concedes the speech\'s premise', origin: 'ai-born' },
      { concept: 'direct address', phrase: 'reserved for direct address', origin: 'ai-born' },
      { concept: 'procedure as cost', phrase: 'procedure is what the moment cannot afford', origin: 'synthesized' },
      { concept: 'climate summit occasion', phrase: 'address to the United Nations', origin: 'prior' },
    ],
  ],
  bikeguide: [
    [
      { concept: 'student-authored intro', phrase: 'having a real conversation with the machine you trust with your body at 40 km/h', origin: 'student-born' },
      { concept: 'fog horn squeal naming', phrase: 'the fog horn squeal', origin: 'student-born' },
      { concept: 'reverse pedal thread', phrase: 'the left pedal has reverse thread', origin: 'ai-born' },
      { concept: 'sealant volume correction', phrase: 'though this varies between sealant brands', origin: 'synthesized' },
      { concept: 'torque stamp note', phrase: 'Many components have the torque value stamped directly onto the bolt head itself', origin: 'synthesized' },
      { concept: "women's biomechanics", phrase: "women's biomechanics are distinct from men's", origin: 'ai-born' },
      { concept: 'generalized suspension brands', phrase: 'IsoSpeed on the Trek Domane, and SAVE Plus Micro-Suspension on the Cannondale Synapse', origin: 'synthesized' },
      { concept: 'future shock shop-only', phrase: 'it is not a home maintenance item', origin: 'ai-born' },
      { concept: 'clean drivetrain claim', phrase: 'the single biggest thing you can do to extend the life of your components', origin: 'ai-born' },
      { concept: 'observant not mechanic', phrase: 'You do not need to become a mechanic. You need to become observant.', origin: 'ai-born' },
      { concept: 'tire pressure range', phrase: 'PSI is a good starting range', origin: 'ai-born' },
      { concept: 'plastic levers only', phrase: 'Use plastic tire levers only', origin: 'ai-born' },
    ],
  ],
};


const PROVENANCE_TURNS = {
  // bikeguide — turn numbers are 1-based over student turns.
  'having a real conversation with the machine you trust with your body at 40 km/h': 6,
  'the fog horn squeal': 18,
  'the left pedal has reverse thread': 34,
  'though this varies between sealant brands': 28,
  'Many components have the torque value stamped directly onto the bolt head itself': 30,
  "women's biomechanics are distinct from men's": 32,
  'IsoSpeed on the Trek Domane, and SAVE Plus Micro-Suspension on the Cannondale Synapse': 39,
  'it is not a home maintenance item': 35,
  'the single biggest thing you can do to extend the life of your components': 2,
  'You do not need to become a mechanic. You need to become observant.': 38,
  'PSI is a good starting range': 2,
  'Use plastic tire levers only': 20,
};

// Applied on the way out so PROVENANCE itself stays a plain phrase/origin list.
for (const tier of Object.keys(PROVENANCE)) {
  for (const cycle of PROVENANCE[tier]) {
    for (const item of cycle) {
      const n = PROVENANCE_TURNS[item.phrase];
      if (n) item.turn = n;
    }
  }
}

const FLAGS = {
  strong: [],
  flat: [],
  bikeguide: [],
  flagged: [
    {
      flag: 'stylistic-inconsistency',
      evidence: "The student's opening turn asks 'what makes it rhetorically effective?' in plain language, then the next turn produces 'the core move is that she refuses the register the occasion expects' with no intervening coach input to account for the jump.",
    },
    {
      flag: 'unnatural-fluency',
      evidence: 'Every student turn across all three drafts is a complete, hedge-free analytic sentence — no false starts, no revisions mid-turn, no colloquial phrasing anywhere in the cycle.',
    },
    {
      flag: 'shadow-session-pattern',
      evidence: "Responses to the coach's open questions arrive fully formed with terminology the coach never introduced ('inverted anaphora', 'register collision'), suggesting the analysis was developed elsewhere.",
    },
  ],
};

const SNAPSHOTS = {
  strong: [
    {
      strengths: [
        { quote: "But I'm not sure that's rhetoric or just niceness — how would I show it's a strategy?", note: 'You questioned your own idea before the coach did. That instinct is the whole skill.' },
        { quote: "I'd say the difference is that her stories always cost her something.", note: 'You answered a challenge with a distinction rather than a retreat.' },
      ],
      growthMoves: [
        'You brought strong claims but mostly waited for the coach to test them — try running the test yourself first.',
        'When the coach offered the "pattern is evidence of design" idea, you took it whole. Push back on it next time and see if it survives.',
      ],
      bridge: 'Your next draft moves to questions-only coaching, which means the coach will stop offering ideas. Everything you build has to start from you.',
    },
    {
      strengths: [
        { quote: "I don't think that holds. An anecdote illustrates a point that's already made; hers makes the point.", note: 'A clean rejection with a reason attached — you did not just disagree, you showed why.' },
        { quote: "I'll move it up so it's the hinge of the section rather than the last line.", note: 'You turned feedback into a structural decision rather than a sentence edit.' },
      ],
      growthMoves: [
        'Your counterargument section is now the strongest part. The opening claim has not been tested as hard.',
        'You accepted the coach\'s framing of what a reader would object to — try predicting the objection yourself.',
      ],
      bridge: 'Your final draft uses sounding-board coaching: the coach will reflect your thinking back but will not evaluate it. You are the judge from here.',
    },
    {
      strengths: [
        { quote: "Not every paragraph should do the same thing.", note: 'You declined a suggestion on principle, and the principle was right.' },
        { quote: 'The conclusion still restates rather than extends.', note: 'You found the weakest part of your own draft without being asked.' },
      ],
      growthMoves: [
        'You named the conclusion problem but did not solve it in this draft — the evidence for the fix is already in your essay.',
      ],
      bridge: 'This assignment is complete. The pattern to carry forward: you argue best when you let the coach test you rather than tell you.',
    },
  ],
  flat: [
    {
      strengths: [
        { quote: 'I guess sports. Is that ok to write about?', note: 'You offered something of your own here, even tentatively. That was the opening.' },
      ],
      growthMoves: [
        'Most of your turns asked the coach to supply the answer. When it turned the question back, the conversation stopped rather than went deeper.',
        'You had a real answer available — sports — and dropped it after one question. Try staying with your own idea for three exchanges before abandoning it.',
      ],
      bridge: 'Your next draft moves to questions-only coaching. It will not be able to list options for you, so bringing your own starting point matters more.',
    },
    {
      strengths: [
        { quote: 'He talks about history a lot. Is that ethos?', note: 'You made an observation of your own before asking for the label.' },
      ],
      growthMoves: [
        'You asked whether you were right five times and stated what you thought once. Try stating first and checking after.',
        'When the coach asked what would make the passage something other than ethos, that was the question worth staying with.',
      ],
      bridge: 'Your final draft uses sounding-board coaching, which will not confirm or deny your reads. You will need to test them against the text instead.',
    },
    {
      strengths: [
        { quote: "It makes difficulty the reason rather than the obstacle.", note: 'This is the first idea in the whole assignment that is entirely yours — and it is the best one in the essay.' },
      ],
      growthMoves: [
        'That idea arrived in your last turn of the last draft. It deserved a whole essay.',
        'Notice what produced it: the coach asked what a disagreeing reader would point to, and you looked at the text instead of asking for the answer.',
      ],
      bridge: 'This assignment is complete. The move that worked: going back to the text when you were stuck, rather than back to the coach.',
    },
  ],
  flagged: [
    {
      strengths: [
        { quote: 'The register collision is measurable at sentence level.', note: 'A claim specific enough to be checked, which is what makes it worth making.' },
      ],
      growthMoves: [
        'Your claims arrive fully formed and are not revised. Thinking usually looks messier than this — the mess is where the work shows.',
        'You did not disagree with the coach once across this draft. If it never said anything you would contest, it was not being useful.',
      ],
      bridge: 'Your next draft moves to questions-only coaching. It will probe rather than confirm.',
    },
    {
      strengths: [
        { quote: 'The emissions-budget passage sustains the procedural register without collision.', note: 'You looked for the place your own reading fails, which is the right instinct.' },
      ],
      growthMoves: [
        'The falsification test came from the coach and entered your essay unchanged. What is your own answer to it?',
        'Three drafts in, nothing in your thinking has visibly changed. Revision that changes nothing is worth questioning.',
      ],
      bridge: 'Your final draft uses sounding-board coaching — it will reflect, not evaluate.',
    },
    {
      strengths: [
        { quote: 'The third body paragraph, which describes rather than argues.', note: 'You identified a real structural weakness in your own draft.' },
      ],
      growthMoves: [
        'You ended by saying the essay is complete. No draft is, and the drafts that improve most start from what is still wrong.',
        'Most of the concepts in your final essay appeared in the conversation before you used them. Try writing a paragraph the conversation never touched.',
      ],
      bridge: 'This assignment is complete.',
    },
  ],
  bikeguide: [
    {
      strengths: [
        { quote: "British Cycling (2022). Women's bike fit guide. This doesn't exist.", note: 'You caught a fabricated citation before it went into a document meant for a real presentation — the single strongest moment in this session.' },
        { quote: 'The bottle says 30-40ml for a top up and up to 120 for a refill.', note: "You checked the AI's number against your own product and made it re-verify — the number it corrected to was more accurate than either of your starting points." },
        { quote: 'The closing is very specific to me, lets make it more general.', note: 'You caught that content written for you specifically would not serve a document meant for other readers, and fixed the scope yourself.' },
      ],
      growthMoves: [
        'Most of your turns directed what to add or change rather than supplying content yourself — that is a legitimate way to work with a drafting tool, but it means the guide is mostly AI-authored prose shaped by your editorial calls, not your own writing.',
        'The moments that mattered most here were catches and corrections, not claims. Notice that those do not show up as "your" sentences in the final document even though they are the clearest evidence of your judgment.',
      ],
      bridge: 'This was a document co-creation session, not an essay-plus-coach cycle — worth reading its score dimensions with that shape in mind rather than against the other tiers.',
    },
  ],
};

const TEACHER_NOTES = {
  'maya@school.dev': 'Maya — the shift you made in draft 3, putting the Mexico story before the claim, is exactly the kind of structural thinking I want to see more of. Bring this instinct to the persuasive essay. Come find me if you want to talk about the conclusion; you were right that it restates.',
  'devon@school.dev': "Devon — read your last paragraph again. The idea about difficulty being the reason rather than the obstacle is genuinely good and it's yours. That's the standard now. Let's talk about how to get there earlier next time.",
};

// Separate from TEACHER_NOTES (which lands on the *past* assignment's final
// draft) — this one lands on a draft within the *open* assignment, so the
// demo shows a teacher note inside the draft-row ledger itself, not just on
// the past-assignment summary card.
const OPEN_TEACHER_NOTES = {
  'maya@school.dev': "Good opening position on draft 1 — the evidence for your second reason is still doing more assertion than argument. Bring a source to our next check-in.",
};

module.exports = {
  READINGS,
  STUDENTS,
  CLASSES,
  ASSIGNMENTS,
  ELECTIVE_ASSIGNMENT,
  ENGLISH_EXTRA_ASSIGNMENT,
  LIT_EXTRA_ASSIGNMENT,
  GUIDE_ASSIGNMENT,
  OPEN_ASSIGNMENTS,
  OPEN_ASSIGNMENT_STATE,
  TRANSCRIPTS,
  ESSAYS,
  PROVENANCE,
  FLAGS,
  SNAPSHOTS,
  TEACHER_NOTES,
  OPEN_TEACHER_NOTES,
};
