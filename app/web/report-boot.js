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
    const res = await fetch(`/api/submissions/${submissionId}/report`);
    if (!res.ok) {
      document.getElementById('pending').textContent = 'Could not load this report.';
      return;
    }
    const { submission, analysis } = await res.json();

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
         <button id="retryBtn" style="font:inherit;padding:8px 16px;cursor:pointer">Retry analysis</button>`;
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

  function renderSnapshot(snapshot, coachingLevel) {
    const el = document.getElementById('snapshotContent');
    if (!snapshot) { el.parentElement.style.display = 'none'; return; }
    el.innerHTML = `
      ${(snapshot.strengths || []).map((s) => `
        <div class="snapshot-strength">
          <div class="quote">“${esc(s.quote)}”</div>
          <div class="note">${esc(s.note)}</div>
        </div>`).join('')}
      ${(snapshot.growthMoves || []).map((g) => `<div class="snapshot-growth">Next draft: ${esc(g)}</div>`).join('')}
      ${snapshot.bridge ? `<div class="snapshot-bridge">${esc(snapshot.bridge)}</div>` : ''}
      <div class="snapshot-bridge" style="margin-top:6px">Coach was in <strong>${esc(coachingLevel)}</strong> mode this draft.</div>`;
  }

  function render(submission, analysis) {
    const scores = analysis.tau;
    const classified = adaptClassified(analysis.classified || []);
    const provenanceData = analysis.provenance || [];

    document.getElementById('pending').style.display = 'none';
    document.getElementById('results').style.display = 'flex';

    document.getElementById('samrHero').innerHTML = renderSAMRCircle(scores);
    document.getElementById('summaryGrid').innerHTML = renderSummary(scores);
    renderSnapshot(analysis.snapshot, analysis.coachingLevel);

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

  load();
})();
