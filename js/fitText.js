export function linesThatFit(availablePx, lineHeightPx) {
  return Math.max(1, Math.floor((availablePx + 0.5) / lineHeightPx));
}

// Every block keeps the same font size; a title that does not fit is cut to the lines that do, ending with «…».
export function clampTitlesIn(container, itemSelector, titleSelector) {
  container.querySelectorAll(itemSelector).forEach((item) => {
    const title = item.querySelector(titleSelector);
    if (!title) return;
    const box = getComputedStyle(item);
    const gap = parseFloat(box.rowGap) || 0;
    const others = [...item.children].filter((el) => el !== title);
    const used = others.reduce((sum, el) => sum + el.offsetHeight + gap, 0);
    const available = item.clientHeight - parseFloat(box.paddingTop) - parseFloat(box.paddingBottom) - used;
    title.style.webkitLineClamp = String(linesThatFit(available, parseFloat(getComputedStyle(title).lineHeight)));
  });
}
