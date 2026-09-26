import { OWNER, REPO, DB_PATH, SETTINGS_PATH } from './config.js';
import { readFile, writeFile } from './github.js';
import { applyOp, normalizeEvents } from './eventOps.js';

const COMMIT_MESSAGES = {
  add: 'Добавлено общее событие',
  exclude: 'Удалены дни общего события',
  delete: 'Удалено общее событие',
  update: 'Изменено общее событие',
  batch: 'Изменено общее событие',
};

function coded(message, code) {
  const err = new Error(message);
  err.code = code;
  return err;
}

function asCoded(err) {
  if (err.code) return err;
  if (err instanceof TypeError) return coded('Нет сети', 'offline');
  return err;
}

async function readLocalJson(base, path, fetchFn) {
  const res = await fetchFn(`${base}/${path}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Не удалось прочитать ${path}: ${res.status}`);
  return res.json();
}

export async function fetchShared({ token = '', fetchFn = fetch, localBase = null } = {}) {
  try {
    if (localBase) {
      const [events, settings] = await Promise.all([
        readLocalJson(localBase, DB_PATH, fetchFn),
        readLocalJson(localBase, SETTINGS_PATH, fetchFn),
      ]);
      return { sha: 'local', events: normalizeEvents(events), settings, fetched_at: new Date().toISOString(), tokenInvalid: false };
    }
    const readBoth = (t) => Promise.all([
      readFile(OWNER, REPO, DB_PATH, { token: t, fetchFn }),
      readFile(OWNER, REPO, SETTINGS_PATH, { token: t, fetchFn }),
    ]);
    let tokenInvalid = false;
    let db;
    let settings;
    try {
      [db, settings] = await readBoth(token);
    } catch (err) {
      if (err.code !== 'auth' || !token) throw err;
      tokenInvalid = true;
      [db, settings] = await readBoth('');
    }
    return { sha: db.sha, events: normalizeEvents(db.data), settings: settings.data, fetched_at: new Date().toISOString(), tokenInvalid };
  } catch (err) {
    throw asCoded(err);
  }
}

export async function applySharedOp(op, { token = '', fetchFn = fetch, maxAttempts = 3 } = {}) {
  if (!token) throw coded('Нет токена — общие события только для чтения', 'auth');
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const { sha, data } = await readFile(OWNER, REPO, DB_PATH, { token, fetchFn });
      const events = applyOp(normalizeEvents(data), op);
      const newSha = await writeFile(OWNER, REPO, DB_PATH, events, { token, sha, message: COMMIT_MESSAGES[op.type], fetchFn });
      return { sha: newSha, events };
    } catch (err) {
      if (err.conflict && attempt < maxAttempts) continue;
      if (err.conflict) throw coded('Не удалось сохранить, попробуйте ещё раз', 'conflict');
      throw asCoded(err);
    }
  }
  throw coded('Не удалось сохранить, попробуйте ещё раз', 'conflict');
}
