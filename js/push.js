import { WORKER_URL, VAPID_PUBLIC_KEY } from './config.js';
import { normalizeOffsets } from './reminders.js';

export function urlBase64ToUint8Array(s) {
  const padded = s + '='.repeat((4 - (s.length % 4)) % 4);
  const binary = atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

export function buildRegisterBody({ deviceId, token, subscription, utcOffsetMinutes, reminders, personal, shared }) {
  const personalById = new Map(personal.map((e) => [e.event_id, e]));
  const sharedIds = new Set(shared.map((e) => e.event_id));
  const list = [];
  for (const [id, offsets] of Object.entries(reminders)) {
    const clean = normalizeOffsets(offsets);
    if (!clean.length) continue;
    if (personalById.has(id)) list.push({ event_id: id, offsets: clean, personalEvent: personalById.get(id) });
    else if (sharedIds.has(id)) list.push({ event_id: id, offsets: clean });
  }
  return { deviceId, token, subscription, utcOffsetMinutes, reminders: list };
}

export function notificationSupport({ win = globalThis } = {}) {
  const nav = win.navigator || {};
  if (!('Notification' in win) || !('serviceWorker' in nav) || !('PushManager' in win)) {
    return /iphone|ipad|ipod/i.test(nav.userAgent || '') ? 'ios-not-installed' : 'unsupported';
  }
  if (win.Notification.permission === 'granted') return 'ok';
  return win.Notification.permission === 'denied' ? 'denied' : 'ask';
}

async function ensureSubscription(registration) {
  if (Notification.permission !== 'granted' && (await Notification.requestPermission()) !== 'granted') return null;
  const existing = await registration.pushManager.getSubscription();
  if (existing) return existing;
  return registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) });
}

async function post(path, body) {
  try {
    const res = await fetch(`${WORKER_URL}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (res.status === 403) return 'auth';
    return res.ok ? 'ok' : 'error';
  } catch {
    return 'offline';
  }
}

async function subscriptionFor(registration, interactive) {
  if (!registration || notificationSupport() === 'unsupported' || notificationSupport() === 'ios-not-installed') return null;
  const existing = await registration.pushManager.getSubscription();
  if (existing || !interactive) return existing;
  return ensureSubscription(registration);
}

export async function syncReminders({ registration, token, deviceId, reminders, personal, shared, interactive = false }) {
  const hasAny = Object.keys(reminders).length > 0;
  if (!token) return hasAny ? 'auth' : 'ok';
  const subscription = await subscriptionFor(registration, interactive && hasAny);
  if (!subscription) return hasAny ? 'denied' : 'ok';
  if (!hasAny) return post('/unregister', { deviceId, token });
  const body = buildRegisterBody({ deviceId, token, subscription: subscription.toJSON(), utcOffsetMinutes: -new Date().getTimezoneOffset(), reminders, personal, shared });
  return post('/register', body);
}

export async function sendTestPush({ registration, token, deviceId, reminders, personal, shared }) {
  if (!token) return 'auth';
  const subscription = await subscriptionFor(registration, true);
  if (!subscription) return 'denied';
  const body = buildRegisterBody({ deviceId, token, subscription: subscription.toJSON(), utcOffsetMinutes: -new Date().getTimezoneOffset(), reminders, personal, shared });
  const registered = await post('/register', body);
  if (registered !== 'ok') return registered;
  return post('/test', { deviceId, token });
}
