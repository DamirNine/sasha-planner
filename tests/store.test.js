import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../js/store.js';

const settings = { reference_monday: '2026-08-31', reference_parity: 'numerator', semester_end_date: '2026-12-31' };

test('setEventCompleted marks dirty; autosave fires once, 30s after the LAST change', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const writes = [];
  const store = createStore({
    readEvents: async () => [{ event_id: 'e1', progress_group: 'required', completed: false, recurrence_rule: '' }],
    readSettings: async () => settings,
    writeEvents: async (events) => { writes.push(events); },
  });

  await store.load();
  store.setEventCompleted('e1', true);
  t.mock.timers.tick(10000);
  store.setEventCompleted('e1', false); // must reset the 30s timer, not add to it
  t.mock.timers.tick(20000);
  assert.equal(writes.length, 0, 'must not save yet — only 20s since the last change');

  t.mock.timers.tick(10000); // total 30s since the second change
  assert.equal(writes.length, 1);
  assert.equal(writes[0][0].completed, false);
});

test('manual save() writes immediately and cancels the pending autosave', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const writes = [];
  const store = createStore({
    readEvents: async () => [{ event_id: 'e1', progress_group: 'required', completed: false, recurrence_rule: '' }],
    readSettings: async () => settings,
    writeEvents: async (events) => { writes.push(events); },
  });
  await store.load();
  store.setEventCompleted('e1', true);
  await store.save();
  assert.equal(writes.length, 1);
  t.mock.timers.tick(30000);
  assert.equal(writes.length, 1, 'no duplicate autosave after a manual save already cleared the timer');
});

test('load() expands missing recurrences and marks the store dirty so they persist', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const writes = [];
  const store = createStore({
    readEvents: async () => [{ event_id: 'tpl-1', date: '2026-09-01', recurrence_rule: 'FREQ=WEEKLY;BYDAY=TU', source_type: 'recurring', title: 'Репетиторство', event_type: 'tutoring', place: '', teacher: '', progress_group: 'required', priority: '', notes: '' }],
    readSettings: async () => settings,
    writeEvents: async (events) => { writes.push(events); },
  });
  await store.load();
  const { events, dirty } = store.getState();
  assert.ok(events.length > 1, 'should have generated instances beyond the template');
  assert.equal(dirty, true);
  t.mock.timers.tick(30000);
  assert.equal(writes.length, 1, 'generated instances get autosaved like any other change');
});

test('addEvent adds a one-off event and marks the store dirty', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const store = createStore({
    readEvents: async () => [],
    readSettings: async () => settings,
    writeEvents: async () => {},
  });
  await store.load();
  const created = store.addEvent({ title: 'Сходить в магазин', date: '2026-09-20', progress_group: 'task' });
  const { events, dirty } = store.getState();
  assert.equal(events.length, 1);
  assert.equal(events[0].event_id, created.event_id);
  assert.equal(events[0].title, 'Сходить в магазин');
  assert.equal(dirty, true);
});

test('addEvent with a recurrence_rule immediately expands into instances too', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const store = createStore({
    readEvents: async () => [],
    readSettings: async () => settings,
    writeEvents: async () => {},
  });
  await store.load();
  store.addEvent({
    title: 'Бег по утрам',
    date: '2026-09-01',
    progress_group: 'task',
    recurrence_rule: 'FREQ=WEEKLY;BYDAY=TU,TH',
  });
  const { events } = store.getState();
  assert.ok(events.length > 1, 'the template plus its generated instances should both be present');
  assert.ok(events.some((e) => e.parent_event_id && e.title === 'Бег по утрам'));
});

test('subscribe() is notified after load and after each change', async () => {
  const store = createStore({
    readEvents: async () => [],
    readSettings: async () => settings,
    writeEvents: async () => {},
  });
  let calls = 0;
  store.subscribe(() => { calls += 1; });
  await store.load();
  assert.equal(calls, 1);
});
