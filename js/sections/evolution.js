// Product evolution: scroll-linked stages (native scrolling, no hijacking),
// an accessible stage selector, a 3D view with orbit, and a still-image fallback.
import { h, badge, clamp } from '../lib/dom.js';
import { prefs, onPrefs, setPref, webglAvailable, lowPower } from '../lib/prefs.js';

export function renderEvolution(root, evo, site) {
  const stages = evo.stages;
  const stepsEl = root.querySelector('#evo-steps');
  const visualEl = root.querySelector('#evo-visual');

  // ---------- Left column: hero copy + one article per stage ----------
  const titleParts = site.title.split('. ');
  stepsEl.append(
    h('header', { class: 'hero-copy' },
      h('p', { class: 'kicker' }, evo.intro.kicker),
      h('h2', { id: 'hero-title', class: 'evo-title' }, 'From the bench ', h('em', null, 'to the field.')),
      h('p', { class: 'lede' }, site.lead),
      h('p', { class: 'hero-note' }, site.heroNote),
      site.heroLinks ? h('ul', { class: 'hero-links' }, site.heroLinks.map((l) => h('li', null, h('a', { href: l.href }, l.label, h('span', { 'aria-hidden': 'true' }, ' →'))))) : null,
      h('div', { class: 'not-list' },
        h('h2', null, 'It does not currently'),
        h('ul', null, site.doesNot.map((t) => h('li', null, t)))
      )
    )
  );

  const stepEls = [];
  stages.forEach((st, i) => {
    if (i > 0 && st.scope === 'beyond' && stages[i - 1].scope !== 'beyond') {
      stepsEl.append(h('div', { class: 'evo-boundary', role: 'separator', 'aria-label': evo.boundary.title },
        h('span', { class: 'label' }, 'Boundary'),
        h('h2', null, evo.boundary.title),
        h('p', null, evo.boundary.body)));
    }
    const art = h('article', { class: 'evo-step', id: `stage-${st.id}`, dataset: { stage: i }, 'aria-labelledby': `stage-${st.id}-title` },
      h('div', { class: 'evo-card' },
        h('div', { class: 'evo-meta' },
          badge(st.reality === 'actual' ? 'actual' : 'concept', st.badge),
          st.scope === 'beyond' ? badge('beyond', 'Beyond TRL7') : null,
          h('span', { class: 'when' }, st.when)),
        h('h2', { id: `stage-${st.id}-title` }, st.title),
        h('p', null, st.body),
        h('ul', null, st.points.map((p) => h('li', null, p))),
        h('p', { class: 'trl-line' }, st.trl)
      )
    );
    stepEls.push(art);
    stepsEl.append(art);
  });

  // ---------- Right column: sticky visual ----------
  const canvasHost = h('div', { class: 'evo-canvas', tabindex: '0', role: 'img',
    'aria-label': 'Interactive 3D view of the current stage. Drag, or use the arrow keys while focused, to orbit. Press 0 to reset.' });
  const loading = h('div', { class: 'evo-loading' }, 'Loading 3D view…');
  const stills = h('div', { class: 'evo-stills' });
  const stillImgs = stages.map((st, i) => {
    const img = h('img', { src: st.still, alt: st.stillAlt, loading: i < 2 ? 'eager' : 'lazy', decoding: 'async', class: i === 0 ? 'is-photo' : null });
    img.addEventListener('error', () => {
      img.replaceWith(h('div', { class: 'still-missing', dataset: { i } }, `Still image for “${st.label}” has not been generated yet (see README → Stills).`));
    });
    stills.append(img);
    return img;
  });
  const caption = h('div', { class: 'evo-caption', 'aria-live': 'polite' });
  const photo = h('figure', { class: 'evo-photo' },
    h('img', { src: site.device.photo, alt: 'Photograph of the actual prototype.', width: 210, height: 280 }),
    h('figcaption', null, site.device.scan ? 'Photograph · actual prototype. The 3D view opens on a scan of the same unit.' : 'Photograph · actual prototype. The 3D view is an approximation.'));
  const coreLabel = h('div', { class: 'evo-core-label', 'aria-hidden': 'true' }, 'Perception core');
  coreLabel.style.opacity = '0';

  const viewBtns = {
    '3d': h('button', { type: 'button', 'aria-pressed': 'false' }, '3D'),
    stills: h('button', { type: 'button', 'aria-pressed': 'false' }, 'Stills'),
  };
  const resetBtn = h('button', { type: 'button', class: 'btn orbit-only' }, 'Reset view');
  const tools = h('div', { class: 'evo-tools' },
    h('span', { class: 'hint orbit-only' }, 'Drag to orbit'),
    resetBtn,
    h('div', { class: 'seg', role: 'group', 'aria-label': 'Visual mode' }, viewBtns['3d'], viewBtns.stills)
  );
  const frame = h('div', { class: 'evo-frame', dataset: { view: 'stills' } }, canvasHost, stills, loading, coreLabel, caption, photo, tools);

  const selector = h('ol', { class: 'evo-selector', 'aria-label': 'Evolution stages' });
  const selBtns = [];
  stages.forEach((st, i) => {
    if (i > 0 && st.scope === 'beyond' && stages[i - 1].scope !== 'beyond') {
      selector.append(h('li', { class: 'sep', 'aria-hidden': 'true' }, h('span', null, 'Beyond TRL7')));
    }
    const b = h('button', { type: 'button', 'aria-controls': `stage-${st.id}` },
      h('span', { class: 'n' }, `${String(i + 1).padStart(2, '0')} · ${st.scope === 'beyond' ? 'concept' : (st.reality === 'actual' ? 'actual' : 'funded scope')}`),
      h('span', null, st.label));
    b.addEventListener('click', () => goTo(i));
    b.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); selBtns[Math.min(i + 1, stages.length - 1)].focus(); }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); selBtns[Math.max(i - 1, 0)].focus(); }
    });
    selBtns.push(b);
    selector.append(h('li', { class: st.scope === 'beyond' ? 'beyond' : null }, b));
  });
  visualEl.append(frame, h('nav', { 'aria-label': 'Stage selector' }, selector));

  // ---------- Scroll → progress ----------
  const anchorRatio = () => (window.innerWidth <= 980 ? 0.64 : 0.5);
  let progress = 0;
  let active = -1;
  let scene = null;

  function computeProgress() {
    const anchor = window.innerHeight * anchorRatio();
    const tops = stepEls.map((el) => el.getBoundingClientRect().top);
    if (anchor <= tops[0]) return 0;
    for (let i = 0; i < tops.length - 1; i++) {
      if (anchor < tops[i + 1]) {
        const f = (anchor - tops[i]) / (tops[i + 1] - tops[i]);
        let t = clamp((f - 0.42) / 0.5);
        if (prefs.reduced) t = t < 0.5 ? 0 : 1; // no tweened transitions
        return i + t;
      }
    }
    return tops.length - 1;
  }

  function goTo(i) {
    const el = stepEls[i];
    const top = window.scrollY + el.getBoundingClientRect().top - window.innerHeight * anchorRatio() + 4;
    window.scrollTo({ top, behavior: prefs.reduced || prefs.capture ? 'auto' : 'smooth' });
    if (prefs.capture) onScroll();
  }

  function setActive(i) {
    if (i === active) return;
    active = i;
    const st = stages[i];
    selBtns.forEach((b, j) => (j === i ? b.setAttribute('aria-current', 'step') : b.removeAttribute('aria-current')));
    stepEls.forEach((el, j) => el.classList.toggle('is-active', j === i));
    // keep the active stage visible in the (horizontally scrollable) selector
    const b = selBtns[i];
    if (selector.scrollWidth > selector.clientWidth) selector.scrollTo({ left: Math.max(0, b.offsetLeft - 12), behavior: prefs.reduced || prefs.capture ? 'auto' : 'smooth' });
    caption.replaceChildren(
      badge(st.reality === 'actual' ? 'actual' : 'concept', st.reality === 'actual' ? (frame.dataset.view === '3d' ? (site.device.scan ? '3D scan of the actual prototype' : '3D approximation of actual hardware') : 'Photograph · actual hardware') : 'Concept visualisation'),
      st.scope === 'beyond' ? badge('beyond', 'Beyond the funded TRL7 project') : h('span', { class: 'scope-note' }, st.when)
    );
    stillImgs.forEach((img, j) => img.classList && img.classList.toggle('is-on', j === i));
    photo.classList.toggle('is-hidden', !(i === 0 && frame.dataset.view === '3d'));
  }

  let ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    (prefs.capture ? (f) => setTimeout(f, 0) : requestAnimationFrame)(() => {
      ticking = false;
      progress = computeProgress();
      setActive(Math.round(progress));
      scene?.setProgress(progress);
    });
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);

  // ---------- 3D / stills ----------
  function setView(v) {
    frame.dataset.view = v;
    viewBtns['3d'].setAttribute('aria-pressed', String(v === '3d'));
    viewBtns.stills.setAttribute('aria-pressed', String(v === 'stills'));
    const i = active; active = -1; setActive(Math.max(0, i));
    scene?.setVisible(v === '3d');
  }

  let loadingScene = null;
  async function ensureScene() {
    if (scene || loadingScene) return loadingScene;
    loadingScene = (async () => {
      try {
        const mod = await import('../three/scene.js');
        scene = await mod.createEvolutionScene(canvasHost, {
          lowPower: lowPower(),
          capture: prefs.capture,
          paused: prefs.paused,
          reduced: prefs.reduced,
          scan: site.device.scan || null,
          onCore: (pos) => {
            if (!pos || !pos.visible) { coreLabel.style.opacity = '0'; return; }
            coreLabel.style.opacity = '1';
            coreLabel.style.transform = `translate(${pos.x}px, ${pos.y}px) translate(-50%, -100%) translateY(-14px)`;
          },
        });
        resetBtn.addEventListener('click', () => scene.resetView());
        if (prefs.capture) window.__evoScene = scene;
        scene.setProgress(computeProgress());
        loading.style.opacity = '0';
        setTimeout(() => (loading.hidden = true), 450);
        return scene;
      } catch (err) {
        console.warn('3D view unavailable, using stills.', err);
        loading.textContent = '3D view unavailable on this device. Showing still images.';
        setView('stills');
        viewBtns['3d'].disabled = true;
        setTimeout(() => (loading.style.opacity = '0'), 2500);
        return null;
      }
    })();
    return loadingScene;
  }

  viewBtns['3d'].addEventListener('click', async () => { setPref('view', '3d'); setView('3d'); await ensureScene(); });
  viewBtns.stills.addEventListener('click', () => { setPref('view', 'stills'); setView('stills'); });

  onPrefs((p, key) => {
    if (key === 'paused') scene?.setPaused(p.paused);
    if (key === 'reduced') { scene?.setReduced(p.reduced); onScroll(); }
  });

  const want3D = prefs.view === '3d' || (prefs.view === 'auto' && !(navigator.connection && navigator.connection.saveData));
  if (want3D && webglAvailable()) {
    setView('3d');
    ensureScene();
  } else {
    if (!webglAvailable()) { viewBtns['3d'].disabled = true; viewBtns['3d'].title = 'WebGL is not available in this browser'; }
    setView('stills');
    loading.style.opacity = '0';
  }

  progress = computeProgress();
  setActive(Math.round(progress));
}
