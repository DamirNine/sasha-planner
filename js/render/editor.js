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

export function renderEditor(el, { shared, personal, onBack, onAdd, onPick }) {
  el.replaceChildren(
    h('button', { type: 'button', class: 'back-button', onclick: onBack }, '‹ Назад'),
    h('h1', {}, 'Редактирование'),
    h('button', { type: 'button', class: 'primary', onclick: onAdd }, '＋ Добавить событие'),
    h('p', { class: 'muted small' }, 'Нажмите на событие, чтобы удалить его целиком или отдельные дни.'),
    ...group('Личные — только на этом телефоне', personal, true, onPick, 'Личных событий пока нет'),
    ...group('Общие — видны на обоих телефонах', shared, false, onPick, 'Общих событий нет'),
  );
}
