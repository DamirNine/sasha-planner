import { normalizeOffsets } from './reminders.js';

export const VIEW_MODES = ['day1', 'day2', 'week_grid', 'week_list'];

const KEYS = {
  personal: 'sp_personal_events',
  done: 'sp_done',
  cache: 'sp_shared_cache',
  view: 'sp_view_mode',
  banner: 'sp_banner_dismissed',
  reminders: 'sp_reminders',
  device: 'sp_device_id',
};
const EXPORT_FORMAT = 'sasha-planner-personal';

function safeGet(storage, key) {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(storage, key, value) {
  try {
    storage.setItem(key, value);
  } catch {
    // quota exceeded or storage blocked: nothing sensible to do, the UI keeps working in memory
  }
}

function readJson(storage, key) {
  const raw = safeGet(storage, key);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function readArray(storage, key) {
  const v = readJson(storage, key);
  return Array.isArray(v) ? v : [];
}

export function createLocalStore(storage = globalThis.localStorage) {
  const getPersonal = () => readArray(storage, KEYS.personal);
  const setPersonal = (events) => safeSet(storage, KEYS.personal, JSON.stringify(events));
  const getDone = () => new Set(readArray(storage, KEYS.done).filter((k) => typeof k === 'string'));
  const saveDone = (set) => safeSet(storage, KEYS.done, JSON.stringify([...set]));
  const getReminders = () => {
    const v = readJson(storage, KEYS.reminders);
    if (!v || typeof v !== 'object' || Array.isArray(v)) return {};
    const out = {};
    for (const [id, offsets] of Object.entries(v)) {
      const clean = normalizeOffsets(offsets);
      if (clean.length) out[id] = clean;
    }
    return out;
  };
  const saveReminders = (map) => safeSet(storage, KEYS.reminders, JSON.stringify(map));

  return {
    getPersonal,
    setPersonal,
    getDone,
    toggleDone(key) {
      const done = getDone();
      if (done.has(key)) done.delete(key);
      else done.add(key);
      saveDone(done);
      return done.has(key);
    },
    getSharedCache() {
      const v = readJson(storage, KEYS.cache);
      return v && Array.isArray(v.events) && v.settings && typeof v.settings === 'object' ? v : null;
    },
    setSharedCache: (cache) => safeSet(storage, KEYS.cache, JSON.stringify(cache)),
    getViewMode() {
      const v = safeGet(storage, KEYS.view);
      return VIEW_MODES.includes(v) ? v : 'day1';
    },
    setViewMode: (mode) => safeSet(storage, KEYS.view, mode),
    getReminders,
    setReminders(id, offsets) {
      const map = getReminders();
      const clean = normalizeOffsets(offsets);
      if (clean.length) map[id] = clean;
      else delete map[id];
      saveReminders(map);
    },
    copyReminders(fromId, toIds) {
      const map = getReminders();
      if (!map[fromId]) return;
      toIds.forEach((id) => { map[id] = [...map[fromId]]; });
      saveReminders(map);
    },
    deleteReminders(id) {
      const map = getReminders();
      delete map[id];
      saveReminders(map);
    },
    getDeviceId() {
      let id = safeGet(storage, KEYS.device);
      if (!id) {
        id = crypto.randomUUID();
        safeSet(storage, KEYS.device, id);
      }
      return id;
    },
    isBannerDismissed: () => safeGet(storage, KEYS.banner) === '1',
    dismissBanner: () => safeSet(storage, KEYS.banner, '1'),
    exportPersonal() {
      return JSON.stringify({
        format: EXPORT_FORMAT,
        version: 1,
        exported_at: new Date().toISOString(),
        personal_events: getPersonal(),
        done: [...getDone()],
      }, null, 2);
    },
    importPersonal(text) {
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        data = null;
      }
      if (!data || data.format !== EXPORT_FORMAT || !Array.isArray(data.personal_events) || !Array.isArray(data.done)) {
        throw new Error('Файл не похож на экспорт личных данных планера');
      }
      const merged = new Map(getPersonal().map((e) => [e.event_id, e]));
      data.personal_events.forEach((e) => merged.set(e.event_id, e));
      setPersonal([...merged.values()]);
      const done = getDone();
      data.done.filter((k) => typeof k === 'string').forEach((k) => done.add(k));
      saveDone(done);
      return { events: data.personal_events.length, done: data.done.length };
    },
  };
}
