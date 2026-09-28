import { createLocalStore } from './localStore.js';
import { getToken, setToken } from './github.js';
import { fetchShared, applySharedOp } from './sharedSync.js';
import { applyOp, makeEvent } from './eventOps.js';
import { occurrenceDates } from './recurrence.js';
import { renderEditor } from './render/editor.js';
import { openAddSheet } from './render/addForm.js';
import { openDeleteSheet } from './render/deleteSheet.js';
import { openMenu, openDayPicker } from './render/menu.js';
import { buildEventFields, eventToFormValues, buildEditOp } from './forms.js';
import { eventsForRange, rangeForMode, shiftAnchor, weekLabel, weekRangeLabel, weekDaysOf } from './planner.js';
import { dateKey, toDateOnly } from './dateUtils.js';
import { consumeSetupHash, extractToken } from './setup.js';
import { attachPullToRefresh } from './gestures.js';
import { createPager } from './render/pager.js';
import { clampTitlesIn } from './fitText.js';
import { h } from './render/dom.js';
import { showToast } from './render/toast.js';
import { registerServiceWorker, checkForUpdate, isStandalone, isIOS, listenForInstallPrompt, promptInstall } from './pwa.js';
import { APP_VERSION } from './version.js';
import { renderSettings } from './render/settings.js';
import { openRemindersSheet } from './render/remindersField.js';
import { notificationSupport, syncReminders, sendTestPush } from './push.js';
import { remindersChanged } from './reminders.js';
import { applyHidden, addHidden, removeHidden, localOnlyChange, convertedEvent, hiddenSummary } from './localOverrides.js';
import { renderDateStrip, highlightStripDay, renderSchedule, observeVisibleDay, stopObservingDays, openDetails, dayHeading } from './render/schedule.js';

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
  reminders: local.getReminders(),
  hidden: local.getHidden(),
  pendingScroll: dateKey(new Date()),
  tokenInvalid: false,
  tokenWarned: false,
};

let registration = null;

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

const pager = createPager(els.schedule, {
  renderPage: renderPageAt,
  onCommit: (direction) => swipe(direction),
  canSwipe: () => !isPinchZoomed(),
});

function isPinchZoomed() {
  return (window.visualViewport?.scale || 1) > 1.01;
}

window.visualViewport?.addEventListener('resize', () => {
  els.screens.schedule.classList.toggle('zoomed', isPinchZoomed());
});

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
  openDetails(els.sheet, occ, { onToggle: toggleDone, onMenu: openEventMenu });
}

function canEditShared() {
  return LOCAL_DEV || Boolean(getToken());
}

function visibleShared() {
  return applyHidden(state.shared, state.hidden);
}

function findSeries(eventId, isPersonal) {
  return (isPersonal ? state.personal : visibleShared()).find((e) => e.event_id === eventId);
}

function upcomingFor(event) {
  return state.settings ? occurrenceDates(event, state.settings, new Date(), state.settings.semester_end_date) : [];
}

function openAddForDate(date) {
  openAddSheet(els.sheet, {
    initial: { date },
    canEditShared: canEditShared(),
    onSubmit: ({ scope, values }) => {
      const fields = buildEventFields(values);
      const isPersonal = scope === 'personal';
      const event = makeEvent({ ...fields, source_type: isPersonal ? 'personal' : 'manual' });
      return applyChange({ type: 'add', event }, isPersonal, { reminders: values.reminders });
    },
  });
}

function openEditForm(series, isPersonal, { scope, dates = [], localOnly = false }) {
  if (!isPersonal && !localOnly && !canEditShared()) {
    toast('Общие события можно менять у всех после установки токена');
    return;
  }
  const current = isPersonal ? 'personal' : 'shared';
  openAddSheet(els.sheet, {
    title: localOnly ? 'Изменить только у себя' : 'Изменить событие',
    submitLabel: 'Сохранить',
    initial: { ...eventToFormValues(series, scope === 'days' ? { date: dates[0] } : {}), reminders: state.reminders[series.event_id] || [] },
    showScope: scope === 'series' && !localOnly,
    initialScope: current,
    canEditShared: canEditShared(),
    showDate: scope === 'series' || dates.length === 1,
    showRepeat: scope === 'series',
    onSubmit: ({ scope: target, values }) => {
      const fields = buildEventFields(values, { baseRule: series.recurrence_rule });
      if (localOnly) return applyLocalOnly(buildEditOp(series, fields, { scope, dates }), series, values.reminders);
      if (scope === 'series' && target !== current) return convertSeries(series, isPersonal, fields, values.reminders);
      return applyChange(buildEditOp(series, fields, { scope, dates }), isPersonal, { reminders: values.reminders });
    },
  });
}

