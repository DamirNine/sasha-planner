import { h } from './dom.js';
import { EVENT_TYPES, WEEKDAY_SHORT_RU, MONTHS_GENITIVE_RU } from '../config.js';
import { toDateOnly } from '../dateUtils.js';
import { gridBounds, assignLanes, toMinutes } from '../layout.js';
import { hyphenate } from '../hyphenate.js';

const PX_PER_MIN = 0.9;

export function weekdayShort(key) {
  return WEEKDAY_SHORT_RU[(toDateOnly(key).getDay() + 6) % 7];
}

export function dayHeading(key) {
  const d = toDateOnly(key);
  const dow = weekdayShort(key);
  return `${dow.charAt(0).toUpperCase()}${dow.slice(1)}, ${d.getDate()} ${MONTHS_GENITIVE_RU[d.getMonth()]}`;
}

export function typeColor(type) {
  return EVENT_TYPES[type]?.color || 'transparent';
}

export function renderDateStrip(el, { weekDays, highlight, today, onPick }) {
  el.replaceChildren(...weekDays.map((key) => {
    const classes = ['strip-day'];
    if (key === today) classes.push('today');
    if (highlight.includes(key)) classes.push('selected');
    return h('button', { type: 'button', class: classes.join(' '), dataset: { day: key }, onclick: () => onPick(key) },
      h('span', { class: 'num' }, String(toDateOnly(key).getDate())),
      h('span', { class: 'dow' }, weekdayShort(key)));
  }));
}

export function highlightStripDay(el, key) {
  el.querySelectorAll('.strip-day').forEach((b) => b.classList.toggle('selected', b.dataset.day === key));
}

export function checkButton(occ, onToggle) {
  return h('button', {
    type: 'button',
    class: 'check',
    'aria-label': occ.isDone ? 'Снять отметку' : 'Отметить выполненным',
    onclick: (e) => { e.stopPropagation(); onToggle(occ.key); },
  }, '✓');
}

export function fullCard(occ, onToggle) {
  const meta = [EVENT_TYPES[occ.event_type]?.label, occ.teacher].filter(Boolean);
  return h('div', { class: `card${occ.isDone ? ' done' : ''}`, style: { borderLeftColor: typeColor(occ.event_type) } },
    occ.place ? h('div', { class: 'place' }, occ.place) : null,
    ...meta.map((m) => h('div', { class: 'meta' }, hyphenate(m))),
    h('div', { class: 'title' }, hyphenate(occ.title)),
    occ.notes ? h('div', { class: 'notes' }, occ.notes) : null,
    occ.isPersonal ? h('span', { class: 'badge' }, 'личное') : null,
    checkButton(occ, onToggle));
}

function timedRow(occ, onToggle) {
  return h('div', { class: 'row' },
    h('div', { class: 'times' }, h('span', {}, occ.start_time), h('span', {}, occ.end_time || '')),
    fullCard(occ, onToggle));
}

function dayList(occs, onToggle) {
  if (occs.length === 0) return [h('p', { class: 'empty' }, 'Нет событий')];
  const untimed = occs.filter((o) => !o.start_time);
  const timed = occs.filter((o) => o.start_time);
  const out = [];
  if (untimed.length) {
    out.push(h('div', { class: 'section-title' }, 'Без времени'));
    untimed.forEach((o) => out.push(h('div', { class: 'row' }, h('div'), fullCard(o, onToggle))));
  }
  timed.forEach((o) => out.push(timedRow(o, onToggle)));
  return out;
}

function timeRange(occ) {
  return [occ.start_time, occ.end_time].filter(Boolean).join('–');
}

function compactCard(occ, { onToggle, onOpen }) {
  return h('div', {
    class: `card compact${occ.isDone ? ' done' : ''}`,
    style: { borderLeftColor: typeColor(occ.event_type) },
    onclick: () => onOpen(occ),
  },
  h('div', { class: 'time' }, timeRange(occ) || 'Без времени'),
  h('div', { class: 'title' }, hyphenate(occ.title)),
  occ.place ? h('div', { class: 'place' }, occ.place) : null,
  checkButton(occ, onToggle));
}

function twoDays(days, byDay, handlers) {
  return h('div', { class: 'cols two' }, ...days.map((key) => {
    const occs = byDay(key);
    return h('div', {},
      h('div', { class: 'col-title' }, dayHeading(key)),
      ...(occs.length ? occs.map((o) => compactCard(o, handlers)) : [h('p', { class: 'empty' }, 'Нет событий')]));
  }));
}

