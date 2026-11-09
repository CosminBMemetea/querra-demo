import { h, sectionHead } from '../lib/dom.js';

export function renderTRL(root, d) {
  const wrap = h('div', { class: 'wrap' });
  wrap.append(sectionHead({ kicker: d.kicker, title: d.title, id: 'trl-title', lede: d.body }));

  const ladder = h('ol', { class: 'trl-ladder' });
  d.levels.forEach((l) => {
    ladder.append(h('li', { class: 'trl-row', dataset: { state: l.state } },
      h('span', { class: 'lvl' }, l.level),
      h('div', null,
        h('div', { class: 'name' }, l.name),
        h('p', { class: 'text' }, l.text),
        l.note ? h('p', { class: 'note' }, l.note) : null),
      h('span', { class: 'state' }, l.stateLabel)));
  });
  const boundary = h('div', { class: 'trl-boundary' },
    h('span', { class: 'label' }, 'Beyond the funded TRL7 project'),
    h('ul', { class: 'trl-beyond' }, d.beyond.map((b) => h('li', null, h('span', { class: 'w' }, b.window), h('span', null, b.text)))),
    h('p', { class: 'trl-beyond-note' }, d.beyondNote));

  const aside = h('aside', { class: 'trl-aside', 'aria-label': 'Not prerequisites for TRL7' },
    h('h3', null, 'Not prerequisites for TRL7 in this 12-month grant'),
    h('ul', null, d.notPrerequisites.map((t) => h('li', null, t))));

  wrap.append(h('div', { class: 'trl-layout' }, h('div', null, ladder, boundary), aside));
  root.append(wrap);
}
