# Мой планер — Саша

Личный недельный планер (РК6-55Б, осень 2026). Статический сайт, данные —
в `data/db.json` этого репозитория.

## Как включить сохранение

1. GitHub → Settings → Developer settings → Fine-grained tokens → Generate new token.
2. Repository access → Only select repositories → `sasha-planner`.
3. Permissions → Contents → Read and write.
4. Создай токен, скопируй его.
5. Открой сайт → внизу поле «GitHub токен» → вставь → «Сохранить токен».

Токен остаётся только в localStorage твоего браузера — не в этом репозитории.
Без токена сайт открывается в режиме «только чтение»: расписание видно, но
кнопка «Сохранить» и автосейв покажут ошибку.

## Локальный запуск

```bash
python -m http.server 8000
```

Открой `http://localhost:8000/`.

## Тесты

```bash
npm test
```
