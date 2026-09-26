import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toMinutes, gridBounds, assignLanes } from '../js/layout.js';

test('toMinutes parses HH:MM', () => {
  assert.equal(toMinutes('08:30'), 510);
  assert.equal(toMinutes('00:00'), 0);
});

test('gridBounds defaults to 8–20 and widens to whole hours around events', () => {
  assert.deepEqual(gridBounds([]), { start: 480, end: 1200 });
  const occ = [
    { start_time: '07:15', end_time: '08:00' },
    { start_time: '20:30', end_time: '' },
    { start_time: '', end_time: '' },
  ];
  assert.deepEqual(gridBounds(occ), { start: 420, end: 1320 });
});

test('assignLanes puts overlapping items side by side; non-overlapping items keep full width', () => {
  const out = assignLanes([
    { id: 'a', start: 600, end: 690 },
    { id: 'b', start: 630, end: 700 },
    { id: 'c', start: 700, end: 760 },
  ]);
  const byId = Object.fromEntries(out.map((o) => [o.id, o]));
  assert.deepEqual([byId.a.lane, byId.a.laneCount], [0, 2]);
  assert.deepEqual([byId.b.lane, byId.b.laneCount], [1, 2]);
  assert.deepEqual([byId.c.lane, byId.c.laneCount], [0, 1]);
});

test('assignLanes reuses a freed lane inside one overlapping cluster', () => {
  const out = assignLanes([
    { id: 'long', start: 600, end: 800 },
    { id: 'x', start: 610, end: 650 },
    { id: 'y', start: 660, end: 700 },
  ]);
  const byId = Object.fromEntries(out.map((o) => [o.id, o]));
  assert.deepEqual([byId.x.lane, byId.y.lane], [1, 1]);
  assert.ok(out.every((o) => o.laneCount === 2));
});
