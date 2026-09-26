import { h } from './dom.js';
import { decideSwipe } from '../gestures.js';

const SETTLE_MS = 280;

export function createPager(host, { renderPage, onCommit, canSwipe = () => true }) {
  const pages = [
    h('div', { class: 'pager-page' }),
    h('div', { class: 'pager-page current' }),
    h('div', { class: 'pager-page' }),
  ];
  const track = h('div', { class: 'pager-track' }, ...pages);
  let drag = null;
  let busy = false;
  let suppressClick = false;

  const width = () => host.clientWidth || 1;

  function setOffset(px, animate) {
    track.style.transition = animate ? `transform ${SETTLE_MS}ms cubic-bezier(0.2, 0.7, 0.3, 1)` : 'none';
    track.style.transform = `translateX(calc(-100% / 3 + ${px}px))`;
  }

  function render() {
    if (track.parentNode !== host) host.replaceChildren(track);
    pages.forEach((page, i) => renderPage(page, i - 1));
    track.classList.remove('dragging');
    setOffset(0, false);
  }

  function settle(direction) {
    busy = true;
    const target = direction === 'next' ? -width() : direction === 'prev' ? width() : 0;
    setOffset(target, true);
    setTimeout(() => {
      busy = false;
      if (direction) onCommit(direction);
      else track.classList.remove('dragging');
    }, SETTLE_MS);
  }

  host.addEventListener('pointerdown', (e) => {
    if (!e.isPrimary) {
      if (drag?.locked === 'h') settle(null);
      drag = null;
      return;
    }
    if (busy || !canSwipe()) return;
    drag = { id: e.pointerId, x0: e.clientX, y0: e.clientY, t0: e.timeStamp, dx: 0, dy: 0, locked: null };
  });

  host.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    drag.dx = e.clientX - drag.x0;
    drag.dy = e.clientY - drag.y0;
    if (!drag.locked && Math.hypot(drag.dx, drag.dy) > 8) {
      drag.locked = Math.abs(drag.dx) > Math.abs(drag.dy) ? 'h' : 'v';
      if (drag.locked === 'v') {
        drag = null;
        return;
      }
      track.classList.add('dragging');
      host.setPointerCapture?.(e.pointerId);
    }
    if (drag.locked === 'h') setOffset(drag.dx, false);
  });

  host.addEventListener('pointerup', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag;
    drag = null;
    if (d.locked !== 'h') return;
    suppressClick = true;
    setTimeout(() => { suppressClick = false; }, 0);
    settle(decideSwipe({ dx: d.dx, dy: d.dy, dt: e.timeStamp - d.t0, width: width() }));
  });

  host.addEventListener('pointercancel', () => {
    if (drag?.locked === 'h') settle(null);
    drag = null;
  });

  host.addEventListener('click', (e) => {
    if (!suppressClick) return;
    e.stopPropagation();
    e.preventDefault();
    suppressClick = false;
  }, true);

  window.addEventListener('resize', () => {
    if (!drag && !busy) setOffset(0, false);
  });

  return {
    render,
    current: () => pages[1],
    message(node) {
      host.replaceChildren(node);
    },
  };
}
