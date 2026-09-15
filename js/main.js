import { OWNER, REPO, DB_PATH, SETTINGS_PATH } from './config.js';
import { createStore } from './store.js';
import { renderDashboard } from './render.js';
import { getToken, setToken, getFileSha, writeFile } from './github.js';

const RAW_BASE = `https://raw.githubusercontent.com/${OWNER}/${REPO}/main`;

async function readPublicJson(path) {
  const res = await fetch(`${RAW_BASE}/${path}?t=${Date.now()}`);
  if (!res.ok) throw new Error(`Не удалось прочитать ${path}: ${res.status}`);
  return res.json();
}

let cachedSha = null;

const store = createStore({
  readEvents: () => readPublicJson(DB_PATH),
  readSettings: () => readPublicJson(SETTINGS_PATH),
  writeEvents: async (events) => {
    const token = getToken();
    const sha = cachedSha || (await getFileSha(OWNER, REPO, DB_PATH, token));
    cachedSha = await writeFile(OWNER, REPO, DB_PATH, events, {
      token,
      sha,
      message: 'Обновление планера',
    });
  },
});

const statusEl = document.getElementById('save-status');
let referenceDate = new Date();

function render() {
  const { events, settings, dirty } = store.getState();
  renderDashboard(document.getElementById('app'), events, settings, {
    onToggle: (id, completed) => store.setEventCompleted(id, completed),
    referenceDate,
    onPrevWeek: () => {
      referenceDate = new Date(referenceDate);
      referenceDate.setDate(referenceDate.getDate() - 7);
      render();
    },
    onNextWeek: () => {
      referenceDate = new Date(referenceDate);
      referenceDate.setDate(referenceDate.getDate() + 7);
      render();
    },
    onToday: () => {
      referenceDate = new Date();
      render();
    },
  });
  statusEl.textContent = dirty ? 'Есть несохранённые изменения…' : 'Всё сохранено';
}

store.subscribe(render);

document.getElementById('save-button').addEventListener('click', () => {
  store.save().catch((err) => alert(err.message));
});

document.getElementById('token-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const input = document.getElementById('token-input');
  setToken(input.value.trim());
  input.value = '';
  alert('Токен сохранён в этом браузере.');
});

store.load().catch((err) => {
  document.getElementById('app').textContent = `Ошибка загрузки: ${err.message}`;
});
