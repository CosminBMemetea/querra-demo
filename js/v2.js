// QUERRA v2: hero reveal and a gentle pointer/scroll parallax. Respects reduced motion and pause.
import { prefs } from './lib/prefs.js';

const hero = document.getElementById('hero');
if (hero) {
  const root = document.documentElement;
  root.classList.add('js-v2');
  requestAnimationFrame(() => requestAnimationFrame(() => hero.classList.add('is-in')));

  const img = hero.querySelector('.hero-x-media');
  const fine = window.matchMedia('(pointer: fine)').matches;
  let px = 0, py = 0, sy = 0, raf = 0;
  const apply = () => {
    raf = 0;
    if (prefs.reduced || prefs.paused || prefs.capture) { img.style.transform = ''; return; }
    img.style.transform = `translate3d(${px * -14}px, ${py * -10 + sy * 0.18}px, 0)`;
  };
  const queue = () => { if (!raf) raf = requestAnimationFrame(apply); };
  if (fine) hero.addEventListener('pointermove', (e) => {
    const r = hero.getBoundingClientRect();
    px = (e.clientX - r.left) / r.width - 0.5; py = (e.clientY - r.top) / r.height - 0.5; queue();
  });
  window.addEventListener('scroll', () => { sy = Math.min(window.scrollY, hero.offsetHeight); queue(); }, { passive: true });
}
