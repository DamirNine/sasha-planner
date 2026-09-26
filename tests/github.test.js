import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getToken, setToken, clearToken, writeFile, readFile } from '../js/github.js';

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

test('readFile decodes line-wrapped UTF-8 base64 and never uses the HTTP cache', async () => {
  const payload = [{ title: 'Программирование технологических процессов' }];
  const b64 = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64').replace(/(.{60})/g, '$1\n');
  let seenOpts;
  const fetchFn = async (url, opts) => {
    seenOpts = opts;
    return { ok: true, status: 200, json: async () => ({ sha: 's1', content: b64 }) };
  };
  const out = await readFile('o', 'r', 'data/db.json', { token: 't', fetchFn });
  assert.equal(out.sha, 's1');
  assert.deepEqual(out.data, payload);
  assert.equal(seenOpts.cache, 'no-store');
  assert.equal(seenOpts.headers.Authorization, 'Bearer t');
});

test('readFile without token sends no Authorization header; 401 maps to code auth', async () => {
  let seenOpts;
  const ok = async (url, opts) => {
    seenOpts = opts;
    return { ok: true, status: 200, json: async () => ({ sha: 's', content: Buffer.from('[]').toString('base64') }) };
  };
  await readFile('o', 'r', 'p', { token: '', fetchFn: ok });
  assert.equal(seenOpts.headers.Authorization, undefined);
  const denied = async () => ({ ok: false, status: 401, json: async () => ({}) });
  await assert.rejects(readFile('o', 'r', 'p', { token: 'bad', fetchFn: denied }), (err) => err.code === 'auth');
});

test('readFile maps a 403 with an exhausted rate limit to code ratelimit, not auth', async () => {
  const limited = async () => ({
    ok: false,
    status: 403,
    headers: { get: (name) => (name.toLowerCase() === 'x-ratelimit-remaining' ? '0' : null) },
    json: async () => ({}),
  });
  await assert.rejects(readFile('o', 'r', 'p', { token: '', fetchFn: limited }), (e) => e.code === 'ratelimit');
});
