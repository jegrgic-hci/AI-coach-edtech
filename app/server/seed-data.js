// Demo content for the dev seed. Transcripts are hand-labeled with the same
// label vocabulary the classifier produces, so seed.js can run them through the
// real enrich()/scoreTAU() instead of hardcoding score vectors.
//
// Three tiers, each with three drafts, so the demo shows different shapes of
// AI use rather than one shape at three volumes:
//   strong  — challenges and rejects the coach; ideas stay the student's
//   flat    — asks the coach for answers and accepts them; little movement
//   flagged — high scores on the surface, provenance says otherwise

const DEV_PASSWORD = 'coach1234';

const STUDENTS = [
  { email: 'maya@school.dev', displayName: 'Maya Rodriguez', tier: 'strong', openAssignmentDrafts: 1 },
  { email: 'devon@school.dev', displayName: 'Devon Clarke', tier: 'flat', openAssignmentDrafts: 0 },
  { email: 'priya@school.dev', displayName: 'Priya Nair', tier: 'flagged', openAssignmentDrafts: 0 },
  { email: 'luis@school.dev', displayName: 'Luis Ferreira', tier: 'strong', pastDrafts: 1, openAssignmentDrafts: 0 },
  { email: 'sam@school.dev', displayName: 'Sam Whitfield', tier: 'flat', pastDrafts: 0, openAssignmentDrafts: 0 },
];

const ASSIGNMENTS = {
  open: {
    title: 'Persuasive essay: school start times',
    prompt:
      'Write a persuasive essay (600–900 words) arguing whether your school should move to a later start time. ' +
      'Take a clear position, support it with at least three distinct reasons, address one counterargument, ' +
      'and cite evidence for your claims.',
    draftBudget: 3,
    coachingLevels: ['full', 'questions', 'sounding-board'],
  },
  past: {
    title: 'Rhetorical analysis: a speech that changed something',
    prompt:
      'Choose a speech that produced a measurable change and analyse how it worked rhetorically (700–1000 words). ' +
      'Identify the audience, the rhetorical strategies used, and argue which strategy did the most work. ' +
      'Ground every claim in specific language from the speech.',
    draftBudget: 3,
    coachingLevels: ['full', 'questions', 'sounding-board'],
  },
};

// t(role, text, label) — label is null for coach turns.
const t = (role, text, label = null) => ({ role, text, label });

