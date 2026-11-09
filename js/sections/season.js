// Growing-season explorer: a procedural, illustrative canopy (side cross-section and
// a top-down "camera frame"), and what is recorded / observed / reviewed per stage.
import { h, s, sectionHead, rng, badge } from '../lib/dom.js';

const ICONS = {
  farmer: 'M4 20c0-4 3.6-6 8-6s8 2 8 6M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  device: 'M3 7h4l2-2h6l2 2h4v12H3zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  expert: 'M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.8 3h10.4a2 2 0 0 0 1.8-3l-5-9V3',
  evidence: 'M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h7',
};

const PX_PER_CM = 2.3;
const SURFACE = 272;
const W = 800, H = 384;

function colourFor(ripe, t = 0) {
  // green → yellow-green → gold → straw
  const stops = [[0, [79, 124, 58]], [0.35, [138, 160, 70]], [0.7, [201, 168, 88]], [1, [214, 190, 132]]];
  const r = Math.min(1, Math.max(0, ripe + t));
  for (let i = 1; i < stops.length; i++) {
    if (r <= stops[i][0]) {
      const [a, ca] = stops[i - 1], [b, cb] = stops[i];
      const k = (r - a) / (b - a);
      return `rgb(${ca.map((v, j) => Math.round(v + (cb[j] - v) * k)).join(',')})`;
    }
  }
  return 'rgb(214,190,132)';
}

function leafD(x, y, ang, len, curl, w) {
  // a tapered blade from (x,y): angle in radians from vertical, curl bends it
  const dx = Math.sin(ang), dy = -Math.cos(ang);
  const mx = x + dx * len * 0.5 + Math.sin(ang + curl) * len * 0.15;
  const my = y + dy * len * 0.5 - Math.cos(ang + curl) * len * 0.05;
  const ex = x + Math.sin(ang + curl) * len, ey = y - Math.cos(ang + curl) * len * 0.92;
  const nx = -dy * w, ny = dx * w;
  return `M${x.toFixed(1)},${y.toFixed(1)} Q${(mx + nx).toFixed(1)},${(my + ny).toFixed(1)} ${ex.toFixed(1)},${ey.toFixed(1)} Q${(mx - nx).toFixed(1)},${(my - ny).toFixed(1)} ${x.toFixed(1)},${y.toFixed(1)}Z`;
}

