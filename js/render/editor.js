import { h } from './dom.js';
import { describeSeries, sortSeries } from '../planner.js';

function seriesRow(event, isPersonal, onPick) {
  return h('button', { type: 'button', class: 'settings-row', onclick: () => onPick(event, isPersonal) },
    h('span', { class: 'series-text' },
      h('span', { class: 'series-title' }, event.title),
      h('span', { class: 'muted small' }, describeSeries(event))),
    h('span', { class: 'muted' }, '›'));
}

function group(title, events, isPersonal, onPick, emptyText) {
  return [
    h('div', { class: 'section-title' }, title),
    h('div', { class: 'settings-group' },
      ...(events.length
        ? sortSeries(events).map((e) => seriesRow(e, isPersonal, onPick))
        : [h('p', { class: 'empty small' }, emptyText)])),
  ];
}

function hiddenGroup(hidden, onRestore) {
  if (!hidden.length) return [];
  return [
    h('div', { class: 'section-title' }, 'Скрыто у меня — только на этом телефоне'),
    h('div', { class: 'settings-group' }, ...hidden.map(({ event, summary }) => h('div', { class: 'settings-row' },
      h('span', { class: 'series-text' },
        h('span', { class: 'series-title' }, event.title),
        h('span', { class: 'muted small' }, summary)),
      h('button', { type: 'button', class: 'restore-button', onclick: () => onRestore(event) }, 'Вернуть')))),
  ];
}

export function renderEditor(el, { shared, personal, hidden = [], onBack, onAdd, onPick, onRestore }) {
  el.replaceChildren(
    h('button', { type: 'button', class: 'back-button', onclick: onBack }, '‹ Назад'),
    h('h1', {}, 'Редактирование'),
    h('button', { type: 'button', class: 'primary', onclick: onAdd }, '＋ Добавить событие'),
    h('p', { class: 'muted small' }, 'Нажмите на событие, чтобы изменить или удалить его.'),
    ...group('Личные — только на этом телефоне', personal, true, onPick, 'Личных событий пока нет'),
    ...group('Общие — видны на обоих телефонах', shared, false, onPick, 'Общих событий нет'),
    ...hiddenGroup(hidden, onRestore),
  );
}
