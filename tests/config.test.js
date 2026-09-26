import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EVENT_TYPES, WEEKDAY_ORDER, WEEKDAY_SHORT_RU, OWNER, REPO } from '../js/config.js';

test('EVENT_TYPES covers every type used in the seed schedule', () => {
  for (const type of ['lecture', 'seminar', 'lab', 'sport', 'vuc', 'consultation', 'tutoring', 'selfstudy', 'task', 'other']) {
    assert.ok(EVENT_TYPES[type], `missing color for ${type}`);
    assert.match(EVENT_TYPES[type].color, /^#[0-9A-Fa-f]{6}$/);
  }
});

test('WEEKDAY_ORDER has 7 unique codes starting Monday, all with short labels', () => {
  assert.equal(WEEKDAY_ORDER.length, 7);
  assert.equal(WEEKDAY_ORDER[0], 'MO');
  assert.equal(new Set(WEEKDAY_ORDER).size, 7);
  assert.equal(WEEKDAY_SHORT_RU.length, 7);
  assert.equal(WEEKDAY_SHORT_RU[0], 'пн');
});

test('repo constants point at the public planner repo', () => {
  assert.equal(OWNER, 'DamirNine');
  assert.equal(REPO, 'sasha-planner');
});