function chooseEditScope(series, isPersonal, date, localOnly = false) {
  const items = [];
  if (date) items.push({ label: `Только ${dayHeading(date).toLowerCase()}`, onSelect: () => openEditForm(series, isPersonal, { scope: 'days', dates: [date], localOnly }) });
  items.push(
    {
      label: 'Выбрать дни',
      chevron: true,
      onSelect: () => openDayPicker(els.sheet, {
        title: 'Какие дни изменить?',
        days: upcomingFor(series),
        confirmLabel: 'Дальше',
        onConfirm: (dates) => openEditForm(series, isPersonal, { scope: 'days', dates, localOnly }),
      }),
    },
    { label: 'Все повторы', onSelect: () => openEditForm(series, isPersonal, { scope: 'series', localOnly }) },
  );
  openMenu(els.sheet, { title: 'Что изменить?', subtitle: series.title, items });
}

function editItem(label, series, isPersonal, date, localOnly) {
  return {
    label,
    chevron: true,
    onSelect: () => {
      if (!isPersonal && !localOnly && !canEditShared()) {
        toast('Менять общее у всех можно после установки токена');
        return;
      }
      if (series.recurrence_rule) chooseEditScope(series, isPersonal, date, localOnly);
      else openEditForm(series, isPersonal, { scope: 'series', localOnly });
    },
  };
}

function deleteItem(label, series, isPersonal, date, localOnly) {
  return {
    label,
    danger: true,
    chevron: true,
    onSelect: () => {
      if (!isPersonal && !localOnly && !canEditShared()) {
        toast('Удалять общее у всех можно после установки токена');
        return;
      }
      openDeleteSheet(els.sheet, {
        event: series,
        date,
        upcoming: upcomingFor(series),
        onConfirm: (op) => (localOnly ? applyLocalOnly(op, series) : applyChange(op, isPersonal)),
      });
    },
  };
}

function remindersItem(series) {
  return {
    label: state.reminders[series.event_id] ? 'Напоминания 🔔' : 'Напоминания',
    chevron: true,
    onSelect: () => openRemindersSheet(els.sheet, {
      title: series.title,
      initial: state.reminders[series.event_id] || [],
      onSave: (offsets) => {
        local.setReminders(series.event_id, offsets);
        state.reminders = local.getReminders();
        render();
        syncPush({ interactive: offsets.length > 0, announce: true });
      },
    }),
  };
}

function openSeriesMenu(series, isPersonal, date = null) {
  const when = date ? dayHeading(date) : '';
  const reminders = remindersItem(series);
  const restore = restoreDeletedItem(series, isPersonal);
  const items = isPersonal
    ? [editItem('Редактировать', series, true, date, false), reminders, restore, deleteItem('Удалить', series, true, date, false)]
    : [
      editItem('Изменить у всех', series, false, date, false),
      editItem('Изменить только у себя', series, false, date, true),
      reminders,
      restore,
      deleteItem('Удалить у всех', series, false, date, false),
      deleteItem('Удалить только у себя', series, false, date, true),
    ];
  openMenu(els.sheet, { title: series.title, subtitle: when, items: items.filter(Boolean) });
}

