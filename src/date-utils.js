export function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function parseDate(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export function getRangeDates(period, referenceDate = new Date()) {
  const today = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());
  let start;
  let end;

  if (period === "week") {
    const dayOfWeek = today.getDay(); // 0=Sun..6=Sat
    const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    start = addDays(today, -diffToMonday);
    end = addDays(start, 6);
  } else if (period === "month") {
    start = new Date(today.getFullYear(), today.getMonth(), 1);
    end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  } else if (period === "year") {
    start = new Date(today.getFullYear(), 0, 1);
    end = new Date(today.getFullYear(), 11, 31);
  } else {
    throw new Error(`Unknown period: ${period}`);
  }

  if (end > today) end = today;

  const dates = [];
  for (let d = new Date(start); d <= end; d = addDays(d, 1)) {
    dates.push(formatDate(d));
  }
  return dates;
}

export function calcStreak(doneDates, referenceDate = new Date()) {
  const doneSet = new Set(doneDates);
  const today = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());

  let current = 0;
  let cursor = doneSet.has(formatDate(today)) ? today : addDays(today, -1);
  while (doneSet.has(formatDate(cursor))) {
    current++;
    cursor = addDays(cursor, -1);
  }

  const sortedDates = [...doneSet].sort();
  let longest = 0;
  let run = 0;
  let prev = null;
  for (const dateStr of sortedDates) {
    if (prev !== null && formatDate(addDays(parseDate(prev), 1)) === dateStr) {
      run++;
    } else {
      run = 1;
    }
    longest = Math.max(longest, run);
    prev = dateStr;
  }

  return { current, longest };
}
