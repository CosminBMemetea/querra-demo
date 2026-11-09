// "How it learns": a stepped, pausable explanation of the offline learning loop,
// plus a group-aware vs random split demonstration.
import { h, s, sectionHead, badge, rng } from '../lib/dom.js';
import { prefs, onPrefs } from '../lib/prefs.js';

const STEP_ICONS = {
  collect: 'M3 7h4l2-2h6l2 2h4v12H3zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  review: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c0-4 3.6-6 8-6M15 18l2 2 4-4',
  split: 'M4 5h5v5H4zM15 5h5v5h-5zM4 15h5v5H4zM15 15h5v5h-5z',
  train: 'M4 18V8l8-4 8 4v10M8 18v-6h8v6',
  evaluate: 'M6 11V8a6 6 0 0 1 12 0v3M5 11h14v10H5zM12 15v2',
  deploy: 'M12 3v12M7 10l5 5 5-5M5 21h14',
  monitor: 'M3 12h4l3-7 4 14 3-7h4',
};
const GROUP_COLOURS = ['#2D5641', '#3D4A57', '#8A5809', '#6B4E39', '#6E7F3A', '#6A4C6B'];

export function renderLearning(root, d) {
  const wrap = h('div', { class: 'wrap' });
  wrap.append(sectionHead({ kicker: d.kicker, title: d.title, id: 'learning-title', lede: 'The device photographs and infers. People review. Learning happens later, offline, on frozen data, and ships only as an approved version.' }));
  wrap.append(h('div', { class: 'learn-status' }, badge('planned', d.status)));

  const flow = h('div', { class: 'learn-flow', role: 'group', 'aria-label': 'Learning steps' });
  const stepBtns = d.steps.map((st, i) => {
    const b = h('button', { type: 'button', class: 'learn-step', 'aria-pressed': 'false' },
      h('span', { class: 'n' }, String(i + 1).padStart(2, '0')),
      h('span', { class: 'l' }, st.label),
      s('svg', { class: 'ic', viewBox: '0 0 24 24', 'aria-hidden': 'true' }, s('path', { d: STEP_ICONS[st.id] || STEP_ICONS.collect })));
    b.addEventListener('click', () => { setStep(i); setPlaying(false); });
    flow.append(b);
    return b;
  });
  const loop = h('div', { class: 'learn-loop', 'aria-hidden': 'true' },
    s('svg', { viewBox: '0 0 1000 34', preserveAspectRatio: 'none' },
      s('path', { d: 'M960,2 C960,30 940,30 900,30 L100,30 C60,30 40,30 40,2', fill: 'none', stroke: '#C3B8A3', 'stroke-width': 1.5, 'stroke-dasharray': '5 5', 'vector-effect': 'non-scaling-stroke' }),
      s('path', { d: 'M34,10 L40,2 L46,10', fill: 'none', stroke: '#C3B8A3', 'stroke-width': 1.5, 'vector-effect': 'non-scaling-stroke' })));
  const loopNote = h('p', { class: 'visually-hidden' }, 'After monitoring, new reviewed data flows back to collection for the next approved version.');

  const textTitle = h('h3');
  const textBody = h('p');
  const playBtn = h('button', { type: 'button', class: 'btn', 'aria-pressed': 'false' });
  const prevBtn = h('button', { type: 'button', class: 'btn' }, '← Previous');
  const nextBtn = h('button', { type: 'button', class: 'btn' }, 'Next →');
  const text = h('div', { class: 'learn-text', 'aria-live': 'polite' },
    h('p', { class: 'kicker' }, 'Step'),
    textTitle, textBody,
    h('div', { class: 'learn-controls' }, prevBtn, playBtn, nextBtn),
    h('ul', { class: 'guardrails' }, d.guardrails.map((g) => h('li', null, g))));

  // split demo
  const sd = d.splitDemo;
  const svgW = 540, svgH = 270;
  const svg = s('svg', { viewBox: `0 0 ${svgW} ${svgH}`, role: 'img', 'aria-label': 'Photos grouped by station and visit are assigned to train, validation or test as whole groups.' });
  const bins = { train: { y: 18, label: 'Train' }, validation: { y: 102, label: 'Validation' }, test: { y: 186, label: 'Test (locked)' } };
  Object.entries(bins).forEach(([k, b]) => {
    svg.append(s('rect', { x: 300, y: b.y, width: 228, height: 70, rx: 8, fill: k === 'test' ? '#F3EEE3' : '#FBF8F1', stroke: k === 'test' ? '#2B2E2F' : '#C3B8A3', 'stroke-dasharray': k === 'test' ? '0' : '4 3' }));
    svg.append(s('text', { x: 310, y: b.y + 15, 'font-family': 'IBM Plex Mono, monospace', 'font-size': 10.5, fill: '#3A3D39' }, b.label));
  });
  const groupsG = s('g');
  svg.append(groupsG);
  const dots = [];
  sd.groups.forEach((g, gi) => {
    const col = gi % 2, row = Math.floor(gi / 2);
    const gx = 18 + col * 136, gy = 18 + row * 84;
    groupsG.append(s('rect', { x: gx, y: gy, width: 124, height: 70, rx: 8, fill: 'none', stroke: '#DDD4C3' }));
    groupsG.append(s('text', { x: gx + 8, y: gy + 15, 'font-family': 'IBM Plex Mono, monospace', 'font-size': 9.5, fill: '#5B5F58' }, g.id));
    for (let k = 0; k < g.n; k++) {
      const hx = gx + 16 + (k % 4) * 26, hy = gy + 34 + Math.floor(k / 4) * 22;
      const c = s('circle', { cx: 0, cy: 0, r: 7.5, fill: GROUP_COLOURS[gi % GROUP_COLOURS.length], class: 'split-dot', stroke: '#FBF8F1', 'stroke-width': 1.5 });
      c.style.transform = `translate(${hx}px, ${hy}px)`;
      svg.append(c);
      dots.push({ el: c, g: gi, home: [hx, hy] });
    }
  });
  const leakG = s('g', { class: 'split-leak', opacity: 0 });
  svg.append(leakG);

  function layout(mode) {
    const fill = { train: 0, validation: 0, test: 0 };
    const r = rng(5);
    const assign = dots.map((dt) => (mode === 'group' ? sd.assignment[dt.g] : ['train', 'train', 'validation', 'test'][Math.floor(r() * 4)]));
    const pos = dots.map((dt, i) => {
      const bin = assign[i];
      const k = fill[bin]++;
      return [314 + (k % 11) * 19, bins[bin].y + 32 + Math.floor(k / 11) * 20];
    });
    dots.forEach((dt, i) => (dt.el.style.transform = `translate(${pos[i][0]}px, ${pos[i][1]}px)`));
    leakG.replaceChildren();
    if (mode === 'random') {
      sd.groups.forEach((g, gi) => {
        const idx = dots.map((dt, i) => [dt, i]).filter(([dt]) => dt.g === gi);
        const tr = idx.find(([, i]) => assign[i] === 'train'), te = idx.find(([, i]) => assign[i] === 'test');
        if (tr && te) leakG.append(s('line', { x1: pos[tr[1]][0], y1: pos[tr[1]][1], x2: pos[te[1]][0], y2: pos[te[1]][1], stroke: '#8E3B22', 'stroke-width': 1.6, 'stroke-dasharray': '3 3' }));
      });
      leakG.append(s('text', { x: 300, y: 266, 'font-family': 'IBM Plex Mono, monospace', 'font-size': 10, fill: '#8E3B22' }, 'Leak: the same group appears in train and test'));
    }
    leakG.setAttribute('opacity', mode === 'random' ? 1 : 0);
  }
  const modeGroup = h('button', { type: 'button', 'aria-pressed': 'true' }, 'Group-aware');
  const modeRandom = h('button', { type: 'button', 'aria-pressed': 'false' }, 'Random (leaks)');
  const modeHome = h('button', { type: 'button', 'aria-pressed': 'false' }, 'Unsplit');
  const setMode = (m) => {
    modeGroup.setAttribute('aria-pressed', String(m === 'group'));
    modeRandom.setAttribute('aria-pressed', String(m === 'random'));
    modeHome.setAttribute('aria-pressed', String(m === 'home'));
    if (m === 'home') { dots.forEach((dt) => (dt.el.style.transform = `translate(${dt.home[0]}px, ${dt.home[1]}px)`)); leakG.setAttribute('opacity', 0); }
    else layout(m);
  };
  modeGroup.addEventListener('click', () => setMode('group'));
  modeRandom.addEventListener('click', () => setMode('random'));
  modeHome.addEventListener('click', () => setMode('home'));
  const split = h('div', { class: 'split-card' },
    h('header', null, h('h3', null, sd.title), h('div', { class: 'seg', role: 'group', 'aria-label': 'Split method' }, modeHome, modeGroup, modeRandom)),
    svg,
    h('p', { class: 'note' }, sd.note));

  wrap.append(flow, loop, loopNote, h('div', { class: 'learn-detail' }, text, split));
  root.append(wrap);

  // stepping
  let step = 0;
  let playing = !prefs.paused && !prefs.reduced;
  let inView = false;
  let timer = 0;
  function setStep(i) {
    step = (i + d.steps.length) % d.steps.length;
    stepBtns.forEach((b, j) => b.setAttribute('aria-pressed', String(j === step)));
    const st = d.steps[step];
    textTitle.textContent = `${String(step + 1).padStart(2, '0')} · ${st.label}`;
    textBody.textContent = st.text;
    if (st.id === 'split') setMode('group');
  }
  function schedule() {
    clearInterval(timer);
    const run = playing && inView && !prefs.paused && !prefs.reduced;
    if (run) timer = setInterval(() => setStep(step + 1), 3600);
  }
  function setPlaying(v) {
    playing = v;
    playBtn.setAttribute('aria-pressed', String(v));
    playBtn.textContent = v ? 'Pause steps' : 'Play steps';
    schedule();
  }
  playBtn.addEventListener('click', () => setPlaying(!playing));
  prevBtn.addEventListener('click', () => { setPlaying(false); setStep(step - 1); });
  nextBtn.addEventListener('click', () => { setPlaying(false); setStep(step + 1); });
  onPrefs(() => schedule());
  new IntersectionObserver(([e]) => { inView = e.isIntersecting; schedule(); }, { threshold: 0.25 }).observe(flow);

  setStep(0);
  setPlaying(playing);
  setMode('group');
}
