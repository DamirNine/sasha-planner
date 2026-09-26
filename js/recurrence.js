import { toDateOnly, dateKey, getWeekParity } from './dateUtils.js';

const JS_DAY_TO_CODE = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

function parityMatches(parity, date, settings) {
  if (!parity) return true;
  const actual = getWeekParity(date, settings);
  return parity === 'NUM' ? actual === 'numerator' : actual === 'denominator';
}

export function occurrenceDates(event, settings, from, to) {
  const start = toDateOnly(from);
  const end = toDateOnly(to);
  const excluded = new Set(event.excluded_dates || []);

  if (!event.recurrence_rule) {
    const key = dateKey(event.date);
    const inRange = key >= dateKey(start) && key <= dateKey(end);
    return inRange && !excluded.has(key) ? [key] : [];
  }

  const rule = parseRecurrenceRule(event.recurrence_rule);
  if (rule.FREQ !== 'WEEKLY' || rule.BYDAY.length === 0) return [];

  const anchor = toDateOnly(event.date);
  let horizon = toDateOnly(settings.semester_end_date);
  if (rule.UNTIL) {
    const until = toDateOnly(rule.UNTIL);
    if (until < horizon) horizon = until;
  }
  const last = end < horizon ? end : horizon;
  const cursor = new Date(Math.max(start.getTime(), anchor.getTime()));
  const out = [];
  while (cursor <= last) {
    const key = dateKey(cursor);
    if (
      rule.BYDAY.includes(JS_DAY_TO_CODE[cursor.getDay()]) &&
      parityMatches(rule.PARITY, cursor, settings) &&
      !excluded.has(key)
    ) {
      out.push(key);
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}

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
