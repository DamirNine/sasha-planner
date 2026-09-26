import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeEvent, applyOp, normalizeEvents } from '../js/eventOps.js';

const NOW = '2026-09-26T10:00:00.000Z';

test('makeEvent fills defaults and keeps given fields', () => {
  const ev = makeEvent({ title: 'Спортзал', date: '2026-09-28' }, { now: NOW, id: 'id-1' });
  assert.equal(ev.event_id, 'id-1');
  assert.equal(ev.title, 'Спортзал');
  assert.equal(ev.recurrence_rule, '');
  assert.deepEqual(ev.excluded_dates, []);
  assert.equal(ev.created_at, NOW);
  assert.equal(ev.updated_at, NOW);
  assert.ok(!('completed' in ev));
  assert.ok(!('parent_event_id' in ev));
});

test('makeEvent generates a unique id when none is given', () => {
  assert.notEqual(makeEvent({}).event_id, makeEvent({}).event_id);
});

test('applyOp add appends without mutating, and is idempotent by event_id', () => {
  const events = [makeEvent({ title: 'A' }, { id: 'a', now: NOW })];
  const b = makeEvent({ title: 'B' }, { id: 'b', now: NOW });
  const once = applyOp(events, { type: 'add', event: b });
  assert.equal(events.length, 1);
  assert.deepEqual(once.map((e) => e.event_id), ['a', 'b']);
  assert.equal(applyOp(once, { type: 'add', event: b }).length, 2);
});

test('applyOp exclude unions and sorts dates and bumps updated_at', () => {
  const events = [makeEvent({ recurrence_rule: 'FREQ=WEEKLY;BYDAY=MO', excluded_dates: ['2026-10-05'] }, { id: 'a', now: NOW })];
  const out = applyOp(events, { type: 'exclude', id: 'a', dates: ['2026-09-28', '2026-10-05'] }, '2026-09-27T00:00:00.000Z');
  assert.deepEqual(out[0].excluded_dates, ['2026-09-28', '2026-10-05']);
  assert.equal(out[0].updated_at, '2026-09-27T00:00:00.000Z');
  assert.deepEqual(events[0].excluded_dates, ['2026-10-05'], 'input not mutated');
});

test('applyOp delete removes the series; unknown op throws', () => {
  const events = [makeEvent({}, { id: 'a' }), makeEvent({}, { id: 'b' })];
  assert.deepEqual(applyOp(events, { type: 'delete', id: 'a' }).map((e) => e.event_id), ['b']);
  assert.throws(() => applyOp(events, { type: 'rename' }), /Неизвестная операция/);
});

test('normalizeEvents turns v1 data (instances, completed) into v2 series', () => {
  const v1 = [
    { event_id: 'num-mon-1', recurrence_rule: 'FREQ=WEEKLY;BYDAY=MO;PARITY=NUM', parent_event_id: '', completed: false, title: 'Пара', date: '2026-08-31' },
    { event_id: 'x1', parent_event_id: 'num-mon-1', completed: true, title: 'Пара', date: '2026-09-14', recurrence_rule: '' },
    { event_id: 'hike', parent_event_id: '', completed: false, title: 'Поход', date: '2026-09-15', recurrence_rule: '' },
  ];
  const out = normalizeEvents(v1);
  assert.deepEqual(out.map((e) => e.event_id), ['num-mon-1', 'hike']);
  for (const e of out) {
    assert.ok(!('completed' in e));
    assert.ok(!('parent_event_id' in e));
    assert.deepEqual(e.excluded_dates, []);
  }
  assert.equal(v1.length, 3, 'input not mutated');
  assert.deepEqual(normalizeEvents(out), out, 'idempotent');
});
