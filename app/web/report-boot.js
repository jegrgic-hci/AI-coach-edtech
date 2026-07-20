// Fetches the submission report from the API and feeds it to the CTA
// renderers in report-render.js. Polls while analysis is pending.

(function () {
  const params = new URLSearchParams(location.search);
  const submissionId = params.get('id');
  if (!submissionId) {
    document.getElementById('pending').textContent = 'No submission specified.';
    return;
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
    const { submission, analysis, history } = await res.json();

    document.getElementById('pageTitle').textContent =
      `Draft ${submission.cycleIndex + 1} — How you worked with the AI`;

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

    render(submission, analysis, history || []);
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

  function renderSnapshot(snapshot, coachingLevel) {
    const el = document.getElementById('snapshotContent');
    if (!snapshot) { el.parentElement.style.display = 'none'; return; }
    el.innerHTML = `
      ${(snapshot.strengths || []).map((s) => `
        <div class="quote">
          <span>“${esc(s.quote)}”</span>
          <span class="snapshot-note">${esc(s.note)}</span>
        </div>`).join('')}
      ${(snapshot.growthMoves || []).map((g) => `<div class="report-next">Next draft: ${esc(g)}</div>`).join('')}
      ${snapshot.bridge ? `<p class="snapshot-bridge">${esc(snapshot.bridge)}</p>` : ''}
      <p class="snapshot-bridge">Coach was in <strong>${esc(coachingLevel)}</strong> mode this draft.</p>`;
  }

  function renderTeacherNote(note) {
    if (!note) return;
    const panel = document.createElement('div');
    panel.className = 'card';
    panel.innerHTML = `
      <span class="eyebrow">A note from your teacher</span>
      <p class="teacher-note">${esc(note)}</p>`;
    document.getElementById('snapshotPanel').after(panel);
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

  function render(submission, analysis, history) {
    const scores = analysis.tau;
    const classified = adaptClassified(analysis.classified || []);
    // The server stores { concept, phrase, origin }; the renderers also need
    // character positions in the essay and a trace back to the originating
    // turn. traceProvenance computes both, and nothing had ever called it — so
    // the heatmap was reading p.positions off an object that has never had it,
    // throwing before the concept list rendered. Hence a whole tab of headings
    // with no content under them.
    const provenanceData = traceProvenance(
      analysis.provenance || [], classified, submission.essayText || '');

    document.getElementById('pending').style.display = 'none';
    document.getElementById('results').style.display = 'flex';

    document.getElementById('samrHero').innerHTML = renderReportHero(scores, history);
    document.getElementById('summaryGrid').innerHTML = renderSummary(scores);
    document.getElementById('dimDetails').innerHTML = renderDimDetails(scores);
    renderSnapshot(analysis.snapshot, analysis.coachingLevel);
    renderTeacherNote(submission.teacherNote);
    // The presence of flags IS the teacher signal — the API strips them for
    // students server-side, so there is nothing for the client to decide. The
    // old `teacherMode` global came from the single-file CTA's ?role=teacher
    // and was never defined here, so this line threw on every single load and
    // took the whole lower half of the report down with it.
    renderFlagsPanel(analysis.flags);

    renderAgencyChart(classified);

    document.getElementById('reflectContent').innerHTML =
      renderReflect(classified, provenanceData, submission.essayText || '');
    initReflectDashboard();

    if (provenanceData.length > 0) {
      document.getElementById('provStats').innerHTML = renderProvStats(provenanceData);
      document.getElementById('essayHeatmap').innerHTML = renderEssayHeatmap(submission.essayText || '', provenanceData);
      document.getElementById('conceptList').innerHTML = renderConceptList(provenanceData);
    } else {
      document.getElementById('essayHeatmap').textContent = 'Provenance analysis unavailable for this draft.';
    }

    renderPatternGuide();
  }

  document.getElementById('patternSidebarClose').addEventListener('click', () => closePatternSidebar());
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closePatternSidebar(); });

  // dt- overlay close wiring lives outside the ported render section in the CTA
  document.getElementById('dt-modal-close').addEventListener('click', () =>
    document.getElementById('dt-modal-overlay').classList.remove('open'));
  document.getElementById('dt-modal-overlay').addEventListener('click', (e) => {
    if (e.target.id === 'dt-modal-overlay') e.target.classList.remove('open');
  });
  document.getElementById('dt-sidebar-close').addEventListener('click', () =>
    document.getElementById('dt-sidebar').classList.remove('open'));

  // load() is async, so anything it throws became an unhandled rejection and
  // vanished — which is how a broken renderer could silently blank three tabs
  // while the top of the report looked perfectly fine. Failures are loud now.
  load().catch((err) => {
    console.error('report render failed', err);
    const pending = document.getElementById('pending');
    pending.style.display = '';
    pending.textContent = 'Something went wrong drawing this report. Your work is safe — reload to try again.';
  });
})();
