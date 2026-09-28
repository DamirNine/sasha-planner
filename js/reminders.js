import { occurrenceDates } from './recurrence.js';
import { formatDateDDMM } from './dateUtils.js';

export const DEFAULT_TIME = '09:00';
export const UNIT_MINUTES = { min: 1, hour: 60, day: 1440, week: 10080 };
const MAX_OFFSET = 60 * 1440;
const MINUTE = 60000;

const UNIT_WORDS = {
  min: ['минуту', 'минуты', 'минут'],
  hour: ['час', 'часа', 'часов'],
  day: ['день', 'дня', 'дней'],
  week: ['неделю', 'недели', 'недель'],
};

function plural(n, [one, few, many]) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

export function normalizeOffsets(list) {
  if (!Array.isArray(list)) return [];
  const valid = list.filter((x) => Number.isInteger(x) && x >= 1 && x <= MAX_OFFSET);
  return [...new Set(valid)].sort((a, b) => a - b);
}

export function splitOffset(minutes) {
  for (const unit of ['week', 'day', 'hour']) {
    if (minutes % UNIT_MINUTES[unit] === 0) return { value: minutes / UNIT_MINUTES[unit], unit };
  }
  return { value: minutes, unit: 'min' };
}

function offsetPhrase(minutes) {
  const { value, unit } = splitOffset(minutes);
  return `${value} ${plural(value, UNIT_WORDS[unit])}`;
}

export function formatOffset(minutes) {
  return `за ${offsetPhrase(minutes)}`;
}

export function occurrenceStartUtc(date, time, utcOffsetMinutes) {
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = (time || DEFAULT_TIME).split(':').map(Number);
  return Date.UTC(y, m - 1, d, hh, mm) - utcOffsetMinutes * MINUTE;
}

function localDateKey(ms, utcOffsetMinutes) {
  return new Date(ms + utcOffsetMinutes * MINUTE).toISOString().slice(0, 10);
}

export function dueReminders({ events, settings, reminders, utcOffsetMinutes, from, to }) {
  const out = [];
  for (const { event_id: id, offsets } of reminders) {
    const event = events.get(id);
    if (!event) continue;
    for (const offset of normalizeOffsets(offsets)) {
      const startFrom = from + offset * MINUTE;
      const startTo = to + offset * MINUTE;
      const dates = occurrenceDates(event, settings, localDateKey(startFrom, utcOffsetMinutes), localDateKey(startTo, utcOffsetMinutes));
      for (const date of dates) {
        const start = occurrenceStartUtc(date, event.start_time, utcOffsetMinutes);
        if (start > startFrom && start <= startTo) {
          out.push({ key: `${id}|${date}|${offset}`, event, date, offset, fireAt: start - offset * MINUTE });
        }
      }
    }
  }
  return out;
}

export function reminderMessage(event, date, offset) {
  const body = [`через ${offsetPhrase(offset)}`, formatDateDDMM(date), event.start_time, event.place].filter(Boolean).join(' · ');
  return { title: event.title, body, url: `./?date=${date}` };
}

export function remindersChanged(before, after) {
  return Object.entries(after).some(([id, offsets]) => String(before[id] || '') !== String(offsets));
}
