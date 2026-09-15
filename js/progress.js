export function computeProgress(events, requiredWeight, taskWeight) {
  const required = events.filter((e) => e.progress_group === 'required');
  const tasks = events.filter((e) => e.progress_group === 'task');
  const reqDone = required.filter((e) => e.completed === true).length;
  const taskDone = tasks.filter((e) => e.completed === true).length;

  let percent;
  if (required.length > 0 && tasks.length > 0) {
    percent = requiredWeight * (reqDone / required.length) + taskWeight * (taskDone / tasks.length);
  } else if (required.length > 0) {
    percent = reqDone / required.length;
  } else if (tasks.length > 0) {
    percent = taskDone / tasks.length;
  } else {
    percent = null;
  }

  return { reqDone, reqTotal: required.length, taskDone, taskTotal: tasks.length, percent };
}

export function renderBar(percent) {
  if (percent === null) return '——————————';
  const filled = Math.round(percent * 10);
  return '●'.repeat(filled) + '○'.repeat(10 - filled);
}

export function formatPercent(percent) {
  return percent === null ? 'Свободно' : `${Math.round(percent * 100)}%`;
}
