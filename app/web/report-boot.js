// Fetches the submission report from the API and feeds it to the CTA
// renderers in report-render.js. Polls while analysis is pending.

(function () {
  const params = new URLSearchParams(location.search);
  const submissionId = params.get('id');
  if (!submissionId) {
    document.getElementById('pending').textContent = 'No submission specified.';
    return;
  }

  // 'report' | 'sessions' — which of the two the results-layout is currently
  // showing. reportReady flips once render() has actually drawn the report,
  // so switching back from Sessions while analysis is still pending restores
  // the spinner rather than an empty results panel.
  let mode = 'report';
  let reportReady = false;

  function setLocalNav(submission) {
    renderNavLocal(document.getElementById('navLocal'), [
      { label: 'Report', active: mode === 'report', onClick: () => { mode = 'report'; applyMode(); setLocalNav(submission); } },
      {
        label: 'Sessions', active: mode === 'sessions',
        onClick: () => {
          mode = 'sessions'; applyMode(); setLocalNav(submission);
          loadConversationView(submission).catch((err) => {
            console.error('session view failed', err);
            document.getElementById('convViewTranscript').innerHTML =
              '<p class="conv-view-empty">Could not load your sessions. Reload to try again.</p>';
          });
        },
      },
    ]);
  }

  function applyMode() {
    document.getElementById('conversationView').classList.toggle('hidden', mode !== 'sessions');
    if (mode === 'sessions') {
      document.getElementById('pending').style.display = 'none';
      document.getElementById('results').style.display = 'none';
      return;
    }
    document.getElementById('pending').style.display = reportReady ? 'none' : '';
    document.getElementById('results').style.display = reportReady ? 'flex' : 'none';
  }

  // Both states that end in "run it again" — a failed analysis and one that
  // predates the current reading — put the same button in the same place, so
  // the machinery is written once and the two differ only in what they say.
  //
  // `working` is what the reader sees for the whole run, which is why it is a
  // caller's line rather than one generic string: a retry after a failure and
  // a first read of an old draft are not the same event to the person waiting.
  function offerRerun(bodyHTML, actionLabel, working) {
    const pending = document.getElementById('pending');
    // Never over the Sessions view — applyMode() owns that toggle, and a poll
    // landing while the reader is in the transcript must not pull them out of it.
    if (mode === 'report') pending.style.display = '';
    pending.innerHTML =
      `${bodyHTML}<br><br>
       <button id="retryBtn" class="btn btn-quiet" type="button">${actionLabel}</button>`;
    document.getElementById('retryBtn').onclick = async () => {
      pending.innerHTML = `<div class="spinner"></div>${working}`;
      const res = await fetch(`/api/submissions/${submissionId}/reanalyze`, { method: 'POST' });
      // 409 means someone else already started this one — the poll below picks
      // that run up, so it is not an error to report. Anything else is.
      if (!res.ok && res.status !== 409) {
        offerRerun('That could not be started just now.', 'Try again', working);
        return;
      }
      setTimeout(load, 2500);
    };
  }

  async function load() {
    // Whether flags come back is decided server-side from the signed-in user's
    // role — the ?role=teacher param no longer grants anything.
    const res = await fetch(`/api/submissions/${submissionId}/report`);
    if (res.status === 401) return requireLogin();
    if (res.status === 403) {
      // Distinct from a broken report, and the reader can act on it: the id is
      // fine, this account has no claim on the student it belongs to. Said
      // plainly because a teacher signed into the wrong one of two accounts
      // otherwise reads "could not load" as the tool being broken.
      document.getElementById('pending').textContent =
        'This report belongs to a student in another teacher’s class, so it cannot be opened from this account.';
      return;
    }
    if (!res.ok) {
      document.getElementById('pending').textContent = 'Could not load this report.';
      return;
    }
    const { submission, analysis, stale, sample } = await res.json();

    if (sample) renderSampleNotice();

    renderNavCrumbs(document.getElementById('navCrumbs'), [
      { label: 'All assignments', href: '/' },
      { label: submission.assignmentTitle || 'Assignment' },
      { label: `Draft ${submission.cycleIndex + 1}`, current: true },
    ]);
    setLocalNav(submission);

    if (!analysis || analysis.status === 'pending') {
      setTimeout(load, 2500);
      return;
    }
    if (analysis.status === 'error') {
      offerRerun(
        `Analysis hit a problem: ${esc(analysis.error || 'unknown error')}`,
        'Retry analysis', 'Retrying analysis…');
      return;
    }

    // AN OLD RECORD IS NOT A THIN SESSION, and before this branch existed the
    // report could not tell the reader which it was looking at. Analyses
    // written before the settled reading store `tau` and no `reading`; every
    // renderer guards for its own field, so the page drew a hero saying there
    // wasn't enough here to read, no dimension cards, and no error — which is
    // exactly what a genuinely thin session looks like. Found on staging
    // 2026-08-20 against five real submissions.
    //
    // NOTHING PARTIAL IS DRAWN. What these records hold is the retired 1-5
    // scoring, which no current renderer reads, so rendering "what we have"
    // produces the same blank page with a caveat on top of it.
    if (stale) {
      offerRerun(
        `<b>This report was produced before the current reading.</b><br>
         The measurement changed after this draft was analysed, so there is
         nothing here to show yet. Re-reading uses the same conversation and the
         same essay — the student's work is not affected.`,
        'Re-read this draft', 'Reading this draft again…');
      return;
    }

    render(submission, analysis);
  }

  // Stored turns carry text under either key depending on how they were
  // written. The heuristic quality/label fallbacks the old charts needed are
  // gone with them — the turn plot reads the classifier's own label, and an AI
  // turn is shown as text rather than as a guessed label.
  function adaptClassified(stored) {
    return stored.map((t) => ({ ...t, text: t.text || t.excerpt || '' }));
  }

  // Everything a teacher needs to know before reading a word of this one, and
  // all of it is a claim about provenance rather than a disclaimer:
  //   - the session is real, and the only real one we have;
  //   - the student's turns are theirs, the AI's are shortened, so the
  //     transcript is a record and not a log;
  //   - it is not school work, so it shows how a reading is written and
  //     nothing about how drafts move;
  //   - and it is in the second person because this is the student's own
  //     report, which is the other half of what it is here to show.
  // Above the hero, not under it: a reader who learns any of this afterwards
  // has already read the reading as something it isn't.
  function renderSampleNotice() {
    const el = document.createElement('div');
    el.className = 'card sample-notice';
    el.innerHTML = `
      <div class="sample-notice-head">An example — not one of your students</div>
      <p>This is a real session: a rider co-writing a bicycle maintenance guide with an AI, and the
      only real transcript we have. Their own turns are as they wrote them; the AI's replies are
      shortened.</p>
      <p>It is adult work rather than school work — one draft, no revision — so it shows you how a
      reading is written and nothing about how a student moves between drafts. It is written in the
      second person because it is the report <em>they</em> would read.</p>`;
    const layout = document.querySelector('.results-layout');
    layout.insertBefore(el, layout.firstChild);
  }

  // Placed directly under the hero, not folded into any other card — a
  // teacher's note outranks the coach's own read of the draft, so it gets
  // its own section rather than living inside one titled "what stood out".
  // Same auditor tint the assignment dashboard's teacher-note disclosure
  // uses (that one collapses to save space inside a crowded card; this one
  // has the whole report to itself, so it stays permanently open).
  function renderTeacherNote(note) {
    const panel = document.getElementById('teacherNotePanel');
    if (!note) { panel.innerHTML = ''; return; }
    panel.innerHTML = `
      <div class="card teacher-note-panel">
        <div class="teacher-note-panel-head">${iconSVG('chat')}<span>Teacher's note</span></div>
        <p class="teacher-note-panel-body">${esc(note)}</p>
      </div>`;
  }

  // Teacher mode only — the API strips flags for students, so this panel
  // can never render from a student fetch.
  function renderFlagsPanel(flags) {
    if (!flags) return;
    const panel = document.createElement('div');
    panel.className = 'card';
    panel.innerHTML = `
      <span class="eyebrow">Worth a chat — teacher view</span>
      <p class="flags-framing">Conversation-starters, never verdicts. Some signals have known false-positive profiles (ELL translation workflows, IEP accommodations).</p>
      ${renderFlags(flags.map((f) => ({ type: f.flag, detail: f.evidence })))}`;
    document.getElementById('results').appendChild(panel);
  }

  function render(submission, analysis) {
    const reading = analysis.reading;
    const classified = adaptClassified(analysis.classified || []);

    reportReady = true;
    applyMode();

    document.getElementById('samrHero').innerHTML = renderReportHero(reading, submission);
    document.getElementById('reportJumpScore').innerHTML = renderJumpScore(reading);
    document.getElementById('readingCards').innerHTML = renderReadings(reading);
    renderTeacherNote(submission.teacherNote);
    // The presence of flags IS the teacher signal — the API strips them for
    // students server-side, so there is nothing for the client to decide.
    renderFlagsPanel(analysis.flags);

    // The conversation on the time axis, and the draft on the authorship axis.
    // Both live in session-view.js because the teacher reads the same two.
    SessionView.renderTurnPlot(
      document.getElementById('turnPlot'), classified, analysis.patterns || []);
    SessionView.renderIdeaStrip(
      document.getElementById('ideaStrip'), analysis.provenance || [],
      classified, submission.essayText || '');

    const growthMovesHtml = renderGrowthMoves(analysis.snapshot && analysis.snapshot.growthMoves);
    const growthMovesPanel = document.getElementById('growthMovesPanel');
    if (growthMovesHtml) {
      document.getElementById('growthMovesContent').innerHTML = growthMovesHtml;
    } else {
      growthMovesPanel.style.display = 'none';
      // Nothing to jump to — pull its entry out of the jump nav rather than
      // leaving a dead link to a hidden section.
      document.getElementById('jumpBtnNext').style.display = 'none';
    }
  }

  // load() is async, so anything it throws became an unhandled rejection and
  // vanished — which is how a broken renderer could silently blank three tabs
  // while the top of the report looked perfectly fine. Failures are loud now.
  load().catch((err) => {
    console.error('report render failed', err);
    const pending = document.getElementById('pending');
    pending.style.display = '';
    pending.textContent = 'Something went wrong drawing this report. Your work is safe — reload to try again.';
  });

  mountAccountChip(document.getElementById('accountChip')).catch(() => {});
})();