// ⋮ on a card: two top buttons, the concrete actions one level down.
function openEventMenu(occ) {
  const series = findSeries(occ.event_id, occ.isPersonal);
  if (!series) return;
  const { isPersonal, date } = occ;
  const title = series.title;
  const subtitle = dayHeading(date);
  const submenu = (items) => () => openMenu(els.sheet, { title, subtitle, items });
  const editItems = isPersonal
    ? [editItem('Изменить', series, true, date, false), remindersItem(series)]
    : [
      editItem('Изменить у всех', series, false, date, false),
      editItem('Изменить только у себя', series, false, date, true),
      remindersItem(series),
    ];
  const del = isPersonal
    ? deleteItem('Удалить', series, true, date, false)
    : {
      label: 'Удалить',
      danger: true,
      chevron: true,
      onSelect: submenu([
        deleteItem('Удалить у всех', series, false, date, false),
        deleteItem('Удалить только у себя', series, false, date, true),
      ]),
    };
  openMenu(els.sheet, {
    title,
    subtitle,
    items: [{ label: 'Редактировать', chevron: true, onSelect: submenu(editItems) }, del],
  });
}

function renderPageAt(el, offset) {
  const anchor = shiftAnchor(state.mode, state.anchor, offset);
  const range = rangeForMode(state.mode, anchor);
  const occurrences = eventsForRange({
    shared: visibleShared(),
    personal: state.personal,
    done: state.done,
    settings: state.settings,
    from: range.from,
    to: range.to,
  }).map((occ) => (state.reminders[occ.event_id] ? { ...occ, hasReminder: true } : occ));
  renderSchedule(el, { mode: state.mode, days: range.days, occurrences, onToggle: toggleDone, onOpen: openOccurrence, onMenu: openEventMenu, onAdd: openAddForDate, today: dateKey(new Date()) });
}

function renderScheduleScreen() {
  if (!state.settings) {
    els.weekLabel.textContent = '';
    els.strip.replaceChildren();
    pager.message(h('p', { class: 'empty' }, 'Загрузка расписания…'));
    return;
  }
  const range = rangeForMode(state.mode, state.anchor);
  const isGrid = state.mode === 'week_grid';
  els.weekLabel.textContent = isGrid
    ? `${weekLabel(state.anchor, state.settings)} · ${weekRangeLabel(range.days)}`
    : weekLabel(state.anchor, state.settings);
  els.strip.hidden = isGrid;
  if (!isGrid) renderDateStrip(els.strip, { weekDays: weekDaysOf(state.anchor), highlight: range.highlight, today: dateKey(new Date()), onPick: pickDay });
  pager.render();
  if (isGrid) fitGridText();
  if (state.mode === 'week_list') {
    if (state.pendingScroll) scrollToDay(state.pendingScroll);
    observeVisibleDay(pager.current(), headOffset(), (key) => {
      state.anchor = toDateOnly(key);
      highlightStripDay(els.strip, key);
    });
  } else {
    stopObservingDays();
    if (state.pendingScroll) window.scrollTo(0, 0);
  }
  state.pendingScroll = null;
}

function fitGridText() {
  clampTitlesIn(els.schedule, '.grid-item', '.gi-title');
}

window.addEventListener('resize', () => {
  if (state.screen === 'schedule' && state.mode === 'week_grid') fitGridText();
});

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

function idsWithNewReminders(op) {
  if (op.type === 'add') return [op.event.event_id];
  if (op.type === 'update') return [op.id];
  if (op.type === 'batch') return op.ops.filter((o) => o.type === 'add').map((o) => o.event.event_id);
  return [];
}

function afterChange(op, reminders, { drop = [] } = {}) {
  const before = state.reminders;
  if (op.type === 'delete') local.deleteReminders(op.id);
  drop.forEach((id) => local.deleteReminders(id));
  if (reminders) idsWithNewReminders(op).forEach((id) => local.setReminders(id, reminders));
  state.reminders = local.getReminders();
  if (Object.keys(before).length || Object.keys(state.reminders).length) {
    const added = remindersChanged(before, state.reminders);
    syncPush({ interactive: added, announce: added });
  }
}

async function commitShared(op) {
  if (LOCAL_DEV) {
    state.shared = applyOp(state.shared, op);
    local.setSharedCache({ sha: state.sha, events: state.shared, settings: state.settings, fetched_at: new Date().toISOString() });
    return true;
  }
  toast('Сохраняю…');
  try {
    const { sha, events } = await applySharedOp(op, { token: getToken() });
    state.shared = events;
    state.sha = sha;
    local.setSharedCache({ sha, events, settings: state.settings, fetched_at: new Date().toISOString() });
    return true;
  } catch (err) {
    toast(err.code === 'offline' ? 'Нет сети — общее событие не сохранено' : errorText(err));
    return false;
  }
}

