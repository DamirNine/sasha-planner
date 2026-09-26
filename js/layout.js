export function toMinutes(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

export function gridBounds(occurrences, { defaultStart = 8 * 60, defaultEnd = 20 * 60 } = {}) {
  let start = defaultStart;
  let end = defaultEnd;
  for (const o of occurrences) {
    if (!o.start_time) continue;
    const s = toMinutes(o.start_time);
    const e = o.end_time ? toMinutes(o.end_time) : s + 60;
    start = Math.min(start, Math.floor(s / 60) * 60);
    end = Math.max(end, Math.ceil(e / 60) * 60);
  }
  return { start, end };
}

export function assignLanes(items) {
  const sorted = [...items].sort((a, b) => a.start - b.start || a.end - b.end);
  const out = [];
  let cluster = [];
  let laneEnds = [];
  let clusterEnd = -Infinity;
  const flush = () => {
    cluster.forEach((p) => out.push({ ...p, laneCount: laneEnds.length }));
    cluster = [];
    laneEnds = [];
  };
  for (const item of sorted) {
    if (item.start >= clusterEnd) flush();
    let lane = laneEnds.findIndex((end) => end <= item.start);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(item.end);
    } else {
      laneEnds[lane] = item.end;
    }
    cluster.push({ ...item, lane });
    clusterEnd = cluster.length === 1 ? item.end : Math.max(clusterEnd, item.end);
  }
  flush();
  return out;
}
