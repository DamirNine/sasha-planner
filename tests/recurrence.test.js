// tests/recurrence.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRecurrenceRule, occurrenceDates } from '../js/recurrence.js';

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

test('occurrenceDates: one-off event inside and outside the range', () => {
  const ev = { date: '2026-09-15', recurrence_rule: '' };
  assert.deepEqual(occurrenceDates(ev, settings, '2026-09-14', '2026-09-20'), ['2026-09-15']);
  assert.deepEqual(occurrenceDates(ev, settings, '2026-09-16', '2026-09-20'), []);
});

test('occurrenceDates: excluded_dates are skipped for one-off and weekly events', () => {
  assert.deepEqual(occurrenceDates({ date: '2026-09-15', recurrence_rule: '', excluded_dates: ['2026-09-15'] }, settings, '2026-09-14', '2026-09-20'), []);
  const weekly = { date: '2026-09-01', recurrence_rule: 'FREQ=WEEKLY;BYDAY=TU', excluded_dates: ['2026-09-08'] };
  assert.deepEqual(occurrenceDates(weekly, settings, '2026-09-01', '2026-09-15'), ['2026-09-01', '2026-09-15']);
});

test('occurrenceDates: PARITY=NUM only on numerator weeks, PARITY=DEN only on denominator weeks', () => {
  const num = { date: '2026-08-31', recurrence_rule: 'FREQ=WEEKLY;BYDAY=MO;PARITY=NUM' };
  assert.deepEqual(occurrenceDates(num, settings, '2026-08-31', '2026-09-27'), ['2026-08-31', '2026-09-14']);
  const den = { date: '2026-09-07', recurrence_rule: 'FREQ=WEEKLY;BYDAY=MO;PARITY=DEN' };
  assert.deepEqual(occurrenceDates(den, settings, '2026-08-31', '2026-09-27'), ['2026-09-07', '2026-09-21']);
});

test('occurrenceDates: several BYDAY days all occur', () => {
  const ev = { date: '2026-09-07', recurrence_rule: 'FREQ=WEEKLY;BYDAY=MO,WE' };
  assert.deepEqual(occurrenceDates(ev, settings, '2026-09-07', '2026-09-13'), ['2026-09-07', '2026-09-09']);
});

test('occurrenceDates: nothing before the anchor date, nothing after UNTIL or semester end', () => {
  const ev = { date: '2026-09-18', recurrence_rule: 'FREQ=WEEKLY;BYDAY=FR;UNTIL=2026-10-02' };
  assert.deepEqual(occurrenceDates(ev, settings, '2026-09-01', '2026-12-31'), ['2026-09-18', '2026-09-25', '2026-10-02']);
  const open = { date: '2026-12-18', recurrence_rule: 'FREQ=WEEKLY;BYDAY=FR' };
  assert.deepEqual(occurrenceDates(open, settings, '2026-12-01', '2027-01-31'), ['2026-12-18', '2026-12-25']);
});
