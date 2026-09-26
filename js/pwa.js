let deferredPrompt = null;

export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return null;
  return navigator.serviceWorker.register('./sw.js');
}

function waitForInstalled(worker) {
  return new Promise((resolve) => {
    worker.addEventListener('statechange', () => {
      if (worker.state === 'installed') resolve(worker);
      if (worker.state === 'redundant') resolve(null);
    });
  });
}

export async function checkForUpdate(registration, { sw = navigator.serviceWorker, reload = () => location.reload() } = {}) {
  await registration.update();
  let waiting = registration.waiting;
  if (!waiting && registration.installing) {
    waiting = await waitForInstalled(registration.installing);
    if (!waiting) return 'failed';
  }
  if (!waiting || !sw.controller) return 'latest';
  sw.addEventListener('controllerchange', reload, { once: true });
  waiting.postMessage('SKIP_WAITING');
  return 'updating';
}

export function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
}

export function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

export function listenForInstallPrompt(onChange) {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    onChange('available');
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    onChange('installed');
  });
}

export async function promptInstall() {
  if (!deferredPrompt) return false;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  return true;
}
