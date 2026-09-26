import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildEventFields, buildDeleteOp } from '../js/forms.js';

const base = { title: '  Спортзал ', event_type: 'sport', date: '2026-09-28', hasTime: true, start_time: '18:00', end_time: '19:30', place: ' Зал ', teacher: '', notes: '', repeatDays: [] };

test('buildEventFields trims text and builds a one-off event', () => {
  const f = buildEventFields(base);
  assert.equal(f.title, 'Спортзал');
  assert.equal(f.place, 'Зал');
  assert.equal(f.recurrence_rule, '');
  assert.equal(f.start_time, '18:00');
});

test('buildEventFields builds a weekly rule from chosen days and drops times when unchecked', () => {
  const f = buildEventFields({ ...base, hasTime: false, repeatDays: ['MO', 'TH'] });
  assert.equal(f.recurrence_rule, 'FREQ=WEEKLY;BYDAY=MO,TH');
  assert.equal(f.start_time, '');
  assert.equal(f.end_time, '');
});

test('buildEventFields rejects empty title, missing date, missing start, end before start', () => {
  assert.throws(() => buildEventFields({ ...base, title: '   ' }), /название/);
  assert.throws(() => buildEventFields({ ...base, date: '' }), /дату/);
  assert.throws(() => buildEventFields({ ...base, start_time: '' }), /начала/);
  assert.throws(() => buildEventFields({ ...base, start_time: '19:00', end_time: '18:00' }), /раньше начала/);
});

test('buildDeleteOp: one-off and "all" delete the series, chosen days become an exclude op', () => {
  const oneOff = { event_id: 'a', recurrence_rule: '' };
  const weekly = { event_id: 'b', recurrence_rule: 'FREQ=WEEKLY;BYDAY=MO' };
  assert.deepEqual(buildDeleteOp(oneOff, 'dates', ['2026-09-28']), { type: 'delete', id: 'a' });
  assert.deepEqual(buildDeleteOp(weekly, 'all'), { type: 'delete', id: 'b' });
  assert.deepEqual(buildDeleteOp(weekly, 'dates', ['2026-10-05', '2026-09-28']), { type: 'exclude', id: 'b', dates: ['2026-09-28', '2026-10-05'] });
  assert.throws(() => buildDeleteOp(weekly, 'dates', []), /хотя бы один день/);
});
