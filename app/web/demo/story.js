// The one story the walkthrough tells, shared by every chapter: Ms. Rivera
// sets up English 10, Maya Chen does the assignment, and her report is read.
// Loaded by the player; fake-api.js reads it off the parent window, so the
// chat replies, the essay and the report all quote the same session.
//
// Authored, not recorded. Nothing here is a measurement, and nothing here may
// be used to validate one (see tau-dimensions.md on the demo seed).

window.DEMO_STORY = (function () {
  const template = {
    id: 'tpl-1',
    name: 'Argument essay',
    title: 'Should the school day start later?',
    description: 'Write a 600–800 word argument essay taking a position on whether our school should move its start time to 9:00.',
    purpose: 'Building an argument from evidence you have weighed yourself — and saying where the evidence runs out.',
    requirements: 'At least two sources, cited. One paragraph that answers the strongest objection to your position.',
    teacherNote: 'Look for whether they engage the counter-argument or only name it.',
    draftBudget: 2,
  };

  // The class once both drafts are in. Per student: each draft's level (1
  // Passive … 4 Transformative) and bands in the dashboard's order (PQ, SU, CS,
  // OC), the patterns found in each session, and any flag on the final. Maya's
  // draft 1 is the reading her report shows.
  //
  // The shape of the room is the point: most move up a level, two hold, one
  // slips, and two drafts carry something worth a conversation.
  const cohort = [
    { name: 'Maya Chen',     d1: [3, 3, 3, 4, 3], fin: [4, 4, 3, 4, 4], p1: ['challenge-arc', 'assertion-questioned'], p2: ['challenge-arc', 'rejection-redirect'] },
    { name: 'Jordan Lee',    d1: [1, 1, 1, 2, 1], fin: [2, 2, 2, 2, 1], p1: ['extraction-loop', 'validation-spiral'], p2: ['assertion-unquestioned'] },
    { name: 'Priya Patel',   d1: [2, 2, 2, 2, 2], fin: [3, 3, 3, 2, 3], p1: ['assertion-unquestioned'], p2: ['extraction-landing'], flags: ['unnatural-fluency'] },
    { name: 'Sam Okafor',    d1: [2, 2, 3, 2, 2], fin: [3, 3, 3, 3, 3], p1: ['extraction-landing'], p2: ['challenge-arc'] },
    { name: 'Ella Novak',    d1: [3, 4, 3, 3, 3], fin: [4, 4, 4, 4, 3], p1: ['challenge-arc'], p2: ['challenge-arc', 'rejection-redirect'] },
    { name: 'Diego Ramírez', d1: [2, 2, 2, 1, 2], fin: [2, 3, 2, 2, 2], p1: ['extraction-loop'], p2: ['validation-spiral'] },
    { name: 'Aisha Rahman',  d1: [3, 3, 3, 3, 4], fin: [3, 3, 4, 3, 4], p1: ['rejection-redirect'], p2: ['assertion-questioned', 'rejection-redirect'] },
    { name: 'Noah Kim',      d1: [1, 1, 2, 1, 1], fin: [2, 2, 2, 2, 2], p1: ['extraction-loop', 'assertion-unquestioned'], p2: ['extraction-landing'] },
    { name: 'Lucía Torres',  d1: [2, 3, 2, 2, 2], fin: [3, 3, 3, 3, 2], p1: ['validation-spiral'], p2: ['challenge-arc'] },
    { name: 'Ben Carter',    d1: [3, 3, 3, 3, 3], fin: [2, 2, 2, 2, 2], p1: ['claim-support'], p2: ['extraction-loop', 'validation-spiral'] },
    { name: 'Hana Sato',     d1: [2, 2, 2, 3, 2], fin: [3, 3, 3, 3, 3], p1: ['assertion-questioned'], p2: ['assertion-questioned', 'challenge-arc'] },
    { name: 'Omar Haddad',   d1: [2, 2, 2, 2, 1], fin: [3, 3, 3, 3, 3], p1: ['extraction-loop'], p2: ['rejection-redirect'], flags: ['provenance-mismatch'] },
  ];

  const roster = cohort.map(({ name }) => {
    const [first, last] = name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().split(' ');
    return [name, `${first}.${last}@school.edu`];
  });

  // Student turn, then the AI's reply to it. The AI is briefed by the student,
  // as in the product: it is never told the assignment.
  const chat = [
    {
      student: "I'm writing an argument essay on whether our school should start at 9 instead of 8. I think it should, mostly because teenagers' sleep cycles shift later — but I want to test that before I build on it.",
      ai: "That's a good claim to test first. The research does point that way: during puberty the body releases melatonin later in the evening, and the American Academy of Pediatrics recommends high schools start no earlier than 8:30.\n\nWhat would count as evidence, for you, that a later start actually *changes* something for students — not just that they're tired?",
    },
    {
      student: "Grades and attendance I guess. But the sleep studies might just show teens are tired, not that 9am fixes it. Has any district actually changed its start time and measured what happened?",
      ai: "Yes. Seattle moved its high school start from 7:50 to 8:45 in 2016, and a University of Washington study found students slept about **34 minutes more** a night, with grades in the classes studied up about 4.5%.\n\nThe usual objections are cost and **bus schedules**, after-school sports and jobs, and parents' work hours.",
    },
    {
      student: "Seattle is useful but that's one district — I don't want to claim it proves grades go up everywhere. I'll use it as evidence it can work, not proof. The buses are the strongest objection at our school, because they already do two runs.",
      ai: "That's a careful way to hold it. If the buses are the strongest objection, how could you answer it without hand-waving — is there anything in the two-run schedule itself you could use?",
    },
    {
      student: "Maybe flip the runs. Elementary kids go first, since younger kids wake up early anyway, and we take the second run. I'll put that in as my answer to the objection.",
      ai: "That turns the objection into part of your proposal rather than something you only concede. Worth saying plainly in the essay that it's your proposal, so a reader knows what's evidence and what's your plan.",
    },
  ];

  // What "How am I doing?" says partway through. About the acts, never about
  // whether she was right (a read-out, not a verdict).
  const auditor = "You're steering this. You came in with a position and asked for help testing it, you questioned the sleep research before leaning on it, and you decided for yourself how far the Seattle study can go.\n\nOne thing to watch: the numbers you're planning to use all came from the AI. Before you write, find where at least one of them comes from, so you can say it in your own words.";

  const essay = `Start Later, Learn More

Every morning at 8:00, half of my first-period class is still asleep with their eyes open. That is not laziness. During puberty the body releases melatonin later in the evening, which is why the American Academy of Pediatrics recommends that high schools start no earlier than 8:30. Our school should move its start time to 9:00.

The strongest evidence that a later start can work comes from Seattle, which moved its high school start from 7:50 to 8:45 in 2016. Students there slept about 34 minutes more a night. One district is not proof that grades will rise everywhere, but it is evidence that the change is possible and that students really do use the time to sleep.

The most serious objection at our school is the buses, which already make two runs each morning. My proposal is to flip the order: elementary students, who naturally wake early, ride the first run, and high school students ride the second. The change costs no extra buses. It only asks us to match the schedule to the students on it.`;

  const reflection = {
    connect: 'I already knew my class is exhausted first period. I didn’t know why, so I asked about the science first.',
    extend: 'The Seattle study, and thinking about the bus schedule as something I could change instead of just an objection.',
    challenge: 'I didn’t let the Seattle numbers prove more than they do — it’s one district.',
  };

  // Labels a classifier would give Maya's four turns, in order.
  const labels = [
    { label: 'claim', responsive: false, followedBy: 'challenge' },
    { label: 'challenge', responsive: true, followedBy: 'rejection' },
    { label: 'rejection', responsive: true, followedBy: 'claim' },
    { label: 'claim', responsive: true, followedBy: null },
  ];

  const provenance = [
    { concept: 'first-period exhaustion', phrase: 'still asleep with their eyes open', origin: 'prior' },
    { concept: 'melatonin timing', phrase: 'releases melatonin later in the evening', origin: 'synthesized' },
    { concept: 'AAP recommendation', phrase: 'no earlier than 8:30', origin: 'ai-born' },
    { concept: 'Seattle study', phrase: 'slept about 34 minutes more', origin: 'ai-born' },
    { concept: 'one district is not proof', phrase: 'One district is not proof', origin: 'student-born' },
    { concept: 'flip the bus runs', phrase: 'flip the order', origin: 'student-born' },
  ];

  const reading = {
    level: 'Directive',
    levelIndex: 3,
    body: 'You came in with a position and asked the AI to help you test it rather than write it. When the evidence arrived you narrowed what it could prove, and you answered the strongest objection with an idea of your own.',
    departure: null,
    exception: 'The research itself came from the AI and went into the essay largely as given — you checked how far it reached, not where it came from.',
    dimensions: [
      {
        key: 'PQ', name: 'Prompting Quality', question: 'Did you drive the chat?', band: 3,
        count: 'You set the direction in 3 of 4 turns.',
        claim: 'You opened with your own position and gave the AI a job: help you test it.',
        moments: [
          { quote: 'I want to test that before I build on it.', note: 'you set the job' },
          { quote: 'Maybe flip the runs.', note: 'the next idea came from you' },
        ],
        counterexample: 'When you asked whether any district had measured it, you let the AI choose which evidence you would see.',
      },
      {
        key: 'CS', name: 'Calibrated Skepticism', question: 'Did you check what you were told?', band: 4,
        count: 'You took a position on 3 of the 4 claims you were offered.',
        claim: 'You questioned the sleep research before relying on it, and limited what the Seattle study could carry.',
        moments: [
          { quote: 'the sleep studies might just show teens are tired, not that 9am fixes it', note: 'you questioned the evidence' },
          { quote: "I don't want to claim it proves grades go up everywhere.", note: 'you set a limit on a source' },
        ],
        counterexample: 'You took the Seattle numbers as given and did not go to the study itself.',
      },
      {
        key: 'SU', name: 'Selective Use', question: 'What survived?', band: 3,
        count: '2 of the 3 things you took from the chat changed what the essay argues.',
        claim: 'The Seattle study went into the essay with the limit you put on it, not as it was offered.',
        moments: [
          { quote: 'One district is not proof that grades will rise everywhere', note: 'your limit, in the essay' },
          { quote: 'the buses, which already make two runs each morning', note: 'the objection you chose' },
        ],
        counterexample: 'The 8:30 recommendation went into the essay exactly as the AI gave it.',
      },
      {
        key: 'OC', name: 'Original Contribution', question: 'Is the thinking yours?', band: 3,
        count: '4 of 6 ideas in the essay are yours or reshaped by you.',
        claim: 'The turn in the argument — answering the bus objection by flipping the runs — is yours.',
        moments: [
          { quote: 'My proposal is to flip the order', note: 'your own answer to the objection' },
          { quote: 'still asleep with their eyes open', note: 'from your own experience' },
        ],
        counterexample: 'The sleep science and the numbers came from the AI.',
      },
    ],
  };

  const growthMoves = [
    'Go to one source yourself. The Seattle study is a search away, and reading it would let you say what it found in your own words.',
  ];

  return { template, cohort, roster, chat, auditor, essay, reflection, labels, provenance, reading, growthMoves };
})();
