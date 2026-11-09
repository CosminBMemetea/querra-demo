// "Call fit": every requirement from the official documents, our response and an
// honest status. Filter by category and status, or search.
import { h, sectionHead } from '../lib/dom.js';

const ORDER = ['in-place', 'planned', 'decision', 'gap'];

export function renderRequirements(root, d) {
  const wrap = h('div', { class: 'wrap' });
  wrap.append(sectionHead({ kicker: d.kicker, title: d.title, id: 'fit-title', lede: d.lede }));

  const items = d.items;
  const cats = [...new Set(items.map((i) => i.cat))];
  const count = (st) => items.filter((i) => i.status === st).length;
  let cat = 'all', status = 'all', q = '';

  // summary bar
  const bar = h('div', { class: 'fit-bar', role: 'img', 'aria-label': ORDER.map((st) => `${count(st)} ${d.statuses[st].label}`).join(', ') });
  ORDER.forEach((st) => { const n = count(st); if (n) bar.append(h('span', { class: `fit-seg fit-${st}`, style: { flexGrow: String(n) } }, String(n))); });
  const statusBtns = {};
  const legend = h('div', { class: 'fit-legend', role: 'group', 'aria-label': 'Filter by status' },
    ORDER.map((st) => {
      const b = h('button', { type: 'button', class: `fit-chip fit-${st}`, 'aria-pressed': 'false' },
        h('span', { class: 'sw', 'aria-hidden': 'true' }),
        h('strong', null, `${count(st)} · ${d.statuses[st].label}`),
        h('span', { class: 'help' }, d.statuses[st].help));
      b.addEventListener('click', () => { status = status === st ? 'all' : st; render(); });
      statusBtns[st] = b;
      return b;
    }));

  const catBtns = {};
  const catRow = h('div', { class: 'fit-cats', role: 'group', 'aria-label': 'Filter by category' },
    ['all', ...cats].map((c) => {
      const b = h('button', { type: 'button', 'aria-pressed': 'false' }, c === 'all' ? 'All' : c);
      b.addEventListener('click', () => { cat = c; render(); });
      catBtns[c] = b;
      return b;
    }));
  const search = h('input', { type: 'search', class: 'fit-search', placeholder: 'Search requirements, e.g. MQTT, ONNX, TRL', 'aria-label': 'Search requirements' });
  search.addEventListener('input', () => { q = search.value.trim().toLowerCase(); render(); });
  const showing = h('p', { class: 'fit-showing', 'aria-live': 'polite' });

  const list = h('ol', { class: 'fit-list' });
  const rows = items.map((it) => {
    const href = d.sources[it.src];
    const row = h('li', { class: 'fit-row', dataset: { status: it.status } },
      h('div', { class: 'fit-ref' },
        h('span', { class: 'fit-cat' }, it.cat),
        href ? h('a', { href, rel: 'noopener', target: '_blank' }, it.src) : h('span', null, it.src),
        h('span', { class: 'fit-sec' }, it.ref)),
      h('p', { class: 'fit-req' }, it.req),
      h('div', { class: 'fit-resp' }, h('p', null, it.resp), it.evidence ? h('p', { class: 'fit-ev' }, 'Evidence: ', it.evidence) : null),
      h('span', { class: `fit-status fit-${it.status}` }, h('span', { class: 'sw', 'aria-hidden': 'true' }), d.statuses[it.status].label));
    list.append(row);
    return { row, it, text: `${it.cat} ${it.src} ${it.ref} ${it.req} ${it.resp} ${it.evidence || ''}`.toLowerCase() };
  });

  function render() {
    ORDER.forEach((st) => statusBtns[st].setAttribute('aria-pressed', String(status === st)));
    Object.entries(catBtns).forEach(([c, b]) => b.setAttribute('aria-pressed', String(cat === c)));
    let n = 0;
    rows.forEach(({ row, it, text }) => {
      const on = (cat === 'all' || it.cat === cat) && (status === 'all' || it.status === status) && (!q || text.includes(q));
      row.hidden = !on;
      if (on) n++;
    });
    showing.textContent = `Showing ${n} of ${items.length} requirements`;
  }

  wrap.append(
    h('div', { class: 'fit-summary' }, bar, legend),
    h('div', { class: 'fit-filters' }, catRow, search),
    showing,
    h('div', { class: 'fit-head', 'aria-hidden': 'true' }, h('span', null, 'Source'), h('span', null, 'Requirement'), h('span', null, 'Our response'), h('span', null, 'Status')),
    list,
    h('p', { class: 'fit-checked' }, d.checked));
  root.append(wrap);
  render();
}