const SHARED_SAVED = LOCAL_DEV ? 'Сохранено (локальный режим, без GitHub)' : 'Сохранено для обоих телефонов';

function savePersonal(op) {
  state.personal = applyOp(state.personal, op);
  local.setPersonal(state.personal);
}

function saveHidden(hidden) {
  state.hidden = hidden;
  local.setHidden(hidden);
}

async function applyChange(op, isPersonal, { reminders } = {}) {
  if (isPersonal) {
    savePersonal(op);
    afterChange(op, reminders);
    render();
    toast('Сохранено на этом телефоне');
    return true;
  }
  if (!(await commitShared(op))) return false;
  afterChange(op, reminders);
  render();
  toast(SHARED_SAVED);
  return true;
}

function applyLocalOnly(op, series, reminders) {
  const { hideOp, personalOps } = localOnlyChange(op, series);
  saveHidden(addHidden(state.hidden, hideOp));
  const personalOp = { type: 'batch', ops: personalOps };
  savePersonal(personalOp);
  afterChange(personalOp, reminders, { drop: hideOp.type === 'delete' ? [series.event_id] : [] });
  render();
  toast(personalOps.length ? 'Изменено только на этом телефоне' : 'Скрыто только на этом телефоне');
  return true;
}

async function convertSeries(series, isPersonal, fields, reminders) {
  const id = series.event_id;
  const keepReminders = { type: 'update', id };
  if (isPersonal) {
    if (!(await commitShared({ type: 'add', event: convertedEvent(series, fields, 'shared') }))) return false;
    savePersonal({ type: 'delete', id });
    afterChange(keepReminders, reminders);
    render();
    toast('Теперь это общее событие');
    return true;
  }
  if (!(await commitShared({ type: 'delete', id }))) return false;
  const { [id]: ignored, ...restHidden } = state.hidden;
  saveHidden(restHidden);
  savePersonal({ type: 'add', event: convertedEvent(series, fields, 'personal') });
  afterChange(keepReminders, reminders);
  render();
  toast('Теперь это личное событие — у второго телефона его больше нет');
  return true;
}

function seriesDays(event) {
  return state.settings ? occurrenceDates(event, state.settings, state.settings.reference_monday, state.settings.semester_end_date) : [];
}

function restoredText(dates) {
  return dates.length === 1 ? `Вернули: ${dayHeading(dates[0]).toLowerCase()}` : `Вернули дней: ${dates.length}`;
}

function chooseDaysToRestore({ title, dates, onRestore }) {
  if (dates.length <= 1) {
    onRestore(dates);
    return;
  }
  openMenu(els.sheet, {
    title,
    subtitle: 'Какие дни вернуть?',
    items: [
      { label: `Все дни (${dates.length})`, onSelect: () => onRestore(dates) },
      {
        label: 'Выбрать дни',
        chevron: true,
        onSelect: () => openDayPicker(els.sheet, { title: 'Какие дни вернуть?', days: dates, confirmLabel: 'Вернуть', onConfirm: onRestore }),
      },
    ],
  });
}

function restoreHidden(event) {
  const value = state.hidden[event.event_id];
  const days = value === 'all' ? seriesDays(event) : value;
  chooseDaysToRestore({
    title: event.title,
    dates: days,
    onRestore: (dates) => {
      saveHidden(removeHidden(state.hidden, event.event_id, dates.length ? dates : 'all', days));
      render();
      toast(dates.length ? restoredText(dates) : `«${event.title}» снова видно`);
      if (Object.keys(state.reminders).length) syncPush();
    },
  });
}

