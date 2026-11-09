import { h, sectionHead } from '../lib/dom.js';
import { prefs } from '../lib/prefs.js';

export function renderDevice(root, d) {
  const wrap = h('div', { class: 'wrap' });
  wrap.append(sectionHead({
    kicker: 'The actual device',
    title: 'What exists on the bench today',
    id: 'device-title',
    lede: 'One Jetson-based core and its camera path. The website shows it. It does not connect to it.',
  }));

  const imgWrap = h('div', { class: 'annot-img' },
    h('img', { src: d.photo, alt: d.alt, width: d.photoWidth, height: d.photoHeight, loading: 'lazy', decoding: 'async' }));
  const caption = h('figcaption', null, d.caption);
  const fig = h('figure', { class: 'annotated' }, imgWrap, caption);
  if (d.scan) addScanToggle(fig, imgWrap, caption, d);
  const list = h('ol', { class: 'hotspot-list', 'aria-label': 'Labelled parts of the photograph' });
  const spots = [];
  const items = [];

  const select = (i) => {
    spots.forEach((b, j) => b.setAttribute('aria-expanded', String(j === i)));
    items.forEach((li, j) => li.classList.toggle('is-active', j === i));
  };

  d.hotspots.forEach((hs, i) => {
    const btn = h('button', { type: 'button', class: 'hotspot', style: { left: `${hs.x}%`, top: `${hs.y}%` },
      'aria-label': `${i + 1}: ${hs.label}`, 'aria-expanded': 'false', 'aria-describedby': `hs-${i}` }, String(i + 1));
    btn.addEventListener('click', () => select(i));
    btn.addEventListener('mouseenter', () => select(i));
    btn.addEventListener('focus', () => select(i));
    imgWrap.append(btn);
    spots.push(btn);
    const li = h('li', { id: `hs-${i}` },
      h('span', { class: 'num', 'aria-hidden': 'true' }, String(i + 1)),
      h('div', null, h('strong', null, hs.label), h('span', { class: 'd' }, hs.detail)));
    li.addEventListener('mouseenter', () => select(i));
    list.append(li);
    items.push(li);
  });

  const caps = h('div', { class: 'cap-grid' },
    d.capabilities.map((c) => h('div', { class: 'cap-col', dataset: { state: c.state } },
      h('h3', null, c.label),
      h('ul', null, c.items.map((t) => h('li', null, t))))));

  wrap.append(h('div', { class: 'device-grid' },
    fig,
    h('div', null,
      list,
      caps,
      h('p', { class: 'not-pictured' }, 'Not in the photograph: ', d.notPictured.join('; '), '.'),
      h('p', { class: 'note-box' }, d.healthNote))));
  root.append(wrap);
}

// Photo / 3D scan toggle. Only rendered when content/site.json → device.scan is set.
function addScanToggle(fig, imgWrap, caption, d) {
  const scan = d.scan;
  const btn = { photo: h('button', { type: 'button', 'aria-pressed': 'true' }, 'Photo'), scan: h('button', { type: 'button', 'aria-pressed': 'false' }, '3D scan') };
  const host = h('div', { class: 'scan-view', tabindex: '0', role: 'img', hidden: true,
    'aria-label': 'Interactive 3D scan of the actual prototype. Drag, or use the arrow keys while focused, to rotate; + and − zoom; 0 resets.' });
  const status = h('p', { class: 'scan-status', 'aria-live': 'polite' });
  const scanCaption = scan.caption || `3D scan of the actual prototype${scan.captured ? `, captured ${scan.captured}` : ''}. Drag to rotate.`;
  let viewer = null, loading = null;

  function setMode(m) {
    btn.photo.setAttribute('aria-pressed', String(m === 'photo'));
    btn.scan.setAttribute('aria-pressed', String(m === 'scan'));
    imgWrap.hidden = m !== 'photo';
    host.hidden = m !== 'scan';
    caption.textContent = m === 'scan' ? scanCaption : d.caption;
    if (m === 'scan' && !viewer && !loading) {
      status.textContent = 'Loading the 3D scan…';
      loading = import('../three/scan-viewer.js')
        .then((mod) => mod.mountScanViewer(host, scan, { capture: prefs.capture }))
        .then((v) => { viewer = v; status.textContent = ''; if (prefs.capture) window.__scanViewer = v; })
        .catch((err) => { console.warn(err); status.textContent = 'The 3D scan could not be loaded. Showing the photograph.'; loading = null; setMode('photo'); });
    }
  }
  btn.photo.addEventListener('click', () => setMode('photo'));
  btn.scan.addEventListener('click', () => setMode('scan'));
  fig.prepend(h('div', { class: 'device-view' }, h('div', { class: 'seg', role: 'group', 'aria-label': 'Device view' }, btn.photo, btn.scan), status));
  imgWrap.after(host);
}
