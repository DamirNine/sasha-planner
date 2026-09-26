import { test } from 'node:test';
import assert from 'node:assert/strict';
import { eventsForRange, rangeForMode, shiftAnchor, weekDaysOf, weekLabel, describeSeries, sortSeries, MODE_STEP } from '../js/planner.js';
import { dateKey } from '../js/dateUtils.js';

const settings = { reference_monday: '2026-08-31', reference_parity: 'numerator', semester_end_date: '2026-12-31' };
const lecture = { event_id: 'den-mon-1', title: 'Разработка программных систем', date: '2026-09-07', start_time: '10:10', end_time: '11:40', recurrence_rule: 'FREQ=WEEKLY;BYDAY=MO;PARITY=DEN', excluded_dates: [] };
const early = { event_id: 'den-mon-0', title: 'Ранняя пара', date: '2026-09-07', start_time: '08:30', end_time: '10:00', recurrence_rule: 'FREQ=WEEKLY;BYDAY=MO;PARITY=DEN', excluded_dates: ['2026-09-21'] };
const gym = { event_id: 'p-gym', title: 'Спортзал', date: '2026-09-21', start_time: '', end_time: '', recurrence_rule: '', excluded_dates: [] };

test('eventsForRange merges shared and personal, marks done, sorts untimed first then by time', () => {
  const done = new Set(['den-mon-1|2026-09-21']);
  const out = eventsForRange({ shared: [lecture, early], personal: [gym], done, settings, from: '2026-09-21', to: '2026-09-21' });
  assert.deepEqual(out.map((o) => o.title), ['Спортзал', 'Разработка программных систем']);
  assert.equal(out[0].isPersonal, true);
  assert.equal(out[1].isPersonal, false);
  assert.equal(out[1].isDone, true);
  assert.equal(out[1].key, 'den-mon-1|2026-09-21');
  assert.equal(out[1].date, '2026-09-21');
});

test('rangeForMode: day1, day2 and both week modes on a Wednesday', () => {
  assert.deepEqual(rangeForMode('day1', '2026-09-23').days, ['2026-09-23']);
  const d2 = rangeForMode('day2', '2026-09-23');
  assert.deepEqual(d2.days, ['2026-09-23', '2026-09-24']);
  assert.deepEqual(d2.highlight, ['2026-09-23', '2026-09-24']);
  for (const mode of ['week_grid', 'week_list']) {
    const w = rangeForMode(mode, '2026-09-23');
    assert.equal(w.days.length, 7);
    assert.equal(w.days[0], '2026-09-21');
    assert.equal(dateKey(w.to), '2026-09-27');
    assert.deepEqual(w.highlight, ['2026-09-23']);
  }
});

test('a Sunday anchor belongs to the week that started the previous Monday', () => {
  assert.equal(rangeForMode('week_list', '2026-09-27').days[0], '2026-09-21');
  assert.deepEqual(weekDaysOf('2026-09-27'), ['2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25', '2026-09-26', '2026-09-27']);
});

test('shiftAnchor moves by the mode step in both directions', () => {
  assert.deepEqual(MODE_STEP, { day1: 1, day2: 2, week_grid: 7, week_list: 7 });
  assert.equal(dateKey(shiftAnchor('day1', '2026-09-30', 1)), '2026-10-01');
  assert.equal(dateKey(shiftAnchor('day2', '2026-09-23', 1)), '2026-09-25');
  assert.equal(dateKey(shiftAnchor('week_grid', '2026-09-23', -1)), '2026-09-16');
});

test('weeks after the semester end produce no recurring occurrences and do not throw', () => {
  const r = rangeForMode('week_list', '2027-01-06');
  const out = eventsForRange({ shared: [lecture], personal: [], done: new Set(), settings, from: r.from, to: r.to });
  assert.deepEqual(out, []);
});

test('weekLabel matches the reference screenshot: 21.09.2026 is week 4, denominator', () => {
  assert.equal(weekLabel('2026-09-21', settings), '4 неделя, знаменатель');
  assert.equal(weekLabel('2026-09-14', settings), '3 неделя, числитель');
});

test('describeSeries summarizes weekday, parity, time and place', () => {
  assert.equal(describeSeries({ ...lecture, place: '417' }), 'Пн, знаменатель · 10:10–11:40 · 417');
  assert.equal(describeSeries({ title: 'Поход', date: '2026-09-15', start_time: '17:25', end_time: '', recurrence_rule: '', place: '' }), '15.09 · 17:25');
  assert.equal(describeSeries({ date: '2026-09-01', start_time: '18:00', end_time: '20:30', recurrence_rule: 'FREQ=WEEKLY;BYDAY=TU,FR', place: '' }), 'Вт, Пт · 18:00–20:30');
});

test('sortSeries puts recurring series first (by weekday, time) then one-offs by date', () => {
  const tue = { event_id: 'tue', date: '2026-09-01', start_time: '18:00', recurrence_rule: 'FREQ=WEEKLY;BYDAY=TU' };
  const monLate = { event_id: 'mon-late', date: '2026-08-31', start_time: '14:05', recurrence_rule: 'FREQ=WEEKLY;BYDAY=MO' };
  const monEarly = { event_id: 'mon-early', date: '2026-08-31', start_time: '10:10', recurrence_rule: 'FREQ=WEEKLY;BYDAY=MO' };
  const oneOffLate = { event_id: 'nov', date: '2026-11-04', start_time: '12:00', recurrence_rule: '' };
  const oneOffEarly = { event_id: 'sep', date: '2026-09-15', start_time: '17:25', recurrence_rule: '' };
  assert.deepEqual(sortSeries([oneOffLate, tue, monLate, oneOffEarly, monEarly]).map((e) => e.event_id), ['mon-early', 'mon-late', 'tue', 'sep', 'nov']);
});
