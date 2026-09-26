import { parseRecurrenceRule } from './recurrence.js';
import { makeEvent } from './eventOps.js';

export function buildEventFields(v, { baseRule = '' } = {}) {
  const title = (v.title || '').trim();
  if (!title) throw new Error('Введите название');
  if (!v.date) throw new Error('Выберите дату');
  const start = v.hasTime ? v.start_time || '' : '';
  const end = v.hasTime ? v.end_time || '' : '';
  if (v.hasTime && !start) throw new Error('Укажите время начала');
  if (start && end && end <= start) throw new Error('Конец раньше начала');
  const days = v.repeatDays || [];
  let rule = '';
  if (days.length) {
    rule = `FREQ=WEEKLY;BYDAY=${days.join(',')}`;
    if (v.parity === 'NUM' || v.parity === 'DEN') rule += `;PARITY=${v.parity}`;
    const until = baseRule ? parseRecurrenceRule(baseRule).UNTIL : null;
    if (until) rule += `;UNTIL=${until}`;
  }
  return {
    title,
    event_type: v.event_type || 'other',
    date: v.date,
    start_time: start,
    end_time: end,
    place: (v.place || '').trim(),
    teacher: (v.teacher || '').trim(),
    notes: (v.notes || '').trim(),
    recurrence_rule: rule,
  };
}

export function eventToFormValues(event, { date = null } = {}) {
  const rule = event.recurrence_rule && !date ? parseRecurrenceRule(event.recurrence_rule) : null;
  return {
    title: event.title || '',
    event_type: event.event_type || 'other',
    date: date || event.date,
    hasTime: Boolean(event.start_time),
    start_time: event.start_time || '',
    end_time: event.end_time || '',
    place: event.place || '',
    teacher: event.teacher || '',
    notes: event.notes || '',
    repeatDays: rule ? rule.BYDAY : [],
    parity: rule?.PARITY || '',
  };
}

export function buildEditOp(event, fields, { scope, dates = [], makeId } = {}) {
  if (scope !== 'days' || !event.recurrence_rule) return { type: 'update', id: event.event_id, fields };
  const sorted = [...dates].sort();
  const { recurrence_rule: ignored, ...oneOff } = fields;
  const keep = { source_type: event.source_type, progress_group: event.progress_group, priority: event.priority };
  const copies = sorted.map((date) => ({
    type: 'add',
    event: makeEvent({
      ...keep,
      ...oneOff,
      recurrence_rule: '',
      date: sorted.length === 1 ? oneOff.date : date,
    }, makeId ? { id: makeId() } : {}),
  }));
  return { type: 'batch', ops: [{ type: 'exclude', id: event.event_id, dates: sorted }, ...copies] };
}

export function buildDeleteOp(event, choice, dates = []) {
  if (!event.recurrence_rule || choice === 'all') return { type: 'delete', id: event.event_id };
  if (dates.length === 0) throw new Error('Выберите хотя бы один день');
  return { type: 'exclude', id: event.event_id, dates: [...dates].sort() };
}
