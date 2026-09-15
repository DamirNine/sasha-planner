import { getWeekRange, getAcademicWeekNumber, getWeekParity, dateKey, formatDateDDMM } from './dateUtils.js';
import { computeProgress, renderBar, formatPercent } from './progress.js';
import { EVENT_TYPES, WEEKDAY_LABELS_RU, WEEKDAY_ORDER } from './config.js';

function sortEventsForDay(events) {
  const timed = events.filter((e) => e.start_time).sort((a, b) => a.start_time.localeCompare(b.start_time));
  const untimed = events.filter((e) => !e.start_time);
  return { timed, untimed };
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function renderEventRow(ev, onToggle) {
  const row = el('div', 'event-row');
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.checked = ev.completed === true;
  checkbox.addEventListener('change', () => onToggle(ev.event_id, checkbox.checked));
  row.appendChild(checkbox);
  row.appendChild(el('span', 'event-time', ev.start_time ? `${ev.start_time}–${ev.end_time || ''}` : ''));
  row.appendChild(el('span', 'event-title', ev.title + (ev.place ? ` · ${ev.place}` : '')));

  const color = (EVENT_TYPES[ev.event_type] || EVENT_TYPES.other).color;
  if (ev.completed) {
    row.style.background = '#F2F2F2';
    row.style.color = '#999999';
  } else {
    row.style.background = color;
    row.style.color = '#2C2C2C';
  }
  return row;
}

function renderDayCard(code, dayDate, dayEvents, settings, onToggle) {
  const card = el('div', 'day-card');
  const progress = computeProgress(dayEvents, settings.required_weight, settings.task_weight);

  card.appendChild(el('div', 'day-card__header', `${WEEKDAY_LABELS_RU[code]} • ${formatDateDDMM(dayDate)}`));

  const stats = el('div', 'day-card__stats');
  stats.appendChild(el('span', null, formatPercent(progress.percent)));
  stats.appendChild(el('span', null, renderBar(progress.percent)));
  stats.appendChild(el('span', null, `Обязательные ${progress.reqDone}/${progress.reqTotal} • Задачи ${progress.taskDone}/${progress.taskTotal}`));
  card.appendChild(stats);

  if (dayEvents.length === 0) {
    card.appendChild(el('div', 'day-card__empty', 'Свободный день'));
    return card;
  }

  const { timed, untimed } = sortEventsForDay(dayEvents);
  timed.forEach((ev) => card.appendChild(renderEventRow(ev, onToggle)));
  if (untimed.length > 0) {
    card.appendChild(el('div', 'day-card__subheader', 'ЗАДАЧИ БЕЗ ВРЕМЕНИ'));
    untimed.forEach((ev) => card.appendChild(renderEventRow(ev, onToggle)));
  }
  return card;
}

export function renderDashboard(container, events, settings, { onToggle, referenceDate = new Date(), onPrevWeek, onNextWeek, onToday }) {
  container.innerHTML = '';
  const { start: monday, end: sunday } = getWeekRange(referenceDate);
  const weekNum = getAcademicWeekNumber(monday, settings);
  const parity = getWeekParity(monday, settings);
  const parityLabel = parity === 'numerator' ? 'Числитель' : 'Знаменатель';

  const visible = events.filter((e) => {
    if (e.recurrence_rule) return false;
    if (!e.date) return false;
    const d = new Date(e.date);
    return d >= monday && d <= sunday;
  });

  const header = el('div', 'planner-header');
  header.appendChild(el('h1', null, `Мой планер — Саша • ${settings.group} • ${settings.semester_label}`));
  header.appendChild(el('div', 'planner-week', `Неделя ${weekNum} (${formatDateDDMM(monday)}–${formatDateDDMM(sunday)}) • ${parityLabel}`));

  const nav = el('div', 'week-nav');
  const prevBtn = document.createElement('button');
  prevBtn.type = 'button';
  prevBtn.textContent = '← Пред. неделя';
  prevBtn.addEventListener('click', () => onPrevWeek && onPrevWeek());
  nav.appendChild(prevBtn);

  const todayBtn = document.createElement('button');
  todayBtn.type = 'button';
  todayBtn.textContent = 'Текущая неделя';
  todayBtn.addEventListener('click', () => onToday && onToday());
  nav.appendChild(todayBtn);

  const nextBtn = document.createElement('button');
  nextBtn.type = 'button';
  nextBtn.textContent = 'След. неделя →';
  nextBtn.addEventListener('click', () => onNextWeek && onNextWeek());
  nav.appendChild(nextBtn);

  header.appendChild(nav);
  container.appendChild(header);

  const weekProgress = computeProgress(visible, settings.required_weight, settings.task_weight);
  const weekStats = el('div', 'week-stats');
  weekStats.appendChild(el('span', null, `Прогресс недели: ${formatPercent(weekProgress.percent)}`));
  weekStats.appendChild(el('span', null, renderBar(weekProgress.percent)));
  weekStats.appendChild(el('span', null, `Обязательные ${weekProgress.reqDone}/${weekProgress.reqTotal} • Задачи ${weekProgress.taskDone}/${weekProgress.taskTotal}`));
  container.appendChild(weekStats);

  const grid = el('div', 'day-grid');
  WEEKDAY_ORDER.forEach((code, i) => {
    const dayDate = new Date(monday);
    dayDate.setDate(monday.getDate() + i);
    const dayEvents = visible.filter((e) => dateKey(e.date) === dateKey(dayDate));
    grid.appendChild(renderDayCard(code, dayDate, dayEvents, settings, onToggle));
  });
  container.appendChild(grid);
}
