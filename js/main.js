import { h, loadJSON } from './lib/dom.js';
import { prefs, setPref, onPrefs } from './lib/prefs.js';
import { renderEvolution } from './sections/evolution.js';
import { renderDevice } from './sections/device.js';
import { renderTRL } from './sections/trl.js';
import { renderSeason } from './sections/season.js';
import { renderLearning } from './sections/learning.js';
import { renderEvidence } from './sections/evidence.js';
import { renderProgramme } from './sections/programme.js';
import { renderFooter } from './sections/footer.js';
import { renderLoop } from './sections/loop.js';
import { renderRequirements } from './sections/requirements.js';
import { renderLandscape } from './sections/landscape.js';

async function boot() {
  const names = ['site', 'evolution', 'loop', 'trl', 'season', 'learning', 'evidence', 'programme', 'requirements', 'landscape'];
  let content;
  try {
    const loaded = await Promise.all(names.map(loadJSON));
    content = Object.fromEntries(names.map((n, i) => [n, loaded[i]]));
  } catch (err) {
    console.error(err);
    document.getElementById('main').prepend(h('div', { class: 'error-box', role: 'alert' },
      'Content could not be loaded. Serve the site over HTTP (see README: python3 serve.py), not from file://. ', String(err.message || err)));
    return;
  }

  renderNav(content.site.nav);
  setupMotionToggle();

  const tasks = [
    () => renderEvolution(document.getElementById('evolution'), content.evolution, content.site),
    () => renderLoop(document.getElementById('loop'), content.loop),
    () => renderDevice(document.getElementById('device'), content.site.device),
    () => renderTRL(document.getElementById('trl'), content.trl),
    () => renderSeason(document.getElementById('season'), content.season),
    () => renderLearning(document.getElementById('learning'), content.learning),
    () => renderEvidence(document.getElementById('evidence'), content.evidence),
    () => renderLandscape(document.getElementById('landscape'), content.landscape),
    () => renderProgramme(document.getElementById('programme'), content.programme),
    () => renderRequirements(document.getElementById('fit'), content.requirements),
    () => renderFooter(document.getElementById('footer'), content.site.footer, content.programme.sources),
  ];
  for (const t of tasks) {
    try { await t(); } catch (err) { console.error(err); }
  }
  trackActiveNav();
  if (location.hash) document.querySelector(location.hash)?.scrollIntoView();
  window.__querraReady = true;
}

function renderNav(items) {
  const ul = document.getElementById('site-nav');
  items.forEach((it) => ul.append(h('li', null, h('a', { href: it.href }, it.label))));
}

function setupMotionToggle() {
  const btn = document.getElementById('motion-toggle');
  const label = btn.querySelector('.tool-label');
  const sync = () => {
    btn.setAttribute('aria-pressed', String(prefs.paused));
    label.textContent = prefs.paused ? 'Play motion' : 'Pause motion';
    btn.title = prefs.reduced ? 'Reduced motion is on in your system settings' : '';
  };
  btn.addEventListener('click', () => setPref('paused', !prefs.paused));
  onPrefs(sync);
  sync();
}

function trackActiveNav() {
  const links = [...document.querySelectorAll('#site-nav a')];
  const map = new Map(links.map((a) => [a.getAttribute('href').slice(1), a]));
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      links.forEach((a) => a.removeAttribute('aria-current'));
      map.get(e.target.id)?.setAttribute('aria-current', 'true');
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  map.forEach((_, id) => { const el = document.getElementById(id); if (el) io.observe(el); });
}

boot();
