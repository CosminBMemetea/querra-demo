// "The M4 loop": predict → plan → capture → review → decide → feed back.
// Architecture (edge / mixed / cloud) and connectivity (online / intermittent / offline)
// change where steps run and which links are down. Observation tokens flow around the
// loop and pile up in a buffer when a link is unavailable. A behaviour model only.
import { h, s, sectionHead, badge } from '../lib/dom.js';
import { prefs, onPrefs } from '../lib/prefs.js';

const W = 760, H = 556, CX = 380, CY = 282, RX = 206, RY = 192;
const WHERE = {
  m4: { edge: 'cache', mixed: 'cloud', cloud: 'cloud' },
  plan: { edge: 'edge', mixed: 'web', cloud: 'web' },
  capture: { edge: 'edge', mixed: 'edge', cloud: 'edge' },
  review: { edge: 'manual', mixed: 'web', cloud: 'web' },
  decide: { edge: 'people', mixed: 'people', cloud: 'people' },
  feedback: { edge: 'manual', mixed: 'cloud', cloud: 'cloud' },
};
const WHERE_LABEL = { edge: 'Field unit', cloud: 'Cloud', web: 'Web view', people: 'People', manual: 'Manual', cache: 'Cached' };
const ICONS = {
  m4: 'M4 18l5-6 4 3 6-8 3 3M4 21h17',
  plan: 'M12 21s-6-5.3-6-10a6 6 0 0 1 12 0c0 4.7-6 10-6 10zM12 13a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  capture: 'M3 7h4l2-2h6l2 2h4v12H3zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  review: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c0-4 3.6-6 8-6M15 18l2 2 4-4',
  decide: 'M5 12l4 4L19 6',
  feedback: 'M20 12a8 8 0 1 1-2.3-5.6M20 4v5h-5',
};

const angleOf = (i, n) => -Math.PI / 2 + (i * 2 * Math.PI) / n;
const pt = (a, k = 1) => [CX + RX * k * Math.cos(a), CY + RY * k * Math.sin(a)];

