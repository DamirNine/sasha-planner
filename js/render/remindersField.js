import { h } from './dom.js';
import { formatOffset, normalizeOffsets, UNIT_MINUTES } from '../reminders.js';

const PRESETS = [[15, '15 мин'], [60, '1 час'], [1440, '1 день'], [10080, '1 неделя']];

export function remindersField(initial = []) {
  let offsets = normalizeOffsets(initial);
  const chips = h('div', { class: 'rem-chips' });
  const number = h('input', { type: 'number', min: '1', max: '999', value: '2', inputmode: 'numeric' });
  const unit = h('select', {},
    h('option', { value: 'min' }, 'минут'),
    h('option', { value: 'hour' }, 'часов'),
    h('option', { value: 'day' }, 'дней'),
    h('option', { value: 'week' }, 'недель'));
  unit.value = 'hour';

  function renderChips() {
    chips.replaceChildren(...(offsets.length
      ? offsets.map((m) => h('span', { class: 'rem-chip' }, formatOffset(m),
        h('button', { type: 'button', 'aria-label': 'Убрать напоминание', onclick: () => { offsets = offsets.filter((x) => x !== m); renderChips(); } }, '✕')))
      : [h('span', { class: 'muted small' }, 'Напоминаний нет')]));
  }

  function add(minutes) {
    offsets = normalizeOffsets([...offsets, minutes]);
    renderChips();
  }

  const custom = h('div', { class: 'rem-custom', hidden: true },
    h('span', { class: 'muted' }, 'за'), number, unit,
    h('button', {
      type: 'button',
      class: 'rem-add',
      onclick: () => {
        const n = parseInt(number.value, 10);
        if (n > 0) add(n * UNIT_MINUTES[unit.value]);
      },
    }, 'Добавить'));

  renderChips();
  const element = h('div', { class: 'rem-field' },
    h('div', { class: 'section-title' }, 'Напоминания'),
    chips,
    h('div', { class: 'rem-presets' },
      ...PRESETS.map(([m, label]) => h('button', { type: 'button', onclick: () => add(m) }, `＋ ${label}`)),
      h('button', { type: 'button', onclick: () => { custom.hidden = !custom.hidden; } }, 'Своё…')),
    custom);
  return { element, getOffsets: () => [...offsets] };
}

export function openRemindersSheet(sheetEl, { title, initial, onSave }) {
  const close = () => { sheetEl.hidden = true; sheetEl.replaceChildren(); };
  const field = remindersField(initial);
  sheetEl.replaceChildren(h('div', { class: 'sheet-body', onclick: (e) => e.stopPropagation() },
    h('h2', {}, title),
    field.element,
    h('div', { class: 'sheet-buttons' },
      h('button', { type: 'button', class: 'secondary', onclick: close }, 'Отмена'),
      h('button', { type: 'button', class: 'primary', onclick: () => { close(); onSave(field.getOffsets()); } }, 'Сохранить'))));
  sheetEl.onclick = close;
  sheetEl.hidden = false;
}
