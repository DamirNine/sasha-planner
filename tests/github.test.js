import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getToken, setToken, clearToken, writeFile } from '../js/github.js';

function makeMemoryStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, v),
    removeItem: (k) => map.delete(k),
  };
}

test('token round-trips through injected storage', () => {
  const storage = makeMemoryStorage();
  assert.equal(getToken(storage), '');
  setToken('abc123', storage);
  assert.equal(getToken(storage), 'abc123');
  clearToken(storage);
  assert.equal(getToken(storage), '');
});

test('writeFile PUTs base64 content with the current sha and returns the new sha', async () => {
  let capturedBody;
  const fetchFn = async (url, opts = {}) => {
    if (opts.method === 'PUT') {
      capturedBody = JSON.parse(opts.body);
      return { ok: true, status: 200, json: async () => ({ content: { sha: 'new-sha' } }) };
    }
    return { ok: true, status: 200, json: async () => ({ sha: 'old-sha' }) };
  };
  const newSha = await writeFile('DamirNine', 'sasha-planner', 'data/db.json', { hello: 'world' }, {
    token: 'tok',
    message: 'test commit',
    fetchFn,
  });
  assert.equal(newSha, 'new-sha');
  assert.equal(capturedBody.sha, 'old-sha');
  const decoded = Buffer.from(capturedBody.content, 'base64').toString('utf-8');
  assert.deepEqual(JSON.parse(decoded), { hello: 'world' });
});

test('writeFile rejects with err.conflict on HTTP 409', async () => {
  const fetchFn = async (url, opts = {}) => {
    if (opts.method === 'PUT') return { ok: false, status: 409, json: async () => ({}) };
    return { ok: true, status: 200, json: async () => ({ sha: 'old-sha' }) };
  };
  await assert.rejects(
    () => writeFile('DamirNine', 'sasha-planner', 'data/db.json', {}, { token: 'tok', message: 'm', fetchFn }),
    (err) => err.conflict === true
  );
});

test('writeFile rejects with a clear message when there is no token', async () => {
  await assert.rejects(
    () => writeFile('DamirNine', 'sasha-planner', 'data/db.json', {}, { token: '', message: 'm', fetchFn: async () => ({}) }),
    /токен/i
  );
});
