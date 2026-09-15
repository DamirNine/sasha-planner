// tests/recurrence.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRecurrenceRule, expandRecurrence, generateAllRecurrences } from '../js/recurrence.js';
import { dateKey, getWeekParity } from '../js/dateUtils.js';

const settings = {
  reference_monday: '2026-08-31',
  reference_parity: 'numerator',
  semester_end_date: '2026-12-31',
};

test('parseRecurrenceRule reads FREQ/BYDAY/PARITY/UNTIL', () => {
  const r = parseRecurrenceRule('FREQ=WEEKLY;BYDAY=TU,FR;PARITY=NUM;UNTIL=2026-12-31');
  assert.equal(r.FREQ, 'WEEKLY');
  assert.deepEqual(r.BYDAY, ['TU', 'FR']);
  assert.equal(r.PARITY, 'NUM');
  assert.equal(r.UNTIL, '2026-12-31');
});

test('numerator-only Monday template stays on numerator weeks, stepping 14 days', () => {
  const dates = expandRecurrence({ date: '2026-08-31', recurrence_rule: 'FREQ=WEEKLY;BYDAY=MO;PARITY=NUM' }, settings);
  assert.ok(dates.length > 5);
  for (const d of dates) assert.equal(getWeekParity(d, settings), 'numerator');
  assert.equal(dateKey(dates[1]), '2026-09-14');
});

test('every-week template (tutoring) steps 7 days regardless of parity', () => {
  const dates = expandRecurrence({ date: '2026-09-01', recurrence_rule: 'FREQ=WEEKLY;BYDAY=TU' }, settings);
  assert.equal(dateKey(dates[1]), '2026-09-08');
});

test('UNTIL caps generation before the semester horizon', () => {
  const dates = expandRecurrence({ date: '2026-09-04', recurrence_rule: 'FREQ=WEEKLY;BYDAY=FR;UNTIL=2026-09-18' }, settings);
  assert.equal(dateKey(dates.at(-1)), '2026-09-18');
});

test('generateAllRecurrences returns only new instances, keyed by parent_event_id+date', () => {
  const events = [
    { event_id: 'tpl-1', date: '2026-09-01', recurrence_rule: 'FREQ=WEEKLY;BYDAY=TU', source_type: 'recurring', title: 'Репетиторство', event_type: 'tutoring', place: '', teacher: '', progress_group: 'required', priority: '', notes: '' },
    { event_id: 'inst-1', date: '2026-09-01', recurrence_rule: '', parent_event_id: 'tpl-1', title: 'Репетиторство', completed: true },
  ];
  const created = generateAllRecurrences(events, settings);
  assert.ok(created.every((e) => e.parent_event_id === 'tpl-1'));
  assert.ok(!created.some((e) => dateKey(e.date) === '2026-09-01'), 'the already-existing 09-01 instance must not be duplicated');
  assert.ok(created.some((e) => dateKey(e.date) === '2026-09-08'));
  assert.equal(events.length, 2, 'generateAllRecurrences must not mutate its input');
});

test('semester_end_date caps generation even when the template UNTIL is later', () => {
  const dates = expandRecurrence(
    { date: '2026-09-04', recurrence_rule: 'FREQ=WEEKLY;BYDAY=FR;UNTIL=2027-06-30' },
    settings // settings.semester_end_date is '2026-12-31'
  );
  assert.equal(dateKey(dates.at(-1)), '2026-12-25'); // last Friday on/before 2026-12-31
  assert.ok(dates.every((d) => dateKey(d) <= '2026-12-31'));
});

test('generateAllRecurrences does not mutate any field of existing event objects', () => {
  const events = [
    { event_id: 'tpl-1', date: '2026-09-01', recurrence_rule: 'FREQ=WEEKLY;BYDAY=TU', source_type: 'recurring', title: 'Репетиторство', event_type: 'tutoring', place: '', teacher: '', progress_group: 'required', priority: '', notes: '' },
  ];
  const snapshot = structuredClone(events);
  generateAllRecurrences(events, settings);
  assert.deepEqual(events, snapshot, 'input events must be byte-for-byte unchanged');
});
