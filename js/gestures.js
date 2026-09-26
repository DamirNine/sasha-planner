export function classifySwipe(dx, dy, threshold = 50) {
  if (Math.abs(dx) < threshold || Math.abs(dx) <= Math.abs(dy)) return null;
  return dx < 0 ? 'next' : 'prev';
}

export function classifyPull(dx, dy, atTop, threshold = 80) {
  return atTop && dy > threshold && dy > Math.abs(dx) * 1.5;
}

export function attachSwipe(el, onSwipe) {
  let start = null;
  let suppressClick = false;
  el.addEventListener('pointerdown', (e) => {
    if (!e.isPrimary) return;
    start = { x: e.clientX, y: e.clientY };
  });
  el.addEventListener('pointerup', (e) => {
    if (!start) return;
    const direction = classifySwipe(e.clientX - start.x, e.clientY - start.y);
    start = null;
    if (!direction) return;
    suppressClick = true;
    setTimeout(() => { suppressClick = false; }, 0);
    onSwipe(direction);
  });
  el.addEventListener('pointercancel', () => { start = null; });
  el.addEventListener('click', (e) => {
    if (!suppressClick) return;
    e.stopPropagation();
    e.preventDefault();
    suppressClick = false;
  }, true);
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
