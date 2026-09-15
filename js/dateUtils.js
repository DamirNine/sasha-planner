export function toDateOnly(d) {
  if (typeof d === 'string') {
    const m = d.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  }
  const date = new Date(d);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function dateKey(d) {
  const date = toDateOnly(d);
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function formatDateDDMM(d) {
  const date = toDateOnly(d);
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  return `${dd}.${mm}`;
}

export function getWeekMonday(d) {
  const date = toDateOnly(d);
  const jsDay = date.getDay();
  const mondayOffset = jsDay === 0 ? -6 : 1 - jsDay;
  date.setDate(date.getDate() + mondayOffset);
  return date;
}

export function getWeekRange(d) {
  const start = getWeekMonday(d);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return { start, end };
}

function weeksBetweenMondays(monday, refMonday) {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((monday - refMonday) / (7 * msPerDay));
}

export function getAcademicWeekNumber(d, settings) {
  const monday = getWeekMonday(d);
  const ref = toDateOnly(settings.reference_monday);
  return weeksBetweenMondays(monday, ref) + 1;
}

export function getWeekParity(d, settings) {
  const monday = getWeekMonday(d);
  const ref = toDateOnly(settings.reference_monday);
  const diff = weeksBetweenMondays(monday, ref);
  const isRefParityWeek = ((diff % 2) + 2) % 2 === 0;
  const refParity = settings.reference_parity || 'numerator';
  if (isRefParityWeek) return refParity;
  return refParity === 'numerator' ? 'denominator' : 'numerator';
}
