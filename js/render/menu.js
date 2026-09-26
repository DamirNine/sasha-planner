import { h } from './dom.js';
import { dayHeading } from './schedule.js';

function show(sheetEl, body) {
  sheetEl.replaceChildren(body);
  sheetEl.onclick = () => { sheetEl.hidden = true; sheetEl.replaceChildren(); };
  sheetEl.hidden = false;
}

export function openMenu(sheetEl, { title, subtitle, items }) {
  const close = () => { sheetEl.hidden = true; sheetEl.replaceChildren(); };
  show(sheetEl, h('div', { class: 'sheet-body', onclick: (e) => e.stopPropagation() },
    h('h2', {}, title),
    subtitle ? h('p', { class: 'muted' }, subtitle) : null,
    h('div', { class: 'settings-group' }, ...items.map((item) => h('button', {
      type: 'button',
      class: `settings-row${item.danger ? ' danger' : ''}`,
      onclick: () => { close(); item.onSelect(); },
    }, h('span', {}, item.label), item.chevron ? h('span', { class: 'muted' }, '›') : null))),
    h('button', { type: 'button', class: 'secondary', onclick: close }, 'Отмена')));
}

export function openDayPicker(sheetEl, { title, days, confirmLabel, danger = false, onConfirm }) {
  const close = () => { sheetEl.hidden = true; sheetEl.replaceChildren(); };
  const error = h('p', { class: 'error' }, days.length ? '' : 'Будущих повторов не осталось');
  const inputs = days.map((key) => h('input', { type: 'checkbox', value: key }));
  show(sheetEl, h('div', { class: 'sheet-body', onclick: (e) => e.stopPropagation() },
    h('h2', {}, title),
    h('div', { class: 'chip-list' }, ...days.map((key, i) => h('label', {}, inputs[i], dayHeading(key)))),
    error,
    h('div', { class: 'sheet-actions' },
      h('button', {
        type: 'button',
        class: `primary${danger ? ' danger' : ''}`,
        onclick: () => {
          const picked = inputs.filter((i) => i.checked).map((i) => i.value);
          if (!picked.length) {
            error.textContent = 'Выберите хотя бы один день';
            return;
          }
          close();
          onConfirm(picked);
        },
      }, confirmLabel),
      h('button', { type: 'button', class: 'secondary', onclick: close }, 'Отмена'))));
}
