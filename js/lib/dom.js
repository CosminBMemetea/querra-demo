// Small DOM helpers. Content from JSON is always inserted as text, never as HTML.

export function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  setAttrs(el, attrs);
  append(el, children);
  return el;
}

const SVGNS = 'http://www.w3.org/2000/svg';
export function s(tag, attrs, ...children) {
  const el = document.createElementNS(SVGNS, tag);
  setAttrs(el, attrs);
  append(el, children);
  return el;
}

function setAttrs(el, attrs) {
  if (!attrs) return;
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') el.setAttribute('class', v);
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, String(v));
  }
}

function append(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

export async function loadJSON(name) {
  const res = await fetch(`content/${name}.json`, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`Could not load content/${name}.json (${res.status})`);
  return res.json();
}

export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (t) => t * t * (3 - 2 * t);
export const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const range = (t, a, b) => clamp((t - a) / (b - a));

/** Deterministic PRNG so illustrations look the same on every load. */
export function rng(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function badge(state, label) {
  return h('span', { class: `badge badge--${state}` }, label);
}

export function sectionHead({ kicker, title, id, lede }) {
  return h('div', { class: 'section-head' },
    h('div', null, h('p', { class: 'kicker' }, kicker), h('h2', { id }, title)),
    lede ? h('p', { class: 'lede' }, lede) : null
  );
}

/** A visible "missing" marker — used wherever evidence is not available. */
export function missing(text) {
  return h('em', { class: 'missing' }, text || 'not supplied');
}
