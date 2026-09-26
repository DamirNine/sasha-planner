import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkForUpdate } from '../js/pwa.js';

function fakeWorker() {
  const listeners = [];
  return {
    state: 'installing',
    messages: [],
    addEventListener: (type, fn) => listeners.push(fn),
    postMessage(m) { this.messages.push(m); },
    become(state) { this.state = state; listeners.forEach((fn) => fn()); },
  };
}

function fakeSw() {
  return { controller: {}, addEventListener() {} };
}

test('checkForUpdate reports latest when no new worker appears', async () => {
  const registration = { installing: null, waiting: null, update: async () => {} };
  assert.equal(await checkForUpdate(registration, { sw: fakeSw() }), 'latest');
});

test('checkForUpdate reports failed when the new worker becomes redundant (install error)', async () => {
  const worker = fakeWorker();
  const registration = { installing: null, waiting: null, update: async () => { registration.installing = worker; setTimeout(() => worker.become('redundant'), 0); } };
  assert.equal(await checkForUpdate(registration, { sw: fakeSw() }), 'failed');
});

test('checkForUpdate activates an installed worker and reports updating', async () => {
  const worker = fakeWorker();
  const registration = { installing: null, waiting: null, update: async () => { registration.installing = worker; setTimeout(() => worker.become('installed'), 0); } };
  assert.equal(await checkForUpdate(registration, { sw: fakeSw() }), 'updating');
  assert.deepEqual(worker.messages, ['SKIP_WAITING']);
});
