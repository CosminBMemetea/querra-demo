// Evidence panel: each item carries state, source, scope, sample count, date,
// configuration and limitations. Missing fields are rendered as visible gaps.
import { h, sectionHead, badge, missing } from '../lib/dom.js';

const ORDER = ['measured', 'replay', 'planned', 'concept'];

/** SHA-256 fingerprint of an evidence export, with a link to the file when published. */
function integrityNode(g) {
  if (!g.sha256) return missing(g.missing || 'No export file attached yet');
  return h('span', { class: 'ev-hash' },
    g.file ? h('a', { href: g.file, download: '' }, g.file.split('/').pop()) : null,
    g.bytes ? h('span', { class: 'ev-bytes' }, ` · ${Number(g.bytes).toLocaleString('en-GB')} bytes`) : null,
    h('code', { title: 'SHA-256. Check with: shasum -a 256 <file>' }, `SHA-256 ${g.sha256.slice(0, 16)}…${g.sha256.slice(-8)}`));
}

export function renderEvidence(root, d) {
  const wrap = h('div', { class: 'wrap' });
  wrap.append(sectionHead({ kicker: d.kicker, title: d.title, id: 'evidence-title', lede: d.body }));

  const counts = Object.fromEntries(ORDER.map((k) => [k, d.items.filter((i) => i.state === k).length]));
  let filter = 'all';
  const legendBtns = {};
  const legend = h('div', { class: 'ev-legend', role: 'group', 'aria-label': 'Filter evidence by state' });
  ORDER.forEach((k) => {
    const st = d.states[k];
    const b = h('button', { type: 'button', 'aria-pressed': 'false' },
      badge(k, st.label),
      h('span', { class: 'help' }, st.help),
      h('span', { class: 'count' }, `${counts[k]} item${counts[k] === 1 ? '' : 's'} · filter`));
    b.addEventListener('click', () => setFilter(filter === k ? 'all' : k));
    legendBtns[k] = b;
    legend.append(b);
  });

  const showing = h('span', { class: 'showing', 'aria-live': 'polite' });
  const allBtn = h('button', { type: 'button', class: 'btn' }, 'Show all');
  allBtn.addEventListener('click', () => setFilter('all'));
  const grid = h('div', { class: 'ev-grid' });

  const field = (label, value, missingText) => [
    h('dt', null, label),
    h('dd', null, value != null && value !== '' ? value : missing(missingText)),
  ];

  const cards = d.items.map((it) => {
    const st = d.states[it.state];
    const src = it.source || {};
    const sourceNode = src.href
      ? h('a', { href: src.href, ...(src.href.startsWith('#') ? {} : { rel: 'noopener', target: '_blank' }) }, src.label || src.href)
      : (src.label || null);
    const needsExport = it.state === 'measured' && !src.href;
    const card = h('article', { class: 'ev-card', dataset: { state: it.state }, 'aria-labelledby': `ev-${it.id}` },
      h('div', { class: 'top' }, badge(it.state, st.label), needsExport ? h('span', { class: 'ev-warn' }, '⚠ Source export missing') : null),
      h('h3', { id: `ev-${it.id}` }, it.title),
      h('p', { class: 'result' }, it.result),
      h('dl', null,
        field('Source', sourceNode, src.missing),
        field('Scope', it.scope),
        field('Samples', it.samples),
        field('Date', it.date, it.dateMissing),
        field('Configuration', it.configuration),
        it.integrity ? [h('dt', null, 'Integrity'), h('dd', null, integrityNode(it.integrity))] : null),
      h('ul', { class: 'limits', 'aria-label': 'Limitations' }, it.limitations.map((l) => h('li', null, l))));
    grid.append(card);
    return { card, state: it.state };
  });

  function setFilter(k) {
    filter = k;
    ORDER.forEach((s) => legendBtns[s].setAttribute('aria-pressed', String(s === k)));
    let n = 0;
    cards.forEach((c) => { const on = k === 'all' || c.state === k; c.card.hidden = !on; if (on) n++; });
    showing.textContent = k === 'all' ? `Showing all ${n} items` : `Showing ${n} · ${d.states[k].label}`;
    allBtn.hidden = k === 'all';
  }

  wrap.append(legend, h('div', { class: 'ev-filter-row' }, showing, allBtn), grid,
    h('div', { class: 'ev-excluded' }, h('h3', null, d.excluded.title), h('ul', null, d.excluded.items.map((t) => h('li', null, t)))));
  root.append(wrap);
  setFilter('all');
}