function drawCanopy(svgEl, canopy) {
  svgEl.replaceChildren();
  const defs = s('defs', null,
    s('pattern', { id: 'soilpat', patternUnits: 'userSpaceOnUse', width: 220, height: 220 },
      s('image', { href: 'assets/textures/soil-diffuse.jpg', width: 220, height: 220, preserveAspectRatio: 'xMidYMid slice' })),
    s('linearGradient', { id: 'soilshade', x1: 0, y1: 0, x2: 0, y2: 1 },
      s('stop', { offset: '0', 'stop-color': '#2a1c12', 'stop-opacity': '0.05' }),
      s('stop', { offset: '1', 'stop-color': '#2a1c12', 'stop-opacity': '0.55' })),
    s('linearGradient', { id: 'airshade', x1: 0, y1: 0, x2: 0, y2: 1 },
      s('stop', { offset: '0', 'stop-color': '#F5F0E6' }),
      s('stop', { offset: '1', 'stop-color': '#E6DECD' })));
  svgEl.append(defs);
  svgEl.append(s('rect', { x: 0, y: 0, width: W, height: SURFACE, fill: 'url(#airshade)' }));

  // soil profile
  const r = rng(99);
  let surf = `M0,${SURFACE}`;
  for (let x = 0; x <= W; x += 20) surf += ` L${x},${SURFACE + (r() - 0.5) * 3}`;
  const soilPath = `${surf} L${W},${H} L0,${H} Z`;
  svgEl.append(s('path', { d: soilPath, fill: 'url(#soilpat)' }));
  svgEl.append(s('path', { d: soilPath, fill: 'url(#soilshade)' }));
  svgEl.append(s('path', { d: surf, fill: 'none', stroke: '#3a2a1d', 'stroke-width': 1.2, 'stroke-opacity': 0.6 }));

  // ruler
  const ruler = s('g', { 'font-family': 'IBM Plex Mono, monospace', 'font-size': 10, fill: '#5B5F58' });
  ruler.append(s('line', { x1: 44, y1: SURFACE, x2: 44, y2: SURFACE - 100 * PX_PER_CM, stroke: '#8a8577', 'stroke-width': 1 }));
  for (let cm = 0; cm <= 100; cm += 20) {
    const y = SURFACE - cm * PX_PER_CM;
    ruler.append(s('line', { x1: 38, y1: y, x2: 50, y2: y, stroke: '#8a8577' }));
    ruler.append(s('text', { x: 34, y: y + 3.5, 'text-anchor': 'end' }, String(cm)));
  }
  ruler.append(s('text', { x: 52, y: SURFACE - 100 * PX_PER_CM - 8 }, 'cm · illustrative'));
  svgEl.append(ruler);

  const kind = canopy.kind;
  const g = s('g', null);
  svgEl.append(g);
  const n = 8;
  for (let i = 0; i < n; i++) {
    const x = 128 + i * 82;
    const pr = rng(i * 131 + 7);
    const seedY = SURFACE + 3.5 * PX_PER_CM + pr() * 3;
    drawPlant(g, kind, x, seedY, canopy, pr);
  }
  if (kind === 'bare') {
    for (let i = 0; i < 40; i++) {
      const x = 60 + r() * 720;
      g.append(s('ellipse', { cx: x, cy: SURFACE - 1, rx: 3 + r() * 6, ry: 1.5 + r() * 2.5, fill: '#5d4431', 'fill-opacity': 0.75 }));
    }
  }
  if (kind === 'stubble' || kind === 'bare') {
    for (let i = 0; i < 60; i++) {
      const x = 60 + r() * 720, l = 6 + r() * 18, a = (r() - 0.5) * 0.5;
      g.append(s('line', { x1: x, y1: SURFACE - 1, x2: x + Math.cos(a) * l, y2: SURFACE - 1 - Math.sin(a) * 2, stroke: '#c9b07a', 'stroke-width': 1.4, 'stroke-linecap': 'round', 'stroke-opacity': kind === 'bare' ? 0.5 : 0.9 }));
    }
  }
  // station peg
  const peg = s('g', { transform: `translate(${W - 28},0)` });
  peg.append(s('rect', { x: -2, y: SURFACE - 120, width: 4, height: 150, fill: '#ece6d9', stroke: '#8a8577', 'stroke-width': 0.6 }));
  peg.append(s('rect', { x: -26, y: SURFACE - 140, width: 52, height: 22, rx: 2, fill: '#F4EFE4', stroke: '#1E3A2B', 'stroke-width': 1.2 }));
  peg.append(s('text', { x: 0, y: SURFACE - 125, 'text-anchor': 'middle', 'font-family': 'IBM Plex Mono, monospace', 'font-size': 10, fill: '#1E3A2B' }, 'STN-03'));
  svgEl.append(peg);
  if (kind === 'seed') {
    svgEl.append(s('text', { x: 400, y: H - 12, 'text-anchor': 'middle', 'font-family': 'IBM Plex Mono, monospace', 'font-size': 10.5, fill: '#F4EFE4' }, 'Cross-section illustration. The device cannot see seeds in the soil.'));
  }
}

