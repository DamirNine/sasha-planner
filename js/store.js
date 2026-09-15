import { generateAllRecurrences } from './recurrence.js';

export function createStore({ readEvents, readSettings, writeEvents, autosaveDelayMs = 30000 }) {
  let events = [];
  let settings = {};
  let dirty = false;
  let autosaveTimer = null;
  const listeners = [];

  function notify() {
    listeners.forEach((fn) => fn({ events, settings, dirty }));
  }

  function markDirty() {
    dirty = true;
    if (autosaveTimer) clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(() => {
      // Autosave failures (e.g. no token configured yet) stay silent — the
      // dirty flag already tells the UI there are unsaved changes; a manual
      // save() surfaces the real error via its own .catch() in main.js.
      save().catch(() => {});
    }, autosaveDelayMs);
    notify();
  }

  async function load() {
    settings = await readSettings();
    events = await readEvents();
    const generated = generateAllRecurrences(events, settings);
    if (generated.length > 0) {
      events = events.concat(generated);
      markDirty();
    } else {
      notify();
    }
  }

  function setEventCompleted(eventId, completed) {
    const ev = events.find((e) => e.event_id === eventId);
    if (!ev) return;
    ev.completed = completed;
    ev.updated_at = new Date().toISOString();
    markDirty();
  }

  function addEvent(fields) {
    const now = new Date().toISOString();
    const newEvent = {
      event_id: crypto.randomUUID(),
      source_type: 'manual',
      date: '',
      start_time: '',
      end_time: '',
      title: '',
      event_type: 'other',
      place: '',
      teacher: '',
      progress_group: 'task',
      priority: '',
      completed: false,
      recurrence_rule: '',
      parent_event_id: '',
      notes: '',
      created_at: now,
      updated_at: now,
      ...fields,
    };
    events.push(newEvent);
    if (newEvent.recurrence_rule) {
      events = events.concat(generateAllRecurrences(events, settings));
    }
    markDirty();
    return newEvent;
  }

  async function save() {
    if (autosaveTimer) { clearTimeout(autosaveTimer); autosaveTimer = null; }
    if (!dirty) return;
    await writeEvents(events);
    dirty = false;
    notify();
  }

  function subscribe(fn) {
    listeners.push(fn);
    return () => {
      const i = listeners.indexOf(fn);
      if (i >= 0) listeners.splice(i, 1);
    };
  }

  function getState() {
    return { events, settings, dirty };
  }

  return { load, setEventCompleted, addEvent, save, subscribe, getState };
}
