import { createLocalStore } from './localStore.js';
import { getToken, setToken } from './github.js';
import { fetchShared, applySharedOp } from './sharedSync.js';
import { applyOp, makeEvent } from './eventOps.js';
import { occurrenceDates } from './recurrence.js';
import { renderEditor } from './render/editor.js';
import { openAddSheet } from './render/addForm.js';
import { openDeleteSheet } from './render/deleteSheet.js';
import { eventsForRange, rangeForMode, shiftAnchor, weekLabel, weekDaysOf } from './planner.js';
import { dateKey, toDateOnly } from './dateUtils.js';
import { consumeSetupHash, extractToken } from './setup.js';
import { attachSwipe, attachPullToRefresh } from './gestures.js';
import { h } from './render/dom.js';
import { showToast } from './render/toast.js';
import { registerServiceWorker, checkForUpdate, isStandalone, isIOS, listenForInstallPrompt, promptInstall } from './pwa.js';
import { APP_VERSION } from './version.js';
import { renderSettings } from './render/settings.js';
import { renderDateStrip, highlightStripDay, renderSchedule, observeVisibleDay, stopObservingDays, openDetails } from './render/schedule.js';

const LOCAL_DEV = ['localhost', '127.0.0.1'].includes(location.hostname);
const local = createLocalStore();
const cache = local.getSharedCache();

const state = {
  screen: 'schedule',
  anchor: toDateOnly(new Date()),
  mode: local.getViewMode(),
  shared: cache?.events || [],
  settings: cache?.settings || null,
  sha: cache?.sha || null,
  personal: local.getPersonal(),
  done: local.getDone(),
  pendingScroll: dateKey(new Date()),
  tokenInvalid: false,
  tokenWarned: false,
};

const els = {
  stickyHead: document.getElementById('sticky-head'),
  strip: document.getElementById('date-strip'),
  weekLabel: document.getElementById('week-label'),
  schedule: document.getElementById('schedule'),
  sheet: document.getElementById('sheet'),
  toast: document.getElementById('toast'),
  screens: {
    schedule: document.getElementById('screen-schedule'),
    settings: document.getElementById('screen-settings'),
    editor: document.getElementById('screen-editor'),
  },
};

function toast(text) {
  showToast(els.toast, text);
}

function errorText(err) {
  if (err.code === 'offline') return 'Нет сети';
  if (err.code === 'auth') return 'Токен не подходит';
  if (err.code === 'ratelimit') return err.message;
  return err.message || 'Ошибка';
}

function headOffset() {
  return els.stickyHead.getBoundingClientRect().height + 8;
}

function scrollToDay(key, behavior = 'auto') {
  const target = document.getElementById(`day-${key}`);
  if (!target) return;
  window.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY - headOffset(), behavior });
}

function openOccurrence(occ) {
  openDetails(els.sheet, occ, { onToggle: toggleDone });
}

function renderScheduleScreen() {
  if (!state.settings) {
    els.weekLabel.textContent = '';
    els.strip.replaceChildren();
    els.schedule.replaceChildren(h('p', { class: 'empty' }, 'Загрузка расписания…'));
    return;
  }
  const range = rangeForMode(state.mode, state.anchor);
  const occurrences = eventsForRange({
    shared: state.shared,
    personal: state.personal,
    done: state.done,
    settings: state.settings,
    from: range.from,
    to: range.to,
  });
  els.weekLabel.textContent = weekLabel(state.anchor, state.settings);
  renderDateStrip(els.strip, { weekDays: weekDaysOf(state.anchor), highlight: range.highlight, today: dateKey(new Date()), onPick: pickDay });
  renderSchedule(els.schedule, { mode: state.mode, days: range.days, occurrences, onToggle: toggleDone, onOpen: openOccurrence, today: dateKey(new Date()) });
  if (state.mode === 'week_list') {
    if (state.pendingScroll) scrollToDay(state.pendingScroll);
    observeVisibleDay(els.schedule, headOffset(), (key) => {
      state.anchor = toDateOnly(key);
      highlightStripDay(els.strip, key);
    });
  } else {
    stopObservingDays();
    if (state.pendingScroll) window.scrollTo(0, 0);
  }
  state.pendingScroll = null;
}

