import { h } from './dom.js';
import { EVENT_TYPES, WEEKDAY_ORDER, WEEKDAY_SHORT_RU } from '../config.js';
import { remindersField } from './remindersField.js';

const EMPTY = {
  title: '', event_type: 'task', date: '', hasTime: false, start_time: '', end_time: '',
  place: '', teacher: '', notes: '', repeatDays: [], parity: '', reminders: [],
};

export function openAddSheet(sheetEl, {
  title = 'Новое событие',
  submitLabel = 'Добавить',
  initial = {},
  showScope = true,
  showDate = true,
  showRepeat = true,
  canEditShared,
  initialScope = 'personal',
  onSubmit,
}) {
  const v = { ...EMPTY, ...initial };
  let scope = initialScope;
  const close = () => { sheetEl.hidden = true; sheetEl.replaceChildren(); };

  const scopeButtons = {
    personal: h('button', { type: 'button', class: scope === 'personal' ? 'active' : '', onclick: () => setScope('personal') }, 'Личное'),
    shared: h('button', { type: 'button', class: scope === 'shared' ? 'active' : '', disabled: !canEditShared, onclick: () => setScope('shared') }, 'Общее'),
  };
  function setScope(next) {
    scope = next;
    scopeButtons.personal.classList.toggle('active', next === 'personal');
    scopeButtons.shared.classList.toggle('active', next === 'shared');
  }

  const f = {
    title: h('input', { type: 'text', maxlength: '120', value: v.title }),
    type: h('select', {}, ...Object.entries(EVENT_TYPES).map(([value, t]) => h('option', { value }, t.label))),
    date: h('input', { type: 'date', value: v.date }),
    hasTime: h('input', { type: 'checkbox', checked: v.hasTime }),
    start: h('input', { type: 'time', value: v.start_time }),
    end: h('input', { type: 'time', value: v.end_time }),
    place: h('input', { type: 'text', value: v.place }),
    teacher: h('input', { type: 'text', value: v.teacher }),
    notes: h('textarea', {}, v.notes),
    days: WEEKDAY_ORDER.map((code) => h('input', { type: 'checkbox', value: code, checked: v.repeatDays.includes(code) })),
    parity: h('select', {},
      h('option', { value: '' }, 'Каждую неделю'),
      h('option', { value: 'NUM' }, 'Только числитель'),
      h('option', { value: 'DEN' }, 'Только знаменатель')),
  };
  const reminders = remindersField(v.reminders);
  f.type.value = v.event_type;
  f.parity.value = v.parity;
  const timeFields = h('div', { class: 'time-fields', hidden: !v.hasTime },
    h('label', {}, 'Начало', f.start),
    h('label', {}, 'Конец', f.end));
  f.hasTime.addEventListener('change', () => { timeFields.hidden = !f.hasTime.checked; });

  const error = h('p', { class: 'error' });
  const submit = h('button', { type: 'submit', class: 'primary' }, submitLabel);

  const form = h('form', {
    class: 'form',
    onsubmit: async (e) => {
      e.preventDefault();
      error.textContent = '';
      submit.disabled = true;
      try {
        const ok = await onSubmit({
          scope,
          values: {
            title: f.title.value,
            event_type: f.type.value,
            date: f.date.value,
            hasTime: f.hasTime.checked,
            start_time: f.start.value,
            end_time: f.end.value,
            place: f.place.value,
            teacher: f.teacher.value,
            notes: f.notes.value,
            repeatDays: showRepeat ? f.days.filter((d) => d.checked).map((d) => d.value) : [],
            parity: showRepeat ? f.parity.value : '',
            reminders: reminders.getOffsets(),
          },
        });
        if (ok) close();
      } catch (err) {
        error.textContent = err.message;
      } finally {
        submit.disabled = false;
      }
    },
  },
  h('h2', {}, title),
  showScope ? h('div', { class: 'segmented' }, scopeButtons.personal, scopeButtons.shared) : null,
  showScope && !canEditShared ? h('p', { class: 'muted small' }, 'Общие события можно добавлять после установки токена.') : null,
  h('label', {}, 'Название', f.title),
  h('label', {}, 'Тип', f.type),
  showDate ? h('label', {}, showRepeat ? 'Дата (для повторов — первый день)' : 'Дата', f.date) : null,
  h('label', { class: 'checkbox-line' }, f.hasTime, 'Указать время'),
  timeFields,
  h('label', {}, 'Аудитория / место', f.place),
  h('label', {}, 'Преподаватель', f.teacher),
  showRepeat ? h('div', { class: 'section-title' }, 'Повторять каждую неделю (пусто — один раз)') : null,
  showRepeat ? h('div', { class: 'days-picker' }, ...f.days.map((input, i) => h('label', {}, input, WEEKDAY_SHORT_RU[i]))) : null,
  showRepeat ? h('label', {}, 'Какие недели', f.parity) : null,
  h('label', {}, 'Заметка', f.notes),
  reminders.element,
  error,
  h('div', { class: 'sheet-buttons' },
    h('button', { type: 'button', class: 'secondary', onclick: close }, 'Отмена'),
    submit));

  sheetEl.replaceChildren(h('div', { class: 'sheet-body', onclick: (e) => e.stopPropagation() }, form));
  sheetEl.onclick = close;
  sheetEl.hidden = false;
  if (!v.title) f.title.focus();
}
