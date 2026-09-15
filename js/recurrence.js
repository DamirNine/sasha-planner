import { toDateOnly, dateKey } from './dateUtils.js';

export function parseRecurrenceRule(rule) {
  const out = { FREQ: null, BYDAY: [], PARITY: null, UNTIL: null };
  String(rule).split(';').forEach((part) => {
    const [key, val] = part.split('=');
    if (!key || val === undefined) return;
    if (key === 'FREQ') out.FREQ = val;
    else if (key === 'BYDAY') out.BYDAY = val.split(',');
    else if (key === 'PARITY') out.PARITY = val;
    else if (key === 'UNTIL') out.UNTIL = val;
  });
  return out;
}

export function expandRecurrence(templateEvent, settings) {
  const rule = parseRecurrenceRule(templateEvent.recurrence_rule);
  if (rule.FREQ !== 'WEEKLY' || rule.BYDAY.length === 0) return [];

  const anchor = toDateOnly(templateEvent.date);
  const semesterHorizon = toDateOnly(settings.semester_end_date);
  let horizon = rule.UNTIL ? toDateOnly(rule.UNTIL) : semesterHorizon;
  if (horizon > semesterHorizon) horizon = semesterHorizon;

  const stepDays = rule.PARITY ? 14 : 7;
  const dates = [];
  const cursor = new Date(anchor);
  while (cursor <= horizon) {
    dates.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + stepDays);
  }
  return dates;
}

export function generateAllRecurrences(events, settings) {
  const templates = events.filter((e) => e.recurrence_rule);
  const existing = new Set(
    events
      .filter((e) => e.parent_event_id)
      .map((e) => `${e.parent_event_id}|${dateKey(e.date)}`)
  );

  const now = new Date().toISOString();
  const newEvents = [];

  templates.forEach((tpl) => {
    expandRecurrence(tpl, settings).forEach((d) => {
      const key = `${tpl.event_id}|${dateKey(d)}`;
      if (existing.has(key)) return;
      newEvents.push({
        event_id: crypto.randomUUID(),
        source_type: tpl.source_type,
        date: dateKey(d),
        start_time: tpl.start_time,
        end_time: tpl.end_time,
        title: tpl.title,
        event_type: tpl.event_type,
        place: tpl.place,
        teacher: tpl.teacher,
        progress_group: tpl.progress_group,
        priority: tpl.priority,
        completed: false,
        recurrence_rule: '',
        parent_event_id: tpl.event_id,
        notes: tpl.notes,
        created_at: now,
        updated_at: now,
      });
    });
  });

  return newEvents;
}
