import { h } from './dom.js';
import { VIEW_MODES } from '../localStore.js';

const TOKEN_LABELS = { ok: 'установлен ✓', missing: 'не установлен', invalid: 'не подходит ✗' };

const MODE_LABELS = { day1: '1 день', day2: '2 дня', week_grid: 'Неделя', week_list: 'Неделя списком' };

export function renderSettings(el, { mode, tokenStatus, version, onBack, onMode, onSaveToken, onEdit, onUpdate, onExport, onImport }) {
  const tokenInput = h('input', { type: 'password', placeholder: 'Вставьте ссылку настройки или токен', autocomplete: 'off' });
  const tokenForm = h('form', {
    class: 'token-form',
    hidden: true,
    onsubmit: (e) => {
      e.preventDefault();
      const value = tokenInput.value.trim();
      if (value) onSaveToken(value);
    },
  }, tokenInput, h('button', { type: 'submit', class: 'primary' }, 'Сохранить токен'));

  const fileInput = h('input', {
    type: 'file',
    accept: 'application/json,.json',
    hidden: true,
    onchange: () => {
      const file = fileInput.files[0];
      if (file) onImport(file);
      fileInput.value = '';
    },
  });

  el.replaceChildren(
    h('button', { type: 'button', class: 'back-button', onclick: onBack }, '‹ Расписание'),
    h('h1', {}, 'Настройки'),
    h('div', { class: 'section-title' }, 'Сколько показывать на экране'),
    h('div', { class: 'settings-group' },
      h('div', { class: 'segmented' }, ...VIEW_MODES.map((m) => h('button', {
        type: 'button',
        class: m === mode ? 'active' : '',
        onclick: () => onMode(m),
      }, MODE_LABELS[m])))),
    h('div', { class: 'settings-group' },
      h('button', { type: 'button', class: 'settings-row', onclick: onEdit }, h('span', {}, 'Редактировать события'), h('span', { class: 'muted' }, '›')),
      h('button', { type: 'button', class: 'settings-row', onclick: () => { tokenForm.hidden = !tokenForm.hidden; } },
        h('span', {}, 'Токен GitHub'),
        h('span', { class: tokenStatus === 'invalid' ? 'danger-text' : 'muted' }, TOKEN_LABELS[tokenStatus])),
      tokenForm),
    h('div', { class: 'settings-group' },
      h('button', { type: 'button', class: 'settings-row', onclick: onUpdate }, h('span', {}, 'Обновить приложение'), h('span', { class: 'muted' }, `версия ${version}`))),
    h('div', { class: 'section-title' }, 'Резервная копия личного'),
    h('div', { class: 'settings-group' },
      h('button', { type: 'button', class: 'settings-row', onclick: onExport }, h('span', {}, 'Экспорт личного'), h('span', { class: 'muted' }, '↓')),
      h('button', { type: 'button', class: 'settings-row', onclick: () => fileInput.click() }, h('span', {}, 'Импорт личного'), h('span', { class: 'muted' }, '↑')),
      fileInput),
    h('p', { class: 'muted small' }, 'Личные события и галочки хранятся только на этом телефоне. Обновление приложения их не удаляет.'),
  );
}
