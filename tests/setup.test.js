import { test } from 'node:test';
import assert from 'node:assert/strict';
import { consumeSetupHash, buildSetupLink } from '../js/setup.js';
import { getToken } from '../js/github.js';

function env(hash) {
  const map = new Map();
  const calls = [];
  return {
    calls,
    location: { hash, pathname: '/sasha-planner/', search: '' },
    history: { replaceState: (...args) => calls.push(args) },
    storage: { getItem: (k) => map.get(k) ?? null, setItem: (k, v) => map.set(k, v), removeItem: (k) => map.delete(k) },
  };
}

test('#setup=<token> saves the token and strips the hash', () => {
  const e = env('#setup=github_pat_ABC123');
  assert.equal(consumeSetupHash(e), true);
  assert.equal(getToken(e.storage), 'github_pat_ABC123');
  assert.deepEqual(e.calls, [[null, '', '/sasha-planner/']]);
});

test('url-encoded tokens are decoded', () => {
  const e = env('#setup=a%2Bb');
  consumeSetupHash(e);
  assert.equal(getToken(e.storage), 'a+b');
});

test('empty #setup= strips the hash but saves nothing', () => {
  const e = env('#setup=');
  assert.equal(consumeSetupHash(e), false);
  assert.equal(getToken(e.storage), '');
  assert.equal(e.calls.length, 1);
});

test('other hashes are ignored', () => {
  const e = env('#settings');
  assert.equal(consumeSetupHash(e), false);
  assert.equal(e.calls.length, 0);
});

test('buildSetupLink appends an encoded #setup fragment', () => {
  assert.equal(buildSetupLink('https://damirnine.github.io/sasha-planner/', 'tok_1'), 'https://damirnine.github.io/sasha-planner/#setup=tok_1');
  assert.equal(buildSetupLink('https://x/', 'a+b'), 'https://x/#setup=a%2Bb');
});

test('extractToken accepts a bare token or a whole setup link pasted from a message', async () => {
  const { extractToken } = await import('../js/setup.js');
  assert.equal(extractToken('  github_pat_XYZ  '), 'github_pat_XYZ');
  assert.equal(extractToken('https://damirnine.github.io/sasha-planner/#setup=github_pat_XYZ\n'), 'github_pat_XYZ');
  assert.equal(extractToken('Вот ссылка: https://x/#setup=a%2Bb'), 'a+b');
  assert.equal(extractToken('   '), '');
});
