// The tour's chapters. Each stop: `setup` puts the real page into one state
// (it runs behind a veil and may assume the stops before it ran), `spot` or
// `spots` names what to light, and `title`/`body` are the callout. Selectors
// are the pages' own ids and classes, so a renamed one fails loudly at its
// stop rather than lighting the wrong thing.
//
// Words — roster, chat, essay, the class's results — come from story.js,
// which the fake server reads too.

(function () {
  const S = window.DEMO_STORY;

  // A date picker's value: local YYYY-MM-DD, never via toISOString (UTC).
  function daysFromNow(n) {
    const d = new Date(Date.now() + n * 86400000);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  const dashboard = (t) => t.open('dashboard.html', '#content > *');

  window.DEMO_CHAPTERS = [{
    title: 'Set up a class',
    desc: 'A class, a roster and an assignment, from a template.',
    scenario: 'teacher-new',
    stops: [
      {
        setup: dashboard,
        spot: '.setup-row',
        title: 'Three steps, on one screen',
        body: 'A new teacher’s Home is the set-up itself: a class, a roster, an assignment. Each step marks itself done.',
      },
      {
        async setup(t) {
          const cls = await t.w().api('/api/classes', { method: 'POST', body: { name: 'English 10 — Period 3' } });
          await t.w().loadDashboardData();
          t.w().render();
          t.w().openAddStudentsModal(cls.id);
          await t.set('#hdr-addstudent-roster-input', S.roster.map((r) => r.join(', ')).join('\n'));
        },
        spot: '#add-students-modal-overlay .modal',
        title: 'Paste the roster',
        body: 'One student per line, with a school email. Every line is checked before an account is made, and each student is emailed a link to set their own password.',
      },
      {
        async setup(t) {
          await t.w().submitRosterAdd('hdr');
          t.w().closeAddStudentsModal();
          t.w().openNewAssignmentModal(['c-1']);
          await t.set('#na-template', S.template.id);
        },
        spots: ['#na-template-row', '#na-requirements'],
        block: 'start',
        title: 'Start from a template',
        body: 'Pick a saved template and its wording fills in: what the task is, why it matters, what it needs. Students see all three at the top of every session.',
      },
      {
        async setup(t) {
          await t.set('#na-due-date', daysFromNow(14));
        },
        spot: '#newAssignmentForm .assign-schedule-panel',
        title: 'A due date for each draft',
        body: 'Set the final date and the drafts space themselves out before it. Each draft is handed in on its own, so you see how the work changes.',
      },
      {
        async setup(t) {
          await t.click('#new-assignment-submit-btn');
          await t.el('#new-assignment-view-success .menu-confirm');
        },
        spot: '#new-assignment-modal-overlay .modal',
        title: 'The whole class has it',
        body: 'Everyone on the class gets the assignment — no one to pick by hand. From here, the dashboard fills in as students submit.',
      },
    ],
  }, {
    title: 'Student use',
    desc: 'Starting the assignment, the chat, handing in a draft.',
    scenario: 'student-assigned',
    stops: [
      {
        setup: (t) => t.open('index.html', '.draft-row-btn'),
        spot: '#currentList > article',
        title: 'The assignment is waiting',
        body: 'Maya signs in and finds what Ms. Rivera set, with a due date for each draft.',
      },
      {
        async setup(t) {
          await t.w().openAssignment('a-1');
          const conv = t.w().demoFastForward('a-1');
          await t.w().openAssignment('a-1');
          await t.w().openConversation(conv);
        },
        spot: ['.turn-student .msg', 'proves grades go up'],
        title: 'She works with the AI',
        body: 'The AI starts knowing nothing, so she briefs it herself. Here, she won’t let one study prove more than it does.',
      },
      {
        async setup(t) {
          await t.click('#btnEvaluate');
          await t.until((doc) => doc.querySelector('.turn-auditor') && !doc.querySelector('.thinking'));
        },
        spot: '.turn-auditor',
        title: '“How am I doing?”',
        body: 'At any point she can ask for a read-out of how she’s using the AI. It isn’t a score, and it stays out of her report.',
      },
      {
        docs: { title: 'Start Later, Learn More', text: S.essay },
        at: { x: 880, y: 250 },
        title: 'She writes outside the tool',
        body: 'The essay is written wherever she usually writes — here, Google Docs. Tau Thinking sees her sessions and the draft she hands in.',
      },
      {
        async setup(t) {
          await t.click('#btnSubmit');
          await t.drop('#uploadDrop', 'Start Later, Learn More.docx', S.essay);
          for (const [key, value] of Object.entries(S.reflection)) await t.set(`#reflect_${key}`, value);
        },
        spot: '#submitModal .confirm',
        title: 'She hands in the draft',
        body: 'She attaches the file and answers three short questions about how she used the AI. Submitting locks her sessions and sends them with the draft.',
      },
      {
        async setup(t) {
          await t.click('#btnConfirmSubmit');
          await t.el('#samrHero .report-hero', 12000);
        },
        spot: '#samrHero',
        title: 'Her report comes back',
        body: 'A level for where her own thinking entered the work, and why — in plain sentences, from her own session. It says how the work was made, not how good it is.',
      },
    ],
  }, {
    title: 'Student report',
    desc: 'Opening one student’s report from the dashboard.',
    scenario: 'teacher-reviewing',
    stops: [
      {
        async setup(t) {
          await dashboard(t);
          t.w().gotoStudentFromClass('s-1');
          t.w().toggleStudentDrill('c-1::a-1');
        },
        spot: '.drill-trace',
        title: 'Every student has a page',
        body: 'Open Maya and each assignment shows her level on every draft, and how each reading moved between them.',
      },
      {
        setup: (t) => t.open('report.html?id=sub-s-1-0', '#samrHero .report-hero'),
        spot: '#samrHero',
        title: 'The report she reads',
        body: 'Each draft has a report, and you see exactly what Maya sees: her level, and the sentences that explain it.',
      },
      {
        spot: '#levelRuling',
        title: 'Your read of the level',
        body: 'One line is yours alone. If the level reads wrong, say so, and which way. It never reaches Maya.',
      },
      {
        async setup(t) {
          await t.scroll('#readingCards');
          await t.click(['.dim-card', 'Calibrated Skepticism']);
        },
        spot: '[role=dialog][aria-modal=true]',
        title: 'Every reading shows its evidence',
        body: 'Four readings, each resting on moments quoted from her session — and on the one moment that didn’t fit.',
      },
      {
        async setup(t) {
          await t.click(['button', 'Close']);
        },
        spot: '#tabIdeas',
        title: 'Whose ideas made it into the essay',
        body: 'Each idea in the draft is traced back: raised by her, worked out in an exchange, or brought in by the AI.',
      },
      {
        spot: '#conversationView',
        title: 'The session, beside it',
        body: 'Everything the report claims can be checked against what was actually said.',
      },
    ],
  }, {
    title: 'Class results',
    desc: 'How the room did, and how it moved between drafts.',
    scenario: 'teacher-reviewing',
    stops: [
      {
        setup: dashboard,
        spot: '.home-cols-top',
        title: 'Where to look first',
        body: 'Home opens on who might need a conversation, and where each class landed.',
      },
      {
        async setup(t) {
          await t.click(['.pattern-card summary', 'Challenge Arc']);
        },
        spot: ['.home-band', 'Behavioral patterns'],
        block: 'start',
        title: 'Habits across the room',
        body: 'Passive patterns show who needs help; high-agency ones show who can help. Each one comes with something to try.',
      },
      {
        async setup(t) {
          t.w().gotoAssignment('a-1');
        },
        spot: ['.overview-card', 'agency across the drafts'],
        title: 'How far each student moved',
        body: 'Every student’s level on draft 1 and on the final. The ribbons show who moved up, who held, and who slipped.',
      },
      {
        async setup(t) {
          await t.click(['.card-tab', 'Calibrated Skepticism']);
        },
        spot: ['.overview-card', 'dimensions across the drafts'],
        block: 'start',
        title: 'The same, for each dimension',
        body: 'One tab per dimension, each with something to try. Here, more students were checking what they were told by the final draft.',
      },
    ],
  }, {
    title: 'Worth a chat',
    desc: 'A flagged draft, what it means, and marking it done.',
    scenario: 'teacher-reviewing',
    stops: [
      {
        setup: dashboard,
        spot: ['.class-row', 'Worth a chat'],
        title: 'Two students are worth a chat',
        body: 'Something on one of their drafts is worth asking about. It’s a question to raise, never a verdict.',
      },
      {
        async setup(t) {
          t.w().gotoStudentFromClass('s-3');
          t.w().toggleStudentDrill('c-1::a-1');
        },
        spot: '.integrity-flags-row',
        title: 'The signal sits on one draft',
        body: 'On Priya’s final draft, her turns read as polished rather than typed live. The flag names what was noticed, and where.',
      },
      {
        async setup(t) {
          t.w().openFlagTray('unnatural-fluency');
          await t.sleep(350);
        },
        spot: '#side-tray',
        title: 'What it means, and what to try',
        body: 'What was noticed, why it can matter, and ways to open the conversation — including the ordinary explanations it can have.',
      },
      {
        async setup(t) {
          t.w().closeFlagTray();
          await t.click(['.flag-item-actions button', 'Had the chat']);
          await t.until((doc) => doc.querySelector('.flag-item.decided'));
        },
        spot: '.integrity-flags-row',
        title: 'After the conversation, mark it',
        body: '“Had the chat”, or “Not worth raising” with a private reason. The flag stays on the record; it just stops asking.',
      },
      {
        async setup(t) {
          t.w().goHome();
        },
        spot: ['.class-row', 'Worth a chat'],
        title: 'The list keeps up',
        body: 'One student left to talk to.',
      },
    ],
  }];
})();