function restoreDeletedItem(series, isPersonal) {
  const raw = isPersonal ? series : state.shared.find((e) => e.event_id === series.event_id) || series;
  const deleted = raw.recurrence_rule ? [...(raw.excluded_dates || [])].sort() : [];
  if (!deleted.length) return null;
  return {
    label: isPersonal ? `Вернуть удалённые дни (${deleted.length})` : `Вернуть дни, удалённые у всех (${deleted.length})`,
    chevron: true,
    onSelect: () => {
      if (!isPersonal && !canEditShared()) {
        toast('Возвращать дни у всех можно после установки токена');
        return;
      }
      chooseDaysToRestore({
        title: series.title,
        dates: deleted,
        onRestore: async (dates) => {
          if (await applyChange({ type: 'include', id: series.event_id, dates }, isPersonal)) toast(restoredText(dates));
        },
      });
    },
  };
}

const PUSH_MESSAGES = {
  auth: 'Для напоминаний нужен токен (Настройки → Токен)',
  denied: 'Уведомления не разрешены — включите их для приложения в настройках телефона',
  offline: 'Нет сети — напоминания отправятся на сервер позже',
  error: 'Сервер напоминаний не ответил — попробуйте позже',
};

function pushProblemText(result) {
  const support = notificationSupport();
  if (result === 'denied' && support === 'ios-not-installed') return 'На iPhone уведомления работают только в установленном приложении';
  if (result === 'denied' && support === 'unsupported') return 'Этот браузер не поддерживает уведомления';
  return PUSH_MESSAGES[result] || 'Ошибка';
}

function pushArgs() {
  const shared = visibleShared();
  // Shared events with days hidden on this phone travel like personal ones, so the server skips those days too.
  const partlyHidden = shared.filter((e) => Array.isArray(state.hidden[e.event_id]));
  return {
    registration,
    token: getToken(),
    deviceId: local.getDeviceId(),
    reminders: state.reminders,
    personal: [...state.personal, ...partlyHidden],
    shared,
  };
}

async function syncPush({ interactive = false, announce = false } = {}) {
  const result = await syncReminders({ ...pushArgs(), interactive }).catch(() => 'error');
  if (result === 'ok') {
    if (announce) toast('Напоминания сохранены 🔔');
  } else if (announce) {
    toast(pushProblemText(result));
  }
  if (state.screen === 'settings') render();
  return result;
}

async function testPush() {
  toast('Отправляю тестовое уведомление…');
  const result = await sendTestPush(pushArgs()).catch(() => 'error');
  toast(result === 'ok' ? 'Отправлено — уведомление придёт через пару секунд' : pushProblemText(result));
  if (state.screen === 'settings') render();
}

function renderEditorScreen() {
  renderEditor(els.screens.editor, {
    shared: visibleShared(),
    personal: state.personal,
    hidden: state.shared
      .filter((e) => state.hidden[e.event_id])
      .map((event) => ({ event, summary: hiddenSummary(state.hidden[event.event_id]) })),
    onBack: () => history.back(),
    onAdd: () => openAddForDate(dateKey(state.anchor)),
    onPick: (event, isPersonal) => openSeriesMenu(event, isPersonal),
    onRestore: restoreHidden,
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
      pager.message(h('p', { class: 'empty' }, 'Не удалось загрузить расписание. Проверьте интернет и потяните экран вниз.'));
      toast(errorText(err));
    } else if (!silent) {
      toast(`${errorText(err)} — показана сохранённая копия`);
    }
  }
}

history.scrollRestoration = 'manual';
const openDate = new URLSearchParams(location.search).get('date');
if (/^\d{4}-\d{2}-\d{2}$/.test(openDate || '')) {
  state.anchor = toDateOnly(openDate);
  state.pendingScroll = openDate;
}
if (openDate !== null) history.replaceState(null, '', location.pathname + location.hash);
if (consumeSetupHash()) toast('Токен установлен');
if (location.hash) history.replaceState(null, '', location.pathname + location.search);
navigator.storage?.persist?.().catch(() => {});

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

const SW_ENABLED = !LOCAL_DEV || new URLSearchParams(location.search).has('sw');
if (SW_ENABLED) {
  registerServiceWorker().then((r) => {
    registration = r;
    if (Object.keys(state.reminders).length) syncPush();
  }).catch(() => {});
}

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
    notifyStatus: notificationSupport(),
    version: APP_VERSION,
    onBack: () => history.back(),
    onTestPush: testPush,
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
      if (Object.keys(state.reminders).length) syncPush();
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
