// "Where QUERRA fits": the value chain from forecast to action with QUERRA's step marked,
// a category comparison (categories, not companies), honest strengths and gaps, and why
// QUERRA does not build its own robot. All text comes from content/landscape.json.
import { h, sectionHead } from '../lib/dom.js';

export function renderLandscape(root, d) {
  const wrap = h('div', { class: 'wrap' });
  wrap.append(sectionHead({ kicker: d.kicker, title: d.title, id: 'landscape-title', lede: d.lede }));

  // value chain
  const chain = h('ol', { class: 'ls-chain', 'aria-label': 'From forecast to action' },
    d.chain.map((c, i) => h('li', { class: c.querra ? 'is-querra' : null },
      h('span', { class: 'ls-step' }, String(i + 1).padStart(2, '0')),
      h('strong', null, c.label),
      h('span', { class: 'ls-who' }, c.who))));
  wrap.append(h('figure', { class: 'ls-chain-fig' }, chain, h('figcaption', null, d.chainNote)));

  // category comparison (a real table, restacked on small screens)
  const cols = [['strong', 'Good at'], ['stops', 'Where it stops'], ['relation', 'How QUERRA relates']];
  wrap.append(h('div', { class: 'ls-table-wrap' },
    h('table', { class: 'ls-table' },
      h('caption', null, d.tableCaption),
      h('thead', null, h('tr', null, h('th', { scope: 'col' }, 'Category'), cols.map(([, l]) => h('th', { scope: 'col' }, l)))),
      h('tbody', null, d.categories.map((c) => h('tr', null,
        h('th', { scope: 'row' }, c.name),
        cols.map(([k, l]) => h('td', { 'data-label': l, class: k === 'relation' ? 'ls-rel' : null }, c[k]))))))));

  // strengths and gaps side by side
  wrap.append(h('div', { class: 'ls-pair' },
    h('section', { class: 'ls-card ls-apart', 'aria-labelledby': 'ls-apart-title' },
      h('h3', { id: 'ls-apart-title' }, d.apartTitle),
      h('ul', null, d.apart.map((t) => h('li', null, t)))),
    h('section', { class: 'ls-card ls-behind', 'aria-labelledby': 'ls-behind-title' },
      h('h3', { id: 'ls-behind-title' }, d.behindTitle),
      h('ul', null, d.behind.map((t) => h('li', null, t))))));

  // why no robot of our own
  const c = d.carrier;
  wrap.append(h('aside', { class: 'ls-carrier', 'aria-labelledby': 'ls-carrier-title' },
    h('h3', { id: 'ls-carrier-title' }, c.title),
    h('p', null, c.body),
    h('ul', { class: 'ls-src' }, c.sources.map((s) => h('li', null, h('a', { href: s.href, rel: 'noopener' }, s.label))))));

  wrap.append(h('details', { class: 'ls-more' },
    h('summary', null, 'Other sources used in this section'),
    h('ul', { class: 'ls-src' }, d.sources.map((s) => h('li', null, h('a', { href: s.href, rel: 'noopener' }, s.label))))));

  root.append(wrap);
}
