export function buildEventFields(v) {
  const title = (v.title || '').trim();
  if (!title) throw new Error('Введите название');
  if (!v.date) throw new Error('Выберите дату');
  const start = v.hasTime ? v.start_time || '' : '';
  const end = v.hasTime ? v.end_time || '' : '';
  if (v.hasTime && !start) throw new Error('Укажите время начала');
  if (start && end && end <= start) throw new Error('Конец раньше начала');
  const days = v.repeatDays || [];
  return {
    title,
    event_type: v.event_type || 'other',
    date: v.date,
    start_time: start,
    end_time: end,
    place: (v.place || '').trim(),
    teacher: (v.teacher || '').trim(),
    notes: (v.notes || '').trim(),
    recurrence_rule: days.length ? `FREQ=WEEKLY;BYDAY=${days.join(',')}` : '',
  };
}

export function buildDeleteOp(event, choice, dates = []) {
  if (!event.recurrence_rule || choice === 'all') return { type: 'delete', id: event.event_id };
  if (dates.length === 0) throw new Error('Выберите хотя бы один день');
  return { type: 'exclude', id: event.event_id, dates: [...dates].sort() };
}
