// The tour. Each chapter is a few stops; each stop puts the real page into
// one state, lights one region of it, and says what it is. Nothing is clicked
// in front of the visitor: a stop's `setup` runs behind a brief veil, and the
// page appears already where the stop is about.
//
// Stops advance on their own, with Back, Next and pause for anyone reading at
// their own pace. Going forward runs the next stop's setup on the page as it
// stands; going anywhere else rebuilds the chapter from its starting world and
// replays every setup up to that stop, so each stop's setup can assume the
// ones before it ran.

// Read by demo/fake-api.js inside the frame. Null state means "start fresh",
// in the world DEMO_SCENARIO names; zero latency because every wait would
// only lengthen a veil.
window.DEMO_STATE = null;
window.DEMO_SCENARIO = null;
window.DEMO_LATENCY = 0;

(function () {
  const STAGE_W = 1280, STAGE_H = 800, GAP = 22, EDGE = 16;
  const $ = (id) => document.getElementById(id);
  const frame = $('frame');
  const CHAPTERS = window.DEMO_CHAPTERS;

  function fit() {
    const scale = $('stage').clientWidth / STAGE_W;
    $('stage-inner').style.transform = `scale(${scale})`;
    $('stage').style.height = `${STAGE_H * scale}px`;
  }
  window.addEventListener('resize', fit);
  fit();

  // ── Run control ────────────────────────────────────────────────────────────
  // Every move bumps the token; a setup still running for an older move finds
  // it changed at its next await and stops there.
  class Stale extends Error {}
  let token = 0;
  let chapter = null;
  let at = -1;

  function loadFrame(src) {
    return new Promise((resolve) => {
      frame.onload = () => resolve();
      frame.src = src;
    });
  }

  function tools(my) {
    const check = () => { if (my !== token) throw new Stale(); };
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms)).then(check);
    const w = () => frame.contentWindow;
    const doc = () => frame.contentDocument;
    const visible = (el) => el && el.getClientRects().length > 0;

    // A selector, or [selector, text] for the innermost match holding that text.
    async function el(target, timeout = 8000) {
      const start = Date.now();
      for (;;) {
        check();
        const [sel, text] = Array.isArray(target) ? target : [target, null];
        let hits = [];
        try {
          hits = [...doc().querySelectorAll(sel)].filter((e) => visible(e) && (!text || e.textContent.includes(text)));
        } catch { /* mid-navigation */ }
        const found = hits.find((e) => !hits.some((o) => o !== e && e.contains(o)));
        if (found) return found;
        if (Date.now() - start > timeout) throw new Error(`tour: never found ${sel}${text ? ` "${text}"` : ''}`);
        await sleep(80);
      }
    }

    const fire = (e, ...types) => types.forEach((t) => e.dispatchEvent(new (w().Event)(t, { bubbles: true })));

    return {
      w, doc, el, sleep,
      // Loads a page unless the frame is already on it.
      async open(page, ready) {
        const want = `/demo/${page}`;
        let here = '';
        try { here = w().location.pathname + w().location.search; } catch { /* blank */ }
        if (here !== want) await loadFrame(want);
        check();
        if (ready) await el(ready, 12000);
      },
      async click(target) { (await el(target)).click(); await sleep(150); },
      async set(target, value) { const e = await el(target); e.value = value; fire(e, 'input', 'change'); await sleep(80); },
      async until(test, timeout = 8000) {
        const start = Date.now();
        for (;;) {
          check();
          let ok = false;
          try { ok = test(doc(), w()); } catch { /* mid-navigation */ }
          if (ok) return;
          if (Date.now() - start > timeout) throw new Error('tour: waited too long');
          await sleep(80);
        }
      },
      async scroll(target, block = 'center') {
        (await el(target)).scrollIntoView({ block, behavior: 'instant' });
        await sleep(60);
      },
      // A real drop of a real File on the page's upload box, so the page's own
      // reading of the file runs.
      async drop(target, name, text) {
        const box = await el(target);
        const dt = new (w().DataTransfer)();
        dt.items.add(new (w().File)([text], name));
        box.dispatchEvent(new (w().DragEvent)('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
        await sleep(200);
      },
    };
  }

  // ── Spotlight and callout ──────────────────────────────────────────────────
  function rectOf(els) {
    const rs = els.map((e) => e.getBoundingClientRect());
    const pad = 8;
    const r = {
      left: Math.min(...rs.map((x) => x.left)) - pad,
      top: Math.min(...rs.map((x) => x.top)) - pad,
      right: Math.max(...rs.map((x) => x.right)) + pad,
      bottom: Math.max(...rs.map((x) => x.bottom)) + pad,
    };
    r.left = Math.max(4, r.left); r.top = Math.max(4, r.top);
    r.right = Math.min(STAGE_W - 4, r.right); r.bottom = Math.min(STAGE_H - 4, r.bottom);
    return r;
  }

  function lightUp(r) {
    const spot = $('spot');
    if (!r) {
      spot.classList.add('off');
      return;
    }
    spot.classList.remove('off');
    Object.assign(spot.style, {
      left: `${r.left}px`, top: `${r.top}px`,
      width: `${r.right - r.left}px`, height: `${r.bottom - r.top}px`,
    });
  }

  // Beside the lit region where there is room — right, then left, then below,
  // then above — and otherwise tucked into its corner.
  function place(r, side, at) {
    const box = $('callout');
    const w = box.offsetWidth, h = box.offsetHeight;
    const clampY = (y) => Math.max(EDGE, Math.min(STAGE_H - h - EDGE, y));
    const clampX = (x) => Math.max(EDGE, Math.min(STAGE_W - w - EDGE, x));
    let x, y;
    if (!r) {
      x = at ? at.x : (STAGE_W - w) / 2;
      y = at ? at.y : (STAGE_H - h) / 2;
    } else {
      // Each side, pulled back inside the stage. The first that leaves the lit
      // region clear wins; when none can, the one covering least of it.
      const spots = {
        right: [r.right + GAP, clampY(r.top)],
        left: [r.left - GAP - w, clampY(r.top)],
        below: [clampX(r.left), r.bottom + GAP],
        above: [clampX(r.left), r.top - GAP - h],
      };
      const covered = ([cx, cy]) => {
        const ix = clampX(cx), iy = clampY(cy);
        const ox = Math.max(0, Math.min(ix + w, r.right) - Math.max(ix, r.left));
        const oy = Math.max(0, Math.min(iy + h, r.bottom) - Math.max(iy, r.top));
        return ox * oy;
      };
      const order = [side, 'right', 'left', 'below', 'above'].filter(Boolean);
      const pick = order.find((s) => covered(spots[s]) === 0)
        || order.reduce((best, s) => (covered(spots[s]) < covered(spots[best]) ? s : best));
      [x, y] = [clampX(spots[pick][0]), clampY(spots[pick][1])];
    }
    box.style.left = `${x}px`;
    box.style.top = `${y}px`;
  }

  function showDocs(docs) {
    $('doc-win').hidden = !docs;
    if (!docs) return;
    const [head, ...body] = docs.text.split('\n');
    $('doc-title').textContent = docs.title;
    const page = $('doc-text');
    page.innerHTML = '';
    const t = document.createElement('span');
    t.className = 'doc-title';
    t.textContent = head;
    page.append(t, document.createTextNode(body.join('\n').replace(/^\n+/, '')));
  }

  // ── Timing ─────────────────────────────────────────────────────────────────
  // Long enough to read the callout twice at an ordinary pace.
  let duration = 0, elapsed = 0, paused = false, hovered = false, lastTick = 0, ticking = false;

  function readingTime(stop) {
    return stop.ms || Math.max(6500, Math.min(13000, 3000 + 42 * (stop.title.length + stop.body.length)));
  }

  function tick(now) {
    if (!ticking) return;
    const dt = lastTick ? now - lastTick : 0;
    lastTick = now;
    if (!paused && !hovered && duration) {
      elapsed += dt;
      $('callout-fill').style.width = `${Math.min(100, (elapsed / duration) * 100)}%`;
      if (elapsed >= duration) { ticking = false; next(); return; }
    }
    requestAnimationFrame(tick);
  }

  function startClock(ms) {
    duration = ms; elapsed = 0; lastTick = 0;
    $('callout-fill').style.width = '0%';
    if (!ticking) { ticking = true; requestAnimationFrame(tick); }
  }

  function stopClock() { ticking = false; duration = 0; }

  function setPaused(p) {
    paused = p;
    $('btn-pause').textContent = p ? '▶' : '❚❚';
    $('btn-pause').setAttribute('aria-label', p ? 'Play' : 'Pause');
  }

  // ── Moving between stops ───────────────────────────────────────────────────
  async function veil(on) {
    $('veil').classList.toggle('on', on);
    await new Promise((r) => setTimeout(r, on ? 230 : 10));
  }

  function renderCallout(stop, k) {
    const last = k === chapter.stops.length - 1;
    const idx = CHAPTERS.indexOf(chapter);
    const following = CHAPTERS[idx + 1];
    $('callout-step').textContent = `${chapter.title} · ${k + 1} of ${chapter.stops.length}`;
    $('callout-title').textContent = stop.title;
    $('callout-body').textContent = stop.body;
    $('callout-foot').hidden = false;
    $('btn-back').disabled = k === 0;
    $('btn-next').textContent = !last ? 'Next' : following ? `Next: ${following.title}` : 'Done';
    $('callout').hidden = false;
  }

  async function goTo(k) {
    const my = ++token;
    stopClock();
    const t = tools(my);
    await veil(true);
    try {
      if (k === at + 1 && at >= 0) {
        if (chapter.stops[k].setup) await chapter.stops[k].setup(t);
      } else {
        window.DEMO_STATE = null;
        window.DEMO_SCENARIO = chapter.scenario;
        await loadFrame('about:blank');
        for (let i = 0; i <= k; i++) if (chapter.stops[i].setup) await chapter.stops[i].setup(t);
      }
      // `spot` is one target; `spots` lights the region covering several.
      const stop = chapter.stops[k];
      const targets = stop.spots || (stop.spot ? [stop.spot] : []);
      let r = null;
      if (targets.length) {
        await t.scroll(targets[0], stop.block || 'center');
        await t.sleep(120);
        const els = [];
        for (const target of targets) els.push(await t.el(target));
        r = rectOf(els);
      }
      at = k;
      showDocs(stop.docs);
      renderCallout(stop, k);
      lightUp(r);
      place(r, stop.side, stop.at);
      await veil(false);
      startClock(readingTime(stop));
    } catch (err) {
      if (err instanceof Stale) return;
      console.error(err);
      $('callout-title').textContent = 'That stop didn’t load.';
      $('callout-body').textContent = 'Try Back, or pick the chapter again.';
      $('callout').hidden = false;
      lightUp(null);
      place(null);
      await veil(false);
    }
  }

  function next() {
    if (!chapter) return;
    if (at < chapter.stops.length - 1) return goTo(at + 1);
    const following = CHAPTERS[CHAPTERS.indexOf(chapter) + 1];
    return following ? play(following) : cover();
  }

  function back() {
    if (chapter && at > 0) goTo(at - 1);
  }

  function play(c) {
    chapter = c;
    at = -1;
    setPaused(false);
    drawMenu();
    return goTo(0);
  }

  // Before any chapter is picked: the finished dashboard, dimmed, and a line
  // saying what to do.
  async function cover() {
    const my = ++token;
    chapter = null; at = -1;
    stopClock();
    drawMenu();
    await veil(true);
    window.DEMO_STATE = null;
    window.DEMO_SCENARIO = 'teacher-reviewing';
    await loadFrame('/demo/dashboard.html');
    if (my !== token) return;
    showDocs(null);
    $('spot').classList.remove('off');
    Object.assign($('spot').style, { left: '640px', top: '400px', width: '0px', height: '0px' });
    $('callout-step').textContent = 'Five short chapters';
    $('callout-title').textContent = 'See Tau Thinking at work';
    $('callout-body').textContent = 'Pick a chapter above. Each is a few stops on the real screens — about half a minute.';
    $('callout-foot').hidden = true;
    $('callout').hidden = false;
    place(null);
    await veil(false);
  }

  // ── Menu and controls ──────────────────────────────────────────────────────
  function drawMenu() {
    $('chapters').innerHTML = CHAPTERS.map((c, i) => `
      <button type="button" class="chapter-card${c === chapter ? ' active' : ''}" data-i="${i}"
              aria-current="${c === chapter ? 'step' : 'false'}">
        <span class="chapter-card-head"><span class="chapter-n">${i + 1}</span>${c.title}</span>
        <span class="chapter-card-desc">${c.desc}</span>
      </button>`).join('');
    $('chapters').querySelectorAll('button').forEach((b) => {
      b.onclick = () => play(CHAPTERS[Number(b.dataset.i)]);
    });
  }

  $('btn-next').onclick = () => next();
  $('btn-back').onclick = () => back();
  $('btn-pause').onclick = () => setPaused(!paused);
  $('callout').addEventListener('mouseenter', () => { hovered = true; });
  $('callout').addEventListener('mouseleave', () => { hovered = false; });
  document.addEventListener('keydown', (e) => {
    if (!chapter || e.target.closest('input, textarea')) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); next(); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); back(); }
    else if (e.key === ' ') { e.preventDefault(); setPaused(!paused); }
  });

  const start = Number(new URLSearchParams(location.search).get('chapter'));
  if (start >= 1 && start <= CHAPTERS.length) play(CHAPTERS[start - 1]);
  else cover();
})();
