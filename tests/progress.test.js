// tests/progress.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeProgress, renderBar, formatPercent } from '../js/progress.js';

test('70/30 split when both categories present', () => {
  const events = [
    { progress_group: 'required', completed: true },
    { progress_group: 'required', completed: false },
    { progress_group: 'task', completed: true },
  ];
  const p = computeProgress(events, 0.7, 0.3);
  assert.equal(p.percent, 0.7 * 0.5 + 0.3 * 1);
});

test('required-only day scales to 100%', () => {
  const events = [
    { progress_group: 'required', completed: true },
    { progress_group: 'required', completed: true },
  ];
  assert.equal(computeProgress(events, 0.7, 0.3).percent, 1);
});

test('task-only day scales to 100%', () => {
  const events = [{ progress_group: 'task', completed: false }];
  assert.equal(computeProgress(events, 0.7, 0.3).percent, 0);
});

test('empty day is "free", not a failure', () => {
  const p = computeProgress([], 0.7, 0.3);
  assert.equal(p.percent, null);
  assert.equal(formatPercent(p.percent), 'Свободно');
});

test('renderBar renders 6/10 filled for 60%', () => {
  assert.equal(renderBar(0.6), '●●●●●●○○○○');
});

test('formatPercent rounds to whole percent', () => {
  assert.equal(formatPercent(0.665), '67%');
});
