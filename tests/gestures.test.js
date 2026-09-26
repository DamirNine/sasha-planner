import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifySwipe, classifyPull } from '../js/gestures.js';

test('horizontal swipes: left is next, right is prev', () => {
  assert.equal(classifySwipe(-80, 10), 'next');
  assert.equal(classifySwipe(80, -5), 'prev');
});

test('short or mostly vertical moves are not swipes', () => {
  assert.equal(classifySwipe(-30, 0), null);
  assert.equal(classifySwipe(-80, -90), null);
  assert.equal(classifySwipe(0, 0), null);
});

test('pull-to-refresh only from the top, mostly downward, long enough', () => {
  assert.equal(classifyPull(0, 120, true), true);
  assert.equal(classifyPull(0, 120, false), false);
  assert.equal(classifyPull(100, 120, true), false);
  assert.equal(classifyPull(0, 40, true), false);
});