const TRANSCRIPTS = {
  strong: [
    {
      title: 'Picking a speech',
      turns: [
        t('student', "I want to analyse the Chimamanda Adichie 'Danger of a Single Story' talk. I think the thing that makes it work is that she keeps making herself the person who was wrong, not the audience.", 'claim'),
        t('coach', "That's a specific and promising angle. What does positioning herself as the one who was wrong let her do that a more direct critique wouldn't?"),
        t('student', 'What are the standard rhetorical strategies people usually name in an analysis like this?', 'extraction'),
        t('coach', "I'd rather start from what you noticed. You already have an observation about who she blames — what does that do to a listener?"),
        t('student', "It means the audience never has to defend themselves, so they can actually hear it. But I'm not sure that's rhetoric or just niceness — how would I show it's a strategy?", 'conceptual'),
        t('coach', 'You could look at where in the talk she does it. If it clusters right before her hardest claims, that pattern is evidence of design rather than temperament.'),
        t('student', 'So the placement is the evidence — is that the kind of thing that counts as analysis?', 'validation'),
        t('coach', 'It is, if you show the pattern rather than assert it. What does the talk actually do?'),
        t('student', 'Where should I look for the pattern first?', 'extraction'),
        t('coach', 'Start with the passages you found hardest to hear as a listener.'),
        t('student', 'Checked it — she does it before the Mexico section and before the publisher section, both of which are her sharpest points. So the confession is load-bearing, not decorative.', 'claim'),
        t('coach', 'That gives you an argument. How will you handle a reader who says any speaker telling personal stories does this?'),
        t('student', "I'd say the difference is that her stories always cost her something. I'll build the counterargument section around that distinction.", 'refinement'),
      ],
    },
    {
      title: 'Testing the counterargument',
      turns: [
        t('student', "My draft feedback said my counterargument was weak. I think the objection is that self-deprecation is just a common TED move and not specific to her.", 'claim'),
        t('coach', 'What would you need to find in the talk to make that objection collapse?'),
        t('student', "So I'd need a moment where the self-criticism does work that a generic TED move couldn't. I think the Mexico story is it — she indicts herself for exactly the thing she's asking the audience to stop doing.", 'claim'),
        t('coach', 'And if a reader said that is still just a vivid anecdote?'),
        t('student', "I disagree that it's just an anecdote. An anecdote illustrates a point that's already made; hers makes the point. Nothing before it establishes that she's capable of the same bias.", 'rejection'),
        t('coach', 'Then that distinction is worth stating explicitly in the essay rather than leaving implicit.'),
        t('student', "Agreed. I'll move it up so it's the hinge of the section rather than the last line.", 'refinement'),
      ],
    },
    {
      title: 'Final structure pass',
      turns: [
        t('student', "Last draft. I restructured so the Mexico story comes before the strategy claim rather than after. Reading it back I think it now argues rather than describes.", 'claim'),
        t('coach', 'What changed in how the reader experiences the claim?'),
        t('student', 'So the reader feels the move working before I name it, and naming it lands as recognition instead of assertion.', 'claim'),
        t('coach', 'Is there anywhere left where you name a strategy before showing it?'),
        t('student', "But I'm going to leave the ethos paragraph as it is — that one is genuinely a summary paragraph and it needs to signpost. Not every paragraph should do the same thing.", 'rejection'),
        t('coach', "Reasonable. What's your own read on the weakest part now?"),
        t('student', 'The conclusion still restates rather than extends. I want it to say something about what this costs a speaker, which the essay has evidence for but never says.', 'refinement'),
        t('coach', 'What evidence in the essay points at that cost?'),
        t('student', "Every admission she makes is one she can't take back — but how would I know that's a cost to her rather than something I'm projecting onto the talk?", 'challenge'),
        t('coach', 'That is the right thing to be uncertain about. What would settle it?'),
        t('student', "So nothing would settle it from the text alone. I'll frame it as a reading rather than a finding — overclaiming would be the same mistake I'm accusing other readings of.", 'rejection'),
      ],
    },
  ],

  flat: [
    {
      title: 'Speech ideas',
      turns: [
        t('student', 'What speech should I do for this assignment?', 'extraction'),
        t('coach', "I'd rather not pick for you — what speeches have you actually heard or read that stuck with you?"),
        t('student', "I don't really know any. Can you list some famous ones?", 'extraction'),
        t('coach', 'What subjects do you find yourself arguing about outside school? That is usually a better route in.'),
        t('student', "I guess sports. Is that ok to write about?", 'validation'),
        t('coach', 'It can absolutely work. What would you want to find out about a sports speech?'),
        t('student', "Not sure. I'll just do a famous one I guess.", 'stuck'),
      ],
    },
    {
      title: 'Draft 2 questions',
      turns: [
        t('student', 'I picked the Kennedy moon speech. What are the rhetorical strategies in it?', 'extraction'),
        t('coach', 'What do you notice yourself when you read the opening two paragraphs?'),
        t('student', 'He talks about history a lot. Is that ethos?', 'validation'),
        t('coach', 'What makes you say ethos rather than something else?'),
        t('student', "Because it's about credibility? I think that's right.", 'validation'),
        t('coach', 'Try testing it: what would the passage be doing if it were not about his credibility?'),
        t('student', "I'm not sure. Can you just explain the difference between ethos and pathos?", 'extraction'),
      ],
    },
    {
      title: 'Finishing up',
      turns: [
        t('student', 'I need one more paragraph. What else can I say about the moon speech?', 'extraction'),
        t('coach', 'What has your essay argued so far, in one sentence?'),
        t('student', 'That he used ethos and pathos to get support for the space program.', 'narrative'),
        t('coach', 'Which of those two does more work in the speech, and how would you know?'),
        t('student', "Probably pathos because it's emotional. That seems right.", 'validation'),
        t('coach', 'What in the text would a reader point to if they disagreed with you?'),
        t('student', "I actually think the 'we choose to go to the moon' part is doing something different — it makes difficulty the reason rather than the obstacle. I could build the paragraph on that.", 'claim'),
      ],
    },
  ],

  flagged: [
    {
      title: 'Analysis planning',
      turns: [
        t('student', "I'm analysing the Greta Thunberg UN speech. What makes it rhetorically effective?", 'extraction'),
        t('coach', 'What is your own read on why it landed the way it did?'),
        t('student', "The core move is that she refuses the register the occasion expects — the setting demands diplomatic gratitude and she delivers accusation, and that violation is itself the argument.", 'claim'),
        t('coach', 'That is a sophisticated framing. Where in the speech is the violation sharpest?'),
        t('student', "The 'how dare you' repetition functions as anaphora inverted: instead of building aspiration it accumulates indictment, so the form of hope carries the content of blame.", 'claim'),
        t('coach', 'How would you show that to a reader who hears it as simply angry?'),
        t('student', "By contrast with the surrounding syntax, which is procedural and data-laden. The register collision is measurable at sentence level.", 'claim'),
      ],
    },
    {
      title: 'Second draft',
      turns: [
        t('student', 'Does my argument about register collision hold up across the whole speech?', 'validation'),
        t('coach', 'Test it — where does the speech not do that?'),
        t('student', "The emissions-budget passage sustains the procedural register without collision, which arguably strengthens the reading: the collision is reserved for moments of direct address, making it a deliberate instrument rather than a temperament.", 'claim'),
        t('coach', 'That is a good save. What would falsify the reading entirely?'),
        t('student', "If the accusatory register appeared in passages with no direct address to the assembly. It does not, on my reading.", 'claim'),
        t('coach', 'Then state that test in the essay — showing what would disprove you makes the claim stronger.'),
        t('student', 'I have added it to the methodology paragraph.', 'refinement'),
      ],
    },
    {
      title: 'Polish',
      turns: [
        t('student', 'Final pass. Is the through-line clear from introduction to conclusion?', 'validation'),
        t('coach', 'Read me your thesis and your last sentence as a pair — do they meet?'),
        t('student', "They do now. The thesis claims register violation is the primary instrument; the conclusion argues that this is why the speech could not be answered on its own terms without conceding its premise.", 'claim'),
        t('coach', 'What is the weakest link between them?'),
        t('student', "The third body paragraph, which describes rather than argues. I have rewritten it to foreground the analytic claim.", 'refinement'),
        t('coach', 'Good. Anything you are still uncertain about?'),
        t('student', 'No, I think it is complete.', 'narrative'),
      ],
    },
  ],
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
};

const FLAGS = {
  strong: [],
  flat: [],
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
};

const TEACHER_NOTES = {
  'maya@school.dev': 'Maya — the shift you made in draft 3, putting the Mexico story before the claim, is exactly the kind of structural thinking I want to see more of. Bring this instinct to the persuasive essay. Come find me if you want to talk about the conclusion; you were right that it restates.',
  'devon@school.dev': "Devon — read your last paragraph again. The idea about difficulty being the reason rather than the obstacle is genuinely good and it's yours. That's the standard now. Let's talk about how to get there earlier next time.",
};

module.exports = {
  DEV_PASSWORD,
  STUDENTS,
  ASSIGNMENTS,
  TRANSCRIPTS,
  ESSAYS,
  PROVENANCE,
  FLAGS,
  SNAPSHOTS,
  TEACHER_NOTES,
};
