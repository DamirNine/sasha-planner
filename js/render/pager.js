import { h } from './dom.js';
import { decideSwipe, lockDirection } from '../gestures.js';

const SETTLE_MS = 170;

export function createPager(host, { renderPage, onCommit, canSwipe = () => true }) {
  const pages = [
    h('div', { class: 'pager-page' }),
    h('div', { class: 'pager-page current' }),
    h('div', { class: 'pager-page' }),
  ];
  const track = h('div', { class: 'pager-track' }, ...pages);
  let drag = null;
  let pending = null;
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

  function completePending() {
    if (!pending) return;
    const { direction, timer } = pending;
    pending = null;
    clearTimeout(timer);
    if (direction) onCommit(direction);
    else track.classList.remove('dragging');
  }

  function settle(direction) {
    const target = direction === 'next' ? -width() : direction === 'prev' ? width() : 0;
    setOffset(target, true);
    pending = { direction, timer: setTimeout(completePending, SETTLE_MS) };
  }

  function begin(x, y, t) {
    completePending();
    if (!canSwipe()) return;
    drag = { x0: x, y0: y, t0: t, dx: 0, dy: 0, locked: null };
  }

  function follow(x, y, event) {
    if (!drag) return;
    drag.dx = x - drag.x0;
    drag.dy = y - drag.y0;
    if (!drag.locked) {
      const dir = lockDirection(drag.dx, drag.dy);
      if (!dir) return;
      if (dir === 'v') {
        drag = null;
        return;
      }
      drag.locked = 'h';
      track.classList.add('dragging');
    }
    if (event.cancelable) event.preventDefault();
    setOffset(drag.dx, false);
  }

  function finish(t) {
    if (!drag) return;
    const d = drag;
    drag = null;
    if (d.locked !== 'h') return;
    suppressClick = true;
    setTimeout(() => { suppressClick = false; }, 0);
    settle(decideSwipe({ dx: d.dx, dy: d.dy, dt: t - d.t0, width: width() }));
  }

  function abort() {
    if (drag?.locked === 'h') settle(null);
    drag = null;
  }

  host.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) {
      abort();
      return;
    }
    begin(e.touches[0].clientX, e.touches[0].clientY, e.timeStamp);
  }, { passive: true });
  host.addEventListener('touchmove', (e) => {
    if (e.touches.length !== 1) {
      abort();
      return;
    }
    follow(e.touches[0].clientX, e.touches[0].clientY, e);
  }, { passive: false });
  host.addEventListener('touchend', (e) => finish(e.timeStamp), { passive: true });
  host.addEventListener('touchcancel', abort, { passive: true });

  host.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'mouse') return;
    begin(e.clientX, e.clientY, e.timeStamp);
  });
  host.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse' || !drag) return;
    const wasLocked = drag.locked;
    follow(e.clientX, e.clientY, e);
    if (!wasLocked && drag?.locked) host.setPointerCapture?.(e.pointerId);
  });
  host.addEventListener('pointerup', (e) => {
    if (e.pointerType === 'mouse') finish(e.timeStamp);
  });

  host.addEventListener('click', (e) => {
    if (!suppressClick) return;
    e.stopPropagation();
    e.preventDefault();
    suppressClick = false;
  }, true);

  window.addEventListener('resize', () => {
    if (!drag && !pending) setOffset(0, false);
  });

  return {
    render,
    current: () => pages[1],
    message(node) {
      host.replaceChildren(node);
    },
  };
}