function drawPlant(g, kind, x, seedY, c, pr) {
  if (kind === 'bare') return;
  const ripe = c.ripeness || 0;
  // seed
  g.append(s('ellipse', { cx: x, cy: seedY, rx: 3.2, ry: 1.8, fill: kind === 'seed' ? '#c89a52' : '#8f7445', stroke: '#5d4431', 'stroke-width': 0.6, transform: `rotate(${(pr() - 0.5) * 50} ${x} ${seedY})` }));
  if (kind === 'seed') {
    g.append(s('line', { x1: x, y1: seedY - 3, x2: x + (pr() - 0.5) * 3, y2: SURFACE + 1, stroke: '#2a1c12', 'stroke-width': 1, 'stroke-dasharray': '2 2', 'stroke-opacity': 0.5 }));
    return;
  }
  // roots
  const rootLen = { seedling: 22, tillering: 55, stem: 85, heading: 95, filling: 100, ripe: 100, stubble: 100 }[kind] || 40;
  const nr = kind === 'seedling' ? 3 : 7;
  for (let i = 0; i < nr; i++) {
    const a = (i / (nr - 1) - 0.5) * 1.6 + (pr() - 0.5) * 0.3;
    const L = rootLen * (0.6 + pr() * 0.4);
    const ex = x + Math.sin(a) * L * 0.6, ey = Math.min(H - 4, seedY + Math.cos(a) * L);
    g.append(s('path', { d: `M${x},${seedY} Q${x + Math.sin(a) * L * 0.2 + (pr() - 0.5) * 10},${seedY + L * 0.5} ${ex},${ey}`, fill: 'none', stroke: '#efe4cf', 'stroke-width': 1, 'stroke-opacity': 0.75 }));
  }
  g.append(s('line', { x1: x, y1: seedY, x2: x, y2: SURFACE, stroke: '#e9dcc0', 'stroke-width': 1.1 }));

  const H0 = (c.height || 0) * PX_PER_CM;
  const green = colourFor(ripe), dark = colourFor(ripe * 0.9, -0.08);
  if (kind === 'seedling') {
    g.append(s('path', { d: leafD(x, SURFACE, -0.12 + (pr() - 0.5) * 0.2, H0, 0.25, 2.2), fill: green }));
    g.append(s('path', { d: leafD(x, SURFACE, 0.35 + pr() * 0.2, H0 * 0.75, 0.5, 2), fill: dark }));
    return;
  }
  if (kind === 'tillering') {
    const nt = c.tillers || 4;
    for (let t = 0; t < nt; t++) {
      const a = (t / (nt - 1) - 0.5) * 1.1 + (pr() - 0.5) * 0.2;
      for (let l = 0; l < 3; l++) {
        const len = H0 * (0.55 + pr() * 0.5);
        g.append(s('path', { d: leafD(x, SURFACE, a + (l - 1) * 0.28, len, a * 0.9 + (pr() - 0.5) * 0.6, 2.4), fill: l === 1 ? green : dark, 'fill-opacity': 0.96 }));
      }
    }
    return;
  }
  if (kind === 'stubble') {
    const nt = c.tillers || 4;
    for (let t = 0; t < nt; t++) {
      const sx = x + (t - (nt - 1) / 2) * 3.2;
      const top = SURFACE - H0 * (0.8 + pr() * 0.3);
      g.append(s('line', { x1: sx, y1: SURFACE, x2: sx + (pr() - 0.5) * 3, y2: top, stroke: '#c7b07c', 'stroke-width': 2.4, 'stroke-linecap': 'butt' }));
      g.append(s('ellipse', { cx: sx, cy: top, rx: 1.4, ry: 0.7, fill: '#9c8656' }));
    }
    return;
  }
  // stemmed stages: stem, heading, filling, ripe
  const nt = c.tillers || 4;
  for (let t = 0; t < nt; t++) {
    const lean = (t / Math.max(1, nt - 1) - 0.5) * 0.22 + (pr() - 0.5) * 0.06;
    const hgt = H0 * (0.86 + pr() * 0.16);
    const tx = x + Math.sin(lean) * hgt, ty = SURFACE - Math.cos(lean) * hgt;
    const stemCol = colourFor(ripe, kind === 'ripe' ? 0 : -0.05);
    g.append(s('line', { x1: x + (t - nt / 2) * 1.2, y1: SURFACE, x2: tx, y2: ty, stroke: stemCol, 'stroke-width': 2, 'stroke-linecap': 'round' }));
    const leaves = kind === 'stem' ? 4 : 3;
    for (let l = 0; l < leaves; l++) {
      const f = 0.2 + (l / leaves) * 0.68;
      const lx = x + (tx - x) * f, ly = SURFACE + (ty - SURFACE) * f;
      g.append(s('circle', { cx: lx, cy: ly, r: 1.6, fill: colourFor(ripe, 0.06) }));
      const side = (l + t) % 2 ? 1 : -1;
      const senesce = kind === 'filling' ? (l === 0 ? 0.55 : l === 1 ? 0.25 : 0) : kind === 'ripe' ? 0.35 : 0;
      const col = colourFor(Math.min(1, ripe + senesce));
      const isFlag = l === leaves - 1;
      const len = (isFlag ? 30 : 42 + pr() * 14) * (kind === 'ripe' ? 0.75 : 1);
      const droop = kind === 'ripe' ? 1.25 : 0.65 + pr() * 0.4;
      g.append(s('path', { d: leafD(lx, ly, side * (0.45 + pr() * 0.3), len, side * droop, 2.3), fill: col, 'fill-opacity': kind === 'ripe' ? 0.8 : 0.95 }));
    }
    if (kind === 'stem') {
      // flag leaf emerging
      g.append(s('path', { d: leafD(tx, ty + 8, lean * 0.5, 22, 0.15, 1.8), fill: green }));
      continue;
    }
    // ear
    const earLen = 19, earW = kind === 'heading' ? 2.8 : 3.4;
    const nod = kind === 'ripe' ? 0.5 + pr() * 0.3 : kind === 'filling' ? 0.18 : 0.04;
    const ang = lean + nod * (lean >= 0 ? 1 : -1);
    const ex = tx + Math.sin(ang) * earLen, ey = ty - Math.cos(ang) * earLen;
    const earCol = kind === 'heading' ? '#a9b764' : colourFor(Math.max(ripe, 0.55));
    const earG = s('g', null);
    earG.append(s('path', { d: leafD(tx, ty, ang, earLen, 0, earW), fill: earCol, stroke: '#6d6a3b', 'stroke-width': 0.4 }));
    for (let k = 1; k < 6; k++) {
      const f = k / 6.2;
      const px = tx + (ex - tx) * f, py = ty + (ey - ty) * f;
      earG.append(s('line', { x1: px - Math.cos(ang) * earW, y1: py - Math.sin(ang) * earW, x2: px + Math.cos(ang) * earW, y2: py + Math.sin(ang) * earW, stroke: '#6d6a3b', 'stroke-width': 0.4, 'stroke-opacity': 0.6 }));
      if (kind === 'heading' && k % 2 === 0) {
        earG.append(s('rect', { x: px + earW * 0.9, y: py, width: 1.6, height: 3.2, fill: '#efe8b8', transform: `rotate(${(pr() - 0.5) * 40} ${px} ${py})` }));
      }
      if (kind === 'ripe' || kind === 'filling') {
        earG.append(s('line', { x1: px, y1: py, x2: px + Math.sin(ang + 0.5) * 9, y2: py - Math.cos(ang + 0.5) * 9, stroke: earCol, 'stroke-width': 0.6 }));
      }
    }
    g.append(earG);
  }
}

