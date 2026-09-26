export function fitFontSize(fits, { min, max, step }) {
  const steps = Math.round((max - min) / step);
  let lo = 0;
  let hi = steps;
  if (fits(max)) return max;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (fits(min + mid * step)) lo = mid;
    else hi = mid - 1;
  }
  return min + lo * step;
}

export function fitTextIn(container, selector, { min = 7, max = 13, step = 0.5 } = {}) {
  container.querySelectorAll(selector).forEach((el) => {
    const fits = (size) => {
      el.style.fontSize = `${size}px`;
      return el.scrollHeight <= el.clientHeight + 1 && el.scrollWidth <= el.clientWidth + 1;
    };
    el.style.fontSize = `${fitFontSize(fits, { min, max, step })}px`;
  });
}
