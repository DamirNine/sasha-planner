import { setToken } from './github.js';

export function consumeSetupHash({
  location = globalThis.location,
  history = globalThis.history,
  storage = globalThis.localStorage,
} = {}) {
  const match = /^#setup=(.*)$/.exec(location.hash || '');
  if (!match) return false;
  history.replaceState(null, '', location.pathname + location.search);
  const token = decodeURIComponent(match[1]).trim();
  if (!token) return false;
  setToken(token, storage);
  return true;
}

export function buildSetupLink(baseUrl, token) {
  return `${baseUrl}#setup=${encodeURIComponent(token)}`;
}

export function extractToken(text) {
  const trimmed = String(text || '').trim();
  const match = /#setup=(\S+)/.exec(trimmed);
  return match ? decodeURIComponent(match[1]).trim() : trimmed;
}