function render() {
  if (state.screen === 'schedule') renderScheduleScreen();
  else if (state.screen === 'editor') renderEditorScreen();
  else if (state.screen === 'settings') renderSettingsScreen();
}

function closeSheet() {
  els.sheet.hidden = true;
  els.sheet.replaceChildren();
}

function showScreen(name, { push = true } = {}) {
  closeSheet();
  state.screen = name;
  for (const [key, el] of Object.entries(els.screens)) el.hidden = key !== name;
  if (push && name !== 'schedule') history.pushState({ screen: name }, '', `#${name}`);
  window.scrollTo(0, 0);
  render();
}

window.addEventListener('popstate', (e) => showScreen(e.state?.screen || 'schedule', { push: false }));

async function applyChange(op, isPersonal) {
  if (isPersonal) {
    state.personal = applyOp(state.personal, op);
    local.setPersonal(state.personal);
    render();
    toast('Сохранено на этом телефоне');
    return true;
  }
  if (LOCAL_DEV) {
    state.shared = applyOp(state.shared, op);
    local.setSharedCache({ sha: state.sha, events: state.shared, settings: state.settings, fetched_at: new Date().toISOString() });
    render();
    toast('Сохранено (локальный режим, без GitHub)');
    return true;
  }
  toast('Сохраняю…');
  try {
    const { sha, events } = await applySharedOp(op, { token: getToken() });
    state.shared = events;
    state.sha = sha;
    local.setSharedCache({ sha, events, settings: state.settings, fetched_at: new Date().toISOString() });
    render();
    toast('Сохранено для обоих телефонов');
    return true;
  } catch (err) {
    toast(err.code === 'offline' ? 'Нет сети — общее событие не сохранено' : errorText(err));
    return false;
  }
}

function renderEditorScreen() {
  renderEditor(els.screens.editor, {
    shared: state.shared,
    personal: state.personal,
    onBack: () => history.back(),
    onAdd: () => openAddSheet(els.sheet, {
      defaultDate: dateKey(state.anchor),
      canEditShared: LOCAL_DEV || Boolean(getToken()),
      onSubmit: ({ scope, fields }) => {
        const isPersonal = scope === 'personal';
        const event = makeEvent({ ...fields, source_type: isPersonal ? 'personal' : 'manual' });
        return applyChange({ type: 'add', event }, isPersonal);
      },
    }),
    onPick: (event, isPersonal) => openDeleteSheet(els.sheet, {
      event,
      upcoming: state.settings ? occurrenceDates(event, state.settings, new Date(), state.settings.semester_end_date) : [],
      onConfirm: (op) => applyChange(op, isPersonal),
    }),
  });
}

function pickDay(key) {
  state.anchor = toDateOnly(key);
  if (state.mode === 'week_list') {
    highlightStripDay(els.strip, key);
    scrollToDay(key, 'smooth');
    return;
  }
  state.pendingScroll = key;
  render();
}

function toggleDone(key) {
  local.toggleDone(key);
  state.done = local.getDone();
  render();
}

function swipe(direction) {
  state.anchor = shiftAnchor(state.mode, state.anchor, direction === 'next' ? 1 : -1);
  state.pendingScroll = state.mode === 'week_list' ? weekDaysOf(state.anchor)[0] : dateKey(state.anchor);
  render();
}

async function refreshShared({ silent }) {
  try {
    const fresh = await fetchShared({ token: getToken(), localBase: LOCAL_DEV ? '.' : null });
    local.setSharedCache(fresh);
    state.shared = fresh.events;
    state.settings = fresh.settings;
    state.sha = fresh.sha;
    state.tokenInvalid = fresh.tokenInvalid;
    render();
    if (fresh.tokenInvalid && !state.tokenWarned) {
      state.tokenWarned = true;
      toast('Токен не подходит — расписание только для чтения. Обновите токен в настройках');
    } else if (!silent) {
      toast('Расписание обновлено');
    }
  } catch (err) {
    if (!state.settings) {
      els.schedule.replaceChildren(h('p', { class: 'empty' }, 'Не удалось загрузить расписание. Проверьте интернет и потяните экран вниз.'));
      toast(errorText(err));
    } else if (!silent) {
      toast(`${errorText(err)} — показана сохранённая копия`);
    }
  }
}

