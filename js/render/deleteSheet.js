import { h } from './dom.js';
import { dayHeading } from './schedule.js';
import { describeSeries } from '../planner.js';
import { buildDeleteOp } from '../forms.js';

export function openDeleteSheet(sheetEl, { event, upcoming, onConfirm }) {
  const close = () => { sheetEl.hidden = true; sheetEl.replaceChildren(); };
  const body = h('div', { class: 'sheet-body', onclick: (e) => e.stopPropagation() });
  const error = h('p', { class: 'error' });

  function confirm(choice, dates = []) {
    try {
      const op = buildDeleteOp(event, choice, dates);
      close();
      onConfirm(op);
    } catch (err) {
      error.textContent = err.message;
    }
  }

  function showPicker(multiple) {
    error.textContent = upcoming.length ? '' : 'Будущих повторов не осталось';
    const inputs = upcoming.map((key) => h('input', { type: multiple ? 'checkbox' : 'radio', name: 'delete-day', value: key }));
    body.replaceChildren(
      h('h2', {}, multiple ? 'Какие дни удалить?' : 'Какой день удалить?'),
      h('div', { class: 'chip-list' }, ...upcoming.map((key, i) => h('label', {}, inputs[i], dayHeading(key)))),
      error,
      h('div', { class: 'sheet-actions' },
        h('button', { type: 'button', class: 'primary danger', onclick: () => confirm('dates', inputs.filter((i) => i.checked).map((i) => i.value)) }, 'Удалить'),
        h('button', { type: 'button', class: 'secondary', onclick: showChoices }, 'Назад')));
  }

  function showChoices() {
    error.textContent = '';
    const actions = event.recurrence_rule
      ? [
        h('button', { type: 'button', class: 'settings-row', onclick: () => showPicker(false) }, 'Только один день', h('span', { class: 'muted' }, '›')),
        h('button', { type: 'button', class: 'settings-row', onclick: () => showPicker(true) }, 'Выбрать дни', h('span', { class: 'muted' }, '›')),
        h('button', { type: 'button', class: 'settings-row danger', onclick: () => confirm('all') }, 'Все повторы'),
      ]
      : [h('button', { type: 'button', class: 'settings-row danger', onclick: () => confirm('all') }, 'Удалить событие')];
    body.replaceChildren(
      h('h2', {}, event.title),
      h('p', { class: 'muted' }, describeSeries(event)),
      h('div', { class: 'settings-group' }, ...actions),
      error,
      h('button', { type: 'button', class: 'secondary', onclick: close }, 'Отмена'));
  }

  showChoices();
  sheetEl.replaceChildren(body);
  sheetEl.onclick = close;
  sheetEl.hidden = false;
}
