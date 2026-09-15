export const OWNER = 'DamirNine';
export const REPO = 'sasha-planner';
export const DB_PATH = 'data/db.json';
export const SETTINGS_PATH = 'data/settings.json';
export const TOKEN_STORAGE_KEY = 'sasha_planner_gh_token';

export const WEEKDAY_ORDER = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];

export const WEEKDAY_LABELS_RU = {
  MO: 'ПОНЕДЕЛЬНИК',
  TU: 'ВТОРНИК',
  WE: 'СРЕДА',
  TH: 'ЧЕТВЕРГ',
  FR: 'ПЯТНИЦА',
  SA: 'СУББОТА',
  SU: 'ВОСКРЕСЕНЬЕ',
};

export const EVENT_TYPES = {
  lecture: { label: 'Лекция', color: '#D6E9F8' },
  seminar: { label: 'Семинар', color: '#FBE3D4' },
  lab: { label: 'Лабораторная', color: '#E5DBF5' },
  sport: { label: 'Спорт', color: '#D9F2E3' },
  vuc: { label: 'ВУЦ', color: '#DCE4EC' },
  consultation: { label: 'Консультация', color: '#D3F0EE' },
  tutoring: { label: 'Репетиторство', color: '#F3DCE3' },
  selfstudy: { label: 'Самостоятельная работа', color: '#FBF2D0' },
  trip: { label: 'Поездка', color: '#EDE3D0' },
  task: { label: 'Личная задача', color: '#E4EFE0' },
  other: { label: 'Другое', color: '#F0EAD9' },
};
