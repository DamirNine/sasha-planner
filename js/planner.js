import { occurrenceDates, parseRecurrenceRule } from './recurrence.js';
import { toDateOnly, dateKey, addDays, getWeekMonday, getAcademicWeekNumber, getWeekParity, formatDateDDMM } from './dateUtils.js';
import { WEEKDAY_ORDER, WEEKDAY_SHORT_RU, MONTHS_SHORT_RU } from './config.js';

export const MODE_STEP = { day1: 1, day2: 2, week_grid: 7, week_list: 7 };

export function eventsForRange({ shared, personal, done, settings, from, to }) {
  const out = [];
  const collect = (event, isPersonal) => {
    for (const date of occurrenceDates(event, settings, from, to)) {
      const key = `${event.event_id}|${date}`;
      out.push({ ...event, date, isPersonal, isDone: done.has(key), key });
    }
  };
  shared.forEach((e) => collect(e, false));
  personal.forEach((e) => collect(e, true));
  return out.sort((a, b) =>
    a.date.localeCompare(b.date) ||
    (a.start_time || '').localeCompare(b.start_time || '') ||
    (a.title || '').localeCompare(b.title || '', 'ru'));
}

export function weekDaysOf(anchor) {
  const monday = getWeekMonday(anchor);
  return Array.from({ length: 7 }, (_, i) => dateKey(addDays(monday, i)));
}

export function rangeForMode(mode, anchor) {
  const a = toDateOnly(anchor);
  const key = dateKey(a);
  if (mode === 'day1') return { from: a, to: a, days: [key], highlight: [key] };
  if (mode === 'day2') {
    const b = addDays(a, 1);
    const keys = [key, dateKey(b)];
    return { from: a, to: b, days: keys, highlight: keys };
  }
  const days = weekDaysOf(a);
  return { from: toDateOnly(days[0]), to: toDateOnly(days[6]), days, highlight: [key] };
}

export function shiftAnchor(mode, anchor, direction) {
  return addDays(anchor, (MODE_STEP[mode] || 1) * direction);
}

export function weekLabel(date, settings) {
  const parity = getWeekParity(date, settings) === 'numerator' ? 'числитель' : 'знаменатель';
  return `${getAcademicWeekNumber(date, settings)} неделя, ${parity}`;
}

export function weekRangeLabel(days) {
  const first = toDateOnly(days[0]);
  const last = toDateOnly(days[days.length - 1]);
  const month = (d) => MONTHS_SHORT_RU[d.getMonth()];
  if (first.getMonth() === last.getMonth()) return `${first.getDate()} – ${last.getDate()} ${month(last)}`;
  return `${first.getDate()} ${month(first)} – ${last.getDate()} ${month(last)}`;
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function describeSeries(event) {
  let when;
  if (event.recurrence_rule) {
    const rule = parseRecurrenceRule(event.recurrence_rule);
    when = rule.BYDAY.map((code) => capitalize(WEEKDAY_SHORT_RU[WEEKDAY_ORDER.indexOf(code)])).join(', ');
    if (rule.PARITY === 'NUM') when += ', числитель';
    if (rule.PARITY === 'DEN') when += ', знаменатель';
  } else {
    when = formatDateDDMM(event.date);
  }
  const time = [event.start_time, event.end_time].filter(Boolean).join('–');
  return [when, time, event.place].filter(Boolean).join(' · ');
}

function seriesSortKey(event) {
  if (event.recurrence_rule) {
    const first = parseRecurrenceRule(event.recurrence_rule).BYDAY[0];
    return `0|${WEEKDAY_ORDER.indexOf(first)}|${event.start_time || ''}`;
  }
  return `1|${event.date}|${event.start_time || ''}`;
}

export function sortSeries(events) {
  return [...events].sort((a, b) => seriesSortKey(a).localeCompare(seriesSortKey(b)));
}
