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

  function adaptClassified(stored) {
    // The CTA renderers expect quality on student turns and labels on AI
    // turns; the server stores neither, so compute them here the same way
    // the CTA does (assessQuality / classifyAITurnFallback are ported in).
    return stored.map((t) => {
      const text = t.text || t.excerpt || '';
      if (t.role === 'student') {
        return { ...t, text, quality: assessQuality(text) };
      }
      return { ...t, text, label: t.label || classifyAITurnFallback(text) };
    });
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
    const scores = analysis.tau;
    const classified = adaptClassified(analysis.classified || []);
    // The server stores { concept, phrase, origin }; My Session's grouping
    // also needs character positions in the essay and a trace back to the
    // originating turn — traceProvenance computes both.
    const provenanceData = traceProvenance(
      analysis.provenance || [], classified, submission.essayText || '');

    reportReady = true;
    applyMode();

    document.getElementById('samrHero').innerHTML = renderReportHero(scores, submission);
    document.getElementById('reportJumpScore').innerHTML = renderJumpScore(scores);
    document.getElementById('dimGrid').innerHTML = renderDimGrid(scores);
    renderTeacherNote(submission.teacherNote);
    // The presence of flags IS the teacher signal — the API strips them for
    // students server-side, so there is nothing for the client to decide. The
    // old `teacherMode` global came from the single-file CTA's ?role=teacher
    // and was never defined here, so this line threw on every single load and
    // took the whole lower half of the report down with it.
    renderFlagsPanel(analysis.flags);

    renderAgencyChart(classified);
    renderDrivingChart(classified);

    document.getElementById('reflectContent').innerHTML =
      renderReflect(classified, provenanceData, submission.essayText || '');
    initReflectInteractions();

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

  document.getElementById('patternSidebarClose').addEventListener('click', () => closePatternSidebar());
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closePatternSidebar(); });

  // dt- overlay close wiring lives outside the ported render section in the CTA
  document.getElementById('dt-modal-close').addEventListener('click', () =>
    document.getElementById('dt-modal-overlay').classList.remove('open'));
  document.getElementById('dt-modal-overlay').addEventListener('click', (e) => {
    if (e.target.id === 'dt-modal-overlay') e.target.classList.remove('open');
  });

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
