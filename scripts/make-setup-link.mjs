import { mkdirSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { createInterface } from 'node:readline/promises';
import { buildSetupLink } from '../js/setup.js';

const SITE = 'https://damirnine.github.io/sasha-planner/';
const rl = createInterface({ input: process.stdin, output: process.stdout });
const token = (await rl.question('Вставь GitHub-токен и нажми Enter: ')).trim();
rl.close();
if (!/^[A-Za-z0-9_]+$/.test(token)) {
  console.error('Токен пустой или содержит неожиданные символы — ничего не создано.');
  process.exit(1);
}
const link = buildSetupLink(SITE, token);
mkdirSync('setup-out', { recursive: true });
writeFileSync('setup-out/setup-link.txt', `${link}\n`);
execSync(`npx --yes qrcode@1.5.4 -o setup-out/setup-qr.png "${link}"`, { stdio: 'ignore' });
console.clear();
console.log('Готово: setup-out/setup-link.txt и setup-out/setup-qr.png (папка в .gitignore).');
console.log('Открой QR камерой телефона. После настройки обоих телефонов удали папку setup-out.');
