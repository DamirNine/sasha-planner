// tests/seedData.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseRecurrenceRule, occurrenceDates } from '../js/recurrence.js';
import { getWeekParity } from '../js/dateUtils.js';

const events = JSON.parse(readFileSync(new URL('../data/db.json', import.meta.url)));
const settings = JSON.parse(readFileSync(new URL('../data/settings.json', import.meta.url)));

test('every event_id is unique', () => {
  const ids = events.map((e) => e.event_id);
  assert.equal(new Set(ids).size, ids.length);
});

test('every event has a title and either a date or a recurrence anchor date', () => {
  for (const e of events) {
    assert.ok(e.title && e.title.length > 0, `missing title on ${e.event_id}`);
    assert.ok(e.date, `missing date on ${e.event_id}`);
  }
});

test('every progress_group is required or task', () => {
  for (const e of events) {
    assert.ok(['required', 'task'].includes(e.progress_group), `bad progress_group on ${e.event_id}`);
  }
});

test('every recurrence_rule parses to a supported WEEKLY rule', () => {
  for (const e of events) {
    if (!e.recurrence_rule) continue;
    const rule = parseRecurrenceRule(e.recurrence_rule);
    assert.equal(rule.FREQ, 'WEEKLY', `unsupported FREQ on ${e.event_id}`);
    assert.ok(rule.BYDAY.length > 0, `missing BYDAY on ${e.event_id}`);
  }
});

test('PARITY=NUM templates only ever land on numerator weeks', () => {
  const tpl = events.find((e) => e.event_id === 'num-mon-1');
  const dates = occurrenceDates(tpl, settings, settings.reference_monday, settings.semester_end_date);
  assert.ok(dates.length > 3);
  for (const d of dates) assert.equal(getWeekParity(d, settings), 'numerator');
});

test('PARITY=DEN templates only ever land on denominator weeks', () => {
  const tpl = events.find((e) => e.event_id === 'den-mon-1');
  const dates = occurrenceDates(tpl, settings, settings.reference_monday, settings.semester_end_date);
  assert.ok(dates.length > 3);
  for (const d of dates) assert.equal(getWeekParity(d, settings), 'denominator');
});

test('no Дмитров/Dmitrov event was added (contradictory dates, needs clarification)', () => {
  assert.ok(!events.some((e) => /дмитров/i.test(e.title)));
});

test('db.json is in v2 format: series only, no completed/parent_event_id, excluded_dates arrays', () => {
  for (const e of events) {
    assert.ok(!('completed' in e), `completed left on ${e.event_id}`);
    assert.ok(!('parent_event_id' in e), `parent_event_id left on ${e.event_id}`);
    assert.ok(Array.isArray(e.excluded_dates), `excluded_dates missing on ${e.event_id}`);
  }
});
