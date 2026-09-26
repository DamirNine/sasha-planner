import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchShared, applySharedOp } from '../js/sharedSync.js';
import { makeEvent } from '../js/eventOps.js';

function b64(obj) {
  return Buffer.from(JSON.stringify(obj), 'utf8').toString('base64').replace(/(.{60})/g, '$1\n');
}

function fakeGitHub({ events, conflicts = 0, putStatus = 200 }) {
  const settings = { semester_end_date: '2026-12-31', group: 'РК6-55Б' };
  const state = { events, sha: 'sha-0', puts: [], getOpts: [], conflictsLeft: conflicts };
  const fetchFn = async (url, opts = {}) => {
    if (opts.method === 'PUT') {
      const body = JSON.parse(opts.body);
      state.puts.push(body);
      if (state.conflictsLeft > 0) {
        state.conflictsLeft -= 1;
        state.sha = `sha-other-${state.puts.length}`;
        return { ok: false, status: 409, json: async () => ({}) };
      }
      if (putStatus !== 200) return { ok: false, status: putStatus, json: async () => ({}) };
      state.events = JSON.parse(Buffer.from(body.content, 'base64').toString('utf8'));
      state.sha = `sha-${state.puts.length}`;
      return { ok: true, status: 200, json: async () => ({ content: { sha: state.sha } }) };
    }
    state.getOpts.push(opts);
    const content = url.endsWith('/data/settings.json') ? b64(settings) : b64(state.events);
    return { ok: true, status: 200, json: async () => ({ sha: state.sha, content }) };
  };
  return { state, fetchFn };
}

const pair = { event_id: 'num-mon-1', title: 'Операционные системы', date: '2026-08-31', recurrence_rule: 'FREQ=WEEKLY;BYDAY=MO;PARITY=NUM', excluded_dates: [] };

test('fetchShared returns normalized events, settings and sha, bypassing the HTTP cache', async () => {
  const v1Leftover = { event_id: 'inst', parent_event_id: 'num-mon-1', completed: true, title: 'x', date: '2026-09-14' };
  const { fetchFn, state } = fakeGitHub({ events: [pair, v1Leftover] });
  const out = await fetchShared({ token: 't', fetchFn });
  assert.equal(out.sha, 'sha-0');
  assert.deepEqual(out.events.map((e) => e.event_id), ['num-mon-1']);
  assert.equal(out.settings.group, 'РК6-55Б');
  assert.ok(state.getOpts.every((o) => o.cache === 'no-store'));
});

test('fetchShared with localBase reads local files', async () => {
  const seen = [];
  const fetchFn = async (url, opts) => {
    seen.push([url, opts.cache]);
    const body = url.endsWith('settings.json') ? { semester_end_date: '2026-12-31' } : [pair];
    return { ok: true, status: 200, json: async () => body };
  };
  const out = await fetchShared({ fetchFn, localBase: '.' });
  assert.equal(out.sha, 'local');
  assert.deepEqual(seen.map((s) => s[0]).sort(), ['./data/db.json', './data/settings.json']);
  assert.ok(seen.every((s) => s[1] === 'no-store'));
});

test('applySharedOp adds an event with the freshly read sha and a Russian commit message', async () => {
  const { fetchFn, state } = fakeGitHub({ events: [pair] });
  const ev = makeEvent({ title: 'Консультация' }, { id: 'new-1' });
  const out = await applySharedOp({ type: 'add', event: ev }, { token: 't', fetchFn });
  assert.equal(state.puts.length, 1);
  assert.equal(state.puts[0].sha, 'sha-0');
  assert.equal(state.puts[0].message, 'Добавлено общее событие');
  assert.deepEqual(out.events.map((e) => e.event_id), ['num-mon-1', 'new-1']);
  assert.equal(out.sha, 'sha-1');
});

test('applySharedOp re-reads and retries after a 409, applying the op exactly once', async () => {
  const { fetchFn, state } = fakeGitHub({ events: [pair], conflicts: 1 });
  const out = await applySharedOp({ type: 'exclude', id: 'num-mon-1', dates: ['2026-09-28'] }, { token: 't', fetchFn });
  assert.equal(state.puts.length, 2);
  assert.equal(state.puts[1].sha, 'sha-other-1');
  assert.deepEqual(out.events[0].excluded_dates, ['2026-09-28']);
});

test('applySharedOp gives up after 3 conflicts with code conflict', async () => {
  const { fetchFn, state } = fakeGitHub({ events: [pair], conflicts: 5 });
  await assert.rejects(
    applySharedOp({ type: 'delete', id: 'num-mon-1' }, { token: 't', fetchFn }),
    (err) => err.code === 'conflict' && /попробуйте ещё раз/.test(err.message),
  );
  assert.equal(state.puts.length, 3);
});

test('applySharedOp maps missing token, 401 and network failure to codes', async () => {
  await assert.rejects(applySharedOp({ type: 'delete', id: 'x' }, { token: '', fetchFn: async () => { throw new Error('must not fetch'); } }), (e) => e.code === 'auth');
  const { fetchFn } = fakeGitHub({ events: [pair], putStatus: 401 });
  await assert.rejects(applySharedOp({ type: 'delete', id: 'num-mon-1' }, { token: 't', fetchFn }), (e) => e.code === 'auth');
  const offline = async () => { throw new TypeError('Failed to fetch'); };
  await assert.rejects(applySharedOp({ type: 'delete', id: 'num-mon-1' }, { token: 't', fetchFn: offline }), (e) => e.code === 'offline');
});

test('fetchShared falls back to an anonymous read when the token is rejected and flags tokenInvalid', async () => {
  const withAuth = [];
  const fetchFn = async (url, opts) => {
    withAuth.push(Boolean(opts.headers.Authorization));
    if (opts.headers.Authorization) return { ok: false, status: 401, headers: { get: () => null }, json: async () => ({}) };
    const content = url.endsWith('/data/settings.json') ? b64({ semester_end_date: '2026-12-31' }) : b64([pair]);
    return { ok: true, status: 200, json: async () => ({ sha: 's-anon', content }) };
  };
  const out = await fetchShared({ token: 'expired', fetchFn });
  assert.equal(out.tokenInvalid, true);
  assert.equal(out.sha, 's-anon');
  assert.deepEqual(out.events.map((e) => e.event_id), ['num-mon-1']);
  assert.ok(withAuth.includes(false), 'retried without the token');
});

test('fetchShared with a working token reports tokenInvalid false', async () => {
  const { fetchFn } = fakeGitHub({ events: [pair] });
  const out = await fetchShared({ token: 't', fetchFn });
  assert.equal(out.tokenInvalid, false);
});
