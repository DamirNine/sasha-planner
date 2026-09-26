import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { APP_VERSION } from '../js/version.js';

const sw = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
const filesBlock = sw.slice(sw.indexOf('const FILES = ['), sw.indexOf('];', sw.indexOf('const FILES = [')));
const precached = [...filesBlock.matchAll(/'(\.\/[^']*)'/g)].map((m) => m[1]);

test('every precached path exists on disk', () => {
  assert.ok(precached.length > 10);
  for (const p of precached) {
    if (p === './') continue;
    assert.ok(existsSync(new URL(`../${p.slice(2)}`, import.meta.url)), `missing file ${p}`);
  }
});

test('every JS module under js/ is precached', () => {
  const jsFiles = readdirSync(new URL('../js/', import.meta.url), { recursive: true })
    .map((f) => String(f).replace(/\\/g, '/'))
    .filter((f) => f.endsWith('.js'));
  for (const f of jsFiles) assert.ok(precached.includes(`./js/${f}`), `sw.js FILES is missing ./js/${f}`);
});

test('sw VERSION equals APP_VERSION', () => {
  assert.equal(/const VERSION = '([^']+)'/.exec(sw)[1], APP_VERSION);
});

test('install bypasses the HTTP cache and data/ + API requests are never intercepted', () => {
  assert.match(sw, /cache: 'reload'/);
  assert.match(sw, /\/data\//);
  assert.match(sw, /url\.origin !== self\.location\.origin/);
});

test('activate only deletes old sp-code caches (never localStorage-related state)', () => {
  assert.match(sw, /k\.startsWith\('sp-code-'\) && k !== CACHE/);
});
