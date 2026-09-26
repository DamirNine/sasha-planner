import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLocalStore, VIEW_MODES } from '../js/localStore.js';

function mem(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    map,
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  };
}

test('empty storage yields defaults', () => {
  const s = createLocalStore(mem());
  assert.deepEqual(s.getPersonal(), []);
  assert.equal(s.getDone().size, 0);
  assert.equal(s.getSharedCache(), null);
  assert.equal(s.getViewMode(), 'day1');
  assert.equal(s.isBannerDismissed(), false);
});

test('corrupted values fall back to defaults instead of throwing', () => {
  const s = createLocalStore(mem({
    sp_personal_events: '{oops',
    sp_done: '"not-an-array"',
    sp_shared_cache: '{"events": 5}',
    sp_view_mode: 'zoom-9000',
  }));
  assert.deepEqual(s.getPersonal(), []);
  assert.equal(s.getDone().size, 0);
  assert.equal(s.getSharedCache(), null);
  assert.equal(s.getViewMode(), 'day1');
});

test('storage that throws on every access still yields defaults', () => {
  const broken = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } };
  const s = createLocalStore(broken);
  assert.deepEqual(s.getPersonal(), []);
  assert.equal(s.getViewMode(), 'day1');
});

test('personal events, view mode, cache and banner flag round-trip', () => {
  const storage = mem();
  const s = createLocalStore(storage);
  s.setPersonal([{ event_id: 'p1', title: 'Спортзал' }]);
  s.setViewMode('week_list');
  s.setSharedCache({ sha: 'abc', events: [{ event_id: 'e1' }], settings: { group: 'РК6-55Б' }, fetched_at: 'now' });
  s.dismissBanner();
  const again = createLocalStore(storage);
  assert.equal(again.getPersonal()[0].title, 'Спортзал');
  assert.equal(again.getViewMode(), 'week_list');
  assert.equal(again.getSharedCache().sha, 'abc');
  assert.equal(again.isBannerDismissed(), true);
  assert.deepEqual(VIEW_MODES, ['day1', 'day2', 'week_grid', 'week_list']);
});

test('toggleDone adds then removes a key and persists', () => {
  const storage = mem();
  const s = createLocalStore(storage);
  assert.equal(s.toggleDone('num-mon-1|2026-09-14'), true);
  assert.ok(createLocalStore(storage).getDone().has('num-mon-1|2026-09-14'));
  assert.equal(s.toggleDone('num-mon-1|2026-09-14'), false);
  assert.equal(createLocalStore(storage).getDone().size, 0);
});

test('export on one phone, import on another merges personal events and done marks', () => {
  const a = createLocalStore(mem());
  a.setPersonal([{ event_id: 'p1', title: 'Новое имя' }, { event_id: 'p2', title: 'Бег' }]);
  a.toggleDone('p2|2026-09-28');
  const b = createLocalStore(mem());
  b.setPersonal([{ event_id: 'p1', title: 'Старое имя' }, { event_id: 'p3', title: 'Книга' }]);
  b.toggleDone('p3|2026-09-27');
  const result = b.importPersonal(a.exportPersonal());
  assert.deepEqual(result, { events: 2, done: 1 });
  const byId = Object.fromEntries(b.getPersonal().map((e) => [e.event_id, e.title]));
  assert.deepEqual(byId, { p1: 'Новое имя', p2: 'Бег', p3: 'Книга' });
  assert.deepEqual([...b.getDone()].sort(), ['p2|2026-09-28', 'p3|2026-09-27']);
});

test('importing a foreign or broken file throws and leaves existing data untouched', () => {
  const storage = mem();
  const s = createLocalStore(storage);
  s.setPersonal([{ event_id: 'p1', title: 'Моё' }]);
  const before = storage.map.get('sp_personal_events');
  assert.throws(() => s.importPersonal('{"hello": "world"}'), /не похож на экспорт/);
  assert.throws(() => s.importPersonal('not json at all'), /не похож на экспорт/);
  assert.equal(storage.map.get('sp_personal_events'), before);
});