export function renderLoop(root, d) {
  const wrap = h('div', { class: 'wrap' });
  wrap.append(sectionHead({ kicker: d.kicker, title: d.title, id: 'loop-title', lede: d.lede }));

  const nodes = d.nodes;
  const N = nodes.length;
  let arch = 'mixed', conn = 'online', sel = nodes.findIndex((n) => n.id === 'capture');

  // ---------- SVG ----------
  const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, class: 'loop-svg', role: 'group', 'aria-label': 'The M4 loop diagram' });
  svg.append(s('defs', null,
    s('marker', { id: 'loop-arrow', viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' },
      s('path', { d: 'M1,1 L9,5 L1,9', fill: 'none', stroke: 'context-stroke', 'stroke-width': 1.6 }))));
  svg.append(s('ellipse', { cx: CX, cy: CY, rx: RX, ry: RY, fill: 'none', stroke: '#E4DCCB', 'stroke-width': 26, opacity: 0.55 }));

  // centre label
  const centre = s('g', { class: 'loop-centre' });
  const cTitle = s('text', { x: CX, y: CY - 16, 'text-anchor': 'middle', class: 'loop-centre-title' });
  const cSub = s('text', { x: CX, y: CY + 8, 'text-anchor': 'middle', class: 'loop-centre-sub' });
  const cNote = s('text', { x: CX, y: CY + 30, 'text-anchor': 'middle', class: 'loop-centre-note' }, 'behaviour model · not measurements');
  centre.append(cTitle, cSub, cNote);
  svg.append(centre);

  // links (sampled along the ellipse, trimmed near nodes)
  const links = [];
  const linkLayer = s('g');
  svg.append(linkLayer);
  for (let i = 0; i < N; i++) {
    const a0 = angleOf(i, N) + 0.2, a1 = angleOf(i + 1, N) - 0.2;
    const pts = [];
    for (let k = 0; k <= 24; k++) pts.push(pt(a0 + ((a1 - a0) * k) / 24));
    const dpath = 'M' + pts.map((p) => p.map((v) => v.toFixed(1)).join(',')).join(' L');
    const id = `${nodes[i].id}-${nodes[(i + 1) % N].id}`;
    const path = s('path', { d: dpath, class: 'loop-link', 'marker-end': 'url(#loop-arrow)' });
    const mid = pt((a0 + a1) / 2);
    const cross = s('g', { class: 'loop-cross', transform: `translate(${mid[0].toFixed(1)},${mid[1].toFixed(1)})` },
      s('circle', { r: 9 }), s('path', { d: 'M-4,-4 L4,4 M4,-4 L-4,4' }));
    linkLayer.append(path, cross);
    links.push({ id, path, cross, a0, a1, state: 'up' });
  }

  // nodes
  const nodeEls = nodes.map((n, i) => {
    const a = angleOf(i, N);
    const [x, y] = pt(a);
    const [lx, ly] = pt(a, 1.0);
    const out = Math.cos(a);
    const anchor = Math.abs(out) < 0.2 ? 'middle' : out > 0 ? 'start' : 'end';
    const labelX = lx + (Math.abs(out) < 0.2 ? 0 : out > 0 ? 46 : -46);
    const labelY = ly + (Math.abs(out) < 0.2 ? (Math.sin(a) < 0 ? -66 : 62) : -4);
    const g = s('g', { class: 'loop-node', tabindex: '0', role: 'button', 'aria-label': `${i + 1}. ${n.title}` });
    g.append(s('circle', { cx: x, cy: y, r: 34, class: 'loop-node-disc' }));
    g.append(s('g', { transform: `translate(${(x - 12).toFixed(1)},${(y - 12).toFixed(1)})` }, s('path', { d: ICONS[n.id], class: 'loop-node-icon' })));
    g.append(s('text', { x: labelX, y: labelY, 'text-anchor': anchor, class: 'loop-node-label' }, `${i + 1} · ${n.short}`));
    g.append(s('text', { x: x + (out >= 0 ? 30 : -30), y: y - 26, 'text-anchor': 'middle', class: 'loop-node-num' }, String(i + 1)));
    const tag = s('text', { x: labelX, y: labelY + 17, 'text-anchor': anchor, class: 'loop-node-tag' });
    g.append(tag);
    const buf = s('g', { class: 'loop-buffer' });
    g.append(buf);
    g.addEventListener('click', () => select(i));
    g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(i); } });
    svg.append(g);
    return { g, tag, buf, x, y, a, out };
  });
  const tokenLayer = s('g', { class: 'loop-tokens' });
  svg.append(tokenLayer);

  // compact step list (shown on small screens; also a plain keyboard route)
  const legendBtns = nodes.map((n, i) => {
    const b = h('button', { type: 'button' }, h('span', { class: 'n' }, String(i + 1)), h('span', { class: 'l' }, n.short), h('span', { class: 'w' }));
    b.addEventListener('click', () => select(i));
    return b;
  });
  const legendList = h('ol', { class: 'loop-legend', 'aria-label': 'Loop steps' }, legendBtns.map((b) => h('li', null, b)));

  // ---------- controls & panels ----------
  const archBtns = d.architectures.map((a) => h('button', { type: 'button', 'aria-pressed': 'false' }, a.label, a.proposed ? h('span', { class: 'prop' }, 'proposed') : null));
  const connBtns = d.connectivity.map((c) => h('button', { type: 'button', 'aria-pressed': 'false' }, c.label));
  archBtns.forEach((b, i) => b.addEventListener('click', () => { arch = d.architectures[i].id; update(); }));
  connBtns.forEach((b, i) => b.addEventListener('click', () => { conn = d.connectivity[i].id; update(); }));

  const behTitle = h('h3');
  const behList = h('ul', { class: 'loop-beh' });
  const detail = h('div', { class: 'loop-detail', 'aria-live': 'polite' });
  const panel = h('div', { class: 'loop-panel' },
    h('div', { class: 'loop-controls' },
      h('div', null, h('span', { class: 'loop-ctl-label', id: 'loop-arch-l' }, 'Architecture'), h('div', { class: 'seg', role: 'group', 'aria-labelledby': 'loop-arch-l' }, archBtns)),
      h('div', null, h('span', { class: 'loop-ctl-label', id: 'loop-conn-l' }, 'Connectivity in the field'), h('div', { class: 'seg', role: 'group', 'aria-labelledby': 'loop-conn-l' }, connBtns))),
    h('div', { class: 'loop-behaviour' }, behTitle, behList, h('p', { class: 'loop-model-note' }, badge('concept', 'Behaviour model'), ' ', d.modelNote)),
    detail);

  const measures = h('div', { class: 'loop-foot' },
    h('div', { class: 'loop-box' }, h('h3', null, d.measures.title), h('ul', null, d.measures.items.map((t) => h('li', null, t)))),
    h('div', { class: 'loop-box loop-kpi' }, h('h3', null, d.kpi.title), h('p', null, d.kpi.text)));

  wrap.append(h('div', { class: 'loop-grid' }, h('div', { class: 'loop-figure' }, svg, legendList), panel), measures);
  root.append(wrap);

  // ---------- state ----------
  function linkState(id, t) {
    const broken = d.brokenLinks[arch][conn].includes(id);
    if (!broken) return 'up';
    if (arch === 'edge') return 'manual';
    if (conn === 'intermittent') return (Math.floor(t / 3.5) % 2 === 0) ? 'up-flicker' : 'down';
    return 'down';
  }

  function select(i) {
    sel = i;
    const n = nodes[i];
    nodeEls.forEach((ne, j) => ne.g.classList.toggle('is-selected', j === i));
    legendBtns.forEach((b, j) => b.setAttribute('aria-current', j === i ? 'step' : 'false'));
    detail.replaceChildren(
      h('p', { class: 'kicker' }, `Step ${i + 1}`),
      h('h3', null, n.title),
      h('p', { class: 'loop-status' }, badge(n.status === 'partial' ? 'actual' : 'planned', n.statusLabel)),
      h('p', null, n.text),
      h('dl', null,
        h('dt', null, 'Runs'), h('dd', null, n.runs[arch]),
        h('dt', null, 'Interface'), h('dd', null, n.interface)));
  }

  function update() {
    archBtns.forEach((b, i) => b.setAttribute('aria-pressed', String(d.architectures[i].id === arch)));
    connBtns.forEach((b, i) => b.setAttribute('aria-pressed', String(d.connectivity[i].id === conn)));
    const A = d.architectures.find((a) => a.id === arch), C = d.connectivity.find((c) => c.id === conn);
    behTitle.textContent = `${A.label} (${A.tier}) · ${C.label}`;
    behList.replaceChildren(...d.behaviour[arch][conn].map((t) => h('li', null, t)));
    cTitle.textContent = A.label;
    cSub.textContent = `${A.tier} · ${C.label.toLowerCase()}`;
    nodeEls.forEach((ne, i) => {
      const w = WHERE[nodes[i].id][arch];
      ne.tag.textContent = WHERE_LABEL[w];
      ne.g.dataset.where = w;
      legendBtns[i].querySelector('.w').textContent = WHERE_LABEL[w];
      legendBtns[i].dataset.where = w;
    });
    select(sel);
    paintLinks(clock);
    if (staticMode()) drawStatic();
  }

  function paintLinks(t) {
    links.forEach((l) => {
      l.state = linkState(l.id, t);
      l.path.dataset.state = l.state;
      l.cross.style.opacity = l.state === 'down' ? '1' : '0';
    });
  }

  // ---------- tokens ----------
  // Observations start at "capture" and travel capture→review→decide→feedback→m4→plan→capture.
  const startIdx = nodes.findIndex((n) => n.id === 'capture');
  let tokens = [];
  let clock = 0, spawnT = 0, raf = 0, last = 0, inView = false;
  const buffers = new Map(); // node index → count waiting

  function staticMode() { return prefs.paused || prefs.reduced || !inView; }

  function drawBuffers() {
    nodeEls.forEach((ne, i) => {
      const n = buffers.get(i) || 0;
      ne.buf.replaceChildren();
      if (!n) return;
      const dir = ne.out >= 0 ? 1 : -1;
      const bx = ne.x + dir * 44, by = ne.y + 30;
      for (let k = 0; k < Math.min(n, 12); k++) {
        ne.buf.append(s('circle', { cx: bx + dir * (k % 4) * 11, cy: by + Math.floor(k / 4) * 11, r: 4.2, class: 'loop-buf-dot' }));
      }
      const label = nodes[i].id === 'capture' ? 'buffered on the field unit' : arch === 'edge' ? 'waiting for manual export' : 'waiting for the link';
      ne.buf.append(s('text', { x: bx - dir * 2, y: by + Math.ceil(Math.min(n, 12) / 4) * 11 + 12, 'text-anchor': dir > 0 ? 'start' : 'end', class: 'loop-buf-label' }, label));
    });
  }

  function drawStatic() {
    tokenLayer.replaceChildren();
    buffers.clear();
    // show where observations would wait in this configuration
    for (let i = 0; i < N; i++) {
      const l = links[(startIdx + i) % N];
      if (l.state === 'down' || l.state === 'manual') { buffers.set((startIdx + i) % N, 6); break; }
    }
    drawBuffers();
  }

  function step(dt) {
    clock += dt;
    paintLinks(clock);
    spawnT -= dt;
    if (spawnT <= 0) { tokens.push({ seg: startIdx, u: 0, waiting: false }); spawnT = 2.4; }
    buffers.clear();
    links.forEach((l) => { l.cool = Math.max(0, (l.cool || 0) - dt); });
    tokens.forEach((tk) => {
      const l = links[tk.seg % N];
      if (tk.u === 0) {
        // a token waits at a node while its outgoing link is unavailable;
        // when the link returns, waiting tokens are released one by one
        const blocked = l.state === 'down' || l.state === 'manual' || l.cool > 0;
        tk.waiting = blocked;
        if (!blocked) l.cool = 0.45;
      }
      if (!tk.waiting) tk.u += dt / 1.5;
      if (tk.u >= 1) { tk.u = 0; tk.seg = (tk.seg + 1) % N; tk.hops = (tk.hops || 0) + 1; }
    });
    tokens = tokens.filter((tk) => (tk.hops || 0) < N);
    const waiting = new Map();
    tokens.forEach((tk) => { if (tk.waiting) waiting.set(tk.seg % N, (waiting.get(tk.seg % N) || 0) + 1); });
    waiting.forEach((n, i) => buffers.set(i, n));
    tokens = tokens.slice(-40);
    // draw moving tokens
    tokenLayer.replaceChildren();
    tokens.forEach((tk) => {
      if (tk.waiting) return;
      const l = links[tk.seg % N];
      const a = l.a0 + (l.a1 - l.a0) * tk.u;
      const [x, y] = pt(a);
      tokenLayer.append(s('circle', { cx: x.toFixed(1), cy: y.toFixed(1), r: 6, class: 'loop-token' }));
    });
    drawBuffers();
  }

  function frame(now) {
    raf = 0;
    const dt = Math.min(0.06, (now - last) / 1000);
    last = now;
    if (staticMode()) return;
    step(dt);
    raf = requestAnimationFrame(frame);
  }
  function run() {
    if (staticMode()) { if (raf) cancelAnimationFrame(raf); raf = 0; drawStatic(); return; }
    if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); }
  }

  // headless capture: let a test drive the simulation step by step
  if (prefs.capture) window.__loop = { step: (dt, n = 1) => { for (let i = 0; i < n; i++) step(dt); }, set: (a, c) => { arch = a; conn = c; update(); }, state: () => ({ tokens: tokens.length, buffers: [...buffers.entries()] }) };
  onPrefs(run);
  new IntersectionObserver(([e]) => { inView = e.isIntersecting; run(); }, { threshold: 0.15 }).observe(svg);
  update();
  run();
}
