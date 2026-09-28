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

function moreButton(occ, onMenu) {
  return h('button', {
    type: 'button',
    class: 'more',
    'aria-label': 'Изменить или удалить',
    onclick: (e) => { e.stopPropagation(); onMenu(occ); },
  }, '⋮');
}

function addButton(key, onAdd) {
  return h('button', {
    type: 'button',
    class: 'day-add',
    'aria-label': 'Добавить на этот день',
    onclick: (e) => { e.stopPropagation(); onAdd(key); },
  }, '＋');
}

export function fullCard(occ, onToggle, onMenu) {
  const meta = [EVENT_TYPES[occ.event_type]?.label, occ.teacher].filter(Boolean);
  return h('div', { class: `card${occ.isDone ? ' done' : ''}`, style: { borderLeftColor: typeColor(occ.event_type) } },
    occ.place ? h('div', { class: 'place' }, occ.place) : null,
    ...meta.map((m) => h('div', { class: 'meta' }, hyphenate(m))),
    h('div', { class: 'title' }, hyphenate(occ.title)),
    occ.notes ? h('div', { class: 'notes' }, occ.notes) : null,
    occ.isPersonal ? h('span', { class: 'badge' }, 'личное') : null,
    occ.hasReminder ? h('span', { class: 'bell', 'aria-label': 'Есть напоминание' }, '🔔') : null,
    checkButton(occ, onToggle),
    onMenu ? moreButton(occ, onMenu) : null);
}

function timedRow(occ, { onToggle, onMenu }) {
  return h('div', { class: 'row' },
    h('div', { class: 'times' }, h('span', {}, occ.start_time), h('span', {}, occ.end_time || '')),
    fullCard(occ, onToggle, onMenu));
}

function dayList(occs, { onToggle, onMenu }) {
  if (occs.length === 0) return [h('p', { class: 'empty' }, 'Нет событий')];
  const untimed = occs.filter((o) => !o.start_time);
  const timed = occs.filter((o) => o.start_time);
  const out = [];
  if (untimed.length) {
    out.push(h('div', { class: 'section-title' }, 'Без времени'));
    untimed.forEach((o) => out.push(h('div', { class: 'row' }, h('div'), fullCard(o, onToggle, onMenu))));
  }
  timed.forEach((o) => out.push(timedRow(o, { onToggle, onMenu })));
  return out;
}

function timeRange(occ) {
  return [occ.start_time, occ.end_time].filter(Boolean).join('–');
}

function compactCard(occ, { onToggle, onOpen, onMenu }) {
  return h('div', {
    class: `card compact${occ.isDone ? ' done' : ''}`,
    style: { borderLeftColor: typeColor(occ.event_type) },
    onclick: () => onOpen(occ),
  },
  h('div', { class: 'time' }, timeRange(occ) || 'Без времени'),
  h('div', { class: 'title' }, occ.hasReminder ? '🔔 ' : '', hyphenate(occ.title)),
  occ.place ? h('div', { class: 'place' }, occ.place) : null,
  checkButton(occ, onToggle),
  moreButton(occ, onMenu));
}

function twoDays(days, byDay, handlers) {
  return h('div', { class: 'cols two' }, ...days.map((key) => {
    const occs = byDay(key);
    return h('div', {},
      h('div', { class: 'col-title' }, h('span', {}, dayHeading(key)), addButton(key, handlers.onAdd)),
      ...(occs.length ? occs.map((o) => compactCard(o, handlers)) : [h('p', { class: 'empty' }, 'Нет событий')]));
  }));
}

function weekGrid(days, occurrences, { onOpen, onAdd }, today) {
  const bounds = gridBounds(occurrences);
  const height = (bounds.end - bounds.start) * PX_PER_MIN;
  const hours = [];
  for (let m = bounds.start; m <= bounds.end; m += 60) {
    hours.push(h('span', { style: { top: `${(m - bounds.start) * PX_PER_MIN}px` } }, String(m / 60)));
  }
  const head = h('div', { class: 'grid grid-head' }, h('div'),
    ...days.map((key) => h('div', { class: `grid-day${key === today ? ' today' : ''}` },
      h('span', {}, `${weekdayShort(key)} ${toDateOnly(key).getDate()}`), addButton(key, onAdd))));
  const untimed = occurrences.filter((o) => !o.start_time);
  const untimedRow = untimed.length
    ? h('div', { class: 'grid grid-untimed' }, h('div'), ...days.map((key) => h('div', {},
      ...untimed.filter((o) => o.date === key).map((o) => h('button', {
        type: 'button', class: `grid-chip${o.isDone ? ' done' : ''}`, onclick: () => onOpen(o),
      }, h('span', { class: 'gi-title' }, o.hasReminder ? '🔔' : '', hyphenate(o.title)))))))
    : null;
  const body = h('div', { class: 'grid grid-body', style: { height: `${height}px` } },
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
          top: `${(it.start - bounds.start) * PX_PER_MIN}px`,
          height: `${Math.max(18, (it.end - it.start) * PX_PER_MIN)}px`,
          left: `${(it.lane / it.laneCount) * 100}%`,
          width: `${100 / it.laneCount}%`,
          borderLeftColor: typeColor(it.occ.event_type),
        },
        onclick: () => onOpen(it.occ),
      }, h('span', { class: 'gi-title' }, it.occ.hasReminder ? '🔔' : '', hyphenate(it.occ.title)), it.occ.place ? h('span', { class: 'gi-place' }, it.occ.place) : null)));
    }));
  return h('div', { class: 'week-grid' }, head, untimedRow, body);
}

export function openDetails(sheetEl, occ, { onToggle, onMenu }) {
  const close = () => { sheetEl.hidden = true; sheetEl.replaceChildren(); };
  const when = [dayHeading(occ.date), timeRange(occ)].filter(Boolean).join(', ');
  sheetEl.replaceChildren(h('div', { class: 'sheet-body', onclick: (e) => e.stopPropagation() },
    h('p', { class: 'muted' }, when),
    fullCard(occ, (key) => { onToggle(key); close(); }, onMenu),
    h('div', { class: 'sheet-actions' }, h('button', { type: 'button', class: 'secondary', onclick: close }, 'Закрыть'))));
  sheetEl.onclick = close;
  sheetEl.hidden = false;
}

export function renderSchedule(el, { mode, days, occurrences, onToggle, onOpen, onMenu, onAdd, today }) {
  const byDay = (key) => occurrences.filter((o) => o.date === key);
  const handlers = { onToggle, onOpen, onMenu, onAdd };
  const heading = (key, extra = {}) => h('h2', { class: 'day-header', ...extra }, h('span', {}, dayHeading(key)), addButton(key, onAdd));
  if (mode === 'week_list') {
    el.replaceChildren(...days.flatMap((key) => [
      heading(key, { id: `day-${key}`, dataset: { day: key } }),
      ...dayList(byDay(key), handlers),
    ]));
  } else if (mode === 'day2') {
    el.replaceChildren(twoDays(days, byDay, handlers));
  } else if (mode === 'week_grid') {
    el.replaceChildren(weekGrid(days, occurrences, handlers, today));
  } else {
    el.replaceChildren(heading(days[0]), ...dayList(byDay(days[0]), handlers));
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