history.scrollRestoration = 'manual';
if (consumeSetupHash()) toast('Токен установлен');
if (location.hash) history.replaceState(null, '', location.pathname + location.search);
navigator.storage?.persist?.().catch(() => {});

attachSwipe(els.screens.schedule, swipe);
attachPullToRefresh(els.screens.schedule, () => refreshShared({ silent: false }));
let lastSeenDay = dateKey(new Date());

function jumpToTodayIfDayChanged() {
  const today = dateKey(new Date());
  if (today === lastSeenDay) return;
  lastSeenDay = today;
  state.anchor = toDateOnly(today);
  state.pendingScroll = today;
  render();
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  jumpToTodayIfDayChanged();
  refreshShared({ silent: true });
});

let registration = null;
const SW_ENABLED = !LOCAL_DEV || new URLSearchParams(location.search).has('sw');
if (SW_ENABLED) registerServiceWorker().then((r) => { registration = r; }).catch(() => {});

function setupInstallBanner() {
  const banner = document.getElementById('install-banner');
  if (isStandalone() || local.isBannerDismissed()) return;
  const dismiss = h('button', { type: 'button', 'aria-label': 'Скрыть', onclick: () => { banner.hidden = true; local.dismissBanner(); } }, '✕');
  if (isIOS()) {
    banner.replaceChildren(h('span', {}, 'Установить: «Поделиться» → «На экран „Домой“»'), dismiss);
    banner.hidden = false;
    return;
  }
  const install = h('button', {
    type: 'button',
    onclick: async () => {
      if (await promptInstall()) banner.hidden = true;
      else toast('Откройте меню браузера ⋮ → «Установить приложение»');
    },
  }, '⬇ Скачать приложение');
  banner.replaceChildren(install, dismiss);
  banner.hidden = false;
  listenForInstallPrompt((status) => {
    if (status === 'installed') banner.hidden = true;
  });
}

function downloadText(filename, text) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const link = h('a', { href: url, download: filename });
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function exportPersonal() {
  const text = local.exportPersonal();
  const name = `planer-lichnoe-${dateKey(new Date())}.json`;
  const file = new File([text], name, { type: 'application/json' });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: name });
      return;
    } catch (err) {
      if (err.name === 'AbortError') return;
    }
  }
  downloadText(name, text);
}

async function importPersonal(file) {
  try {
    const result = local.importPersonal(await file.text());
    state.personal = local.getPersonal();
    state.done = local.getDone();
    toast(`Импортировано: событий ${result.events}, отметок ${result.done}`);
  } catch (err) {
    toast(err.message);
  }
}

async function updateApp() {
  if (!registration) {
    toast('Обновление недоступно в этом режиме');
    return;
  }
  toast('Проверяю обновления…');
  try {
    const result = await checkForUpdate(registration);
    if (result === 'latest') toast('Установлена последняя версия');
    if (result === 'failed') toast('Не удалось обновить — попробуйте позже');
  } catch {
    toast('Нет сети — не удалось проверить обновление');
  }
}

function renderSettingsScreen() {
  renderSettings(els.screens.settings, {
    mode: state.mode,
    tokenStatus: !getToken() ? 'missing' : state.tokenInvalid ? 'invalid' : 'ok',
    version: APP_VERSION,
    onBack: () => history.back(),
    onMode: (mode) => {
      state.mode = mode;
      local.setViewMode(mode);
      state.pendingScroll = dateKey(state.anchor);
      render();
    },
    onSaveToken: (text) => {
      const token = extractToken(text);
      if (!token) return;
      setToken(token);
      state.tokenInvalid = false;
      state.tokenWarned = false;
      toast('Токен сохранён');
      render();
      refreshShared({ silent: true });
    },
    onEdit: () => showScreen('editor'),
    onUpdate: updateApp,
    onExport: exportPersonal,
    onImport: importPersonal,
  });
}

document.getElementById('open-settings').addEventListener('click', () => showScreen('settings'));

setupInstallBanner();

render();
refreshShared({ silent: true });
