import { makeEvent } from './eventOps.js';

// Shared events hidden on this phone only: { [event_id]: 'all' | ['YYYY-MM-DD', ...] }.

export function applyHidden(shared, hidden) {
  return shared
    .filter((e) => hidden[e.event_id] !== 'all')
    .map((e) => {
      const dates = hidden[e.event_id];
      if (!Array.isArray(dates)) return e;
      return { ...e, excluded_dates: [...new Set([...(e.excluded_dates || []), ...dates])].sort() };
    });
}

export function addHidden(hidden, op) {
  const current = hidden[op.id];
  if (op.type === 'delete' || current === 'all') return { ...hidden, [op.id]: 'all' };
  return { ...hidden, [op.id]: [...new Set([...(current || []), ...op.dates])].sort() };
}

// allDays: every day of the series, needed only when the whole series was hidden and just some days come back.
export function removeHidden(hidden, id, dates, allDays = []) {
  const { [id]: current, ...rest } = hidden;
  if (dates === 'all' || current === undefined) return rest;
  const back = new Set(dates);
  const stay = (current === 'all' ? allDays : current).filter((d) => !back.has(d));
  return stay.length ? { ...rest, [id]: stay } : rest;
}

export function localOnlyChange(op, series, { makeId } = {}) {
  if (op.type === 'delete' || op.type === 'exclude') return { hideOp: op, personalOps: [] };
  if (op.type === 'update') {
    const { event_id: ignored, created_at: c, updated_at: u, ...rest } = series;
    const copy = makeEvent({ ...rest, ...op.fields, source_type: 'personal' }, makeId ? { id: makeId() } : {});
    return { hideOp: { type: 'delete', id: series.event_id }, personalOps: [{ type: 'add', event: copy }] };
  }
  const [exclude, ...adds] = op.ops;
  return {
    hideOp: exclude,
    personalOps: adds.map((a) => ({ type: 'add', event: { ...a.event, source_type: 'personal' } })),
  };
}

export function convertedEvent(series, fields, target, now = new Date().toISOString()) {
  const { original_source: original, ...rest } = series;
  const event = { ...rest, ...fields, updated_at: now };
  if (target === 'personal') return { ...event, source_type: 'personal', original_source: series.source_type };
  return { ...event, source_type: original || 'manual' };
}

function daysWord(n) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return 'день';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'дня';
  return 'дней';
}

export function hiddenSummary(value) {
  if (value === 'all') return 'скрыто полностью';
  const n = value.length;
  return `${n === 1 ? 'скрыт' : 'скрыто'} ${n} ${daysWord(n)}`;
}
