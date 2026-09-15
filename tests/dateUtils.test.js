// tests/dateUtils.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toDateOnly, dateKey, formatDateDDMM, getWeekMonday, getWeekRange, getAcademicWeekNumber, getWeekParity } from '../js/dateUtils.js';

const settings = { reference_monday: '2026-08-31', reference_parity: 'numerator' };

test('dateKey formats a local date-only string', () => {
  assert.equal(dateKey('2026-09-14'), '2026-09-14');
  assert.equal(dateKey(new Date(2026, 8, 14)), '2026-09-14');
});

test('formatDateDDMM formats day.month', () => {
  assert.equal(formatDateDDMM('2026-09-01'), '01.09');
});

test('getWeekMonday normalizes any weekday to that week\'s Monday', () => {
  assert.equal(dateKey(getWeekMonday('2026-09-17')), '2026-09-14');
  assert.equal(dateKey(getWeekMonday('2026-09-14')), '2026-09-14');
});

test('getWeekRange returns Monday..Sunday', () => {
  const { start, end } = getWeekRange('2026-09-16');
  assert.equal(dateKey(start), '2026-09-14');
  assert.equal(dateKey(end), '2026-09-20');
});

test('week number and parity for the user-confirmed reference point', () => {
  assert.equal(getAcademicWeekNumber('2026-09-01', settings), 1);
  assert.equal(getWeekParity('2026-09-01', settings), 'numerator');
  assert.equal(getWeekParity('2026-08-31', settings), 'numerator');
});

test('week 3 (14-20 Sept 2026) is numerator per the full schedule appendix', () => {
  assert.equal(getAcademicWeekNumber('2026-09-14', settings), 3);
  assert.equal(getWeekParity('2026-09-14', settings), 'numerator');
});

test('week 4 (21-27 Sept 2026) is denominator per the full schedule appendix', () => {
  assert.equal(getAcademicWeekNumber('2026-09-21', settings), 4);
  assert.equal(getWeekParity('2026-09-21', settings), 'denominator');
});

test('toDateOnly strips time-of-day', () => {
  const d = toDateOnly('2026-09-14T15:30:00');
  assert.equal(d.getHours(), 0);
  assert.equal(d.getMinutes(), 0);
});

test('toDateOnly parses a bare date string as a local date, not UTC-then-shifted', () => {
  // Regression test: new Date('2026-09-14') parses as UTC midnight; reading it back
  // in a negative-UTC-offset timezone previously rolled the date back to 2026-09-13.
  assert.equal(dateKey(toDateOnly('2026-09-14')), '2026-09-14');
});
