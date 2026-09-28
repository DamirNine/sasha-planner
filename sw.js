const VERSION = '2.4.2';
const CACHE = `sp-code-${VERSION}`;
const FILES = [
  './',
  './index.html',
  './styles.css',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
  './apple-touch-icon.png',
  './js/config.js',
  './js/dateUtils.js',
  './js/recurrence.js',
  './js/eventOps.js',
  './js/localStore.js',
  './js/github.js',
  './js/sharedSync.js',
  './js/planner.js',
  './js/layout.js',
  './js/setup.js',
  './js/gestures.js',
  './js/pwa.js',
  './js/version.js',
  './js/main.js',
  './js/render/dom.js',
  './js/render/toast.js',
  './js/render/schedule.js',
  './js/forms.js',
  './js/render/editor.js',
  './js/render/addForm.js',
  './js/render/deleteSheet.js',
  './js/render/settings.js',
  './js/render/pager.js',
  './js/hyphenate.js',
  './js/render/menu.js',
  './js/fitText.js',
  './js/reminders.js',
  './js/push.js',
  './js/render/remindersField.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(FILES.map((f) => new Request(f, { cache: 'reload' })))),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('sp-code-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.includes('/data/')) return;
  if (event.request.mode === 'navigate') {
    event.respondWith(caches.match('./index.html').then((r) => r || fetch(event.request)));
    return;
  }
  event.respondWith(caches.match(event.request, { ignoreSearch: true }).then((r) => r || fetch(event.request)));
});

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : '' };
  }
  event.waitUntil(self.registration.showNotification(data.title || 'Расписание', {
    body: data.body || '',
    icon: './icon-192.png',
    badge: './icon-192.png',
    data: { url: data.url || './' },
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || './', self.registration.scope).href;
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    const client = list[0];
    if (!client) return self.clients.openWindow(url);
    return client.navigate(url).then((c) => (c || client).focus()).catch(() => self.clients.openWindow(url));
  }));
});
