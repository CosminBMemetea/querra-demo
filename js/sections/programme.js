// Programme panel: an evaluator should get topic, site, deadline, sprints,
// payments, acceptance evidence and open dependencies in under a minute.
import { h, sectionHead } from '../lib/dom.js';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function monthLabel(start, m) {
  const [y, mo] = start.split('-').map(Number);
  const idx = mo - 1 + (m - 1);
  return { mon: MONTHS[idx % 12], year: y + Math.floor(idx / 12) };
}
function spanLabel(start, [a, b]) {
  const A = monthLabel(start, a), B = monthLabel(start, b);
  return A.year === B.year ? `${A.mon}–${B.mon} ${B.year}` : `${A.mon} ${A.year}–${B.mon} ${B.year}`;
}

export function renderProgramme(root, d) {
  const wrap = h('div', { class: 'wrap' });
  wrap.append(sectionHead({ kicker: d.kicker, title: d.title, id: 'programme-title', lede: d.body }));

  wrap.append(h('div', { class: 'pg-facts' }, d.facts.map((f) => h('div', { class: 'pg-fact' },
    h('div', { class: 'k' }, f.label), h('div', { class: 'v' }, f.value), h('p', { class: 'd' }, f.detail)))));

  wrap.append(h('ol', { class: 'pg-steps', 'aria-label': 'Application timeline' },
    d.timeline.map((t) => h('li', { class: t.key ? 'is-key' : null }, h('div', { class: 'dt' }, t.date), h('div', { class: 'ev' }, t.event)))));
  wrap.append(h('p', { class: 'pg-assume' }, d.timelineNote));

  // sprint bar
  const bar = h('div', { class: 'pg-bar', role: 'list', 'aria-label': 'Programme sprints and payments' });
  d.sprints.forEach((sp) => {
    bar.append(h('div', { class: 'pg-seg', role: 'listitem' },
      h('span', { class: 's' }, `${sp.id} · M${sp.months[0]}–M${sp.months[1]} · ${spanLabel(d.assumedStart, sp.months)}*`),
      h('span', { class: 'nm' }, sp.name),
      h('span', { class: 'pay' }, h('b', null, `${sp.payment}%`), h('span', null, 'paid on approval'))));
  });
  const months = h('div', { class: 'pg-months', 'aria-hidden': 'true' });
  for (let m = 1; m <= 12; m++) months.append(h('span', null, `M${m}`));
  wrap.append(h('div', { class: 'pg-timeline' }, bar, months));
  wrap.append(h('p', { class: 'pg-assume' }, `* ${d.assumedStartNote}`));

  const group = (cls, title, items) => h('div', { class: cls }, h('h4', null, title), h('ul', null, items.map((t) => h('li', null, t))));
  wrap.append(h('div', { class: 'pg-cols' }, d.sprints.map((sp) => h('div', { class: 'pg-col', dataset: sp.months[1] - sp.months[0] > 2 ? { wide: '' } : {} , 'aria-label': `${sp.id} ${sp.name}` },
    group('grp-out', 'Measurable outputs', sp.outputs),
    group('grp-acc', 'Acceptance evidence', sp.acceptance),
    group('grp-dep', 'Open dependencies', sp.dependencies),
    h('details', { class: 'grp-off' }, h('summary', null, 'Official expectations · Annex 1.1'), h('ul', null, sp.official.map((t) => h('li', null, t))))))));

  const cr = d.criteria;
  const cal = d.calendar;
  wrap.append(h('div', { class: 'pg-lower' },
    h('div', { class: 'pg-box' },
      h('h3', null, cr.title),
      h('p', { class: 'note' }, cr.note),
      h('div', { class: 'pg-criteria' }, cr.items.map((c) => h('div', null, h('strong', null, c.name), h('span', null, c.focus))))),
    h('div', { class: 'pg-box' },
      h('h3', null, cal.title),
      h('p', { class: 'note' }, cal.note),
      h('table', { class: 'pg-cal' },
        h('thead', null, h('tr', null, h('th', { scope: 'col' }, 'Sprint'), h('th', { scope: 'col' }, 'Cyprus (typical)'), h('th', { scope: 'col' }, 'Germany (typical)'))),
        h('tbody', null, cal.rows.map((r) => h('tr', null, h('td', null, r.sprint), h('td', null, r.cyprus), h('td', null, r.germany))))),
      h('p', { class: 'implication' }, cal.implication)),
    h('div', { class: 'pg-box pg-deps' },
      h('h3', null, d.dependencies.title),
      h('ul', null, d.dependencies.items.map((t) => h('li', null, t)))),
    h('div', { class: 'pg-box pg-sources' },
      h('h3', null, 'Sources of truth'),
      h('ul', null, d.sources.map((src) => h('li', null, h('a', { href: src.href, rel: 'noopener', target: '_blank' }, src.label), h('span', { class: 'ver' }, src.version)))))));

  root.append(wrap);
}
