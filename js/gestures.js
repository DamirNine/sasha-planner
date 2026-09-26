export function decideSwipe({ dx, dy, dt, width }) {
  if (Math.abs(dx) <= Math.abs(dy)) return null;
  const far = Math.abs(dx) > width * 0.25;
  const flick = Math.abs(dx) > 30 && Math.abs(dx) / Math.max(dt, 1) > 0.5;
  if (!far && !flick) return null;
  return dx < 0 ? 'next' : 'prev';
}

export function classifyPull(dx, dy, atTop, threshold = 80) {
  return atTop && dy > threshold && dy > Math.abs(dx) * 1.5;
}

export function attachPullToRefresh(el, onRefresh) {
  let start = null;
  el.addEventListener('touchstart', (e) => {
    start = e.touches.length === 1
      ? { x: e.touches[0].clientX, y: e.touches[0].clientY, atTop: window.scrollY <= 0 }
      : null;
  }, { passive: true });
  el.addEventListener('touchend', (e) => {
    if (!start) return;
    const t = e.changedTouches[0];
    if (classifyPull(t.clientX - start.x, t.clientY - start.y, start.atTop)) onRefresh();
    start = null;
  }, { passive: true });
}
