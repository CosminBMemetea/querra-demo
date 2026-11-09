import { h } from '../lib/dom.js';

export function renderFooter(root, f, sources) {
  root.append(h('div', { class: 'wrap' },
    h('div', null,
      h('h2', null, 'One perception core. A whole growing season.'),
      h('p', null, f.boundary),
      h('p', null, f.privacy),
      h('p', null, f.contact)),
    h('div', null,
      h('h3', null, 'Credits and licences'),
      h('ul', null, f.credits.map((c) => h('li', null, c.href ? h('a', { href: c.href, rel: 'noopener', target: '_blank' }, c.item) : c.item, ` · ${c.detail}`)))),
    h('p', { class: 'fine' }, 'Demo preview · shared by QUERRA for discussion. Programme references: ', sources.map((s, i) => [i ? ' · ' : '', h('a', { href: s.href, rel: 'noopener', target: '_blank' }, s.label)]))));
}