// ---------------------------------------------------------------- top-down frame
let soilImg = null;
function drawFrame(canvas, canopy, stageId) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width, hh = canvas.height;
  const r = rng(stageId.length * 97 + 3);
  if (!soilImg) {
    soilImg = new Image();
    soilImg.src = 'assets/textures/soil-diffuse.jpg';
    soilImg.onload = () => drawFrame(canvas, canopy, stageId);
  }
  ctx.fillStyle = '#5e4734';
  ctx.fillRect(0, 0, w, hh);
  if (soilImg.complete && soilImg.naturalWidth) ctx.drawImage(soilImg, 0, 0, 380, 285, 0, 0, w, hh);
  ctx.fillStyle = 'rgba(30,20,10,0.15)';
  ctx.fillRect(0, 0, w, hh);
  const rows = [w * 0.18, w * 0.5, w * 0.82];
  const kind = canopy.kind, ripe = canopy.ripeness || 0, cover = canopy.cover || 0;
  if (kind === 'seed' || kind === 'bare') {
    rows.forEach((x) => { ctx.strokeStyle = 'rgba(40,26,14,.45)'; ctx.lineWidth = 3; ctx.setLineDash([6, 5]); ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, hh); ctx.stroke(); ctx.setLineDash([]); });
  }
  if (kind === 'stubble') {
    for (let i = 0; i < 80; i++) { ctx.strokeStyle = `rgba(214,190,132,${0.5 + r() * 0.4})`; ctx.lineWidth = 2; const x = r() * w, y = r() * hh, a = r() * Math.PI; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * 30, y + Math.sin(a) * 30); ctx.stroke(); }
    rows.forEach((x) => { for (let y = 10; y < hh; y += 14) { ctx.fillStyle = '#b9a271'; ctx.beginPath(); ctx.arc(x + (r() - 0.5) * 10, y, 3.2, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#7d6a42'; ctx.beginPath(); ctx.arc(x + (r() - 0.5) * 10, y, 1.4, 0, Math.PI * 2); ctx.fill(); } });
  } else if (cover > 0) {
    const L = 14 + cover * 90;
    const per = kind === 'seedling' ? 2 : kind === 'tillering' ? 6 : 9;
    rows.forEach((x) => {
      for (let y = -10; y < hh + 10; y += kind === 'seedling' ? 16 : 22) {
        const px = x + (r() - 0.5) * 8, py = y + (r() - 0.5) * 8;
        for (let k = 0; k < per; k++) {
          const a = r() * Math.PI * 2, len = L * (0.4 + r() * 0.6);
          ctx.strokeStyle = colourFor(Math.min(1, ripe + (r() < 0.2 && kind === 'filling' ? 0.3 : 0)), (r() - 0.5) * 0.15);
          ctx.lineWidth = 2.2 + r() * 2.2;
          ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(px, py);
          ctx.quadraticCurveTo(px + Math.cos(a) * len * 0.5 + (r() - 0.5) * 10, py + Math.sin(a) * len * 0.5 + (r() - 0.5) * 10, px + Math.cos(a) * len, py + Math.sin(a) * len);
          ctx.stroke();
        }
        if (['heading', 'filling', 'ripe'].includes(kind)) {
          for (let k = 0; k < 3; k++) {
            ctx.fillStyle = kind === 'heading' ? '#b7c06f' : colourFor(Math.max(ripe, 0.6));
            ctx.beginPath(); ctx.ellipse(px + (r() - 0.5) * 26, py + (r() - 0.5) * 26, 3.5, 9, r() * Math.PI, 0, Math.PI * 2); ctx.fill();
          }
        }
      }
    });
  }
  // grey card and frame guides
  ctx.fillStyle = '#8f8f8b'; ctx.fillRect(w - 66, 10, 56, 40);
  ctx.strokeStyle = '#f4efe4'; ctx.lineWidth = 1; ctx.strokeRect(w - 66, 10, 56, 40);
  ctx.fillStyle = '#f4efe4'; ctx.font = '10px "IBM Plex Mono", monospace'; ctx.fillText('grey card', w - 63, 62);
  ctx.strokeStyle = 'rgba(244,239,228,.9)'; ctx.lineWidth = 2;
  const m = 8, cl = 18;
  [[m, m, 1, 1], [w - m, m, -1, 1], [m, hh - m, 1, -1], [w - m, hh - m, -1, -1]].forEach(([x, y, sx, sy]) => {
    ctx.beginPath(); ctx.moveTo(x, y + sy * cl); ctx.lineTo(x, y); ctx.lineTo(x + sx * cl, y); ctx.stroke();
  });
}

// ---------------------------------------------------------------- section
export function renderSeason(root, d) {
  const wrap = h('div', { class: 'wrap' });
  wrap.append(sectionHead({ kicker: d.kicker, title: d.title, id: 'season-title', lede: 'Pick a stage. Each one shows what the farmer records, what the device observes, what needs an expert, and what evidence carries forward. Missing data is shown, never filled in.' }));
  wrap.append(h('p', { class: 'assumption', role: 'note' }, h('strong', null, 'Planning assumption'), h('span', null, d.assumption)));

  const tablist = h('div', { class: 'season-tabs', role: 'tablist', 'aria-label': 'Season stages' });
  const tabs = d.stages.map((st, i) => {
    const t = h('button', { type: 'button', role: 'tab', class: 'season-tab', id: `stab-${st.id}`, 'aria-controls': 'season-panel', 'aria-selected': 'false', tabindex: '-1' },
      h('span', { class: 'dot', 'aria-hidden': 'true' }),
      h('span', { class: 't' }, st.label),
      h('span', { class: 'c' }, `${st.code} · ${st.months}`));
    t.addEventListener('click', () => select(i));
    t.addEventListener('keydown', (e) => {
      let j = null;
      if (e.key === 'ArrowRight') j = (i + 1) % tabs.length;
      if (e.key === 'ArrowLeft') j = (i - 1 + tabs.length) % tabs.length;
      if (e.key === 'Home') j = 0;
      if (e.key === 'End') j = tabs.length - 1;
      if (j != null) { e.preventDefault(); select(j); tabs[j].focus(); }
    });
    tablist.append(t);
    return t;
  });

  const svgEl = s('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-labelledby': 'canopy-desc' });
  const svgDesc = h('p', { id: 'canopy-desc', class: 'visually-hidden' });
  const legend = h('div', { class: 'canopy-legend' });
  const canopyCard = h('div', { class: 'canopy-card' }, legend, svgEl, svgDesc);
  const frameCanvas = h('canvas', { width: 400, height: 300, role: 'img', 'aria-label': 'Illustrative top-down camera frame at station STN-03' });
  const frameCard = h('div', { class: 'frame-card' }, frameCanvas, h('span', { class: 'cap' }, 'Illustrative frame · not a device photo'));
  const stageHead = h('div', { class: 'season-stage-head' });
  const cols = h('div', { class: 'season-cols' });
  const panel = h('div', { class: 'season-panel', id: 'season-panel', role: 'tabpanel', tabindex: '0' },
    h('div', { class: 'season-visual' }, canopyCard, h('div', { class: 'frame-row' }, frameCard, stageHead)),
    cols);

  function select(i) {
    const st = d.stages[i];
    tabs.forEach((t, j) => { t.setAttribute('aria-selected', String(j === i)); t.tabIndex = j === i ? 0 : -1; });
    panel.setAttribute('aria-labelledby', `stab-${st.id}`);
    drawCanopy(svgEl, st.canopy);
    drawFrame(frameCanvas, st.canopy, st.id);
    svgDesc.textContent = `Illustrative cross-section of a cereal row at ${st.label}. Not observed or measured growth.`;
    legend.replaceChildren(badge('concept', 'Illustration'), h('span', { class: 'chip' }, `${st.code} · ${st.months} (assumed)`));
    stageHead.replaceChildren(
      h('h3', null, st.label),
      h('div', { class: 'meta' }, h('span', { class: 'chip' }, st.code), h('span', { class: 'chip' }, `${st.months} · planning assumption`)),
    );
    cols.replaceChildren(
      ...['farmer', 'device', 'expert', 'evidence'].map((k) => h('div', { class: 'season-col', dataset: { col: k } },
        h('h4', null, s('svg', { viewBox: '0 0 24 24', 'aria-hidden': 'true' }, s('path', { d: ICONS[k] })), d.columns[k]),
        h('ul', null, st[k].map((t) => h('li', null, t))))),
      h('div', { class: 'season-col season-missing', dataset: { col: 'missing' } },
        h('h4', null, 'Missing data'),
        ...st.missing.map((m) => h('p', null, h('em', { class: 'missing' }, m)))),
    );
  }

  wrap.append(tablist, panel);

  // record format strip
  const rf = d.recordFormat;
  wrap.append(h('div', { class: 'record-strip' },
    h('header', null, h('h3', null, rf.title), h('span', { class: 'note' }, rf.note)),
    h('dl', { class: 'record-fields' }, rf.fields.map((f) => h('div', null, h('dt', null, f.label), h('dd', null, ['station', 'visit', 'specimen'].includes(f.key) ? h('code', null, f.example) : f.example))))));

  // public replay strip
  const rp = d.replay;
  const grid = h('div', { class: 'replay-months', role: 'img', 'aria-label': `${rp.weather}; ${rp.eo}; missing: ${rp.missingMonths.join(', ')}` });
  grid.append(h('span'), ...rp.months.map((m) => h('span', { class: 'm' }, m)));
  grid.append(h('span', { class: 'rl' }, 'Weather'), ...rp.months.map(() => h('span', { class: 'wx' })));
  grid.append(h('span', { class: 'rl' }, 'Sentinel-2'), ...rp.months.map((m) => h('span', { class: `eo${rp.missingMonths.includes(m) ? ' is-missing' : ''}` }, h('span'))));
  wrap.append(h('div', { class: 'replay-strip' },
    h('header', null, badge('replay', 'Historical public replay'), h('h3', null, rp.title), h('span', { class: 'chip' }, rp.range)),
    h('p', { class: 'visually-hidden' }, `${rp.weather}. ${rp.eo}.`),
    grid,
    h('p', { class: 'caveat' }, `${rp.weather} · ${rp.eo}. ${rp.caveat}`)));

  root.append(wrap);
  select(4);
}