function weekGrid(days, occurrences, { onOpen }, today) {
  const bounds = gridBounds(occurrences);
  const height = (bounds.end - bounds.start) * PX_PER_MIN;
  const hours = [];
  for (let m = bounds.start; m <= bounds.end; m += 60) {
    hours.push(h('span', { style: { top: `calc(${(m - bounds.start) * PX_PER_MIN}px * var(--z))` } }, String(m / 60)));
  }
  const head = h('div', { class: 'grid grid-head' }, h('div'),
    ...days.map((key) => h('div', { class: `grid-day${key === today ? ' today' : ''}` }, `${weekdayShort(key)} ${toDateOnly(key).getDate()}`)));
  const untimed = occurrences.filter((o) => !o.start_time);
  const untimedRow = untimed.length
    ? h('div', { class: 'grid grid-untimed' }, h('div'), ...days.map((key) => h('div', {},
      ...untimed.filter((o) => o.date === key).map((o) => h('button', {
        type: 'button', class: `grid-chip${o.isDone ? ' done' : ''}`, onclick: () => onOpen(o),
      }, hyphenate(o.title))))))
    : null;
  const body = h('div', { class: 'grid grid-body', style: { height: `calc(${height}px * var(--z))` } },
    h('div', { class: 'grid-hours' }, ...hours),
    ...days.map((key) => {
      const items = occurrences
        .filter((o) => o.date === key && o.start_time)
        .map((o) => {
          const start = toMinutes(o.start_time);
          return { occ: o, start, end: o.end_time ? toMinutes(o.end_time) : start + 60 };
        });
      return h('div', { class: 'grid-col' }, ...assignLanes(items).map((it) => h('button', {
        type: 'button',
        class: `grid-item${it.occ.isDone ? ' done' : ''}`,
        style: {
          top: `calc(${(it.start - bounds.start) * PX_PER_MIN}px * var(--z))`,
          height: `calc(${Math.max(18, (it.end - it.start) * PX_PER_MIN)}px * var(--z))`,
          left: `${(it.lane / it.laneCount) * 100}%`,
          width: `${100 / it.laneCount}%`,
          borderLeftColor: typeColor(it.occ.event_type),
        },
        onclick: () => onOpen(it.occ),
      }, h('span', { class: 'gi-title' }, hyphenate(it.occ.title)), it.occ.place ? h('span', { class: 'gi-place' }, it.occ.place) : null)));
    }));
  return h('div', { class: 'grid-scroll' }, h('div', { class: 'week-grid' }, head, untimedRow, body));
}

export function openDetails(sheetEl, occ, { onToggle }) {
  const close = () => { sheetEl.hidden = true; sheetEl.replaceChildren(); };
  const when = [dayHeading(occ.date), timeRange(occ)].filter(Boolean).join(', ');
  sheetEl.replaceChildren(h('div', { class: 'sheet-body', onclick: (e) => e.stopPropagation() },
    h('p', { class: 'muted' }, when),
    fullCard(occ, (key) => { onToggle(key); close(); }),
    h('div', { class: 'sheet-actions' }, h('button', { type: 'button', class: 'secondary', onclick: close }, 'Закрыть'))));
  sheetEl.onclick = close;
  sheetEl.hidden = false;
}

export function renderSchedule(el, { mode, days, occurrences, onToggle, onOpen, today }) {
  const byDay = (key) => occurrences.filter((o) => o.date === key);
  if (mode === 'week_list') {
    el.replaceChildren(...days.flatMap((key) => [
      h('h2', { class: 'day-header', id: `day-${key}`, dataset: { day: key } }, dayHeading(key)),
      ...dayList(byDay(key), onToggle),
    ]));
  } else if (mode === 'day2') {
    el.replaceChildren(twoDays(days, byDay, { onToggle, onOpen }));
  } else if (mode === 'week_grid') {
    el.replaceChildren(weekGrid(days, occurrences, { onOpen }, today));
  } else {
    el.replaceChildren(...dayList(byDay(days[0]), onToggle));
  }
}

let observer = null;

export function observeVisibleDay(container, topOffset, onDay) {
  observer?.disconnect();
  observer = new IntersectionObserver((entries) => {
    const visible = entries
      .filter((e) => e.isIntersecting)
      .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
    if (visible[0]) onDay(visible[0].target.dataset.day);
  }, { rootMargin: `-${Math.round(topOffset)}px 0px -60% 0px` });
  container.querySelectorAll('.day-header').forEach((el) => observer.observe(el));
}

export function stopObservingDays() {
  observer?.disconnect();
  observer = null;
}
