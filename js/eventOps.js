const EVENT_DEFAULTS = {
  source_type: 'manual',
  date: '',
  start_time: '',
  end_time: '',
  title: '',
  event_type: 'other',
  place: '',
  teacher: '',
  progress_group: 'task',
  priority: '',
  recurrence_rule: '',
  notes: '',
};

export function makeEvent(fields, { now = new Date().toISOString(), id = crypto.randomUUID() } = {}) {
  return {
    event_id: id,
    ...EVENT_DEFAULTS,
    excluded_dates: [],
    created_at: now,
    updated_at: now,
    ...fields,
  };
}

export function applyOp(events, op, now = new Date().toISOString()) {
  switch (op.type) {
    case 'add':
      if (events.some((e) => e.event_id === op.event.event_id)) return events;
      return [...events, op.event];
    case 'exclude':
      return events.map((e) => {
        if (e.event_id !== op.id) return e;
        const dates = [...new Set([...(e.excluded_dates || []), ...op.dates])].sort();
        return { ...e, excluded_dates: dates, updated_at: now };
      });
    case 'include':
      return events.map((e) => {
        if (e.event_id !== op.id) return e;
        const back = new Set(op.dates);
        return { ...e, excluded_dates: (e.excluded_dates || []).filter((d) => !back.has(d)), updated_at: now };
      });
    case 'delete':
      return events.filter((e) => e.event_id !== op.id);
    case 'update':
      return events.map((e) => (e.event_id === op.id ? { ...e, ...op.fields, updated_at: now } : e));
    case 'batch':
      return op.ops.reduce((acc, inner) => applyOp(acc, inner, now), events);
    default:
      throw new Error(`Неизвестная операция: ${op.type}`);
  }
}

export function normalizeEvents(events) {
  return events
    .filter((e) => !e.parent_event_id)
    .map(({ completed, parent_event_id, ...rest }) => ({
      ...rest,
      excluded_dates: Array.isArray(rest.excluded_dates) ? rest.excluded_dates : [],
    }));
}
