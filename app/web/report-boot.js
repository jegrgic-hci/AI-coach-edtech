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

  async function load() {
    // Whether flags come back is decided server-side from the signed-in user's
    // role — the ?role=teacher param no longer grants anything.
    const res = await fetch(`/api/submissions/${submissionId}/report`);
    if (res.status === 401) return requireLogin();
    if (!res.ok) {
      document.getElementById('pending').textContent = 'Could not load this report.';
      return;
    }
    const { submission, analysis } = await res.json();

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
      const pending = document.getElementById('pending');
      pending.innerHTML =
        `Analysis hit a problem: ${esc(analysis.error || 'unknown error')}<br><br>
         <button id="retryBtn" class="btn btn-quiet" type="button">Retry analysis</button>`;
      document.getElementById('retryBtn').onclick = async () => {
        pending.innerHTML = '<div class="spinner"></div>Retrying analysis…';
        await fetch(`/api/submissions/${submissionId}/reanalyze`, { method: 'POST' });
        setTimeout(load, 2500);
      };
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
