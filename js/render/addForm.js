import { h } from './dom.js';
import { EVENT_TYPES, WEEKDAY_ORDER, WEEKDAY_SHORT_RU } from '../config.js';
import { buildEventFields } from '../forms.js';

export function openAddSheet(sheetEl, { defaultDate, canEditShared, onSubmit }) {
  let scope = 'personal';
  const close = () => { sheetEl.hidden = true; sheetEl.replaceChildren(); };

  const scopeButtons = {
    personal: h('button', { type: 'button', class: 'active', onclick: () => setScope('personal') }, 'Личное'),
    shared: h('button', { type: 'button', disabled: !canEditShared, onclick: () => setScope('shared') }, 'Общее'),
  };
  function setScope(next) {
    scope = next;
    scopeButtons.personal.classList.toggle('active', next === 'personal');
    scopeButtons.shared.classList.toggle('active', next === 'shared');
  }

  const f = {
    title: h('input', { type: 'text', maxlength: '120' }),
    type: h('select', {}, ...Object.entries(EVENT_TYPES).map(([value, t]) => h('option', { value }, t.label))),
    date: h('input', { type: 'date', value: defaultDate }),
    hasTime: h('input', { type: 'checkbox' }),
    start: h('input', { type: 'time' }),
    end: h('input', { type: 'time' }),
    place: h('input', { type: 'text' }),
    teacher: h('input', { type: 'text' }),
    notes: h('textarea', {}),
    days: WEEKDAY_ORDER.map((code) => h('input', { type: 'checkbox', value: code })),
  };
  f.type.value = 'task';
  const timeFields = h('div', { class: 'time-fields', hidden: true },
    h('label', {}, 'Начало', f.start),
    h('label', {}, 'Конец', f.end));
  f.hasTime.addEventListener('change', () => { timeFields.hidden = !f.hasTime.checked; });

  const error = h('p', { class: 'error' });
  const submit = h('button', { type: 'submit', class: 'primary' }, 'Добавить');

  const form = h('form', {
    class: 'form',
    onsubmit: async (e) => {
      e.preventDefault();
      error.textContent = '';
      let fields;
      try {
        fields = buildEventFields({
          title: f.title.value,
          event_type: f.type.value,
          date: f.date.value,
          hasTime: f.hasTime.checked,
          start_time: f.start.value,
          end_time: f.end.value,
          place: f.place.value,
          teacher: f.teacher.value,
          notes: f.notes.value,
          repeatDays: f.days.filter((d) => d.checked).map((d) => d.value),
        });
      } catch (err) {
        error.textContent = err.message;
        return;
      }
      submit.disabled = true;
      const ok = await onSubmit({ scope, fields });
      submit.disabled = false;
      if (ok) close();
    },
  },
  h('h2', {}, 'Новое событие'),
  h('div', { class: 'segmented' }, scopeButtons.personal, scopeButtons.shared),
  canEditShared ? null : h('p', { class: 'muted small' }, 'Общие события можно добавлять после установки токена.'),
  h('label', {}, 'Название', f.title),
  h('label', {}, 'Тип', f.type),
  h('label', {}, 'Дата (для повторов — первый день)', f.date),
  h('label', { class: 'checkbox-line' }, f.hasTime, 'Указать время'),
  timeFields,
  h('label', {}, 'Аудитория / место', f.place),
  h('label', {}, 'Преподаватель', f.teacher),
  h('div', { class: 'section-title' }, 'Повторять каждую неделю (пусто — один раз)'),
  h('div', { class: 'days-picker' }, ...f.days.map((input, i) => h('label', {}, input, WEEKDAY_SHORT_RU[i]))),
  h('label', {}, 'Заметка', f.notes),
  error,
  h('div', { class: 'sheet-buttons' },
    h('button', { type: 'button', class: 'secondary', onclick: close }, 'Отмена'),
    submit));

  sheetEl.replaceChildren(h('div', { class: 'sheet-body', onclick: (e) => e.stopPropagation() }, form));
  sheetEl.onclick = close;
  sheetEl.hidden = false;
  f.title.focus();
}
