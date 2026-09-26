import { TOKEN_STORAGE_KEY } from './config.js';

const API_BASE = 'https://api.github.com';

export function getToken(storage = globalThis.localStorage) {
  try {
    return storage.getItem(TOKEN_STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

export function setToken(token, storage = globalThis.localStorage) {
  storage.setItem(TOKEN_STORAGE_KEY, token);
}

export function clearToken(storage = globalThis.localStorage) {
  storage.removeItem(TOKEN_STORAGE_KEY);
}

function toBase64(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  bytes.forEach((b) => { binary += String.fromCharCode(b); });
  return btoa(binary);
}

function fromBase64(b64) {
  const binary = atob(b64.replace(/\s/g, ''));
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function authError() {
  const err = new Error('Токен не подходит');
  err.code = 'auth';
  return err;
}

export async function readFile(owner, repo, path, { token, fetchFn = fetch }) {
  const headers = { Accept: 'application/vnd.github+json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetchFn(`${API_BASE}/repos/${owner}/${repo}/contents/${path}`, { headers, cache: 'no-store' });
  if (res.status === 403 && res.headers?.get?.('x-ratelimit-remaining') === '0') {
    const err = new Error('GitHub временно ограничил запросы — попробуйте позже');
    err.code = 'ratelimit';
    throw err;
  }
  if (res.status === 401 || res.status === 403) throw authError();
  if (!res.ok) throw new Error(`GitHub API error ${res.status} reading ${path}`);
  const json = await res.json();
  return { sha: json.sha, data: JSON.parse(fromBase64(json.content)) };
}

export async function getFileSha(owner, repo, path, token, fetchFn = fetch) {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const res = await fetchFn(`${API_BASE}/repos/${owner}/${repo}/contents/${path}`, { headers });
  if (!res.ok) throw new Error(`GitHub API error ${res.status} reading ${path}`);
  const json = await res.json();
  return json.sha;
}

export async function writeFile(owner, repo, path, dataObj, { token, sha, message, fetchFn = fetch }) {
  if (!token) throw new Error('Нет токена GitHub — сохранение недоступно.');
  const currentSha = sha || (await getFileSha(owner, repo, path, token, fetchFn));
  const content = toBase64(JSON.stringify(dataObj, null, 2));
  const res = await fetchFn(`${API_BASE}/repos/${owner}/${repo}/contents/${path}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ message, content, sha: currentSha }),
  });
  if (res.status === 409) {
    const err = new Error('Конфликт версий файла в GitHub — обновите страницу и сохраните заново.');
    err.conflict = true;
    throw err;
  }
  if (res.status === 401 || res.status === 403) throw authError();
  if (!res.ok) throw new Error(`GitHub API error ${res.status} writing ${path}`);
  const json = await res.json();
  return json.content.sha;
}
