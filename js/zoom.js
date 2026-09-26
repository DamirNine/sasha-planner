export const MIN_ZOOM = 1;
export const MAX_ZOOM = 3;

export function pinchZoom(startZoom, startDist, dist) {
  if (!startDist) return startZoom;
  const z = Math.round(startZoom * (dist / startDist) * 100) / 100;
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));
}

export function isDoubleTap(prev, tap, { maxMs = 300, maxDist = 30 } = {}) {
  return Boolean(prev) && tap.t - prev.t <= maxMs && Math.hypot(tap.x - prev.x, tap.y - prev.y) <= maxDist;
}

function fingerDistance(touches) {
  return Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY);
}

export function attachPinchZoom(el, { getZoom, onZoom, onZoomEnd, onDoubleTap }) {
  let pinch = null;
  let tapStart = null;
  let lastTap = null;
  el.addEventListener('touchstart', (e) => {
    if (e.touches.length === 2) {
      pinch = { zoom: getZoom(), dist: fingerDistance(e.touches) };
      tapStart = null;
      lastTap = null;
    } else if (e.touches.length === 1) {
      tapStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
  }, { passive: true });
  el.addEventListener('touchmove', (e) => {
    if (!pinch || e.touches.length !== 2) return;
    e.preventDefault();
    onZoom(pinchZoom(pinch.zoom, pinch.dist, fingerDistance(e.touches)));
  }, { passive: false });
  el.addEventListener('touchend', (e) => {
    if (pinch) {
      if (e.touches.length < 2) {
        pinch = null;
        onZoomEnd();
      }
      return;
    }
    const t = e.changedTouches[0];
    const moved = !tapStart || Math.hypot(t.clientX - tapStart.x, t.clientY - tapStart.y) > 10;
    tapStart = null;
    if (moved || e.touches.length !== 0 || e.target.closest('button')) {
      lastTap = null;
      return;
    }
    const tap = { t: e.timeStamp, x: t.clientX, y: t.clientY };
    if (isDoubleTap(lastTap, tap)) {
      lastTap = null;
      onDoubleTap();
    } else {
      lastTap = tap;
    }
  }, { passive: true });
  el.addEventListener('dblclick', (e) => {
    if (!e.target.closest('button')) onDoubleTap();
  });
  document.addEventListener('gesturestart', (e) => e.preventDefault());
}
