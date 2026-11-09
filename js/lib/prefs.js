// Viewer preferences: reduced motion, pause, and 3D vs still images.
// Stored per browser (best effort); everything works when storage is unavailable.

const params = new URLSearchParams(location.search);
const mq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };

function read(key) { try { return localStorage.getItem(`querra:${key}`); } catch { return null; } }
function write(key, value) { try { localStorage.setItem(`querra:${key}`, value); } catch { /* storage blocked */ } }

const forcedMotion = params.get('motion'); // 'reduced' | 'full' (testing / previews)
const reduced = forcedMotion ? forcedMotion === 'reduced' : !!mq.matches;

const capture = params.has('capture'); // headless preview / still generation

export const prefs = {
  reduced,
  paused: reduced || capture || read('paused') === '1',
  view: params.get('view') || read('view') || 'auto', // 'auto' | '3d' | 'stills'
  capture,
};

const listeners = new Set();
export function onPrefs(fn) { listeners.add(fn); return () => listeners.delete(fn); }

export function setPref(key, value) {
  if (prefs[key] === value) return;
  prefs[key] = value;
  if (key === 'paused' && !prefs.capture) write('paused', value ? '1' : '0');
  if (key === 'view' && !prefs.capture) write('view', value);
  document.documentElement.classList.toggle('motion-paused', prefs.paused);
  listeners.forEach((fn) => fn(prefs, key));
}

if (mq.addEventListener && !forcedMotion) {
  mq.addEventListener('change', (e) => {
    setPref('reduced', e.matches);
    if (e.matches) setPref('paused', true);
  });
}
document.documentElement.classList.toggle('motion-paused', prefs.paused);
document.documentElement.classList.toggle('is-capture', capture);

export function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch { return false; }
}

/** Heuristic for constrained devices: fewer instances, lower pixel ratio. */
export function lowPower() {
  const conn = navigator.connection;
  if (conn && conn.saveData) return true;
  if (navigator.deviceMemory && navigator.deviceMemory <= 4) return true;
  if (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4) return true;
  return window.innerWidth < 700;
}
